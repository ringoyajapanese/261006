// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecorder } from './useRecorder';
class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = () => true;
  state = 'inactive'; mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { FakeRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) }); this.onstop?.(); }
}
describe('recording lifecycle', () => {
  let trackStop: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let stream: { getTracks: () => { stop: ReturnType<typeof vi.fn> }[] };
  beforeEach(() => {
    vi.useFakeTimers(); FakeRecorder.instances = [];
    trackStop = vi.fn(); stream = { getTracks: () => [{ stop: trackStop }] };
    getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MediaRecorder', FakeRecorder);
    URL.createObjectURL = vi.fn(() => 'blob:recording'); URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('requests only on click, locks immediately, stops at 60 seconds and releases the mic', async () => {
    const { result } = renderHook(useRecorder); expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => { const first = result.current.start(vi.fn()); const second = result.current.start(vi.fn()); await Promise.all([first, second]); });
    expect(getUserMedia).toHaveBeenCalledTimes(1); expect(result.current.isBusy()).toBe(true);
    act(() => vi.advanceTimersByTime(59999)); expect(result.current.state.phase).toBe('recording');
    act(() => vi.advanceTimersByTime(1)); expect(result.current.state.phase).toBe('idle'); expect(result.current.state.seconds).toBe(60);
    expect(trackStop).toHaveBeenCalled(); expect(result.current.state.url).toBe('blob:recording');
    act(() => result.current.clear()); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording'); expect(result.current.state.url).toBeNull();
  });
  it('releases a stream granted after the component unmounts', async () => {
    let resolve!: (value: unknown) => void; getUserMedia.mockImplementation(() => new Promise(r => { resolve = r; }));
    const { result, unmount } = renderHook(useRecorder); let pending!: Promise<void>;
    act(() => { pending = result.current.start(vi.fn()); }); expect(result.current.state.phase).toBe('requesting');
    unmount(); await act(async () => { resolve(stream); await pending; });
    expect(trackStop).toHaveBeenCalledOnce(); expect(FakeRecorder.instances).toHaveLength(0);
  });
  it('blocks clearing while recording and frees the old URL on replacement and unmount', async () => {
    const { result, unmount } = renderHook(useRecorder);
    await act(async () => { await result.current.start(vi.fn()); });
    act(() => { expect(result.current.clear()).toBe(false); result.current.stop(); });
    await act(async () => { await result.current.start(vi.fn()); }); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording');
    act(() => result.current.stop()); unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans tracks and timers on recording error and allows retry', async () => {
    const { result } = renderHook(useRecorder); await act(async () => { await result.current.start(vi.fn()); });
    act(() => FakeRecorder.instances[0].onerror?.()); expect(result.current.state.phase).toBe('error');
    expect(trackStop).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0); expect(result.current.isBusy()).toBe(false);
    await act(async () => { await result.current.start(vi.fn()); }); expect(result.current.state.phase).toBe('recording');
  });
  it('ignores old recorder callbacks after an error and retry', async () => {
    const { result } = renderHook(useRecorder); await act(async () => { await result.current.start(vi.fn()); });
    const oldStop = FakeRecorder.instances[0].onstop; const oldError = FakeRecorder.instances[0].onerror;
    act(() => oldError?.()); await act(async () => { await result.current.start(vi.fn()); });
    trackStop.mockClear();
    act(() => { oldStop?.(); oldError?.(); });
    expect(result.current.state.phase).toBe('recording'); expect(trackStop).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(2);
  });
  it.each([['NotAllowedError', '권한이 거절'], ['NotFoundError', '찾을 수 없습니다'], ['NotReadableError', '접근하지 못']])('explains %s', async (name: string, message: string) => {
    getUserMedia.mockRejectedValue(new DOMException('denied', name)); const { result } = renderHook(useRecorder);
    await act(async () => { await result.current.start(vi.fn()); }); expect(result.current.state.message).toContain(message); expect(result.current.isBusy()).toBe(false);
  });
  it('explains insecure context and unsupported APIs without requesting a microphone', async () => {
    const { result } = renderHook(useRecorder); vi.stubGlobal('isSecureContext', false);
    await act(async () => { await result.current.start(vi.fn()); }); expect(result.current.state.message).toContain('HTTPS');
    vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MediaRecorder', undefined);
    await act(async () => { await result.current.start(vi.fn()); }); expect(result.current.state.message).toContain('지원하지'); expect(getUserMedia).not.toHaveBeenCalled();
  });
});
