/* Private comparison is loaded from the couple's configured sheet, never bundled. */
window.CondoHunting=(()=>{
  let data=[],loaded='',busy=false,error='',mode='comparison',filter='active',linkedSource='',detail=null;
  const verdicts=['🤔 Not decided','👍 I like this one','❤️ Shortlist','💭 Maybe','👎 Pass'];
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  function csv(text){const rows=[];let row=[],s='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){s+='"';i++;}else q=!q;}else if(!q&&(c===','||c==='\n')){row.push(s.replace(/\r$/,''));s='';if(c==='\n'){rows.push(row);row=[];}}else s+=c;}row.push(s.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);return rows;}
  function parse(text){const rows=csv(text);if(rows[0]?.[0]!=='Condo Hunting')throw Error('The sheet is not in the Condo Hunting column layout yet.');return rows[0].slice(1).map((name,i)=>{const o={name};rows.slice(1).forEach(r=>{if(r[0])o[r[0]]=r[i+1]||'';});o.id=o['Rental listing'];return o;}).filter(o=>o.name&&url(o.id));}
  const validId=id=>typeof id==='string'&&/^[\w-]{20,}$/.test(id);
  function sourceId(){const id=DB.get('condoSheet','');return validId(id)?id:(DB.get('condoCache',null)?.id||'');}
  function mergeSource(remote,local){const read=v=>{try{return JSON.parse(v);}catch{return '';}};const id=linkedSource||(validId(read(remote['cf-condoSheet']))?read(remote['cf-condoSheet']):read(local['cf-condoSheet']));return validId(id)?{...remote,'cf-condoSheet':JSON.stringify(id)}:remote;}
  function eligible(year,furnishing){const y=Number(year),t=String(furnishing||'');return Number.isInteger(y)&&y>=2022&&y<=new Date().getFullYear()&&/\bfully[ -]+furnished\b/i.test(t)&&!/(?:part(?:ly|ially)?[ -]+furnished|unfurnished|un-furnished|not[ -]+(?:fully[ -]+)?furnished|fully fitted|only .*rooms? furnished|basic unit|bare unit)/i.test(t);}
  function acceptLink(){const m=location.hash.match(/^#homes\?sheet=([\w-]{20,})$/);if(m){linkedSource=m[1];DB.set('condoSheet',m[1]);history.replaceState(null,'','#homes');}}
  async function refresh(){const id=sourceId();if(!/^[\w-]{20,}$/.test(id)||busy)return;busy=true;error='';render();try{const r=await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=0`,{cache:'no-store'});if(!r.ok)throw Error('Sheet could not be loaded.');data=parse(await r.text());loaded=id;DB.set('condoCache',{id,data,at:Date.now()});}catch(err){error=err.message||'Could not refresh the comparison.';}finally{busy=false;render();}}
  function connect(){const value=document.getElementById('condo-connect').value.trim();const id=value.match(/\/d\/([\w-]+)/)?.[1]||value;if(!/^[\w-]{20,}$/.test(id)){error='Paste the Google Sheet link.';render();return;}DB.set('condoSheet',id);loaded='';data=[];refresh();}
  function votes(o){const v=DB.get('condoVotes',{})[o.id]||{};return {F:v.F??o['Fares verdict'],C:v.C??o['Charlotte verdict'],FS:v.FS??(o['Fares seen']==='TRUE'),CS:v.CS??(o['Charlotte seen']==='TRUE')};}
  const isPass=v=>String(v||'').includes('Pass');
  const building=o=>String(o['Building name']||o.name||o.title||'').split(' · ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
  function historyItems(){return DB.get('condoHistory',{});}
  function remember(){
    const all=historyItems();let changed=false;
    data.forEach(o=>{const v=votes(o);if(!isPass(v.F)&&!isPass(v.C)&&!isPass(o['Building decision']))return;
      const previous=all[o.id],reason=DB.get('condoReviewNotes',{})[o.id]||o['Review notes']||'Passed during review.';
      if(!previous||previous.reason!==reason){all[o.id]={o:{...o},reason,at:o['Review date']||new Date().toISOString(),building:building(o),votes:v};changed=true;}
    });
    if(changed)DB.set('condoHistory',all);
  }
  function archived(o){
    const v=votes(o);if(isPass(v.F)||isPass(v.C)||isPass(o['Building decision']))return true;
    return Object.values(historyItems()).some(h=>h.building===building(o));
  }
  function blockedDiscovery(l){
    if(/cheras/i.test([l.area,l.title,l.desc].join(' ')))return true;
    const text=String([l.title,l.desc].join(' ')).toLowerCase().replace(/[^a-z0-9]/g,'');
    const items=data.length?data:(DB.get('condoCache',{})?.data||[]);
    const keys=[...items.filter(o=>{const v=votes(o);return isPass(v.F)||isPass(v.C)||isPass(o['Building decision']);}).map(building),...Object.values(historyItems()).map(h=>h.building)];
    return keys.some(k=>k.length>3&&text.includes(k));
  }
  function status(o,v=votes(o)){
    if(archived(o))return 'Archived — Pass';
    if(/cheras/i.test(o.Neighbourhood||''))return 'Excluded — Cheras';
    if(!eligible(o['Build year filter'],o.Furnishing))return 'Needs checking — completion or furnishing';
    if(!Number(o['Rent RM/month'])||+o['Rent RM/month']>+(o['Budget ceiling RM']||5000))return 'Excluded — over budget or price unknown';
    if(+o['Build year filter']<+(o['Minimum build year']||2022))return 'Excluded — completion year';
    if(+o['Size sqft']<+(o['Minimum size sqft']||800))return 'Excluded — too small';
    if(v.F===verdicts[2]&&v.C===verdicts[2])return '❤️ Both shortlist';
    if(v.F===verdicts[3]||v.C===verdicts[3])return 'Maybe';
    return 'To review';
  }
  function vote(index,key,value){const o=data[index];if(!o)return;const all=DB.get('condoVotes',{});all[o.id]={...(all[o.id]||{}),[key]:value};DB.set('condoVotes',all);remember();render();}
  function note(index,value){const all=DB.get('condoReviewNotes',{});all[data[index].id]=value;DB.set('condoReviewNotes',all);}
  function matches(st){if(filter==='archive')return st.startsWith('Archived');if(filter==='checking')return st.startsWith('Needs')||st.startsWith('Excluded');if(st.startsWith('Archived')||st.startsWith('Excluded')||st.startsWith('Needs'))return false;return filter==='shortlist'?st==='❤️ Both shortlist':true;}
  const brief=(s,n=170)=>{s=String(s||'');return s.length>n?s.slice(0,s.lastIndexOf(' ',n))+'…':s;};
  const link=(v,label)=>url(v)?`<a href="${e(url(v))}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`:'';
  const field=(o,key)=>o[key]?`<div class="ch-field"><h4>${e(key)}</h4><p>${e(o[key])}</p></div>`:'';
  function render(){const root=document.getElementById('condo-root');if(!root)return;window.CondoMap?.destroy();const legacy=document.getElementById('hm-legacy');legacy.hidden=mode!=='explore';root.hidden=mode==='explore';document.querySelectorAll('[data-condo-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.condoMode===mode));if(mode==='explore'){hmLegacyRender();return;}
    const id=sourceId();if(loaded!==id&&!busy){const cache=DB.get('condoCache',null);data=cache?.id===id?cache.data:[];loaded=id;if(id){refresh();return;}}
    if(!id){root.innerHTML=`<div class="ch-connect"><h3>Your shared comparison</h3><p>Open the private condo link shared in your chat to load the comparison automatically on this device. The connection syncs to your other signed-in devices. You can also paste the sheet link below.</p><label for="condo-connect">Google Sheet link</label><input id="condo-connect" type="url" placeholder="Paste the sheet link"><button class="btn primary" onclick="CondoHunting.connect()">Connect comparison</button><p role="status">${e(error)}</p></div>`;return;}
    remember();
    Object.values(historyItems()).forEach(h=>{if(!data.some(o=>o.id===h.o.id))data.push(h.o);});
    const items=data.map((o,index)=>({o,index,v:votes(o),st:status(o)}));
    const count=k=>items.filter(x=>k==='archive'?x.st.startsWith('Archived'):k==='checking'?/^(Needs|Excluded)/.test(x.st):k==='shortlist'?x.st==='❤️ Both shortlist':!/^(Archived|Excluded|Needs)/.test(x.st)).length;
    const toolbar=`<div class="ch-toolbar"><div><strong>${count('active')} ready to review</strong><p>Fully furnished · completed 2022+ · no Cheras. Either person’s Pass archives the condo.</p></div><button class="btn" onclick="CondoHunting.refresh()" ${busy?'disabled':''}>${busy?'Refreshing…':'Refresh'}</button></div><div class="ch-filter" aria-label="Review stages">${[['active','To review'],['shortlist','Shortlist'],['checking','Needs checking'],['archive','Archive']].map(([k,n])=>`<button aria-pressed="${filter===k}" onclick="CondoHunting.filter('${k}')">${n} <span>${count(k)}</span></button>`).join('')}</div>${error?`<p class="ch-error" role="alert">${e(error)} Saved details are shown.</p>`:''}`;
    const entries=items.filter(x=>matches(x.st));
    if(mode==='map'){root.innerHTML=toolbar+'<div id="condo-map-root"></div>';CondoMap.render(document.getElementById('condo-map-root'),entries,{vote,verdicts,details:index=>{mode='comparison';detail=index;render();document.getElementById('ch-detail')?.scrollIntoView({block:'start'});}});return;}
    if(detail!==null&&data[detail]){root.innerHTML=toolbar+research(data[detail],detail);document.getElementById('ch-back').focus();return;}
    root.innerHTML=toolbar+(filter==='checking'?'<p class="ch-sync">Saved interests with missing evidence or a criteria mismatch. These are not qualifying recommendations.</p>':'')+`<div class="ch-grid">${entries.map(card).join('')}</div>`;
    if(!entries.length)root.insertAdjacentHTML('beforeend',`<div class="ch-empty"><h3>${filter==='archive'?'No archived condos yet':filter==='shortlist'?'No joint shortlist yet':filter==='checking'?'Nothing needs checking':'No qualifying proposals left'}</h3><p>${filter==='active'?'Your review decisions are saved. Check saved interests under Needs checking, or explore rentals for fresh options.':'Your decisions stay saved as the list changes.'}</p></div>`);
    root.insertAdjacentHTML('beforeend',`<p class="ch-sync">App decisions sync across signed-in devices. ${link(`https://docs.google.com/spreadsheets/d/${id}/edit`,'Source sheet')} · Full evidence is available on each card.</p>`);
  }
  function card({o,index,v,st}){
    const review=o['Review notes']||'',personal=DB.get('condoReviewNotes',{})[o.id]||'';
    return `<article class="ch-card ch-review" id="ch-card-${index}"><div class="ch-heading"><div><span class="ch-area">${e(o.Neighbourhood)} · ${e(o['Build year filter']||'Year unconfirmed')}</span><h3>${e(o.name)}</h3><span class="ch-status ${st==='❤️ Both shortlist'?'shortlisted':''}">${e(st)}</span></div>${url(o['Photo URL'])?`<img class="ch-thumb" loading="lazy" src="${e(url(o['Photo URL']))}" alt="Listing photo" onerror="this.hidden=true">`:''}</div><div class="ch-body"><div class="ch-price">RM ${Number(o['Rent RM/month']).toLocaleString()}<small> / month</small></div><p class="ch-spec">${e(o['Size sqft'])} sqft · ${e(o.Bedrooms)} beds · ${e(o.Bathrooms)} baths</p><p class="ch-furnishing">${e(brief(o.Furnishing||'Furnishing unconfirmed',105))}</p><div class="ch-facts"><div><h4>Office → home</h4><p><b>6 pm:</b> ${e(o['CEVA → home · leave 6 pm']||'Not checked')}<br><b>6:30 pm:</b> ${e(o['CEVA → home · leave 6:30 pm']||'Not checked')}</p><small>Traffic estimates; check before a viewing.</small></div><div><h4>Pool sunshine</h4><p>${e(o['Pool summary']||'Sunshine hours unverified. Check the pool during your usual swimming time.')}</p></div><div><h4>Gym</h4><p>${e(o['Gym summary']||brief(o['Gym equipment']||'Equipment not verified.'))}</p></div><div><h4>Life around the condo</h4><p>${e(o['Area summary']||brief(o['Walkability evidence']||'Walkability not verified.'))}</p></div><div><h4>Lifts & crowding</h4><p>${e(o['Lift summary']||'Passenger lifts, units per floor and served floors not verified.')}</p></div></div>${review?`<div class="ch-decision"><h4>Review decision</h4><p>${e(review)}</p>${o['Review date']?`<small>${e(o['Review date'])}</small>`:''}</div>`:''}<div class="ch-votes">${[['F','Fares'],['C','Charlotte']].map(([k,n])=>`<div><label class="ch-vlabel" for="ch-${index}-${k}">${n}</label><select id="ch-${index}-${k}" ${st.startsWith('Archived')?'disabled':''} onchange="CondoHunting.vote(${index},'${k}',this.value)">${verdicts.map(x=>`<option ${v[k]===x?'selected':''}>${e(x)}</option>`).join('')}</select></div>`).join('')}</div>${st.startsWith('Archived')?'<p class="ch-sync">Archived condo: other units here will not be proposed again. Its review history is kept here.</p>':''}<label class="ch-note">Add a review note<textarea rows="2" onchange="CondoHunting.note(${index},this.value)" placeholder="What works, what rules it out…">${e(personal)}</textarea></label><div class="ch-links">${link(o.id,'Listing ↗')}${link(o['Condo YouTube tour'],'Condo tour ↗')}${link(o['Area YouTube tour'],'Area tour ↗')}<button class="btn" onclick="CondoHunting.details(${index})">Full research</button></div></div></article>`;
  }
  function research(o,index){return `<article id="ch-detail" class="ch-research"><button id="ch-back" class="btn" onclick="CondoHunting.details(null)">← Back to reviews</button><h3>${e(o.name)}</h3><p>Source details and calculations. Video claims and estimates still need confirmation for the exact unit.</p>${Object.entries(o).filter(([k,v])=>!['id','name','Photo URL'].includes(k)&&v).map(([k,v])=>url(v)?`<div class="ch-field"><h4>${e(k)}</h4>${link(v,'Open source ↗')}</div>`:field(o,k)).join('')}</article>`;}

  return {render,refresh,connect,vote,note,acceptLink,parse,eligible,sourceId,mergeSource,status,archived,blockedDiscovery,details:index=>{detail=index;render();},filter:k=>{filter=k==='all'?'active':k;detail=null;render();},mode:k=>{mode=k;render();}};
})();
