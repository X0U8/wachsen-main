import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { fontSize } from '../lib/utils';

export type InfoType = 'success' | 'error' | 'info';

export default function InfoComponent({
  message,
  type = 'info',
  onClose,
}: {
  message: string;
  type?: InfoType;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const bgCls =
    type === 'success'
      ? 'bg-emerald-100/80 dark:bg-emerald-950/80 border-emerald-300/50 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
      : type === 'error'
        ? 'bg-rose-100/80 dark:bg-rose-950/80 border-rose-300/50 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
        : 'bg-blue-100/80 dark:bg-blue-950/80 border-blue-300/50 dark:border-blue-500/30 text-blue-800 dark:text-blue-200';

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl animate-fade-in ${bgCls} max-w-sm w-full mx-4`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="font-medium leading-normal flex-1" style={{ fontSize: fontSize.sm }}>{message}</p>
      <button onClick={onClose} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
