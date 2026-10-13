import {useEffect,useRef,useState,type PointerEvent as RP} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {crimeAssetURL} from './assets';
import {CityMap} from './CityMap';
import {impactBody,stepImpactBody,type ImpactBody} from './ImpactMotion';
import {CITY_EDGE,ROAD_TILE_SIZE,DISTRICTS,districtAt,ROAD_TILES,STREET_NODES,nearestStreet,isRoad} from './CityLayout';
import {trafficPlan,trafficInput,spawnLane,type TrafficPlan} from './TrafficController';
import {VehicleLightRig} from './VehicleLights';
import {StreetCombat,npcCombatIntent,aggressiveFromSeed,restorePunchPose,applyPunchPose} from './StreetCombat';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {CrimeWorld,createCarVisual,renderCar,showCarDamage,applyCarCosmetics,disposeCarVisual,type CarStyle} from './World';
import {BASE_TUNE,axes,drive,newCar,collideWall,collideCars,pointTouchesCar,carOverlapsWall,constrainCarToBounds,kmh,speed,tuneWithMods,type CarState,type CarTune,type DriverInput} from './vehiclePhysics';
import {readSave,saveGame,initial,MARKETS,GOODS,MISSIONS,bankMoney,missionUpdate,missionMarker,buyUpgrade,buyCar,cargoCount,cargoCap,activeBuild,type GameSave,type Commodity,type Mods} from './Systems';
import {advanceEconomy,marketQuote,observeMarket,requestTrade,transferCargo,seizeCargo,syncCargo,type TradeRequest,type TradeResult} from './Economy';
import {TradePanel,SafehouseStorage,MarketIntel} from './EconomyPanels';
import './crime.css';
import {Controls,type ControlField} from './Controls';
import {disposePersonVisual,markSharedPersonModel,screenMovement} from './PersonVisuals';

