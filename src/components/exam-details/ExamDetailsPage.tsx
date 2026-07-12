import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Loader2, RefreshCw, Wrench } from 'lucide-react';
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

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
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


  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamForInfo, setSelectedExamForInfo] = useState<Exam | null>(null);
  const [loadingExams, setLoadingExams] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
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
        .select('*')
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


  const { data: initialExams = [], isLoading: loadingExamsInitial } = useQuery({
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
      return fetchedExams;
    },
    enabled: !!id && !!userProfile?.id,
    staleTime: Infinity,
    refetchOnMount: false,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (initialExams.length > 0 || !loadingExamsInitial) {
      setExams(initialExams);
      setLoadingExams(loadingExamsInitial);
    }
  }, [initialExams, loadingExamsInitial]);

  const hasMoreExams = exams.length >= EXAMS_PER_PAGE && exams.length % EXAMS_PER_PAGE === 0;


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
            <h1 className="font-medium text-zinc-900 dark:text-gray-100" style={{ fontSize: fontSize.base }}>{examType?.name || 'Exam Details'}</h1>
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
          {loadingExamsInitial ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : exams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: fontSize.sm }}>
                <thead className="bg-zinc-100 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 font-semibold tracking-wider" style={{ fontSize: fontSize.sm }}>
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
                        <span className={`px-2 py-0.5 rounded-full font-medium ${exam.status === 'Completed' ? 'bg-green-500/10 text-green-500' :
                          exam.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                            exam.status === 'Expired' ? 'bg-red-500/10 text-red-500' :
                              'bg-yellow-500/10 text-yellow-500'
                          }`} style={{ fontSize: fontSize.xs }}>
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-full font-medium uppercase ${exam.difficulty === 'easy' ? 'bg-blue-500/10 text-blue-500' :
                          exam.difficulty === 'medium' ? 'bg-blue-500/10 text-blue-500' :
                            exam.difficulty === 'hard' ? 'bg-orange-500/10 text-orange-500' :
                              'bg-red-500/10 text-red-500'
                          }`} style={{ fontSize: fontSize.xs }}>
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
              <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.sm }}>No exams found for this type.</p>
              {examType?.name !== 'challenges' && examType?.name !== 'others' && (
                <p className="mt-1 text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>Click the plus icon to create your first exam.</p>
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
            onClick={() => setShowMakeAI(true)}
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



      <EditCategoryModal
        show={showEditCategoryModal}
        form={editCategoryForm}
        maxSubjects={getMaxSubjects()}
        isEditing={isSavingCategory}
        onSave={handleSaveCategory}
        onClose={() => setShowEditCategoryModal(false)}
        onFormChange={(f) => setEditCategoryForm(f)}
      />

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
