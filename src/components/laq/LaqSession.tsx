import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, Clock, AlertCircle, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { analyzeLaqSession, LaqAnswerRecord } from './analyzeLaqSession';
import Notification from '../../ui/Notification';
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
  timeSpentSeconds: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LaqSession({ laq, onComplete }: LaqSessionProps) {
  const { userProfile } = useUserProfile();

  const totalTimeSeconds = (laq.time_limit_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(totalTimeSeconds);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    laq.questions.map(() => ({ text: '', timeSpentSeconds: 0 }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [isExamStarted, setIsExamStarted] = useState(false);
  const [showStartModal, setShowStartModal] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const currentElapsedRef = useRef(0);

  const totalQuestions = laq.questions.length;
  const currentQuestion = laq.questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Handle countdown logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const t = setTimeout(() => {
        setIsExamStarted(true);
        setShowStartModal(false);
        setCountdown(null);
        localStorage.setItem(`laq_start_${laq.id}`, Date.now().toString());
      }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, laq.id]);

  // Sync remaining time with localStorage start timestamp
  useEffect(() => {
    if (!isExamStarted || finished) return;

    // Always write a fresh start time when the exam begins — never reuse a stale key
    const freshStart = Date.now().toString();
    localStorage.setItem(`laq_start_${laq.id}`, freshStart);
    const startTime = Number(freshStart);

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalTimeSeconds - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleSubmitAll();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamStarted, finished, totalTimeSeconds, laq.id]);

  // Per-question elapsed timer + record time when switching questions
  useEffect(() => {
    if (!isExamStarted || finished) return;
    setCurrentElapsedSeconds(0);
    currentElapsedRef.current = 0;
    elapsedRef.current = setInterval(() => {
      currentElapsedRef.current += 1;
      setCurrentElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      // Save elapsed time for the question we're leaving
      setAnswers((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex], timeSpentSeconds: next[currentIndex].timeSpentSeconds + currentElapsedRef.current };
        return next;
      });
    };
  }, [currentIndex, finished, isExamStarted]);

  // Navigation lock (beforeunload/popstate) - active only when exam has started
  useEffect(() => {
    if (!isExamStarted || finished) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave? Your exam progress will be lost.';
      return e.returnValue;
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setNotification({ type: 'error', message: 'Navigation is disabled during the exam. Please use the Finish button to submit.' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isExamStarted, finished]);

  const handleAnswerChange = (value: string) => {
    if (value.length > 1000) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], text: value };
      return next;
    });
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleSelectQuestion = (idx: number) => {
    setCurrentIndex(idx);
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
      // Add current question's running time to its stored time
      finalAnswers[currentIndex] = {
        ...finalAnswers[currentIndex],
        timeSpentSeconds: finalAnswers[currentIndex].timeSpentSeconds + currentElapsedRef.current,
      };

      const totalTimeSpentSeconds = totalTimeSeconds - timeLeft;

      // Build records directly from user text — no intermediate per-question AI calls
      const records: LaqAnswerRecord[] = finalAnswers.map((a, idx) => ({
        questionIndex: idx,
        question: laq.questions[idx].question,
        userAnswer: a.text,
        timeSpentSeconds: a.timeSpentSeconds || 0,
      }));

      // Single batch AI grading
      const analysis = await analyzeLaqSession(records, totalTimeSpentSeconds, userProfile.id, authToken);

      // Save answers separately, ai_analysis only has per-question breakdown
      const answersPayload = records.map((r) => ({
        questionIndex: r.questionIndex,
        question: r.question,
        userAnswer: r.userAnswer,
        timeSpentSeconds: r.timeSpentSeconds,
      }));

      // Calculate overall rating as the average of the question ratings
      const totalRatings = analysis.perQuestion.reduce((sum, q) => sum + (q.rating || 0), 0);
      const overallRating = analysis.perQuestion.length > 0 ? parseFloat((totalRatings / analysis.perQuestion.length).toFixed(1)) : 0;

      const { error: updateError } = await supabase
        .from('laq_exam')
        .update({
          status: 'completed',
          answers: answersPayload,
          ai_feedback: analysis.ai_feedback,
          accuracy: analysis.accuracy,
          depth: analysis.depth,
          clarity: analysis.clarity,
          ai_analysis: {
            overall_rating: overallRating,
            totalTimeSpentSeconds,
            perQuestion: analysis.perQuestion,
          },
        })
        .eq('id', laq.id);

      if (updateError) throw updateError;

      localStorage.removeItem(`laq_start_${laq.id}`);
      onComplete();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to submit. Please try again.');
      setFinished(false);
    } finally {
      setSubmitting(false);
    }
  };

  const timerUrgent = timeLeft < 60;
  const unansweredCount = answers.filter((a) => !a.text.trim()).length;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-white/95 dark:bg-black/95 backdrop-blur-xl p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl text-center"
            >
              <div className="space-y-3 py-4">
                {countdown !== null ? (
                  <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10">
                    <motion.span className="text-8xl font-bold text-blue-500 dark:text-blue-400">{countdown === 0 ? 'Start!' : countdown}</motion.span>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-zinc-900 dark:text-white text-2xl font-semibold">Ready to Start?</h3>
                    <p className="text-zinc-500 dark:text-gray-400 leading-relaxed text-sm">
                      You are about to start <span className="text-zinc-900 dark:text-white font-medium">{laq.name}</span>.
                    </p>
                  </div>
                )}
              </div>

              {countdown === null && (
                <div className="flex gap-3">
                  <button
                    onClick={() => window.history.back()}
                    className="flex-1 py-2.5 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 text-zinc-900 dark:text-white rounded-xl transition-all font-medium text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setCountdown(3)}
                    className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 font-medium text-xs cursor-pointer"
                  >
                    Start Now
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {submitting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <div className="text-center">
            <h3 className="text-white font-bold text-lg">AI Marking your questions</h3>
            <p className="text-zinc-400 text-xs mt-1">Please wait while the AI reviews and evaluates your answers</p>
          </div>
        </div>
      )}

      <header className="px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-zinc-900 dark:text-white truncate max-w-[200px] text-sm font-semibold">{laq.name}</h1>
        </div>

        <div className="flex items-center justify-center flex-1">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border bg-zinc-200/30 dark:bg-gray-800/30 ${timerUrgent ? 'border-red-500/50 text-red-500' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
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
        {error && (
          <div className="max-w-6xl mx-auto mb-4 flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 w-full">
          <div className="flex-1 border-t-0">
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
                      <span className="px-2 py-0.5 bg-zinc-200 dark:bg-gray-800 text-zinc-900 dark:text-white rounded-md text-[10px] uppercase tracking-wider font-semibold">
                        Q{currentIndex + 1}
                      </span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-400 dark:text-gray-500 rounded-md text-[10px] uppercase tracking-wider border border-zinc-200 dark:border-gray-800">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(currentElapsedSeconds)}
                      </div>
                      <button
                        onClick={() => setShowQuestionModal(true)}
                        className="md:hidden flex items-center gap-1 text-[10px] text-zinc-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                        <span>Questions</span>
                      </button>
                    </div>
                  </div>
                  <h2 className="font-normal leading-relaxed text-sm sm:text-base text-zinc-800 dark:text-zinc-150">
                    {currentQuestion.question}
                  </h2>
                </div>

                <div className="space-y-1 relative">
                  <textarea
                    value={currentAnswer?.text || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    disabled={finished}
                    placeholder="Type your answer here..."
                    rows={8}
                    maxLength={1000}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-805 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-white text-sm resize-none leading-relaxed disabled:opacity-50 animate-none overflow-y-auto"
                  />
                  <div className="flex justify-end text-[10px] text-zinc-400 dark:text-zinc-500 font-medium px-1">
                    {(currentAnswer?.text || '').length}/1000
                  </div>
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
                    onClick={() => handleSelectQuestion(idx)}
                    className={`w-10 h-10 rounded-lg transition-all font-semibold ${idx === currentIndex
                        ? 'bg-blue-600 text-white border border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)] ring-2 ring-blue-500/30'
                        : answers[idx]?.text.trim()
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                          : 'bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 border border-zinc-300 dark:border-gray-700 hover:border-zinc-450 dark:hover:border-gray-655'
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
            onClick={handlePrev}
            className="flex-1 py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-755 disabled:opacity-30 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-1 overflow-x-auto max-w-[40%] no-scrollbar px-2 md:hidden">
            {Array.from({ length: totalQuestions }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectQuestion(idx)}
                className={`w-2 h-2 rounded-full shrink-0 transition-all ${idx === currentIndex
                    ? 'bg-blue-600 scale-125'
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
              className="flex-1 py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-755 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-semibold"
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
                      handleSelectQuestion(idx);
                      setShowQuestionModal(false);
                    }}
                    className={`h-12 rounded-2xl transition-all font-semibold flex items-center justify-center ${idx === currentIndex
                        ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
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
                    await handleSubmitAll();
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

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
