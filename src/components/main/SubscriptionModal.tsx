import { Lock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fontSize } from '../../lib/utils';

interface SubscriptionModalProps {
  name: string;
  onClose: () => void;
}

export default function SubscriptionModal({ name, onClose }: SubscriptionModalProps) {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center pt-2">
          <Lock className="w-10 h-10 text-zinc-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2" style={{ fontSize: fontSize.lg }}>Upgrade Required</h3>
          <p className="text-zinc-500 dark:text-gray-400 leading-relaxed" style={{ fontSize: fontSize.sm }}>
            "{name}" is locked. Upgrade your subscription plan to unlock all features.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 font-medium hover:bg-zinc-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            style={{ fontSize: fontSize.sm }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onClose(); navigate('/settings'); }}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            style={{ fontSize: fontSize.sm }}
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
}
