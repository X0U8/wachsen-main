import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import LongAnswerSession from './LongAnswerSession';
import VivaAnalysis from './VivaAnalysis';

export default function VivaSessionPage() {
  const { vivaId } = useParams<{ vivaId: string }>();

  const { data: viva, isLoading, error, refetch } = useQuery({
    queryKey: ['vivaExam', vivaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viva_exams')
        .select('id, name, subject_name, topics, difficulty, question_count, time_limit_minutes, status, questions, ai_analysis, created_at')
        .eq('id', vivaId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!vivaId,
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

  if (error || !viva) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black text-zinc-600 dark:text-gray-400 gap-2">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm">Failed to load.</p>
      </div>
    );
  }

  if (viva.status === 'completed') {
    return <VivaAnalysis viva={viva} />;
  }

  return <LongAnswerSession viva={viva} onComplete={() => refetch()} />;
}