const CAR_TUNES:Record<CarStyle,Partial<CarTune>>={
 sedan:{power:6900,topSpeed:40,grip:.99,mass:1380},
 'sedan-sports':{power:12700,topSpeed:59,grip:1.22,mass:1180},
 police:{power:11000,topSpeed:52,grip:1.16,mass:1480,durability:150},
 taxi:{power:6600,topSpeed:38,mass:1430},
 suv:{power:9100,topSpeed:43,mass:2030,durability:160,grip:.9},
 race:{power:16000,topSpeed:68,grip:1.34,mass:1030,durability:85}
};
type Actor={car:CarState;mesh:THREE.Group;type:'police'|'traffic'|'racer';style:CarStyle;routeX:number;routeZ:number;repath:number;alert:number;stuck:number;lastX:number;lastZ:number;nav:TrafficPlan};
type Ped={body:ImpactBody|null;hp:number;heading:number;aggressive:boolean;hostile:number;hitCooldown:number;stun:number;punchAt:number;mesh:THREE.Group;x:number;z:number;vx:number;vz:number;panic:number;down:number;alive:boolean;bleed:THREE.Mesh|null;mixer:THREE.AnimationMixer|null;clips:Map<string,THREE.AnimationAction>;currentAction:string};
type Radar={viewHeading:number;player:[number,number];heading:number;cops:[number,number][];traffic:[number,number][];people:[number,number][];parked:[number,number]|null;target:[number,number]|null};
type UI={speed:number;hp:number;heat:number;cash:number;nitro:number;mission:string;objective:string;message:string;area:string;near:string|null;mode:'campaign'|'freeroam';house:boolean;foot:boolean;heading:number;clock:string;notice:string;radar:Radar;cargo:number;race:string|null};
const initialUi:UI={speed:0,hp:100,heat:0,cash:1200,nitro:100,mission:'LAST $200',objective:'DRIVE TO SAFEHOUSE',message:'',area:'MIDTOWN',near:null,mode:'campaign',house:false,foot:false,heading:0,clock:'17:30',notice:'',radar:{viewHeading:0,player:[0,0],heading:0,cops:[],traffic:[],people:[],parked:null,target:null},cargo:0,race:null};
const clearInputs=(c:Controls)=>c.clear();
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const colours=[0xdf8759,0x75b0c5,0xead5b0,0x7a9384,0xbb6573,0xc2c7c3];
type PersonAsset={scene:THREE.Group;animations:THREE.AnimationClip[]};
const personSources=new Map<string,Promise<PersonAsset>>();
const personLoader=new GLTFLoader();
function getPerson(id:string):Promise<PersonAsset>{
 let load=personSources.get(id);if(!load){
  load=personLoader.loadAsync(crimeAssetURL('characters/'+id+'.glb'))
    .then(glb=>({scene:glb.scene,animations:glb.animations}));
  personSources.set(id,load);
 }
 return load;
}

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
  const a=new Audio(crimeAssetURL('audio/'+file));a.loop=true;a.preload='auto';a.volume=0;return a;
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
 tick(kmph:number,throttle:boolean,cops:number,t:number,drifting=false,engineAudible=true){
  const run=!this.muted;
  const rpm=clamp(.76+kmph/150+(throttle?.25:0),.72,2.15);
  if(this.engineSample){
   this.engineSample.playbackRate=rpm;
   this.engineSample.volume=run&&engineAudible?clamp(.10+kmph*.00062+(throttle?.025:0),.07,.23):0;
   if(run&&this.engineSample.paused)this.resumeSamples();
  }
  if(this.skidSample){
   const active=run&&engineAudible&&drifting&&kmph>12;
   this.skidSample.volume=active?clamp(.085+kmph*.0004,.08,.17):0;
   if(active&&this.skidSample.paused)void this.skidSample.play().catch(()=>{});
   if(!active&&!this.skidSample.paused)this.skidSample.pause();
  }
  if(!this.ctx||!this.engine||!this.engineGain||!this.engineFilter||!this.siren||!this.sirenGain)return;
  const now=this.ctx.currentTime;
  this.engine.frequency.setTargetAtTime(54+kmph*1.25+(throttle?34:0),now,.1);
  this.engineFilter.frequency.setTargetAtTime(155+kmph*5+(throttle?100:0),now,.12);
  // Real engine recording leads. Synth exists at a fraction of original volume.
  this.engineGain.gain.setTargetAtTime(run&&engineAudible?.008:0,now,.15);
  this.siren.frequency.setTargetAtTime(420+Math.sin(t*9)*165,now,.012);
  this.sirenGain.gain.setTargetAtTime(run&&cops>0?.03:0,now,.08);
 }
 hit(strength:number){
  if(this.muted||performance.now()-this.lastHit<120)return;this.lastHit=performance.now();
  const a=new Audio(crimeAssetURL('audio/impact.ogg'));
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
 world:CrimeWorld;player:CarState;mesh:THREE.Group;save:GameSave;house=false;paused=false;private menuOpen=false;private tradeContact:string|null=null;private backgrounded=document.hidden;foot=false;footMesh:THREE.Group;
 actors:Actor[]=[];people:Ped[]=[];private sound=new Sound();private alive=true;private raf=0;private prev=performance.now();private acc=0;private gameTime=0;private displayAt=0;private saveAt=0;private noticeUntil=0;
 private message='HIT THE STREETS';private lastCrimeAt=0;private lastPoliceAt=0;private lastPedSpawn=0;private lastActorSpawn=0;
 private camTarget=new THREE.Vector3();private playerDamage=[0,0,0,0];private npcDamage=new WeakMap<Actor,number>();private currentCarStyle:CarStyle;
 private raceRival:Actor|null=null;private raceTime=0;private rivalStep=1;private arrestProgress=0;private houseX=0;private houseZ=4;private skidAtX=Infinity;private skidAtZ=Infinity;
 private footMixer:THREE.AnimationMixer|null=null;private footClips=new Map<string,THREE.AnimationAction>();private footAction='';
 private footState=newCar();private footHP=100;private combat=new StreetCombat();private punchAt=-100;private headlightRig:VehicleLightRig;
 private waypoint:{x:number;z:number;label:string}|null=null;
 private position(){return this.foot?this.footState:this.player;}
 private canWalk(x:number,z:number){return this.canStand(x,z,.4)&&!pointTouchesCar(this.player,x,z,.4)&&this.actors.every(a=>!pointTouchesCar(a.car,x,z,.4));}
 constructor(el:HTMLDivElement,private controls:Controls,private onUpdate:(v:UI)=>void){
  this.save=readSave();const active=activeBuild(this.save);this.player=newCar(this.save.x,this.save.z,this.save.heading,active.hp);
  Object.assign(this.player,{damageFront:active.damage.front,damageRear:active.damage.rear,damageLeft:active.damage.left,damageRight:active.damage.right});
  this.currentCarStyle=this.save.car;this.world=new CrimeWorld(el);this.headlightRig=new VehicleLightRig(this.world.scene);
  this.world.restoreClock(this.save.economy.seconds);
  this.world.setInteriorLevels(this.save.houseLevel,this.save.garageLevel);
  this.world.stream(this.player.x,this.player.z);
  if(this.world.walls.some(w=>carOverlapsWall(this.player,w))||Math.abs(this.player.x)>CITY_EDGE||Math.abs(this.player.z)>CITY_EDGE){const street=nearestStreet(this.player.x,this.player.z);this.player.x=street.x;this.player.z=street.z;}
  this.mesh=createCarVisual(this.save.car,active.paint);this.mesh.position.set(this.player.x,this.world.surfaceHeight(this.player.x,this.player.z),this.player.z);this.mesh.rotation.y=this.player.heading;this.world.scene.add(this.mesh);
  applyCarCosmetics(this.mesh,active);
  this.footMesh=npcVisual();this.footMesh.visible=false;this.world.scene.add(this.footMesh);
  void getPerson('casual-male').then(source=>{
   if(!this.alive)return;
   const model=cloneSkinned(source.scene) as THREE.Group;
   const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y;
   if(!Number.isFinite(height)||height<.1)return;
   model.scale.multiplyScalar(1.85/height);
   const fit=new THREE.Box3().setFromObject(model),center=fit.getCenter(new THREE.Vector3());
   model.position.set(-center.x,-fit.min.y,-center.z);model.name='player-character';
   for(const child of [...this.footMesh.children])disposePersonVisual(child);
   markSharedPersonModel(model);
   this.footMesh.add(model);this.footMixer=new THREE.AnimationMixer(model);
   for(const name of ['Idle','Walk','Run']){
    const clip=source.animations.find(c=>c.name.toLowerCase().split('|').pop()===name.toLowerCase());
    if(clip)this.footClips.set(name,this.footMixer.clipAction(clip));
   }
   this.footAction='';
  }).catch(e=>console.warn('Player character fallback',e));
  this.world.marker('safehouse',7,7,0x40d3aa);
  this.world.marker('garage',0,-12,0xf4b255);
  for(const m of MARKETS)this.world.marker(m.id,m.x,m.z,0x8cadf0);
  this.world.marker('mission',0,32,0xf8cf63);
  document.addEventListener('visibilitychange',this.visibility);
  window.addEventListener('pagehide',this.saveNow);window.addEventListener('resize',this.resize);
  this.resize();this.publish();this.raf=requestAnimationFrame(this.tick);
 }
 private resize=()=>this.world.resize();
 private visibility=()=>{
  this.backgrounded=document.hidden;clearInputs(this.controls);this.acc=0;this.prev=performance.now();
  if(this.backgrounded)this.saveNow();
  this.sound.muted=this.backgrounded||this.paused||this.menuOpen||this.house;
 };
 private saveNow=()=>{this.save.x=this.player.x;this.save.z=this.player.z;this.save.heading=this.player.heading;
  this.save.carHP=this.player.hp;
  this.save.carDamage={front:this.player.damageFront,rear:this.player.damageRear,left:this.player.damageLeft,right:this.player.damageRight};
  const build=activeBuild(this.save);build.hp=this.player.hp;build.damage={...this.save.carDamage};
  build.mods={...this.save.mods};return saveGame(this.save);};
 unlock(){this.sound.start();}
 notice(s:string){this.message=s;this.noticeUntil=this.gameTime+3.5;this.publish();}
 private crime(heat:number){this.save.heat=clamp(this.save.heat+heat,0,5);this.lastCrimeAt=this.gameTime;}
 private makeActor(type:'police'|'traffic'|'racer',x:number,z:number,heading?:number):Actor{
  const style:CarStyle=type==='police'?'police':type==='racer'?'race':(['taxi','sedan-sports','suv','sedan'] as CarStyle[])[Math.floor(Math.random()*4)];
  const lane=spawnLane({x,z},Math.floor(Math.random()*4));
  const car=newCar(heading===undefined?lane.x:x,heading===undefined?lane.z:z,heading??lane.heading,100);
  const mesh=createCarVisual(style,colours[Math.floor(Math.random()*colours.length)]);mesh.position.set(car.x,this.world.surfaceHeight(car.x,car.z),car.z);mesh.rotation.y=car.heading;this.world.scene.add(mesh);
  const a={car,mesh,type,style,routeX:cell(x),routeZ:cell(z),repath:0,alert:0,stuck:0,lastX:car.x,lastZ:car.z,nav:trafficPlan(car,{x:car.x,z:car.z})};this.actors.push(a);return a;
 }
 private makePed(x:number,z:number){
  const mesh=npcVisual();mesh.position.set(x,0,z);this.world.scene.add(mesh);
  const p:Ped={body:null,hp:100,heading:0,aggressive:aggressiveFromSeed(this.people.length*137+Math.round(x*31+z*97)),hostile:0,hitCooldown:0,stun:0,punchAt:-100,mesh,x,z,vx:0,vz:0,panic:0,down:0,alive:true,bleed:null,mixer:null,clips:new Map(),currentAction:''};
  this.people.push(p);
  const names=['casual-male','casual-female','worker-male','suit-female'];
  const id=names[Math.floor(Math.random()*names.length)];
  void getPerson(id).then(source=>{
   if(!this.alive||!this.people.includes(p))return;
   const model=cloneSkinned(source.scene) as THREE.Group;
   const bounds=new THREE.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
   if(!Number.isFinite(height)||height<.1)return;
   model.scale.multiplyScalar(1.85/height);
   const b=new THREE.Box3().setFromObject(model),center=b.getCenter(new THREE.Vector3());
   model.position.x-=center.x;model.position.z-=center.z;model.position.y-=b.min.y;
   for(const child of [...mesh.children])disposePersonVisual(child);
   markSharedPersonModel(model);
   mesh.add(model);
   const mixer=new THREE.AnimationMixer(model);p.mixer=mixer;
   for(const name of ['Idle','Walk','Run','Death']){
    const clip=source.animations.find(c=>c.name.toLowerCase().split('|').pop()===name.toLowerCase());
    if(clip){const action=mixer.clipAction(clip);if(name==='Death'){action.clampWhenFinished=true;action.setLoop(THREE.LoopOnce,1);}p.clips.set(name,action);}
   }
   this.playPerson(p,p.alive?'Idle':'Death');
  }).catch(()=>{/* fallback character is a fully playable pedestrian */});
 }
 private canStand(x:number,z:number,r=.55){if(Math.abs(x)>CITY_EDGE-r||Math.abs(z)>CITY_EDGE-r)return false;return !this.world.walls.some(w=>{if(w.broken)return false;const dx=Math.max(0,Math.abs(x-w.x)-w.w/2),dz=Math.max(0,Math.abs(z-w.z)-w.d/2);return dx*dx+dz*dz<r*r;});}
 private npcSpawn(){
  const position=this.position();
  const offscreen=(x:number,z:number)=>{const p=new THREE.Vector3(x,.8,z).project(this.world.camera);return Math.abs(p.x)>1.25||Math.abs(p.y)>1.25;};
  const spawn=(type:'traffic'|'police')=>{
   const candidates=ROAD_TILES.filter(p=>{const d=Math.hypot(p.x-position.x,p.z-position.z);return d>44&&d<85&&offscreen(p.x,p.z);});
   for(let i=0;i<18&&candidates.length;i++){
    const p=candidates[Math.floor(Math.random()*candidates.length)],lane=spawnLane(p,Math.floor(Math.random()*4));
    if(this.canStand(lane.x,lane.z,2)&&this.actors.every(a=>Math.hypot(a.car.x-lane.x,a.car.z-lane.z)>10)&&Math.hypot(this.player.x-lane.x,this.player.z-lane.z)>12){this.makeActor(type,lane.x,lane.z,lane.heading);break;}
   }
  };
  if(this.gameTime-this.lastActorSpawn>2.3&&this.actors.filter(a=>a.type==='traffic').length<10){this.lastActorSpawn=this.gameTime;spawn('traffic');}
  if(this.save.heat>=1&&this.actors.filter(a=>a.type==='police').length<Math.min(7,Math.ceil(this.save.heat*1.3))&&this.gameTime-this.lastPoliceAt>3){this.lastPoliceAt=this.gameTime;spawn('police');}
  if(this.gameTime-this.lastPedSpawn>1.1&&this.people.length<24){
   this.lastPedSpawn=this.gameTime;
   for(let i=0;i<15;i++){const x=position.x+(Math.random()-.5)*84,z=position.z+(Math.random()-.5)*84;
    if(this.canStand(x,z)&&Math.hypot(x-position.x,z-position.z)>8&&!isRoad(x,z,1.1)){this.makePed(x,z);break;}
   }
  }
 }
 private arrest(){
  this.arrestProgress=0;this.finishRace();
  const fine=Math.min(this.save.money,Math.max(250,Math.round(this.save.heat*600)));
  this.save.money-=fine;
  seizeCargo(this.save);
  this.save.heat=0;
  this.player.x=0;this.player.z=-12;this.player.heading=0;
  this.player.vx=this.player.vz=this.player.yawRate=0;
  this.player.hp=Math.min(this.player.hp,55);
  this.player.damageFront=Math.max(.35,this.player.damageFront);
  this.foot=false;clearInputs(this.controls);
  for(const a of this.actors)disposeCarVisual(a.mesh);this.actors=[];
  this.lastCrimeAt=this.gameTime;this.saveNow();
  this.notice('BUSTED · FINE $'+fine+' · CARGO SEIZED · CAR IMPOUNDED');
 }
 tow(){
  if(this.save.money<180){this.notice('NEED $180 FOR TOW RECOVERY');return;}
  this.save.money-=180;this.player.x=0;this.player.z=-12;this.player.heading=0;
  this.player.vx=this.player.vz=this.player.yawRate=0;this.player.hp=Math.max(this.player.hp,25);
  this.foot=false;this.saveNow();this.notice('TOWED TO MIDTOWN GARAGE · $180');
 }
 private finishRace(){
  if(this.raceRival){
   disposeCarVisual(this.raceRival.mesh);
   this.actors=this.actors.filter(a=>a!==this.raceRival);
  }
  this.raceRival=null;this.raceTime=0;this.rivalStep=1;
 }
 private steerActor(a:Actor,dt:number){
  const s=a.car,position=this.position();a.repath-=dt;
  const finished=a.nav.index>=a.nav.path.length-1&&Math.hypot(s.x-a.nav.goal.x,s.z-a.nav.goal.z)<5;
  if(a.repath<=0||finished){
   let goal:{x:number;z:number};
   if(a.type==='police'){goal=nearestStreet(position.x,position.z);a.repath=1.8;}
   else if(a.type==='racer'){
    const checkpoints=[{x:32,z:0},{x:32,z:-32},{x:0,z:-32}];
    if(Math.hypot(s.x-checkpoints[Math.min(2,this.rivalStep-1)].x,s.z-checkpoints[Math.min(2,this.rivalStep-1)].z)<6)this.rivalStep++;
    goal=checkpoints[Math.min(2,this.rivalStep-1)];a.repath=1.5;
   }else{
    const choices=ROAD_TILES.filter(p=>{const d=Math.hypot(p.x-s.x,p.z-s.z);return d>35&&d<75;});goal=choices[Math.floor(Math.random()*choices.length)]??nearestStreet(s.x,s.z);a.repath=12;
   }
   a.routeX=goal.x;a.routeZ=goal.z;a.nav=trafficPlan(s,goal,a.nav);
  }
  const others=[this.player,...this.actors.filter(o=>o!==a).map(o=>o.car)];
  const input=trafficInput(s,a.nav,others,this.world.walls,dt,a.type==='traffic'?9:a.type==='racer'?15:17);
  drive(s,input,dt,engineTune(a.style,{engine:0,tires:0,brakes:0,armor:0}));constrainCarToBounds(s,CITY_EDGE);
 }
 private playPerson(p:Ped,name:string){
  if(name===p.currentAction)return;
  const previous=p.clips.get(p.currentAction);const next=p.clips.get(name)??p.clips.get('Idle');
  if(previous)previous.fadeOut(.12);
  if(next){next.reset().fadeIn(.12).play();}
  p.currentAction=name;
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
 private walkInterior(dt:number){
  const c=this.controls;
  const {x:dx,z:dz}=screenMovement(c.moveX||Number(c.right)-Number(c.left),c.moveZ||Number(c.throttle)-Number(c.brake),this.world.viewHeading);
  if(!dx&&!dz)return;
  const distance=Math.max(1,Math.hypot(dx,dz));
  const nx=clamp(this.houseX+dx/distance*dt*4.6,-7,7);
  const nz=clamp(this.houseZ+dz/distance*dt*4.6,-7.3,7.3);
  // Real furniture colliders: bedroom, workbench, safes and kitchen table.
  // The low rug at (-2,3) is floor dressing, not an obstacle around the entry.
  const blockers=[[-4,-4,2.4,1.9],[4,-5,2.4,1.1],[4,2,1.35,1.8]];
  if(this.save.houseLevel>=1)blockers.push([-5.5,4,.675,1.6]);
  if(this.save.garageLevel>=1)blockers.push([3,5,1.9,.7]);
  if(!blockers.some(([x,z,w,d])=>Math.abs(nx-x)<w+.4&&Math.abs(nz-z)<d+.4)){
   this.houseX=nx;this.houseZ=nz;
  }
  this.footMesh.position.set(10000+this.houseX,0,10000+this.houseZ);
  this.footMesh.rotation.y=Math.atan2(dx,dz);
 }
 private physics(dt:number){
  this.gameTime+=dt;advanceEconomy(this.save.economy,dt);this.save.day=1+Math.floor(this.save.economy.seconds/1200);const c=this.controls;
  if(!this.foot){
   const steer=-clamp(c.steer+Number(c.right)-Number(c.left),-1,1),tune=engineTune(this.save.car,this.save.mods);
   drive(this.player,{throttle:Number(c.throttle),brake:Number(c.brake),steer,handbrake:c.handbrake,nitro:c.nitro},dt,tune);
   const a=axes(this.player.heading),v=this.player.vx*a.rx+this.player.vz*a.rz;
   const sliding=speed(this.player)>6&&(c.handbrake||Math.abs(v)>3.8||c.brake&&speed(this.player)>20);
   if(sliding&&Math.hypot(this.player.x-this.skidAtX,this.player.z-this.skidAtZ)>.50){
    for(const side of [-1,1])this.world.addSkidMark(
     this.player.x-a.fx*1.46+a.rx*.87*side,
     this.player.z-a.fz*1.46+a.rz*.87*side,
     this.player.heading
    );
    this.skidAtX=this.player.x;this.skidAtZ=this.player.z;
   }
   if(!sliding){this.skidAtX=Infinity;this.skidAtZ=Infinity;}

  }else{
   // Lightweight on-foot mode: shared input with driving, physically blocked by buildings.
   const {x:dx,z:dz}=screenMovement(c.moveX||Number(c.right)-Number(c.left),c.moveZ||Number(c.throttle)-Number(c.brake),this.world.viewHeading);
   const len=Math.max(1,Math.hypot(dx,dz)),x=this.footState.x+dx/len*dt*5,z=this.footState.z+dz/len*dt*5;
   if(this.canWalk(x,z)){this.footState.x=x;this.footState.z=z;}
   this.player.vx=0;this.player.vz=0;this.footMesh.position.set(this.footState.x,this.world.surfaceHeight(this.footState.x,this.footState.z)+.005,this.footState.z);
   if(dx||dz)this.footMesh.rotation.y=this.footState.heading=Math.atan2(dx,dz);
  }
  const here=this.position();
  if(this.foot&&c.punch)this.punch();
  constrainCarToBounds(this.player,CITY_EDGE);
  for(const w of this.world.walls)if(Math.abs(w.x-this.player.x)<w.w/2+2.8&&Math.abs(w.z-this.player.z)<w.d/2+2.8){
   const h=collideWall(this.player,w,1.12,engineTune(this.save.car,this.save.mods));
   if(h&&h.speed>3){this.hitEffect(h.speed,this.player.x,this.player.z);if(w.breakable&&w.broken)this.world.destroyProp(w,this.player.vx,this.player.vz);else if(!this.foot&&h.speed>6)this.crime(.06);}
  }
  if(this.player.hp<10&&!this.foot){this.player.vx*=.87;this.player.vz*=.87;}
  for(const actor of this.actors){
   if(Math.hypot(actor.car.x-here.x,actor.car.z-here.z)>155)continue;
   this.steerActor(actor,dt);
   for(const w of this.world.walls)if(Math.abs(w.x-actor.car.x)<w.w/2+2.8&&Math.abs(w.z-actor.car.z)<w.d/2+2.8){
    const hit=collideWall(actor.car,w,1.12,engineTune(actor.style,{engine:0,tires:0,brakes:0,armor:0}));
    if(hit&&w.breakable&&w.broken)this.world.destroyProp(w,actor.car.vx,actor.car.vz);
   }
   {
   const contacts=collideCars(this.player,actor.car,engineTune(this.save.car,this.save.mods),engineTune(actor.style,{engine:0,tires:0,brakes:0,armor:0}));
    if(contacts&&contacts[0].speed>2){
     this.hitEffect(contacts[0].speed,this.player.x,this.player.z);
     if(actor.type==='police')this.crime(.18);
     else if(contacts[0].speed>5)this.crime(.32);
    }
   }
   renderCar(actor.mesh,actor.car,dt,false,this.world.nightAmount);actor.mesh.position.y=this.world.surfaceHeight(actor.car.x,actor.car.z);actor.mesh.visible=!this.house;
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
   if(!p.alive){p.down+=dt;restorePunchPose(p.mesh);p.mixer?.update(dt);
    if(p.body){stepImpactBody(p.body,dt,(x,z)=>this.world.surfaceHeight(x,z),this.world.walls,CITY_EDGE);p.x=p.body.x;p.z=p.body.z;p.mesh.position.set(p.x,p.body.y,p.z);p.mesh.rotation.x=Math.sin(p.body.roll)*.22*Math.max(0,1-p.down/1.5);p.mesh.rotation.z=p.mixer?Math.sin(p.body.roll)*.26*Math.max(0,1-p.down/1.5):1.4;}
    if(p.down>18)p.mesh.visible=false;continue;
   }
   const dist=Math.hypot(p.x-here.x,p.z-here.z);
   p.panic=Math.max(0,p.panic-dt);
   const intent=npcCombatIntent(p,this.foot?{...this.footState,hp:this.footHP}:null,dt,this.gameTime);
   if((speed(here)>11&&dist<11)||this.save.heat>1&&dist<18)p.panic=Math.max(p.panic,4);
   if(intent.mode!=='idle'){p.vx=intent.vx;p.vz=intent.vz;if(intent.mode==='flee')p.panic=Math.max(p.panic,.5);}
   else if(p.panic>0){const ang=Math.atan2(p.x-here.x,p.z-here.z),v=2.8;p.vx=Math.sin(ang)*v;p.vz=Math.cos(ang)*v;}
   else if(Math.random()<dt*.15){p.vx=(Math.random()-.5)*1.1;p.vz=(Math.random()-.5)*1.1;}
   if(intent.punch){p.punchAt=this.gameTime;this.footHP=Math.max(0,this.footHP-intent.damage);this.hitEffect(.9,here.x,here.z);if(this.footHP<=0)this.recoverOnFoot();}
   const nx=p.x+p.vx*dt,nz=p.z+p.vz*dt;
   if(this.canStand(nx,nz,.35)&&!pointTouchesCar(this.player,nx,nz,.3)){p.x=nx;p.z=nz;}else{p.vx*=-1;p.vz*=-1;}
   p.mesh.position.set(p.x,this.world.surfaceHeight(p.x,p.z)+.005,p.z);
   if(Math.hypot(p.vx,p.vz)>.05)p.heading=Math.atan2(p.vx,p.vz);
   p.mesh.rotation.y=p.heading;
   restorePunchPose(p.mesh);
   this.playPerson(p,p.panic>0?'Run':Math.hypot(p.vx,p.vz)>.15?'Walk':'Idle');
   p.mixer?.update(dt);applyPunchPose(p.mesh,this.gameTime-p.punchAt);
   const hitter=!this.foot&&pointTouchesCar(this.player,p.x,p.z,.35)&&speed(this.player)>3?this.player:this.actors.find(a=>pointTouchesCar(a.car,p.x,p.z,.35)&&speed(a.car)>3)?.car;
   if(hitter){
    p.alive=false;p.down=0;p.body=impactBody(p.x,p.z,hitter.vx,hitter.vz,speed(hitter));this.playPerson(p,'Death');if(!p.mixer)p.mesh.rotation.z=1.4;
    const m=new THREE.Mesh(new THREE.CircleGeometry(.55+Math.random()*.8,12),new THREE.MeshBasicMaterial({color:0x7d1519,depthWrite:false,transparent:true,opacity:.75}));
    m.rotation.x=-Math.PI/2;m.position.set(p.x,this.world.surfaceHeight(p.x,p.z)+.002,p.z);this.world.scene.add(m);p.bleed=m;
    if(hitter===this.player){this.crime(.9);this.notice('CIVILIAN DOWN · POLICE ALERTED');}if(dist<30)this.hitEffect(speed(hitter),p.x,p.z);
    hitter.vx*=.95;hitter.vz*=.95;
   }
  }
  if(this.gameTime-this.lastCrimeAt>6&&this.save.heat>0){
   const nearestCop=Math.min(999,...this.actors.filter(a=>a.type==='police').map(a=>Math.hypot(a.car.x-here.x,a.car.z-here.z)));
   if(nearestCop>24||this.house)this.save.heat=Math.max(0,this.save.heat-dt*(this.house?.2:.08));
  }
  if(this.save.heat<.05)this.save.heat=0;
  const arrestNearby=this.actors.some(a=>a.type==='police'&&Math.hypot(a.car.x-here.x,a.car.z-here.z)<5.5);
  this.arrestProgress=arrestNearby&&this.save.heat>=1.25&&speed(here)<3.5
   ?this.arrestProgress+dt:Math.max(0,this.arrestProgress-dt*2);
  if(this.arrestProgress>=3.3){this.arrest();return;}
  const beforeMission=this.save.mission;
  const mission=missionUpdate(this.save,here.x,here.z,this.save.heat);if(mission)this.notice(mission);
  // Street-racing campaign mission is won on real checkpoints, against an actual
  // simulated AI rival and a strict deadline, not by opening a menu.
  if(beforeMission===2&&this.save.mode==='campaign'){
   if(this.save.mission!==2){this.finishRace();}
   else{
    if(this.save.missionStep===1&&!this.raceRival){
     this.raceRival=this.makeActor('racer',this.player.x-2.5,this.player.z-3.2);
     this.raceTime=0;this.rivalStep=1;
     this.notice('RACE START · WIN THE MIDTOWN CIRCUIT');
    }
    if(this.raceRival){
     this.raceTime+=dt;
     if(this.rivalStep>3||this.raceTime>65){
      this.save.missionStep=0;this.finishRace();
      this.notice('RACE LOST · RESTART AT FIRST CHECKPOINT');
     }
    }
   }
  }else if(this.raceRival)this.finishRace();
  const marker=missionMarker(this.save),m=this.world.markers.get('mission');
  if(m){m.visible=!!marker;if(marker)m.position.set(marker.x,.21,marker.z);}
  this.world.tickProps(dt);
  this.npcSpawn(); // Populate/dispatch regardless of how recently a crime occurred.
  // Separate visual and simulation; actors >camera radius still retain minimal logic.
  const sight=100;this.actors=this.actors.filter(a=>{
   if(Math.hypot(a.car.x-here.x,a.car.z-here.z)>sight&&(a.type==='traffic'||this.save.heat===0)){
    disposeCarVisual(a.mesh);return false;
   }return true;
  });
  this.people=this.people.filter(p=>{
   if(Math.hypot(p.x-here.x,p.z-here.z)>90||!p.alive&&p.down>18){
    p.mixer?.stopAllAction();if(p.mixer)p.mixer.uncacheRoot(p.mixer.getRoot());disposePersonVisual(p.mesh);p.bleed?.removeFromParent();if(p.bleed){p.bleed.geometry.dispose();(p.bleed.material as THREE.Material).dispose();}return false;
   }return true;
  });
 }
 private tick=(now:number)=>{
  if(!this.alive)return;
  const elapsed=clamp((now-this.prev)/1000,0,.08);this.prev=now;
  if(this.house&&!this.paused&&!this.backgrounded)this.save.heat=Math.max(0,this.save.heat-elapsed*.17);
  if(this.house&&!this.paused&&!this.menuOpen&&!this.backgrounded){this.walkInterior(elapsed);advanceEconomy(this.save.economy,elapsed);}
  if(!this.paused&&!this.menuOpen&&!this.house&&!this.backgrounded){this.acc=Math.min(.10,this.acc+elapsed);for(let i=0;i<5&&this.acc>=1/60;i++){this.physics(1/60);this.acc-=1/60;}}
  const position=this.position();
  if(!this.house){this.world.stream(position.x,position.z);}
  this.mesh.visible=!this.house;this.footMesh.visible=this.foot||this.house;
  const moving=this.controls.moveX||this.controls.moveZ||this.controls.left||this.controls.right||this.controls.throttle||this.controls.brake;
  const action=this.footMesh.visible&&moving&&!this.menuOpen&&!this.paused&&!this.backgrounded?(this.house?'Walk':'Run'):'Idle';
  if(action!==this.footAction){this.footClips.get(this.footAction)?.fadeOut(.18);this.footClips.get(action)?.reset().fadeIn(.18).play();this.footAction=action;}
  restorePunchPose(this.footMesh);
  if(!this.menuOpen&&!this.paused&&!this.backgrounded)this.footMixer?.update(elapsed);
  if(this.foot&&!this.house)applyPunchPose(this.footMesh,this.gameTime-this.punchAt);
  renderCar(this.mesh,this.player,elapsed,this.controls.brake,this.world.nightAmount);
  this.mesh.position.y=this.world.surfaceHeight(this.player.x,this.player.z);
  const d=[this.player.damageFront,this.player.damageRear,this.player.damageLeft,this.player.damageRight];
  if(d.some((v,i)=>Math.abs(v-this.playerDamage[i])>.015)){showCarDamage(this.mesh,{front:d[0],rear:d[1],left:d[2],right:d[3]});this.playerDamage=d;}
  if(!this.menuOpen&&!this.paused&&!this.backgrounded)this.world.updateEnvironment(elapsed);
  this.world.follow(this.house?this.houseX:position.x,this.house?this.houseZ:position.z,speed(this.player),this.player.heading,Math.min(.05,elapsed),this.house,this.foot||this.house);
  this.headlightRig.update(this.house||this.foot?null:this.mesh,this.world.nightAmount);
  this.world.render();
  this.sound.tick(kmh(this.player),!this.foot&&this.controls.throttle,this.actors.filter(a=>a.type==='police').length,this.gameTime,!this.foot&&(this.controls.handbrake||Math.abs(this.player.steerAngle*this.player.yawRate)>0.1),!this.foot||Math.hypot(this.footState.x-this.player.x,this.footState.z-this.player.z)<14);
  if(now-this.displayAt>130){this.displayAt=now;this.publish();}
  if(now-this.saveAt>8000){this.saveAt=now;this.saveNow();}
  this.raf=requestAnimationFrame(this.tick);
 };
 private publish(){
  const mission=MISSIONS[this.save.mission],objective=this.waypoint??missionMarker(this.save);
  const here=this.position(),near=this.world.nearMarker(here.x,here.z,7.5);
  this.world.setNavigation(this.house?null:objective,{x:here.x,z:here.z,heading:here.heading});
  const district=districtAt(here.x,here.z).name.toUpperCase();
  this.onUpdate({speed:kmh(here),hp:Math.round(this.foot||this.house?this.footHP:this.player.hp),heat:this.save.heat,cash:this.save.money,nitro:Math.round(this.player.nitro),
   mission:this.house?'SAFEHOUSE INTERIOR':this.waypoint?this.waypoint.label:this.save.mode==='freeroam'?'FREE ROAM':mission?.title??'CAMPAIGN COMPLETE',
   objective:this.house?'EXPLORE ROOMS · UPGRADE FURNITURE · EXIT WHEN READY':this.waypoint?'FOLLOW THE CYAN WAYPOINTS':this.save.mode==='freeroam'?'BUILD YOUR EMPIRE':mission?.brief??'CITY IS YOURS',
   message:this.gameTime<this.noticeUntil?this.message:'',area:district,near,mode:this.save.mode,house:this.house,foot:this.foot||this.house,heading:this.world.viewHeading,clock:this.world.clockLabel,
   race:this.raceRival?'RACE · '+Math.max(0,Math.ceil(65-this.raceTime))+'s LEFT · RIVAL '+Math.min(3,this.rivalStep)+'/3':null,
   notice:this.foot&&this.footHP<30?'HURT · RETURN TO SAFEHOUSE':!this.foot&&this.player.hp<25?'ENGINE CRITICAL · REPAIR AT GARAGE':'',cargo:cargoCount(this.save),
   radar:{viewHeading:this.world.viewHeading,player:[here.x,here.z],heading:here.heading,cops:this.actors.filter(a=>a.type==='police').map(a=>[a.car.x,a.car.z] as [number,number]),
    traffic:this.actors.filter(a=>a.type==='traffic').map(a=>[a.car.x,a.car.z] as [number,number]),
    parked:this.foot?[this.player.x,this.player.z]:null,people:this.people.filter(p=>p.alive).map(p=>[p.x,p.z] as [number,number]),target:!this.house&&objective?[objective.x,objective.z]:null}});
 }
 setMenuOpen(open:boolean){this.menuOpen=open;if(!open)this.tradeContact=null;clearInputs(this.controls);this.sound.muted=this.paused||open||this.house||this.backgrounded;}
 isMenuOpen(){return this.menuOpen;}
 navigateTo(id:string){const place=MARKETS.find(m=>m.id===id);if(place){this.waypoint={x:place.x,z:place.z,label:place.name};this.publish();}}
 clearWaypoint(){this.waypoint=null;this.publish();}
 punch(){
  if(!this.foot||this.house||this.paused||this.menuOpen||this.backgrounded)return;
  const result=this.combat.punch(this.footState,this.people.filter(p=>p.alive),this.gameTime);
  if(!result.attempted)return;this.punchAt=this.gameTime;
  if(result.target){const p=result.target;this.hitEffect(1.5,p.x,p.z);this.crime(.25);this.notice(p.aggressive?'THEY ARE FIGHTING BACK':'THEY ARE FLEEING');
   if(p.hp<=0){p.alive=false;p.down=0;p.body=impactBody(p.x,p.z,Math.sin(this.footState.heading)*2,Math.cos(this.footState.heading)*2,2);this.playPerson(p,'Death');if(!p.mixer)p.mesh.rotation.z=1.4;this.crime(.4);}
  }
 }
 private recoverOnFoot(){
  this.footHP=100;this.footState.x=7;this.footState.z=7;this.footState.heading=0;
  this.save.money=Math.max(0,this.save.money-100);this.save.heat=Math.max(0,this.save.heat-1);
  for(const p of this.people){p.hostile=0;p.panic=0;}clearInputs(this.controls);this.notice('KNOCKED OUT · RECOVERED AT SAFEHOUSE · $100');
 }
 canUseGarage(){return this.world.nearMarker(this.player.x,this.player.z,7.5)==='garage'&&speed(this.player)<1.7;}
 resume(){this.paused=false;this.acc=0;this.prev=performance.now();clearInputs(this.controls);this.sound.muted=this.menuOpen||this.house||this.backgrounded;}
 togglePause(){this.paused=!this.paused;clearInputs(this.controls);this.sound.muted=this.paused||this.menuOpen||this.house;this.publish();}
 setMode(mode:'campaign'|'freeroam'){this.save.mode=mode;if(mode==='freeroam')this.finishRace();this.saveNow();this.notice(mode==='campaign'?'CAMPAIGN RESUMED':'FREE ROAM · NO STORY REQUIREMENTS');}
 action(){
  this.unlock();
  if(this.house){this.house=false;this.paused=false;this.footMesh.visible=false;this.notice('BACK ON THE STREET');return;}
  const position=this.position(),m=this.world.nearMarker(position.x,position.z,7.5);
  if(m==='safehouse'){
   if(speed(this.player)>3){this.notice('PARK THE CAR FIRST');return;}
   if(this.save.heat>=1&&this.actors.some(a=>a.type==='police'&&Math.hypot(a.car.x-position.x,a.car.z-position.z)<27)){
    this.notice('POLICE WATCHING THE DOOR · LOSE YOUR TAIL');return;
   }
   this.footHP=100;this.house=true;this.houseX=0;this.houseZ=4;this.footMesh.visible=true;this.footMesh.position.set(10000,0,10004);
   clearInputs(this.controls);this.saveNow();this.notice('MIDTOWN SAFEHOUSE');return;
  }
  if(this.foot){if(Math.hypot(this.footState.x-this.player.x,this.footState.z-this.player.z)>3.5){this.notice('APPROACH YOUR CAR TO ENTER');return;}this.foot=false;clearInputs(this.controls);this.notice('BACK IN THE DRIVER SEAT');return;}
  if(speed(this.player)<1.5){
   const a=axes(this.player.heading),options=[{x:this.player.x-a.rx*1.75,z:this.player.z-a.rz*1.75},{x:this.player.x+a.rx*1.75,z:this.player.z+a.rz*1.75},{x:this.player.x-a.fx*3,z:this.player.z-a.fz*3}];
   const spot=options.find(p=>this.canWalk(p.x,p.z));if(!spot){this.notice('CAR DOORS BLOCKED · REPOSITION FIRST');return;}
   Object.assign(this.footState,this.player,{x:spot.x,z:spot.z,vx:0,vz:0,yawRate:0});this.player.vx=this.player.vz=0;this.foot=true;clearInputs(this.controls);this.notice('ON FOOT · APPROACH YOUR CAR TO ENTER');return;
  }
  this.notice('SLOW DOWN BEFORE EXITING');
 }
 private rebuildPlayerVisual(){
  disposeCarVisual(this.mesh);
  const build=activeBuild(this.save);
  this.mesh=createCarVisual(this.save.car,build.paint);
  this.mesh.position.set(this.player.x,this.world.surfaceHeight(this.player.x,this.player.z),this.player.z);this.mesh.rotation.y=this.player.heading;this.world.scene.add(this.mesh);
  applyCarCosmetics(this.mesh,build);
  const damage={front:this.player.damageFront,rear:this.player.damageRear,left:this.player.damageLeft,right:this.player.damageRight};
  showCarDamage(this.mesh,damage);
  this.playerDamage=[damage.front,damage.rear,damage.left,damage.right];
 }
 repair(){
  const damage=this.player.damageFront+this.player.damageRear+this.player.damageLeft+this.player.damageRight;
  if(this.player.hp>=99.9&&damage<.01){this.notice('YOUR VEHICLE IS ALREADY REPAIRED');return;}
  const cost=Math.max(40,Math.round((100-this.player.hp)*12+damage*210));
  if(this.save.money<cost){this.notice('NEED $'+cost+' FOR REPAIR');return;}
  this.save.money-=cost;this.player.hp=100;
  this.player.damageFront=this.player.damageRear=this.player.damageLeft=this.player.damageRight=0;
  this.rebuildPlayerVisual();this.notice('FULL REPAIR · $'+cost);this.saveNow();
 }
 upgrade(key:keyof Mods|'garage'|'house'){
  const result=buyUpgrade(this.save,key);
  if(result.ok&&(key==='garage'||key==='house'))this.world.setInteriorLevels(this.save.houseLevel,this.save.garageLevel);
  this.notice(result.text);this.saveNow();
 }
 purchaseCar(style:CarStyle){
  // Save the outgoing car BEFORE selecting another: no free repairs by swapping vehicles.
  this.saveNow();
  const result=buyCar(this.save,style);
  if(result.ok){
   const build=activeBuild(this.save,style);
   this.save.mods={...build.mods};this.player.hp=build.hp;
   this.player.damageFront=build.damage.front;this.player.damageRear=build.damage.rear;
   this.player.damageLeft=build.damage.left;this.player.damageRight=build.damage.right;
   this.rebuildPlayerVisual();
  }
  this.notice(result.text);this.saveNow();
 }
 customize(kind:'paint'|'spoiler'|'neon',color=0){
  const build=activeBuild(this.save);
  const prices={paint:180,spoiler:450,neon:700};
  if(kind==='paint'&&build.paint===color){this.notice('PAINT ALREADY FITTED');return;}
  if(kind==='spoiler'&&build.spoiler||kind==='neon'&&build.neon){this.notice('MOD ALREADY FITTED');return;}
  const price=prices[kind];
  if(this.save.money<price){this.notice('NOT ENOUGH CASH · $'+price);return;}
  this.save.money-=price;
  if(kind==='paint')build.paint=color;
  else if(kind==='spoiler')build.spoiler=true;
  else build.neon=true;
  applyCarCosmetics(this.mesh,build);this.notice(kind.toUpperCase()+' FITTED · $'+price);this.saveNow();
 }
 openMarket(market:string){
  const m=MARKETS.find(x=>x.id===market),here=this.position();
  if(!m||this.house||Math.hypot(here.x-m.x,here.z-m.z)>7.5||kmh(here)>6)return false;
  if(this.foot&&Math.hypot(here.x-this.player.x,here.z-this.player.z)>8){this.notice('PARK YOUR CAR BY THE CONTACT FOR CARGO');return false;}
  this.tradeContact=market;this.setMenuOpen(true);observeMarket(this.save.economy,market);this.saveNow();return true;
 }
 private financialAction(action:()=>TradeResult):TradeResult{
  const before=JSON.parse(JSON.stringify(this.save)) as GameSave,previousCrimeAt=this.lastCrimeAt;
  const result=action();
  if(result.ok){
   if(result.receipt)this.crime(.08);
   if(!this.saveNow()){this.save=before;this.lastCrimeAt=previousCrimeAt;syncCargo(this.save);const failed={ok:false,text:'SAVE UNAVAILABLE · DEAL CANCELLED'};this.notice(failed.text);return failed;}
  }
  this.notice(result.text);return result;
 }
 deal(request:TradeRequest){
  const here=this.position();return this.financialAction(()=>requestTrade(this.save,request,{x:here.x,z:here.z,speed:kmh(here),
   open:this.menuOpen&&this.tradeContact===request.market&&!this.backgrounded&&!this.house,
   cargoAccessible:!this.foot||Math.hypot(here.x-this.player.x,here.z-this.player.z)<=8}));
 }
 canTransferCargo(){return this.house&&Math.hypot(this.player.x-7,this.player.z-7)<=12&&kmh(this.player)<=6;}
 moveCargo(good:Commodity,qty:number){return this.financialAction(()=>transferCargo(this.save,good,qty,this.house&&this.menuOpen&&!this.backgrounded,this.canTransferCargo()));}
 bankCash(amount:number){return this.financialAction(()=>bankMoney(this.save,amount,this.house&&this.menuOpen&&!this.backgrounded));}
 getData(){return this.save;}
 getPrice(market:string,good:Commodity){return marketQuote(this.save.economy,market,good)?.buy??0;}
 dispose(){this.alive=false;cancelAnimationFrame(this.raf);this.saveNow();clearInputs(this.controls);
  document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.saveNow);window.removeEventListener('resize',this.resize);
  this.sound.dispose();this.headlightRig.dispose();this.actors.forEach(a=>disposeCarVisual(a.mesh));this.people.forEach(p=>{p.mixer?.stopAllAction();if(p.mixer)p.mixer.uncacheRoot(p.mixer.getRoot());disposePersonVisual(p.mesh);if(p.bleed){p.bleed.removeFromParent();p.bleed.geometry.dispose();(p.bleed.material as THREE.Material).dispose();}});
  this.footMixer?.stopAllAction();if(this.footMixer)this.footMixer.uncacheRoot(this.footMixer.getRoot());this.footMixer=null;
  disposeCarVisual(this.mesh);disposePersonVisual(this.footMesh);this.world.dispose();}
}
function ControlButton({label,field,controls,engine,className=''}:{label:string;field:ControlField;controls:React.MutableRefObject<Controls>;engine:React.MutableRefObject<EmpireEngine|null>;className?:string}){
 const [held,setHeld]=useState(false),ids=useRef(new Set<number>());
 useEffect(()=>{const reset=()=>{for(const id of ids.current)controls.current.release(id);ids.current.clear();setHeld(false);};window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);for(const id of ids.current)controls.current.release(id);};},[controls]);
 const down=(e:RP<HTMLButtonElement>)=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);ids.current.add(e.pointerId);setHeld(true);controls.current.pointer(e.pointerId,field);engine.current?.unlock();if(field==='punch')engine.current?.punch();};
 const up=(e:RP<HTMLButtonElement>)=>{e.preventDefault();ids.current.delete(e.pointerId);setHeld(ids.current.size>0);controls.current.release(e.pointerId);};
 return <button type="button" className={'be-control '+className+(held?' is-held':'')} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} aria-label={label}>{label}{field==='brake'&&<small>REVERSE</small>}</button>;
}
function SteeringStick({controls,engine,foot}:{controls:React.MutableRefObject<Controls>;engine:React.MutableRefObject<EmpireEngine|null>;foot:boolean}){
 const pointer=useRef<number|null>(null),[offset,setOffset]=useState<[number,number]>([0,0]);
 const reset=()=>{pointer.current=null;controls.current.setStick(0,0);setOffset([0,0]);};
 useEffect(()=>{const resetOnBlur=()=>reset();window.addEventListener('blur',resetOnBlur);document.addEventListener('visibilitychange',resetOnBlur);return()=>{window.removeEventListener('blur',resetOnBlur);document.removeEventListener('visibilitychange',resetOnBlur);controls.current.setStick(0,0);};},[controls]);
 const move=(e:RP<HTMLDivElement>)=>{if(pointer.current!==e.pointerId)return;const box=e.currentTarget.getBoundingClientRect(),radius=box.width*.32;let x=(e.clientX-box.left-box.width/2)/radius,z=(e.clientY-box.top-box.height/2)/radius;const len=Math.max(1,Math.hypot(x,foot?z:0));x/=len;z=foot?z/len:0;controls.current.setStick(Math.abs(x)<.08?0:x,Math.abs(z)<.08?0:-z);setOffset([x*radius,z*radius]);};
 const down=(e:RP<HTMLDivElement>)=>{e.preventDefault();e.stopPropagation();if(pointer.current!==null)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);engine.current?.unlock();move(e);};
 const up=(e:RP<HTMLDivElement>)=>{if(pointer.current===e.pointerId)reset();};
 return <div className={'be-stick '+(foot?'be-stick-foot':'')} role="group" aria-label="Steering stick" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}><span className="be-stick-guide">{foot?'MOVE':'STEER'}</span><i className="be-stick-track"/><span className="be-stick-knob" style={{transform:`translate(${offset[0]}px,${offset[1]}px)`}}><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d={foot?'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3':'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4'} fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></span></div>;
}
function NavigationHUD({hud}:{hud:UI}){
 const [expanded,setExpanded]=useState(false),target=hud.house?null:hud.radar.target,player=hud.radar.player;
 const distance=target?Math.hypot(target[0]-player[0],target[1]-player[1]):0;
 const heading=hud.heading??0,bearing=target?Math.atan2(target[0]-player[0],target[1]-player[1]):heading;
 const angle=-(bearing-heading)*180/Math.PI;
 return <div className="be-navigation"><button className="be-mission-toggle" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-label={hud.house?"Expand safehouse details":"Expand mission details"}>{!hud.house&&<span className="be-nav-arrow" style={{transform:`rotate(${angle}deg)`}} aria-hidden="true">↑</span>}<span><small>{hud.house?'SAFEHOUSE':hud.mode==='campaign'?'ACTIVE JOB':'FREE ROAM'}</small><b>{hud.house?'EXPLORE / UPGRADES':hud.mission}</b></span>{!hud.house&&<em>{target?(distance>999?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m'):'—'}</em>}<i>{expanded?'−':'+'}</i></button>{expanded&&<div className="be-mission-details">{hud.house?'Explore your rooms, upgrade your property or leave to return to the streets.':hud.objective}<small>{hud.house?'Use UPGRADES to open your property options.':`BOOT ${hud.cargo} · Follow the cyan waypoints`}</small></div>}</div>;
}
function MiniMap({radar}:{radar:Radar}){const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(!ctx)return;const mid=60,scale=1.18;
  ctx.clearRect(0,0,120,120);ctx.fillStyle='#0e1b22';ctx.fillRect(0,0,120,120);
  const gx=radar.player[0],gz=radar.player[1];
  const h=radar.viewHeading??0,c=Math.cos(h),s=Math.sin(h);
  const project=(x:number,z:number)=>{const dx=x-gx,dz=z-gz;return [mid+(-c*dx+s*dz)*scale,mid-(s*dx+c*dz)*scale];};
  ctx.strokeStyle='#35454e';ctx.lineWidth=10.5*scale;ctx.lineCap='butt';
  for(const tile of ROAD_TILES){
   if(Math.hypot(tile.x-gx,tile.z-gz)>90)continue;
   for(const bit of [1,2]){if(!(tile.mask&bit))continue;const [x,y]=project(tile.x,tile.z),[nx,ny]=project(tile.x+(bit===2?ROAD_TILE_SIZE:0),tile.z+(bit===1?ROAD_TILE_SIZE:0));ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();}
  }
  function dot(a:[number,number],color:string,r=2.4){const [x,z]=project(...a);if(x<0||x>120||z<0||z>120)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.fill();}
  radar.people.forEach(x=>dot(x,'#d0cdbb',1.2));radar.traffic.forEach(x=>dot(x,'#95afbe',2));radar.cops.forEach(x=>dot(x,'#599eff',3));
  if(radar.parked)dot(radar.parked,'#62c8e6',3.5);
  if(radar.target){const [x,y]=project(...radar.target);dot([gx+Math.sin(Math.atan2(radar.target[0]-gx,radar.target[1]-gz))*Math.min(43,Math.hypot(radar.target[0]-gx,radar.target[1]-gz)),gz+Math.cos(Math.atan2(radar.target[0]-gx,radar.target[1]-gz))*Math.min(43,Math.hypot(radar.target[0]-gx,radar.target[1]-gz))],'#67e2f5',3);}
  ctx.save();ctx.translate(mid,mid);ctx.rotate(-(radar.heading-h));ctx.fillStyle='#ffe6b4';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore();
 },[radar]);return <canvas ref={canvas} width={120} height={120} className="be-minimap" aria-label="Local radar showing player, traffic, police and mission objective"/>;}
export default function CrimeGame(){
 const el=useRef<HTMLDivElement>(null),controls=useRef(new Controls()),engine=useRef<EmpireEngine|null>(null);
 const [hud,setHud]=useState<UI>(initialUi),[menu,setMenu]=useState<'none'|'pause'|'garage'|'trade'|'house'|'jobs'|'map'>('none');

 useEffect(()=>{controls.current.clear();engine.current?.setMenuOpen(menu!=='none');},[menu]);
 useEffect(()=>{
  if(!el.current)return;const game=new EmpireEngine(el.current,controls.current,setHud);engine.current=game;
  const keydown=(e:KeyboardEvent)=>{if(e.repeat&&['e','escape','m'].includes(e.key.toLowerCase()))return;if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
   const k=e.key.toLowerCase();if(game.isMenuOpen()&&k!=='escape')return;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
   if(k==='e')game.action();else if(k==='escape')setMenu(prev=>prev==='none'?'pause':'none');else if(k==='f')game.punch();else if(k==='m')setMenu(prev=>prev==='none'?'jobs':'none');
   controls.current.key(k,true);game.unlock();};
  const keyup=(e:KeyboardEvent)=>{controls.current.key(e.key.toLowerCase(),false);};
  const blur=()=>clearInputs(controls.current);
  const visibility=()=>{if(document.hidden)blur();};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);game.dispose();engine.current=null;};
 },[]);
 const s=engine.current?.getData()??initial();
 const close=()=>{if(menu==='pause')engine.current?.resume();setMenu('none');};
 const openNear=()=>{engine.current?.unlock();
  if(hud.house){engine.current?.action();close();}
  else if(hud.near==='garage'){if(!engine.current?.canUseGarage()){engine.current?.notice('BRING YOUR CAR TO THE GARAGE AND PARK');return;}setMenu('garage');}
  else if(hud.near==='safehouse'){if(hud.speed>6){engine.current?.notice('PARK BEFORE ENTERING THE SAFEHOUSE');return;}engine.current?.action();if(engine.current?.house)setMenu('house');}
  else if(hud.near&&MARKETS.some(m=>m.id===hud.near)){if(hud.speed>6){engine.current?.notice('PARK BEFORE TRADING');return;}if(engine.current?.openMarket(hud.near))setMenu('trade');}
  else engine.current?.action();
 };
 const adjust=(key:keyof Mods|'house'|'garage')=>engine.current?.upgrade(key);
 const item=MARKETS.find(m=>m.id===hud.near);
 const money=(n:number)=>'$'+n.toLocaleString('en-AU');
 return <div className="be-root">
  <style>{`@font-face{font-family:Barlow;src:url("${crimeAssetURL('fonts/BarlowCondensed-SemiBold.ttf')}") format("truetype");font-weight:600;font-display:swap}@font-face{font-family:Rajdhani;src:url("${crimeAssetURL('fonts/Rajdhani-Medium.ttf')}") format("truetype");font-weight:500;font-display:swap}`}</style>
  <div className="be-scene" ref={el} aria-label="Playable 3D top-down open world"/><div className="be-vignette"/>
  <header className="be-hud">
   <div className="be-topline"><div><strong>BLACKTOP <em>EMPIRE</em></strong><span>{hud.area} <i>·</i> {hud.clock??'21:40'}</span></div><button onClick={()=>setMenu('pause')} aria-label="Menu">☰</button></div>
   <div className="be-statusbar"><span className="be-cash">{money(hud.cash)}</span><span className="be-stars" aria-label={'Wanted level '+Math.ceil(hud.heat)}>{'★'.repeat(Math.ceil(hud.heat))}<i>{'☆'.repeat(5-Math.ceil(hud.heat))}</i></span></div>
   <div className="be-mapwrap"><button className="be-radar-panel be-map-open" aria-label="Open city map" onClick={()=>setMenu('map')}><MiniMap radar={hud.radar}/><span>{hud.area}</span></button><NavigationHUD hud={hud}/></div>
  </header>
  <div className="be-speed"><div><b>{hud.foot?'ON FOOT':hud.speed}</b><small>{hud.foot?'EXPLORE':'KM/H'}</small></div><span><i className="be-health-icon">◇</i>{Math.round(hud.hp)}%<i className="be-condition"><u style={{width:Math.max(0,hud.hp)+'%'}}/></i>{!hud.foot&&<em>N₂O {Math.round(hud.nitro)}%</em>}</span></div>
  {hud.message&&<div className="be-banner">{hud.message}</div>}
  {hud.race&&<div className="be-race">{hud.race}</div>}
  {hud.notice&&<div className="be-danger">{hud.notice}</div>}
  {menu==='none'&&<><div className="be-worldactions"><button onClick={()=>{engine.current?.unlock();setMenu(hud.house?'house':'jobs');}}>{hud.house?'UPGRADES':'JOBS'}</button><button className="be-interact" onClick={openNear}>{hud.house?'LEAVE':hud.near===null?(hud.foot?'ENTER CAR':'EXIT CAR'):hud.near==='safehouse'?'SAFEHOUSE':hud.near==='garage'?'GARAGE':'TRADE'}</button></div>
  <div className={'be-controls '+(hud.foot?'be-walking':'')}><SteeringStick controls={controls} engine={engine} foot={hud.foot??false}/><div className="be-pedals">
    {!hud.foot&&<div className="be-secondary"><ControlButton label="DRIFT" field="handbrake" controls={controls} engine={engine} className="be-small"/><ControlButton label="N₂O" field="nitro" controls={controls} engine={engine} className="be-small be-nitro"/></div>}
    {!hud.foot&&<div className="be-primary"><ControlButton label="BRAKE" field="brake" controls={controls} engine={engine}/><ControlButton label="GO" field="throttle" controls={controls} engine={engine} className="be-go"/></div>}
    {hud.foot&&<div className="be-walk-hint">{!hud.house&&<ControlButton label="PUNCH" field="punch" controls={controls} engine={engine} className="be-punch"/>}<small>{hud.house?'Explore your rooms':'F punch · Approach your car to enter'}</small></div>}
   </div></div></>}
  {menu!=='none'&&<div className="be-overlay" role="dialog" aria-modal="true">
   <div className={'be-panel'+(menu==='trade'?' be-trade-panel':'')}><div className="be-panelhead"><strong>{menu==='pause'?'CITY MENU':menu==='trade'?(item?.name??'STREET MARKET'):menu==='garage'?'VEHICLE SHOP':menu==='house'?'MIDTOWN SAFEHOUSE':menu==='map'?'CITY MAP':'JOBS & CAMPAIGN'}</strong><button onClick={close} aria-label="Close menu">✕</button></div>
   {menu==='map'&&<CityMap radar={hud.radar} onPick={id=>{engine.current?.navigateTo(id);close();}}/>}
   {menu==='pause'&&<><p>STREETS NEVER SLEEP. DRIVE, BUILD YOUR EMPIRE AND LOSE THE HEAT.</p><div className="be-columns"><button onClick={()=>{engine.current?.setMode('campaign');close();}}>CAMPAIGN</button><button onClick={()=>{engine.current?.setMode('freeroam');close();}}>FREE ROAM</button></div>
    <button onClick={()=>{engine.current?.resume();close();}}>RESUME DRIVING</button><button onClick={()=>{engine.current?.unlock();close();}}>BACK TO STREETS</button><button onClick={()=>{engine.current?.tow();close();}}>TOW MY VEHICLE TO GARAGE · $180</button><p className="be-note">WASD/arrows drive · SPACE drift · SHIFT nitro · E interact · F punch · M jobs. Progress autosaves.</p></>}
   {menu==='trade'&&<TradePanel save={s} market={item??null} onDeal={request=>engine.current!.deal(request)} onNavigate={id=>{engine.current?.navigateTo(id);close();}}/>}
   {menu==='garage'&&<><p>OWNED CARS · PURCHASE · MOD · REPAIR</p><div className="be-columns">{(['sedan','sedan-sports','taxi','suv','race','police'] as CarStyle[]).map(c=><button key={c} onClick={()=>engine.current?.purchaseCar(c)}>{c.toUpperCase()}<small>{s.owned.includes(c)?'OWNED · SELECT':c==='race'?'$11,000':c==='sedan-sports'?'$5,500':c==='police'?'$9,000':c==='suv'?'$3,800':'$1,700'}</small></button>)}</div>
    <button onClick={()=>engine.current?.repair()}>FULL BODY / ENGINE REPAIR</button>
    <p>CUSTOM BODYWORK · ALL MODS SAVED TO THIS VEHICLE</p>
    <div className="be-colors">{[0xd45f3d,0x40a3e2,0xe6d1a6,0x292e39,0x58aa6c,0xe5ca38,0xbd426f,0x6a55bf].map(color=><button type="button" key={color} title={'Paint '+color.toString(16)} className={activeBuild(s).paint===color?'active':''} style={{backgroundColor:'#'+color.toString(16).padStart(6,'0')}} onClick={()=>engine.current?.customize('paint',color)} aria-label={'Install paint '+color.toString(16)} />)}</div>
    <div className="be-columns"><button onClick={()=>engine.current?.customize('spoiler')}>3D REAR SPOILER · $450<small>{activeBuild(s).spoiler?'INSTALLED':'AERO COSMETIC'}</small></button>
    <button onClick={()=>engine.current?.customize('neon')}>UNDERBODY GLOW · $700<small>{activeBuild(s).neon?'INSTALLED':'CAR MATCHED'}</small></button></div>
    {(['engine','tires','brakes','armor'] as (keyof Mods)[]).map(k=><button key={k} onClick={()=>adjust(k)}>{k.toUpperCase()} · LEVEL {activeBuild(s).mods[k]}/3 · {money(350*(activeBuild(s).mods[k]+1))}</button>)}</>}
   {menu==='house'&&<><p>YOUR ENTERABLE SAFEHOUSE · PERSONAL GARAGE · STORAGE · HIDEOUT</p><p>HOUSE LEVEL {s.houseLevel} · GARAGE LEVEL {s.garageLevel}</p>
    <div className="be-columns"><button onClick={()=>adjust('house')}>UPGRADE ROOMS · {money(550*(s.houseLevel+1))}</button><button onClick={()=>adjust('garage')}>EXPAND GARAGE/STASH · {money(650*(s.garageLevel+1))}</button></div>
    <SafehouseStorage save={s} canTransfer={engine.current?.canTransferCargo()??false} onTransfer={(good,qty)=>engine.current!.moveCargo(good,qty)} onBank={amount=>engine.current!.bankCash(amount)}/>
    <button onClick={()=>{engine.current?.repair();}}>REPAIR YOUR CAR</button><button onClick={()=>{engine.current?.action();close();}}>EXIT SAFEHOUSE</button></>}
   {menu==='jobs'&&<><p>CAMPAIGN: {s.completed.length} / {MISSIONS.length} COMPLETED. FREE ROAM ALWAYS OPEN.</p>
    <MarketIntel save={s} onNavigate={id=>{engine.current?.navigateTo(id);close();}}/>
    <p>DISTRICT MARKETS · SET A ROUTE</p><div className="be-columns">{MARKETS.map(m=><button key={m.id} onClick={()=>{engine.current?.navigateTo(m.id);close();}}>{m.name}<small>{districtAt(m.x,m.z).name} · {Math.round(Math.hypot(m.x-hud.radar.player[0],m.z-hud.radar.player[1]))} m</small></button>)}</div><button onClick={()=>{engine.current?.clearWaypoint();close();}}>RETURN TO STORY ROUTE</button>
    {MISSIONS.map((m,i)=><div key={m.title} className={'be-job '+(s.mission===i?'active':'')}><b>{i+1}. {m.title}</b><span>{m.brief}</span><small>{s.completed.includes(i)?'COMPLETED':s.mission===i?'ACTIVE':s.mission<i?'LOCKED':'UP NEXT'} · {money(m.reward)}</small></div>)}
    <div className="be-columns"><button onClick={()=>{engine.current?.setMode('campaign');close();}}>CONTINUE STORY</button><button onClick={()=>{engine.current?.setMode('freeroam');close();}}>EXPLORE CITY</button></div></>}
   <p className="be-note">BLACKTOP EMPIRE · EARLY PLAYABLE FOUNDATION · ORIGINAL 18+ FICTIONAL CRIME GAME</p>
   </div></div>}
 </div>;
}

