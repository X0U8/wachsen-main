import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import MathText from '../../../ui/MathText';
import { useUserProfile } from '../../../lib/UserContext.tsx';
import { Lock, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { fontSize } from '../../../lib/utils';

interface SubjectChapter {
  subjectName: string;
  chapters: string[];
}

interface MonthPlan {
  month: number;
  subjects: SubjectChapter[];
}

interface PlanViewDailyProps {
  planId: string;
  createdAt: string;
  planJson: {
    months: MonthPlan[];
  };
  setErrorMsg: (val: string | null) => void;
  setSuccessMsg: (val: string | null) => void;
}

export default function PlanViewDaily({
  planId,
  createdAt,
  planJson,
  setErrorMsg,
  setSuccessMsg
}: PlanViewDailyProps) {
  const { userProfile, refreshCredits } = useUserProfile();
  const todayRef = useRef<HTMLDivElement | null>(null);
  const [loadedDetails, setLoadedDetails] = useState<Record<number, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({});
  const [generatingDetails, setGeneratingDetails] = useState<boolean>(false);


  const createdDate = new Date(createdAt);
  const currentDate = new Date();

  const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
  const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();

  const diffDays = Math.max(0, Math.floor((currentMidnight - createdMidnight) / (1000 * 60 * 60 * 24)));
  const currentActiveMonth = Math.floor(diffDays / 30) + 1;
  const currentDayInMonth = (diffDays % 30) + 1;

  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(
    Math.min(currentActiveMonth, planJson?.months?.length || 1)
  );


  const getMonthDateRange = (createdDateStr: string, monthNum: number) => {
    const start = new Date(createdDateStr);
    start.setDate(start.getDate() + (monthNum - 1) * 30);
    const end = new Date(start);
    end.setDate(start.getDate() + 29);

    const formatDateStr = (d: Date) => {
      const day = d.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
      const month = d.toLocaleString('en', { month: 'long' });
      return `${day}${suffix} ${month}`;
    };
    return `${formatDateStr(start)} – ${formatDateStr(end)}`;
  };

  const getUnlockDateString = (mNum: number) => {
    const unlockDate = new Date(createdDate);
    unlockDate.setDate(createdDate.getDate() + (mNum - 1) * 30);
    return unlockDate.toLocaleDateString(undefined, { dateStyle: 'medium' });
  };

  const ordinalSuffix = (day: number) =>
    day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';

  const formatBlockDates = (raw: string) => {

    if (!raw) return raw;
    const parts = raw.split(/\s+(?:to|–|-)\s+/);
    if (parts.length !== 2) return raw;
    const parse = (s: string) => {

      const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) {
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        const day = d.getDate();
        return `${day}${ordinalSuffix(day)} ${d.toLocaleString('en', { month: 'long' })}`;
      }
      return s;
    };
    return `${parse(parts[0])} – ${parse(parts[1])}`;
  };


  useEffect(() => {

    if (selectedMonthNum > currentActiveMonth) return;
    if (loadedDetails[selectedMonthNum]) return;

    const fetchMonthDetails = async () => {
      setLoadingDetails(prev => ({ ...prev, [selectedMonthNum]: true }));
      try {
        const { data, error } = await supabase
          .from('study_plan_details')
          .select('details_json')
          .eq('plan_id', planId)
          .eq('month_number', selectedMonthNum)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setLoadedDetails(prev => ({
            ...prev,
            [selectedMonthNum]: data.details_json
          }));
        }
      } catch (err) {
        console.error('Failed to load month details:', err);
      } finally {
        setLoadingDetails(prev => ({ ...prev, [selectedMonthNum]: false }));
      }
    };

    fetchMonthDetails();
  }, [selectedMonthNum, currentActiveMonth]);


  useEffect(() => {
    if (selectedMonthNum === currentActiveMonth && loadedDetails[selectedMonthNum]) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [loadedDetails[selectedMonthNum]]);

  const handleGenerateDetailedTasks = async () => {
    if (generatingDetails) return;
    setGeneratingDetails(true);
    setErrorMsg(null);

    const useOwnKey = localStorage.getItem('use_own_key') === 'true';


    if (useOwnKey) {
      setErrorMsg("Detailed monthly tasks can only be generated using our default credit system. Please disable 'Use Own Key' in Settings.");
      setGeneratingDetails(false);
      return;
    }


    if (selectedMonthNum !== currentActiveMonth) {
      setErrorMsg(`Detailed tasks can only be generated during the active month (Month ${currentActiveMonth}).`);
      setGeneratingDetails(false);
      return;
    }

    const detailCost = 15;
    const userCredits = userProfile?.credits || 0;

    if (userCredits < detailCost) {
      setErrorMsg(`Insufficient credits. Generating detailed tasks costs ${detailCost} credits. You have ${userCredits}.`);
      setGeneratingDetails(false);
      return;
    }

    try {
      const session = await supabase.auth.getSession();
      const authToken = session.data?.session?.access_token || '';

      const monthConfig = planJson.months.find(m => m.month === selectedMonthNum);
      if (!monthConfig) throw new Error(`Plan configuration not found for month ${selectedMonthNum}`);

      const monthStartDate = new Date(createdDate);
      monthStartDate.setDate(createdDate.getDate() + (selectedMonthNum - 1) * 30);
      const startDateStr = monthStartDate.toISOString().split('T')[0];

      const response = await fetch('/api/generate-monthly-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: monthConfig.subjects,
          monthNumber: selectedMonthNum,
          startDateStr,
          userId: userProfile?.id,
          authToken
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate detailed tasks.');
      }

      const { error: saveError } = await supabase
        .from('study_plan_details')
        .insert({
          plan_id: planId,
          user_id: userProfile?.id,
          month_number: selectedMonthNum,
          details_json: data.tasks
        });

      if (saveError) throw saveError;

      setLoadedDetails(prev => ({
        ...prev,
        [selectedMonthNum]: data.tasks
      }));
      refreshCredits();
      setSuccessMsg(`Month ${selectedMonthNum} detailed tasks generated successfully!`);
      setTimeout(() => setSuccessMsg(null), 3000);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to generate detailed tasks.');
    } finally {
      setGeneratingDetails(false);
    }
  };

  const isMonthLocked = selectedMonthNum > currentActiveMonth;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-gray-800 pb-3">
        {planJson.months.map(m => {
          const isLocked = currentActiveMonth < m.month;
          return (
            <button
              key={m.month}
              onClick={() => setSelectedMonthNum(m.month)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${selectedMonthNum === m.month
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : isLocked
                  ? 'bg-zinc-100/50 dark:bg-zinc-950/20 border-zinc-200 dark:border-gray-850 text-zinc-400 dark:text-gray-650'
                  : 'bg-white dark:bg-zinc-900 border-zinc-250 dark:border-gray-800 text-zinc-650 dark:text-gray-350 hover:bg-zinc-50 dark:hover:bg-white/5'
                }`}
            >
              Month {m.month}
              {isLocked && <Lock className="w-3 h-3 text-zinc-400" />}
            </button>
          );
        })}
      </div>
      {isMonthLocked ? (
        <div className="border border-zinc-300 dark:border-gray-850 rounded-3xl p-12 text-center flex flex-col items-center gap-3 bg-white/20 dark:bg-gray-900/20">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-gray-650 rounded-full border border-zinc-200 dark:border-gray-800">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-zinc-805 dark:text-gray-250 text-sm">Month {selectedMonthNum} is Locked</h4>
            <p className="text-zinc-450 dark:text-gray-450 mt-1 text-xs">
              Syllabus schedule will unlock on <strong className="text-zinc-705 dark:text-white">{getUnlockDateString(selectedMonthNum)}</strong> ({getMonthDateRange(createdAt, selectedMonthNum)}).
            </p>
          </div>
        </div>
      ) : loadingDetails[selectedMonthNum] ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-zinc-400 text-xs font-semibold">Loading month details...</p>
        </div>
      ) : loadedDetails[selectedMonthNum] ? (
        <div className="space-y-6 relative border-l-2 border-zinc-200 dark:border-gray-800 ml-4 pl-6 md:pl-8 py-2">
          {loadedDetails[selectedMonthNum].map((block, idx) => {
            const blockStartDay = idx * Math.ceil(30 / loadedDetails[selectedMonthNum].length) + 1;
            const blockEndDay = Math.min(blockStartDay + Math.ceil(30 / loadedDetails[selectedMonthNum].length) - 1, 30);
            const isToday = selectedMonthNum === currentActiveMonth &&
              currentDayInMonth >= blockStartDay && currentDayInMonth <= blockEndDay;
            return (
              <div key={idx} ref={isToday ? todayRef : null} className="relative group animate-fadeIn space-y-2">
                <div className="absolute -left-[31px] md:-left-[39px] top-1 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-zinc-950 flex items-center justify-center transition-colors group-hover:bg-blue-500" />

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h4 className="text-sm font-extrabold text-zinc-800 dark:text-white  tracking-wide">
                    {block.label || `Block ${idx + 1}`}
                  </h4>
                  <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    {formatBlockDates(block.dates)}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-3 pt-1">
                  {block.subjects.map((sub: any, sIdx: number) => (
                    <div
                      key={sIdx}
                      className="p-3.5 bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-2xl space-y-1 hover:border-zinc-300 dark:hover:border-gray-700 transition-colors shadow-sm"
                    >
                      <span className="text-xs font-bold text-zinc-400 dark:text-gray-500 tracking-widest block">
                        <MathText text={sub.subjectName} />
                      </span>
                      <p className="text-zinc-755 dark:text-gray-300 text-xs leading-relaxed font-medium">
                        <MathText text={sub.task || 'Revision / Mock practice'} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (

        <div className="border border-dashed border-black/15 dark:border-white/20 rounded-3xl p-8 text-center flex flex-col items-center gap-4 bg-white dark:bg-zinc-900/40">
          {generatingDetails ? (
            <div className="space-y-4 py-4 flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <div className="space-y-1">
                <p className="font-semibold text-zinc-705 dark:text-white text-xs">Generating detailed daily tasks...</p>
                <p className="text-zinc-400 text-xs">Processing month date horizon: {getMonthDateRange(createdAt, selectedMonthNum)}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="font-semibold text-zinc-900 dark:text-white text-base">
                  Generate tasks for Month {selectedMonthNum}
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium text-xs">
                  {getMonthDateRange(createdAt, selectedMonthNum)}
                </p>
                {selectedMonthNum !== currentActiveMonth && (
                  <p className="text-xs text-red-500 font-semibold bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 mt-3.5">
                    Notice: Detailed tasks can only be generated during the active month (Month {currentActiveMonth}).
                  </p>
                )}
              </div>

              <div className="text-zinc-550 dark:text-zinc-400 font-medium text-xs">
                planning cost: <strong className="text-blue-600 dark:text-blue-400 font-bold">15 credits</strong>
              </div>

              <button
                onClick={handleGenerateDetailedTasks}
                disabled={selectedMonthNum !== currentActiveMonth}
                className="px-5 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-550 disabled:border-transparent text-white font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-xs">
                Generate Tasks
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
