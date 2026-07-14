import { safeParseJSON } from '../RevisionLog';

export interface LaqAnswerRecord {
  questionIndex: number;
  question: string;
  userAnswer: string;
  correctness: 'correct' | 'partial' | 'incorrect';
  feedback: string;
}

export interface LaqAnalysis {
  overall_rating: number;
  accuracy: number;
  depth: number;
  clarity: number;
  feedback: string;
  perQuestion: Array<{
    questionIndex: number;
    correctness: 'correct' | 'partial' | 'incorrect';
    rating: number;
    feedback: string;
    overall: string;
    userAnswer: string;
  }>;
}

export async function analyzeLaqSession(
  answers: LaqAnswerRecord[],
  userId: string,
  authToken: string
): Promise<LaqAnalysis> {
  const prompt = `You are an expert examiner. Review the following long-form written answers and produce a final analysis.

Student responses:
${answers.map((a, i) => `${i + 1}. Q: ${a.question}
   Answer: ${a.userAnswer || '(no answer)'}
   Correctness: ${a.correctness}
   Feedback: ${a.feedback}`).join('\n\n')}

Return ONLY a valid JSON object in this exact format:
{
  "overall_rating": 0-10,
  "accuracy": 0-10,
  "depth": 0-10,
  "clarity": 0-10,
  "feedback": "2-3 encouraging sentences summarizing strengths and one concrete improvement area.",
  "perQuestion": [
    {
      "questionIndex": 0,
      "correctness": "correct" | "partial" | "incorrect",
      "rating": 0-10,
      "feedback": "Concise feedback for this specific answer.",
      "overall": "One-line verdict on this answer.",
      "userAnswer": "${answers[0]?.userAnswer || ''}"
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
      provider: 'mesh',
      model: '',
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
    typeof parsed.depth !== 'number' ||
    typeof parsed.clarity !== 'number' ||
    !parsed.feedback ||
    !Array.isArray(parsed.perQuestion)
  ) {
    throw new Error('Invalid analysis response from AI');
  }

  return parsed;
}
