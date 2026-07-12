import React from 'react';
import { createPortal } from 'react-dom';
import MathText from '../../ui/MathText';
import { Printer, X } from 'lucide-react';

interface PrintQuestionProps {
  isOpen: boolean;
  onClose: () => void;
  examName: string;
  questions: any[];
  examMeta: {
    totalTime: number;
    totalMarks: number;
    correctMarks: number;
    negativeMarks: number;
  };
}

export default function PrintQuestion({
  isOpen,
  onClose,
  examName,
  questions,
  examMeta
}: PrintQuestionProps) {
  const [progress, setProgress] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setProgress(0);


    let currentProgress = 0;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90;
        return prev + 6;
      });
    }, 45);


    const triggerTypeset = async () => {

      await new Promise(resolve => setTimeout(resolve, 400));

      if (window.MathJax?.typesetPromise && previewContainerRef.current) {
        try {
          await window.MathJax.typesetPromise([previewContainerRef.current]);
        } catch (e) {
          console.error(e);
        }
      }


      setProgress(100);
      clearInterval(interval);
      setTimeout(() => {
        setIsLoading(false);
      }, 150);
    };

    triggerTypeset();

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerPrint = () => {
    window.print();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden no-print-overlay">
      <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-zinc-200/50 dark:border-gray-800 flex items-center justify-between bg-zinc-50/50 dark:bg-gray-900/50 backdrop-blur-md">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Print Preview</h3>
            <p className="text-[10px] text-zinc-550 dark:text-gray-400">Generate clean paper sheets and answer keys</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerPrint}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-250 dark:disabled:bg-gray-800 disabled:text-zinc-500 text-white rounded-xl text-xs font-medium shadow-md hover:shadow-lg disabled:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Exam
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer text-zinc-500 dark:text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-grow p-6 overflow-y-auto bg-zinc-50 dark:bg-gray-950 flex justify-center items-start">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/90 dark:bg-gray-950/90 backdrop-blur-xs z-10 gap-2 pointer-events-none animate-in fade-in duration-200">
              <div className="w-64 flex flex-col items-center gap-2">
                <div className="w-full bg-zinc-250 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-100 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-gray-400 font-semibold">Preparing  {progress}%</span>
              </div>
            </div>
          )}

          <div
            ref={previewContainerRef}
            className={`w-full max-w-3xl text-zinc-900 dark:text-zinc-100 p-4 font-sans transition-all duration-350 ${isLoading ? 'opacity-0 h-0 overflow-hidden pointer-events-none' : 'opacity-100'
              }`}
          >

            <div>
              <div className="text-center pb-2 mb-4">
                <h1 className="text-xl font-bold uppercase tracking-wide">{examName || 'EXAMINATION'}</h1>
              </div>

              <div className="flex justify-between items-start text-xs pb-3 mb-4 text-zinc-550 dark:text-gray-400">
                <div>
                  <div><span className="font-bold">Total Marks:</span> {examMeta.totalMarks}</div>
                  <div className="mt-1"><span className="font-bold">Marking Scheme:</span> +{examMeta.correctMarks} / -{examMeta.negativeMarks}</div>
                </div>
                <div className="text-right">
                  <div><span className="font-bold">Duration:</span> {examMeta.totalTime} Minutes</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-zinc-200 dark:border-gray-800 pb-4 mb-6">
                <div className="flex-grow flex items-center gap-2">
                  <span className="font-semibold text-zinc-700 dark:text-gray-300">Student Name:</span>
                  <span className="flex-grow border-b border-dashed border-zinc-450 dark:border-gray-600 h-4"></span>
                </div>
                <div className="w-48 ml-8 flex items-center gap-2">
                  <span className="font-semibold text-zinc-700 dark:text-gray-300">Date:</span>
                  <span className="flex-grow border-b border-dashed border-zinc-455 dark:border-gray-600 h-4"></span>
                </div>
              </div>

              <div className="space-y-8">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="text-sm leading-relaxed avoid-break">
                    <div className="font-medium flex gap-3 items-start">
                      <span className="font-semibold text-zinc-850 dark:text-zinc-200">{idx + 1}.</span>
                      <div className="flex-grow">
                        <MathText text={q.text} />
                      </div>
                    </div>

                    {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="flex flex-col gap-3 mt-3 ml-7">
                        {q.options.map((opt: string, oIdx: number) => (
                          <div key={oIdx} className="flex items-start gap-2.5 text-xs py-1">
                            <span className="border border-zinc-400 dark:border-gray-600 rounded-sm w-4 h-4 flex-shrink-0 flex items-center justify-center font-semibold text-[10px]">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="leading-relaxed"><MathText text={opt} /></span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(!q.options || q.options.length === 0) && (
                      <div className="mt-4 ml-7 border-b border-dashed border-zinc-300 w-48 h-6 text-zinc-400 text-[10px] italic">
                        Write answer here:
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-12 border-t border-zinc-200 dark:border-gray-800 mt-12">
              <div className="text-center pb-4 mb-6">
                <p className="text-xs text-zinc-550 dark:text-gray-450 uppercase font-semibold">Answer Key</p>
              </div>

              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="text-sm leading-relaxed avoid-break py-2 border-b border-zinc-100 dark:border-gray-800">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-zinc-700 dark:text-gray-300">Question {idx + 1}:</span>
                      <div className="space-y-2 flex-grow">
                        <div className="text-zinc-800 dark:text-zinc-200">
                          <MathText text={q.correct_answer} />
                        </div>
                        {q.explanation && (
                          <div className="text-xs text-zinc-600 dark:text-gray-400 leading-relaxed italic mt-1">
                            <span className="font-bold not-italic text-zinc-700 dark:text-gray-300">Solution Path:</span>{' '}
                            <MathText text={q.explanation} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12 pt-4 border-t border-zinc-200 dark:border-gray-850 text-center text-[9px] text-zinc-450 italic">
                This Question & answers are generated in wachsen AI. AI can make mistakes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const printContent = (
    <div
      id="print-wrapper-root"
      className="hidden print:block bg-white text-zinc-900 p-[20mm] font-sans"
    >
      <div>
        <div className="text-center pb-2 mb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide">{examName || 'EXAMINATION'}</h1>
        </div>

        <div className="flex justify-between items-start text-xs pb-3 mb-4 text-zinc-550">
          <div>
            <div><span className="font-bold">Total Marks:</span> {examMeta.totalMarks}</div>
            <div className="mt-1"><span className="font-bold">Marking Scheme:</span> +{examMeta.correctMarks} / -{examMeta.negativeMarks}</div>
          </div>
          <div className="text-right">
            <div><span className="font-bold">Duration:</span> {examMeta.totalTime} Minutes</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs border-b border-zinc-200 pb-4 mb-6">
          <div className="flex-grow flex items-center gap-2">
            <span className="font-bold text-zinc-800">Student Name:</span>
            <span className="flex-grow border-b border-dashed border-zinc-500 h-4"></span>
          </div>
          <div className="w-48 ml-8 flex items-center gap-2">
            <span className="font-bold text-zinc-800">Date:</span>
            <span className="flex-grow border-b border-dashed border-zinc-500 h-4"></span>
          </div>
        </div>

        <div className="space-y-8">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="text-sm leading-relaxed avoid-break">
              <div className="font-medium flex gap-3 items-start">
                <span className="font-semibold text-zinc-850">{idx + 1}.</span>
                <div className="flex-grow">
                  <MathText text={q.text} />
                </div>
              </div>

              {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                <div className="flex flex-col gap-3 mt-3 ml-7">
                  {q.options.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className="flex items-start gap-2.5 text-xs py-1">
                      <span className="border border-zinc-400 rounded-sm w-4 h-4 flex-shrink-0 flex items-center justify-center font-semibold text-[10px]">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="leading-relaxed"><MathText text={opt} /></span>
                    </div>
                  ))}
                </div>
              )}

              {(!q.options || q.options.length === 0) && (
                <div className="mt-4 ml-7 border-b border-dashed border-zinc-300 w-48 h-6 text-zinc-400 text-[10px] italic">
                  Write answer here:
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="page-break pt-12">
        <div className="text-center border-b-2 border-zinc-850 pb-4 mb-6">
          <p className="text-xs text-zinc-550 uppercase font-semibold">Answer Key</p>
        </div>

        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="text-sm leading-relaxed avoid-break py-2 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <span className="font-bold text-zinc-700">Question {idx + 1}:</span>
                <div className="space-y-2 flex-grow">
                  <div className="text-zinc-900">
                    <MathText text={q.correct_answer} />
                  </div>
                  {q.explanation && (
                    <div className="text-xs text-zinc-600 leading-relaxed italic mt-1">
                      <span className="font-bold not-italic text-zinc-700">Solution Path:</span>{' '}
                      <MathText text={q.explanation} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-4 border-t border-zinc-200 text-center text-[9px] text-zinc-400 italic">
          This Question & answers are generated in wachsen AI. AI can make mistakes.
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          #root {
            display: none !important;
          }
          #print-wrapper-root {
            display: block !important;
            visibility: visible !important;
          }
          #print-wrapper-root * {
            visibility: visible !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />
      {modalContent}
      {createPortal(printContent, document.body)}
    </>
  );
}
