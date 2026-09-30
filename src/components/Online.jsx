import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Copy, Globe, Home, Radio, RefreshCw } from 'lucide-react';
import { MODES } from '../engine.js';
import { read, write } from '../storage.js';
import { playSound } from '../audio.js';
import Setup from './Setup.jsx';
import Battle from './Battle.jsx';
import Result from './Result.jsx';

const API = import.meta.env.VITE_MULTIPLAYER_URL || 'https://mpxlab.ru/sea-battle-api';
const KEY = `sea-online-v1:${API}`;
const validSession = s => s && /^[A-Z2-9]{6}$/.test(s.code) && /^[a-f0-9]{64}$/.test(s.token);
export const hasOnlineGame = () => validSession(read(KEY, null));
async function request(path, { token, body } = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
  } catch { throw new Error('Нет связи с морем. Проверь интернет — партия сохранена, подключение восстановится автоматически.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('Сервис временно недоступен. Подключаемся снова…'); }
  if (!response.ok) throw Object.assign(new Error(result.error || 'Не удалось выполнить действие.'), { status: response.status });
  return result;
}

export default function Online({ captain, mode, soundOn, onHome, onComplete }) {
  const [session, setSession] = useState(() => { const s = read(KEY, null); return validSession(s) ? s : null; });
  const [state, setState] = useState(null), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [connected, setConnected] = useState(false), [error, setError] = useState('');
  const [fatal, setFatal] = useState(false), [copied, setCopied] = useState(false), [changing, setChanging] = useState(false), [saved, setSaved] = useState(true);
  const currentSession = useRef(session), lastSound = useRef(null), mounted = useRef(true), inFlight = useRef(false), networkError = useRef(false);
  currentSession.current = session;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const apply = (result, expected) => {
    if (!mounted.current || currentSession.current?.token !== expected.token) return;
    setState(old => !old || old.revision <= result.revision ? result : old);
    setConnected(true); setFatal(false);
    if (networkError.current) { networkError.current = false; setError(''); }
  };
  useEffect(() => {
    if (!session) return;
    let active = true, timer, polling = false;
    const poll = async () => {
      if (polling || !active) return;
      polling = true; clearTimeout(timer);
      try { const result = await request(`/rooms/${session.code}`, session); if (active) apply(result, session); }
      catch (e) { if (active) { networkError.current = true; setConnected(false); setError(e.message); setFatal([401, 404].includes(e.status)); } }
      finally { polling = false; if (active) timer = setTimeout(poll, document.hidden ? 7000 : 2000); }
    };
    const wake = () => { if (!document.hidden) poll(); };
    poll(); window.addEventListener('online', poll); document.addEventListener('visibilitychange', wake);
    return () => { active = false; clearTimeout(timer); window.removeEventListener('online', poll); document.removeEventListener('visibilitychange', wake); };
  }, [session]);
  useEffect(() => {
    const g = state?.game;
    if (g) {
      const key = `${g.id}-${g.last?.seq || 0}`;
      if (g.last && lastSound.current && lastSound.current !== key) playSound(g.phase === 'result' ? 'win' : g.last.result, soundOn);
      lastSound.current = key;
    }
    if (g?.phase === 'result') onComplete(g);
  }, [state?.game.id, state?.game.last?.seq, state?.game.phase, soundOn, onComplete]);
  const enter = async joining => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await request(joining ? `/rooms/${code}/join` : '/rooms', { body: joining ? {} : { captain, mode } });
      if (!mounted.current) return;
      const s = { code: result.code, token: result.token };
      setSaved(write(KEY, s)); currentSession.current = s; setSession(s); setState(result); setConnected(true); setFatal(false);
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const dispatch = async action => {
    if (inFlight.current || !connected || !session || !state) return;
    inFlight.current = true; setBusy(true); setError('');
    const expected = session;
    try {
      const result = await request(`/rooms/${session.code}/actions`, { token: session.token, body: {
        revision: state.revision, requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, action,
      } });
      apply(result, expected);
    } catch (e) {
      if (mounted.current) { setError(e.message); if (!e.status) { networkError.current = true; setConnected(false); } }
      try { apply(await request(`/rooms/${expected.code}`, expected), expected); } catch { /* polling will reconnect */ }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const forget = () => { write(KEY, null); currentSession.current = null; setSession(null); setState(null); setChanging(false); setError(''); setFatal(false); setConnected(false); };
  const g = state?.game;
  return <>
    <div className="online-bar">
      <span><Globe size={19}/>{session ? <>Комната <strong className="room-code-small">{session.code}</strong>{state && ` · Ты ${g.names[state.player]}`}</> : 'Капитаны на разных устройствах'}</span>
      {session && <span className={connected ? 'online-status' : 'offline-status'} role="status">{connected ? state?.joined ? state.opponentOnline ? 'Друг на связи' : 'Ждём возвращения друга' : 'Ждём друга' : 'Восстанавливаем связь…'}</span>}
      {session && <button className="text-button" onClick={() => setChanging(true)}>Другая комната</button>}
    </div>
    {!saved && <p className="save-warning">Браузер не разрешает сохранение. Не закрывай страницу до конца боя.</p>}
    {error && (!connected || busy || !session || fatal) && <div className="online-error" role="alert">{error}</div>}
    {error && connected && !busy && session && !fatal && <div className="online-error" role="status">{error}<button className="text-button" onClick={() => setError('')}>Понятно</button></div>}
    {changing && <section className="online-card online-confirm"><h2>Покинуть эту комнату?</h2><p>Вернуться после этого не получится. Чтобы сыграть вместе снова, понадобится новый код.</p><div className="modal-actions"><button className="secondary" onClick={() => setChanging(false)}>Остаться</button><button className="secondary" onClick={forget}>Выйти из комнаты</button></div></section>}
    {!session ? <main className="online-lobby game-page"><div className="page-heading"><div><p className="section-label">Два капитана · два устройства</p><h1>Встречаемся в море!</h1><p>Один создаёт комнату, другой вводит её код. Можно играть с Mac или iPad.</p></div><Globe className="heading-icon"/></div>
      <div className="online-options"><section className="online-card"><Radio className="online-icon"/><h2>Пригласи друга</h2><p>Ты — {captain}.<br/>{MODES[mode].title} · поле {MODES[mode].size} × {MODES[mode].size}</p><button className="primary" disabled={busy} onClick={() => enter(false)}>Создать комнату <ArrowRight/></button></section>
      <form className="online-card" onSubmit={e => { e.preventDefault(); if (code.length === 6) enter(true); }}><Globe className="online-icon"/><h2>У меня есть код</h2><label htmlFor="room-code">Введи 6 символов от друга</label><input id="room-code" aria-label="Код комнаты" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))} placeholder="ABC234"/><button className="primary" disabled={busy || code.length !== 6}>Присоединиться <ArrowRight/></button><p className="small-note">Капитан и режим определятся по комнате.</p></form></div><p className="small-note">Нужен интернет на обоих устройствах. Комната хранится 24 часа после последнего игрового действия. Код сообщай только тому, с кем хочешь играть.</p><button className="text-button" onClick={onHome}><Home size={18}/> Выбрать капитана или режим</button></main> : !state || fatal ? <main className="handoff"><Radio className="heading-icon"/><h1>{fatal ? 'Эта гавань закрыта' : 'Ищем твою комнату…'}</h1><p>{fatal ? 'Можно создать новую комнату или присоединиться к другу.' : 'Подключаемся к сохранённой партии.'}</p>{fatal && <button className="primary" onClick={forget}>К новым приключениям <ArrowRight/></button>}</main> : <>
      {!state.joined && <section className="room-invite online-card"><div><p className="section-label">Сообщи другу этот код</p><strong className="room-code">{session.code}</strong><p>Друг открывает игру → «По сети» → вводит код.<br/>А ты пока расставляй корабли.</p></div><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(session.code); setCopied(true); } catch { setCopied(false); } }}><Copy size={19}/>{copied ? 'Код скопирован' : 'Скопировать код'}</button></section>}
      <fieldset className="online-stage" disabled={busy || !connected || changing}>
        {g.phase === 'setup' && !state.ready[state.player] && <Setup key={g.id} game={g} dispatch={dispatch}/>}
        {g.phase === 'setup' && state.ready[state.player] && <main className="handoff"><div className="privacy-symbol"><Radio/></div><p className="section-label">Твой флот под защитой</p><h1>Ты готов к бою!</h1><p>{state.joined ? `${g.names[1 - state.player]} расставляет корабли. Бой начнётся, когда оба капитана будут готовы.` : 'Ждём, когда друг введёт код комнаты и подготовит свой флот.'}</p></main>}
        {g.phase === 'battle' && <Battle key={g.id} game={g} dispatch={dispatch} sound={kind => playSound(kind, soundOn)} locked={!connected || busy}/>}
        {g.phase === 'result' && <><Result game={g} onHome={onHome} onReplay={() => dispatch({ type: 'REMATCH' })}/>{state.rematch.some(Boolean) && <p className="rematch-note" role="status">{state.rematch[state.player] ? 'Ты готов к реваншу! Ждём второго капитана.' : 'Друг зовёт на реванш! Нажми «Ещё один бой».'}</p>}</>}
      </fieldset>
      {!connected && !fatal && <p className="reconnect-note"><RefreshCw size={16}/> Игра приостановлена на этом устройстве. Ходы появятся после восстановления связи.</p>}
    </>}
  </>;
}
