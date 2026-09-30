import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
const hasBuild = await access('site-dist/sw.js').then(()=>true,()=>false);
test('Pages build caches every asset under its own project path', {skip:!hasBuild}, async()=>{
 const code=await readFile('site-dist/sw.js','utf8');
 const hooks={}, fetched=[],deleted=[];let ownCache;
 const cache={addAll:async urls=>{fetched.push(...urls)},match:async key=>key==='/morskoy-boy/'?'OFFLINE_GAME':undefined};
 const context={self:{addEventListener:(name,fn)=>hooks[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},location:{origin:'https://example.github.io'},URL,caches:{open:async name=>{ownCache=name;return cache},keys:async()=>[ownCache,ownCache.replace(/[^-]+$/,'old'),'unrelated-app-cache','sea-ffffffff-old'],delete:async name=>{deleted.push(name);return true}},fetch:async()=>{throw Error('offline')}};
 vm.runInNewContext(code,context);
 let work; hooks.install({waitUntil:p=>work=p});await work;
 for(const url of fetched){assert.ok(url.startsWith('/morskoy-boy/'));await access('site-dist/'+(url.slice('/morskoy-boy/'.length)||'index.html'));}
 hooks.activate({waitUntil:p=>work=p});await work;assert.equal(deleted.length,1);assert.ok(deleted[0].endsWith('-old'));
 hooks.fetch({request:{url:'https://example.github.io/morskoy-boy/?from=icon',method:'GET',mode:'navigate'},respondWith:p=>work=p});assert.equal(await work,'OFFLINE_GAME');
 let intercepted=false;hooks.fetch({request:{url:'https://example.github.io/another-game/',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
test('Pages HTML and manifest use project-scoped icons and entry points', {skip:!hasBuild}, async()=>{
 const html=await readFile('site-dist/index.html','utf8');assert.ok(html.includes('/morskoy-boy/manifest.webmanifest'));assert.ok(html.includes('/morskoy-boy/assets/'));assert.ok(!html.includes('href="/icons/'));
 const manifest=JSON.parse(await readFile('site-dist/manifest.webmanifest','utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
 for(const icon of manifest.icons){assert.ok(!icon.src.startsWith('/'));await access('site-dist/'+icon.src);}
});
