import { createClient } from '@supabase/supabase-js';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const CHAT_DEDUCT_AMOUNT = 1;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const refundCredits = async () => {
    try {
      const { userId, authToken } = req.body;
      if (supabaseUrl && supabaseAnonKey && userId && authToken) {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + CHAT_DEDUCT_AMOUNT }).eq('id', userId);
      }
    } catch (e) {
      console.error('Refund failed:', e);
    }
  };

  try {
    const { 
      message, 
      chatHistory, 
      activeTasks, 
      examsPerformance, 
      currentTime, 
      userId, 
      authToken 
    } = req.body;

    if (!message || !userId || !authToken) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    if (!MESH_API_KEY) {
      return res.status(500).json({ error: 'No MESH_API_KEY config found.' });
    }

    if (supabaseUrl && supabaseAnonKey) {
      const authed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
      const currentCredits = profile?.credits || 0;
      if (currentCredits < CHAT_DEDUCT_AMOUNT) {
        return res.status(400).json({ error: `Insufficient credits. Asking Mentor costs ${CHAT_DEDUCT_AMOUNT} credit. You have ${currentCredits}.` });
      }
      const { data: updated, error: deductError } = await authed.from('profiles')
        .update({ credits: currentCredits - CHAT_DEDUCT_AMOUNT })
        .eq('id', userId)
        .select('credits');
      if (deductError || !updated || updated.length === 0) {
        return res.status(500).json({ error: 'Failed to reserve credits.' });
      }
    }

    let systemContext = `You are Mentor AI, an expert, friendly study mentor helping the student prepare for their target exams.
Your tone is highly encouraging, supportive, and direct.
STRICT RULE: Answer in short, concise paragraphs (maximum 2-3 sentences per response). Do not give long explanations unless specifically asked. Keep answers brief and actionable.

STUDENT STUDY CONTEXT:
- Current Local Time: ${currentTime}
- Active Study Roadmap Tasks (Current Month):
${activeTasks && activeTasks.length > 0 
  ? activeTasks.map((t, idx) => `- Block ${idx + 1} (${t.dates}): ${t.subjects.map(s => `${s.subjectName}: ${s.task}`).join(' | ')}`).join('\n')
  : 'No detailed task list generated for this month yet.'
}

- Recent Mock Exams Performance History (linked exam category):
${examsPerformance && examsPerformance.length > 0
  ? examsPerformance.map(e => `- Exam: ${e.name} | Status: Completed | Score: ${e.marksObtained}/${e.totalMarks} | Syllabus/Plan: ${e.plan || 'N/A'}`).join('\n')
  : 'No completed exams recorded in this category yet.'
}

Math Delimiters Instructions:
For any mathematical formulas/expressions, use ONLY single dollar sign delimiters $...$. NEVER use \\( \\) or \\[ \\].`;

    const messagesPayload = [
      { role: 'system', content: systemContext }
    ];

    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach(msg => {
        messagesPayload.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      });
    }

    messagesPayload.push({
      role: 'user',
      content: message
    });

    console.log(`[MENTOR CHAT] Sending request to Mesh model: ${MESH_MODEL}`);

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
          messages: messagesPayload,
          temperature: 0.7,
          reasoning: { enabled: false }
        })
      });
    } catch (fetchErr) {
      console.error('[MENTOR CHAT] API call gateway error:', fetchErr);
      await refundCredits();
      return res.status(502).json({ error: 'Failed to contact AI gateway', details: fetchErr.message });
    }

    const responseText = await response.text();
    console.log(`[MENTOR CHAT] Gateway status: ${response.status}`);

    let data = {};
    try {
      if (responseText) {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error('[MENTOR CHAT] Failed to parse JSON response:', parseErr);
    }

    if (!response.ok) {
      await refundCredits();
      return res.status(502).json({
        error: `Mesh API request failed`,
        code: data.error?.code,
        details: data.error?.message || responseText
      });
    }

    const content = data.choices?.[0]?.message?.content || '';
    if (!content) {
      await refundCredits();
      return res.status(502).json({ error: `Mesh API returned empty content` });
    }

    return res.json({ success: true, response: content.trim() });

  } catch (error) {
    console.error('Mentor chat handler exception:', error);
    await refundCredits();
    return res.status(500).json({ error: error.message });
  }
}
