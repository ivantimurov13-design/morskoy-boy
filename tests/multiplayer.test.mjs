import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGameServer } from '../multiplayer/server.mjs';

async function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sea-test-'));
  let server, base;
  async function start() {
    server = createGameServer({ dataDir, origins: ['http://test.local'], limits: false });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
  }
  await start();
  const stop = () => new Promise(r => { server.close(r); server.closeAllConnections(); });
  t.after(async () => { await stop(); rmSync(dataDir, { recursive: true, force: true }); });
  async function request(path, body, token, origin = 'http://test.local') {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function pair(mode = 'rookie') {
    const a = await request('/rooms', { captain: 'Дамир', mode }); assert.equal(a.status, 201);
    const b = await request(`/rooms/${a.data.code}/join`, {}); assert.equal(b.status, 200);
    return [a.data, b.data];
  }
  const get = s => request(`/rooms/${s.code}`, undefined, s.token);
  async function act(s, action, options = {}) {
    const state = (await get(s)).data;
    return request(`/rooms/${s.code}/actions`, { revision: state.revision, requestId: crypto.randomUUID(), action, ...options }, s.token);
  }
  return { request, pair, get, act, restart: async () => { await stop(); await start(); } };
}

test('rooms isolate secrets, reject invalid origins and unauthorized access', async t => {
  const f = await fixture(t), [a, b] = await f.pair('radar');
  const av = (await f.get(a)).data, bv = (await f.get(b)).data;
  assert.equal(av.game.boards[1].length, 0); assert.equal(bv.game.boards[0].length, 0);
  assert.equal(av.game.boards[0].length, 10); assert.equal(bv.game.boards[1].length, 10);
  assert.equal(av.token, undefined); assert.equal(av.tokens, undefined);
  assert.deepEqual(av.game.names, ['Дамир', 'Даня']);
  assert.equal((await f.request(`/rooms/${a.code}`)).status, 401);
  assert.equal((await f.request(`/rooms/${a.code}`, undefined, 'f'.repeat(64))).status, 401);
  assert.equal((await f.request(`/rooms/${a.code}/join`, {})).status, 409);
  assert.equal((await f.request('/rooms', { captain: 'Дамир', mode: 'rookie' }, undefined, 'https://untrusted.example')).status, 403);
  assert.equal((await f.request('/rooms', { captain: 'Дамир', mode: '__proto__' })).status, 400);
  assert.equal((await f.act(a, { type: 'NEW', mode: 'classic' })).status, 400);
});

test('both captains must be ready; turns, revisions, retries and radar are authoritative', async t => {
  const f = await fixture(t), [a, b] = await f.pair('radar');
  assert.equal((await f.act(a, { type: 'PLACE', id: 0, start: -1, vertical: false })).status, 200);
  assert.equal((await f.act(a, { type: 'FIRE', target: 0 })).status, 409);
  assert.equal((await f.act(a, { type: 'READY' })).data.game.phase, 'setup');
  assert.equal((await f.act(a, { type: 'SHUFFLE' })).status, 409);
  assert.equal((await f.act(b, { type: 'READY' })).data.game.phase, 'battle');
  assert.equal((await f.act(b, { type: 'FIRE', target: 0 })).status, 409);
  assert.equal((await f.act(a, { type: 'FIRE', target: 100 })).status, 400);
  const revision = (await f.get(a)).data.revision, requestId = crypto.randomUUID();
  const body = { revision, requestId };
  const scan = await f.act(a, { type: 'SCAN', target: 22 }, body);
  assert.equal(scan.data.game.charges[0], 1);
  const retry = await f.act(a, { type: 'SCAN', target: 22 }, body);
  assert.equal(retry.data.game.charges[0], 1); assert.equal(retry.data.revision, scan.data.revision);
  assert.equal((await f.get(b)).data.game.scans[0], null);
  assert.equal((await f.act(a, { type: 'FIRE', target: 0 }, { revision })).status, 409);
  await f.act(a, { type: 'SCAN', target: 22 });
  assert.equal((await f.act(a, { type: 'SCAN', target: 22 })).status, 409);
  const ships = (await f.get(b)).data.game.boards[1];
  const hit = ships[0].cells[0], miss = Array.from({ length: 100 }, (_, i) => i).find(i => !ships.some(s => s.cells.includes(i)));
  assert.equal((await f.act(a, { type: 'FIRE', target: hit })).data.game.turn, 0);
  assert.equal((await f.act(a, { type: 'FIRE', target: hit })).status, 409);
  const [one, two] = await Promise.all([f.act(a, { type: 'FIRE', target: miss }), f.act(a, { type: 'FIRE', target: miss })]);
  assert.deepEqual([one.status, two.status].sort(), [200, 409]);
  assert.equal((await f.get(a)).data.game.turn, 1);
});

test('full game, hidden fleets, restart persistence and mutual rematch', async t => {
  const f = await fixture(t), [a, b] = await f.pair();
  const fleet = (await f.get(b)).data.game.boards[1];
  await f.act(a, { type: 'READY' }); await f.act(b, { type: 'READY' });
  const first = await f.act(a, { type: 'FIRE', target: fleet[0].cells[0] });
  await f.restart();
  assert.deepEqual((await f.get(a)).data.game, first.data.game);
  for (const target of fleet.flatMap(s => s.cells).slice(1)) assert.equal((await f.act(a, { type: 'FIRE', target })).status, 200);
  const won = (await f.get(a)).data;
  assert.equal(won.game.phase, 'result'); assert.equal(won.game.winner, 0); assert.equal(won.game.left[1], 0);
  assert.equal((await f.get(b)).data.game.boards[0].length, 0);
  assert.equal((await f.act(a, { type: 'FIRE', target: 63 })).status, 409);
  assert.equal((await f.act(a, { type: 'REMATCH' })).data.game.phase, 'result');
  const rematch = (await f.act(b, { type: 'REMATCH' })).data;
  assert.equal(rematch.game.phase, 'setup'); assert.notEqual(rematch.game.id, won.game.id);
  assert.deepEqual(rematch.ready, [false, false]); assert.equal(rematch.game.turn, 1);
});

test('simultaneous fleet preparation and Ready clicks do not conflict', async t => {
  const f = await fixture(t), [a, b] = await f.pair('classic');
  const revision = (await f.get(a)).data.revision;
  const results = await Promise.all([
    f.act(a, { type: 'SHUFFLE' }, { revision }),
    f.act(b, { type: 'SHUFFLE' }, { revision }),
  ]);
  assert.ok(results.every(r => r.status === 200));
  const ready = await Promise.all([
    f.act(a, { type: 'READY' }, { revision }),
    f.act(b, { type: 'READY' }, { revision }),
  ]);
  assert.ok(ready.every(r => r.status === 200));
  assert.equal((await f.get(a)).data.game.phase, 'battle');
});

test('server enforces rate limits and JSON request size', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'sea-limits-'));
  const server = createGameServer({ dataDir });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => { server.close(r); server.closeAllConnections(); }); rmSync(dataDir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}/rooms`;
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ large: 'a'.repeat(5000) })).status, 413);
  for (let i = 0; i < 12; i++) assert.equal((await post({ mode: 'rookie', captain: 'Даня' })).status, 201);
  assert.equal((await post({ mode: 'rookie', captain: 'Даня' })).status, 429);
});
