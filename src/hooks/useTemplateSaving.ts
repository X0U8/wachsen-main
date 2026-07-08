import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export function useTemplateSaving(userId?: string | null, premiumType?: string) {
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateCount, setTemplateCount] = useState(0);

  const getMaxTemplates = () => {
    const pt = (premiumType || '').toLowerCase();
    if (pt.includes('peak')) return 30;
    if (pt.includes('rise')) return 20;
    if (pt.includes('lite')) return 10;
    return 5;
  };

  const fetchTemplateCount = async () => {
    if (!userId) return;
    try {
      const { count, error } = await supabase
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId);
      if (!error && count !== null) setTemplateCount(count);
    } catch { }
  };

  useEffect(() => { fetchTemplateCount(); }, [userId]);

  const openTemplateModal = (exam: { isTemplate?: boolean; templateName?: string } | null) => {
    if (!exam) return;
    const isTemplate = exam.isTemplate || false;
    setIsEditingTemplate(isTemplate);
    setTemplateNameInput(isTemplate ? (exam.templateName || '') : '');
    setTemplateMessage(null);
    fetchTemplateCount();
    setShowTemplateModal(true);
  };

  const saveTemplate = async (examId: string, onSuccess: () => void) => {
    if (!userId || !examId) return;

    setIsSavingTemplate(true);
    setTemplateMessage(null);
    try {
      if (!isEditingTemplate) {
        const { count, error: countError } = await supabase
          .from('templates')
          .select('*', { count: 'exact', head: true })
          .eq('userId', userId);

        if (countError) throw countError;
        if (count !== null && count >= getMaxTemplates()) {
          setTemplateMessage({ type: 'error', text: `Template limit reached (${getMaxTemplates()}).` });
          return;
        }
      }

      const { error: updateError } = await supabase
        .from('exams')
        .update({ isTemplate: true, templateName: templateNameInput.trim() })
        .eq('id', examId);

      if (updateError) throw updateError;

      setTemplateMessage({ type: 'success', text: 'Template saved successfully!' });
      setTimeout(() => {
        closeTemplateModal();
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error saving template:', error);
      setTemplateMessage({ type: 'error', text: 'Failed to save template.' });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setTemplateNameInput('');
    setTemplateMessage(null);
    setIsEditingTemplate(false);
  };

  return {
    showTemplateModal,
    templateNameInput,
    isSavingTemplate,
    templateMessage,
    isEditingTemplate,
    templateCount,
    maxTemplates: getMaxTemplates(),
    setTemplateNameInput: (v: string) => { setTemplateNameInput(v); setTemplateMessage(null); },
    openTemplateModal,
    saveTemplate,
    closeTemplateModal,
  };
}
