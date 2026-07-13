import { jsonrepair } from 'jsonrepair';
import { createClient } from '@supabase/supabase-js';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { segment, subjectName, questionTypes, difficulty, academicLevel, userId, authToken, apiKey: userKey, provider, model, creditsPreReserved, files } = req.body;
    const isByok = !!(userKey && userKey.trim());
    const activeProvider = isByok ? (provider || 'mesh') : 'mesh';
    const isMistral = activeProvider === 'mistral';
    const meshKey = isByok ? userKey : MESH_API_KEY;
    const apiUrl = isMistral ? MISTRAL_API_URL : MESH_API_URL;
    const apiLabel = isMistral ? 'Mistral' : 'Mesh';
    const activeModel = isMistral ? (model || 'mistral-small-latest') : (model || MESH_MODEL);

    if (!segment || !subjectName || !questionTypes || !Array.isArray(questionTypes)) {
      return res.status(400).json({ error: 'Invalid segment data' });
    }

    if (!meshKey) {
      return res.status(500).json({ error: 'No API key provided.' });
    }

    const [segStart, segEnd] = (segment.range || '1-1').split('-').map(Number);
    const questionCount = (segEnd || segStart) - segStart + 1;

    const refundCredits = async () => {
      if (creditsPreReserved) return;
      if (!isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
        try {
          const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
          const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
          await authed.from('profiles').update({ credits: (profile?.credits || 0) + questionCount }).eq('id', userId);
        } catch (e) {
          console.error('Credit refund failed:', e);
        }
      }
    };

    if (!creditsPreReserved && !isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
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
    }

    const questionSequence = [];
    for (const qt of questionTypes) {
      for (let i = 0; i < qt.count; i++) {
        questionSequence.push(qt);
      }
    }

    let segmentType = (segment.type || '').toLowerCase().trim();
    if (!segmentType) {
      const segStartVal = parseInt(segment.range.split('-')[0]);
      const qTypeObj = questionSequence[segStartVal - 1];
      segmentType = qTypeObj?.type || 'mcq';
    }

    const hasMcq = segmentType === 'mcq';
    const hasInteger = segmentType === 'integer';
    const hasTrueFalse = segmentType === 'true_false';

    let qTypesInfo = '';
    if (hasMcq) {
      const mcqOpt = questionTypes.find(q => q.type === 'mcq')?.mcqOptions || 4;
      qTypesInfo = `MCQ (${mcqOpt} options): ${questionCount} questions`;
    } else if (hasInteger) {
      qTypesInfo = `INTEGER: ${questionCount} questions`;
    } else if (hasTrueFalse) {
      qTypesInfo = `TRUE_FALSE: ${questionCount} questions`;
    }

    const rules = [
      "1. Return ONLY a raw JSON object. No markdown, no code fences, no ```json, no extra text.",
      `2. Generate exactly ${questionCount} questions matching the specified segment range and question types.`,
      "3. Every question must have EXACTLY these fields: id, type, question, correct_answer, difficulty (which must be 'easy', 'medium', 'hard', or 'advance')." + (hasMcq ? " For MCQ also include options." : "") + " Do NOT add any extra fields."
    ];
    let ruleIdx = 4;

    if (hasMcq) {
      const mcqOpt = questionTypes.find(q => q.type === 'mcq')?.mcqOptions || 4;
      rules.push(`${ruleIdx++}. For MCQ: generate exactly ${mcqOpt} options. Do NOT prefix the options with 'Option A:', 'A. ', or similar labels; just output the clean option content. "correct_answer" must match the EXACT text of the correct option value, NOT an index or letter label.`);
    }
    if (hasInteger) {
      rules.push(`${ruleIdx++}. For integer: provide the numeric correct_answer.`);
    }
    if (hasTrueFalse) {
      rules.push(`${ruleIdx++}. For true/false: provide "true" or "false" as correct_answer.`);
    }

    rules.push(`${ruleIdx++}. Set the 'difficulty' field for every question: at least 80% of the questions generated must have a 'difficulty' value matching '${difficulty.toLowerCase()}', and the remaining questions should have other difficulty levels ('easy', 'medium', 'hard', or 'advance') to create a natural spread.`);
    rules.push(`${ruleIdx++}. MATH/LATEX FORMATTING: For ALL mathematical expressions, use ONLY single dollar sign delimiters $...$. NEVER use \\( \\) or \\[ \\] delimiters. NEVER double-wrap like $\\(...\\)$. Correct: "$\\\\frac{1}{2}$", "$x^2 + y^2$", "$\\\\vec{F} = m\\\\vec{a}$". WRONG (never do this): "$\\(\\\\frac{1}{2}\\)$", "\\(x^2\\)", "\\[F = ma\\]".`);

    const exampleQuestions = [];
    if (hasMcq) {
      const topicLabel = (Array.isArray(segment.topics) && segment.topics[0]) ? segment.topics[0] : 'concept';
      exampleQuestions.push({
        id: 1,
        type: "mcq",
        question: `Sample MCQ on ${subjectName}: what is the core idea of "${topicLabel}"?`,
        options: ["Correct definition", "Distractor A", "Distractor B", "Distractor C"],
        correct_answer: "Correct definition",
        difficulty: "easy"
      });
      exampleQuestions.push({
        id: 2,
        type: "mcq",
        question: `Which statement best describes a key concept in ${subjectName} related to "${topicLabel}"?`,
        options: ["Correct statement", "Wrong statement A", "Wrong statement B", "Wrong statement C"],
        correct_answer: "Correct statement",
        difficulty: "easy"
      });
      if (questionCount > 2) {
        exampleQuestions.push({
          id: 3,
          type: "mcq",
          question: `Which of the following expressions is correct for the ${topicLabel} topic in ${subjectName}?`,
          options: ["$\\\\frac{\\\\text{value}_1}{\\\\text{value}_2}$", "$\\\\text{wrong}_1$", "$\\\\text{wrong}_2$", "$\\\\text{wrong}_3$"],
          correct_answer: "$\\\\frac{\\\\text{value}_1}{\\\\text{value}_2}$",
          difficulty: "medium"
        });
      }
    }
    if (hasInteger) {
      exampleQuestions.push({
        id: 1,
        type: "integer",
        question: `Sample integer on ${subjectName}: compute $2 + 2$.`,
        correct_answer: "4",
        difficulty: "easy"
      });
      if (questionCount > 1) {
        exampleQuestions.push({
          id: 2,
          type: "integer",
          question: `Another sample integer on ${subjectName}: evaluate $10 \\\\div 2$.`,
          correct_answer: "5",
          difficulty: "easy"
        });
      }
    }
    if (hasTrueFalse) {
      exampleQuestions.push({
        id: 1,
        type: "true_false",
        question: `Sample true/false for ${subjectName}: "${topicLabel}" is a key part of ${subjectName}.`,
        correct_answer: "true",
        difficulty: "easy"
      });
      if (questionCount > 1) {
        exampleQuestions.push({
          id: 2,
          type: "true_false",
          question: `Another sample true/false for ${subjectName}: the opposite of "${topicLabel}" applies here.`,
          correct_answer: "false",
          difficulty: "easy"
        });
      }
    }

    const formatExample = JSON.stringify({ questions: exampleQuestions }, null, 2);

    const prompt = `Generate JSON questions for this exam segment.

Subject: ${subjectName}
Academic Level: ${academicLevel || 'Not specified'}
Difficulty Level: ${difficulty.toUpperCase()}
Question Range: ${segment.range} (generate exactly ${questionCount} questions)
Topics: ${segment.topics.join(', ')}
Question Types for this segment: ${qTypesInfo}

DIFFICULTY GUIDELINES:
- EASY: Generate very basic, straightforward, easiest questions. Simple direct formula application.
- MEDIUM: Generate average, moderate-difficulty questions requiring basic problem-solving steps.
- HARD: Generate complex, challenging, multi-step questions requiring advanced logical deduction.
- ADVANCE: Generate the absolute hardest, most complex, advanced, and extremely non-trivial questions possible for this topic and academic level. Do not hold back — these should push the student to their absolute limit and cover the toughest exam-level edge cases.

STRICT RULES:
${rules.join('\n')}

Required format (no extra fields):
${formatExample}`;

    let textPrompt = prompt;
    let userMessageContent = [];

    if (files && files.length > 0) {
      textPrompt = `The User put some reference to make questions , see the reference if its theory then ask questions from that theory , or if questions and the answer key is provided then take questions from there and if answer key not there then make questions like those questions , if the reference has many diagrams and you are making diagram related questions then ask questions those are answerable without viewing the diagram , if the reference images or pdfs not showed or the image or pdf reference is wrong or non related data , then it must be a mistake you simply ignore the images and pdf.\n\n` + textPrompt;
    }

    userMessageContent.push({ type: 'text', text: textPrompt });

    if (files && files.length > 0) {
      files.forEach(f => {
        const fileUrl = f.url || f.base64;
        if (fileUrl) {
          userMessageContent.push({
            type: 'image_url',
            image_url: { url: fileUrl }
          });
        }
      });
    }

    let messages = [
      { role: 'system', content: `You are an exam question generator. Return only valid JSON. For any math content, use ONLY $...$ delimiters (single dollar signs). NEVER use \\( \\) or \\[ \\] delimiters. NEVER double-wrap expressions like $\\(...\\)$. VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes. If you output a single backslash like \\frac, it will break JSON parsing and make the result invalid JSON.` }
    ];

    if (files && files.length > 0) {
      messages.push({ role: 'user', content: userMessageContent });
    } else {
      messages.push({ role: 'user', content: textPrompt });
    }

    console.log(`[API QUESTIONS] Sending request to: ${apiUrl}`);
    console.log(`[API QUESTIONS] Using model: ${activeModel}`);
    console.log(`[API QUESTIONS] Messages payload:`, JSON.stringify(messages, null, 2));

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${meshKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: activeModel,
          messages: messages,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          ...(!isMistral && { reasoning_effort: "none" })
        })
      });
    } catch (fetchErr) {
      console.error('[API QUESTIONS] Fetch error calling AI gateway:', fetchErr);
      return res.status(502).json({ error: 'Failed to contact AI gateway', details: fetchErr.message });
    }

    const responseText = await response.text();
    console.log(`[API QUESTIONS] Response status: ${response.status}`);
    console.log(`[API QUESTIONS] Response text: ${responseText}`);

    let data = {};
    try {
      if (responseText) {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error('[API QUESTIONS] Failed to parse response as JSON:', parseErr);
    }

    if (!response.ok) {
      console.error(`${apiLabel} API request failed:`, response.status, responseText);
      return res.status(502).json({ 
        error: `${apiLabel} API request failed`, 
        code: data.error?.code, 
        details: data.error?.message || responseText, 
        request_id: data.error?.request_id 
      });
    }

    let content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      return res.status(502).json({ error: `${apiLabel} API returned no content` });
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
            response_format: { type: 'json_object' },
            ...(!isMistral && { reasoning_effort: "none" })
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
          const aiRepaired = await repairJsonWithAI(content);
          if (aiRepaired) {
            parsedQuestions = aiRepaired;
            break;
          }
          await refundCredits();
          return res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: content });
        }
      }
    }

    const fixLatex = (obj) => {
      if (typeof obj === 'string') {
        let s = obj;
        s = s.replace(/\$\s*\\+\(\s*([\s\S]*?)\s*\\+\)\s*\$/g, (_, inner) => `$${inner}$`);
        s = s.replace(/\\+\(([\s\S]*?)\\+\)/g, (_, inner) => `$${inner}$`);
        s = s.replace(/\\+\[([\s\S]*?)\\+\]/g, (_, inner) => `$${inner}$`);
        s = s.replace(/\\+(?= )/g, '\\\\');
        return s;
      }
      if (Array.isArray(obj)) return obj.map(fixLatex);
      if (obj && typeof obj === 'object') { for (const k in obj) obj[k] = fixLatex(obj[k]); }
      return obj;
    };
    parsedQuestions = fixLatex(parsedQuestions);

    const ALLOWED_FIELDS = ['id', 'type', 'question', 'options', 'correct_answer', 'difficulty'];
    parsedQuestions.questions = parsedQuestions.questions.map(q => {
      const clean = {};
      for (const k of ALLOWED_FIELDS) if (q[k] !== undefined) clean[k] = q[k];
      return clean;
    });

    if (Array.isArray(parsedQuestions?.questions)) {
      for (const q of parsedQuestions.questions) {
        if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0) {
          const correctStr = String(q.correct_answer || '').trim();

          if (!correctStr) continue;

          if (q.options.includes(correctStr)) continue;

          let matchedOption = null;

          for (const opt of q.options) {
            if (String(opt).trim().toLowerCase() === correctStr.toLowerCase()) {
              matchedOption = opt;
              break;
            }
          }

          if (!matchedOption) {
            const matchLetter = correctStr.match(/^(?:option\s+)?([a-d])\b/i);
            if (matchLetter) {
              const letter = matchLetter[1].toUpperCase();
              const index = letter.charCodeAt(0) - 65;
              if (index >= 0 && index < q.options.length) {
                matchedOption = q.options[index];
              }
            }
          }

          if (!matchedOption) {
            for (const opt of q.options) {
              const optStr = String(opt).trim();
              if (optStr.toLowerCase().startsWith(correctStr.toLowerCase()) || correctStr.toLowerCase().startsWith(optStr.toLowerCase())) {
                matchedOption = opt;
                break;
              }
            }
          }

          if (matchedOption !== null) {
            q.correct_answer = matchedOption;
          }
        }
      }
    }

    if (!Array.isArray(parsedQuestions?.questions) || parsedQuestions.questions.length === 0) {
      await refundCredits();
      return res.status(422).json({ error: 'Response missing questions array', raw: content });
    }

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

    return res.status(200).json({ success: true, questions: parsedQuestions.questions, raw: content });
  } catch (error) {
    if (!creditsPreReserved && !isByok && supabaseUrl && supabaseAnonKey && userId && authToken) {
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
