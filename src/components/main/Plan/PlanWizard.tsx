import { useState } from 'react';
import { Plus, X, Sparkles, AlertCircle } from 'lucide-react';
import { fontSize } from '../../../lib/utils';

export interface SubjectInput {
  id: string;
  name: string;
  chapters: string;
}

interface PlanWizardProps {
  examName: string;
  setExamName: (val: string) => void;
  subjects: SubjectInput[];
  setSubjects: React.Dispatch<React.SetStateAction<SubjectInput[]>>;
  days: number;
  setDays: (val: number) => void;
  onGenerate: () => void;
  generating: boolean;
  errorMsg: string | null;
  setErrorMsg: (val: string | null) => void;
  onCancel: () => void;
}

export default function PlanWizard({
  examName,
  setExamName,
  subjects,
  setSubjects,
  days,
  setDays,
  onGenerate,
  generating,
  errorMsg,
  setErrorMsg,
  onCancel
}: PlanWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [subjectText, setSubjectText] = useState<string>('');

  const handleAddSubject = () => {
    const cleaned = subjectText.trim();
    if (!cleaned) return;
    if (cleaned.length > 15) {
      setErrorMsg('Subject name must be 15 characters or less.');
      return;
    }
    if (subjects.find(s => s.name.toLowerCase() === cleaned.toLowerCase())) {
      setErrorMsg('Subject already added.');
      return;
    }
    if (subjects.length >= 5) {
      setErrorMsg('You can add a maximum of 5 subjects.');
      return;
    }

    setSubjects(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: cleaned,
        chapters: ''
      }
    ]);
    setSubjectText('');
    setErrorMsg(null);
  };

  const handleRemoveSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const handleChaptersChange = (id: string, text: string) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, chapters: text } : s));
  };

  return (
    <div className="space-y-6">
      {step === 1 && (
        <div className="bg-white dark:bg-zinc-900/40 border border-black/15 dark:border-white/20 p-6 rounded-3xl max-w-md mx-auto space-y-6 animate-fadeIn shadow-sm">
          <div className="space-y-1 text-center">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-base">What exam are you preparing for?</h3>
            <p className="text-zinc-400 text-xs">You can only have one roadmap at a time</p>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              maxLength={15}
              placeholder="Enter exam name"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-black/15 dark:border-white/20 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-zinc-800 dark:text-white text-center text-sm" />
            <div className="text-right text-zinc-400 font-medium text-xs">
              {examName.length}/15 characters
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onCancel}
              className="w-1/2 py-2.5 border border-black/15 dark:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-650 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer text-xs">
              Cancel
            </button>
            <button
              onClick={() => {
                if (!examName.trim()) {
                  setErrorMsg('Exam target name cannot be empty.');
                  return;
                }
                setErrorMsg(null);
                setStep(2);
              }}
              className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all cursor-pointer text-xs">
              Next
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="bg-white dark:bg-zinc-900/40 border border-black/15 dark:border-white/20 p-6 rounded-3xl max-w-md mx-auto space-y-6 animate-fadeIn shadow-sm">
          <div className="space-y-1 text-center">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-base">Which subjects do you have?</h3>
            <p className="text-zinc-400 font-medium text-xs">subjects: {subjects.length}/5</p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              maxLength={15}
              placeholder="Enter subject name"
              value={subjectText}
              onChange={(e) => setSubjectText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubject(); }}
              className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-black/15 dark:border-white/20 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white font-semibold text-xs" />
            <button
              onClick={handleAddSubject}
              className="px-4 py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {subjects.length === 0 ? (
              <p className="text-center text-zinc-400 py-6 text-xs">No subjects added yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl font-semibold text-xs">
                    <span>{sub.name}</span>
                    <button
                      onClick={() => handleRemoveSubject(sub.id)}
                      className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="w-1/2 py-2.5 border border-black/15 dark:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-650 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer text-xs">
              Back
            </button>
            <button
              onClick={() => {
                if (subjects.length === 0) {
                  setErrorMsg('Please add at least 1 subject.');
                  return;
                }
                setErrorMsg(null);
                setStep(3);
              }}
              className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all cursor-pointer text-xs">
              Next
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="bg-white dark:bg-zinc-900/40 border border-black/15 dark:border-white/20 p-6 rounded-3xl max-w-md mx-auto space-y-6 animate-fadeIn shadow-sm">
          <div className="space-y-1 text-center">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-base">Define syllabus</h3>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-black/5 dark:border-white/8 rounded-2xl space-y-2 text-left"
              >
                <label className="text-zinc-500 dark:text-zinc-400 font-medium block text-xs">
                  {sub.name} chapters
                </label>
                <textarea
                  placeholder="Enter chapters list (comma-separated)"
                  value={sub.chapters}
                  onChange={(e) => handleChaptersChange(sub.id, e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-black/15 dark:border-white/20 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs" />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="w-1/2 py-2.5 border border-black/15 dark:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-650 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer text-xs">
              Back
            </button>
            <button
              onClick={() => {
                const missingChapters = subjects.some(s => !s.chapters.trim());
                if (missingChapters) {
                  setErrorMsg('Please specify the chapters list for all subjects.');
                  return;
                }
                setErrorMsg(null);
                setStep(4);
              }}
              className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all cursor-pointer text-xs">
              Next
            </button>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="bg-white dark:bg-zinc-900/40 border border-black/15 dark:border-white/20 p-6 rounded-3xl max-w-md mx-auto space-y-6 animate-fadeIn shadow-sm">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <div className="space-y-1">
                <p className="font-semibold text-zinc-700 dark:text-white text-xs">Generating study roadmap </p>
                <p className="text-zinc-400" style={{ fontSize: '10px' }}>Analyzing chapters and mapping months, please hold on.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-center mb-3">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-base">When is your exam?</h3>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-center items-center">
                  <span
                    className="text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 dark:bg-blue-500/20 px-3 py-1 rounded-lg text-xs">
                    {Math.round(days / 30)} Months ({days} Days)
                  </span>
                </div>

                <input
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  value={Math.round(days / 30)}
                  onChange={(e) => setDays(parseInt(e.target.value) * 30)}
                  className="w-full accent-blue-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg"
                />

                <div className="flex justify-between text-zinc-400 font-semibold text-xs">
                  <span>2 months</span>
                  <span>12 months</span>
                </div>
              </div>

              <div
                className="text-zinc-550 dark:text-zinc-400 font-medium text-center text-xs">
                planning cost: <strong className="text-blue-600 dark:text-blue-400 font-bold">{Math.round(days / 30) * subjects.length} credits</strong>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="w-1/2 py-2.5 border border-black/15 dark:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-650 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer text-xs">
                  Back
                </button>
                <button
                  onClick={onGenerate}
                  disabled={generating}
                  className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs">
                  Generate
                </button>
              </div>
            </>
          )}
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
