import { X, AlertCircle, CheckCircle2, Loader2, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fontSize } from '../../lib/utils';

interface TemplateModalProps {
  show: boolean;
  isEditing: boolean;
  templateName: string;
  message: { type: 'success' | 'error'; text: string } | null;
  isSaving: boolean;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
  templateCount?: number;
  maxTemplates?: number;
}

export default function TemplateModal({
  show, isEditing, templateName, message, isSaving,
  onNameChange, onSave, onClose, templateCount = 0, maxTemplates = 5,
}: TemplateModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 border border-black/15 dark:border-white/20 rounded-3xl p-6 w-full max-w-md space-y-6 shadow-2xl dark:shadow-[0_0_30px_rgba(255,255,255,0.06)]"
          >
            <div className="text-center space-y-2">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">
                {isEditing ? 'Edit Template' : 'Mark as Template'}
              </h3>
              <p className="text-zinc-500 dark:text-gray-400 text-sm">
                {isEditing ? 'Update the template name and settings' : 'Give this exam a template name to reuse its configuration later'}
              </p>
            </div>

            {!isEditing && (
              <div className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-black/30 border border-black/10 dark:border-white/15 rounded-xl">
                <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-500 dark:text-gray-400 text-xs">
                  {maxTemplates - templateCount} template{maxTemplates - templateCount !== 1 ? 's' : ''} left
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-zinc-500 dark:text-gray-550 font-medium text-xs">
                Template Name (Required, max 50 characters)
              </label>
              <input
                type="text"
                maxLength={50}
                value={templateName}
                onChange={(e) => { onNameChange(e.target.value); }}
                className="w-full bg-zinc-100 dark:bg-black border border-black/15 dark:border-white/20 rounded-xl p-3 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none transition-all text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 text-sm"
                placeholder="e.g., Weekly Maths Practice..." />
              {message && (
                <div
                  className={`flex items-center gap-2 p-2 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'} text-xs`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {message.text}
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-400 text-xs">If you delete this exam, the template will also be deleted.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-3 bg-zinc-100 dark:bg-gray-800 hover:bg-zinc-200 dark:hover:bg-gray-700 text-zinc-900 dark:text-white rounded-2xl font-medium transition-all text-sm">
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!templateName.trim() || isSaving || message?.type === 'success'}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-2xl font-medium transition-all flex items-center justify-center gap-2 text-sm">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Template'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
