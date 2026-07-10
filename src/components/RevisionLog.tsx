import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useUserProfile } from '../lib/UserContext';
import MathText from '../ui/MathText';
import { ArrowLeft, BookOpen, AlertCircle, RotateCcw, X } from 'lucide-react';
import ConceptCards from './ConceptCards';
import Notification from '../ui/Notification';

interface RevisionLogData {
  questions: Array<{
    id: string;
    text: string;
    correctAnswer: string;
    userAnswer: string | null;
    concept: string;
  }>;
}

// Renders text with basic markdown to HTML (MathJax handles LaTeX automatically)
function renderMathMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // MathJax will handle $...$ and $$...$$ automatically
  let result = text;
  result = result
    .replace(/^### (.+)$/gm, '<div style="font-size:11px;color:#e5e7eb;font-weight:600;margin:10px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-size:12px;color:#fff;font-weight:600;margin:12px 0 4px">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-size:14px;color:#fff;font-weight:700;margin:14px 0 6px">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#d1d5db;font-style:italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#1f2937;padding:1px 4px;border-radius:4px;color:#60a5fa;font-size:11px">$1</code>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#6b7280">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div style="margin:2px 0 2px 12px">$1</div>');
  return result;
}

interface ConceptCardsProps {
  onClose: () => void;
  examQuestions?: any[];
  subtopics?: string[];
  cardCount?: number;
}

