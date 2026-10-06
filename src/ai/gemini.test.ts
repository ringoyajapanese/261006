import { afterEach, describe, expect, it, vi } from 'vitest';
import { askMentor, GEMINI_MODEL, GEMINI_ENDPOINT } from './gemini';
import { situations } from '../data';
const context = { situation: situations[0].name, sentence: situations[0].sentences[0] };
const args = () => ({ apiKey: '  test-only-key  ', messages: [{ role: 'user' as const, text: '문법을 설명해 주세요.' }], context, signal: new AbortController().signal });
afterEach(() => vi.unstubAllGlobals());
describe('Gemini mentor API', () => {
  it('uses the exact model, header authentication and current sentence context without exposing the key in URL/body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'internal', thought: true }, { text: '일본어 설명' }, { text: '예문' }] } }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await askMentor(args())).toBe('일본어 설명\n예문');
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe(GEMINI_ENDPOINT); expect(endpoint).toContain(GEMINI_MODEL); expect(endpoint).not.toContain('test-only-key');
    expect(init.headers['x-goog-api-key']).toBe('test-only-key'); expect(init.credentials).toBe('omit'); expect(init.redirect).toBe('error');
    const body = JSON.parse(init.body); expect(init.body).not.toContain('test-only-key');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: '문법을 설명해 주세요.' }] }]);
    expect(body.systemInstruction.parts[0].text).toContain(context.sentence.japanese);
  });
  it.each([[400, '요청이 거절'], [401, 'API 키'], [403, '접근 권한'], [404, GEMINI_MODEL], [429, '요청 한도'], [503, '서비스가 응답하지']])('explains HTTP %s without reflecting provider error content', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('provider error containing test-only-key', { status })));
    await expect(askMentor(args())).rejects.toThrow(message);
    await expect(askMentor(args())).rejects.not.toThrow('test-only-key');
  });
  it('does not call the API without a key', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(askMentor({ ...args(), apiKey: ' ' })).rejects.toThrow('먼저 입력'); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([{ promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'SAFETY' }] }])('handles blocked responses', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    await expect(askMentor(args())).rejects.toThrow('답변을 제공하지');
  });
  it.each([{}, { candidates: [{ content: { parts: [{ text: 'internal', thought: true }] } }] }])('handles empty or thought-only responses', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    await expect(askMentor(args())).rejects.toThrow('빈 응답');
  });
  it('handles truncated and malformed responses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }] }))).mockResolvedValueOnce(new Response('not JSON'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(askMentor(args())).rejects.toThrow('길어 중단'); await expect(askMentor(args())).rejects.toThrow('응답을 읽지');
  });
  it('reports network failures without leaking thrown error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('test-only-key')));
    await expect(askMentor(args())).rejects.toThrow('연결하지 못'); await expect(askMentor(args())).rejects.not.toThrow('test-only-key');
  });
});
