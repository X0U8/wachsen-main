import { safeParseJSON } from '../RevisionLog';

export interface VivaAnswerEvaluation {
  correctness: 'correct' | 'partial' | 'incorrect';
  feedback: string;
}

export async function evaluateVivaAnswer(
  question: string,
  expectedAnswer: string,
  keywords: string[],
  userTranscription: string,
  userId: string,
  authToken: string
): Promise<VivaAnswerEvaluation> {
  const prompt = `You are evaluating a viva / oral exam answer.

Question: """${question}"""
Expected answer: """${expectedAnswer}"""
Important keywords/concepts to look for: ${keywords.join(', ') || 'none specified'}
Student's spoken answer (transcribed): """${userTranscription || '(no answer provided)'}"""

Evaluate the student's answer. Be fair: partial credit if they mention key ideas but miss details. Return ONLY a valid JSON object in this exact format:
{
  "correctness": "correct" | "partial" | "incorrect",
  "feedback": "One concise sentence of encouragement or what to improve."
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
    throw new Error(data.error || 'Failed to evaluate answer');
  }

  const cleaned = (data.reply || '').replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
  const parsed: VivaAnswerEvaluation = safeParseJSON(cleaned);

  if (!parsed.correctness || !parsed.feedback) {
    return {
      correctness: 'incorrect',
      feedback: 'Could not evaluate this answer. Try speaking more clearly.',
    };
  }

  return parsed;
}
