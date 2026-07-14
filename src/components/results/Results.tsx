import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { Loader2, ChevronRight, Filter, Check } from 'lucide-react';
import Footer from '../Footer';
import { useQuery } from '@tanstack/react-query';

export default function Results() {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'exams' | 'laq'>('exams');
  const PAGE_SIZE = 10;
  const userId = userProfile?.id || null;

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

  const { data: resultsPage, isLoading: loadingExams } = useQuery<{ items: any[]; hasNext: boolean }>({
    queryKey: ['results', userId, selectedExamTypeId, activeSearchQuery, page],
    queryFn: async () => {
      if (!userId) return { items: [], hasNext: false };
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';
      const offset = (page - 1) * PAGE_SIZE;

      const response = await fetch(`/api/search?type=results&userId=${userId}&authToken=${authToken}&selectedExamTypeId=${selectedExamTypeId || ''}&query=${encodeURIComponent(activeSearchQuery)}&limit=${PAGE_SIZE + 1}&offset=${offset}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to search results');
      const list = data.results || [];
      return { items: list.slice(0, PAGE_SIZE), hasNext: list.length > PAGE_SIZE };
    },
    enabled: !!userId && activeTab === 'exams',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: laqResultsPage, isLoading: loadingLaqs } = useQuery<{ items: any[]; hasNext: boolean }>({
    queryKey: ['laqResults', userId, selectedExamTypeId, activeSearchQuery, page],
    queryFn: async () => {
      if (!userId) return { items: [], hasNext: false };
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';
      const offset = (page - 1) * PAGE_SIZE;

      const response = await fetch(`/api/search?type=laq&userId=${userId}&authToken=${authToken}&statusFilter=completed&categoryId=${selectedExamTypeId || ''}&query=${encodeURIComponent(activeSearchQuery)}&limit=${PAGE_SIZE + 1}&offset=${offset}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to search LAQ results');
      const list = data.laqExams || [];
      return { items: list.slice(0, PAGE_SIZE), hasNext: list.length > PAGE_SIZE };
    },
    enabled: !!userId && activeTab === 'laq',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const currentItems = activeTab === 'exams' ? (resultsPage?.items || []) : (laqResultsPage?.items || []);
  const hasNext = activeTab === 'exams' ? (resultsPage?.hasNext || false) : (laqResultsPage?.hasNext || false);
  const loading = activeTab === 'exams' ? loadingExams : loadingLaqs;

  if (loading && currentItems.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white items-center justify-center p-6 font-sans antialiased">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <p className="mt-2 text-zinc-400 font-semibold uppercase tracking-wider text-xs">Loading Results</p>
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
                <div className="font-semibold text-zinc-400 dark:text-zinc-505 px-3 py-1.5 uppercase tracking-wider text-xs">
                  Filter by Exam Type
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedExamTypeId(null);
                      setPage(1);
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${!selectedExamTypeId
                        ? 'bg-blue-500/10 text-blue-600 dark:text-white font-semibold'
                        : 'text-zinc-655 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      } text-xs`}>
                    <span>All Exam Types</span>
                    {!selectedExamTypeId && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {examTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedExamTypeId(type.id);
                        setPage(1);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${selectedExamTypeId === type.id
                          ? 'bg-blue-500/10 text-blue-600 dark:text-white font-semibold'
                          : 'text-zinc-655 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
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
        <div className="flex shrink-0 pb-1.5">
          <div className="flex w-full bg-zinc-100 dark:bg-gray-900/80 rounded-xl p-1 gap-1">
            {([
              { key: 'exams', label: 'Exams' },
              { key: 'laq', label: 'LAQ Exams' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-4 font-semibold tracking-wider rounded-lg transition-all duration-200 cursor-pointer text-xs ${activeTab === tab.key
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full bg-white dark:bg-gray-900/40 p-2 rounded-xl border border-zinc-200 dark:border-gray-800/80 mb-2">
          <input
            type="text"
            placeholder={activeTab === 'exams' ? "Search results..." : "Search LAQ results..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setActiveSearchQuery(searchInput);
              }
            }}
            className="flex-1 bg-transparent border-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none text-xs" />
          <button
            onClick={() => {
              setPage(1);
              setActiveSearchQuery(searchInput);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition-colors text-xs">
            Search
          </button>
          {activeSearchQuery && (
            <button
              onClick={() => {
                setSearchInput('');
                setPage(1);
                setActiveSearchQuery('');
              }}
              className="px-2 py-1.5 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-lg text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors font-medium text-xs">
              Clear
            </button>
          )}
        </div>

        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-zinc-500 dark:text-gray-400 text-sm">
              {activeTab === 'exams' ? 'No exam results found yet.' : 'No LAQ results found yet.'}
            </p>
            <button
              onClick={() => navigate('/exam')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-500/10 cursor-pointer text-xs">
              Start Your First Exam
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {activeTab === 'exams' ? (
                currentItems.map((res) => {
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
                        <h3 className="font-semibold text-zinc-850 dark:text-gray-100 truncate text-sm">
                          {res.examName || 'Untitled Exam'}
                        </h3>
                        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-505 font-semibold tracking-wide uppercase text-xs">
                          <span>{date}</span><span>•</span><span>{time}</span><span>•</span><span>{timeSpent} mins</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${scorePercent >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} text-sm`}>{scorePercent}%</span>
                        <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-650" />
                      </div>
                    </button>
                  );
                })
              ) : (
                currentItems.map((res) => {
                  const date = new Date(res.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  });
                  const time = new Date(res.created_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <button key={res.id}
                      onClick={() => navigate(`/laq/${res.id}`)}
                      className="bg-white dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800/80 hover:border-zinc-300 dark:hover:border-gray-700 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 text-left w-full shadow-xs">
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <h3 className="font-semibold text-zinc-850 dark:text-gray-100 truncate text-sm">
                          {res.name || 'Untitled LAQ Exam'}
                        </h3>
                        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-505 font-semibold tracking-wide uppercase text-xs">
                          <span>{date}</span><span>•</span><span>{time}</span><span>•</span><span>{res.subject_name || 'General'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        <span className="px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold text-[10px] bg-blue-500/10 text-blue-500">
                          {res.difficulty}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-650" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext || loading}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
