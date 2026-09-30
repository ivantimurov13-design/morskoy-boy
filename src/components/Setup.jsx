import { useState } from 'react';
import { Shuffle, RotateCw, ArrowRight, Anchor, MousePointer2 } from 'lucide-react';
import Board from './Board.jsx';
import { canPlace, cellsFor, MODES } from '../engine.js';
export default function Setup({ game, dispatch }) {
  const [selected, setSelected] = useState(null), [vertical, setVertical] = useState(false), [message, setMessage] = useState('Флот уже готов! Можешь отправляться в бой или расставить корабли по-своему.');
  const ships = game.boards[game.setupPlayer];
  const move = start => {
    if (selected === null) {
      const ship = ships.find(s => s.cells.includes(start));
      if (ship) { setSelected(ship.id); setVertical(ship.vertical); setMessage('Нажми на клетку, где будет начало корабля.'); }
      else setMessage('Сначала выбери корабль на поле или в списке справа.');
      return;
    }
    const ship = ships.find(s => s.id === selected);
    if (!canPlace(ships, cellsFor(start, ship.cells.length, vertical, game.size), game.size, selected)) { setMessage('Здесь тесно! Между кораблями нужна хотя бы одна пустая клетка, даже по диагонали.'); return; }
    dispatch({ type: 'PLACE', id: selected, start, vertical }); setSelected(null); setMessage('Отличное место! Выбери следующий корабль или начинай бой.');
  };
  return <main className="game-page"><div className="page-heading"><div><p className="section-label">{MODES[game.mode].title}</p><h1>{game.names[game.setupPlayer]}, собери флот</h1><p>Твоя маленькая эскадра готова к большому приключению.</p></div><Anchor className="heading-icon"/></div>
    <div className="setup-layout"><section className="ocean-panel"><div className="panel-heading"><h2>Твоя гавань</h2><span>{ships.length} кораблей</span></div><Board size={game.size} ships={ships} reveal onCell={move} selected={selected} label="Расстановка кораблей"/><div className="board-legend"><span><i className="legend-ship"/> Твой корабль</span><span>Корабли не касаются друг друга</span></div></section>
      <aside className="setup-tools"><h2>Готов к отплытию?</h2><p className="instruction" aria-live="polite"><MousePointer2 size={21}/>{message}</p><div className="fleet-picker" aria-label="Выбрать корабль">{ships.map((s, i) => <button key={s.id} aria-label={`Корабль ${i + 1}, палуб: ${s.cells.length}`} aria-pressed={selected === s.id} onClick={() => { setSelected(s.id); setVertical(s.vertical); setMessage('Нажми на клетку, где будет начало корабля.'); }}><img src={`${import.meta.env.BASE_URL}assets/ship.png`} alt=""/><span>{s.cells.length}</span></button>)}</div>
        <div className="setup-actions"><button className="secondary" onClick={() => { setVertical(v => !v); setMessage(selected === null ? 'Выбери корабль, затем поверни и поставь его на поле.' : 'Направление изменено. Теперь выбери начало корабля на поле.'); }}><RotateCw size={20}/>{vertical ? 'Вертикально' : 'Горизонтально'}</button><button className="secondary" onClick={() => { dispatch({ type: 'SHUFFLE' }); setSelected(null); setMessage('Новая расстановка готова. Можно в бой!'); }}><Shuffle size={20}/> Расставить случайно</button>{selected !== null && <button className="text-button" onClick={() => { setSelected(null); setMessage('Перемещение отменено. Флот готов к бою.'); }}>Отменить выбор</button>}</div>
        <button className="primary" onClick={() => dispatch({ type: 'READY' })}>Флот готов! <ArrowRight/></button><p className="small-note">{game.opponent === 'friend' ? 'После расстановки передай устройство другому капитану. Поле будет скрыто.' : 'Компьютер не видит твои корабли. Всё по-честному!'}</p>
      </aside></div>
  </main>;
}
