import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subjects, examName, days, userId, authToken } = req.body;

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ error: 'Invalid subjects data' });
  }

  if (!examName || !days || isNaN(days)) {
    return res.status(400).json({ error: 'Invalid exam name or days count' });
  }

  const calculatedMonths = Math.max(1, Math.round(days / 30));
  const deductCost = calculatedMonths * subjects.length;

  const refundCredits = async () => {
    if (supabaseUrl && supabaseAnonKey && userId && authToken) {
      try {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + deductCost }).eq('id', userId);
      } catch (e) {
        console.error('Refund failed:', e);
      }
    }
  };

  try {
    if (!MESH_API_KEY) {
      return res.status(500).json({ error: 'No MESH_API_KEY config found.' });
    }

    if (supabaseUrl && supabaseAnonKey && userId && authToken) {
      const authed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
      const currentCredits = profile?.credits || 0;
      if (currentCredits < deductCost) {
        return res.status(400).json({ error: `Insufficient credits. Need ${deductCost} credits. You have ${currentCredits}.` });
      }
      const { data: updated, error: deductError } = await authed.from('profiles')
        .update({ credits: currentCredits - deductCost })
        .eq('id', userId)
        .select('credits');
      if (deductError || !updated || updated.length === 0) {
        return res.status(500).json({ error: 'Failed to reserve credits.' });
      }
    }

    const jsonTemplate = {
      months: Array.from({ length: calculatedMonths }, (_, i) => ({
        month: i + 1,
        subjects: subjects.map(s => ({
          subjectName: s.name,
          chapters: []
        }))
      }))
    };

    const prompt = `Generate a JSON study roadmap plan preparing for "${examName}" over exactly ${calculatedMonths} months (${days} days).
We have provided a list of subjects and their chapters. You must divide these chapters logically and sequentially across the ${calculatedMonths} months.
You must return the EXACT JSON structure below, but with the empty "chapters" arrays populated with the logical subtopics/chapters to study for each subject in each month.

PLANNING & REVISION RULES:
1. In addition to introducing new chapters, you MUST explicitly allocate time for revisions, mock test practice, and quick reading sessions inside each month's chapters list (e.g., adding items like "Revise: [Chapter Name]", "Mock test practice: [Topic]", "Read once: [Subtopic]", or "Practice previous years questions").
2. Ensure there are active revision tasks mixed in, especially in the middle and latter months as the exam date draws closer, rather than just listing new chapters to cover.

Input Subjects and Chapter Guidelines:
${subjects.map(s => `- ${s.name}: "${s.chapters || 'General Preparation'}"`).join('\n')}

Required JSON Structure (you MUST keep the exact same "months", "month", "subjects", and "subjectName" keys. Only populate the "chapters" arrays):

${JSON.stringify(jsonTemplate, null, 2)}

STRICT RULES:
1. Return ONLY the valid JSON object — no markdown, no code fences, no extra text.
2. Do not change the subjects list, subjectName, or month numbers.
3. Distribute the chapters/topics evenly and in a logical order (e.g. foundational topics in early months, advanced/review topics in later months).
4. MATH/LATEX FORMATTING: For ALL mathematical expressions, use ONLY single dollar sign delimiters $...$. NEVER use \\( \\) or \\[ \\] delimiters.
5. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.`;

    console.log(`[STUDY PLAN] Sending request to: ${MESH_API_URL}`);
    console.log(`[STUDY PLAN] Using model: ${MESH_MODEL}`);

    let response;
    try {
      response = await fetch(MESH_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MESH_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MESH_MODEL,
          messages: [
            { role: 'system', content: `You are an expert study planner. Return only valid JSON. For any math content, use ONLY $...$ delimiters (single dollar signs). NEVER use \\( \\) or \\[ \\] delimiters. NEVER double-wrap expressions like $\\(...\\)$. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.` },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      });
    } catch (fetchErr) {
      console.error('[STUDY PLAN] Fetch error calling AI gateway:', fetchErr);
      await refundCredits();
      return res.status(502).json({ error: 'Failed to contact AI gateway', details: fetchErr.message });
    }

    const responseText = await response.text();
    console.log(`[STUDY PLAN] Response status: ${response.status}`);

    let data = {};
    try {
      if (responseText) {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error('[STUDY PLAN] Failed to parse response as JSON:', parseErr);
    }

    if (!response.ok) {
      await refundCredits();
      return res.status(502).json({
        error: `Mesh API request failed`,
        code: data.error?.code,
        details: data.error?.message || responseText,
        request_id: data.error?.request_id
      });
    }

    let content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      await refundCredits();
      return res.status(502).json({ error: `Mesh API returned empty content` });
    }

    content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();

    const repairJsonWithAI = async (brokenContent) => {
      try {
        const repairResponse = await fetch(MESH_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MESH_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: MESH_MODEL,
            messages: [
              { role: 'system', content: 'You are a JSON repair tool. Your only task is to take the broken JSON string provided by the user, fix any syntax errors, and return the fixed JSON. Do NOT output any markdown, no code fences, no extra text. Just return the raw corrected JSON.' },
              { role: 'user', content: brokenContent }
            ],
            temperature: 0.1,
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
    } catch (e) {
      console.warn('[STUDY PLAN] Initial JSON parse failed, trying native jsonrepair...', e);
      try {
        parsedPlan = JSON.parse(jsonrepair(content));
      } catch (err) {
        console.warn('[STUDY PLAN] Jsonrepair failed, attempting AI repair...', err);
        parsedPlan = await repairJsonWithAI(content);
      }
    }

    if (!parsedPlan || !parsedPlan.months) {
      await refundCredits();
      return res.status(502).json({ error: 'AI did not return a valid study plan structure' });
    }

    return res.json({ success: true, plan: parsedPlan });

  } catch (error) {
    console.error('Study plan generation exception:', error);
    await refundCredits();
    return res.status(500).json({ error: error.message });
  }
}
