import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BarChart3, MessageSquare, CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';

interface VivaAnalysisProps {
  viva: any;
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(10, value || 0));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-600 dark:text-gray-400 font-medium">{label}</span>
        <span className="font-semibold text-zinc-900 dark:text-gray-100">{normalized}/10</span>
      </div>
      <div className="w-full bg-zinc-200 dark:bg-gray-800 rounded-full h-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            normalized >= 7 ? 'bg-green-500' : normalized >= 4 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${normalized * 10}%` }}
        />
      </div>
    </div>
  );
}

function CorrectnessIcon({ correctness }: { correctness: string }) {
  if (correctness === 'correct') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (correctness === 'partial') return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VivaAnalysis({ viva }: VivaAnalysisProps) {
  const navigate = useNavigate();
  const analysis = viva?.ai_analysis;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      <header className="p-3 flex items-center gap-2 border-b border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-black/50 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-900 rounded-full transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-semibold text-sm sm:text-base">{viva?.name || 'Long Answer Analysis'}</h1>
          <p className="text-xs text-zinc-500 dark:text-gray-400">
            {viva?.subject_name} • {viva?.difficulty}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">
        <div className="max-w-2xl mx-auto space-y-4">
          {!analysis ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/15 dark:border-white/20 p-6 text-center">
              <p className="text-zinc-500 dark:text-gray-400 text-sm">No analysis available.</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/15 dark:border-white/20 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <h2 className="font-semibold text-sm">Overall Performance</h2>
                </div>
                <div className="space-y-4">
                  <RatingBar label="Overall Rating" value={analysis.overall_rating} />
                  <RatingBar label="Accuracy" value={analysis.accuracy} />
                  <RatingBar label="Depth" value={analysis.depth} />
                  <RatingBar label="Clarity" value={analysis.clarity} />
                </div>
                {analysis.totalTimeSpentSeconds > 0 && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-gray-800 text-xs text-zinc-500 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Total time: {formatTime(analysis.totalTimeSpentSeconds)}</span>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/15 dark:border-white/20 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <h2 className="font-semibold text-sm">Feedback</h2>
                </div>
                <p className="text-sm text-zinc-700 dark:text-gray-300 leading-relaxed">
                  {analysis.feedback}
                </p>
              </div>

              {Array.isArray(analysis.perQuestion) && analysis.perQuestion.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/15 dark:border-white/20 p-5 shadow-sm">
                  <h2 className="font-semibold text-sm mb-4">Per-Question Breakdown</h2>
                  <div className="space-y-4">
                    {analysis.perQuestion.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-gray-800 bg-zinc-50 dark:bg-gray-950/50"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <CorrectnessIcon correctness={item.correctness} />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-zinc-800 dark:text-gray-100 uppercase">
                              Question {item.questionIndex + 1}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-gray-400 mt-0.5">{item.overall}</p>
                          </div>
                          {item.timeSpentSeconds > 0 && (
                            <span className="text-[10px] text-zinc-400 shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(item.timeSpentSeconds)}
                            </span>
                          )}
                        </div>
                        {item.userAnswer && (
                          <div className="mb-2 text-xs text-zinc-600 dark:text-gray-400 italic bg-zinc-100 dark:bg-gray-950/70 rounded-lg px-2.5 py-1.5">
                            “{item.userAnswer}”
                          </div>
                        )}
                        <p className="text-xs text-zinc-700 dark:text-gray-300">
                          <span className="font-semibold">Feedback:</span> {item.feedback}
                        </p>
                      </div>
                    ))}
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
