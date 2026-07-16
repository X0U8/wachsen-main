import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, AlertCircle, XCircle, Clock, Sparkle } from 'lucide-react';
import { useUserProfile } from '../../lib/UserContext';
import AITutorModal from '../results/AITutorModal';

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
          <circle cx="36" cy="36" r={radius} className={`${trailColorClass} stroke-current`} strokeWidth={strokeWidth} fill="transparent" />
          <circle cx="36" cy="36" r={radius} className={`${colorClass} stroke-current transition-all duration-1000 ease-out`} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-zinc-800 dark:text-white">
          {(value || 0).toFixed(1)}
        </div>
      </div>
      <span className="text-[10px] tracking-wider font-semibold text-zinc-400 mt-3">{label}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function mapCorrectness(correctness: string): 'correct' | 'wrong' | 'skipped' {
  if (correctness === 'correct') return 'correct';
  return 'wrong';
}

export default function LaqAnalysis({ laq }: LaqAnalysisProps) {
  const navigate = useNavigate();
  const analysis = laq?.ai_analysis;
  const aiFeedback = laq?.ai_feedback || analysis?.feedback || '';
  const overallRating = analysis?.overall_rating ?? 0;
  const accuracy = laq?.accuracy ?? analysis?.accuracy ?? 0;
  const depth = laq?.depth ?? analysis?.depth ?? 0;
  const clarity = laq?.clarity ?? analysis?.clarity ?? 0;

  const perQuestion: any[] = useMemo(() => {
    const rawPerQ = Array.isArray(analysis?.perQuestion) ? analysis.perQuestion : [];
    const answers = Array.isArray(laq?.answers) ? laq.answers : [];
    const questions = Array.isArray(laq?.questions) ? laq.questions : [];

    return rawPerQ.map((item: any) => {
      const qIndex = item.questionIndex;
      const ansRecord = answers.find((a: any) => a.questionIndex === qIndex);
      const qRecord = questions[qIndex] || null;

      return {
        ...item,
        question: qRecord?.question || ansRecord?.question || item.question || `Question ${qIndex + 1}`,
        userAnswer: ansRecord?.userAnswer || item.userAnswer || '',
        timeSpentSeconds: ansRecord?.timeSpentSeconds || item.timeSpentSeconds || 0,
      };
    });
  }, [analysis, laq]);

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [tutorItem, setTutorItem] = useState<{ question: any; userAnswer: string; index: number; status: 'correct' | 'wrong' | 'skipped' } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const { userProfile, refreshCredits } = useUserProfile();
  const userId = userProfile?.id || null;

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const selectedQuestion = useMemo(() => perQuestion[selectedIdx] || null, [perQuestion, selectedIdx]);
  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < perQuestion.length - 1;

  const getStatusColor = (correctness: string, isSelected = false) => {
    const ring = isSelected ? ' ring-2 ring-blue-500 scale-110' : '';
    if (correctness === 'correct') return `bg-green-500/10 dark:bg-green-500/20 border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30${ring}`;
    if (correctness === 'partial') return `bg-amber-500/10 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/30${ring}`;
    return `bg-red-500/10 dark:bg-red-500/20 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30${ring}`;
  };

  const getStatusCircle = (correctness: string) => {
    if (correctness === 'correct') return 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400';
    if (correctness === 'partial') return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400';
    return 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400';
  };

  const getAnswerPanelColor = (correctness: string) => {
    if (correctness === 'correct') return 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400';
    if (correctness === 'partial') return 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400';
    return 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400';
  };

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
            <span>{formatTime(analysis.totalTimeSpentSeconds)}</span>
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
                <CircularProgress value={overallRating} label="Overall Rating" colorClass="text-blue-500" trailColorClass="text-blue-500/10" />
                <CircularProgress value={accuracy} label="Accuracy" colorClass="text-emerald-500" trailColorClass="text-emerald-500/10" />
                <CircularProgress value={depth} label="Depth" colorClass="text-amber-500" trailColorClass="text-amber-500/10" />
                <CircularProgress value={clarity} label="Clarity" colorClass="text-purple-500" trailColorClass="text-purple-500/10" />
              </div>

              {/* Feedback Section */}
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200/85 dark:border-zinc-900 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                <h2 className="font-semibold text-xs tracking-wider text-zinc-450 dark:text-zinc-400">AI Overall Feedback</h2>
                <p className="text-zinc-700 dark:text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{aiFeedback}</p>
              </div>

              {/* Per-Question Section — ResultDetails style */}
              {perQuestion.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-gray-800 pb-4">
                    <h2 className="text-sm font-medium text-zinc-900 dark:text-white">Question wise Analysis</h2>
                    {/* Legend */}
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-zinc-400">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Correct</span>
                      <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" />Partial</span>
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />Incorrect</span>
                    </div>
                  </div>

                  {/* Question number grid */}
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5 justify-center">
                    {perQuestion.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedIdx(idx)}
                        className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg border text-[10px] font-medium transition-all flex items-center justify-center ${getStatusColor(item.correctness, selectedIdx === idx)} text-xs`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Single question detail panel */}
                  {selectedQuestion && (
                    <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-3xl overflow-hidden">
                      <div className="p-5 space-y-4">
                        {/* Top row: number circle + badges + nav arrows */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs ${getStatusCircle(selectedQuestion.correctness)}`}>
                              {selectedIdx + 1}
                            </span>
                            {selectedQuestion.timeSpentSeconds > 0 && (
                              <div className="px-2 py-1 bg-zinc-100 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl">
                                <div className="text-zinc-550 dark:text-gray-450 font-medium text-xs">Time</div>
                                <div className="text-zinc-900 dark:text-white font-bold text-xs">{formatTime(selectedQuestion.timeSpentSeconds)}</div>
                              </div>
                            )}
                            {/* Rating badge */}
                            {typeof selectedQuestion.rating === 'number' && (
                              <div className="px-2 py-1 bg-zinc-100 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl">
                                <div className="text-zinc-550 dark:text-gray-450 font-medium text-xs">Rating</div>
                                <div className="text-zinc-900 dark:text-white font-bold text-xs">{selectedQuestion.rating}</div>
                              </div>
                            )}
                            {/* Correctness badge */}
                            <div className={`px-2 py-1 border rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl text-xs font-semibold ${selectedQuestion.correctness === 'correct'
                              ? 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400'
                              : selectedQuestion.correctness === 'partial'
                                ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400'
                              }`}>
                              {selectedQuestion.correctness === 'correct' ? <CheckCircle2 className="w-3 h-3" /> : selectedQuestion.correctness === 'partial' ? <AlertCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span className="capitalize">{selectedQuestion.correctness}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => hasPrev && setSelectedIdx(selectedIdx - 1)}
                              disabled={!hasPrev}
                              className="p-2 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:bg-zinc-100 dark:disabled:bg-gray-905 disabled:cursor-not-allowed rounded-lg text-zinc-700 dark:text-gray-300 disabled:text-zinc-400 dark:disabled:text-gray-600 border border-zinc-350 dark:border-gray-700/50 transition-all cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => hasNext && setSelectedIdx(selectedIdx + 1)}
                              disabled={!hasNext}
                              className="p-2 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:bg-zinc-100 dark:disabled:bg-gray-905 disabled:cursor-not-allowed rounded-lg text-zinc-700 dark:text-gray-300 disabled:text-zinc-400 dark:disabled:text-gray-600 border border-zinc-350 dark:border-gray-700/50 transition-all cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </button>
                          </div>
                        </div>

                        {/* Question text */}
                        <div className="font-medium leading-relaxed text-zinc-900 dark:text-white text-base">
                          {selectedQuestion.question || `Question ${selectedIdx + 1}`}
                        </div>

                        {/* Your Answer + AI Feedback panels */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className={`p-3 rounded-2xl border flex flex-col gap-1 ${getAnswerPanelColor(selectedQuestion.correctness)} text-xs`}>
                            <span className="text-zinc-500 dark:text-gray-455 font-medium text-xs">Your Answer</span>
                            <span className="font-normal leading-relaxed ">
                              {selectedQuestion.userAnswer ? `${selectedQuestion.userAnswer}s` : 'Not Answered'}
                            </span>
                          </div>
                          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-400 text-xs flex flex-col gap-1">
                            <span className="text-zinc-500 dark:text-blue-500/80 font-medium text-xs">AI Feedback</span>
                            <span className="font-normal leading-relaxed text-zinc-700 dark:text-zinc-300">
                              {selectedQuestion.feedback || selectedQuestion.overall || 'No feedback available.'}
                            </span>
                          </div>
                        </div>

                        {/* AI Tutor button */}
                        <div className="flex justify-end pt-3 mt-1 border-t border-zinc-200/50 dark:border-gray-800/50">
                          <button
                            onClick={() => {
                              setTutorItem({
                                question: {
                                  id: `laq-${laq.id}-q${selectedIdx}`,
                                  text: selectedQuestion.question || `Question ${selectedIdx + 1}`,
                                  correct_answer: '',
                                  options: [],
                                },
                                userAnswer: selectedQuestion.userAnswer || '',
                                index: selectedIdx + 1,
                                status: mapCorrectness(selectedQuestion.correctness),
                              });
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-[10px] sm:text-xs font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkle className="w-3.5 h-3.5 fill-current" />
                            Ask AI Tutor
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-[60] px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-lg border ${notification.type === 'error'
          ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          : notification.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}>
          {notification.message}
        </div>
      )}

      {/* AI Tutor Modal */}
      {tutorItem && (
        <AITutorModal
          isOpen={!!tutorItem}
          onClose={() => setTutorItem(null)}
          question={tutorItem.question}
          userAnswer={tutorItem.userAnswer}
          userId={userId}
          userProfile={userProfile}
          refreshCredits={refreshCredits}
          showNotification={showNotification}
          originalIndex={tutorItem.index}
          status={tutorItem.status}
        />
      )}
    </div>
  );
}
