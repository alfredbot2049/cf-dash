/* Private comparison is loaded from the couple's configured sheet, never bundled. */
window.CondoHunting=(()=>{
  let data=[],loaded='',busy=false,error='',mode='comparison',filter='active',linkedSource='',detail=null,detailBack='comparison',discovery=null,pendingRefresh=false;
  const verdicts=['🤔 Not decided','👍 I like this one','❤️ Shortlist','💭 Maybe','👎 Pass'];
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  function csv(text){const rows=[];let row=[],s='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){s+='"';i++;}else q=!q;}else if(!q&&(c===','||c==='\n')){row.push(s.replace(/\r$/,''));s='';if(c==='\n'){rows.push(row);row=[];}}else s+=c;}row.push(s.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);return rows;}
  function parse(text){const rows=csv(text);if(rows[0]?.[0]!=='Condo Hunting')throw Error('The sheet is not in the Condo Hunting column layout yet.');return rows[0].slice(1).map((name,i)=>{const o={name};rows.slice(1).forEach(r=>{if(r[0])o[r[0]]=r[i+1]||'';});o.id=o['Rental listing'];return o;}).filter(o=>o.name&&url(o.id));}
  const validId=id=>typeof id==='string'&&/^[\w-]{20,}$/.test(id);
  function sourceId(){return [linkedSource,DB.get('condoSheet',''),DB.get('condoCache',null)?.id].find(validId)||'';}
  function mergeSource(remote={},local={}){const read=v=>{try{return typeof v==='string'?JSON.parse(v):v;}catch{return null;}};const id=[linkedSource,read(remote['cf-condoSheet']),read(remote['cf-condoCache'])?.id,read(local['cf-condoSheet']),read(local['cf-condoCache'])?.id].find(validId);return id?{...remote,'cf-condoSheet':JSON.stringify(id)}:remote;}
  function fullyFurnished(furnishing){
    const t=String(furnishing||'').normalize('NFKC');
    // Agents also answer a "Fully furnished:" label with PARTIAL, NO or PF.
    // A positive keyword never overrides contradictory unit details.
    return /\bfully[\s-]+furnished\b/i.test(t)&&!/(?:\bpartial(?:ly)?\b|\bpartly\b|\bsemi[\s-]*furnish|\bp\s*\/\s*f\b|\bPF\b|\bun[\s-]*furnished\b|\bnot[\s-]+(?:fully[\s-]+)?furnished\b|fully fitted|only .*rooms? furnished|\bbasic unit\b|\bbare\b|fully[\s-]+furnished\s*[:=–-]\s*(?:no|none|false)\b)/i.test(t);
  }
  function eligible(year,furnishing){const y=Number(year);return Number.isInteger(y)&&y>=2022&&y<=new Date().getFullYear()&&fullyFurnished(furnishing);}
  function acceptLink(){const m=location.hash.match(/^#homes\?sheet=([\w-]{20,})$/);if(m){linkedSource=m[1];DB.set('condoSheet',m[1]);history.replaceState(null,'','#homes');}}
  async function refresh(){const id=sourceId();if(!validId(id))return;if(busy){pendingRefresh=true;return;}busy=true;loaded=id;error='';render();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=0`,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Sheet could not be loaded.');const next=parse(await r.text());if(sourceId()===id){data=next;loaded=id;DB.set('condoSheet',id);DB.set('condoCache',{id,data,at:Date.now()});}}catch(err){if(sourceId()===id)error=err.name==='AbortError'?'The sheet took too long to respond. Retry when your connection is ready.':err.message||'Could not refresh the comparison.';}finally{clearTimeout(timer);busy=false;if(pendingRefresh||sourceId()!==id){pendingRefresh=false;refresh();}else render();}}
  function connect(){const value=document.getElementById('condo-connect').value.trim();const id=value.match(/\/d\/([\w-]+)/)?.[1]||value;if(!validId(id)){error='Paste the Google Sheet link.';render();return;}linkedSource=id;DB.set('condoSheet',id);loaded='';data=[];refresh();}
  function sheetItems(){const cache=DB.get('condoCache',null);return loaded===sourceId()&&data.length?data:(cache?.id===sourceId()?cache.data||[]:[]);}
  function sameListing(a,b){try{const clean=v=>{const u=new URL(v);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');};return clean(a)===clean(b);}catch{return false;}}
  function savedListing(l){return sheetItems().find(o=>sameListing(o.id,l.url));}
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
    if(o['Review override']==='Reopened for review'&&!historyItems()[o.id])return false;
    return Object.values(historyItems()).some(h=>h.building===building(o));
  }
  // Conservative interpretation of the user-marked PJ–Bangsar corridor.
  // Broad city labels and nearby-area claims in adverts do not establish location.
  function areaDecision(o){
    const area=String(o.Neighbourhood||o.area||'');
    const name=String(o.name||o.building||o.title||'');
    if(/titiwangsa|d[’']?\s*bright{1,2}on|wangsa maju|sentul|cheras|maluri|cochrane|damansara|mont kiara|hartamas|klcc|ampang|kepong|puchong|shah alam|subang/i.test(area+' '+name))return 'outside';
    if(/\b(bangsar|kerinchi|pantai|taman desa|seputeh|brickfields|kl sentral|kelana jaya|sungai way|seri setia)\b|\bss\s*2\b/i.test(area))return 'inside';
    return 'unconfirmed';
  }
  function blockedDiscovery(l){
    if(areaDecision(l)!=='inside')return true;
    const text=String([l.title,l.desc].join(' ')).toLowerCase().replace(/[^a-z0-9]/g,'');
    const items=data.length?data:(DB.get('condoCache',{})?.data||[]);
    const keys=[...items.filter(o=>{const v=votes(o);return isPass(v.F)||isPass(v.C)||isPass(o['Building decision']);}).map(building),...Object.values(historyItems()).map(h=>h.building)];
    return keys.some(k=>k.length>3&&text.includes(k));
  }
  function status(o,v=votes(o)){
    if(archived(o))return 'Archived — Pass';
    if(areaDecision(o)==='outside')return 'Excluded — outside your search area';
    if(areaDecision(o)!=='inside')return 'Needs checking — exact location';
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
    if(discovery){root.innerHTML=research(discovery);return;}
    if(!id&&window.cfSyncPending){root.innerHTML='<p class="ch-empty" role="status">Loading your shared comparison…</p>';return;}
    if(!id){root.innerHTML=`<div class="ch-connect"><h3>Your shared comparison</h3><p>Open the private condo link shared in your chat to load the comparison automatically on this device. The connection syncs to your other signed-in devices. You can also paste the sheet link below.</p><label for="condo-connect">Google Sheet link</label><input id="condo-connect" type="url" placeholder="Paste the sheet link"><button class="btn primary" onclick="CondoHunting.connect()">Connect comparison</button><p role="status">${e(error)}</p></div>`;return;}
    remember();
    Object.values(historyItems()).forEach(h=>{if(!data.some(o=>o.id===h.o.id))data.push(h.o);});
    const items=data.map((o,index)=>({o,index,v:votes(o),st:status(o)}));
    const count=k=>items.filter(x=>k==='archive'?x.st.startsWith('Archived'):k==='checking'?/^(Needs|Excluded)/.test(x.st):k==='shortlist'?x.st==='❤️ Both shortlist':!/^(Archived|Excluded|Needs)/.test(x.st)).length;
    const toolbar=`<div class="ch-toolbar"><div><strong>${count('active')} ready to review</strong><p>Fully furnished · completed 2022+ · your PJ–Bangsar corridor. Either person’s Pass archives the condo.</p></div><button class="btn" onclick="CondoHunting.refresh()" ${busy?'disabled':''}>${busy?'Refreshing…':'Refresh'}</button></div><div class="ch-filter" aria-label="Review stages">${[['active','To review'],['shortlist','Shortlist'],['checking','Needs checking'],['archive','Archive']].map(([k,n])=>`<button aria-pressed="${filter===k}" onclick="CondoHunting.filter('${k}')">${n} <span>${count(k)}</span></button>`).join('')}</div>${error?`<p class="ch-error" role="alert">${e(error)} Saved details are shown.</p>`:''}`;
    if(busy&&!data.length){root.innerHTML=toolbar+'<p class="ch-empty" role="status">Loading properties from your sheet…</p>';return;}
    const entries=items.filter(x=>matches(x.st));
    if(mode==='map'){root.innerHTML=toolbar+'<div id="condo-map-root"></div>';CondoMap.render(document.getElementById('condo-map-root'),entries,{vote,verdicts,details:index=>{detailBack='map';mode='comparison';detail=index;discovery=null;render();document.getElementById('ch-detail')?.scrollIntoView({block:'start'});}});return;}
    if(detail!==null&&data[detail]){root.innerHTML=research(data[detail],detail);document.getElementById('ch-back').focus();return;}
    root.innerHTML=toolbar+(filter==='checking'?'<p class="ch-sync">Saved interests with missing evidence or a criteria mismatch. These are not qualifying recommendations.</p>':'')+`<div class="ch-grid">${entries.map(card).join('')}</div>`;
    if(!entries.length)root.insertAdjacentHTML('beforeend',`<div class="ch-empty"><h3>${filter==='archive'?'No archived condos yet':filter==='shortlist'?'No joint shortlist yet':filter==='checking'?'Nothing needs checking':'No qualifying proposals left'}</h3><p>${filter==='active'?'Your review decisions are saved. Check saved interests under Needs checking, or explore rentals for fresh options.':'Your decisions stay saved as the list changes.'}</p></div>`);
    root.insertAdjacentHTML('beforeend',`<p class="ch-sync">App decisions sync across signed-in devices. ${link(`https://docs.google.com/spreadsheets/d/${id}/edit`,'Source sheet')} · Full evidence is available on each card.</p>`);
  }
  function commute(o){
    const time=o['CEVA → home']||o['CEVA → home · leave 6 pm']||'',route=commuteRoute(o);
    const label=/\d/.test(time)?time:'Drive time unconfirmed';
    return link(route,label)||e(label);
  }
  function commuteRoute(o){
    if(url(o['Route · 6 pm']))return url(o['Route · 6 pm']);
    const origin=o['Commute origin'],destination=o['Map coordinates'];
    if(!origin||!/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(destination||''))return '';
    return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(origin)+'&destination='+encodeURIComponent(destination)+'&travelmode=driving';
  }
  const mapFields=['Exact address / Maps','Local shops / Maps','Nearby mall / Maps'];
  function placeLink(key,value){
    if(!mapFields.includes(key)||!value)return '';
    return link(url(value)||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(value),url(value)?'Open map ↗':value);
  }
  function pool(o){
    return `<span>☀️ Sun: ${e(o['Pool sun window']||'timing unconfirmed')}</span><br><span>🏢 Building shade: ${e(o['Pool shade window']||'timing unconfirmed')}</span>`;
  }
  function card({o,index,v,st}){
    const review=o['Review notes']||'',personal=DB.get('condoReviewNotes',{})[o.id]||'';
    return `<article class="ch-card ch-review" id="ch-card-${index}"><div class="ch-heading"><div><span class="ch-area">${e(o.Neighbourhood)} · ${e(o['Build year filter']||'Year unconfirmed')}</span><h3>${e(o.name)}</h3><span class="ch-status ${st==='❤️ Both shortlist'?'shortlisted':''}">${e(st)}</span></div>${url(o['Photo URL'])?`<img class="ch-thumb" loading="lazy" src="${e(url(o['Photo URL']))}" alt="Listing photo" onerror="this.hidden=true">`:''}</div><div class="ch-body"><div class="ch-price">RM ${Number(o['Rent RM/month']).toLocaleString()}<small> / month</small></div><p class="ch-spec">${e(o['Size sqft'])} sqft · ${e(o.Bedrooms)} beds · ${e(o.Bathrooms)} baths</p><p class="ch-furnishing">${e(brief(o.Furnishing||'Furnishing unconfirmed',105))}</p>${url(o['Condo YouTube tour'])?`<div class="ch-tour">${link(o['Condo YouTube tour'],'▶ '+(o['Condo tour label']||'Watch condo tour'))}</div>`:''}<div class="ch-facts"><div><h4>🚗 CEVA → home</h4><p>${commute(o)}</p><small>Evening drive · traffic varies</small></div><div><h4>🏊 Pool</h4><p>${pool(o)}</p></div><div><h4>🏋️ Gym</h4><p>• ${e(brief(o['Gym summary']||o['Gym equipment']||'Equipment not verified.',120))}</p></div><div><h4>🚶 Around you</h4><p>• ${e(brief(o['Area summary']||o['Walkability evidence']||'Walkability not verified.',120))}</p></div><div><h4>🛗 Lifts</h4><p>• ${e(brief(o['Lift summary']||'Lift count and units per floor unconfirmed.',120))}</p></div></div>${review?`<div class="ch-decision"><h4>Review decision</h4><p>• ${e(brief(review,140))}</p>${o['Review date']?`<small>${e(o['Review date'])}</small>`:''}</div>`:''}<div class="ch-votes">${[['F','Fares'],['C','Charlotte']].map(([k,n])=>`<div><label class="ch-vlabel" for="ch-${index}-${k}">${n}</label><select id="ch-${index}-${k}" ${st.startsWith('Archived')?'disabled':''} onchange="CondoHunting.vote(${index},'${k}',this.value)">${verdicts.map(x=>`<option ${v[k]===x?'selected':''}>${e(x)}</option>`).join('')}</select></div>`).join('')}</div>${st.startsWith('Archived')?'<p class="ch-sync">Archived condo: other units here will not be proposed again. Its review history is kept here.</p>':''}<label class="ch-note">Add a review note<textarea rows="2" onchange="CondoHunting.note(${index},this.value)" placeholder="What works, what rules it out…">${e(personal)}</textarea></label><div class="ch-links">${link(o.id,'Listing ↗')}${link(o['Area YouTube tour'],'Area tour ↗')}<button class="btn" onclick="CondoHunting.details(${index})">Full research</button></div></div></article>`;
  }
  function property(l){
    const saved=savedListing(l);
    if(saved)return {...saved};
    return {id:l.url||'',name:l.building||l.title||'Property details','Rental listing':l.url||'','Rent RM/month':l.rent||'','Size sqft':l.size||'',Neighbourhood:l.area||'','Completion / VP':l.builtYear||'',Bedrooms:l.beds||'',Bathrooms:l.baths||'',Furnishing:l.furnishing||(fullyFurnished(l.desc+' '+l.title)?'Fully furnished per listing; inventory not verified.':''),'Photo URL':l.imgs?.[0]||'','Build year filter':l.builtYear||'','Listing description':l.desc||'','Research coverage':'Explorer listing — not yet researched in the comparison sheet.'};
  }
  function research(o){
    const groups=[['The unit',['Rental listing','Rent RM/month','Size sqft','Neighbourhood','Completion / VP','Bedrooms','Bathrooms','Balcony / floor / view','Living room','Furnishing','Parking spaces']],['Location & facilities',['Exact address / Maps','Local shops / Maps','Nearby mall / Maps','Area summary','Gym equipment','Lift summary','Pool sun window','Pool shade window']],['Review',['Fares verdict','Charlotte verdict','Building decision','Review notes','Review date','Review stage']],['Evidence & criteria',['Condo YouTube tour','Condo tour label','Agent','Build year filter','Budget ceiling RM','Minimum size sqft','Minimum build year','Map coordinates','Building name','Research coverage','Listing description']]];
    const shown=new Set(['id','name','Photo URL','Commute origin','CEVA → home','CEVA → home · leave 6 pm','Route · 6 pm']);
    const row=(key,value)=>{shown.add(key);return `<div class="ch-field"><h4>${e(key)}</h4><p>${placeLink(key,value)||(url(value)?link(value,'Open source ↗'):e(value||'Not yet confirmed'))}</p></div>`;};
    const sections=groups.map(([title,keys])=>`<section class="ch-research-section"><h2>${e(title)}</h2>${keys.map(k=>row(k,o[k])).join('')}</section>`).join('');
    const extra=Object.entries(o).filter(([k,v])=>!shown.has(k)&&v).map(([k,v])=>row(k,v)).join('');
    const appVotes=DB.get('condoVotes',{})[o.id],appNote=DB.get('condoReviewNotes',{})[o.id];
    return `<article id="ch-detail" class="ch-research"><button id="ch-back" class="btn" onclick="CondoHunting.back()">← Back to ${detailBack==='explore'?'Explorer':detailBack==='map'?'map':'reviews'}</button><h3>${e(o.name)}</h3><p>${o['Research coverage']?e(o['Research coverage']):'The same property research as your comparison sheet.'}</p>${url(o['Photo URL'])?`<img class="ch-detail-photo" src="${e(url(o['Photo URL']))}" alt="Property listing photo" onerror="this.hidden=true">`:''}<div class="ch-field"><h4>🚗 CEVA → home</h4><p>${commute(o)}</p></div>${sections}${extra?'<section class="ch-research-section"><h2>More from the sheet</h2>'+extra+'</section>':''}${appVotes||appNote?`<section class="ch-research-section"><h2>Latest app review</h2><p>Saved across signed-in devices; separate from sheet verdicts.</p>${appVotes?row('Fares',votes(o).F)+row('Charlotte',votes(o).C):''}${appNote?row('App review note',appNote):''}</section>`:''}</article>`;
  }
  function discoveryDetails(id){const l=hmAll().find(x=>hmId(x)===id);if(!l)return;discovery=property(l);detail=null;detailBack='explore';mode='comparison';render();document.getElementById('ch-detail')?.scrollIntoView({block:'start'});}
  function back(){detail=null;discovery=null;mode=detailBack;render();}

  return {render,refresh,connect,vote,note,acceptLink,parse,commuteRoute,eligible,sourceId,mergeSource,status,archived,blockedDiscovery,areaDecision,fullyFurnished,property,research,discoveryDetails,back,details:index=>{detailBack=mode;detail=index;discovery=null;render();},filter:k=>{filter=k==='all'?'active':k;detail=null;render();},mode:k=>{mode=k;detail=null;discovery=null;render();}};
})();
