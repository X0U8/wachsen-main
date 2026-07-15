import { createClient } from '@supabase/supabase-js';
import { jsonrepair } from 'jsonrepair';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const DEDUCT_AMOUNT = 15;

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subjects, monthNumber, startDateStr, userId, authToken } = req.body;

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ error: 'Invalid subjects data' });
  }

  if (!monthNumber || !startDateStr) {
    return res.status(400).json({ error: 'Invalid month number or start date' });
  }

  const refundCredits = async () => {
    if (supabaseUrl && supabaseAnonKey && userId && authToken) {
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
    if (!MESH_API_KEY) {
      return res.status(500).json({ error: 'No MESH_API_KEY config found.' });
    }

    if (supabaseUrl && supabaseAnonKey && userId && authToken) {
      const authed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
      const currentCredits = profile?.credits || 0;
      if (currentCredits < DEDUCT_AMOUNT) {
        return res.status(400).json({ error: `Insufficient credits. Detailed planning costs ${DEDUCT_AMOUNT} credit. You have ${currentCredits}.` });
      }
      const { data: updated, error: deductError } = await authed.from('profiles')
        .update({ credits: currentCredits - DEDUCT_AMOUNT })
        .eq('id', userId)
        .select('credits');
      if (deductError || !updated || updated.length === 0) {
        return res.status(500).json({ error: 'Failed to reserve credits.' });
      }
    }

    const startDate = new Date(startDateStr);
    const dateBlocks = [];
    for (let i = 0; i < 15; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(startDate.getDate() + i * 2);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      dateBlocks.push({
        label: `Block ${i + 1}`,
        dates: `${formatDate(dayStart)} to ${formatDate(dayEnd)}`,
        subjects: subjects.map(s => ({
          subjectName: s.subjectName,
          task: ""
        }))
      });
    }

    const prompt = `Generate a detailed study schedule for Month ${monthNumber}.
We have pre-calculated 15 study blocks of 2 days each. You must divide the assigned subject chapters and revise/mock test sessions logically across these 15 blocks.

Assigned Chapters/Topics to cover during Month ${monthNumber}:
${subjects.map(s => `- ${s.subjectName}: Chapters are [${s.chapters.join(', ')}]`).join('\n')}

Required JSON Output format:
{
  "tasks": [
    ${dateBlocks.map((b, idx) => JSON.stringify({
      label: b.label,
      dates: b.dates,
      subjects: b.subjects.map(sub => ({
        subjectName: sub.subjectName,
        task: `Specific learning, reading, revision, or mock test tasks for this 2-day period. For example: 'Read: kinematics, Revise: formulas' or 'Practice: mock questions'. Keep it highly descriptive.`
      }))
    }, null, 2)).join(',\n')}
  ]
}

STRICT INSTRUCTIONS:
1. Return ONLY the valid JSON object — no markdown, no code fences, no extra text.
2. Do not change the subjects, labels, or date ranges. Just populate the "task" values.
3. Make sure the student can complete all assigned chapters for the month within these 15 blocks.
4. It is acceptable if some subjects have light/empty tasks in certain blocks to prevent overloading the student, but ensure overall completion.
5. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.
6. CHAPTER-WISE TEST RECOMMENDATIONS: Whenever a chapter or topic of a subject is completed within a block, you MUST explicitly instruct the user to take a chapter-wise practice test for that chapter to check their comprehension (e.g., 'Read:  sample chapter  name , Test: take a chapter-wise test on Sample chapter name').`;

    console.log(`[MONTH DETAIL] Sending request to: ${MESH_API_URL}`);
    console.log(`[MONTH DETAIL] Using model: ${MESH_MODEL}`);

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
            { role: 'system', content: `You are an expert study task breakdown generator. Return only valid JSON. For any math content, use ONLY $...$ delimiters (single dollar signs). NEVER use \\( \\) or \\[ \\] delimiters. NEVER double-wrap expressions like $\\(...\\)$. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.` },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
          reasoning_effort: "none"
        })
      });
    } catch (fetchErr) {
      await refundCredits();
      return res.status(502).json({ error: 'Failed to contact AI gateway', details: fetchErr.message });
    }

    const responseText = await response.text();

    let data = {};
    try {
      if (responseText) {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) { }

    if (!response.ok) {
      await refundCredits();
      return res.status(502).json({
        error: `Mesh API request failed`,
        code: data.error?.code,
        details: data.error?.message || responseText
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
            response_format: { type: 'json_object' },
            reasoning_effort: "none"
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

    let parsedTasks;
    try {
      parsedTasks = JSON.parse(content);
    } catch (e) {
      console.warn('[MONTH DETAIL] Initial JSON parse failed, trying native jsonrepair...', e);
      try {
        parsedTasks = JSON.parse(jsonrepair(content));
      } catch (err) {
        console.warn('[MONTH DETAIL] Jsonrepair failed, attempting AI repair...', err);
        parsedTasks = await repairJsonWithAI(content);
      }
    }

    if (!parsedTasks || !parsedTasks.tasks) {
      await refundCredits();
      return res.status(502).json({ error: 'AI did not return a valid task list structure' });
    }

    return res.json({ success: true, tasks: parsedTasks.tasks });

  } catch (error) {
    console.error('Month detail plan generation exception:', error);
    await refundCredits();
    return res.status(500).json({ error: error.message });
  }
}
