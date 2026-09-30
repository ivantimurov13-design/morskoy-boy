import { readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const outDir = process.env.VITE_BUILD_DIR || 'dist';
const base = process.env.VITE_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid application base path');
async function walk(dir, prefix = '') { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`, `${prefix}${e.name}/`) : `${prefix}${e.name}`))).flat(); }
await writeFile(`${outDir}/.nojekyll`, '');
const assets = (await walk(outDir)).filter(p => p !== 'sw.js');
const hash = createHash('sha256').update(base).update(await readFile(new URL(import.meta.url)));
for (const file of assets) hash.update(await readFile(`${outDir}/${file}`));
const version = hash.digest('hex').slice(0,12);
const prefix = `sea-${createHash('sha256').update(base).digest('hex').slice(0,8)}-`;
await writeFile(`${outDir}/sw.js`, `const PREFIX=${JSON.stringify(prefix)},CACHE=PREFIX+'${version}',BASE=${JSON.stringify(base)},ASSETS=${JSON.stringify([base, ...assets.map(p=>base+p)])};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==location.origin||event.request.method!=='GET'||!url.pathname.startsWith(BASE)||url.pathname===BASE+'connection.json')return;
event.respondWith(caches.open(CACHE).then(async cache=>{const key=event.request.mode==='navigate'&&(url.pathname===BASE||url.pathname===BASE+'index.html')?BASE:event.request;const hit=await cache.match(key);if(hit)return hit;return fetch(event.request);}));});`);
console.log(`Offline cache: ${assets.length} assets, base ${base}, ${version}`);
