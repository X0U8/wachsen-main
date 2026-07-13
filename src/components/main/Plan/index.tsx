import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { useUserProfile } from '../../../lib/UserContext.tsx';
import PlanWizard, { SubjectInput } from './PlanWizard';
import PlanDashboard from './PlanDashboard';
import PlanView from './PlanView';
import { Calendar, X } from 'lucide-react';
import { fontSize } from '../../../lib/utils';

export default function PlanContainer() {
  const { userProfile, refreshCredits } = useUserProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const cacheKey = `cached_active_study_plan_${userId}`;
  const [activePlanCached, setActivePlanCached] = useState<any | undefined>(() => {
    const item = localStorage.getItem(cacheKey);
    if (item === null) return undefined;
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  });

  const { data: activePlanQuery = null, isLoading: loadingPlan } = useQuery({
    queryKey: ['activeStudyPlan', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('study_plans')
        .select('id, created_at, user_id, exam_name, subjects, days, plan_json')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      const record = data || null;
      localStorage.setItem(cacheKey, JSON.stringify(record));
      return record;
    },
    enabled: !!userId,
  });

  const activePlan = activePlanQuery || activePlanCached;

  const [viewRoadmap, setViewRoadmap] = useState<boolean>(false);
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);


  const [examName, setExamName] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [days, setDays] = useState<number>(90);
  const [generating, setGenerating] = useState<boolean>(false);


  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);


  useEffect(() => {
    const getSessionUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        setUserId(user.id);
      }
    };
    getSessionUser();
  }, []);

  useEffect(() => {
    if (userId) {
      try {
        const item = localStorage.getItem(`cached_active_study_plan_${userId}`);
        if (item === null) {
          setActivePlanCached(undefined);
        } else {
          setActivePlanCached(JSON.parse(item));
        }
      } catch {
        setActivePlanCached(null);
      }
    } else {
      setActivePlanCached(undefined);
    }
  }, [userId]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setErrorMsg(null);

    const calculatedMonths = Math.max(1, Math.round(days / 30));
    const totalCost = calculatedMonths * subjects.length;
    const userCredits = userProfile?.credits || 0;
    const useOwnKey = localStorage.getItem('use_own_key') === 'true';

    if (useOwnKey) {
      setErrorMsg("Study Plan generation can only be performed using our default credit system. Please disable 'Use Own Key' in Settings.");
      setGenerating(false);
      return;
    }

    if (userCredits < totalCost) {
      setErrorMsg(`Insufficient credits. Study Plan generation costs ${totalCost} credits (${calculatedMonths} months × ${subjects.length} subjects). You have ${userCredits}.`);
      setGenerating(false);
      return;
    }

    try {

      const payloadSubjects = subjects.map(s => ({
        name: s.name,
        chapters: s.chapters
      }));

      const apiEndpoint = '/api/generate-study-plan';
      const session = await supabase.auth.getSession();
      const authToken = session.data?.session?.access_token || '';


      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: payloadSubjects,
          examName,
          days,
          userId,
          authToken
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate study plan.');
      }


      const { data: savedRecord, error: saveError } = await supabase
        .from('study_plans')
        .insert({
          user_id: userId,
          exam_name: examName,
          subjects: subjects.map(s => ({ name: s.name, chapters: s.chapters })),
          days,
          plan_json: data.plan
        })
        .select('id, created_at, user_id, exam_name, subjects, days, plan_json')
        .single();

      if (saveError) throw saveError;

      refreshCredits();
      localStorage.setItem(cacheKey, JSON.stringify(savedRecord));
      queryClient.setQueryData(['activeStudyPlan', userId], savedRecord);
      setActivePlanCached(savedRecord);
      setShowWizard(false);
      setViewRoadmap(true);


      setExamName('');
      setSubjects([]);
      setDays(90);
      setSuccessMsg('Your custom study roadmap has been generated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);

    } catch (err: any) {
      console.error('Error generating plan:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteActivePlan = async () => {
    if (deleting || !activePlan) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('study_plans')
        .delete()
        .eq('id', activePlan.id);

      if (error) throw error;

      localStorage.removeItem(cacheKey);
      queryClient.setQueryData(['activeStudyPlan', userId], null);
      setActivePlanCached(null);
      setViewRoadmap(false);
      setShowWizard(false);
      setSuccessMsg('Study plan reset successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to reset plan:', err);
      setErrorMsg('Failed to reset study plan.');
    } finally {
      setDeleting(false);
    }
  };

  const isPlanLoading = !userId || (loadingPlan && activePlanCached === undefined);

  if (isPlanLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-zinc-400 text-xs">Loading study plan...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-xs leading-relaxed">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-650 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center gap-3 animate-fadeIn">
          <span className="font-medium text-xs leading-relaxed">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-650 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {activePlan && viewRoadmap && (
        <PlanView
          planId={activePlan.id}
          createdAt={activePlan.created_at}
          examName={activePlan.exam_name}
          days={activePlan.days}
          planJson={activePlan.plan_json}
          onBack={() => setViewRoadmap(false)}
        />
      )}
      {activePlan && !viewRoadmap && (
        <PlanDashboard
          plan={activePlan}
          onContinue={() => setViewRoadmap(true)}
          onDelete={handleDeleteActivePlan}
          isDeleting={deleting}
        />
      )}
      {!activePlan && !showWizard && (
        <div className="border border-dashed border-black/15 dark:border-white/20 rounded-3xl p-8 text-center flex flex-col items-center gap-4 bg-white dark:bg-zinc-900/40">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
            No active study roadmap
          </h3>
          <button
            onClick={() => setShowWizard(true)}
            className="px-5 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold rounded-xl transition-all shadow-md cursor-pointer text-xs">
            Create Study Plan
          </button>
        </div>
      )}
      {!activePlan && showWizard && (
        <PlanWizard
          examName={examName}
          setExamName={setExamName}
          subjects={subjects}
          setSubjects={setSubjects}
          days={days}
          setDays={setDays}
          onGenerate={handleGenerate}
          generating={generating}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}


function AlertCircle({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}


function Loader2({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
