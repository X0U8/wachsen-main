import React from 'react';
import { BookOpen } from 'lucide-react';

interface RevisionLogItem {
  id: string;
  examID: string;
  created_at: string;
  question_count?: number;
  exams?: {
    examName: string;
  } | null;
}

interface RevisionLogListProps {
  revisionList: RevisionLogItem[];
  onSelectLog: (examID: string) => void;
}

export default function RevisionLogList({ revisionList, onSelectLog }: RevisionLogListProps) {
  return (
    <div className="max-w-4xl w-full mx-auto space-y-4">
      {revisionList.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-sm">
          <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">No revision logs created yet.</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Complete an exam and click "Create Revision Log" on the results page to generate one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {revisionList.map((log) => {
            const examName = log.exams?.examName || 'Exam';
            const dateString = new Date(log.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            return (
              <div 
                key={log.id} 
                onClick={() => onSelectLog(log.examID)}
                className="bg-white dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 hover:border-blue-500/50 hover:dark:border-blue-500/50 p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-center h-20 group shadow-xs"
              >
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-1">
                  {dateString}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate flex-1">
                    {examName}
                  </h3>
                  {log.question_count !== undefined && (
                    <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold whitespace-nowrap flex-shrink-0 bg-zinc-100 dark:bg-zinc-850 px-2 py-0.5 rounded-md">
                      {log.question_count} {log.question_count === 1 ? 'Question' : 'Questions'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
