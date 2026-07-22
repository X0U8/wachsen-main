import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle, Volume2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Notification from '../../ui/Notification';

export default function VivaTestPage() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(55);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);


  const startRecording = async () => {
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];
    setTimeLeft(55);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;


      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      volumeIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const max = dataArray.length ? Math.max(...Array.from(dataArray)) : 0;
        setVolume(Math.min(100, Math.round((max / 255) * 100)));
      }, 50);


      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Failed to access microphone:', err);
      setError('Microphone access denied or failed to initialize.');
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    setVolume(0);
    setRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    if (blob.size === 0) return;
    setTranscribing(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const rawBase64 = base64.split(',')[1] || base64;

      const res = await fetch('/api/generate_viva_media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transcribe_only',
          audioBase64: rawBase64
        })
      });

      if (!res.ok) {
        throw new Error('Transcription API failed');
      }

      const data = await res.json();
      if (data.success) {
        setTranscript(data.transcript || '[Speech could not be understood]');
      } else {
        throw new Error(data.error || 'Failed to transcribe');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to transcribe audio.');
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col">
      <header className="px-4 py-3 bg-zinc-100/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-zinc-200 dark:border-gray-800 flex items-center gap-4">
        <button
          onClick={() => navigate('/exam')}
          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold">Speech-to-Text Sandbox Test</h1>
      </header>

      <main className="flex-1 p-6 max-w-xl mx-auto w-full flex flex-col justify-center gap-8">
        <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm space-y-6 text-center">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-zinc-800 dark:text-gray-100">STT Audio Level Checker</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Speak into your microphone. Let's check how accurately Google transcribes it without sample rate wrapping.
            </p>
          </div>

          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            {recording ? (
              <>
                <div className="absolute inset-0 bg-red-500/10 rounded-full animate-ping" />
                <button
                  onClick={stopRecording}
                  className="absolute inset-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Square className="w-6 h-6 fill-current" />
                  <span className="text-[10px] font-medium tracking-wide">0:{timeLeft.toString().padStart(2, '0')}</span>
                </button>
              </>
            ) : (
              <button
                onClick={startRecording}
                disabled={transcribing}
                className="absolute inset-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-gray-800 text-white disabled:text-zinc-400 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Mic className="w-8 h-8" />
              </button>
            )}
          </div>

          {recording && (
            <div className="space-y-2">
              <div className="h-2 w-full bg-zinc-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-75"
                  style={{ width: `${volume}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-gray-400 font-mono">Audio Volume: {volume}%</p>
            </div>
          )}

          {transcribing && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <p className="text-xs text-zinc-500 dark:text-gray-400">Transcribing via Google Cloud STT...</p>
            </div>
          )}

          {transcript && (
            <div className="space-y-2 text-left pt-2 border-t border-zinc-150 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-gray-400 uppercase tracking-wider">Detected Transcript:</h3>
              <div className="bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 min-h-[60px] text-sm leading-relaxed text-zinc-800 dark:text-white">
                {transcript}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl text-xs text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </main>

      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
