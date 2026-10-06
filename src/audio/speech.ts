export type SpeechState = { phase: 'idle' | 'playing' | 'error'; message: string };
export class SpeechPlayer {
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setTimeout>;
  private utterance?: SpeechSynthesisUtterance;
  private voices: SpeechSynthesisVoice[] = [];
  private synth?: SpeechSynthesis;
  private loadVoices = () => { this.voices = this.synth?.getVoices() ?? []; };
  constructor(private update: (state: SpeechState) => void) {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    this.loadVoices();
    this.synth?.addEventListener('voiceschanged', this.loadVoices);
  }
  stop(notify = true) {
    // Invalidate callbacks before cancel(): some engines emit end/error while cancelling.
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.watchdog);
    if (this.utterance) this.utterance.onend = this.utterance.onerror = null;
    this.utterance = undefined;
    this.synth?.cancel();
    if (notify) this.update({ phase: 'idle', message: '재생 대기 중' });
  }
  play(text: string, rate: number, repeat: boolean) {
    this.stop(false);
    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      this.update({ phase: 'error', message: '이 브라우저는 문장 듣기를 지원하지 않습니다. Chrome, Edge 또는 Safari에서 다시 시도해 주세요.' });
      return;
    }
    const generation = this.generation;
    const total = repeat ? 3 : 1;
    const fail = () => {
      if (generation !== this.generation) return;
      this.stop(false);
      this.update({ phase: 'error', message: '일본어 음성을 재생하지 못했습니다. 기기의 일본어 음성 설정을 확인하고 다시 시도해 주세요.' });
    };
    const speak = (count: number) => {
      if (generation !== this.generation) return;
      this.loadVoices();
      const utterance = new SpeechSynthesisUtterance(text);
      this.utterance = utterance;
      utterance.lang = 'ja-JP';
      utterance.rate = rate;
      const voice = this.voices.find(v => /^ja(?:[-_]|$)/i.test(v.lang));
      if (voice) utterance.voice = voice;
      this.update({ phase: 'playing', message: `재생 중 · ${count} / ${total}` });
      utterance.onerror = fail;
      utterance.onend = () => {
        if (generation !== this.generation) return;
        clearTimeout(this.watchdog);
        utterance.onend = utterance.onerror = null;
        if (count < total) this.timer = setTimeout(() => speak(count + 1), 1000);
        else { this.utterance = undefined; this.update({ phase: 'idle', message: '예문 재생 완료 · 이제 따라 말해 보세요.' }); }
      };
      // Recover when a speech engine silently fails without firing an event.
      this.watchdog = setTimeout(fail, 45000);
      try { this.synth!.speak(utterance); } catch { fail(); }
    };
    speak(1);
  }
  dispose() { this.stop(false); this.synth?.removeEventListener('voiceschanged', this.loadVoices); }
}
