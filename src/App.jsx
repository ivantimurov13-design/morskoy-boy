import { useEffect, useReducer, useState, useRef, useCallback } from 'react';
import { Anchor, Volume2, VolumeX, CircleHelp, Home, EyeOff, ArrowRight, Medal, Compass, Trophy, Radar } from 'lucide-react';
import { gameReducer, chooseTarget, MODES } from './engine.js';
import { read, write, loadGame } from './storage.js';
import { playSound, unlockAudio } from './audio.js';
import Menu from './components/Menu.jsx';
import Setup from './components/Setup.jsx';
import Battle from './components/Battle.jsx';
import Result from './components/Result.jsx';
import Modal from './components/Modal.jsx';
import InstallGuide from './components/InstallGuide.jsx';
import Online, { hasOnlineGame } from './components/Online.jsx';

export default function App() {
  const [game, dispatch] = useReducer(gameReducer, null, loadGame);
  const [screen, setScreen] = useState('menu'), [captain, setCaptain] = useState(() => read('sea-captain', 'Дамир')), [opponent, setOpponent] = useState('ai'), [mode, setMode] = useState('rookie');
  const [soundOn, setSoundOn] = useState(() => read('sea-sound', true)), [stats, setStats] = useState(() => read('sea-stats-v1', {}));
  const [modal, setModal] = useState(null), [connection, setConnection] = useState(null), [saveOk, setSaveOk] = useState(true);
  const lastSound = useRef(null);
  useEffect(() => { setSaveOk(write('sea-game-v1', game)); }, [game]);
  useEffect(() => { write('sea-sound', soundOn); }, [soundOn]);
  useEffect(() => { write('sea-captain', captain); }, [captain]);
  useEffect(() => { write('sea-stats-v1', stats); }, [stats]);
  useEffect(() => {
    if (screen !== 'game' || modal || game?.phase !== 'battle' || game.opponent !== 'ai' || game.turn !== 1) return;
    const timer = setTimeout(() => { const target = chooseTarget(game.shots[1], game.size, game.mode !== 'rookie'); if (target !== null) dispatch({ type: 'FIRE', target }); }, game.last?.result === 'hit' ? 1100 : 900);
    return () => clearTimeout(timer);
  }, [game, screen, modal]);
  useEffect(() => {
    if (!game?.last || screen !== 'game') return;
    const key = `${game.id}-${game.last.seq}`;
    if (lastSound.current !== key) { lastSound.current = key; playSound(game.phase === 'result' ? 'win' : game.last.result, soundOn); }
  }, [game, screen, soundOn]);
  const recordResult = useCallback(game => {
    if (game?.phase !== 'result') return;
    setStats(current => {
      if (current.completed?.includes(game.id)) return current;
      const next = { ...current, completed: [...(current.completed || []), game.id].slice(-100) };
      game.names.forEach((name, i) => {
        if (name === 'Капитан Бот') return;
        const old = current[name] || { played: 0, wins: 0, modes: [] };
        next[name] = { played: old.played + 1, wins: old.wins + Number(game.winner === i), modes: [...new Set([...old.modes, game.mode])] };
      }); return next;
    });
  }, []);
  useEffect(() => { recordResult(game); }, [game, recordResult]);
  useEffect(() => { if (modal === 'install' && import.meta.env.VITE_HOSTED !== 'true') fetch(`${import.meta.env.BASE_URL}connection.json`).then(r => r.ok ? r.json() : null).then(setConnection).catch(() => setConnection(null)); }, [modal]);
  const start = () => { unlockAudio(); dispatch({ type: 'NEW', mode, captain, opponent }); setScreen('game'); setModal(null); };
  const resume = () => {
    unlockAudio();
    if (game?.opponent === 'friend' && ['setup', 'battle'].includes(game.phase)) {
      // The reducer-independent privacy curtain hides a resumed shared-device game.
      setModal('resume-private');
    } else setScreen('game');
  };
  const home = () => { setScreen('menu'); setModal(null); };
  const page = screen === 'menu' ? 'menu' : screen === 'online' ? 'online' : game?.phase;
  const pStats = stats[captain] || { played: 0, wins: 0, modes: [] };
  return <div className={`app app-${page}`} onPointerDown={unlockAudio}>
    <header className="header"><button className="brand" onClick={home} aria-label="Морской бой — в гавань"><Anchor/><span><strong>МОРСКОЙ БОЙ</strong><small>Дамир и Даня · навстречу приключениям</small></span></button><nav aria-label="Управление игрой">{screen !== 'menu' && <button className="icon-button" onClick={home} aria-label="В гавань — сохранить игру"><Home/></button>}<button className="icon-button" aria-label={soundOn ? 'Выключить звук' : 'Включить звук'} aria-pressed={soundOn} onClick={() => { unlockAudio(); setSoundOn(s => !s); }} >{soundOn ? <Volume2/> : <VolumeX/>}</button><button className="icon-button" aria-label="Как играть" onClick={() => setModal('help')}><CircleHelp/></button></nav></header>
    {!saveOk && <div className="save-warning" role="status">Браузер не разрешает сохранение. Эта партия сохранится только пока открыта страница.</div>}
    {screen === 'menu' && <Menu captain={captain} setCaptain={setCaptain} opponent={opponent} setOpponent={setOpponent} mode={mode} setMode={setMode} onStart={() => opponent === 'online' ? setScreen('online') : game && game.phase !== 'result' ? setModal('replace') : start()} onlineResume={hasOnlineGame()} onOnlineResume={() => setScreen('online')} resume={game && game.phase !== 'result'} onResume={resume} stats={stats} onInstall={() => setModal('install')} onMedals={() => setModal('medals')}/>}
    {screen === 'online' && <Online captain={captain} mode={mode} soundOn={soundOn} onHome={home} onComplete={recordResult}/>}
    {screen === 'game' && game?.phase === 'setup' && <Setup key={`${game.id}-${game.setupPlayer}`} game={game} dispatch={dispatch}/>}
    {screen === 'game' && game?.phase === 'battle' && <Battle key={`${game.id}-${game.opponent === 'friend' ? game.turn : 0}`} game={game} dispatch={dispatch} sound={kind => playSound(kind, soundOn)}/>}
    {screen === 'game' && game?.phase === 'handoff' && <main className="handoff"><div className="privacy-symbol"><EyeOff/></div><p className="section-label">Секреты флота под защитой</p><h1>Передай устройство<br/>{game.names[game.nextPhase === 'setup' ? game.setupPlayer : game.turn] === 'Дамир' ? 'Дамиру' : 'Дане'}</h1><p>{game.last && game.nextPhase === 'battle' ? 'Мимо! Теперь ход другого капитана.' : 'Другой капитан отворачивается. Никто не подглядывает!'}</p><button className="primary" onClick={() => dispatch({ type: 'REVEAL' })}>Я {game.names[game.nextPhase === 'setup' ? game.setupPlayer : game.turn]}, готов! <ArrowRight/></button></main>}
    {screen === 'game' && game?.phase === 'result' && <Result game={game} onHome={home} onReplay={() => { dispatch({ type: 'NEW', mode: game.mode, captain: game.names[0], opponent: game.opponent }); }}/>} 
    {modal === 'help' && <Modal title="Как стать капитаном" onClose={() => setModal(null)}><ol className="help-steps"><li><strong>Расставь корабли.</strong> Случайная расстановка уже готова. Чтобы изменить её, выбери корабль, направление и начальную клетку.</li><li><strong>Ищи флот соперника.</strong> Нажимай на клетки в его море. Оранжевый крестик — попадание, точка — вода.</li><li><strong>Попал? Стреляй ещё!</strong> После промаха ход переходит сопернику. Побеждает тот, кто потопит весь чужой флот.</li><li><strong>Береги секреты.</strong> В режиме «Друг» передавайте одно устройство. В режиме «По сети» играйте каждый на своём: создай комнату и сообщи другу код. Никому больше не показывай код.</li></ol><div className="help-mode"><Compass/><p><strong>Первая экспедиция</strong> — небольшое поле, 5 кораблей и подсказки. Бот выбирает цели случайно.</p></div><div className="help-mode"><Anchor/><p><strong>Классический бой</strong> — поле 10 × 10 и 10 кораблей. Бот добивает найденные корабли.</p></div><div className="help-mode"><Radar/><p><strong>Секретный радар</strong> — два сканирования области 3 × 3 за бой. Показывает число ещё не подбитых палуб, не тратит ход. Бот играет без радара.</p></div><p className="small-note">Пустые клетки вокруг потопленного корабля отмечаются сами. Корабли не соприкасаются даже углами. На каждом устройстве — своя партия и свои награды.</p><button className="primary" onClick={() => setModal(null)}>Всё понятно!</button></Modal>}
    {modal === 'replace' && <Modal title="Начать новое приключение?" onClose={() => setModal(null)}><p>Сохранённая партия будет заменена. Награды капитанов останутся.</p><div className="modal-actions"><button className="primary" onClick={start}>Начать новый бой</button><button className="secondary" onClick={() => { setModal(null); resume(); }}>Продолжить прошлый</button></div></Modal>}
    {modal === 'resume-private' && <Modal title="Передай устройство капитану" onClose={() => setModal(null)}><p>Пусть устройство возьмёт {game.names[game.phase === 'setup' ? game.setupPlayer : game.turn]}. Второй капитан отворачивается.</p><button className="primary" onClick={() => { setModal(null); setScreen('game'); }}>Устройство у меня — открыть поле</button></Modal>}
    {modal === 'medals' && <Modal title={`${captain} · каюта капитана`} onClose={() => setModal(null)}><div className="captain-summary"><Medal/><p><strong>Победы: {pStats.wins}</strong><span>Завершено приключений: {pStats.played}</span></p></div><div className="medals">{[[pStats.played >= 1, Compass, 'Первое плавание', 'Заверши любой бой'], [pStats.wins >= 1, Trophy, 'Морская победа', 'Победи в первом бою'], [pStats.wins >= 5, Anchor, 'Адмирал', 'Одержи 5 побед'], [pStats.modes.length === 3, Radar, 'Исследователь', 'Сыграй во всех трёх режимах']].map(([earned, Icon, title, text]) => <div className={earned ? 'earned' : ''} key={title}><Icon/><span><strong>{title}</strong><small>{earned ? 'Награда получена!' : text}</small></span></div>)}</div><p className="small-note">Награды хранятся в этом браузере на этом устройстве.</p><button className="text-button" onClick={() => setModal('reset-medals')}>Сбросить награды капитана</button></Modal>}
    {modal === 'reset-medals' && <Modal title={`Сбросить награды: ${captain}?`} onClose={() => setModal('medals')}><p>Победы и награды этого капитана будут удалены только на этом устройстве. Вернуть их не получится.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal('medals')}>Оставить награды</button><button className="primary" onClick={() => { setStats(s => ({ ...s, [captain]: { played: 0, wins: 0, modes: [] } })); setModal('medals'); }}>Да, сбросить награды</button></div></Modal>}
    {modal === 'install' && <Modal title="Морской бой на iPad" onClose={() => setModal(null)}><InstallGuide connection={connection}/></Modal>}
  </div>;
}
