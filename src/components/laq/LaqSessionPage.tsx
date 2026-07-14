import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import LaqSession from './LaqSession';
import LaqAnalysis from './LaqAnalysis';

export default function LaqSessionPage() {
  const { laqId } = useParams<{ laqId: string }>();

  const { data: laq, isLoading, error, refetch } = useQuery({
    queryKey: ['laqExam', laqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('laq_exam')
        .select('id, name, subject_name, topics, difficulty, question_count, time_limit_minutes, status, questions, answers, ai_analysis, ai_feedback, accuracy, depth, clarity, created_at')
        .eq('id', laqId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!laqId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !laq) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black text-zinc-600 dark:text-gray-400 gap-2">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm">Failed to load.</p>
      </div>
    );
  }

  if (laq.status === 'completed') {
    return <LaqAnalysis laq={laq} />;
  }

  return <LaqSession laq={laq} onComplete={() => refetch()} />;
}
