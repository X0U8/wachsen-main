import { Lock } from 'lucide-react';
import { fontSize } from '../../lib/utils';

interface UpgradeModalProps {
  name: string;
  onClose: () => void;
}

export default function UpgradeModal({ name, onClose }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
        <div className="text-center">
          <Lock className="w-10 h-10 text-zinc-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1" style={{ fontSize: fontSize.base }}>Upgrade Required</h3>
          <p className="text-zinc-600 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>"{name}" is locked. Upgrade your subscription plan to gain full access.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-gray-700 transition-colors cursor-pointer" style={{ fontSize: fontSize.xs }}>Close</button>
          <button onClick={() => { onClose(); }} className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors cursor-pointer" style={{ fontSize: fontSize.xs }}>Upgrade Plan</button>
        </div>
      </div>
    </div>
  );
}
