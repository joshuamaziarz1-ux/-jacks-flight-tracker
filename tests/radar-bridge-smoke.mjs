import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('radar-bridge/worker.js','utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(script).toString('base64'));
let requests=[];
const now=1791555872;
const state=['a2c482','N278DC','United States',now-2,now-1,-85.02,41.19,838.2,false,28,148,0,null,840,null,false,0];
globalThis.caches={default:{async match(){return null},async put(){}}};
globalThis.fetch=async(url)=>{
 requests.push(url);
 if(url.includes('/v0/aircraft/')) {
   return new Response(JSON.stringify({response:{aircraft:{mode_s:'A214D5',registration:'N233ND'}}}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 if(url.includes('opensky-network.org')) {
   return new Response(JSON.stringify({time:now,states:[state]}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 throw new Error('Unexpected upstream '+url);
};
const ctx={waitUntil(){}};
async function check(path,origin='https://joshuamaziarz1-ux.github.io'){
 const headers=origin?{Origin:origin}:{};
 const req=new Request('https://jacks-radar.example.workers.dev'+path,{headers});
 const res=await worker.fetch(req,{},ctx);
 return {res,json:await res.json()};
}
const health=await check('/health');
assert.equal(health.res.status,200);
assert.equal(health.json.service,'jacks-flight-tracker-radar');
assert.equal(health.res.headers.get('access-control-allow-origin'),'https://joshuamaziarz1-ux.github.io');
const airplane=await check('/api/aircraft/N278DC');
assert.equal(airplane.res.status,200);
assert.equal(airplane.json.ac[0].r,'N278DC');
assert.equal(airplane.json.ac[0].hex,'a2c482');
assert.equal(airplane.json.ac[0].alt_baro,2750);
assert.equal(airplane.json.ac[0].seen_pos,2);
const nearby=await check('/api/nearby');
assert.equal(nearby.json.ac.length,1);
assert.equal(nearby.json.ac[0].r,'N278DC');
const diagnostic=await check('/diagnostics');
assert.equal(diagnostic.res.status,200);
assert.equal(diagnostic.json.checks.length,3);
assert.equal(diagnostic.json.checks[0].status,200);
const unknownReg=await check('/api/aircraft/N233ND');
assert.equal(unknownReg.res.status,200);
assert.equal(unknownReg.json.ac[0].r,'N233ND');
const bad=await check('/api/aircraft/!');
assert.equal(bad.res.status,404);
const stranger=await check('/api/aircraft/N278DC','https://evil.example');
assert.equal(stranger.res.status,403);
assert.equal(requests.length,6);
console.log('PASS: OpenSky conversion, native known tails, nearby, registry diagnostic, CORS and health');
