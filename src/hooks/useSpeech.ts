import { useEffect, useRef, useState } from 'react';
import { SpeechPlayer, type SpeechState } from '../audio/speech';
export function useSpeech() {
  const [state, setState] = useState<SpeechState>({ phase: 'idle', message: '재생 대기 중' });
  const player = useRef<SpeechPlayer | null>(null);
  useEffect(() => { player.current = new SpeechPlayer(setState); return () => { player.current?.dispose(); player.current = null; }; }, []);
  return { state, play: (text: string, rate: number, repeat: boolean) => player.current?.play(text, rate, repeat), stop: () => player.current?.stop() };
}
