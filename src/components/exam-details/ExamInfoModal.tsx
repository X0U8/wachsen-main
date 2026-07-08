import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, AlertCircle, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fontSize } from '../../lib/utils';

interface Exam {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
  status: 'Completed' | 'Pending' | 'Ongoing' | 'Expired';
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
  onOpenTemplate: () => void;
  formatSimpleDate: (date: string) => string;
  templateCount?: number;
  maxTemplates?: number;
}

export default function ExamInfoModal({ exam, onClose, onOpenTemplate, formatSimpleDate, templateCount = 0, maxTemplates = 5 }: ExamInfoModalProps) {
  const navigate = useNavigate();
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
          className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-md space-y-6 shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-gray-800 rounded-full text-zinc-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium text-zinc-900 dark:text-gray-100" style={{ fontSize: fontSize.lg }}>{exam.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${exam.status === 'Completed' ? 'bg-green-500/10 text-green-500' :
                    exam.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                      exam.status === 'Expired' ? 'bg-red-500/10 text-red-500' :
                        'bg-yellow-500/10 text-yellow-500'
                  }`} style={{ fontSize: '0.625rem' }}>
                  {exam.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-zinc-200 dark:border-gray-800/50 h-full flex flex-col justify-center">
                <p className="text-zinc-500 dark:text-gray-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.625rem' }}>Exam Type</p>
                <p className="font-medium text-zinc-900 dark:text-white capitalize" style={{ fontSize: fontSize.sm }}>{exam.examType || 'N/A'}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-zinc-200 dark:border-gray-800/50 h-full flex flex-col justify-center">
                <p className="text-zinc-500 dark:text-gray-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.625rem' }}>Difficulty</p>
                <p className="font-medium text-zinc-900 dark:text-white capitalize" style={{ fontSize: fontSize.sm }}>{exam.difficulty}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-zinc-200 dark:border-gray-800/50 h-full flex flex-col justify-center">
                <p className="text-zinc-500 dark:text-gray-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.625rem' }}>Questions</p>
                <p className="font-medium text-zinc-900 dark:text-white" style={{ fontSize: fontSize.sm }}>{exam.totalQuestions}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black/50 p-3 rounded-2xl border border-zinc-200 dark:border-gray-800/50 h-full flex flex-col justify-center">
                <p className="text-zinc-500 dark:text-gray-500 uppercase tracking-wider mb-1" style={{ fontSize: '0.625rem' }}>Total Marks</p>
                <p className="font-medium text-zinc-900 dark:text-white" style={{ fontSize: fontSize.sm }}>{exam.totalMarks}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-zinc-500 dark:text-gray-500 uppercase tracking-wider" style={{ fontSize: '0.625rem' }}>Subjects</p>
              <div className="flex flex-wrap gap-2">
                {exam.subjects.map((sub: any, idx: number) => (
                  <span key={idx} className="bg-blue-500/5 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-xl font-medium" style={{ fontSize: fontSize.xs }}>
                    {sub.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-between border-t border-zinc-200 dark:border-gray-800/50" style={{ fontSize: '0.625rem' }}>
              {exam.startDateTime && exam.startDateTime !== 'anytime' && exam.endDateTime && exam.endDateTime !== 'anytime' ? (
                <span className="w-full text-center text-zinc-500 dark:text-gray-500">
                  {formatSimpleDate(exam.startDateTime)} — {formatSimpleDate(exam.endDateTime)}
                </span>
              ) : (
                <span className="w-full text-center text-zinc-500 dark:text-gray-500">Available anytime</span>
              )}
            </div>

            <div className="pt-4 space-y-3">
              {!exam.isTemplate && (
                <div className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-gray-800 rounded-xl">
                  <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>
                    {maxTemplates - templateCount} template{maxTemplates - templateCount !== 1 ? 's' : ''} left
                  </span>
                </div>
              )}
              {(!exam.isTemplate && templateCount >= maxTemplates) ? (
                <div className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center gap-2" style={{ fontSize: fontSize.sm }}>
                  <AlertCircle className="w-4 h-4" />
                  Template limit reached
                </div>
              ) : (
                <button
                  onClick={onOpenTemplate}
                  className="w-full py-3 bg-zinc-100 dark:bg-gray-800 hover:bg-zinc-200 dark:hover:bg-gray-700 text-zinc-600 dark:text-gray-300 rounded-2xl transition-all flex items-center justify-center gap-2"
                  style={{ fontSize: fontSize.sm }}
                >
                  <GraduationCap className="w-4 h-4" />
                  {exam.isTemplate ? 'Edit Template' : 'Mark as Template'}
                </button>
              )}

              {(() => {
                const isExpired = exam.status === 'Expired';
                const canStart = exam.status === 'Pending';

                if (!canStart) {
                  let message = "This exam cannot be started.";
                  if (isExpired) message = "This exam has expired.";
                  else if (exam.status === 'Ongoing') message = "This exam is already ongoing.";
                  else if (exam.status === 'Completed') message = "This exam is already completed.";

                  return (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="font-medium" style={{ fontSize: fontSize.xs }}>{message}</p>
                    </div>
                  );
                }

                return (
                  <button
                    onClick={() => navigate(`/exam/${exam.id}`)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group"
                    style={{ fontSize: fontSize.base }}
                  >
                    Start Exam Now
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
