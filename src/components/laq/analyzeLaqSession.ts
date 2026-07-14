import { safeParseJSON } from '../RevisionLog';

export interface LaqAnswerRecord {
  questionIndex: number;
  question: string;
  userAnswer: string;
  timeSpentSeconds: number;
}

export interface LaqAnalysisResult {
  overall_rating: number;
  accuracy: number;
  depth: number;
  clarity: number;
  ai_feedback: string;
  totalTimeSpentSeconds: number;
  perQuestion: Array<{
    questionIndex: number;
    question: string;
    correctness: 'correct' | 'partial' | 'incorrect';
    rating: number; // 0-10 per question
    feedback: string;
    userAnswer: string;
    timeSpentSeconds: number;
  }>;
}

export async function analyzeLaqSession(
  answers: LaqAnswerRecord[],
  totalTimeSpentSeconds: number,
  userId: string,
  authToken: string
): Promise<LaqAnalysisResult> {
  const prompt = `You are an expert examiner. Grade these long-form written answers.

Total time: ${Math.round(totalTimeSpentSeconds / 60)}m ${totalTimeSpentSeconds % 60}s

${answers.map((a, i) => `Q${i + 1}: ${a.question}
Answer: ${a.userAnswer || '(no answer provided)'}
Time: ${a.timeSpentSeconds}s`).join('\n\n')}

Return ONLY valid JSON in this exact format (no extra fields):
{
  "overall_rating": 0-10,
  "accuracy": 0-10,
  "depth": 0-10,
  "clarity": 0-10,
  "ai_feedback": "2-3 sentences summarizing overall strengths and one improvement area.",
  "perQuestion": [
    {
      "questionIndex": 0,
      "question": "exact question text",
      "correctness": "correct" | "partial" | "incorrect",
      "rating": 0-10,
      "feedback": "One concise sentence of feedback for this answer.",
      "userAnswer": "exact user answer text",
      "timeSpentSeconds": 0
    }
  ]
}`;

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
  const parsed: LaqAnalysisResult = safeParseJSON(cleaned);

  if (
    typeof parsed.overall_rating !== 'number' ||
    typeof parsed.accuracy !== 'number' ||
    typeof parsed.depth !== 'number' ||
    typeof parsed.clarity !== 'number' ||
    !parsed.ai_feedback ||
    !Array.isArray(parsed.perQuestion)
  ) {
    throw new Error('Invalid analysis response from AI');
  }

  return parsed;
}
