import { useState, useEffect } from 'react';
import { X, Loader2, Edit3 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { streamConceptCards } from '../../lib/streamConceptCards';
import { safeParseJSON } from '../RevisionLog';
import { getAiRequestMode } from '../../lib/aiRequest';

import Notification from '../../ui/Notification';

export interface LaqQuestion {
  question: string;
}

interface MakeLaqProps {
  show: boolean;
  onClose: () => void;
  userProfile: any;
  categoryId: string;
  availableSubjects: any[];
  examType: any;
  onCreated: (laqId: string) => void;
  defaultIsViva?: boolean;
}

const DIFFICULTIES: Array<'easy' | 'medium' | 'hard' | 'advance'> = ['easy', 'medium', 'hard', 'advance'];

export default function MakeLaq({
  show,
  onClose,
  userProfile,
  categoryId,
  availableSubjects,
  examType,
  onCreated,
  defaultIsViva,
}: MakeLaqProps) {
  const { refreshCredits } = useUserProfile();
  const [subject, setSubject] = useState('');
  const [examName, setExamName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [isViva] = useState(defaultIsViva ?? false);

  useEffect(() => {
    if (isViva) {
      setTimeLimitMinutes(questionCount * 5);
    }
  }, [isViva, questionCount]);
  const [topics, setTopics] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  if (!show) return null;

  const handleCreate = async () => {
    const trimmedSubject = subject.trim();
    const trimmedTopics = topics.trim();
    const trimmedName = examName.trim();
    if (!trimmedSubject) {
      showNotification('error', 'Please select or enter a subject.');
      return;
    }
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 15) {
      showNotification('error', 'Exam name must be between 3 and 15 characters.');
      return;
    }
    if (!trimmedTopics || trimmedTopics.length < 5) {
      showNotification('error', 'Topic must be at least 5 characters.');
      return;
    }
    if (questionCount < 1 || questionCount > 10) {
      showNotification('error', 'Question count must be between 1 and 10.');
      return;
    }

    const aiRequestMode = getAiRequestMode();
    if (isViva && aiRequestMode.useOwnKey) {
      showNotification('error', "Viva sessions do not support using your own API key. Please turn off 'Use Own Key' in Settings to use the credit system.");
      return;
    }

    const creditsNeeded = isViva ? questionCount * 4 : questionCount * 2;
    const isUsingOwnKey = !isViva && aiRequestMode.useOwnKey;

    if (!userProfile?.id) {
      showNotification('error', 'You must be signed in.');
      return;
    }

    if (!isUsingOwnKey && (userProfile?.credits || 0) < creditsNeeded) {
      showNotification('error', `Insufficient credits. You need ${creditsNeeded} credits.`);
      return;
    }

    setGenerating(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';
      const level = examType?.academicLevel || 'Grade 10';

      const prompt = isViva
        ? `Subject: ${trimmedSubject}. Topic: ${trimmedTopics}.
Generate exactly ${questionCount} oral Viva (spoken voice exam) questions for a student at academic level ${level}. The requested difficulty is: ${difficulty}.
CRITICAL RULES:
1. These questions will be read out loud to the student and they must speak their answers. SO make sure its possible for the questions.
2. Ask questions that are brief, speakable, conversational, and directly answerable in a short spoken response (no complex math, essay prompts, or writing requirements). Keep the questions small and clear.
3. No LaTeX, no mathematical symbols.
4. Return ONLY a valid JSON array of question strings in this exact format:
["Question 1 text here.", "Question 2 text here."]`
        : `Subject: ${trimmedSubject}. Topic: ${trimmedTopics}.
Generate exactly ${questionCount} long-answer / written-response questions for a student at academic level ${level}. The requested difficulty is: ${difficulty}.
For "easy", ask simple, direct theory/recall questions that can be answered in 2-3 sentences.
For "medium", ask standard conceptual explanation questions requiring clear understanding.
For "hard", ask deeper analytical or application questions requiring detailed written responses.
For "advance", generate the absolute hardest written-response questions possible for this topic and level — questions that test deep mastery, edge cases, complex reasoning, and the toughest analytical skills.

No LaTeX, no symbols.
Return ONLY a valid JSON array of question strings in this exact format:
["Question 1 text here.", "Question 2 text here."]`;

      const replyText = await streamConceptCards(
        {
          question: prompt,
          correctAnswer: '',
          userAnswer: '',
          userId: userProfile.id,
          authToken,
          ...(isViva
            ? { useOwnKey: false, deductAmount: creditsNeeded }
            : { ...aiRequestMode, deductAmount: isUsingOwnKey ? 0 : creditsNeeded }),
        },
        (count) => setProgress(count),
        questionCount
      );

      const cleaned = replyText.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
      const rawParsed = safeParseJSON(cleaned);


      let questions: LaqQuestion[];
      if (Array.isArray(rawParsed) && rawParsed.length > 0) {
        if (typeof rawParsed[0] === 'string') {
          questions = rawParsed.map((q: string) => ({ question: q }));
        } else {
          questions = rawParsed.map((q: any) => ({ question: q.question || String(q) }));
        }
      } else {
        throw new Error('Failed to generate valid questions.');
      }

      const finalName = trimmedName;

      const { data: inserted, error: insertError } = await supabase
        .from('laq_exam')
        .insert({
          user_id: userProfile.id,
          category_id: categoryId,
          name: finalName,
          subject_name: trimmedSubject,
          topics: trimmedTopics,
          difficulty,
          question_count: questions.length,
          time_limit_minutes: timeLimitMinutes,
          status: 'pending',
          questions,
          is_viva: isViva,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      refreshCredits();
      onCreated(inserted.id);
    } catch (err: any) {
      console.error('Error creating long answer:', err);
      showNotification('error', err.message || 'Failed to create. Please try again.');
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md h-[550px] shadow-2xl relative text-zinc-900 dark:text-white flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-900 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-base">
              {isViva ? 'Create Viva Session' : 'Create LAQ Exam'}
            </h3>
            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md tracking-wider ${isViva
                ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60'
                : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60'
              }`}>
              {isViva ? 'Viva' : 'LAQ'}
            </span>
          </div>
          {!generating && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {generating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
                {isViva ? 'Generating Viva Session' : 'Generating LAQ Exam'}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">Do not close or navigate away</p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto pr-1 py-3 text-left space-y-3 no-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold  tracking-wider text-zinc-400">Subject</label>
                {availableSubjects.length > 0 ? (
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                  >
                    <option value="">Select a subject</option>
                    {availableSubjects.map((sub: any) => (
                      <option key={sub.id || sub.name} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Enter subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold  tracking-wider text-zinc-400">Name</label>
                <input
                  type="text"
                  placeholder={isViva ? "e.g. Genetics Viva Session" : "e.g. Genetics LAQ Exam"}
                  value={examName}
                  maxLength={15}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold  tracking-wider text-zinc-400">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold  tracking-wider text-zinc-400">
                  Question Count
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuestionCount(prev => Math.max(1, prev - 1))}
                    className="w-9 h-9 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-semibold select-none cursor-pointer transition-all text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-blue-600 dark:text-blue-400 text-sm">{questionCount}</span>
                  <button
                    type="button"
                    onClick={() => setQuestionCount(prev => Math.min(10, prev + 1))}
                    className="w-9 h-9 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-semibold select-none cursor-pointer transition-all text-sm"
                  >
                    +
                  </button>
                  {(() => {
                    const aiRequestMode = getAiRequestMode();
                    if (isViva && aiRequestMode.useOwnKey) {
                      return (
                        <span className="text-red-500 font-semibold text-[11px]">
                          (Viva requires credits. Please turn off BYOK in Settings)
                        </span>
                      );
                    }
                    if (!isViva && aiRequestMode.useOwnKey) {
                      return (
                        <span className="text-green-600 dark:text-green-400 font-medium text-[11px]">
                          (Using own API key)
                        </span>
                      );
                    }
                    return (
                      <span className="text-zinc-400 dark:text-zinc-500 font-medium text-[11px]">
                        ({questionCount} Questions = {questionCount * (isViva ? 4 : 2)} credits)
                      </span>
                    );
                  })()}
                </div>
              </div>

              {!isViva ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold tracking-wider text-zinc-400">
                    Time Limit: {timeLimitMinutes} minutes
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={180}
                    step={5}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 font-medium px-0.5">
                    <span>10 min</span>
                    <span>180 min</span>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl p-4 text-center">
                  <p className="text-zinc-600 dark:text-zinc-300 text-xs font-semibold">
                    You have <span className="text-blue-600 dark:text-blue-400 font-bold">{timeLimitMinutes} mins</span> after you start the viva
                  </p>
                </div>
              )}



              <div className="space-y-1">
                <label className="text-[10px] font-semibold  tracking-wider text-zinc-400">Topics</label>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Enter topics or subtopics to be asked"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs resize-none leading-relaxed"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                  <span>{topics.trim().length > 0 && topics.trim().length < 5 ? 'Topic must be at least 5 characters' : ''}</span>
                  <span>{topics.length} / 305</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 shrink-0 border-t border-zinc-150 dark:border-zinc-900 mt-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={generating || (isViva && getAiRequestMode().useOwnKey)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl text-xs transition-all flex items-center gap-2 justify-center cursor-pointer shadow-md shadow-blue-500/10"
              >
                {(() => {
                  const aiRequestMode = getAiRequestMode();
                  if (isViva) {
                    return `Create (${questionCount * 4} credits)`;
                  }
                  if (aiRequestMode.useOwnKey) {
                    return 'Create (Your Key)';
                  }
                  return `Create (${questionCount * 2} credits)`;
                })()}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Toast Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
