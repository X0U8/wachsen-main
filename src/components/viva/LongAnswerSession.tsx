import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, Loader2, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { evaluateVivaAnswer, VivaAnswerEvaluation } from './evaluateAnswer';
import { analyzeVivaSession, VivaAnswerRecord } from './analyzeVivaSession';
import type { LaqQuestion } from './MakeLaq';

export interface VivaExam {
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

interface LongAnswerSessionProps {
  viva: VivaExam;
  onComplete: () => void;
}

interface AnswerState {
  text: string;
  evaluation: VivaAnswerEvaluation | null;
  submitted: boolean;
  timeSpentSeconds: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MAX_CHARS = 500;

export default function LongAnswerSession({ viva, onComplete }: LongAnswerSessionProps) {
  const { userProfile } = useUserProfile();

  const totalTimeSeconds = (viva.time_limit_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(totalTimeSeconds);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    viva.questions.map(() => ({ text: '', evaluation: null, submitted: false, timeSpentSeconds: 0 }))
  );
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  const totalQuestions = viva.questions.length;
  const currentQuestion = viva.questions[currentIndex];
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

  const handleEvaluate = async () => {
    if (!userProfile?.id || !currentAnswer.text.trim()) return;
    setEvaluating(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const evaluation = await evaluateVivaAnswer(
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

      // Evaluate any unanswered questions as empty
      const finalAnswers = [...answers];
      for (let i = 0; i < finalAnswers.length; i++) {
        if (!finalAnswers[i].submitted) {
          if (!finalAnswers[i].text.trim() && i === currentIndex) {
            // Current unanswered question - evaluate as empty
            try {
              const evalResult = await evaluateVivaAnswer(
                viva.questions[i].question,
                viva.questions[i].expectedAnswer,
                viva.questions[i].keywords || [],
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

      const totalTimeSpent = totalTimeSeconds - timeLeft;
      const totalTimeSpentSeconds = totalTimeSeconds - timeLeft;

      const records: VivaAnswerRecord[] = finalAnswers.map((a, idx) => ({
        questionIndex: idx,
        question: viva.questions[idx].question,
        userAnswer: a.text,
        correctness: a.evaluation?.correctness || 'incorrect',
        feedback: a.evaluation?.feedback || 'No feedback available.',
        timeSpentSeconds: a.timeSpentSeconds || 0,
      }));

      const analysis = await analyzeVivaSession(records, totalTimeSpentSeconds, userProfile.id, authToken);

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
        .eq('id', viva.id);

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

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      <header className="p-4 border-b border-zinc-200 dark:border-gray-900 bg-white dark:bg-black/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm sm:text-base truncate">{viva.name}</h1>
              <span className="text-xs text-zinc-500 dark:text-gray-400">
                {currentIndex + 1} / {totalQuestions}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-xs font-semibold ${timerUrgent ? 'text-red-500' : 'text-zinc-500 dark:text-gray-400'}`}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(timeLeft)}
            </div>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-gray-800 rounded-full h-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${timerUrgent ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${timePercent}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-black/15 dark:border-white/20 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base sm:text-lg font-medium leading-relaxed mb-4">
            {currentQuestion.question}
          </h2>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-red-500/10 text-red-500 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <textarea
            value={currentAnswer?.text || ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            disabled={currentAnswer?.submitted || finished}
            placeholder="Type your answer here..."
            rows={6}
            maxLength={MAX_CHARS}
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-sm resize-none leading-relaxed disabled:opacity-50"
          />

          <div className="flex justify-between items-center mt-2 mb-4 text-xs text-zinc-400">
            <span>{MAX_CHARS - charCount} characters remaining</span>
            {currentAnswer?.submitted && (
              <span className="text-green-500 font-medium">✓ Submitted</span>
            )}
          </div>

          {currentAnswer?.evaluation && (
            <div
              className={`p-3 rounded-xl border text-sm mb-4 ${
                currentAnswer.evaluation.correctness === 'correct'
                  ? 'bg-green-500/10 border-green-500/20 text-green-500'
                  : currentAnswer.evaluation.correctness === 'partial'
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}
            >
              <span className="font-semibold uppercase text-xs">
                {currentAnswer.evaluation.correctness}
              </span>
              <p className="mt-1">{currentAnswer.evaluation.feedback}</p>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-gray-800">
            <span className="text-xs text-zinc-500 dark:text-gray-400">
              {formatTime(currentElapsedSeconds)} on this question
            </span>
            <div className="flex gap-2">
              {!currentAnswer?.submitted && !finished && (
                <button
                  onClick={handleEvaluate}
                  disabled={!currentAnswer?.text.trim() || evaluating}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
                </button>
              )}
              {isLastQuestion ? (
                <button
                  onClick={handleFinish}
                  disabled={submitting || finished}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                  ) : (
                    <>Finish <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
