import { useRef, useState, useCallback } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioBase64: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetRecording: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    setAudioBase64(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : undefined;

    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      const base64 = await blobToBase64(blob);
      setAudioBase64(base64);
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve();
        return;
      }

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const base64 = await blobToBase64(blob);
        setAudioBase64(base64);
        setIsRecording(false);
        resolve();
      };

      recorder.stop();
    });
  }, []);

  const resetRecording = useCallback(() => {
    setAudioBase64(null);
    setIsRecording(false);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  return {
    isRecording,
    audioBase64,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
