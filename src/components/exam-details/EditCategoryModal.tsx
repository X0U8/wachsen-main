import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fontSize } from '../../lib/utils';
import { ACADEMIC_LEVELS } from '../../data/academicLevels';
import { KNOWN_SUBJECTS } from '../../data/subjects';

interface FormData {
  examName: string;
  subjectInput: string;
  subjects: string[];
  academicLevel: string;
  subjectError: string;
}

interface EditCategoryModalProps {
  show: boolean;
  form: FormData;
  maxSubjects: number;
  isEditing: boolean;
  onSave: () => void;
  onClose: () => void;
  onFormChange: (form: FormData) => void;
}

export default function EditCategoryModal({
  show, form, maxSubjects, isEditing, onSave, onClose, onFormChange
}: EditCategoryModalProps) {
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const updateForm = (partial: Partial<FormData>) => {
    onFormChange({ ...form, ...partial });
  };

  const capitalizeWords = (str: string) =>
    str.replace(/\b\w/g, c => c.toUpperCase());

  const addSubject = () => {
    const raw = form.subjectInput.trim();
    if (!raw) return;
    const capitalized = capitalizeWords(raw);
    const lower = raw.toLowerCase();

    if (form.subjects.length >= maxSubjects) {
      updateForm({ subjectError: `Maximum ${maxSubjects} subjects allowed` });
      return;
    }
    if (!KNOWN_SUBJECTS.has(lower)) {
      updateForm({ subjectError: `"${capitalized}" doesn't look like a valid subject` });
      return;
    }
    if (form.subjects.map(s => s.toLowerCase()).includes(lower)) {
      updateForm({ subjectError: 'Already added', subjectInput: '' });
      return;
    }
    updateForm({
      subjects: [...form.subjects, capitalized],
      subjectInput: '',
      subjectError: '',
    });
  };

  const removeSubject = (i: number) => {
    updateForm({ subjects: form.subjects.filter((_, idx) => idx !== i) });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSubject();
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 border border-black/15 dark:border-white/20 rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl dark:shadow-[0_0_30px_rgba(255,255,255,0.06)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 style={{ fontSize: fontSize.base }} className="text-zinc-900 dark:text-gray-100">Edit Category</h2>
              <button onClick={onClose} className="text-zinc-400 dark:text-gray-500 hover:text-zinc-900 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-zinc-500 dark:text-gray-500 mb-1 block" style={{ fontSize: fontSize.xs }}>Category Name</label>
              <input
                autoFocus
                value={form.examName}
                onChange={e => updateForm({ examName: e.target.value })}
                placeholder="e.g. SAT Mathematics or, SAT, JEE , Board Exams"
                className="w-full bg-zinc-100 dark:bg-black border border-black/15 dark:border-white/20 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all"
                style={{ fontSize: fontSize.sm }}
              />
            </div>

            <div>
              <label className="text-zinc-500 dark:text-gray-500 mb-1 block" style={{ fontSize: fontSize.xs }}>
                Subjects{' '}
                <span className={form.subjects.length >= maxSubjects ? 'text-red-400' : 'text-zinc-400 dark:text-gray-600'}>
                  ({form.subjects.length}/{maxSubjects})
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  value={form.subjectInput}
                  onChange={e => updateForm({ subjectInput: e.target.value, subjectError: '' })}
                  onKeyDown={handleKeyDown}
                  placeholder={form.subjects.length >= maxSubjects ? 'Subject limit reached' : 'Type subject, press Enter'}
                  disabled={form.subjects.length >= maxSubjects}
                  className="flex-1 bg-zinc-100 dark:bg-black border border-black/15 dark:border-white/20 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: fontSize.sm }}
                />
                <button
                  onClick={addSubject}
                  disabled={form.subjects.length >= maxSubjects}
                  className="px-3 py-2 bg-zinc-200 dark:bg-zinc-800 border border-black/15 dark:border-white/20 hover:bg-zinc-350 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-gray-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {form.subjectError && (
                <p className="text-red-400 mt-1" style={{ fontSize: fontSize.xs }}>{form.subjectError}</p>
              )}
              {form.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.subjects.map((s, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 bg-zinc-200 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 px-2 py-1 rounded-full"
                      style={{ fontSize: fontSize.xs }}
                    >
                      {s}
                      <button onClick={() => removeSubject(i)} className="text-zinc-400 dark:text-gray-500 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-zinc-500 dark:text-gray-500 mb-1 block" style={{ fontSize: fontSize.xs }}>Academic Level</label>
              <input
                value={form.academicLevel}
                onChange={e => {
                  updateForm({ academicLevel: e.target.value });
                  setShowLevelPicker(true);
                }}
                onFocus={() => setShowLevelPicker(true)}
                onBlur={() => setTimeout(() => setShowLevelPicker(false), 150)}
                placeholder="Type to search level..."
                className="w-full bg-zinc-100 dark:bg-black border border-black/15 dark:border-white/20 rounded-lg px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all"
                style={{ fontSize: fontSize.sm }}
              />
              {showLevelPicker && form.academicLevel.trim().length > 0 && (() => {
                const filtered = ACADEMIC_LEVELS.filter(l =>
                  l.toLowerCase().startsWith(form.academicLevel.toLowerCase())
                );
                return filtered.length > 0 ? (
                  <div className="absolute bottom-full mb-1 left-0 w-full bg-white dark:bg-gray-800 border border-black/15 dark:border-white/20 rounded-lg overflow-y-auto max-h-48 z-10">
                    {filtered.map(level => (
                      <button
                        key={level}
                        onMouseDown={() => {
                          updateForm({ academicLevel: level });
                          setShowLevelPicker(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-gray-700 transition-colors ${
                          form.academicLevel === level ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-gray-400'
                        }`}
                        style={{ fontSize: fontSize.sm }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-gray-700 transition-colors"
                style={{ fontSize: fontSize.sm }}
                disabled={isEditing}
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isEditing || !form.examName.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                style={{ fontSize: fontSize.sm }}
              >
                {isEditing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
