// Optional QA dependency: install playwright outside the frozen shipping dependency tree.
// PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE and CHROMIUM_ARGS can select an existing runner.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {spawn} from 'node:child_process';
const server=spawn('node',['node_modules/vite/bin/vite.js',...(process.env.PLAYTEST_BUILD?['preview']:[]),'--host','127.0.0.1','--port','8081'],{stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('Local:'))resolve();});server.on('exit',reject);});
const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:JSON.parse(process.env.CHROMIUM_ARGS||'["--no-sandbox"]'),headless:true});
try{
let page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',r=>r.abort());
await page.goto('http://127.0.0.1:8081',{waitUntil:'networkidle'});
await page.waitForTimeout(1800);
async function state(){return page.evaluate(()=>{
 const root=document.querySelector('.be-root');if(!root)return {missing:true};
 let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))],hooks=[];
 while(f){let h=f.memoizedState;hooks=[];while(h&&typeof h==='object'&&'memoizedState' in h){hooks.push(h.memoizedState);h=h.next;}if(hooks[2]?.current?.world&&hooks[2]?.current?.player)break;f=f.return;}
 const engine=hooks[2].current,controls=hooks[1].current;window.testEngine=engine;
 return {gameTime:engine.gameTime,x:engine.player.x,z:engine.player.z,heading:engine.player.heading,speed:Math.hypot(engine.player.vx,engine.player.vz),paused:engine.paused,controls:{...controls},canvas:[engine.world.renderer.domElement.width,engine.world.renderer.domElement.height],frames:engine.world.renderer.info.render.frame,drawCalls:engine.world.renderer.info.render.calls};
});}
console.log('initial',await state(),errors);
const failures=[];
const check=(ok,name)=>{console.log(ok?'PASS':'BROKEN',name);if(!ok)failures.push(name);};
check(await page.evaluate(()=>{const e=window.testEngine,w=e.world;w.render();const before=w.renderer.info.render.calls;e.mesh.visible=false;w.render();const without=w.renderer.info.render.calls;e.mesh.visible=true;w.render();return before-without>=5;}),'imported player body renders as well as four wheels');
check(await page.locator('.be-scene canvas').evaluate(e=>e.getBoundingClientRect().width===390&&e.getBoundingClientRect().height===844),'canvas fills portrait scene');
await page.screenshot({path:'../baseline-portrait.png'});
const parked=await state();await page.keyboard.press('e');await page.waitForTimeout(650);check(await page.evaluate(()=>window.testEngine.mesh.visible&&window.testEngine.footMesh.visible),'exiting leaves the real car parked in the street');
await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');check(await page.evaluate(()=>window.testEngine.footMesh.position.x<window.testEngine.player.x),'right walking input moves screen-right from the parked car');check(Math.abs((await state()).x-parked.x)<.01,'walking does not drag the parked car along');await page.keyboard.press('e');await page.waitForTimeout(300);
await page.getByRole('button',{name:'GO',exact:true}).hover();await page.mouse.down();await page.waitForTimeout(1500);console.log('touch GO held',await state());await page.mouse.up();
await page.keyboard.down('w');await page.waitForTimeout(1200);console.log('keyboard forward',await state());await page.keyboard.up('w');
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
await page.keyboard.down('w');await page.waitForTimeout(500);console.log('after tab return',await state());await page.keyboard.up('w');
await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'BACK TO STREETS'}).click();console.log('back to streets',await state());
check(!(await state()).paused,'returning from background resumes driving');
await page.evaluate(()=>{window.testEngine.paused=false;});
await page.keyboard.down('w');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check(!(await state()).controls.throttle,'window blur releases held keyboard input');await page.keyboard.up('w');
await page.getByRole('button',{name:'GO',exact:true}).hover();await page.mouse.down();await page.keyboard.press('x');check((await state()).controls.throttle,'unrelated keyboard events preserve held touch input');await page.mouse.up();
// Real Chromium touch events with three simultaneous fingers and captured release.
const cdp=await page.context().newCDPSession(page);
const center=async name=>{const b=await page.getByRole('button',{name,exact:true}).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
const stick=await page.getByRole('group',{name:'Steering stick'}).boundingBox();
const touches=[{id:1,...await center('GO')},{id:2,x:stick.x+stick.width*.75,y:stick.y+stick.height*.5},{id:3,...await center('DRIFT')}];
const headingBefore=(await state()).heading;
for(let n=1;n<=3;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches.slice(0,n)});
await page.waitForTimeout(700);const multi=await state();check(multi.controls.throttle&&multi.controls.steer>.2&&multi.controls.handbrake,'three fingers hold throttle, analog steering and drift together');
check(Math.atan2(Math.sin(multi.heading-headingBefore),Math.cos(multi.heading-headingBefore))<-.03,'right stick turns right with the behind-car camera');
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const released=await state();check(!released.controls.throttle&&!released.controls.steer&&!released.controls.handbrake,'all touch inputs release without sticking');
await page.evaluate(()=>{window.testEngine.dispose();localStorage.clear();});await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(800);console.log('safehouse fresh',await state());
await page.keyboard.down('w');const driveDeadline=Date.now()+12000;while((await state()).z<4.5&&Date.now()<driveDeadline)await page.waitForTimeout(50);await page.keyboard.up('w');
await page.keyboard.down('s');while((await state()).speed>0.6)await page.waitForTimeout(40);await page.keyboard.up('s');
const near=await page.getByRole('button',{name:'SAFEHOUSE',exact:true}).count();check(near===1,'drive and brake beside safehouse using keyboard');
console.log('safehouse stop',await state());
if(near){await page.getByRole('button',{name:'SAFEHOUSE',exact:true}).click();await page.getByRole('button',{name:'Close menu',exact:true}).click();await page.waitForTimeout(1000);const start=await page.evaluate(()=>window.testEngine.houseZ);await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');check(await page.evaluate(start=>window.testEngine.house&&window.testEngine.houseZ!==start,start),'close upgrades and walk inside safehouse');check(await page.evaluate(()=>!!window.testEngine.footMesh.getObjectByName('player-character')),'on-foot player is the locally loaded animated character');await page.screenshot({path:'../safehouse-portrait.png'});await page.getByRole('button',{name:'LEAVE',exact:true}).click();check(await page.evaluate(()=>!window.testEngine.house),'exit safehouse to driving');}
const beforeReverse=await state();await page.keyboard.down('s');await page.waitForTimeout(1100);await page.keyboard.up('s');const afterReverse=await state();console.log('reverse',beforeReverse,afterReverse);check(afterReverse.z<beforeReverse.z,'brake pedal reverses from rest');
const driveClock=(await state()).gameTime;await page.keyboard.down('w');await page.waitForFunction(t=>window.testEngine.gameTime>=t+1.3,driveClock,{timeout:30000});const beforeTurn=await page.evaluate(()=>window.testEngine.player.heading);const turnClock=(await state()).gameTime;await page.keyboard.down('d');await page.waitForFunction(t=>window.testEngine.gameTime>=t+1,turnClock,{timeout:30000});await page.keyboard.up('d');await page.keyboard.up('w');console.log('steering comparison',{beforeTurn,after:await state()});check(await page.evaluate(h=>Math.abs(window.testEngine.player.heading-h)>.1,beforeTurn),'steering turns moving vehicle');
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await page.screenshot({path:'../baseline-landscape.png'});
check(await page.evaluate(()=>{const a=document.querySelector('.be-speed').getBoundingClientRect(),b=document.querySelector('.be-mapwrap').getBoundingClientRect();return a.top>=b.bottom||a.right<=b.left||a.left>=b.right;}),'landscape speed display avoids radar');
await page.evaluate(()=>{document.querySelector('.be-root').style.width='320px';document.querySelector('.be-root').style.height='640px';});await page.waitForTimeout(200);
await page.waitForFunction(()=>window.testEngine.world.renderer.domElement.width===320&&window.testEngine.world.renderer.domElement.height===640,null,{timeout:5000});
check(await page.evaluate(()=>window.testEngine.world.renderer.domElement.width===320&&window.testEngine.world.renderer.domElement.height===640),'renderer follows host resize without window event');
await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{const root=document.querySelector('.be-root');root.style.width='';root.style.height='';});await page.waitForTimeout(250);check(await page.locator('.be-scene canvas').evaluate(e=>e.getBoundingClientRect().width===1280&&e.getBoundingClientRect().height===720),'canvas fills desktop scene');await page.screenshot({path:'../blacktop-desktop.png'});
check(errors.length===0,'no browser runtime errors');console.log('errors',errors);if(failures.length)throw new Error(failures.join('; '));
}finally{await browser.close();server.kill();}
