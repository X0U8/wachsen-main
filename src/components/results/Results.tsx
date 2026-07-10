import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { Loader2, ChevronRight } from 'lucide-react';
import Footer from '../Footer';
import { useQuery } from '@tanstack/react-query';
import { fontSize } from '../../lib/utils';

export default function Results() {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraResults, setExtraResults] = useState<any[]>([]);
  const userId = userProfile?.id || null;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: initialResults = [], isLoading: loading } = useQuery({
    queryKey: ['results', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('userId', userId!)
        .order('created_at', { ascending: false })
        .range(0, 9);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
    refetchOnMount: true,
    gcTime: 0,
  });

  const results = [...initialResults, ...extraResults];
  const hasMore = initialResults.length === 10 || (extraResults.length > 0 && extraResults.length % 10 === 0);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !userId) return;
    setLoadingMore(true);
    try {
      const offset = results.length;
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('userId', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + 9);
      if (error) throw error;
      if (data) setExtraResults(prev => [...prev, ...data]);
    } catch (err) {
      console.error('Error loading more results:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
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
  }, [hasMore, loadingMore, results.length]);

  if (loading && results.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 font-sans antialiased">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <p className="mt-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">Loading Results</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none">
      <header className="sticky top-0 z-40 w-full px-6 py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 flex items-center justify-between transition-colors duration-300">
        <h1 className="font-semibold text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.base }}>Results</h1>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-5 pb-28 flex flex-col gap-3">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.sm }}>No exam results found yet.</p>
            <button onClick={() => navigate('/exam')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-500/10 cursor-pointer"
              style={{ fontSize: fontSize.xs }}>
              Start Your First Exam
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {results.map((res) => {
                const date = new Date(res.created_at || res.startTime).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric'
                });
                const time = new Date(res.created_at || res.startTime).toLocaleTimeString('en-GB', {
                  hour: '2-digit', minute: '2-digit'
                });
                const timeSpent = res.startTime && res.endTime
                  ? Math.floor((new Date(res.endTime).getTime() - new Date(res.startTime).getTime()) / 60000)
                  : 0;
                const scorePercent = Math.round((res.marksObtained / (res.totalMarks || 1)) * 100);

                return (
                  <button key={res.id}
                    onClick={() => navigate(`/results/${res.id}`)}
                    className="bg-white dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800/80 hover:border-zinc-300 dark:hover:border-gray-700 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 text-left w-full shadow-xs">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <h3 className="font-semibold text-zinc-800 dark:text-gray-100 truncate" style={{ fontSize: fontSize.sm }}>
                        {res.examName || 'Untitled Exam'}
                      </h3>
                      <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 font-semibold tracking-wide uppercase" style={{ fontSize: '0.625rem' }}>
                        <span>{date}</span><span>•</span><span>{time}</span><span>•</span><span>{timeSpent} mins</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${scorePercent >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} style={{ fontSize: fontSize.sm }}>{scorePercent}%</span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="w-full py-6 flex items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Loading more results...</span>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
