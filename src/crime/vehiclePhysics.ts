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
/** Circle against the same oriented chassis used by solid car collisions. */
export function pointTouchesCar(s:CarState,x:number,z:number,radius=.35):boolean{
 const a=axes(s.heading),dx=x-s.x,dz=z-s.z;
 const side=Math.max(0,Math.abs(dx*a.rx+dz*a.rz)-1.1);
 const front=Math.max(0,Math.abs(dx*a.fx+dz*a.fz)-2.25);
 return side*side+front*front<radius*radius;
}
export function tuneWithMods(base:CarTune,mods:{engine:number;tires:number;brakes:number;armor:number}):CarTune{
 return {...base,power:base.power*(1+.15*mods.engine),grip:base.grip*(1+.11*mods.tires),brakeForce:base.brakeForce*(1+.13*mods.brakes),mass:base.mass+mods.armor*95,durability:base.durability*(1+.23*mods.armor)};
}
/** Slip-limited bicycle handling with yaw inertia. Must be called at 1/60s timestep. */
export function drive(s:CarState,c:DriverInput,dt:number,t:CarTune=BASE_TUNE,wet=false):void{
 dt=limit(dt,0,1/30); const a=axes(s.heading),long=s.vx*a.fx+s.vz*a.fz,lat=s.vx*a.rx+s.vz*a.rz;
 const k=limit(1-s.hp/100,0,1);
 const maxAngle=t.steerLock/(1+Math.abs(long)*.035);
 const target=limit(c.steer,-1,1)*maxAngle;
 const steeringRate=(c.handbrake?4.2:3.6)/(1+Math.abs(long)*.015);
 s.steerAngle+=limit(target-s.steerAngle,-dt*steeringRate,dt*steeringRate);
 // Stronger initial torque, then a gentle roll-off rather than a constant shove.
 const torque=1.16-.24*limit(Math.abs(long)/t.topSpeed,0,1);
 const engine=limit(c.throttle,0,1)*(t.power/t.mass)*torque*(1-k*.5);
 const reverse=c.throttle<.1&&c.brake>0&&(long<-.3||(c.brake>.8&&Math.abs(long)<.5));
 const motor=reverse ? -c.brake*4.2:engine;
 const braking=reverse?0:c.brake*t.brakeForce/t.mass;
 const resistance=.0025*long*Math.abs(long)+t.drag*long/t.mass+(.11*long);
 let flong=motor-resistance-(Math.abs(long)>.08?Math.sign(long)*braking:0);
 if(!reverse&&Math.abs(long)<.25&&c.brake>.6&&!c.throttle)flong=0;
 const grip=t.grip*(wet?.78:1)*(c.handbrake?.36:1)*9.81;
 const latForce=limit(-lat*7.6,-grip,grip);
 const steerYaw=long*Math.tan(s.steerAngle)/t.wheelbase;
 // Limit ordinary turning by tyre acceleration; handbrake permits yaw/slip to separate.
 const yawLimit=t.grip*(wet?.78:1)*9.81*(c.handbrake?1.8:1.25)/Math.max(4,Math.abs(long));
 const targetYaw=limit(steerYaw*(c.handbrake?1.35:1),-yawLimit,yawLimit);
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
 const amount=Math.max(0,relativeSpeed-2.1)*.9*(t.mass/1320)*(100/Math.max(35,t.durability));
 const part='damage'+side.charAt(0).toUpperCase()+side.slice(1) as keyof CarState;
 (s as unknown as Record<string,number>)[part]=limit(Number(s[part])+amount/55,0,1);
 s.hp=limit(s.hp-amount,0,100);
 s.lastImpact=relativeSpeed;
 return {speed:relativeSpeed,nx,nz,side,wall};
}
/** Collision hull is a 2.2m x 4.5m oriented rectangle, not a tiny radius centred on the car.
 * SAT along car/wall axes prevents bonnets and rear bumpers penetrating scenery. */
