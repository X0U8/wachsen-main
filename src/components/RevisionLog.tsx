import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useUserProfile } from '../lib/UserContext';
import MathText from '../ui/MathText';
import { ArrowLeft, BookOpen, AlertCircle, RotateCcw, Loader2, Filter, Check, BarChart3, Brain } from 'lucide-react';
import ConceptCards from './ConceptCards';
import Notification from '../ui/Notification';
import Footer from './Footer';
import { fontSize } from '../lib/utils';
import { idbGet, idbSet } from '../lib/idb';
import { jsonrepair } from 'jsonrepair';
import { streamConceptCards } from '../lib/streamConceptCards';

export const safeParseJSON = (str: string) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    try {
      const repaired = jsonrepair(str);
      return JSON.parse(repaired);
    } catch (repairErr) {

      const sanitized = str.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      try {
        return JSON.parse(sanitized);
      } catch (finalErr) {
        const finalRepaired = jsonrepair(sanitized);
        return JSON.parse(finalRepaired);
      }
    }
  }
};

export const normalizeQuestionType = (type?: string): 'mcq' | 'integer' | 'true_false' | 'laq' => {
  if (!type) return 'mcq';
  const clean = type.toLowerCase().trim();
  if (clean === 'integer' || clean === 'num' || clean === 'numeric') return 'integer';
  if (clean === 'true_false' || clean === 'true/false' || clean === 'true-false' || clean === 'truefalse') return 'true_false';
  if (clean === 'laq' || clean === 'subjective' || clean === 'long') return 'laq';
  return 'mcq';
};

import RevisionLogList from './revision/RevisionLogList';
import RevisionQuestionsList from './revision/RevisionQuestionsList';
import RevisionRetryModal from './revision/RevisionRetryModal';
import SegmentSelectorModal from './revision/SegmentSelectorModal';

interface RevisionLogData {
  questions: Array<{
    id: string;
    text: string;
    correctAnswer: string;
    userAnswer: string | null;
    concept: string;
  }>;
}

const resolveConceptsFromPlan = (questions: any[], planData: any) => {
  const planSubjects = Array.isArray(planData) ? planData : (planData?.subjects || []);

  return questions.map((q: any, qIdx: number) => {
    const qNum = parseInt(q.id) || (typeof q.originalIndex === 'number' ? q.originalIndex : qIdx) + 1;

    let resolvedTopic = '';
    let resolvedSubject = '';

    for (const sub of planSubjects) {
      const segments = sub.planSubject?.segments || sub.segments;
      if (Array.isArray(segments)) {
        for (const segment of segments) {
          if (!segment.range) continue;
          const [start, end] = segment.range.split('-').map(Number);
          if (qNum >= start && qNum <= (end || start)) {
            const subName = sub.subject || sub.name || '';
            const topicsText = Array.isArray(segment.topics)
              ? segment.topics.join(', ')
              : (segment.topics || '');
            
            resolvedSubject = subName;
            resolvedTopic = topicsText;
            break;
          }
        }
      }
      if (resolvedTopic) break;
    }

    let conceptText = '';
    if (resolvedSubject && resolvedTopic) {
      conceptText = `${resolvedSubject}: ${resolvedTopic}`;
    } else if (resolvedTopic) {
      conceptText = resolvedTopic;
    }

    const currentConcept = q.concept || q.chapter || '';
    const isPlaceholder = !currentConcept || 
      /review/i.test(currentConcept) || 
      /subtopic/i.test(currentConcept) || 
      currentConcept === 'N/A';

    if (conceptText && (isPlaceholder || conceptText !== currentConcept)) {
      return { ...q, concept: conceptText };
    }

    return { ...q, concept: currentConcept || 'Review Topic' };
  });
};

