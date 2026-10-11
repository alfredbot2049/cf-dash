/* Calendar-first cooking. No migrations or automatic writes to saved recipes. */
let ckWeekOffset=0,ckFilter='all',ckVoice=null,ckAudioUrl=null;
function recipes(){return DB.get('recipes',SEED);}
const CK_INGREDIENTS={
 hp1:['2 chicken breasts','1 cup uncooked rice','Garlic','Soy sauce','Broccoli or green beans','Greek yoghurt','Sriracha','Salt, pepper and paprika'],
 hp2:['300 g lean beef','2 cups broccoli','1 tbsp soy sauce for marinade, plus sauce to taste','1 tsp cornflour','Garlic','Ginger','Oyster sauce','Rice for serving'],
 hp3:['2 salmon fillets','1 cup uncooked quinoa','Stock','Spinach','Garlic','Lemon','Salt and pepper'],
 hp4:['1.5 cups Greek yoghurt','1 scoop vanilla protein powder','Berries','Banana','Chia seeds','Peanut butter','Honey','Granola'],
 hp5:['4 eggs','Feta','Pepper','Onion','Tomato','Spinach','Olive oil','Salt and pepper','Wholegrain toast or avocado'],
 hp6:['1 block firm tofu','Noodles','2 tbsp peanut butter','Soy sauce','Lime','Garlic','Carrot','Cucumber','Peanuts','Chilli'],
 hp7:['400 g chicken thigh','Cumin','Paprika','Garlic','Yoghurt','Wholemeal wraps','Salad','Pickles','Hummus or garlic yoghurt'],
 hp8:['Chicken','1 cup red lentils','1.5 L stock','Onion','Carrot','Celery','Garlic','Cumin','Lemon','Spinach'],
 seed1:['2 cups rice (as specified in method)','4 garlic cloves','1 onion','Butter','2 eggs','Soy sauce','Sugar','Spring onion']
};
function ckAll(){
  const saved=recipes(),titles=new Set(saved.map(r=>r.title));
  return [...saved,...CK_SUGGEST.filter(r=>!titles.has(r.title)).map(r=>({...r,builtin:true}))].map(r=>({...r,ingredients:r.ingredients||CK_INGREDIENTS[r.id]||CK_INGREDIENTS[CK_SUGGEST.find(s=>s.title===r.title)?.id]||[]}));
}
function ckIngredients(r){return Array.isArray(r.ingredients)?r.ingredients:[];}
function ckKeyDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function ckDate(s){return new Date(s+'T12:00:00');}
function ckMonday(){const d=new Date();d.setHours(12,0,0,0);return d;}
function ckDays(){const d=ckMonday();return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(x.getDate()+i);return ckKeyDate(x);});}
function ckPlan(){return DB.get('cookingPlan',[]);}
function ckArg(id){return esc(JSON.stringify(String(id)));}
function ckFind(id){return ckAll().find(r=>r.id===id);}
function ckAction(code,label,cls='btn sm'){return `<button class="${cls}" onclick="${code}">${label}</button>`;}
function ckWeek(n){ckWeekOffset+=n;ckRender();}
function ckSchedule(id,date){if(!date||!ckFind(id))return;const list=ckPlan();list.push({id:uid(),recipeId:id,date,done:false});DB.set('cookingPlan',list);ckRender();}
function ckRemove(id){DB.set('cookingPlan',ckPlan().filter(p=>p.id!==id));ckRender();}
function ckDone(id){DB.set('cookingPlan',ckPlan().map(p=>p.id===id?{...p,done:!p.done}:p));ckRender();}
function ckMove(id,date){if(!date)return;DB.set('cookingPlan',ckPlan().map(p=>p.id===id?{...p,date}:p));ckRender();ckDetail(ckPlan().find(p=>p.id===id)?.recipeId,id);}
function ckScheduleSelect(r){return `<label class="ck-small">Plan a day<select aria-label="Plan ${esc(r.title)}" onchange="ckSchedule(${ckArg(r.id)},this.value);this.value='' "><option value="">Choose a day…</option>${ckDays().map(d=>`<option value="${d}">${ckDate(d).toLocaleDateString('en',{weekday:'short',day:'numeric',month:'short'})}</option>`).join('')}</select></label>`;}
function ckRender(){
  const root=document.getElementById('ck-planner');if(!root)return;
  const days=ckDays(),plan=ckPlan(),today=ckKeyDate(new Date());
  const next=plan.filter(p=>!p.done&&p.date>=today&&ckFind(p.recipeId)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  root.innerHTML=`<div class="ck-workspace"><section class="ck-calendar" aria-label="Weekly meal calendar"><div class="maptop"><div><h3>Next 7 days</h3><span class="ck-small">${ckDate(days[0]).toLocaleDateString('en',{day:'numeric',month:'short'})} – ${ckDate(days[6]).toLocaleDateString('en',{day:'numeric',month:'short'})}</span></div></div><div class="ck-days">${days.map(d=>`<div class="ck-day ${d===today?'today':''}"><div class="ck-date">${ckDate(d).toLocaleDateString('en',{weekday:'short'})}<strong>${ckDate(d).getDate()}</strong></div>${plan.filter(p=>p.date===d).map(p=>{const r=ckFind(p.recipeId);return r?ckAction(`ckDetail(${ckArg(r.id)},${ckArg(p.id)})`,`${p.done?'✓ ':''}${esc(r.title)}`,'ck-meal')+`<div class="ck-slide">${[-1,1].map(n=>ckAction(`ckSlide(${ckArg(p.id)},${n})`,n<0?'←':'→','btn sm')).join('')}</div>`:'';}).join('')||'<span class="ck-free">Leave it open</span>'}</div>`).join('')}</div><p class="ck-small">Use the arrows to move meals one day, swapping when the next day has a meal.</p></section><aside class="ck-next" aria-label="Next meal and groceries">${ckNext(next)}${ckShopping()}</aside></div>`;
  document.getElementById('ck-total').textContent=ckAll().length+' recipes';
  document.getElementById('ck-filters').innerHTML=[['all','All recipes'],['protein','High protein'],['saved','Saved by us']].map(([id,label])=>ckAction(`ckFilter='${id}';ckRender()`,label,'btn sm '+(ckFilter===id?'primary':''))).join('');
  ckShelf();
}
function ckNext(p){
  if(!p)return `<div class="ck-eyebrow">One meal at a time</div><h3>Your next recipe</h3><p>Pick something from the shelf and choose a day. Two or three meals is plenty to start with.</p>`;
  const r=ckFind(p.recipeId),items=ckIngredients(r),have=DB.get('cookingPantry',{});
  return `<div class="ck-eyebrow">${ckDate(p.date).toLocaleDateString('en',{weekday:'long',day:'numeric',month:'short'})}</div><h3>Your next recipe</h3><h4>${esc(r.title)}</h4><p>Do you have these? Tick what is already at home.</p>${items.length?items.map((s,i)=>`<label class="ck-check"><input type="checkbox" ${have[r.id+':'+i]?'checked':''} onchange="ckPantry(${ckArg(r.id+':'+i)},this.checked)"><span>${esc(s)}</span></label>`).join(''):'<p>Ingredients still need checking. Open the recipe or source before shopping.</p>'}<div class="ck-detail-actions">${ckAction(`ckDetail(${ckArg(r.id)},${ckArg(p.id)})`,'View recipe')}${r.steps?.length?ckAction(`cmOpen(${ckArg(r.id)})`,'Start cooking','btn sm primary'):''}${ckAction(`ckDone(${ckArg(p.id)})`,'Cooked it')}</div><div class="ck-tip">A small habit: read the steps and set out your ingredients before turning on the heat.</div>`;
}
function ckPantry(key,value){const have=DB.get('cookingPantry',{});have[key]=value;DB.set('cookingPantry',have);ckRender();}
function ckShopPicks(){const chosen=DB.get('cookingShopSelection',null);if(chosen!==null)return chosen;const today=ckKeyDate(new Date());return ckPlan().filter(p=>!p.done&&p.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3).map(p=>p.id);}
function ckShopSelect(id,on){const picks=new Set(ckShopPicks());on?picks.add(id):picks.delete(id);DB.set('cookingShopSelection',[...picks]);ckRender();}
function ckBought(key,on){const state=DB.get('cookingBought',{});state[key]=on;DB.set('cookingBought',state);ckRender();}
function ckShopping(){
  const upcoming=ckPlan().filter(p=>!p.done&&ckFind(p.recipeId)).sort((a,b)=>a.date.localeCompare(b.date)),selected=ckShopPicks(),have=DB.get('cookingPantry',{}),bought=DB.get('cookingBought',{}),items=new Map();let missing=0;
  for(const p of upcoming.filter(p=>selected.includes(p.id))){const r=ckFind(p.recipeId),list=ckIngredients(r);if(!list.length)missing++;list.forEach((line,i)=>{if(have[r.id+':'+i])return;const key=p.id+':'+i;items.set(key,{line,title:r.title});});}
  return `<details class="ck-shopping" open><summary>Groceries for the next few meals</summary><p class="ck-small">Choose what this shop covers. Quantities stay with each recipe so nothing gets silently rounded or combined.</p>${upcoming.map(p=>`<label class="ck-shop-pick"><input type="checkbox" ${selected.includes(p.id)?'checked':''} onchange="ckShopSelect(${ckArg(p.id)},this.checked)"><span>${esc(ckFind(p.recipeId).title)} · ${esc(p.date)}</span></label>`).join('')||'<p class="ck-small">Plan a meal to start your list.</p>'}${missing?`<p class="ck-small">${missing} selected recipe${missing===1?' needs':'s need'} ingredient details before shopping.</p>`:''}${[...items].map(([key,x])=>`<label class="ck-check"><input type="checkbox" ${bought[key]?'checked':''} onchange="ckBought(${ckArg(key)},this.checked)"><span>${esc(x.line)}<br><small>${esc(x.title)} · ${bought[key]?'bought':'to buy'}</small></span></label>`).join('')}</details>`;
}
function ckShelf(){
  const query=(document.getElementById('ck-search')?.value||'').trim().toLowerCase();
  const list=ckAll().filter(r=>(ckFilter!=='protein'||r.builtin||r.tag==='High protein')&&(ckFilter!=='saved'||!r.builtin)&&(!query||r.title.toLowerCase().includes(query)));
  document.getElementById('cook-list').innerHTML=list.map(r=>`<article class="ck-recipe"><p>${r.builtin?'High protein · ready to browse':r.link?'From your recipe collection':'From our kitchen'}</p><h4>${esc(r.title)}</h4><p>${r.steps?.length?r.steps.length+' steps':'Recipe details to check'}${r.servings?' · '+esc(String(r.servings))+' servings':''}</p><div class="row">${ckAction(`ckDetail(${ckArg(r.id)})`,'View recipe')}${r.steps?.length?ckAction(`cmOpen(${ckArg(r.id)})`,'Cook','btn sm primary'):''}</div>${ckScheduleSelect(r)}</article>`).join('')||'<p class="empty">No recipes match. Try another name or add your own.</p>';
}
function ckSafeLink(link){try{const u=new URL(link);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function ckDetail(id,planId){
  const r=ckFind(id);if(!r)return;const p=planId?ckPlan().find(x=>x.id===planId):null,link=ckSafeLink(r.link),items=ckIngredients(r);
  const dlg=document.getElementById('ck-detail');dlg.dataset.recipeId=id;document.getElementById('ck-detail-body').innerHTML=`<h2>${esc(r.title)}</h2>${p?`<p>${esc(p.date)} · ${p.done?'Cooked':'Planned'}</p><label>Move to another day<input type="date" value="${esc(p.date)}" onchange="ckMove(${ckArg(p.id)},this.value)"></label><div class="ck-detail-actions">${ckAction(`ckDone(${ckArg(p.id)});document.getElementById('ck-detail').close()`,p.done?'Mark as planned':'Cooked it')}${ckAction(`ckRemove(${ckArg(p.id)});document.getElementById('ck-detail').close()`,'Remove from calendar')}</div>`:ckScheduleSelect(r)}<h3>Ingredients</h3>${items.length?'<ul>'+items.map(s=>`<li>${esc(s)}</li>`).join('')+'</ul>':'<p class="ck-small">No ingredient list yet. Add it before creating groceries.</p>'}<h3>Method</h3>${r.steps?.length?'<ol>'+r.steps.map(s=>`<li>${esc(s)}</li>`).join('')+'</ol>':'<p>Saved for later. Recipe steps still need checking.</p>'}${r.notes?`<p>${esc(r.notes)}</p>`:''}${link?`<p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Watch the original / read the source ↗</a></p>`:''}<div id="ck-audio-playback"></div><div class="ck-detail-actions">${r.steps?.length?ckAction(`document.getElementById('ck-detail').close();cmOpen(${ckArg(r.id)})`,'Start cooking','btn sm primary'):''}${!r.builtin?ckAction(`ckEdit(${ckArg(r.id)})`,'Edit recipe'):''}</div>`;
  if(!dlg.open)dlg.showModal();ckPlayAudio(id);
}
let ckEditId=null;
function ckComposer(open=true){if(!open&&ckVoice)ckVoice.stop();document.getElementById('ck-composer').hidden=!open;if(open){document.getElementById('ck-composer').scrollIntoView({block:'start'});document.getElementById('ck-input').focus();}else{ckEditId=null;document.getElementById('ck-input').value='';document.getElementById('ck-audio').value='';}}
function ckEdit(id){const r=recipes().find(r=>r.id===id);if(!r)return;ckEditId=id;document.getElementById('ck-detail').close();ckComposer();document.getElementById('ck-input').value=r.notes?.split('\n')[0]===r.title?r.notes:[r.title,r.notes].filter(Boolean).join('\n');}
function ckStatus(s){document.getElementById('ck-status').textContent=s;}
function ckDrop(event){event.preventDefault();const box=document.getElementById('ck-input'),text=event.dataTransfer.getData('text/plain')||event.dataTransfer.getData('text/uri-list');if(text)box.value+=(box.value?'\n':'')+text;}
function ckSlide(id,n){const list=ckPlan(),meal=list.find(p=>p.id===id);if(!meal)return;const day=ckDate(meal.date);day.setDate(day.getDate()+n);const date=ckKeyDate(day);if(!ckDays().includes(date))return;const others=list.filter(p=>p.id!==id&&p.date===date);DB.set('cookingPlan',list.map(p=>p.id===id?{...p,date}:others.includes(p)?{...p,date:meal.date}:p));ckRender();}
async function ckSave(){
  const text=document.getElementById('ck-input').value.trim(),audio=document.getElementById('ck-audio').files[0];
  if(!text){ckStatus('Type, dictate or paste an idea first.');return;}
  const list=recipes().slice(),existing=list.find(r=>r.id===ckEditId),id=existing?.id||uid();
  if(audio&&audio.size>20*1024*1024){ckStatus('Choose a voice note smaller than 20 MB. Your text is kept.');return;}if(audio){try{await ckAudioStore(id,audio);}catch(e){ckStatus('The voice note could not be saved on this device. Your text is still here.');return;}}
  const raw=text.match(/https?:\/\/[^\s]+/)?.[0],link=ckSafeLink(raw);
  const r={...existing,id,title:text.split('\n')[0].slice(0,100),notes:text,link:link||existing?.link||'',ingredients:existing?.ingredients||[],steps:existing?.steps||[]};
  const i=list.findIndex(x=>x.id===id);i<0?list.unshift(r):list.splice(i,1,r);DB.set('recipes',list);ckComposer(false);ckStatus('Saved for recipe review.');ckRender();
}
function ckAudioChosen(){const file=document.getElementById('ck-audio').files[0];ckStatus(file?'Voice note selected. Save the recipe to keep it on this device.':'');}
function ckAudioDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('cf-cooking-audio',1);req.onupgradeneeded=()=>req.result.createObjectStore('notes');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function ckAudioStore(id,file){if(file.size>20*1024*1024)throw Error('Audio too large');const db=await ckAudioDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function ckPlayAudio(id){if(ckAudioUrl){URL.revokeObjectURL(ckAudioUrl);ckAudioUrl=null;}try{const db=await ckAudioDB();const file=await new Promise((resolve,reject)=>{const req=db.transaction('notes').objectStore('notes').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();if(file&&document.getElementById('ck-detail').open&&document.getElementById('ck-detail').dataset.recipeId===id){ckAudioUrl=URL.createObjectURL(file);const box=document.getElementById('ck-audio-playback');box.innerHTML='<p class="ck-small">Voice note · saved on this device</p>';const el=document.createElement('audio');el.controls=true;el.className='ck-audio-player';el.src=ckAudioUrl;box.appendChild(el);}}catch{}}
function ckDictate(){
  if(ckVoice){ckVoice.stop();return;}const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){ckStatus('Dictation is not available in this browser. Use your keyboard microphone, type, or attach a voice note.');return;}
  ckVoice=new Recognition();ckVoice.lang='en-US';ckVoice.continuous=true;ckVoice.interimResults=false;
  ckVoice.onresult=e=>{const box=document.getElementById('ck-input');for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)box.value+=(box.value?'\n':'')+e.results[i][0].transcript;};
  ckVoice.onerror=()=>ckStatus('Dictation stopped. Check microphone permission or use typed notes.');ckVoice.onend=()=>{ckVoice=null;document.getElementById('ck-dictate').textContent='Dictate notes';};
  try{ckVoice.start();document.getElementById('ck-dictate').textContent='Stop dictation';ckStatus('Listening. Speak your recipe notes, then stop and review before saving.');}catch{ckVoice=null;ckStatus('Could not start dictation. Your typed notes are kept.');}
}
