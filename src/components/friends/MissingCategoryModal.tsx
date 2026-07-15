import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { fontSize } from '../../lib/utils';

interface MissingCategoryModalProps {
  isOpen: boolean;
  creating: boolean;
  onCreate: () => void;
}

export const MissingCategoryModal: React.FC<MissingCategoryModalProps> = ({
  isOpen,
  creating,
  onCreate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-black/15 dark:border-white/20 rounded-3xl p-6 max-w-sm w-full shadow-2xl dark:shadow-[0_0_30px_rgba(255,255,255,0.06)] flex flex-col items-center text-center">
        <AlertCircle className="w-10 h-10 text-yellow-500 mb-4" />
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 text-base">
          Challenges ExamType required
        </h3>
        <p
          className="text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed font-medium text-xs">
          To make the friends tab all functions work properly we need to create this exam type.
        </p>
        <button
          onClick={onCreate}
          disabled={creating}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 text-xs">
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Create'
          )}
        </button>
      </div>
    </div>
  );
};
