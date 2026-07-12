import React from 'react';
import { fontSize } from '../../lib/utils';

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
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-xs">No revision logs created yet.</p>
          <p className="text-zinc-450 dark:text-zinc-550 mt-1 text-xs">Complete an exam and click "Create Revision Log" on the results page to generate one.</p>
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
                className="bg-white dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 hover:border-blue-500/50 hover:dark:border-blue-500/50 p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 min-h-[5.5rem] group shadow-xs"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-bold text-zinc-900 dark:text-white truncate text-sm">
                    {examName}
                  </h3>
                  <div className="text-zinc-500 dark:text-zinc-400 font-medium text-xs">
                    {dateString}
                  </div>
                </div>
                {log.question_count !== undefined && (
                  <span
                    className="font-semibold whitespace-nowrap flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-405 px-2.5 py-1 rounded-lg text-xs">
                    {log.question_count} {log.question_count === 1 ? 'Question' : 'Questions'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
