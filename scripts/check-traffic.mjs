import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const file=new URL('../src/crime/.traffic-check.mjs',import.meta.url);
try{
 const source=await fs.readFile(new URL('../src/crime/TrafficController.ts',import.meta.url),'utf8');
 await fs.writeFile(file,ts.transpileModule(source.replace("'./CityLayout'","'./CityLayout.ts'"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {trafficPlan,trafficInput,spawnLane,TRAFFIC_LANE_OFFSET}=await import(file.href);
 const {newCar,drive}=await import('../src/crime/vehiclePhysics.ts');
 const car=newCar(0,0),plan=trafficPlan(car,{x:0,z:90});
 assert.ok(plan.path.length>3);car.vz=7;const clear=trafficInput(car,plan,[],[],.016,12);
 const lead=newCar(car.x,car.z+7);const yieldInput=trafficInput(car,plan,[lead],[],.016,12);
 assert.ok(yieldInput.brake>clear.brake,'brake for vehicle ahead');
 assert.ok(yieldInput.throttle<clear.throttle,'reduce power before impact');
 const side=newCar(car.x+10,car.z+4);assert.equal(trafficInput(car,plan,[side],[],.016,12).brake,clear.brake,'other street traffic does not block lane');
 const wall={x:0,z:7,w:3,d:3};assert.ok(trafficInput(car,plan,[],[wall],.016,12).brake>0,'brake for solid obstacle ahead');
 const lane=spawnLane({x:0,z:0},1);assert.ok(Number.isFinite(lane.heading));assert.equal(TRAFFIC_LANE_OFFSET,2.4);assert.equal(Math.hypot(lane.x,lane.z),TRAFFIC_LANE_OFFSET);
 const {ROAD_HALF_WIDTH,ROAD_TILE_SIZE,isRoad,STREET_NODES}=await import('../src/crime/CityLayout.ts');
 assert.equal(ROAD_TILE_SIZE,15);
 for(const node of STREET_NODES.values())for(let choice=0;choice<node.neighbors.length;choice++){const spawn=spawnLane(node,choice);assert.ok(isRoad(spawn.x,spawn.z,-1.1),'spawned chassis sides stay inside the widened asphalt');}
 const stopped=newCar(-TRAFFIC_LANE_OFFSET,0),obstacle=newCar(-TRAFFIC_LANE_OFFSET,5),holding=trafficPlan(stopped,{x:0,z:80});for(let i=0;i<120;i++)drive(stopped,trafficInput(stopped,holding,[obstacle],[],1/60,12),1/60);assert.ok(Math.abs(stopped.z)<.01,'yielding waits rather than immediately reversing');
 const behind=newCar(-TRAFFIC_LANE_OFFSET,20,0),directed=trafficPlan(behind,{x:0,z:-80});assert.ok(directed.path[1].z>directed.path[0].z,'initial route follows the lane heading instead of requesting a U-turn');
 const {roadDistance}=await import('../src/crime/CityLayout.ts');const routed=newCar(-TRAFFIC_LANE_OFFSET,20,0),rp=trafficPlan(routed,{x:0,z:-80});let maxRoadError=0,maxHullRoadError=0;for(let i=0;i<1800;i++){drive(routed,trafficInput(routed,rp,[],[],1/60,9),1/60);maxRoadError=Math.max(maxRoadError,roadDistance(routed.x,routed.z));for(const side of [-1.1,1.1])for(const front of [-2.25,2.25]){const x=routed.x+Math.cos(routed.heading)*side+Math.sin(routed.heading)*front,z=routed.z-Math.sin(routed.heading)*side+Math.cos(routed.heading)*front;maxHullRoadError=Math.max(maxHullRoadError,roadDistance(x,z));}}console.log('Directed-route max centerline / chassis corner offset',maxRoadError.toFixed(2),maxHullRoadError.toFixed(2));assert.ok(maxHullRoadError<=ROAD_HALF_WIDTH,'the full chassis remains on asphalt while following bends');assert.ok(maxRoadError<ROAD_HALF_WIDTH,'routed vehicles remain inside the widened asphalt through bends');
 const scenarios=[{x:20,z:TRAFFIC_LANE_OFFSET,heading:Math.PI/2,goal:{x:-80,z:0}},{x:TRAFFIC_LANE_OFFSET,z:-20,heading:Math.PI,goal:{x:0,z:80}},{x:-20,z:-TRAFFIC_LANE_OFFSET,heading:-Math.PI/2,goal:{x:80,z:0}}];
 for(const scenario of scenarios){
  const chassis=newCar(scenario.x,scenario.z,scenario.heading),route=trafficPlan(chassis,scenario.goal);let maxHull=0;
  for(let tick=0;tick<1200;tick++){
   drive(chassis,trafficInput(chassis,route,[],[],1/60,9),1/60);
   for(const side of [-1.1,1.1])for(const front of [-2.25,2.25])maxHull=Math.max(maxHull,roadDistance(chassis.x+Math.cos(chassis.heading)*side+Math.sin(chassis.heading)*front,chassis.z-Math.sin(chassis.heading)*side+Math.cos(chassis.heading)*front));
  }
  console.log('Rotated route max chassis corner offset',scenario.heading.toFixed(2),maxHull.toFixed(2));
  assert.ok(maxHull<=ROAD_HALF_WIDTH,'rotated traffic routes keep the full chassis on asphalt');
 }
 const recovering=newCar(-TRAFFIC_LANE_OFFSET,0),recoveryPlan=trafficPlan(recovering,{x:0,z:90});recoveryPlan.stuck=3.5;
 const recovery=trafficInput(recovering,recoveryPlan,[],[],1/60,9);assert.equal(recovery.reverse,true);assert.equal(recovering.heading,0,'requesting recovery does not set the chassis heading');
 for(let tick=0;tick<60;tick++)drive(recovering,trafficInput(recovering,recoveryPlan,[],[],1/60,9),1/60);
 assert.ok(recovering.z<-.1,'recovery applies reverse torque to move the chassis');assert.ok(Math.abs(recovering.heading)<Math.PI/2,'recovery rotates continuously rather than turning the heading around');
 const original=car.heading;for(let i=0;i<240;i++)trafficInput(car,plan,[],[],1/60,12);
 assert.equal(car.heading,original,'recovery never teleports heading');
 console.log('Traffic lane graph, forward avoidance, turn-speed and physical recovery: PASS');
}finally{await fs.unlink(file).catch(()=>{});}
