// Optional real-browser integration QA; uses the same runner environment as playtest-blacktop.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','8092'],{stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('Local:'))resolve();});server.on('exit',reject);});
const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:JSON.parse(process.env.CHROMIUM_ARGS||'["--no-sandbox"]'),headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{window.qaFrames=[];window.qaLongTasks=[];const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const gl=get.apply(this,args);if(gl&&args[0]==='webgl2'&&!gl.qaTracked){gl.qaTracked=true;window.qaGpu={created:0,deleted:0};const create=gl.createBuffer.bind(gl),remove=gl.deleteBuffer.bind(gl);gl.createBuffer=()=>{window.qaGpu.created++;return create();};gl.deleteBuffer=b=>{if(b)window.qaGpu.deleted++;return remove(b);};}return gl;};let last=0;function sample(t){if(last)window.qaFrames.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);new PerformanceObserver(list=>window.qaLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
 await page.goto('http://127.0.0.1:8092',{waitUntil:'networkidle'});await page.waitForTimeout(2000);
 await page.evaluate(()=>{let f=document.querySelector('.be-root')[Object.keys(document.querySelector('.be-root')).find(k=>k.startsWith('__reactFiber'))];while(f){let h=f.memoizedState,a=[];while(h&&typeof h==='object'&&'memoizedState' in h){a.push(h.memoizedState);h=h.next;}if(a[2]?.current?.world){window.qaEngine=a[2].current;break;}f=f.return;}});
 const snapshot=()=>page.evaluate(()=>{const e=window.qaEngine;return {x:e.player.x,z:e.player.z,heading:e.player.heading,speed:Math.hypot(e.player.vx,e.player.vz),hp:e.player.hp,zoom:e.world.camera.zoom,cash:e.save.money,cargo:{...e.save.cargo},clock:e.world.clockLabel,calls:e.world.renderer.info.render.calls,geometries:e.world.renderer.info.memory.geometries,textures:e.world.renderer.info.memory.textures,chunks:e.world.map.size};});
 const samples=[await snapshot()];console.log('START',samples[0]);
 const initialZoom=samples[0].zoom;
 const buffers=await page.evaluate(()=>{const e=window.qaEngine,w=e.world;e.setMenuOpen(true);const live=()=>window.qaGpu.created-window.qaGpu.deleted;const before=live(),rounds=[];for(let n=0;n<3;n++){for(const [x,z] of [[512,0],[0,512],[512,512],[0,0]]){w.stream(x,z);w.follow(x,z,0,0,.05);w.render();}rounds.push(live());}e.setMenuOpen(false);return {before,rounds,...window.qaGpu};});console.log('GPU STREAM BUFFERS',buffers);assert.ok(buffers.rounds[2]<=buffers.rounds[1]+10,'repeated streaming releases retired instance buffers');
 await page.keyboard.down('w');const end=Date.now()+15000;
 while(Date.now()<end){const s=await snapshot();samples.push(s);if(s.z>19)break;await page.waitForTimeout(100);}
 await page.keyboard.up('w');await page.keyboard.down('s');const brakeEnd=Date.now()+5000;
 while((await snapshot()).speed>.4&&Date.now()<brakeEnd)await page.waitForTimeout(35);
 await page.keyboard.up('s');await page.waitForTimeout(250);console.log('PORT STOP',await snapshot());
 assert.ok(samples.some(s=>s.zoom<initialZoom-.04),'camera opens as actual driving speed increases');
 assert.ok(await page.getByRole('button',{name:'TRADE',exact:true}).count(),'reach real Port market by driving');
 await page.getByRole('button',{name:'TRADE',exact:true}).click();const before=await snapshot();await page.getByRole('button',{name:'BUY',exact:true}).click();await page.waitForTimeout(200);const bought=await snapshot();assert.equal(bought.cargo.Ember,before.cargo.Ember+1);assert.ok(bought.cash<before.cash);await page.getByRole('button',{name:'Close menu',exact:true}).click();
 await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1200);await page.evaluate(()=>{let f=document.querySelector('.be-root')[Object.keys(document.querySelector('.be-root')).find(k=>k.startsWith('__reactFiber'))];while(f){let h=f.memoizedState,a=[];while(h&&typeof h==='object'&&'memoizedState' in h){a.push(h.memoizedState);h=h.next;}if(a[2]?.current?.world){window.qaEngine=a[2].current;break;}f=f.return;}});assert.equal((await snapshot()).cargo.Ember,bought.cargo.Ember);assert.equal((await snapshot()).cash,bought.cash);console.log('PASS real market purchase and saved reload');
 await page.keyboard.down('w');await page.keyboard.down('d');const turnEnd=Date.now()+20000;
 while((await snapshot()).heading> -1.2&&Date.now()<turnEnd)await page.waitForTimeout(100);
 await page.keyboard.up('d');const hitEnd=Date.now()+20000;let damage=await snapshot();
 while(damage.hp===100&&Date.now()<hitEnd){await page.waitForTimeout(100);damage=await snapshot();}
 await page.keyboard.up('w');console.log('COLLISION',damage);
 assert.ok(damage.hp<100,'physically drive into city obstacles and lose structural health');
 const changed=await page.evaluate(()=>{let changed=0;window.qaEngine.mesh.getObjectByName('loaded-body')?.traverse(o=>{const base=o.userData.damagePositions,pos=o.geometry?.getAttribute('position');if(base&&pos)for(let i=0;i<pos.array.length;i++)if(Math.abs(pos.array[i]-base[i])>.001)changed++;});return changed;});assert.ok(changed>0,'collision visibly deforms imported car geometry');await page.screenshot({path:'../overhaul-damage.png'});console.log('PASS visible damage vertices',changed);
 await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'FREE ROAM',exact:true}).click();
 const cruiseStart=Date.now(),duration=Number(process.env.CITY_TEST_SECONDS||120)*1000;
 const held=new Set();async function keys(next){for(const k of held)if(!next.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of next)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}}
 while(Date.now()-cruiseStart<duration){const elapsed=(Date.now()-cruiseStart)/1000;const phase=Math.floor(elapsed/6)%4;await keys(phase===0?['w']:phase===1?['w','d']:phase===2?['s']:['w','a',' ']);samples.push(await snapshot());await page.waitForTimeout(500);}
 await keys([]);await page.screenshot({path:'../overhaul-night.png'});console.log('END',await snapshot());
 const observations=await page.evaluate(()=>({frames:window.qaFrames,longTasks:window.qaLongTasks,heap:performance.memory?.usedJSHeapSize,loadedModels:[...window.qaEngine.world.buildingAssets.keys()],night:window.qaEngine.world.night}));
 assert.ok(observations.night>.5,'day/night advances through dusk during actual play');assert.equal(errors.length,0,errors.join('; '));
 const times=observations.frames.slice(90).sort((a,b)=>a-b),pct=p=>times[Math.min(times.length-1,Math.floor(times.length*p))];
 const report={durationSeconds:(Date.now()-cruiseStart)/1000,samples,frameMs:{p50:pct(.5),p95:pct(.95),p99:pct(.99)},longTasks:observations.longTasks,heap:observations.heap,loadedModels:observations.loadedModels,night:observations.night,errors,softwareWebGL:true};await fs.writeFile('../overhaul-city-report.json',JSON.stringify(report,null,2));console.log('PASS city integration',JSON.stringify({frameMs:report.frameMs,samples:samples.length,maxCalls:Math.max(...samples.map(s=>s.calls)),maxGeometries:Math.max(...samples.map(s=>s.geometries)),chunks:[...new Set(samples.map(s=>s.chunks))],errors}));
}finally{await browser.close();server.kill();}
