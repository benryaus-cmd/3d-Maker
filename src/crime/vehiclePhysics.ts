/** BLACKTOP EMPIRE — fixed-step planar chassis/tire model (world units = metres).
 * Vehicle direction uses heading=0 towards +Z; local X is right. No frame-dependent movement.
 * Core simulation intentionally independent of Three.js so physics can be unit-tested. */
export type DriverInput={throttle:number;brake:number;steer:number;handbrake:boolean;nitro:boolean};
export type CarTune={mass:number;power:number;grip:number;brakeForce:number;steerLock:number;drag:number;wheelbase:number;topSpeed:number;durability:number};
export type CarState={x:number;z:number;heading:number;vx:number;vz:number;yawRate:number;steerAngle:number;hp:number;damageFront:number;damageRear:number;damageLeft:number;damageRight:number;nitro:number;odometer:number;lastImpact:number};
export type Wall={x:number;z:number;w:number;d:number;breakable?:boolean;broken?:boolean;kind?:string};
export type Contact={speed:number;nx:number;nz:number;side:'front'|'rear'|'left'|'right';wall?:Wall};
export const BASE_TUNE:CarTune={mass:1320,power:8200,grip:1.05,brakeForce:11700,steerLock:.60,drag:.42,wheelbase:2.7,topSpeed:49,durability:100};
const limit=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export const newCar=(x=0,z=0,heading=0,hp=100):CarState=>({x,z,heading,vx:0,vz:0,yawRate:0,steerAngle:0,hp,damageFront:0,damageRear:0,damageLeft:0,damageRight:0,nitro:100,odometer:0,lastImpact:0});
export const speed=(s:CarState)=>Math.hypot(s.vx,s.vz);
export const kmh=(s:CarState)=>Math.round(speed(s)*3.6);
export const axes=(heading:number)=>({fx:Math.sin(heading),fz:Math.cos(heading),rx:Math.cos(heading),rz:-Math.sin(heading)});
export function tuneWithMods(base:CarTune,mods:{engine:number;tires:number;brakes:number;armor:number}):CarTune{
 return {...base,power:base.power*(1+.15*mods.engine),grip:base.grip*(1+.11*mods.tires),brakeForce:base.brakeForce*(1+.13*mods.brakes),mass:base.mass+mods.armor*95,durability:base.durability*(1+.23*mods.armor)};
}
/** Slip-limited bicycle handling with yaw inertia. Must be called at 1/60s timestep. */
export function drive(s:CarState,c:DriverInput,dt:number,t:CarTune=BASE_TUNE,wet=false):void{
 dt=limit(dt,0,1/30); const a=axes(s.heading),long=s.vx*a.fx+s.vz*a.fz,lat=s.vx*a.rx+s.vz*a.rz;
 const k=limit(1-s.hp/(t.durability||100),0,1);
 const maxAngle=t.steerLock/(1+Math.abs(long)*.025);
 const target=limit(c.steer,-1,1)*maxAngle;
 s.steerAngle+=limit(target-s.steerAngle,-dt*3.7,dt*3.7);
 const engine=limit(c.throttle,0,1)*(t.power/t.mass)*(1-k*.5);
 const reverse=long<-.3 || (c.brake>.8&&Math.abs(long)<.5&&c.throttle<.1);
 const motor=reverse ? -c.brake*4.2:engine;
 const braking=reverse?0:c.brake*t.brakeForce/t.mass;
 const resistance=.018*long*Math.abs(long)+t.drag*long/t.mass+(.14*long);
 let flong=motor-resistance-(Math.abs(long)>.08?Math.sign(long)*braking:0);
 if(Math.abs(long)<.25&&c.brake>.6&&!c.throttle)flong=0;
 const grip=t.grip*(wet?.78:1)*(c.handbrake?.36:1)*9.81;
 const latForce=limit(-lat*7.6,-grip,grip);
 const steerYaw=long*Math.tan(s.steerAngle)/t.wheelbase;
 const targetYaw=steerYaw*(c.handbrake?1.5:1);
 const yawResponse=limit((c.handbrake?2.8:5.4)*dt,0,1);
 s.yawRate+=(targetYaw-s.yawRate)*yawResponse;
 // Excess speed and sharp turning generate real lateral slip, not instant velocity snapping.
 if(c.nitro&&s.nitro>0&&c.throttle>.4){flong+=8;s.nitro=Math.max(0,s.nitro-dt*19);}
 else s.nitro=Math.min(100,s.nitro+dt*2.5);
 const dvx=(a.fx*flong+a.rx*latForce)*dt;
 const dvz=(a.fz*flong+a.rz*latForce)*dt;
 s.vx+=dvx;s.vz+=dvz;
 const v=speed(s),cap=t.topSpeed*(c.nitro?1.18:1)*(1-.42*k);
 if(v>cap){s.vx*=cap/v;s.vz*=cap/v;}
 s.heading+=s.yawRate*dt;
 s.x+=s.vx*dt;s.z+=s.vz*dt;
 s.odometer+=speed(s)*dt;
}
export function sideFor(s:CarState,nx:number,nz:number):Contact['side']{
 const a=axes(s.heading),forward=nx*a.fx+nz*a.fz,side=nx*a.rx+nz*a.rz;
 return Math.abs(forward)>Math.abs(side)?forward>0?'front':'rear':side>0?'right':'left';
}
export function impact(s:CarState,nx:number,nz:number,relativeSpeed:number,wall?:Wall,t:CarTune=BASE_TUNE):Contact{
 const side=sideFor(s,nx,nz);
 // Progressive structural damage at collision face: contact velocity sets seriousness.
 const amount=Math.max(0,relativeSpeed-2.1)*.9*(t.mass/1320);
 const part='damage'+side.charAt(0).toUpperCase()+side.slice(1) as keyof CarState;
 (s as unknown as Record<string,number>)[part]=limit(Number(s[part])+amount/55,0,1);
 s.hp=limit(s.hp-amount,0,t.durability);
 s.lastImpact=relativeSpeed;
 return {speed:relativeSpeed,nx,nz,side,wall};
}
/** Circle-against-AABB chassis proxy at urban top-down scale; collision is not visual-only. */
export function collideWall(s:CarState,w:Wall,r=1.17,t:CarTune=BASE_TUNE):Contact|null{
 if(w.broken)return null;
 const minx=w.x-w.w/2,maxx=w.x+w.w/2,minz=w.z-w.d/2,maxz=w.z+w.d/2;
 const px=limit(s.x,minx,maxx),pz=limit(s.z,minz,maxz),dx=s.x-px,dz=s.z-pz;
 const d2=dx*dx+dz*dz;if(d2>=r*r)return null;
 let nx=0,nz=0,push=0;
 if(d2>1e-8){const d=Math.sqrt(d2);nx=dx/d;nz=dz/d;push=r-d;}
 else {const edges=[{d:s.x-minx,nx:-1,nz:0},{d:maxx-s.x,nx:1,nz:0},{d:s.z-minz,nx:0,nz:-1},{d:maxz-s.z,nx:0,nz:1}].sort((a,b)=>a.d-b.d);nx=edges[0].nx;nz=edges[0].nz;push=r+edges[0].d;}
 const incoming=Math.max(0,-(s.vx*nx+s.vz*nz));
 s.x+=nx*push;s.z+=nz*push;
 if(incoming>0){s.vx+=nx*incoming*1.32;s.vz+=nz*incoming*1.32;s.yawRate+=(-nz*Math.sin(s.heading)+nx*Math.cos(s.heading))*incoming*.032;}
 if(incoming>.3){const hit=impact(s,-nx,-nz,incoming,w,t); if(w.breakable&&incoming>4.5)w.broken=true;return hit;}
 return null;
}
export function collideCars(a:CarState,b:CarState,ta:CarTune=BASE_TUNE,tb:CarTune=BASE_TUNE):[Contact,Contact]|null{
 const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),radius=2.2;if(d>=radius)return null;
 const nx=d>1e-6?dx/d:1,nz=d>1e-6?dz/d:0,overlap=(radius-d)/2;
 a.x-=nx*overlap;b.x+=nx*overlap;a.z-=nz*overlap;b.z+=nz*overlap;
 const rel=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
 if(rel>0){const ia=1/ta.mass,ib=1/tb.mass,imp=1.12*rel/(ia+ib);a.vx-=nx*imp*ia;a.vz-=nz*imp*ia;b.vx+=nx*imp*ib;b.vz+=nz*imp*ib;}
 return [impact(a,nx,nz,Math.max(0,rel),undefined,ta),impact(b,-nx,-nz,Math.max(0,rel),undefined,tb)];
}
