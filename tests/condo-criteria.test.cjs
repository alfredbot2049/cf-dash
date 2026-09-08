const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const store={};const ctx={window:{},URL,Date,DB:{get:(k,d)=>store[k]??d,set:(k,v)=>store[k]=v},location:{hash:''},history:{replaceState(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/condo.js','utf8'),ctx);
const c=ctx.window.CondoHunting;
assert.equal(c.eligible(2022,'Fully furnished'),true);
for(const year of [2008,2021,null,'',2030])assert.equal(c.eligible(year,'Fully furnished'),false);
for(const text of ['','Furnished','Unfurnished','Partially furnished','Fully furnished / partially furnished','Header fully furnished; description fully fitted. Confirm furniture inventory.','Listed fully furnished; description specifies only two rooms furnished.'])assert.equal(c.eligible(2025,text),false,text);
assert.equal(c.eligible(2025,'Fully furnished per listing; confirm exact inventory.'),true);
const id='test_private_sheet_identifier_12345';store.condoCache={id,data:[]};assert.equal(c.sourceId(),id);
const incoming={'cf-condoSheet':'""','cf-films':'["preserve"]'};
const merged=c.mergeSource(incoming,{'cf-condoSheet':JSON.stringify(id)});
assert.equal(JSON.parse(merged['cf-condoSheet']),id);assert.equal(merged['cf-films'],incoming['cf-films']);
ctx.location.hash='#homes?sheet='+id;c.acceptLink();assert.equal(store.condoSheet,id);
const html=fs.readFileSync(root+'/index.html','utf8');
ctx.CondoHunting=c;ctx.hmAge=()=>null;
vm.runInContext(html.slice(html.indexOf('function hmPass('),html.indexOf('function hmBucket(')),ctx);
const f={beds:2,baths:2,size:800,rentMin:0,maxAge:1};
const base={src:'mine',builtYear:2022,title:'Fully furnished',area:'Bangsar South',rent:3500,beds:2,baths:2,size:900};
assert.equal(ctx.hmPass(base,f)&&ctx.hmAgeOk(base,f),true);
for(const l of [{...base,builtYear:2008},{...base,builtYear:null},{...base,title:'Partially furnished'}])assert.equal(ctx.hmPass(l,f)&&ctx.hmAgeOk(l,f),false);
console.log('PASS strict furnishing/year rules, manual listings, cache recovery and shared connection merge');
// Either person's Pass persists and suppresses other units in the same building.
const rejected={id:'https://example.com/a',name:'Test Residence · 900 sqft',Neighbourhood:'Bangsar South',Furnishing:'Fully furnished','Build year filter':2025,'Rent RM/month':3500,'Size sqft':900,'Fares verdict':'👎 Pass','Charlotte verdict':'💭 Maybe'};
assert.equal(c.status(rejected),'Archived — Pass');
assert.equal(c.status({...rejected,'Fares verdict':'💭 Maybe','Charlotte verdict':'👎 Pass'}),'Archived — Pass');
store.condoCache={id,data:[rejected]};
assert.equal(c.blockedDiscovery({title:'Fully furnished Test Residence 2 bedrooms'}),true);
assert.equal(c.blockedDiscovery({title:'Different condo',area:'Cheras'}),true);
assert.equal(c.blockedDiscovery({title:'Different condo',area:'Bangsar South'}),false);
store.condoHistory={[rejected.id]:{o:rejected,building:'testresidence',reason:'Review decision'}};
assert.equal(c.status({...rejected,id:'https://example.com/new',name:'Test Residence · 1100 sqft','Fares verdict':'❤️ Shortlist','Charlotte verdict':'❤️ Shortlist'}),'Archived — Pass');
assert.match(c.status({...rejected,name:'Different place','Fares verdict':'💭 Maybe','Rent RM/month':6000}),/^Excluded — over budget/);
assert.equal(ctx.hmPass({...base,rent:5100},{...f,rentMax:4500}),false);
console.log('PASS either-person archive, building-level repeat suppression, Cheras and hard budget exclusion');
// An explicitly reopened unit can be reviewed without reviving a rejected unit.
const reopened={...rejected,id:'https://example.com/reopened','Fares verdict':'🤔 Not decided','Charlotte verdict':'🤔 Not decided','Review override':'Reopened for review'};
assert.equal(c.status(reopened),'To review');
assert.equal(c.status(rejected),'Archived — Pass');
assert.equal(c.status({...reopened,'Charlotte verdict':'👎 Pass'}),'Archived — Pass');
assert.equal(c.status({...reopened,'Furnishing':'Partially furnished'}),'Needs checking — completion or furnishing');
assert.equal(c.status({...reopened,'Rent RM/month':6000}),'Excluded — over budget or price unknown');
console.log('PASS explicit unit reopening preserves old rejection and enforces fresh votes and eligibility');

store.condoHistory[reopened.id]={o:reopened,building:"testresidence",reason:"Passed after reopening"};
assert.equal(c.status(reopened),"Archived — Pass");
console.log("PASS a later rejection of the reopened unit remains archived from history");

// Named Maps hyperlinks export as labels; the compact sheet supplies route endpoints.
const route=c.commuteRoute({'Commute origin':'Example office, Main Street','Map coordinates':'3.12, 101.67'});
assert.equal(new URL(route).searchParams.get('origin'),'Example office, Main Street');
assert.equal(new URL(route).searchParams.get('destination'),'3.12, 101.67');
assert.equal(new URL(route).searchParams.get('travelmode'),'driving');
assert.equal(c.commuteRoute({'Commute origin':'Example office'}),'');
assert.equal(c.commuteRoute({'Route · 6 pm':'https://www.google.com/maps/dir/example'}),'https://www.google.com/maps/dir/example');
console.log('PASS compact-sheet driving links and missing destination handling');

for(const text of ['Fully furnished : PARTIAL','Fully furnished: NO','Fully furnished, PF','Fully furnished / P/F','Fully furnished but bare unit'])assert.equal(c.eligible(2025,text),false,text);
const remoteCache={'cf-condoCache':JSON.stringify({id:'remote_sheet_identifier_123456',data:[]})};
// Fresh device recovers the connection from its shared cache before any explicit link.
const freshStore={},fresh={...ctx,window:{},DB:{get:(k,d)=>freshStore[k]??d,set:(k,v)=>freshStore[k]=v}};
vm.createContext(fresh);vm.runInContext(fs.readFileSync(root+'/condo.js','utf8'),fresh);
assert.equal(JSON.parse(fresh.window.CondoHunting.mergeSource(remoteCache,{})['cf-condoSheet']),'remote_sheet_identifier_123456');
assert.equal(JSON.parse(c.mergeSource(remoteCache,{})['cf-condoSheet']),id,'explicit link wins over stale remote cache');
const exact={...rejected,'Review notes':'Exact unit research','Pool sun window':'Morning confirmed by source'};
store.condoCache={id,data:[exact]};
assert.equal(c.property({url:'https://www.example.com/a/?tracking=1',title:'Explorer title'}).name,exact.name);
assert.equal(c.property({url:'https://example.com/different',title:exact.name}).Furnishing,'','another unit must not inherit furnishing');
const rich=c.research(c.property({url:exact.id}));
assert.match(rich,/Exact unit research/);assert.match(rich,/Morning confirmed by source/);assert.match(rich,/Not yet confirmed/);
for(const [key,value] of Object.entries(exact))if(!['id','name'].includes(key)&&typeof value==='string'&&value&&!value.startsWith('https://'))assert.ok(rich.includes(value),key);
assert.match(html,/function hmMore\(id\)\{CondoHunting.discoveryDetails\(id\);\}/);
console.log('PASS PARTIAL label rejection, fresh-device cache recovery, exact-unit research and shared Details entry');

(async()=>{
  const requests=[],cache={},old='old_sheet_identifier_1234567',next='new_sheet_identifier_1234567';
  cache.condoSheet=old;
  const race={window:{},URL,Date,AbortController,setTimeout,clearTimeout,location:{hash:''},history:{replaceState(){}},DB:{get:(k,d)=>cache[k]??d,set:(k,v)=>cache[k]=v},document:{getElementById:id=>id==='condo-connect'?{value:next}:null},fetch:()=>new Promise(resolve=>requests.push(resolve))};
  vm.createContext(race);vm.runInContext(fs.readFileSync(root+'/condo.js','utf8'),race);
  const app=race.window.CondoHunting,pending=app.refresh();app.connect();
  requests[0]({ok:true,text:async()=> 'Condo Hunting,Old unit\nRental listing,https://example.com/old'});
  await pending;
  assert.equal(cache.condoCache,undefined,'stale response must not replace the new connection');
  assert.equal(app.sourceId(),next);assert.equal(requests.length,2);
  requests[1]({ok:true,text:async()=> 'Condo Hunting,New unit\nRental listing,https://example.com/new'});
  await new Promise(r=>setTimeout(r,0));
  assert.equal(cache.condoCache.id,next);assert.equal(cache.condoCache.data[0].name,'New unit');
  console.log('PASS reconnect during an in-flight refresh discards stale results and loads the new source');
})().catch(e=>{console.error(e);process.exitCode=1;});

for(const area of ['Titiwangsa','Wangsa Maju','Sentul','Kota Damansara','Mont Kiara','Cheras','KL City','Petaling Jaya',''])assert.equal(c.blockedDiscovery({title:'Another property',area}),true,area);
assert.equal(c.areaDecision({area:'Titiwangsa',title:"D’Brightton fully furnished near Bangsar"}),'outside');
assert.equal(c.areaDecision({area:'Taman Desa'}),'inside');
assert.equal(c.areaDecision({area:'KL City',desc:'Near Bangsar'}),'unconfirmed');
assert.equal(c.status({...reopened,Neighbourhood:'Titiwangsa',id:'https://example.com/outside'}),'Excluded — outside your search area');
console.log('PASS hard search-area exclusions across discovery and saved review, including ambiguous location labels');

const approved={...reopened,id:'https://example.com/user-approved',name:'User approved residence',Neighbourhood:'Unmapped area','Review override':'Location approved for viewing','Fares verdict':'❤️ Shortlist','Charlotte verdict':'❤️ Shortlist'};
assert.equal(c.status(approved),'❤️ Both shortlist');
assert.equal(c.status({...approved,Furnishing:'Partially furnished'}),'Needs checking — completion or furnishing');
assert.equal(c.status({...approved,'Fares verdict':'👎 Pass'}),'Archived — Pass');
assert.equal(c.blockedDiscovery({area:'Unmapped area',title:'Another unit'}),true);
console.log('PASS explicit viewing approval accepts only that saved location and preserves furnishing and Pass rules');