export default function RevisionLog() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { userProfile, refreshProfile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logData, setLogData] = useState<RevisionLogData | null>(null);
  const [showConceptCards, setShowConceptCards] = useState(false);
  const [conceptCards, setConceptCards] = useState<any[]>([]);
  const [activeTopics, setActiveTopics] = useState('');
  const [conceptSubject, setConceptSubject] = useState('');
  const [conceptDifficulty, setConceptDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [cardGenProgress, setCardGenProgress] = useState(0);
  const [examCategoryId, setExamCategoryId] = useState<string | null>(null);
  const [academicLevel, setAcademicLevel] = useState<string>('');
  const [examPlan, setExamPlan] = useState<any>(null);
  const [showSegmentSelector, setShowSegmentSelector] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: revisionPage, isLoading: loadingInitialList, error: queryError } = useQuery<{ items: any[]; hasNext: boolean }>({
    queryKey: ['revisionLogs', userProfile?.id, activeSearchQuery, page],
    queryFn: async () => {
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';
      const offset = (page - 1) * PAGE_SIZE;
      const response = await fetch(`/api/search?type=revision&userId=${userProfile?.id}&authToken=${authToken}&query=${encodeURIComponent(activeSearchQuery)}&limit=${PAGE_SIZE + 1}&offset=${offset}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to search revision logs');
      const list = data.revisionList || [];
      return { items: list.slice(0, PAGE_SIZE), hasNext: list.length > PAGE_SIZE };
    },
    enabled: !!userProfile?.id && !examId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const revisionList = revisionPage?.items || [];
  const hasNext = revisionPage?.hasNext || false;




  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [subtopics, setSubtopics] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(5);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryData, setRetryData] = useState<any[]>([]);
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryResults, setRetryResults] = useState<Record<string, { isCorrect: boolean; explanation?: string; marks?: string }>>({});
  const [checkingAI, setCheckingAI] = useState<Record<string, boolean>>({});
  const [currentRetryIndex, setCurrentRetryIndex] = useState(0);
  useEffect(() => {
    if (!generatingCards) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      showNotification('error', 'Generation in progress. Please wait.');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [generatingCards]);

  const handleRetry = () => {
    if (!logData?.questions?.length) return;
    const retryQuestions = logData.questions.map((q: any) => {
      const qType = normalizeQuestionType(q.type || q.questionType);
      return {
        ...q,
        type: qType,
        shuffledOptions: qType === 'mcq' && q.options && q.options.length > 0
          ? [...q.options].sort(() => Math.random() - 0.5)
          : qType === 'true_false'
            ? ['True', 'False']
            : []
      };
    });
    setRetryData(retryQuestions);
    setRetryAnswers({});
    setRetryResults({});
    setCurrentRetryIndex(0);
    setShowRetry(true);
  };

  const handleRetryAnswer = (questionId: string, answer: string) => {
    setRetryAnswers(prev => ({ ...prev, [questionId]: answer }));

    const question = retryData.find((q: any) => q.id === questionId);
    if (!question) return;


    const qType = normalizeQuestionType(question.type || question.questionType);
    if (qType === 'mcq' || qType === 'integer' || qType === 'true_false') {
      const correctAns = question.correctAnswer ?? question.correct_answer;
      const isCorrect = String(correctAns).trim() === String(answer ?? '').trim();
      setRetryResults(prev => ({
        ...prev,
        [questionId]: { isCorrect }
      }));
    }
  };

  const handleAISelfCheck = async (questionId: string, answer: string) => {
    setCheckingAI(prev => ({ ...prev, [questionId]: true }));
    try {
      const question = retryData.find((q: any) => q.id === questionId);
      if (!question) return;

      const response = await fetch('/api/ask-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          correctAnswer: question.correctAnswer,
          userAnswer: answer,
          options: question.options,
          useOwnKey: localStorage.getItem('use_own_key') === 'true',
          apiKey: localStorage.getItem('use_own_key') === 'true' ? localStorage.getItem('mesh_api_key') : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to check answer');

      const isCorrect = data.reply.toLowerCase().includes('correct') && !data.reply.toLowerCase().includes('incorrect');
      setRetryResults(prev => ({
        ...prev,
        [questionId]: { isCorrect, explanation: data.reply }
      }));
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'AI evaluation failed');
    } finally {
      setCheckingAI(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const generateConceptCards = async ({
    subject,
    topics,
    difficulty
  }: {
    subject?: string;
    topics: string;
    difficulty?: 'easy' | 'medium' | 'hard' | 'advance';
  }) => {
    if (generatingCards) return;
    setGeneratingCards(true);
    setCardGenProgress(0);
    try {
      setActiveTopics(topics);
      setConceptSubject(subject || '');
      setConceptDifficulty(difficulty || 'medium');
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const useOwnKey = localStorage.getItem('use_own_key') === 'true';
      const userApiKey = localStorage.getItem(localStorage.getItem('provider') === 'mistral' ? 'mistral_api_key' : 'mesh_api_key') || '';
      const activeProvider = localStorage.getItem('provider') || 'mesh';
      const activeModel = localStorage.getItem('mesh_active_model') || '';

      const level = academicLevel || 'Grade 10';
      const diffLabel = difficulty || 'medium';

      const replyText = await streamConceptCards(
        {
          question: `Subject: ${subject || 'General'}. Topic: ${topics}. Generate exactly 10 theory-based conceptual multiple-choice questions.
VERY IMPORTANT: The target academic difficulty level of the student is: ${level}. The requested difficulty for this deck is: ${diffLabel}.
For "easy", ask simpler theory-based recall questions. For "medium", ask standard conceptual understanding questions. For "hard", ask deeper application and analysis questions. For "advance", generate the absolute hardest theory-based questions possible for this topic and academic level — questions that require deep mastery, complex reasoning, edge cases, and the toughest exam-level understanding.
The questions must be theory-based (definitions, concepts, explanations, principles) rather than pure numerical calculation.
For each question, provide:
1. "question": The conceptual question text.
2. "options": An array of exactly 4 choices.
3. "correctAnswers": An array of the 0-based indices of all correct options (note: multiple options can be correct).

For any math content, variables, formulas, or equations, use ONLY $...$ delimiters (single dollar signs) for inline LaTeX (e.g., $E = mc^2$). NEVER use \( \) or \[ \] delimiters. NEVER double-wrap expressions.
VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting inside the JSON strings, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes so it is valid JSON and parses correctly.

Return ONLY a valid JSON array matching this format:
[{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswers": [0, 2]}]`,
          correctAnswer: '',
          userAnswer: '',
          userId: userProfile?.id,
          authToken,
          apiKey: useOwnKey ? userApiKey : undefined,
          useOwnKey,
          provider: activeProvider,
          model: activeModel,
          deductAmount: 10
        },
        (count) => setCardGenProgress(count)
      );

      const cleanedReply = replyText.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
      const cards = safeParseJSON(cleanedReply);

      setConceptCards(cards);
      setCardGenProgress(10);
      setShowConceptCards(true);
      refreshProfile();
    } catch (err) {
      console.error('Error generating concept cards:', err);
      showNotification('error', 'Failed to generate concept cards');
    } finally {
      setGeneratingCards(false);
      setCardGenProgress(0);
    }
  };

  const generateWrongAnswer = (correctAnswer: string): string => {
    const wrongOptions = [
      "None of the above",
      "The opposite is true",
      "Insufficient parameters provided",
      "Data is inconclusive"
    ];
    return wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  };

  useEffect(() => {
    if (!userProfile?.id || !examId) return;

    const fetchRevisionLog = async () => {
      try {
        setLoading(true);
        setLogData(null);
        setExamQuestions([]);
        setSubtopics([]);
        setResultId(null);
        setExamPlan(null);

        let categoryId = null;
        let acadLevel = '';
        try {
          const { data: examDataDoc } = await supabase
            .from('exams')
            .select('categoryId')
            .eq('id', examId)
            .maybeSingle();
          if (examDataDoc?.categoryId) {
            categoryId = examDataDoc.categoryId;
            const { data: catDataDoc } = await supabase
              .from('examtypes')
              .select('academicLevel')
              .eq('id', categoryId)
              .maybeSingle();
            acadLevel = catDataDoc?.academicLevel || '';
          }
        } catch (dbErr) {
          console.error('Error loading exam category details:', dbErr);
        }
        setExamCategoryId(categoryId);
        setAcademicLevel(acadLevel);

        const cacheKey = `revision_${examId}`;
        const cachedData = await idbGet(cacheKey);

        if (cachedData) {
          try {
            const questionsData = JSON.parse(cachedData.questions);
            const examLogsData = JSON.parse(cachedData.examLogs);
            setExamPlan(examLogsData);

            let loadedResultId = cachedData.resultId;
            if (!loadedResultId) {
              const { data: resultDocs } = await supabase
                .from('results')
                .select('id')
                .eq('examId', examId)
                .eq('userId', userProfile.id)
                .limit(1);
              if (resultDocs && resultDocs.length > 0) {
                loadedResultId = resultDocs[0].id;
                await idbSet(cacheKey, {
                  questions: cachedData.questions,
                  examLogs: cachedData.examLogs,
                  resultId: loadedResultId
                });
              }
            }
            setResultId(loadedResultId || null);

            const mergedQuestions = resolveConceptsFromPlan(questionsData, examLogsData);

            setLogData({ questions: mergedQuestions });
            setExamQuestions(mergedQuestions);


            const topics = mergedQuestions
              .map((q: any) => q.concept?.split(':')[0]?.trim())
              .filter((t: string) => t);
            setSubtopics(topics);


            setCardCount(mergedQuestions.length * 2);
            setLoading(false);
            return;
          } catch (cacheErr) {
            console.error('Cache parse error:', cacheErr);
          }
        }


        const { data: revDocs, error: revError } = await supabase
          .from('revision')
          .select('questions, examLogs')
          .eq('userID', userProfile.id)
          .eq('examID', examId)
          .limit(1);

        if (revError) throw revError;

        if (revDocs && revDocs.length > 0) {
          const doc = revDocs[0];
          const questionsData = JSON.parse(doc.questions as string);
          const examLogsData = JSON.parse(doc.examLogs as string);
          setExamPlan(examLogsData);


          let fetchedResultId = null;
          try {
            const { data: resultDocs } = await supabase
              .from('results')
              .select('id')
              .eq('examId', examId)
              .eq('userId', userProfile.id)
              .limit(1);
            if (resultDocs && resultDocs.length > 0) {
              fetchedResultId = resultDocs[0].id;
              setResultId(fetchedResultId);
            }
          } catch (resErr) {
            console.error('Error fetching associated resultId:', resErr);
          }


          await idbSet(cacheKey, {
            questions: doc.questions,
            examLogs: doc.examLogs,
            resultId: fetchedResultId
          });

          const mergedQuestions = resolveConceptsFromPlan(questionsData, examLogsData);

          setLogData({ questions: mergedQuestions });
          setExamQuestions(mergedQuestions);


          const topics = mergedQuestions
            .map((q: any) => q.concept?.split(':')[0]?.trim())
            .filter((t: string) => t);
          setSubtopics(topics);


          setCardCount(mergedQuestions.length * 2);
        } else {
          setError('No revision log found for this exam');
        }
      } catch (err) {
        console.error('Error fetching revision log:', err);
        setError('Failed to load revision log');
      } finally {
        setLoading(false);
      }
    };

    fetchRevisionLog();
  }, [examId, userProfile?.id]);



  const isPageLoading = examId ? loading : (loadingInitialList && revisionList.length === 0);
  const pageError = examId ? error : (queryError ? (queryError as Error).message : error);

  if (isPageLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 font-sans antialiased select-none">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <p className="mt-2 text-zinc-400 text-xs font-semibold tracking-wider">Loading Revision Log</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 font-sans antialiased select-none">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 w-full max-w-md text-center space-y-4 shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800 dark:text-white">Error Loading Revision Log</h3>
          <p className="text-zinc-500 dark:text-gray-400 text-xs">{pageError}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const headerContent = (
    <header className="sticky top-0 z-40 w-full px-6 py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 flex items-center justify-between transition-colors duration-300">
      {examId ? (
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!generatingCards) {
                navigate(-1);
              }
            }}
            disabled={generatingCards}
            className={`p-1 rounded-xl transition-all border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 ${
              generatingCards ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-150 dark:hover:bg-zinc-900 cursor-pointer'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-zinc-800 dark:text-gray-100 text-base">Revision Log</h1>
        </div>
      ) : (
        <h1 className="font-semibold text-zinc-800 dark:text-gray-100 text-base">Revision Logs</h1>
      )}
    </header>
  );

  if (!examId) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none pb-24">
        {headerContent}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 w-full bg-white dark:bg-gray-900/40 p-2 rounded-xl border border-zinc-200 dark:border-gray-800/80 mb-2">
            <input
              type="text"
              placeholder="Search revision logs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setActiveSearchQuery(searchInput);
                }
              }}
              className="flex-1 bg-transparent border-none text-xs text-zinc-800 dark:text-gray-200 placeholder-zinc-400 focus:outline-none"
            />
            <button
              onClick={() => {
                setPage(1);
                setActiveSearchQuery(searchInput);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Search
            </button>
            {activeSearchQuery && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setPage(1);
                  setActiveSearchQuery('');
                }}
                className="px-2 py-1.5 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-lg text-xs text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <RevisionLogList
            revisionList={revisionList}
            onSelectLog={(examID) => navigate(`/revision/${examID}`)}
          />

          {revisionList.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loadingInitialList}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext || loadingInitialList}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  if (!logData) return null;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none pb-24">
      {headerContent}
      <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-5 space-y-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-2">
          <button
            onClick={() => resultId && navigate(`/results/${resultId}`)}
            disabled={!resultId}
            className="py-2.5 px-2 sm:px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-semibold text-zinc-700 dark:text-zinc-300 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs">
            View Result
          </button>

          <button
            onClick={() => {
              if (examPlan) {
                setShowSegmentSelector(true);
              } else {
                if (subtopics.length > 0) {
                  generateConceptCards({ topics: subtopics.join(', ') });
                } else {
                  showNotification('error', 'No topics available to generate concept cards.');
                }
              }
            }}
            disabled={generatingCards}
            className="py-2.5 px-2 sm:px-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs">
            {generatingCards ? (
              <>
                <Loader2 className="w-3.5 h-3.5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin mr-1 sm:mr-2" />
                Generating...
              </>
            ) : (
              <>
                Concept Cards
              </>
            )}
          </button>

          <button
            onClick={handleRetry}
            className="py-2.5 px-2 sm:px-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all flex items-center justify-center cursor-pointer text-xs">
            Retry Questions
          </button>
        </div>

        <RevisionQuestionsList questions={logData.questions} />
      </main>
      {showConceptCards && (
      <ConceptCards
          onClose={() => setShowConceptCards(false)}
          cards={conceptCards}
          topics={activeTopics}
          deckName={activeTopics}
          subjectName={conceptSubject}
          difficulty={conceptDifficulty}
          userId={userProfile?.id}
          categoryId={examCategoryId || ''}
          academicLevel={academicLevel}
        />
      )}
      {generatingCards && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-[295] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-[280px] text-center space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Generating Cards</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">Please do not go back or exit</p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
            <div className="space-y-2">
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.round((cardGenProgress / 10) * 100)}%` }}
                />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-semibold">
                {cardGenProgress < 10 ? `${cardGenProgress}/10 questions` : 'Finalizing...'}
              </p>
            </div>
          </div>
        </div>
      )}
      <RevisionRetryModal
        isOpen={showRetry}
        onClose={() => setShowRetry(false)}
        retryData={retryData}
        currentRetryIndex={currentRetryIndex}
        setCurrentRetryIndex={setCurrentRetryIndex}
        retryAnswers={retryAnswers}
        setRetryAnswers={setRetryAnswers}
        retryResults={retryResults}
        handleRetryAnswer={handleRetryAnswer}
        handleAISelfCheck={handleAISelfCheck}
        checkingAI={checkingAI}
      />
      {showSegmentSelector && (
        <SegmentSelectorModal
          isOpen={showSegmentSelector}
          onClose={() => setShowSegmentSelector(false)}
          examPlan={examPlan}
          onSelectSegment={(selection) => generateConceptCards(selection)}
        />
      )}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <Footer />
    </div>
  );
}
