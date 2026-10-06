import { useEffect, useRef, useState } from 'react';
export type RecordingPhase = 'idle' | 'requesting' | 'recording' | 'stopping' | 'error';
interface RecordingState { phase: RecordingPhase; message: string; seconds: number; url: string | null }
export function microphoneError(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '마이크 권한이 거절되었습니다. 브라우저 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '마이크를 찾을 수 없습니다. 마이크를 연결한 뒤 다시 시도해 주세요.';
  return '마이크에 접근하지 못했습니다. 다른 프로그램의 마이크 사용과 기기 설정을 확인해 주세요.';
}
export function useRecorder() {
  const [state, setState] = useState<RecordingState>({ phase: 'idle', message: '녹음 대기 중', seconds: 0, url: null });
  const phase = useRef<RecordingPhase>('idle');
  const alive = useRef(true);
  const generation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const url = useRef<string | null>(null);
  const limit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tick = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const clearTimers = () => { clearTimeout(limit.current); clearInterval(tick.current); };
  const releaseStream = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  const revoke = () => { if (url.current) URL.revokeObjectURL(url.current); url.current = null; };
  const transition = (next: RecordingPhase, message: string) => {
    phase.current = next;
    if (alive.current) setState(s => ({ ...s, phase: next, message }));
  };
  const disposeRecorder = () => {
    const current = recorder.current;
    recorder.current = null;
    if (current) {
      current.ondataavailable = current.onstop = current.onerror = null;
      if (current.state !== 'inactive') { try { current.stop(); } catch { /* Tracks are still released below. */ } }
    }
    clearTimers(); releaseStream();
  };
  const stop = () => {
    if (phase.current !== 'recording') return;
    transition('stopping', '녹음 마무리 중…');
    clearTimers();
    try { recorder.current?.stop(); releaseStream(); }
    catch { disposeRecorder(); transition('error', '녹음을 종료하지 못했습니다. 다시 녹음해 주세요.'); }
  };
  const clear = () => {
    if (['requesting', 'recording', 'stopping'].includes(phase.current)) return false;
    revoke();
    transition('idle', '녹음 대기 중');
    setState(s => ({ ...s, url: null, seconds: 0 }));
    return true;
  };
  const start = async (beforeStart: () => void) => {
    // The ref lock is synchronous, so two clicks before React renders cannot request two streams.
    if (['requesting', 'recording', 'stopping'].includes(phase.current)) return;
    beforeStart();
    if (!window.isSecureContext) { transition('error', '녹음은 HTTPS 또는 localhost에서 사용할 수 있습니다. 안전한 주소에서 다시 열어 주세요.'); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { transition('error', '이 브라우저는 녹음을 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari를 사용해 주세요.'); return; }
    const request = ++generation.current;
    transition('requesting', '마이크 권한을 기다리는 중 · 권한 요청 중에는 문장을 이동할 수 없습니다.');
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      // A permission dialog may resolve after unmount; release its stream instead of retaining it.
      if (!alive.current || request !== generation.current) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream.current = acquired;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported?.(type));
      const current = new MediaRecorder(acquired, mime ? { mimeType: mime } : undefined);
      recorder.current = current;
      const chunks: Blob[] = [];
      let failed = false;
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      current.onerror = () => {
        if (request !== generation.current || !alive.current) return;
        failed = true; disposeRecorder(); transition('error', '녹음 중 오류가 발생했습니다. 마이크 연결을 확인하고 다시 녹음해 주세요.');
      };
      current.onstop = () => {
        // A stale recorder must never release a newer recording's stream or timers.
        if (request !== generation.current || !alive.current || failed) return;
        clearTimers(); releaseStream();
        current.ondataavailable = current.onstop = current.onerror = null;
        recorder.current = null;
        const blob = new Blob(chunks, { type: current.mimeType || chunks[0]?.type || 'audio/webm' });
        if (!blob.size) { transition('error', '녹음된 소리가 없습니다. 다시 녹음해 주세요.'); return; }
        revoke(); url.current = URL.createObjectURL(blob);
        setState(s => ({ ...s, url: url.current }));
        transition('idle', '녹음 완료 · 내 목소리를 듣고 예문과 비교해 보세요.');
      };
      current.start();
      revoke(); setState(s => ({ ...s, url: null, seconds: 0 }));
      transition('recording', '녹음 중 · 녹음 완료를 누르면 마이크가 꺼집니다.');
      const started = Date.now();
      tick.current = setInterval(() => { if (alive.current) setState(s => ({ ...s, seconds: Math.min(60, Math.floor((Date.now() - started) / 1000)) })); }, 250);
      limit.current = setTimeout(stop, 60000);
    } catch (error) {
      if (!alive.current || request !== generation.current) return;
      disposeRecorder(); transition('error', microphoneError(error));
    }
  };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; generation.current++; disposeRecorder(); revoke(); phase.current = 'idle'; };
    // These helpers only read refs; cleanup deliberately owns the current resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { state, start, stop, clear, isBusy: () => ['requesting', 'recording', 'stopping'].includes(phase.current) };
}
