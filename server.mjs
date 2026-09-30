import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const interfaces = os.networkInterfaces();
const lan = Object.entries(interfaces).filter(([name]) => /^(en|eth|wlan)/.test(name)).flatMap(([, values]) => values || []).find(i => i.family === 'IPv4' && !i.internal)?.address;
let hostname = os.hostname().replace(/\.local$/, '');
try { if (process.platform === 'darwin') hostname = execFileSync('/usr/sbin/scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim(); } catch {}
const connection = { url: `http://${hostname}.local:${port}`, fallbackUrl: lan ? `http://${lan}:${port}` : null };
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/connection.json') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(connection)); return; }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(target)).isFile()) { res.writeHead(404); res.end(); return; }
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Порт 4173 уже занят. Игра, возможно, уже открыта: http://localhost:4173' : error.message); process.exit(1); });
server.listen(port, '0.0.0.0', () => { console.log(`Морской бой готов!\nMac: http://localhost:${port}\niPad: ${connection.url}\nОставь это окно открытым. Остановить игру: Control+C.`); });
