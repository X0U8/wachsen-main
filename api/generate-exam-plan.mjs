import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL || 'openai/gpt-4o';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const DEDUCT_AMOUNT = 2;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { subjects, examName, difficulty, userId, authToken, apiKey: userKey, provider, model } = req.body;
    const activeProvider = provider || 'mesh';
    const isMistral = activeProvider === 'mistral';
    const meshKey = userKey || (isMistral ? process.env.MISTRAL_API_KEY : MESH_API_KEY);

    const refundCredits = async () => {
      if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + DEDUCT_AMOUNT }).eq('id', userId);
      }
    };

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'Invalid subjects data' });
    }

    if (!meshKey) {
      return res.status(500).json({ error: 'No API key provided. Set MESH_API_KEY in .env or provide an apiKey.' });
    }


    // Reserve credits BEFORE calling AI
    if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
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
    } else {
    }

    const totalQuestions = subjects.reduce((total, sub) => {
      return total + sub.questionTypes.reduce((qTotal, q) => qTotal + q.count, 0);
    }, 0);

    const subjectsInfo = subjects.map(sub => {
      const qCount = sub.questionTypes.reduce((qTotal, q) => qTotal + q.count, 0);
      const qTypesDistribution = sub.questionTypes.map(q => `${q.type.toLowerCase()}: ${q.count} questions`).join(', ');
      return `- ${sub.name}: Total ${qCount} questions (${qTypesDistribution}) - Chapters: ${sub.chapters || 'Not specified'}`;
    }).join('\n');

    const prompt = `Generate a json for an exam plan with the following details:

Exam Name: ${examName}
Difficulty: ${difficulty}
Total Questions: ${totalQuestions}

Subjects and Question Distribution:
${subjectsInfo}

DIFFICULTY (determines subtopic depth):
- EASY: most basic subtopics
- MEDIUM: moderate subtopics
- HARD: advanced subtopics
- ADVANCE: the most complex subtopics possible

NOTE: Adjust the depth and complexity of generated subtopics according to the selected difficulty.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON — no markdown, no code fences, no \`\`\`json, just the raw JSON object
2. Generate specific subtopics for each subject based on the chapters/topics provided
3. Distribute questions logically across subtopics
4. Each segment in the "segments" list MUST contain exactly 5 questions (e.g., "1-5", "6-10", "11-15") and must be assigned exactly ONE question type ('mcq', 'integer', or 'true_false') from the requested distribution for that subject. For example, if a subject has 10 mcq and 5 integer questions, you should have 3 segments in total: 2 segments assigned 'mcq' type and 1 segment assigned 'integer' type.

Return the response in this JSON format:
{
  "subjects": [
    {
      "name": "Subject Name",
      "segments": [
        { "range": "1-5", "type": "mcq", "topics": ["Subtopic1", "Subtopic2"] },
        { "range": "6-10", "type": "mcq", "topics": ["Subtopic3", "Subtopic4"] },
        { "range": "11-15", "type": "integer", "topics": ["Subtopic5"] }
      ]
    }
  ]
}

Return ONLY valid JSON — no markdown, no code fences, no \`\`\`json, just the raw JSON object`;

    const apiUrl = isMistral ? MISTRAL_API_URL : MESH_API_URL;
    const activeModel = isMistral ? (model || 'mistral-small-latest') : (model || MESH_MODEL);
    const apiLabel = isMistral ? 'Mistral' : 'Mesh';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${meshKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: 'You are an exam generator. Return only valid JSON. For any math content, wrap LaTeX expressions in $...$ delimiters. Ensure all backslashes in LaTeX commands are properly escaped for JSON (e.g. a single backslash becomes \\\\).' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await refundCredits();
      return res.status(502).json({ error: `${apiLabel} API request failed`, code: data.error?.code, details: data.error?.message, request_id: data.error?.request_id });
    }

    let content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      await refundCredits();
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
            messages: [
              { role: 'system', content: 'You are a JSON repair tool. Your only task is to take the broken JSON string provided by the user, fix any syntax errors (like missing commas, unescaped quotes, or mismatched braces), and return the fixed JSON. Do NOT output any markdown, no code fences, no extra text. Just return the raw corrected JSON.' },
              { role: 'user', content: brokenContent }
            ],
            temperature: 0.1,
            max_tokens: 4096,
            response_format: { type: 'json_object' }
          })
        });

        if (repairResponse.ok) {
          const repairData = await repairResponse.json();
          let repairedText = repairData.choices?.[0]?.message?.content || '';
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

    // Normalize LaTeX row separators: any run of backslashes before a space → exactly \\
    const fixLatex = (obj) => {
      if (typeof obj === 'string') return obj.replace(/\\+(?= )/g, '\\\\');
      if (Array.isArray(obj)) return obj.map(fixLatex);
      if (obj && typeof obj === 'object') { for (const k in obj) obj[k] = fixLatex(obj[k]); }
      return obj;
    };
    parsedPlan = fixLatex(parsedPlan);

    // Validate format
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
