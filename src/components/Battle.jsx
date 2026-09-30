import { useState } from 'react';
import { Crosshair, Radar, Shield, Sparkles, Waves } from 'lucide-react';
import Board from './Board.jsx';
import { remaining, MODES } from '../engine.js';
export default function Battle({ game, dispatch, sound, locked = false }) {
  const [radar, setRadar] = useState(false);
  const online = game.opponent === 'online';
  const viewer = online ? game.viewer : game.opponent === 'ai' ? 0 : game.turn, enemy = 1 - viewer;
  const thinking = online ? game.turn !== viewer || locked : game.opponent === 'ai' && game.turn === 1;
  const myShots = game.shots[viewer], theirShots = game.shots[enemy];
  const enemyLeft = online ? game.left[enemy] : remaining(game.boards[enemy], myShots), ownLeft = remaining(game.boards[viewer], theirShots);
  const last = game.last;
  const hint = game.mode === 'rookie' && Object.values(myShots).includes('hit') ? 'Есть попадание! Попробуй клетку сверху, снизу, слева или справа — корабль продолжается по прямой.' : 'Нажми на клетку в море соперника. Попал — стреляй ещё раз. Мимо — ход переходит сопернику.';
  const scan = game.scans[viewer];
  return <main className="game-page battle-page"><div className="battle-top"><div><p className="section-label">{MODES[game.mode].title}</p><h1>{thinking ? online ? locked && game.turn === viewer ? 'Передаём сигнал…' : `${game.names[enemy]} выбирает цель…` : 'Капитан Бот выбирает цель…' : `${game.names[viewer]}, твой ход!`}</h1></div><div className={`turn-orb ${thinking ? 'thinking' : ''}`}><Crosshair/>{thinking ? 'Ход соперника' : 'Наведи на цель'}</div></div>
    <div className="battle-message" role="status" aria-live="polite">{last ? <><Sparkles size={22}/><span>{game.log[0]}{last.result === 'hit' || last.result === 'sunk' ? ' Ещё один выстрел!' : ''}</span></> : <><Waves/><span>Попутного ветра! Найди все корабли соперника.</span></>}</div>
    <div className="battle-bottom"><p className="battle-hint">{radar ? 'Радар включён! Выбери центр области 3 × 3. Он посчитает целые палубы, но не покажет их места.' : hint}</p>{game.mode === 'radar' && <button className={`secondary radar-button ${radar ? 'armed' : ''}`} disabled={thinking || game.charges[viewer] === 0} onClick={() => setRadar(r => !r)}><Radar/>{radar ? 'Отменить радар' : `Радар · ${game.charges[viewer]}/2`}</button>}</div>
    {scan && <p className="scan-report" role="status"><Radar size={20}/> Проверено клеток: {scan.cells.length}. Целых палуб на момент сканирования: {scan.count}. Радар не тратит ход.</p>}
    <div className="battle-boards"><section className={`ocean-panel target-panel ${radar ? 'radar-active' : ''}`}><div className="panel-heading"><h2><Crosshair size={20}/> Море соперника</h2><span>Осталось: {enemyLeft}</span></div><Board size={game.size} ships={game.boards[enemy]} shots={myShots} label="Море соперника" disabled={thinking} scan={scan} last={last?.who === viewer ? last : null} onCell={target => { if (thinking) return; if (radar) { dispatch({ type: 'SCAN', target }); setRadar(false); sound('radar'); } else dispatch({ type: 'FIRE', target }); }}/><div className="board-legend"><span><i className="legend-hit"/> Попадание</span><span><i className="legend-miss"/> Мимо</span><span><i className="legend-sunk"/> Потоплен</span></div></section>
      <section className="ocean-panel own-panel"><div className="panel-heading"><h2><Shield size={20}/> Твой флот</h2><span>На плаву: {ownLeft}</span></div><Board size={game.size} ships={game.boards[viewer]} shots={theirShots} reveal label="Твой флот" last={last?.who === enemy ? last : null}/><div className="board-legend"><span>{game.names[viewer]}</span><span>{game.moves[viewer]} выстрелов</span></div></section></div>
    <details className="battle-log"><summary>Бортовой журнал</summary><ol>{game.log.map((entry, i) => <li key={`${entry}-${i}`}>{entry}</li>)}</ol></details>
  </main>;
}
