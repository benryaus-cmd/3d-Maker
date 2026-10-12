import {useEffect,useRef,useState,type PointerEvent as RP} from 'react';
import * as THREE from 'three';
import {CrimeWorld,createCarVisual,renderCar,showCarDamage,type CarStyle} from './World';
import {BASE_TUNE,axes,drive,newCar,collideWall,collideCars,kmh,speed,tuneWithMods,type CarState,type CarTune,type DriverInput} from './vehiclePhysics';
import {readSave,saveGame,initial,MARKETS,GOODS,MISSIONS,quote,trade,missionUpdate,missionMarker,buyUpgrade,buyCar,cargoCount,cargoCap,type GameSave,type Commodity,type Mods} from './Systems';
import './crime.css';

const CAR_TUNES:Record<CarStyle,Partial<CarTune>>={
 sedan:{power:6900,topSpeed:40,grip:.99,mass:1380},
 'sedan-sports':{power:12700,topSpeed:59,grip:1.22,mass:1180},
 police:{power:11000,topSpeed:52,grip:1.16,mass:1480,durability:150},
 taxi:{power:6600,topSpeed:38,mass:1430},
 suv:{power:9100,topSpeed:43,mass:2030,durability:160,grip:.9},
 race:{power:16000,topSpeed:68,grip:1.34,mass:1030,durability:85}
};
type Actor={car:CarState;mesh:THREE.Group;type:'police'|'traffic';style:CarStyle;routeX:number;routeZ:number;repath:number;alert:number;stuck:number;lastX:number;lastZ:number};
type Ped={mesh:THREE.Group;x:number;z:number;vx:number;vz:number;panic:number;down:number;alive:boolean;bleed:THREE.Mesh|null};
type Radar={player:[number,number];cops:[number,number][];traffic:[number,number][];people:[number,number][];target:[number,number]|null};
type UI={speed:number;hp:number;heat:number;cash:number;nitro:number;mission:string;objective:string;message:string;area:string;near:string|null;mode:'campaign'|'freeroam';house:boolean;notice:string;radar:Radar;cargo:number};
const initialUi:UI={speed:0,hp:100,heat:0,cash:1200,nitro:100,mission:'LAST $200',objective:'DRIVE TO SAFEHOUSE',message:'',area:'DOCKSIDE',near:null,mode:'campaign',house:false,notice:'',radar:{player:[0,0],cops:[],traffic:[],people:[],target:null},cargo:0};
type Controls={throttle:boolean;brake:boolean;left:boolean;right:boolean;handbrake:boolean;nitro:boolean;moveX:number;moveZ:number};
const clearInputs=(c:Controls)=>{c.throttle=false;c.brake=false;c.left=false;c.right=false;c.handbrake=false;c.nitro=false;c.moveX=0;c.moveZ=0;};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const colours=[0xdf8759,0x75b0c5,0xead5b0,0x7a9384,0xbb6573,0xc2c7c3];
const cell=(x:number)=>Math.round(x/32)*32;
function engineTune(style:CarStyle,mods:Mods){return tuneWithMods({...BASE_TUNE,...CAR_TUNES[style]},mods);}
function npcVisual(){const group=new THREE.Group(),shirt=new THREE.MeshStandardMaterial({color:colours[Math.floor(Math.random()*colours.length)]}),skin=new THREE.MeshStandardMaterial({color:0xc99578}),pants=new THREE.MeshStandardMaterial({color:0x343942});
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.32,.37,.85,7),shirt);torso.position.y=1.15;group.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.25,8,7),skin);head.position.y=1.87;group.add(head);
 for(const s of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.62,.24),pants);leg.position.set(s*.16,.36,0);group.add(leg);}
 return group;
}
class Sound{
 ctx:AudioContext|null=null;engine:OscillatorNode|null=null;engineGain:GainNode|null=null;engineFilter:BiquadFilterNode|null=null;siren:OscillatorNode|null=null;sirenGain:GainNode|null=null;
 private engineSample:HTMLAudioElement|null=null;private skidSample:HTMLAudioElement|null=null;
 private impactSamples:HTMLAudioElement[]=[];private activeImpacts=new Set<HTMLAudioElement>();
 muted=false;lastHit=0;
 private makeLoop(file:string):HTMLAudioElement{
  const a=new Audio(import.meta.env.BASE_URL+'assets/crime/audio/'+file);a.loop=true;a.preload='auto';a.volume=0;return a;
 }
 start(){
  if(this.ctx){void this.ctx.resume();this.resumeSamples();return;}
  try{
   const a=this.ctx=new AudioContext();
   // Low-volume procedural blend backs up real samples and reacts to RPM.
   const eng=this.engine=a.createOscillator();eng.type='sawtooth';eng.frequency.value=70;
   const filter=this.engineFilter=a.createBiquadFilter();filter.type='lowpass';filter.frequency.value=360;
   const volume=this.engineGain=a.createGain();volume.gain.value=.0001;
   eng.connect(filter);filter.connect(volume);volume.connect(a.destination);eng.start();
   const sir=this.siren=a.createOscillator();sir.type='triangle';const sv=this.sirenGain=a.createGain();
   sv.gain.value=.0001;sir.connect(sv);sv.connect(a.destination);sir.start();
  }catch(e){console.warn('AudioContext unavailable; sample-only audio',e);}
  this.engineSample=this.makeLoop('engine.ogg');
  this.skidSample=this.makeLoop('skid.ogg');
  this.resumeSamples();
 }
 private resumeSamples(){
  if(this.muted)return;
  if(this.engineSample?.paused)void this.engineSample.play().catch(()=>{});
 }
 tick(kmph:number,throttle:boolean,cops:number,t:number,drifting=false){
  const run=!this.muted;
  const rpm=clamp(.76+kmph/150+(throttle?.25:0),.72,2.15);
  if(this.engineSample){
   this.engineSample.playbackRate=rpm;
   this.engineSample.volume=run?clamp(.10+kmph*.00062+(throttle?.025:0),.07,.23):0;
   if(run&&this.engineSample.paused)this.resumeSamples();
  }
  if(this.skidSample){
   const active=run&&drifting&&kmph>12;
   this.skidSample.volume=active?clamp(.085+kmph*.0004,.08,.17):0;
   if(active&&this.skidSample.paused)void this.skidSample.play().catch(()=>{});
   if(!active&&!this.skidSample.paused)this.skidSample.pause();
  }
  if(!this.ctx||!this.engine||!this.engineGain||!this.engineFilter||!this.siren||!this.sirenGain)return;
  const now=this.ctx.currentTime;
  this.engine.frequency.setTargetAtTime(54+kmph*1.25+(throttle?34:0),now,.1);
  this.engineFilter.frequency.setTargetAtTime(155+kmph*5+(throttle?100:0),now,.12);
  // Real engine recording leads. Synth exists at a fraction of original volume.
  this.engineGain.gain.setTargetAtTime(run?.008:0,now,.15);
  this.siren.frequency.setTargetAtTime(420+Math.sin(t*9)*165,now,.012);
  this.sirenGain.gain.setTargetAtTime(run&&cops>0?.03:0,now,.08);
 }
 hit(strength:number){
  if(this.muted||performance.now()-this.lastHit<120)return;this.lastHit=performance.now();
  const a=new Audio(import.meta.env.BASE_URL+'assets/crime/audio/impact.ogg');
  a.volume=clamp(.24+strength*.019,.24,.78);a.playbackRate=clamp(.8+Math.random()*.35,.7,1.25);
  this.activeImpacts.add(a);a.addEventListener('ended',()=>{a.removeAttribute('src');this.activeImpacts.delete(a);},{once:true});
  void a.play().catch(()=>{this.activeImpacts.delete(a);});
  // Additional thump for mass/force on impacts.
  if(!this.ctx)return;
  const ctx=this.ctx,osc=ctx.createOscillator(),vol=ctx.createGain();
  osc.type='sine';osc.frequency.value=75+strength*5;
  osc.frequency.exponentialRampToValueAtTime(28,ctx.currentTime+.12);
  vol.gain.value=Math.min(.09,.02+strength*.004);
  vol.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);
  osc.connect(vol);vol.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.19);
 }
 dispose(){
  this.engineSample?.pause();this.skidSample?.pause();
  this.engineSample?.removeAttribute('src');this.skidSample?.removeAttribute('src');
  this.activeImpacts.forEach(a=>{a.pause();a.removeAttribute('src');});this.activeImpacts.clear();
  this.engineSample=null;this.skidSample=null;
  void this.ctx?.close();this.ctx=null;
 }
}
class EmpireEngine{
 world:CrimeWorld;player:CarState;mesh:THREE.Group;save:GameSave;house=false;paused=false;private menuOpen=false;foot=false;footMesh:THREE.Group;
 actors:Actor[]=[];people:Ped[]=[];private sound=new Sound();private alive=true;private raf=0;private prev=performance.now();private acc=0;private gameTime=0;private displayAt=0;private saveAt=0;private noticeUntil=0;
 private message='HIT THE STREETS';private lastCrimeAt=0;private lastPoliceAt=0;private lastPedSpawn=0;private lastActorSpawn=0;
 private camTarget=new THREE.Vector3();private playerDamage=[0,0,0,0];private npcDamage=new WeakMap<Actor,number>();private currentCarStyle:CarStyle;
 constructor(el:HTMLDivElement,private controls:Controls,private onUpdate:(v:UI)=>void){
  this.save=readSave();this.player=newCar(this.save.x,this.save.z,this.save.heading,this.save.carHP);
  Object.assign(this.player,{damageFront:this.save.carDamage.front,damageRear:this.save.carDamage.rear,damageLeft:this.save.carDamage.left,damageRight:this.save.carDamage.right});
  this.currentCarStyle=this.save.car;this.world=new CrimeWorld(el);
  this.world.stream(this.player.x,this.player.z);
  this.mesh=createCarVisual(this.save.car,0xd45f3d);this.world.scene.add(this.mesh);
  this.footMesh=npcVisual();this.footMesh.visible=false;this.world.scene.add(this.footMesh);
  this.world.marker('safehouse',7,7,0x40d3aa);
  this.world.marker('garage',-7,-7,0xf4b255);
  for(const m of MARKETS)this.world.marker(m.id,m.x,m.z,0x8cadf0);
  this.world.marker('mission',0,32,0xf8cf63);
  document.addEventListener('visibilitychange',this.visibility);
  window.addEventListener('pagehide',this.saveNow);window.addEventListener('resize',this.resize);
  this.resize();this.publish();this.raf=requestAnimationFrame(this.tick);
 }
 private resize=()=>this.world.resize();
 private visibility=()=>{if(document.hidden){this.saveNow();this.paused=true;clearInputs(this.controls);}else this.prev=performance.now();};
 private saveNow=()=>{this.save.x=this.player.x;this.save.z=this.player.z;this.save.heading=this.player.heading;
  this.save.carHP=this.player.hp;
  this.save.carDamage={front:this.player.damageFront,rear:this.player.damageRear,left:this.player.damageLeft,right:this.player.damageRight};
  saveGame(this.save);};
 unlock(){this.sound.start();}
 notice(s:string){this.message=s;this.noticeUntil=this.gameTime+3.5;this.publish();}
 private crime(heat:number){this.save.heat=clamp(this.save.heat+heat,0,5);this.lastCrimeAt=this.gameTime;}
 private makeActor(type:'police'|'traffic',x:number,z:number):Actor{
  const style:CarStyle=type==='police'?'police':(['taxi','sedan-sports','suv','sedan'] as CarStyle[])[Math.floor(Math.random()*4)];
  const car=newCar(x,z,Math.round(Math.random()*3)*Math.PI/2,100);
  const mesh=createCarVisual(style,colours[Math.floor(Math.random()*colours.length)]);this.world.scene.add(mesh);
  const a={car,mesh,type,style,routeX:cell(x),routeZ:cell(z),repath:0,alert:0,stuck:0,lastX:x,lastZ:z};this.actors.push(a);return a;
 }
 private makePed(x:number,z:number){const mesh=npcVisual();mesh.position.set(x,0,z);this.world.scene.add(mesh);this.people.push({mesh,x,z,vx:0,vz:0,panic:0,down:0,alive:true,bleed:null});}
 private canStand(x:number,z:number,r=.55){return !this.world.walls.some(w=>!w.broken&&Math.abs(x-w.x)<w.w/2+r&&Math.abs(z-w.z)<w.d/2+r);}
 private npcSpawn(){
  if(this.gameTime-this.lastActorSpawn>2.3&&this.actors.filter(a=>a.type==='traffic').length<7){
   this.lastActorSpawn=this.gameTime;
   for(let i=0;i<10;i++){const delta=Math.random()*Math.PI*2,dist=30+Math.random()*30;let x=this.player.x+Math.sin(delta)*dist,z=this.player.z+Math.cos(delta)*dist;
    if(Math.random()<.5)x=cell(x)+(Math.random()<.5?1.7:-1.7);else z=cell(z)+(Math.random()<.5?1.7:-1.7);
    if(this.canStand(x,z,2)&&Math.hypot(x-this.player.x,z-this.player.z)>18&&this.actors.every(a=>Math.hypot(a.car.x-x,a.car.z-z)>8)){this.makeActor('traffic',x,z);break;}
   }
  }
  if(this.save.heat>=1&&this.actors.filter(a=>a.type==='police').length<Math.min(7,Math.ceil(this.save.heat*1.3))&&this.gameTime-this.lastPoliceAt>3){
   this.lastPoliceAt=this.gameTime;
   for(let i=0;i<16;i++){const angle=Math.random()*Math.PI*2;let x=this.player.x+Math.cos(angle)*51,z=this.player.z+Math.sin(angle)*51;
    if(Math.random()<.5)x=cell(x);else z=cell(z);
    if(this.canStand(x,z,2)&&this.actors.every(a=>Math.hypot(a.car.x-x,a.car.z-z)>9)){this.makeActor('police',x,z);break;}
   }
  }
  if(this.gameTime-this.lastPedSpawn>1.1&&this.people.length<32){
   this.lastPedSpawn=this.gameTime;
   for(let i=0;i<15;i++){const x=this.player.x+(Math.random()-.5)*84,z=this.player.z+(Math.random()-.5)*84;
    if(this.canStand(x,z)&&Math.hypot(x-this.player.x,z-this.player.z)>8&&Math.abs(x-cell(x))>5&&Math.abs(z-cell(z))>5){this.makePed(x,z);break;}
   }
  }
 }
 private steerActor(a:Actor,dt:number){
  const s=a.car,dist=Math.hypot(this.player.x-s.x,this.player.z-s.z);
  if(a.type==='police'){a.alert=this.gameTime;a.repath-=dt;}
  if(a.type==='traffic'&&Math.hypot(a.routeX-s.x,a.routeZ-s.z)<5)a.repath=0;
  if(a.repath<=0){
   a.repath=a.type==='police'?.9:1.9;
   if(a.type==='traffic'){
    if(Math.random()<.5){a.routeX=cell(s.x)+(Math.random()<.5?-32:32);a.routeZ=cell(s.z);}
    else{a.routeX=cell(s.x);a.routeZ=cell(s.z)+(Math.random()<.5?-32:32);}
   }else{
    // Manhattan street pursuit: first get into a lane, then target intersections.
    const jx=cell(s.x),jz=cell(s.z),tx=cell(this.player.x),tz=cell(this.player.z);
    if(Math.abs(s.x-jx)>5){a.routeX=jx;a.routeZ=s.z;}
    else if(Math.abs(s.z-jz)>5){a.routeX=s.x;a.routeZ=jz;}
    else if(Math.abs(tx-jx)>Math.abs(tz-jz)){a.routeX=jx+32*Math.sign(tx-jx||1);a.routeZ=jz;}
    else {a.routeX=jx;a.routeZ=jz+32*Math.sign(tz-jz||1);}
    if(dist<14){a.routeX=this.player.x;a.routeZ=this.player.z;}
   }
  }
  const desired=Math.atan2(a.routeX-s.x,a.routeZ-s.z),error=wrap(desired-s.heading);
  const tune=engineTune(a.style,{engine:0,tires:0,brakes:0,armor:0});
  const input:DriverInput={throttle:Math.abs(error)>1.2?.24:a.type==='police'?.93:.38,brake:Math.abs(error)>1.55?.42:0,steer:clamp(error*2.3,-1,1),handbrake:Math.abs(error)>1.5&&speed(s)>9,nitro:false};
  drive(s,input,dt,tune);
  if(Math.hypot(s.x-a.lastX,s.z-a.lastZ)<.012)a.stuck+=dt;else a.stuck=0;
  a.lastX=s.x;a.lastZ=s.z;
  if(a.stuck>2.5){a.repath=0;a.car.heading+=Math.PI*.8;a.stuck=0;}
 }
 private hitEffect(impactSpeed:number,x:number,z:number){
  this.sound.hit(impactSpeed);
  if(impactSpeed>6){const count=Math.min(8,Math.round(impactSpeed/3));
   for(let i=0;i<count;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.13,.10,.30),new THREE.MeshBasicMaterial({color:i%3===0?0xffc767:0x898d92}));
    p.position.set(x+(Math.random()-.5)*1.5,.15,z+(Math.random()-.5)*1.5);this.world.scene.add(p);
    setTimeout(()=>{this.world.scene.remove(p);p.geometry.dispose();(p.material as THREE.Material).dispose();},450+Math.random()*650);
   }
  }
 }
 private physics(dt:number){
  this.gameTime+=dt;const c=this.controls;
  if(!this.foot){
   const steer=Number(c.right)-Number(c.left),tune=engineTune(this.save.car,this.save.mods);
   drive(this.player,{throttle:Number(c.throttle),brake:Number(c.brake),steer,handbrake:c.handbrake,nitro:c.nitro},dt,tune);
  }else{
   // Lightweight on-foot mode: shared input with driving, physically blocked by buildings.
   const dx=Number(c.right)-Number(c.left),dz=Number(c.throttle)-Number(c.brake);
   const len=Math.hypot(dx,dz)||1,x=this.player.x+dx/len*dt*5,z=this.player.z+dz/len*dt*5;
   if(this.canStand(x,z,.5)){this.player.x=x;this.player.z=z;}
   this.player.vx=0;this.player.vz=0;this.footMesh.position.set(this.player.x,0,this.player.z);
   if(dx||dz)this.footMesh.rotation.y=Math.atan2(dx,dz);
  }
  const here=this.player;
  for(const w of this.world.walls)if(!this.foot&&Math.abs(w.x-here.x)<w.w/2+2&&Math.abs(w.z-here.z)<w.d/2+2){
   const h=collideWall(here,w,1.12,engineTune(this.save.car,this.save.mods));
   if(h&&h.speed>3){this.hitEffect(h.speed,here.x,here.z);if(w.breakable&&w.broken)this.world.destroyProp(w,here.vx,here.vz);else if(h.speed>6)this.crime(.06);}
  }
  if(this.player.hp<10&&!this.foot){this.player.vx*=.87;this.player.vz*=.87;}
  for(const actor of this.actors){
   if(Math.hypot(actor.car.x-here.x,actor.car.z-here.z)>155)continue;
   this.steerActor(actor,dt);
   for(const w of this.world.walls)if(Math.abs(w.x-actor.car.x)<w.w/2+2&&Math.abs(w.z-actor.car.z)<w.d/2+2){
    const hit=collideWall(actor.car,w,1.12,engineTune(actor.style,{engine:0,tires:0,brakes:0,armor:0}));
    if(hit&&w.breakable&&w.broken)this.world.destroyProp(w,actor.car.vx,actor.car.vz);
   }
   if(!this.foot){
    const contacts=collideCars(here,actor.car,engineTune(this.save.car,this.save.mods));
    if(contacts&&contacts[0].speed>2){
     this.hitEffect(contacts[0].speed,here.x,here.z);
     if(actor.type==='police')this.crime(.18);
     else if(contacts[0].speed>5)this.crime(.32);
    }
   }
   renderCar(actor.mesh,actor.car,dt);actor.mesh.visible=!this.house;
   const damage=actor.car.damageFront+actor.car.damageRear+actor.car.damageLeft+actor.car.damageRight;
   if(damage>(this.npcDamage.get(actor)??0)+.025){
    showCarDamage(actor.mesh,{front:actor.car.damageFront,rear:actor.car.damageRear,left:actor.car.damageLeft,right:actor.car.damageRight});
    this.npcDamage.set(actor,damage);
   }
  }
  // Civilian vehicles and patrols are actual solid physics objects to each other,
  // not ghost traffic passing through wrecks at intersections.
  for(let i=0;i<this.actors.length;i++)for(let j=i+1;j<this.actors.length;j++){
   const a=this.actors[i],b=this.actors[j];
   if(Math.abs(a.car.x-b.car.x)>5||Math.abs(a.car.z-b.car.z)>5)continue;
   const hits=collideCars(a.car,b.car,engineTune(a.style,{engine:0,tires:0,brakes:0,armor:0}),
       engineTune(b.style,{engine:0,tires:0,brakes:0,armor:0}));
   if(hits&&hits[0].speed>4)this.hitEffect(hits[0].speed,(a.car.x+b.car.x)/2,(a.car.z+b.car.z)/2);
  }
  for(const p of this.people){
   if(!p.alive){p.down+=dt;if(p.down>18)p.mesh.visible=false;continue;}
   const dist=Math.hypot(p.x-here.x,p.z-here.z);
   p.panic=Math.max(0,p.panic-dt);
   if((speed(here)>11&&dist<11)||this.save.heat>1&&dist<18)p.panic=Math.max(p.panic,4);
   if(p.panic>0){const ang=Math.atan2(p.x-here.x,p.z-here.z),v=2.1;p.vx=Math.sin(ang)*v;p.vz=Math.cos(ang)*v;}
   else if(Math.random()<dt*.15){p.vx=(Math.random()-.5)*1.1;p.vz=(Math.random()-.5)*1.1;}
   const nx=p.x+p.vx*dt,nz=p.z+p.vz*dt;
   if(this.canStand(nx,nz,.35)){p.x=nx;p.z=nz;}else{p.vx*=-1;p.vz*=-1;}
   p.mesh.position.set(p.x,0,p.z);
   if(Math.hypot(p.vx,p.vz)>.05)p.mesh.rotation.y=Math.atan2(p.vx,p.vz);
   if(!this.foot&&dist<1.55&&speed(here)>3){
    p.alive=false;p.down=0;p.mesh.rotation.z=1.4;p.mesh.position.y=.2;
    const m=new THREE.Mesh(new THREE.CircleGeometry(.55+Math.random()*.8,12),new THREE.MeshBasicMaterial({color:0x7d1519,depthWrite:false,transparent:true,opacity:.75}));
    m.rotation.x=-Math.PI/2;m.position.set(p.x,.04,p.z);this.world.scene.add(m);p.bleed=m;
    this.crime(.9);this.hitEffect(speed(here),p.x,p.z);this.notice('CIVILIAN DOWN · POLICE ALERTED');
    this.player.vx*=.84;this.player.vz*=.84;
   }
  }
  if(this.gameTime-this.lastCrimeAt>6&&this.save.heat>0){
   const nearestCop=Math.min(999,...this.actors.filter(a=>a.type==='police').map(a=>Math.hypot(a.car.x-here.x,a.car.z-here.z)));
   if(nearestCop>24||this.house)this.save.heat=Math.max(0,this.save.heat-dt*(this.house?.2:.08));
  }
  if(this.save.heat<.05)this.save.heat=0;
  const mission=missionUpdate(this.save,here.x,here.z,this.save.heat);if(mission)this.notice(mission);
  const marker=missionMarker(this.save),m=this.world.markers.get('mission');
  if(m){m.visible=!!marker;if(marker)m.position.set(marker.x,.21,marker.z);}
  this.world.tickProps(dt);
  if(this.gameTime-this.lastCrimeAt>5)this.npcSpawn();
  // Separate visual and simulation; actors >camera radius still retain minimal logic.
  const sight=100;this.actors=this.actors.filter(a=>{
   if(Math.hypot(a.car.x-here.x,a.car.z-here.z)>sight&&(a.type==='traffic'||this.save.heat===0)){
    a.mesh.userData.disposed=true;a.mesh.removeFromParent();return false;
   }return true;
  });
  this.people=this.people.filter(p=>{
   if(Math.hypot(p.x-here.x,p.z-here.z)>90||!p.alive&&p.down>18){
    p.mesh.removeFromParent();p.bleed?.removeFromParent();if(p.bleed){p.bleed.geometry.dispose();(p.bleed.material as THREE.Material).dispose();}return false;
   }return true;
  });
 }
 private tick=(now:number)=>{
  if(!this.alive)return;
  const elapsed=clamp((now-this.prev)/1000,0,.08);this.prev=now;
  if(this.house&&!this.paused)this.save.heat=Math.max(0,this.save.heat-elapsed*.17);
  if(!this.paused&&!this.menuOpen&&!this.house){this.acc=Math.min(.10,this.acc+elapsed);for(let i=0;i<5&&this.acc>=1/60;i++){this.physics(1/60);this.acc-=1/60;}}
  if(!this.house){this.world.stream(this.player.x,this.player.z);}
  this.mesh.visible=!this.foot&&!this.house;this.footMesh.visible=this.foot&&!this.house;
  renderCar(this.mesh,this.player,elapsed,this.controls.brake);
  const d=[this.player.damageFront,this.player.damageRear,this.player.damageLeft,this.player.damageRight];
  if(d.some((v,i)=>Math.abs(v-this.playerDamage[i])>.015)){showCarDamage(this.mesh,{front:d[0],rear:d[1],left:d[2],right:d[3]});this.playerDamage=d;}
  this.world.follow(this.player.x,this.player.z,speed(this.player),this.player.heading,Math.min(.05,elapsed),this.house);
  this.world.render();
  this.sound.tick(kmh(this.player),this.controls.throttle,this.actors.filter(a=>a.type==='police').length,this.gameTime,this.controls.handbrake||Math.abs(this.player.steerAngle*this.player.yawRate)>0.1);
  if(now-this.displayAt>130){this.displayAt=now;this.publish();}
  if(now-this.saveAt>8000){this.saveAt=now;this.saveNow();}
  this.raf=requestAnimationFrame(this.tick);
 };
 private publish(){
  const mission=MISSIONS[this.save.mission],objective=missionMarker(this.save);
  const here=this.player,near=this.world.nearMarker(here.x,here.z,7.5);
  const district=this.player.z>64?'NEON MILE':this.player.x< -64?'OLD QUARTER':this.player.z< -64?'INDUSTRIAL BELT':'DOCKSIDE';
  this.onUpdate({speed:kmh(here),hp:Math.round(here.hp),heat:this.save.heat,cash:this.save.money,nitro:Math.round(here.nitro),
   mission:this.save.mode==='freeroam'?'FREE ROAM':mission?.title??'CAMPAIGN COMPLETE',
   objective:this.save.mode==='freeroam'?'BUILD YOUR EMPIRE':mission?.brief??'CITY IS YOURS',
   message:this.gameTime<this.noticeUntil?this.message:'',area:district,near,mode:this.save.mode,house:this.house,
   notice:this.player.hp<25?'ENGINE CRITICAL · REPAIR AT GARAGE':'',cargo:cargoCount(this.save),
   radar:{player:[here.x,here.z],cops:this.actors.filter(a=>a.type==='police').map(a=>[a.car.x,a.car.z] as [number,number]),
    traffic:this.actors.filter(a=>a.type==='traffic').map(a=>[a.car.x,a.car.z] as [number,number]),
    people:this.people.filter(p=>p.alive).map(p=>[p.x,p.z] as [number,number]),target:objective?[objective.x,objective.z]:null}});
 }
 setMenuOpen(open:boolean){this.menuOpen=open;if(open)clearInputs(this.controls);this.sound.muted=this.paused||open||this.house;}
 togglePause(){this.paused=!this.paused;clearInputs(this.controls);this.sound.muted=this.paused||this.menuOpen||this.house;this.publish();}
 setMode(mode:'campaign'|'freeroam'){this.save.mode=mode;this.saveNow();this.notice(mode==='campaign'?'CAMPAIGN RESUMED':'FREE ROAM · NO STORY REQUIREMENTS');}
 action(){
  this.unlock();
  if(this.house){this.house=false;this.paused=false;this.notice('BACK ON THE STREET');return;}
  const m=this.world.nearMarker(this.player.x,this.player.z,7.5);
  if(m==='safehouse'){
   if(speed(this.player)>3){this.notice('PARK THE CAR FIRST');return;}
   if(this.save.heat>=1&&this.actors.some(a=>a.type==='police'&&Math.hypot(a.car.x-this.player.x,a.car.z-this.player.z)<27)){
    this.notice('POLICE WATCHING THE DOOR · LOSE YOUR TAIL');return;
   }
   this.house=true;this.saveNow();this.notice('DOCKSIDE SAFEHOUSE');return;
  }
  if(this.foot){this.foot=false;this.notice('BACK IN THE DRIVER SEAT');return;}
  if(speed(this.player)<1.5){this.foot=true;this.notice('ON FOOT · PRESS ACTION TO ENTER CAR');return;}
  this.notice('SLOW DOWN BEFORE EXITING');
 }
 repair(){const cost=Math.max(40,Math.round((100-this.player.hp)*12));if(this.save.money<cost){this.notice('NEED $'+cost+' FOR REPAIR');return;}this.save.money-=cost;this.player.hp=100;this.player.damageFront=0;this.player.damageRear=0;this.player.damageLeft=0;this.player.damageRight=0;
  this.mesh.userData.disposed=true;this.mesh.removeFromParent();this.mesh=createCarVisual(this.save.car,0xd45f3d);this.world.scene.add(this.mesh);this.playerDamage=[0,0,0,0];this.notice('FULL REPAIR · $'+cost);this.saveNow();
 }
 upgrade(key:keyof Mods|'garage'|'house'){const r=buyUpgrade(this.save,key);this.notice(r.text);this.saveNow();}
 purchaseCar(style:CarStyle){const r=buyCar(this.save,style);if(r.ok){this.mesh.userData.disposed=true;this.mesh.removeFromParent();this.mesh=createCarVisual(style,0xd45f3d);this.world.scene.add(this.mesh);this.player.hp=100;this.playerDamage=[0,0,0,0];this.player.damageFront=0;this.player.damageRear=0;this.player.damageLeft=0;this.player.damageRight=0;}this.notice(r.text);this.saveNow();}
 deal(market:string,good:Commodity,qty:number){const r=trade(this.save,market,good,qty,this.gameTime);this.notice(r.text);if(r.ok){this.crime(.08);this.saveNow();}}
 getData(){return this.save;}
 getPrice(market:string,good:Commodity){return quote(market,good,this.gameTime);}
 dispose(){this.alive=false;cancelAnimationFrame(this.raf);this.saveNow();clearInputs(this.controls);
  document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.saveNow);window.removeEventListener('resize',this.resize);
  this.sound.dispose();this.actors.forEach(a=>a.mesh.removeFromParent());this.people.forEach(p=>{p.mesh.removeFromParent();p.bleed?.removeFromParent();});
  this.mesh.userData.disposed=true;this.mesh.removeFromParent();this.footMesh.removeFromParent();this.world.dispose();}
}
function ControlButton({label,field,controls,engine,className=''}:{label:string;field:keyof Controls;controls:React.MutableRefObject<Controls>;engine:React.MutableRefObject<EmpireEngine|null>;className?:string}){
 const down=(e:RP<HTMLButtonElement>)=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);(controls.current as unknown as Record<string,boolean>)[field]=true;engine.current?.unlock();};
 const up=(e:RP<HTMLButtonElement>)=>{e.preventDefault();(controls.current as unknown as Record<string,boolean>)[field]=false;};
 return <button type="button" className={'be-control '+className} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} aria-label={label}>{label}</button>;
}
function MiniMap({radar}:{radar:Radar}){const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(!ctx)return;const mid=60,scale=1.18;
  ctx.clearRect(0,0,120,120);ctx.fillStyle='#0e1b22';ctx.fillRect(0,0,120,120);
  const gx=radar.player[0],gz=radar.player[1];
  for(let i=-4;i<5;i++)for(const vert of [true,false]){
   const offset=(Math.round((vert?gx:gz)/32)+i)*32;
   const pos=mid+(offset-(vert?gx:gz))*scale;
   ctx.fillStyle='#354049';if(vert)ctx.fillRect(pos-6*scale,0,12*scale,120);else ctx.fillRect(0,pos-6*scale,120,12*scale);
  }
  function dot(a:[number,number],color:string,r=2.4){const x=mid+(a[0]-gx)*scale,z=mid+(a[1]-gz)*scale;if(x<0||x>120||z<0||z>120)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.fill();}
  radar.people.forEach(x=>dot(x,'#d0cdbb',1.2));radar.traffic.forEach(x=>dot(x,'#95afbe',2));radar.cops.forEach(x=>dot(x,'#599eff',3));
  if(radar.target)dot(radar.target,'#ffd06d',4);dot(radar.player,'#ff8b4c',4.5);
 },[radar]);return <canvas ref={canvas} width={120} height={120} className="be-minimap" aria-label="Local radar showing player, traffic, police and mission objective"/>;}
