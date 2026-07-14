import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import MathText from '../../ui/MathText';
import { motion } from 'framer-motion';
import Notification from '../../ui/Notification';
import { useUserProfile } from '../../lib/UserContext';
import { fontSize } from '../../lib/utils';
import { supabase } from '../../services/supabase';

interface FinalizeExamProps {
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

type GenerationStatus = 'idle' | 'planning' | 'generating' | 'done' | 'failed';

export default function FinalizeExam({ show, onClose, examData, userId }: FinalizeExamProps) {
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

  const uploadedFilePathsRef = useRef<string[]>([]);
  const uploadedFilesRef = useRef<any[]>([]);


  useEffect(() => {
    return () => {
      cleanupUploadedFiles();
    };
  }, []);

  const uploadScannedFiles = async (): Promise<any[]> => {
    if (!examData.scannedFiles || examData.scannedFiles.length === 0) return [];

    const uploadedFiles: any[] = [];
    const localPaths: string[] = [];

    for (const f of examData.scannedFiles) {
      const fileExt = f.file.name.split('.').pop() || 'jpg';
      const uniqueId = Math.random().toString(36).substr(2, 9);
      const filePath = `temp/${userId}/${uniqueId}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('scan-refs')
        .upload(filePath, f.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading file to storage:', error, f.name);
        throw new Error(`Failed to upload ${f.name} to storage.`);
      }

      localPaths.push(filePath);
      uploadedFilePathsRef.current.push(filePath);

      const { data } = supabase.storage.from('scan-refs').getPublicUrl(filePath);

      uploadedFiles.push({
        name: f.name,
        type: f.type,
        url: data.publicUrl,
        subjectId: f.subjectId,
        subjectName: f.subjectName
      });
    }

    return uploadedFiles;
  };

  const cleanupUploadedFiles = async () => {
    const paths = uploadedFilePathsRef.current;
    if (paths.length === 0) return;

    try {
      const { error } = await supabase.storage.from('scan-refs').remove(paths);
      if (error) {
        console.error('Error cleaning up files from storage:', error);
      } else {
        uploadedFilePathsRef.current = [];
      }
    } catch (e) {
      console.error('Cleanup files exception:', e);
    }
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const getProvider = () => localStorage.getItem('provider') || 'mesh';
  const getApiKey = () => localStorage.getItem(getProvider() === 'mistral' ? 'mistral_api_key' : 'mesh_api_key') || '';
  const getActiveModel = () => localStorage.getItem('mesh_active_model') || '';
  const getUseOwnKey = () => localStorage.getItem('use_own_key') === 'true';


  const getTotalQuestionCredits = () => {
    return examData.subjects.reduce((total: number, sub: any) => {
      return total + sub.questionTypes.reduce((qTotal: number, q: any) => qTotal + q.count, 0);
    }, 0);
  };


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
    setStatus('planning');
    try {
      const authToken = await getAuthToken();
      if (isStale(myId)) return;
      const apiKey = getUseOwnKey() ? getApiKey() : '';
      const provider = getUseOwnKey() ? getProvider() : 'mesh';
      const model = getUseOwnKey() ? (provider === 'mistral' ? 'mistral-small-latest' : getActiveModel()) : '';

      const hasFiles = examData.scannedFiles && examData.scannedFiles.length > 0;
      let filesPayload = [];
      if (hasFiles) {
        filesPayload = await uploadScannedFiles();
        uploadedFilesRef.current = filesPayload;
      }

      const response = await fetch('/api/generate-exam-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: examData.subjects,
          examName: examData.examName,
          difficulty: examData.difficulty,
          userId,
          authToken,
          apiKey,
          provider,
          model,
          files: hasFiles ? filesPayload : undefined,
        }),
      });

      if (isStale(myId)) return;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let msg = `API error: ${response.status}`;
        try { const e = JSON.parse(text); msg = e.error || msg; } catch { }
        if (isStale(myId)) return;
        setStatus('failed');
        setFailureMessage(msg);
        return;
      }
      const data = await response.json();
      if (isStale(myId)) return;
      if (data.success) {
        setExamBlueprint(data.plan.subjects);
        await refreshCredits();
      } else {
        await cleanupUploadedFiles();
        setStatus('failed');
        setFailureMessage(data.error || 'Failed to generate blueprint');
      }
    } catch (error) {
      if (isStale(myId)) return;
      console.error('Error generating blueprint:', error);
      await cleanupUploadedFiles();
      setStatus('failed');
      setFailureMessage('Failed to generate blueprint. Please try again.');
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


    const totalCredits = getTotalQuestionCredits();
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

          await cleanupUploadedFiles();
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
        const apiKey = getUseOwnKey() ? getApiKey() : '';
        const provider = getUseOwnKey() ? getProvider() : 'mesh';
        const model = getUseOwnKey() ? (provider === 'mistral' ? 'mistral-small-latest' : getActiveModel()) : '';

        const originalSubject = examData.subjects.find((s: any) =>
          (s.name || '').toLowerCase().trim() === (subject.name || '').toLowerCase().trim()
        );
        const questionTypes = originalSubject?.questionTypes || [];

        const hasFiles = examData.scannedFiles && examData.scannedFiles.length > 0;
        let filesPayload = [];
        if (hasFiles && uploadedFilesRef.current.length > 0) {
          const subjectFiles = uploadedFilesRef.current.filter((f: any) =>
            String(f.subjectName || '').toLowerCase().trim() === String(subject.name || '').toLowerCase().trim() ||
            String(f.subjectId || '').trim() === String(originalSubject?.id || '').trim()
          );

          if (subjectFiles.length > 0) {
            filesPayload = subjectFiles.map((f) => ({
              name: f.name,
              type: f.type,
              url: f.url
            }));
          }
        }

        const endpoint = (hasFiles && filesPayload.length > 0) ? `/api/generate-segment-questions-with-file` : `/api/generate-segment-questions`;

        const response = await fetch(endpoint, {
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
            apiKey: apiKey || undefined,
            provider,
            model: model || undefined,
            creditsPreReserved: true,
            files: hasFiles ? filesPayload : undefined
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
    if (examBlueprint && status === 'planning' && !hasStartedQuestionsRef.current) {
      hasStartedQuestionsRef.current = true;
      startQuestionGeneration(examBlueprint);
    }
  }, [examBlueprint, status]);




  const handleSaveExam = async (questionsOverride?: any[] | React.MouseEvent) => {
    if (isSaving || hasSavedRef.current) return;
    hasSavedRef.current = true;
    setIsSaving(true);

    const authToken = await getAuthToken();

    let totalQuestions = 0;
    let totalMarks = 0;

    examData.subjects.forEach((subject: any) => {
      subject.questionTypes.forEach((q: any) => {
        totalQuestions += q.count;
        totalMarks += q.count * q.correctMarks;
      });
    });

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
      totalQuestions,
      totalMarks,
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
      if (data.success) {
        await cleanupUploadedFiles();
        showNotification('success', 'Exam saved successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        await cleanupUploadedFiles();
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
        <header className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-gray-900 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                abortRef.current = true;
                generationIdRef.current++;
                await cleanupUploadedFiles();
                if (reservedCredits > 0) {
                  await refundAllCredits(reservedCredits);
                }
                window.location.reload();
              }}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-gray-900 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="font-base text-base">Finalize Exam</h2>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-32">
          {status === 'planning' && !examBlueprint && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-10 h-10 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
              <p className="text-zinc-900 dark:text-gray-100 font-medium">Generating exam plan</p>
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
                      ? `thinking, generating in ${segmentCountdown}s`
                      : (status === 'generating' ? 'generating questions' : 'generation complete')}
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
                          <div key={sIdx} className="bg-zinc-50 dark:bg-gray-950 rounded-lg p-3 border border-zinc-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-amber-500 dark:text-amber-400 font-medium text-xs">Questions {seg.range}</div>
                              <div className="flex items-center gap-1">
                                {isCompleted && <CheckCircle2 className="w-3 h-3 text-green-500 dark:text-green-400" />}
                                {isCurrentSegment && <Loader2 className="w-3 h-3 text-blue-500 dark:text-blue-400 animate-spin" />}
                                {isWaiting && <div className="w-3 h-3 rounded-full border border-zinc-400 dark:border-gray-600" />}
                                <span className="text-[10px]">
                                  {isCompleted ? 'Done' : isCurrentSegment ? 'Generating...' : 'Waiting'}
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
              onClick={handleSaveExam}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Exam'
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
