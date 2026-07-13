import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Loader2, RefreshCw, Wrench, ClipboardX, Mic, Binary, GraduationCap, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MakeAIForm from '../make-exam/MakeQuestions';
import Notification from '../../ui/Notification';
import { fontSize } from '../../lib/utils';
import localStorageCache from '../../lib/localStorage';
import ExamInfoModal from './ExamInfoModal';
import TemplateModal from './TemplateModal';
import EditCategoryModal from './EditCategoryModal';
import { useTemplateSaving } from '../../hooks/useTemplateSaving';
import ConceptCards from '../ConceptCards';
import CheatCards from '../CheatCards';
import { safeParseJSON } from '../RevisionLog';
import { streamConceptCards } from '../../lib/streamConceptCards';

interface Exam {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  status: 'Completed' | 'Pending' | 'Ongoing' | 'Expired' | 'active';
  difficulty: 'easy' | 'medium' | 'hard' | 'advance';
  examType: string;
  totalQuestions: number;
  totalMarks: number;
  subjects: any[];
  createdAt: string;
  isTemplate?: boolean;
  templateName?: string;
}

export default function ExamDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile, refreshCredits } = useUserProfile();

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [showMakeAI, setShowMakeAI] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const [showTopicInputModal, setShowTopicInputModal] = useState(false);
  const [topicText, setTopicText] = useState('');
  const [activeTopicText, setActiveTopicText] = useState('');
  const [generatingCards, setGeneratingCards] = useState(false);
  const [cardGenProgress, setCardGenProgress] = useState(0);
  const [showConceptCards, setShowConceptCards] = useState(false);
  const [conceptCards, setConceptCards] = useState<any[]>([]);

  const [showCheatCardModal, setShowCheatCardModal] = useState(false);
  const [cheatTopicText, setCheatTopicText] = useState('');
  const [cheatDeckName, setCheatDeckName] = useState('');
  const [generatingCheatCards, setGeneratingCheatCards] = useState(false);
  const [cheatCardProgress, setCheatCardProgress] = useState(0);
  const [showCheatCards, setShowCheatCards] = useState(false);
  const [cheatCards, setCheatCards] = useState<any[]>([]);

  const handleGenerateConceptCards = async () => {
    const trimmedTopic = topicText.trim();
    if (!trimmedTopic) return;
    setGeneratingCards(true);
    setCardGenProgress(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const useOwnKey = localStorage.getItem('use_own_key') === 'true';
      const userApiKey = localStorage.getItem(localStorage.getItem('provider') === 'mistral' ? 'mistral_api_key' : 'mesh_api_key') || '';
      const activeProvider = localStorage.getItem('provider') || 'mesh';
      const activeModel = localStorage.getItem('mesh_active_model') || '';

      const level = examType?.academicLevel || 'Grade 10';

      const replyText = await streamConceptCards(
        {
          question: `Based on these concepts: ${trimmedTopic}. Generate exactly 10 conceptual multiple-choice questions.
VERY IMPORTANT: The target academic difficulty level of the student is: ${level}. You MUST customize the questions complexity to match this academic level.
Additionally, you MUST sequence the 10 questions from easiest (question 1) to hardest (question 10) in progressive difficulty order.
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

      setActiveTopicText(trimmedTopic);
      setCardGenProgress(10);
      setConceptCards(cards);
      setShowConceptCards(true);
      setShowTopicInputModal(false);
      setTopicText('');
      refreshCredits();
    } catch (err: any) {
      console.error('Error generating concept cards:', err);
      showNotification('error', err.message || 'Failed to generate concept cards');
    } finally {
      setGeneratingCards(false);
      setCardGenProgress(0);
    }
  };

  const handleGenerateCheatCards = async () => {
    const trimmedTopic = cheatTopicText.trim();
    const trimmedDeckName = cheatDeckName.trim() || trimmedTopic;
    if (!trimmedTopic) return;

    setGeneratingCheatCards(true);
    setCheatCardProgress(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const useOwnKey = localStorage.getItem('use_own_key') === 'true';
      const userApiKey = localStorage.getItem(localStorage.getItem('provider') === 'mistral' ? 'mistral_api_key' : 'mesh_api_key') || '';
      const activeProvider = localStorage.getItem('provider') || 'mesh';
      const activeModel = localStorage.getItem('mesh_active_model') || '';

      const level = examType?.academicLevel || 'Grade 10';
      const categoryName = examType?.name || '';

      const replyText = await streamConceptCards(
        {
          question: `Topic: ${trimmedTopic}. Generate exactly 20 cheat-card style memorization items.
VERY IMPORTANT: The target academic difficulty level of the student is: ${level}. You MUST customize the complexity to match this level.
Exam category / context: ${categoryName}.
Each item must be short and designed for fast memorization: formulas, definitions, key facts, constants, dates, rules, or exam-oriented points.
Front side ("question") should be a 1-2 line prompt that asks what to recall.
Back side ("answer") should be the concise answer, formula, or fact to memorize.
Return ONLY a valid JSON array in this exact format:
[{"question": "...", "answer": "..."}]

For any math content, variables, formulas, or equations, use ONLY $...$ delimiters (single dollar signs) for inline LaTeX (e.g., $E = mc^2$). NEVER use \( \) or \[ \] delimiters. NEVER double-wrap expressions.
VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting inside the JSON strings, you MUST use double backslashes (e.g., \\frac, \\theta, \\vec, \\alpha) instead of single backslashes so it is valid JSON and parses correctly.`,
          correctAnswer: '',
          userAnswer: '',
          userId: userProfile?.id,
          authToken,
          apiKey: useOwnKey ? userApiKey : undefined,
          useOwnKey,
          provider: activeProvider,
          model: activeModel,
          deductAmount: 20
        },
        (count) => setCheatCardProgress(count),
        20
      );

      const cleanedReply = replyText.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
      const cards = safeParseJSON(cleanedReply);

      setCheatCards(cards);
      setCheatDeckName(trimmedDeckName);
      setShowCheatCards(true);
      setShowCheatCardModal(false);
      setCheatTopicText('');
      refreshCredits();
    } catch (err: any) {
      console.error('Error generating cheat cards:', err);
      showNotification('error', err.message || 'Failed to generate cheat cards');
    } finally {
      setGeneratingCheatCards(false);
      setCheatCardProgress(0);
    }
  };

  const {
    showTemplateModal, templateNameInput, isSavingTemplate, templateMessage, isEditingTemplate,
    templateCount, maxTemplates, setTemplateNameInput,
    openTemplateModal, saveTemplate, closeTemplateModal,
  } = useTemplateSaving(userProfile?.id, userProfile?.PremiumType);

  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [examType, setExamType] = useState<any>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({
    examName: '',
    subjectInput: '',
    subjects: [] as string[],
    academicLevel: '',
    subjectError: ''
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const getMaxSubjects = () => {
    const premiumType = (userProfile as any)?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 10;
    if (premiumType.toLowerCase().includes('rise')) return 8;
    if (premiumType.toLowerCase().includes('lite')) return 5;
    return 3;
  };
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);


  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  const cacheKey = `cached_exams_${id}_${userProfile?.id}_${statusFilter}_${sortOrder}_${activeSearchQuery}`;
  const [exams, setExams] = useState<Exam[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) || '[]');
    } catch {
      return [];
    }
  });
  const [selectedExamForInfo, setSelectedExamForInfo] = useState<Exam | null>(null);
  const [loadingExams, setLoadingExams] = useState(false);
  const [hasMoreExams, setHasMoreExams] = useState(false);
  const EXAMS_PER_PAGE = 10;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const formatSimpleDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} (${hours}:${minutes})`;
  };

  const queryClient = useQueryClient();


  const { data: fetchedExamType } = useQuery({
    queryKey: ['examType', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('examtypes')
        .select('id, name, subjects, academicLevel, Percentages')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: Infinity,
    refetchOnMount: false,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (!fetchedExamType) return;
    setExamType(fetchedExamType);
    if (fetchedExamType.subjects && Array.isArray(fetchedExamType.subjects) && fetchedExamType.subjects.length > 0) {
      setAvailableSubjects(fetchedExamType.subjects.map((sub: any, index: number) => ({
        id: sub.id || `sub${index}`,
        name: sub.name || sub,
        academicLevel: fetchedExamType.academicLevel || 'Grade 10'
      })));
    } else {
      setAvailableSubjects([]);
    }
  }, [fetchedExamType]);


  const { data: initialExams, isLoading: loadingExamsInitial } = useQuery({
    queryKey: ['examInstances', id, userProfile?.id, statusFilter, sortOrder, activeSearchQuery],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';

      const response = await fetch(`/api/search?type=exams&userId=${userProfile.id}&authToken=${authToken}&categoryId=${id}&statusFilter=${statusFilter}&sortOrder=${sortOrder}&query=${encodeURIComponent(activeSearchQuery)}&limit=${EXAMS_PER_PAGE}&offset=0`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to search exams');

      const documents = data.exams || [];
      const fetchedExams: Exam[] = documents.map((doc: any) => ({
        id: doc.id,
        name: doc.examName || 'Untitled Exam',
        startDateTime: doc.startDateTime || new Date().toISOString(),
        endDateTime: doc.endDateTime || '',
        status: doc.status || 'Pending',
        difficulty: doc.difficulty || 'medium',
        examType: doc.examType || '',
        totalQuestions: doc.totalQuestions || 0,
        totalMarks: doc.totalMarks || 0,
        subjects: doc.subjects ? (typeof doc.subjects === 'string' ? JSON.parse(doc.subjects) : doc.subjects) : [],
        createdAt: doc.created_at || new Date().toISOString(),
        isTemplate: doc.isTemplate || false,
        templateName: doc.templateName || ''
      }));
      if (id && userProfile?.id) {
        localStorage.setItem(`cached_exams_${id}_${userProfile.id}_${statusFilter}_${sortOrder}_${activeSearchQuery}`, JSON.stringify(fetchedExams));
      }
      return fetchedExams;
    },
    enabled: !!id && !!userProfile?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (id && userProfile?.id) {
      try {
        const cached = JSON.parse(localStorage.getItem(`cached_exams_${id}_${userProfile.id}_${statusFilter}_${sortOrder}_${activeSearchQuery}`) || '[]');
        setExams(cached);
      } catch {
        setExams([]);
      }
    } else {
      setExams([]);
    }
  }, [id, userProfile?.id, statusFilter, sortOrder, activeSearchQuery]);

  useEffect(() => {
    if (initialExams !== undefined) {
      setExams(initialExams);
      setHasMoreExams(initialExams.length === EXAMS_PER_PAGE);
    }
    setLoadingExams(loadingExamsInitial);
  }, [initialExams, loadingExamsInitial]);


  const fetchExams = async (reset: boolean = false) => {
    if (!id || !userProfile) return;

    if (reset) {
      queryClient.invalidateQueries({ queryKey: ['examInstances', id, userProfile.id, statusFilter, sortOrder, activeSearchQuery] });
      return;
    }

    setLoadingExams(true);
    try {
      const offset = exams.length;
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';

      const response = await fetch(`/api/search?type=exams&userId=${userProfile.id}&authToken=${authToken}&categoryId=${id}&statusFilter=${statusFilter}&sortOrder=${sortOrder}&query=${encodeURIComponent(activeSearchQuery)}&limit=${EXAMS_PER_PAGE}&offset=${offset}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch more exams');

      const documents = data.exams || [];

      const fetchedExams: Exam[] = documents.map((doc: any) => ({
        id: doc.id,
        name: doc.examName || 'Untitled Exam',
        startDateTime: doc.startDateTime || new Date().toISOString(),
        endDateTime: doc.endDateTime || '',
        status: doc.status || 'Pending',
        difficulty: doc.difficulty || 'medium',
        examType: doc.examType || '',
        totalQuestions: doc.totalQuestions || 0,
        totalMarks: doc.totalMarks || 0,
        subjects: doc.subjects ? (typeof doc.subjects === 'string' ? JSON.parse(doc.subjects) : doc.subjects) : [],
        createdAt: doc.created_at || new Date().toISOString(),
        isTemplate: doc.isTemplate || false,
        templateName: doc.templateName || ''
      }));
      if (fetchedExams.length < EXAMS_PER_PAGE) {
        setHasMoreExams(false);
      } else {
        setHasMoreExams(true);
      }
      setExams(prev => [...prev, ...fetchedExams]);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    if (!hasMoreExams || loadingExams) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchExams(false);
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
  }, [hasMoreExams, loadingExams, exams.length]);

  const handleLoadMore = () => {
    fetchExams(false);
  };

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExamForInfo(exam);
  };







  const handleOpenEditCategoryModal = () => {
    if (!examType) return;
    setEditCategoryForm({
      examName: examType.name || '',
      subjectInput: '',
      subjects: examType.subjects || [],
      academicLevel: examType.academicLevel || '',
      subjectError: ''
    });
    setShowEditCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!examType || !id) return;
    const name = editCategoryForm.examName.trim();
    if (!name) return;
    if (editCategoryForm.subjects.length === 0) {
      setEditCategoryForm(f => ({ ...f, subjectError: 'Add at least one subject' }));
      return;
    }

    setIsSavingCategory(true);
    try {
      const { error } = await supabase
        .from('examtypes')
        .update({
          name,
          subjects: editCategoryForm.subjects,
          academicLevel: editCategoryForm.academicLevel,
        })
        .eq('id', id);
      if (error) throw error;


      setExamType(prev => ({
        ...prev,
        name,
        subjects: editCategoryForm.subjects,
        academicLevel: editCategoryForm.academicLevel,
      }));


      const cachedExamTypes = localStorageCache.get<any[]>(localStorageCache.keys.EXAM_CATEGORIES) || [];
      const updatedCache = cachedExamTypes.map(exam =>
        exam.id === id ? { ...exam, name, subjects: editCategoryForm.subjects, academicLevel: editCategoryForm.academicLevel } : exam
      );
      localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, updatedCache);

      setShowEditCategoryModal(false);
      queryClient.invalidateQueries({ queryKey: ['examCategories', userProfile?.$id] });
    } catch (error) {
      console.error('Error updating category:', error);
      showNotification('error', 'Failed to update category. Please try again.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100 font-sans antialiased select-none relative">
      <header className="p-2 flex items-center justify-between border-b border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-black/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/exam')}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-900 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-medium text-zinc-900 dark:text-gray-100 text-base">{examType?.name || 'Exam Details'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-900 rounded-full transition-colors"
            title="Refresh page"
          >
            <RefreshCw className="w-4 h-4 text-zinc-500 dark:text-gray-400" />
          </button>
          {examType?.name !== 'challenges' && examType?.name !== 'others' && (
            <button onClick={handleOpenEditCategoryModal}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-900 rounded-full transition-colors"
              title="Update Category">
              <Wrench className="w-4 h-4 text-zinc-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 p-4 pb-32">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-black/15 dark:border-white/20 overflow-hidden dark:shadow-[0_0_35px_rgba(255,255,255,0.06)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-gray-800 bg-zinc-50/50 dark:bg-gray-950/30">
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-100 dark:bg-gray-950 border border-black/15 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-gray-300 font-medium text-xs focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all">
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Expired">Expired</option>
              </select>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                className="bg-zinc-100 dark:bg-gray-950 border border-black/15 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-gray-300 font-medium text-xs focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all">
                <option value="desc">Newest</option>
                <option value="asc">Oldest</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 max-w-xs w-full">
              <input
                type="text"
                placeholder="Search exams..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveSearchQuery(searchInput);
                  }
                }}
                className="flex-1 bg-zinc-100 dark:bg-gray-950 border border-black/15 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-gray-200 placeholder-zinc-400 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all"
              />
              <button
                onClick={() => setActiveSearchQuery(searchInput)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                Search
              </button>
              {activeSearchQuery && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setActiveSearchQuery('');
                  }}
                  className="px-2 py-1.5 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-lg text-xs text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {loadingExamsInitial && exams.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : exams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead
                  className="bg-zinc-100 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 font-semibold tracking-wider text-sm">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">End</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Difficulty</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
                  {exams.map((exam) => (
                    <tr
                      key={exam.id}
                      onClick={() => handleSelectExam(exam)}
                      className="hover:bg-zinc-100 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-4 font-normal text-zinc-800 dark:text-gray-100 group-hover:text-blue-400 transition-colors">
                        {exam.name}
                      </td>
                      <td className="px-4 py-4 text-zinc-500 dark:text-gray-400">
                        {exam.startDateTime?.toLowerCase() === 'anytime' ? 'Anytime' : formatSimpleDate(exam.startDateTime)}
                      </td>
                      <td className="px-4 py-4 text-zinc-500 dark:text-gray-400">
                        {exam.endDateTime?.toLowerCase() === 'anytime' || !exam.endDateTime ? 'Anytime' : formatSimpleDate(exam.endDateTime)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${exam.status === 'Completed' ? 'bg-green-500/10 text-green-500' :
                            exam.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                              exam.status === 'Expired' ? 'bg-red-500/10 text-red-500' :
                                'bg-yellow-500/10 text-yellow-500'
                            } text-xs`}>
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium uppercase ${exam.difficulty === 'easy' ? 'bg-blue-500/10 text-blue-500' :
                            exam.difficulty === 'medium' ? 'bg-blue-500/10 text-blue-500' :
                              exam.difficulty === 'hard' ? 'bg-orange-500/10 text-orange-500' :
                                'bg-red-500/10 text-red-500'
                            } text-xs`}>
                          {exam.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-zinc-500 dark:text-gray-400 text-sm">No exams found for this type.</p>
              {examType?.name !== 'challenges' && examType?.name !== 'others' && (
                <p className="mt-1 text-zinc-400 dark:text-gray-500 text-xs">Click the plus icon to create your first exam.</p>
              )}
            </div>
          )}
        </div>

        {exams.length > 0 && hasMoreExams && (
          <div ref={sentinelRef} className="flex justify-center items-center gap-2 mt-6 py-4 text-zinc-400 dark:text-zinc-550">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Loading more exams...</span>
          </div>
        )}
      </main>
      {examType?.name !== 'challenges' && examType?.name !== 'others' && (
        <div className="fixed bottom-10 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowTypeSelector(true)}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 pointer-events-auto"
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </motion.button>
        </div>
      )}
      <ExamInfoModal
        exam={selectedExamForInfo}
        onClose={() => setSelectedExamForInfo(null)}
        formatSimpleDate={formatSimpleDate}
      />
      <TemplateModal
        show={showTemplateModal}
        isEditing={isEditingTemplate}
        templateName={templateNameInput}
        message={templateMessage}
        isSaving={isSavingTemplate}
        onNameChange={setTemplateNameInput}
        onSave={() => selectedExamForInfo && saveTemplate(selectedExamForInfo.id, () => { setSelectedExamForInfo(null); })}
        onClose={closeTemplateModal}
        templateCount={templateCount}
        maxTemplates={maxTemplates}
      />
      {showMakeAI && (
        <MakeAIForm
          show={showMakeAI}
          onClose={() => setShowMakeAI(false)}
          mode={'auto'}
          userProfile={userProfile}
          categoryId={id || ''}
          availableSubjects={availableSubjects}
        />
      )}
      {showTypeSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-xl shadow-2xl relative overflow-hidden text-zinc-900 dark:text-white max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-900">
              <div>
                <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-sm sm:text-base">Select Learning Mode</h3>
              </div>
              <button
                onClick={() => setShowTypeSelector(false)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 overflow-y-auto">
              <button
                onClick={() => {
                  setShowTypeSelector(false);
                  setShowMakeAI(true);
                }}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-center "
              >
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl mb-2.5">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 fill-current/20" />
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">AI Question</h4>
                <p className="hidden sm:block text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  Generate customized exams with questions parsed from topics or document attachments.
                </p>
              </button>

              <button
                onClick={() => {
                  setShowTypeSelector(false);
                  setShowTopicInputModal(true);
                }}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-center "
              >
                <div className="relative flex flex-col items-center mb-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                    <ClipboardX className="w-4 h-4 sm:w-5 sm:h-5 fill-current/20" />
                  </div>
                  <span className="absolute -top-2 -right-8 text-[8px] font-bold text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded">Soon</span>
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Concept Cards</h4>
                <p className="hidden sm:block text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  Generate flip card decks for active recall practice on subtopics and key definitions.
                </p>
              </button>

              <button
                onClick={() => {
                  setNotification({ message: 'Oral Viva mock interview mode coming soon!', type: 'info' });
                }}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-center "
              >
                <div className="relative flex flex-col items-center mb-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5 fill-current/20" />
                  </div>
                  <span className="absolute -top-2 -right-8 text-[8px] font-bold text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded">Soon</span>
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Oral Viva</h4>
                <p className="hidden sm:block text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  Practice oral tests with interactive AI questions to master verbal explanation.
                </p>
              </button>

              <button
                onClick={() => {
                  setShowTypeSelector(false);
                  setShowCheatCardModal(true);
                }}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-center "
              >
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl mb-2.5">
                  <Binary className="w-4 h-4 sm:w-5 sm:h-5 fill-current/20" />
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Cheat Cards</h4>
                <p className="hidden sm:block text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  Generate flip memorization cards for formulas, facts, and key points.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
      <EditCategoryModal
        show={showEditCategoryModal}
        form={editCategoryForm}
        maxSubjects={getMaxSubjects()}
        isEditing={isSavingCategory}
        onSave={handleSaveCategory}
        onClose={() => setShowEditCategoryModal(false)}
        onFormChange={(f) => setEditCategoryForm(f)}
      />
      {showTopicInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-zinc-900 dark:text-white flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-900">
              <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-base">Generate Concept Cards</h3>
              <button
                onClick={() => { setShowTopicInputModal(false); setTopicText(''); }}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-zinc-550 dark:text-zinc-400 text-xs leading-relaxed text-left">
              Enter the topic or subtopics .
            </p>

            <div className="space-y-1.5 text-left">
              <textarea
                rows={3}
                maxLength={200}
                placeholder="Enter topic "
                value={topicText}
                onChange={(e) => setTopicText(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs resize-none leading-relaxed"
              />
              <div className="flex justify-end text-[10px] text-zinc-400 font-medium">
                {topicText.length} / 200
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowTopicInputModal(false); setTopicText(''); }}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateConceptCards}
                disabled={generatingCards || !topicText.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 justify-center cursor-pointer shadow-md shadow-blue-500/10"
              >
                {generatingCards ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate (10 credits)'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {generatingCards && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Generating Cards</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">Do not close or navigate away</p>
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
      {showConceptCards && (
        <ConceptCards
          onClose={() => setShowConceptCards(false)}
          cards={conceptCards}
          topics={activeTopicText}
          userId={userProfile?.id}
          categoryId={id || ''}
          academicLevel={examType?.academicLevel || ''}
        />
      )}

      {showCheatCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-zinc-900 dark:text-white flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-900">
              <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-base">Generate Cheat Cards</h3>
              <button
                onClick={() => { setShowCheatCardModal(false); setCheatTopicText(''); setCheatDeckName(''); }}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-zinc-550 dark:text-zinc-400 text-xs leading-relaxed text-left">
              Enter the deck name and the topic you want to memorize.
            </p>

            <div className="space-y-3 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Deck Name</label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="e.g. Organic Chemistry Formulas"
                  value={cheatDeckName}
                  onChange={(e) => setCheatDeckName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Topic</label>
                <textarea
                  rows={3}
                  maxLength={200}
                  placeholder="Enter topic or subtopics"
                  value={cheatTopicText}
                  onChange={(e) => setCheatTopicText(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs resize-none leading-relaxed"
                />
                <div className="flex justify-end text-[10px] text-zinc-400 font-medium">
                  {cheatTopicText.length} / 200
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowCheatCardModal(false); setCheatTopicText(''); setCheatDeckName(''); }}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCheatCards}
                disabled={generatingCheatCards || !cheatTopicText.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 justify-center cursor-pointer shadow-md shadow-blue-500/10"
              >
                {generatingCheatCards ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate (20 credits)'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {generatingCheatCards && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Generating Cheat Cards</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">Do not close or navigate away</p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
            <div className="space-y-2">
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.round((cheatCardProgress / 20) * 100)}%` }}
                />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-semibold">
                {cheatCardProgress < 20 ? `${cheatCardProgress}/20 cards` : 'Finalizing...'}
              </p>
            </div>
          </div>
        </div>
      )}
      {showCheatCards && (
        <CheatCards
          onClose={() => setShowCheatCards(false)}
          cards={cheatCards}
          topics={cheatDeckName}
          deckName={cheatDeckName}
          userId={userProfile?.id}
          categoryId={id || ''}
          academicLevel={examType?.academicLevel || ''}
        />
      )}

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
