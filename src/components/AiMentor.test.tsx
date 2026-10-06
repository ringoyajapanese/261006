// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiMentor } from './AiMentor';
import { situations } from '../data';
import { askMentor, MentorError } from '../ai/gemini';
vi.mock('../ai/gemini', async importOriginal => ({ ...await importOriginal<typeof import('../ai/gemini')>(), askMentor: vi.fn() }));
const ask = vi.mocked(askMentor);
const context = { situation: situations[0].name, sentence: situations[0].sentences[0] };
function enter(key = 'test-only-key', question = '私は韓国から来ました。は自然ですか？') {
  fireEvent.change(screen.getByLabelText('Gemini API 키'), { target: { value: key } });
  fireEvent.change(screen.getByLabelText('질문 또는 교정할 일본어 문장'), { target: { value: question } });
}
function send() { fireEvent.click(screen.getByRole('button', { name: '멘토에게 보내기' })); }
beforeEach(() => { ask.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('AI mentor conversation and cancellation', () => {
  it('does not request anything until both key and question are supplied and the user sends', async () => {
    ask.mockResolvedValue('자연스러운 문장입니다.'); render(<AiMentor context={context}/>);
    expect(ask).not.toHaveBeenCalled(); expect((screen.getByRole('button', { name: '멘토에게 보내기' }) as HTMLButtonElement).disabled).toBe(true);
    enter(); send(); await screen.findByText('자연스러운 문장입니다.');
    expect(ask).toHaveBeenCalledOnce(); expect(ask.mock.calls[0][0].apiKey).toBe('test-only-key');
    expect((screen.getByLabelText('Gemini API 키') as HTMLInputElement).type).toBe('password');
  });
  it('keeps conversation history and uses the current sentence for follow-up requests', async () => {
    ask.mockResolvedValueOnce('첫 답변').mockResolvedValueOnce('두 번째 답변');
    const { rerender } = render(<AiMentor context={context}/>); enter(); send(); await screen.findByText('첫 답변');
    const next = { situation: situations[1].name, sentence: situations[1].sentences[0] }; rerender(<AiMentor context={next}/>);
    fireEvent.change(screen.getByLabelText('질문 또는 교정할 일본어 문장'), { target: { value: '다른 표현도 알려 주세요.' } });
    send(); await screen.findByText('두 번째 답변'); expect(ask.mock.calls[1][0].messages).toHaveLength(3); expect(ask.mock.calls[1][0].context).toEqual(next);
  });
  it('ignores an old response after cancellation and a new request', async () => {
    let resolveOld!: (value: string) => void; ask.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce('새 답변');
    render(<AiMentor context={context}/>); enter(); send();
    const signal = ask.mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole('button', { name: '요청 취소' })); expect(signal.aborted).toBe(true);
    fireEvent.change(screen.getByLabelText('질문 또는 교정할 일본어 문장'), { target: { value: '새 질문' } }); send(); await screen.findByText('새 답변');
    await act(async () => { resolveOld('오래된 답변'); }); expect(screen.queryByText('오래된 답변')).toBeNull(); expect(screen.getByText('새 답변')).toBeTruthy();
  });
  it('aborts a pending request when the key is deleted and masks the field again', async () => {
    ask.mockImplementation(() => new Promise(() => {})); render(<AiMentor context={context}/>); enter();
    fireEvent.click(screen.getByRole('button', { name: '키 보기' })); send();
    fireEvent.click(screen.getByRole('button', { name: '키 지우기' }));
    expect(ask.mock.calls[0][0].signal.aborted).toBe(true); expect((screen.getByLabelText('Gemini API 키') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Gemini API 키') as HTMLInputElement).type).toBe('password');
    expect(screen.queryByRole('button', { name: '요청 취소' })).toBeNull();
  });
  it('times out after 60 seconds and preserves the question for retry', async () => {
    vi.useFakeTimers(); ask.mockImplementation(() => new Promise(() => {})); render(<AiMentor context={context}/>); enter(); send();
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByText(/응답 시간이 초과/)).toBeTruthy(); expect(ask.mock.calls[0][0].signal.aborted).toBe(true);
    expect((screen.getByLabelText('질문 또는 교정할 일본어 문장') as HTMLTextAreaElement).value).toContain('自然');
  });
  it('allows retry after an API error without sending a failed turn as conversation history', async () => {
    ask.mockRejectedValueOnce(new MentorError('키를 확인해 주세요.')).mockResolvedValueOnce('재시도 답변');
    render(<AiMentor context={context}/>); enter(); send(); await screen.findByText('키를 확인해 주세요.');
    send(); await screen.findByText('재시도 답변'); expect(ask.mock.calls[1][0].messages).toHaveLength(1);
  });
  it('clears conversation, never uses persistent storage, and loses the key on remount', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'); ask.mockResolvedValue('<script>untrusted</script>');
    const { unmount } = render(<AiMentor context={context}/>); enter(); send(); await screen.findByText('<script>untrusted</script>');
    expect(document.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '대화 지우기' })); expect(screen.queryByText('<script>untrusted</script>')).toBeNull();
    expect(storage).not.toHaveBeenCalled(); storage.mockRestore(); unmount(); render(<AiMentor context={context}/>);
    expect((screen.getByLabelText('Gemini API 키') as HTMLInputElement).value).toBe('');
  });
  it('aborts on unmount and prevents double submission while busy', async () => {
    ask.mockImplementation(() => new Promise(() => {})); const { unmount } = render(<AiMentor context={context}/>); enter();
    const form = screen.getByLabelText('질문 또는 교정할 일본어 문장').closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form); expect(ask).toHaveBeenCalledOnce();
    const signal = ask.mock.calls[0][0].signal; unmount(); expect(signal.aborted).toBe(true);
  });
});
