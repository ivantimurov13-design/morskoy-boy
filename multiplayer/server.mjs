import http from 'node:http';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODES, newGame, gameReducer, remaining, sunk } from '../src/engine.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hash = token => createHash('sha256').update(token).digest('hex');
const secret = () => randomBytes(32).toString('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const TTL = 24 * 60 * 60 * 1000;

// One process owns the rooms. Mutations and atomic file replacement run synchronously,
// so two simultaneous shots cannot both act on the same turn/revision.
export function createGameServer({ dataDir, origins = ['https://ivantimurov13-design.github.io'], trustProxy = false, limits = true } = {}) {
  dataDir = resolve(dataDir || './.multiplayer-data');
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const rooms = new Map(), seen = new Map(), buckets = new Map();
  for (const file of readdirSync(dataDir).filter(f => /^[A-Z2-9]{6}\.json$/.test(f))) {
    const room = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
    if (room.updated > Date.now() - TTL) rooms.set(room.code, room);
    else rmSync(join(dataDir, file));
  }
  const persist = room => {
    const path = join(dataDir, `${room.code}.json`), temp = `${path}.tmp`;
    writeFileSync(temp, JSON.stringify(room), { mode: 0o600 });
    const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, path);
    const dir = openSync(dataDir, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
    rooms.set(room.code, room);
  };
  const cleanup = () => {
    for (const [code, room] of rooms) if (room.updated < Date.now() - TTL) {
      rooms.delete(code); seen.delete(code); rmSync(join(dataDir, `${code}.json`), { force: true });
    }
    for (const [key, value] of buckets) if (value.until < Date.now()) buckets.delete(key);
  };
  const maintenance = setInterval(cleanup, 60_000); maintenance.unref();
  const rate = (ip, kind, count, duration) => {
    if (!limits) return;
    const key = `${ip}:${kind}`, now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.until < now) { bucket = { n: 0, until: now + duration }; buckets.set(key, bucket); }
    if (++bucket.n > count) fail(429, 'Слишком много запросов. Подожди немного и попробуй снова.');
  };
  const view = (room, player) => {
    const g = structuredClone(room.game), enemy = 1 - player;
    const left = g.boards.map((ships, p) => remaining(ships, g.shots[1 - p]));
    // Never send intact enemy ships, the enemy radar, or session credentials.
    g.boards[enemy] = g.boards[enemy].filter(ship => sunk(ship, g.shots[player]));
    g.scans[enemy] = null;
    g.setupPlayer = player;
    const live = seen.get(room.code) || [0, 0];
    return { code: room.code, revision: room.revision, player, ready: room.ready, rematch: room.rematch,
      joined: Boolean(room.tokens[1]), opponentOnline: Date.now() - live[enemy] < 15_000,
      expiresAt: room.updated + TTL, game: { ...g, viewer: player, left } };
  };
  const server = http.createServer({ requestTimeout: 10_000, headersTimeout: 10_000, maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) fail(403, 'Этот адрес игры не разрешён.');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '600'); return send(204, null);
      }
      const ip = trustProxy ? (req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress;
      rate(ip, 'requests', 600, 60_000);
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/health' && req.method === 'GET') return send(200, { ok: true, version: 1 });
      let body = {};
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Нужен JSON.');
        let data = '';
        for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 4096) fail(413, 'Запрос слишком большой.'); }
        try { body = JSON.parse(data); } catch { fail(400, 'Не удалось прочитать запрос.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Неверный запрос.');
      }
      if (path === '/rooms' && req.method === 'POST') {
        rate(ip, 'create', 12, 3600_000); cleanup();
        if (!Object.hasOwn(MODES, body.mode) || !['Дамир', 'Даня'].includes(body.captain)) fail(400, 'Выбери режим и капитана.');
        if (rooms.size >= 100) fail(503, 'Все гавани заняты. Попробуй позже.');
        let code;
        do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (rooms.has(code));
        const token = secret(), game = newGame(body.mode, body.captain, 'online');
        const room = { code, game, revision: 1, tokens: [hash(token), null], ready: [false, false], rematch: [false, false], requests: [[], []], updated: Date.now() };
        persist(room); seen.set(code, [Date.now(), 0]);
        return send(201, { token, ...view(room, 0) });
      }
      const match = path.match(/^\/rooms\/([A-Z2-9]{6})(?:\/(join|actions))?$/);
      if (!match) fail(404, 'Адрес не найден.');
      const [, code, operation] = match;
      if (operation === 'join') rate(ip, 'join', 30, 60_000);
      const room = rooms.get(code);
      if (!room || room.updated < Date.now() - TTL) fail(404, 'Комната не найдена или истекла. Создайте новую.');
      if (operation === 'join' && req.method === 'POST') {
        if (room.tokens[1]) fail(409, 'В комнате уже два капитана. Проверь код или продолжи сохранённый бой.');
        const token = secret(), next = structuredClone(room);
        next.tokens[1] = hash(token); next.revision++; next.updated = Date.now(); persist(next);
        const live = seen.get(code) || [0, 0]; live[1] = Date.now(); seen.set(code, live);
        return send(200, { token, ...view(next, 1) });
      }
      const bearer = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      const player = bearer ? room.tokens.indexOf(hash(bearer)) : -1;
      if (player < 0) fail(401, 'Нет доступа к этой партии. Открой её на устройстве, где начинал бой.');
      const live = seen.get(code) || [0, 0]; live[player] = Date.now(); seen.set(code, live);
      if (!operation && req.method === 'GET') return send(200, view(room, player));
      if (operation !== 'actions' || req.method !== 'POST') fail(405, 'Действие не поддерживается.');
      rate(ip, 'actions', 180, 60_000);
      if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId)) fail(400, 'Нет номера действия.');
      if (room.requests[player].includes(body.requestId)) return send(200, view(room, player));
      const action = body.action;
      if (!action || typeof action !== 'object') fail(400, 'Нет действия.');
      // Preparing separate fleets and voting for a rematch commute. Requiring the
      // latest shared revision here would reject the second captain's Ready click.
      const independent = ['SHUFFLE', 'PLACE', 'READY', 'REMATCH'].includes(action.type);
      if (!Number.isInteger(body.revision) || (body.revision !== room.revision && !independent)) fail(409, 'Партия обновилась. Повтори действие.');
      const next = structuredClone(room), g = next.game;
      if (['SHUFFLE', 'PLACE', 'READY'].includes(action.type)) {
        if (g.phase !== 'setup' || next.ready[player]) fail(409, 'Флот уже готов к бою.');
        if (action.type === 'READY') {
          next.ready[player] = true;
          if (next.ready.every(Boolean) && next.tokens[1]) g.phase = 'battle';
        } else {
          if (action.type === 'PLACE' && (!Number.isInteger(action.id) || !Number.isInteger(action.start) || typeof action.vertical !== 'boolean')) fail(400, 'Неверная клетка.');
          next.game = gameReducer({ ...g, setupPlayer: player }, action);
        }
      } else if (['FIRE', 'SCAN'].includes(action.type)) {
        if (g.phase !== 'battle' || g.turn !== player) fail(409, 'Сейчас ход другого капитана.');
        if (!Number.isInteger(action.target) || action.target < 0 || action.target >= g.size ** 2) fail(400, 'Неверная клетка.');
        const changed = gameReducer(g, action);
        if (changed === g) fail(409, 'Эта клетка уже проверена или заряды закончились.');
        next.game = changed;
      } else if (action.type === 'REMATCH') {
        if (g.phase !== 'result') fail(409, 'Сначала завершите бой.');
        next.rematch[player] = true;
        if (next.rematch.every(Boolean)) {
          next.game = newGame(g.mode, g.names[0], 'online');
          next.game.turn = 1 - g.winner;
          next.ready = [false, false]; next.rematch = [false, false];
        }
      } else fail(400, 'Неизвестное действие.');
      next.requests[player] = [...next.requests[player], body.requestId].slice(-64);
      next.updated = Date.now(); next.revision++; persist(next);
      return send(200, view(next, player));
    } catch (error) {
      if (!error.status) console.error('Request failed:', error.code || error.name);
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Сервер отдыхает. Попробуй ещё раз.' });
      else res.end();
    }
  });
  server.on('close', () => clearInterval(maintenance));
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createGameServer({ dataDir: process.env.DATA_DIR, origins: (process.env.ALLOWED_ORIGINS || 'https://ivantimurov13-design.github.io').split(','), trustProxy: process.env.TRUST_PROXY === 'true' });
  server.listen(Number(process.env.PORT || 4188), '127.0.0.1', () => console.log('Battleship service ready on loopback'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
