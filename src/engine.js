export const MODES = {
  rookie: { title: 'Первая экспедиция', subtitle: 'Учись, исследуй, побеждай', size: 8, fleet: [3, 2, 2, 1, 1], detail: 'Поле 8 × 8 · 5 кораблей · подсказки', icon: 'compass' },
  classic: { title: 'Классический бой', subtitle: 'Настоящая морская битва', size: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], detail: 'Поле 10 × 10 · 10 кораблей', icon: 'anchor' },
  radar: { title: 'Секретный радар', subtitle: 'Больше тайн, больше вызовов', size: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], detail: 'Поле 10 × 10 · 2 заряда радара', icon: 'radar' },
};
export const LETTERS = 'АБВГДЕЖЗИК';
export const coord = (i, size) => `${LETTERS[i % size]}${Math.floor(i / size) + 1}`;
export const cellsFor = (start, length, vertical, size) => {
  if (!Number.isInteger(start) || start < 0 || start >= size * size) return null;
  const row = Math.floor(start / size), col = start % size;
  if (vertical ? row + length > size : col + length > size) return null;
  return Array.from({ length }, (_, k) => start + k * (vertical ? size : 1));
};
export function canPlace(ships, cells, size, except = -1) {
  if (!cells) return false;
  return ships.filter(s => s.id !== except).every(s => s.cells.every(a => cells.every(b => Math.abs(a % size - b % size) > 1 || Math.abs(Math.floor(a / size) - Math.floor(b / size)) > 1)));
}
export function randomFleet(mode, rng = Math.random) {
  const { size, fleet } = MODES[mode];
  for (let attempt = 0; attempt < 500; attempt++) {
    const ships = [];
    for (let id = 0; id < fleet.length; id++) {
      const candidates = [];
      for (let i = 0; i < size * size; i++) for (const vertical of [false, true]) {
        const cells = cellsFor(i, fleet[id], vertical, size);
        if (canPlace(ships, cells, size)) candidates.push({ id, cells, vertical });
      }
      if (!candidates.length) break;
      ships.push(candidates[Math.floor(rng() * candidates.length)]);
    }
    if (ships.length === fleet.length) return ships;
  }
  throw new Error('Не удалось расставить флот');
}
export function newGame(mode, captain, opponent) {
  return { version: 1, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, mode, opponent, size: MODES[mode].size, names: [captain, opponent === 'ai' ? 'Капитан Бот' : captain === 'Дамир' ? 'Даня' : 'Дамир'], boards: [randomFleet(mode), randomFleet(mode)], shots: [{}, {}], scans: [null, null], charges: [2, 2], phase: 'setup', setupPlayer: 0, turn: 0, nextPhase: null, winner: null, log: [], last: null, moves: [0, 0] };
}
export const sunk = (ship, shots) => ship.cells.every(c => shots[c] === 'hit' || shots[c] === 'sunk');
export const remaining = (ships, shots) => ships.filter(s => !sunk(s, shots)).length;
export function fire(game, target) {
  if (game.phase !== 'battle' || target < 0 || target >= game.size ** 2 || !Number.isInteger(target)) return game;
  const who = game.turn, enemy = 1 - who;
  if (game.shots[who][target]) return game;
  const g = JSON.parse(JSON.stringify(game)), shots = g.shots[who];
  const ship = g.boards[enemy].find(s => s.cells.includes(target));
  shots[target] = ship ? 'hit' : 'miss'; g.moves[who]++;
  let result = ship ? 'hit' : 'miss';
  if (ship && sunk(ship, shots)) {
    result = 'sunk'; ship.cells.forEach(c => { shots[c] = 'sunk'; });
    for (const c of ship.cells) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const r = Math.floor(c / g.size) + y, col = c % g.size + x;
      if (r >= 0 && r < g.size && col >= 0 && col < g.size && !shots[r * g.size + col]) shots[r * g.size + col] = 'auto';
    }
  }
  g.last = { who, target, result, seq: g.moves[0] + g.moves[1] };
  g.log = [`${g.names[who]} · ${coord(target, g.size)} · ${result === 'sunk' ? 'Корабль потоплен!' : ship ? 'Попадание!' : 'Мимо'}`, ...g.log].slice(0, 6);
  if (!remaining(g.boards[enemy], shots)) { g.phase = 'result'; g.winner = who; }
  else if (!ship) {
    g.turn = enemy;
    if (g.opponent === 'friend') { g.phase = 'handoff'; g.nextPhase = 'battle'; }
  }
  return g;
}
export function scan(game, center) {
  if (game.phase !== 'battle' || game.mode !== 'radar' || game.charges[game.turn] <= 0 || !Number.isInteger(center) || center < 0 || center >= game.size ** 2) return game;
  const g = JSON.parse(JSON.stringify(game)), who = g.turn, cells = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    const row = Math.floor(center / g.size) + y, col = center % g.size + x;
    if (row >= 0 && row < g.size && col >= 0 && col < g.size) cells.push(row * g.size + col);
  }
  const count = g.boards[1 - who].flatMap(s => s.cells).filter(c => cells.includes(c) && !g.shots[who][c]).length;
  g.scans[who] = { cells, count }; g.charges[who]--;
  return g;
}
// Deliberately accepts only shot history: the bot cannot inspect hidden ships.
export function chooseTarget(shots, size, smart = true, rng = Math.random) {
  const available = Array.from({ length: size ** 2 }, (_, i) => i).filter(i => !shots[i]);
  if (!available.length) return null;
  if (smart) {
    const hits = Object.keys(shots).filter(k => shots[k] === 'hit').map(Number);
    const neighbors = available.filter(i => hits.some(h => Math.abs(i % size - h % size) + Math.abs(Math.floor(i / size) - Math.floor(h / size)) === 1));
    const aligned = neighbors.filter(i => hits.some(a => hits.some(b => a !== b && ((Math.floor(a / size) === Math.floor(b / size) && Math.floor(i / size) === Math.floor(a / size)) || (a % size === b % size && i % size === a % size)))));
    const candidates = aligned.length ? aligned : neighbors.length ? neighbors : available.filter(i => (Math.floor(i / size) + i % size) % 2 === 0);
    if (candidates.length) return candidates[Math.floor(rng() * candidates.length)];
  }
  return available[Math.floor(rng() * available.length)];
}
export function gameReducer(g, action) {
  switch (action.type) {
    case 'NEW': return newGame(action.mode, action.captain, action.opponent);
    case 'SHUFFLE': return g?.phase !== 'setup' ? g : { ...g, boards: g.boards.map((b, i) => i === g.setupPlayer ? randomFleet(g.mode) : b) };
    case 'PLACE': {
      if (g?.phase !== 'setup') return g;
      const ships = g.boards[g.setupPlayer], ship = ships.find(s => s.id === action.id);
      if (!ship) return g;
      const cells = cellsFor(action.start, ship.cells.length, action.vertical, g.size);
      if (!canPlace(ships, cells, g.size, ship.id)) return g;
      return { ...g, boards: g.boards.map((b, i) => i === g.setupPlayer ? b.map(s => s.id === ship.id ? { ...s, cells, vertical: action.vertical } : s) : b) };
    }
    case 'READY':
      if (g?.phase !== 'setup') return g;
      if (g.opponent === 'friend' && g.setupPlayer === 0) return { ...g, setupPlayer: 1, phase: 'handoff', nextPhase: 'setup' };
      return { ...g, phase: g.opponent === 'friend' ? 'handoff' : 'battle', nextPhase: 'battle', turn: 0 };
    case 'REVEAL': return g?.phase === 'handoff' ? { ...g, phase: g.nextPhase } : g;
    case 'FIRE': return fire(g, action.target);
    case 'SCAN': return scan(g, action.target);
    case 'CLEAR': return null;
    default: return g;
  }
}
