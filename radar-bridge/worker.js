// Jack's Flight Tracker — free personal radar bridge.
// Data source: OpenSky's documented anonymous, rate-limited API.
// The two original ADS-B feeds currently return HTTP 403 when called
// from Cloudflare, so live queries no longer retry those blocked services.
// No credentials, API keys, or payment are needed for anonymous OpenSky access.
//
// OpenSky anonymous limit: 400 credits/day per public egress IP. A small
// aircraft / area query consumes one credit. Do not monitor unattended.
// Attribution: https://opensky-network.org/

const SITE_ORIGIN = 'https://joshuamaziarz1-ux.github.io';
const OPENSKY = 'https://opensky-network.org/api/states/all';
const AIRCRAFT_DB = 'https://api.adsbdb.com/v0/aircraft/';
const KNOWN_HEX = { N233ND:'a214d5', N278DC:'a2c482' };
const KNOWN_TAIL = { a214d5:'N233ND', a2c482:'N278DC' };
const NEARBY = OPENSKY + '?lamin=40.7&lomin=-85.85&lamax=41.85&lomax=-84.45';
const HEALTH = {service:'jacks-flight-tracker-radar',status:'ready',cost:'free',keyRequired:false,feed:'OpenSky anonymous (limited)'};

function cors(req) {
  return req.headers.get('Origin') === SITE_ORIGIN
    ? {'Access-Control-Allow-Origin':SITE_ORIGIN,
       'Access-Control-Allow-Methods':'GET, OPTIONS',
       'Access-Control-Allow-Headers':'Content-Type',
       'Vary':'Origin'}
    : {};
}
function response(req,obj,status=200,ttl=30) {
  return new Response(JSON.stringify(obj), {status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff',
    'Cache-Control':'public, max-age='+ttl,
    ...cors(req)
  }});
}
function permitted(req) {
  const origin=req.headers.get('Origin');
  return !origin || origin === SITE_ORIGIN;
}
async function upstream(url,timeout=9000) {
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeout);
  try {
    // Plain fetch, no special Cloudflare cache or fingerprint headers.
    const res=await fetch(url,{headers:{Accept:'application/json'},signal:abort.signal});
    const type=res.headers.get('content-type')||'';
    if(!res.ok)throw new Error('HTTP '+res.status+(res.status===429?' (quota exhausted)':''));
    if(!type.toLowerCase().includes('json'))throw new Error('Feed returned non-JSON data');
    return await res.json();
  } finally {clearTimeout(timer);}
}
function value(x){return typeof x==='number' && Number.isFinite(x)?x:null;}
function convert(state,now,requestedReg) {
  if(!Array.isArray(state) || state.length<17)return null;
  const lat=value(state[6]),lon=value(state[5]);
  if(lat===null||lon===null)return null;
  const hex=String(state[0]||'').toLowerCase();
  const callsign=String(state[1]||'').trim().toUpperCase();
  const reg=KNOWN_TAIL[hex] ||
    (/^N[0-9A-Z]{2,7}$/.test(callsign)?callsign:(requestedReg||hex.toUpperCase()));
  const timePosition=value(state[3])||value(state[4])||0;
  const altitude=value(state[7]) ?? value(state[13]);
  const ground=state[8]===true;
  const mps=value(state[9]);
  return {
    hex, r:reg, flight:callsign, t:'OpenSky aircraft',
    lat, lon,
    alt_baro:ground?'ground':altitude===null?null:Math.round(altitude*3.280839895),
    gs:mps===null?null:Math.round(mps*1.94384449*10)/10,
    track:value(state[10]),
    seen_pos:Math.max(0,now-timePosition)
  };
}
async function lookupHex(tail) {
  if(/^[A-F0-9]{6}$/.test(tail))return tail.toLowerCase();
  if(KNOWN_HEX[tail])return KNOWN_HEX[tail];
  const json=await upstream(AIRCRAFT_DB+encodeURIComponent(tail));
  const record=json?.response?.aircraft;
  const hex=String(record?.mode_s||'').toLowerCase();
  if(!/^[a-f0-9]{6}$/.test(hex))return null;
  if(String(record?.registration||'').toUpperCase()!==tail)return null;
  return hex;
}
async function findAircraft(tail) {
  let hex;
  try {hex=await lookupHex(tail);} catch(err) {
    throw new Error('Aircraft registration database error: '+err.message);
  }
  if(!hex)return {ac:[],source:'OpenSky',now:Date.now(),message:'Tail number not found in public registry'};
  const data=await upstream(OPENSKY+'?icao24='+hex);
  if(!Array.isArray(data?.states)) {
    if(data?.states===null)return {ac:[],source:'OpenSky',now:data?.time?data.time*1000:Date.now()};
    throw new Error('OpenSky did not return state vectors');
  }
  const now=value(data.time) || Date.now()/1000;
  const matches=data.states.map(s=>convert(s,now,tail)).filter(Boolean);
  return {ac:matches,source:'OpenSky',now:now*1000,total:matches.length};
}
async function findNearby() {
  const data=await upstream(NEARBY);
  if(!Array.isArray(data?.states) && data?.states!==null)
    throw new Error('OpenSky did not return state vectors');
  const now=value(data.time) || Date.now()/1000;
  const ac=(data.states||[]).map(s=>convert(s,now,null))
    .filter(p=>p&&p.seen_pos<120)
    .slice(0,160);
  return {ac,source:'OpenSky',now:now*1000,total:ac.length};
}
async function diagnostics() {
  const feeds=[
    ['OpenSky N278DC',OPENSKY+'?icao24=a2c482'],
    ['OpenSky Fort Wayne',NEARBY],
    ['ADSBdb registration',AIRCRAFT_DB+'N233ND']
  ];
  const checks=[];
  for(const [name,url] of feeds){
    try {
      const json=await upstream(url,7500);
      checks.push({source:name,status:200,
        aircraftStates:Array.isArray(json?.states)?json.states.length:undefined,
        registration:json?.response?.aircraft?.registration||undefined,
        available:true});
    }catch(err){
      checks.push({source:name,available:false,error:String(err?.message||err).slice(0,140)});
    }
  }
  return checks;
}
export default {
  async fetch(req,env,ctx) {
    const url=new URL(req.url);
    if(req.method==='OPTIONS'){
      if(!permitted(req))return response(req,{error:'Origin not allowed'},403);
      return new Response(null,{status:204,headers:cors(req)});
    }
    if(req.method!=='GET')return response(req,{error:'Only GET supported'},405);
    if(!permitted(req))return response(req,{error:'Origin not allowed'},403);
    if(url.pathname==='/health')return response(req,HEALTH,200,60);
    if(url.pathname==='/diagnostics')
      return response(req,{service:'jacks-flight-tracker-radar',checks:await diagnostics()},200,0);

    const tail=/^\/api\/aircraft\/([A-Za-z0-9-]{2,12})$/.exec(url.pathname);
    if(!tail&&url.pathname!=='/api/nearby')return response(req,{error:'Unknown route'},404);

    const cache=caches.default;
    const key=new Request(url.origin+url.pathname,{method:'GET'});
    const cached=await cache.match(key);
    if(cached){
      const headers=new Headers(cached.headers);
      Object.entries(cors(req)).forEach(([k,v])=>headers.set(k,v));
      return new Response(cached.body,{status:cached.status,headers});
    }
    try {
      const data=tail?await findAircraft(tail[1].toUpperCase()):await findNearby();
      ctx.waitUntil(cache.put(key,response(req,data,200,30)));
      return response(req,data,200,30);
    }catch(err) {
      return response(req,{
        ac:[],source:'OpenSky',
        error:'Free OpenSky data temporarily unavailable: '+String(err?.message||err)
      },503,0);
    }
  }
};
