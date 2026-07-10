import React from 'react';
import { BookOpen } from 'lucide-react';
import MathText from '../../ui/MathText';

interface Question {
  id: string;
  text?: string;
  question?: string;
  originalIndex?: number;
  correctAnswer: string;
  correct_answer?: string;
  userAnswer: string | null;
  concept: string;
}

interface RevisionQuestionsListProps {
  questions: Question[];
}

export default function RevisionQuestionsList({ questions }: RevisionQuestionsListProps) {
  return (
    <div className="space-y-4">
      {questions.map((question, idx) => {
        const qNum = (typeof question.originalIndex === 'number' ? question.originalIndex : idx) + 1;
        return (
          <div key={question.id || idx} className="bg-white dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-xs font-bold text-zinc-650 dark:text-zinc-300 flex-shrink-0">
                {qNum}
              </div>
              <div className="flex-1 space-y-4">
                <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
                  <MathText text={question.question || question.text || ''} />
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-850 text-[11px]">
                <div>
                  <span className="text-zinc-500 font-medium block mb-1">Your Answer:</span>
                  <span className="text-red-650 dark:text-red-400/90 font-medium">
                    {question.userAnswer ? <MathText text={question.userAnswer} /> : <span className="text-zinc-450 dark:text-zinc-650 italic">Skipped</span>}
                  </span>
                </div>
                {(question.correctAnswer || question.correct_answer) && (
                  <div>
                    <span className="text-zinc-500 font-medium block mb-1">Correct Answer:</span>
                    <span className="text-green-600 dark:text-green-400/90 font-medium">
                      <MathText text={question.correctAnswer || question.correct_answer || ''} />
                    </span>
                  </div>
                )}
              </div>

              {question.concept && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/50">
                  <div className="text-[9px] text-zinc-500 mb-1 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
                    <BookOpen className="w-3 h-3 text-zinc-450 dark:text-zinc-600" />
                    Subtopic / Concept
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <MathText text={question.concept} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ); })}
    </div>
  );
}
