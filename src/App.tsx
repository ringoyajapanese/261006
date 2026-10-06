import { useRef, useState } from 'react';
import { situations } from './data';
import { useSpeech } from './hooks/useSpeech';
import { useRecorder } from './hooks/useRecorder';
import './styles.css';
import { AiMentor } from './components/AiMentor';
function Icon({ kind }: { kind: 'play' | 'stop' | 'mic' }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{kind === 'play' ? <path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/> : kind === 'stop' ? <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/> : <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></>}</svg>;
}
export default function App() {
  const [situationIndex, setSituationIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const audio = useRef<HTMLAudioElement>(null);
  const speech = useSpeech();
  const recording = useRecorder();
  const situation = situations[situationIndex];
  const sentence = situation.sentences[sentenceIndex];
  const busy = ['requesting', 'recording', 'stopping'].includes(recording.state.phase);
  const pauseAudio = () => { if (audio.current) { audio.current.pause(); audio.current.currentTime = 0; } setAudioMessage(''); };
  const change = (category: number, index: number) => {
    if (recording.isBusy()) return;
    speech.stop(); pauseAudio(); recording.clear();
    setSituationIndex(category); setSentenceIndex(index);
  };
  const listen = () => {
    if (recording.isBusy()) return;
    pauseAudio(); speech.play(sentence.japanese, rate, repeat);
  };
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="./" aria-label="KOTOBA 홈"><span className="brand-mark" aria-hidden="true">K</span>KOTOBA</a><span className="header-caption">일본어 쉐도잉</span><span className="level">N5–N4</span></header>
    <div className="workspace">
      <aside className="situations" aria-labelledby="situations-title"><div className="section-heading"><h2 id="situations-title">연습 상황</h2><span>4가지 상황</span></div><nav aria-label="상황 선택"><div className="situation-list">{situations.map((item, index) => <button key={item.id} className={`situation-button ${index === situationIndex ? 'selected' : ''}`} aria-current={index === situationIndex ? 'true' : undefined} disabled={busy} onClick={() => change(index, 0)}><span className="situation-number">0{index + 1}</span><span><strong>{item.name}</strong><small>3개 문장</small></span></button>)}</div></nav><p className="sidebar-note">듣고, 따라 말하고,<br/>내 목소리와 비교해 보세요.</p></aside>
      <main>
        <div className="practice-heading"><div><p className="eyebrow">오늘의 쉐도잉</p><h1>{situation.name}</h1></div><span className="sentence-count" aria-label={`현재 문장 ${sentenceIndex + 1}, 전체 ${situation.sentences.length}`}>{sentenceIndex + 1}<span> / {situation.sentences.length}</span></span></div>
        <section className="sentence-card" aria-label="연습 문장"><div className="card-label"><span>일본어 문장</span><span>따라 말해 보세요</span></div><p className="japanese" lang="ja">{sentence.japanese}</p><p className="reading" lang="ja">{sentence.reading}</p><div className="translation"><span>뜻</span><p>{sentence.meaning}</p></div></section>
        <div className="exercise-grid">
          <section className="control-card" aria-labelledby="listen-title"><h2 id="listen-title"><span className="step">STEP 1</span> 예문 듣기</h2><div className="playback-settings"><label htmlFor="speed">재생 속도<select id="speed" value={rate} disabled={busy} onChange={e => setRate(Number(e.target.value))}>{[0.7, 0.85, 1, 1.2].map(value => <option key={value} value={value}>{value === 1 ? '1.0' : value}×</option>)}</select></label><label className="repeat-label"><input type="checkbox" checked={repeat} disabled={busy} onChange={e => setRepeat(e.target.checked)}/><span>3회 반복</span></label></div><div className="button-row"><button className="primary" onClick={listen} disabled={busy}><Icon kind="play"/>문장 듣기</button><button className="secondary" onClick={speech.stop} disabled={speech.state.phase !== 'playing'}><Icon kind="stop"/>정지</button></div><p className={`status ${speech.state.phase === 'error' ? 'error' : ''}`} role="status" aria-live="polite">{speech.state.message}</p><p className="hint">음성은 기기마다 다를 수 있어요. 반복 사이에는 1초 동안 쉽니다.</p></section>
          <section className={`control-card ${recording.state.phase === 'recording' ? 'recording' : ''}`} aria-labelledby="record-title"><div className="record-heading"><h2 id="record-title"><span className="step">STEP 2</span> 따라 말하기</h2><span className="timer" aria-label={`녹음 ${recording.state.seconds}초, 최대 60초`}>{String(recording.state.seconds).padStart(2, '0')} / 60초</span></div><p className="record-instruction">예문의 발음과 리듬을 따라 녹음해 보세요.</p><button className={`record-button ${recording.state.phase === 'recording' ? 'active' : ''}`} disabled={recording.state.phase === 'requesting' || recording.state.phase === 'stopping'} onClick={() => recording.state.phase === 'recording' ? recording.stop() : void recording.start(() => { speech.stop(); pauseAudio(); })}><Icon kind={recording.state.phase === 'recording' ? 'stop' : 'mic'}/>{recording.state.phase === 'recording' ? '녹음 완료' : recording.state.phase === 'requesting' ? '마이크 권한 요청 중…' : recording.state.phase === 'stopping' ? '녹음 마무리 중…' : '녹음 시작'}</button><p className={`status ${recording.state.phase === 'error' ? 'error' : ''}`} role="status" aria-live="polite">{recording.state.message}</p><p className="hint">최대 60초 · 녹음은 이 페이지에서만 임시로 보관됩니다.</p></section>
        </div>
        <section className="recording-playback" aria-labelledby="compare-title"><div><h2 id="compare-title"><span className="step">STEP 3</span>내 녹음 듣기</h2><p>직접 듣고 예문의 발음과 리듬을 비교해 보세요.</p></div>{recording.state.url && !busy ? <audio key={recording.state.url} ref={audio} src={recording.state.url} controls aria-label="내 녹음 재생" onPlay={() => { if (recording.isBusy()) { pauseAudio(); return; } speech.stop(); setAudioMessage('내 녹음 재생 중'); }} onPause={() => setAudioMessage('내 녹음 일시 정지')} onEnded={() => setAudioMessage('내 녹음 재생 완료')} onError={() => setAudioMessage('녹음을 재생하지 못했습니다. 다시 녹음해 주세요.')}/> : <span className="empty-recording">{busy ? '녹음을 마치면 여기서 들을 수 있어요.' : '아직 녹음된 목소리가 없어요.'}</span>}<span className="audio-status" role="status" aria-live="polite">{audioMessage}</span></section>
        {busy && <p className="navigation-notice" role="status">{recording.state.phase === 'requesting' ? '마이크 권한 요청이 끝난 후' : '녹음을 마친 후'} 상황과 문장을 이동할 수 있습니다.</p>}
        <div className="sentence-navigation"><button className="secondary" disabled={busy || sentenceIndex === 0} onClick={() => change(situationIndex, sentenceIndex - 1)}>이전 문장</button><div className="position-indicators" aria-hidden="true">{situation.sentences.map((s, index) => <span key={s.id} className={index === sentenceIndex ? 'current' : ''}/>)}</div><button className="secondary" disabled={busy || sentenceIndex === situation.sentences.length - 1} onClick={() => change(situationIndex, sentenceIndex + 1)}>다음 문장</button></div>
        <AiMentor context={{ situation: situation.name, sentence }}/>
        <footer>녹음은 전송·저장되지 않으며, 문장 이동이나 새로고침 시 삭제됩니다.</footer>
      </main>
    </div>
  </div>;
}
