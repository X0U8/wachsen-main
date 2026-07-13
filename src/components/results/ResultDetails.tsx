import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, CheckCircle2, XCircle, Clock, Award, ChevronLeft, ChevronUp,
  BarChart3, Brain, Target, Zap, AlertTriangle, Info, PieChart, Activity, Sparkle, X, Printer
} from 'lucide-react';
import AITutorModal from './AITutorModal';
import PrintQuestion from './PrintQuestion';
import { motion } from 'framer-motion';
import MathText from '../../ui/MathText';
import Notification from '../../ui/Notification';
import { fontSize } from '../../lib/utils';
import { idbGet, idbSet } from '../../lib/idb';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie, Legend
} from 'recharts';



function parseStoredValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeResultQuestions(rawGeneratedExam: unknown, parsedSubjects: any[]) {
  const parsed = parseStoredValue<any>(rawGeneratedExam, []);
  const allQuestions: any[] = [];
  const counts: number[] = [];

  const subjectsList = Array.isArray(parsedSubjects) ? parsedSubjects : [];


  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0]?.question || parsed[0]?.text)) {
    const subjectMap = new Map<string, any[]>();

    parsed.forEach((q: any) => {
      let subjectName = 'Unknown';
      if (q.subjectIndex !== undefined && subjectsList[q.subjectIndex]) {
        subjectName = subjectsList[q.subjectIndex].name || subjectsList[q.subjectIndex].subject || 'Unknown';
      } else if (q.subjectName || q.subject) {
        subjectName = q.subjectName || q.subject;
      }

      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, []);
      }

      subjectMap.get(subjectName)!.push({
        ...q,
        text: q.question || q.text || '',
        question: q.question || q.text || '',
        correct_answer: q.correct_answer || q.correctAnswer || q.answer || '',
        subject: subjectName,
        chapter: q.chapter || q.chapters || ''
      });
    });

    subjectMap.forEach((subjectQuestions) => {
      counts.push(subjectQuestions.length);
      allQuestions.push(...subjectQuestions);
    });

    return { allQuestions, counts };
  }

  const subjects = Array.isArray(parsed) ? parsed : (parsed?.subjects || []);
  subjects.forEach((s: any) => {
    const qs = Array.isArray(s.questions) ? s.questions : [];
    counts.push(qs.length);
    allQuestions.push(...qs.map((q: any) => ({
      ...q,
      text: q.question || q.text || '',
      question: q.question || q.text || '',
      correct_answer: q.correct_answer || q.correctAnswer || q.answer || '',
      subject: s.subject || s.subjectName || s.name || q.subject || q.subjectName || '',
      chapter: s.chapter || s.chapters || q.chapter || ''
    })));
  });

  return { allQuestions, counts };
}

function normalizeExamPlanSubjects(rawPlan: unknown): any[] {
  const parsed = parseStoredValue<any>(rawPlan, null);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.subjects)) return parsed.subjects;
  return [];
}

