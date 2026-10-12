/** BLACKTOP EMPIRE — fixed-step planar chassis/tire model (world units = metres).
 * Vehicle direction uses heading=0 towards +Z; local X is right. No frame-dependent movement.
 * Core simulation intentionally independent of Three.js so physics can be unit-tested. */
export type DriverInput={throttle:number;brake:number;steer:number;handbrake:boolean;nitro:boolean;reverse?:boolean};
export type CarTune={mass:number;power:number;grip:number;brakeForce:number;steerLock:number;drag:number;wheelbase:number;topSpeed:number;durability:number};
export type CarState={x:number;z:number;heading:number;vx:number;vz:number;yawRate:number;steerAngle:number;hp:number;damageFront:number;damageRear:number;damageLeft:number;damageRight:number;nitro:number;odometer:number;lastImpact:number;throttlePedal?:number;brakePedal?:number;longitudinalAccel?:number;reverseEngaged?:boolean};
export type Wall={x:number;z:number;w:number;d:number;breakable?:boolean;broken?:boolean;kind?:string;mass?:number;hitThreshold?:number};
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
/** Two-axle planar chassis, informed by oseiskar/js-car's MIT model:
 * https://github.com/oseiskar/js-car/blob/master/physics/car.js
 * Original implementation here uses continuous slip-angle tire forces rather than
 * its no-slip matrix solver. Front/rear contact velocity includes rotational velocity;
 * their force moments accelerate a physical yaw inertia, never a target yaw rate.
 * Small internal substeps keep low-speed tire damping stable at the fixed 60 Hz tick. */
