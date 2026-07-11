import { useState, useEffect } from 'react';
import { idbGet, idbSet } from '../../../lib/idb';
import { TrendingUp, Loader2 } from 'lucide-react';

interface SubjectChapter {
  subjectName: string;
  chapters: string[];
}

interface MonthPlan {
  month: number;
  subjects: SubjectChapter[];
}

interface PlanViewChecklistProps {
  planId: string;
  planJson: {
    months: MonthPlan[];
  };
}

export default function PlanViewChecklist({ planId, planJson }: PlanViewChecklistProps) {
  const [checkedChapters, setCheckedChapters] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');

  // Load progress from IndexedDB on mount
  useEffect(() => {
    const loadProgress = async () => {
      const saved = await idbGet(`study_plan_progress_${planId}`);
      setCheckedChapters(saved || {});
      setLoaded(true);
    };
    loadProgress();
  }, [planId]);

  // Group chapters subject-wise
  const groupedSubjects: Record<string, string[]> = {};
  planJson.months.forEach(m => {
    m.subjects.forEach(sub => {
      if (!groupedSubjects[sub.subjectName]) {
        groupedSubjects[sub.subjectName] = [];
      }
      sub.chapters.forEach(chap => {
        if (!groupedSubjects[sub.subjectName].includes(chap)) {
          groupedSubjects[sub.subjectName].push(chap);
        }
      });
    });
  });

  const handleToggle = async (key: string) => {
    const updated = { ...checkedChapters, [key]: !checkedChapters[key] };
    setCheckedChapters(updated);
    await idbSet(`study_plan_progress_${planId}`, updated);
  };

  // Stats calculation (overall chapters)
  const totalChaptersList: { subjectName: string; chapterName: string; key: string }[] = [];
  Object.keys(groupedSubjects).forEach(subName => {
    groupedSubjects[subName].forEach(chap => {
      totalChaptersList.push({
        subjectName: subName,
        chapterName: chap,
        key: `${subName}-${chap}`
      });
    });
  });

  const completedCount = totalChaptersList.filter(item => checkedChapters[item.key]).length;
  const totalChaptersCount = totalChaptersList.length;
  const progressPercent = totalChaptersCount > 0 ? Math.round((completedCount / totalChaptersCount) * 100) : 0;

  const subjectsList = ['All', ...Object.keys(groupedSubjects)];

  // Determine subjects to show based on selected filter
  const subjectsToShow = selectedSubject === 'All' 
    ? Object.keys(groupedSubjects) 
    : [selectedSubject];

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 gap-2.5">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="text-zinc-400 text-xs">Loading progress...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Progress header card */}
      <div className="flex flex-col md:flex-row items-center gap-6 p-5 bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-3xl shadow-sm">
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="34"
              className="stroke-zinc-200 dark:stroke-zinc-800"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              className="stroke-blue-500 transition-all duration-500"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={213.6}
              strokeDashoffset={213.6 - (213.6 * progressPercent) / 100}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute font-mono text-base font-black text-blue-500">
            {progressPercent}%
          </span>
        </div>

        <div className="text-center md:text-left space-y-1.5">
          <h4 className="text-sm font-bold text-zinc-850 dark:text-white flex items-center gap-1.5 justify-center md:justify-start">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Syllabus Completion
          </h4>
          <p className="text-zinc-500 dark:text-gray-400 text-xs leading-relaxed">
            You have completed <strong className="text-zinc-700 dark:text-white">{completedCount}</strong> out of <strong className="text-zinc-700 dark:text-white">{totalChaptersCount}</strong> chapters. Tick off items below as you study them!
          </p>
        </div>
      </div>

      {/* Horizontally scrollable subject selector bubbles row */}
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-2 scrollbar-none border-b border-zinc-200/60 dark:border-gray-800/80">
        {subjectsList.map((sub) => (
          <button
            key={sub}
            onClick={() => setSelectedSubject(sub)}
            className={`px-4.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 ${
              selectedSubject === sub
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-900 border-zinc-250 dark:border-gray-800 text-zinc-650 dark:text-gray-350 hover:bg-zinc-50 dark:hover:bg-white/5'
            }`}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Grouped Subject checklist panels */}
      <div className="space-y-5 max-h-[380px] overflow-y-auto pr-1">
        {subjectsToShow.map((subName) => {
          if (!groupedSubjects[subName]) return null;
          return (
            <div key={subName} className="space-y-2.5 animate-fadeIn">
              <h5 className="text-xs font-bold text-zinc-400 dark:text-gray-500 uppercase tracking-widest pl-1 border-b border-zinc-200 dark:border-gray-850 pb-1">
                {subName} ({groupedSubjects[subName].filter(chap => checkedChapters[`${subName}-${chap}`]).length} / {groupedSubjects[subName].length})
              </h5>
              
              <div className="grid md:grid-cols-2 gap-2">
                {groupedSubjects[subName].map((chap) => {
                  const key = `${subName}-${chap}`;
                  const isChecked = !!checkedChapters[key];
                  return (
                    <div
                      key={chap}
                      onClick={() => handleToggle(key)}
                      className={`p-3.5 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                        isChecked
                          ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-white/40 dark:bg-gray-900/40 border-zinc-200 dark:border-gray-800 text-zinc-700 dark:text-gray-300 hover:border-zinc-300 dark:hover:border-gray-705'
                      }`}
                    >
                      <span className="font-semibold text-xs leading-relaxed">
                        {chap}
                      </span>

                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        isChecked
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-gray-750'
                      }`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
