import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, Clock, GraduationCap, CheckCircle2, AlertCircle, Lock as LockIcon, CircleStop, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Notification from '../../ui/Notification';
import FinalizeExam from '../FinalizeExam';
import { useUserProfile } from '../../lib/UserContext';
import { fontSize } from '../../lib/utils';
import { supabase } from '../../services/supabase';

interface QuestionType {
  type: 'mcq' | 'integer' | 'true_false';
  count: number;
  correctMarks: number;
  negativeMarks: number;
  mcqOptions?: 3 | 4 | 5;
  mcqMultiple?: boolean;
}

interface SubjectConfig {
  id: string;
  name: string;
  academicLevel: string;
  chapters: string;
  questionTypes: QuestionType[];
}

interface ManuallyWithAIProps {
  show: boolean;
  onClose: () => void;
  mode: 'auto' | 'manual';
  userProfile: any;
  categoryId: string;
  availableSubjects: any[];
}

export default function ManuallyWithAI({ show, onClose, userProfile, categoryId, availableSubjects }: ManuallyWithAIProps) {
  const { refreshCredits, refreshProfile } = useUserProfile();
  const [showFinalizeExam, setShowFinalizeExam] = useState(false);
  const [step, setStep] = useState<'details' | 'subjects'>('details');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Add no-scrollbar style
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Close template dropdown on outside click
  useEffect(() => {
    if (!showTemplateList) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-template-dropdown]') && !target.closest('[data-template-btn]')) {
        setShowTemplateList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplateList]);


  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [disabledItemName, setDisabledItemName] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<('mcq' | 'integer' | 'true_false')[]>(['mcq']);
  const [defaultCounts, setDefaultCounts] = useState<Record<string, number>>({});

  const [examName, setExamName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [defaultCorrectMarks, setDefaultCorrectMarks] = useState(4);
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState(0);
  const [startDateTime, setStartDateTime] = useState('anytime');
  const [endDateTime, setEndDateTime] = useState('anytime');
  const [accessType, setAccessType] = useState<'anytime' | 'specific'>('anytime');

  // Time picker state (for specific schedule)
  const [startDate, setStartDate] = useState('');
  const [startHour, setStartHour] = useState(12);
  const [startMinute, setStartMinute] = useState(0);
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [endDate, setEndDate] = useState('');
  const [endHour, setEndHour] = useState(12);
  const [endMinute, setEndMinute] = useState(0);
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('AM');

  const roundUp30 = (d: Date) => {
    const m = d.getMinutes();
    const round = Math.ceil(m / 30) * 30;
    if (round === 60) { d.setHours(d.getHours() + 1); d.setMinutes(0); }
    else d.setMinutes(round);
    d.setSeconds(0, 0);
    return d;
  };

  const toISO = (date: string, hour: number, min: number, ampm: 'AM' | 'PM') => {
    let h = hour;
    if (ampm === 'PM' && hour !== 12) h += 12;
    if (ampm === 'AM' && hour === 12) h = 0;
    return new Date(`${date}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`).toISOString();
  };

  const fromISO = (iso: string) => {
    const d = new Date(iso);
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' as const : 'AM' as const;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return { date: d.toISOString().slice(0, 10), hour: h, minute: Math.floor(d.getMinutes() / 30) * 30, ampm };
  };

  const syncScheduleInputs = () => {
    const now = roundUp30(new Date());
    const sd = now.toISOString().slice(0, 10);
    let h = now.getHours();
    const ap = h >= 12 ? 'PM' as const : 'AM' as const;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    const min = Math.floor(now.getMinutes() / 30) * 30;
    setStartDate(sd); setStartHour(h); setStartMinute(min); setStartAmPm(ap);
    const startIso = toISO(sd, h, min, ap);

    // End = start + max(30, duration)
    const addMins = Math.max(30, totalTime);
    const end = new Date(new Date(startIso).getTime() + addMins * 60000);
    const ed = end.toISOString().slice(0, 10);
    let eh = end.getHours();
    const eap = eh >= 12 ? 'PM' as const : 'AM' as const;
    if (eh > 12) eh -= 12;
    if (eh === 0) eh = 12;
    setEndDate(ed); setEndHour(eh); setEndMinute(Math.floor(end.getMinutes() / 30) * 30); setEndAmPm(eap);

    setStartDateTime(startIso);
    setEndDateTime(toISO(ed, eh, Math.floor(end.getMinutes() / 30) * 30, eap));
  };

  const isScheduleValid = accessType === 'anytime' || (startDateTime !== 'anytime' && endDateTime !== 'anytime' && new Date(startDateTime) < new Date(endDateTime));

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'advance'>('medium');
  const [totalTime, setTotalTime] = useState(60);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);

  const totalQuestions = subjects.reduce((total, sub) => total + sub.questionTypes.reduce((qTotal, q) => qTotal + q.count, 0), 0);
  const totalMarks = subjects.reduce((total, sub) => total + sub.questionTypes.reduce((qTotal, q) => qTotal + (q.count * q.correctMarks), 0), 0);

  // Get max questions based on premium tier
  const getMaxTemplates = () => {
    const premiumType = userProfile?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 30;
    if (premiumType.toLowerCase().includes('rise')) return 20;
    if (premiumType.toLowerCase().includes('lite')) return 10;
    return 5;
  };

  const getMaxQuestions = () => {
    const premiumType = userProfile?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 125;
    if (premiumType.toLowerCase().includes('rise')) return 100;
    if (premiumType.toLowerCase().includes('lite')) return 75;
    return 25; // Free tier
  };

  // Get max subjects based on premium tier
  const getMaxSubjects = () => {
    const premiumType = (userProfile as any)?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 10;
    if (premiumType.toLowerCase().includes('rise')) return 8;
    if (premiumType.toLowerCase().includes('lite')) return 5;
    return 3; // Free tier
  };

  const maxQuestions = getMaxQuestions();
  const maxSubjects = getMaxSubjects();

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const validateSubjects = () => {
    for (const sub of subjects) {
      const subjectTotal = sub.questionTypes.reduce((qTotal, q) => qTotal + q.count, 0);
      if (subjectTotal < 5) {
        showNotification('error', `${sub.name} must have at least 5 questions`);
        return false;
      }
    }
    return true;
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !userProfile?.$id) return;
    setIsSavingTemplate(true);
    try {
      const { count, error: countError } = await supabase
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userProfile.$id);

      if (countError) throw countError;
      if (count !== null && count >= getMaxTemplates()) {
        showNotification('error', `Template limit reached (${getMaxTemplates()}). Upgrade to save more.`);
        return;
      }

      const { error } = await supabase
        .from('templates')
        .insert({
          userId: userProfile.$id,
          name: templateName.trim(),
          examName: examName || '',
          difficulty,
          totalTime,
          visibility: isPublic,
          defaultCorrectMarks,
          defaultNegativeMarks,
          selectedTypes,
          defaultCounts,
        });

      if (error) throw error;
      showNotification('success', 'Template saved!');
      fetchTemplates();
      setShowTemplateModal(false);
      setTemplateName('');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const fetchTemplates = async () => {
    if (!userProfile?.$id) return;
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('userId', userProfile.$id)
        .order('created_at', { ascending: false });
      if (!error && data) setTemplates(data);
    } catch { } finally {
      setLoadingTemplates(false);
    }
  };

  const applyTemplate = (tmpl: any) => {
    setDifficulty(tmpl.difficulty || 'medium');
    setTotalTime(tmpl.totalTime || 60);
    setIsPublic(tmpl.visibility !== false);
    setDefaultCorrectMarks(tmpl.defaultCorrectMarks ?? 4);
    setDefaultNegativeMarks(tmpl.defaultNegativeMarks ?? 0);
    setSelectedTypes(tmpl.selectedTypes || ['mcq']);
    setDefaultCounts(tmpl.defaultCounts || {});
    setShowTemplateList(false);
  };

  const handleGenerate = () => {
    if (!validateSubjects()) return;
    const useOwn = localStorage.getItem('use_own_key') === 'true';
    const prov = localStorage.getItem('provider') || 'mesh';
    const key = localStorage.getItem(prov === 'mistral' ? 'mistral_api_key' : 'mesh_api_key');
    if (!useOwn || !key) {
      const planCost = 2;
      const questionCost = totalQuestions;
      const totalCost = planCost + questionCost;
      const userCredits = userProfile?.credits || 0;
      if (userCredits < totalCost) {
        showNotification('error', `Insufficient credits. Cost: ${planCost} (plan) + ${questionCost} (questions) = ${totalCost}. You have ${userCredits}.`);
        return;
      }
    }
    setShowFinalizeExam(true);
  };

  const addSubject = (sub?: any) => {
    if (sub) {
      if (subjects.find(s => s.id === sub.id)) return;
      setSubjects([...subjects, {
        id: sub.id, name: sub.name, academicLevel: sub.academicLevel || 'Grade 10', chapters: '', questionTypes: selectedTypes.map(type => ({
          type, count: defaultCounts[type] || 5, correctMarks: defaultCorrectMarks, negativeMarks: defaultNegativeMarks,
          mcqOptions: type === 'mcq' ? 4 : undefined, mcqMultiple: type === 'mcq' ? false : undefined
        }))
      }]);
    } else {
      setSubjects([...subjects, { id: `sub${Date.now()}`, name: '', academicLevel: '', chapters: '', questionTypes: [] }]);
    }
  };

  const removeSubject = (index: number) => setSubjects(subjects.filter((_, i) => i !== index));

  const updateSubject = (index: number, updates: Partial<SubjectConfig>) => {
    const newSubjects = [...subjects];
    newSubjects[index] = { ...newSubjects[index], ...updates };
    setSubjects(newSubjects);
  };

  if (!show) return null;

  return (
    <>
      {/* Main AI Form */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[60] bg-zinc-50 dark:bg-gray-950 text-zinc-900 dark:text-gray-100 flex flex-col"
      >
        <header className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-gray-900 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button data-template-btn onClick={() => { fetchTemplates(); setShowTemplateList(!showTemplateList); }}
              className="flex items-center gap-1.5 bg-zinc-200/80 dark:bg-gray-800/80 backdrop-blur-sm border border-zinc-300 dark:border-gray-700 rounded-lg px-2 py-1 hover:bg-zinc-300 dark:hover:bg-gray-700 transition-colors"
              title="Select a template">
              <GraduationCap className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-400 font-medium" style={{ fontSize: fontSize.xs }}>Templates</span>
            </button>


            <div className="flex items-center gap-1.5 bg-zinc-200/80 dark:bg-gray-800/80 backdrop-blur-sm border border-zinc-300 dark:border-gray-700 rounded-lg px-2 py-1">
              <CircleStop className="w-4 h-4 text-white fill-yellow-500" />
              <span className="font-medium text-zinc-900 dark:text-white" style={{ fontSize: fontSize.xs }}>{userProfile?.credits || 0}</span>
            </div>
          </div>
        </header>

        {showTemplateList && (
          <div data-template-dropdown className="fixed z-[70] top-16 right-4 w-72 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '300px' }}>
            <div className="p-2 border-b border-zinc-200 dark:border-gray-800 flex items-center justify-between">
              <h4 className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.xs }}>Your Templates</h4>
              <button onClick={() => setShowTemplateList(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-800 rounded">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-zinc-400 dark:text-gray-500 text-center py-6" style={{ fontSize: fontSize.xs }}>No templates saved yet</p>
              ) : (
                templates.map(tmpl => (
                  <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                    className="w-full text-left px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-gray-800 transition-colors border-b border-zinc-100 dark:border-gray-800/50 last:border-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate" style={{ fontSize: fontSize.sm }}>{tmpl.name}</p>
                    <p className="text-zinc-400 dark:text-gray-500 truncate" style={{ fontSize: fontSize.xs }}>{tmpl.examName}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 space-y-8 pb-32 no-scrollbar">
          {step === 'details' && (
            <>
              {/* Basic Details */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <h3 className="font-medium tracking-wider" style={{ fontSize: fontSize.xs }}>Basic Details</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="examName" className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Exam Name (Required)</label>
                      <input id="examName" name="examName" type="text" maxLength={50} required value={examName} onChange={(e) => setExamName(e.target.value)}
                        className="w-full bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl p-3 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all" style={{ fontSize: fontSize.sm }}
                        placeholder="Enter exam name manually..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col justify-between">
                        <label className="text-zinc-500 dark:text-gray-400 font-medium mb-2" style={{ fontSize: fontSize.xs }}>Correct Marks</label>
                        <div className="relative flex-1 flex items-stretch">
                          <input type="text" inputMode="numeric" maxLength={1} value={defaultCorrectMarks || ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '');
                              if (v !== '') setDefaultCorrectMarks(parseInt(v));
                              else setDefaultCorrectMarks(0);
                            }}
                            className="w-full bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-green-500 focus:outline-none transition-all h-full"
                            style={{ fontSize: fontSize.sm }} />
                        </div>
                      </div>
                      <div className="flex flex-col justify-between">
                        <label className="text-zinc-500 dark:text-gray-400 font-medium mb-2" style={{ fontSize: fontSize.xs }}>Negative Marks</label>
                        <div className="relative flex-1 flex items-stretch">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400 font-medium pointer-events-none z-10" style={{ fontSize: fontSize.sm }}>-</span>
                          <input type="text" inputMode="numeric" maxLength={1} value={defaultNegativeMarks !== undefined ? defaultNegativeMarks : ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '');
                              setDefaultNegativeMarks(v !== '' ? parseInt(v) : 0);
                            }}
                            className="w-full bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-xl pl-7 pr-3 py-2.5 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all h-full"
                            style={{ fontSize: fontSize.sm }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Visibility (Public)</label>
                        {!userProfile?.isPremium && <span className="text-[9px] text-amber-500 flex items-center gap-1">Premium required to hide</span>}
                      </div>
                      <div className="flex bg-zinc-100 dark:bg-gray-900 rounded-xl p-1 border border-zinc-300 dark:border-gray-800">
                        <button type="button" onClick={() => setIsPublic(true)} className={`flex-1 py-2 font-medium rounded-lg transition-all ${isPublic ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-gray-500'}`} style={{ fontSize: fontSize.xs }}>Public</button>
                        <button type="button" disabled={!userProfile?.isPremium} onClick={() => setIsPublic(false)} className={`flex-1 py-2 font-medium rounded-lg transition-all ${!isPublic ? 'bg-red-600 text-white' : 'text-zinc-500 dark:text-gray-500'} ${!userProfile?.isPremium ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-300 dark:hover:bg-gray-800'}`} style={{ fontSize: fontSize.xs }}>Private</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Difficulty Level</label>
                      <div className="flex bg-zinc-100 dark:bg-gray-900 rounded-xl p-1 border border-zinc-300 dark:border-gray-800">
                        {(['easy', 'medium', 'hard', 'advance'] as const).map((level) => (
                          <button key={level} onClick={() => setDifficulty(level)} className={`flex-1 py-2 font-medium rounded-lg transition-all ${difficulty === level ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-gray-500'}`} style={{ fontSize: fontSize.xs }}>{level.charAt(0).toUpperCase() + level.slice(1)}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><label htmlFor="totalTime" className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Total Time Limit</label></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setTotalTime(Math.max(5, totalTime - 5))} className="w-8 h-8 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 border border-zinc-300 dark:border-gray-700 rounded-lg flex items-center justify-center text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white transition-all" style={{ fontSize: fontSize.sm }}>-</button>
                        <input id="totalTime" name="totalTime" type="range" min="5" max="600" step="5" value={totalTime} onChange={(e) => setTotalTime(parseInt(e.target.value))} className="flex-1 accent-blue-600" />
                        <button onClick={() => setTotalTime(Math.min(600, totalTime + 5))} className="w-8 h-8 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 border border-zinc-300 dark:border-gray-700 rounded-lg flex items-center justify-center text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white transition-all" style={{ fontSize: fontSize.sm }}>+</button>
                      </div>
                      <div className="flex justify-between" style={{ fontSize: fontSize.xs }}><span>5 min</span><span className="text-blue-500" style={{ fontSize: fontSize.sm }}>{totalTime} minutes</span><span>600 min</span></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Access Schedule</label>
                    <div className="flex bg-zinc-100 dark:bg-gray-900 rounded-xl p-1 border border-zinc-300 dark:border-gray-800">
                      <button onClick={() => { setAccessType('anytime'); setStartDateTime('anytime'); setEndDateTime('anytime'); }} className={`flex-1 py-2 font-medium rounded-lg transition-all ${accessType === 'anytime' ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-gray-500'}`} style={{ fontSize: fontSize.xs }}>Anytime</button>
                      <button onClick={() => { setAccessType('specific'); syncScheduleInputs(); }} className={`flex-1 py-2 font-medium rounded-lg transition-all ${accessType === 'specific' ? 'bg-blue-600 text-white' : 'text-zinc-500 dark:text-gray-500'}`} style={{ fontSize: fontSize.xs }}>Specific Window</button>
                    </div>
                    {accessType === 'specific' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Starting Date & Time</label>
                          <div className="flex gap-2 mt-1.5">
                            <input type="date" value={startDate} onChange={(e) => {
                              setStartDate(e.target.value);
                              setStartDateTime(toISO(e.target.value, startHour, startMinute, startAmPm));
                              const newEnd = new Date(new Date(toISO(e.target.value, startHour, startMinute, startAmPm)).getTime() + Math.max(30, totalTime) * 60000);
                              setEndDate(newEnd.toISOString().slice(0, 10));
                              setEndDateTime(newEnd.toISOString());
                            }} className="flex-1 bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all [color-scheme:dark]" style={{ fontSize: fontSize.sm }} />
                            <select value={startHour} onChange={(e) => {
                              const h = parseInt(e.target.value);
                              setStartHour(h);
                              setStartDateTime(toISO(startDate, h, startMinute, startAmPm));
                            }} className="bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-2 py-2.5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" style={{ fontSize: fontSize.sm }}>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                            </select>
                            <select value={startMinute} onChange={(e) => {
                              const m = parseInt(e.target.value);
                              setStartMinute(m);
                              setStartDateTime(toISO(startDate, startHour, m, startAmPm));
                            }} className="bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-2 py-2.5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" style={{ fontSize: fontSize.sm }}>
                              {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                            </select>
                            <select value={startAmPm} onChange={(e) => {
                              const ap = e.target.value as 'AM' | 'PM';
                              setStartAmPm(ap);
                              setStartDateTime(toISO(startDate, startHour, startMinute, ap));
                            }} className="bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-2 py-2.5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" style={{ fontSize: fontSize.sm }}>
                              <option value="AM">AM</option><option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Ending Date & Time</label>
                          <div className="flex gap-2 mt-1.5">
                            <input type="date" value={endDate} onChange={(e) => {
                              setEndDate(e.target.value);
                              setEndDateTime(toISO(e.target.value, endHour, endMinute, endAmPm));
                            }} className="flex-1 bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all [color-scheme:dark]" style={{ fontSize: fontSize.sm }} />
                            <select value={endHour} onChange={(e) => {
                              const h = parseInt(e.target.value);
                              setEndHour(h);
                              setEndDateTime(toISO(endDate, h, endMinute, endAmPm));
                            }} className="bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-2 py-2.5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" style={{ fontSize: fontSize.sm }}>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                            </select>
                            <select value={endMinute} onChange={(e) => {
                              const m = parseInt(e.target.value);
                              setEndMinute(m);
                              setEndDateTime(toISO(endDate, endHour, m, endAmPm));
                            }} className="bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-2 py-2.5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" style={{ fontSize: fontSize.sm }}>
                              {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                            </select>
                            <select value={endAmPm} onChange={(e) => {
                              const ap = e.target.value as 'AM' | 'PM';
                              setEndAmPm(ap);
                              setEndDateTime(toISO(endDate, endHour, endMinute, ap));
                            }} className="bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-800 rounded-xl px-2 py-2.5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" style={{ fontSize: fontSize.sm }}>
                              <option value="AM">AM</option><option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    {!isScheduleValid && accessType === 'specific' && (
                      <p className="text-red-500 font-medium mt-1 flex items-center gap-1" style={{ fontSize: fontSize.xs }}><AlertCircle className="w-3 h-3" /> Ending time must be after starting time</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Question Types */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-500">
                  <h3 className="font-medium tracking-wider" style={{ fontSize: fontSize.xs }}>Question Types</h3>
                </div>
                <div className="space-y-4">
                  {(['mcq', 'integer', 'true_false'] as const).map((type) => {
                    const isActive = selectedTypes.includes(type);
                    const count = defaultCounts[type] ?? 5;
                    return (
                      <div key={type} onClick={() => {
                        if (isActive && selectedTypes.length <= 1) return;
                        if (isActive) {
                          setSelectedTypes(prev => prev.filter(t => t !== type));
                          setSubjects(prev => prev.map(sub => ({
                            ...sub, questionTypes: sub.questionTypes.filter(qt => qt.type !== type)
                          })));
                        } else {
                          setSelectedTypes(prev => [...prev, type]);
                          if (!defaultCounts[type]) {
                            setDefaultCounts(prev => ({ ...prev, [type]: 5 }));
                          }
                          setSubjects(prev => prev.map(sub => {
                            const qTypes = [...sub.questionTypes];
                            const idx = qTypes.findIndex(t => t.type === type);
                            if (idx >= 0) qTypes[idx] = { ...qTypes[idx], count: 5 };
                            return { ...sub, questionTypes: qTypes };
                          }));
                        }
                      }} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isActive ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-100/50 dark:bg-gray-900/50 border-zinc-200 dark:border-gray-800 opacity-60 hover:opacity-80'}`}>
                        <span className={`font-medium ${isActive ? 'text-zinc-800 dark:text-gray-100' : 'text-zinc-500 dark:text-gray-400'}`} style={{ fontSize: fontSize.sm }}>
                          {type === 'mcq' ? 'Multiple Choice' : type === 'integer' ? 'Integer' : 'True / False'}
                        </span>
                        {isActive && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input type="text" inputMode="numeric" maxLength={2} value={count || ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                setDefaultCounts(prev => ({ ...prev, [type]: raw !== '' ? parseInt(raw) : 0 }));
                              }}
                              onBlur={(e) => {
                                let raw = e.target.value.replace(/\D/g, '');
                                let val = raw !== '' ? parseInt(raw) : 5;
                                if (val < 5) val = 5;
                                if (val > 99) val = 99;
                                setDefaultCounts(prev => ({ ...prev, [type]: val }));
                                setSubjects(prev => prev.map(sub => {
                                  const qTypes = [...sub.questionTypes];
                                  const idx = qTypes.findIndex(t => t.type === type);
                                  if (idx >= 0) qTypes[idx] = { ...qTypes[idx], count: val };
                                  return { ...sub, questionTypes: qTypes };
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-14 bg-white dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-lg px-2 py-1 text-center font-medium text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              style={{ fontSize: fontSize.sm }} />
                            <span className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>q</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Subject Selection */}
          {step === 'subjects' && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-500">

                  <h3 className="font-medium" style={{ fontSize: fontSize.xs }}>Subject Selection</h3>
                  <span className="text-zinc-400 dark:text-gray-500 font-medium ml-2" style={{ fontSize: fontSize.xs }}>
                    ({subjects.length}/{maxSubjects})
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSubjects?.map((sub, index) => {
                  const isSelected = subjects.find(s => s.id === sub.id);
                  const isDisabled = !isSelected && subjects.length >= maxSubjects;
                  return (
                    <button key={sub.id} onClick={() => isDisabled ? (setDisabledItemName(sub.name), setShowUpgradeModal(true)) : isSelected ? setSubjects(subjects.filter(s => s.id !== sub.id)) : addSubject(sub)}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-xl font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-blue-600/10 border-blue-600 text-blue-500' : isDisabled ? 'bg-zinc-100 dark:bg-gray-900 border-zinc-300 dark:border-gray-800 text-zinc-500 dark:text-gray-500 opacity-50 cursor-not-allowed' : 'bg-zinc-100 dark:bg-gray-900 border-zinc-300 dark:border-gray-800 text-zinc-500 dark:text-gray-500 hover:border-zinc-400 dark:hover:border-gray-700'}`}>
                      {sub.name}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-6">
                {subjects.map((sub, sIdx) => (
                  <motion.div key={sub.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/50 dark:bg-gray-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-zinc-900 dark:text-white flex items-center gap-2" style={{ fontSize: fontSize.sm }}><CheckCircle2 className="w-4 h-4 text-blue-500" />{sub.name}</h4>
                      <div className="flex items-center gap-2 px-2 py-1 bg-zinc-100 dark:bg-gray-800 rounded-lg"><GraduationCap className="w-3 h-3 text-zinc-400" /><span className=" font-medium text-zinc-600 dark:text-gray-400">{sub.academicLevel.charAt(0).toUpperCase() + sub.academicLevel.slice(1)}</span></div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`chapters-${sub.id}`} className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Chapters / Topics <span className="text-red-400">*</span></label>
                      <input id={`chapters-${sub.id}`} name={`chapters-${sub.id}`} type="text" value={sub.chapters} onChange={(e) => {
                        if (e.target.value.length <= 200) updateSubject(sIdx, { chapters: e.target.value });
                      }}
                        className="w-full bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-800 rounded-xl p-3 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600" style={{ fontSize: fontSize.sm }}
                        placeholder="Chapter's or Topics's Name  or  FUll syllabus. e.g.  AMC MAths Full Syllabus" />
                      <div className="flex justify-between">
                        {!sub.chapters && <p className="text-[9px] text-red-400">Required</p>}
                        <p className="text-[9px] text-zinc-400 dark:text-gray-500">{sub.chapters.length}/200</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

        </main>

        {/* Footer */}
        <footer className="p-4 border-t border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md fixed bottom-0 left-0 right-0 z-10">
          <div className="max-w-md mx-auto">
            {step === 'details' ? (
              <div className="flex gap-2">
                <button onClick={() => setShowTemplateModal(true)} disabled={!examName}
                  className="px-4 py-3 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:opacity-40 text-zinc-700 dark:text-gray-300 rounded-xl font-medium transition-all border border-zinc-300 dark:border-gray-700"
                  style={{ fontSize: fontSize.sm }}>
                  Save Template
                </button>
                <button onClick={() => { setStep('subjects'); setTimeout(() => document.querySelector('.no-scrollbar')?.scrollTo({ top: 9999, behavior: 'smooth' }), 100); }} disabled={!examName}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-medium transition-all"
                  style={{ fontSize: fontSize.sm }}>
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col"><span className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Questions</span><span className={`font-mono font-medium ${totalQuestions > maxQuestions ? 'text-red-500' : 'text-blue-500'}`} style={{ fontSize: fontSize.base }}>{totalQuestions}<span className={`text-sm ${totalQuestions > maxQuestions ? 'text-red-400' : 'text-zinc-400 dark:text-gray-600'}`}>/{maxQuestions}</span></span></div>
                    <div className="flex flex-col"><span className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Marks</span><span className="font-mono font-medium text-blue-500" style={{ fontSize: fontSize.base }}>{totalMarks}</span></div>
                  </div>
                  <button onClick={handleGenerate} disabled={subjects.length === 0 || !examName || totalQuestions < 5 || totalQuestions > maxQuestions || subjects.some(s => !s.chapters) || subjects.some(s => s.questionTypes.length === 0) || !isScheduleValid}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2" style={{ fontSize: fontSize.sm }}>
                    {(() => { const useOwn = localStorage.getItem('use_own_key') === 'true'; const prov = localStorage.getItem('provider') || 'mesh'; const key = localStorage.getItem(prov === 'mistral' ? 'mistral_api_key' : 'mesh_api_key'); return useOwn && key ? 'Generate (Your Key)' : `Generate (${2 + totalQuestions} credits)`; })()}
                  </button>
                </div>
              </div>
            )}
          </div>
        </footer>

        {/* Template Save Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowTemplateModal(false); setTemplateName(''); } }}>
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-zinc-900 dark:text-white" style={{ fontSize: fontSize.lg }}>Save as Template</h3>
              <div className="space-y-2">
                <label className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>Template Name</label>
                <input type="text" maxLength={50} value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Weekly Math Practice"
                  className="w-full bg-zinc-100 dark:bg-gray-900 border border-zinc-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ fontSize: fontSize.sm }} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowTemplateModal(false); setTemplateName(''); }}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-gray-700 transition-colors"
                  style={{ fontSize: fontSize.sm }}>Cancel</button>
                <button onClick={handleSaveTemplate} disabled={!templateName.trim() || isSavingTemplate}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  style={{ fontSize: fontSize.sm }}>
                  {isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <FinalizeExam
        show={showFinalizeExam}
        onClose={() => setShowFinalizeExam(false)}
        examData={{
          examName,
          difficulty,
          totalTime,
          subjects,
          examType: 'practice',
          accessType,
          isPublic,
          startDateTime,
          endDateTime,
          categoryId
        }}
        userId={userProfile?.$id || ''}
      />


      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="text-center">
              <LockIcon className="w-12 h-12 text-zinc-500 dark:text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">Upgrade Required</h3>
              <p className="text-sm text-zinc-500 dark:text-gray-400">"{disabledItemName}" is locked. Upgrade your plan to access more subjects.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUpgradeModal(false)} className="flex-1 py-2.5 bg-gray-800 text-zinc-700 dark:text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition-colors">Close</button>
              <button onClick={() => { setShowUpgradeModal(false); window.location.href = '/dashboard'; }} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors">Upgrade Plan</button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </>
  );
}
