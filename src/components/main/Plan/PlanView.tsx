import { useState } from 'react';
import { fontSize } from '../../../lib/utils';
import { ChevronLeft, Calendar, ListTodo, CheckSquare, BrainCircuit, X, Bot } from 'lucide-react';
import PlanViewMonthly from './PlanViewMonthly';
import PlanViewDaily from './PlanViewDaily';
import PlanViewChecklist from './PlanViewChecklist';
import PlanViewMentor from './PlanViewMentor';

interface SubjectChapter {
  subjectName: string;
  chapters: string[];
}

interface MonthPlan {
  month: number;
  subjects: SubjectChapter[];
}

interface PlanViewProps {
  planId: string;
  createdAt: string;
  examName: string;
  days: number;
  planJson: {
    months: MonthPlan[];
  };
  onBack: () => void;
}

type TabType = 'monthly' | 'daily' | 'mentor' | 'checklist';

export default function PlanView({ planId, createdAt, examName, days, planJson, onBack }: PlanViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-50 dark:bg-zinc-950 overflow-y-auto p-6 md:p-10 animate-fadeIn">
      <div className="max-w-4xl mx-auto space-y-6">

        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 animate-fadeIn">
            <span className="font-medium text-xs leading-relaxed">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-650 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center gap-3 animate-fadeIn">
            <span className="font-medium text-xs leading-relaxed">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-650 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-black/15 dark:border-white/20 pb-4 gap-4">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all text-zinc-550 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="font-semibold text-zinc-800 dark:text-white text-base">
            {examName} Roadmap
          </h2>

          <div className="w-10" />
        </div>

        <div className="flex bg-zinc-100 dark:bg-gray-900/80 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${activeTab === 'monthly'
              ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm border border-zinc-250/20'
              : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-850 dark:hover:text-white'
              }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Monthly Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${activeTab === 'daily'
              ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm border border-zinc-250/20'
              : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-850 dark:hover:text-white'
              }`}
          >
            <ListTodo className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Daily Tasks</span>
          </button>

          <button
            onClick={() => setActiveTab('mentor')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${activeTab === 'mentor'
              ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm border border-zinc-250/20'
              : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-850 dark:hover:text-white'
              }`}
          >
            <Bot className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Mentor AI</span>
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${activeTab === 'checklist'
              ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-sm border border-zinc-250/20'
              : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-850 dark:hover:text-white'
              }`}
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Syllabus Progress</span>
          </button>
        </div>

        <div className="pt-2">
          {activeTab === 'monthly' && (
            <PlanViewMonthly createdAt={createdAt} planJson={planJson} />
          )}

          {activeTab === 'daily' && (
            <PlanViewDaily
              planId={planId}
              createdAt={createdAt}
              planJson={planJson}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {activeTab === 'mentor' && (
            <PlanViewMentor
              planId={planId}
              createdAt={createdAt}
            />
          )}

          {activeTab === 'checklist' && (
            <PlanViewChecklist planId={planId} planJson={planJson} />
          )}
        </div>

      </div>
    </div>
  );
}
