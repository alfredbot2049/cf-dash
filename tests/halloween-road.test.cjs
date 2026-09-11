const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
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
assert.deepEqual(Array.from(road.days.at(-1).films,f=>f.title),['Halloween',"Trick 'r Treat"]);
assert.deepEqual(Array.from(road.christmas.order),[
  'The Rings of Power · Season 1','The Rings of Power · Season 2','The Lord of the Rings trilogy'
]);
const html=fs.readFileSync(root+'/index.html','utf8');
assert.match(html,/id="halloween-road"/);
assert.match(html,/src="halloween\.js/);
assert.match(html,/function hwRender\(/);
console.log('PASS 51-day Road to Halloween, 66 unique films, weekend doubles and Middle-earth handoff');