export default function CrimeGame(){
 const el=useRef<HTMLDivElement>(null),controls=useRef<Controls>({throttle:false,brake:false,left:false,right:false,handbrake:false,nitro:false,moveX:0,moveZ:0}),engine=useRef<EmpireEngine|null>(null);
 const [hud,setHud]=useState<UI>(initialUi),[menu,setMenu]=useState<'none'|'pause'|'garage'|'trade'|'house'|'jobs'>('none');
 const [selectedGood,setSelectedGood]=useState<Commodity>('Ember'),[qty,setQty]=useState(1);
 useEffect(()=>{engine.current?.setMenuOpen(menu!=='none');},[menu]);
 useEffect(()=>{
  if(!el.current)return;const game=new EmpireEngine(el.current,controls.current,setHud);engine.current=game;
  const pressed=new Set<string>();const apply=()=>{const c=controls.current;c.throttle=pressed.has('w')||pressed.has('arrowup')||c.throttle&&false;
   c.brake=pressed.has('s')||pressed.has('arrowdown');c.left=pressed.has('a')||pressed.has('arrowleft');c.right=pressed.has('d')||pressed.has('arrowright');c.handbrake=pressed.has(' ');c.nitro=pressed.has('shift');};
  const keydown=(e:KeyboardEvent)=>{if(e.repeat&&['e','escape','m'].includes(e.key.toLowerCase()))return;if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
   const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
   if(k==='e')game.action();else if(k==='escape')setMenu(prev=>prev==='none'?'pause':'none');else if(k==='m')setMenu(prev=>prev==='none'?'jobs':'none');
   pressed.add(k);apply();game.unlock();};
  const keyup=(e:KeyboardEvent)=>{pressed.delete(e.key.toLowerCase());apply();};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);game.dispose();engine.current=null;};
 },[]);
 const s=engine.current?.getData()??initial();
 const close=()=>setMenu('none');
 const openNear=()=>{engine.current?.unlock();
  if(hud.near==='garage')setMenu('garage');
  else if(hud.near==='safehouse'){engine.current?.action();setMenu('house');}
  else if(hud.near&&MARKETS.some(m=>m.id===hud.near))setMenu('trade');
  else engine.current?.action();
 };
 const adjust=(key:keyof Mods|'house'|'garage')=>engine.current?.upgrade(key);
 const item=MARKETS.find(m=>m.id===hud.near);
 const money=(n:number)=>'$'+n.toLocaleString('en-AU');
 return <div className="be-root">
  <div className="be-scene" ref={el} aria-label="Playable 3D top-down open world"/><div className="be-vignette"/>
  <header className="be-hud">
   <div className="be-topline"><div><strong>BLACKTOP <em>EMPIRE</em></strong><span>{hud.area} · {hud.mode==='campaign'?'STORY':'FREE ROAM'}</span></div><button onClick={()=>setMenu('pause')} aria-label="Menu">☰</button></div>
   <div className="be-stats"><span className="be-cash">{money(hud.cash)}</span><span className="be-stars">{'★'.repeat(Math.ceil(hud.heat))}<i>{'☆'.repeat(5-Math.ceil(hud.heat))}</i></span></div>
   <div className="be-mapwrap"><MiniMap radar={hud.radar}/><div className="be-legend"><b>{hud.mission}</b><span>{hud.objective}</span><small>BOOT {hud.cargo}/{cargoCap(s)}</small></div></div>
  </header>
  <div className="be-speed"><b>{hud.speed}</b><small>KM/H</small><span>VEHICLE {Math.round(hud.hp)}%</span><i><u style={{width:Math.max(0,hud.hp)+'%'}}/></i><span>NITRO {hud.nitro}%</span></div>
  {hud.message&&<div className="be-banner">{hud.message}</div>}
  {hud.notice&&<div className="be-danger">{hud.notice}</div>}
  <div className="be-worldactions"><button onClick={()=>{engine.current?.unlock();setMenu('jobs');}}>JOBS</button><button onClick={()=>{engine.current?.unlock();openNear();}}>{hud.near===null?'ENTER / EXIT':hud.near==='safehouse'?'SAFEHOUSE':hud.near==='garage'?'GARAGE':'DEAL / ENTER'}</button></div>
  <div className="be-controls"><div className="be-steer">
    <ControlButton label="◀" field="left" controls={controls} engine={engine}/>
    <ControlButton label="▶" field="right" controls={controls} engine={engine}/>
    <ControlButton label="DRIFT" field="handbrake" controls={controls} engine={engine} className="be-small"/>
   </div><div className="be-pedals">
    <ControlButton label="N₂O" field="nitro" controls={controls} engine={engine} className="be-small"/>
    <ControlButton label="BRAKE" field="brake" controls={controls} engine={engine}/>
    <ControlButton label="GO" field="throttle" controls={controls} engine={engine} className="be-go"/>
   </div></div>
  {menu!=='none'&&<div className="be-overlay" role="dialog" aria-modal="true">
   <div className="be-panel"><div className="be-panelhead"><strong>{menu==='pause'?'CITY MENU':menu==='trade'?'STREET MARKET':menu==='garage'?'VEHICLE SHOP':menu==='house'?'DOCKSIDE SAFEHOUSE':'JOBS & CAMPAIGN'}</strong><button onClick={close}>✕</button></div>
   {menu==='pause'&&<><p>STREETS NEVER SLEEP. DRIVE, BUILD YOUR EMPIRE AND LOSE THE HEAT.</p><div className="be-columns"><button onClick={()=>{engine.current?.setMode('campaign');close();}}>CAMPAIGN</button><button onClick={()=>{engine.current?.setMode('freeroam');close();}}>FREE ROAM</button></div>
    <button onClick={()=>{engine.current?.togglePause();close();}}>PAUSE / RESUME DRIVING</button><button onClick={()=>{engine.current?.unlock();close();}}>BACK TO STREETS</button><p className="be-note">WASD/arrows drive · SPACE drift · SHIFT nitro · E interact · M jobs. Progress autosaves.</p></>}
   {menu==='trade'&&<><p>{item?.name??'NEARBY STREET MARKET'} · Prices move between districts. Reach a market before trading.</p>
    <div className="be-columns">{GOODS.map(g=><button key={g} className={selectedGood===g?'active':''} onClick={()=>setSelectedGood(g)}>{g.toUpperCase()}<small>{money(engine.current?.getPrice(item?.id??'port',g)??0)} · HAVE {s.cargo[g]}</small></button>)}</div>
    <div className="be-tradeqty"><label>Quantity <input type="number" min="1" max="20" value={qty} onChange={e=>setQty(clamp(Math.trunc(Number(e.target.value)||1),1,20))}/></label></div>
    <div className="be-columns"><button onClick={()=>item&&engine.current?.deal(item.id,selectedGood,qty)}>BUY</button><button onClick={()=>item&&engine.current?.deal(item.id,selectedGood,-qty)}>SELL</button></div>
    <p>BOOT CAPACITY {cargoCount(s)}/{cargoCap(s)} · CASH {money(hud.cash)}</p></>}
   {menu==='garage'&&<><p>OWNED CARS · PURCHASE · MOD · REPAIR</p><div className="be-columns">{(['sedan','sedan-sports','taxi','suv','race','police'] as CarStyle[]).map(c=><button key={c} onClick={()=>engine.current?.purchaseCar(c)}>{c.toUpperCase()}<small>{s.owned.includes(c)?'OWNED · SELECT':c==='race'?'$11,000':c==='sedan-sports'?'$5,500':c==='police'?'$9,000':c==='suv'?'$3,800':'$1,700'}</small></button>)}</div>
    <button onClick={()=>engine.current?.repair()}>FULL BODY / ENGINE REPAIR</button>{(['engine','tires','brakes','armor'] as (keyof Mods)[]).map(k=><button key={k} onClick={()=>adjust(k)}>{k.toUpperCase()} · LEVEL {s.mods[k]}/3 · {money(350*(s.mods[k]+1))}</button>)}</>}
   {menu==='house'&&<><p>YOUR ENTERABLE SAFEHOUSE · PERSONAL GARAGE · STORAGE · HIDEOUT</p><p>HOUSE LEVEL {s.houseLevel} · GARAGE LEVEL {s.garageLevel}</p>
    <div className="be-columns"><button onClick={()=>adjust('house')}>UPGRADE ROOMS · {money(550*(s.houseLevel+1))}</button><button onClick={()=>adjust('garage')}>EXPAND GARAGE/STASH · {money(650*(s.garageLevel+1))}</button></div>
    <button onClick={()=>{engine.current?.repair();}}>REPAIR YOUR CAR</button><button onClick={()=>{engine.current?.action();close();}}>EXIT SAFEHOUSE</button></>}
   {menu==='jobs'&&<><p>CAMPAIGN: {s.completed.length} / {MISSIONS.length} COMPLETED. FREE ROAM ALWAYS OPEN.</p>
    {MISSIONS.map((m,i)=><div key={m.title} className={'be-job '+(s.mission===i?'active':'')}><b>{i+1}. {m.title}</b><span>{m.brief}</span><small>{s.completed.includes(i)?'COMPLETED':s.mission===i?'ACTIVE':s.mission<i?'LOCKED':'UP NEXT'} · {money(m.reward)}</small></div>)}
    <div className="be-columns"><button onClick={()=>{engine.current?.setMode('campaign');close();}}>CONTINUE STORY</button><button onClick={()=>{engine.current?.setMode('freeroam');close();}}>EXPLORE CITY</button></div></>}
   <p className="be-note">BLACKTOP EMPIRE · EARLY PLAYABLE FOUNDATION · ORIGINAL 18+ FICTIONAL CRIME GAME</p>
   </div></div>}
 </div>;
}
