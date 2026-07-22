import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, AlertCircle, Loader2, Mic, Volume2, Eye, EyeOff, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { useUserProfile } from '../../lib/UserContext';
import { analyzeLaqSession, LaqAnswerRecord } from './analyzeLaqSession';
import Notification from '../../ui/Notification';
import type { LaqQuestion } from './MakeLaq';

export interface LaqExam {
  id: string;
  name: string;
  subject_name: string | null;
  topics: string | null;
  difficulty: string | null;
  question_count: number;
  time_limit_minutes: number | null;
  questions: LaqQuestion[];
  status: string;
  updated_at?: string | null;
  created_at?: string | null;
}

interface VivaSessionProps {
  laq: LaqExam;
  onComplete: () => void;
}

interface AudioMappingItem {
  url: string;
  manifestUrl: string;
  gender?: 'female' | 'male';
  answerUrl?: string;
  answerManifestUrl?: string;
  transcript?: string;
}

interface AnswerState {
  text: string;
  audioUrl?: string;
  manifestUrl?: string;
}

type SessionState = 'intro' | 'mic-check' | 'noise-check' | 'ready' | 'transitioning' | 'speaking' | 'standby' | 'recording' | 'finished';

const STANDBY_SECONDS = 30;
const RECORD_SECONDS = 55;
const NOISE_CHECK_SECONDS = 10;
const HOLD_TO_START_MS = 800;
const VOLUME_UPDATE_MS = 200;
const NOISE_FAIL_THRESHOLD = 60;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getVolumeColor(level: number) {
  if (level < 30) return 'bg-emerald-500';
  if (level < 55) return 'bg-lime-500';
  if (level < 75) return 'bg-yellow-500';
  if (level < 90) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function VivaSession({ laq, onComplete }: VivaSessionProps) {
  const { userProfile } = useUserProfile();

  const [sessionState, setSessionState] = useState<SessionState>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    laq.questions.map(() => ({ text: '' }))
  );

  const [audioMapping, setAudioMapping] = useState<Record<number, AudioMappingItem>>({});
  const [replayCounts, setReplayCounts] = useState<Record<number, number>>({});
  const [interviewerGender, setInterviewerGender] = useState<'female' | 'male' | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);


  const [waitCountdown, setWaitCountdown] = useState(STANDBY_SECONDS);
  const [recordTimeLeft, setRecordTimeLeft] = useState(RECORD_SECONDS);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);


  const [noiseCheckProgress, setNoiseCheckProgress] = useState(0);
  const [isNoiseCheckFailed, setIsNoiseCheckFailed] = useState(false);
  const [noiseCheckError, setNoiseCheckError] = useState<'noisy' | 'no-mic' | null>(null);
  const [micCheckError, setMicCheckError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const noiseValuesRef = useRef<number[]>([]);


  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isStopHolding, setIsStopHolding] = useState(false);
  const [stopHoldProgress, setStopHoldProgress] = useState(0);
  const [startHoldProgress, setStartHoldProgress] = useState(0);


  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);
  const stopHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopHoldStartRef = useRef<number>(0);
  const startHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startHoldStartRef = useRef<number>(0);
  const backgroundUploadsRef = useRef<Promise<void>[]>([]);
  const fireUploadInBackgroundRef = useRef<(blob: Blob, capturedIndex: number) => void>(() => { });
  const handleNextRef = useRef<() => void>(() => { });
  const submitAllRef = useRef<() => Promise<void>>(async () => { });
  const ttsPromisesRef = useRef<Record<number, Promise<AudioMappingItem | null>>>({});
  const audioMappingRef = useRef<Record<number, AudioMappingItem>>(audioMapping);
  const playQuestionAudioRef = useRef<(index: number, isReplay?: boolean, fallbackUrl?: string) => boolean>(() => false);
  const generateTTSRef = useRef<(index: number) => Promise<AudioMappingItem | null>>(async () => null);
  const autoSkipRef = useRef<() => void>(() => { });
  const answersRef = useRef(answers);
  const sessionStartRef = useRef<number | null>(null);
  const prepareIndexRef = useRef<number>(0);

  const totalQuestions = laq.questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const currentQuestion = laq.questions[currentIndex]?.question || '';
  audioMappingRef.current = audioMapping;
  answersRef.current = answers;


  const stopMicStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      if (stopHoldTimerRef.current) clearInterval(stopHoldTimerRef.current);
      if (startHoldTimerRef.current) clearInterval(startHoldTimerRef.current);
      stopAudio();
      stopMicStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch { }
      }
    };
  }, [stopAudio, stopMicStream]);


  useEffect(() => {
    const loadMapping = async () => {
      try {
        const { data, error } = await supabase
          .from('laq_audio_mapping')
          .select('mapping')
          .eq('laq_exam_id', laq.id)
          .maybeSingle();
        if (!error && data && data.mapping) {
          setAudioMapping(data.mapping);


          const loadedAnswers = laq.questions.map((_, idx) => {
            const mapped = data.mapping[idx] || data.mapping[idx.toString()];
            return {
              text: mapped?.transcript || '',
              audioUrl: mapped?.answerUrl || '',
              manifestUrl: mapped?.answerManifestUrl || ''
            };
          });
          setAnswers(loadedAnswers);
          answersRef.current = loadedAnswers;


          let firstUnanswered = 0;
          for (let i = 0; i < laq.questions.length; i++) {
            const mapped = data.mapping[i] || data.mapping[i.toString()];
            if (!mapped?.transcript) {
              firstUnanswered = i;
              break;
            }
            if (i === laq.questions.length - 1) {
              firstUnanswered = i;
            }
          }
          setCurrentIndex(firstUnanswered);
          prepareIndexRef.current = firstUnanswered;
        }
      } catch (err) {
        console.error('Failed to load audio mapping:', err);
      }
    };
    loadMapping();
  }, [laq.id, laq.questions]);


  const saveMapping = useCallback(async (mapping: Record<number, AudioMappingItem>) => {
    try {
      await supabase
        .from('laq_audio_mapping')
        .upsert({
          laq_exam_id: laq.id,
          mapping,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'laq_exam_id' });
    } catch (err) {
      console.error('Failed to save audio mapping:', err);
    }
  }, [laq.id]);


  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`viva_answers_${laq.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === laq.questions.length) {
          setAnswers(parsed);
          answersRef.current = parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load answers from sessionStorage:', e);
    }
  }, [laq.id, laq.questions.length]);


  useEffect(() => {
    try {
      sessionStorage.setItem(`viva_answers_${laq.id}`, JSON.stringify(answers));
    } catch (e) {
      console.error('Failed to save answers to sessionStorage:', e);
    }
  }, [answers, laq.id]);


  useEffect(() => {
    if (sessionState === 'intro' || sessionState === 'mic-check' || sessionState === 'noise-check' || sessionState === 'ready' || submitting) {
      setTimeLeft(null);
      return;
    }
    const startTime = sessionStartRef.current || new Date(laq.updated_at || laq.created_at || '').getTime();
    const limitSeconds = (laq.time_limit_minutes || 15) * 60;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, limitSeconds - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (totalTimerRef.current) clearInterval(totalTimerRef.current);
        submitAllRef.current();
      }
    };

    updateTimer();
    totalTimerRef.current = setInterval(updateTimer, 1000);
    return () => {
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    };
  }, [sessionState, submitting, laq.updated_at, laq.created_at, laq.time_limit_minutes]);


  const startVolumeMeter = useCallback(() => {
    if (!analyserRef.current) return;
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    volumeIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const max = dataArray.length ? Math.max(...Array.from(dataArray)) : 0;
      const level = Math.min(100, Math.round((max / 255) * 100));
      setVolumeLevel(level);
      noiseValuesRef.current.push(level);
    }, VOLUME_UPDATE_MS);
  }, []);

  const stopVolumeMeter = useCallback(() => {
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    setVolumeLevel(0);
  }, []);


  const initMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;
      return true;
    } catch {
      setNotification({ type: 'error', message: 'Microphone access denied.' });
      return false;
    }
  };


  const startNoiseCheck = () => {
    setIsNoiseCheckFailed(false);
    setNoiseCheckError(null);
    setNoiseCheckProgress(0);
    setVolumeLevel(0);
    noiseValuesRef.current = [];
    setSessionState('noise-check');
    startVolumeMeter();

    let secondsPassed = 0;
    const interval = setInterval(() => {
      secondsPassed++;
      setNoiseCheckProgress(secondsPassed);
      if (secondsPassed >= NOISE_CHECK_SECONDS) {
        clearInterval(interval);
        stopVolumeMeter();
        const vals = noiseValuesRef.current;
        const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        const max = vals.length ? Math.max(...vals) : 0;
        const min = vals.length ? Math.min(...vals) : 0;

        if (avg > NOISE_FAIL_THRESHOLD) {
          setIsNoiseCheckFailed(true);
          setNoiseCheckError('noisy');
          stopMicStream();
        } else if (vals.length > 5 && max - min < 2) {
          setIsNoiseCheckFailed(true);
          setNoiseCheckError('no-mic');
          stopMicStream();
        } else {
          setSessionState('ready');
        }
      }
    }, 1000);
  };

  const checkMicPermission = async () => {
    setMicCheckError(null);
    const ok = await initMic();
    if (ok) {
      startNoiseCheck();
    } else {
      setMicCheckError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
    }
  };


  const startViva = async () => {
    const now = new Date().toISOString();
    sessionStartRef.current = Date.now();
    prepareIndexRef.current = 0;
    await supabase.from('laq_exam').update({ status: 'ongoing', updated_at: now }).eq('id', laq.id);

    const cached = audioMappingRef.current[0];
    if (cached?.url && cached?.gender === (interviewerGender || 'female')) {
      playQuestionAudioRef.current(0, false, cached.url);
    } else {
      setSessionState('transitioning');
    }
  };


  const generateTTS = useCallback(async (index: number): Promise<AudioMappingItem | null> => {
    if (!userProfile?.id || !laq.questions[index]) return null;

    if (ttsPromisesRef.current[index]) {
      return ttsPromisesRef.current[index];
    }

    const promise = (async () => {
      try {

        const { data: dbData, error: dbError } = await supabase
          .from('laq_audio_mapping')
          .select('mapping')
          .eq('laq_exam_id', laq.id)
          .maybeSingle();

        if (!dbError && dbData && dbData.mapping) {
          const dbMapping = dbData.mapping as Record<string | number, AudioMappingItem>;
          const cachedItem = dbMapping[index] || dbMapping[index.toString()];
          if (cachedItem?.url && cachedItem?.gender === (interviewerGender || 'female')) {
            setAudioMapping(prev => {
              const next = { ...prev, [index]: { ...(prev[index] || {}), ...cachedItem } };
              return next;
            });
            return cachedItem;
          }
        }


        const res = await fetch('/api/generate_viva_media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_tts',
            text: laq.questions[index].question,
            gender: interviewerGender || 'female',
            userId: userProfile.id,
            examId: laq.id,
            index,
          }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          const item: AudioMappingItem = {
            url: data.url,
            manifestUrl: data.manifestUrl,
            gender: interviewerGender || 'female'
          };
          setAudioMapping(prev => {
            const next = { ...prev, [index]: { ...(prev[index] || {}), ...item } };
            saveMapping(next);
            return next;
          });
          return item;
        } else {
          delete ttsPromisesRef.current[index];
        }
      } catch (err) {
        console.error('TTS generation failed:', err);
        delete ttsPromisesRef.current[index];
      }
      return null;
    })();

    ttsPromisesRef.current[index] = promise;
    return promise;
  }, [userProfile?.id, laq.id, laq.questions, interviewerGender, saveMapping]);
  generateTTSRef.current = generateTTS;


  const playQuestionAudio = useCallback((index: number, isReplay = false, fallbackUrl?: string) => {
    stopAudio();
    setIsAutoplayBlocked(false);
    const url = fallbackUrl || audioMappingRef.current[index]?.url;
    if (!url) {
      setSessionState('standby');
      if (!isReplay) setWaitCountdown(STANDBY_SECONDS);
      return false;
    }

    setSessionState('speaking');
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      setSessionState('standby');
      if (!isReplay) setWaitCountdown(STANDBY_SECONDS);
    };
    audio.onerror = () => {
      setSessionState('standby');
      if (!isReplay) setWaitCountdown(STANDBY_SECONDS);
    };
    audio.play().catch(err => {
      console.warn('Playback blocked or failed:', err);
      if (err.name === 'AbortError') {
        return;
      }
      if (!isReplay) {
        setIsAutoplayBlocked(true);
      } else {
        setSessionState('standby');
      }
    });
    return true;
  }, [stopAudio]);
  playQuestionAudioRef.current = playQuestionAudio;


  useEffect(() => {
    if (sessionState !== 'transitioning') return;
    if (submitting) return;

    let cancelled = false;
    const prepare = async () => {
      await new Promise(r => setTimeout(r, 800));
      if (cancelled) return;

      const targetIndex = prepareIndexRef.current;
      const cached = audioMappingRef.current[targetIndex];
      let url = cached?.url;
      if (!cached?.url || cached?.gender !== (interviewerGender || 'female')) {
        const generated = await generateTTSRef.current(targetIndex);
        url = generated?.url;
      }
      if (!cancelled) playQuestionAudioRef.current(targetIndex, false, url);
    };

    prepare();
    return () => { cancelled = true; };
  }, [sessionState, submitting, interviewerGender]);


  useEffect(() => {
    const isActive = ['speaking', 'standby', 'recording', 'transitioning'].includes(sessionState);
    if (!isActive || submitting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setNotification({ type: 'error', message: 'Navigation is disabled during the Viva session.' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [sessionState, submitting]);


  const prefetchNextQuestion = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalQuestions) return;
    const cached = audioMappingRef.current[nextIndex];
    if (cached?.url && cached?.gender === (interviewerGender || 'female')) return;
    await generateTTSRef.current(nextIndex);
  }, [currentIndex, totalQuestions, interviewerGender]);


  useEffect(() => {
    if (sessionState === 'speaking' || sessionState === 'standby' || sessionState === 'recording') {
      prefetchNextQuestion();
    }
  }, [currentIndex, sessionState, prefetchNextQuestion]);


  useEffect(() => {
    if (sessionState !== 'standby') return;
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    startVolumeMeter();

    waitTimerRef.current = setInterval(() => {
      setWaitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(waitTimerRef.current!);
          autoSkipRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      stopVolumeMeter();
    };
  }, [sessionState]);


  useEffect(() => {
    if (sessionState !== 'recording') return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecordTimeLeft(RECORD_SECONDS);
    startVolumeMeter();

    recordTimerRef.current = setInterval(() => {
      setRecordTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(recordTimerRef.current!);
          stopRecordingAndProceed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [sessionState]);


  const startRecording = () => {
    if (!micStreamRef.current || mediaRecorderRef.current?.state === 'recording') return;
    audioChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(micStreamRef.current, { mimeType: 'audio/webm' });
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        const capturedIndex = currentIndex;

        fireUploadInBackgroundRef.current(blob, capturedIndex);

        handleNextRef.current();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      setNotification({ type: 'error', message: 'Failed to start recording.' });
      setSessionState('standby');
    }
  };


  const stopRecordingAndProceed = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Failed to stop media recorder, forcing next question:', err);
        handleNextRef.current();
      }
    } else {
      console.warn('Media recorder was null or inactive, forcing next question.');
      handleNextRef.current();
    }
  };


  const fireUploadInBackground = useCallback((blob: Blob, capturedIndex: number) => {
    if (blob.size === 0 || !userProfile?.id) return;

    const task = (async () => {
      try {
        const base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const audioBase64 = base64data.split(',')[1];

        const response = await fetch('/api/generate_viva_media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_audio',
            audioBase64,
            userId: userProfile.id,
            examId: laq.id,
            index: capturedIndex,
          }),
        });

        let transcript = '';
        let answerUrl = '';
        let answerManifestUrl = '';

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.url) {
            transcript = data.transcript || '';
            answerUrl = data.url;
            answerManifestUrl = data.manifestUrl;
          }
        }


        const updatedAnswers = [...answersRef.current];
        updatedAnswers[capturedIndex] = { text: transcript, audioUrl: answerUrl, manifestUrl: answerManifestUrl };
        answersRef.current = updatedAnswers;
        setAnswers(updatedAnswers);


        const nextMapping = {
          ...audioMappingRef.current,
          [capturedIndex]: {
            ...(audioMappingRef.current[capturedIndex] || { url: '', manifestUrl: '' }),
            answerUrl,
            answerManifestUrl,
            transcript,
          },
        };
        await saveMapping(nextMapping);
        setAudioMapping(nextMapping);
      } catch (err) {
        console.error(`[Viva] Background upload failed for Q${capturedIndex}:`, err);
      }
    })();


    backgroundUploadsRef.current.push(task);
  }, [userProfile?.id, laq.id, saveMapping]);
  fireUploadInBackgroundRef.current = fireUploadInBackground;

  const submitAll = useCallback(async () => {
    if (!userProfile?.id || submitting) return;
    setSubmitting(true);
    setSessionState('transitioning');
    stopAudio();
    stopMicStream();
    stopVolumeMeter();

    try {

      await Promise.allSettled(backgroundUploadsRef.current);

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const latestAnswers = answersRef.current;
      const records: LaqAnswerRecord[] = latestAnswers.map((a, idx) => ({
        questionIndex: idx,
        question: laq.questions[idx].question,
        userAnswer: a.text,
        correctness: 'incorrect',
        feedback: '',
      }));

      const analysis = await analyzeLaqSession(records, userProfile.id, authToken, true);

      const answersPayload = latestAnswers.map((a, idx) => ({
        questionIndex: idx,
        userAnswer: a.text,
      }));

      const { error: updateError } = await supabase
        .from('laq_exam')
        .update({
          status: 'completed',
          answers: answersPayload,
          ai_feedback: analysis.feedback,
          accuracy: analysis.accuracy,
          depth: analysis.depth,
          clarity: analysis.clarity,
          ai_analysis: {
            overall_rating: analysis.overall_rating,
            accuracy_reason: analysis.accuracy_reason,
            depth_reason: analysis.depth_reason,
            clarity_reason: analysis.clarity_reason,
            perQuestion: analysis.perQuestion,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', laq.id);

      if (updateError) throw updateError;


      sessionStorage.removeItem(`viva_answers_${laq.id}`);

      setNotification({ type: 'success', message: 'Viva completed!' });
      setTimeout(() => onComplete(), 1500);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to submit Viva.' });
      setSubmitting(false);
    }
  }, [userProfile?.id, submitting, laq.id, laq.questions, onComplete, stopAudio, stopMicStream, stopVolumeMeter]);
  submitAllRef.current = submitAll;

  const handleNext = useCallback(() => {
    stopVolumeMeter();
    stopAudio();
    setIsAutoplayBlocked(false);
    if (isLastQuestion) {
      submitAllRef.current();
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      prepareIndexRef.current = nextIndex;
      setShowTranscript(false);

      const cached = audioMappingRef.current[nextIndex];
      if (cached?.url && cached?.gender === (interviewerGender || 'female')) {
        playQuestionAudioRef.current(nextIndex, false, cached.url);
      } else {
        setSessionState('transitioning');
      }
    }
  }, [isLastQuestion, currentIndex, stopVolumeMeter, stopAudio, interviewerGender]);
  handleNextRef.current = handleNext;

  const autoSkip = useCallback(() => {
    stopVolumeMeter();
    const finalAnswers = [...answersRef.current];
    finalAnswers[currentIndex] = { text: '[No response]' };
    answersRef.current = finalAnswers;
    setAnswers(finalAnswers);

    setAudioMapping(prev => {
      const existing = prev[currentIndex] || { url: '', manifestUrl: '' };
      const next = {
        ...prev,
        [currentIndex]: { ...existing, transcript: '[No response]' },
      };
      saveMapping(next);
      return next;
    });
    handleNextRef.current();
  }, [currentIndex, stopVolumeMeter, saveMapping]);
  autoSkipRef.current = autoSkip;


  const startHold = () => {
    if (sessionState !== 'standby' || isHolding) return;
    setIsHolding(true);
    setHoldProgress(0);
    holdStartRef.current = Date.now();

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, (elapsed / HOLD_TO_START_MS) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setIsHolding(false);
        setHoldProgress(0);
        setSessionState('recording');
        startRecording();
      }
    }, 50);
  };

  const endHold = () => {
    if (!isHolding) return;
    setIsHolding(false);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setHoldProgress(0);
  };

  const startStopHold = () => {
    if (sessionState !== 'recording' || isStopHolding) return;
    setIsStopHolding(true);
    setStopHoldProgress(0);
    stopHoldStartRef.current = Date.now();

    stopHoldTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - stopHoldStartRef.current;
      const progress = Math.min(100, (elapsed / HOLD_TO_START_MS) * 100);
      setStopHoldProgress(progress);
      if (progress >= 100) {
        if (stopHoldTimerRef.current) clearInterval(stopHoldTimerRef.current);
        setIsStopHolding(false);
        setStopHoldProgress(0);
        stopRecordingAndProceed();
      }
    }, 50);
  };

  const endStopHold = () => {
    if (!isStopHolding) return;
    setIsStopHolding(false);
    if (stopHoldTimerRef.current) clearInterval(stopHoldTimerRef.current);
    setStopHoldProgress(0);
  };

  const handleReListen = () => {
    const currentCount = replayCounts[currentIndex] || 0;
    if (currentCount >= 3) {
      setNotification({ type: 'error', message: 'You have reached the maximum of 3 replays for this question.' });
      return;
    }
    if (audioMappingRef.current[currentIndex]?.url) {
      const played = playQuestionAudioRef.current(currentIndex, true);
      if (played) {
        setReplayCounts(prev => ({ ...prev, [currentIndex]: currentCount + 1 }));
      }
    }
  };

  const handleResolveAutoplay = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setIsAutoplayBlocked(false);
        })
        .catch(err => {
          console.error('Failed to play audio after interaction:', err);
        });
    }
  };


  const statusText = () => {
    if (isAutoplayBlocked) return 'Autoplay blocked. Click to play question';
    if (sessionState === 'speaking') return 'Interviewer is speaking';
    if (sessionState === 'standby') return 'Your turn to speak';
    if (sessionState === 'recording') return 'Recording your answer';
    if (sessionState === 'transitioning') return 'Preparing...';
    return '';
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col">
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <header className="sticky top-0 z-10 px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-zinc-900 dark:text-white truncate font-medium text-sm">{laq.name}</h1>
        </div>

        {timeLeft !== null && (
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-300 dark:border-gray-700 bg-zinc-200/30 dark:bg-gray-800/30 text-zinc-700 dark:text-gray-300 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 flex-1">
          <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 font-medium uppercase tracking-wider">
            {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8 max-w-6xl mx-auto w-full flex flex-col items-center justify-center">
        {/* Active Session */}
        {(sessionState === 'speaking' || sessionState === 'standby' || sessionState === 'recording' || sessionState === 'transitioning') && (
          <div className="relative w-full max-w-2xl bg-white/40 dark:bg-gray-900/40 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-zinc-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">
                {statusText()}
              </p>
              {showTranscript && sessionState !== 'recording' && !isHolding && !isStopHolding && (
                <h2 className="text-zinc-900 dark:text-white text-base md:text-lg font-medium leading-relaxed">
                  {currentQuestion}
                </h2>
              )}
            </div>

            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              {isAutoplayBlocked ? (
                <button
                  onClick={handleResolveAutoplay}
                  className="absolute inset-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all cursor-pointer animate-pulse border-none outline-none"
                >
                  <Play className="w-8 h-8 fill-current relative left-0.5 text-white" />
                </button>
              ) : sessionState === 'speaking' ? (
                <>
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                  <div className="absolute inset-3 bg-blue-500/30 rounded-full animate-pulse" />
                  <div className="absolute inset-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Volume2 className="w-7 h-7 text-white" />
                  </div>
                </>
              ) : (
                <div className="absolute inset-6 bg-zinc-200 dark:bg-gray-800 rounded-full flex items-center justify-center border border-zinc-300 dark:border-gray-700">
                  <Volume2 className="w-7 h-7 text-zinc-500 dark:text-gray-500 opacity-40" />
                </div>
              )}
            </div>

            <div className="min-h-[48px] flex items-center justify-center">
              {sessionState === 'standby' && (
                <div className="space-y-1">
                  <div className="text-3xl font-mono font-medium text-blue-600 dark:text-blue-400">
                    0:{waitCountdown.toString().padStart(2, '0')}
                  </div>
                  <p className="text-zinc-500 dark:text-gray-400 text-xs font-medium">You have to Start under 30 sec</p>
                </div>
              )}
              {sessionState === 'recording' && (
                <div className="text-3xl font-mono font-medium text-red-500 dark:text-red-400">
                  {formatTime(recordTimeLeft)}
                </div>
              )}
            </div>

            {sessionState === 'recording' && (
              <div className="h-2 w-full bg-zinc-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${getVolumeColor(volumeLevel)}`}
                  style={{ width: `${volumeLevel}%` }}
                />
              </div>
            )}

            <div className="space-y-3">
              {sessionState === 'standby' && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onPointerDown={startHold}
                    onPointerUp={endHold}
                    onPointerLeave={endHold}
                    onPointerCancel={endHold}
                    className="relative w-20 h-20 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-transform cursor-pointer select-none touch-none"
                  >
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" className="text-blue-400/30" />
                      <circle
                        cx="50" cy="50" r="46"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeDasharray={`${holdProgress * 2.89} 289`}
                        className="text-white transition-all duration-75"
                      />
                    </svg>
                    <Mic className="w-7 h-7 relative z-10" />
                  </button>
                  <p className="text-zinc-500 dark:text-gray-400 text-xs font-medium">Hold to speak</p>
                </div>
              )}

              {sessionState === 'recording' && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onPointerDown={startStopHold}
                    onPointerUp={endStopHold}
                    onPointerLeave={endStopHold}
                    onPointerCancel={endStopHold}
                    className="relative w-20 h-20 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg shadow-red-500/30 active:scale-95 transition-transform cursor-pointer select-none touch-none"
                  >
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" className="text-red-400/30" />
                      <circle
                        cx="50" cy="50" r="46"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeDasharray={`${stopHoldProgress * 2.89} 289`}
                        className="text-white transition-all duration-75"
                      />
                    </svg>
                    <svg className="w-7 h-7 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                    </svg>
                  </button>
                  <p className="text-red-500 dark:text-red-400 text-xs font-medium">Hold to finish</p>
                </div>
              )}

              {sessionState !== 'speaking' && sessionState !== 'recording' && !isHolding && !isStopHolding && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowTranscript(s => !s)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium text-xs transition-all cursor-pointer"
                  >
                    {showTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showTranscript ? 'Hide' : 'Transcript'}
                  </button>
                  <button
                    onClick={handleReListen}
                    disabled={(sessionState === 'transitioning' && !audioMapping[currentIndex]?.url) || (replayCounts[currentIndex] || 0) >= 3}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium text-xs transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Replay ({Math.max(0, 3 - (replayCounts[currentIndex] || 0))} left)
                  </button>
                </div>
              )}
            </div>

            {/* Preparing overlay */}
            {sessionState === 'transitioning' && !submitting && (
              <div className="absolute inset-0 bg-white dark:bg-gray-900 rounded-3xl flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-zinc-900 dark:text-white text-sm font-medium">Preparing question...</p>
              </div>
            )}

            {/* Saving overlay */}
            {submitting && (
              <div className="absolute inset-0 bg-white dark:bg-gray-900 rounded-3xl flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-zinc-900 dark:text-white text-sm font-medium">Saving your responses...</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Gender Selection */}
      <AnimatePresence>
        {sessionState === 'intro' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl text-center">
              <h3 className="text-zinc-900 dark:text-white text-xl font-medium">Viva Exam</h3>
              <p className="text-zinc-500 dark:text-gray-400 text-sm">{laq.name}</p>

              <div className="text-left space-y-2">
                <label className="text-zinc-500 dark:text-gray-500 text-sm">Interviewer Voice</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['female', 'male'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { setInterviewerGender(g); setSessionState('mic-check'); }}
                      className={`aspect-square rounded-xl border font-medium text-sm transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${interviewerGender === g
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-zinc-100 dark:bg-gray-800 border-zinc-200 dark:border-gray-700 text-zinc-700 dark:text-gray-400 hover:bg-zinc-100 dark:hover:bg-gray-750'
                        }`}
                    >
                      <span className="text-2xl">👤</span>
                      <span>{g === 'female' ? 'Female' : 'Male'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => window.history.back()}
                  className="flex-1 py-3 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic Permission Check */}
      <AnimatePresence>
        {sessionState === 'mic-check' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl text-center">
              <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Microphone Access</h3>

              {micCheckError ? (
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-red-500 dark:text-red-400 text-sm font-medium">{micCheckError}</p>
                  <button
                    onClick={() => window.history.back()}
                    className="w-full py-2.5 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium text-sm transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-zinc-500 dark:text-gray-400 text-sm">
                    We need access to your microphone to record your answers.
                  </p>
                  <button
                    onClick={checkMicPermission}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4" /> Check Microphone
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Noise Check */}
      <AnimatePresence>
        {sessionState === 'noise-check' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl text-center">
              <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Mic Check</h3>

              {!isNoiseCheckFailed ? (
                <>
                  <p className="text-zinc-500 dark:text-gray-400 text-sm">
                    Stay quiet for {NOISE_CHECK_SECONDS}s while we check background noise.
                  </p>

                  <div className="space-y-2">
                    <div className="h-3 w-full bg-zinc-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-100 ${getVolumeColor(volumeLevel)}`} style={{ width: `${volumeLevel}%` }} />
                    </div>
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(noiseCheckProgress / NOISE_CHECK_SECONDS) * 100}%` }} />
                    </div>
                  </div>

                  <p className="text-zinc-500 dark:text-gray-500 text-xs font-medium uppercase tracking-wider">
                    Checking {noiseCheckProgress}/{NOISE_CHECK_SECONDS}
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-red-500 dark:text-red-400 text-sm font-medium">
                    {noiseCheckError === 'no-mic' ? 'Microphone not working' : 'Environment too noisy'}
                  </p>
                  <p className="text-zinc-500 dark:text-gray-400 text-xs">
                    {noiseCheckError === 'no-mic'
                      ? 'Check your microphone connection and ensure permissions are granted.'
                      : 'Find a quieter place or switch to written LAQ mode.'}
                  </p>
                  <button
                    onClick={() => window.history.back()}
                    className="w-full py-2.5 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium text-sm transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ready to Start */}
      <AnimatePresence>
        {sessionState === 'ready' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-6 shadow-2xl text-center">
              <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Ready to Start</h3>
              <p className="text-zinc-500 dark:text-gray-400 text-sm">
                You're all set! Press start when you're ready.
              </p>

              <div className="flex flex-col items-center gap-4 pt-2">
                <button
                  onPointerDown={() => {
                    setStartHoldProgress(0);
                    startHoldStartRef.current = Date.now();
                    startHoldTimerRef.current = setInterval(() => {
                      const elapsed = Date.now() - startHoldStartRef.current;
                      const pct = Math.min(100, (elapsed / HOLD_TO_START_MS) * 100);
                      setStartHoldProgress(pct);
                      if (pct >= 100) {
                        if (startHoldTimerRef.current) clearInterval(startHoldTimerRef.current);
                        startViva();
                      }
                    }, 50);
                  }}
                  onPointerUp={() => {
                    if (startHoldTimerRef.current) clearInterval(startHoldTimerRef.current);
                    setStartHoldProgress(0);
                  }}
                  onPointerLeave={() => {
                    if (startHoldTimerRef.current) clearInterval(startHoldTimerRef.current);
                    setStartHoldProgress(0);
                  }}
                  onPointerCancel={() => {
                    if (startHoldTimerRef.current) clearInterval(startHoldTimerRef.current);
                    setStartHoldProgress(0);
                  }}
                  className="relative w-20 h-20 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-transform cursor-pointer select-none touch-none"
                >
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" className="text-blue-400/30" />
                    <circle
                      cx="50" cy="50" r="46"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeDasharray={`${startHoldProgress * 2.89} 289`}
                      className="text-white transition-all duration-75"
                    />
                  </svg>
                  <svg className="w-7 h-7 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                  </svg>
                </button>
                <p className="text-zinc-500 dark:text-gray-400 text-xs font-medium">Hold to start</p>
                <button
                  onClick={() => window.history.back()}
                  className="w-full py-2.5 bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 hover:bg-zinc-100 dark:hover:bg-gray-800 text-zinc-900 dark:text-white rounded-xl font-medium text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