export default function RevisionLog() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { userProfile, refreshProfile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logData, setLogData] = useState<RevisionLogData | null>(null);
  const [showConceptCards, setShowConceptCards] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [subtopics, setSubtopics] = useState<string[]>([]);
  const [cardCount, setCardCount] = useState(5);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryData, setRetryData] = useState<any[]>([]);
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryResults, setRetryResults] = useState<Record<string, { isCorrect: boolean; explanation?: string; marks?: string }>>({});
  const [checkingAI, setCheckingAI] = useState<Record<string, boolean>>({});
  const [currentRetryIndex, setCurrentRetryIndex] = useState(0);

  const handleRetry = () => {
    // Prepare retry data with correct and wrong options for MCQ
    const retryQuestions = examQuestions.map((q: any) => {
      if (q.questionType === 'mcq' && q.options && q.options.length > 0) {
        // For MCQ, shuffle existing options
        return {
          ...q,
          shuffledOptions: [...q.options].sort(() => Math.random() - 0.5)
        };
      } else if (q.questionType === 'integer' || q.questionType === 'true-false') {
        // For integer/true-false, create simple options
        return {
          ...q,
          shuffledOptions: [
            q.correctAnswer,
            generateWrongAnswer(q.correctAnswer)
          ].sort(() => Math.random() - 0.5)
        };
      } else {
        // For LAQ, no options needed
        return { ...q, shuffledOptions: [] };
      }
    });
    setRetryData(retryQuestions);
    setRetryAnswers({});
    setRetryResults({});
    setCurrentRetryIndex(0);
    setShowRetry(true);
  };

  const handleRetryAnswer = (questionId: string, answer: string) => {
    setRetryAnswers(prev => ({ ...prev, [questionId]: answer }));

    const question = retryData.find((q: any) => q.id === questionId);
    if (!question) return;

    // For MCQ, integer, true-false: instant feedback
    if (question.questionType === 'mcq' || question.questionType === 'integer' || question.questionType === 'true-false') {
      const isCorrect = answer === question.correctAnswer;
      setRetryResults(prev => ({
        ...prev,
        [questionId]: { isCorrect }
      }));
    }
  };

  const handleAICheck = async (questionId: string) => {
    const question = retryData.find((q: any) => q.id === questionId);
    if (!question || !userProfile) return;

    const userAnswer = retryAnswers[questionId];
    if (!userAnswer) {
      showNotification('error', 'Please enter your answer first');
      return;
    }

    // Check credits (1 credit per LAQ check)
    if ((userProfile.credits || 0) < 1) {
      showNotification('error', 'Insufficient credits. You need 1 credit for AI check.');
      return;
    }

    try {
      setCheckingAI(prev => ({ ...prev, [questionId]: true }));

      // Use server-side API endpoint for security
      const response = await fetch('/api/evaluate-text-answers.mjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer,
          marks: 4,
          negativeMarks: -1
        })
      });

      if (!response.ok) {
        throw new Error('AI check failed');
      }

      const data = await response.json();
      const aiResponse = data.candidates[0]?.content?.parts[0]?.text || 'Failed to get response';

      // Deduct credit
      const { error: creditsError } = await supabase
        .from('profiles')
        .update({ credits: (userProfile.credits || 0) - 1 })
        .eq('id', userProfile.id);
      if (creditsError) throw creditsError;
      await refreshProfile();

      setRetryResults(prev => ({
        ...prev,
        [questionId]: {
          isCorrect: aiResponse.includes('4/4') || aiResponse.includes('full marks'),
          explanation: aiResponse
        }
      }));
    } catch (err) {
      console.error('AI check error:', err);
      showNotification('error', 'AI check failed. Please try again.');
    } finally {
      setCheckingAI(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const generateWrongAnswer = (correctAnswer: string): string => {
    // Simple wrong answer generation (placeholder)
    // In production, you might want to use AI for this
    const wrongOptions = [
      "None of the above",
      "The opposite is true",
      "This is incorrect",
      "Data insufficient"
    ];
    return wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  };

  const handleGenerateConceptCards = async () => {
    if (!userProfile) return;

    // Calculate credits needed: cardCount / 2 (every 2 cards = 1 credit)
    const creditsNeeded = Math.ceil(cardCount / 2);

    // Check if user has enough credits
    if ((userProfile.credits || 0) < creditsNeeded) {
      showNotification('error', `Insufficient credits. You need ${creditsNeeded} credits to generate ${cardCount} concept cards.`);
      return;
    }

    try {
      setGeneratingCards(true);

      // Deduct credits
      const { error: creditsError } = await supabase
        .from('profiles')
        .update({ credits: (userProfile.credits || 0) - creditsNeeded })
        .eq('id', userProfile.id);
      if (creditsError) throw creditsError;

      // Refresh user profile
      await refreshProfile();

      // Show concept cards
      setShowConceptCards(true);
    } catch (err) {
      console.error('Error generating concept cards:', err);
      showNotification('error', 'Failed to generate concept cards');
    } finally {
      setGeneratingCards(false);
    }
  };

  useEffect(() => {
    if (!examId || !userProfile?.$id) return;

    const fetchRevisionLog = async () => {
      try {
        setLoading(true);

        // Check IndexedDB first
        const cacheKey = `revision_${examId}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          try {
            const parsedCache = JSON.parse(cachedData);
            const questionsData = JSON.parse(parsedCache.questions);
            const examLogsData = JSON.parse(parsedCache.examLogs);

            // Merge original questions data with AI concept data
            const mergedQuestions = questionsData.map((q: any) => {
              const aiQuestion = examLogsData.questions?.find((aq: any) => aq.id === q.id);
              return {
                ...q,
                concept: aiQuestion?.concept || ''
              };
            });

            setLogData({ questions: mergedQuestions });
            setExamQuestions(mergedQuestions);

            // Filter wrong and skipped questions
            const wrongAndSkipped = mergedQuestions.filter((q: any) => {
              const isSkipped = !q.userAnswer;
              const isWrong = q.userAnswer && q.userAnswer !== q.correct_answer && q.userAnswer !== q.correctAnswer;
              return isSkipped || isWrong;
            });

            setExamQuestions(wrongAndSkipped);

            // Extract subtopics from concepts of wrong/skipped questions
            const topics = wrongAndSkipped
              .map((q: any) => q.concept?.split(':')[0]?.trim())
              .filter((t: string) => t);
            setSubtopics(topics);

            // Calculate card count: wrong/skipped questions * 2
            setCardCount(wrongAndSkipped.length * 2);
            setLoading(false);
            return;
          } catch (cacheErr) {
            console.error('Cache parse error:', cacheErr);
          }
        }

        // Fetch from database if cache fails
        const { data: revDocs, error: revError } = await supabase
          .from('revision')
          .select('*')
          .eq('userID', userProfile.id)
          .eq('examID', examId)
          .limit(1);

        if (revError) throw revError;

        if (revDocs && revDocs.length > 0) {
          const doc = revDocs[0];
          const questionsData = JSON.parse(doc.questions as string);
          const examLogsData = JSON.parse(doc.examLogs as string);

          // Save to IndexedDB (localStorage as fallback)
          localStorage.setItem(cacheKey, JSON.stringify({
            questions: doc.questions,
            examLogs: doc.examLogs
          }));

          // Merge original questions data with AI concept data
          const mergedQuestions = questionsData.map((q: any) => {
            const aiQuestion = examLogsData.questions?.find((aq: any) => aq.id === q.id);
            return {
              ...q,
              concept: aiQuestion?.concept || ''
            };
          });

          setLogData({ questions: mergedQuestions });
          setExamQuestions(mergedQuestions);

          // Filter wrong and skipped questions
          const wrongAndSkipped = mergedQuestions.filter((q: any) => {
            const isSkipped = !q.userAnswer;
            const isWrong = q.userAnswer && q.userAnswer !== q.correct_answer && q.userAnswer !== q.correctAnswer;
            return isSkipped || isWrong;
          });

          setExamQuestions(wrongAndSkipped);

          // Extract subtopics from concepts of wrong/skipped questions
          const topics = wrongAndSkipped
            .map((q: any) => q.concept?.split(':')[0]?.trim())
            .filter((t: string) => t);
          setSubtopics(topics);

          // Calculate card count: wrong/skipped questions * 2
          setCardCount(wrongAndSkipped.length * 2);
        } else {
          setError('No revision log found for this exam');
        }
      } catch (err) {
        console.error('Error fetching revision log:', err);
        setError('Failed to load revision log');
      } finally {
        setLoading(false);
      }
    };

    fetchRevisionLog();
  }, [examId, userProfile?.$id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading revision log...</div>
      </div>
    );
  }

  if (error || !logData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-400">{error || 'No revision log found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        

        {/* Questions Section */}
        <div className="space-y-6">
          {logData.questions.map((question, idx) => (
            <div key={question.id} className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs text-blue-400 flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white mb-3 leading-relaxed">
                    <MathText text={question.text} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                    <div>
                      <span className="text-gray-500">Your Answer:</span>
                      <span className="text-white ml-2">
                        {question.userAnswer ? <MathText text={question.userAnswer} /> : 'Skipped'}
                      </span>
                    </div>
                    {question.correctAnswer && (
                      <div>
                        <span className="text-gray-500">Correct Answer:</span>
                        <span className="text-white ml-2">
                          <MathText text={question.correctAnswer} />
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    {question.concept && (
                      <div>
                        <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-2">
                          <BookOpen className="w-3 h-3" />
                          Subtopic & Concept
                        </div>
                        <div
                          className="text-xs text-white font-medium leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderMathMarkdown(question.concept) }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Concept Cards Button */}
        <div className="mt-8">
          <button
            onClick={handleGenerateConceptCards}
            disabled={generatingCards}
            className="w-full py-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-3xl text-sm text-blue-400 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingCards ? (
              <>
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate Concept Cards ({cardCount} cards · {Math.ceil(cardCount / 2)} credits)
              </>
            )}
          </button>
        </div>

        {/* Retry Questions Button */}
        <div className="mt-4">
          <button
            onClick={handleRetry}
            className="w-full py-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-3xl text-sm text-green-400 hover:bg-green-500/20 transition-all flex items-center justify-center gap-3"
          >
            <RotateCcw className="w-5 h-5" />
            Retry the Questions (Free)
          </button>
        </div>
      </div>

      {showConceptCards && <ConceptCards onClose={() => setShowConceptCards(false)} examQuestions={examQuestions} subtopics={subtopics} cardCount={cardCount} />}

      {showRetry && retryData.length > 0 && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-green-400" />
                Retry Questions
              </h3>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Question {currentRetryIndex + 1} of {retryData.length}</span>
              <span>Original time: {retryData[currentRetryIndex]?.timeSpent || 0}s</span>
            </div>

            {/* Single question view */}
            {(() => {
              const question = retryData[currentRetryIndex];
              const result = retryResults[question.id];
              const answer = retryAnswers[question.id];
              const isMCQ = question.questionType === 'mcq';
              const isInteger = question.questionType === 'integer';
              const isTrueFalse = question.questionType === 'true-false';
              const isLAQ = question.questionType === 'long-answer' || question.questionType === 'laq' || !isMCQ && !isInteger && !isTrueFalse;

              return (
                <div className="bg-gray-800/50 rounded-2xl p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-xs text-green-400 flex-shrink-0">
                      {currentRetryIndex + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-white mb-3 leading-relaxed">
                        <MathText text={question.text} />
                      </div>

                      {/* MCQ, Integer, True-False: Show options */}
                      {(isMCQ || isInteger || isTrueFalse) && question.shuffledOptions && question.shuffledOptions.length > 0 ? (
                        <div className="space-y-2">
                          {question.shuffledOptions.map((option: string, optIdx: number) => (
                            <button
                              key={optIdx}
                              onClick={() => !result && handleRetryAnswer(question.id, option)}
                              disabled={!!result}
                              className={`w-full p-3 rounded-xl border text-left text-xs text-white transition-all ${
                                result
                                  ? result.isCorrect && option === question.correctAnswer
                                    ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                    : answer === option && !result.isCorrect
                                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                    : 'bg-gray-800/30 border-gray-700/50 opacity-50'
                                  : answer === option
                                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                  : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600 hover:bg-gray-700/30'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px]">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span><MathText text={option} /></span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        /* LAQ: Show text input */
                        <div className="space-y-3">
                          <textarea
                            value={answer || ''}
                            onChange={(e) => !result && setRetryAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                            disabled={!!result}
                            placeholder="Type your answer here..."
                            className="w-full p-3 rounded-xl border border-gray-700/50 bg-gray-800/30 text-xs text-white placeholder-gray-500 resize-none h-24 disabled:opacity-50"
                          />
                          {!result && (
                            <button
                              onClick={() => handleAICheck(question.id)}
                              disabled={checkingAI[question.id] || !answer}
                              className="w-full py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-xs text-blue-400 hover:bg-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {checkingAI[question.id] ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                  Checking...
                                </>
                              ) : (
                                <>
                                  AI Check (1 Credit)
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Result display */}
                      {result && (
                        <div className={`mt-3 p-3 rounded-xl text-xs ${
                          result.isCorrect
                            ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                            : 'bg-red-500/20 border border-red-500/30 text-red-400'
                        }`}>
                          {result.isCorrect ? 'Correct!' : 'Incorrect'}
                          {result.explanation && (
                            <div className="mt-2 text-white/80 whitespace-pre-wrap">{result.explanation}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Results summary when all questions answered */}
            {Object.keys(retryResults).length === retryData.length && retryData.length > 0 && (
              <div className="bg-gray-800/50 rounded-2xl p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white">Retry Results</h4>
                <div className="text-sm text-gray-300">
                  {(() => {
                    const correctCount = Object.values(retryResults).filter(r => r.isCorrect).length;
                    const totalCount = retryData.length;
                    const percentage = (correctCount / totalCount) * 100;

                    let message = '';
                    let messageColor = '';

                    if (percentage < 50) {
                      message = 'Hmm these questions still need revisions';
                      messageColor = 'text-orange-400';
                    } else if (percentage < 70) {
                      message = 'Moderate performance';
                      messageColor = 'text-yellow-400';
                    } else if (percentage < 80) {
                      message = 'Good';
                      messageColor = 'text-green-400';
                    } else if (percentage < 90) {
                      message = 'Great';
                      messageColor = 'text-green-300';
                    } else {
                      message = 'This concepts are properly revised';
                      messageColor = 'text-green-200';
                    }

                    return (
                      <div>
                        <div className="text-2xl font-bold text-white mb-2">
                          {correctCount} / {totalCount} correct ({Math.round(percentage)}%)
                        </div>
                        <div className={`text-sm ${messageColor} mb-4`}>{message}</div>
                        <button
                          onClick={() => setShowRetry(false)}
                          className="w-full py-3 bg-blue-500 rounded-xl text-sm text-white hover:bg-blue-600 transition-all"
                        >
                          Close
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Navigation buttons - hide when all answered */}
            {Object.keys(retryResults).length !== retryData.length && (
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentRetryIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentRetryIndex === 0}
                  className="flex-1 py-3 bg-gray-800 rounded-xl text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentRetryIndex(prev => Math.min(retryData.length - 1, prev + 1))}
                  disabled={currentRetryIndex === retryData.length - 1}
                  className="flex-1 py-3 bg-blue-500 rounded-xl text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all"
                >
                  Next
                </button>
              </div>
            )}
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
    </div>
  );
}
