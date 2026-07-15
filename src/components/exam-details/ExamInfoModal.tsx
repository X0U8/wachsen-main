import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';

interface Exam {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  status: 'Completed' | 'Pending' | 'Ongoing' | 'Expired' | 'active';
  difficulty: 'easy' | 'medium' | 'hard' | 'advance';
  examType: string;
  totalQuestions: number;
  totalMarks: number;
  subjects: any[];
  isTemplate?: boolean;
}

interface ExamInfoModalProps {
  exam: Exam | null;
  onClose: () => void;
  formatSimpleDate: (date: string) => string;
}

export default function ExamInfoModal({ exam, onClose, formatSimpleDate }: ExamInfoModalProps) {
  const navigate = useNavigate();
  const [resultId, setResultId] = useState<string | null>(null);
  const [fetchingResult, setFetchingResult] = useState(false);

  useEffect(() => {
    if (exam && exam.status === 'Completed') {
      const fetchResult = async () => {
        setFetchingResult(true);
        try {
          const { data, error } = await supabase
            .from('results')
            .select('id')
            .eq('examId', exam.id)
            .limit(1);
          if (!error && data && data.length > 0) {
            setResultId(data[0].id);
          }
        } catch (err) {
          console.error('Error fetching result ID:', err);
        } finally {
          setFetchingResult(false);
        }
      };
      fetchResult();
    } else {
      setResultId(null);
    }
  }, [exam]);

  if (!exam) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-gray-900 border border-black/15 dark:border-white/20 rounded-3xl p-6 w-full max-w-md space-y-6 shadow-2xl dark:shadow-[0_0_30px_rgba(255,255,255,0.06)] relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-gray-800 rounded-full text-zinc-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium text-zinc-900 dark:text-gray-100 text-lg">{exam.name}</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${exam.status === 'Completed' ? 'bg-green-500/10 text-green-500' :
                    exam.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                      exam.status === 'Expired' ? 'bg-red-500/10 text-red-500' :
                        'bg-yellow-500/10 text-yellow-500'
                    } text-xs`}>
                  {exam.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-black/10 dark:border-white/15 h-full flex flex-col justify-center">
                <p
                  className="text-zinc-500 dark:text-gray-550 uppercase tracking-wider mb-1 text-xs">Exam Type</p>
                <p className="font-medium text-zinc-900 dark:text-white capitalize text-sm">{exam.examType || 'N/A'}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-black/10 dark:border-white/15 h-full flex flex-col justify-center">
                <p
                  className="text-zinc-500 dark:text-gray-550 uppercase tracking-wider mb-1 text-xs">Difficulty</p>
                <p className="font-medium text-zinc-900 dark:text-white capitalize text-sm">{exam.difficulty}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-black/10 dark:border-white/15 h-full flex flex-col justify-center">
                <p
                  className="text-zinc-500 dark:text-gray-550 uppercase tracking-wider mb-1 text-xs">Questions</p>
                <p className="font-medium text-zinc-900 dark:text-white text-sm">{exam.totalQuestions}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-black/10 dark:border-white/15 h-full flex flex-col justify-center">
                <p
                  className="text-zinc-500 dark:text-gray-555 uppercase tracking-wider mb-1 text-xs">Total Marks</p>
                <p className="font-medium text-zinc-900 dark:text-white text-sm">{exam.totalMarks}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p
                className="text-zinc-500 dark:text-gray-550 uppercase tracking-wider text-xs">Subjects</p>
              <div className="flex flex-wrap gap-2">
                {exam.subjects.map((sub: any, idx: number) => (
                  <span
                    key={idx}
                    className="bg-blue-500/5 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-xl font-medium text-xs">
                    {sub.name}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="pt-2 flex justify-between border-t border-black/10 dark:border-white/10 text-xs">
              {exam.startDateTime && exam.startDateTime !== 'anytime' && exam.endDateTime && exam.endDateTime !== 'anytime' ? (
                <span className="w-full text-center text-zinc-500 dark:text-gray-500">
                  {formatSimpleDate(exam.startDateTime)} — {formatSimpleDate(exam.endDateTime)}
                </span>
              ) : (
                <span className="w-full text-center text-zinc-500 dark:text-gray-500">Available anytime</span>
              )}
            </div>

            <div className="pt-4 space-y-3">
              {(() => {
                const isExpired = exam.status === 'Expired';
                const canStart = exam.status === 'Pending' || exam.status === 'active';

                if (!canStart) {
                  let message = "This exam cannot be started.";
                  if (isExpired) message = "This exam has expired.";
                  else if (exam.status === 'Ongoing') message = "This exam is already ongoing.";
                  else if (exam.status === 'Completed') message = "This exam is already completed.";
                  console.log('[ExamInfoModal] Start blocked:', message, '| status:', JSON.stringify(exam.status));

                  return (
                    <div className="space-y-3">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="font-medium text-xs">{message}</p>
                      </div>
                      {exam.status === 'Completed' && (
                        <button
                          onClick={() => {
                            onClose();
                            if (resultId) {
                              navigate(`/results/${resultId}`);
                            } else {
                              navigate(`/results`);
                            }
                          }}
                          disabled={fetchingResult}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 group text-base cursor-pointer font-semibold"
                        >
                          {fetchingResult ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              See Result
                              <ChevronLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    onClick={() => navigate(`/exam/${exam.id}`)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group text-base font-semibold cursor-pointer">Start Exam Now
                    <ChevronLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })()}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
