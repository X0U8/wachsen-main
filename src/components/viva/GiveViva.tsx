import { useState, useEffect, useCallback } from 'react';
import { Mic, Square, Volume2, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { useAudioRecorder } from './useAudioRecorder';
import { useTextToSpeech } from './useTextToSpeech';
import { evaluateVivaAnswer, VivaAnswerEvaluation } from './evaluateAnswer';
import { analyzeVivaSession, VivaAnswerRecord } from './analyzeVivaSession';
import type { VivaQuestion } from './MakeVivaForm';

export interface VivaExam {
  id: string;
  name: string;
  subject_name: string | null;
  topics: string | null;
  difficulty: string | null;
  questions: VivaQuestion[];
  status: string;
}

interface GiveVivaProps {
  viva: VivaExam;
  onComplete: () => void;
}

interface AnswerState {
  userTranscription: string;
  evaluation: VivaAnswerEvaluation | null;
  submitted: boolean;
}

export default function GiveViva({ viva, onComplete }: GiveVivaProps) {
  const { userProfile } = useUserProfile();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    viva.questions.map(() => ({ userTranscription: '', evaluation: null, submitted: false }))
  );
  const [transcribing, setTranscribing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { isRecording, audioBase64, startRecording, stopRecording, resetRecording } = useAudioRecorder();
  const { isSpeaking, speak, stop: stopSpeaking } = useTextToSpeech();

  const totalQuestions = viva.questions.length;
  const currentQuestion = viva.questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const handleTranscribe = useCallback(async () => {
    if (!audioBase64) return;
    setTranscribing(true);
    setError('');

    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transcription failed');

      const transcription = (data.text || '').trim();

      setAnswers((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex], userTranscription: transcription };
        return next;
      });

      await handleEvaluate(transcription);
    } catch (err: any) {
      console.error('STT error:', err);
      setError(err.message || 'Failed to transcribe audio.');
    } finally {
      setTranscribing(false);
    }
  }, [audioBase64, currentIndex]);

  const handleEvaluate = async (transcription: string) => {
    if (!userProfile?.id) return;
    setEvaluating(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const evaluation = await evaluateVivaAnswer(
        currentQuestion.question,
        currentQuestion.expectedAnswer,
        currentQuestion.keywords || [],
        transcription,
        userProfile.id,
        authToken
      );

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

  const handleStopRecording = async () => {
    await stopRecording();
  };

  useEffect(() => {
    if (audioBase64 && !isRecording) {
      handleTranscribe();
    }
  }, [audioBase64, isRecording, handleTranscribe]);

  const handleNext = () => {
    stopSpeaking();
    resetRecording();
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSubmit = async () => {
    if (!userProfile?.id) return;
    setSubmitting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const records: VivaAnswerRecord[] = answers.map((a, idx) => ({
        questionIndex: idx,
        question: viva.questions[idx].question,
        userTranscription: a.userTranscription,
        correctness: a.evaluation?.correctness || 'incorrect',
        feedback: a.evaluation?.feedback || 'No feedback available.',
      }));

      const analysis = await analyzeVivaSession(records, userProfile.id, authToken);

      const perQuestionWithTranscriptions = analysis.perQuestion.map((item) => ({
        ...item,
        userTranscription: records[item.questionIndex]?.userTranscription || '',
      }));

      const { error: updateError } = await supabase
        .from('viva_exams')
        .update({
          status: 'completed',
          ai_analysis: {
            ...analysis,
            perQuestion: perQuestionWithTranscriptions,
          },
        })
        .eq('id', viva.id);

      if (updateError) throw updateError;

      onComplete();
    } catch (err: any) {
      console.error('Submit viva error:', err);
      setError(err.message || 'Failed to submit viva. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const allAnswered = answers.every((a) => a.submitted);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      <header className="p-4 border-b border-zinc-200 dark:border-gray-900 bg-white dark:bg-black/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-semibold text-sm sm:text-base truncate">{viva.name}</h1>
            <span className="text-xs text-zinc-500 dark:text-gray-400">
              {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-black/15 dark:border-white/20 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-medium leading-relaxed">
              {currentQuestion.question}
            </h2>
            <button
              onClick={() => speak(currentQuestion.question)}
              disabled={isSpeaking}
              className="shrink-0 p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 disabled:opacity-50 transition-colors cursor-pointer"
              title="Listen"
            >
              {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-red-500/10 text-red-500 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-4 py-6">
            {!currentAnswer.submitted ? (
              <>
                <button
                  onClick={isRecording ? handleStopRecording : startRecording}
                  disabled={transcribing || evaluating}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                      : 'bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-200 hover:bg-zinc-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-6 h-6" />}
                </button>
                <p className="text-xs text-zinc-500 dark:text-gray-400">
                  {isRecording ? 'Recording... tap to stop' : 'Tap microphone to answer'}
                </p>
              </>
            ) : (
              <div className="w-full space-y-3">
                <div className="p-3 bg-zinc-50 dark:bg-gray-950/50 rounded-xl border border-zinc-200 dark:border-gray-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Your answer</p>
                  <p className="text-sm text-zinc-800 dark:text-gray-100">
                    {currentAnswer.userTranscription || <span className="italic text-zinc-400">No speech detected</span>}
                  </p>
                </div>
                {currentAnswer.evaluation && (
                  <div
                    className={`p-3 rounded-xl border text-sm ${
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
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-gray-800">
            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>Finish Viva <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!currentAnswer.submitted}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
