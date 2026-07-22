import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../Footer';
import SpotlightCard from '../../ui/SpotlightCard';
import TextType from '../../ui/TextType';
import PlanIcon from '../../ui/PlanIcon';
import { Plus, Lock, BarChart3, ChartNoAxesCombined, Brain, Mic, Binary, GraduationCap, X } from 'lucide-react';
import { SettingsIcon } from '../../icons/SettingsIcon';
import AnalyticsModal from '../profile/AnalyticsModal';
import { supabase } from '../../services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserProfile } from '../../lib/UserContext.tsx';
import localStorageCache from '../../lib/localStorage';
import { fontSize } from '../../lib/utils';
import { useTheme } from '../../lib/ThemeContext.tsx';
import InfoComponent from '../../ui/InfoComponent';
import NewExamTypeForm from './NewExamTypeForm';
import UpcomingTable from './UpcomingTable';
import Plan from './Plan/index';
import SubscriptionModal from './SubscriptionModal';
import ClaimCreditsModal from './ClaimCreditsModal';

type Tab = 'exams' | 'plan' | 'upcoming';

interface ExamType {
  id: string;
  name: string;
  subjects: string[];
  academicLevel: string;
}

export default function Exam() {
  const navigate = useNavigate();
  const { userProfile, refreshCredits, refreshProfile } = useUserProfile();
  const { fontSizeLevel } = useTheme();
  const scale = { small: 0.85, medium: 1.0, large: 1.35, larger: 1.6 }[fontSizeLevel] || 1.0;
  const [tab, setTab] = useState<Tab>('exams');
  const [examTypes, setExamTypes] = useState<ExamType[]>(() => {
    return localStorageCache.get<ExamType[]>(localStorageCache.keys.EXAM_CATEGORIES) || [];
  });
  const hasInitializedExamTypes = useRef(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [disabledItemName, setDisabledItemName] = useState('');
  const [showClaim, setShowClaim] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  const EXAMS_PER_PAGE = 10;
  const MAX_EXAM_NAME_LENGTH = 60;
  const lastSaveTime = useRef(0);
  const lastSaveData = useRef<string>('');
  const [localProfile, setLocalProfile] = useState<any | null>(() => {
    return localStorageCache.get<any>(localStorageCache.keys.USER_PROFILE);
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const getMaxExamTypes = () => {
    const premiumType = (userProfile as any)?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 20;
    if (premiumType.toLowerCase().includes('rise')) return 15;
    if (premiumType.toLowerCase().includes('lite')) return 10;
    return 5;
  };

  const getMaxSubjects = () => {
    const premiumType = (userProfile as any)?.PremiumType || '';
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
  const fullGreeting = `${greeting}, ${userProfile?.name || 'User'}`;

  useEffect(() => {
    setShowIcon(false);
    const textLength = fullGreeting.length;
    const typingDuration = textLength * 200;
    const timer = setTimeout(() => setShowIcon(true), typingDuration + 100);
    return () => clearTimeout(timer);
  }, [fullGreeting]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const queryClient = useQueryClient();

  const { data: fetchedExamTypes = [] } = useQuery({
    queryKey: ['examCategories', userId],
    queryFn: async () => {
      const cachedExamTypes = localStorageCache.get<ExamType[]>(localStorageCache.keys.EXAM_CATEGORIES);

      if (cachedExamTypes && cachedExamTypes.length > 0) {
        const hasChallenges = cachedExamTypes.some(cat => cat.name === 'challenges');
        const hasOthers = cachedExamTypes.some(cat => cat.name === 'others');

        if (hasChallenges && hasOthers) {
          return cachedExamTypes;
        }

        let updated = [...cachedExamTypes];
        let changed = false;

        if (!hasChallenges) {
          try {
            const { data, error } = await supabase
              .from('examtypes')
              .select('id, name, subjects, academicLevel')
              .eq('userId', userId!)
              .eq('name', 'challenges')
              .maybeSingle();

            if (!error && data) {
              updated.push({
                id: data.id,
                name: data.name,
                subjects: data.subjects || [],
                academicLevel: data.academicLevel || ''
              });
              changed = true;
            }
          } catch (e) {
            console.error("Error loading challenges ExamType separately:", e);
          }
        }

        if (!hasOthers) {
          try {
            const { data, error } = await supabase
              .from('examtypes')
              .select('id, name, subjects, academicLevel')
              .eq('userId', userId!)
              .eq('name', 'others')
              .maybeSingle();

            if (!error && data) {
              updated.push({
                id: data.id,
                name: data.name,
                subjects: data.subjects || [],
                academicLevel: data.academicLevel || ''
              });
              changed = true;
            }
          } catch (e) {
            console.error("Error loading others ExamType separately:", e);
          }
        }

        if (changed) {
          localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, updated);
        }
        return updated;
      }

      const { data, error } = await supabase
        .from('examtypes')
        .select('id, name, subjects, academicLevel')
        .eq('userId', userId!)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      const examTypes = (data || []).map(d => ({
        id: d.id, name: d.name, subjects: d.subjects || [], academicLevel: d.academicLevel || '',
      }));
      localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, examTypes);
      return examTypes;
    },
    enabled: !!userId,
    staleTime: 0,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (fetchedExamTypes.length > 0) {
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
          .select('id, examName, startDateTime, status, difficulty, categoryId')
          .contains('accessIds', [userId!])
          .order('created_at', { ascending: false })
          .range(0, EXAMS_PER_PAGE - 1);
        if (error) throw error;
        documents = data || [];
        const mapped = documents
          .map((doc: any) => ({
            id: doc.id, name: doc.examName || 'Untitled Exam',
            startDateTime: doc.startDateTime || '', status: doc.status || 'active',
            difficulty: doc.difficulty || 'medium', categoryId: doc.categoryId
          }))
          .filter((exam: any) => exam.status === 'active' || exam.status === 'Pending');
        if (userId!) {
          localStorage.setItem(`cached_upcoming_exams_${userId!}`, JSON.stringify(mapped));
        }
        return mapped;
      } catch { documents = []; }
      return [];
    },
    enabled: !!userId,
    staleTime: 0, refetchOnMount: true, gcTime: 0,
  });

  useEffect(() => {
    if (userId) {
      try {
        const cached = JSON.parse(localStorage.getItem(`cached_upcoming_exams_${userId}`) || '[]');
        setUpcomingExams(cached);
      } catch {
        setUpcomingExams([]);
      }
    } else {
      setUpcomingExams([]);
    }
  }, [userId]);

  useEffect(() => {
    if (initialUpcoming.length > 0) {
      setUpcomingExams(initialUpcoming);
    }
  }, [initialUpcoming]);

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
          .select('id, examName, startDateTime, status, difficulty, categoryId')
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
        .filter((exam: any) => exam.status === 'active' || exam.status === 'Pending');
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
    const dataKey = JSON.stringify(data);
    if (lastSaveData.current === dataKey && now - lastSaveTime.current < 120000) {
      setNotification({ message: 'Duplicate exam type detected. Please wait 2 minutes.', type: 'error' });
      return;
    }
    if (now - lastSaveTime.current < 5000) {
      setNotification({ message: 'Please wait before creating another exam type', type: 'error' });
      return;
    }
    lastSaveData.current = dataKey;

    setSaving(true);
    try {
      const { data: doc, error } = await supabase
        .from('examtypes')
        .insert({ userId, name: data.name, subjects: data.subjects, academicLevel: data.academicLevel })
        .select('id, name, subjects, academicLevel')
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

  const [showChallenges, setShowChallenges] = useState(
    () => localStorage.getItem('show_challenges_category') === 'true'
  );
  const [showOthers, setShowOthers] = useState(
    () => localStorage.getItem('show_others_category') === 'true'
  );


  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'show_challenges_category') setShowChallenges(e.newValue === 'true');
      if (e.key === 'show_others_category') setShowOthers(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filterOutDefaultAny = (cat: ExamType) => {
    const hasAnyAcademic = cat.academicLevel?.toLowerCase() === 'any';
    const hasAnySubject = Array.isArray(cat.subjects)
      ? cat.subjects.some((s: string) => s.toLowerCase() === 'any')
      : typeof cat.subjects === 'string' && (cat.subjects as string).toLowerCase() === 'any';

    if (hasAnyAcademic || hasAnySubject) return true;
    return false;
  };

  const nonChallengeExamTypes = examTypes.filter(et => {
    if (filterOutDefaultAny(et)) return false;
    return et.name !== 'challenges' && et.name !== 'others';
  });

  const displayedCategories = examTypes.filter(cat => {


    if (cat.name === 'challenges') return showChallenges;
    if (cat.name === 'others') return showOthers;
    if (filterOutDefaultAny(cat)) return false;
    return true;
  });
  const slotsLeft = getMaxExamTypes() - nonChallengeExamTypes.length;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100 font-sans antialiased select-none pb-24">
      <header className="sticky top-0 z-40 w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-900/80 flex items-center justify-between transition-colors duration-300">
        <div>
          <h1
            className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold tracking-tight text-zinc-800 dark:text-gray-100 text-base">
            <span className="sm:hidden">
              <TextType text={greeting} typingSpeed={200} pauseDuration={2000} showCursor={false} loop={false} />
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <TextType text={fullGreeting} typingSpeed={200} pauseDuration={2000} showCursor={false} loop={false} />
              {userProfile?.PremiumType && userProfile.PremiumType !== 'Free' && showIcon && (
                <PlanIcon planName={userProfile.PremiumType} className="shrink-0" />
              )}
            </span>
          </h1>
          <p className="text-zinc-450 dark:text-gray-550 mt-1 text-sm">{today}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-1.5 sm:gap-2 bg-zinc-150/50 dark:bg-gray-900/50 border border-zinc-250 dark:border-gray-800 rounded-xl px-2.5 sm:px-3 py-1.5 text-zinc-600 dark:text-gray-400 text-sm">
            <strong className="text-zinc-850 dark:text-gray-100 font-semibold">{userProfile?.credits || 0}</strong>
            <span className="hidden sm:inline">credits</span>
            <button onClick={() => setShowClaim(true)} className="text-zinc-450 dark:text-gray-550 hover:text-blue-500 dark:hover:text-blue-400 font-semibold pl-1 sm:pl-1.5 transition-colors cursor-pointer" aria-label="Daily credits">+</button>
          </div>
          <button onClick={() => setShowAnalytics(true)} className="p-1 sm:p-1.5 flex items-center justify-center rounded-lg bg-zinc-105 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer" style={{ width: `${32 * scale}px`, height: `${32 * scale}px` }} aria-label="Analytics">
            <ChartNoAxesCombined className="fill-current" style={{ width: `${14 * scale}px`, height: `${14 * scale}px` }} />
          </button>
          <button onClick={() => navigate('/settings')} className="p-1 sm:p-1.5 flex items-center justify-center rounded-lg bg-zinc-105 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer" style={{ width: `${32 * scale}px`, height: `${32 * scale}px` }} aria-label="Settings">
            <SettingsIcon size={14 * scale} style={{ width: `${14 * scale}px`, height: `${14 * scale}px` }} />
          </button>
        </div>
      </header>
      {localStorage.getItem('use_own_key') === 'true' && (() => {
        const prov = localStorage.getItem('provider') || 'mesh';
        const key = localStorage.getItem(prov === 'mistral' ? 'mistral_api_key' : 'mesh_api_key');
        if (!key) return null;
        return (
          <div
            className="w-full px-3 py-1 bg-[#007AFF]/8 border-b border-[#007AFF]/20 text-[#007AFF] text-center font-medium text-xs">Using your own key with {prov === 'mistral' ? 'Mistral' : 'Mesh API'}
          </div>
        );
      })()}
      <div className="flex shrink-0 px-3 sm:px-4 pt-3 pb-2 bg-white dark:bg-black">
        <div className="flex w-full bg-zinc-100 dark:bg-gray-900/80 rounded-xl p-1 gap-1">
          {(['exams', 'plan', 'upcoming'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 font-semibold  tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${tab === t
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-zinc-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-gray-300'
                } text-xs`}>
              {t === 'exams' ? 'Exams' : t === 'plan' ? 'Plan' : 'Upcoming'}
            </button>
          ))}
        </div>
      </div>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-5 pb-24 mb-2 overflow-y-auto min-h-0">
        {tab === 'exams' && (
          <>
            {examTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                <h3 className="font-semibold text-zinc-800 dark:text-gray-100 text-base">
                  Create your first exam type
                </h3>
                <button
                  onClick={handleDoubleClick}
                  className="bg-[#007AFF] hover:bg-[#0062CC] text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all duration-200 cursor-pointer flex items-center gap-2 text-sm mt-2"
                >
                  <Plus className="w-4 h-4" /> Create Exam Type
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4 px-1">
                  <p className="font-medium text-gray-500 dark:text-gray-400 text-xs">{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} remaining</p>
                  <button
                    onClick={handleDoubleClick}
                    disabled={slotsLeft <= 0}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${slotsLeft <= 0 ? 'bg-zinc-200 dark:bg-gray-800 text-zinc-400 dark:text-gray-600 cursor-not-allowed' : 'bg-[#007AFF] hover:bg-[#0062CC] text-white cursor-pointer'} text-xs`}>
                    <Plus className="w-3.5 h-3.5" /> New
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {displayedCategories.map((exam, i) => {
                    const isChallengeCategory = exam.name === 'challenges';
                    const nonChallengeIdx = nonChallengeExamTypes.findIndex(et => et.id === exam.id);
                    const isDisabled = !isChallengeCategory && nonChallengeIdx >= getMaxExamTypes();
                    return (
                      <SpotlightCard
                        key={exam.id}
                        onClick={() => isDisabled ? (setDisabledItemName(exam.name), setShowUpgradeModal(true)) : navigate(`/exam-details/${exam.id}`)}
                        spotlightColor={isDisabled ? "rgba(0, 255, 180, 0.15)" : "rgba(37, 99, 235, 0.12)"}
                        className={`exam-card bg-white dark:bg-gray-900/40 rounded-xl border transition-all duration-300 ${isDisabled ? 'border-zinc-200 dark:border-gray-800/60 opacity-50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-gray-800/50' : 'border-zinc-200 dark:border-gray-800/80 hover:border-zinc-300 dark:hover:border-gray-700 cursor-pointer'}`}
                        style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
                      >
                        <div className="p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-zinc-800 dark:text-gray-100 font-medium truncate text-sm">{exam.name === 'challenges' ? 'Challenges' : exam.name === 'others' ? 'Others' : exam.name}</p>
                            {isDisabled && <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-gray-600 shrink-0 mt-0.5" />}
                          </div>
                          {exam.academicLevel && (
                            <p className="text-zinc-500 dark:text-gray-400 mt-1 font-medium text-xs">{exam.academicLevel === 'any' ? 'Any' : exam.academicLevel}</p>
                          )}
                          {exam.subjects.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {exam.subjects.slice(0, 3).map((s, si) => (
                                <span
                                  key={si}
                                  className="bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-gray-400 px-2 py-0.5 border border-zinc-200 dark:border-gray-700/60 rounded-full text-xs">
                                  {s === 'any' ? 'Any' : s}
                                </span>
                              ))}
                              {exam.subjects.length > 3 && (
                                <span
                                  className="text-gray-600 dark:text-gray-550 font-medium self-center pl-0.5 text-xs">+{exam.subjects.length - 3}</span>
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
        {tab === 'plan' && (
          <Plan />
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
      {showForm && (
        <NewExamTypeForm
          onSave={handleSaveForm}
          onClose={() => setShowForm(false)}
          maxSubjects={getMaxSubjects()}
          maxNameLength={MAX_EXAM_NAME_LENGTH}
        />
      )}
      {showUpgradeModal && (
        <SubscriptionModal name={disabledItemName} onClose={() => setShowUpgradeModal(false)} />
      )}
      {notification && (
        <InfoComponent
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <ClaimCreditsModal
        show={showClaim}
        onClose={() => setShowClaim(false)}
        userProfile={userProfile}
        refreshCredits={refreshCredits}
      />
      {showAnalytics && (
        <AnalyticsModal onClose={() => setShowAnalytics(false)} />
      )}
      <Footer />
    </div>
  );
}
