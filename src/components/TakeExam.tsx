import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Clock, AlertCircle, CheckCircle2, Loader2, X, Camera, WifiOff, Shield, RefreshCw, Brain, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { useUserProfile } from '../lib/UserContext';
import Notification from '../ui/Notification';
import { useMathJax } from '../lib/MathJaxContext';

// ASCII Math renderer using MathJax
export const MathText = ({ text }: { text: string }) => {
  const ready = useMathJax();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const mathSpans = containerRef.current.querySelectorAll('.math-inline');
    if (!mathSpans.length) return;

    mathSpans.forEach(span => {
      span.innerHTML = '`' + span.getAttribute('data-math') + '`';
    });

    const timer = setTimeout(() => {
      window.MathJax.typesetPromise([containerRef.current]).catch(console.error);
    }, 50);
    return () => clearTimeout(timer);
  }, [text, ready]);

  if (!text) return null;
  if (!text.includes('$')) return <span>{text}</span>;

  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span ref={containerRef} style={{ display: 'inline-block' }}>
      {parts.map((part, i) => {
        const match = part.match(/^\$([^$]+)\$$/);
        if (match) {
          return <span key={i} className="math-inline" data-math={match[1]} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

interface Question {
  id: number;
  text: string;
  type: 'mcq' | 'integer' | 'true_false' | 'text';
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  negative_marks: number;
  maxCharLimit?: number;
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

  // Question Analytics State
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>(() => {
    const saved = sessionStorage.getItem(`exam_times_${instanceId}`);
    return saved ? JSON.parse(saved) : {};
  });

  const [currentQuestionTime, setCurrentQuestionTime] = useState(0);

  // Proctoring & Start State
  const [showStartModal, setShowStartModal] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showCasualOverlay, setShowCasualOverlay] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
  const [showAIExaminerModal, setShowAIExaminerModal] = useState(false);
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);
  const [aiEvalResults, setAiEvalResults] = useState<Record<number, { marks: number; reason: string }>>({});
  const [aiEvalError, setAiEvalError] = useState<string | null>(null);

  const dotsContainerRef = useRef<HTMLDivElement>(null);

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
          // Handle both old (JSON string) and new (object) data formats
          const parsed = typeof mappedRes.generatedExam === 'string'
            ? JSON.parse(mappedRes.generatedExam)
            : mappedRes.generatedExam;
          const allQuestions: Question[] = [];
          const subjectList: Subject[] = [];

          // Parse subjects to get names by index
          let parsedSubjects: any[] = [];
          if (mappedRes.subjects) {
            try {
              parsedSubjects = typeof mappedRes.subjects === 'string' ? JSON.parse(mappedRes.subjects) : mappedRes.subjects;
            } catch (e) {
              console.error('Failed to parse subjects:', e);
            }
          }

          // Handle new flat array format (AI generated questions)
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
            // New format: flat array of questions
            const subjectMap = new Map<string, Question[]>();
            
            parsed.forEach((q: any) => {
              // Try to get subject name from parsedSubjects using subjectIndex, fallback to q.subjectName
              let subjectName = 'Unknown';
              if (q.subjectIndex !== undefined && parsedSubjects[q.subjectIndex]) {
                subjectName = parsedSubjects[q.subjectIndex].name || parsedSubjects[q.subjectIndex].subject || 'Unknown';
              } else if (q.subjectName) {
                subjectName = q.subjectName;
              }

              if (!subjectMap.has(subjectName)) {
                subjectMap.set(subjectName, []);
              }

              // Try to get marks and limits from subject setting based on question type
              let qMarks = q.marks || q.correctMarks;
              let qNeg = q.negative_marks || q.negativeMarks;
              let qChar = q.maxCharLimit || q.maxCharlimit;

              if (q.subjectIndex !== undefined && parsedSubjects[q.subjectIndex]) {
                const qt = parsedSubjects[q.subjectIndex].questionTypes?.find((t: any) => t.type === q.type);
                if (qt) {
                  qMarks = qMarks ?? qt.correctMarks;
                  qNeg = qNeg ?? qt.negativeMarks;
                }
              }

              const formattedQ: Question = {
                id: q.id,
                type: q.type,
                text: q.question,
                options: q.options || [],
                correct_answer: q.correct_answer || q.correctAnswer || '',
                explanation: q.explanation || '',
                difficulty: q.difficulty || 'medium',
                marks: qMarks ?? 4,
                negative_marks: qNeg ?? 0,
                maxCharLimit: qChar
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
            // Handle old format: array of subjects with nested questions
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
          setQuestions(allQuestions);
          setSubjects(subjectList);
        }
        
        // Check existing result to set correct timeLeft (prevents flicker)
        if (userProfile?.id) {
          try {
            const { data: resultsData, error: resultsErr } = await supabase
              .from('results')
              .select('*')
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
              // Clear stale sessionStorage timing for existing result
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
        setError('Failed to load exam. It might not exist or you don\'t have access.');
        setLoading(false);
      }
    };

    loadExam();
  }, [instanceId]);

  // Countdown Logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setShowStartModal(false); // Hide modal immediately to prevent flash
      startExamFlow();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-scroll dots to keep current question visible (mobile only)
  useEffect(() => {
    if (dotsContainerRef.current && currentQuestionIdx >= 0) {
      const dots = dotsContainerRef.current.children;
      const currentDot = dots[currentQuestionIdx] as HTMLElement;
      if (currentDot) {
        currentDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentQuestionIdx]);

  // Internet Status Monitoring - Removed (no longer needed for practice mode)

  // Prevent page reload and back navigation during exam
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

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Push initial state to enable popstate handling
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isExamStarted, isSubmitting]);

  // Cleanup localStorage on unmount (if user navigates away without submitting)
  useEffect(() => {
    return () => {
      if (instanceId) {
        localStorage.removeItem(`exam_start_${instanceId}`);
        sessionStorage.removeItem(`exam_times_${instanceId}`);
      }
    };
  }, [instanceId]);

  // Exam Timer - Based on elapsed time for accuracy and offline support
  useEffect(() => {
    if (!isExamStarted || !examData || isSubmitting) return;

    const startTime = localStorage.getItem(`exam_start_${instanceId}`);
    if (!startTime) return;

    const totalSeconds = (examData.totalTime || 0) * 60;
    
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - parseInt(startTime)) / 1000);
      if (examData?.examType === 'casual') {
        // For casual mode, track elapsed time instead of countdown
        setTimeLeft(elapsed);
      } else {
        // For practice mode, use countdown timer
        const remaining = totalSeconds - elapsed;
        if (remaining <= 0) {
          clearInterval(timer);
          setTimeLeft(0);
          setShowAutoSubmitModal(true);
        } else {
          setTimeLeft(remaining);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, examData, isSubmitting, instanceId]);

  // Track time spent per question - Independent question timer
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
        return 0; // reset
      });
    };
  }, [currentQuestionIdx, isExamStarted, isSubmitting, questions, instanceId]);

  // Improved Internet Check Logic
  const checkActualConnectivity = async () => {
    if (!navigator.onLine) return false;
    try {
      // Try to fetch a tiny resource with a cache-buster to verify actual internet access
      // We use a timeout to not hang the UI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors', 
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      return true; // If we can reach Google, internet is definitely ON
    } catch (e) {
      return false; // Fetch failed, likely offline or blocked
    }
  };

  // Proctoring Logic - Removed (no camera or internet checks for practice mode)

  const handleWarning = (msg: string) => {
    setWarnings(prev => {
      const newWarnings = prev + 1;
      if (newWarnings >= 3) {
        showNotification('error', 'Exam cancelled due to multiple security violations.');
        navigate('/exam-details/' + examData.categoryId);
        return newWarnings;
      }
      setWarningMessage(msg);
      setShowWarningModal(true);
      return newWarnings;
    });
  };

  const startExamFlow = async () => {
    // No camera or internet checks for practice mode anymore
    
    // Check if existing result record exists for this examId + userId
    if (!userProfile?.id) {
      // Cannot check existing results without user ID
    } else {
      try {
        const { data: resultsData, error: resultsErr } = await supabase
          .from('results')
          .select('*')
          .eq('userId', userProfile.id)
          .eq('examId', instanceId)
          .limit(1);

        if (!resultsErr && resultsData && resultsData.length > 0) {
          const existing = resultsData[0];
          const startTime = new Date(existing.startTime).getTime();
          const endTime = new Date(existing.endTime).getTime();
          const now = Date.now();

          if (now > endTime) {
            // Exam has expired
            setError('This exam attempt has expired. Please contact your administrator.');
            setShowStartModal(false);
            return;
          }

          // Resume existing attempt
          const remainingMs = endTime - now;
          setTimeLeft(Math.floor(remainingMs / 1000));
          setResultId(existing.id);
          
          // Load saved answers if available
          if (existing.userAnswers) {
            setAnswers(JSON.parse(existing.userAnswers));
          }
          if (existing.reviewList) {
            setReviewList(new Set(JSON.parse(existing.reviewList)));
          }

          // Set localStorage start time for timer to work correctly when resuming
          localStorage.setItem(`exam_start_${instanceId}`, startTime.toString());

          setIsExamStarted(true);
          setShowStartModal(false);
          return;
        }
      } catch (err) {
        // Continue to create new record if check fails
      }
    }
    
    // Save start time for elapsed timer logic
    const startTime = Date.now().toString();
    localStorage.setItem(`exam_start_${instanceId}`, startTime);

    // Create initial result record in database
    try {
      // Set the exam instance to 'Completed' immediately so user can't restart if cancelled/failed
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
        .select()
        .single();
      if (!insertError && resultDoc) {
        setResultId(resultDoc.id);
      }
    } catch (err) {
      // Don't alert here to avoid blocking start, but we'll try again at the end
    }
    
    setIsExamStarted(true);
    setShowStartModal(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = useCallback((questionId: number, answer: string) => {
    if (isSubmitting) return;
    setAnswers(prev => {
      if (prev[questionId] === answer) {
        // If clicking the same option, deselect it
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

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Close auto-submit modal if it's open
    setShowAutoSubmitModal(false);
    // Close exit confirm modal if it's open
    setShowExitConfirm(false);

    // Check if there are text-based questions that need AI evaluation
    const textQuestions = questions.filter(q => q.type === 'text' && answers[q.id]);
    if (textQuestions.length > 0) {
      setShowAIExaminerModal(true);
      return;
    }

    // If no text questions, proceed with normal submission
    await performSubmission();
  };

  const handleAIEvaluation = async () => {
    setIsAIEvaluating(true);
    setAiEvalError(null);

    try {
      const textQuestions = questions.filter(q => q.type === 'text' && answers[q.id]);
      const payload = textQuestions.map(q => ({
        id: q.id,
        text: q.text,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        marks: q.marks,
        negative_marks: q.negative_marks,
        userAnswer: answers[q.id],
      }));

      const res = await fetch('/api/evaluate-text-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: payload }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'AI evaluation failed');
      }

      const data = await res.json();
      const resultsMap: Record<number, { marks: number; reason: string }> = {};
      (data.results || []).forEach((r: any) => {
        resultsMap[r.id] = { marks: r.marks, reason: r.reason };
      });

      setAiEvalResults(resultsMap);
    } catch (err: any) {
      setAiEvalError(err.message || 'Failed to evaluate answers');
    } finally {
      setIsAIEvaluating(false);
    }
  };

  const performSubmission = async () => {
    setIsSubmitting(true);

    try {
      // Calculate results
      let obtainedMarks = 0;
      const correctAnswers: number[] = [];
      const wrongAnswers: number[] = [];

      questions.forEach(q => {
        const userAnswer = answers[q.id];
        if (q.type === 'text') {
          // Text questions are handled separately via AI evaluation
          const evalResult = aiEvalResults[q.id];
          if (evalResult) {
            obtainedMarks += evalResult.marks;
            if (evalResult.marks > 0) {
              correctAnswers.push(q.id);
            } else if (evalResult.marks < 0) {
              wrongAnswers.push(q.id);
            }
          }
        } else if (userAnswer === q.correct_answer) {
          obtainedMarks += q.marks;
          correctAnswers.push(q.id);
        } else if (userAnswer !== undefined && userAnswer !== "") {
          obtainedMarks -= q.negative_marks;
          wrongAnswers.push(q.id);
        }
      });

      // Update or Create the detailed result document
      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
      const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
      const percentageValue = isNaN(percentage) || !isFinite(percentage) ? 0 : Math.round(percentage);

      // Prepare userAnswers with AI evaluation for text questions
      const processedAnswers: Record<number, string> = {};
      questions.forEach(q => {
        const userAnswer = answers[q.id];
        if (q.type === 'text' && userAnswer) {
          const evalResult = aiEvalResults[q.id];
          if (evalResult) {
            processedAnswers[q.id] = `${userAnswer}!!${evalResult.marks}::${evalResult.reason}`;
          } else {
            processedAnswers[q.id] = userAnswer;
          }
        } else {
          processedAnswers[q.id] = userAnswer || '';
        }
      });

      // Incorporate any un-flushed time for the last question before submitting
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
            .select()
            .single();
          if (insertErr) throw insertErr;
          if (newRes) finalResultId = newRes.id;
        }
      } else {
        const { data: newRes, error: insertErr } = await supabase
          .from('results')
          .insert(resultData)
          .select()
          .single();
        if (insertErr) throw insertErr;
        if (newRes) finalResultId = newRes.id;
      }

      // Clear local/session storage for this exam
      localStorage.removeItem(`exam_start_${instanceId}`);
      sessionStorage.removeItem(`exam_times_${instanceId}`);

      // Update examtypes collection with percentage
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

      navigate('/results', { state: { resultId: finalResultId } }); // Pass finalResultId to results page
    } catch (err: any) {
      showNotification('error', `Failed to save results: ${err.message || 'Unknown error'}. Please check your internet and try again.`);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <p className="text-gray-400">Loading your exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl  text-white">Error</h2>
            <p className="text-gray-400">{error}</p>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIdx];

  if (!loading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">This exam has no questions.</p>
          <p className="text-gray-500 text-sm">The exam may not have been generated correctly.</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col select-none">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {/* Start Modal */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-md space-y-8 shadow-2xl text-center"
            >
              {countdown !== null ? (
                <div className="space-y-6 py-10">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-bold text-blue-500"
                  >
                    {countdown}
                  </motion.div>
                  <p className="text-gray-400 font-medium font-bold uppercase ">Exam Starting</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    
                    <h3 className="text-2xl  text-white">Ready to Start?</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      You are about to start <span className="text-white font-medium">{examData?.examName}</span>. 
                      {examData?.examType === 'practice' && (
                        <span className="block mt-2 text-amber-500 font-medium">
                          Note: This is a Test with  time limit.
                        </span>
                      )}
                      {examData?.examType === 'casual' && (
                        <span className="block mt-2 text-blue-500 font-medium">
                          Note: This is a Casual Practice. No time limit, just track your time.
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => navigate(-1)}
                      className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl  transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setCountdown(3)}
                      className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl  transition-all shadow-lg shadow-blue-500/20"
                    >
                      Start Now
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-900 border border-red-500/50 rounded-3xl p-8 w-full max-w-sm space-y-6 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl  text-white">Security Warning</h3>
                <p className="text-sm text-gray-400">{warningMessage}</p>
                <p className="text-xs text-red-400  mt-2">Warning {warnings}/3</p>
              </div>
              <button 
                onClick={() => setShowWarningModal(false)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl  transition-all"
              >
                I Understand
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proctoring UI (Floating Camera) - Removed for practice mode */}

      {/* Header */}
      <header className="px-4 py-3 bg-gray-900/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          
          <div>
            <h1 className="text-sm  text-white truncate max-w-[150px]">{examData?.examName}</h1>
            <div className="flex items-center gap-2">
              {examData?.examType === 'casual' && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-[8px] text-blue-500  uppercase">
                  <Clock className="w-2 h-2" /> Casual
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center flex-1">
          {timeLeft !== null && (() => {
            if (examData?.examType === 'casual') {
              // For casual mode, show elapsed time in simple format
              const hours = Math.floor(timeLeft / 3600);
              const minutes = Math.floor((timeLeft % 3600) / 60);
              const seconds = timeLeft % 60;
              const timeStr = hours > 0
                ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              return (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/50 bg-gray-800/30">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span className="text-xs font-mono text-white">{timeStr}</span>
                </div>
              );
            } else {
              // For practice mode, show countdown with progress
              const totalSec = (examData?.totalTime || 0) * 60;
              const pct = totalSec > 0 ? (timeLeft / totalSec) * 100 : 100;
              const borderClass = pct >= 60
                ? 'border-green-500/50 text-green-500'
                : pct >= 20
                  ? 'border-yellow-500/50 text-yellow-500'
                  : 'border-red-500/50 text-red-500';
              return (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border bg-gray-800/30 ${borderClass}`}>
                  <Clock className={`w-3 h-3 ${pct >= 60 ? 'text-green-500' : pct >= 20 ? 'text-yellow-500' : 'text-red-500'}`} />
                  <span className="text-xs font-mono text-white">{formatTime(timeLeft)}</span>
                </div>
              );
            }
          })()}
        </div>

        <div className="flex items-center justify-end flex-1">
          <button 
            onClick={() => setShowExitConfirm(true)}
            className="px-4 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs  tracking-wider transition-all"
          >
            Finish
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 w-full">
          {/* Question Content */}
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
                    <span className="px-2 py-0.5 bg-gray-800 text-white rounded-md text-[10px]  uppercase tracking-wider">
                      {currentQuestionIdx + 1}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[10px]  uppercase tracking-wider">
                      +{currentQuestion.marks} <span className="hidden sm:inline">Marks</span>
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-800/50 text-gray-500 rounded-md text-[10px] uppercase tracking-wider border border-gray-800">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime((questionTimes[currentQuestion.id] || 0) + currentQuestionTime)}
                    </div>
                    <button
                      onClick={() => setShowQuestionModal(true)}
                      className="md:hidden flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                      <span>Questions</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => toggleReview(currentQuestionIdx)}
                    className={`flex items-center gap-2 px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] tracking-wider transition-all ${
                      reviewList.has(currentQuestionIdx)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {reviewList.has(currentQuestionIdx) ? 'In Review' : 'Mark for review'}
                  </button>
                </div>
                <h2 className="text-base md:text-lg font-medium leading-relaxed">
                  <MathText text={currentQuestion.text} />
                </h2>
              </div>

              <div className="space-y-3">
                {currentQuestion.type === 'mcq' && currentQuestion.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(currentQuestion.id, option)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                      answers[currentQuestion.id] === option
                        ? 'bg-blue-600/10 border-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                        : 'bg-gray-900 border-gray-800 text-white hover:border-gray-700'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0  text-xs ${
                      answers[currentQuestion.id] === option
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-700'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="text-sm md:text-base font-medium leading-relaxed">
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
                        className={`p-8 rounded-2xl border text-center transition-all capitalize  text-lg ${
                          answers[currentQuestion.id] === val
                            ? 'bg-blue-600/10 border-blue-600 text-white'
                            : 'bg-gray-900 border-gray-800 text-white hover:border-gray-700'
                        }`}
                      >
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
                      placeholder="Enter integer answer"
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9-]/g, '');
                        if (val.length <= 15) handleAnswer(currentQuestion.id, val);
                      }}
                      className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center text-3xl text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-gray-800"
                    />
                    <p className="text-[10px] text-gray-600 text-center uppercase  ">Max 15 Digits</p>
                  </div>
                )}

                {currentQuestion.type === 'text' && (
                  <div className="space-y-4">
                    <textarea
                      placeholder="Enter your answer"
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const maxChar = currentQuestion.maxCharLimit || 150;
                        if (val.length <= maxChar) handleAnswer(currentQuestion.id, val);
                      }}
                      maxLength={currentQuestion.maxCharLimit || 150}
                      className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all placeholder:text-gray-800 min-h-[120px] resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-600 uppercase">Short Answer Question</p>
                      <p className="text-[10px] text-gray-500">
                        {answers[currentQuestion.id]?.length || 0} / {currentQuestion.maxCharLimit || 150} characters
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
          </div>

          {/* Right Sidebar - Question Number Boxes (Desktop Only) */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 max-h-[calc(100vh-8rem)] flex flex-col">
              <h3 className="text-xs font-medium uppercase text-gray-500 mb-4 shrink-0">Questions</h3>
              
              {/* Subject Tabs */}
              {subjects.length > 1 && (
                <div className="mb-4 shrink-0">
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${
                      selectedSubject === null
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    All Subjects
                  </button>
                  {subjects.map((subject, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSubject(subject.subjectName)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${
                        selectedSubject === subject.subjectName
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                    // Find which subject this question belongs to
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
                    className={`w-10 h-10 rounded-lg text-sm  transition-all ${
                      idx === currentQuestionIdx
                        ? 'bg-blue-500/50 text-blue-400 border border-blue-500/50 scale-110'
                        : reviewList.has(idx)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : answers[questions[idx].id]
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-3 h-3 rounded bg-blue-500/30"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-3 h-3 rounded bg-green-500/30"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-3 h-3 rounded bg-amber-500/30"></div>
                  <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-3 h-3 rounded bg-gray-800 border border-gray-700"></div>
                  <span>Skipped</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="p-4 bg-gray-900/50 backdrop-blur-md border-t border-gray-800 sticky bottom-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button
            disabled={currentQuestionIdx === 0}
            onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl  transition-all flex items-center justify-center gap-2 text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div ref={dotsContainerRef} className="flex gap-1 overflow-x-auto max-w-[40%] no-scrollbar px-2 md:hidden">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestionIdx(idx)}
                className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                  idx === currentQuestionIdx ? 'bg-blue-500/60 scale-125' : 
                  reviewList.has(idx) ? 'bg-amber-500/30' :
                  answers[questions[idx].id] ? 'bg-green-500/30' : 'bg-gray-700'
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
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl  transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 text-xs"
          >
            {currentQuestionIdx === questions.length - 1 ? 'Finish' : ''}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* Exit/Submit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl text-center"
            >
              <div className="space-y-2">
                <h3 className="text-2xl  text-white">Finish Exam?</h3>
                <p className="text-sm text-gray-400">
                  You have answered {Object.keys(answers).length} out of {questions.length} questions.
                  {reviewList.size > 0 && <span className="block text-amber-500 mt-1 font-medium">{reviewList.size} questions are still marked for review.</span>}
                </p>
              </div>

              <div className="space-y-3">
                <button 
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl  transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : 'Yes, Submit Now'}
                </button>
                <button 
                  disabled={isSubmitting}
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl  transition-all"
                >
                  Continue Exam
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Submit Modal - Shown when timer reaches 00:00 */}
      <AnimatePresence>
        {showAutoSubmitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900 border border-red-500/50 rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl text-white">Time's Up!</h3>
                <p className="text-sm text-gray-400">
                  Your exam time has ended. You have answered {Object.keys(answers).length} out of {questions.length} questions.
                  {reviewList.size > 0 && <span className="block text-amber-500 mt-1 font-medium">{reviewList.size} questions are still marked for review.</span>}
                </p>
              </div>

              <button
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : 'Submit Exam Now'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Examiner Modal - For text-based questions */}
      <AnimatePresence>
        {showAIExaminerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900 border border-blue-500/50 rounded-3xl p-4 sm:p-6 w-full max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl"
            >
              <div className="space-y-4">
                <h3 className="text-xl text-white">AI Examiner - Text Questions</h3>

                {questions.filter(q => q.type === 'text' && answers[q.id]).map((q, idx) => (
                  <div key={q.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs text-blue-400 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="text-sm font-medium text-white">
                          <MathText text={q.text} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400">
                          <div>Marks: +{q.marks}</div>
                          <div>Negative: -{q.negative_marks}</div>
                          <div>Max chars: {q.maxCharLimit || 150}</div>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-3">
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Your Answer</div>
                          <div className="text-sm text-gray-300">{answers[q.id]}</div>
                        </div>
                        {aiEvalResults[q.id] && (
                          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] text-blue-400 uppercase">AI Evaluation</div>
                              <div className={`text-sm  ${aiEvalResults[q.id].marks > 0 ? 'text-green-400' : aiEvalResults[q.id].marks < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                                {aiEvalResults[q.id].marks} marks
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400">{aiEvalResults[q.id].reason}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {aiEvalError && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
                    {aiEvalError}
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  {!Object.keys(aiEvalResults).length ? (
                    <button
                      onClick={handleAIEvaluation}
                      disabled={isAIEvaluating}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {isAIEvaluating ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Evaluating with AI...</>
                      ) : (
                        <>Call AI Examiner for Text Questions</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowAIExaminerModal(false);
                        performSubmission();
                      }}
                      disabled={isSubmitting}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                      ) : (
                        <><CheckSquare className="w-5 h-5" /> Submit Exam with AI Marks</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowAIExaminerModal(false)}
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Practice Unremovable Overlay - Shown after auto-submit */}
      <AnimatePresence>
        {showCasualOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900 border-2 border-red-500 rounded-3xl p-12 w-full max-w-2xl space-y-8 shadow-2xl text-center"
            >
              <div className="space-y-4">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-4xl  text-white">Exam Completed</h3>
                <p className="text-lg text-gray-400 leading-relaxed">
                  Your mock test has been automatically submitted due to time expiry.
                  <br /><br />
                  <span className="text-red-400 font-medium">DO NOT turn on your internet connection until instructed.</span>
                  <br /><br />
                  Your results are being processed. Please wait while we redirect you to the results page.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-500">Processing your results...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Question Modal - Shows question number boxes */}
      <AnimatePresence>
        {showQuestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-6"
            onClick={() => setShowQuestionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-gray-800 rounded-3xl p-4 md:p-6 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-sm font-medium uppercase text-gray-400">Questions</h3>
                <button
                  onClick={() => setShowQuestionModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Subject Tabs */}
              {subjects.length > 1 && (
                <div className="mb-4 shrink-0">
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${
                      selectedSubject === null
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    All Subjects
                  </button>
                  {subjects.map((subject, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSubject(subject.subjectName)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-2 w-full ${
                        selectedSubject === subject.subjectName
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                    className={`w-10 h-10 rounded-lg text-sm  transition-all ${
                      idx === currentQuestionIdx
                        ? 'bg-blue-500/50 text-blue-400 border border-blue-500/50 scale-110'
                        : reviewList.has(idx)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : answers[questions[idx].id]
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2 shrink-0">
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-3 h-3 rounded bg-blue-500/30"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-3 h-3 rounded bg-green-500/30"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
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
    </div>
  );
}
