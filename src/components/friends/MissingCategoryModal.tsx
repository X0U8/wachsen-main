import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4 animate-bounce" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
          Challenges Category Required
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed font-medium">
          To send and accept challenges, you need to create a default "challenges" category. This category has subject "any" and academic level "any".
        </p>
        <button
          onClick={onCreate}
          disabled={creating}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Create Challenges Category'
          )}
        </button>
      </div>
    </div>
  );
};
