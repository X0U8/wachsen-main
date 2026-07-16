import { safeParseJSON } from '../RevisionLog';

export interface LaqAnswerEvaluation {
  correctness: 'correct' | 'partial' | 'incorrect';
  feedback: string;
}

export async function evaluateLaqAnswer(
  question: string,
  expectedAnswer: string,
  keywords: string[],
  userAnswer: string,
  userId: string,
  authToken: string
): Promise<LaqAnswerEvaluation> {
  const prompt = `You are grading a long-form written answer.

Question: """${question}"""
Expected answer: """${expectedAnswer}"""
Important keywords/concepts to look for: ${keywords.join(', ') || 'none specified'}
Student's written answer: """${userAnswer || '(no answer provided)'}"""

Evaluate the student's answer on accuracy, depth, and clarity. Be fair: partial credit if they mention key ideas but miss details. Return ONLY a valid JSON object in this exact format:
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
      deductAmount: 0,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to evaluate answer');
  }

  const cleaned = (data.reply || '').replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
  const parsed: LaqAnswerEvaluation = safeParseJSON(cleaned);

  if (!parsed.correctness || !parsed.feedback) {
    return {
      correctness: 'incorrect',
      feedback: 'Could not evaluate this answer. Try writing more clearly.',
    };
  }

  return parsed;
}
