import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Clock, AlertCircle, CheckCircle2, Loader2, X, RefreshCw, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import Notification from '../../ui/Notification';
import MathText from '../../ui/MathText';
import { fontSize } from '../../lib/utils';

interface Question {
  id: number;
  text: string;
  type: 'mcq' | 'integer' | 'true_false';
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  negative_marks: number;
}

interface Subject {
  subjectName: string;
  subject?: string;
  questions: Question[];
}

export default function TakeExam() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();

  const [examData, setExamData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [reviewList, setReviewList] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>(() => {
    const saved = sessionStorage.getItem(`exam_times_${instanceId}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [currentQuestionTime, setCurrentQuestionTime] = useState(0);

  const [showStartModal, setShowStartModal] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);

  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const lastAnswerTime = useRef(0);

  useEffect(() => {
    if (!instanceId) return;

    const loadExam = async () => {
      try {
        const { data: res, error } = await supabase
          .from('exams')
          .select('*')
          .eq('id', instanceId)
          .single();

        if (error) throw error;

        const mappedRes = { ...res, $id: res.id, $createdAt: res.created_at };
        setExamData(mappedRes);

        if (mappedRes.generatedExam) {
          const parsed = typeof mappedRes.generatedExam === 'string'
            ? JSON.parse(mappedRes.generatedExam)
            : mappedRes.generatedExam;
          const allQuestions: Question[] = [];
          const subjectList: Subject[] = [];

          let parsedSubjects: any[] = [];
          if (mappedRes.subjects) {
            try {
              parsedSubjects = typeof mappedRes.subjects === 'string' ? JSON.parse(mappedRes.subjects) : mappedRes.subjects;
            } catch (e) {
              console.error('Failed to parse subjects:', e);
            }
          }

          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
            const subjectMap = new Map<string, Question[]>();

            parsed.forEach((q: any) => {
              let subjectName = 'Unknown';
              if (q.subjectIndex !== undefined && parsedSubjects[q.subjectIndex]) {
                subjectName = parsedSubjects[q.subjectIndex].name || parsedSubjects[q.subjectIndex].subject || 'Unknown';
              } else if (q.subjectName) {
                subjectName = q.subjectName;
              }

              if (!subjectMap.has(subjectName)) {
                subjectMap.set(subjectName, []);
              }

              let qMarks = q.marks || q.correctMarks;
              let qNeg = q.negative_marks || q.negativeMarks;

              const normalizedType = (q.type || 'mcq').toLowerCase().trim();

              if (q.subjectIndex !== undefined && parsedSubjects[q.subjectIndex]) {
                const qt = parsedSubjects[q.subjectIndex].questionTypes?.find((t: any) => t.type === normalizedType);
                if (qt) {
                  qMarks = qMarks ?? qt.correctMarks;
                  qNeg = qNeg ?? qt.negativeMarks;
                }
              }

              const formattedQ: Question = {
                id: q.id,
                type: normalizedType,
                text: q.question,
                options: q.options || [],
                correct_answer: q.correct_answer || q.correctAnswer || '',
                explanation: q.explanation || '',
                difficulty: q.difficulty || 'medium',
                marks: qMarks ?? mappedRes.correct_marks ?? 4,
                negative_marks: qNeg ?? mappedRes.negative_marks ?? 0,
              };

              subjectMap.get(subjectName)!.push(formattedQ);
              allQuestions.push(formattedQ);
            });

            subjectMap.forEach((questions, subjectName) => {
              subjectList.push({
                subjectName,
                questions
              });
            });
          } else {
            const subjects = Array.isArray(parsed) ? parsed : (parsed.subjects || []);

            subjects.forEach((subject: Subject) => {
              if (subject.questions && Array.isArray(subject.questions)) {
                allQuestions.push(...subject.questions);
                subjectList.push({
                  subjectName: subject.subjectName || subject.subject || 'Unknown',
                  questions: subject.questions
                });
              }
            });
          }
          allQuestions.forEach((q, i) => q.id = i + 1);
          setQuestions(allQuestions);
          setSubjects(subjectList);
        }

        if (userProfile?.id) {
          try {
            const { data: resultsData, error: resultsErr } = await supabase
              .from('results')
              .select('id, endTime, userAnswers, reviewList')
              .eq('userId', userProfile.id)
              .eq('examId', instanceId)
              .limit(1);
            if (!resultsErr && resultsData && resultsData.length > 0) {
              const existing = resultsData[0];
              const endTime = new Date(existing.endTime).getTime();
              const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
              setTimeLeft(remaining);
              setResultId(existing.id);
              if (existing.userAnswers) setAnswers(JSON.parse(existing.userAnswers));
              if (existing.reviewList) setReviewList(new Set(JSON.parse(existing.reviewList)));
              sessionStorage.removeItem(`exam_times_${instanceId}`);
              setQuestionTimes({});
            } else if (mappedRes.totalTime > 0) {
              setTimeLeft(mappedRes.totalTime * 60);
            }
          } catch {
            if (mappedRes.totalTime > 0) setTimeLeft(mappedRes.totalTime * 60);
          }
        } else if (mappedRes.totalTime > 0) {
          setTimeLeft(mappedRes.totalTime * 60);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to load exam. It might not exist or you don't have access.");
        setLoading(false);
      }
    };

    loadExam();
  }, [instanceId]);

  useEffect(() => {
    if (dotsContainerRef.current && currentQuestionIdx >= 0) {
      const dots = dotsContainerRef.current.children;
      const currentDot = dots[currentQuestionIdx] as HTMLElement;
      if (currentDot) {
        currentDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentQuestionIdx]);

  useEffect(() => {
    if (!isExamStarted || isSubmitting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      showNotification('error', 'Navigation is disabled during the exam. Please use the Finish button to submit.');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isExamStarted, isSubmitting]);

  useEffect(() => {
    return () => {
      if (instanceId) {
        localStorage.removeItem(`exam_start_${instanceId}`);
        sessionStorage.removeItem(`exam_times_${instanceId}`);
      }
    };
  }, [instanceId]);

  useEffect(() => {
    if (!isExamStarted || !examData || isSubmitting || timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return prev;
        if (examData?.examType === 'casual') {
          return prev + 1;
        } else {
          if (prev <= 1) {
            clearInterval(timer);
            setShowAutoSubmitModal(true);
            return 0;
          }
          return prev - 1;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, examData, isSubmitting, timeLeft === null]);

  useEffect(() => {
    if (!isExamStarted || isSubmitting) return;

    const currentQId = questions[currentQuestionIdx]?.id;
    if (!currentQId) return;

    setCurrentQuestionTime(0);

    const timer = setInterval(() => {
      setCurrentQuestionTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      setCurrentQuestionTime(prevTime => {
        setQuestionTimes(prev => {
          const newTimes = {
            ...prev,
            [currentQId]: (prev[currentQId] || 0) + prevTime
          };
          sessionStorage.setItem(`exam_times_${instanceId}`, JSON.stringify(newTimes));
          return newTimes;
        });
        return 0;
      });
    };
  }, [currentQuestionIdx, isExamStarted, isSubmitting, questions, instanceId]);


  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const t = setTimeout(() => {
        setIsExamStarted(true);
        setShowStartModal(false);
        setCountdown(null);
        doStartExam();
      }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);


  const startExamFlow = () => {
    setCountdown(3);
  };


  const doStartExam = async () => {
    if (!userProfile?.id) {
      showNotification('error', 'Please log in to start the exam.');
      return;
    }
    setCountdown(3);
    try {
      const { data: resultsData, error: resultsErr } = await supabase
        .from('results')
        .select('id, startTime, endTime, userAnswers, reviewList')
        .eq('userId', userProfile.id)
        .eq('examId', instanceId)
        .limit(1);

      if (!resultsErr && resultsData && resultsData.length > 0) {
        const existing = resultsData[0];
        const startTime = new Date(existing.startTime).getTime();
        const endTime = new Date(existing.endTime).getTime();
        const now = Date.now();

        if (now > endTime) {
          setError('This exam attempt has expired. Please contact your administrator.');
          setShowStartModal(false);
          return;
        }

        const remainingMs = endTime - now;
        setTimeLeft(Math.floor(remainingMs / 1000));
        setResultId(existing.id);

        if (existing.userAnswers) {
          setAnswers(JSON.parse(existing.userAnswers));
        }
        if (existing.reviewList) {
          setReviewList(new Set(JSON.parse(existing.reviewList)));
        }

        localStorage.setItem(`exam_start_${instanceId}`, startTime.toString());

        setIsExamStarted(true);
        setShowStartModal(false);
        return;
      }
    } catch (err) {
    }

    const startTime = Date.now().toString();
    localStorage.setItem(`exam_start_${instanceId}`, startTime);

    try {
      await supabase
        .from('exams')
        .update({ status: 'Completed' })
        .eq('id', instanceId!);

      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
      const examDurationMs = (examData?.totalTime || 0) * 60 * 1000;
      const nowStr = new Date().toISOString();
      const endTimeStr = new Date(Date.now() + examDurationMs).toISOString();

      const { data: resultDoc, error: insertError } = await supabase
        .from('results')
        .insert({
          userId: userProfile?.id,
          examId: instanceId,
          examName: examData?.examName || 'Unknown Exam',
          totalMarks: totalMarks,
          startTime: nowStr,
          endTime: endTimeStr,
          marksObtained: 0,
        })
        .select('id')
        .single();
      if (!insertError && resultDoc) {
        setResultId(resultDoc.id);
      }
    } catch (err) {
    }

    setIsExamStarted(true);
    setShowStartModal(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = useCallback((questionId: number, answer: string, skipThrottle = false, skipToggle = false) => {
    if (isSubmitting) return;
    const now = Date.now();
    if (!skipThrottle && now - lastAnswerTime.current < 300) return;
    if (!skipThrottle) lastAnswerTime.current = now;
    setAnswers(prev => {
      if (!skipToggle && prev[questionId] === answer) {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        return newAnswers;
      }
      return { ...prev, [questionId]: answer };
    });
  }, [isSubmitting]);

  const toggleReview = (idx: number) => {
    const newReview = new Set(reviewList);
    if (newReview.has(idx)) newReview.delete(idx);
    else newReview.add(idx);
    setReviewList(newReview);
  };

  const performSubmission = async () => {
    if (isSubmitting) return;
    setShowAutoSubmitModal(false);
    setShowExitConfirm(false);
    setIsSubmitting(true);

    try {
      let obtainedMarks = 0;
      const correctAnswers: number[] = [];
      const wrongAnswers: number[] = [];

      questions.forEach(q => {
        const userAnswer = answers[q.id];
        const normUser = String(userAnswer || '').trim();
        const normCorrect = String(q.correct_answer ?? '').trim();
        if (normUser === normCorrect) {
          obtainedMarks += Number(q.marks || 0);
          correctAnswers.push(q.id);
        } else if (userAnswer !== undefined && userAnswer !== "") {
          obtainedMarks -= Number(q.negative_marks || 0);
          wrongAnswers.push(q.id);
        }
      });

      const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
      const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
      const percentageValue = isNaN(percentage) || !isFinite(percentage) ? 0 : Math.round(percentage);

      const processedAnswers: Record<number, string> = {};
      questions.forEach(q => {
        processedAnswers[q.id] = answers[q.id] || '';
      });

      const currentQId = questions[currentQuestionIdx]?.id;
      const finalQuestionTimes = { ...questionTimes };
      if (currentQId) {
        finalQuestionTimes[currentQId] = (finalQuestionTimes[currentQId] || 0) + currentQuestionTime;
      }

      const resultData = {
        userId: userProfile?.id,
        examId: instanceId,
        examName: examData?.examName || 'Unknown Exam',
        totalMarks: totalMarks,
        marksObtained: obtainedMarks,
        correctAnswers: JSON.stringify(correctAnswers),
        wrongAnswers: JSON.stringify(wrongAnswers),
        timeSpentPerQuestion: JSON.stringify(finalQuestionTimes),
        userAnswers: JSON.stringify(processedAnswers),
        reviewList: JSON.stringify(Array.from(reviewList)),
        startTime: localStorage.getItem(`exam_start_${instanceId}`)
          ? new Date(parseInt(localStorage.getItem(`exam_start_${instanceId}`)!)).toISOString()
          : new Date().toISOString(),
        endTime: new Date().toISOString(),
      };

      let finalResultId = resultId;

      if (resultId) {
        try {
          const { error } = await supabase
            .from('results')
            .update(resultData)
            .eq('id', resultId);
          if (error) throw error;
        } catch (updateErr) {
          const { data: newRes, error: insertErr } = await supabase
            .from('results')
            .insert(resultData)
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          if (newRes) finalResultId = newRes.id;
        }
      } else {
        const { data: newRes, error: insertErr } = await supabase
          .from('results')
          .insert(resultData)
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        if (newRes) finalResultId = newRes.id;
      }

      localStorage.removeItem(`exam_start_${instanceId}`);
      sessionStorage.removeItem(`exam_times_${instanceId}`);

      if (examData?.categoryId) {
        try {
          const { data: examTypeDoc, error: getError } = await supabase
            .from('examtypes')
            .select('Percentages')
            .eq('id', examData.categoryId)
            .single();

          if (!getError && examTypeDoc) {
            const currentPercentages = examTypeDoc.Percentages || [];
            const updatedPercentages = [...currentPercentages, percentageValue];
            await supabase
              .from('examtypes')
              .update({
                Percentages: updatedPercentages
              })
              .eq('id', examData.categoryId);
          }
        } catch (err) {
        }
      }

      navigate('/results');
    } catch (err: any) {
      showNotification('error', `Failed to save results: ${err.message || 'Unknown error'}. Please check your internet and try again.`);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <p className="text-zinc-500 dark:text-gray-400">Loading your exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-8 text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-zinc-900 dark:text-white" style={{ fontSize: fontSize.xl || '1.25rem' }}>Error</h2>
            <p className="text-zinc-500 dark:text-gray-400">{error}</p>
          </div>
          <button
            onClick={() => navigate('/exam')}
            className="w-full py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 text-zinc-900 dark:text-white rounded-xl font-medium transition-all text-sm">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIdx];

  if (!loading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">This exam has no questions.</p>
          <p className="text-zinc-400 dark:text-gray-500 text-sm">The exam may not have been generated correctly.</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col select-none">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
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
                    <h3 className="text-zinc-900 dark:text-white text-2xl">Ready to Start?</h3>
                    <p className="text-zinc-500 dark:text-gray-400 leading-relaxed text-sm">
                      You are about to start <span className="text-zinc-900 dark:text-white font-medium">{examData?.examName}</span>.
                    </p>
                  </div>
                )}
              </div>

              {countdown === null && (
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/exam')}
                    className="flex-1 py-2.5 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 text-zinc-900 dark:text-white rounded-xl transition-all font-medium text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={startExamFlow}
                    className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 font-medium text-sm">
                    Start Now
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {isExamStarted && (
        <>
          <header className="px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div>
                <h1 className="text-zinc-900 dark:text-white truncate max-w-[150px] text-sm">{examData?.examName}</h1>
                <div className="flex items-center gap-2">
                  {examData?.examType === 'casual' && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-[8px] text-blue-500 uppercase">
                      <Clock className="w-2 h-2" /> Casual
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center flex-1">
              {timeLeft !== null && (() => {
                if (examData?.examType === 'casual') {
                  const hours = Math.floor(timeLeft / 3600);
                  const minutes = Math.floor((timeLeft % 3600) / 60);
                  const seconds = timeLeft % 60;
                  const timeStr = hours > 0
                    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                  return (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/50 bg-zinc-200/30 dark:bg-gray-800/30">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span className="text-zinc-900 dark:text-white font-mono text-xs">{timeStr}</span>
                    </div>
                  );
                } else {
                  const totalSec = (examData?.totalTime || 0) * 60;
                  const pct = totalSec > 0 ? (timeLeft / totalSec) * 100 : 100;
                  const borderClass = pct >= 60
                    ? 'border-green-500/50 text-green-500'
                    : pct >= 20
                      ? 'border-yellow-500/50 text-yellow-500'
                      : 'border-red-500/50 text-red-500';
                  return (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border bg-zinc-200/30 dark:bg-gray-800/30 ${borderClass}`}>
                      <span className="text-zinc-900 dark:text-white font-mono text-xs">{formatTime(timeLeft)}</span>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="flex items-center justify-end flex-1">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="px-4 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg tracking-wider transition-all text-xs">
                Finish
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 w-full">
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestionIdx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-zinc-200 dark:bg-gray-800 text-zinc-900 dark:text-white rounded-md text-[10px] uppercase tracking-wider">
                            {currentQuestionIdx + 1}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[10px] uppercase tracking-wider">
                            +{currentQuestion.marks} <span className="hidden sm:inline">Marks</span>
                          </span>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-400 dark:text-gray-500 rounded-md text-[10px] uppercase tracking-wider border border-zinc-200 dark:border-gray-800">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTime((questionTimes[currentQuestion.id] || 0) + currentQuestionTime)}
                          </div>
                          <button
                            onClick={() => setShowQuestionModal(true)}
                            className="md:hidden flex items-center gap-1 text-[10px] text-zinc-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <ChevronDown className="w-3 h-3" />
                            <span>Questions</span>
                          </button>
                        </div>
                        <button
                          onClick={() => toggleReview(currentQuestionIdx)}
                          className={`flex items-center gap-2 px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] tracking-wider transition-all ${reviewList.has(currentQuestionIdx)
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-200 dark:bg-gray-800 text-zinc-500 dark:text-gray-400 hover:bg-zinc-300 dark:hover:bg-gray-700'
                            }`}
                        >
                          {reviewList.has(currentQuestionIdx) ? 'In Review' : 'Mark for review'}
                        </button>
                      </div>
                      <h2 className="font-medium leading-relaxed text-base">
                        <MathText text={currentQuestion.text} />
                      </h2>
                    </div>

                    <div className="space-y-3">
                      {currentQuestion.type === 'mcq' && currentQuestion.options?.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(currentQuestion.id, option)}
                          disabled={isSubmitting}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${answers[currentQuestion.id] === option
                            ? 'bg-blue-600/10 border-blue-600 text-zinc-900 dark:text-white shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                            : 'bg-zinc-100 dark:bg-gray-900 border-zinc-200 dark:border-gray-800 text-zinc-900 dark:text-white hover:border-zinc-300 dark:hover:border-gray-700'
                            }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${answers[currentQuestion.id] === option
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-zinc-300 dark:border-gray-700'
                              } text-xs`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="font-medium leading-relaxed text-sm">
                            <MathText text={option} />
                          </span>
                        </button>
                      ))}

                      {currentQuestion.type === 'true_false' && (
                        <div className="grid grid-cols-2 gap-4">
                          {['true', 'false'].map((val) => (
                            <button
                              key={val}
                              onClick={() => handleAnswer(currentQuestion.id, val)}
                              disabled={isSubmitting}
                              className={`p-8 rounded-2xl border text-center transition-all capitalize ${answers[currentQuestion.id] === val
                                ? 'bg-blue-600/10 border-blue-600 text-zinc-900 dark:text-white'
                                : 'bg-zinc-100 dark:bg-gray-900 border-zinc-200 dark:border-gray-800 text-zinc-900 dark:text-white hover:border-zinc-300 dark:hover:border-gray-700'
                                } text-lg`}>
                              {val}
                            </button>
                          ))}
                        </div>
                      )}

                      {currentQuestion.type === 'integer' && (
                        <div className="space-y-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={isSubmitting}
                            placeholder="Enter integer answer"
                            value={answers[currentQuestion.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9-]/g, '');
                              if (val.length <= 15) handleAnswer(currentQuestion.id, val, true, true);
                            }}
                            className="w-full bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-2xl p-6 text-center text-3xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-gray-800"
                          />
                          <p className="text-[10px] text-zinc-400 dark:text-gray-600 text-center uppercase">Max 15 Digits</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <aside className="hidden md:block w-64 shrink-0">
                <div className="bg-zinc-100/50 dark:bg-gray-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 max-h-[calc(100vh-8rem)] flex flex-col">
                  <h3
                    className="font-medium uppercase text-zinc-400 dark:text-gray-500 mb-4 shrink-0 text-xs">Questions</h3>

                  {subjects.length > 1 && (
                    <div className="mb-4 shrink-0">
                      <button
                        onClick={() => setSelectedSubject(null)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${selectedSubject === null
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-200 dark:bg-gray-800 text-zinc-500 dark:text-gray-400 hover:bg-zinc-300 dark:hover:bg-gray-700'
                          }`}
                      >
                        All Subjects
                      </button>
                      {subjects.map((subject, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSubject(subject.subjectName)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${selectedSubject === subject.subjectName
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-200 dark:bg-gray-800 text-zinc-500 dark:text-gray-400 hover:bg-zinc-300 dark:hover:bg-gray-700'
                            }`}
                        >
                          {subject.subjectName} ({subject.questions.length})
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-2 overflow-y-auto flex-1 pr-1 no-scrollbar">
                    {questions
                      .map((q, idx) => ({ q, idx }))
                      .filter(({ q }) => {
                        if (!selectedSubject) return true;
                        for (const subject of subjects) {
                          if (subject.questions.some(sq => sq.id === q.id)) {
                            return subject.subjectName === selectedSubject;
                          }
                        }
                        return true;
                      })
                      .map(({ idx }) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentQuestionIdx(idx)}
                          className={`w-10 h-10 rounded-lg transition-all ${idx === currentQuestionIdx
                            ? 'bg-blue-600 text-white border border-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)] ring-2 ring-blue-500/30'
                            : reviewList.has(idx)
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : answers[questions[idx].id]
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 border border-zinc-300 dark:border-gray-700 hover:border-zinc-400 dark:hover:border-gray-600'
                            } text-sm`}>
                          {idx + 1}
                        </button>
                      ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-blue-500/30"></div>
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-green-500/30"></div>
                      <span>Answered</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-amber-500/30"></div>
                      <span>Marked for Review</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-zinc-200 dark:bg-gray-800 border border-zinc-300 dark:border-gray-700"></div>
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
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                className="flex-1 py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:opacity-30 rounded-xl transition-all flex items-center justify-center gap-2 text-xs">
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div ref={dotsContainerRef} className="flex gap-1 overflow-x-auto max-w-[40%] no-scrollbar px-2 md:hidden">
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${idx === currentQuestionIdx ? 'bg-blue-500/60 scale-125' :
                      reviewList.has(idx) ? 'bg-amber-500/30' :
                        answers[questions[idx].id] ? 'bg-green-500/30' : 'bg-zinc-300 dark:bg-gray-700'
                      }`}
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  if (currentQuestionIdx === questions.length - 1) {
                    setShowExitConfirm(true);
                  } else {
                    setCurrentQuestionIdx(prev => prev + 1);
                  }
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 text-xs">
                {currentQuestionIdx === questions.length - 1 ? 'Finish' : ''}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </footer>

          <AnimatePresence>
            {showExitConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center bg-white/90 dark:bg-black/90 backdrop-blur-md p-6"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl text-center"
                >
                  <div className="space-y-2">
                    <h3 className="text-zinc-900 dark:text-white text-2xl">Finish Exam?</h3>
                    <p className="text-zinc-500 dark:text-gray-400 text-sm">
                      You have answered {Object.keys(answers).length} out of {questions.length} questions.
                      {reviewList.size > 0 && <span className="block text-amber-500 mt-1 font-medium">{reviewList.size} questions are still marked for review.</span>}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      disabled={isSubmitting}
                      onClick={performSubmission}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : 'Yes, Submit Now'}
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => setShowExitConfirm(false)}
                      className="w-full py-4 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 text-zinc-900 dark:text-white rounded-2xl transition-all"
                    >
                      Continue Exam
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showAutoSubmitModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-white/95 dark:bg-black/95 backdrop-blur-xl p-6"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-zinc-100 dark:bg-gray-900 border border-red-500/50 rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl text-center"
                >
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-zinc-900 dark:text-white text-2xl">Time's Up!</h3>
                    <p className="text-zinc-500 dark:text-gray-400 text-sm">
                      Your exam time has ended. You have answered {Object.keys(answers).length} out of {questions.length} questions.
                      {reviewList.size > 0 && <span className="block text-amber-500 mt-1 font-medium">{reviewList.size} questions are still marked for review.</span>}
                    </p>
                  </div>

                  <button
                    disabled={isSubmitting}
                    onClick={performSubmission}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : 'Submit Exam Now'}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showQuestionModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-white/95 dark:bg-black/95 backdrop-blur-xl p-4 md:p-6"
                onClick={() => setShowQuestionModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-4 md:p-6 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3
                      className="font-medium uppercase text-zinc-500 dark:text-gray-400 text-sm">Questions</h3>
                    <button
                      onClick={() => setShowQuestionModal(false)}
                      className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-zinc-500 dark:text-gray-400" />
                    </button>
                  </div>

                  {subjects.length > 1 && (
                    <div className="mb-4 shrink-0">
                      <button
                        onClick={() => setSelectedSubject(null)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${selectedSubject === null
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-200 dark:bg-gray-800 text-zinc-500 dark:text-gray-400 hover:bg-zinc-300 dark:hover:bg-gray-700'
                          }`}
                      >
                        All Subjects
                      </button>
                      {subjects.map((subject, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSubject(subject.subjectName)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${selectedSubject === subject.subjectName
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-200 dark:bg-gray-800 text-zinc-500 dark:text-gray-400 hover:bg-zinc-300 dark:hover:bg-gray-700'
                            }`}
                        >
                          {subject.subjectName} ({subject.questions.length})
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-2 overflow-y-auto flex-1 pr-1 no-scrollbar">
                    {questions
                      .map((q, idx) => ({ q, idx }))
                      .filter(({ q }) => {
                        if (!selectedSubject) return true;
                        for (const subject of subjects) {
                          if (subject.questions.some(sq => sq.id === q.id)) {
                            return subject.subjectName === selectedSubject;
                          }
                        }
                        return true;
                      })
                      .map(({ idx }) => (
                        <button
                          key={idx}
                          onClick={() => { setCurrentQuestionIdx(idx); setShowQuestionModal(false); }}
                          className={`w-10 h-10 rounded-lg transition-all ${idx === currentQuestionIdx
                            ? 'bg-blue-500/50 text-blue-400 border border-blue-500/50 scale-110'
                            : reviewList.has(idx)
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : answers[questions[idx].id]
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 border border-zinc-300 dark:border-gray-700 hover:border-zinc-400 dark:hover:border-gray-600'
                            } text-sm`}>
                          {idx + 1}
                        </button>
                      ))}
                  </div>

                  <div className="mt-4 space-y-2 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-blue-500/30"></div>
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-green-500/30"></div>
                      <span>Answered</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-gray-500">
                      <div className="w-3 h-3 rounded bg-amber-500/30"></div>
                      <span>Marked for Review</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {notification && (
            <Notification
              type={notification.type}
              message={notification.message}
              onClose={hideNotification}
            />
          )}
        </>
      )}
    </div>
  );
}
