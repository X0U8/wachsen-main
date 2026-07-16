import React from 'react';
import { BookOpen, Square } from 'lucide-react';
import MathText from '../../ui/MathText';
import { fontSize } from '../../lib/utils';

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
            <div className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal text-sm [&>span]:inline">
              <span className="font-bold text-zinc-650 dark:text-zinc-350 mr-1.5 select-none text-sm">
                Q{qNum}.
              </span>
              <MathText text={(question.question || question.text || '').trim()} />
            </div>

            <div className="space-y-3">
              <div
                className="flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm w-full overflow-hidden break-words">
                <div className="break-words w-full">
                  <span className="text-zinc-500 font-medium block mb-1">Your Answer:</span>
                  <span className="text-red-650 dark:text-red-400 font-medium break-words block w-full whitespace-normal">
                    {question.userAnswer ? <MathText text={question.userAnswer} /> : <span className="text-zinc-500 dark:text-zinc-650 ">Skipped</span>}
                  </span>
                </div>
                {(question.correctAnswer || question.correct_answer) && (
                  <div className="break-words w-full">
                    <span className="text-zinc-500 font-medium block mb-1">Correct Answer:</span>
                    <span className="text-green-600 dark:text-green-400 font-medium break-words block w-full whitespace-normal">
                      <MathText text={question.correctAnswer || question.correct_answer || ''} />
                    </span>
                  </div>
                )}
              </div>

              {question.concept && (
                <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 rounded-xl space-y-1">
                  <div
                    className="text-blue-500 dark:text-blue-400 flex items-center gap-1.5  tracking-wider font-semibold text-xs">
                    <Square className="w-2.5 h-2.5 fill-current text-blue-500 dark:text-blue-400" />
                    Subtopic
                  </div>
                  <div className="text-zinc-750 dark:text-zinc-300 leading-relaxed text-sm">
                    <MathText text={question.concept} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
