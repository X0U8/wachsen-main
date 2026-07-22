import { safeParseJSON } from '../RevisionLog';

export interface LaqAnalysis {
  overall_rating: number;
  accuracy: number;
  accuracy_reason: string;
  depth: number;
  depth_reason: string;
  clarity: number;
  clarity_reason: string;
  feedback: string;
  perQuestion: Array<{
    questionIndex: number;
    correctness: 'correct' | 'partial' | 'incorrect';
    rating: number;
    feedback: string;
    overall: string;
  }>;
}

export async function analyzeLaqSession(
  answers: LaqAnswerRecord[],
  userId: string,
  authToken: string,
  isViva: boolean = false
): Promise<LaqAnalysis> {
  const modeText = isViva ? 'spoken oral answers (transcribed from voice)' : 'long-form written answers';
  const formattingInstruction = isViva 
    ? 'Since these are spoken responses transcribed to text, be understanding of minor transcription issues, conversational flow, or natural spoken formatting. Focus on the student\'s core conceptual accuracy and spoken explanation quality. Note: each answer was recorded with a 55-second limit (~120-140 words), so judge depth and completeness within that constraint — do not penalise for brevity if the core answer is complete.'
    : 'Evaluate the answers based on typical written-exam rigor, detail, accuracy, and clear structure.';

  const prompt = `You are an expert examiner speaking directly to the student. Always use second-person ("you", "your") — never say "the student" or "the user".
Review the following ${modeText} and produce a final analysis.
${formattingInstruction}

Evaluation Rubrics:
1. Accuracy: How correct, precise, and concise your answer is. A conceptually correct answer does not automatically get a high score if it is bloated, vague, or has irrelevant facts.
2. Depth: Whether you demonstrated proper conceptual knowledge and included all critical information needed, while staying concise without unnecessary fluff.
3. Clarity: Depends on your grammar, structure, and expression:
   - Written LAQ: Strict on grammar, spelling, written structure, and sentence presentation.
   - Spoken Viva: Judged on spoken grammar, natural flow, fluency, and expression from the transcript.

Tone & Length Rules:
- Address the student as "you" / "your" everywhere.
- Keep ALL reasons and feedback concise — 1-3 short sentences max. No long paragraphs. Be direct and to the point.

JSON Output Generation Policy:
Think through reasons and improvement spots BEFORE deciding on numerical scores. Write reason fields before score fields in the JSON.

When using mathematical formulas, use LaTeX in single dollar signs (e.g. $x^2 + y^2 = z^2$).
IMPORTANT: Inside JSON strings, escape every backslash with a double backslash (e.g., \\\\frac{...} not \\frac{...}).

Your responses:
${answers.map((a, i) => `${i + 1}. Q: ${a.question}
   Answer: ${a.userAnswer || '(no response provided)'}`).join('\n\n')}

Return ONLY a valid JSON object in this exact format:
{
  "accuracy_reason": "Concise reason for this accuracy score. If < 10, state exactly where your answer was incorrect, vague, or verbose and how to fix it.",
  "accuracy": 0-10,
  "depth_reason": "Concise reason for this depth score. If < 10, state what key info you missed or where you added unnecessary fluff.",
  "depth": 0-10,
  "clarity_reason": "Concise reason for this clarity score. If < 10, point out the exact spots where your grammar, fluency, or structure fell short.",
  "clarity": 0-10,
  "feedback": "2-3 short encouraging sentences summarizing your strengths and one concrete area to improve.",
  "overall_rating": 0-10,
  "perQuestion": [
    {
      "questionIndex": 0,
      "feedback": "Concise feedback for this answer. If < 10, state the reason for cutting marks and the exact spot to fix.",
      "overall": "One-line verdict.",
      "correctness": "correct" | "partial" | "incorrect",
      "rating": 0-10
    }
  ]
}
`;

  const response = await fetch('/api/ask-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: prompt,
      correctAnswer: '',
      userAnswer: '',
      userId,
      authToken,
      useOwnKey: false,
      deductAmount: 0,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to analyze session');
  }

  const cleaned = (data.reply || '').replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
  const parsed: LaqAnalysis = safeParseJSON(cleaned);

  if (
    typeof parsed.overall_rating !== 'number' ||
    typeof parsed.accuracy !== 'number' ||
    typeof parsed.accuracy_reason !== 'string' ||
    typeof parsed.depth !== 'number' ||
    typeof parsed.depth_reason !== 'string' ||
    typeof parsed.clarity !== 'number' ||
    typeof parsed.clarity_reason !== 'string' ||
    !parsed.feedback ||
    !Array.isArray(parsed.perQuestion)
  ) {
    throw new Error('Invalid analysis response from AI');
  }

  return parsed;
}

export interface LaqAnswerRecord {
  questionIndex: number;
  question: string;
  userAnswer: string;
  correctness: 'correct' | 'partial' | 'incorrect';
  feedback: string;
}
