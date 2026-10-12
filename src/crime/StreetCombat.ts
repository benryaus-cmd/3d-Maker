import * as THREE from 'three';

export interface Combatant {
 x:number; z:number; heading:number; hp:number; aggressive:boolean;
 /** Remaining seconds; only npcCombatIntent advances these timers. */
 hostile:number; hitCooldown:number; stun:number;
}
export interface FootAttacker {x:number;z:number;heading:number;hp?:number}
export interface PunchResult<T extends Combatant> {attempted:boolean;target:T|null;damage:number}
export interface CombatIntent {mode:'idle'|'stunned'|'fight'|'flee';vx:number;vz:number;damage:number;punch:boolean}
export const PUNCH_DURATION=.42;

/** Heading zero faces +Z, matching vehicle and pedestrian coordinates. */
export class StreetCombat {
 nextPunchAt=0;
 punch<T extends Combatant>(attacker:FootAttacker,targets:readonly T[],time:number):PunchResult<T>{
  if(time<this.nextPunchAt)return {attempted:false,target:null,damage:0};
  this.nextPunchAt=time+.48;
  let target:T|null=null,nearest=2.25;
  const fx=Math.sin(attacker.heading),fz=Math.cos(attacker.heading);
  for(const p of targets){
   if(p.hp<=0)continue;
   const dx=p.x-attacker.x,dz=p.z-attacker.z,d=Math.hypot(dx,dz);
   if(d>nearest||(d>.001&&(dx*fx+dz*fz)/d<=.25))continue;
   nearest=d;target=p;
  }
  if(!target)return {attempted:true,target:null,damage:0};
  const damage=Math.min(28,target.hp);
  target.hp=Math.max(0,target.hp-damage);target.hostile=12;target.stun=.3;
  // Short readable recoil; caller may clamp the new position to walkable space.
  target.x+=fx*.22;target.z+=fz*.22;
  return {attempted:true,target,damage};
 }
}

/** Stable personality, independent of render timing or subsequent hits. */
export function aggressiveFromSeed(seed:number):boolean {
 let n=(seed|0)^0x9e3779b9;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);
 return ((n^(n>>>16))>>>0)/4294967296<.3;
}

/** Call once per simulation step. Apply velocity through normal collision handling. */
export function npcCombatIntent(p:Combatant,player:FootAttacker|null,dt:number,_clock:number):CombatIntent {
 const step=Math.max(0,dt);
 p.hostile=Math.max(0,p.hostile-step);p.hitCooldown=Math.max(0,p.hitCooldown-step);p.stun=Math.max(0,p.stun-step);
 const idle:CombatIntent={mode:'idle',vx:0,vz:0,damage:0,punch:false};
 if(p.hp<=0||p.hostile===0||!player||(player.hp!==undefined&&player.hp<=0))return idle;
 if(p.stun>0)return {...idle,mode:'stunned'};
 const dx=player.x-p.x,dz=player.z-p.z,d=Math.hypot(dx,dz),nx=d>.001?dx/d:Math.sin(p.heading),nz=d>.001?dz/d:Math.cos(p.heading);
 if(!p.aggressive){
  p.heading=Math.atan2(-nx,-nz);
  return {...idle,mode:'flee',vx:-nx*3.4,vz:-nz*3.4};
 }
 p.heading=Math.atan2(nx,nz);
 if(d>1.8)return {...idle,mode:'fight',vx:nx*2.6,vz:nz*2.6};
 if(p.hitCooldown>0)return {...idle,mode:'fight'};
 p.hitCooldown=1;
 return {...idle,mode:'fight',damage:9,punch:true};
}

// Quaternius Ultimate Animated Character Pack, CC0. These authored punch
// quaternions are sampled at 0.10 / 0.40 s from bundled casual-male.glb's Punch
// clip. Names below are the verified GLTFLoader-sanitized rig names.
const poseNames=['Torso','UpperArmR','LowerArmR','UpperArmL','LowerArmL'] as const;
const windup=[
 [.156192,.054031,.01812,.986081],[.018115,.752437,.558303,.34901],[.372958,-.245258,.450575,.773132],[-.097199,-.608515,-.766906,.179212],[.081619,-.178459,-.600929,.774839],
].map(q=>new THREE.Quaternion(...q as [number,number,number,number]).normalize());
const extension=[
 [.162552,-.022244,.028494,.986038],[.46513,.686787,.457532,.320379],[-.013498,-.03233,.035893,.998741],[-.097199,-.608515,-.766906,.179212],[.029131,-.076921,-.570193,.817383],
].map(q=>new THREE.Quaternion(...q as [number,number,number,number]).normalize());
interface PoseRig {bones:(THREE.Object3D|null)[];base:THREE.Quaternion[];applied:boolean}
const rigs=new WeakMap<THREE.Object3D,PoseRig>();
const poseTarget=new THREE.Quaternion();
/** REQUIRED frame order: restorePunchPose → mixer.update → applyPunchPose. */
export function restorePunchPose(root:THREE.Object3D):void {
 const rig=rigs.get(root);if(!rig?.applied)return;
 rig.bones.forEach((bone,i)=>{if(bone)bone.quaternion.copy(rig.base[i]);});rig.applied=false;
}
/** Overlay an arm windup, extension, and recovery while legs keep animating. */
export function applyPunchPose(root:THREE.Object3D,age:number):void {
 if(age<0||age>=PUNCH_DURATION)return;
 let rig=rigs.get(root);
 if(!rig){rig={bones:poseNames.map(n=>root.getObjectByName(n)??null),base:poseNames.map(()=>new THREE.Quaternion()),applied:false};rigs.set(root,rig);}
 // Makes repeat calls without an intervening mixer update idempotent.
 if(rig.applied)restorePunchPose(root);
 const blend=Math.min(1,age/.055,(PUNCH_DURATION-age)/.12),reach=THREE.MathUtils.smoothstep(age,.07,.21);
 rig.bones.forEach((bone,i)=>{if(!bone)return;rig.base[i].copy(bone.quaternion);poseTarget.copy(windup[i]).slerp(extension[i],reach);bone.quaternion.slerp(poseTarget,blend);});
 rig.applied=true;
}
