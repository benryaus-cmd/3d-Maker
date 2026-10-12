import assert from 'node:assert/strict';
import {newCar,drive,speed,axes,BASE_TUNE,impact,tuneWithMods,collideCars,collideWall} from '../src/crime/vehiclePhysics.ts';
const neutral={throttle:0,brake:0,steer:0,handbrake:false,nitro:false};
const step=(s,input,seconds,t=BASE_TUNE,wet=false)=>{for(let i=0;i<Math.round(seconds*60);i++)drive(s,{...neutral,...input},1/60,t,wet);return s;};
const slip=s=>{const a=axes(s.heading);return Math.atan2(s.vx*a.rx+s.vz*a.rz,Math.abs(s.vx*a.fx+s.vz*a.fz));};
const failures=[];const check=(name,fn)=>{try{fn();console.log('PASS '+name);}catch(e){failures.push(name);console.error('FAIL '+name+': '+e.message);}};
check('pedals ramp acceleration instead of applying full torque in one tick',()=>{
 const s=newCar();drive(s,{...neutral,throttle:1},1/60);const first=s.vz*60;
 step(s,{throttle:1},.5);const before=s.vz;drive(s,{...neutral,throttle:1},1/60);const settled=(s.vz-before)*60;
 assert.ok(first<settled*.35,`first ${first.toFixed(2)} vs settled ${settled.toFixed(2)} m/s²`);
});
check('brake force builds progressively',()=>{
 const s=newCar();s.vz=15;drive(s,{...neutral,brake:1},1/60);const first=(15-s.vz)*60;
 step(s,{brake:1},.3);const before=s.vz;drive(s,{...neutral,brake:1},1/60);const settled=(before-s.vz)*60;
 assert.ok(first<settled*.55,`first ${first.toFixed(2)} vs settled ${settled.toFixed(2)} m/s²`);
});
check('released throttle coasts with momentum',()=>{
 const s=step(newCar(),{throttle:1},4),before=speed(s);step(s,{},2);
 assert.ok(speed(s)>before*.8&&speed(s)<before,`coast ${before.toFixed(2)} → ${speed(s).toFixed(2)} m/s`);
});
check('small steering input follows a stable finite turning radius',()=>{
 const s=newCar();s.vz=10;step(s,{throttle:.3,steer:.2},3);
 const a=axes(s.heading),long=s.vx*a.fx+s.vz*a.fz,radius=Math.abs(long/s.yawRate);
 assert.ok(s.heading>.4&&s.heading<1.4&&radius>20&&radius<70,`heading ${s.heading.toFixed(2)} radius ${radius.toFixed(2)}`);
 assert.ok(Math.abs(slip(s))<.2,'steady corner has small lateral slip');
});
check('high speed sharp steer stays within tire force envelope',()=>{
 const s=newCar();s.vz=25;step(s,{throttle:.4,steer:1},.75);
 assert.ok(Math.abs(s.yawRate)<1.3&&speed(s)>20,`yaw ${s.yawRate.toFixed(2)} speed ${speed(s).toFixed(2)}`);
});
check('handbrake breaks rear traction and released drift recovers',()=>{
 const s=newCar();s.vz=18;step(s,{throttle:.3,steer:.7,handbrake:true},.65);
 const sliding=Math.abs(slip(s));assert.ok(sliding>.22,`drift slip ${sliding.toFixed(2)} rad`);
 step(s,{throttle:.2,steer:0},3);
 const recoveredAxes=axes(s.heading);assert.ok(s.vx*recoveredAxes.fx+s.vz*recoveredAxes.fz>5,'released short drift should recover forward momentum');
 assert.ok(Math.abs(slip(s))<.12&&Math.abs(s.yawRate)<.12,`recovered slip ${slip(s).toFixed(2)}, yaw ${s.yawRate.toFixed(2)}`);
});
check('countersteering arrests a slide more effectively than continuing to turn',()=>{
 const drifting=newCar();drifting.vz=18;step(drifting,{throttle:.2,steer:.7,handbrake:true},.65);
 const recovered=step({...drifting},{throttle:.2,steer:-.7},1),held=step({...drifting},{throttle:.2,steer:.7},1);
 const ra=axes(recovered.heading),ha=axes(held.heading);
 assert.ok(Math.abs(recovered.yawRate)<Math.abs(held.yawRate)*.8,'opposite steering reduces spin');
 assert.ok(recovered.vx*ra.fx+recovered.vz*ra.fz>held.vx*ha.fx+held.vz*ha.fz+2,'countersteer retains more forward motion');
});
check('brake holds reverse from rest and throttle recovers forward',()=>{
 const s=step(newCar(),{brake:1},1);assert.ok(s.z< -1&&s.vz< -1);
 step(s,{throttle:1},2);assert.ok(s.vz>1);
 const slow=step(newCar(),{brake:.3},2);assert.ok(slow.vz< -1,'analog reverse works below full pedal');
});
check('reverse steering turns in the opposite direction',()=>{
 const s=step(newCar(),{brake:1,steer:.45},2);assert.ok(s.heading<-.2,'reverse right steering produces negative yaw');
});
check('crash damage tracks energy while armor and light taps retain their roles',()=>{
 const light=newCar(),medium=newCar(),fast=newCar(),armored=newCar();
 impact(light,0,1,3);impact(medium,0,1,10);impact(fast,0,1,20);
 impact(armored,0,1,20,undefined,tuneWithMods(BASE_TUNE,{engine:0,tires:0,brakes:0,armor:3}));
 assert.ok(light.hp>97,'parking bump should not wreck car');
 assert.ok(medium.hp<80&&medium.hp>60,`10m/s hp ${medium.hp}`);
 assert.ok(fast.hp<30,`20m/s hp ${fast.hp}`);
 assert.ok((100-fast.hp)>3*(100-medium.hp),'double impact speed must cause nonlinear damage');
 assert.ok(armored.hp>fast.hp+15,'armor meaningfully protects structure');
 assert.ok(fast.damageFront>.9&&fast.damageRear===0,'impact marks the contacted body panel');
});
check('wall impact damages structure and equal-speed car convoy does not',()=>{
 const s=newCar(0,7);s.vz=18;assert.ok(collideWall(s,{x:0,z:8,w:5,d:2}));assert.ok(s.hp<50,`18m/s wall hp ${s.hp}`);
 const a=newCar(),b=newCar(0,4);a.vz=b.vz=15;collideCars(a,b);assert.equal(a.hp,100);assert.equal(b.hp,100);
});
check('zero timestep is a no-op and simulation is rotation invariant',()=>{
 const s=newCar();s.vz=4;const before={...s};drive(s,{...neutral,throttle:1},0);assert.deepEqual(s,before);
 const a=step(newCar(),{throttle:.6,steer:.3},3),b=step(newCar(0,0,Math.PI/2),{throttle:.6,steer:.3},3);
 assert.ok(Math.abs(a.x+b.z)<1e-6&&Math.abs(a.z-b.x)<1e-6,'rotated trajectory matches');
});
check('unpowered cornering dissipates energy and fixed ticks remain deterministic',()=>{
 for(const initialSpeed of [5,15,30])for(const steer of [-1,-.25,.25,1]){
  const s=newCar();s.vz=initialSpeed;
  for(let i=0;i<120;i++){const before=speed(s);drive(s,{...neutral,steer},1/60);assert.ok(speed(s)<=before+1e-6,'tires cannot add unpowered translational energy');}
 }
 const a=newCar(),b=newCar();step(a,{throttle:.6,steer:.25},2);
 for(let i=0;i<60;i++)drive(b,{...neutral,throttle:.6,steer:.25},1/30);
 assert.ok(Math.abs(a.x-b.x)<1e-7&&Math.abs(a.z-b.z)<1e-7,'substeps agree across tick batches');
});
check('mixed wet-road driving remains finite through sustained slides and pedal changes',()=>{
 for(const wet of [false,true]){
  const s=newCar();s.vz=25;
  for(let i=0;i<1800;i++){
   drive(s,{throttle:.5+.5*Math.sin(i*.003),brake:Math.max(0,Math.sin(i*.008))*.6,steer:Math.sin(i*.006),handbrake:Math.sin(i*.002)>.88,nitro:true},1/60,BASE_TUNE,wet);
   assert.ok([s.x,s.z,s.heading,s.vx,s.vz,s.yawRate].every(Number.isFinite),'chassis state must remain finite');
   assert.ok(speed(s)<70,'force integration must not run away');
  }
 }
});
if(failures.length){console.error(`${failures.length} vehicle handling checks failed`);process.exitCode=1;}else console.log('Vehicle handling checks passed');
