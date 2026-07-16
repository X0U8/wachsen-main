import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import MathText from '../../ui/MathText';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Question {
  id: string;
  text?: string;
  question?: string;
  correctAnswer?: string;
  correct_answer?: string;
  questionType?: string;
  type?: string;
  shuffledOptions?: string[];
  options?: string[];
}

interface RevisionRetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  retryData: Question[];
}

function normalizeQuestionType(type?: string): string {
  if (!type) return 'mcq';
  const t = type.toLowerCase();
  if (t.includes('multiple') || t.includes('choice') || t === 'mcq') return 'mcq';
  if (t.includes('integer') || t === 'integer') return 'integer';
  if (t.includes('true') || t.includes('false') || t === 'true_false') return 'true_false';
  return 'mcq';
}

export default function RevisionRetryModal({
  isOpen,
  onClose,
  retryData = []
}: RevisionRetryModalProps) {
  const [normalizedQuestions, setNormalizedQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { isCorrect: boolean }>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isFinished = Object.keys(results).length === retryData.length && retryData.length > 0;

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setAnswers({});
      setResults({});
      setQuestionTimes({});
      setStartTime(Date.now());
      setIsTransitioning(false);

      const normalized = retryData.map(q => {
        const qType = normalizeQuestionType(q.type || q.questionType);
        let shuffled = q.shuffledOptions;
        if (!shuffled && qType === 'mcq' && Array.isArray(q.options)) {
          shuffled = [...q.options].sort(() => Math.random() - 0.5);
        } else if (!shuffled && qType === 'true_false') {
          shuffled = ['True', 'False'];
        }
        return {
          ...q,
          shuffledOptions: shuffled
        };
      });
      setNormalizedQuestions(normalized);
    }
  }, [isOpen, retryData]);

  useEffect(() => {
    if (isOpen && !isFinished) {
      setStartTime(Date.now());
    }
  }, [currentIndex, isOpen, isFinished]);

  if (!isOpen || normalizedQuestions.length === 0) return null;

  const question = normalizedQuestions[currentIndex];
  const result = results[question.id];
  const answer = answers[question.id];

  const qType = normalizeQuestionType(question.type || question.questionType);
  const isMCQ = qType === 'mcq';
  const isInteger = qType === 'integer';
  const isTrueFalse = qType === 'true_false';

  const handleAnswerSubmit = (submittedValue: string) => {
    if (result) return;
    const trimmedVal = submittedValue.trim();
    setAnswers(prev => ({ ...prev, [question.id]: trimmedVal }));

    const correctAns = String(question.correctAnswer ?? question.correct_answer ?? '').trim();
    const isCorrect = correctAns.toLowerCase() === trimmedVal.toLowerCase();

    setResults(prev => ({
      ...prev,
      [question.id]: { isCorrect }
    }));

    const elapsed = Math.round((Date.now() - startTime) / 1000) || 1;
    setQuestionTimes(prev => ({ ...prev, [currentIndex]: elapsed }));
  };

  const handleNext = () => {
    if (currentIndex < retryData.length - 1) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }
  };

  const correctCount = Object.values(results).filter(r => r.isCorrect).length;
  const totalCount = retryData.length;
  const percentage = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  const chartData = retryData.map((_, idx) => ({
    name: `Q${idx + 1}`,
    seconds: questionTimes[idx] || 0
  }));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg h-[620px] flex flex-col shadow-2xl relative text-zinc-900 dark:text-white justify-between overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-900 flex-shrink-0">
          <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-xs">Retry Questions</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <>
            {/* Card Content wrapper */}
            <div className="flex-grow flex flex-col justify-between my-2 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <div className="text-zinc-450 dark:text-zinc-500 font-semibold tracking-wider text-[10px] ">
                  Question {currentIndex + 1} of {retryData.length}
                </div>

                {/* Snapping Card Wrapper */}
                <div
                  className={`w-full ${isTransitioning ? 'transition-none opacity-0' : 'transition-all duration-300 opacity-100'}`}
                >
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-4 space-y-4 shadow-xs">
                    <h4 className="font-medium text-zinc-850 dark:text-zinc-150 leading-relaxed text-sm">
                      <MathText text={question.question || question.text || ''} />
                    </h4>

                    {/* MCQs and True/False */}
                    {(isMCQ || isTrueFalse) && (
                      <div className="space-y-2 pt-2">
                        {(question.shuffledOptions || []).map((option: string, optIdx: number) => {
                          const isSelected = answer === option;
                          const isCorrect = String(question.correctAnswer ?? question.correct_answer ?? '').trim().toLowerCase() === option.trim().toLowerCase();

                          let optionStyle = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-300';
                          if (isSelected) {
                            optionStyle = 'bg-blue-600/10 border-blue-600 text-zinc-900 dark:text-white';
                          }
                          if (result) {
                            if (isCorrect) {
                              optionStyle = 'bg-green-600/15 border-green-600 text-green-700 dark:text-green-400 font-semibold';
                            } else if (isSelected && !isCorrect) {
                              optionStyle = 'bg-red-600/15 border-red-650 text-red-600 dark:text-red-400';
                            } else {
                              optionStyle = 'opacity-50 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-300';
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={!!result}
                              onClick={() => handleAnswerSubmit(option)}
                              className={`w-full p-3 border rounded-2xl text-left text-xs transition-all flex items-center gap-2.5 cursor-pointer ${optionStyle}`}
                            >
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-350 dark:border-zinc-800'
                                  } text-[10px]`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </div>
                              <span className="leading-relaxed">
                                <MathText text={option} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Integer Input */}
                    {isInteger && (
                      <div className="space-y-3 pt-2">
                        <input
                          type="text"
                          value={answer || ''}
                          onChange={(e) => !result && setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                          disabled={!!result}
                          placeholder="Enter numeric answer..."
                          className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                        />
                        {!result && (
                          <button
                            onClick={() => handleAnswerSubmit(answer || '')}
                            disabled={!answer}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer shadow-md"
                          >
                            Submit Answer
                          </button>
                        )}
                      </div>
                    )}

                    {/* Result Badge */}
                    {result && (
                      <div className={`p-3 rounded-xl text-xs font-semibold ${result.isCorrect
                        ? 'bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-655 dark:text-red-400'
                        }`}>
                        {result.isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex gap-2 justify-end pt-2 flex-shrink-0 border-t border-zinc-150 dark:border-zinc-900">
              {result && (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  {currentIndex === retryData.length - 1 ? 'Finish Practice' : 'Next Question'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        ) : (
          /* Summary Screen */
          <div className="flex-grow flex flex-col justify-between bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 my-3 overflow-y-auto">
            <div className="text-center space-y-3 flex-grow flex flex-col justify-center">
              <div>
                <h4 className="font-semibold text-zinc-450 dark:text-zinc-500  tracking-wider text-[10px]">Practice Completed</h4>
                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                  {correctCount} / {totalCount} Correct
                </div>
                <div className="text-zinc-550 dark:text-zinc-400 text-[10px] font-semibold mt-1">
                  Accuracy: {Math.round(percentage)}%
                </div>
              </div>

              {/* Time spent line chart */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[9px] font-semibold text-zinc-400  tracking-wider text-left pl-2">Time Spent per Question (seconds)</p>
                <div className="h-[140px] w-full bg-white dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          borderColor: '#27272a',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '10px'
                        }}
                      />
                      <Line type="monotone" dataKey="seconds" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="pt-2 flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-white transition-all cursor-pointer text-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
