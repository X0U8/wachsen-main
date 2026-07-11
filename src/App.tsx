import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import Login from './components/onboarding/Login';
import Onboarding from './components/onboarding/OnboardingPage';
import Exam from './components/main/ExamPage';
import ExamDetails from './components/exam-details/ExamDetailsPage';
import Settings from './components/settings/Settings';
import TakeExam from './components/main/TakeExam';
import Results from './components/results/Results';
import ResultDetails from './components/results/ResultDetails';
import RevisionLog from './components/RevisionLog';
import Friends from './components/Friends';
import Subscription from './components/Subscription';

import { UserProvider, useUserProfile } from './lib/UserContext.tsx';
import { ThemeProvider } from './lib/ThemeContext.tsx';
import { MathJaxProvider } from './lib/MathJaxContext.tsx';
import Loading from './components/Loading';
import SuspendedOverlay from './components/SuspendedOverlay';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import localStorageCache from './lib/localStorage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      gcTime: 30 * 60 * 1000,
    },
  },
});

function MainApp() {
  const { userProfile, profileLoading, refreshProfile } = useUserProfile();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [banned, setBanned] = useState(false);
  const [banChecked, setBanChecked] = useState(false);
  const [examTypesReady, setExamTypesReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
      if (session?.user?.id) {
        try {
          const { data } = await supabase.from('profiles').select('is_ban').eq('id', session.user.id).single();
          if (data?.is_ban) setBanned(true);
        } catch {}
        setBanChecked(true);

        // Pre-load exam types in background
        const cached = localStorageCache.get(localStorageCache.keys.EXAM_CATEGORIES);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          setExamTypesReady(true);
        } else {
          try {
            const { data } = await supabase
              .from('examtypes')
              .select('*')
              .eq('userId', session.user.id)
              .order('created_at', { ascending: true })
              .limit(50);
            if (data && data.length > 0) {
              const examTypes = data.map(d => ({
                id: d.id, name: d.name, subjects: d.subjects || [], academicLevel: d.academicLevel || '',
              }));
              localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, examTypes);
            }
          } catch {}
          setExamTypesReady(true);
        }
      } else {
        setBanChecked(true);
        setExamTypesReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Show loading until session, ban, exam types, and profile are all resolved
  if (sessionLoading || (session && !banChecked) || (session && !examTypesReady) || profileLoading) {
    return <Loading />;
  }

  if (banned) {
    return <SuspendedOverlay />;
  }

  if (!session) {
    return <Login />;
  }

  if (!userProfile || !userProfile.name) {
    return <Onboarding session={session} onComplete={refreshProfile} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/exam" />} />
      <Route path="/exam" element={<Exam />} />
      <Route path="/exam-details/:id" element={<ExamDetails />} />
      <Route path="/exam/:instanceId" element={<TakeExam />} />
      <Route path="/results" element={<Results />} />
      <Route path="/results/:resultId" element={<ResultDetails />} />
      <Route path="/results/:viewUserId/:examId" element={<ResultDetails />} />
      <Route path="/revision" element={<RevisionLog />} />
      <Route path="/revision/:examId" element={<RevisionLog />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/subscription" element={<Subscription />} />
      <Route path="*" element={<Navigate to="/exam" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MathJaxProvider>
        <ThemeProvider>
          <UserProvider>
            <MainApp />
          </UserProvider>
        </ThemeProvider>
      </MathJaxProvider>
    </QueryClientProvider>
  );
}
