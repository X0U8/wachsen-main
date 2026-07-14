import React from 'react';

interface PaginationControlsProps {
  page: number;
  hasNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function PaginationControls({ page, hasNext, loading, onPrev, onNext }: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button
        onClick={onPrev}
        disabled={page === 1 || loading}
        className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
      >
        Previous
      </button>
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Page {page}</span>
      <button
        onClick={onNext}
        disabled={!hasNext || loading}
        className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
      >
        Next
      </button>
    </div>
  );
}
