import React, { useState } from 'react';
import { X } from 'lucide-react';
import { fontSize } from '../../lib/utils';
import MathText from '../../ui/MathText';

interface Segment {
  subject: string;
  range: string;
  topics: string;
}

interface SegmentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  examPlan: any;
  onSelectSegment: (selection: { subject: string; topics: string; difficulty: 'easy' | 'medium' | 'hard' | 'advance'; name: string }) => void;
}

export default function SegmentSelectorModal({
  isOpen,
  onClose,
  examPlan,
  onSelectSegment
}: SegmentSelectorModalProps) {
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !examPlan) return null;


  const planSubjects = Array.isArray(examPlan) ? examPlan : (examPlan.subjects || []);
  const segmentsBySubject: Record<string, Segment[]> = {};

  planSubjects.forEach((sub: any) => {
    const subName = sub.name || sub.subject || 'Subject';
    const segments = sub?.planSubject?.segments || sub?.segments || [];
    if (Array.isArray(segments)) {
      segments.forEach((seg: any) => {
        let topicStr = '';
        if (Array.isArray(seg.topics)) {
          topicStr = seg.topics.join(', ');
        } else {
          topicStr = seg.topics || '';
        }
        if (!segmentsBySubject[subName]) {
          segmentsBySubject[subName] = [];
        }
        segmentsBySubject[subName].push({
          subject: subName,
          range: seg.range || '',
          topics: topicStr
        });
      });
    }
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl relative text-zinc-900 dark:text-white">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h3
              className="font-semibold text-zinc-800 dark:text-white tracking-wider text-base">Select Subtopic</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">Choose a topic range and difficulty to generate 10 concept cards</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 flex-shrink-0">
          <label className="text-xs font-semibold  tracking-wider text-zinc-400">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none text-zinc-800 dark:text-white text-xs"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="advance">Advance</option>
          </select>
        </div>

        <div className="space-y-1 flex-shrink-0">
          <label className="text-xs font-semibold  tracking-wider text-zinc-400">Name</label>
          <input
            type="text"
            maxLength={15}
            placeholder="e.g. My Concept Cards"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none text-zinc-800 dark:text-white text-xs"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="my-2 space-y-5">
          {Object.keys(segmentsBySubject).length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400 text-xs">
              No segments found in this exam plan.
            </div>
          ) : (
            Object.entries(segmentsBySubject).map(([subject, list]) => (
              <div key={subject} className="space-y-2">
                <div
                  className="font-bold text-zinc-500 dark:text-zinc-400 tracking-widest pl-1 text-xs">
                  <MathText text={subject} />
                </div>
                <div className="space-y-2">
                  {list.map((seg, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const trimmed = name.trim();
                        if (trimmed.length < 3 || trimmed.length > 15) {
                          setError('Name must be between 3 and 15 characters.');
                          return;
                        }
                        setError('');
                        onSelectSegment({ subject: seg.subject, topics: seg.topics, difficulty, name: trimmed });
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div
                            className="font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
                            <MathText text={seg.topics || 'General Review'} />
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">
                            Questions {seg.range}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex-shrink-0 border-t border-zinc-150 dark:border-zinc-900 pt-3">
          <button
            onClick={onClose}
            className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl font-semibold text-zinc-700 dark:text-white transition-all cursor-pointer text-xs">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
