
'use strict';
(() => {
  const KEY='jft.saved.aircraft.v1';
  const PROXY_KEY='jft.radar.bridge.url.v1';
  const DEFAULT_BRIDGE_URL='https://jacks-radar.joshua-maziarz1.workers.dev';
  const starter=()=>({
    categories:[{id:'sweet-aviation',name:'Sweet Aviation'}],
    planes:[
      {tail:'N233ND',categoryId:'sweet-aviation',note:'Jack’s training airplane'},
      {tail:'N278DC',categoryId:'sweet-aviation',note:'Sweet Aviation DA20-C1'}
    ]
  });
  const byId=id=>document.getElementById(id);
  let memoryOnly=false;
  let library;
  try {
    const json=localStorage.getItem(KEY);
    library=json?JSON.parse(json):starter();
    if(!json)localStorage.setItem(KEY,JSON.stringify(library));
  } catch (_) {library=starter();memoryOnly=true;}
  if(!library || !Array.isArray(library.categories) || !Array.isArray(library.planes))library=starter();
  let selectedCategory='all';
  function persist(){
    try {localStorage.setItem(KEY,JSON.stringify(library));}
    catch (_) {memoryOnly=true;notify('Storage is unavailable; changes may not survive a refresh.');}
  }
  function notify(message){
    byId('libraryStatus').textContent=message;
  }
  const safeTail=value=>String(value||'').trim().toUpperCase().replace(/\s+/g,'');
  function el(tag,cls,text){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function button(label,cls,fn){
    const node=el('button',cls,label);node.type='button';
    node.addEventListener('click',fn);
    return node;
  }
  function selector(current,onChange){
    const drop=el('select');
    drop.setAttribute('aria-label','Saved aircraft category');
    for(const category of library.categories){
      const option=el('option','',category.name);
      option.value=category.id;
      drop.append(option);
    }
    drop.value=current;
    drop.addEventListener('change',()=>onChange(drop.value));
    return drop;
  }
  function render(){
    const tabs=byId('libraryTabs'),planes=byId('libraryPlanes'),catInput=byId('saveCategory');
    tabs.replaceChildren();planes.replaceChildren();catInput.replaceChildren();
    if(!library.categories.some(c=>c.id===selectedCategory))selectedCategory='all';
    const all=[{id:'all',name:'All aircraft'}].concat(library.categories);
    for(const category of all){
      const count=category.id==='all'?library.planes.length:library.planes.filter(p=>p.categoryId===category.id).length;
      const tab=button(category.name+' ('+count+')','lib-tab'+(category.id===selectedCategory?' selected':''),()=>{selectedCategory=category.id;render();});
      tab.setAttribute('aria-pressed',String(category.id===selectedCategory));
      tabs.append(tab);
    }
    for(const category of library.categories){
      const option=el('option','',category.name);option.value=category.id;
      catInput.append(option);
    }
    const preferred=selectedCategory!=='all'?selectedCategory:'sweet-aviation';
    if(library.categories.some(c=>c.id===preferred))catInput.value=preferred;
    const shown=library.planes.filter(p=>selectedCategory==='all'||p.categoryId===selectedCategory).sort((a,b)=>a.tail.localeCompare(b.tail));
    if(!shown.length){
      planes.append(el('p','lib-help','No saved airplanes in this category. Use Save Plane to add one.'));
    }
    for(const plane of shown){
      const card=el('div','lib-plane'),title=el('div','lib-tail',plane.tail);
      const note=el('div','lib-label',plane.note||'Saved aircraft');
      const controls=el('div','lib-controls');
      controls.append(button('Track','lib-primary',()=>{
        input.value=plane.tail;
        begin(plane.tail);
        document.querySelector('.map-wrap').scrollIntoView({behavior:'smooth',block:'center'});
      }));
      controls.append(selector(plane.categoryId,id=>{
        plane.categoryId=id;persist();notify(plane.tail+' moved.');render();
      }));
      controls.append(button('Edit note','',()=>{
        const result=prompt('Note for '+plane.tail,plane.note||'');
        if(result===null)return;
        plane.note=result.trim().slice(0,70);persist();render();
      }));
      controls.append(button('Remove','lib-danger',()=>{
        if(!confirm('Remove '+plane.tail+' from saved aircraft?'))return;
        library.planes=library.planes.filter(p=>p.tail!==plane.tail);
        persist();notify(plane.tail+' removed.');render();
      }));
      card.append(title,note,controls);planes.append(card);
    }
    byId('categoryManager').replaceChildren();
    if(selectedCategory!=='all'){
      const category=library.categories.find(c=>c.id===selectedCategory);
      if(category){
        const label=el('span','lib-help','Category: '+category.name);
        const controls=el('div','lib-manage-buttons');
        controls.append(button('Rename category','',()=>{
          const value=prompt('Rename category',category.name);
          if(value===null)return;
          const name=value.trim().slice(0,36);
          if(!name){notify('Category name cannot be empty.');return;}
          if(library.categories.some(c=>c.id!==category.id&&c.name.toLowerCase()===name.toLowerCase())){notify('That category already exists.');return;}
          category.name=name;persist();render();
        }));
        controls.append(button('Delete category','lib-danger',()=>{
          if(library.planes.some(p=>p.categoryId===category.id)){notify('Move or remove the aircraft in this category before deleting it.');return;}
          if(!confirm('Delete category '+category.name+'?'))return;
          library.categories=library.categories.filter(c=>c.id!==category.id);
          selectedCategory='all';persist();render();
        }));
        byId('categoryManager').append(label,controls);
      }
    }
    const current=safeTail(input.value);
    byId('saveCurrent').textContent=library.planes.some(p=>p.tail===current)?'Update saved plane':'Save plane';
  }
  byId('newCategoryForm').addEventListener('submit',event=>{
    event.preventDefault();
    const field=byId('categoryName');
    const name=field.value.trim().slice(0,36);
    if(!name){notify('Enter a category name.');return;}
    const duplicate=library.categories.find(c=>c.name.toLowerCase()===name.toLowerCase());
    if(duplicate){selectedCategory=duplicate.id;notify('This category already exists.');render();return;}
    const id='cat-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    library.categories.push({id,name});selectedCategory=id;field.value='';
    persist();notify('Created category '+name+'.');render();
  });
  byId('saveCurrent').addEventListener('click',()=>{
    const tail=safeTail(input.value);
    if(!/^[A-Z0-9-]{2,12}$/.test(tail)){notify('Enter a valid tail number first.');return;}
    const cat=byId('saveCategory').value;
    if(!library.categories.some(c=>c.id===cat)){notify('Choose a category.');return;}
    let item=library.planes.find(p=>p.tail===tail);
    if(item){item.categoryId=cat;notify('Updated '+tail+'.');}
    else {library.planes.push({tail,categoryId:cat,note:''});notify('Saved '+tail+'.');}
    selectedCategory=cat;persist();render();
  });
  byId('downloadLibrary').addEventListener('click',()=>{
    const payload=JSON.stringify({app:'jacks-flight-tracker',version:1,exportedAt:new Date().toISOString(),...library},null,2);
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=el('a');link.href=url;link.download='jacks-saved-aircraft.json';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    notify('Exported your saved aircraft backup.');
  });
  byId('importLibrary').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try {
      if(file.size>200000)throw Error('File is too large.');
      const incoming=JSON.parse(await file.text());
      if(!incoming||!Array.isArray(incoming.categories)||!Array.isArray(incoming.planes))throw Error('Not a saved aircraft backup.');
      const categories=incoming.categories.filter(c=>typeof c.id==='string'&&typeof c.name==='string'&&c.id.length<=80&&c.name.trim().length<=36).slice(0,100);
      const ids=new Set(categories.map(c=>c.id));
      const seen=new Set();
      const planes=incoming.planes.filter(p=>{
        if(!p||!(/^[A-Z0-9-]{2,12}$/.test(p.tail))||!ids.has(p.categoryId)||seen.has(p.tail))return false;
        seen.add(p.tail);return true;
      }).map(p=>({tail:p.tail,categoryId:p.categoryId,note:String(p.note||'').slice(0,70)})).slice(0,500);
      if(!categories.length)throw Error('No valid categories in backup.');
      if(!confirm('Replace your saved aircraft with this backup ('+planes.length+' planes)?'))return;
      library={categories,planes};selectedCategory='all';persist();render();notify('Restored '+planes.length+' aircraft.');
    }catch(e){notify('Import failed: '+e.message);}
  });
  const radarInput=byId('radarBridgeUrl');
  try{radarInput.value=localStorage.getItem(PROXY_KEY)||DEFAULT_BRIDGE_URL;}catch(_){radarInput.value=DEFAULT_BRIDGE_URL;}
  byId('saveRadarBridge').addEventListener('click',async()=>{
    const value=radarInput.value.trim().replace(/\/+$/,'');
    if(value&&!/^https:\/\/[a-z0-9][a-z0-9.-]+(?:\:[0-9]+)?$/i.test(value)){
      byId('radarBridgeStatus').textContent='Use the HTTPS workers.dev URL; do not include /api/aircraft.';
      return;
    }
    byId('radarBridgeStatus').textContent='Checking bridge…';
    if(value){
      try{
        const response=await fetch(value+'/health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw Error('HTTP '+response.status);
        const data=await response.json();
        if(data.service!=='jacks-flight-tracker-radar')throw Error('This is not our radar bridge.');
      }catch(error){byId('radarBridgeStatus').textContent='Bridge check failed: '+error.message+'. Check the Worker URL and deployment.';return;}
    }
    try{if(value)localStorage.setItem(PROXY_KEY,value);else localStorage.removeItem(PROXY_KEY);}catch(_){}
    byId('radarBridgeStatus').textContent=value?'Radar bridge connected. Rechecking current airplane…':'Radar bridge disconnected.';
    if(typeof update==='function')update();
  });
  if(memoryOnly)notify('Storage disabled: saved planes may disappear when this browser closes.');
  else notify('Aircraft lists are saved on this device. Export a backup to move them to another device.');
  if(radarInput.value)byId('radarBridgeStatus').textContent='Optional Cloudflare bridge address. The app currently uses direct free data and GitHub delayed snapshots by default.';
  else byId('radarBridgeStatus').textContent='Live tracking needs a one-time free radar bridge setup; saving categories works now.';
  input.addEventListener('input',()=>{byId('saveCurrent').textContent=library.planes.some(p=>p.tail===safeTail(input.value))?'Update saved plane':'Save plane';});
  render();
})();