export function drive(s:CarState,c:DriverInput,dt:number,t:CarTune=BASE_TUNE,wet=false):void{
 dt=limit(dt,0,1/30);if(dt===0)return;
 const steps=Math.ceil(dt/(1/120)),h=dt/steps;
 for(let i=0;i<steps;i++){
  const a=axes(s.heading),long=s.vx*a.fx+s.vz*a.fz,lat=s.vx*a.rx+s.vz*a.rz;
  const requestedThrottle=limit(c.throttle,0,1),requestedBrake=limit(c.brake,0,1);
  // A pedal input changes torque over time, including when the driver lifts off.
  s.throttlePedal=(s.throttlePedal??0)+(requestedThrottle-(s.throttlePedal??0))*(1-Math.exp(-h/(requestedThrottle>(s.throttlePedal??0)?.18:.09)));
  s.brakePedal=(s.brakePedal??0)+(requestedBrake-(s.brakePedal??0))*(1-Math.exp(-h/.10));
  if(c.reverse===false||requestedThrottle>.08||requestedBrake<.02)s.reverseEngaged=false;
  else if(long<.25)s.reverseEngaged=true;
  const reverse=!!s.reverseEngaged;
  const damage=limit(1-s.hp/100,0,1),absLong=Math.abs(long);
  const maxAngle=t.steerLock/(1+absLong*.028);
  const requestedSteer=limit(c.steer,-1,1);
  // A mild self-aligning rack helps unwind a slide when the driver releases steering.
  // Explicit countersteering always takes priority; the rear tires still govern recovery.
  const align=!c.handbrake&&long>3?limit(Math.atan2(lat,Math.max(3,long))*.7,-maxAngle,maxAngle)*(1-Math.min(1,Math.abs(requestedSteer)*5)):0;
  const target=limit(requestedSteer*maxAngle+align,-maxAngle,maxAngle);
  // Steering winds in, countersteers and self-centres progressively.
  const steeringRate=(Math.abs(target)<Math.abs(s.steerAngle)?2.1:1.65)/(1+absLong*.02);
  s.steerAngle+=limit((target-s.steerAngle)*(1-Math.exp(-h/.13)),-h*steeringRate,h*steeringRate);
  const delta=s.steerAngle,cos=Math.cos(delta),sin=Math.sin(delta);
  const frontArm=t.wheelbase*.48,rearArm=t.wheelbase*.52;
  const inertia=t.mass*(4.5*4.5+2.2*2.2)/12;
  const friction=t.grip*(wet?.76:1)*9.81;
  // Acceleration moves normal load rearwards; braking moves it forwards.
  const transfer=limit((s.longitudinalAccel??0)*.48/(9.81*t.wheelbase),-.16,.16);
  const frontLoad=limit(rearArm/t.wheelbase-transfer,.30,.70),rearLoad=1-frontLoad;
  const frontLimit=t.mass*friction*frontLoad;
  const rearLimit=t.mass*friction*rearLoad*(c.handbrake?.23:1);
  const denominator=Math.max(3,absLong),direction=long<0?-1:1;
  // Regularized slip is continuous through zero speed and also works in reverse.
  const frontSlip=Math.atan2(lat+s.yawRate*frontArm,denominator)-delta*direction*Math.min(1,absLong/3);
  const rearSlip=Math.atan2(lat-s.yawRate*rearArm,denominator);
  const frontLateral=-frontLimit*Math.tanh(frontSlip*8.8);
  const rearLateral=-rearLimit*Math.tanh(rearSlip*9.8);
  const boost=c.nitro&&s.nitro>0&&requestedThrottle>.4&&!reverse;
  if(boost)s.nitro=Math.max(0,s.nitro-h*19);else s.nitro=Math.min(100,s.nitro+h*2.5);
  const cap=(reverse?9:t.topSpeed*(boost?1.18:1))*(1-.42*damage);
  // Fade engine force at redline, leaving collision and slide velocity unsnapped.
  const torque=1.14-.23*limit(absLong/t.topSpeed,0,1);
  const engine=reverse?-s.brakePedal*t.mass*4.2:s.throttlePedal*t.power*torque*(1-damage*.5)+(boost?t.mass*8:0);
  const redline=limit((cap-(reverse?-long:long))/Math.max(2,cap*.12),0,1);
  const traction=t.mass*friction;
  const motor=limit(engine*redline,-traction*.55,traction*.82);
  const requestedStop=(!reverse?s.brakePedal*t.brakeForce:0)+(c.handbrake?t.brakeForce*.34:0);
  // Friction circle: braking and cornering share the same tire contact budget.
  const brakeBudget=Math.sqrt(Math.max(0,frontLimit*frontLimit-frontLateral*frontLateral))+Math.sqrt(Math.max(0,rearLimit*rearLimit-rearLateral*rearLateral));
  const braking=Math.min(requestedStop,brakeBudget,absLong*t.mass/h);
  const resistance=t.mass*(.16*Math.tanh(long*3)+.0018*long*absLong)+t.drag*long;
  const longitudinal=(motor-resistance-Math.sign(long)*braking-frontLateral*sin)/t.mass;
  const lateral=(frontLateral*cos+rearLateral)/t.mass;
  s.longitudinalAccel=longitudinal;
  s.vx+=(a.fx*longitudinal+a.rx*lateral)*h;
  s.vz+=(a.fz*longitudinal+a.rz*lateral)*h;
  s.yawRate+=(frontArm*frontLateral*cos-rearArm*rearLateral)/inertia*h;
  s.heading+=s.yawRate*h;
  s.x+=s.vx*h;s.z+=s.vz*h;s.odometer+=speed(s)*h;
  if(speed(s)<.025&&requestedThrottle<.02&&requestedBrake<.02){s.vx=0;s.vz=0;}
 }
}
export function sideFor(s:CarState,nx:number,nz:number):Contact['side']{
 const a=axes(s.heading),forward=nx*a.fx+nz*a.fz,side=nx*a.rx+nz*a.rz;
 return Math.abs(forward)>Math.abs(side)?forward>0?'front':'rear':side>0?'right':'left';
}
export function impact(s:CarState,nx:number,nz:number,relativeSpeed:number,wall?:Wall,t:CarTune=BASE_TUNE):Contact{
 const side=sideFor(s,nx,nz);
 // Progressive structural damage at collision face: contact velocity sets seriousness.
 const damagingSpeed=Math.max(0,relativeSpeed-1.8);
 const amount=(.24*damagingSpeed*damagingSpeed+.55*damagingSpeed)*(t.mass/1320)*(100/Math.max(35,t.durability));
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
/** Geometry-only overlap used when validating a saved stationary chassis. */
export function carOverlapsWall(s:CarState,w:Wall):boolean{
 if(w.broken)return false;const car=carHull(s),wall:Hull={x:w.x,z:w.z,rx:1,rz:0,fx:0,fz:1,halfW:w.w/2,halfL:w.d/2};
 return !!sat(car,wall,[{x:1,z:0},{x:0,z:1},{x:car.rx,z:car.rz},{x:car.fx,z:car.fz}]);
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
 const smashed=!!w.breakable&&incoming>(w.hitThreshold??4.5);
 if(smashed)w.broken=true;
 s.x+=h.nx*(h.depth+.001);s.z+=h.nz*(h.depth+.001);
 if(incoming>0){
  const propRatio=(w.mass??120)/(t.mass+(w.mass??120));
  const restitution=smashed?Math.min(.42,propRatio+.025):1.15;
  s.vx+=h.nx*incoming*restitution;s.vz+=h.nz*incoming*restitution;
  // Side-loaded impacts twist vehicle around a heavier contact point.
  s.yawRate=limit(s.yawRate+(-h.nz*Math.sin(s.heading)+h.nx*Math.cos(s.heading))*incoming*.026,-3.5,3.5);
 }
 if(incoming>.3){const effective=smashed?incoming*Math.sqrt((w.mass??120)/(t.mass+(w.mass??120))):incoming;return {...impact(s,-h.nx,-h.nz,effective,w,t),speed:incoming};}
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


/** Clamp the actual oriented hull to the physical map perimeter, not its centre to an inset. */
export function constrainCarToBounds(s:CarState,edge:number):void{
 const c=Math.abs(Math.cos(s.heading)),a=Math.abs(Math.sin(s.heading));
 const halfX=c*1.1+a*2.25,halfZ=a*1.1+c*2.25;
 const x=limit(s.x,-edge+halfX,edge-halfX),z=limit(s.z,-edge+halfZ,edge-halfZ);
 if(x!==s.x){s.x=x;s.vx*=-.12;}if(z!==s.z){s.z=z;s.vz*=-.12;}
}
