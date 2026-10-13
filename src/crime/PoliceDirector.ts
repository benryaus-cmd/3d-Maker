import {STREET_NODES,nearestStreet,roadRoute} from './CityLayout.ts';
import type {Wall} from './vehiclePhysics';
export type PolicePoint={x:number;z:number};
export type PoliceStage='idle'|'incident'|'dispatch'|'pursuit'|'search'|'cooldown'|'escaped';
export type PoliceIncident=PolicePoint&{severity:number;witnessId?:string;vehicleId?:string};
export type PoliceUnit=PolicePoint&{id:string;heading?:number};
export type PoliceTarget=PolicePoint&{speed:number;onFoot:boolean;vehicleId?:string;vx?:number;vz?:number};
export type PoliceRoadblock=PolicePoint&{id:string;nodeId:string;heading:number;announcedAt:number;deployAt:number;expiresAt:number};
export type PoliceState={version:1;clock:number;stage:PoliceStage;heat:number;notoriety:number;vehicleNotoriety:Record<string,number>;reportedBy:string|null;lastKnown:PolicePoint|null;lastSeenAt:number;reportAt:number;searchAt:number;cooldownAt:number;arrestProgress:number;roadblock:PoliceRoadblock|null;roadblockSequence:number};
export type PoliceStepInput={target:PoliceTarget;units:PoliceUnit[];walls:Wall[];safehouse?:boolean};
export type PoliceGuidance={unitId:string;destination:PolicePoint;role:'pursuer'|'interceptor'|'search';visible:boolean};
export type PoliceResponse={stage:PoliceStage;heat:number;notoriety:number;desiredUnitCount:number;intensity:number;guidance:PoliceGuidance[];arrested:boolean;canEnterSafehouse:boolean;roadblock:PoliceRoadblock|null;lastKnown:PolicePoint|null;searchRadius:number};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const point=(v:unknown):v is PolicePoint=>!!v&&typeof v==='object'&&finite((v as PolicePoint).x)&&finite((v as PolicePoint).z);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const distance=(a:PolicePoint,b:PolicePoint)=>Math.hypot(a.x-b.x,a.z-b.z);
const copyPoint=(p:PolicePoint):PolicePoint=>({x:p.x,z:p.z});
export function createPoliceState(legacyHeat=0):PoliceState{
 const heat=finite(legacyHeat)?clamp(legacyHeat,0,5):0;
 return {version:1,clock:0,stage:heat>0?'dispatch':'idle',heat,notoriety:heat*.25,vehicleNotoriety:{},reportedBy:null,lastKnown:null,lastSeenAt:0,reportAt:heat>0?3:0,searchAt:0,cooldownAt:0,arrestProgress:0,roadblock:null,roadblockSequence:0};
}
/** Persist only serializable perception knowledge; never save live actor references. */
export function restorePoliceState(saved:unknown,legacyHeat=0):PoliceState{
 const fallback=createPoliceState(legacyHeat);
 if(!saved||typeof saved!=='object')return fallback;
 const s=saved as PoliceState;
 if(s.version!==1||!['idle','incident','dispatch','pursuit','search','cooldown','escaped'].includes(s.stage)||
  !['clock','heat','notoriety','lastSeenAt','reportAt','searchAt','cooldownAt','arrestProgress','roadblockSequence'].every(k=>finite(s[k as keyof PoliceState])&&(s[k as keyof PoliceState] as number)>=0)||
  s.heat>5||s.notoriety>5||(s.lastKnown!==null&&!point(s.lastKnown))||
  !(s.reportedBy===null||typeof s.reportedBy==='string')||!s.vehicleNotoriety||typeof s.vehicleNotoriety!=='object'||
  Object.values(s.vehicleNotoriety).some(v=>!finite(v)||v<0||v>5))return fallback;
 const roadblock=s.roadblock;
 if(roadblock!==null&&(!point(roadblock)||typeof roadblock.id!=='string'||!STREET_NODES.has(roadblock.nodeId)||
  ![roadblock.heading,roadblock.announcedAt,roadblock.deployAt,roadblock.expiresAt].every(finite)||roadblock.deployAt<roadblock.announcedAt+6||roadblock.expiresAt<roadblock.deployAt))return fallback;
 return {...s,lastKnown:s.lastKnown?copyPoint(s.lastKnown):null,vehicleNotoriety:{...s.vehicleNotoriety},roadblock:roadblock?{...roadblock}:null};
}
/** Segment/slab intersection handles thin walls and endpoints; broken furniture is transparent. */
export function policeLineOfSight(from:PolicePoint,to:PolicePoint,walls:readonly Wall[]):boolean{
 for(const wall of walls){
  if(wall.broken||wall.w<=0||wall.d<=0)continue;
  let enter=0,exit=1;
  for(const [origin,delta,lo,hi] of [[from.x,to.x-from.x,wall.x-wall.w/2,wall.x+wall.w/2],[from.z,to.z-from.z,wall.z-wall.d/2,wall.z+wall.d/2]]){
   if(Math.abs(delta)<1e-8){if(origin<lo||origin>hi){enter=2;break;}continue;}
   const a=(lo-origin)/delta,b=(hi-origin)/delta;
   enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if(enter<=exit&&exit>=0&&enter<=1)return false;
 }
 return true;
}
/** Caller owns physics, spawning and pause: this clock advances only through step(dt). */
export class PoliceDirector{
 private state:PoliceState;
 constructor(saved?:unknown,legacyHeat=0){this.state=restorePoliceState(saved,legacyHeat);}
 get heat(){return this.state.heat;}
 get stage(){return this.state.stage;}
 snapshot():PoliceState{return restorePoliceState(this.state);}
 reportIncident(incident:PoliceIncident):void{
  if(!point(incident)||!finite(incident.severity)||incident.severity<=0)return;
  const s=this.state,wasActive=s.heat>0;
  s.heat=clamp(s.heat+incident.severity,0,5);s.notoriety=clamp(s.notoriety+incident.severity*.25,0,5);
  if(incident.vehicleId)s.vehicleNotoriety[incident.vehicleId]=clamp((s.vehicleNotoriety[incident.vehicleId]??0)+incident.severity*.35,0,5);
  // A report is a location provided by a named witness, not a permanent live target feed.
  s.lastKnown=copyPoint(incident);s.reportedBy=incident.witnessId??'dispatch';
  if(!wasActive||s.stage==='cooldown'||s.stage==='escaped'){
   s.stage='incident';s.reportAt=s.clock+3;s.arrestProgress=0;s.searchAt=0;s.roadblock=null;s.roadblockSequence=0;
  }
 }
 clearAfterArrest():void{
  const s=this.state;this.state={...createPoliceState(),clock:s.clock,notoriety:s.notoriety,vehicleNotoriety:{...s.vehicleNotoriety}};
 }
 private planRoadblock(target:PoliceTarget):void{
  const s=this.state;if(!s.lastKnown||s.roadblockSequence>0)return;
  const origin=s.lastKnown,vx=target.vx??0,vz=target.vz??0,v=Math.hypot(vx,vz);
  const aim=v>.5?{x:origin.x+vx/v*75,z:origin.z+vz/v*75}:nearestStreet(origin.x,origin.z+75);
  const route=roadRoute(origin,aim),candidate=route.find(p=>distance(origin,p)>=55);
  if(!candidate)return;
  const node=STREET_NODES.get(nearestStreet(candidate.x,candidate.z).nodeId);if(!node)return;
  const next=STREET_NODES.get(node.neighbors[0]);if(!next)return;
  s.roadblockSequence++;
  s.roadblock={id:`roadblock-${s.roadblockSequence}`,nodeId:node.id,x:node.x,z:node.z,heading:Math.atan2(next.x-node.x,next.z-node.z),announcedAt:s.clock,deployAt:s.clock+7,expiresAt:s.clock+30};
 }
 step(dt:number,input:PoliceStepInput):PoliceResponse{
  const s=this.state,advance=finite(dt)&&dt>0?dt:0;
  if(advance>0){
   s.clock+=advance;
   if(s.stage==='incident'&&s.clock>=s.reportAt-2.5)s.stage='dispatch';
   const ready=s.heat>0&&s.clock>=s.reportAt;
   const visible=ready&&!input.safehouse?input.units.filter(u=>distance(u,input.target)<=65&&policeLineOfSight(u,input.target,input.walls)):[];
   if(visible.length){
    s.stage='pursuit';s.lastKnown=copyPoint(input.target);s.lastSeenAt=s.clock;
    s.reportedBy=visible[0].id;s.searchAt=0;s.cooldownAt=0;
    if(s.heat>=3)this.planRoadblock(input.target);
   }else if(ready){
    if(s.stage==='dispatch'||s.stage==='pursuit'&&s.clock-s.lastSeenAt>=1.2){s.stage='search';s.searchAt=s.clock;}
    if(s.stage==='search'&&s.clock-s.searchAt>=18+s.heat*2){s.stage='cooldown';s.cooldownAt=s.clock;}
    if(s.stage==='cooldown'&&s.clock-s.cooldownAt>=8){s.stage='escaped';s.heat=0;s.roadblock=null;}
   }
   // Speed is supplied from the actual controlled body, including on-foot movement.
   const arrest=visible.some(u=>distance(u,input.target)<5.5)&&s.heat>=1.25&&input.target.speed<3.5;
   s.arrestProgress=arrest?s.arrestProgress+Math.min(advance,Math.max(0,s.clock-s.reportAt)):Math.max(0,s.arrestProgress-advance*2);
   if(s.roadblock&&s.clock>s.roadblock.expiresAt)s.roadblock=null;
  }
  const ready=s.heat>0&&s.clock>=s.reportAt;
  const guidance:PoliceGuidance[]=ready&&s.lastKnown?input.units.map((unit,index)=>{
   const visible=!input.safehouse&&distance(unit,input.target)<=65&&policeLineOfSight(unit,input.target,input.walls);
   let destination=copyPoint(s.lastKnown!),role:PoliceGuidance['role']=s.stage==='pursuit'?'pursuer':'search';
   if(s.stage==='pursuit'&&visible&&index>0&&s.heat>=2){
    const vx=input.target.vx??0,vz=input.target.vz??0;
    destination=nearestStreet(s.lastKnown!.x+vx*1.5,s.lastKnown!.z+vz*1.5);role='interceptor';
   }else if(s.stage!=='pursuit'){
    const near=STREET_NODES.get(nearestStreet(s.lastKnown!.x,s.lastKnown!.z).nodeId)!;
    const direction=near.neighbors[(index+Math.floor(Math.max(0,s.clock-s.searchAt)/6))%near.neighbors.length];
    const neighbor=STREET_NODES.get(direction);if(neighbor)destination=copyPoint(neighbor);
   }
   return {unitId:unit.id,destination,role,visible};
  }):[];
  const active=ready&&s.stage!=='escaped'&&s.stage!=='idle';
  return {stage:s.stage,heat:s.heat,notoriety:s.notoriety,desiredUnitCount:active?Math.min(7,Math.ceil(s.heat*1.3)):0,intensity:s.stage==='pursuit'?1:s.stage==='search'?.55:s.stage==='cooldown'?.2:0,guidance,arrested:s.arrestProgress>=3.3,canEnterSafehouse:!ready||!input.units.some(u=>distance(u,input.target)<=65&&policeLineOfSight(u,input.target,input.walls)),roadblock:s.roadblock?{...s.roadblock}:null,lastKnown:s.lastKnown?copyPoint(s.lastKnown):null,searchRadius:s.stage==='search'?Math.min(65,20+Math.max(0,s.clock-s.searchAt)*2):0};
 }
}
