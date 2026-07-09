import { jsonrepair } from 'jsonrepair';
import { createClient } from '@supabase/supabase-js';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL || 'openai/gpt-4o';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { segment, subjectName, questionTypes, difficulty, userId, authToken, apiKey: userKey, provider, model } = req.body;
    const activeProvider = provider || 'mesh';
    const isMistral = activeProvider === 'mistral';
    const meshKey = userKey || (isMistral ? process.env.MISTRAL_API_KEY : MESH_API_KEY);
    const apiUrl = isMistral ? MISTRAL_API_URL : MESH_API_URL;
    const apiLabel = isMistral ? 'Mistral' : 'Mesh';
    const activeModel = isMistral ? (model || 'mistral-small-latest') : (model || MESH_MODEL);

    if (!segment || !subjectName || !questionTypes || !Array.isArray(questionTypes)) {
      return res.status(400).json({ error: 'Invalid segment data' });
    }

    if (!meshKey) {
      return res.status(500).json({ error: 'No API key provided.' });
    }


    // Calculate question count from segment range
    const [segStart, segEnd] = (segment.range || '1-1').split('-').map(Number);
    const questionCount = (segEnd || segStart) - segStart + 1;

    // Reserve credits BEFORE calling AI
    if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
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
    } else {
    }

    const qTypesInfo = questionTypes.map(q => {
      let typeStr = q.type.toUpperCase();
      if (q.type === 'mcq') {
        typeStr += ` (${q.mcqOptions || 4} options`;
        if (q.mcqMultiple) typeStr += ', multiple selection allowed';
        typeStr += ')';
      }
      return `${typeStr}: ${q.count} questions`;
    }).join(', ');

    const prompt = `Generate json output with questions for a specific segment of an exam.

Subject: ${subjectName}
Difficulty: ${difficulty.toUpperCase()}
Question Range: ${segment.range}
Topics: ${segment.topics.join(', ')}
Question Types: ${qTypesInfo}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON — no markdown, no code fences, no \`\`\`json, just the raw JSON object
2. DIFFICULTY IS CRITICAL: All questions MUST match the "${difficulty.toUpperCase()}" difficulty level
3. For MCQ questions:
   - Generate exactly ${questionTypes.find(q => q.type === 'mcq')?.mcqOptions || 4} options
   - "correct_answer" must be the ACTUAL option text, NOT an index
   - For single correct: "correct_answer": "Option A"
   - For multiple correct: "correct_answer": ["Option A", "Option B"]
 4. For integer questions, provide the correct numeric answer
5. For true/false questions, provide "true" or "false"

Return the response in this JSON format:
{
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
    }
  ]
}

- Generate questions based on the topics provided
- Distribute question types according to the counts specified
- Return ONLY valid JSON — no markdown, no code fences, no \`\`\`json, just the raw JSON object`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${meshKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: 'You are an exam question generator. Return only valid JSON. For math inside $...$ use a single backslash. Example: $\\sqrt{x}$. NEVER use double backslashes.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`${apiLabel} API request failed:`, response.status, JSON.stringify(data));
      return res.status(502).json({ error: `${apiLabel} API request failed`, code: data.error?.code, details: data.error?.message, request_id: data.error?.request_id });
    }

    let content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      return res.status(502).json({ error: `${apiLabel} API returned no content` });
    }

    content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();

    // Normalize all string values — replace double backslashes with single
    const normalizeStrings = (obj) => {
      if (typeof obj === 'string') return obj.replace(/\\\\/g, '\\');
      if (Array.isArray(obj)) return obj.map(normalizeStrings);
      if (obj && typeof obj === 'object') {
        for (const key in obj) { obj[key] = normalizeStrings(obj[key]); }
      }
      return obj;
    };

    let parsedQuestions;
    let parseAttempts = 0;
    const maxParseAttempts = 3;

    while (parseAttempts < maxParseAttempts) {
      parseAttempts++;
      try {
        let cleanContent = content;
        if (parseAttempts > 1) {
          cleanContent = jsonrepair(cleanContent);
        }
        parsedQuestions = JSON.parse(cleanContent);
        break;
      } catch (parseError) {
        if (parseAttempts === maxParseAttempts) {
          return res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: content });
        }
      }
    }

    if (!Array.isArray(parsedQuestions?.questions) || parsedQuestions.questions.length === 0) {
      const refundCredits = async () => {
        if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
          const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
          const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
          await authed.from('profiles').update({ credits: (profile?.credits || 0) + questionCount }).eq('id', userId);
        }
      };
      await refundCredits();
      return res.status(422).json({ error: 'Response missing questions array', raw: content });
    }

    parsedQuestions = normalizeStrings(parsedQuestions);

    const refundCredits = async () => {
      if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + questionCount }).eq('id', userId);
      }
    };

    // Validate each question format
    for (const q of parsedQuestions.questions) {
      if (!q.id || !q.type || !q.question || !q.correct_answer) {
        await refundCredits();
        return res.status(422).json({ error: `Question #${q.id || '?'} missing required fields`, raw: content });
      }
      if (q.type === 'mcq' && (!Array.isArray(q.options) || q.options.length < 2)) {
        await refundCredits();
        return res.status(422).json({ error: `MCQ question #${q.id} needs at least 2 options`, raw: content });
      }
    }

    // Credits already reserved — no extra deduction needed

    return res.status(200).json({ success: true, questions: parsedQuestions.questions, raw: content });
  } catch (error) {
    // Refund credits on failure
    if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
      try {
        const authed = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${authToken}` } }
        });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + questionCount }).eq('id', userId);
      } catch (e) { console.error('Credit refund failed:', e); }
    }
    console.error('Error generating segment questions:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
