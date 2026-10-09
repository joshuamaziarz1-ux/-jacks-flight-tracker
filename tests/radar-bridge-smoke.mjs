import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync('radar-bridge/worker.js','utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(script).toString('base64'));
let providerRequests=[];
globalThis.caches={default:{async match(){return null;},async put(){}}};
globalThis.fetch=async(url)=>{
 providerRequests.push(url);
 if(url.includes('/registration/N278DC')){
  return new Response(JSON.stringify({now:1791555872002,ac:[{r:'N278DC',hex:'a2c482',lat:41.19,lon:-85.02,alt_baro:2750,seen_pos:0.1}]}),{status:200});
 }
 return new Response(JSON.stringify({now:1791555872002,ac:[{r:'N278DC',hex:'a2c482',lat:41.19,lon:-85.02,alt_baro:2750,seen_pos:0.1}]}),{status:200});
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
const diagnostic=await check('/diagnostics');
assert.equal(diagnostic.res.status,200);
assert.equal(diagnostic.json.checks.length,2);
assert.equal(diagnostic.json.checks[0].status,200);
assert.equal(diagnostic.json.checks[0].format,'aircraft-json');
const nearby=await check('/api/nearby');
assert.equal(nearby.json.ac.length,1);
assert.equal(providerRequests.length,4);
const bad=await check('/api/aircraft/!');
assert.equal(bad.res.status,404);
const stranger=await check('/api/aircraft/N278DC','https://evil.example');
assert.equal(stranger.res.status,403);
console.log('PASS: free radar bridge health, lookup, nearby, wrong route, cross-origin protection');
