import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/responses';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const DEDUCT_AMOUNT = 2;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subjects, examName, difficulty, userId, authToken, apiKey: userKey, provider, model, files } = req.body;
  const isByok = !!(userKey && userKey.trim());
  const activeProvider = isByok ? (provider || 'mesh') : 'mesh';
  const isMistral = activeProvider === 'mistral';
  const meshKey = isByok ? userKey : MESH_API_KEY;

  const refundCredits = async () => {
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

    if (!meshKey) {
      return res.status(500).json({ error: 'No API key provided. Set MESH_API_KEY in .env or provide an apiKey.' });
    }

    if (!isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
      const authed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
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

    const subjectsTemplate = subjects.map(sub => {
      const segments = [];
      let currentQuestionIndex = 1;

      sub.questionTypes.forEach(qt => {
        const type = qt.type.toLowerCase();
        const totalForType = qt.count;
        if (totalForType <= 0) return;

        const segmentCount = Math.ceil(totalForType / 5);

        for (let i = 0; i < segmentCount; i++) {
          const start = currentQuestionIndex;
          const end = Math.min(currentQuestionIndex + 4, start + (totalForType - i * 5) - 1);
          segments.push({
            range: `${start}-${end}`,
            type: type,
            topics: []
          });
          currentQuestionIndex = end + 1;
        }
      });

      return {
        name: sub.name,
        segments: segments
      };
    });

    const jsonTemplate = {
      subjects: subjectsTemplate
    };

    const prompt = `Generate a JSON exam plan containing subtopics/topics for the following subjects.
We have already calculated the exact segment structure, question ranges, and types for you.
You must return the EXACT JSON structure below, but with the empty "topics" arrays populated with specific, relevant subtopics based on the specified chapters/topics for that subject.

Chapters/Topics config for each subject:
${subjects.map(sub => `- ${sub.name}: Chapters are "${sub.chapters || 'General Topics'}"`).join('\n')}

Required JSON Structure (you MUST keep the exact same "subjects", "name", "segments", "range", and "type" keys and values. Only fill in the "topics" arrays with specific, high-quality, educational subtopics/concepts suitable for the specified chapters and difficulty level: ${difficulty.toUpperCase()}):

${JSON.stringify(jsonTemplate, null, 2)}

STRICT RULES:
1. Return ONLY the valid JSON object — no markdown, no code fences, no extra text.
2. Do not change the range, name, type, or number of segments.
3. Ensure every "topics" array contains 2 to 4 relevant subtopic strings.`;

    const apiUrl = isMistral ? MISTRAL_API_URL : MESH_API_URL;
    const activeModel = isMistral ? (model || 'mistral-small-latest') : (model || MESH_MODEL);
    const apiLabel = isMistral ? 'Mistral' : 'Mesh';

    let textPrompt = prompt;
    let userMessageContent = [];

    if (files && files.length > 0) {
      let fileMappingsText = "Uploaded Reference Files Mapping:\n";
      files.forEach(f => {
        fileMappingsText += `- File "${f.name}" is mapped to Subject: "${f.subjectName || 'General'}"\n`;
      });

      textPrompt = `The User put some reference to make questions , see the reference if its theory then make plan from that theory , or if questions and the answer key is provided then make plan according on the topic of the questions  and if answer key not there then make plans based on those questions , if the reference images or pdfs not showed or the image or pdf reference is wrong or non related data , then it must be a mistake you simply ignore the images and pdf.\n\n` + fileMappingsText + "\n" + textPrompt;
    }

    userMessageContent.push({ type: 'text', text: textPrompt });

    if (files && files.length > 0) {
      files.forEach(f => {
        const fileUrl = f.url || f.base64;
        if (fileUrl) {
          userMessageContent.push({
            type: 'image_url',
            image_url: { url: fileUrl }
          });
        }
      });
    }

    let messages = [
      { role: 'system', content: `You are an exam generator. Return only valid JSON. For any math content, use ONLY $...$ delimiters (single dollar signs). NEVER use \\( \\) or \\[ \\] delimiters. NEVER double-wrap expressions like $\\(...\\)$. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.` }
    ];

    if (files && files.length > 0) {
      messages.push({ role: 'user', content: userMessageContent });
    } else {
      messages.push({ role: 'user', content: textPrompt });
    }

    console.log(`[API PLAN] Sending request to: ${apiUrl}`);
    console.log(`[API PLAN] Using model: ${activeModel}`);
    console.log(`[API PLAN] Messages payload:`, JSON.stringify(messages, null, 2));

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${meshKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: activeModel,
          ...(isMistral ? { messages: messages } : { input: messages }),
          temperature: 0.7,
          response_format: { type: 'json_object' },
          ...(!isMistral && { reasoning: { enabled: false } })
        })
      });
    } catch (fetchErr) {
      console.error('[API PLAN] Fetch error calling AI gateway:', fetchErr);
      await refundCredits();
      return res.status(502).json({ error: 'Failed to contact AI gateway', details: fetchErr.message });
    }

    const responseText = await response.text();
    console.log(`[API PLAN] Response status: ${response.status}`);
    console.log(`[API PLAN] Response text: ${responseText}`);

    let data = {};
    try {
      if (responseText) {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error('[API PLAN] Failed to parse response as JSON:', parseErr);
    }

    if (!response.ok) {
      await refundCredits();
      return res.status(502).json({ 
        error: `${apiLabel} API request failed`, 
        code: data.error?.code, 
        details: data.error?.message || responseText, 
        request_id: data.error?.request_id 
      });
    }

    let content = (data.output?.[0]?.content?.[0]?.text || data.choices?.[0]?.message?.content || '').trim();

    if (!content) {
      await refundCredits();
      return res.status(502).json({ error: `${apiLabel} API returned empty content` });
    }

    content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();

    const repairJsonWithAI = async (brokenContent) => {
      try {
        const repairResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${meshKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: activeModel,
            ...(isMistral ? {
              messages: [
                { role: 'system', content: 'You are a JSON repair tool. Your only task is to take the broken JSON string provided by the user, fix any syntax errors (like missing commas, unescaped quotes, or mismatched braces), and return the fixed JSON. Do NOT output any markdown, no code fences, no extra text. Just return the raw corrected JSON.' },
                { role: 'user', content: brokenContent }
              ]
            } : {
              input: [
                { role: 'system', content: 'You are a JSON repair tool. Your only task is to take the broken JSON string provided by the user, fix any syntax errors (like missing commas, unescaped quotes, or mismatched braces), and return the fixed JSON. Do NOT output any markdown, no code fences, no extra text. Just return the raw corrected JSON.' },
                { role: 'user', content: brokenContent }
              ]
            }),
            temperature: 0.1,
            response_format: { type: 'json_object' },
            ...(!isMistral && { reasoning: { enabled: false } })
          })
        });

        if (repairResponse.ok) {
          const repairData = await repairResponse.json();
          let repairedText = (repairData.output?.[0]?.content?.[0]?.text || repairData.choices?.[0]?.message?.content || '').trim();
          repairedText = repairedText.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
          return JSON.parse(repairedText);
        }
      } catch (err) {
        console.error('AI JSON repair failed:', err);
      }
      return null;
    };

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(content);
    } catch (parseError) {
      try {
        parsedPlan = JSON.parse(jsonrepair(content));
      } catch (repairError) {
        const aiRepaired = await repairJsonWithAI(content);
        if (aiRepaired) {
          parsedPlan = aiRepaired;
        } else {
          await refundCredits();
          return res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: content });
        }
      }
    }

    const fixLatex = (obj) => {
      if (typeof obj === 'string') {
        let s = obj;
        s = s.replace(/\$\s*\\+\(\s*([\s\S]*?)\s*\\+\)\s*\$/g, (_, inner) => `$${inner}$`);
        s = s.replace(/\\+\(([\s\S]*?)\\+\)/g, (_, inner) => `$${inner}$`);
        s = s.replace(/\\+\[([\s\S]*?)\\+\]/g, (_, inner) => `$${inner}$`);
        s = s.replace(/\\+(?= )/g, '\\\\');
        return s;
      }
      if (Array.isArray(obj)) return obj.map(fixLatex);
      if (obj && typeof obj === 'object') { for (const k in obj) obj[k] = fixLatex(obj[k]); }
      return obj;
    };
    parsedPlan = fixLatex(parsedPlan);

    if (!Array.isArray(parsedPlan?.subjects) || parsedPlan.subjects.length === 0) {
      await refundCredits();
      return res.status(422).json({ error: 'Response missing subjects array', raw: content });
    }
    for (const sub of parsedPlan.subjects) {
      if (!sub.name || !Array.isArray(sub.segments)) {
        await refundCredits();
        return res.status(422).json({ error: `Subject "${sub.name || 'unnamed'}" missing name or segments array`, raw: content });
      }
      for (const seg of sub.segments) {
        if (!seg.range || !Array.isArray(seg.topics)) {
          await refundCredits();
          return res.status(422).json({ error: `Segment in "${sub.name}" missing range or topics array`, raw: content });
        }
      }
    }

    return res.status(200).json({ success: true, plan: parsedPlan, raw: content });

  } catch (error) {
    await refundCredits();
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
