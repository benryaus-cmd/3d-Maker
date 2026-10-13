/** Engine-free, fixed-step street firearms. Heading zero faces +Z. */
export type WeaponId='pistol'|'shotgun'|'smg';
export interface WeaponDefinition {name:string;magazine:number;startingReserve:number;damage:number;range:number;cadence:number;reload:number;pellets:number;spread:number;recoil:number;ammoCost:number;unlockCost:number;ammoPackSize:number;ammoPackCost:number}
export const WEAPON_DEFINITIONS:Record<WeaponId,WeaponDefinition>={
 pistol:{name:'Pistol',magazine:12,startingReserve:48,damage:27,range:38,cadence:.32,reload:1.25,pellets:1,spread:0,recoil:.12,ammoCost:3,unlockCost:0,ammoPackSize:24,ammoPackCost:72},
 shotgun:{name:'Shotgun',magazine:6,startingReserve:18,damage:13,range:19,cadence:.85,reload:1.9,pellets:7,spread:.16,recoil:.35,ammoCost:8,unlockCost:650,ammoPackSize:12,ammoPackCost:96},
 smg:{name:'SMG',magazine:24,startingReserve:72,damage:12,range:30,cadence:.105,reload:1.65,pellets:1,spread:.035,recoil:.08,ammoCost:2,unlockCost:1200,ammoPackSize:48,ammoPackCost:96},
};
const ids:WeaponId[]=['pistol','shotgun','smg'];
export interface Arsenal {selected:WeaponId;unlocked:WeaponId[];ammo:Record<WeaponId,{magazine:number;reserve:number}>;cooldown:number;reloadRemaining:number;reloading:WeaponId|null;shotsFired:number}
const finite=(n:unknown,fallback=0):number=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
const bounded=(n:unknown,max:number,fallback=0)=>Math.min(max,Math.max(0,finite(n,fallback)));
export function createArsenal():Arsenal {return {selected:'pistol',unlocked:['pistol'],ammo:{pistol:{magazine:12,reserve:48},shotgun:{magazine:6,reserve:18},smg:{magazine:24,reserve:72}},cooldown:0,reloadRemaining:0,reloading:null,shotsFired:0};}
/** Invalid/corrupt saves cannot manufacture infinite magazines or timers. */
export function restoreArsenal(raw:unknown):Arsenal {
 const state=createArsenal();if(!raw||typeof raw!=='object')return state;
 const r=raw as Partial<Arsenal>;
 state.unlocked=ids.filter(id=>id==='pistol'||(Array.isArray(r.unlocked)&&r.unlocked.includes(id)));
 if(r.selected&&state.unlocked.includes(r.selected))state.selected=r.selected;
 for(const id of ids){const a=r.ammo?.[id];if(a){state.ammo[id]={magazine:Math.floor(bounded(a.magazine,WEAPON_DEFINITIONS[id].magazine)),reserve:Math.floor(bounded(a.reserve,999))};}}
 state.cooldown=bounded(r.cooldown,2);state.shotsFired=Math.floor(bounded(r.shotsFired,1e9));
 if(r.reloading===state.selected){state.reloadRemaining=bounded(r.reloadRemaining,WEAPON_DEFINITIONS[state.selected].reload);if(state.reloadRemaining>0)state.reloading=r.reloading;}
 return state;
}
export function stepArsenal(state:Arsenal,dt:number):void {
 const step=bounded(dt,60);state.cooldown=Math.max(0,state.cooldown-step);
 if(!state.reloading)return;state.reloadRemaining=Math.max(0,state.reloadRemaining-step);
 if(state.reloadRemaining>0)return;
 const id=state.reloading,a=state.ammo[id],amount=Math.min(WEAPON_DEFINITIONS[id].magazine-a.magazine,a.reserve);
 a.magazine+=amount;a.reserve-=amount;state.reloading=null;
}
export function selectWeapon(state:Arsenal,id:WeaponId):boolean {
 if(!state.unlocked.includes(id))return false;
 if(state.selected!==id){state.reloading=null;state.reloadRemaining=0;state.selected=id;}
 return true;
}
export function unlockWeapon(state:Arsenal,id:WeaponId):boolean {if(!ids.includes(id)||state.unlocked.includes(id))return false;state.unlocked=ids.filter(key=>key===id||state.unlocked.includes(key));return true;}
export function reloadWeapon(state:Arsenal):boolean {
 const id=state.selected,a=state.ammo[id];if(state.reloading||a.reserve<=0||a.magazine>=WEAPON_DEFINITIONS[id].magazine)return false;
 state.reloading=id;state.reloadRemaining=WEAPON_DEFINITIONS[id].reload;return true;
}
export interface Point {x:number;z:number}
export interface Shooter extends Point {heading:number}
export interface ShotWall extends Point {w:number;d:number;broken?:boolean;id?:string|number}
export interface ShotTarget extends Point {id?:string|number;kind?:'actor'|'car';hp:number;radius?:number;heading?:number;halfWidth?:number;halfLength?:number}
export interface ShotHit {kind:'actor'|'car'|'wall';id:string|number;index:number;damage:number}
export interface ShotRay {start:Point;end:Point;hit:ShotHit|null}
export interface ShotResult {fired:boolean;weapon:WeaponId;reason?:'cooldown'|'reloading'|'empty'|'invalid';rays:ShotRay[];hits:ShotHit[];damage:number}
const validPoint=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.z);
/** Ray interval slabs, including origins on/in cover and tangent contacts. */
function boxDistance(origin:Point,dir:Point,center:Point,hx:number,hz:number,max:number):number|null {
 if(!validPoint(center)||!Number.isFinite(hx)||!Number.isFinite(hz)||hx<=0||hz<=0)return null;
 let near=0,far=max;
 for(const axis of ['x','z'] as const){const half=axis==='x'?hx:hz,lo=center[axis]-half,hi=center[axis]+half;
  if(Math.abs(dir[axis])<1e-10){if(origin[axis]<lo||origin[axis]>hi)return null;continue;}
  const a=(lo-origin[axis])/dir[axis],b=(hi-origin[axis])/dir[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;
 }
 return near<=max?near:null;
}
function targetDistance(o:Point,d:Point,t:ShotTarget,max:number):number|null {
 if(!validPoint(t)||!Number.isFinite(t.hp)||(t.kind!=='car'&&t.hp<=0))return null;
 if(t.kind==='car'){
  const h=finite(t.heading),c=Math.cos(h),s=Math.sin(h),x=o.x-t.x,z=o.z-t.z;
  return boxDistance({x:x*c-z*s,z:x*s+z*c},{x:d.x*c-d.z*s,z:d.x*s+d.z*c},{x:0,z:0},t.halfWidth??1,t.halfLength??2,max);
 }
 const r=bounded(t.radius??.48,5,.48);if(r<=0)return null;
 const x=o.x-t.x,z=o.z-t.z,b=x*d.x+z*d.z,c=x*x+z*z-r*r;
 if(c<=0)return 0;const disc=b*b-c;if(disc<0)return null;
 const n=-b-Math.sqrt(disc);return n>=0&&n<=max?n:null;
}
export function hasLineOfSight(from:Point,to:Point,walls:readonly ShotWall[],cover:readonly ShotTarget[]=[]):boolean {
 if(!validPoint(from)||!validPoint(to))return false;
 const distance=Math.hypot(to.x-from.x,to.z-from.z);if(distance<1e-6)return true;
 const dir={x:(to.x-from.x)/distance,z:(to.z-from.z)/distance};
 return !walls.some(w=>!w.broken&&boxDistance(from,dir,w,w.w/2,w.d/2,distance-.001)!==null)&&!cover.some(t=>t.kind==='car'&&targetDistance(from,dir,t,distance-.001)!==null);
}
/** Mutates ammunition/timers only; caller applies returned damage and effects. */
export function shootWeapon(state:Arsenal,origin:Shooter,targets:readonly ShotTarget[],walls:readonly ShotWall[],_clock:number):ShotResult {
 const result:ShotResult={fired:false,weapon:state.selected,rays:[],hits:[],damage:0};
 if(!validPoint(origin)||!Number.isFinite(origin.heading)){result.reason='invalid';return result;}
 if(state.reloading){result.reason='reloading';return result;}if(state.cooldown>1e-8){result.reason='cooldown';return result;}
 const def=WEAPON_DEFINITIONS[state.selected],ammo=state.ammo[state.selected];if(ammo.magazine<=0){result.reason='empty';return result;}
 ammo.magazine--;state.cooldown=def.cadence;state.shotsFired=Math.min(1e9,state.shotsFired+1);result.fired=true;
 for(let pellet=0;pellet<def.pellets;pellet++){
  // Deterministic spread is replayable and avoids random state on pause/reload.
  const offset=def.pellets>1?(pellet/(def.pellets-1)*2-1)*def.spread:state.selected==='smg'?Math.sin(state.shotsFired*2.39996)*def.spread:0;
  const h=origin.heading+offset,dir={x:Math.sin(h),z:Math.cos(h)};let distance=def.range,hit:ShotHit|null=null;
  walls.forEach((w,index)=>{if(w.broken)return;const d=boxDistance(origin,dir,w,w.w/2,w.d/2,distance);if(d!==null&&d<=distance){distance=d;hit={kind:'wall',id:w.id??index,index,damage:0};}});
  targets.forEach((t,index)=>{const d=targetDistance(origin,dir,t,distance);if(d!==null&&d<distance){distance=d;const falloff=state.selected==='shotgun'?Math.max(.35,1-distance/def.range*.6):1;hit={kind:t.kind??'actor',id:t.id??index,index,damage:t.hp<=0?0:Math.round(def.damage*falloff)};}});
  result.rays.push({start:{x:origin.x,z:origin.z},end:{x:origin.x+dir.x*distance,z:origin.z+dir.z*distance},hit});
  if(hit){const existing=result.hits.find(h=>h.kind===hit!.kind&&h.index===hit!.index);if(existing)existing.damage+=hit.damage;else result.hits.push({...hit});}
 }
 result.damage=result.hits.reduce((sum,h)=>sum+h.damage,0);return result;
}
export interface EnemyCombatState {cooldown:number;windup:number;alert:number;lastSeen:Point|null;strafe:number;coverGoal:Point|null}
export type EnemyCombatMode='idle'|'investigate'|'windup'|'attack'|'cover'|'reposition'|'retreat';
export interface EnemyCombatIntent {mode:EnemyCombatMode;vx:number;vz:number;heading:number;shoot:boolean;windup:number;visible:boolean}
export function createEnemyCombat(seed=0):EnemyCombatState {return {cooldown:0,windup:0,alert:0,lastSeen:null,strafe:seed%2===0?1:-1,coverGoal:null};}
/** Perception and velocity intent only. Caller uses normal actor collision/movement. */
export function enemyCombatIntent(state:EnemyCombatState,actor:Shooter&{hp:number},player:(Point&{hp?:number})|null,dt:number,_clock:number,walls:readonly ShotWall[],covers:readonly ShotTarget[]=[]):EnemyCombatIntent {
 const step=bounded(dt,1);state.cooldown=Math.max(0,state.cooldown-step);state.alert=Math.max(0,state.alert-step);
 const intent:EnemyCombatIntent={mode:'idle',vx:0,vz:0,heading:actor.heading,shoot:false,windup:0,visible:false};
 if(!player||actor.hp<=0||(player.hp!==undefined&&player.hp<=0)||!validPoint(actor)||!validPoint(player)){state.windup=0;return intent;}
 const dx=player.x-actor.x,dz=player.z-actor.z,distance=Math.hypot(dx,dz),nx=distance>.001?dx/distance:0,nz=distance>.001?dz/distance:1;
 intent.visible=distance<=42&&hasLineOfSight(actor,player,walls,covers);intent.heading=Math.atan2(nx,nz);
 if(intent.visible){state.alert=6;state.lastSeen={x:player.x,z:player.z};}
 if(state.alert<=0){state.windup=0;return intent;}
 if(actor.hp<=28){state.windup=0;return {...intent,mode:'retreat',vx:-nx*3.1,vz:-nz*3.1};}
 if(!intent.visible){state.windup=0;const last=state.lastSeen;if(!last)return intent;const lx=last.x-actor.x,lz=last.z-actor.z,l=Math.hypot(lx,lz);return {...intent,mode:l<2?'cover':'investigate',vx:l<2?0:lx/l*1.9,vz:l<2?0:lz/l*1.9};}
 if(distance>23||distance<5){state.windup=0;const sign=distance<5?-1:1;return {...intent,mode:'reposition',vx:nx*2.1*sign,vz:nz*2.1*sign};}
 if(state.cooldown>0){
  // Select a nearby world-space point behind actual solid cover. Movement is
  // still applied by the caller through the same collision solver as walking.
  let goal:Point|null=null,nearest=12;
  const boxes=[...walls.filter(w=>!w.broken),...covers.filter(c=>c.kind==='car').map(c=>({x:c.x,z:c.z,w:2*(c.halfWidth??1),d:2*(c.halfLength??2)}))];
  for(const box of boxes){if(!validPoint(box)||!Number.isFinite(box.w)||!Number.isFinite(box.d))continue;
   const points=[{x:box.x-box.w/2-.7,z:box.z},{x:box.x+box.w/2+.7,z:box.z},{x:box.x,z:box.z-box.d/2-.7},{x:box.x,z:box.z+box.d/2+.7}];
   for(const point of points){const range=Math.hypot(point.x-actor.x,point.z-actor.z);if(range<nearest&&!hasLineOfSight(player,point,walls,covers)){nearest=range;goal=point;}}
  }
  state.coverGoal=goal;
  if(goal){const gx=goal.x-actor.x,gz=goal.z-actor.z,g=Math.hypot(gx,gz);return {...intent,mode:'cover',vx:g>.3?gx/g*1.6:0,vz:g>.3?gz/g*1.6:0};}
  return {...intent,mode:'reposition',vx:nz*state.strafe*.7,vz:-nx*state.strafe*.7};
 }
 if(state.windup<=0){state.windup=.42;return {...intent,mode:'windup',windup:state.windup};}
 state.windup=Math.max(0,state.windup-step);if(state.windup>0)return {...intent,mode:'windup',windup:state.windup};
 state.cooldown=1.15;return {...intent,mode:'attack',shoot:true};
}
/** Hearing creates an investigation, never a shot through unknown cover. */
export function hearGunshot(state:EnemyCombatState,actor:Point,source:Point,range=45):boolean {
 if(!validPoint(actor)||!validPoint(source)||Math.hypot(source.x-actor.x,source.z-actor.z)>bounded(range,100,45))return false;
 state.alert=Math.max(state.alert,6);state.lastSeen={x:source.x,z:source.z};return true;
}
