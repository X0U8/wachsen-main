import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import MathText from '../../ui/MathText';
import { normalizeQuestionType } from '../RevisionLog';

interface Question {
  id: string;
  text?: string;
  question?: string;
  correctAnswer: string;
  correct_answer?: string;
  questionType?: string;
  shuffledOptions?: string[];
  options?: string[];
  timeSpent?: number;
}

interface RevisionRetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  retryData: Question[];
  currentRetryIndex: number;
  setCurrentRetryIndex: React.Dispatch<React.SetStateAction<number>>;
  retryAnswers: Record<string, string>;
  setRetryAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  retryResults: Record<string, { isCorrect: boolean; explanation?: string }>;
  handleRetryAnswer: (questionId: string, answer: string) => void;
  handleAISelfCheck: (questionId: string, answer: string) => Promise<void>;
  checkingAI: Record<string, boolean>;
}

export default function RevisionRetryModal({
  isOpen,
  onClose,
  retryData,
  currentRetryIndex,
  setCurrentRetryIndex,
  retryAnswers,
  setRetryAnswers,
  retryResults,
  handleRetryAnswer,
  handleAISelfCheck,
  checkingAI
}: RevisionRetryModalProps) {
  if (!isOpen || retryData.length === 0) return null;

  const question = retryData[currentRetryIndex];
  const result = retryResults[question.id];
  const answer = retryAnswers[question.id];

  const qType = normalizeQuestionType((question as any).type || question.questionType);
  const isMCQ = qType === 'mcq';
  const isInteger = qType === 'integer';
  const isTrueFalse = qType === 'true_false';
  const isFinished = Object.keys(retryResults).length === retryData.length && retryData.length > 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-2xl h-[600px] flex flex-col justify-between shadow-2xl relative overflow-hidden text-zinc-900 dark:text-white">
        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-white flex items-center gap-2 uppercase tracking-wider">
            Retry Questions
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <div className="flex-grow flex flex-col justify-between overflow-hidden mt-4 space-y-4">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex-shrink-0">
              <span>Question {currentRetryIndex + 1} of {retryData.length}</span>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-850/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-xs font-bold text-zinc-650 dark:text-zinc-300 flex-shrink-0">
                    {currentRetryIndex + 1}
                  </div>
                  <div className="flex-grow space-y-4">
                    <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal h-32 overflow-y-auto pr-1">
                      <MathText text={question.question || question.text || ''} />
                    </div>

                    {(isMCQ || isTrueFalse) ? (
                      <div className="space-y-2">
                        {question.shuffledOptions && question.shuffledOptions.map((option: string, optIdx: number) => (
                          <button
                            key={optIdx}
                            onClick={() => !result && handleRetryAnswer(question.id, option)}
                            disabled={!!result}
                            className={`w-full p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${result
                              ? result.isCorrect && String(question.correctAnswer ?? question.correct_answer) === option
                                ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400 font-medium'
                                : answer === option && !result.isCorrect
                                  ? 'bg-red-500/10 border-red-500/40 text-red-655 dark:text-red-400 font-medium'
                                  : 'bg-zinc-100/50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-850/50 opacity-40 text-zinc-450 dark:text-zinc-600'
                              : answer === option
                                ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold'
                                : 'bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 text-zinc-750 dark:text-zinc-300'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 dark:text-zinc-400">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span><MathText text={option} /></span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : isInteger ? (
                      /* Integer: Simple text input */
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={answer || ''}
                          onChange={(e) => !result && setRetryAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                          disabled={!!result}
                          placeholder="Enter numeric answer..."
                          className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/30 text-xs text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 disabled:opacity-50 focus:outline-none focus:border-blue-500"
                        />
                        {!result && (
                          <button
                            onClick={() => handleRetryAnswer(question.id, answer)}
                            disabled={!answer}
                            className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-xl text-xs text-blue-600 dark:text-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium cursor-pointer"
                          >
                            Submit Answer
                          </button>
                        )}
                      </div>
                    ) : null}

                    {result && (
                      <div className={`mt-3 p-3 rounded-xl text-xs font-semibold ${result.isCorrect
                        ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-655 dark:text-red-400'
                        }`}>
                        {result.isCorrect ? 'Correct!' : 'Incorrect'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-4 flex-shrink-0">
                <button
                  onClick={() => {
                    if (currentRetryIndex < retryData.length - 1) {
                      setCurrentRetryIndex(prev => prev + 1);
                    }
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {currentRetryIndex === retryData.length - 1 ? 'See Results Summary' : 'Next Question'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Results summary when finished */
          <div className="flex-grow flex flex-col justify-center bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-5 space-y-4 my-4 overflow-y-auto">
            <h4 className="text-xs font-semibold text-zinc-800 dark:text-white uppercase tracking-wider">Retry Results</h4>
            <div className="text-sm text-zinc-650 dark:text-gray-300">
              {(() => {
                const correctCount = Object.values(retryResults).filter(r => r.isCorrect).length;
                const totalCount = retryData.length;
                const percentage = (correctCount / totalCount) * 100;

                let message = '';
                let messageColor = '';

                if (percentage < 50) {
                  message = 'Hmm these questions still need revisions';
                  messageColor = 'text-orange-600 dark:text-orange-450';
                } else if (percentage < 70) {
                  message = 'Moderate performance';
                  messageColor = 'text-yellow-600 dark:text-yellow-450';
                } else if (percentage < 80) {
                  message = 'Good';
                  messageColor = 'text-green-600 dark:text-green-450';
                } else if (percentage < 90) {
                  message = 'Great';
                  messageColor = 'text-green-500 dark:text-green-400';
                } else {
                  message = 'This concepts are properly revised';
                  messageColor = 'text-green-600 dark:text-green-300';
                }

                return (
                  <div>
                    <div className="text-lg font-bold text-zinc-850 dark:text-white mb-1">
                      {correctCount} / {totalCount} correct ({Math.round(percentage)}%)
                    </div>
                    <div className={`text-xs ${messageColor} mb-4 font-medium`}>{message}</div>
                    <button
                      onClick={onClose}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer"
                    >
                      Close Summary
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
