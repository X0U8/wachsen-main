import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import PaginationControls from './PaginationControls';

interface LaqExam {
  id: string;
  name: string;
  subject_name: string | null;
  topics: string | null;
  difficulty: string | null;
  question_count: number;
  status: string;
  created_at: string;
}

interface LaqListTabProps {
  categoryId: string;
  userProfile: any;
}

const PAGE_SIZE = 10;

function formatSimpleDate(dateStr: string) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function LaqListTab({ categoryId, userProfile }: LaqListTabProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const userId = userProfile?.id;

  const { data: resultsPage, isLoading: loading } = useQuery<{ items: LaqExam[]; hasNext: boolean }>({
    queryKey: ['laqExams', categoryId, userId, statusFilter, sortOrder, activeSearchQuery, page],
    queryFn: async () => {
      if (!userId) return { items: [], hasNext: false };
      const sessionData = await supabase.auth.getSession();
      const authToken = sessionData.data.session?.access_token || '';
      const offset = (page - 1) * PAGE_SIZE;

      const response = await fetch(
        `/api/search?type=laq&userId=${userId}&authToken=${authToken}&categoryId=${categoryId}&statusFilter=${statusFilter}&sortOrder=${sortOrder}&query=${encodeURIComponent(activeSearchQuery)}&limit=${PAGE_SIZE + 1}&offset=${offset}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to search LAQ exams');

      const items = (data.laqExams || []).slice(0, PAGE_SIZE);
      return { items, hasNext: (data.laqExams || []).length > PAGE_SIZE };
    },
    enabled: !!categoryId && !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const laqExams = resultsPage?.items || [];
  const hasNext = resultsPage?.hasNext || false;

  const handleSearch = () => {
    setPage(1);
    setActiveSearchQuery(searchInput);
  };

  const handleClear = () => {
    setPage(1);
    setSearchInput('');
    setActiveSearchQuery('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-gray-800 bg-zinc-50/50 dark:bg-gray-950/30 rounded-t-xl">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="bg-zinc-100 dark:bg-gray-950 border border-black/15 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-gray-300 font-medium text-xs focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => { setPage(1); setSortOrder(e.target.value as 'desc' | 'asc'); }}
            className="bg-zinc-100 dark:bg-gray-950 border border-black/15 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-gray-300 font-medium text-xs focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all"
          >
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 max-w-xs w-full">
          <input
            type="text"
            placeholder="Search LAQ exams..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="flex-1 bg-zinc-100 dark:bg-gray-950 border border-black/15 dark:border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-gray-200 placeholder-zinc-400 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
          >
            Search
          </button>
          {activeSearchQuery && (
            <button
              onClick={handleClear}
              className="px-2 py-1.5 border border-zinc-300 dark:border-gray-700 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-lg text-xs text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && laqExams.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : laqExams.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-gray-800/50 text-zinc-500 dark:text-gray-400 font-semibold tracking-wider text-sm">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-gray-800">
              {laqExams.map((laq) => (
                <tr
                  key={laq.id}
                  onClick={() => navigate(`/laq/${laq.id}`)}
                  className="hover:bg-zinc-100 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-4 font-normal text-zinc-800 dark:text-gray-100 group-hover:text-blue-400 transition-colors">
                    {laq.name}
                  </td>
                  <td className="px-4 py-4 text-zinc-500 dark:text-gray-400">
                    {laq.subject_name || '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium uppercase ${
                        laq.difficulty === 'easy' ? 'bg-blue-500/10 text-blue-500' :
                        laq.difficulty === 'medium' ? 'bg-blue-500/10 text-blue-500' :
                        laq.difficulty === 'hard' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-red-500/10 text-red-500'
                      } text-xs`}
                    >
                      {laq.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        laq.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        laq.status === 'ongoing' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      } text-xs`}
                    >
                      {laq.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-500 dark:text-gray-400">
                    {formatSimpleDate(laq.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-500 dark:text-gray-400 text-sm">No LAQ exams found.</p>
          <p className="mt-1 text-zinc-400 dark:text-gray-500 text-xs">Click the plus icon to create one.</p>
        </div>
      )}

      {laqExams.length > 0 && (
        <PaginationControls
          page={page}
          hasNext={hasNext}
          loading={loading}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => p + 1)}
        />
      )}
    </div>
  );
}
