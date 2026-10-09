import assert from 'node:assert/strict';
import {webkit} from 'playwright';
const browser=await webkit.launch({headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 page.on('pageerror',err=>errors.push('PAGE ERROR '+err.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text().slice(0,240))});
 await page.goto('http://127.0.0.1:9123/index.html',{waitUntil:'domcontentloaded',timeout:40000});
 console.log('Page loaded; waiting for vector map tiles');
 const diagnostic=await page.evaluate(()=>({
  lib:typeof window.maplibregl,
  shim:typeof window.L,
  supported:typeof window.maplibregl==='object'?window.maplibregl.supported():null,
  scriptUrls:[...document.querySelectorAll('script[src]')].map(s=>s.src),
  mapHTML:document.getElementById('map')?.innerHTML.slice(0,300),
  title:document.title
 }));
 console.log('BEFORE WAIT DIAGNOSTIC',JSON.stringify(diagnostic),'browser errors',errors.slice(0,8).join(' | '));
 try {
   await page.waitForFunction(()=>{
     try{return typeof map!=='undefined'&&map.view&&map.view.isStyleLoaded()}catch(_){return false}
   },null,{timeout:25000});
 }catch(error){
   const finalDiagnostics=await page.evaluate(()=>({
     mapDefined:typeof map!=='undefined', mapCanvas:document.querySelectorAll('#map canvas').length,
     body:document.getElementById('map')?.textContent.slice(0,300),
     status:document.getElementById('statusText')?.textContent
   }));
   console.log('AFTER WAIT',JSON.stringify(finalDiagnostics),'browser errors',errors.join(' | '));
   throw error;
 }
 const snapshot=await page.evaluate(()=>({
  canvas:document.querySelectorAll('#map canvas').length,
  height:document.querySelector('#map').getBoundingClientRect().height,
  width:document.querySelector('#map').getBoundingClientRect().width,
  activeTail:typeof activeTail==='string'?activeTail:'unknown',
  status:document.querySelector('#statusText').textContent,
  style:map.view.getStyle()?.name,
  mapText:document.querySelector('#map').textContent?.slice(0,120)
 }));
 console.log('iPhone WebKit vector-map snapshot',JSON.stringify(snapshot));
 assert.ok(snapshot.canvas>=1,'MapLibre must render a canvas');
 assert.ok(snapshot.height>=300,'Map must occupy visible space');
 assert.ok(snapshot.width>=250,'Map must fill mobile width');
 assert.equal(snapshot.activeTail,'','page must NOT check saved aircraft on load');
 await page.screenshot({path:'webkit-tracker-dark.png',fullPage:false});
 await page.click('#mapStyleBtn');
 await page.waitForFunction(()=>map.view.isStyleLoaded(),null,{timeout:35000});
 console.log('Streets map style loaded');
 await page.evaluate(()=>startDemoFlight());
 const status=await page.locator('#statusText').innerText();
 console.log('Demo mode:',status);
 assert.ok(status.includes('DEMO MODE')&&status.includes('NOT A REAL AIRCRAFT'));
 await page.screenshot({path:'webkit-tracker-demo.png',fullPage:false});
 await page.click('#stopTrackingBtn');
 assert.ok((await page.locator('#statusText').innerText()).includes('Ready.'));
 if(errors.length)console.log('Browser console observations',errors.slice(0,10).join(' || '));
 console.log('PASS iPhone-sized WebKit: vector map, both styles, idle startup and test flight.');
}finally {
 await browser.close();
}
