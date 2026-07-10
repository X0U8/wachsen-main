import { createClient } from '@supabase/supabase-js';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL || 'openai/gpt-4o';

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
      provider, 
      model 
    } = req.body;

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

    if (!question) {
      return res.status(400).json({ error: 'Missing question content' });
    }

    if (!meshKey) {
      return res.status(500).json({ error: 'No API key provided. Set MESH_API_KEY in .env or provide an apiKey.' });
    }

    // Deduct credit BEFORE calling AI
    let finalCredits = null;
    if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
      const authed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });
      const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
      const currentCredits = profile?.credits || 0;
      if (currentCredits < DEDUCT_AMOUNT) {
        return res.status(400).json({ error: `Insufficient credits. Need ${DEDUCT_AMOUNT} credit. You have ${currentCredits}.` });
      }
      const { data: updated, error: deductError } = await authed.from('profiles')
        .update({ credits: currentCredits - DEDUCT_AMOUNT })
        .eq('id', userId)
        .select('credits');
      if (deductError || !updated || updated.length === 0) {
        return res.status(500).json({ error: 'Failed to deduct credits.' });
      }
      finalCredits = updated[0].credits;
    }

    // Build the system prompt
    const systemPrompt = `You are a helpful tutor explaining exam questions. Be concise and explain in a clear, easy-to-understand way. 
Wrap any math content, variables, formulas, or equations in single $...$ delimiters for inline LaTeX (e.g. $E = mc^2$).

Context of the question under discussion:
Question: "${question}"
${options && Array.isArray(options) && options.length > 0 ? `Options:\n${options.map((opt, i) => `- ${opt}`).join('\n')}` : ''}
Correct Answer: "${correctAnswer}"
User's Answer: "${userAnswer || '(No answer provided)'}"`;

    // Map conversation history
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
        max_tokens: 1024
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await refundCredits();
      return res.status(502).json({ error: `${apiLabel} API request failed`, code: data.error?.code, details: data.error?.message });
    }

    const reply = data.choices?.[0]?.message?.content || '';

    return res.json({ 
      success: true, 
      reply,
      creditsDeducted: !userKey ? DEDUCT_AMOUNT : 0,
      remainingCredits: finalCredits
    });
  } catch (error) {
    console.error('Ask question AI error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
