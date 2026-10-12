import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
// The rendered world must use the street graph, with no procedural road paint.
const worldSource=await fs.readFile(new URL('../src/crime/World.ts',import.meta.url),'utf8');
assert.match(worldSource,/ROAD_TILES/,'world tiles must follow the authored graph');
assert.match(worldSource,/CITY_BLOCKS/,'merged blocks must drive district dressing');
assert.doesNotMatch(worldSource,/lineYellow|lineWhite/,'imported road markings have no duplicate overlay');
assert.match(worldSource,/ROAD_LAMPS/,'street lamps derive from real road corners');
// Execute the actual presentation methods without requiring a browser/WebGL context.
const layoutSource=await fs.readFile(new URL('../src/crime/CityLayout.ts',import.meta.url),'utf8');
const vehicleLightsSource=await fs.readFile(new URL('../src/crime/VehicleLights.ts',import.meta.url),'utf8');
const modelSource=await fs.readFile(new URL('../src/crime/CityModels.ts',import.meta.url),'utf8');
const source=(await fs.readFile(new URL('../src/crime/World.ts',import.meta.url),'utf8'))
 .replace("import {crimeAssetURL} from './assets';", "const crimeAssetURL=()=>'';")
 .replace("import {CITY_MODELS,CITY_ROAD_ORIENTATION} from './CityModels';", modelSource)
 .replace("import {ROAD_TILES,CITY_BLOCKS,districtAt,isRoad,roadRoute} from './CityLayout';",layoutSource)
 .replace("import {attachVehicleLights,updateVehicleLights,disposeVehicleLights} from './VehicleLights';",vehicleLightsSource.replace("import * as THREE from 'three';",''))
 .replace("import {type CarState,type Wall} from './vehiclePhysics';",'');