function normalizeName(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function buildPlanTopicEntries(planSubject: any) {
  if (!planSubject) return [];

  if (Array.isArray(planSubject.segments)) {
    return planSubject.segments.flatMap((segment: any) => {
      const topics = Array.isArray(segment?.topics) ? segment.topics : [];
      return topics
        .map((topic: any) => ({
          range: segment?.range || (segment?.from && segment?.to ? `${segment.from}-${segment.to}` : ''),
          label: typeof topic === 'string' ? topic : (topic?.name || topic?.topic || '')
        }))
        .filter((entry: any) => entry.label);
    });
  }

  if (Array.isArray(planSubject.topics)) {
    return planSubject.topics
      .map((topic: any) => ({
        range: topic?.range || (topic?.from && topic?.to ? `${topic.from}-${topic.to}` : ''),
        label: typeof topic === 'string' ? topic : (topic?.name || topic?.topic || '')
      }))
      .filter((entry: any) => entry.label);
  }

  return [];
}

export default function ResultDetails() {
  const { resultId, viewUserId, examId } = useParams<{ resultId?: string; viewUserId?: string; examId?: string }>();
  const navigate = useNavigate();
  const { userProfile, refreshProfile, refreshCredits } = useUserProfile();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isRestrictedView, setIsRestrictedView] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [examPlan, setExamPlan] = useState<any>(null);
  const [examChapters, setExamChapters] = useState<any>(null);
  const [subjectQuestionCounts, setSubjectQuestionCounts] = useState<number[]>([]);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [expandedSubjectIdx, setExpandedSubjectIdx] = useState<number | null>(null);


  const [tutorQuestion, setTutorQuestion] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [examMeta, setExamMeta] = useState<{
    totalTime: number;
    totalMarks: number;
    correctMarks: number;
    negativeMarks: number;
  }>({ totalTime: 60, totalMarks: 100, correctMarks: 4, negativeMarks: 0 });
  const queryClient = useQueryClient();
  const [hasRevisionLog, setHasRevisionLog] = useState(true);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  const planSubjects = useMemo(() => normalizeExamPlanSubjects(examPlan), [examPlan]);

  const analysisSubjects = useMemo(() => {
    const chapterSubjects = Array.isArray(examChapters) ? examChapters : [];

    if (chapterSubjects.length > 0) {
      return chapterSubjects.map((subject: any, idx: number) => {
        const planSubjectByIndex = planSubjects[idx];
        const planSubjectByName = planSubjects.find((ps: any) =>
          normalizeName(ps?.name || ps?.subjectName) === normalizeName(subject?.name || subject?.subjectName)
        );
        const matchedPlanSubject = planSubjectByIndex || planSubjectByName || null;

        return {
          ...subject,
          name: subject?.name || subject?.subjectName || matchedPlanSubject?.name || matchedPlanSubject?.subjectName || `Subject ${idx + 1}`,
          chapters: subject?.chapters || subject?.chapter || '',
          planSubject: matchedPlanSubject,
          planTopics: buildPlanTopicEntries(matchedPlanSubject)
        };
      });
    }

    if (planSubjects.length > 0) {
      return planSubjects.map((subject: any, idx: number) => ({
        ...subject,
        name: subject?.name || subject?.subjectName || `Subject ${idx + 1}`,
        chapters: subject?.chapters || subject?.chapter || '',
        planSubject: subject,
        planTopics: buildPlanTopicEntries(subject)
      }));
    }


    const uniqueSubjects = new Map<string, number>();
    questions.forEach(q => {
      const sName = q.subject || q.subjectName || 'Unknown';
      uniqueSubjects.set(sName, (uniqueSubjects.get(sName) || 0) + 1);
    });

    return Array.from(uniqueSubjects.entries()).map(([name, count]) => ({
      name,
      count,
      chapters: '',
      planSubject: null,
      planTopics: []
    }));
  }, [examChapters, planSubjects, questions]);

  const getQuestionTopic = (q: any, qIdx: number, subjects: any[]) => {
    if (q.chapter) return q.chapter;

    const targetSubject = subjects?.find(sub =>
      sub.name?.toLowerCase() === q.subject?.toLowerCase() ||
      sub.subject?.toLowerCase() === q.subject?.toLowerCase()
    );

    const segments = targetSubject?.planSubject?.segments || targetSubject?.segments;

    if (Array.isArray(segments)) {
      const qNum = qIdx + 1;
      for (const segment of segments) {
        if (!segment.range) continue;
        const [start, end] = segment.range.split('-').map(Number);
        if (qNum >= start && qNum <= (end || start)) {
          if (Array.isArray(segment.topics)) {
            return segment.topics.join(', ');
          }
          return segment.topics || '';
        }
      }
    }
    return 'Review Topic';
  };

  const createRevisionLog = async () => {
    if (!result || !questions.length || isCreatingRevision || hasRevisionLog) return;
    setIsCreatingRevision(true);

    try {
      const correctIds = parseStoredValue(result.correctAnswers, []);
      const wrongAndSkipped = questions.map((q, qIdx) => {
        const isCorrect = correctIds.includes(q.id);
        if (isCorrect) return null;

        const userAns = analytics?.userAnswers?.[q.id] || '';
        return {
          id: q.id,
          originalIndex: qIdx,
          type: q.type || q.questionType || 'mcq',
          question: q.question || q.text,
          options: q.options || [],
          correct_answer: q.correct_answer || q.correctAnswer || '',
          userAnswer: userAns,
          subject: q.subject || 'Review'
        };
      }).filter((q): q is NonNullable<typeof q> => q !== null);

      const { error } = await supabase
        .from('revision')
        .insert({
          userID: userId || result.userId,
          examID: result.examId,
          questions: JSON.stringify(wrongAndSkipped),
          examLogs: JSON.stringify(examPlan || analysisSubjects),
          question_count: wrongAndSkipped.length
        });

      if (error) throw error;

      setHasRevisionLog(true);
      showNotification('success', 'Revision log created successfully!');
      // Drop all localStorage revision caches so next visit re-fetches fresh data
      Object.keys(localStorage)
        .filter(k => k.startsWith('cached_revision_logs_'))
        .forEach(k => localStorage.removeItem(k));
      // Invalidate React Query cache so RevisionLog re-fetches immediately
      queryClient.invalidateQueries({ queryKey: ['revisionLogs'] });
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'Failed to create revision log');
    } finally {
      setIsCreatingRevision(false);
    }
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };



  useEffect(() => {
    if (!resultId && (!viewUserId || !examId)) return;
    if (!userProfile?.id) return;

    const fetchResult = async () => {
      try {
        setLoading(true);
        let resDoc: any = null;
        let examDoc: any = null;

        if (viewUserId && examId) {

          if (viewUserId !== userProfile.id) {
            setIsRestrictedView(true);
            const { data: chCheck, error: chErr } = await supabase
              .from('challenges')
              .select('id')
              .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${viewUserId}),and(sender_id.eq.${viewUserId},receiver_id.eq.${userProfile.id})`)
              .or(`exam_id.eq.${examId},receiver_exam_id.eq.${examId}`)
              .limit(1);

            if (chErr || !chCheck || chCheck.length === 0) {
              setIsAuthorized(false);
              setLoading(false);
              return;
            }
          }
          setIsAuthorized(true);


          const { data: resData, error: getResultError } = await supabase
            .from('results')
            .select('id, examId, userId, examName, startTime, endTime, marksObtained, totalMarks, correctAnswers, wrongAnswers, userAnswers, timeSpentPerQuestion')
            .eq('userId', viewUserId)
            .eq('examId', examId)
            .maybeSingle();

          if (getResultError) throw getResultError;
          if (!resData) {

            setResult(null);
            setLoading(false);
            return;
          }
          resDoc = resData;
        } else {

          setIsAuthorized(true);

          const cacheKey = `result_details_${resultId}`;
          const cached = await idbGet(cacheKey);

          if (cached) {
            resDoc = cached.resDoc;
            examDoc = cached.examDoc;
          } else {

            const { data, error: getResultError } = await supabase
              .from('results')
              .select('id, examId, userId, examName, startTime, endTime, marksObtained, totalMarks, correctAnswers, wrongAnswers, userAnswers, timeSpentPerQuestion')
              .eq('id', resultId)
              .single();
            if (getResultError) throw getResultError;

            resDoc = data;
          }


          if (resDoc && resDoc.userId !== userProfile.id) {
            setIsRestrictedView(true);
            const { data: chCheck } = await supabase
              .from('challenges')
              .select('id')
              .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${resDoc.userId}),and(sender_id.eq.${resDoc.userId},receiver_id.eq.${userProfile.id})`)
              .or(`exam_id.eq.${resDoc.examId},receiver_exam_id.eq.${resDoc.examId}`)
              .limit(1);

            if (!chCheck || chCheck.length === 0) {
              setIsAuthorized(false);
              setLoading(false);
              return;
            }
          }
        }

        if (resDoc) {
          setResult(resDoc);
          setUserId(resDoc.userId || null);
          setLoading(false);
          setLoadingQuestions(true);


          if (!examDoc) {
            const { data: examDocs, error: examError } = await supabase
              .from('exams')
              .select('generatedExam, ExamPlan, subjects, totalTime, totalMarks, correct_marks, negative_marks')
              .eq('id', resDoc.examId)
              .limit(1);

            if (examError) throw examError;

            if (examDocs && examDocs.length > 0) {
              examDoc = examDocs[0];
              if (resultId) {
                await idbSet(`result_details_${resultId}`, { resDoc, examDoc });
              }
            }
          }
        }

        if (examDoc) {

          let subjectsParsed: any[] = [];
          if (examDoc.subjects) {
            subjectsParsed = parseStoredValue(examDoc.subjects, []);
            setExamChapters(subjectsParsed);
          }

          setExamMeta({
            totalTime: examDoc.totalTime || 60,
            totalMarks: examDoc.totalMarks || 0,
            correctMarks: examDoc.correct_marks ?? 4,
            negativeMarks: examDoc.negative_marks ?? 0
          });

          if (examDoc.generatedExam) {
            const { allQuestions, counts } = normalizeResultQuestions(examDoc.generatedExam, subjectsParsed);
            setQuestions(allQuestions);
            setSubjectQuestionCounts(counts);
          }


          if (examDoc.ExamPlan) {
            const planParsed = parseStoredValue(examDoc.ExamPlan, null);
            setExamPlan(planParsed);
          }
        }


        if (resDoc && !isRestrictedView) {
          try {
            const { data: existingRev } = await supabase
              .from('revision')
              .select('id')
              .eq('userID', resDoc.userId)
              .eq('examID', resDoc.examId)
              .maybeSingle();
            setHasRevisionLog(!!existingRev);
          } catch (e) {
            console.error('Error checking revision:', e);
          }
        }
      } catch (err) {
        console.error('Error fetching result details:', err);
      } finally {
        setLoading(false);
        setLoadingQuestions(false);
      }
    };

    fetchResult();
  }, [resultId, viewUserId, examId, userProfile?.id]);


  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  useEffect(() => {
    setSelectedQuestionId(null);
  }, [filter]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const analytics = useMemo(() => {
    if (!result || questions.length === 0) return null;

    const correctIds = parseStoredValue(result.correctAnswers, []);
    const wrongIds = parseStoredValue(result.wrongAnswers, []);
    const userAnswers = parseStoredValue(result.userAnswers, {});
    const questionTimes = parseStoredValue(result.timeSpentPerQuestion, {});

    const attempted = correctIds.length + wrongIds.length;
    const skipped = questions.length - correctIds.length - wrongIds.length;
    const totalTimeTakenSec = result.startTime && result.endTime
      ? Math.floor((new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 1000)
      : 0;

    const avgTimePerAttempt = attempted > 0 ? (totalTimeTakenSec / attempted) : 0;


    const chapterAnalytics: Record<string, { correct: number, wrong: number, total: number, start: number, end: number, subject: string }> = {};
    analysisSubjects.forEach((subject: any, idx: number) => {
      const key = String(idx);
      chapterAnalytics[key] = { correct: 0, wrong: 0, total: 0, start: 0, end: 0, subject: subject.name || '' };

      const subjectNameLower = (subject.name || '').toLowerCase().trim();
      const subjectQuestions = questions.filter(q => {
        const qSub = (q.subject || q.subjectName || '').toLowerCase().trim();
        return qSub === subjectNameLower;
      });

      chapterAnalytics[key].total = subjectQuestions.length;
      subjectQuestions.forEach(q => {
        if (correctIds.includes(q.id)) chapterAnalytics[key].correct++;
        else if (wrongIds.includes(q.id)) chapterAnalytics[key].wrong++;
      });
    });


    const timePerQuestionData = questions.map((q, idx) => ({
      name: `Q${idx + 1}`,
      time: questionTimes[q.id] || 0
    }));


    const difficultyDataMap: Record<string, { correct: number, wrong: number, skipped: number }> = {
      easy: { correct: 0, wrong: 0, skipped: 0 },
      medium: { correct: 0, wrong: 0, skipped: 0 },
      hard: { correct: 0, wrong: 0, skipped: 0 },
      advance: { correct: 0, wrong: 0, skipped: 0 }
    };

    questions.forEach(q => {
      const diff = (q.difficulty || 'medium').toLowerCase();
      const normalizedDiff = diff in difficultyDataMap ? diff : 'medium';
      if (correctIds.includes(q.id)) difficultyDataMap[normalizedDiff].correct++;
      else if (wrongIds.includes(q.id)) difficultyDataMap[normalizedDiff].wrong++;
      else difficultyDataMap[normalizedDiff].skipped++;
    });

    const difficultyChartData = Object.entries(difficultyDataMap).map(([level, stats]) => ({
      level: level.charAt(0).toUpperCase() + level.slice(1),
      ...stats
    }));


    const doughnutData = [
      { name: 'Correct', value: correctIds?.length || 0, color: '#22c55e' },
      { name: 'Wrong', value: wrongIds?.length || 0, color: '#ef4444' },
      { name: 'Skipped', value: (questions?.length || 0) - (correctIds?.length || 0) - (wrongIds?.length || 0), color: '#4b5563' }
    ];


    const performanceMatrix = {
      quickRight: 0,
      quickWrong: 0,
      slowRight: 0,
      slowWrong: 0
    };

    questions.forEach(q => {
      const time = questionTimes[q.id] || 0;
      if (!userAnswers[q.id]) return;

      const isQuick = time <= avgTimePerAttempt;
      const isRight = correctIds.includes(q.id);

      if (isQuick && isRight) performanceMatrix.quickRight++;
      else if (isQuick && !isRight) performanceMatrix.quickWrong++;
      else if (!isQuick && isRight) performanceMatrix.slowRight++;
      else if (!isQuick && !isRight) performanceMatrix.slowWrong++;
    });

    return {
      correctIds,
      wrongIds,
      userAnswers,
      questionTimes,
      attempted,
      skipped,
      accuracy: Math.round((correctIds.length / (attempted || 1)) * 100),
      totalTimeTakenSec,
      totalTimeTakenMin: Math.floor(totalTimeTakenSec / 60),
      avgTimePerAttempt: Math.round(avgTimePerAttempt),
      timePerQuestionData,
      difficultyChartData,
      doughnutData,
      performanceMatrix,
      chapterAnalytics
    };
  }, [result, questions, analysisSubjects, subjectQuestionCounts]);


  const filteredQuestions = useMemo(() => {
    if (!analytics) return [];
    return questions.filter(q => {
      const status = analytics.correctIds.includes(q.id) ? 'correct' : (analytics.wrongIds.includes(q.id) ? 'wrong' : 'skipped');
      if (filter === 'all') return true;
      return status === filter;
    });
  }, [questions, analytics, filter]);


  const selectedQuestion = useMemo(() => {
    if (filteredQuestions.length === 0) return null;
    return filteredQuestions.find(q => q.id === selectedQuestionId) || filteredQuestions[0];
  }, [filteredQuestions, selectedQuestionId]);

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-base">Access Denied</h2>
        <p className="mt-2 text-xs text-zinc-500 dark:text-gray-400 font-medium max-w-xs leading-relaxed">
          You are not authorized to view this result. Sharing is restricted to participants of the challenge.
        </p>
        <button
          onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/results'); } }}
          className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer text-xs">Back</button>
      </div>
    );
  }

  if (!loading && !result) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6">
        <h2 className="text-sm">Result Not Found</h2>
        <button
          onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/results'); } }}
          className="mt-6 px-4 py-2 bg-blue-600 rounded-xl text-sm">Back to Results</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="mt-4 text-zinc-500 dark:text-gray-400 font-medium text-xs">Analyzing</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      <header className="p-2 flex items-center justify-between border-b border-gray-900 bg-zinc-50/50 dark:bg-black/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/results'); } }} className="p-2 hover:bg-white dark:hover:bg-gray-900 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-zinc-900 dark:text-white" />
          </button>
          <h1
            className="sm:text-lg font-medium text-zinc-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px] text-base">
            {result.examName || 'Results'}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mr-2">
          {!isRestrictedView && (
            <button
              onClick={createRevisionLog}
              disabled={hasRevisionLog || isCreatingRevision}
              className="px-2.5 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-gray-800 text-white disabled:text-zinc-500 dark:disabled:text-gray-400 rounded-xl font-semibold shadow-sm hover:shadow-md disabled:shadow-none transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed text-xs">
              {isCreatingRevision ? (
                <>
                  <Loader2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Creating...</span>
                  <span className="sm:hidden">Creating</span>
                </>
              ) : hasRevisionLog ? (
                <>
                  <span className="hidden sm:inline">Revision Log Created</span>
                  <span className="sm:hidden">Created</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Create Revision Log</span>
                  <span className="sm:hidden">Create Revision</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowPrintPreview(true)}
            className="px-2.5 sm:px-3.5 py-1.5 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-1 cursor-pointer text-xs">
            <Printer className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            <span className="hidden sm:inline">Print Exam</span>
          </button>
        </div>
      </header>
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center  space-y-2 py-4">
          <div className="text-5xl font-black text-zinc-900 dark:text-white text-3xl">
            {result.marksObtained}<span className="text-blue-500">/</span><span className="text-gray-600">{result.totalMarks}</span>
          </div>

        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {analytics ? [
            { label: 'Final Score', value: result.marksObtained, color: 'text-zinc-900 dark:text-white font-bold' },
            { label: 'Accuracy', value: `${analytics.accuracy}%`, color: 'text-zinc-900 dark:text-white font-bold' },
            { label: 'Time Taken', value: `${analytics.totalTimeTakenMin}m`, color: 'text-zinc-900 dark:text-white font-bold' },
            { label: 'Attempted', value: `${analytics.attempted}/${questions.length}`, color: 'text-zinc-900 dark:text-white font-bold' },
          ].map((card, i) => (
            <div key={i} className="bg-white dark:bg-gray-900/50 border border-zinc-200 dark:border-gray-800 p-3 md:p-6 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center text-center space-y-1 md:space-y-2">
              <p
                className="text-[9px] text-zinc-500 dark:text-gray-400 font-medium text-xs">{card.label}</p>
              <p className={`md:text-3xl truncate w-full ${card.color} text-base`}>{card.value}</p>
            </div>
          )) : [
            { label: 'Final Score', value: result.marksObtained, color: 'text-zinc-900 dark:text-white font-bold' },
            { label: 'Accuracy', value: 'Loading...', color: 'text-zinc-400 dark:text-zinc-500' },
            { label: 'Time Taken', value: 'Loading...', color: 'text-zinc-400 dark:text-zinc-500' },
            { label: 'Attempted', value: 'Loading...', color: 'text-zinc-400 dark:text-zinc-500' },
          ].map((card, i) => (
            <div key={i} className="bg-white dark:bg-gray-900/50 border border-zinc-200 dark:border-gray-800 p-3 md:p-6 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center text-center space-y-1 md:space-y-2">
              <p
                className="text-[10px] text-zinc-500 dark:text-gray-400 font-medium text-xs">{card.label}</p>
              <p className={`md:text-3xl truncate w-full ${card.color} text-base`}>{card.value}</p>
            </div>
          ))}
        </div>

        {loadingQuestions ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl h-80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ))}
          </div>
        ) : !analytics ? (
          <div
            className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl text-center text-zinc-500 dark:text-gray-400 text-sm">
            Question data is unavailable for this result, so detailed analytics cannot be shown.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-zinc-500 dark:text-gray-400 text-xs">Time Spent Per Question</h3>
              <div className="overflow-x-auto">
                <div
                  style={{ minWidth: Math.max(analytics?.timePerQuestionData?.length * 32 || 300, 300) }}
                  className="h-64"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.timePerQuestionData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="time"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 2 }}
                        activeDot={{ r: 5, stroke: '#111827', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 dark:text-gray-400 text-xs">Difficulty Analysis</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.difficultyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                      contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                    />
                    <Bar dataKey="correct" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="skipped" stackId="a" fill="#4b5563" />
                    <Bar dataKey="wrong" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 dark:text-gray-400 text-xs">Global Status</h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={analytics.doughnutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {analytics.doughnutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl space-y-6">
              <h3 className="text-zinc-500 dark:text-gray-400 text-xs">Performance Matrix</h3>
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {[
                  { label: 'Quick + Right', value: analytics.performanceMatrix.quickRight, desc: 'Quick Thinking Skill', color: 'bg-green-500/5 dark:bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300' },
                  { label: 'Quick + Wrong', value: analytics.performanceMatrix.quickWrong, desc: 'Silly Mistake / Blind Guess', color: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300' },
                  { label: 'Slow + Correct', value: analytics.performanceMatrix.slowRight, desc: 'Tough Question / Confused', color: 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300' },
                  { label: 'Slow + Wrong', value: analytics.performanceMatrix.slowWrong, desc: 'Conceptual Gap', color: 'bg-red-500/5 dark:bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300' },
                ].map((item, idx) => (
                  <div key={idx} className={`${item.color} border p-4 rounded-2xl flex flex-col justify-center items-center text-center space-y-1`}>
                    <div className="font-bold text-xl">{item.value}</div>
                    <div className="font-semibold text-xs">{item.label}</div>
                    <div className="opacity-70 text-xs">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {analysisSubjects.length > 0 && (() => {
              return (
                <>
                  <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl space-y-4">
                    <h3 className="text-zinc-500 dark:text-gray-400 text-xs">Topic-wise Analysis</h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {analysisSubjects.map((subject: any, idx: number) => {
                        const hasSubtopics = subject.planTopics.length > 0;
                        const isExpanded = expandedSubjectIdx === idx;
                        return (
                          <div key={idx}>
                            <div
                              className={`flex items-center gap-3 p-3 bg-zinc-100 dark:bg-gray-800/30 rounded-xl border border-zinc-200 dark:border-gray-700/50 ${hasSubtopics ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-gray-600' : ''} transition-all`}
                              onClick={() => hasSubtopics && setExpandedSubjectIdx(isExpanded ? null : idx)}
                            >
                              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] text-blue-500 dark:text-blue-400 font-semibold shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-zinc-900 dark:text-white text-xs">{subject.name || ''}</div>
                                {subject.chapters ? <div className="text-zinc-550 dark:text-gray-400 mt-0.5 text-xs">{subject.chapters}</div> : null}
                              </div>
                              {hasSubtopics && (
                                <div className={`text-zinc-500 dark:text-gray-500 text-[10px] shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</div>
                              )}
                            </div>
                            {isExpanded && hasSubtopics && (
                              <div className="ml-10 mt-1 flex flex-row flex-wrap gap-1.5">
                                {subject.planTopics.map((topic: any, tIdx: number) => {
                                  const showRange = tIdx === 0 || topic.range !== subject.planTopics[tIdx - 1].range;
                                  return (
                                    <div key={tIdx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 dark:bg-gray-950 border border-zinc-200 dark:border-gray-800 rounded-lg max-w-full">
                                      <div
                                        className="text-zinc-455 dark:text-gray-500 shrink-0 w-10 font-semibold text-xs">
                                        {showRange && topic.range ? `Q${String(topic.range).replace('-', '–')}` : ''}
                                      </div>
                                      <div className="text-zinc-700 dark:text-gray-300 min-w-0 text-xs">
                                        <MathText text={topic.label} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl space-y-4">
                    <h3 className="text-zinc-500 dark:text-gray-400 text-xs">Subject-wise Breakdown</h3>
                    <div className="h-64 overflow-x-auto">
                      <div style={{ minWidth: Math.max(analysisSubjects.length * 40, 400), height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analysisSubjects.map((subject: any, idx: number) => {
                            const stats = analytics.chapterAnalytics?.[String(idx)] || { correct: 0, wrong: 0, total: subjectQuestionCounts[idx] || 0, start: 0, end: 0, subject: '' };
                            const skipped = Math.max(0, stats.total - stats.correct - stats.wrong);
                            return {
                              name: (subject.name || '').length > 10 ? (subject.name || '').substring(0, 10) + '…' : (subject.name || ''),
                              fullName: subject.name || '',
                              chapter: subject.chapters || '',
                              correct: stats.correct,
                              wrong: stats.wrong,
                              skipped: Math.max(0, skipped)
                            };
                          })} barSize={80}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 8 }} tickLine={false} axisLine={false} interval={0} angle={0} textAnchor="middle" height={40} />
                            <YAxis hide />
                            <Tooltip
                              cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                              content={({ active, payload }: any) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-xl p-3 space-y-1 shadow-lg">
                                      <div className="text-[10px] text-zinc-900 dark:text-white font-bold">{d.fullName}</div>
                                      {d.chapter ? <div className="text-[9px] text-zinc-500 dark:text-gray-400">{d.chapter}</div> : null}
                                      <div className="text-[9px] text-green-600 dark:text-green-400 font-semibold">Correct: {d.correct}</div>
                                      <div className="text-[9px] text-red-600 dark:text-red-400 font-semibold">Wrong: {d.wrong}</div>
                                      <div className="text-[9px] text-zinc-600 dark:text-gray-400 font-semibold">Skipped: {d.skipped}</div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="correct" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="wrong" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="skipped" stackId="a" fill="#4b5563" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {!isRestrictedView && (
          loadingQuestions ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl h-32 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ))}
            </div>
          ) : !analytics ? (
            <div
              className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 text-zinc-500 dark:text-gray-400 text-sm">
              Question review is unavailable because this result does not include usable question data.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-900 pb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm">Question-wise Analysis</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 bg-white/50 dark:bg-gray-900/50 rounded-full p-1">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 rounded-full transition-all ${filter === 'all' ? 'bg-blue-500 text-zinc-900 dark:text-white' : 'text-gray-500 hover:text-zinc-500 dark:hover:text-gray-400'
                        } text-xs`}>
                      All ({questions.length})
                    </button>
                    <button
                      onClick={() => setFilter('wrong')}
                      className={`px-3 py-1 rounded-full transition-all ${filter === 'wrong' ? 'bg-red-500 text-zinc-900 dark:text-white' : 'text-gray-500 hover:text-zinc-500 dark:hover:text-gray-400'
                        } text-xs`}>
                      Wrong ({analytics.wrongIds.length})
                    </button>
                    <button
                      onClick={() => setFilter('correct')}
                      className={`px-3 py-1 rounded-full transition-all ${filter === 'correct' ? 'bg-emerald-500 text-zinc-900 dark:text-white' : 'text-gray-500 hover:text-zinc-500 dark:hover:text-gray-400'
                        } text-xs`}>
                      Correct ({analytics.correctIds.length})
                    </button>
                    <button
                      onClick={() => setFilter('skipped')}
                      className={`px-3 py-1 rounded-full transition-all ${filter === 'skipped' ? 'bg-gray-500 text-zinc-900 dark:text-white' : 'text-gray-500 hover:text-zinc-500 dark:hover:text-gray-400'
                        } text-xs`}>
                      Skipped ({questions.length - analytics.correctIds.length - analytics.wrongIds.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5 justify-center">
                {filteredQuestions.map((q) => {
                  const originalIndex = questions.findIndex(qq => qq.id === q.id);
                  const status = analytics.correctIds.includes(q.id) ? 'correct' : (analytics.wrongIds.includes(q.id) ? 'wrong' : 'skipped');
                  const isSelected = selectedQuestion?.id === q.id;
                  const statusColor =
                    status === 'correct' ? 'bg-green-500/10 dark:bg-green-500/20 border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30'
                      : status === 'wrong' ? 'bg-red-500/10 dark:bg-red-500/20 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30'
                        : 'bg-zinc-200/50 dark:bg-gray-800 border-zinc-300 dark:border-gray-700 text-zinc-650 dark:text-gray-400 hover:bg-zinc-300/50 dark:hover:bg-gray-700/80';
                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuestionId(q.id)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center ${statusColor} ${isSelected ? 'ring-2 ring-blue-500 scale-110' : ''
                        } text-xs`}>
                      {originalIndex + 1}
                    </button>
                  );
                })}
              </div>

              {selectedQuestion && (() => {
                const q = selectedQuestion;
                const originalIndex = questions.findIndex(qq => qq.id === q.id);
                const status = analytics.correctIds.includes(q.id) ? 'correct' : (analytics.wrongIds.includes(q.id) ? 'wrong' : 'skipped');
                const timeSpent = analytics.questionTimes[q.id] || 0;
                const userAns = analytics.userAnswers[q.id];
                const currentIdx = filteredQuestions.findIndex(fq => fq.id === q.id);
                const hasPrev = currentIdx > 0;
                const hasNext = currentIdx < filteredQuestions.length - 1;

                return (
                  <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-3xl overflow-hidden">
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${status === 'correct' ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                              : status === 'wrong' ? 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                : 'bg-zinc-200 dark:bg-gray-800 text-zinc-650 dark:text-gray-400'
                              } text-xs`}>
                            {originalIndex + 1}
                          </span>
                          <div className="px-2 py-1 bg-zinc-100 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl">
                            <div className="text-zinc-550 dark:text-gray-450 font-medium text-xs">Time Taken</div>
                            <div className="text-zinc-900 dark:text-white font-bold text-xs">{timeSpent}s</div>
                          </div>
                          <div className="px-2 py-1 bg-zinc-100 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl">
                            <div className="text-zinc-550 dark:text-gray-455 font-medium text-xs">Difficulty</div>
                            <div className="text-zinc-900 dark:text-white font-bold capitalize text-xs">{q.difficulty || 'medium'}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => hasPrev && setSelectedQuestionId(filteredQuestions[currentIdx - 1].id)}
                            disabled={!hasPrev}
                            className="p-2 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:bg-zinc-100 dark:disabled:bg-gray-905 disabled:cursor-not-allowed rounded-lg text-zinc-700 dark:text-gray-300 disabled:text-zinc-400 dark:disabled:text-gray-600 border border-zinc-350 dark:border-gray-700/50 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => hasNext && setSelectedQuestionId(filteredQuestions[currentIdx + 1].id)}
                            disabled={!hasNext}
                            className="p-2 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:bg-zinc-100 dark:disabled:bg-gray-905 disabled:cursor-not-allowed rounded-lg text-zinc-700 dark:text-gray-300 disabled:text-zinc-400 dark:disabled:text-gray-600 border border-zinc-350 dark:border-gray-700/50 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4 rotate-180" />
                          </button>
                        </div>
                      </div>

                      <div
                        className="font-medium leading-relaxed text-zinc-900 dark:text-white text-base">
                        <MathText text={q.text} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div
                            className={`p-3 rounded-2xl border flex items-center justify-between ${status === 'correct' ? 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400'
                              : status === 'wrong' ? 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400'
                                : 'bg-zinc-100 dark:bg-gray-900 border-zinc-200 dark:border-gray-800 text-zinc-500 dark:text-gray-400'
                              } text-xs`}>
                            <div className="flex flex-col gap-1 flex-1">
                              <span className="text-zinc-500 dark:text-gray-455 font-medium text-xs">Your Answer</span>
                              <span className="font-semibold"><MathText text={userAns || 'Not Attempted'} /></span>
                            </div>
                          </div>
                          <div
                            className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-400 text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-zinc-500 dark:text-blue-500/80 font-medium text-xs">Correct Answer</span>
                              <span className="font-semibold"><MathText text={q.correct_answer} /></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-3 mt-1 border-t border-zinc-200/50 dark:border-gray-800/50">
                          <button
                            onClick={() => setTutorQuestion(q)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-[10px] sm:text-xs font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs">
                            <Sparkle className="w-3.5 h-3.5 fill-current" />
                            Ask AI Tutor
                          </button>
                        </div>
                      </div>
                    </div>  </div>
                );
              })()}
            </div>
          )
        )}
      </main>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      {tutorQuestion && (
        <AITutorModal
          isOpen={!!tutorQuestion}
          onClose={() => setTutorQuestion(null)}
          question={tutorQuestion}
          userAnswer={analytics.userAnswers[tutorQuestion.id] || ''}
          userId={userId}
          userProfile={userProfile}
          refreshCredits={refreshCredits}
          showNotification={showNotification}
          originalIndex={questions.findIndex(qq => qq.id === tutorQuestion.id) + 1}
          status={analytics.correctIds.includes(tutorQuestion.id) ? 'correct' : (analytics.wrongIds.includes(tutorQuestion.id) ? 'wrong' : 'skipped')}
        />
      )}
      {showPrintPreview && (
        <PrintQuestion
          isOpen={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          examName={result.examName}
          questions={questions}
          examMeta={examMeta}
        />
      )}
    </div>
  );
}
