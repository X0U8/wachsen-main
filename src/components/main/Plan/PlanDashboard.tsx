import { useState, useEffect } from 'react';
import { Calendar, BookOpen, Trash, ArrowRight, Award, AlertCircle } from 'lucide-react';
import { fontSize } from '../../../lib/utils';

interface PlanDashboardProps {
  plan: {
    id: string;
    exam_name: string;
    subjects: any;
    days: number;
    created_at: string;
  };
  onContinue: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export default function PlanDashboard({ plan, onContinue, onDelete, isDeleting }: PlanDashboardProps) {
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15);


  const createdDate = new Date(plan.created_at);
  const currentDate = new Date();


  const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
  const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();

  const diffDays = Math.max(0, Math.floor((currentMidnight - createdMidnight) / (1000 * 60 * 60 * 24)));
  const x = Math.min(plan.days, diffDays);

  const parsedSubjects = Array.isArray(plan.subjects) ? plan.subjects : [];


  const progressPercent = Math.min(100, Math.max(0, (x / plan.days) * 100));


  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showConfirmModal && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showConfirmModal, secondsRemaining]);

  const handleOpenDeleteConfirm = () => {
    setSecondsRemaining(15);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowConfirmModal(false);
  };

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-zinc-900/40 border border-black/15 dark:border-white/20 p-6 rounded-3xl space-y-6 shadow-sm animate-fadeIn relative">
      <div className="flex items-center justify-between border-b border-black/15 dark:border-white/20 pb-4 gap-4">
        <div className="w-8" />
        <h2
          className="font-semibold text-zinc-900 dark:text-white text-center flex-1 text-base">
          {plan.exam_name} preparation
        </h2>
        {createdDate.getDate() === currentDate.getDate() &&
          createdDate.getMonth() === currentDate.getMonth() &&
          createdDate.getFullYear() === currentDate.getFullYear() ? (
          <button
            onClick={handleOpenDeleteConfirm}
            disabled={isDeleting}
            className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-xl transition-all cursor-pointer disabled:opacity-40 shrink-0"
            title="Reset study plan"
          >
            <Trash className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>
      <div className="space-y-4 py-2">
        <div className="text-center font-bold text-blue-500 tracking-widest text-sm">
          DAY
        </div>
        <div className="text-center font-bold text-blue-500 tracking-widest text-xl">
          {x}/{plan.days}
        </div>

        <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {parsedSubjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center pt-2">
            {parsedSubjects.map((sub: any, idx: number) => (
              <span
                key={idx}
                className="bg-zinc-150/50 dark:bg-zinc-800/40 border border-zinc-250 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-xl font-medium tracking-wide animate-fade-in text-xs">
                {sub.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onContinue}
        className="w-full py-2.5 bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 text-xs">
        Continue
      </button>
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm p-6 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-gray-800 rounded-3xl shadow-xl space-y-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-800 dark:text-white text-sm">Delete Study Plan?</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  This plan will be completely deleted. You will lose your roadmap checkpoints and progress.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {secondsRemaining > 0 ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 bg-zinc-100 dark:bg-zinc-950 text-zinc-400 dark:text-gray-600 border border-zinc-200 dark:border-gray-800 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4" />
                  Please wait {secondsRemaining}s...
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl transition-all cursor-pointer text-xs disabled:opacity-40"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-3 bg-transparent hover:bg-zinc-50 dark:hover:bg-white/5 border border-zinc-200 dark:border-gray-800 text-zinc-650 dark:text-gray-300 font-semibold rounded-2xl transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Loader2({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
