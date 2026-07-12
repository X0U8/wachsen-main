import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { Loader2, ChevronRight, Filter, Check } from 'lucide-react';
import Footer from '../Footer';
import { useQuery } from '@tanstack/react-query';
import { fontSize } from '../../lib/utils';

export default function Results() {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraResults, setExtraResults] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const userId = userProfile?.id || null;
  const sentinelRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!userId) return;
    const fetchExamTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('examtypes')
          .select('id, name')
          .eq('userId', userId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setExamTypes(data || []);
      } catch (err) {
        console.error('Error fetching exam types:', err);
      }
    };
    fetchExamTypes();
  }, [userId]);

  const { data: initialResults = [], isLoading: loading } = useQuery({
    queryKey: ['results', userId, selectedExamTypeId, activeSearchQuery],
    queryFn: async () => {
      if (!userId) return [];
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';

      const response = await fetch(`/api/search?type=results&userId=${userId}&authToken=${authToken}&selectedExamTypeId=${selectedExamTypeId || ''}&query=${encodeURIComponent(activeSearchQuery)}&limit=10&offset=0`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to search results');
      return data.results || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const results = [...initialResults, ...extraResults];
  const hasMore = initialResults.length === 10 || (extraResults.length > 0 && extraResults.length % 10 === 0);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !userId) return;
    setLoadingMore(true);
    try {
      const offset = results.length;
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';

      const response = await fetch(`/api/search?type=results&userId=${userId}&authToken=${authToken}&selectedExamTypeId=${selectedExamTypeId || ''}&query=${encodeURIComponent(activeSearchQuery)}&limit=10&offset=${offset}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load more results');

      const dataResults = data.results || [];
      if (dataResults.length > 0) {
        setExtraResults(prev => [...prev, ...dataResults]);
      }
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
        <p
          className="mt-2 text-zinc-400 font-semibold uppercase tracking-wider text-xs">Loading Results</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none pb-24">
      <header className="sticky top-0 z-40 w-full px-6 py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 flex items-center justify-between transition-colors duration-300">
        <h1 className="font-semibold text-zinc-800 dark:text-gray-100 text-base">Results</h1>
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 cursor-pointer flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
          </button>

          {showFilterDropdown && (
            <>
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowFilterDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div
                  className="font-semibold text-zinc-400 dark:text-zinc-505 px-3 py-1.5 uppercase tracking-wider text-xs">
                  Filter by Exam Type
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedExamTypeId(null);
                      setExtraResults([]);
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${!selectedExamTypeId
                        ? 'bg-blue-500/10 text-blue-600 dark:text-white font-semibold'
                        : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      } text-xs`}>
                    <span>All Exam Types</span>
                    {!selectedExamTypeId && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {examTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedExamTypeId(type.id);
                        setExtraResults([]);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${selectedExamTypeId === type.id
                          ? 'bg-blue-500/10 text-blue-600 dark:text-white font-semibold'
                          : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                        } text-xs`}>
                      <span className="truncate">{type.name}</span>
                      {selectedExamTypeId === type.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-5 pb-6 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 w-full bg-white dark:bg-gray-900/40 p-2 rounded-xl border border-zinc-200 dark:border-gray-800/80 mb-2">
          <input
            type="text"
            placeholder="Search results..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setExtraResults([]);
                setActiveSearchQuery(searchInput);
              }
            }}
            className="flex-1 bg-transparent border-none text-zinc-800 dark:text-gray-250 placeholder-zinc-400 focus:outline-none text-xs" />
          <button
            onClick={() => {
              setExtraResults([]);
              setActiveSearchQuery(searchInput);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition-colors text-xs">
            Search
          </button>
          {activeSearchQuery && (
            <button
              onClick={() => {
                setSearchInput('');
                setExtraResults([]);
                setActiveSearchQuery('');
              }}
              className="px-2 py-1.5 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-lg text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors font-medium text-xs">
              Clear
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-zinc-500 dark:text-gray-400 text-sm">No exam results found yet.</p>
            <button
              onClick={() => navigate('/exam')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-500/10 cursor-pointer text-xs">
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
                      <h3
                        className="font-semibold text-zinc-800 dark:text-gray-100 truncate text-sm">
                        {res.examName || 'Untitled Exam'}
                      </h3>
                      <div
                        className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 font-semibold tracking-wide uppercase text-xs">
                        <span>{date}</span><span>•</span><span>{time}</span><span>•</span><span>{timeSpent} mins</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${scorePercent >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} text-sm`}>{scorePercent}%</span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-650" />
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="w-full py-6 flex items-center justify-center gap-2 text-zinc-400 dark:text-zinc-505">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="uppercase tracking-wider font-semibold text-xs">Loading more results...</span>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
