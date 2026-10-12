import type {Wall} from './vehiclePhysics';
export type ImpactBody={x:number;z:number;y:number;vx:number;vz:number;vy:number;roll:number;spin:number;settled:boolean};
/** A bounded ballistic body, used for pedestrian impacts rather than an instant static death pose. */
export function impactBody(x:number,z:number,vx:number,vz:number,strength:number):ImpactBody{
 return {x,z,y:.35,vx:vx*.45,vz:vz*.45,vy:Math.min(5.6,1.8+strength*.13),roll:0,spin:Math.min(5,1+strength*.12),settled:false};
}
export function stepImpactBody(s:ImpactBody,dt:number,ground:(x:number,z:number)=>number,walls:readonly Wall[],edge=Infinity):void{
 if(s.settled)return;dt=Math.min(1/30,Math.max(0,dt));s.vy-=9.81*dt;
 const nx=s.x+s.vx*dt,nz=s.z+s.vz*dt;
 const blocked=(x:number,z:number)=>walls.some(w=>!w.broken&&Math.abs(x-w.x)<w.w/2+.28&&Math.abs(z-w.z)<w.d/2+.28);
 if(blocked(nx,s.z))s.vx*=-.16;else s.x=nx;
 if(blocked(s.x,nz))s.vz*=-.16;else s.z=nz;
 if(Math.abs(s.x)>edge-.28){s.x=Math.max(-edge+.28,Math.min(edge-.28,s.x));s.vx*=-.16;}
 if(Math.abs(s.z)>edge-.28){s.z=Math.max(-edge+.28,Math.min(edge-.28,s.z));s.vz*=-.16;}
 s.y+=s.vy*dt;s.roll+=s.spin*dt;const floor=ground(s.x,s.z)+.015;
 if(s.y<=floor){s.y=floor;if(s.vy< -1.5)s.vy*=-.17;else s.vy=0;s.vx*=Math.exp(-dt*4.6);s.vz*=Math.exp(-dt*4.6);s.spin*=Math.exp(-dt*7);}
 else{s.vx*=Math.exp(-dt*.2);s.vz*=Math.exp(-dt*.2);}
 if(Math.hypot(s.vx,s.vz)<.08&&Math.abs(s.vy)<.15&&s.y<=floor+.02){s.vx=s.vz=s.vy=s.spin=0;s.settled=true;}
}
