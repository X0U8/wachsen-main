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
      authToken,
      examTypeName,
      subjects
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

    let systemContext = `You are Glix AI, an expert, friendly study mentor helping the student prepare for their target exams.
Your tone is highly encouraging, supportive, and direct.
STRICT RULE: Answer in short, concise paragraphs (maximum 2-3 sentences per response). Do not give long explanations unless specifically asked. Keep answers brief and actionable.

CRITICAL RULE 1: You can ONLY answer questions related to the student's exam preparation, study roadmap, active study tasks, mock exams performance, scheduling, or exam study strategy. If the user's message is off-topic, unrelated, or requests general/casual chat unrelated to exam preparation, you must reply EXACTLY with: "I cannot answer this question." and nothing else.


PLATFORM CAPABILITIES & NAVIGATION:
- You reside inside "Glix" - an exam preparation and revision platform.
- Users can create and take AI-generated exams in multiple formats: Multiple Choice Questions (MCQ), Integer-based questions, and Long Answer Questions (LAQ).
- Users can review completed exams and ask question-specific details using a separate "Tutor AI" available inside the results review screen.
- Users can revise using Concept Cards, test memorization with Recall/Cheat Cards, and redo incorrect questions from the Revision log.
- If the user wants to practice a specific topic, guide them to generate/give a practice exam or use concept cards for that topic on the platform.

STUDENT STUDY CONTEXT:
- Current Local Time: ${currentTime}
- Target Exam Category: ${examTypeName || 'Not set'}
- Focus Enrolled Subjects: ${Array.isArray(subjects) ? subjects.join(', ') : (subjects || 'None')}
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
  CRITICAL RULE 2: Treat the target exam category and subject list in the STUDENT STUDY CONTEXT as implicit state: do not restate, mention, or summarize these values in your greetings or responses unless directly requested by the user.

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
          reasoning_effort: "none",
          stream: true
        })
      });
    } catch (fetchErr) {
      console.error('[MENTOR CHAT] API call gateway error:', fetchErr);
      await refundCredits();
      return res.status(502).json({ error: 'Failed to contact AI gateway', details: fetchErr.message });
    }

    if (!response.ok) {
      const errText = await response.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch (_) { }
      await refundCredits();
      return res.status(502).json({
        error: `Mesh API request failed`,
        code: errData.error?.code,
        details: errData.error?.message || errText
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'none');

    try {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch (streamErr) {
      console.error('[MENTOR CHAT] Streaming error:', streamErr);
    } finally {
      res.end();
    }
  } catch (error) {
    console.error('Mentor chat handler exception:', error);
    await refundCredits();
    return res.status(500).json({ error: error.message });
  }
}