const path=new URL('./.world-check-runtime.mjs',import.meta.url);
await fs.writeFile(path,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
try{
 const {CrimeWorld,ROAD_TILES,CITY_BLOCKS,ROAD_LAMPS,CITY_ROAD_ORIENTATION,isRoad}=await import(path.href+'?'+Date.now());
 const world=Object.create(CrimeWorld.prototype);
 Object.assign(world,{scene:new THREE.Scene(),root:new THREE.Group(),interior:new THREE.Group(),navigation:new THREE.Group(),navigationKey:'',camera:new THREE.OrthographicCamera(-12,12,25,-25,.1,400),cameraFocus:new THREE.Vector3(),cameraHeading:0,cameraReady:false,sun:new THREE.DirectionalLight(),sky:new THREE.HemisphereLight(),streetLights:[],lampAnchors:[],lampRefresh:Infinity,lampX:Infinity,lampZ:Infinity,renderer:{toneMappingExposure:1},lampMaterial:new THREE.MeshBasicMaterial(),windowMaterial:new THREE.MeshBasicMaterial(),routeMaterial:new THREE.MeshBasicMaterial(),environmentTime:17.5*3600,night:0,skidCursor:0,skidSide:0,skidPrevious:[null,null],skidDummy:new THREE.Object3D(),tyreMarks:new THREE.InstancedMesh(new THREE.PlaneGeometry(.2,1),new THREE.MeshBasicMaterial(),420)});
 world.scene.background=new THREE.Color();world.interior.visible=false;
 for(let i=0;i<180;i++)world.follow(0,0,0,0,1/60,false,false);
 assert.equal(world.surfaceHeight(0,18),.055,'road grounding includes connected vertical streets');assert.equal(world.surfaceHeight(7,16),.09,'ordinary sidewalk grounding');assert.equal(world.viewHeading,0,'HUD exposes current damped camera heading');
 const slowZoom=world.camera.zoom;
 const p=new THREE.Vector3(0,0,5).project(world.camera);
 assert.ok(p.y>new THREE.Vector3(0,0,0).project(world.camera).y,'forward +Z projects upward');
 for(let i=0;i<180;i++)world.follow(0,0,40,0,1/60,false,false);
 assert.ok(world.camera.zoom<slowZoom,'camera widens at speed');
 const oldHeading=world.cameraHeading;world.follow(0,0,40,Math.PI,1/60);
 assert.ok(Math.abs(world.cameraHeading-oldHeading)<=.95/60+.00001,'instant heading reversal cannot whip camera');assert.equal(world.viewHeading,world.cameraHeading,'HUD uses damped rendered heading');
 world.cameraHeading=Math.PI-.02;world.follow(0,0,0,-Math.PI+.02,1/60);assert.ok(Math.abs(world.cameraHeading-(Math.PI-.02))<.01,'camera wrap follows the short angle');
 world.follow(2,3,0,0,1/60,true);assert.ok(world.cameraFocus.x>9990,'safehouse transition snaps into separate room');
 world.follow(2,3,0,0,1/60,false,true);assert.ok(world.cameraFocus.x<10,'exit snaps back into city');
 world.updateEnvironment(0);const afternoon=world.sky.intensity;
 world.updateEnvironment(150);assert.ok(world.sky.intensity<afternoon,'sunset reduces daylight');assert.ok(world.windowMaterial.opacity>.7,'windows illuminate at night');assert.ok(world.sky.intensity>=.9,'bluish night ambient keeps vehicles readable');assert.match(world.clockLabel,/^\d\d:\d\d$/);
 world.setNavigation({x:64,z:64},{x:1,z:3,heading:0});assert.ok(world.navigation.children.length>=3,'route follows connected street bends');world.setNavigation(null,{x:1,z:3,heading:0});assert.equal(world.navigation.children.length,0);
 world.addSkidMark(-.87,0,0);world.addSkidMark(.87,0,0);world.addSkidMark(-.87,1,0);world.addSkidMark(.87,1,0);
 assert.equal(world.tyreMarks.count,2,'paired wheels produce one continuous segment each');const m=new THREE.Matrix4();world.tyreMarks.getMatrixAt(0,m);const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(pos,quat,scale);assert.ok(Math.abs(pos.z-.5)<1e-5&&scale.y>=1,'skid bridges the actual previous/current wheel coordinates');
 world.addSkidMark(.13,2,Math.PI/4);world.addSkidMark(1.87,2,Math.PI/4);world.tyreMarks.getMatrixAt(2,m);const axis=new THREE.Vector3(0,1,0).transformDirection(m);assert.ok(Math.abs(axis.x-axis.z)<1e-5,'diagonal skid segment connects both axes without mirroring');
 const glb=await fs.readFile(new URL('../src/crime/bundled/interior/beddouble.glb',import.meta.url));const original=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');world.buildingAssets=new Map([['bed',original.scene]]);const chunk=new THREE.Group(),slot=new THREE.Group();slot.position.set(-4,0,-4);slot.userData.streetSlot={name:'bed',w:3.6,h:1.05,d:4.6};slot.userData.buildingSlot=true;chunk.add(slot);world.attachModels(chunk);chunk.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(chunk),centre=bounds.getCenter(new THREE.Vector3()),dims=bounds.getSize(new THREE.Vector3());assert.ok(Math.abs(centre.x+4)<.001&&Math.abs(centre.z+4)<.001,'corner-origin model remains centered after axis fitting');assert.ok(Math.abs(dims.x-3.6)<.001&&Math.abs(dims.z-4.6)<.001,'furniture fitted visual footprint matches collision dimensions');
 // Render all authored chunks without WebGL and inspect the actual road slots/colliders.
 world.props=[];world.buildingAssets=new Map();
 const renderedRoads=[];let buildingCount=0;
 for(let cx=-3;cx<=2;cx++)for(let cz=-3;cz<=2;cz++){
  const ch=world.makeChunk(cx,cz);
  ch.group.traverse(o=>{if(o.userData.roadSlot)renderedRoads.push({x:o.position.x+cx*60,z:o.position.z+cz*60,rotation:o.rotation.y,spec:o.userData.streetSlot});if(o.userData.buildingSlot)buildingCount++;});
  for(const wall of ch.walls)if(wall.kind==='building'){
   assert.ok(!isRoad(wall.x,wall.z),'building centre cannot occupy a street');
   for(const p of [{x:-8,z:0},{x:0,z:-12},{x:0,z:32},{x:32,z:0},{x:-32,z:0},{x:0,z:-32}])assert.ok(Math.abs(wall.x-p.x)>=wall.w/2+4||Math.abs(wall.z-p.z)>=wall.d/2+4,'interaction approach stays accessible');
  }
 }
 assert.equal(renderedRoads.length,ROAD_TILES.length,'each graph tile is rendered once, including city edges');
 for(const tile of ROAD_TILES){const actual=renderedRoads.find(p=>p.x===tile.x&&p.z===tile.z);assert.equal(actual.spec.w,10);assert.equal(actual.spec.d,10);assert.ok(Math.abs(actual.rotation-tile.rotation-CITY_ROAD_ORIENTATION[tile.kind])<1e-6,'source orientation correction follows connection mask');}
 assert.ok(CITY_BLOCKS.some(b=>b.cells.length>2),'world consumes merged blocks');assert.ok(buildingCount>150,'all district themes have dense dressing');
 assert.ok(ROAD_LAMPS.length>50&&ROAD_LAMPS.every(p=>!isRoad(p.x,p.z)),'lamps stay on real sidewalk corners');
 // Actual InstancedMesh disposal events release GPU instance buffers without disposing shared assets.
 const sharedGeometry=new THREE.BoxGeometry(),sharedMaterial=new THREE.MeshBasicMaterial();let geometryDisposals=0,materialDisposals=0,instanceDisposals=0;
 sharedGeometry.addEventListener('dispose',()=>geometryDisposals++);sharedMaterial.addEventListener('dispose',()=>materialDisposals++);
 const instance=()=>{const mesh=new THREE.InstancedMesh(sharedGeometry,sharedMaterial,1);mesh.userData.sharedGeometry=true;mesh.addEventListener('dispose',()=>instanceDisposals++);return mesh;};
 const oldChunk=new THREE.Group();oldChunk.add(instance());world.root.add(oldChunk);
 Object.assign(world,{w:390,h:844,lastcx:Infinity,lastcz:Infinity,map:new Map([['100:100',{group:oldChunk,walls:[],props:[]}]]),props:[],walls:[],propertyUpgrades:new THREE.Group(),markers:new Map(),mountResize:null});
 world.makeChunk=()=>({group:new THREE.Group(),walls:[],props:[]});world.stream(0,0);assert.ok(world.map.size<=16,'chunk budget stays bounded');assert.equal(instanceDisposals,1,'stream unload disposes instance-owned GPU buffers');
 world.propertyUpgrades.add(instance());world.setInteriorLevels(0,0);assert.equal(instanceDisposals,2,'property replacement disposes instance-owned GPU buffers');
 world.navigation.add(instance());world.navigationKey='old';world.setNavigation(null,{x:0,z:0,heading:0});assert.equal(instanceDisposals,3,'route replacement disposes any instance-owned GPU buffers');
 const remainingChunk=new THREE.Group();remainingChunk.add(instance());world.map.set('remaining',{group:remainingChunk,walls:[],props:[]});world.interior.add(instance());world.navigation.add(instance());world.tyreMarks.addEventListener('dispose',()=>instanceDisposals++);
 world.renderer={dispose(){},domElement:{remove(){}}};world.dispose();assert.equal(instanceDisposals,7,'world teardown disposes chunk, interior, route and tyre-mark instances');
 assert.equal(geometryDisposals,0,'shared model geometry remains reusable');assert.equal(materialDisposals,0,'shared model materials remain reusable');sharedGeometry.dispose();sharedMaterial.dispose();
 console.log(`${renderedRoads.length} road tiles, ${CITY_BLOCKS.length} merged/standalone blocks, ${buildingCount} buildings, ${ROAD_LAMPS.length} sidewalk lamps`);
 console.log('World camera, safehouse, day/night, route, connected skid and instance disposal checks passed');
}finally{await fs.unlink(path);}
