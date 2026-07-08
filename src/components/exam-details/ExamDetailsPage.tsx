import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsIcon } from '../../icons/SettingsIcon';
import MakeAIForm from '../make-exam/MakeAIPage';
import Notification from '../../ui/Notification';
import { fontSize } from '../../lib/utils';
import localStorageCache from '../../lib/localStorage';
import ExamInfoModal from './ExamInfoModal';
import TemplateModal from './TemplateModal';
import EditCategoryModal from './EditCategoryModal';

interface Exam {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  status: 'Completed' | 'Pending' | 'Ongoing' | 'Expired';
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
  const settingsRef = useRef<any>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [showMakeAI, setShowMakeAI] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateCount, setTemplateCount] = useState(0);
  const [loadingTemplateCount, setLoadingTemplateCount] = useState(true);
  const [examType, setExamType] = useState<any>(null);

  // Edit category form state
  const [editCategoryForm, setEditCategoryForm] = useState({
    examName: '',
    subjectInput: '',
    subjects: [] as string[],
    academicLevel: '',
    subjectError: ''
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const MAX_SUBJECTS = 10;
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);

  // State for exams - initialized as empty
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamForInfo, setSelectedExamForInfo] = useState<Exam | null>(null);
  const [loadingExams, setLoadingExams] = useState(false);
  const EXAMS_PER_PAGE = 10;

  const getMaxTemplates = () => {
    const premiumType = userProfile?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 30;
    if (premiumType.toLowerCase().includes('rise')) return 20;
    if (premiumType.toLowerCase().includes('lite')) return 10;
    return 5;
  };

  const fetchTemplateCount = async () => {
    if (!userProfile?.id) return;
    try {
      const { count, error } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true })
        .eq('createdBy', userProfile.id)
        .eq('isTemplate', true);
      if (!error && count !== null) setTemplateCount(count);
    } catch { } finally {
      setLoadingTemplateCount(false);
    }
  };

  useEffect(() => { fetchTemplateCount(); }, [userProfile?.id]);

  const formatSimpleDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} (${hours}:${minutes})`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      settingsRef.current?.startAnimation?.();
      setTimeout(() => {
        settingsRef.current?.stopAnimation?.();
      }, 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const queryClient = useQueryClient();

  // Load exam type details with React Query
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

  // Fetch initial exams with React Query
  const { data: initialExams = [], isLoading: loadingExamsInitial } = useQuery({
    queryKey: ['examInstances', id, userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('categoryId', id!)
        .contains('accessIds', [userProfile.id])
        .order('created_at', { ascending: false })
        .range(0, EXAMS_PER_PAGE - 1);

      if (error) throw error;
      const documents = data || [];
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

  // Fetch more exams (pagination)
  const fetchExams = async (reset: boolean = false) => {
    if (!id || !userProfile) return;

    if (reset) {
      queryClient.invalidateQueries({ queryKey: ['examInstances', id, userProfile.id] });
      return;
    }

    setLoadingExams(true);
    try {
      const offset = exams.length;
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('categoryId', id)
        .contains('accessIds', [userProfile.id])
        .order('created_at', { ascending: false })
        .range(offset, offset + EXAMS_PER_PAGE - 1);

      if (error) throw error;
      const documents = data || [];

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

  const handleLoadMore = () => {
    fetchExams(false);
  };

  const handleSelectExam = async (exam: Exam) => {
    // Check if expired
    if (exam.status !== 'Completed' && exam.status !== 'Expired' &&
      exam.endDateTime && exam.endDateTime !== 'anytime' &&
      new Date(exam.endDateTime) < new Date()) {

      try {
        // Update in Supabase
        const { error } = await supabase
          .from('exams')
          .update({ status: 'Expired' })
          .eq('id', exam.id);
        if (error) throw error;

        // Update locally
        const updatedExam = { ...exam, status: 'Expired' as const };
        setExams(prev => prev.map(e => e.id === exam.id ? updatedExam : e));
        setSelectedExamForInfo(updatedExam);
        return;
      } catch (err) {
        console.error('Error auto-expiring exam:', err);
      }
    }

    setSelectedExamForInfo(exam);
  };







  // Handle opening template modal
  const handleOpenTemplateModal = () => {
    if (!selectedExamForInfo) return;
    const isTemplate = selectedExamForInfo.isTemplate || false;
    setIsEditingTemplate(isTemplate);
    setTemplateNameInput(isTemplate ? (selectedExamForInfo.templateName || '') : '');
    setTemplateMessage(null);
    fetchTemplateCount();
    setShowTemplateModal(true);
  };

  // Handle saving exam as template
  const handleSaveTemplate = async () => {
    if (!userProfile?.id || !selectedExamForInfo) return;

    setIsSavingTemplate(true);
    setTemplateMessage(null);
    try {
      // Only check template limit when creating new template, not editing
      if (!isEditingTemplate) {
        const { count, error: countError } = await supabase
          .from('exams')
          .select('*', { count: 'exact', head: true })
          .eq('createdBy', userProfile.id)
          .eq('isTemplate', true);

        if (countError) throw countError;

        if (count !== null && count >= getMaxTemplates()) {
          setTemplateMessage({ type: 'error', text: `Template limit reached (${getMaxTemplates()}). Please delete an existing template first.` });
          return;
        }
      }

      // Update exam document with isTemplate and templateName
      const { error: updateError } = await supabase
        .from('exams')
        .update({
          isTemplate: true,
          templateName: templateNameInput.trim()
        })
        .eq('id', selectedExamForInfo.id);

      if (updateError) throw updateError;

      setTemplateMessage({ type: 'success', text: 'Template saved successfully!' });

      // Close modals and reset state after delay
      setTimeout(() => {
        setShowTemplateModal(false);
        setSelectedExamForInfo(null);
        setTemplateNameInput('');
        setTemplateMessage(null);
        fetchExams(true);
      }, 1500);
    } catch (error) {
      console.error('Error saving template:', error);
      setTemplateMessage({ type: 'error', text: 'Failed to save template. Please try again.' });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };
    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsDropdown]);

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

    // Check if name is different from current
    if (name === examType.name &&
      JSON.stringify(editCategoryForm.subjects) === JSON.stringify(examType.subjects) &&
      editCategoryForm.academicLevel === examType.academicLevel) {
      setShowEditCategoryModal(false);
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

      // Update local state
      setExamType(prev => ({
        ...prev,
        name,
        subjects: editCategoryForm.subjects,
        academicLevel: editCategoryForm.academicLevel,
      }));

      // Update cache with modified exam type
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
      {/* Header */}
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
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-900 rounded-full transition-colors"
            >
              <SettingsIcon ref={settingsRef} size={18} />
            </button>
            <AnimatePresence>
              {showSettingsDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-12 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-2xl p-2 min-w-[200px] shadow-xl z-50"
                >
                  <div className="border-t border-zinc-200 dark:border-gray-800 my-1" />
                  <button
                    onClick={() => {
                      setShowSettingsDropdown(false);
                      handleOpenEditCategoryModal();
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-gray-800 rounded-xl text-zinc-600 dark:text-gray-400 font-medium transition-colors"
                    style={{ fontSize: fontSize.sm }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update Category
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Table Section */}
      <main className="flex-1 p-4 pb-32">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-zinc-200 dark:border-gray-800 overflow-hidden">
          {loadingExamsInitial ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : exams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontSize: fontSize.sm }}>
                <thead className="bg-zinc-100 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 uppercase font-medium tracking-wider" style={{ fontSize: '0.625rem' }}>
                  <tr>
                    <th className="px-4 py-3">Exam Name</th>
                    <th className="px-4 py-3">Starting Time</th>
                    <th className="px-4 py-3">Ending Time</th>
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
                          }`} style={{ fontSize: '0.625rem' }}>
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-full font-medium uppercase ${exam.difficulty === 'easy' ? 'bg-blue-500/10 text-blue-500' :
                          exam.difficulty === 'medium' ? 'bg-blue-500/10 text-blue-500' :
                            exam.difficulty === 'hard' ? 'bg-orange-500/10 text-orange-500' :
                              'bg-red-500/10 text-red-500'
                          }`} style={{ fontSize: '0.625rem' }}>
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
              <p className="mt-1 text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>Click the plus icon to create your first exam.</p>
            </div>
          )}
        </div>

        {/* Load More Button */}
        {exams.length > 0 && hasMoreExams && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={loadingExams}
              className="px-6 py-2.5 bg-white dark:bg-gray-900 hover:bg-zinc-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-200 dark:border-gray-800 rounded-xl font-medium transition-all flex items-center gap-2 text-zinc-700 dark:text-gray-300"
              style={{ fontSize: fontSize.sm }}
            >
              {loadingExams ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </main>

      {/* Floating Plus Button - Bottom Center */}
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

      <ExamInfoModal
        exam={selectedExamForInfo}
        onClose={() => setSelectedExamForInfo(null)}
        onOpenTemplate={handleOpenTemplateModal}
        formatSimpleDate={formatSimpleDate}
        templateCount={templateCount}
        maxTemplates={getMaxTemplates()}
      />

      <TemplateModal
        show={showTemplateModal}
        isEditing={isEditingTemplate}
        templateName={templateNameInput}
        message={templateMessage}
        isSaving={isSavingTemplate}
        onNameChange={(v) => { setTemplateNameInput(v); setTemplateMessage(null); }}
        onSave={handleSaveTemplate}
        onClose={() => { setShowTemplateModal(false); setTemplateNameInput(''); setTemplateMessage(null); setIsEditingTemplate(false); }}
        templateCount={templateCount}
        maxTemplates={getMaxTemplates()}
      />

      {/* Make AI Form Component */}
      <AnimatePresence>
        {showMakeAI && (
          <MakeAIForm
            show={showMakeAI}
            onClose={() => setShowMakeAI(false)}
            mode={'auto'}
            userProfile={userProfile}
            categoryId={id || ''}
            availableSubjects={availableSubjects}
            refreshCredits={refreshCredits}
          />
        )}
      </AnimatePresence>



      <EditCategoryModal
        show={showEditCategoryModal}
        form={editCategoryForm}
        maxSubjects={MAX_SUBJECTS}
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