type Vec={x:number;z:number};
type Hull={x:number;z:number;rx:number;rz:number;fx:number;fz:number;halfW:number;halfL:number};
const carHull=(s:CarState):Hull=>{const a=axes(s.heading);return {x:s.x,z:s.z,...a,halfW:1.10,halfL:2.25};};
function projectHalf(h:Hull,axis:Vec):number {
 return h.halfW*Math.abs(h.rx*axis.x+h.rz*axis.z)+h.halfL*Math.abs(h.fx*axis.x+h.fz*axis.z);
}
function sat(h1:Hull,h2:Hull,axesList:Vec[]):{nx:number;nz:number;depth:number}|null{
 let depth=Infinity,nx=0,nz=0;
 for(const axis of axesList){
  const proj1=projectHalf(h1,axis),proj2=projectHalf(h2,axis);
  const distance=(h1.x-h2.x)*axis.x+(h1.z-h2.z)*axis.z;
  const overlap=proj1+proj2-Math.abs(distance);
  if(overlap<=0)return null;
  if(overlap<depth){depth=overlap;const sign=distance>=0?1:-1;nx=axis.x*sign;nz=axis.z*sign;}
 }
 return {nx,nz,depth};
}
export function collideWall(s:CarState,w:Wall,_r=1.17,t:CarTune=BASE_TUNE):Contact|null{
 if(w.broken)return null;
 // Broadphase prevents SAT work for distant buildings.
 if(Math.abs(s.x-w.x)>w.w/2+2.8||Math.abs(s.z-w.z)>w.d/2+2.8)return null;
 const car=carHull(s);
 const wall:Hull={x:w.x,z:w.z,rx:1,rz:0,fx:0,fz:1,halfW:w.w/2,halfL:w.d/2};
 const h=sat(car,wall,[{x:1,z:0},{x:0,z:1},{x:car.rx,z:car.rz},{x:car.fx,z:car.fz}]);
 if(!h)return null;
 const incoming=Math.max(0,-(s.vx*h.nx+s.vz*h.nz));
 // Breakable furniture gets displaced rather than rigidly repelling a 1.3-ton car.
 const smashed=!!w.breakable&&incoming>4.5;
 if(smashed)w.broken=true;
 s.x+=h.nx*(h.depth+.001);s.z+=h.nz*(h.depth+.001);
 if(incoming>0){
  const restitution=smashed?.18:1.15;
  s.vx+=h.nx*incoming*restitution;s.vz+=h.nz*incoming*restitution;
  // Side-loaded impacts twist vehicle around a heavier contact point.
  s.yawRate=limit(s.yawRate+(-h.nz*Math.sin(s.heading)+h.nx*Math.cos(s.heading))*incoming*.026,-3.5,3.5);
 }
 if(incoming>.3)return impact(s,-h.nx,-h.nz,incoming,w,t);
 return null;
}
/** Two full-body oriented chassis use separating-axis collision and mass-weighted impulse. */
export function collideCars(a:CarState,b:CarState,ta:CarTune=BASE_TUNE,tb:CarTune=BASE_TUNE):[Contact,Contact]|null{
 const dx=b.x-a.x,dz=b.z-a.z;
 if(Math.abs(dx)>5.2||Math.abs(dz)>5.2)return null;
 const ah=carHull(a),bh=carHull(b);
 const h=sat(ah,bh,[
  {x:ah.rx,z:ah.rz},{x:ah.fx,z:ah.fz},
  {x:bh.rx,z:bh.rz},{x:bh.fx,z:bh.fz}
 ]);
 if(!h)return null;
 const ia=1/Math.max(1,ta.mass),ib=1/Math.max(1,tb.mass),total=ia+ib;
 a.x+=h.nx*(h.depth+.001)*ia/total;a.z+=h.nz*(h.depth+.001)*ia/total;
 b.x-=h.nx*(h.depth+.001)*ib/total;b.z-=h.nz*(h.depth+.001)*ib/total;
 // h normal points from B -> A. Positive incoming means moving together.
 const approaching=Math.max(0,(b.vx-a.vx)*h.nx+(b.vz-a.vz)*h.nz);
 if(approaching>0){
  const impulse=1.12*approaching/total;
  a.vx+=h.nx*impulse*ia;a.vz+=h.nz*impulse*ia;
  b.vx-=h.nx*impulse*ib;b.vz-=h.nz*impulse*ib;
  a.yawRate=limit(a.yawRate+approaching*.018*(-h.nz*ah.fx+h.nx*ah.fz),-3,3);
  b.yawRate=limit(b.yawRate-approaching*.018*(-h.nz*bh.fx+h.nx*bh.fz),-3,3);
 }
 return [impact(a,-h.nx,-h.nz,approaching,undefined,ta),impact(b,h.nx,h.nz,approaching,undefined,tb)];
}

