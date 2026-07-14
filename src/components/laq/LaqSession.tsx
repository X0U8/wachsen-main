import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, Clock, AlertCircle, CheckCircle2, Loader2, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { evaluateLaqAnswer, LaqAnswerEvaluation } from './evaluateAnswer';
import { analyzeLaqSession, LaqAnswerRecord } from './analyzeLaqSession';
import type { LaqQuestion } from './MakeLaq';

export interface LaqExam {
  id: string;
  name: string;
  subject_name: string | null;
  topics: string | null;
  difficulty: string | null;
  question_count: number;
  time_limit_minutes: number | null;
  questions: LaqQuestion[];
  status: string;
}

interface LaqSessionProps {
  laq: LaqExam;
  onComplete: () => void;
}

interface AnswerState {
  text: string;
  evaluation: LaqAnswerEvaluation | null;
  submitted: boolean;
  timeSpentSeconds: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MAX_CHARS = 500;

export default function LaqSession({ laq, onComplete }: LaqSessionProps) {
  const { userProfile } = useUserProfile();

  const totalTimeSeconds = (laq.time_limit_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(totalTimeSeconds);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    laq.questions.map(() => ({ text: '', evaluation: null, submitted: false, timeSpentSeconds: 0 }))
  );
  const [reviewList, setReviewList] = useState<Set<number>>(new Set());
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  const totalQuestions = laq.questions.length;
  const currentQuestion = laq.questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Countdown timer
  useEffect(() => {
    if (finished) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [finished]);

  // Per-question elapsed timer
  useEffect(() => {
    if (finished) return;
    setCurrentElapsedSeconds(0);
    elapsedRef.current = setInterval(() => {
      setCurrentElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [currentIndex, finished]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft <= 0 && !finished && !submitting) {
      handleSubmitAll();
    }
  }, [timeLeft, finished, submitting]);

  const recordTimeForCurrent = useCallback(() => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], timeSpentSeconds: next[currentIndex].timeSpentSeconds + currentElapsedSeconds };
      return next;
    });
  }, [currentIndex, currentElapsedSeconds]);

  const handleAnswerChange = (value: string) => {
    if (value.length > MAX_CHARS) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], text: value };
      return next;
    });
  };

  const toggleReview = (idx: number) => {
    setReviewList((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleEvaluate = async () => {
    if (!userProfile?.id || !currentAnswer.text.trim()) return;
    setEvaluating(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const evaluation = await evaluateLaqAnswer(
        currentQuestion.question,
        currentQuestion.expectedAnswer,
        currentQuestion.keywords || [],
        currentAnswer.text,
        userProfile.id,
        authToken
      );

      recordTimeForCurrent();

      setAnswers((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex], evaluation, submitted: true };
        return next;
      });
    } catch (err: any) {
      console.error('Evaluation error:', err);
      setError(err.message || 'Failed to evaluate answer.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleFinish = async () => {
    if (!currentAnswer.submitted && currentAnswer.text.trim()) {
      await handleEvaluate();
    }
    await handleSubmitAll();
  };

  const handleSubmitAll = async () => {
    if (!userProfile?.id || submitting || finished) return;
    setSubmitting(true);
    setError('');
    setFinished(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const finalAnswers = [...answers];
      for (let i = 0; i < finalAnswers.length; i++) {
        if (!finalAnswers[i].submitted) {
          if (!finalAnswers[i].text.trim() && i === currentIndex) {
            try {
              const evalResult = await evaluateLaqAnswer(
                laq.questions[i].question,
                laq.questions[i].expectedAnswer,
                laq.questions[i].keywords || [],
                finalAnswers[i].text,
                userProfile.id,
                authToken
              );
              finalAnswers[i] = { ...finalAnswers[i], evaluation: evalResult, submitted: true };
            } catch {
              finalAnswers[i] = {
                ...finalAnswers[i],
                evaluation: { correctness: 'incorrect' as const, feedback: 'No answer provided.' },
                submitted: true,
              };
            }
          }
        }
      }

      setAnswers(finalAnswers);

      const totalTimeSpentSeconds = totalTimeSeconds - timeLeft;

      const records: LaqAnswerRecord[] = finalAnswers.map((a, idx) => ({
        questionIndex: idx,
        question: laq.questions[idx].question,
        userAnswer: a.text,
        correctness: a.evaluation?.correctness || 'incorrect',
        feedback: a.evaluation?.feedback || 'No feedback available.',
        timeSpentSeconds: a.timeSpentSeconds || 0,
      }));

      const analysis = await analyzeLaqSession(records, totalTimeSpentSeconds, userProfile.id, authToken);

      const perQuestionWithAnswers = analysis.perQuestion.map((item) => ({
        ...item,
        userAnswer: records[item.questionIndex]?.userAnswer || '',
        timeSpentSeconds: records[item.questionIndex]?.timeSpentSeconds || 0,
      }));

      const { error: updateError } = await supabase
        .from('laq_exam')
        .update({
          status: 'completed',
          ai_analysis: {
            ...analysis,
            perQuestion: perQuestionWithAnswers,
            totalTimeSpentSeconds,
          },
        })
        .eq('id', laq.id);

      if (updateError) throw updateError;

      onComplete();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to submit. Please try again.');
      setFinished(false);
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = currentAnswer?.text.length || 0;
  const timePercent = (timeLeft / totalTimeSeconds) * 100;
  const timerUrgent = timeLeft < 60;

  const unansweredCount = answers.filter((a) => !a.text.trim()).length;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      {submitting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <div className="text-center">
            <h3 className="text-white font-bold text-lg">AI Grading In Progress...</h3>
            <p className="text-zinc-400 text-xs mt-1">Please wait while the AI reviews and evaluates your answers</p>
          </div>
        </div>
      )}

      <header className="px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-zinc-900 dark:text-white truncate max-w-[200px] text-sm font-semibold">{laq.name}</h1>
        </div>

        <div className="flex items-center justify-center flex-1">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border bg-zinc-200/30 dark:bg-gray-800/30 ${timerUrgent ? 'border-red-500/50 text-red-500' : 'border-zinc-350 dark:border-zinc-700 text-zinc-650 dark:text-zinc-350'}`}>
            <Clock className="w-3.5 h-3.5" />
            <span className="text-zinc-900 dark:text-white font-mono text-xs font-semibold">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end flex-1">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            Finish
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 w-full">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-zinc-250 dark:bg-gray-800 text-zinc-900 dark:text-white rounded-md text-[10px] uppercase tracking-wider font-semibold">
                        Q{currentIndex + 1}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-md text-[10px] uppercase tracking-wider font-semibold">
                        Max 500 chars
                      </span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-400 dark:text-gray-500 rounded-md text-[10px] uppercase tracking-wider border border-zinc-200 dark:border-gray-800">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(currentElapsedSeconds)}
                      </div>
                      <button
                        onClick={() => setShowQuestionModal(true)}
                        className="md:hidden flex items-center gap-1 text-[10px] text-zinc-400 dark:text-gray-500 hover:text-zinc-650 dark:hover:text-gray-300 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                        <span>Questions</span>
                      </button>
                    </div>
                    <button
                      onClick={() => toggleReview(currentIndex)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-semibold tracking-wider transition-all ${reviewList.has(currentIndex)
                        ? 'bg-amber-500 text-white'
                        : 'bg-zinc-200 dark:bg-gray-800 text-zinc-500 dark:text-gray-400 hover:bg-zinc-300 dark:hover:bg-gray-700'
                        }`}
                    >
                      {reviewList.has(currentIndex) ? 'In Review' : 'Mark for review'}
                    </button>
                  </div>
                  <h2 className="font-semibold leading-relaxed text-sm sm:text-base text-zinc-800 dark:text-zinc-150">
                    {currentQuestion.question}
                  </h2>
                </div>

                <div className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <textarea
                    value={currentAnswer?.text || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    disabled={currentAnswer?.submitted || finished}
                    placeholder="Type your answer here..."
                    rows={8}
                    maxLength={MAX_CHARS}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-white text-sm resize-none leading-relaxed disabled:opacity-50"
                  />

                  <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-550">
                    <span>{MAX_CHARS - charCount} characters remaining</span>
                    {currentAnswer?.submitted && (
                      <span className="text-green-500 font-semibold">✓ Checked by AI</span>
                    )}
                  </div>

                  {currentAnswer?.evaluation && (
                    <div
                      className={`p-4 rounded-2xl border text-xs sm:text-sm ${
                        currentAnswer.evaluation.correctness === 'correct'
                          ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                          : currentAnswer.evaluation.correctness === 'partial'
                          ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-500'
                      }`}
                    >
                      <span className="font-bold uppercase text-xs">
                        {currentAnswer.evaluation.correctness} Evaluation
                      </span>
                      <p className="mt-1 leading-relaxed">{currentAnswer.evaluation.feedback}</p>
                    </div>
                  )}

                  {!currentAnswer?.submitted && !finished && (
                    <button
                      onClick={handleEvaluate}
                      disabled={!currentAnswer?.text.trim() || evaluating}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20"
                    >
                      {evaluating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Check Answer'
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="hidden md:block w-64 shrink-0">
            <div className="bg-zinc-100/50 dark:bg-gray-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 max-h-[calc(100vh-8rem)] flex flex-col">
              <h3 className="font-semibold uppercase text-zinc-400 dark:text-gray-500 mb-4 shrink-0 text-[10px] tracking-wider">
                Questions
              </h3>

              <div className="grid grid-cols-5 gap-2 overflow-y-auto flex-1 pr-1 no-scrollbar">
                {Array.from({ length: totalQuestions }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-10 h-10 rounded-lg transition-all font-semibold ${
                      idx === currentIndex
                        ? 'bg-blue-600 text-white border border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)] ring-2 ring-blue-500/30'
                        : reviewList.has(idx)
                        ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                        : answers[idx]?.text.trim()
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                        : 'bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 border border-zinc-300 dark:border-gray-700 hover:border-zinc-450 dark:hover:border-gray-650'
                    } text-xs`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-zinc-200 dark:border-gray-800 pt-3 flex-shrink-0">
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                  <div className="w-3 h-3 rounded bg-blue-600"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                  <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                  <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30"></div>
                  <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                  <div className="w-3 h-3 rounded bg-zinc-200 dark:bg-gray-850 border border-zinc-300 dark:border-gray-750"></div>
                  <span>Skipped</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="p-4 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-t border-zinc-200 dark:border-gray-800 sticky bottom-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="flex-1 py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-750 disabled:opacity-30 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-1 overflow-x-auto max-w-[40%] no-scrollbar px-2 md:hidden">
            {Array.from({ length: totalQuestions }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                  idx === currentIndex
                    ? 'bg-blue-600 scale-125'
                    : reviewList.has(idx)
                    ? 'bg-amber-500'
                    : answers[idx]?.text.trim()
                    ? 'bg-green-500'
                    : 'bg-zinc-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          {isLastQuestion ? (
            <button
              onClick={() => setShowExitConfirm(true)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 text-xs font-semibold"
            >
              Finish
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-750 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-semibold"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* mobile drawer modal for question navigation */}
      <AnimatePresence>
        {showQuestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center md:hidden"
            onClick={() => setShowQuestionModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-zinc-950 w-full max-h-[80vh] rounded-t-[2.5rem] p-6 flex flex-col border-t border-zinc-200 dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-zinc-300 dark:bg-gray-800 rounded-full mx-auto mb-4 shrink-0" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm uppercase text-zinc-400 dark:text-gray-500">
                  Questions
                </h3>
                <button
                  onClick={() => setShowQuestionModal(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-full"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3 overflow-y-auto flex-1 pb-6 py-2 no-scrollbar">
                {Array.from({ length: totalQuestions }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowQuestionModal(false);
                    }}
                    className={`h-12 rounded-2xl transition-all font-semibold flex items-center justify-center ${
                      idx === currentIndex
                        ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                        : reviewList.has(idx)
                        ? 'bg-amber-500/20 text-amber-500'
                        : answers[idx]?.text.trim()
                        ? 'bg-green-500/20 text-green-600'
                        : 'bg-zinc-100 dark:bg-gray-900 text-zinc-555 dark:text-gray-400'
                    } text-sm`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* exit confirm modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-zinc-900 dark:text-white text-center flex flex-col gap-4"
            >
              <div>
                <h3 className="font-bold text-zinc-850 dark:text-white text-base">Finish LAQ Exam?</h3>
                <p className="text-zinc-550 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  {unansweredCount > 0
                    ? `You still have ${unansweredCount} unanswered question(s). Are you sure you want to finish and submit?`
                    : 'All questions have responses. Would you like to submit and let the AI grade your exam?'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  onClick={async () => {
                    setShowExitConfirm(false);
                    await handleFinish();
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  Submit & Grade
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
