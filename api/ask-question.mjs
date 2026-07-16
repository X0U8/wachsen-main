import { createClient } from '@supabase/supabase-js';
import { resolveAiConfig } from './lib/ai-config.mjs';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const DEDUCT_AMOUNT = 1;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      question,
      correctAnswer,
      userAnswer,
      options,
      history = [],
      userId,
      authToken,
      stream = false,
      deductAmount = 1
    } = req.body;

    const aiConfig = resolveAiConfig(req.body, {
      meshApiKey: MESH_API_KEY,
      meshApiUrl: MESH_API_URL,
      meshModel: MESH_MODEL
    });
    const isByok = aiConfig.mode === 'byok';

    if (!question) {
      return res.status(400).json({ error: 'Missing question content' });
    }

    if (!aiConfig.apiKey) {
      return res.status(500).json({ error: 'No API key provided. Set MESH_API_KEY in .env or provide an apiKey.' });
    }

    let currentCredits = 0;
    let authedSupabase = null;
    if (!isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
      authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authedSupabase.from('profiles').select('credits').eq('id', userId).single();
      currentCredits = profile?.credits || 0;
      if (currentCredits < deductAmount) {
        return res.status(400).json({ error: `Insufficient credits. You need at least ${deductAmount} credits. You have ${currentCredits}.` });
      }
    }

    const systemPrompt = `You are a helpful tutor explaining exam questions. Be extremely concise, direct, and explain in short. Avoid unnecessary conversational fluff. Keep explanations brief and to the point, but make sure to write out all mathematical steps and derivations fully and clearly.

CRITICAL RULE: You can ONLY answer questions directly related to the exam question under discussion (or the general subject and topic of that question). If the user asks anything off-topic, unrelated, or requests general chat, you must reply EXACTLY with: "I cannot answer this question." and nothing else.

Do NOT use raw markdown formatting symbols like headers (###), markdown bolding (**), divider lines (---), or bullet points with dashes. Instead, format your output into separate, clean paragraphs. Start a new line whenever a new step, equation, or part of the explanation begins (e.g. after full stops, colons, or semicolons where appropriate) to make the text clean, readable, and well-spaced.

Wrap any math content, variables, formulas, or equations in single $...$ delimiters for inline LaTeX (e.g. $E = mc^2$).

Context of the question under discussion:
Question: "${question}"
${options && Array.isArray(options) && options.length > 0 ? `Options:\n${options.map((opt, i) => `- ${opt}`).join('\n')}` : ''}
Correct Answer: "${correctAnswer}"
User's Answer: "${userAnswer || '(No answer provided)'}"`;

    const conversationMessages = [
      { role: 'system', content: systemPrompt }
    ];

    if (history && history.length > 0) {
      history.forEach(msg => {
        conversationMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    } else {
      conversationMessages.push({
        role: 'user',
        content: `Please process the task or question: "${question}"`
      });
    }

    let finalCredits = null;
    let creditsDeducted = 0;
    const refundCredits = async () => {
      if (creditsDeducted > 0 && authedSupabase && userId) {
        const { data: updated } = await authedSupabase.from('profiles')
          .update({ credits: currentCredits })
          .eq('id', userId)
          .select('credits');
        finalCredits = updated?.[0]?.credits ?? currentCredits;
        creditsDeducted = 0;
      }
    };

    if (stream && !isByok && authedSupabase && userId) {
      creditsDeducted = deductAmount;
      const newCreditsTotal = Math.max(0, currentCredits - creditsDeducted);
      const { data: updated } = await authedSupabase.from('profiles')
        .update({ credits: newCreditsTotal })
        .eq('id', userId)
        .select('credits');
      finalCredits = updated?.[0]?.credits ?? newCreditsTotal;
    }

    const response = await fetch(aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: conversationMessages,
        temperature: 0.7,
        ...(aiConfig.includeReasoningEffort && { reasoning_effort: "none" }),
        stream: stream
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch (_) {}
      await refundCredits();
      return res.status(502).json({
        error: `${aiConfig.apiLabel} API request failed`,
        code: errData.error?.code,
        details: errData.error?.message || errText
      });
    }

    if (stream) {
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
        console.error('Ask question stream error:', streamErr);
      } finally {
        res.end();
      }
      return;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (!isByok && authedSupabase && userId) {
      creditsDeducted = deductAmount;
      const newCreditsTotal = Math.max(0, currentCredits - creditsDeducted);

      const { data: updated } = await authedSupabase.from('profiles')
        .update({ credits: newCreditsTotal })
        .eq('id', userId)
        .select('credits');

      finalCredits = updated?.[0]?.credits ?? newCreditsTotal;
    }

    return res.json({
      success: true,
      reply,
      creditsDeducted,
      remainingCredits: finalCredits
    });
  } catch (error) {
    console.error('Ask question AI error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
