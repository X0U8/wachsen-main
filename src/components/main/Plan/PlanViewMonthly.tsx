import { useState } from 'react';
import { fontSize } from '../../../lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface SubjectChapter {
  subjectName: string;
  chapters: string[];
}

interface MonthPlan {
  month: number;
  subjects: SubjectChapter[];
}

interface PlanViewMonthlyProps {
  createdAt: string;
  planJson: {
    months: MonthPlan[];
  };
}

export default function PlanViewMonthly({ createdAt, planJson }: PlanViewMonthlyProps) {
  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({ 1: true });

  const toggleMonth = (monthNum: number) => {
    setExpandedMonths(prev => ({ ...prev, [monthNum]: !prev[monthNum] }));
  };

  const getMonthDateRange = (createdDateStr: string, monthNum: number) => {
    const start = new Date(createdDateStr);
    start.setDate(start.getDate() + (monthNum - 1) * 30);
    const end = new Date(start);
    end.setDate(start.getDate() + 29);
    
    const formatDateStr = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };
    return `${formatDateStr(start)} to ${formatDateStr(end)}`;
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {planJson?.months?.map((m) => {
        const isExpanded = expandedMonths[m.month];
        return (
          <div
            key={m.month}
            className="bg-white dark:bg-zinc-900/40 border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden transition-all shadow-sm"
          >
            <div
              onClick={() => toggleMonth(m.month)}
              className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-950/40 cursor-pointer border-b border-zinc-150 dark:border-gray-800/80 hover:bg-zinc-100/50 dark:hover:bg-zinc-950/70 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1">
                <span className="font-bold text-zinc-805 dark:text-gray-250 flex items-center gap-2" style={{ fontSize: fontSize.xs }}>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md font-extrabold" style={{ fontSize: fontSize.xs }}>Month {m.month}</span>
                  chapters
                </span>
                <span className="text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md self-start" style={{ fontSize: fontSize.xs }}>
                  {getMonthDateRange(createdAt, m.month)}
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </div>
 
            {isExpanded && (
              <div className="p-4 grid md:grid-cols-2 gap-3 animate-fadeIn">
                {m.subjects.map((sub, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-zinc-50 dark:bg-gray-950/30 border border-black/8 dark:border-white/10 rounded-xl space-y-2.5"
                  >
                    <h5 className="font-semibold text-blue-500 dark:text-blue-400 border-b border-zinc-100 dark:border-gray-800 pb-1.5" style={{ fontSize: fontSize.xs }}>
                      {sub.subjectName}
                    </h5>
                    {sub.chapters && sub.chapters.length > 0 ? (
                      <ul className="space-y-1.5">
                        {sub.chapters.map((chap, cIdx) => (
                          <li key={cIdx} className="text-zinc-650 dark:text-gray-350 flex items-start gap-1.5 leading-relaxed" style={{ fontSize: fontSize.sm }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 mt-1.5 shrink-0" />
                            <span>{chap}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400 dark:text-gray-600 italic font-medium" style={{ fontSize: fontSize.xs }}>
                        Revision / Practice or no syllabus allocated
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
