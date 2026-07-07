import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { fontSize } from '../../lib/utils';
import { KNOWN_SUBJECTS } from '../../data/subjects';
import { ACADEMIC_LEVELS } from '../../data/academicLevels';

interface FormData {
  examName: string;
  subjectInput: string;
  subjects: string[];
  academicLevel: string;
  subjectError: string;
}

const emptyForm = (): FormData => ({
  examName: '',
  subjectInput: '',
  subjects: [],
  academicLevel: '',
  subjectError: '',
});

interface NewExamFormProps {
  onSave: (data: { name: string; subjects: string[]; academicLevel: string }) => Promise<void>;
  onClose: () => void;
  maxSubjects: number;
  maxNameLength: number;
}

export default function NewExamForm({ onSave, onClose, maxSubjects, maxNameLength }: NewExamFormProps) {
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const capitalizeWords = (str: string) =>
    str.replace(/\b\w/g, c => c.toUpperCase());

  const addSubject = () => {
    const raw = form.subjectInput.trim();
    if (!raw) return;
    const capitalized = capitalizeWords(raw);
    const lower = raw.toLowerCase();

    if (form.subjects.length >= maxSubjects) {
      setForm(f => ({ ...f, subjectError: `Maximum ${maxSubjects} subjects allowed` }));
      return;
    }
    if (!KNOWN_SUBJECTS.has(lower)) {
      setForm(f => ({ ...f, subjectError: `"${capitalized}" doesn't look like a valid subject` }));
      return;
    }
    if (form.subjects.map(s => s.toLowerCase()).includes(lower)) {
      setForm(f => ({ ...f, subjectError: 'Already added', subjectInput: '' }));
      return;
    }
    setForm(f => ({
      ...f,
      subjects: [...f.subjects, capitalized],
      subjectInput: '',
      subjectError: '',
    }));
  };

  const removeSubject = (i: number) => {
    setForm(f => ({ ...f, subjects: f.subjects.filter((_, idx) => idx !== i) }));
  };

  const handleSubjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSubject();
    }
  };

  const handleSave = async () => {
    const name = form.examName.trim();
    if (!name || name.length > maxNameLength) return;
    if (form.subjects.length === 0) {
      setForm(f => ({ ...f, subjectError: 'Add at least one subject' }));
      return;
    }
    setSaving(true);
    try {
      await onSave({ name, subjects: form.subjects, academicLevel: form.academicLevel });
      setForm(emptyForm());
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4 backdrop-blur-xs"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-gray-800 rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-xl transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">New Exam Type</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-gray-550 hover:text-zinc-650 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="font-medium text-zinc-450 dark:text-gray-550 mb-1 block" style={{ fontSize: fontSize.xs }}>
            Exam Name
            <span className="text-zinc-500 dark:text-gray-650 ml-1">({form.examName.length}/{maxNameLength})</span>
          </label>
          <input
            autoFocus
            value={form.examName}
            onChange={e => {
              if (e.target.value.length <= maxNameLength) {
                setForm(f => ({ ...f, examName: e.target.value }));
              }
            }}
            placeholder="e.g. Board Exams, SAT, or JEE"
            maxLength={maxNameLength}
            className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-gray-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-gray-500"
            style={{ fontSize: fontSize.xs }}
          />
        </div>

        <div>
          <label className="font-medium text-zinc-450 dark:text-gray-550 mb-1 block" style={{ fontSize: fontSize.xs }}>
            Subjects{' '}
            <span className={form.subjects.length >= maxSubjects ? 'text-red-500' : 'text-zinc-500 dark:text-gray-650'}>
              ({form.subjects.length}/{maxSubjects})
            </span>
          </label>
          <div className="flex gap-2">
            <input
              value={form.subjectInput}
              onChange={e => setForm(f => ({ ...f, subjectInput: e.target.value, subjectError: '' }))}
              onKeyDown={handleSubjectKeyDown}
              placeholder={form.subjects.length >= maxSubjects ? 'Subject limit reached' : 'Type subject and press Enter'}
              disabled={form.subjects.length >= maxSubjects}
              className="flex-1 bg-white dark:bg-black border border-zinc-200 dark:border-gray-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: fontSize.xs }}
            />
            <button
              onClick={addSubject}
              disabled={form.subjects.length >= maxSubjects}
              className="px-3 py-2 bg-zinc-100 dark:bg-gray-800 border border-zinc-200 dark:border-gray-700 hover:bg-zinc-200 dark:hover:bg-gray-700 text-zinc-600 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {form.subjectError && (
            <p className="text-red-500 mt-1" style={{ fontSize: fontSize.xs }}>{form.subjectError}</p>
          )}
          {form.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {form.subjects.map((s, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 px-2 py-0.5 border border-zinc-200 dark:border-gray-700 rounded-full"
                  style={{ fontSize: fontSize.xs }}
                >
                  {s}
                  <button onClick={() => removeSubject(i)} className="text-zinc-450 dark:text-gray-500 hover:text-red-500 ml-0.5 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="font-medium text-zinc-450 dark:text-gray-550 mb-1 block" style={{ fontSize: fontSize.xs }}>Academic Level</label>
          <input
            value={form.academicLevel}
            onChange={e => {
              setForm(f => ({ ...f, academicLevel: e.target.value }));
              setShowLevelPicker(true);
            }}
            onFocus={() => setShowLevelPicker(true)}
            onBlur={() => setTimeout(() => setShowLevelPicker(false), 150)}
            placeholder="Search level..."
            className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-gray-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-gray-500"
            style={{ fontSize: fontSize.xs }}
          />
          {showLevelPicker && form.academicLevel.trim().length > 0 && (() => {
            const filtered = ACADEMIC_LEVELS.filter(l =>
              l.toLowerCase().startsWith(form.academicLevel.toLowerCase())
            );
            return filtered.length > 0 ? (
              <div className="absolute bottom-full mb-1 left-0 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-gray-800 rounded-lg overflow-y-auto max-h-40 shadow-lg z-50">
                {filtered.map(level => (
                  <button
                    key={level}
                    onMouseDown={() => {
                      setForm(f => ({ ...f, academicLevel: level }));
                      setShowLevelPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-gray-800 transition-colors ${form.academicLevel === level ? 'text-blue-600 dark:text-white font-medium' : 'text-zinc-600 dark:text-gray-400'}`}
                    style={{ fontSize: fontSize.xs }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 font-medium hover:bg-zinc-200 dark:hover:bg-gray-700 border border-zinc-200 dark:border-gray-750 transition-colors cursor-pointer"
            style={{ fontSize: fontSize.xs }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.examName.trim() || form.examName.trim().length > maxNameLength}
            className="flex-1 py-2 rounded-lg bg-blue-600 dark:bg-white text-white dark:text-black font-medium hover:bg-blue-700 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
            style={{ fontSize: fontSize.xs }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
