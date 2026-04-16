/**
 * useVoiceRecognition — Web Audio API 錄音管理 hook
 * 按住錄音（mousedown/touchstart）→ 放開送出 → POST /api/voice/process
 */

import { useState, useRef, useCallback } from 'react';

export type VoiceState = 'idle' | 'recording' | 'recognizing' | 'parsing' | 'result';

export interface VoiceFields {
  loanType: 'mortgage' | 'personal' | 'reverse_annuity';
  basicInfo: {
    occupation: string | null;
    income: number | null;
    purpose: string | null;
    amount: number | null;
    termYears: number | null;
  };
}

export interface VoiceResult {
  transcript: string;
  taiwaneseDisplay?: string;
  fields: VoiceFields;
  mode: 'demo' | 'asr';
}

const MAX_RECORD_MS = 30_000;

export function useVoiceRecognition() {
  const [state, setState] = useState<VoiceState>('idle');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 開始錄音
  const startRecording = useCallback(async () => {
    if (state !== 'idle' && state !== 'result') return;

    setError('');
    setResult(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(200);
      setState('recording');

      // 自動停止上限 30 秒
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_MS);
    } catch (err) {
      setError('無法取得麥克風權限，請確認瀏覽器設定');
      setState('idle');
    }
  }, [state]);

  // 停止錄音並送出
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    mediaRecorderRef.current.onstop = async () => {
      // 釋放麥克風
      streamRef.current?.getTracks().forEach((t) => t.stop());

      setState('recognizing');

      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // 轉 base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1] || '');
        };
        reader.readAsDataURL(blob);
      });

      setState('parsing');

      try {
        const res = await fetch('/api/voice/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: base64, mimeType }),
        });
        const data = await res.json() as VoiceResult & { success: boolean };
        if (!data.success) throw new Error('語音辨識失敗');
        setResult(data);
        setState('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : '語音辨識失敗，請再試一次');
        setState('idle');
      }
    };

    mediaRecorderRef.current.stop();
  }, []);

  // Demo 模式：直接呼叫 API（不錄音）
  const runDemo = useCallback(async () => {
    setError('');
    setResult(null);
    setState('recognizing');

    await new Promise((r) => setTimeout(r, 800));
    setState('parsing');

    try {
      const res = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json() as VoiceResult & { success: boolean };
      if (!data.success) throw new Error('語音辨識失敗');
      setResult(data);
      setState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '示範模式失敗，請稍後再試');
      setState('idle');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError('');
  }, []);

  return {
    state,
    result,
    error,
    startRecording,
    stopRecording,
    runDemo,
    reset,
  };
}
