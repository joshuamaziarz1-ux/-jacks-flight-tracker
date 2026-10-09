import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const markup=readFileSync('index.html','utf8');
const inline=markup.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline,'inline tracking script');
const dom=new JSDOM(markup,{url:'https://joshuamaziarz1-ux.github.io/-jacks-flight-tracker/',runScripts:'outside-only'});
const w=dom.window; w.HTMLElement.prototype.scrollIntoView=()=>{};
let requests=0;
const ac=[
 {r:'N9123A',hex:'a34567',lat:41.146,lon:-85.15,gs:83,alt_baro:2500,track:90,seen_pos:3,t:'C172'},
 {r:'N278DC',hex:'a2c482',lat:41.306,lon:-85.061,gs:65,alt_baro:1000,track:100,seen_pos:4,t:'DV20'},
 {r:'N99999',hex:'aaaaaa',lat:42.05,lon:-85.2,gs:100,alt_baro:3200,track:60,seen_pos:2,t:'C172'}
];
w.fetch=async(url)=>{requests++;if(String(url).includes('avioadsb.org'))return {ok:true,json:async()=>({ac})};throw Error('Unexpected '+url)};
w.setInterval=()=>99;w.clearInterval=()=>{};
const map={setView(){return this},whenReady(fn){fn()},invalidateSize(){},removeLayer(){},panTo(){},changeStyle(){}};
const layer=()=>({addTo(){return this},on(){return this},redraw(){},setUrl(){},bindPopup(){return this},setLatLng(){return this},setIcon(){return this},setLatLngs(){return this}});
w.L={map:()=>map,tileLayer:layer,marker:layer,polyline:layer,divIcon:o=>o};
w.eval(inline+'\n'+readFileSync('saved-aircraft.js','utf8'));
const byId=x=>w.document.getElementById(x);
assert.equal(requests,0,'no automatic requests on app startup');
assert.equal(byId('radarRadius').value,'100','100 nautical miles is the default widest free radius');
assert.ok(byId('nearbyHint').textContent.includes('100 nautical miles'),'wide search explained from the beginning');
const smith=w.document.querySelector('[data-airport="SMD"]');
assert.ok(smith,'Smith Field selection exists');
smith.click();
assert.equal(smith.getAttribute('aria-pressed'),'true');
assert.equal(requests,0,'choosing airport does not trigger a flight check');
assert.ok(byId('outsideRadar').href.includes('41.1433611'),'external live radar centers on Smith Field');
byId('testBtn').click();
await new Promise(resolve=>setTimeout(resolve,140));
const rows=byId('nearbyResults').querySelectorAll('.nearby-row');
assert.equal(rows.length,3,'default 100nm search includes aircraft outside the original 25nm circle');
assert.ok(rows[0].textContent.includes('N9123A'),'closest aircraft listed first');
assert.ok(rows[0].textContent.includes('KSMD'));
rows[0].querySelector('button').click();
assert.equal(byId('tailDisplay').textContent,'N9123A');
assert.ok(byId('statusText').textContent.includes('RECENT PUBLIC RADAR'));
assert.equal(byId('autoRefreshToggle').checked,false);
assert.equal(requests,1,'selecting a reported aircraft does not trigger a duplicate API call');
byId('stopTrackingBtn').click();
byId('radarRadius').value='50';
byId('radarRadius').dispatchEvent(new w.Event('change',{bubbles:true}));
assert.equal(requests,1,'changing radius does not make an API call');
assert.equal(byId('nearbyResults').children.length,0,'changing radius clears old results');
// Advance the free provider's last-request timestamp in the test only. The
// production app still enforces its 11-second minimum interval.
w.eval('lastAvioCall = Date.now() - 11000');
byId('testBtn').click();
await new Promise(resolve=>setTimeout(resolve,140));
assert.equal(byId('nearbyResults').querySelectorAll('.nearby-row').length,2,'50nm radius excludes more distant airplane');
w.document.querySelector('[data-airport="GWB"]').click();
assert.ok(byId('nearbyHint').textContent.includes('DeKalb County Airport'));
assert.equal(byId('nearbyResults').children.length,0,'new airport clears old results');
assert.equal(requests,2,'airport and radius switches remain entirely manual; only explicit searches use the API');
console.log('PASS KGWB / KSMD browser list, real positions, nearest sorting, manual track, no auto polling');
