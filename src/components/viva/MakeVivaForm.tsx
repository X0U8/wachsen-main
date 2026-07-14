import { useState } from 'react';
import { X, Loader2, Mic } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { streamConceptCards } from '../../lib/streamConceptCards';
import { safeParseJSON } from '../RevisionLog';

export interface VivaQuestion {
  question: string;
  expectedAnswer: string;
  keywords: string[];
}

interface MakeVivaFormProps {
  show: boolean;
  onClose: () => void;
  userProfile: any;
  categoryId: string;
  availableSubjects: any[];
  examType: any;
  onCreated: (vivaId: string) => void;
}

const DIFFICULTIES: Array<'easy' | 'medium' | 'hard' | 'advance'> = ['easy', 'medium', 'hard', 'advance'];

export default function MakeVivaForm({
  show,
  onClose,
  userProfile,
  categoryId,
  availableSubjects,
  examType,
  onCreated,
}: MakeVivaFormProps) {
  const { refreshCredits } = useUserProfile();
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [topics, setTopics] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  if (!show) return null;

  const handleCreate = async () => {
    const trimmedSubject = subject.trim();
    const trimmedTopics = topics.trim();
    if (!trimmedSubject) {
      setError('Please select or enter a subject.');
      return;
    }
    if (!trimmedTopics || trimmedTopics.length < 5) {
      setError('Topic must be at least 5 characters.');
      return;
    }
    if (questionCount < 1 || questionCount > 20) {
      setError('Question count must be between 1 and 20.');
      return;
    }

    const creditsNeeded = questionCount * 2;
    if (!userProfile?.id) {
      setError('You must be signed in.');
      return;
    }
    if ((userProfile?.credits || 0) < creditsNeeded) {
      setError(`Insufficient credits. You need ${creditsNeeded} credits.`);
      return;
    }

    setGenerating(true);
    setProgress(0);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';
      const level = examType?.academicLevel || 'Grade 10';

      const prompt = `Subject: ${trimmedSubject}. Topic: ${trimmedTopics}.
Generate exactly ${questionCount} viva / oral interview questions for a student at academic level ${level}. The requested difficulty is: ${difficulty}.
For "easy", ask simple, direct theory/recall questions that can be answered in 1-2 sentences.
For "medium", ask standard conceptual explanation questions requiring clear understanding.
For "hard", ask deeper analytical or application questions.
For "advance", generate the absolute hardest oral-exam questions possible for this topic and level — questions that test deep mastery, edge cases, complex reasoning, and the toughest verbal explanation skills.

Each item must be in plain, natural language (no LaTeX, no equations, no symbols).
Return ONLY a valid JSON array in this exact format:
[
  {
    "question": "...",
    "expectedAnswer": "Concise ideal spoken answer (2-4 sentences).",
    "keywords": ["keyword1", "keyword2"]
  }
]
`;

      const replyText = await streamConceptCards(
        {
          question: prompt,
          correctAnswer: '',
          userAnswer: '',
          userId: userProfile.id,
          authToken,
          useOwnKey: false,
          provider: 'mesh',
          model: '',
          deductAmount: creditsNeeded,
        },
        (count) => setProgress(count),
        questionCount
      );

      const cleaned = replyText.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
      const questions: VivaQuestion[] = safeParseJSON(cleaned);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Failed to generate valid viva questions.');
      }

      const { data: inserted, error: insertError } = await supabase
        .from('viva_exams')
        .insert({
          user_id: userProfile.id,
          category_id: categoryId,
          name: `${trimmedSubject} Viva`,
          subject_name: trimmedSubject,
          topics: trimmedTopics,
          difficulty,
          question_count: questions.length,
          status: 'pending',
          questions,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      refreshCredits();
      onCreated(inserted.id);
    } catch (err: any) {
      console.error('Error creating viva:', err);
      setError(err.message || 'Failed to create viva. Please try again.');
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-zinc-900 dark:text-white flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
              <Mic className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-base">Create Viva</h3>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Subject</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Difficulty</label>
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

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Questions</label>
              <input
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 0)))}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Topics</label>
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
              <span>{topics.length} / 300</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/40 px-3 py-2 rounded-xl">
            <span>Cost</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{questionCount * 2} credits</span>
          </div>

          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={generating}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 justify-center cursor-pointer shadow-md shadow-blue-500/10"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating {progress}/{questionCount}
              </>
            ) : (
              `Create Viva (${questionCount * 2} credits)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
