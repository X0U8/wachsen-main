import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, AlertCircle, XCircle, Clock, Sparkle, Volume2, VolumeX, Play } from 'lucide-react';
import { useUserProfile } from '../../lib/UserContext';
import { useTheme } from '../../lib/ThemeContext';
import { fontSize } from '../../lib/utils';
import AITutorModal from '../results/AITutorModal';
import { supabase } from '../../services/supabase';
import MathText from '../../ui/MathText';

interface LaqAnalysisProps {
  laq: any;
}

function CircularProgress({ value, label, colorClass, trailColorClass }: { value: number; label: string; colorClass: string; trailColorClass: string }) {
  const { fontSizeLevel } = useTheme();
  const scale = { small: 0.85, medium: 1.0, large: 1.15, larger: 1.3 }[fontSizeLevel] || 1.0;

  const percentage = Math.max(0, Math.min(100, (value || 0) * 10));
  const radius = 30 * scale;
  const strokeWidth = 5 * scale;
  const svgSize = 72 * scale;
  const center = svgSize / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-4 bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-900 rounded-3xl shadow-sm hover:shadow-md transition-all">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle cx={center} cy={center} r={radius} className={`${trailColorClass} stroke-current`} strokeWidth={strokeWidth} fill="transparent" />
          <circle cx={center} cy={center} r={radius} className={`${colorClass} stroke-current transition-all duration-1000 ease-out`} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-semibold text-zinc-800 dark:text-white" style={{ fontSize: fontSize.sm }}>
          {(value || 0).toFixed(1)}
        </div>
      </div>
      <span className="tracking-wider font-semibold text-zinc-400 mt-3" style={{ fontSize: fontSize.xs }}>{label}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function mapCorrectness(correctness: string): 'correct' | 'wrong' | 'skipped' {
  if (correctness === 'correct') return 'correct';
  return 'wrong';
}

export default function LaqAnalysis({ laq }: LaqAnalysisProps) {
  const navigate = useNavigate();
  const { fontSizeLevel } = useTheme();
  const scale = { small: 0.85, medium: 1.0, large: 1.15, larger: 1.3 }[fontSizeLevel] || 1.0;
  const analysis = laq?.ai_analysis;
  const aiFeedback = laq?.ai_feedback || analysis?.feedback || '';
  const overallRating = analysis?.overall_rating ?? 0;
  const accuracy = laq?.accuracy ?? analysis?.accuracy ?? 0;
  const depth = laq?.depth ?? analysis?.depth ?? 0;
  const clarity = laq?.clarity ?? analysis?.clarity ?? 0;

  const [audioMapping, setAudioMapping] = useState<Record<number, any>>({});

  const perQuestion: any[] = useMemo(() => {
    const rawPerQ = Array.isArray(analysis?.perQuestion) ? analysis.perQuestion : [];
    const answers = Array.isArray(laq?.answers) ? laq.answers : [];
    const questions = Array.isArray(laq?.questions) ? laq.questions : [];

    return rawPerQ.map((item: any) => {
      const qIndex = item.questionIndex;
      const ansRecord = answers.find((a: any) => a.questionIndex === qIndex);
      const qRecord = questions[qIndex] || null;
      const mapItem = audioMapping[qIndex] || audioMapping[qIndex.toString()] || null;

      return {
        ...item,
        question: qRecord?.question || ansRecord?.question || item.question || `Question ${qIndex + 1}`,
        userAnswer: ansRecord?.userAnswer || item.userAnswer || '',
        audioUrl: mapItem?.answerUrl || ansRecord?.audioUrl || item.audioUrl || '',
        manifestUrl: mapItem?.answerManifestUrl || ansRecord?.manifestUrl || item.manifestUrl || '',
        timeSpentSeconds: ansRecord?.timeSpentSeconds || item.timeSpentSeconds || 0,
      };
    });
  }, [analysis, laq, audioMapping]);

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [tutorItem, setTutorItem] = useState<{ question: any; userAnswer: string; index: number; status: 'correct' | 'wrong' | 'skipped' } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const { userProfile, refreshCredits } = useUserProfile();
  const userId = userProfile?.id || null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudio, setPlayingAudio] = useState<{ type: 'question' | 'answer' | 'overall'; index: number } | null>(null);


  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingAudio(null);
  };


  const playAudio = (url: string, type: 'question' | 'answer' | 'overall', index: number, onEnded?: () => void) => {
    stopAudio();
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAudio({ type, index });
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      setPlayingAudio(null);
    });
    audio.onended = () => {
      setPlayingAudio(null);
      if (onEnded) onEnded();
    };
  };


  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);


  useEffect(() => {
    if (!laq?.is_viva) return;
    const fetchAudioMapping = async () => {
      try {
        const { data, error } = await supabase
          .from('laq_audio_mapping')
          .select('mapping')
          .eq('laq_exam_id', laq.id)
          .maybeSingle();
        if (!error && data && data.mapping) {
          setAudioMapping(data.mapping);


          Object.values(data.mapping).forEach((item: any) => {
            if (item.url) {
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.href = item.url;
              link.as = 'audio';
              document.head.appendChild(link);
            }
          });
        }
      } catch (err) {
        console.error('Failed to load audio mapping:', err);
      }
    };

    fetchAudioMapping();


    if (laq.answers) {
      laq.answers.forEach((ans: any) => {
        if (ans.audioUrl) {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = ans.audioUrl;
          link.as = 'audio';
          document.head.appendChild(link);
        }
      });
    }
  }, [laq.id, laq.is_viva, laq.answers]);


  const playSequenceStep = (qIdx: number, stepType: 'question' | 'answer') => {
    if (qIdx >= perQuestion.length) {
      stopAudio();
      return;
    }

    const question = perQuestion[qIdx];
    if (stepType === 'question') {
      const qUrl = audioMapping[qIdx]?.url || audioMapping[qIdx.toString()]?.url;
      if (qUrl) {
        setSelectedIdx(qIdx);
        playAudio(qUrl, 'overall', qIdx, () => {
          playSequenceStep(qIdx, 'answer');
        });
      } else {
        playSequenceStep(qIdx, 'answer');
      }
    } else {
      const aUrl = question.audioUrl;
      if (aUrl) {
        setSelectedIdx(qIdx);
        playAudio(aUrl, 'overall', qIdx, () => {
          playSequenceStep(qIdx + 1, 'question');
        });
      } else {
        playSequenceStep(qIdx + 1, 'question');
      }
    }
  };

  const playOverallViva = () => {
    if (playingAudio?.type === 'overall') {
      stopAudio();
    } else {
      playSequenceStep(0, 'question');
    }
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const selectedQuestion = useMemo(() => perQuestion[selectedIdx] || null, [perQuestion, selectedIdx]);
  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < perQuestion.length - 1;

  const getStatusColor = (correctness: string, isSelected = false) => {
    const ring = isSelected ? ' ring-2 ring-blue-500 scale-110' : '';
    if (correctness === 'correct') return `bg-green-500/10 dark:bg-green-500/20 border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30${ring}`;
    if (correctness === 'partial') return `bg-amber-500/10 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/30${ring}`;
    return `bg-red-500/10 dark:bg-red-500/20 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30${ring}`;
  };

  const getStatusCircle = (correctness: string) => {
    if (correctness === 'correct') return 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400';
    if (correctness === 'partial') return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400';
    return 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400';
  };

  const getAnswerPanelColor = (correctness: string) => {
    if (correctness === 'correct') return 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400';
    if (correctness === 'partial') return 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400';
    return 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100">
      <header className="px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-zinc-900 dark:text-white font-semibold truncate max-w-[250px]" style={{ fontSize: fontSize.sm }}>{laq?.name || 'LAQ Analysis'}</h1>
            <p className="text-zinc-400 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>
              {laq?.subject_name} {laq?.difficulty ? `• ${laq.difficulty}` : ''}
            </p>
          </div>
        </div>

        {analysis?.totalTimeSpentSeconds > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-200/50 dark:bg-gray-800/50 text-zinc-400 dark:text-gray-500 rounded-xl font-semibold border border-zinc-200 dark:border-gray-850" style={{ fontSize: fontSize.xs }}>
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(analysis.totalTimeSpentSeconds)}</span>
          </div>
        )}
      </header>

      <main className="flex-grow overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {!analysis ? (
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.sm }}>No analysis grading reports generated yet.</p>
            </div>
          ) : (
            <>
              {/* Overall Performance */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CircularProgress value={overallRating} label="Overall Rating" colorClass="text-blue-500" trailColorClass="text-blue-500/10" />
                <CircularProgress value={accuracy} label="Accuracy" colorClass="text-emerald-500" trailColorClass="text-emerald-500/10" />
                <CircularProgress value={depth} label="Depth" colorClass="text-amber-500" trailColorClass="text-amber-500/10" />
                <CircularProgress value={clarity} label="Clarity" colorClass="text-purple-500" trailColorClass="text-purple-500/10" />
              </div>

              {/* Feedback Section */}
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200/85 dark:border-zinc-900 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
                <h2 className="font-semibold tracking-wider text-zinc-450 dark:text-zinc-400" style={{ fontSize: fontSize.xs }}>AI Overall Feedback</h2>
                <div className="text-zinc-700 dark:text-white/80 leading-relaxed whitespace-pre-wrap" style={{ fontSize: fontSize.sm }}>
                  <MathText text={aiFeedback} />
                </div>
              </div>

              {/* Performance Score Reasons */}
              {(analysis?.accuracy_reason || analysis?.depth_reason || analysis?.clarity_reason) && (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200/85 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="font-semibold tracking-wider text-zinc-450 dark:text-zinc-450" style={{ fontSize: fontSize.xs }}>Score Explanations</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {analysis.accuracy_reason && (
                      <div className="space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5" style={{ fontSize: fontSize.xs }}>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Accuracy
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal" style={{ fontSize: fontSize.xs }}>
                          <MathText text={analysis.accuracy_reason} />
                        </p>
                      </div>
                    )}
                    {analysis.depth_reason && (
                      <div className="space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5" style={{ fontSize: fontSize.xs }}>
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Depth
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal" style={{ fontSize: fontSize.xs }}>
                          <MathText text={analysis.depth_reason} />
                        </p>
                      </div>
                    )}
                    {analysis.clarity_reason && (
                      <div className="space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5" style={{ fontSize: fontSize.xs }}>
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          Clarity
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal" style={{ fontSize: fontSize.xs }}>
                          <MathText text={analysis.clarity_reason} />
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Per-Question Section — ResultDetails style */}
              {perQuestion.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-gray-800 pb-4">
                    <h2 className="font-medium text-zinc-900 dark:text-white" style={{ fontSize: fontSize.sm }}>Question wise Analysis</h2>
                    {/* Legend */}
                    <div className="flex items-center gap-3 font-semibold text-zinc-400" style={{ fontSize: fontSize.xs }}>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Correct</span>
                      <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" />Partial</span>
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />Incorrect</span>
                    </div>
                  </div>

                  {/* Question number grid */}
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5 justify-center">
                    {perQuestion.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedIdx(idx)}
                        className={`rounded-lg border font-medium transition-all flex items-center justify-center ${getStatusColor(item.correctness, selectedIdx === idx)}`}
                        style={{ fontSize: fontSize.xs, width: `${32 * scale}px`, height: `${32 * scale}px` }}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Single question detail panel */}
                  {selectedQuestion && (
                    <div className="bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-3xl overflow-hidden">
                      <div className="p-5 space-y-4">
                        {/* Top row: number circle + badges + nav arrows */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full flex items-center justify-center font-semibold ${getStatusCircle(selectedQuestion.correctness)}`} style={{ fontSize: fontSize.sm, width: `${32 * scale}px`, height: `${32 * scale}px` }}>
                              {selectedIdx + 1}
                            </span>
                            {selectedQuestion.timeSpentSeconds > 0 && (
                              <div className="px-2 py-1 bg-zinc-100 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl" style={{ fontSize: fontSize.xs }}>
                                <div className="text-zinc-550 dark:text-gray-450 font-medium">Time</div>
                                <div className="text-zinc-900 dark:text-white font-semibold">{formatTime(selectedQuestion.timeSpentSeconds)}</div>
                              </div>
                            )}
                            {/* Rating badge */}
                            {typeof selectedQuestion.rating === 'number' && (
                              <div className="px-2 py-1 bg-zinc-100 dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl" style={{ fontSize: fontSize.xs }}>
                                <div className="text-zinc-550 dark:text-gray-450 font-medium">Rating</div>
                                <div className="text-zinc-900 dark:text-white font-semibold">{selectedQuestion.rating}</div>
                              </div>
                            )}
                            {/* Correctness badge */}
                            <div className={`px-2 py-1 border rounded-lg flex items-center gap-1.5 sm:px-3 sm:py-1.5 sm:gap-2 sm:rounded-xl font-semibold ${selectedQuestion.correctness === 'correct'
                              ? 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400'
                              : selectedQuestion.correctness === 'partial'
                                ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400'
                              }`} style={{ fontSize: fontSize.xs }}>
                              {selectedQuestion.correctness === 'correct' ? <CheckCircle2 className="w-3 h-3" /> : selectedQuestion.correctness === 'partial' ? <AlertCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span className="capitalize">{selectedQuestion.correctness}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => hasPrev && setSelectedIdx(selectedIdx - 1)}
                              disabled={!hasPrev}
                              className="p-2 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:bg-zinc-100 dark:disabled:bg-gray-905 disabled:cursor-not-allowed rounded-lg text-zinc-700 dark:text-gray-300 disabled:text-zinc-400 dark:disabled:text-gray-600 border border-zinc-350 dark:border-gray-700/50 transition-all cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => hasNext && setSelectedIdx(selectedIdx + 1)}
                              disabled={!hasNext}
                              className="p-2 bg-zinc-200 dark:bg-gray-800 hover:bg-zinc-300 dark:hover:bg-gray-700 disabled:bg-zinc-100 dark:disabled:bg-gray-905 disabled:cursor-not-allowed rounded-lg text-zinc-700 dark:text-gray-300 disabled:text-zinc-400 dark:disabled:text-gray-600 border border-zinc-350 dark:border-gray-700/50 transition-all cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </button>
                          </div>
                        </div>

                        {/* Question text with speak button */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="font-medium leading-relaxed text-zinc-900 dark:text-white flex-1" style={{ fontSize: fontSize.base }}>
                            <MathText text={selectedQuestion.question || `Question ${selectedIdx + 1}`} />
                          </div>
                          {laq.is_viva && (
                            <button
                              onClick={() => {
                                const qUrl = audioMapping[selectedIdx]?.url || audioMapping[selectedIdx.toString()]?.url;
                                if (playingAudio?.type === 'question' && playingAudio?.index === selectedIdx) {
                                  stopAudio();
                                } else {
                                  playAudio(qUrl, 'question', selectedIdx);
                                }
                              }}
                              disabled={!audioMapping[selectedIdx]?.url && !audioMapping[selectedIdx.toString()]?.url}
                              className={`p-2 rounded-xl transition-all cursor-pointer border flex-shrink-0 disabled:opacity-40 ${playingAudio?.type === 'question' && playingAudio?.index === selectedIdx
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                  : 'bg-zinc-150/40 dark:bg-gray-800/40 border-zinc-200 dark:border-gray-800 text-zinc-700 dark:text-gray-400 hover:bg-zinc-200 dark:hover:bg-gray-700'
                                }`}
                            >
                              {playingAudio?.type === 'question' && playingAudio?.index === selectedIdx ? (
                                <VolumeX className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Your Answer + AI Feedback panels */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className={`p-3 rounded-2xl border flex flex-col gap-1 ${getAnswerPanelColor(selectedQuestion.correctness)}`} style={{ fontSize: fontSize.sm }}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-zinc-500 dark:text-gray-455 font-medium" style={{ fontSize: fontSize.xs }}>Your Answer</span>
                              {laq.is_viva && selectedQuestion.audioUrl && (
                                <button
                                  onClick={() => {
                                    if (playingAudio?.type === 'answer' && playingAudio?.index === selectedIdx) {
                                      stopAudio();
                                    } else {
                                      playAudio(selectedQuestion.audioUrl, 'answer', selectedIdx);
                                    }
                                  }}
                                  className={`p-1 rounded-lg transition-all cursor-pointer border flex-shrink-0 ${playingAudio?.type === 'answer' && playingAudio?.index === selectedIdx
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-zinc-150/50 dark:bg-gray-800/50 border-zinc-250 dark:border-gray-700 text-zinc-700 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                  {playingAudio?.type === 'answer' && playingAudio?.index === selectedIdx ? (
                                    <VolumeX className="w-3.5 h-3.5" />
                                  ) : (
                                    <Volume2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="font-normal leading-relaxed">
                              {selectedQuestion.userAnswer ? <MathText text={selectedQuestion.userAnswer} /> : 'Not Answered'}
                            </span>
                          </div>
                          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-400 flex flex-col gap-1" style={{ fontSize: fontSize.sm }}>
                            <span className="text-zinc-500 dark:text-blue-500/80 font-medium" style={{ fontSize: fontSize.xs }}>AI Feedback</span>
                            <span className="font-normal leading-relaxed text-zinc-700 dark:text-zinc-300">
                              <MathText text={selectedQuestion.feedback || selectedQuestion.overall || 'No feedback available.'} />
                            </span>
                          </div>
                        </div>

                        {/* AI Tutor + Overall Viva buttons */}
                        <div className="flex justify-end items-center gap-3 pt-3 mt-1 border-t border-zinc-200/50 dark:border-gray-800/50">
                          {laq.is_viva && (
                            <button
                              onClick={playOverallViva}
                              className={`px-4 py-2 border rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer ${playingAudio?.type === 'overall'
                                  ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-md hover:shadow-lg'
                                  : 'bg-white dark:bg-gray-900 border-zinc-200 dark:border-gray-850 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-gray-800 shadow-sm'
                                }`}
                              style={{ fontSize: fontSize.xs }}
                            >
                              {playingAudio?.type === 'overall' ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5" />
                                  Stop Overall Viva
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  Overall Viva
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setTutorItem({
                                question: {
                                  id: `laq-${laq.id}-q${selectedIdx}`,
                                  text: selectedQuestion.question || `Question ${selectedIdx + 1}`,
                                  correct_answer: '',
                                  options: [],
                                },
                                userAnswer: selectedQuestion.userAnswer || '',
                                index: selectedIdx + 1,
                                status: mapCorrectness(selectedQuestion.correctness),
                              });
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            style={{ fontSize: fontSize.xs }}
                          >
                            <Sparkle className="w-3.5 h-3.5 fill-current" />
                            Ask AI Tutor
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-[60] px-4 py-2.5 rounded-2xl font-semibold shadow-lg border ${notification.type === 'error'
          ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          : notification.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
          }`} style={{ fontSize: fontSize.xs }}>
          {notification.message}
        </div>
      )}

      {/* AI Tutor Modal */}
      {tutorItem && (
        <AITutorModal
          isOpen={!!tutorItem}
          onClose={() => setTutorItem(null)}
          question={tutorItem.question}
          userAnswer={tutorItem.userAnswer}
          userId={userId}
          userProfile={userProfile}
          refreshCredits={refreshCredits}
          showNotification={showNotification}
          originalIndex={tutorItem.index}
          status={tutorItem.status}
        />
      )}
    </div>
  );
}
