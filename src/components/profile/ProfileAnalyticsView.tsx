import { useState, useEffect } from 'react';
import { useTheme } from '../../lib/ThemeContext';
import { supabase } from '../../services/supabase';
import { fontSize } from '../../lib/utils';
import { User, Library, ChevronLeft, ChevronRight, Flame, Loader2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, BarChart, Bar, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';

interface ProfileAnalyticsViewProps {
  userId: string;
  isOwner: boolean;
}

export default function ProfileAnalyticsView({ userId, isOwner }: ProfileAnalyticsViewProps) {
  const { theme } = useTheme();

  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [chartOffset, setChartOffset] = useState(0);
  const [summaryType, setSummaryType] = useState<'column' | 'line'>('column');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['profileAnalytics', userId, isOwner],
    queryFn: async () => {
      const { data: presData } = await supabase
        .from('user_presence')
        .select('active_days, last_opened')
        .eq('user_id', userId)
        .maybeSingle();

      const { count: madeCount } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true })
        .contains('accessIds', [userId]);

      const { count: gaveCount } = await supabase
        .from('exams')
        .select('*', { count: 'exact', head: true })
        .contains('accessIds', [userId])
        .eq('status', 'Completed');

      const { data: profData } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single();

      let calcMemberDays = 1;
      if (profData?.created_at) {
        const createdDate = new Date(profData.created_at);
        const currentDate = new Date();
        createdDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((currentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        calcMemberDays = Math.max(1, diffDays + 1);
      }

      let fetchedCategories: any[] = [];
      if (isOwner) {
        const { data } = await supabase
          .from('examtypes')
          .select('id, name, Percentages')
          .eq('userId', userId)
          .order('created_at', { ascending: true });
        if (data) {
          fetchedCategories = data;
        }
      }

      return {
        presence: presData,
        examsMadeCount: madeCount || 0,
        examsGaveCount: gaveCount || 0,
        memberDays: calcMemberDays,
        categories: fetchedCategories
      };
    },
    enabled: !!userId,
    staleTime: 0,
    gcTime: Infinity,
  });

  const categories = analyticsData?.categories || [];
  const presence = analyticsData?.presence;
  const examsMadeCount = analyticsData?.examsMadeCount || 0;
  const examsGaveCount = analyticsData?.examsGaveCount || 0;
  const memberDays = analyticsData?.memberDays || 0;

  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  const activeDays = presence?.active_days || [];
  const totalDays = activeDays.reduce((sum: number, val: number) => sum + val, 0);

  const calculateStreak = () => {
    if (activeDays.length === 0) return 0;

    let currentStreak = 0;
    for (let i = activeDays.length - 1; i >= 0; i--) {
      if (activeDays[i] === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
    return currentStreak;
  };

  const streak = calculateStreak();

  const calculateLongestStreak = () => {
    let maxStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < activeDays.length; i++) {
      if (activeDays[i] === 1) {
        tempStreak++;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 0;
      }
    }
    return Math.max(maxStreak, tempStreak);
  };

  const longestStreak = calculateLongestStreak();

  const getPresenceForDate = (dateStr: string) => {
    if (activeDays.length === 0 || !presence?.last_opened) return false;

    const lastOpenedDate = new Date(presence.last_opened);
    const targetDate = new Date(dateStr);

    const utcLast = Date.UTC(lastOpenedDate.getFullYear(), lastOpenedDate.getMonth(), lastOpenedDate.getDate());
    const utcTarget = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.round((utcLast - utcTarget) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < activeDays.length) {
      return activeDays[activeDays.length - 1 - diffDays] === 1;
    }
    return false;
  };

  const activeCategory = categories.find(c => c.id === selectedCatId);
  const rawPercentages = activeCategory?.Percentages || [];

  const getPaginatedData = () => {
    const totalCount = rawPercentages.length;
    const end = totalCount - chartOffset;
    const start = Math.max(0, end - 10);
    const sliced = rawPercentages.slice(start, end);

    return sliced.map((score: number, idx: number) => ({
      name: `Ex ${start + idx + 1}`,
      percentage: score
    }));
  };

  const chartData = getPaginatedData();
  const minScore = rawPercentages.length > 0 ? Math.min(...rawPercentages, 0) : 0;

  const categoryData = categories.map((c) => {
    const plist = c.Percentages || [];
    const avg = plist.length > 0 ? Math.round(plist.reduce((a: number, b: number) => a + b, 0) / plist.length) : 0;

    return {
      id: c.id,
      name: c.id,
      rawName: c.name,
      average: avg,
      exams: plist.length
    };
  });
  const minSummaryScore = categoryData.length > 0 ? Math.min(...categoryData.map(d => d.average), 0) : 0;

  const canPageBack = rawPercentages.length - chartOffset > 10;
  const canPageForward = chartOffset > 0;

  const handlePageBack = () => {
    if (canPageBack) {
      setChartOffset(prev => prev + 10);
    }
  };

  const handlePageForward = () => {
    if (canPageForward) {
      setChartOffset(prev => Math.max(0, prev - 10));
    }
  };

  const renderSingleMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return (
      <div className="w-full space-y-2">
        <div className="text-center font-bold text-zinc-700 dark:text-zinc-300 text-xs py-1">
          {monthName}
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isPresent = getPresenceForDate(dateStr);
            const isToday = new Date().toLocaleDateString('en-CA') === dateStr;

            return (
              <div
                key={dayNum}
                className={`aspect-square flex items-center justify-center rounded-lg text-[10px] font-extrabold transition-all ${isPresent
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isToday
                    ? 'border border-blue-500 text-blue-500'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400'
                  }`}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthlyCalendar = () => {
    const handlePrevMonth = () => {
      setCurrentMonthDate(prev => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() - 1);
        return d;
      });
    };

    const handleNextMonth = () => {
      setCurrentMonthDate(prev => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + 1);
        return d;
      });
    };

    const prevMonthDate = new Date(currentMonthDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 w-full items-stretch">
          <div className="hidden sm:block sm:flex-1">
            {renderSingleMonth(prevMonthDate)}
          </div>
          <div className="flex-1 w-full">
            {renderSingleMonth(currentMonthDate)}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading && !analyticsData) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col min-h-0 space-y-6 pb-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center h-28">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
            <Library className="w-5 h-5 text-blue-500 fill-blue-500" />
          </div>
          <span className="font-extrabold text-zinc-850 dark:text-white text-lg">
            {examsMadeCount}
          </span>
          <span className="font-medium text-zinc-500 text-[10px] sm:text-xs tracking-wider">
            Exams Made
          </span>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center h-28">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
            <Flame className="w-5 h-5 text-blue-500 fill-blue-500" />
          </div>
          <span className="font-extrabold text-zinc-850 dark:text-white text-lg">
            {streak}
          </span>
          <span className="font-medium text-zinc-500 text-[10px] sm:text-xs tracking-wider">
            Day Streak
          </span>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center h-28">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
            <User className="w-5 h-5 text-blue-500 fill-blue-500" />
          </div>
          <span className="font-extrabold text-zinc-850 dark:text-white text-lg">
            {totalDays}
          </span>
          <span className="font-medium text-zinc-500 text-[10px] sm:text-xs tracking-wider">
            Active Days
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center h-24">
          <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-base">
            {examsGaveCount}
          </span>
          <span className="text-[9px] sm:text-[10px] text-zinc-500 font-semibold tracking-wider mt-0.5 leading-tight">
            Exams Completed
          </span>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center h-24">
          <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-base">
            {longestStreak}d
          </span>
          <span className="text-[9px] sm:text-[10px] text-zinc-500 font-semibold tracking-wider mt-1 leading-tight">
            Longest Streak
          </span>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center h-24">
          <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-base">
            {memberDays}d
          </span>
          <span className="text-[9px] sm:text-[10px] text-zinc-500 font-semibold tracking-wider mt-1 leading-tight">
            Since Joining
          </span>
        </div>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
          Active Heat Map
        </h3>
        {activeDays.length > 0 ? (
          renderMonthlyCalendar()
        ) : (
          <div className="text-center py-8 text-zinc-500 font-semibold text-xs">
            No activity recorded yet.
          </div>
        )}
      </div>
      {isOwner && (
        <>
          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
            <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
              Performance History
            </h3>

            <div className="flex items-center gap-3">
              <span className="text-zinc-550 font-semibold text-xs">ExamType:</span>
              <select
                value={selectedCatId}
                onChange={(e) => {
                  setSelectedCatId(e.target.value);
                  setChartOffset(0);
                }}
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded-xl px-3 py-1.5 font-medium outline-none cursor-pointer text-xs">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {chartData.length > 0 ? (
              <div className="space-y-3">
                <div className="h-44 sm:h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                      <XAxis dataKey="name" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} tick={false} style={{ fontSize: '10px', fontWeight: 600 }} />
                      <YAxis
                        tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#52525b' }}
                        stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'}
                        style={{ fontSize: '10px', fontWeight: 600 }}
                        domain={[minScore < 0 ? 'auto' : 0, 100]}
                      />
                      <Tooltip
                        labelFormatter={() => ''}
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                          borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
                          color: theme === 'dark' ? '#ffffff' : '#000000',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                        labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                      />
                      <Area type="monotone" dataKey="percentage" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#scoreColor)" name="Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handlePageBack}
                    disabled={!canPageBack}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 rounded-xl text-zinc-650 dark:text-zinc-400 font-bold transition-all flex items-center gap-1 cursor-pointer text-xs">
                    <ChevronLeft className="w-4 h-4" /> Prev 10
                  </button>

                  <span className="text-zinc-550 dark:text-zinc-450 font-semibold text-xs">
                    Showing {rawPercentages.length - chartOffset - chartData.length + 1} - {rawPercentages.length - chartOffset} of {rawPercentages.length}
                  </span>

                  <button
                    onClick={handlePageForward}
                    disabled={!canPageForward}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 rounded-xl text-zinc-650 dark:text-zinc-400 font-bold transition-all flex items-center gap-1 cursor-pointer text-xs">
                    Next 10 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center py-10 text-center text-zinc-500 font-semibold text-xs">
                No exam score history found for this ExamType.
              </div>
            )}
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
                ExamType Summary
              </h3>
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setSummaryType('column')}
                  className={`px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer ${summaryType === 'column'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-white shadow-xs'
                    : 'text-zinc-400 dark:text-zinc-550'
                    }`}
                >
                  Column
                </button>
                <button
                  onClick={() => setSummaryType('line')}
                  className={`px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer ${summaryType === 'line'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-white shadow-xs'
                    : 'text-zinc-400 dark:text-zinc-550'
                    }`}
                >
                  Line
                </button>
              </div>
            </div>
            {categoryData.length > 0 ? (
              <div className="h-44 sm:h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {summaryType === 'column' ? (
                    <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                      <XAxis dataKey="name" tick={false} stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                      <YAxis
                        tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#52525b' }}
                        stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'}
                        style={{ fontSize: '10px', fontWeight: 600 }}
                        domain={[minSummaryScore < 0 ? 'auto' : 0, 100]}
                      />
                      <Tooltip
                        labelFormatter={() => ''}
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                          borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
                          color: theme === 'dark' ? '#ffffff' : '#000000',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                        labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                        formatter={(value, name, props) => [`${value}% Avg`, props.payload.rawName || name]}
                      />
                      <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                        {categoryData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.average >= 75 ? '#10b981' : entry.average < 0 ? '#ef4444' : '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <LineChart data={categoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                      <XAxis dataKey="name" tick={false} stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                      <YAxis
                        tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#52525b' }}
                        stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'}
                        style={{ fontSize: '10px', fontWeight: 600 }}
                        domain={[minSummaryScore < 0 ? 'auto' : 0, 100]}
                      />
                      <Tooltip
                        labelFormatter={() => ''}
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                          borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7',
                          color: theme === 'dark' ? '#ffffff' : '#000000',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                        itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                        labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                        formatter={(value, name, props) => [`${value}% Avg`, props.payload.rawName || name]}
                      />
                      <Line type="monotone" dataKey="average" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Average" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 font-semibold text-xs">
                No categories available.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
