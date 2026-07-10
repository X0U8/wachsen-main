import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import Login from './components/onboarding/Login';
import Onboarding from './components/onboarding/OnboardingPage';
import Exam from './components/exam/ExamPage';
import ExamDetails from './components/exam-details/ExamDetailsPage';
import Settings from './components/settings/Settings';
import TakeExam from './components/exam/TakeExam';
import Results from './components/results/Results';
import ResultDetails from './components/results/ResultDetails';

import { UserProvider, useUserProfile } from './lib/UserContext.tsx';
import { ThemeProvider } from './lib/ThemeContext.tsx';
import { MathJaxProvider } from './lib/MathJaxContext.tsx';
import { Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (sessionLoading || (session && profileLoading)) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col items-center justify-center p-6 font-sans">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
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
      <Route path="/settings" element={<Settings />} />
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
