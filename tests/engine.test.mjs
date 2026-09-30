import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, canPlace, cellsFor, randomFleet, newGame, fire, scan, remaining, chooseTarget, gameReducer } from '../src/engine.js';
function seeded(seed=12345) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
test('every mode generates complete separated straight fleets at all board edges', () => {
  const rng=seeded();
  for(const [mode,spec] of Object.entries(MODES)) for(let t=0;t<60;t++) {
    const ships=randomFleet(mode,rng);
    assert.deepEqual(ships.map(s=>s.cells.length),spec.fleet);
    for(const s of ships){ assert.ok(canPlace(ships,s.cells,spec.size,s.id)); assert.deepEqual(s.cells,cellsFor(s.cells[0],s.cells.length,s.vertical,spec.size)); }
  }
});
test('placement rejects wrapping, overlaps, diagonal contact, and accepts valid placement',()=>{
  assert.equal(cellsFor(7,2,false,8),null); assert.equal(cellsFor(63,2,true,8),null);
  assert.equal(canPlace([{id:0,cells:[0,1]}],[10],8),false);
  assert.equal(canPlace([{id:0,cells:[0,1]}],[18,19],8),true);
});
test('hit retains turn, miss changes turn, repeated shot is inert, original state immutable',()=>{
  const g={...newGame('rookie','Дамир','ai'),phase:'battle'};
  const target=g.boards[1][0].cells[0]; const hit=fire(g,target);
  assert.equal(hit.turn,0); assert.equal(hit.last.result,'hit'); assert.deepEqual(g.shots,[{},{}]); assert.equal(fire(hit,target),hit);
  const water=Array.from({length:64},(_,i)=>i).find(i=>!g.boards[1].some(s=>s.cells.includes(i)));
  assert.equal(fire(hit,water).turn,1);
});
test('sinking marks only water neighbors and recognizes final victory',()=>{
  const g={...newGame('rookie','Даня','ai'),phase:'battle',boards:[[{id:0,cells:[63]}],[{id:0,cells:[0,1]}]]};
  const final=fire(fire(g,0),1);
  assert.equal(final.phase,'result');assert.equal(final.winner,0);assert.equal(final.shots[0][0],'sunk');assert.equal(final.shots[0][8],'auto');assert.equal(remaining(final.boards[1],final.shots[0]),0);
  assert.equal(fire(final,3),final);
});
test('duel hides fleets between setup and every miss',()=>{
  let g=newGame('classic','Дамир','friend'); g=gameReducer(g,{type:'READY'});assert.equal(g.phase,'handoff');assert.equal(g.nextPhase,'setup');assert.equal(g.setupPlayer,1);
  g=gameReducer(g,{type:'REVEAL'});g=gameReducer(g,{type:'READY'});assert.equal(g.phase,'handoff');assert.equal(g.nextPhase,'battle');g=gameReducer(g,{type:'REVEAL'});
  const water=Array.from({length:100},(_,i)=>i).find(i=>!g.boards[1].some(s=>s.cells.includes(i)));
  g=fire(g,water);assert.equal(g.phase,'handoff');assert.equal(g.turn,1);assert.equal(fire(g,2),g);
});
test('radar clips edges, counts intact decks, consumes only two charges, does not consume turn',()=>{
  let g={...newGame('radar','Дамир','ai'),phase:'battle',boards:[[],[{id:0,cells:[0,1,2]}]],shots:[{0:'hit'},{}]};
  g=scan(g,0); assert.deepEqual(g.scans[0].cells,[0,1,10,11]);assert.equal(g.scans[0].count,1);assert.equal(g.charges[0],1);assert.equal(g.turn,0);assert.equal(g.moves[0],0);
  g=scan(g,99);assert.equal(g.charges[0],0);assert.equal(scan(g,50),g);
});
test('bot selects untried cells and pursues adjacent hits without row wrapping',()=>{
  const rng=seeded();
  for(let t=0;t<100;t++){const target=chooseTarget({7:'hit',6:'miss',15:'miss'},8,true,rng);assert.notEqual(target,8);assert.ok(Number.isInteger(target));assert.ok(![6,7,15].includes(target));}
  assert.equal(chooseTarget({11:'hit',12:'hit',10:'miss'},10,true,()=>0),13);
  assert.equal(chooseTarget(Object.fromEntries(Array.from({length:64},(_,i)=>[i,'miss'])),8),null);
});
test('complete simulated battles terminate legally in every mode',()=>{
  const rng=seeded(99);
  for(const mode of Object.keys(MODES)) for(let t=0;t<10;t++){
    let g={...newGame(mode,'Дамир','ai'),phase:'battle'},moves=0;
    while(g.phase==='battle'&&moves<200){const who=g.turn,target=chooseTarget(g.shots[who],g.size,true,rng);assert.ok(target!==null);g=fire(g,target);moves++;}
    assert.equal(g.phase,'result');assert.ok(moves<=g.size*g.size*2);assert.equal(remaining(g.boards[1-g.winner],g.shots[g.winner]),0);
  }
});
test('manual move leaves state intact on invalid placement and ready board complete',()=>{
  let g=newGame('classic','Даня','ai'); assert.equal(gameReducer(g,{type:'PLACE',id:0,start:99,vertical:false}),g);
  const shuffled=gameReducer(g,{type:'SHUFFLE'});assert.equal(shuffled.boards[0].length,10);
  g=gameReducer(g,{type:'READY'});assert.equal(gameReducer(g,{type:'SHUFFLE'}),g);
});
