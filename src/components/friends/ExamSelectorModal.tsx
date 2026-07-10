import React from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface ExamSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  friendName: string;
  examSearchQuery: string;
  setExamSearchQuery: (query: string) => void;
  onSearch: () => void;
  myExams: any[];
  loadingMyExams: boolean;
  hasMoreExams: boolean;
  onLoadMore: () => void;
  onSelectExam: (examId: string) => void;
}

export const ExamSelectorModal: React.FC<ExamSelectorModalProps> = ({
  isOpen,
  onClose,
  friendName,
  examSearchQuery,
  setExamSearchQuery,
  onSearch,
  myExams,
  loadingMyExams,
  hasMoreExams,
  onLoadMore,
  onSelectExam,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 max-w-sm w-full max-h-[80vh] shadow-2xl flex flex-col relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-350 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
          Select Exam to Send
        </h3>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-4 font-medium">
          Choose an exam to challenge <strong>{friendName}</strong>.
        </p>

        {/* Search Input Bar */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search exam name..."
              value={examSearchQuery}
              onChange={(e) => setExamSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearch();
              }}
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500 placeholder-zinc-400 font-medium"
            />
          </div>
          <button
            onClick={onSearch}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0"
          >
            Search
          </button>
        </div>

        {loadingMyExams && myExams.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : myExams.length > 0 ? (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            <div className="space-y-2.5">
              {myExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => onSelectExam(exam.id)}
                  className="w-full text-left bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1"
                >
                  <span className="text-xs font-semibold text-zinc-800 dark:text-gray-100 line-clamp-1">
                    {exam.examName || 'Untitled Exam'}
                  </span>
                  <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-medium uppercase">
                    {exam.totalQuestions} Questions • {exam.difficulty}
                  </span>
                </button>
              ))}
            </div>

            {hasMoreExams && (
              <button
                onClick={onLoadMore}
                disabled={loadingMyExams}
                className="w-full mt-3 py-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 transition-all cursor-pointer flex justify-center items-center gap-1.5"
              >
                {loadingMyExams ? (
                  <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                ) : (
                  'Load More'
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
            No exams found.
          </div>
        )}
      </div>
    </div>
  );
};
