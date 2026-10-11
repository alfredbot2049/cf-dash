/* Account-scoped navigation preferences; shared content stays in its sections. */
let ptEditing=false,ptSuppress=false;
function ptKey(){return cfUser?'tabs-'+cfUser.id:null;}
function ptPrefs(){const key=ptKey(),p=key?DB.get(key,{}):{};return {order:[...new Set([...(!Array.isArray(p.order)||p.order.includes('hub')?[]:['hub']),...(Array.isArray(p.order)?p.order:[]),...NAV.map(n=>n.id)])].filter(id=>NAV.some(n=>n.id===id)),hidden:Array.isArray(p.hidden)?p.hidden:[],labels:p.labels||{}};}
function ptSave(p){const key=ptKey();if(!key)return;DB.set(key,p);renderTabs(location.hash.slice(1));}
function ptMove(id,delta){const p=ptPrefs(),i=p.order.indexOf(id),j=i+delta;if(i<0||j<0||j>=p.order.length)return;[p.order[i],p.order[j]]=[p.order[j],p.order[i]];ptSave(p);}
function ptRename(id,value){const p=ptPrefs();p.labels[id]=value.trim().slice(0,30);ptSave(p);}
function ptVisible(id,on){const p=ptPrefs();p.hidden=p.hidden.filter(x=>x!==id);if(!on)p.hidden.push(id);ptSave(p);}
renderTabs=function(cur){
 const p=ptPrefs(),root=document.getElementById('tabs');root.innerHTML=p.order.filter(id=>!p.hidden.includes(id)).map(id=>{const n=NAV.find(n=>n.id===id);return `<button class="tab ${cur===id?'on':''}" data-tab="${id}"><span class="d">${n.ico}</span>${esc(p.labels[id]||n.lbl)}</button>`;}).join('')+`<button class="tab" id="pt-customize" aria-label="Personalise tabs">${ptEditing?'Done':'＋ Tabs'}</button>`;
 root.classList.toggle('pt-editing',ptEditing);root.querySelector('#pt-customize').onclick=()=>{if(ptEditing){ptEditing=false;renderTabs(cur);}else ptManager();};
 root.querySelectorAll('[data-tab]').forEach(el=>{
  el.onclick=()=>{if(ptSuppress){ptSuppress=false;return;}if(!ptEditing)go(el.dataset.tab);};
  el.oncontextmenu=e=>e.preventDefault();
  el.onpointerdown=e=>{
   if(e.button!==0)return;const x=e.clientX,y=e.clientY;let active=ptEditing,timer;
   const begin=()=>{active=true;ptEditing=true;root.classList.add('pt-editing');el.classList.add('pt-held');el.setPointerCapture(e.pointerId);};
   timer=setTimeout(begin,450);if(active)begin();
   const move=ev=>{if(!active){if(Math.hypot(ev.clientX-x,ev.clientY-y)>8)clearTimeout(timer);return;}ev.preventDefault();const hit=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-tab]');if(hit&&hit!==el&&root.contains(hit)){const nodes=[...root.querySelectorAll('[data-tab]')];root.insertBefore(el,nodes.indexOf(hit)>nodes.indexOf(el)?hit.nextSibling:hit);}const r=root.getBoundingClientRect();if(ev.clientX>r.right-30)root.scrollLeft+=16;if(ev.clientX<r.left+30)root.scrollLeft-=16;};
   const end=ev=>{clearTimeout(timer);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);el.classList.remove('pt-held');if(active){ptSuppress=true;const p=ptPrefs();if(ev.type!=='pointercancel'){const visible=[...root.querySelectorAll('[data-tab]')].map(n=>n.dataset.tab);let i=0;p.order=p.order.map(id=>p.hidden.includes(id)?id:visible[i++]);ptSave(p);}else renderTabs(cur);setTimeout(()=>{ptSuppress=false;},100);}};
   el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  };
 });
};
function ptManager(){
 let dlg=document.getElementById('pt-manager');if(!dlg){dlg=document.createElement('dialog');dlg.id='pt-manager';dlg.className='ck-dialog';document.body.appendChild(dlg);}const p=ptPrefs();dlg.innerHTML='<h2>Your tabs</h2><p>Choose sections, rename them, or hold a tab to move it. Changes apply to your account.</p>'+p.order.map(id=>{const n=NAV.find(n=>n.id===id);return `<div class="pt-row"><label><input type="checkbox" data-visible="${id}" ${p.hidden.includes(id)?'':'checked'}> ${n.ico} ${esc(n.lbl)}</label><input data-name="${id}" aria-label="Name for ${esc(n.lbl)}" value="${esc(p.labels[id]||n.lbl)}" maxlength="30"><button class="btn sm" data-move="${id}" data-delta="-1" aria-label="Move ${esc(n.lbl)} earlier">←</button><button class="btn sm" data-move="${id}" data-delta="1" aria-label="Move ${esc(n.lbl)} later">→</button></div>`;}).join('')+'<button class="btn" id="pt-close">Done</button>';
 dlg.querySelectorAll('[data-visible]').forEach(el=>el.onchange=()=>ptVisible(el.dataset.visible,el.checked));dlg.querySelectorAll('[data-name]').forEach(el=>el.onchange=()=>ptRename(el.dataset.name,el.value));dlg.querySelectorAll('[data-move]').forEach(el=>el.onclick=()=>{ptMove(el.dataset.move,Number(el.dataset.delta));ptManager();});dlg.querySelector('#pt-close').onclick=()=>dlg.close();if(!dlg.open)dlg.showModal();
}
const ptRerender=rerender;rerender=function(){renderTabs(location.hash.slice(1));ptRerender();};
