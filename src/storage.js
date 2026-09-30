export function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
export function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
export function loadGame() {
  const g = read('sea-game-v1', null);
  if (!g || g.version !== 1 || !['rookie', 'classic', 'radar'].includes(g.mode) || !Array.isArray(g.boards) || g.boards.length !== 2 || !Array.isArray(g.shots) || !['setup','battle','handoff','result'].includes(g.phase)) return null;
  // Always hide private fleets on a shared-device reload.
  if (g.opponent === 'friend' && ['setup', 'battle'].includes(g.phase)) return { ...g, nextPhase: g.phase, phase: 'handoff' };
  return g;
}
