// Jack's Flight Tracker — free aircraft data bridge for GitHub Pages.
// No API key, login, accounts, paid services, or credential storage.
// This service is intended for personal, non-commercial tracking.
// adsb.fi limits public API calls to 1 request/second; we cache results.
// Permit our own website and a plain /health diagnostic.
const SITE_ORIGIN='https://joshuamaziarz1-ux.github.io';
const PROVIDERS=[
  {name:'adsb.fi',base:'https://opendata.adsb.fi/api'},
  {name:'adsb.lol',base:'https://api.adsb.lol'}
];
const basicHeaders={
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':'public, max-age=15'
};
function cors(request){
  const origin=request.headers.get('Origin');
  return origin===SITE_ORIGIN?{
    'Access-Control-Allow-Origin': SITE_ORIGIN,
    'Access-Control-Allow-Methods':'GET, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Vary':'Origin'
  }:{};
}
function response(request,body,status=200){
  return new Response(JSON.stringify(body),{
    status,headers:{...basicHeaders,...cors(request)}
  });
}
function isFromOurWebsite(request){
  const origin=request.headers.get('Origin');
  return !origin || origin===SITE_ORIGIN;
}
async function readUpstream(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const res=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'JacksFlightTrackerPersonalUse/1.0'},signal:controller.signal,cf:{cacheTtl:15,cacheEverything:true}});
    if(!res.ok)throw Error('upstream HTTP '+res.status);
    const data=await res.json();
    if(!data||!Array.isArray(data.ac))throw Error('Unexpected upstream data');
    return data;
  }finally{clearTimeout(timer)}
}
async function aircraftLookup(tail){
  let received=false;
  for(const source of PROVIDERS){
    const path=source.name==='adsb.fi'?'/v2/registration/':'/v2/reg/';
    try{
      const data=await readUpstream(source.base+path+encodeURIComponent(tail));
      received=true;
      const matches=data.ac.filter(ac=>String(ac.r||'').toUpperCase().replace(/[^A-Z0-9]/g,'')===tail.replace(/[^A-Z0-9]/g,''));
      if(matches.length)return {ac:matches.slice(0,3),source:source.name,now:data.now||Date.now(),total:matches.length};
    }catch(_){continue}
  }
  if(received)return {ac:[],source:'public data',now:Date.now(),total:0};
  throw Error('All free aircraft data providers unavailable');
}
async function nearby(){
  let received=false;
  for(const source of PROVIDERS){
    const path=source.name==='adsb.fi'?'/v3/lat/41.13/lon/-85.14/dist/125':'/v2/point/41.13/-85.14/125';
    try{
      const data=await readUpstream(source.base+path);
      received=true;
      if(data.ac.length)return {ac:data.ac.filter(p=>p.r&&p.lat!=null&&p.lon!=null).slice(0,400),source:source.name,now:data.now||Date.now(),total:data.ac.length};
    }catch(_){continue}
  }
  if(received)return {ac:[],source:'public data',now:Date.now(),total:0};
  throw Error('Free aircraft providers temporarily unavailable');
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='OPTIONS'){
      if(!isFromOurWebsite(request))return response(request,{error:'Origin not allowed'},403);
      return new Response(null,{status:204,headers:cors(request)});
    }
    if(request.method!=='GET')return response(request,{error:'Only GET requests supported'},405);
    if(!isFromOurWebsite(request))return response(request,{error:'Origin not allowed'},403);
    if(url.pathname==='/health')return response(request,{service:'jacks-flight-tracker-radar',status:'ready',cost:'free',keyRequired:false});
    const tailMatch=/^\/api\/aircraft\/([A-Za-z0-9-]{2,12})$/.exec(url.pathname);
    if(!tailMatch&&url.pathname!=='/api/nearby')return response(request,{error:'Route not found'},404);
    const cache=caches.default;
    const cacheKey=new Request(url.origin+url.pathname,{method:'GET'});
    const found=await cache.match(cacheKey);
    if(found){
      // Return the cached aircraft data with origin-specific CORS headers.
      const copy=new Response(found.body,found);
      const headers=new Headers(copy.headers);
      Object.entries(cors(request)).forEach(([key,val])=>headers.set(key,val));
      return new Response(copy.body,{status:copy.status,headers});
    }
    try{
      const data=tailMatch?await aircraftLookup(tailMatch[1].toUpperCase()):await nearby();
      const output=response(request,data);
      ctx.waitUntil(cache.put(cacheKey,new Response(JSON.stringify(data),{headers:basicHeaders})));
      return output;
    }catch(_){
      return response(request,{error:'Free radar feeds unavailable. Try again shortly.',ac:[]},503);
    }
  }
};
