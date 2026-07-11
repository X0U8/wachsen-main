import { createClient } from '@supabase/supabase-js';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
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
      apiKey: userKey,
      useOwnKey,
      provider,
      model
    } = req.body;

    const isByok = !!(useOwnKey && userKey && userKey.trim());
    const activeProvider = isByok ? (provider || 'mesh') : 'mesh';
    const isMistral = activeProvider === 'mistral';
    const meshKey = isByok ? userKey : MESH_API_KEY;

    if (!question) {
      return res.status(400).json({ error: 'Missing question content' });
    }

    if (!meshKey) {
      return res.status(500).json({ error: 'No API key provided. Set MESH_API_KEY in .env or provide an apiKey.' });
    }

    let currentCredits = 0;
    let authedSupabase = null;
    if (!useOwnKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
      authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authedSupabase.from('profiles').select('credits').eq('id', userId).single();
      currentCredits = profile?.credits || 0;
      if (currentCredits < 1) {
        return res.status(400).json({ error: `Insufficient credits. You need at least 1 credit to ask a question. You have ${currentCredits}.` });
      }
    }

    const systemPrompt = `You are a helpful tutor explaining exam questions. Be direct, clear, and explain in short. Avoid unnecessary conversational fluff. Keep explanations concise, but make sure to write out all mathematical steps and derivations fully and clearly.

Do NOT use raw markdown formatting symbols like headers (###), markdown bolding (**), bullet lists with dashes, or dividers (---). Instead, format your output into separate, clean paragraphs. Start a new line whenever a new step, equation, or part of the explanation begins (e.g. after full stops, colons, or semicolons where appropriate) to make the text clean, readable, and well-spaced.

Wrap any math content, variables, formulas, or equations in single $...$ delimiters for inline LaTeX (e.g. $E = mc^2$).

Context of the question under discussion:
Question: "${question}"
${options && Array.isArray(options) && options.length > 0 ? `Options:\n${options.map((opt, i) => `- ${opt}`).join('\n')}` : ''}
Correct Answer: "${correctAnswer}"
User's Answer: "${userAnswer || '(No answer provided)'}"`;

    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

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
        messages: conversationMessages,
        temperature: 0.7,
        ...(!isMistral && { reasoning: { enabled: false } })
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: `${apiLabel} API request failed`, code: data.error?.code, details: data.error?.message });
    }

    const reply = data.choices?.[0]?.message?.content || '';

    let finalCredits = null;
    let creditsDeducted = 0;
    if (!useOwnKey && authedSupabase && userId) {
      creditsDeducted = 1;
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}
