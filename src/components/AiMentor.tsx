import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askMentor, GEMINI_MODEL, MentorError, type MentorContext, type MentorMessage } from '../ai/gemini';

export function AiMentor({ context }: { context: MentorContext }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [pending, setPending] = useState('');
  const [status, setStatus] = useState('API 키를 입력하고 일본어 질문이나 문장을 보내 보세요.');
  const [error, setError] = useState(false);
  const request = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const generation = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const responseEnd = useRef<HTMLDivElement>(null);

  const cancelRequest = () => {
    // Invalidate first: a cancelled fetch can resolve later and must not replace newer state.
    generation.current++;
    if (request.current) { clearTimeout(request.current.timer); request.current.controller.abort(); request.current = null; }
  };
  const cancel = () => { cancelRequest(); setPending(''); setError(false); setStatus('요청을 취소했습니다. 질문을 수정하고 다시 보낼 수 있어요.'); };
  const clearConversation = () => {
    cancelRequest(); setPending(''); setMessages([]); setError(false);
    setStatus('대화를 지웠습니다. 새 질문을 보내 보세요.');
  };
  const changeKey = (value: string) => {
    cancelRequest(); setPending(''); setApiKey(value); setError(false);
    setStatus(value.trim() ? '키를 입력했습니다. 질문을 보내면 연결을 확인합니다.' : 'Gemini API 키를 먼저 입력해 주세요.');
  };
  const usePrompt = (text: string) => { setDraft(text); input.current?.focus(); };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (request.current) return;
    const prompt = draft.trim();
    if (!apiKey.trim() || !prompt) { setError(true); setStatus(!apiKey.trim() ? 'Gemini API 키를 먼저 입력해 주세요.' : '일본어 질문이나 문장을 입력해 주세요.'); return; }
    const controller = new AbortController();
    const id = ++generation.current;
    // Keep only complete successful exchanges; failed/cancelled prompts stay editable in the composer.
    const history = [...messages.slice(-20), { role: 'user' as const, text: prompt }];
    const timer = setTimeout(() => {
      if (generation.current !== id) return;
      cancelRequest(); setPending(''); setError(true); setStatus('응답 시간이 초과되었습니다. 잠시 후 다시 보내 주세요.');
    }, 60000);
    request.current = { controller, timer };
    setPending(prompt); setError(false); setStatus('멘토가 답변을 작성하고 있어요…');
    try {
      const answer = await askMentor({ apiKey, messages: history, context, signal: controller.signal });
      if (generation.current !== id) return;
      setMessages([...history, { role: 'model', text: answer }]); setDraft('');
      setStatus('답변이 도착했습니다. 이어서 질문할 수 있어요.');

    } catch (failure) {
      if (generation.current !== id) return;
      setError(true); setStatus(failure instanceof MentorError ? failure.message : '답변을 받지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (generation.current === id) {
        clearTimeout(timer); request.current = null; setPending('');
      }
    }
  };
  useEffect(() => () => { cancelRequest(); }, []);
  useEffect(() => { if (messages.length) responseEnd.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' }); }, [messages]);

  return <section className="ai-mentor" aria-labelledby="mentor-title">
    <div className="mentor-heading">
      <div><h2 id="mentor-title"><span className="step">AI MENTOR</span>AI 일본어 멘토</h2><p>내 문장을 다듬고, 궁금한 일본어를 물어보세요.</p></div>
      <span className="mentor-model">{GEMINI_MODEL}</span>
    </div>
    <div className="mentor-key-panel">
      <label htmlFor="gemini-api-key">Gemini API 키</label>
      <div className="mentor-key-row">
        <input id="gemini-api-key" type={showKey ? 'text' : 'password'} value={apiKey} onChange={event => changeKey(event.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="none" aria-describedby="mentor-key-help" placeholder="Google AI Studio에서 발급한 키 입력"/>
        <button type="button" className="secondary" aria-pressed={showKey} onClick={() => setShowKey(value => !value)}>{showKey ? '키 숨기기' : '키 보기'}</button>
        <button type="button" className="secondary" disabled={!apiKey} onClick={() => { changeKey(''); setShowKey(false); }}>키 지우기</button>
      </div>
      <p id="mentor-key-help">키는 이 페이지에서만 사용하며 새로고침하면 삭제됩니다. 질문·최근 대화·현재 예문은 Google에 직접 전송되며, 키의 요금제에 따라 비용이 발생할 수 있어요.</p>
      <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Google AI Studio에서 키 발급하기</a>
    </div>
    <div className="mentor-context"><span>현재 예문</span><p lang="ja">{context.sentence.japanese}</p></div>
    <div className="mentor-prompts" aria-label="질문 예시">
      <button className="secondary" type="button" disabled={!!pending} onClick={() => usePrompt('현재 예문의 문법과 표현을 초급자도 이해할 수 있게 설명해 주세요.')}>이 문장 설명해 줘</button>
      <button className="secondary" type="button" disabled={!!pending} onClick={() => usePrompt('현재 예문을 활용한 짧은 일본어 대화와 읽기, 한국어 뜻을 알려 주세요.')}>짧은 대화 만들어 줘</button>
      <button className="secondary" type="button" disabled={!!pending} onClick={() => usePrompt('제가 쓴 일본어 문장을 자연스럽게 고쳐 주세요.\n문장: ')}>내 문장 교정하기</button>
    </div>
    <div className="mentor-conversation" aria-label="멘토와의 대화" aria-busy={!!pending}>
      {messages.length === 0 && !pending && <p className="mentor-empty">“이 표현은 친구에게도 쓸 수 있나요?”처럼 편하게 질문해 보세요.</p>}
      {messages.map((message, index) => <article key={index} className={`mentor-message ${message.role}`}><h3>{message.role === 'user' ? '나' : '일본어 멘토'}</h3><p>{message.text}</p></article>)}
      {pending && <article className="mentor-message user"><h3>나 · 전송 중</h3><p>{pending}</p></article>}
      <div ref={responseEnd}/>
    </div>
    <form onSubmit={event => void send(event)} className="mentor-form">
      <label htmlFor="mentor-question">질문 또는 교정할 일본어 문장</label>
      <textarea ref={input} id="mentor-question" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={4} disabled={!!pending} placeholder="일본어 문장과 말하고 싶은 한국어 뜻을 함께 적어도 좋아요." aria-describedby="mentor-question-help"/>
      <div className="mentor-actions"><span id="mentor-question-help">{draft.length} / 2,000자</span><div><button type="button" className="secondary" disabled={messages.length === 0 && !pending} onClick={clearConversation}>대화 지우기</button>{pending ? <button key="cancel" type="button" className="secondary" onClick={event => { event.preventDefault(); cancel(); }}>요청 취소</button> : <button key="send" type="submit" className="primary" disabled={!apiKey.trim() || !draft.trim()}>멘토에게 보내기</button>}</div></div>
    </form>
    <p className={`status ${error ? 'error' : ''}`} role="status" aria-live="polite">{status}</p>
    <p className="mentor-note">AI 답변에는 오류가 있을 수 있어요. 녹음은 AI에 전송하지 않으며, 이 멘토는 텍스트로만 대화합니다.</p>
  </section>;
}
