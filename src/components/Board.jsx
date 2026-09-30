import { LETTERS, coord, sunk } from '../engine.js';
export default function Board({ size, ships = [], shots = {}, reveal = false, onCell, label, scan, selected = -1, preview = [], invalid = false, last, disabled = false }) {
  const visibleShips = ships.filter(s => reveal || sunk(s, shots));
  return <div className="board-shell" aria-label={label}>
    <div className="letters" style={{ gridTemplateColumns: `repeat(${size},1fr)` }}>{Array.from({ length: size }, (_, i) => <span key={i}>{LETTERS[i]}</span>)}</div>
    <div className="board-row"><div className="numbers">{Array.from({ length: size }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
      <div className="sea-grid" style={{ '--size': size }}>
        {Array.from({ length: size * size }, (_, i) => {
          const status = shots[i], ownShip = reveal && ships.find(s => s.cells.includes(i));
          const className = ['cell', status || '', scan?.cells.includes(i) ? 'scanned' : '', preview.includes(i) ? invalid ? 'invalid-preview' : 'preview' : '', last?.target === i ? 'latest' : ''].join(' ');
          const statusText = status === 'sunk' ? 'потоплен' : status === 'hit' ? 'попадание' : status ? 'мимо' : ownShip ? 'корабль' : 'не проверено';
          return <button key={i} type="button" className={className} aria-label={`${coord(i, size)}: ${statusText}`} disabled={disabled || !onCell || Boolean(status)} onClick={() => onCell?.(i)}>
            {status && <span className="shot-mark" aria-hidden="true">{status === 'hit' || status === 'sunk' ? '×' : '•'}</span>}
            {last?.target === i && <span key={last.seq} className={`impact ${last.result}`} aria-hidden="true"/>}
          </button>;
        })}
        <div className="ship-layer" aria-hidden="true">{visibleShips.map(s => {
          const start = s.cells[0], length = s.cells.length, isSunk = sunk(s, shots);
          return <div key={s.id} className={`ship-position ${isSunk ? 'ship-sunk' : ''} ${selected === s.id ? 'ship-selected' : ''}`} style={{ left: `${start % size / size * 100}%`, top: `${Math.floor(start / size) / size * 100}%`, width: `${(s.vertical ? 1 : length) / size * 100}%`, height: `${(s.vertical ? length : 1) / size * 100}%` }}>
            <img src={`${import.meta.env.BASE_URL}assets/ship.png`} alt="" draggable="false" style={s.vertical ? { width: `${length * 100}%`, height: `${100 / length}%`, transform: 'translate(-50%,-50%) rotate(90deg)' } : { width: '100%', height: '100%' }}/>
          </div>;
        })}</div>
      </div>
    </div>
  </div>;
}
