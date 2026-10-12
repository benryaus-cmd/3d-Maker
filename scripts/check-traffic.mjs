import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const file=new URL('../src/crime/.traffic-check.mjs',import.meta.url);
try{
 const source=await fs.readFile(new URL('../src/crime/TrafficController.ts',import.meta.url),'utf8');
 await fs.writeFile(file,ts.transpileModule(source.replace("'./CityLayout'","'./CityLayout.ts'"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {trafficPlan,trafficInput,spawnLane}=await import(file.href);
 const {newCar,drive}=await import('../src/crime/vehiclePhysics.ts');
 const car=newCar(0,0),plan=trafficPlan(car,{x:0,z:90});
 assert.ok(plan.path.length>3);car.vz=7;const clear=trafficInput(car,plan,[],[],.016,12);
 const lead=newCar(car.x,car.z+7);const yieldInput=trafficInput(car,plan,[lead],[],.016,12);
 assert.ok(yieldInput.brake>clear.brake,'brake for vehicle ahead');
 assert.ok(yieldInput.throttle<clear.throttle,'reduce power before impact');
 const side=newCar(car.x+10,car.z+4);assert.equal(trafficInput(car,plan,[side],[],.016,12).brake,clear.brake,'other street traffic does not block lane');
 const wall={x:0,z:7,w:3,d:3};assert.ok(trafficInput(car,plan,[],[wall],.016,12).brake>0,'brake for solid obstacle ahead');
 const lane=spawnLane({x:0,z:0},1);assert.ok(Number.isFinite(lane.heading));assert.ok(Math.hypot(lane.x,lane.z)<3);
 const stopped=newCar(-1.55,0),obstacle=newCar(-1.55,5),holding=trafficPlan(stopped,{x:0,z:80});for(let i=0;i<120;i++)drive(stopped,trafficInput(stopped,holding,[obstacle],[],1/60,12),1/60);assert.ok(Math.abs(stopped.z)<.01,'yielding waits rather than immediately reversing');
 const behind=newCar(-1.55,20,0),directed=trafficPlan(behind,{x:0,z:-80});assert.ok(directed.path[1].z>directed.path[0].z,'initial route follows the lane heading instead of requesting a U-turn');
 const {roadDistance}=await import('../src/crime/CityLayout.ts');const routed=newCar(-1.55,20,0),rp=trafficPlan(routed,{x:0,z:-80});let maxRoadError=0;for(let i=0;i<1800;i++){drive(routed,trafficInput(routed,rp,[],[],1/60,9),1/60);maxRoadError=Math.max(maxRoadError,roadDistance(routed.x,routed.z));}console.log('Directed-route max centerline offset',maxRoadError.toFixed(2));assert.ok(maxRoadError<4.5,'routed vehicles remain inside the street envelope through bends');
 const original=car.heading;for(let i=0;i<240;i++)trafficInput(car,plan,[],[],1/60,12);
 assert.equal(car.heading,original,'recovery never teleports heading');
 console.log('Traffic lane graph, forward avoidance, turn-speed and physical recovery: PASS');
}finally{await fs.unlink(file).catch(()=>{});}
