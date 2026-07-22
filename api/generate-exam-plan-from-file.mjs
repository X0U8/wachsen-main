import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';
import { resolveAiConfig } from './lib/ai-config.mjs';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const DEDUCT_AMOUNT = 2;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subjects, examName, difficulty, userId, authToken, files } = req.body;

  const bodyDebug = { ...req.body };
  if (Array.isArray(bodyDebug.files)) {
    bodyDebug.files = bodyDebug.files.map(f => ({
      name: f.name,
      type: f.type,
      url: f.url,
      base64: f.base64 ? `[base64 string: ${f.base64.length} chars]` : undefined
    }));
  }
  console.log('[API PLAN SCAN] Handler started with payload:', JSON.stringify(bodyDebug, null, 2));

  const aiConfig = resolveAiConfig(req.body, {
    meshApiKey: MESH_API_KEY,
    meshApiUrl: MESH_API_URL,
    meshModel: MESH_MODEL
  });
  const isByok = aiConfig.mode === 'byok';

  const refundAllCredits = async () => {
    if (!isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
      try {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + DEDUCT_AMOUNT }).eq('id', userId);
      } catch (e) {
        console.error('Refund failed:', e);
      }
    }
  };

  try {
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'Invalid subjects data' });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one uploaded scanned question paper file is required.' });
    }

    if (!aiConfig.apiKey) {
      return res.status(500).json({ error: 'No API key provided. Set MESH_API_KEY in .env or provide an apiKey.' });
    }

    let maxQuestions = 15;
    if (supabaseUrl && supabaseAnonKey && userId && authToken) {
      try {
        const authed = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${authToken}` } }
        });
        const { data: profile } = await authed.from('profiles').select('credits, premium_type').eq('id', userId).single();
        const premiumType = (profile?.premium_type || '').toLowerCase();
        if (premiumType.includes('peak')) maxQuestions = 35;
        else if (premiumType.includes('rise')) maxQuestions = 25;
        else if (premiumType.includes('lite')) maxQuestions = 20;

        if (!isByok) {
          const currentCredits = profile?.credits || 0;
          if (currentCredits < DEDUCT_AMOUNT) {
            return res.status(400).json({ error: `Insufficient credits. Need ${DEDUCT_AMOUNT} credits. You have ${currentCredits}.` });
          }
          const { data: updated, error: deductError } = await authed.from('profiles')
            .update({ credits: currentCredits - DEDUCT_AMOUNT })
            .eq('id', userId)
            .select('credits');
          if (deductError || !updated || updated.length === 0) {
            return res.status(500).json({ error: 'Failed to reserve credits.' });
          }
        }
      } catch (err) {
        console.error('Error verifying user profile & credits:', err);
      }
    }


    const resolvedFiles = await resolveScannedFileUrls(files);
    const fileMappingsText = resolvedFiles.map((f, index) => `- Page ${index} (URL: ${f.url}) belongs to File "${f.name}" mapped to Subject "${f.subjectName || 'General'}"`).join('\n');

    const prompt = `You are a professional mock exam scanner. You are given a scanned question paper (as images) and the selected subjects with their requested question counts.

Subjects & requested question counts:
${subjects.map(s => `- ${s.name}: ${s.questionTypes[0]?.count || 5} questions`).join('\n')}

Attached Pages:
${fileMappingsText}

Your task is to scan the images and return the mapped question details and answer key pages.

QUESTION MAPPING:
1. Scan the images and identify where the questions for the selected subjects reside.
2. For each subject, find the questions starting from the first page and list them up to the requested count. For example, if Physics requested 15 questions, find the first 15 Physics questions.
3. For each found question, map:
   - "subject": which selected subject name it matches.
   - "original_label": the original label/question number printed on the page (e.g. "Q1", "1.", "a)").
   - "page_index": 0-based page index of the attached image where this question is located.
   - "subtopic": a brief 2-3 word subtopic of the question.
4. Search all pages carefully for an answer key or answers. If you find one, list the 0-based page index(es) in the "answer_key_pages" array. If no answer key is present, return an empty array [].
5. Return ONLY this raw mapping JSON (no markdown block fences, no triple backticks, keep it extremely brief):
{
  "success": true,
  "answer_key_pages": [4], 
  "mappings": [
    { "subject": "Physics", "original_label": "Q1", "page_index": 0, "subtopic": "Relative Velocity" },
    { "subject": "Physics", "original_label": "Q2", "page_index": 0, "subtopic": "Vertical Motion" }
  ]
}

STRICT RULE: Return ONLY the raw JSON object. Do NOT wrap it in markdown block fences (like triple backticks).`;

    const userMessageContent = [{ type: 'text', text: prompt }];
    resolvedFiles.forEach((f, idx) => {
      const imgUrl = f.base64 || f.url;
      if (imgUrl) {
        console.log(`[PLAN SCANNER] Page ${idx} size: ${imgUrl.startsWith('data:') ? `${(imgUrl.length / 1024).toFixed(1)} KB (base64)` : 'Direct B2 URL'}`);
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: imgUrl }
        });
      }
    });

    const messages = [
      { role: 'system', content: 'You are an expert mock exam scanner. You return only clean JSON responses.' },
      { role: 'user', content: userMessageContent }
    ];

    console.log(`\n=================== [PLAN SCANNER] SENDING TO GEMINI ===================`);
    console.log(`Model: ${aiConfig.model}`);
    console.log(`Prompt text length: ${prompt.length} chars`);
    console.log(`Prompt message content:`, JSON.stringify(prompt, null, 2));
    console.log(`========================================================================\n`);

    const response = await fetch(aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        ...(aiConfig.includeReasoningEffort && { reasoning_effort: "none" })
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[PLAN SCANNER] AI gateway returned HTTP ${response.status} Error:`, text);
      throw new Error(`AI gateway returned status ${response.status}: ${text}`);
    }

    const responseText = await response.text();
    console.log(`\n=================== [PLAN SCANNER] RAW RESPONSE RECEIVED ===================`);
    console.log(responseText);
    console.log(`============================================================================\n`);

    let content = '';
    try {
      const data = JSON.parse(responseText);
      content = data.choices?.[0]?.message?.content || '';
    } catch (parseErr) {
      console.error('[PLAN SCANNER] JSON Parse error:', parseErr);
      throw new Error('AI gateway response parse failed');
    }

    content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();

    let cleanJson;
    try {
      cleanJson = JSON.parse(jsonrepair(content));
      console.log(`[PLAN SCANNER] Repaired/Parsed JSON output:`, JSON.stringify(cleanJson, null, 2));
    } catch (e) {
      console.error('[PLAN SCANNER] Failed to parse repaired plan JSON. Content:', content);
      throw new Error('AI returned an invalid JSON schema');
    }

    if (cleanJson.success === false) {
      console.warn(`[PLAN SCANNER] AI returned success: false. Error details:`, cleanJson.error);
      await refundAllCredits();
      return res.status(400).json({ success: false, error: cleanJson.error || 'Failed to detect questions in the document.' });
    }


    const mappings = cleanJson.mappings || [];
    if (mappings.length === 0) {
      console.warn(`[PLAN SCANNER] Programmatic planning aborted: mappings array is empty.`);
      await refundAllCredits();
      return res.status(400).json({ success: false, error: 'No questions matching your selected subjects were detected in the uploaded document page scans.' });
    }
    const answerKeyPages = cleanJson.answer_key_pages || [];

    const subjectsMap = {};
    mappings.forEach(m => {
      if (!subjectsMap[m.subject]) {
        subjectsMap[m.subject] = [];
      }
      subjectsMap[m.subject].push(m);
    });

    let currentQuestionIndex = 1;
    const plannedSubjects = [];

    subjects.forEach(sub => {
      const subMappings = subjectsMap[sub.name] || [];
      const segments = [];
      const totalQs = subMappings.length;
      const numSegments = Math.ceil(totalQs / 5);

      for (let i = 0; i < numSegments; i++) {
        const segmentQs = subMappings.slice(i * 5, (i + 1) * 5);
        if (segmentQs.length === 0) continue;


        if (segmentQs.length < 5) {
          continue;
        }

        const start = currentQuestionIndex;
        const end = start + 4;

        const uniquePages = [...new Set(segmentQs.map(q => q.page_index))];
        answerKeyPages.forEach(p => {
          if (!uniquePages.includes(p)) uniquePages.push(p);
        });

        segments.push({
          range: `${start}-${end}`,
          type: 'mcq',
          topics: [...new Set(segmentQs.map(q => q.subtopic || 'General'))],
          page_indexes: uniquePages,
          questions_metadata: segmentQs.map((q, idx) => ({
            index: start + idx,
            subtopic: q.subtopic || 'General',
            page_index: q.page_index,
            original_label: q.original_label
          }))
        });

        currentQuestionIndex = end + 1;
      }

      plannedSubjects.push({
        name: sub.name,
        segments: segments
      });
    });

    const finalPlan = {
      subjects: plannedSubjects
    };

    return res.status(200).json({ success: true, plan: finalPlan });
  } catch (error) {
    console.error('Error generating plan blueprint:', error);
    await refundAllCredits();
    return res.status(500).json({ error: error.message || 'Failed to generate plan blueprint' });
  }
}

