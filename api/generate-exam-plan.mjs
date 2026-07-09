import { createClient } from '@supabase/supabase-js';

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
      const qTypes = sub.questionTypes.map(q => q.type.toUpperCase()).join(', ');
      return `- ${sub.name}: ${qCount} questions (${qTypes}) - Topics: ${sub.chapters || 'Not specified'}`;
    }).join('\n');

    const prompt = `Generate a json for an exam plan with the following details:

Exam Name: ${examName}
Difficulty: ${difficulty}
Total Questions: ${totalQuestions}

Subjects and Question Distribution:
${subjectsInfo}

DIFFICULTY REQUIREMENTS (STRICT):
- User-selected difficulty: ${difficulty}
- At least 80% of subtopics MUST align with this difficulty level
- Difficulty definitions:
  * EASY: Focus on basic concepts and fundamental topics
  * MEDIUM: Focus on moderate complexity topics
  * HARD: Focus on advanced and challenging topics
  * ADVANCE: Focus on the most complex and advanced topics possible, The Toughest Questions you can make.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON — no markdown, no code fences, no \`\`\`json, just the raw JSON object
2. Generate specific subtopics for each subject based on the chapters/topics provided
3. Distribute questions logically across subtopics

Return the response in this JSON format:
{
  "subjects": [
    {
      "name": "Subject Name",
      "segments": [
        { "range": "1-10", "topics": ["Subtopic1", "Subtopic2"] },
        { "range": "11-20", "topics": ["Subtopic3", "Subtopic4"] }
      ]
    }
  ]
}

For each subject, create ranges of exactly 10 questions like "1-10", "11-20", "21-30" based on question count.
Each range MUST contain exactly 10 questions except the last range which can have fewer.
Each range should contain relevant subtopics as an array (max 5 subtopics per range).
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
        max_tokens: 4096
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

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(content);
    } catch (parseError) {
      await refundCredits();
      return res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: content });
    }

    // Normalize LaTeX row separators: any run of backslashes before a space → exactly \\
    const fixLatex = (obj) => {
      if (typeof obj === 'string') return obj.replace(/\\+(?= )/g, '\\\\');
      if (Array.isArray(obj)) return obj.map(fixLatex);
      if (obj && typeof obj === 'object') { for (const k in obj) obj[k] = fixLatex(obj[k]); }
      return obj;
    };
    parsedPlan = fixLatex(parsedPlan);    const refundCredits = async () => {
      if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + DEDUCT_AMOUNT }).eq('id', userId);
      }
    };

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
