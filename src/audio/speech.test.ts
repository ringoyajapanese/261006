import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechPlayer } from './speech';
class Utterance {
  lang = ''; rate = 1; voice: unknown; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
describe('SpeechPlayer cancellation and repeat', () => {
  let player: SpeechPlayer;
  let spoken: Utterance[];
  let synth: { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; getVoices: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
  const update = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers(); spoken = []; update.mockClear();
    synth = { speak: vi.fn((u: Utterance) => spoken.push(u)), cancel: vi.fn(), getVoices: vi.fn(() => [{ lang: 'ja-JP' }]), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('window', { speechSynthesis: synth }); vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    player = new SpeechPlayer(update);
  });
  afterEach(() => { player.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('uses Japanese voice and speed, repeats exactly three times at one second intervals', () => {
    player.play('こんにちは', .85, true);
    expect(spoken[0].lang).toBe('ja-JP'); expect(spoken[0].rate).toBe(.85); expect(spoken[0].voice).toEqual({ lang: 'ja-JP' });
    for (let i = 0; i < 2; i++) {
      spoken[i].onend?.(); vi.advanceTimersByTime(999); expect(spoken).toHaveLength(i + 1);
      vi.advanceTimersByTime(1); expect(spoken).toHaveLength(i + 2);
    }
    spoken[2].onend?.(); vi.advanceTimersByTime(60000);
    expect(spoken).toHaveLength(3); expect(update.mock.lastCall?.[0].phase).toBe('idle');
  });
  it('cancels a scheduled repeat', () => {
    player.play('a', 1, true); spoken[0].onend?.(); player.stop(); vi.advanceTimersByTime(60000);
    expect(spoken).toHaveLength(1); expect(update.mock.lastCall?.[0].phase).toBe('idle');
  });
  it('ignores stale end and error callbacks after rapid play clicks', () => {
    player.play('old', 1, true); const end = spoken[0].onend; const error = spoken[0].onerror;
    player.play('new', 1.2, false); end?.(); error?.();
    vi.advanceTimersByTime(1000); expect(spoken).toHaveLength(2);
    expect(update.mock.lastCall?.[0].message).toBe('재생 중 · 1 / 1');
    spoken[1].onend?.(); vi.advanceTimersByTime(60000); expect(spoken).toHaveLength(2);
  });
  it('refreshes late-loading voices and removes listener on disposal', () => {
    synth.getVoices.mockReturnValue([]); player.play('a', 1, false); expect(spoken[0].voice).toBeUndefined();
    synth.getVoices.mockReturnValue([{ lang: 'ja-JP' }]); synth.addEventListener.mock.calls[0][1]();
    player.play('b', 1, false); expect(spoken[1].voice).toEqual({ lang: 'ja-JP' });
    player.dispose(); expect(synth.removeEventListener).toHaveBeenCalledWith('voiceschanged', synth.addEventListener.mock.calls[0][1]);
  });
  it('recovers from failures and missing APIs', () => {
    player.play('a', 1, true); spoken[0].onerror?.(); vi.advanceTimersByTime(60000);
    expect(spoken).toHaveLength(1); expect(update.mock.lastCall?.[0].phase).toBe('error');
    player.dispose(); vi.stubGlobal('window', {}); player = new SpeechPlayer(update); player.play('a', 1, false);
    expect(update.mock.lastCall?.[0].phase).toBe('error');
  });
});
