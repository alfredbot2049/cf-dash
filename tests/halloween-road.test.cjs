const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root+'/halloween-availability.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(root+'/halloween.js','utf8'),ctx);
const road=ctx.window.CF_HALLOWEEN;
assert.equal(road.start,'2026-09-11');
assert.equal(road.end,'2026-10-31');
assert.equal(road.days.length,51);
assert.equal(road.days.flatMap(d=>d.films).length,66);
assert.equal(new Set(road.days.flatMap(d=>d.films.map(f=>f.title))).size,66);
for(const day of road.days){
  const dow=new Date(day.date+'T12:00:00Z').getUTCDay();
  assert.equal(day.films.length,[0,6].includes(dow)?2:1,day.date);
}
assert.equal(road.days[0].films[0].title,'Beetlejuice');
assert.ok(road.days.at(-1).films.every(f=>f.year>=1995));
assert.deepEqual(Array.from(road.christmas.order),[
  'The Rings of Power · Season 1','The Rings of Power · Season 2','The Lord of the Rings trilogy'
]);
const html=fs.readFileSync(root+'/index.html','utf8');
assert.match(html,/id="halloween-road"/);
assert.match(html,/src="halloween\.js/);
assert.match(html,/function hwRender\(/);
console.log('PASS 51-day Road to Halloween, 66 unique films, weekend doubles and Middle-earth handoff');

const future=road.days.filter(d=>d.date>='2026-10-10').flatMap(d=>d.films);
assert.equal(future.length,29);
assert.equal(future[0].title,'The Prestige');
assert.ok(future.every(f=>!['Horror','Slasher','Body horror','Finale'].includes(f.kind)));
assert.ok(future.every(f=>f.year>=1995));
assert.ok(road.reserve.every(f=>f.year>=1995));
assert.equal(road.preferences.country,'MY');
assert.ok(road.availability[future[0].movieWiserId].offers.some(o=>o.type==='Stream'));
assert.ok(road.availability[future[1].movieWiserId].offers.some(o=>o.type==='Stream'));
assert.equal(road.preferences.minimumRating,7.3);
assert.match(html,/posterCell\(\{t:f.title/);
assert.match(html,/Movie of the day/);
assert.match(html,/Asia\/Kuala_Lumpur/);

// Already-seen exclusions persist across reloads and do not move other days.
let state={};
const original=road.days.find(d=>d.date==='2026-10-10').films[0];
state=road.replaceSeen(state,original.id);
let resolved=road.resolveDays(state);
let replacement=resolved.find(d=>d.date==='2026-10-10').films[0];
assert.notEqual(replacement.title,original.title);
assert.ok(state.seen[road.filmKey(original)]);
assert.notEqual(replacement.id,original.id);
assert.equal(resolved[0].films[0].id,road.days[0].films[0].id);
state=road.replaceSeen(JSON.parse(JSON.stringify(state)),replacement.id);
replacement=road.resolveDays(state).find(d=>d.date==='2026-10-10').films[0];
assert.equal(Object.keys(state.seen).length,2);
assert.equal(Object.keys(state.replacements).length,1);
assert.equal(new Set(road.resolveDays(state).flatMap(d=>d.films.map(road.filmKey))).size,66);
assert.equal(road.resolveDays(state.undo).find(d=>d.date==='2026-10-10').films[0].title,road.reserve[0].title);
for(let i=2;i<road.reserve.length;i++){
 state=road.replaceSeen(state,replacement.id);
 replacement=road.resolveDays(state).find(d=>d.date==='2026-10-10').films[0];
}
state=road.replaceSeen(state,replacement.id);
assert.equal(state.exhausted,true);
assert.ok(state.seen[road.filmKey(replacement)]);
assert.equal(road.resolveDays(state).find(d=>d.date==='2026-10-10').films[0].id,replacement.id);
assert.match(html,/DB.set\('halloweenSeen'/);
assert.match(html,/Undo last already seen/);
console.log('PASS seen replacements, reload, no repeats, stable history, undo and honest pool exhaustion');
