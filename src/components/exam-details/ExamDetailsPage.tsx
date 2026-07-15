import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Loader2, RefreshCw, Wrench, ClipboardX, Mic, Binary, GraduationCap, X, SquarePen } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MakeAIForm from '../make-exam/MakeQuestions';
import Notification from '../../ui/Notification';
import localStorageCache from '../../lib/localStorage';
import EditCategoryModal from './EditCategoryModal';
import ConceptCards from '../ConceptCards';
import CheatCards from '../CheatCards';
import ExamListTab from './ExamListTab';
import LaqListTab from './LaqListTab';
import ConceptCardsListTab from './ConceptCardsListTab';
import CheatCardsListTab from './CheatCardsListTab';
import MakeLaq from '../laq/MakeLaq';
import { safeParseJSON } from '../RevisionLog';
import { streamConceptCards } from '../../lib/streamConceptCards';
import { NON_INT_SUBJECTS } from '../../data/nonIntSubjects';

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
  const [conceptSubject, setConceptSubject] = useState('');
  const [conceptDifficulty, setConceptDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [generatingCards, setGeneratingCards] = useState(false);
  const [cardGenProgress, setCardGenProgress] = useState(0);
  const [showConceptCards, setShowConceptCards] = useState(false);
  const [conceptCards, setConceptCards] = useState<any[]>([]);

  const [showCheatCardModal, setShowCheatCardModal] = useState(false);
  const [cheatTopicText, setCheatTopicText] = useState('');
  const [cheatSubject, setCheatSubject] = useState('');
  const [cheatDifficulty, setCheatDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [generatingCheatCards, setGeneratingCheatCards] = useState(false);
  const [cheatCardProgress, setCheatCardProgress] = useState(0);
  const [showCheatCards, setShowCheatCards] = useState(false);
  const [cheatCards, setCheatCards] = useState<any[]>([]);
  const [isConceptSaved, setIsConceptSaved] = useState(false);
  const [isCheatSaved, setIsCheatSaved] = useState(false);

  const [showMakeLaq, setShowMakeLaq] = useState(false);

  const handleGenerateConceptCards = async () => {
    const trimmedTopic = topicText.trim();
    const trimmedSubject = conceptSubject.trim();
    if (!trimmedSubject) {
      showNotification('error', 'Please select or enter a subject.');
      return;
    }
    if (!trimmedTopic) {
      showNotification('error', 'Please enter a topic.');
      return;
    }
    if (trimmedTopic.length < 5) {
      showNotification('error', 'Topic must be at least 5 characters.');
      return;
    }
    if (!conceptDifficulty) {
      showNotification('error', 'Please select a difficulty.');
      return;
    }
    const creditsNeeded = 10;
    if ((userProfile?.credits || 0) < creditsNeeded) {
      showNotification('error', `Insufficient credits. You need ${creditsNeeded} credits.`);
      return;
    }

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
      const diffLabel = conceptDifficulty;

      const replyText = await streamConceptCards(
        {
          question: `Subject: ${trimmedSubject || 'General'}. Topic: ${trimmedTopic}. Generate exactly 10 theory-based conceptual multiple-choice questions.
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

      setActiveTopicText(trimmedTopic);
      setCardGenProgress(10);
      setConceptCards(cards);
      setIsConceptSaved(false);
      setShowConceptCards(true);
      setShowTopicInputModal(false);
      setTopicText('');
      refreshCredits();
    } catch (err: any) {
      console.error('Error generating concept cards:', err);
      const errMsg = err?.message || '';
      const displayMsg = errMsg.toLowerCase().includes('credits')
        ? 'Insufficient credits. Please try again tomorrow or use your own API Key (BYOK).'
        : (errMsg || 'Failed to generate concept cards');
      showNotification('error', displayMsg);
    } finally {
      setGeneratingCards(false);
      setCardGenProgress(0);
    }
  };

  const handleGenerateCheatCards = async () => {
    const trimmedTopic = cheatTopicText.trim();
    const trimmedSubject = cheatSubject.trim();
    if (!trimmedSubject) {
      showNotification('error', 'Please select or enter a subject.');
      return;
    }
    if (!trimmedTopic) {
      showNotification('error', 'Please enter a topic.');
      return;
    }
    if (trimmedTopic.length < 5) {
      showNotification('error', 'Topic must be at least 5 characters.');
      return;
    }
    if (!cheatDifficulty) {
      showNotification('error', 'Please select a difficulty.');
      return;
    }
    const creditsNeeded = 10;
    if ((userProfile?.credits || 0) < creditsNeeded) {
      showNotification('error', `Insufficient credits. You need ${creditsNeeded} credits.`);
      return;
    }

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
      const isNonInt = NON_INT_SUBJECTS.has(trimmedSubject.toLowerCase());
      const diffLabel = cheatDifficulty;

      const contentInstruction = isNonInt
        ? `Generate memorization-focused cheat cards for this ${trimmedSubject} topic. Focus on exam-important facts, must-memorize points, key dates, definitions, rules, and commonly asked theory questions. The cards should help the student recall the most important stuff from this topic for exams.`
        : `Generate memorization-focused cheat cards for this ${trimmedSubject} topic. Focus mainly on formulas, equations, constants, variables, relationships, and any exam-asked facts or values that must be memorized. Include the formula/equation and what it represents.`;

      const replyText = await streamConceptCards(
        {
          question: `Subject: ${trimmedSubject}. Topic: ${trimmedTopic}. Generate exactly 20 cheat-card style memorization items.
VERY IMPORTANT: The target academic difficulty level of the student is: ${level}. The requested difficulty for this deck is: ${diffLabel}.
Exam category / context: ${categoryName}.
${contentInstruction}
For "easy", use simple recall items. For "medium", standard memorization items. For "hard", deeper or more detailed recall. For "advance", generate the absolute hardest memorization items possible for this topic and academic level — the most exam-critical, complex, and demanding facts/formulas the student must master.
Each item must be short and designed for fast memorization.
Front side ("question") should be a 1-2 line prompt that asks what to recall.
Back side ("answer") should be the concise answer, formula, or fact to memorize.
Return ONLY a valid JSON array in this exact format:
[{"question": "...", "answer": "..."}]

For any math content, variables, formulas, or equations, use ONLY $...$ delimiters (single dollar signs) for inline LaTeX (e.g., $E = mc^2$). NEVER use \( \) or \[ \] delimiters. NEVER double-wrap expressions.
VERY IMPORTANT: For all LaTeX math commands, symbols, and formatting inside the JSON strings, you MUST use double backslashes (e.g., \\\\frac, \\\\theta, \\\\vec, \\\\alpha) instead of single backslashes so it is valid JSON and parses correctly.`,
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
        (count) => setCheatCardProgress(count),
        20
      );

      const cleanedReply = replyText.replace(/```json\\s*/gi, '').replace(/```\\s*$/gm, '').trim();
      const cards = safeParseJSON(cleanedReply);

      setCheatCards(cards);
      setIsCheatSaved(false);
      setShowCheatCards(true);
      setShowCheatCardModal(false);
      refreshCredits();
    } catch (err: any) {
      console.error('Error generating cheat cards:', err);
      const errMsg = err?.message || '';
      const displayMsg = errMsg.toLowerCase().includes('credits')
        ? 'Insufficient credits. Please try again tomorrow or use your own API Key (BYOK).'
        : (errMsg || 'Failed to generate cheat cards');
      showNotification('error', displayMsg);
    } finally {
      setGeneratingCheatCards(false);
      setCheatCardProgress(0);
    }
  };

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


  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'exams' | 'laq' | 'concept' | 'cheat'>('exams');

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

  // Count pending exams for this category to enforce 100-exam spam limit
  const { data: pendingExamCount = 0 } = useQuery({
    queryKey: ['pendingExamCount', id, userProfile?.id],
    queryFn: async () => {
      if (!id || !userProfile?.id) return 0;
      const { count, error } = await supabase
        .from('exams')
        .select('id', { count: 'exact', head: true })
        .eq('categoryId', id)
        .eq('status', 'pending')
        .contains('accessIds', [userProfile.id]);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!id && !!userProfile?.id,
    staleTime: 0,
    gcTime: Infinity,
  });

  // Count pending LAQ exams for this category
  const { data: pendingLaqCount = 0 } = useQuery({
    queryKey: ['pendingLaqCount', id, userProfile?.id],
    queryFn: async () => {
      if (!id || !userProfile?.id) return 0;
      const { count, error } = await supabase
        .from('laq_exam')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id)
        .eq('user_id', userProfile.id)
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!id && !!userProfile?.id,
    staleTime: 0,
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
        <div className="flex shrink-0 pb-3">
          <div className="flex w-full bg-zinc-100 dark:bg-gray-900/80 rounded-xl p-1 gap-1">
            {([
              { key: 'exams', label: 'Exams' },
              { key: 'laq', label: 'LAQ Exams' },
              { key: 'concept', label: 'Concept Cards' },
              { key: 'cheat', label: 'Recall Cards' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 font-semibold tracking-wider rounded-lg transition-all duration-200 cursor-pointer text-xs ${activeTab === tab.key
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-black/15 dark:border-white/20 overflow-hidden dark:shadow-[0_0_35px_rgba(255,255,255,0.06)]">
          {activeTab === 'exams' && (
            <ExamListTab categoryId={id || ''} userProfile={userProfile} canCreate={examType?.name !== 'challenges' && examType?.name !== 'others'} />
          )}
          {activeTab === 'laq' && (
            <LaqListTab categoryId={id || ''} userProfile={userProfile} />
          )}
          {activeTab === 'concept' && (
            <ConceptCardsListTab
              categoryId={id || ''}
              userProfile={userProfile}
              onSelect={async (deck) => {
                const { data } = await supabase
                  .from('saved_concept_cards')
                  .select('questions')
                  .eq('id', deck.id)
                  .single();
                setConceptCards(data?.questions || []);
                setConceptSubject(deck.subject_name || '');
                setConceptDifficulty((deck.difficulty as any) || 'medium');
                setActiveTopicText(deck.topics || '');
                setIsConceptSaved(true);
                setShowConceptCards(true);
              }}
            />
          )}
          {activeTab === 'cheat' && (
            <CheatCardsListTab
              categoryId={id || ''}
              userProfile={userProfile}
              onSelect={async (deck) => {
                const { data } = await supabase
                  .from('saved_cheat_cards')
                  .select('cards')
                  .eq('id', deck.id)
                  .single();
                setCheatCards(data?.cards || []);
                setCheatSubject(deck.subject_name || '');
                setCheatDifficulty((deck.difficulty as any) || 'medium');
                setCheatTopicText(deck.topics || '');
                setIsCheatSaved(true);
                setShowCheatCards(true);
              }}
            />
          )}
        </div>
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
      {showMakeAI && (
        <MakeAIForm
          show={showMakeAI}
          onClose={() => {
            setShowMakeAI(false);
            queryClient.invalidateQueries({ queryKey: ['pendingExamCount', id, userProfile?.id] });
            queryClient.invalidateQueries({ queryKey: ['examInstances', id] });
          }}
          mode={'auto'}
          userProfile={userProfile}
          categoryId={id || ''}
          availableSubjects={availableSubjects}
        />
      )}
      {showMakeLaq && (
        <MakeLaq
          show={showMakeLaq}
          onClose={() => setShowMakeLaq(false)}
          userProfile={userProfile}
          categoryId={id || ''}
          availableSubjects={availableSubjects}
          examType={examType}
          onCreated={() => {
            setShowMakeLaq(false);
            queryClient.invalidateQueries({ queryKey: ['laqExams'] });
            queryClient.invalidateQueries({ queryKey: ['pendingLaqCount', id, userProfile?.id] });
          }}
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
                  if ((pendingExamCount as number) >= 100) {
                    setShowTypeSelector(false);
                    showNotification('error', 'You already have 100+ pending exams in this category that you haven\'t taken yet.');
                    return;
                  }
                  setShowTypeSelector(false);
                  setShowMakeAI(true);
                }}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-center "
              >
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl mb-2.5">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 fill-current/20" />
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Exam</h4>
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
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Concept Cards</h4>
                <p className="hidden sm:block text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  Generate flip card decks for active recall practice on subtopics and key definitions.
                </p>
              </button>

              <button
                onClick={() => {
                  if ((pendingLaqCount as number) >= 100) {
                    setShowTypeSelector(false);
                    showNotification('error', 'You already have 100+ pending LAQ exams in this category that you haven\'t taken yet.');
                    return;
                  }
                  setShowTypeSelector(false);
                  setShowMakeLaq(true);
                }}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-center "
              >
                <div className="relative flex flex-col items-center mb-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                    <SquarePen className="w-4 h-4 sm:w-5 sm:h-5 fill-current/20" />
                  </div>
                </div>
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">LAQ Exam</h4>
                <p className="hidden sm:block text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                  Timed written-response questions with AI evaluation on accuracy, depth, and clarity.
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
                <h4 className="font-semibold text-zinc-850 dark:text-zinc-200 text-xs sm:text-sm group-hover:text-blue-500 transition-colors">Recall Cards</h4>
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
              Pick the subject, difficulty, and topic for theory-based practice.
            </p>

            <div className="space-y-3 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Subject</label>
                {availableSubjects.length > 0 ? (
                  <select
                    value={conceptSubject}
                    onChange={(e) => setConceptSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                  >
                    <option value="">Select a subject</option>
                    {availableSubjects.map((sub: any) => (
                      <option key={sub.id || sub.name} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Enter subject"
                    value={conceptSubject}
                    onChange={(e) => setConceptSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Difficulty</label>
                <select
                  value={conceptDifficulty}
                  onChange={(e) => setConceptDifficulty(e.target.value as typeof conceptDifficulty)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="advance">Advance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Topic</label>
                <textarea
                  rows={3}
                  maxLength={200}
                  placeholder="Enter topic or subtopics"
                  value={topicText}
                  onChange={(e) => setTopicText(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs resize-none leading-relaxed"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                  <span>{topicText.length < 5 ? 'Topic must be at least 5 characters' : ''}</span>
                  <span>{topicText.length} / 200</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowTopicInputModal(false); setTopicText(''); setConceptSubject(''); setConceptDifficulty('medium'); }}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateConceptCards}
                disabled={generatingCards || !topicText.trim() || topicText.trim().length < 5 || !conceptSubject.trim()}
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
          deckName={activeTopicText}
          subjectName={conceptSubject}
          difficulty={conceptDifficulty}
          userId={userProfile?.id}
          categoryId={id || ''}
          academicLevel={examType?.academicLevel || ''}
          isAlreadySaved={isConceptSaved}
        />
      )}

      {showCheatCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-zinc-900 dark:text-white flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-900">
              <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-base">Generate Recall Cards</h3>
              <button
                onClick={() => { setShowCheatCardModal(false); setCheatTopicText(''); setCheatSubject(''); setCheatDifficulty('medium'); }}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-zinc-550 dark:text-zinc-400 text-xs leading-relaxed text-left">
              Pick the subject, difficulty, and topic to memorize.
            </p>

            <div className="space-y-3 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Subject</label>
                {availableSubjects.length > 0 ? (
                  <select
                    value={cheatSubject}
                    onChange={(e) => setCheatSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                  >
                    <option value="">Select a subject</option>
                    {availableSubjects.map((sub: any) => (
                      <option key={sub.id || sub.name} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Enter subject"
                    value={cheatSubject}
                    onChange={(e) => setCheatSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Difficulty</label>
                <select
                  value={cheatDifficulty}
                  onChange={(e) => setCheatDifficulty(e.target.value as typeof cheatDifficulty)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="advance">Advance</option>
                </select>
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
                <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                  <span>{cheatTopicText.length < 5 ? 'Topic must be at least 5 characters' : ''}</span>
                  <span>{cheatTopicText.length} / 200</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowCheatCardModal(false); setCheatTopicText(''); setCheatSubject(''); setCheatDifficulty('medium'); }}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCheatCards}
                disabled={generatingCheatCards || !cheatTopicText.trim() || cheatTopicText.trim().length < 5 || !cheatSubject.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 justify-center cursor-pointer shadow-md shadow-blue-500/10"
              >
                {generatingCheatCards ? (
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
      {generatingCheatCards && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Generating Recall Cards</h3>
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
          topics={cheatTopicText}
          subjectName={cheatSubject}
          difficulty={cheatDifficulty}
          userId={userProfile?.id}
          categoryId={id || ''}
          academicLevel={examType?.academicLevel || ''}
          isAlreadySaved={isCheatSaved}
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
