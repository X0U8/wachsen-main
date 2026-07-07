import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer.tsx';
import SpotlightCard from '../ui/SpotlightCard';
import TextType from '../ui/TextType';
import PlanIcon from '../ui/PlanIcon';
import BuyCreditsModal from '../ui/BuyCreditsModal';
import { Plus, X, Loader2, Lock, Settings } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserProfile } from '../lib/UserContext.tsx';
import localStorageCache from '../lib/localStorage';
import { fontSize } from '../lib/utils';
import InfoComponent from '../ui/InfoComponent';
import NewExamTypeForm from './exam/NewExamTypeForm';
import UpcomingTable from './exam/UpcomingTable';
import SubscriptionModal from './exam/SubscriptionModal';

type Tab = 'exams' | 'upcoming';

interface ExamType {
  id: string;
  name: string;
  subjects: string[];
  academicLevel: string;
}

export default function Exam() {
  const navigate = useNavigate();
  const { userProfile, refreshCredits, refreshProfile } = useUserProfile();
  const [tab, setTab] = useState<Tab>('exams');
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const hasInitializedExamTypes = useRef(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [disabledItemName, setDisabledItemName] = useState('');
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const hasInitializedUpcoming = useRef(false);
  const EXAMS_PER_PAGE = 10;
  const MAX_EXAM_NAME_LENGTH = 60;
  const lastSaveTime = useRef(0);
  const [localProfile, setLocalProfile] = useState<any | null>(() => {
    return localStorageCache.get<any>(localStorageCache.keys.USER_PROFILE);
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const getMaxExamTypes = () => {
    const profile = localProfile || userProfile;
    const premiumType = (profile as any)?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 20;
    if (premiumType.toLowerCase().includes('rise')) return 15;
    if (premiumType.toLowerCase().includes('lite')) return 10;
    return 5;
  };

  const getMaxSubjects = () => {
    const profile = localProfile || userProfile;
    const premiumType = (profile as any)?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 10;
    if (premiumType.toLowerCase().includes('rise')) return 8;
    if (premiumType.toLowerCase().includes('lite')) return 5;
    return 3;
  };

  useEffect(() => {
    if (userProfile?.$id) {
      setUserId(userProfile.$id);
    }
  }, [userProfile]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const greeting = `${getGreeting()}`;

  useEffect(() => {
    const textLength = greeting.length;
    const typingDuration = textLength * 200;
    const timer = setTimeout(() => setShowIcon(true), typingDuration + 100);
    return () => clearTimeout(timer);
  }, [greeting]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const queryClient = useQueryClient();

  const { data: fetchedExamTypes = [] } = useQuery({
    queryKey: ['examCategories', userId],
    queryFn: async () => {
      const cachedExamTypes = localStorageCache.get<ExamType[]>(localStorageCache.keys.EXAM_CATEGORIES);
      if (cachedExamTypes && cachedExamTypes.length > 0) return cachedExamTypes;

      const { data, error } = await supabase
        .from('examtypes')
        .select('*')
        .eq('userId', userId!)
        .order('created_at', { ascending: true })
        .limit(10);
      if (error) throw error;
      const examTypes = (data || []).map(d => ({
        id: d.id, name: d.name, subjects: d.subjects || [], academicLevel: d.academicLevel || '',
      }));
      localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, examTypes);
      return examTypes;
    },
    enabled: !!userId,
    staleTime: Infinity, refetchOnMount: false, gcTime: Infinity,
  });

  useEffect(() => {
    if (fetchedExamTypes.length > 0 && !hasInitializedExamTypes.current) {
      hasInitializedExamTypes.current = true;
      setExamTypes(fetchedExamTypes);
    }
  }, [fetchedExamTypes]);

  const { data: initialUpcoming = [], isLoading: loadingUpcomingInitial } = useQuery({
    queryKey: ['upcomingExams', userId],
    queryFn: async () => {
      let documents;
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .contains('accessIds', [userId!])
          .order('created_at', { ascending: false })
          .range(0, EXAMS_PER_PAGE - 1);
        if (error) throw error;
        documents = data || [];
      } catch { documents = []; }
      return documents
        .map((doc: any) => ({
          id: doc.id, name: doc.examName || 'Untitled Exam',
          startDateTime: doc.startDateTime || '', status: doc.status || 'active',
          difficulty: doc.difficulty || 'medium', categoryId: doc.categoryId
        }))
        .filter((exam: any) => exam.status === 'active');
    },
    enabled: !!userId,
    staleTime: Infinity, refetchOnMount: false, gcTime: Infinity,
  });

  useEffect(() => {
    if ((initialUpcoming.length > 0 || !loadingUpcomingInitial) && !hasInitializedUpcoming.current) {
      hasInitializedUpcoming.current = true;
      setUpcomingExams(initialUpcoming);
      setLoadingUpcoming(loadingUpcomingInitial);
    }
  }, [initialUpcoming, loadingUpcomingInitial]);

  const hasMoreUpcoming = upcomingExams.length >= EXAMS_PER_PAGE && upcomingExams.length % EXAMS_PER_PAGE === 0;
  const upcomingOffset = upcomingExams.length;

  const fetchMoreUpcoming = async () => {
    if (!userId) return;
    setLoadingUpcoming(true);
    try {
      let documents;
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .contains('accessIds', [userId])
          .order('created_at', { ascending: false })
          .range(upcomingOffset, upcomingOffset + EXAMS_PER_PAGE - 1);
        if (error) throw error;
        documents = data || [];
      } catch { documents = []; }
      const fetched = documents
        .map((doc: any) => ({
          id: doc.id, name: doc.examName || 'Untitled Exam',
          startDateTime: doc.startDateTime || '', status: doc.status || 'active',
          difficulty: doc.difficulty || 'medium', categoryId: doc.categoryId
        }))
        .filter((exam: any) => exam.status === 'active');
      setUpcomingExams(prev => [...prev, ...fetched]);
    } catch (err) {
      console.error('Error fetching upcoming exams:', err);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  const handleDoubleClick = () => {
    if (showForm) return;
    if (examTypes.length >= getMaxExamTypes()) return;
    setShowForm(true);
  };

  const handleSaveForm = async (data: { name: string; subjects: string[]; academicLevel: string }) => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastSaveTime.current < 2000) {
      setNotification({ message: 'Please wait before creating another exam type', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const { data: doc, error } = await supabase
        .from('examtypes')
        .insert({ userId, name: data.name, subjects: data.subjects, academicLevel: data.academicLevel })
        .select('*')
        .single();

      if (error) throw error;

      const newExamType = { id: doc.id, name: doc.name, subjects: doc.subjects || [], academicLevel: doc.academicLevel || '' };
      setExamTypes(prev => [...prev, newExamType]);

      const cached = localStorageCache.get<ExamType[]>(localStorageCache.keys.EXAM_CATEGORIES) || [];
      localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, [...cached, newExamType]);

      queryClient.invalidateQueries({ queryKey: ['examCategories', userId] });
      setShowForm(false);
      lastSaveTime.current = now;
    } catch (err: any) {
      console.error(err);
      setNotification({ message: err.message || 'Failed to create exam type', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const slotsLeft = getMaxExamTypes() - examTypes.length;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100 font-sans antialiased select-none">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-900/80 flex items-center justify-between transition-colors duration-300">
        <div>
          <h1 className="flex items-center gap-2 font-semibold tracking-tight text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.lg }}>
            <TextType text={greeting} typingSpeed={200} pauseDuration={2000} showCursor={false} loop={false} />
            {showIcon && userProfile?.PremiumType && userProfile.PremiumType !== 'Free' && (
              <PlanIcon planName={userProfile.PremiumType} />
            )}
          </h1>
          <p className="text-zinc-450 dark:text-gray-550 mt-1" style={{ fontSize: fontSize.sm }}>{today}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-150/50 dark:bg-gray-900/50 border border-zinc-250 dark:border-gray-800 rounded-xl px-2.5 sm:px-3 py-1.5 text-zinc-600 dark:text-gray-400" style={{ fontSize: fontSize.sm }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <strong className="text-zinc-850 dark:text-gray-100 font-semibold">{userProfile?.credits || 0}</strong>
            <span className="hidden sm:inline">credits</span>
            <button onClick={() => setShowBuyCredits(true)} className="text-zinc-450 dark:text-gray-550 hover:text-blue-500 dark:hover:text-blue-400 font-semibold pl-1 sm:pl-1.5 transition-colors cursor-pointer" aria-label="Add credits">+</button>
          </div>
          <button onClick={() => navigate('/settings')} className="p-1.5 rounded-lg bg-zinc-105 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer" aria-label="Settings">
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex shrink-0 px-3 sm:px-4 pt-3 pb-2 bg-white dark:bg-black">
        <div className="flex w-full bg-zinc-100 dark:bg-gray-900/80 rounded-xl p-1 gap-1">
          {(['exams', 'upcoming'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${tab === t
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-gray-300'
                }`}
              style={{ fontSize: fontSize.xs }}
            >
              {t === 'exams' ? 'Exams' : 'Upcoming'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-5 pb-28">
        {tab === 'exams' && (
          <>
            {examTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center gap-2">
                <p className="text-gray-600 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.sm }}>Tap + to add an exam type</p>
                <p className="text-gray-700 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>{slotsLeft} slots remaining</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4 px-1">
                  <p className="font-medium text-gray-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} remaining</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {examTypes.map((exam, i) => {
                    const isDisabled = i >= getMaxExamTypes();
                    return (
                      <SpotlightCard
                        key={exam.id}
                        onClick={() => isDisabled ? (setDisabledItemName(exam.name), setShowUpgradeModal(true)) : navigate(`/exam-details/${exam.id}`)}
                        spotlightColor={isDisabled ? undefined : "rgba(37, 99, 235, 0.12)"}
                        className={`exam-card bg-white dark:bg-gray-900/40 rounded-xl border transition-all duration-300 ${isDisabled ? 'border-zinc-200 dark:border-gray-800/60 opacity-40 cursor-not-allowed' : 'border-zinc-200 dark:border-gray-800/80 hover:border-zinc-300 dark:hover:border-gray-700 cursor-pointer'}`}
                        style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
                      >
                        <div className="p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-zinc-800 dark:text-gray-100 font-medium truncate" style={{ fontSize: fontSize.sm }}>{exam.name}</p>
                            {isDisabled && <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-gray-600 shrink-0 mt-0.5" />}
                          </div>
                          {exam.academicLevel && (
                            <p className="text-zinc-500 dark:text-gray-400 mt-1 font-medium" style={{ fontSize: fontSize.xs }}>{exam.academicLevel}</p>
                          )}
                          {exam.subjects.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {exam.subjects.slice(0, 3).map((s, si) => (
                                <span key={si} className="bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-gray-400 px-2 py-0.5 border border-zinc-200 dark:border-gray-700/60 rounded-full" style={{ fontSize: '0.625rem' }}>
                                  {s}
                                </span>
                              ))}
                              {exam.subjects.length > 3 && (
                                <span className="text-gray-600 dark:text-gray-500 font-medium self-center pl-0.5" style={{ fontSize: '0.625rem' }}>+{exam.subjects.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        {tab === 'upcoming' && (
          <UpcomingTable
            exams={upcomingExams}
            loading={loadingUpcoming}
            hasMore={hasMoreUpcoming}
            onLoadMore={fetchMoreUpcoming}
          />
        )}
      </main>

      {/* New Exam Form Modal */}
      {showForm && (
        <NewExamTypeForm
          onSave={handleSaveForm}
          onClose={() => setShowForm(false)}
          maxSubjects={getMaxSubjects()}
          maxNameLength={MAX_EXAM_NAME_LENGTH}
        />
      )}

      {/* Subscription Modal */}
      {showUpgradeModal && (
        <SubscriptionModal name={disabledItemName} onClose={() => setShowUpgradeModal(false)} />
      )}

      {/* Buy Credits Modal */}
      {showBuyCredits && (
        <BuyCreditsModal
          onClose={() => setShowBuyCredits(false)}
          userId={userProfile?.$id}
          onPaymentSuccess={async () => { await refreshCredits(); }}
          currentPlan={userProfile?.PremiumType}
          isPremium={userProfile?.isPremium}
          premiumEnds={userProfile?.premiumEnds}
          refreshProfile={refreshProfile}
        />
      )}

      {/* Add Button */}
      {tab === 'exams' && !showForm && examTypes.length < getMaxExamTypes() && (
        <button
          onClick={handleDoubleClick}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Add exam type"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Notification */}
      {notification && (
        <InfoComponent
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <Footer />
    </div>
  );
}
