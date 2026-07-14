import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BarChart3, MessageSquare, CheckCircle2, AlertCircle, XCircle, Clock, Award, Target, Sparkle } from 'lucide-react';
import { motion } from 'framer-motion';

interface LaqAnalysisProps {
  laq: any;
}

function CircularProgress({ value, label, colorClass, trailColorClass }: { value: number; label: string; colorClass: string; trailColorClass: string }) {
  const percentage = Math.max(0, Math.min(100, (value || 0) * 10));
  const radius = 30;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-4 bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-900 rounded-3xl shadow-sm hover:shadow-md transition-all">
      <div className="relative w-18 h-18">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="36"
            cy="36"
            r={radius}
            className={`${trailColorClass} stroke-current`}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            className={`${colorClass} stroke-current transition-all duration-1000 ease-out`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-zinc-800 dark:text-white">
          {(value || 0).toFixed(1)}/10
        </div>
      </div>
      <span className="text-[10px]  tracking-wider font-semibold text-zinc-400 mt-3">{label}</span>
    </div>
  );
}

function CorrectnessBadge({ correctness }: { correctness: string }) {
  if (correctness === 'correct') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-[10px] font-semibold border border-green-500/25">
        <CheckCircle2 className="w-3 h-3" /> Correct
      </span>
    );
  }
  if (correctness === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/25">
        <AlertCircle className="w-3 h-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-semibold border border-red-500/25">
      <XCircle className="w-3 h-3" /> Incorrect
    </span>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LaqAnalysis({ laq }: LaqAnalysisProps) {
  const navigate = useNavigate();
  const analysis = laq?.ai_analysis;
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      <header className="px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-zinc-900 dark:text-white text-sm font-semibold truncate max-w-[250px]">{laq?.name || 'LAQ Analysis'}</h1>
            <p className="text-[10px] text-zinc-400 dark:text-gray-500 font-medium">
              {laq?.subject_name} {laq?.difficulty ? `• ${laq.difficulty}` : ''}
            </p>
          </div>
        </div>

        {analysis?.totalTimeSpentSeconds > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-400 dark:text-gray-500 rounded-xl text-[10px] font-semibold border border-zinc-200 dark:border-gray-850">
            <Clock className="w-3.5 h-3.5" />
            <span>Time Taken: {formatTime(analysis.totalTimeSpentSeconds)}</span>
          </div>
        )}
      </header>

      <main className="flex-grow overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {!analysis ? (
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-zinc-400 dark:text-gray-500 text-xs">No analysis grading reports generated yet.</p>
            </div>
          ) : (
            <>
              {/* Overall Performance */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CircularProgress
                  value={analysis.overall_rating}
                  label="Overall Rating"
                  colorClass="text-blue-500"
                  trailColorClass="text-blue-500/10"
                />
                <CircularProgress
                  value={analysis.accuracy}
                  label="Accuracy"
                  colorClass="text-emerald-500"
                  trailColorClass="text-emerald-500/10"
                />
                <CircularProgress
                  value={analysis.depth}
                  label="Depth"
                  colorClass="text-amber-500"
                  trailColorClass="text-amber-500/10"
                />
                <CircularProgress
                  value={analysis.clarity}
                  label="Clarity"
                  colorClass="text-purple-500"
                  trailColorClass="text-purple-500/10"
                />
              </div>

              {/* Feedback Section */}
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200/85 dark:border-zinc-900 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2">

                  <h2 className="font-semibold text-xs  tracking-wider text-zinc-450 dark:text-zinc-400">AI Evaluation Feedback</h2>
                </div>
                <p className="text-zinc-700 dark:text-zinc-350 text-sm leading-relaxed whitespace-pre-wrap">
                  {analysis.feedback}
                </p>
              </div>

              {/* Per Question breakdown */}
              {Array.isArray(analysis.perQuestion) && analysis.perQuestion.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <h2 className="font-semibold text-xs  tracking-wider text-zinc-450 dark:text-zinc-400">Question-wise Breakdown</h2>
                  </div>

                  <div className="space-y-3">
                    {analysis.perQuestion.map((item: any, idx: number) => {
                      const isExpanded = expandedQuestion === idx;
                      return (
                        <div
                          key={idx}
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-3xl overflow-hidden transition-all shadow-sm"
                        >
                          <div
                            onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                            className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-all select-none"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-gray-800 text-zinc-800 dark:text-white flex items-center justify-center font-semibold text-[10px]">
                                {idx + 1}
                              </span>
                              <div className="flex flex-col gap-1">
                                <span className="text-zinc-850 dark:text-zinc-200 text-xs font-semibold leading-relaxed line-clamp-1 max-w-[200px] sm:max-w-md">
                                  {item.question || `Question ${item.questionIndex + 1}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <CorrectnessBadge correctness={item.correctness} />
                                  {item.timeSpentSeconds > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 dark:text-gray-500 font-medium">
                                      <Clock className="w-3 h-3" />
                                      {formatTime(item.timeSpentSeconds)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] font-semibold text-blue-500  tracking-wider">
                              {isExpanded ? 'Hide Details' : 'View Details'}
                            </div>
                          </div>

                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="border-t border-zinc-150 dark:border-zinc-900/80 p-4 space-y-4 text-xs"
                            >
                              <div className="space-y-1">
                                <span className="font-semibold text-zinc-450 dark:text-zinc-500  tracking-wider text-[9px]">Question:</span>
                                <p className="text-zinc-800 dark:text-zinc-150 leading-relaxed font-medium">
                                  {item.question || `Question ${item.questionIndex + 1}`}
                                </p>
                              </div>

                              {item.userAnswer && (
                                <div className="space-y-1">
                                  <span className="font-semibold text-zinc-450 dark:text-zinc-500  tracking-wider text-[9px]">Your Answer:</span>
                                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-805 rounded-2xl text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                                    “{item.userAnswer}”
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 rounded-2xl">

                                  <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed">
                                    {item.overall || 'No evaluation score details.'}
                                  </p>
                                </div>

                                <div className="space-y-1 p-3 bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-850 rounded-2xl">

                                  <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed">
                                    {item.feedback}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