async function resolveScannedFileUrls(files) {
  const b2KeyId = process.env.B2_KEY_ID;
  const b2AppKey = process.env.B2_APPLICATION_KEY;
  const b2BucketId = process.env.B2_BUCKET_ID;
  const b2BucketName = process.env.B2_BUCKET_NAME;

  if (!b2KeyId || !b2AppKey || !b2BucketId || !b2BucketName) {
    return files;
  }

  try {
    const authCredentials = Buffer.from(`${b2KeyId}:${b2AppKey}`).toString('base64');
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${authCredentials}` }
    });
    if (!authResponse.ok) return files;
    const authData = await authResponse.json();
    const { apiInfo, authorizationToken: accountToken } = authData;
    const { apiUrl, downloadUrl } = apiInfo.storageApi;

    const resolved = [];
    for (const f of files) {
      if (f.url && f.url.includes('/api/upload-to-b2')) {
        const urlObj = new URL(f.url, 'http://localhost');
        const fileName = urlObj.searchParams.get('path');
        if (fileName) {
          const downloadAuthResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
            method: 'POST',
            headers: {
              'Authorization': accountToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              bucketId: b2BucketId,
              fileNamePrefix: fileName,
              validDurationInSeconds: 7200
            })
          });
          if (downloadAuthResponse.ok) {
            const downloadAuthData = await downloadAuthResponse.json();
            const downloadToken = downloadAuthData.authorizationToken;
            const secureUrl = `${downloadUrl}/file/${b2BucketName}/${fileName}?Authorization=${downloadToken}`;
            resolved.push({ ...f, url: secureUrl });
            continue;
          }
        }
      }
      resolved.push(f);
    }
    return resolved;
  } catch (err) {
    console.error('Error resolving B2 secure URLs:', err);
    return files;
  }
}
