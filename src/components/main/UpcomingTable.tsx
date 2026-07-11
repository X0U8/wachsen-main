import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fontSize } from '../../lib/utils';

interface UpcomingExam {
  id: string;
  name: string;
  startDateTime: string;
  status: string;
  difficulty: string;
  categoryId: string;
}

interface UpcomingTableProps {
  exams: UpcomingExam[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function UpcomingTable({ exams, loading, hasMore, onLoadMore }: UpcomingTableProps) {
  const navigate = useNavigate();

  if (exams.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
        <p className="text-gray-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.sm }}>No upcoming exams found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900/30 rounded-xl border border-zinc-200 dark:border-gray-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: fontSize.xs }}>
            <thead className="bg-zinc-50 dark:bg-gray-900/60 text-zinc-500 dark:text-gray-400 uppercase font-semibold tracking-wider border-b border-zinc-200 dark:border-gray-800" style={{ fontSize: fontSize.xs }}>
              <tr>
                <th className="px-4 sm:px-5 py-3 sm:py-3.5 font-semibold">Exam Name</th>
                <th className="px-4 sm:px-5 py-3 sm:py-3.5 font-semibold">Starting Date</th>
                <th className="px-4 sm:px-5 py-3 sm:py-3.5 font-semibold">Status</th>
                <th className="px-4 sm:px-5 py-3 sm:py-3.5 font-semibold text-right">Difficulty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-gray-800">
              {exams.map((exam) => (
                <tr
                  key={exam.id}
                  onClick={() => exam.categoryId && navigate(`/exam-details/${exam.categoryId}`)}
                  className="hover:bg-zinc-50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer"
                >
                  <td className="px-4 sm:px-5 py-3 sm:py-4 font-medium text-zinc-800 dark:text-gray-100">{exam.name}</td>
                  <td className="px-4 sm:px-5 py-3 sm:py-4 text-zinc-500 dark:text-gray-400">
                    {exam.startDateTime?.toLowerCase() === 'anytime'
                      ? 'Anytime'
                      : new Date(exam.startDateTime).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                  </td>
                  <td className="px-4 sm:px-5 py-3 sm:py-4">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${exam.status === 'Completed' || exam.status === 'Ongoing'
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'
                      }`} style={{ fontSize: fontSize.xs }}>
                      {exam.status}
                    </span>
                  </td>
                  <td className="px-4 sm:px-5 py-3 sm:py-4 text-right">
                    <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${exam.difficulty === 'hard' || exam.difficulty === 'expert'
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40'
                      }`} style={{ fontSize: fontSize.xs }}>
                      {exam.difficulty}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-4 sm:px-5 py-2 bg-white dark:bg-gray-900 hover:bg-zinc-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-200 dark:border-gray-700 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-gray-300"
            style={{ fontSize: fontSize.xs }}
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /><span>Loading...</span></>
            ) : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
