import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const repository = 'ivantimurov13-design/morskoy-boy';
const remote = `https://github.com/${repository}.git`;
const stage = path.join(root, '.publish');
const run = (cmd,args,cwd=root) => execFileSync(cmd,args,{cwd,stdio:'inherit'});
const git = (args,cwd=stage) => run('git',['-c','credential.helper=','-c','credential.helper=!gh auth git-credential',...args],cwd);
run('npm',['run','build:pages']);
await mkdir(stage,{recursive:true});
const exists = execFileSync('git',['-c','credential.helper=','-c','credential.helper=!gh auth git-credential','ls-remote','--heads',remote,'gh-pages'],{encoding:'utf8'}).trim();
if (!(await readdir(stage)).includes('.git')) git(['init','-b','gh-pages']);
if (exists) { git(['fetch',remote,'gh-pages']); git(['reset','--hard','FETCH_HEAD']); }
for (const name of await readdir(stage)) if (name !== '.git') await rm(path.join(stage,name),{recursive:true,force:true});
await cp(path.join(root,'site-dist'),stage,{recursive:true});
git(['config','user.name','ivantimurov13-design']);
git(['config','user.email','266346074+ivantimurov13-design@users.noreply.github.com']);
git(['add','--all']);
const changed = execFileSync('git',['status','--porcelain'],{cwd:stage,encoding:'utf8'}).trim();
if (changed) { git(['commit','-m','Publish Battleship for Mac and iPad']); git(['push',remote,'HEAD:gh-pages']); }
console.log('Published files: https://ivantimurov13-design.github.io/morskoy-boy/');
