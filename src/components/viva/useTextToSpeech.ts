import { useRef, useState, useCallback } from 'react';

interface UseTextToSpeechReturn {
  isSpeaking: boolean;
  speakingError: string | null;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingError, setSpeakingError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingError(null);
  }, []);

  const speak = useCallback(async (text: string) => {
    stop();
    setSpeakingError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let err = {};
        try { err = JSON.parse(errText); } catch (_) {}
        const message = (err as any).details || (err as any).error || `TTS request failed (${response.status})`;
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('TTS playback error:', err);
        setSpeakingError(err.message);
      }
      setIsSpeaking(false);
    }
  }, [stop]);

  return { isSpeaking, speakingError, speak, stop };
}
