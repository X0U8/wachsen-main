import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export const safeParseJSON = (str: string) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    try {
      const repaired = jsonrepair(str);
      return JSON.parse(repaired);
    } catch (repairErr) {
      // Fix unescaped backslashes that aren't valid JSON escape sequences
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
    if (q.chapter || q.concept) return { ...q, concept: q.chapter || q.concept };

    const targetSubject = planSubjects?.find((sub: any) =>
      sub.name?.toLowerCase() === q.subject?.toLowerCase() ||
      sub.subject?.toLowerCase() === q.subject?.toLowerCase()
    );

    const segments = targetSubject?.planSubject?.segments || targetSubject?.segments;

    let resolvedTopic = '';
    if (Array.isArray(segments)) {
      const qNum = (typeof q.originalIndex === 'number' ? q.originalIndex : qIdx) + 1;
      for (const segment of segments) {
        if (!segment.range) continue;
        const [start, end] = segment.range.split('-').map(Number);
        if (qNum >= start && qNum <= (end || start)) {
          if (Array.isArray(segment.topics)) {
            resolvedTopic = segment.topics.join(', ');
          } else {
            resolvedTopic = segment.topics || '';
          }
          break;
        }
      }
    }

    return {
      ...q,
      concept: resolvedTopic || 'Review Topic'
    };
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
  const [examPlan, setExamPlan] = useState<any>(null);
  const [showSegmentSelector, setShowSegmentSelector] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [revisionList, setRevisionList] = useState<any[]>([]);
  const [extraRevisionLogs, setExtraRevisionLogs] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // Fetch exam types for filtering
  useEffect(() => {
    if (!userProfile?.id) return;
    const fetchExamTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('examtypes')
          .select('id, name')
          .eq('userId', userProfile.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setExamTypes(data || []);
      } catch (err) {
        console.error('Error fetching exam types:', err);
      }
    };
    fetchExamTypes();
  }, [userProfile?.id]);

  // Fetch matching exam IDs when category changes


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

    // For MCQ, integer, true_false: instant feedback
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

  const generateConceptCards = async (selectedTopics: string) => {
    if (generatingCards) return;
    setGeneratingCards(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const useOwnKey = localStorage.getItem('use_own_key') === 'true';
      const userApiKey = localStorage.getItem(localStorage.getItem('provider') === 'mistral' ? 'mistral_api_key' : 'mesh_api_key') || '';
      const activeProvider = localStorage.getItem('provider') || 'mesh';
      const activeModel = localStorage.getItem('mesh_active_model') || '';

      const response = await fetch('/api/ask-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Based on these concepts: ${selectedTopics}. Generate exactly 10 conceptual multiple-choice questions. For each question, provide:
1. "question": The conceptual question text.
2. "options": An array of exactly 4 choices.
3. "correctAnswers": An array of the 0-based indices of all correct options (note: multiple options can be correct).
4. "explanation": A concise explanation of the correct answers.

Return ONLY a valid JSON array matching this format:
[{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswers": [0, 2], "explanation": "..."}]`,
          correctAnswer: '',
          userAnswer: '',
          userId: userProfile?.id,
          authToken,
          apiKey: useOwnKey ? userApiKey : undefined,
          useOwnKey,
          provider: activeProvider,
          model: activeModel
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate flashcards');

      let replyText = data.reply || '[]';
      replyText = replyText.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
      const cards = safeParseJSON(replyText);

      setConceptCards(cards);
      setShowConceptCards(true);
      if (data.creditsDeducted > 0) {
        refreshProfile();
      }
    } catch (err) {
      console.error('Error generating concept cards:', err);
      showNotification('error', 'Failed to generate concept cards');
    } finally {
      setGeneratingCards(false);
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
    if (!userProfile?.id) return;

    if (!examId) {
      const fetchAllRevisionLogs = async () => {
        try {
          setLoading(true);
          setExtraRevisionLogs([]);
          const sessionData = await supabase.auth.getSession();
          const authToken = sessionData.data.session?.access_token || '';

          const response = await fetch(`/api/search?type=revision&userId=${userProfile.id}&authToken=${authToken}&selectedExamTypeId=${selectedExamTypeId || ''}&query=${encodeURIComponent(activeSearchQuery)}&limit=10&offset=0`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to search revision logs');

          setRevisionList(data.revisionList || []);
        } catch (err) {
          console.error('Error fetching revision list:', err);
          setError('Failed to load revision list');
        } finally {
          setLoading(false);
        }
      };
      fetchAllRevisionLogs();
      return;
    }

    const fetchRevisionLog = async () => {
      try {
        setLoading(true);
        setLogData(null);
        setExamQuestions([]);
        setSubtopics([]);
        setResultId(null);
        setExamPlan(null);

        // Check IndexedDB cache first
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

            // Extract subtopics from concepts
            const topics = mergedQuestions
              .map((q: any) => q.concept?.split(':')[0]?.trim())
              .filter((t: string) => t);
            setSubtopics(topics);

            // Calculate card count
            setCardCount(mergedQuestions.length * 2);
            setLoading(false);
            return;
          } catch (cacheErr) {
            console.error('Cache parse error:', cacheErr);
          }
        }

        // Fetch from database if cache fails
        const { data: revDocs, error: revError } = await supabase
          .from('revision')
          .select('*')
          .eq('userID', userProfile.id)
          .eq('examID', examId)
          .limit(1);

        if (revError) throw revError;

        if (revDocs && revDocs.length > 0) {
          const doc = revDocs[0];
          const questionsData = JSON.parse(doc.questions as string);
          const examLogsData = JSON.parse(doc.examLogs as string);
          setExamPlan(examLogsData);

          // Fetch the matching resultId corresponding to this examId
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

          // Save to IndexedDB
          await idbSet(cacheKey, {
            questions: doc.questions,
            examLogs: doc.examLogs,
            resultId: fetchedResultId
          });

          const mergedQuestions = resolveConceptsFromPlan(questionsData, examLogsData);

          setLogData({ questions: mergedQuestions });
          setExamQuestions(mergedQuestions);

          // Extract subtopics from concepts
          const topics = mergedQuestions
            .map((q: any) => q.concept?.split(':')[0]?.trim())
            .filter((t: string) => t);
          setSubtopics(topics);

          // Calculate card count
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

  const displayList = [...revisionList, ...extraRevisionLogs];

  const hasMore = revisionList.length === 10 || (extraRevisionLogs.length > 0 && extraRevisionLogs.length % 10 === 0);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !userProfile?.id) return;
    setLoadingMore(true);
    try {
      const offset = revisionList.length + extraRevisionLogs.length;
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';

      const response = await fetch(`/api/search?type=revision&userId=${userProfile.id}&authToken=${authToken}&selectedExamTypeId=${selectedExamTypeId || ''}&query=${encodeURIComponent(activeSearchQuery)}&limit=10&offset=${offset}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load more revision logs');

      const dataRevisionList = data.revisionList || [];
      if (dataRevisionList.length > 0) {
        setExtraRevisionLogs(prev => [...prev, ...dataRevisionList]);
      }
    } catch (err) {
      console.error('Error loading more revision logs:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!hasMore || loadingMore || examId) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { rootMargin: '200px' });

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, loadingMore, displayList.length, examId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 font-sans antialiased select-none">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <p className="mt-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">Loading Revision Log</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 font-sans antialiased select-none">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 w-full max-w-md text-center space-y-4 shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800 dark:text-white">Error Loading Revision Log</h3>
          <p className="text-zinc-500 dark:text-gray-400 text-xs">{error}</p>
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
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-zinc-150 dark:hover:bg-zinc-900 rounded-xl transition-all border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.base }}>Revision Log</h1>
        </div>
      ) : (
        <>
          <h1 className="font-semibold text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.base }}>Revision Logs</h1>
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 cursor-pointer flex items-center gap-1"
            >
              <Filter className="w-4 h-4" />
            </button>

            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 px-3 py-1.5 uppercase tracking-wider">
                    Filter by Exam Type
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedExamTypeId(null);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${!selectedExamTypeId
                          ? 'bg-blue-500/10 text-blue-600 dark:text-white font-semibold'
                          : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                        }`}
                    >
                      <span>All Exam Types</span>
                      {!selectedExamTypeId && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {examTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedExamTypeId(type.id);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${selectedExamTypeId === type.id
                            ? 'bg-blue-500/10 text-blue-600 dark:text-white font-semibold'
                            : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                          }`}
                      >
                        <span className="truncate">{type.name}</span>
                        {selectedExamTypeId === type.id && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );

  if (!examId) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none pb-24">
        {headerContent}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-5 flex flex-col gap-3">
          {/* Search Bar */}
          <div className="flex items-center gap-1.5 w-full bg-white dark:bg-gray-900/40 p-2 rounded-xl border border-zinc-200 dark:border-gray-800/80 mb-2">
            <input
              type="text"
              placeholder="Search revision logs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setExtraRevisionLogs([]);
                  setActiveSearchQuery(searchInput);
                }
              }}
              className="flex-1 bg-transparent border-none text-xs text-zinc-800 dark:text-gray-200 placeholder-zinc-400 focus:outline-none"
            />
            <button
              onClick={() => {
                setExtraRevisionLogs([]);
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
                  setExtraRevisionLogs([]);
                  setActiveSearchQuery('');
                }}
                className="px-2 py-1.5 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-lg text-xs text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <RevisionLogList
            revisionList={displayList}
            onSelectLog={(examID) => navigate(`/revision/${examID}`)}
          />
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
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
        {/* Revision Options Row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-2">
          {/* View Result */}
          <button
            onClick={() => resultId && navigate(`/results/${resultId}`)}
            disabled={!resultId}
            className="py-2.5 px-2 sm:px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60 border border-zinc-250 dark:border-zinc-800 rounded-2xl text-[10px] sm:text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View Result
          </button>

          {/* Generate Concept Cards */}
          <button
            onClick={() => {
              console.log('Concept Cards clicked. examPlan:', examPlan);
              if (examPlan) {
                setShowSegmentSelector(true);
              } else {
                console.log('No exam plan found. Falling back to direct generation from subtopics:', subtopics);
                if (subtopics.length > 0) {
                  generateConceptCards(subtopics.join(', '));
                } else {
                  showNotification('error', 'No topics available to generate concept cards.');
                }
              }
            }}
            disabled={generatingCards}
            className="py-2.5 px-2 sm:px-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl text-[10px] sm:text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
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

          {/* Retry Questions */}
          <button
            onClick={handleRetry}
            className="py-2.5 px-2 sm:px-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl text-[10px] sm:text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all flex items-center justify-center cursor-pointer"
          >
            Retry Questions
          </button>
        </div>

        <RevisionQuestionsList questions={logData.questions} />
      </main>

      {showConceptCards && <ConceptCards onClose={() => setShowConceptCards(false)} cards={conceptCards} />}
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
          onSelectSegment={(topics) => generateConceptCards(topics)}
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
