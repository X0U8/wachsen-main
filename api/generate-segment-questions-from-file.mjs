import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';
import { resolveAiConfig } from './lib/ai-config.mjs';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bodyDebug = { ...req.body };
  if (Array.isArray(bodyDebug.files)) {
    bodyDebug.files = bodyDebug.files.map(f => ({
      name: f.name,
      type: f.type,
      url: f.url,
      base64: f.base64 ? `[base64 string: ${f.base64.length} chars]` : undefined
    }));
  }
  console.log('[API SEGMENT EXTRACT] Handler started with payload:', JSON.stringify(bodyDebug, null, 2));

  try {
    const { segment, subjectName, subjectIndex, questionTypes, difficulty, academicLevel, userId, authToken, creditsPreReserved, files } = req.body;
    const aiConfig = resolveAiConfig(req.body, {
      meshApiKey: MESH_API_KEY,
      meshApiUrl: MESH_API_URL,
      meshModel: MESH_MODEL
    });
    const isByok = aiConfig.mode === 'byok';

    if (!segment || !subjectName || !files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Invalid segment or files data' });
    }

    if (!aiConfig.apiKey) {
      return res.status(500).json({ error: 'No API key provided.' });
    }

    const [segStart, segEnd] = (segment.range || '1-1').split('-').map(Number);
    const questionCount = (segEnd || segStart) - segStart + 1;

    const refundCredits = async () => {
      if (creditsPreReserved) return;
      if (!isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
        try {
          const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
          const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
          await authed.from('profiles').update({ credits: (profile?.credits || 0) + questionCount }).eq('id', userId);
        } catch (e) {
          console.error('Credit refund failed:', e);
        }
      }
    };

    if (!creditsPreReserved && !isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
      const authed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
      const currentCredits = profile?.credits || 0;
      if (currentCredits < questionCount) {
        return res.status(400).json({ error: `Insufficient credits. Need ${questionCount} credits. You have ${currentCredits}.` });
      }
      const { data: updated, error: deductError } = await authed.from('profiles')
        .update({ credits: currentCredits - questionCount })
        .eq('id', userId)
        .select('credits');
      if (deductError || !updated || updated.length === 0) {
        return res.status(500).json({ error: 'Failed to reserve credits.' });
      }
    }

    const segmentType = (segment.type || 'mcq').toLowerCase().trim();
    const hasMcq = segmentType === 'mcq';
    const hasInteger = segmentType === 'integer';
    const hasTrueFalse = segmentType === 'true_false';

    const rules = [
      "1. Return ONLY a raw JSON object. No markdown, no code fences, no ```json, no extra text.",
      `2. Extract exactly ${questionCount} questions matching the specified questions metadata: ${JSON.stringify(segment.questions_metadata)}`,
      "3. Every question must have EXACTLY these fields: id, type, question, correct_answer, difficulty (use matching difficulty level as specified in metadata or default difficulty). For MCQ also include 'options' array. Do NOT add extra fields."
    ];

    let rulesIdx = 4;
    if (hasMcq) {
      rules.push(`${rulesIdx++}. For MCQ: extract all options directly from the document. Do NOT prefix option texts with A., B., C., D. or 'Option A:'. The 'correct_answer' must match the EXACT text of the correct option value, NOT an index or option letter.`);
    }
    if (hasInteger) {
      rules.push(`${rulesIdx++}. For Integer: provide the integer correct answer as a string.`);
    }
    if (hasTrueFalse) {
      rules.push(`${rulesIdx++}. For True/False: provide "true" or "false" matching the key.`);
    }

    rules.push(`${rulesIdx++}. MATH/LATEX FORMATTING: For ALL mathematical expressions, use ONLY single dollar sign delimiters $...$. NEVER use \\( \\) or \\[ \\] delimiters. NEVER double-wrap expressions. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.`);

    const resolvedFiles = await resolveScannedFileUrls(files);
    const filesMappingText = resolvedFiles.map((f, i) => `- Attached image index ${i} represents original Document Page ${f.original_index ?? i} (file: "${f.name}").`).join('\n');

    const prompt = `You are a professional exam extractor. You are given a scanned question paper (as images) and segment plan metadata.
Your task is to locate and extract the EXACT questions listed in the questions metadata from the attached pages, solve/retrieve their correct answers from the answer key (located in the document), and return them formatted as JSON.

Segment Metadata:
- Subject: ${subjectName}
- Academic Level: ${academicLevel || 'Grade 10'}
- Segment Range: ${segment.range}
- Questions Metadata: ${JSON.stringify(segment.questions_metadata, null, 2)}
- Question Type: ${segmentType.toUpperCase()}

Attached Images Page Mapping:
${filesMappingText}

STRICT EXTRACTION RULES:
${rules.join('\n')}

Example output format (keep keys exactly as shown):
{
  "success": true,
  "questions": [
    {
      "id": 1,
      "type": "${segmentType}",
      "question": "Exact question text extracted from the document page...",
      ${hasMcq ? `"options": ["Option 1 content", "Option 2 content", "Option 3 content", "Option 4 content"],` : ''}
      "correct_answer": "Correct answer solved/extracted from answer key...",
      "difficulty": "${difficulty}"
    }
  ]
}`;

    const userMessageContent = [{ type: 'text', text: prompt }];
    resolvedFiles.forEach((f, idx) => {
      const imgUrl = f.base64 || f.url;
      if (imgUrl) {
        console.log(`[SEGMENT EXTRACTOR] Page ${idx} size: ${imgUrl.startsWith('data:') ? `${(imgUrl.length/1024).toFixed(1)} KB (base64)` : 'Direct B2 URL'}`);
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: imgUrl }
        });
      }
    });

    const messages = [
      { role: 'system', content: 'You are an expert exam question extractor. You return only clean JSON responses.' },
      { role: 'user', content: userMessageContent }
    ];

    console.log(`\n=================== [SEGMENT EXTRACTOR] SENDING TO GEMINI ===================`);
    console.log(`Model: ${aiConfig.model}`);
    console.log(`Prompt text length: ${prompt.length} chars`);
    console.log(`Prompt message content:`, JSON.stringify(prompt, null, 2));
    console.log(`=============================================================================\n`);

    const response = await fetch(aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        ...(aiConfig.includeReasoningEffort && { reasoning_effort: "none" })
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[SEGMENT EXTRACTOR] AI gateway returned HTTP ${response.status} Error:`, text);
      throw new Error(`AI gateway returned status ${response.status}: ${text}`);
    }

    const responseText = await response.text();
    console.log(`\n=================== [SEGMENT EXTRACTOR] RAW RESPONSE RECEIVED ===================`);
    console.log(responseText);
    console.log(`=================================================================================\n`);

    let content = '';
    try {
      const data = JSON.parse(responseText);
      content = data.choices?.[0]?.message?.content || '';
    } catch (parseErr) {
      console.error('[SEGMENT EXTRACTOR] JSON Parse error:', parseErr);
      throw new Error('AI gateway response parse failed');
    }

    content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();

    let cleanJson;
    try {
      cleanJson = JSON.parse(jsonrepair(content));
      console.log(`[SEGMENT EXTRACTOR] Repaired/Parsed JSON output:`, JSON.stringify(cleanJson, null, 2));
    } catch (e) {
      console.error('[SEGMENT EXTRACTOR] Failed to parse repaired questions JSON. Content:', content);
      throw new Error('AI returned an invalid JSON schema');
    }

    if (!cleanJson.questions || !Array.isArray(cleanJson.questions) || cleanJson.questions.length === 0) {
      console.warn(`[SEGMENT EXTRACTOR] Empty questions array returned by model.`);
      throw new Error('No questions generated by AI.');
    }

    return res.status(200).json({ success: true, questions: cleanJson.questions });
  } catch (error) {
    console.error('Error generating segment questions:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate segment questions' });
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
