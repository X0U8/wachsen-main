import { useState, useEffect } from 'react';
import { Calendar, BookOpen, Trash2, ArrowRight, Award, AlertCircle } from 'lucide-react';
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

  // Compute progress day "x" where x is (current date - created date) capped at total plan days
  const createdDate = new Date(plan.created_at);
  const currentDate = new Date();
  
  // Set times to midnight to calculate exact difference in calendar days
  const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
  const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
  
  const diffDays = Math.max(0, Math.floor((currentMidnight - createdMidnight) / (1000 * 60 * 60 * 24)));
  const x = Math.min(plan.days, diffDays);

  const parsedSubjects = Array.isArray(plan.subjects) ? plan.subjects : [];
  
  // Progress percentage (elapsed time)
  const progressPercent = Math.min(100, Math.max(0, (x / plan.days) * 100));

  // Timer countdown hook for confirmation modal
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
    <div className="max-w-xl mx-auto bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 p-6 rounded-3xl backdrop-blur-[2px] space-y-6 shadow-sm animate-fadeIn relative">
      {/* Target Exam Header */}
      <div className="flex items-start justify-between border-b border-zinc-250/60 dark:border-gray-800/80 pb-4 gap-4">
        <div>
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2.5 py-1 rounded-lg">
            Active Study Roadmap
          </span>
          <h2 className="text-xl font-extrabold text-zinc-800 dark:text-white mt-2.5 uppercase tracking-wide">
            {plan.exam_name} Preparation
          </h2>
          <p className="text-[11px] text-zinc-400 mt-1">
            Started on {createdDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
        </div>

        {/* Delete button only visible on the day the plan was created */}
        {createdDate.getDate() === currentDate.getDate() &&
         createdDate.getMonth() === currentDate.getMonth() &&
         createdDate.getFullYear() === currentDate.getFullYear() && (
          <button
            onClick={handleOpenDeleteConfirm}
            disabled={isDeleting}
            className="p-2.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-500/20 disabled:opacity-40 shrink-0"
            title="Reset study plan"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        )}
      </div>

      {/* Progress Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-semibold text-zinc-650 dark:text-gray-400">
            Timeline Progress
          </span>
          <span className="font-mono text-lg font-black text-blue-500">
            DAY {x} <span className="text-xs text-zinc-400 font-semibold">/ {plan.days}</span>
          </span>
        </div>

        {/* Premium Progress Bar */}
        <div className="w-full h-3 bg-zinc-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
          <span>{x} days elapsed</span>
          <span>{Math.max(0, plan.days - x)} days remaining</span>
        </div>
      </div>

      {/* Subjects overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-zinc-700 dark:text-gray-300 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
          Enrolled Subjects ({parsedSubjects.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {parsedSubjects.map((sub: any, idx: number) => (
            <div
              key={idx}
              className="px-3 py-1.5 bg-zinc-50 dark:bg-gray-950/40 border border-zinc-200 dark:border-gray-800 rounded-xl text-[11px] font-semibold text-zinc-700 dark:text-gray-300"
            >
              {sub.name}
            </div>
          ))}
        </div>
      </div>

      {/* Expiry Warning or Congrats */}
      {x >= plan.days && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-start gap-2.5">
          <Award className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h5 className="font-bold text-xs">Roadmap Complete!</h5>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
              Congratulations, you have reached the final day of your target preparation timeframe!
            </p>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <button
        onClick={onContinue}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2 text-xs"
      >
        Continue to Roadmap
        <ArrowRight className="w-4 h-4" />
      </button>

      {/* 15-SEC WAIT DELETE CONFIRMATION MODAL OVERLAY */}
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

// Internal Loader helper
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
