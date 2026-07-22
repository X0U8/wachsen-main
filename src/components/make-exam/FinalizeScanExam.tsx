import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import MathText from '../../ui/MathText';
import { motion } from 'framer-motion';
import Notification from '../../ui/Notification';
import { useUserProfile } from '../../lib/UserContext';
import { fontSize } from '../../lib/utils';
import { supabase } from '../../services/supabase';
import { getAiRequestMode } from '../../lib/aiRequest';

interface FinalizeScanExamProps {
  show: boolean;
  onClose: () => void;
  examData: {
    examName: string;
    difficulty: string;
    totalTime: number;
    subjects: any[];
    examType?: 'practice' | 'casual';
    accessType?: 'anytime' | 'specific';
    isPublic?: boolean;
    startDateTime?: string;
    endDateTime?: string;
    categoryId?: string;
    defaultCorrectMarks?: number;
    defaultNegativeMarks?: number;
    academicLevel?: string;
    scannedFiles?: any[];
  };
  userId: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

type GenerationStatus = 'idle' | 'uploading' | 'planning' | 'generating' | 'done' | 'failed';

export default function FinalizeScanExam({ show, onClose, examData, userId }: FinalizeScanExamProps) {
  const { refreshCredits } = useUserProfile();
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [examBlueprint, setExamBlueprint] = useState<any>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [generatedQuestions, setGeneratedQuestions] = useState<any>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');
  const [completedSegments, setCompletedSegments] = useState<Set<string>>(new Set());
  const [reservedCredits, setReservedCredits] = useState(0);
  const [segmentCountdown, setSegmentCountdown] = useState<number | null>(null);
  const abortRef = useRef(false);
  const generationIdRef = useRef(0);
  const hasStartedBlueprintRef = useRef(false);
  const hasStartedQuestionsRef = useRef(false);
  const hasSavedRef = useRef(false);

  useEffect(() => {
    if (!show) {
      abortRef.current = true;
      generationIdRef.current++;
      hasStartedBlueprintRef.current = false;
      hasStartedQuestionsRef.current = false;
      hasSavedRef.current = false;
      if (reservedCredits > 0) {
        refundAllCredits(reservedCredits);
      }
      setStatus('idle');
      setExamBlueprint(null);
      setCurrentSegmentIndex(0);
      setCurrentSubjectIndex(0);
      setGeneratedQuestions([]);
      setIsSaving(false);
      setFailureMessage('');
      setCompletedSegments(new Set());
      setReservedCredits(0);
      setSegmentCountdown(null);
      setNotification(null);
    }
  }, [show]);

  const uploadedFilesRef = useRef<any[]>([]);

  const resizeImage = (fileObj: any): Promise<string> => {
    const file = fileObj.file;
    const brightness = fileObj.brightness ?? 100;
    const contrast = fileObj.contrast ?? 100;
    const saturate = fileObj.saturate ?? 100;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const width = img.width;
          const height = img.height;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get 2D context'));
            return;
          }
          ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const uploadScannedFiles = async (): Promise<any[]> => {
    if (!examData.scannedFiles || examData.scannedFiles.length === 0) return [];

    const uploadedFiles: any[] = [];
    for (const f of examData.scannedFiles) {
      try {
        let fileBase64WithPrefix = '';
        if (f.file.type.startsWith('image/')) {
          fileBase64WithPrefix = await resizeImage(f);
        } else {
          fileBase64WithPrefix = await fileToBase64(f.file);
        }
        const rawBase64 = fileBase64WithPrefix.split(',')[1] || fileBase64WithPrefix;

        const response = await fetch('/api/upload-to-b2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            fileName: `exams/${userId}/${Date.now()}_${f.name}`,
            fileType: f.file.type,
            fileBase64: rawBase64
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${f.name} to B2`);
        }

        const data = await response.json();
        if (!data.url) {
          throw new Error(`No proxy URL returned for ${f.name}`);
        }

        uploadedFiles.push({
          name: f.name,
          type: f.type,
          url: data.url,
          subjectId: f.subjectId,
          subjectName: f.subjectName,
          base64: fileBase64WithPrefix
        });
      } catch (err) {
        console.error('Error uploading file to B2:', err, f.name);
        throw new Error(`Failed to upload ${f.name} to storage.`);
      }
    }
    return uploadedFiles;
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const getUseOwnKey = () => localStorage.getItem('use_own_key') === 'true';

  const reserveAllCredits = async (totalCredits: number): Promise<boolean> => {
    if (getUseOwnKey()) return true;

    const authToken = await getAuthToken();
    const authed = supabase;

    const { data: profile } = await authed.from('profiles').select('credits').eq('id', userId).single();
    const currentCredits = profile?.credits || 0;

    if (currentCredits < totalCredits) {
      showNotification('error', `Insufficient credits. Need ${totalCredits} credits. You have ${currentCredits}.`);
      return false;
    }

    const { error } = await authed.from('profiles')
      .update({ credits: currentCredits - totalCredits })
      .eq('id', userId);

    if (error) {
      showNotification('error', 'Failed to reserve credits.');
      return false;
    }

    setReservedCredits(totalCredits);
    await refreshCredits();
    return true;
  };

  const refundAllCredits = async (creditsToRefund = reservedCredits) => {
    if (getUseOwnKey() || creditsToRefund === 0) return;

    try {
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
      await supabase.from('profiles')
        .update({ credits: (profile?.credits || 0) + creditsToRefund })
        .eq('id', userId);
      setReservedCredits(0);
      await refreshCredits();
    } catch (e) {
      console.error('Credit refund failed:', e);
    }
  };

  const isStale = (capturedId: number) => abortRef.current || generationIdRef.current !== capturedId;

  const generateBlueprint = async () => {
    const myId = ++generationIdRef.current;
    abortRef.current = false;
    setStatus('uploading');

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('premium_type, storage_used')
        .eq('id', userId)
        .single();

      if (profileError) throw new Error('Failed to retrieve storage details.');

      const premiumType = profile?.premium_type || '';
      const storageUsed = profile?.storage_used || 0;

      const totalUploadBytes = (examData.scannedFiles || []).reduce((sum, f) => sum + (f.file?.size || 0), 0);

      let limitBytes = 20 * 1024 * 1024;
      if (premiumType.toLowerCase().includes('peak')) limitBytes = 200 * 1024 * 1024;
      else if (premiumType.toLowerCase().includes('rise')) limitBytes = 100 * 1024 * 1024;
      else if (premiumType.toLowerCase().includes('lite')) limitBytes = 50 * 1024 * 1024;

      if (storageUsed + totalUploadBytes > limitBytes) {
        setStatus('failed');
        setFailureMessage(`Storage limit exceeded. Your plan limit is ${limitBytes / (1024 * 1024)}MB. You have used ${(storageUsed / (1024 * 1024)).toFixed(2)}MB, and this upload requires ${(totalUploadBytes / (1024 * 1024)).toFixed(2)}MB. Please delete old exams or upgrade your plan.`);
        return;
      }

      const filesPayload = await uploadScannedFiles();
      uploadedFilesRef.current = filesPayload;

      if (isStale(myId)) return;

      await supabase
        .from('profiles')
        .update({ storage_used: storageUsed + totalUploadBytes })
        .eq('id', userId);

      setStatus('planning');

      const authToken = await getAuthToken();
      const aiRequestMode = getAiRequestMode();

      const response = await fetch('/api/generate-exam-plan-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: examData.subjects,
          examName: examData.examName,
          difficulty: examData.difficulty,
          userId,
          authToken,
          ...aiRequestMode,
          files: filesPayload,
        })
      });

      if (isStale(myId)) return;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let msg = `API error: ${response.status}`;
        try { const e = JSON.parse(text); msg = e.error || msg; } catch { }
        setStatus('failed');
        setFailureMessage(msg);
        return;
      }

      const data = await response.json();
      if (isStale(myId)) return;

      if (data.success) {
        setExamBlueprint(data.plan.subjects);
      } else {
        setStatus('failed');
        setFailureMessage(data.error || 'Failed to generate plan blueprint');
      }
    } catch (error: any) {
      if (isStale(myId)) return;
      console.error('Error generating blueprint:', error);
      setStatus('failed');
      setFailureMessage(error.message || 'Failed to generate blueprint. Please try again.');
    }
  };

  const startQuestionGeneration = async (blueprint: any[]) => {
    const myId = generationIdRef.current;
    abortRef.current = false;
    setStatus('generating');
    setGeneratedQuestions([]);
    setCompletedSegments(new Set());
    setCurrentSubjectIndex(0);
    setCurrentSegmentIndex(0);

    const extraCreditsCost = Math.ceil((examData.scannedFiles || []).reduce((sum, f) => sum + f.pagesCount, 0) / 2);
    const totalCredits = 2 + extraCreditsCost;

    if (!getUseOwnKey()) {
      const reserved = await reserveAllCredits(totalCredits);
      if (isStale(myId)) {
        if (reserved) refundAllCredits(totalCredits);
        return;
      }
      if (!reserved) {
        setStatus('failed');
        setFailureMessage('Insufficient credits to generate this exam.');
        return;
      }
    }

    const allQuestions: any[] = [];

    for (let si = 0; si < blueprint.length; si++) {
      const subject = blueprint[si];
      for (let sgi = 0; sgi < subject.segments.length; sgi++) {
        if (isStale(myId)) return;

        setCurrentSubjectIndex(si);
        setCurrentSegmentIndex(sgi);

        if (allQuestions.length > 0) {
          for (let count = 10; count > 0; count--) {
            if (isStale(myId)) return;
            setSegmentCountdown(count);
            await new Promise(r => setTimeout(r, 1000));
          }
          setSegmentCountdown(null);
        }

        if (isStale(myId)) return;
        const result = await generateOneSegment(subject, si, subject.segments[sgi]);
        if (isStale(myId)) return;
        if (!result) {
          await refundAllCredits(totalCredits);
          setStatus('failed');
          setFailureMessage(`Failed to generate questions for "${subject.name}" segment ${subject.segments[sgi].range}. No credits were charged.`);
          return;
        }

        allQuestions.push(...result);
        if (isStale(myId)) return;
        setGeneratedQuestions([...allQuestions]);
        setCompletedSegments(prev => new Set(prev).add(`${si}-${sgi}`));
      }
    }

    if (isStale(myId)) return;
    setStatus('done');
    showNotification('info', 'All questions generated successfully! Saving exam...');
    await handleSaveExam(allQuestions);
  };

  const generateOneSegment = async (subject: any, subjectIndex: number, segment: any): Promise<any[] | null> => {
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 2000));
        }

        const authToken = await getAuthToken();
        const aiRequestMode = getAiRequestMode();

        const originalSubject = examData.subjects.find((s: any) =>
          (s.name || '').toLowerCase().trim() === (subject.name || '').toLowerCase().trim()
        );
        const questionTypes = originalSubject?.questionTypes || [];

        const hasFiles = uploadedFilesRef.current.length > 0;
        let filesPayload = [];
        if (hasFiles) {
          if (Array.isArray(segment.page_indexes)) {
            segment.page_indexes.forEach((pageIdx: number) => {
              const fileObj = uploadedFilesRef.current[pageIdx];
              if (fileObj) {
                filesPayload.push({
                  name: fileObj.name,
                  type: fileObj.type,
                  url: fileObj.url,
                  base64: fileObj.base64,
                  original_index: pageIdx
                });
              }
            });
          } else {

            filesPayload = uploadedFilesRef.current.map((f, i) => ({
              name: f.name,
              type: f.type,
              url: f.url,
              base64: f.base64,
              original_index: i
            }));
          }
        }

        const response = await fetch('/api/generate-segment-questions-from-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segment,
            subjectName: subject.name,
            subjectIndex,
            questionTypes,
            difficulty: examData.difficulty,
            academicLevel: examData.subjects.find((s: any) => s.name === subject.name)?.academicLevel || examData.academicLevel || '',
            userId,
            authToken,
            ...aiRequestMode,
            creditsPreReserved: true,
            files: filesPayload
          }),
        });

        if (!response.ok) {
          console.error(`Segment ${segment.range} attempt ${attempt + 1} failed: ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          return data.questions.map((q: any) => ({ ...q, subjectIndex }));
        }

        console.error(`Segment ${segment.range} attempt ${attempt + 1}: invalid data`);
      } catch (error) {
        console.error(`Segment ${segment.range} attempt ${attempt + 1} error:`, error);
      }
    }

    return null;
  };

  useEffect(() => {
    if (show && status === 'idle' && !hasStartedBlueprintRef.current) {
      hasStartedBlueprintRef.current = true;
      generateBlueprint();
    }
  }, [show, status]);

  useEffect(() => {
    if (examBlueprint && (status === 'planning') && !hasStartedQuestionsRef.current) {
      hasStartedQuestionsRef.current = true;
      startQuestionGeneration(examBlueprint);
    }
  }, [examBlueprint, status]);

  const handleSaveExam = async (questionsOverride?: any[]) => {
    if (isSaving || hasSavedRef.current) return;
    hasSavedRef.current = true;
    setIsSaving(true);

    const authToken = await getAuthToken();
    const targetQuestions = Array.isArray(questionsOverride) ? questionsOverride : generatedQuestions;

    const examDocument = {
      examName: examData.examName,
      examType: examData.examType || 'practice',
      language: 'English',
      isPublic: examData.isPublic !== undefined ? examData.isPublic : true,
      createdBy: userId,
      accessIds: [userId],
      accessType: examData.accessType || 'anytime',
      startDateTime: examData.startDateTime || null,
      endDateTime: examData.endDateTime || null,
      difficulty: examData.difficulty,
      totalTime: examData.totalTime,
      totalQuestions: targetQuestions.length,
      totalMarks: targetQuestions.length * (examData.defaultCorrectMarks ?? 4),
      subjects: JSON.stringify(examData.subjects),
      categoryId: examData.categoryId || null,
      status: examData.accessType === 'specific' && examData.startDateTime && examData.startDateTime !== 'anytime' ? 'Pending' : 'active',
      correct_marks: examData.defaultCorrectMarks ?? 4,
      negative_marks: examData.defaultNegativeMarks ?? 0,
      generatedExam: JSON.stringify(targetQuestions.map((q: any, i: number) => ({ ...q, id: i + 1 }))),
      ExamPlan: JSON.stringify(examBlueprint),
      authToken
    };

    try {
      const response = await fetch('/api/save-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examDocument),
      });

      const data = await response.json();
      if (data.success && data.examId) {
        const mappingUrls = uploadedFilesRef.current.map(f => ({ name: f.name, url: f.url }));
        await supabase
          .from('document_mapping')
          .insert({
            user_id: userId,
            exam_id: data.examId,
            documents: mappingUrls
          });

        showNotification('success', 'Exam saved successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        showNotification('error', data.error || 'Failed to save exam');
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Error saving exam:', error);
      showNotification('error', 'Failed to save exam. Please try again.');
      setIsSaving(false);
    }
  };

  const handleRestart = () => {
    setStatus('idle');
    setExamBlueprint(null);
    setCurrentSegmentIndex(0);
    setCurrentSubjectIndex(0);
    setGeneratedQuestions([]);
    setFailureMessage('');
    setCompletedSegments(new Set());
    setReservedCredits(0);
    abortRef.current = false;
    hasStartedBlueprintRef.current = true;
    hasStartedQuestionsRef.current = false;
    generateBlueprint();
  };

  if (!show) return null;

  const totalSegments = examBlueprint?.reduce((t: number, s: any) => t + (s.segments?.length || 0), 0) || 0;

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[60] bg-zinc-50 dark:bg-gray-950 text-zinc-900 dark:text-gray-100 flex flex-col"
      >
        <header className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-gray-955/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                abortRef.current = true;
                generationIdRef.current++;
                if (reservedCredits > 0) {
                  await refundAllCredits(reservedCredits);
                }
                window.location.reload();
              }}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="font-base text-base">Finalize Question Paper Exam</h2>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-32">
          {status === 'uploading' && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
              <p className="text-zinc-900 dark:text-gray-100 font-medium">Uploading scanned documents to B2...</p>
            </div>
          )}

          {status === 'planning' && !examBlueprint && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
              <p className="text-zinc-900 dark:text-gray-100 font-medium">Scanning question paper & checking answer key...</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400" />
              <p className="text-zinc-900 dark:text-gray-100 font-medium text-center">Generation Failed</p>
              <p className="text-zinc-500 dark:text-gray-400 text-center max-w-sm text-sm">
                {failureMessage}
              </p>
              <button
                onClick={handleRestart}
                className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all text-sm">
                Try Again
              </button>
            </div>
          )}

          {examBlueprint && (status === 'generating' || status === 'done') && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-blue-500 dark:text-blue-400 font-medium text-xs">
                    {segmentCountdown !== null
                      ? `thinking, generating next segment in ${segmentCountdown}s`
                      : (status === 'generating' ? 'Extracting questions from scanned paper' : 'Extraction complete')}
                  </h4>
                  <span className="text-zinc-500 dark:text-gray-400 text-xs">
                    {completedSegments.size}/{totalSegments} segments
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${totalSegments > 0 ? (completedSegments.size / totalSegments) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {examBlueprint.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                    <h4 className="text-zinc-900 dark:text-gray-100 font-medium text-sm"><MathText text={item.name} /></h4>
                    <div className="space-y-2">
                      {item.segments.map((seg: any, sIdx: number) => {
                        const segKey = `${idx}-${sIdx}`;
                        const isCurrentSegment = status === 'generating' && idx === currentSubjectIndex && sIdx === currentSegmentIndex;
                        const isCompleted = completedSegments.has(segKey);
                        const isWaiting = !isCurrentSegment && !isCompleted;
                        return (
                          <div key={sIdx} className="bg-zinc-50 dark:bg-gray-950 rounded-lg p-3 border border-zinc-200 dark:border-gray-750">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-amber-500 dark:text-amber-400 font-medium text-xs">Questions {seg.range}</div>
                              <div className="flex items-center gap-1">
                                {isCompleted && <CheckCircle2 className="w-3 h-3 text-green-500 dark:text-green-400" />}
                                {isCurrentSegment && <Loader2 className="w-3 h-3 text-blue-500 dark:text-blue-400 animate-spin" />}
                                {isWaiting && <div className="w-3 h-3 rounded-full border border-zinc-400 dark:border-gray-600" />}
                                <span className="text-[10px]">
                                  {isCompleted ? 'Done' : isCurrentSegment ? 'Extracting...' : 'Waiting'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              {seg.topics.map((topic: string, tIdx: number) => (
                                <div key={tIdx} className="text-gray-400 dark:text-gray-400 text-xs">• <MathText text={topic} /></div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {status === 'done' && (
          <footer className="p-4 border-t border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md fixed bottom-0 left-0 right-0 z-10">
            <button
              onClick={() => handleSaveExam()}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Exam...</span>
                </>
              ) : (
                'Save Mock Exam'
              )}
            </button>
          </footer>
        )}
      </motion.div>
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
