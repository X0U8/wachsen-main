import { safeParseJSON } from '../RevisionLog';

export interface VivaAnswerRecord {
  questionIndex: number;
  question: string;
  userTranscription: string;
  correctness: 'correct' | 'partial' | 'incorrect';
  feedback: string;
}

export interface VivaAnalysis {
  overall_rating: number;
  fluency: number;
  confidence: number;
  feedback: string;
  perQuestion: Array<{
    questionIndex: number;
    correctness: 'correct' | 'partial' | 'incorrect';
    feedback: string;
    overall: string;
  }>;
}

export async function analyzeVivaSession(
  answers: VivaAnswerRecord[],
  userId: string,
  authToken: string
): Promise<VivaAnalysis> {
  const prompt = `You are an expert viva examiner. Review the following oral-exam responses and produce a final analysis.

Student responses:
${answers.map((a, i) => `${i + 1}. Q: ${a.question}\n   Transcribed answer: ${a.userTranscription || '(no answer)'}\n   Correctness: ${a.correctness}\n   Feedback: ${a.feedback}`).join('\n\n')}

Return ONLY a valid JSON object in this exact format:
{
  "overall_rating": 0-10,
  "fluency": 0-10,
  "confidence": 0-10,
  "feedback": "2-3 encouraging sentences summarizing strengths and one concrete improvement area.",
  "perQuestion": [
    {
      "questionIndex": 0,
      "correctness": "correct" | "partial" | "incorrect",
      "feedback": "Concise feedback for this specific answer.",
      "overall": "One-line verdict on this answer."
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
    throw new Error(data.error || 'Failed to analyze viva session');
  }

  const cleaned = (data.reply || '').replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
  const parsed: VivaAnalysis = safeParseJSON(cleaned);

  if (
    typeof parsed.overall_rating !== 'number' ||
    typeof parsed.fluency !== 'number' ||
    typeof parsed.confidence !== 'number' ||
    !parsed.feedback ||
    !Array.isArray(parsed.perQuestion)
  ) {
    throw new Error('Invalid analysis response from AI');
  }

  return parsed;
}
