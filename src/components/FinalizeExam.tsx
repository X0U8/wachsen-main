import React, { useState, useEffect } from 'react';
import { ChevronLeft, RefreshCw, AlertCircle, CheckCircle2, CircleStop } from 'lucide-react';
import { motion } from 'framer-motion';
import Notification from '../ui/Notification';
import { useUserProfile } from '../lib/UserContext';

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
  };
  userId: string;
  initialPlan?: any;
}

export default function FinalizeExam({ show, onClose, examData, userId, initialPlan }: FinalizeExamProps) {
  const { refreshCredits, userProfile } = useUserProfile();
  const [isGenerating, setIsGenerating] = useState(!!initialPlan ? false : true);
  const [examBlueprint, setExamBlueprint] = useState<any>(initialPlan ? initialPlan.subjects : null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [generatedQuestions, setGeneratedQuestions] = useState<any>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [allQuestionsGenerated, setAllQuestionsGenerated] = useState(false);
  const [failedSegments, setFailedSegments] = useState<Set<string>>(new Set());
  const [allSegmentsAttempted, setAllSegmentsAttempted] = useState(false);
  const [segmentJsonData, setSegmentJsonData] = useState<Record<string, any>>({});

  // Prevent going back and show reload warning
  useEffect(() => {
    if (!show) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Exam generation is in progress. Are you sure you want to leave?';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      showNotification('info', 'Cannot go back during exam generation');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [show]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const generateBlueprint = async () => {
    try {
      const response = await fetch(`/api/generate-exam-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: examData.subjects,
          examName: examData.examName,
          difficulty: examData.difficulty,
          userId
        }),
      });

      const data = await response.json();
      if (data.success) {
        setExamBlueprint(data.plan.subjects);
        setIsGenerating(false);
        await refreshCredits();
      } else {
        showNotification('error', data.error || 'Failed to generate blueprint');
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Error generating blueprint:', error);
      showNotification('error', 'Failed to generate blueprint. Please try again.');
      setIsGenerating(false);
    }
  };

  const generateSegmentQuestions = async (subjectIndex: number, segmentIndex: number, retryCount = 0) => {
    if (!examBlueprint || !examBlueprint[subjectIndex] || !examBlueprint[subjectIndex].segments[segmentIndex]) {
      return;
    }

    const subject = examBlueprint[subjectIndex];
    const segment = subject.segments[segmentIndex];
    const segmentKey = `${subjectIndex}-${segmentIndex}`;

    try {
      const response = await fetch(`/api/generate-segment-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment,
          subjectName: subject.name,
          subjectIndex,
          questionTypes: examData.subjects[subjectIndex]?.questionTypes || [],
          difficulty: examData.difficulty,
          userId
        }),
      });

      const data = await response.json();
      if (data.success) {
        const questionsWithIndex = data.questions.map((q: any) => ({ ...q, subjectIndex }));
        setGeneratedQuestions(prev => [...prev, ...questionsWithIndex]);
        setSegmentJsonData(prev => ({ ...prev, [segmentKey]: data.raw }));
        setFailedSegments(prev => {
          const newSet = new Set(prev);
          newSet.delete(segmentKey);
          return newSet;
        });

        // Move to next segment
        const nextSegmentIndex = segmentIndex + 1;
        const nextSubjectIndex = subjectIndex;

        if (nextSegmentIndex < subject.segments.length) {
          setCurrentSegmentIndex(nextSegmentIndex);
          setCooldownRemaining(30);
          startCooldown(() => generateSegmentQuestions(nextSubjectIndex, nextSegmentIndex));
        } else if (subjectIndex + 1 < examBlueprint.length) {
          setCurrentSubjectIndex(subjectIndex + 1);
          setCurrentSegmentIndex(0);
          setCooldownRemaining(30);
          startCooldown(() => generateSegmentQuestions(subjectIndex + 1, 0));
        } else {
          setIsGeneratingQuestions(false);
          setAllSegmentsAttempted(true);
          if (failedSegments.size === 0) {
            setAllQuestionsGenerated(true);
            showNotification('success', 'All questions generated successfully!');
          } else {
            showNotification('info', 'Some segments failed. You can regenerate them.');
          }
        }
      } else {
        if (retryCount < 3) {
          // Auto-retry on error with no cooldown
          console.log(`Retrying segment ${subjectIndex}-${segmentIndex}, attempt ${retryCount + 1}`);
          setTimeout(() => generateSegmentQuestions(subjectIndex, segmentIndex, retryCount + 1), 1000);
        } else {
          setFailedSegments(prev => new Set(prev).add(segmentKey));
          showNotification('error', `Failed to generate questions for ${subject.name} segment ${segment.range}`);
          // Move to next segment immediately on failure
          const nextSegmentIndex = segmentIndex + 1;
          if (nextSegmentIndex < subject.segments.length) {
            setCurrentSegmentIndex(nextSegmentIndex);
            setCooldownRemaining(30);
            startCooldown(() => generateSegmentQuestions(subjectIndex, nextSegmentIndex));
          } else if (subjectIndex + 1 < examBlueprint.length) {
            setCurrentSubjectIndex(subjectIndex + 1);
            setCurrentSegmentIndex(0);
            setCooldownRemaining(30);
            startCooldown(() => generateSegmentQuestions(subjectIndex + 1, 0));
          } else {
            setIsGeneratingQuestions(false);
            setAllSegmentsAttempted(true);
            showNotification('info', 'Some segments failed. You can regenerate them.');
          }
        }
      }
    } catch (error) {
      console.error('Error generating segment questions:', error);
      if (retryCount < 3) {
        setTimeout(() => generateSegmentQuestions(subjectIndex, segmentIndex, retryCount + 1), 1000);
      } else {
        setFailedSegments(prev => new Set(prev).add(segmentKey));
        showNotification('error', 'Failed to generate questions. Please try again.');
        // Continue to next segment
        const nextSegmentIndex = segmentIndex + 1;
        if (nextSegmentIndex < subject.segments.length) {
          setCurrentSegmentIndex(nextSegmentIndex);
          setCooldownRemaining(30);
          startCooldown(() => generateSegmentQuestions(subjectIndex, nextSegmentIndex));
        } else if (subjectIndex + 1 < examBlueprint.length) {
          setCurrentSubjectIndex(subjectIndex + 1);
          setCurrentSegmentIndex(0);
          setCooldownRemaining(30);
          startCooldown(() => generateSegmentQuestions(subjectIndex + 1, 0));
        } else {
          setIsGeneratingQuestions(false);
          setAllSegmentsAttempted(true);
          showNotification('info', 'Some segments failed. You can regenerate them.');
        }
      }
    }
  };

  const startCooldown = (callback: () => void) => {
    let countdown = 30;
    setCooldownRemaining(countdown);

    const interval = setInterval(() => {
      countdown--;
      setCooldownRemaining(countdown);
      if (countdown <= 0) {
        clearInterval(interval);
        callback();
      }
    }, 1000);
  };

  const regenerateSegment = async (subjectIndex: number, segmentIndex: number) => {
    const segmentKey = `${subjectIndex}-${segmentIndex}`;
    setFailedSegments(prev => {
      const newSet = new Set(prev);
      newSet.delete(segmentKey);
      return newSet;
    });
    setCurrentSubjectIndex(subjectIndex);
    setCurrentSegmentIndex(segmentIndex);
    setIsGeneratingQuestions(true);
    await generateSegmentQuestions(subjectIndex, segmentIndex);
  };

  const handleSaveExam = async () => {
    setIsSaving(true);

    // Calculate total questions and marks
    let totalQuestions = 0;
    let totalMarks = 0;

    examData.subjects.forEach((subject: any) => {
      subject.questionTypes.forEach((q: any) => {
        totalQuestions += q.count;
        totalMarks += q.count * q.correctMarks;
      });
    });

    const examDocument = {
      examName: examData.examName,
      examType: examData.examType || 'practice',
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
      isTemplate: false,
      categoryId: examData.categoryId || null,
      status: 'active',
      generatedExam: JSON.stringify(generatedQuestions),
      ExamPlan: JSON.stringify(examBlueprint)
    };

    try {
      const response = await fetch('/api/save-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examDocument),
      });

      const data = await response.json();
      if (data.success) {
        showNotification('success', 'Exam saved successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        showNotification('error', data.error || 'Failed to save exam');
      }
    } catch (error) {
      console.error('Error saving exam:', error);
      showNotification('error', 'Failed to save exam. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isGeneratingQuestions && examBlueprint && currentSubjectIndex === 0 && currentSegmentIndex === 0) {
      generateSegmentQuestions(0, 0);
    }
  }, [isGeneratingQuestions]);

  useEffect(() => {
    if (show && isGenerating) {
      generateBlueprint();
    }
  }, [show]);

  if (!show) return null;

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[60] bg-gray-950 flex flex-col"
      >
        <header className="p-4 flex items-center justify-between border-b border-gray-900 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-gray-900 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-base">Finalize Exam</h2>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg px-2 py-1">
            <CircleStop className="w-4 h-4 text-white fill-yellow-500" />
            <span className="text-white font-medium text-xs">{userProfile?.credits || 0}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-32">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full">
              <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-white font-medium">Generating exam plan</p>
            </div>
          ) : examBlueprint ? (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-blue-500 font-medium text-sm">Exam Plan</h3>
                  {cooldownRemaining > 0 && (
                    <span className="text-amber-500 text-xs">Thinking about questions, Writting in: {cooldownRemaining}s</span>
                  )}
                </div>
                <div className="space-y-4">
                  {examBlueprint.map((item: any, idx: number) => (
                    <div key={idx} className="bg-gray-950 rounded-lg p-4 border border-gray-800 space-y-3">
                      <h4 className="text-white font-medium text-sm">{item.name}</h4>
                      <div className="space-y-2">
                        {item.segments.map((seg: any, sIdx: number) => {
                          const isCurrentSegment = isGeneratingQuestions && idx === currentSubjectIndex && sIdx === currentSegmentIndex;
                          const isCompleted = idx < currentSubjectIndex || (idx === currentSubjectIndex && sIdx < currentSegmentIndex) || (!isGeneratingQuestions && segmentJsonData[`${idx}-${sIdx}`]);
                          const segmentKey = `${idx}-${sIdx}`;
                          const isFailed = failedSegments.has(segmentKey);
                          const canRegenerate = allSegmentsAttempted && isFailed && !isGeneratingQuestions;
                          return (
                            <div key={sIdx} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs text-amber-500 font-medium">Questions {seg.range}</div>
                                <div className="flex items-center gap-1">
                                  {isCompleted && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                  {isCurrentSegment && <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />}
                                  {isFailed && !isGeneratingQuestions && <AlertCircle className="w-3 h-3 text-red-500" />}
                                  {!isCompleted && !isCurrentSegment && !isFailed && <div className="w-3 h-3 rounded-full border border-gray-600" />}
                                  <span className="text-[10px]">
                                    {isCompleted ? 'Generated' : isCurrentSegment ? 'Generating...' : isFailed ? 'Failed' : 'active'}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                {seg.topics.map((topic: string, tIdx: number) => (
                                  <div key={tIdx} className="text-xs text-gray-400">• {topic}</div>
                                ))}
                              </div>
                              {segmentJsonData[segmentKey] && (
                                <div className="mt-2 bg-gray-950 rounded-lg p-2 border border-gray-700">
                                  <div className="text-[10px] text-gray-500 mb-1">Generated JSON:</div>
                                  <pre className="text-[9px] text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                                    {segmentJsonData[segmentKey]}
                                  </pre>
                                </div>
                              )}
                              {canRegenerate && (
                                <button
                                  onClick={() => regenerateSegment(idx, sIdx)}
                                  className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-xs font-medium transition-all"
                                >
                                  Regenerate
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-white font-medium">Failed to generate plan</p>
            </div>
          )}
        </main>

        {/* Fixed Footer */}
        {examBlueprint && (
          <footer className="p-4 border-t border-gray-900 bg-gray-950/80 backdrop-blur-md fixed bottom-0 left-0 right-0 z-10">
            {!isGeneratingQuestions && !allSegmentsAttempted && (
              <button
                onClick={() => setIsGeneratingQuestions(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium text-sm transition-all"
              >
                Generate Questions
              </button>
            )}
            {allSegmentsAttempted && !isGeneratingQuestions && failedSegments.size === 0 && (
              <button
                onClick={() => handleSaveExam()}
                disabled={isSaving}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium text-sm transition-all"
              >
                {isSaving ? 'Saving...' : 'Save Exam'}
              </button>
            )}
            {allSegmentsAttempted && !isGeneratingQuestions && failedSegments.size > 0 && (
              <div className="text-center text-amber-500 text-xs">
                Regenerate failed segments to save exam
              </div>
            )}
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
