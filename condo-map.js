/* Locations and opinions come from the private comparison, never from bundled data. */
window.CondoMap=(()=>{
  let map=null,view=null,signature='',selected='',groups=[],markers=new Map(),options={},host=null;
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const money=v=>`RM ${Number(v).toLocaleString('en-MY')}`;
  function pair(lat,lon){if(lat===''||lon==='')return null;lat=Number(lat);lon=Number(lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?[lat,lon]:null;}
  function coordinates(o){
    const explicit=(o['Map coordinates']||'').trim().split(/\s*,\s*/);
    if(explicit.length===2){const p=pair(...explicit);if(p)return p;}
    // Route destination follows the origin. Never use @lat,lon: that is the viewport centre.
    for(const k of ['Route · 6 pm','Route · 6:30 pm']){
      const matches=[...(o[k]||'').matchAll(/!1d(-?[\d.]+)!2d(-?[\d.]+)/g)];
      if(matches.length>=2){const m=matches.at(-1),p=pair(m[2],m[1]);if(p)return p;}
    }
    try{const u=new URL(o['Exact address / Maps']);const q=(u.searchParams.get('query')||u.searchParams.get('q')||'').split(',');if(q.length===2)return pair(...q);}catch{}
    return null;
  }
  function group(entries){
    const byPlace=new Map(),missing=[];
    entries.forEach(entry=>{const p=coordinates(entry.o);if(!p){missing.push(entry);return;}
      const key=p.map(n=>n.toFixed(5)).join(',');
      if(!byPlace.has(key))byPlace.set(key,{key,point:p,name:entry.o.name.split(' · ')[0],entries:[]});
      byPlace.get(key).entries.push(entry);
    });
    return {groups:[...byPlace.values()],missing};
  }
  function kind(g){return g.entries.some(x=>x.st==='❤️ Both shortlist')?'shortlisted':g.entries.every(x=>x.st.startsWith('Excluded'))?'excluded':'available';}
  function price(g){const prices=g.entries.map(x=>Number(x.o['Rent RM/month'])).filter(Number.isFinite);const lo=Math.min(...prices),hi=Math.max(...prices);return lo===hi?money(lo):`${money(lo)}–${hi.toLocaleString('en-MY')}`;}
  function destroy(){if(map){view={center:map.getCenter(),zoom:map.getZoom()};map.remove();map=null;}markers.clear();}
  function choose(key){
    selected=key;const g=groups.find(x=>x.key===key);
    markers.forEach((m,k)=>{const el=m.getElement();el?.classList.toggle('is-selected',k===key);if(el)el.setAttribute('aria-pressed',String(k===key));m.setZIndexOffset(k===key?1000:0);});
    if(g&&map)map.setView(g.point,Math.max(map.getZoom(),17),{animate:false});
    renderList();
  }
  function card({o,index,v,st}){
    const photo=safe(o['Photo URL']);
    return `<article class="cm-card"><div class="cm-card-top">${photo?`<img src="${e(photo)}" alt="Listing photo of ${e(o.name)}" loading="lazy" onerror="this.hidden=true">`:''}<div><h4>${e(o.name)}</h4><strong>${money(o['Rent RM/month'])}<small> / month</small></strong><p>${e(o['Size sqft'])} sqft · ${e(o.Bedrooms)} beds</p></div></div><p class="ch-status ${st.startsWith('Excluded')?'excluded':st==='❤️ Both shortlist'?'shortlisted':''}">${e(st)}</p><div class="cm-verdicts">${[['F','Fares'],['C','Charlotte']].map(([key,name])=>`<label>${name}<select aria-label="${name} verdict for ${e(o.name)}" data-vote-index="${index}" data-vote-key="${key}">${options.verdicts.map(x=>`<option${v[key]===x?' selected':''}>${e(x)}</option>`).join('')}</select></label>`).join('')}</div><div class="cm-actions"><button class="btn" data-details="${index}">Full comparison</button><a href="${e(safe(o.id))}" target="_blank" rel="noopener noreferrer">Rental listing ↗</a></div></article>`;
  }
  function renderList(){
    const list=host?.querySelector('.cm-results');if(!list)return;
    const shown=selected?groups.filter(g=>g.key===selected):groups;
    list.innerHTML=`<div class="cm-results-heading"><h3>${selected?e(shown[0]?.name||'Condo'):'Condos on this map'}</h3>${selected?'<button class="btn" data-clear>All condos</button>':''}</div>${shown.map(g=>`<section class="cm-building"><div class="cm-building-heading"><button data-place="${e(g.key)}" aria-label="Show ${e(g.name)} on map">${e(g.name)}</button><span>${g.entries.length} listing${g.entries.length===1?'':'s'}</span></div>${g.entries.map(card).join('')}</section>`).join('')}`;
    list.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>choose(b.dataset.place));
    list.querySelector('[data-clear]')?.addEventListener('click',()=>{choose('');fit();});
    list.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>options.details(Number(b.dataset.details)));
    list.querySelectorAll('[data-vote-index]').forEach(s=>s.onchange=()=>options.vote(Number(s.dataset.voteIndex),s.dataset.voteKey,s.value));
    list.scrollTop=0;
  }
  function fit(){if(map&&groups.length)map.fitBounds(groups.map(g=>g.point),{padding:[55,55],maxZoom:15,animate:false});}
  function render(node,entries,callbacks){
    destroy();host=node;options=callbacks;
    const result=group(entries);groups=result.groups;
    if(!groups.some(g=>g.key===selected))selected='';
    const nextSignature=groups.map(g=>g.key).sort().join('|')+':'+Math.round(node.getBoundingClientRect().width)+':'+innerWidth,keepView=signature===nextSignature&&view;signature=nextSignature;
    const n=groups.reduce((sum,g)=>sum+g.entries.length,0);
    host.innerHTML=`<section class="cm-shell" aria-label="Your property map"><div class="cm-bar"><div><strong>${groups.length} condo${groups.length===1?'':'s'} · ${n} listing${n===1?'':'s'} on map</strong><p>Tap a price for its units. Nearby condos group together; tap the count to zoom in.</p></div><button class="btn" data-fit ${groups.length?'':'disabled'}>Show all pins</button></div><div class="cm-legend"><span><i class="available"></i>In criteria</span><span><i class="shortlisted"></i>Both shortlist</span><span><i class="excluded"></i>Excluded</span></div>${groups.length?'<div class="cm-layout"><div class="cm-map-wrap"><div id="condo-map" class="cm-map" aria-label="Map of saved condos"></div><p class="cm-tile-error" role="status" hidden>Map tiles could not load. Pins and listing details remain available; try refreshing.</p></div><div class="cm-results" aria-label="Mapped property listings"></div></div>':`<p class="ch-empty">${entries.length?'No confirmed map pins for these listings yet.':'No listings match this filter. Choose All listings to see every condo.'}</p>`}${result.missing.length?`<div class="cm-missing"><h3>${result.missing.length} listing${result.missing.length===1?'':'s'} awaiting a map pin</h3><p>These stay in your comparison until their location is confirmed.</p>${result.missing.map(x=>`<p>${e(x.o.name)} · <a href="${e(safe(x.o['Exact address / Maps'])||safe(x.o.id))}" target="_blank" rel="noopener noreferrer">Look up location ↗</a></p>`).join('')}</div>`:''}<p class="ch-sync">Pins show condo locations, not individual units or a confirmed entrance.</p></section>`;
    host.querySelector('[data-fit]').onclick=()=>{choose('');fit();};
    if(!groups.length)return;
    renderList();
    if(typeof L==='undefined'){host.querySelector('.cm-map').innerHTML='<p class="ch-empty">The map needs an internet connection. Your listing details are available alongside it.</p>';return;}
    map=L.map('condo-map',{scrollWheelZoom:false,zoomControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([3.14,101.66],12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{if(host)host.querySelector('.cm-tile-error').hidden=false;}).addTo(map);
    function drawPins(){
      markers.forEach(m=>map.removeLayer(m));markers.clear();
      const clusters=[];
      for(const g of groups){
        const p=map.latLngToContainerPoint(g.point);
        const cluster=clusters.find(c=>c.every(x=>Math.abs(x.p.x-p.x)<135&&Math.abs(x.p.y-p.y)<48));
        if(cluster)cluster.push({g,p});else clusters.push([{g,p}]);
      }
      clusters.forEach(cluster=>{
        if(cluster.length>1){
          const members=cluster.map(x=>x.g),point=[0,1].map(i=>members.reduce((sum,g)=>sum+g.point[i],0)/members.length);
          const title=`${members.length} nearby condos: ${members.map(g=>g.name).join(', ')}. Zoom in to separate pins.`;
          const icon=L.divIcon({className:'cm-pin cm-cluster',html:`<span>${members.length} condos</span>`,iconSize:null,iconAnchor:[40,22]});
          const marker=L.marker(point,{icon,title,keyboard:true}).addTo(map).on('click',()=>{const bounds=L.latLngBounds(members.map(g=>g.point));const zoom=Math.min(19,Math.max(map.getZoom()+1,map.getBoundsZoom(bounds,false,L.point(100,100))));map.setView(bounds.getCenter(),zoom,{animate:false});});
          marker.getElement()?.setAttribute('aria-label',title);markers.set('cluster:'+members.map(g=>g.key).join('|'),marker);return;
        }
        const g=cluster[0].g,st=kind(g),count=g.entries.length,title=`${g.name}: ${price(g)}, ${count} listing${count===1?'':'s'}${st==='shortlisted'?', both shortlist':st==='excluded'?', excluded':''}`;
        const icon=L.divIcon({className:`cm-pin ${st}${selected===g.key?' is-selected':''}`,html:`<span>${st==='shortlisted'?'♥ ':''}${e(price(g))}${count>1?`<b>${count}</b>`:''}</span>`,iconSize:null,iconAnchor:[48,22]});
        const marker=L.marker(g.point,{icon,title,keyboard:true}).addTo(map).on('click',()=>choose(g.key));
        marker.getElement()?.setAttribute('aria-label',title);marker.getElement()?.setAttribute('aria-pressed',String(selected===g.key));markers.set(g.key,marker);
      });
    }
    map.on('zoomend',drawPins);
    map.on('resize',fit);
    if(keepView)map.setView(view.center,view.zoom,{animate:false});else fit();
    drawPins();
  }
  return {render,destroy,coordinates,group};
})();
