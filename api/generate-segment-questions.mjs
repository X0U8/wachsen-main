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
    const { segment, subjectName, questionTypes, difficulty, userId, authToken, apiKey: userKey, provider, model, creditsPreReserved } = req.body;
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

    // Reserve credits BEFORE calling AI (skip if credits were pre-reserved by FinalizeExam)
    if (!creditsPreReserved && !userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
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

    // Flatten question types to identify exactly what this segment range contains
    const questionSequence = [];
    for (const qt of questionTypes) {
      for (let i = 0; i < qt.count; i++) {
        questionSequence.push(qt);
      }
    }

    let segmentType = (segment.type || '').toLowerCase().trim();
    if (!segmentType) {
      // Fallback: detect type from range sequence
      const segStart = parseInt(segment.range.split('-')[0]);
      const qTypeObj = questionSequence[segStart - 1];
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

    const exampleQuestions = [];
    if (hasMcq) {
      exampleQuestions.push({
        id: 1,
        type: "mcq",
        question: "What is the capital of France?",
        options: ["Option P value", "Option Q value", "Option R value", "Option S value"],
        correct_answer: "Option S value",
        difficulty: "easy"
      });
      exampleQuestions.push({
        id: 2,
        type: "mcq",
        question: "Which of the following is a prime number?",
        options: ["Option P value", "Option Q value", "Option R value", "Option S value"],
        correct_answer: "Option Q value",
        difficulty: "easy"
      });
    }
    if (hasInteger) {
      exampleQuestions.push({
        id: 1,
        type: "integer",
        question: "Compute $5 + 3$.",
        correct_answer: "8",
        difficulty: "easy"
      });
      exampleQuestions.push({
        id: 2,
        type: "integer",
        question: "What is the value of $10 - 2$?",
        correct_answer: "8",
        difficulty: "easy"
      });
    }
    if (hasTrueFalse) {
      exampleQuestions.push({
        id: 1,
        type: "true_false",
        question: "Water boils at $100^\\circ$C.",
        correct_answer: "true",
        difficulty: "easy"
      });
      exampleQuestions.push({
        id: 2,
        type: "true_false",
        question: "Sound travels faster in a vacuum than in air.",
        correct_answer: "false",
        difficulty: "easy"
      });
    }

    const formatExample = JSON.stringify({ questions: exampleQuestions }, null, 2);

    const prompt = `Generate JSON questions for this exam segment.

Subject: ${subjectName}
Difficulty Level: ${difficulty.toUpperCase()}
Question Range: ${segment.range} (generate exactly ${questionCount} questions)
Topics: ${segment.topics.join(', ')}
Question Types for this segment: ${qTypesInfo}

DIFFICULTY GUIDELINES:
- EASY: Generate very basic, straightforward, easiest questions. Simple direct formula application.
- MEDIUM: Generate average, moderate-difficulty questions requiring basic problem-solving steps.
- HARD: Generate complex, challenging, multi-step questions requiring advanced logical deduction.
- ADVANCE: Generate the toughest, most complex, advanced, and extremely non-trivial questions possible.

STRICT RULES:
${rules.join('\n')}

Required format (no extra fields):
${formatExample}`;


    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${meshKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: 'You are an exam question generator. Return only valid JSON. For any math content, wrap LaTeX expressions in $...$ delimiters. Ensure all backslashes in LaTeX commands are properly escaped for JSON (e.g. a single backslash becomes \\\\).' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: 'json_object' }
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
            max_tokens: 2048,
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

    // Normalize LaTeX row separators: any run of backslashes before a space → exactly \\
    const fixLatex = (obj) => {
      if (typeof obj === 'string') return obj.replace(/\\+(?= )/g, '\\\\');
      if (Array.isArray(obj)) return obj.map(fixLatex);
      if (obj && typeof obj === 'object') { for (const k in obj) obj[k] = fixLatex(obj[k]); }
      return obj;
    };
    parsedQuestions = fixLatex(parsedQuestions);

    const refundCredits = async () => {
      if (creditsPreReserved) return; // FinalizeExam handles refund for pre-reserved credits
      if (!userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
        const authed = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${authToken}` } } });
        const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
        await authed.from('profiles').update({ credits: (profile?.credits || 0) + questionCount }).eq('id', userId);
      }
    };

    // Strip extra fields — keep only what we need, regardless of what AI added
    const ALLOWED_FIELDS = ['id', 'type', 'question', 'options', 'correct_answer', 'difficulty'];
    parsedQuestions.questions = parsedQuestions.questions.map(q => {
      const clean = {};
      for (const k of ALLOWED_FIELDS) if (q[k] !== undefined) clean[k] = q[k];
      return clean;
    });

    // Post-process MCQ correct_answer to resolve mismatch/label issues (e.g. correct_answer is "Option A" but option is "Option A: $x^2$")
    if (Array.isArray(parsedQuestions?.questions)) {
      for (const q of parsedQuestions.questions) {
        if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0) {
          const correctStr = String(q.correct_answer || '').trim();
          
          if (!correctStr) continue;

          // If it matches exactly one of the options, we are good.
          if (q.options.includes(correctStr)) continue;

          let matchedOption = null;

          // 1. Case-insensitive exact match
          for (const opt of q.options) {
            if (String(opt).trim().toLowerCase() === correctStr.toLowerCase()) {
              matchedOption = opt;
              break;
            }
          }

          // 2. Try parsing index from "A", "B", "C", "D", "Option A", "option a" etc.
          if (!matchedOption) {
            const matchLetter = correctStr.match(/^(?:option\s+)?([a-d])\b/i);
            if (matchLetter) {
              const letter = matchLetter[1].toUpperCase();
              const index = letter.charCodeAt(0) - 65; // A=0, B=1...
              if (index >= 0 && index < q.options.length) {
                matchedOption = q.options[index];
              }
            }
          }

          // 3. Prefix matching: if option starts with correct_answer (e.g. option is "Option A: text", correctStr is "Option A")
          // or if correct_answer starts with option (e.g. correctStr is "Option A: text", option is "Option A")
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
    // Refund credits on failure (skip if pre-reserved — FinalizeExam handles that)
    if (!creditsPreReserved && !userKey && supabaseUrl && supabaseAnonKey && userId && authToken) {
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
