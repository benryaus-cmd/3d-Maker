import {LIVE} from './LiveTuning';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {crimeAssetURL} from './assets';
import {TimedSkids} from './TimedSkids';
import {daylightAt} from './Daylight';
import {CITY_MODELS,CITY_ROAD_ORIENTATION} from './CityModels';
import {ROAD_TILES,CITY_BLOCKS,ROAD_TILE_SIZE,CITY_EDGE,districtAt,isRoad,roadRoute} from './CityLayout';
import {SCENERY_RESPONSE,sceneryKind,solidFootprint,stepFallingScenery,type FallingScenery} from './SceneryPhysics';
import {attachVehicleLights,updateVehicleLights,disposeVehicleLights} from './VehicleLights';
import {type CarState,type Wall} from './vehiclePhysics';

type SceneryWall=Wall&{mass?:number;hitThreshold?:number};
type InstanceRef={mesh:THREE.InstancedMesh;index:number};
type Prop={root:THREE.Group;wall:SceneryWall;fall?:FallingScenery};
type Chunk={group:THREE.Group;walls:Wall[];props:Prop[]};
const loader=new GLTFLoader();
const carPaths=['sedan','sedan-sports','police','taxi','suv','race'] as const;
export type CarStyle=typeof carPaths[number];
const buildingPaths=['building-a','building-b','building-c','building-d','building-skyscraper-a'] as const;
const streetPaths=['dumpster','construction-barrier','construction-fence','light-curved','traffic-light','road-sign-stop','road-sign-warning','construction-cone','electricity-pole'] as const;
// All referenced models are Vite-bundled so the Aippy host need not expose upstream/public.
const assets=new Map<string,Promise<THREE.Group>>();
function getModel(path:string):Promise<THREE.Group>{
 let promise=assets.get(path);if(!promise){promise=loader.loadAsync(crimeAssetURL(path)).then(r=>r.scene);assets.set(path,promise);}return promise;
}
// Share per-colour materials between streamed blocks, instead of leaking a new GPU
// material each time a 96m city chunk is built or recycled.
const cachedMaterials=new Map<string,THREE.MeshStandardMaterial>();
const mat=(color:number,metalness=0)=>{
 const key=color.toString(16)+':'+metalness;
 let existing=cachedMaterials.get(key);
 if(!existing){existing=new THREE.MeshStandardMaterial({color,roughness:.72,metalness});cachedMaterials.set(key,existing);}
 return existing;
};
const asphalt=mat(0x252a34),walk=mat(0x77736f),buildingMats=[mat(0x807d73),mat(0x6b777d),mat(0x947f70),mat(0x6b656a),mat(0x606f69)];
const ground=mat(0x4c5750);
const glowPixels=new Uint8Array(32*32*4);
for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);glowPixels[i]=glowPixels[i+1]=glowPixels[i+2]=255;glowPixels[i+3]=Math.round(Math.pow(Math.max(0,1-r),2)*255);}
const glowTexture=new THREE.DataTexture(glowPixels,32,32);glowTexture.needsUpdate=true;glowTexture.magFilter=THREE.LinearFilter;glowTexture.minFilter=THREE.LinearFilter;

const CHUNK_SIZE=60;
const protectedPlaces=[{x:7,z:7},{x:-8,z:0},{x:0,z:-12},{x:0,z:32},{x:32,z:0},{x:-32,z:0},{x:0,z:-32}];
const clearFootprint=(x:number,z:number,w:number,d:number)=>!protectedPlaces.some(p=>Math.abs(x-p.x)<w/2+4&&Math.abs(z-p.z)<d/2+4);
const unitBox=new THREE.BoxGeometry(1,1,1);
const lampPoolGeometry=new THREE.PlaneGeometry(8,8);
// InstancedMesh owns matrix buffers even when its geometry/material are cached.
function disposeWorldVisuals(root:THREE.Object3D){
 root.traverse(o=>{
  if(o instanceof THREE.InstancedMesh)o.dispose();
  if(o instanceof THREE.Mesh&&!o.userData.sharedGeometry)o.geometry.dispose();
 });
}
const box=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const o=new THREE.Mesh(unitBox,m);o.scale.set(w,h,d);o.userData.sharedGeometry=true;o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o;};
const hash=(x:number,z:number)=>((Math.imul(x+2903,73856093)^Math.imul(z+9851,19349663))>>>0);
// Lamps sit beyond tile corners, including bends and tees, rather than on a phantom grid.
export const ROAD_LAMPS=ROAD_TILES.filter(t=>t.kind!=='straight' || hash(Math.round(t.x),Math.round(t.z))%5===0).flatMap(t=>
 [{x:t.x+6.3,z:t.z+6.3},{x:t.x-6.3,z:t.z-6.3}]).filter((p,i,all)=>!isRoad(p.x,p.z)&&all.findIndex(q=>q.x===p.x&&q.z===p.z)===i);

const rand=(seed:number)=>((Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
function fitted(root:THREE.Group,targetX:number,targetY:number,targetZ:number):THREE.Group{
 const model=root.clone(true);
 model.traverse(o=>{if(o instanceof THREE.Mesh)o.userData.sharedGeometry=true;});
 const bb=new THREE.Box3().setFromObject(model),size=bb.getSize(new THREE.Vector3());

 model.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(model),s=b.getSize(new THREE.Vector3());
 model.scale.multiplyScalar(Math.min(targetX/Math.max(.01,s.x),targetY/Math.max(.01,s.y),targetZ/Math.max(.01,s.z)));
 model.updateMatrixWorld(true);
 const n=new THREE.Box3().setFromObject(model),center=n.getCenter(new THREE.Vector3());
 model.position.x-=center.x;model.position.y-=n.min.y;model.position.z-=center.z;
 return model;
}
export function createCarVisual(style:CarStyle='sedan',color=0xdf6b35):THREE.Group{
 const root=new THREE.Group();root.name=style+'-car';
 const body=new THREE.Group();body.name='body';root.add(body);
 const paint=mat(color,.26),dark=mat(0x242a32),glass=mat(0x405e69,.1),red=new THREE.MeshBasicMaterial({color:0xee4141});
 box(body,0,.63,0,2.16,.74,4.34,paint);
 box(body,0,1.12,-.34,1.72,.66,1.91,glass);
 box(body,0,.99,1.23,1.75,.18,.93,paint);
 for(const x of [-1.09,1.09])for(const z of [-1.46,1.46]){
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.26,12),dark);tire.rotation.z=Math.PI/2;tire.position.set(x,.48,z);root.add(tire);
 }
 for(const x of [-.72,.72]){box(body,x,.72,2.16,.38,.18,.07,new THREE.MeshBasicMaterial({color:0xffe6b5}));box(body,x,.75,-2.18,.35,.18,.08,red);}
 const front=box(body,0,.44,2.21,2.25,.34,.22,mat(0x44464a));front.name='bumper-front';
 const rear=box(body,0,.44,-2.21,2.25,.34,.22,mat(0x44464a));rear.name='bumper-rear';
 if(style==='police'){
  const emergency=new THREE.Group();emergency.name='emergency-bar';root.add(emergency);
  for(const side of [-1,1]){
   const light=new THREE.Mesh(new THREE.BoxGeometry(.73,.16,.42),
    new THREE.MeshBasicMaterial({color:side<0?0xfa283d:0x367fff,transparent:true,opacity:1,depthWrite:false}));
   light.position.set(side*.49,1.7,-.25);light.userData.ownMaterial=true;emergency.add(light);
  }
  box(emergency,0,1.59,-.25,1.6,.06,.49,mat(0x22272c));
 }
 const smoke=new THREE.Group();smoke.name='engine-smoke';root.add(smoke);
 for(let i=0;i<3;i++){
  const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.21+i*.07,0),
   new THREE.MeshBasicMaterial({color:i?0x696d69:0x373c3b,transparent:true,opacity:.25,depthWrite:false}));
  puff.userData.ownMaterial=true;puff.visible=false;puff.userData.smokeIndex=i;smoke.add(puff);
 }
 // Real Kenney model is loaded locally; retained 3D shell serves as deterministic fallback.
 void getModel('vehicles/'+style+'.glb').then(original=>{
  if(!root.parent || root.userData.disposed)return;
  const replacement=fitted(original,2.2,1.65,4.5);
  const extent=new THREE.Box3().setFromObject(replacement).getSize(new THREE.Vector3());replacement.scale.x*=2.2/extent.x;replacement.scale.z*=4.5/extent.z;replacement.updateMatrixWorld(true);const footprint=new THREE.Box3().setFromObject(replacement),mid=footprint.getCenter(new THREE.Vector3());replacement.position.x-=mid.x;replacement.position.z-=mid.z;replacement.position.y-=footprint.min.y;
  const bodyBox=new THREE.Box3().setFromObject(replacement);
  if(!Number.isFinite(bodyBox.min.x))return;
  body.visible=false; for(const child of [...root.children])if(child!==body&&child!==smoke&&child.name!=='emergency-bar'&&!child.name.startsWith('custom-'))child.visible=false;
  replacement.name='loaded-body';replacement.userData.originalGeometry=true;
  replacement.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}if(/wheel/i.test(o.name)){o.userData.wheelBase=o.rotation.clone();}});
  root.add(replacement);
  // Apply impacts that happened while the GLB was still loading, not just future collisions.
  const prior=root.userData.currentDamage as {front:number;rear:number;left:number;right:number}|undefined;
  if(prior)showCarDamage(root,prior);
  const cosmetic=root.userData.cosmetics as {paint:number;spoiler:boolean;neon:boolean}|undefined;
  if(cosmetic)applyCarCosmetics(root,cosmetic);
 }).catch(e=>console.warn('Car GLB fallback:',style,e));
 attachVehicleLights(root);
 return root;
}

/** Real car customisation is attached to the vehicle scene, including after async GLB load.
 * Only the original Kenney BODY material is cloned/tinted, never tyres or shared assets. */
export function applyCarCosmetics(root:THREE.Group,options:{paint:number;spoiler:boolean;neon:boolean}):void{
 root.userData.cosmetics={...options};
 const paint=Math.max(0,Math.min(0xffffff,options.paint|0));
 const original=root.getObjectByName('loaded-body');
 if(original)original.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh)||!obj.name.toLowerCase().includes('body'))return;
  if(!obj.userData.ownPaint){
   const existing=Array.isArray(obj.material)?obj.material:[obj.material];
   const copied=existing.map(m=>m.clone());
   // Single-material GLB primitives have no geometry groups; an array hides them.
   obj.material=Array.isArray(obj.material)?copied:copied[0];
   obj.userData.ownPaint=true;
  }
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  for(const m of mats)if('color' in m && m.color instanceof THREE.Color){
   m.color.set(0xffffff).lerp(new THREE.Color(paint),.46);
  }
 });
 const fallback=root.getObjectByName('body');
 if(fallback)fallback.traverse(o=>{
  if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial&&o.position.y>.65&&o.position.y<1.1){
   // Avoid recolouring windows/tyres. Fallback body and hood only.
   o.material=mat(paint,.26);
  }
 });
 const oldSpoiler=root.getObjectByName('custom-spoiler');if(oldSpoiler)oldSpoiler.removeFromParent();
 const oldGlow=root.getObjectByName('custom-neon');if(oldGlow)oldGlow.removeFromParent();
 if(options.spoiler){
  const spoiler=new THREE.Group();spoiler.name='custom-spoiler';
  box(spoiler,0,1.22,-1.84,2.3,.13,.5,mat(0x22252b,.45));
  for(const x of [-.84,.84])box(spoiler,x,1,-1.84,.14,.45,.18,mat(0x272c32,.45));
  root.add(spoiler);
 }
 if(options.neon){
  const glow=new THREE.Group();glow.name='custom-neon';
  const p=new THREE.Mesh(new THREE.PlaneGeometry(2.8,5.5),new THREE.MeshBasicMaterial({
   color:paint,transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide
  }));
  p.rotation.x=-Math.PI/2;p.position.y=.065;glow.add(p);root.add(glow);
 }
}
/** Dispose per-car meshes and copied paint without invalidating shared model/texture caches. */
export function disposeCarVisual(root:THREE.Group){
 disposeVehicleLights(root);
 root.userData.disposed=true;root.removeFromParent();
 const ownedMaterials=new Set<THREE.Material>();
 root.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh))return;
  if(!obj.userData.sharedGeometry)obj.geometry.dispose();
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  if(obj.userData.ownPaint||obj.userData.ownMaterial)for(const material of materials)ownedMaterials.add(material);
  // Transparent neon is uniquely allocated for each player car.
  if(obj.parent?.name==='custom-neon')for(const material of materials)ownedMaterials.add(material);
 });
 for(const material of ownedMaterials)material.dispose();
 root.clear();
}
/** Visibly deform actual GLB mesh vertices in the direction of the collision. */
export function showCarDamage(root:THREE.Group,damage:{front:number;rear:number;left:number;right:number}){
 root.userData.currentDamage={...damage};root.userData.damageRevision=(root.userData.damageRevision??0)+1;
 const model=root.getObjectByName('loaded-body');
 if(model){
  model.traverse(o=>{
   if(!(o instanceof THREE.Mesh)||/wheel|tire/i.test(o.name))return;
   if(!o.userData.damagePositions){
    o.geometry=o.geometry.clone();o.userData.sharedGeometry=false;
    o.userData.damagePositions=new Float32Array((o.geometry.getAttribute('position') as THREE.BufferAttribute).array);
   }
   const attr=o.geometry.getAttribute('position') as THREE.BufferAttribute,initial=o.userData.damagePositions as Float32Array;
   // Coordinates of each primitive are in its mesh-local space; transform into car space.
   o.updateWorldMatrix(true,false);const rootInv=root.matrixWorld.clone().invert(),toCar=rootInv.multiply(o.matrixWorld);
   for(let i=0;i<attr.count;i++){
    const v=new THREE.Vector3(initial[i*3],initial[i*3+1],initial[i*3+2]).applyMatrix4(toCar);
    let dd=0;
    if(v.z>1.2)dd+=Math.max(0,(v.z-1.2)/1.15)*damage.front*.65;
    if(v.z< -1.2)dd-=Math.max(0,(-v.z-1.2)/1.15)*damage.rear*.65;
    let side=0;if(v.x>.58)side-=Math.min(1,(v.x-.58)/.7)*damage.right*.36;
    if(v.x<-.58)side+=Math.min(1,(-v.x-.58)/.7)*damage.left*.36;
    const carNew=v.clone().add(new THREE.Vector3(side,-Math.abs(dd)*.27,-dd));
    const local=carNew.applyMatrix4(toCar.clone().invert());
    attr.setXYZ(i,local.x,local.y,local.z);
   }
   attr.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();
  });
 }else{
  const shell=root.getObjectByName('body');
  if(shell){shell.scale.z=1-(damage.front+damage.rear)*.12;shell.rotation.z=(damage.left-damage.right)*.1;}
 }
 if(Math.max(...Object.values(damage))>.32){
  const hood=root.getObjectByName('bumper-front');if(hood){hood.rotation.x=-damage.front*.55;hood.position.z=2.21-damage.front*.4;}
  const rear=root.getObjectByName('bumper-rear');if(rear){rear.rotation.x=damage.rear*.5;}
 }
}
/** Car view must be updated independently from physics cadence. */
export function renderCar(root:THREE.Group,s:CarState,dt:number,braking=false,night=0){
 updateVehicleLights(root,night,braking||(s.brakePedal??0)>.05);
 root.position.set(s.x,.055,s.z);root.rotation.y=s.heading;
 const bar=root.getObjectByName('emergency-bar');
 if(bar)for(const child of bar.children){
  if(!(child instanceof THREE.Mesh)||!(child.material instanceof THREE.MeshBasicMaterial))continue;
  if(child.userData.ownMaterial)child.material.opacity=(Math.floor(performance.now()/145)%2)^(child.position.x>0?1:0)?.96:.10;
 }
 const smoke=root.getObjectByName('engine-smoke');
 if(smoke){
  const damaged=s.hp<44,period=performance.now()*.00065;
  for(const child of smoke.children){
   if(!(child instanceof THREE.Mesh))continue;
   const i=Number(child.userData.smokeIndex)||0;
   child.visible=damaged;
   if(damaged){
    const phase=(period+i/3)%1;
    child.position.set(Math.sin(phase*4+i)*(.11+phase*.25),1.55+phase*1.65,1.14+phase*.75);
    child.scale.setScalar(.42+phase*2.25);
    if(child.material instanceof THREE.MeshBasicMaterial)child.material.opacity=(1-phase)*.27;
   }
  }
 }
 const body=root.getObjectByName('loaded-body')??root.getObjectByName('body');
 const travel=(root.userData.wheelTravel??0)+Math.hypot(s.vx,s.vz)*dt/ .38;root.userData.wheelTravel=travel;
 const model=root.getObjectByName('loaded-body');
 if(model)model.traverse(o=>{if(!/wheel/i.test(o.name))return;const base=o.userData.wheelBase as THREE.Euler|undefined;if(!base)return;o.rotation.copy(base);if(/front|wheel.*[ab]$/i.test(o.name))o.rotation.y+=s.steerAngle;o.rotation.x+=travel;});
 if(body){body.rotation.z+=(Math.max(-.12,Math.min(.12,s.steerAngle*s.vx*.014))-body.rotation.z)*Math.min(1,dt*4);body.rotation.x+=(Math.max(-.09,Math.min(.09,braking?-.05:0))-body.rotation.x)*Math.min(1,dt*4);}
}
export class CrimeWorld{
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.OrthographicCamera(-18,18,30,-30,.1,400);
 readonly renderer:THREE.WebGLRenderer;
 readonly root=new THREE.Group();readonly map=new Map<string,Chunk>();readonly walls:Wall[]=[];
 readonly markers=new Map<string,THREE.Mesh>();
 readonly interior=new THREE.Group();
 readonly propertyUpgrades=new THREE.Group();
 readonly props:Prop[]=[];
 private activeProps=new Set<Prop>();
 private brokenLamps=new Set<string>();
 private tyreMarks:THREE.InstancedMesh;
 private skids:TimedSkids;
 cameraScale=1;
 private environmentTime=17.5*3600;clockLabel='17:30';
 private night=0;private cameraHeading=0;private cameraReady=false;
 private navigation=new THREE.Group();private navigationKey='';
 private routeMaterial=new THREE.MeshBasicMaterial({color:0x67e2f5,transparent:true,opacity:.72,depthWrite:false});
 private lampMaterial=new THREE.MeshBasicMaterial({color:0xffcc82,map:glowTexture,transparent:true,opacity:0,depthWrite:false});
 private windowMaterial=new THREE.MeshBasicMaterial({color:0xffcf8c,transparent:true,opacity:0,depthWrite:false});
 private streetLights:THREE.PointLight[]=[];
 private lampAnchors:THREE.Vector3[]=[];private lampRefresh=Infinity;private lampX=Infinity;private lampZ=Infinity;
 get nightAmount():number{return this.night;}
 get viewHeading():number{return this.interior.visible?0:this.cameraHeading;}
 surfaceHeight(x:number,z:number):number{
  if(isRoad(x,z))return .055;
  const theme=districtAt(x,z).theme;
  if(theme==='park' && Math.abs(x%30)>2 && Math.abs(z%30)>2)return .135;
  return .09;
 }

 readonly sky=new THREE.HemisphereLight(0xc7d7ef,0x394033,2.05);
 readonly sun=new THREE.DirectionalLight(0xffdcac,2.35);
 readonly maxChunks=16;
 private w=1;private h=1;private disposed=false;private lastcx=Infinity;private lastcz=Infinity;
 private cameraFocus=new THREE.Vector3();
 private mountResize:ResizeObserver|null=null;
 private testWallSizes=new WeakMap<Wall,{w:number;d:number}>();
 private buildingAssets=new Map<string,THREE.Group>();
 constructor(private mount:HTMLElement){
  this.scene.background=new THREE.Color(0x4a555b);this.scene.add(this.root,this.sky,this.sun,this.sun.target,this.interior,this.navigation);
  this.skids=new TimedSkids(this.scene,(x,z)=>this.surfaceHeight(x,z));this.tyreMarks=this.skids.mesh;
  this.interior.visible=false;
  this.sun.position.set(-45,80,18);
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-45;this.sun.shadow.camera.right=45;this.sun.shadow.camera.top=45;this.sun.shadow.camera.bottom=-45;this.sun.shadow.bias=-.001;
  for(let i=0;i<3;i++){const l=new THREE.PointLight(0xffbb70,0,15,2);this.streetLights.push(l);this.scene.add(l);}
  this.camera.position.set(0,67,21);this.camera.lookAt(0,0,0);
  this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;
  // CSS owns the display size; don't install a permanent inline 1px width/height.
  this.renderer.setSize(this.w,this.h,false);this.mount.appendChild(this.renderer.domElement);
  this.resize();
  if(typeof ResizeObserver!=='undefined'){
   this.mountResize=new ResizeObserver(()=>{if(!this.disposed)this.resize();});
   this.mountResize.observe(this.mount);
  }
  this.makeInterior();
  const palette=new Set([...buildingPaths.map(n=>'buildings/'+n+'.glb'),...streetPaths.map(n=>'streets/'+n+'.glb'),...Object.values(CITY_MODELS).filter(v=>typeof v==='string')]);
  for(const path of palette){void getModel(path).then(m=>{if(this.disposed)return;this.buildingAssets.set(path,m);this.map.forEach(ch=>this.attachModels(ch.group));this.attachModels(this.interior);}).catch(()=>{});}
  this.updateEnvironment(0);
 }
 resize(){this.w=Math.max(1,this.mount.clientWidth);this.h=Math.max(1,this.mount.clientHeight);
  const halfH=25,halfW=halfH*this.w/this.h;
  this.camera.left=-halfW;this.camera.right=halfW;this.camera.top=halfH;this.camera.bottom=-halfH;this.camera.updateProjectionMatrix();
  this.renderer.setSize(this.w,this.h,false);
 }
 private attachModels(group:THREE.Group){
  const buckets=new Map<string,{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];matrices:THREE.Matrix4[];owners:THREE.Object3D[];road:boolean}>();
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert();
  const slots:THREE.Object3D[]=[];group.traverse(o=>{if(o.userData.streetSlot&&!o.userData.visualAttached)slots.push(o);});
  for(const obj of slots){
   const spec=obj.userData.streetSlot as {w:number;h:number;d:number;name:string},source=this.buildingAssets.get(spec.name);if(!source)continue;
   const clone=fitted(source,spec.w,spec.h,spec.d),size=new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());
   if(obj.userData.roadSlot||obj.userData.buildingSlot){
    clone.scale.x*=spec.w/size.x;clone.scale.z*=spec.d/size.z;clone.scale.y*=(obj.userData.roadSlot?.025:spec.h)/size.y;clone.position.y=0;
    clone.updateMatrixWorld(true);const fittedBounds=new THREE.Box3().setFromObject(clone),fittedCentre=fittedBounds.getCenter(new THREE.Vector3());clone.position.x-=fittedCentre.x;clone.position.z-=fittedCentre.z;clone.position.y-=fittedBounds.min.y;
    if(obj.userData.roadSlot)obj.position.y=.03;
   }
   const wall=obj.userData.wall as SceneryWall|undefined;
   if(wall){
    const solid=solidFootprint(clone,obj.userData.buildingSlot?'building':sceneryKind(spec.name));
    obj.updateWorldMatrix(true,false);const worldSolid=solid.clone().applyMatrix4(obj.matrixWorld),centre=worldSolid.getCenter(new THREE.Vector3());
    wall.x=centre.x;wall.z=centre.z;wall.w=Math.max(.12,worldSolid.max.x-worldSolid.min.x);wall.d=Math.max(.12,worldSolid.max.z-worldSolid.min.z);this.testWallSizes.set(wall,{w:wall.w,d:wall.d});const scale=wall.breakable?LIVE.propCollisionScale:LIVE.wallCollisionScale;wall.w*=scale;wall.d*=scale;
   }
   if(obj.userData.lampKey&&!wall?.broken){
    // Anchor the visible bulb and projected pool to the fitted GLB's lamp head.
    const full=new THREE.Box3().setFromObject(clone),head=new THREE.Box3(),point=new THREE.Vector3();
    clone.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const positions=o.geometry.getAttribute('position');if(!positions)return;for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);if(point.y>=full.max.y-.16)head.expandByPoint(point);}});
    const centre=(head.isEmpty()?full:head).getCenter(new THREE.Vector3()).applyMatrix4(obj.matrixWorld).applyMatrix4(inverse);
    const dummy=new THREE.Object3D();
    for(const ref of (obj.userData.lampGlowRefs??[]) as Array<InstanceRef&{bulb:boolean}>){dummy.position.set(centre.x,ref.bulb?centre.y:.12,centre.z);dummy.rotation.set(ref.bulb?0:-Math.PI/2,0,0);dummy.scale.set(ref.bulb?.3:1,ref.bulb?.13:1,ref.bulb?.3:1);dummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,dummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;ref.mesh.computeBoundingSphere();}
    obj.userData.lampHead=new THREE.Vector3(centre.x+group.position.x,centre.y+group.position.y,centre.z+group.position.z);
   }
   obj.userData.visualAttached=true;obj.userData.propTemplate=clone;
   const fallback=obj.getObjectByName('fallback');if(fallback)fallback.visible=false;
   const roadFallback=obj.userData.roadFallback as THREE.Mesh|undefined;if(roadFallback)roadFallback.visible=false;
   // Loading after an impact still produces the correctly toppled object.
   if(wall?.broken){const fall=obj.userData.fallingBody as FallingScenery|undefined;if(fall)fall.bounds.copy(new THREE.Box3().setFromObject(clone));obj.add(clone);continue;}
   // Static GLB primitives share GPU buffers and are batched per material in each chunk.
   obj.updateWorldMatrix(true,false);clone.updateMatrixWorld(true);const transform=inverse.clone().multiply(obj.matrixWorld);
   clone.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material],key=o.geometry.uuid+materials.map(m=>m.uuid).join();let bucket=buckets.get(key);if(!bucket){bucket={geometry:o.geometry,material:o.material,matrices:[],owners:[],road:!!obj.userData.roadSlot};buckets.set(key,bucket);}bucket.matrices.push(transform.clone().multiply(o.matrixWorld));bucket.owners.push(obj);});
  }
  for(const bucket of buckets.values()){const mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.matrices.length);bucket.matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);const owner=bucket.owners[i];if(owner.userData.dynamicProp){const refs=(owner.userData.instanceRefs??=[]) as InstanceRef[];refs.push({mesh,index:i});}});mesh.userData.sharedGeometry=true;mesh.castShadow=!bucket.road;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);}
 }
 private batchBoxes(group:THREE.Group){
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert();const buckets=new Map<THREE.Material,{meshes:THREE.Mesh[];matrices:THREE.Matrix4[]}>();
  group.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.geometry!==unitBox||Array.isArray(o.material)||o.name==='fallback'||o.name==='fallback-road')return;let p=o.parent;while(p&&p!==group){if(p.userData.dynamicProp)return;p=p.parent;}let b=buckets.get(o.material);if(!b){b={meshes:[],matrices:[]};buckets.set(o.material,b);}b.meshes.push(o);b.matrices.push(inverse.clone().multiply(o.matrixWorld));});
  for(const [material,b]of buckets){if(b.meshes.length<2)continue;const mesh=new THREE.InstancedMesh(unitBox,material,b.meshes.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.userData.sharedGeometry=true;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);b.meshes.forEach(o=>o.removeFromParent());}
 }
 private makeChunk(cx:number,cz:number):Chunk{
  const g=new THREE.Group();g.position.set(cx*CHUNK_SIZE,0,cz*CHUNK_SIZE);this.root.add(g);
  const walls:Wall[]=[],props:Prop[]=[];
  const minX=cx===-3?-CITY_EDGE:cx*60,maxX=cx===2?CITY_EDGE:(cx+1)*60,minZ=cz===-3?-CITY_EDGE:cz*60,maxZ=cz===2?CITY_EDGE:(cz+1)*60;
  box(g,(minX+maxX)/2-cx*60,-.24,(minZ+maxZ)/2-cz*60,maxX-minX,.35,maxZ-minZ,ground);
  const local=(x:number,z:number)=>({x:x-cx*CHUNK_SIZE,z:z-cz*CHUNK_SIZE});
  const belongs=(x:number,z:number)=>Math.max(-3,Math.min(2,Math.floor(x/CHUNK_SIZE)))===cx&&Math.max(-3,Math.min(2,Math.floor(z/CHUNK_SIZE)))===cz;
  const palette=CITY_MODELS as Record<string,string>;
  const model=(path:string,x:number,z:number,w:number,h:number,d:number,rotation=0,road=false)=>{
   const p=local(x,z),slot=new THREE.Group();slot.position.set(p.x,road?.03:.09,p.z);slot.rotation.y=rotation;
   slot.userData.streetSlot={name:path,w,h,d};slot.userData.roadSlot=road;g.add(slot);return slot;
  };
  const roads={straight:palette.roadStraight,bend:palette.roadBend,tee:palette.roadIntersection,cross:palette.roadCross,end:palette.roadEnd??palette.roadStraight};
  for(const tile of ROAD_TILES){
   if(!belongs(tile.x,tile.z))continue;
   const p=local(tile.x,tile.z),fall=box(g,p.x,.015,p.z,ROAD_TILE_SIZE,.04,ROAD_TILE_SIZE,asphalt);fall.name='fallback-road';
   const slot=model(roads[tile.kind],tile.x,tile.z,ROAD_TILE_SIZE,.025,ROAD_TILE_SIZE,tile.rotation+CITY_ROAD_ORIENTATION[tile.kind],true);
   slot.userData.roadFallback=fall;
  }
  const prop=(path:string,x:number,z:number,w:number,h:number,d:number,rotation=0,breakable=true)=>{
   if(!clearFootprint(x,z,w,d)||isRoad(x,z))return;
   const obj=model(path,x,z,w,h,d,rotation);obj.userData.dynamicProp=breakable;
   const response=SCENERY_RESPONSE[sceneryKind(path)],slender=/tree|palm|light|pole|sign/.test(path);
   const turned=Math.abs(Math.sin(rotation))>.5,wall:SceneryWall={x,z,w:slender?.24:turned?d:w,d:slender?.24:turned?w:d,kind:path,breakable,...response};obj.userData.wall=wall;walls.push(wall);
   if(breakable){const entry:Prop={root:obj,wall};props.push(entry);this.props.push(entry);}return obj;
  };
  const building=(path:string,x:number,z:number,w:number,h:number,d:number,seed:number,rot=0)=>{
   const turned=Math.abs(Math.sin(rot))>.5,fw=turned?d:w,fd=turned?w:d;
   if(!clearFootprint(x,z,fw,fd)||[-1,1].some(dx=>[-1,1].some(dz=>isRoad(x+dx*(fw/2+.4),z+dz*(fd/2+.4)))))return;
   const obj=model(path,x,z,w,h,d,rot),shell=box(obj,0,h/2,0,w,h,d,buildingMats[seed%5]);shell.name='fallback';
   obj.userData.buildingSlot=true;const wall:Wall={x,z,w:fw,d:fd,kind:'building'};obj.userData.wall=wall;walls.push(wall);
   const p=local(x,z);box(g,p.x,.07,p.z,fw+.5,.015,fd+.5,mat(0x343a3c));
   for(const side of [-1,1])for(let n=-1;n<=1;n++)box(obj,n*w*.25,2,side*(d/2+.025),w*.12,.7,.025,this.windowMaterial);
   return obj;
  };
  const cellModel=model,cellProp=prop,cellBuilding=building;
  for(const block of CITY_BLOCKS){
   const bx=(block.minX+block.maxX)/2,bz=(block.minZ+block.maxZ)/2;
   // Ownership by block centre keeps merged-block colliders alive together.
   if(!belongs(bx,bz))continue;
   const district=districtAt(bx,bz),theme=district.theme;
   let landmark:THREE.Group|undefined;
   if(block.cells.length===4){
    const seed=hash(Math.round(bx),Math.round(bz));
    if(theme==='downtown')landmark=building('buildings/building-skyscraper-a.glb',bx,bz,25,30,25,seed);
    if(theme==='industrial')landmark=building('buildings/building-a.glb',bx,bz,30,8,24,seed);
    if(theme==='commercial')landmark=building(palette.store,bx,bz,28,8,26,seed);
    if(theme==='nightlife')landmark=building(palette.store,bx,bz,26,9,24,seed);
    if(landmark&&theme==='nightlife'){const neon=mat(0x804eb1);neon.emissive.set(0xa148d0);neon.emissiveIntensity=1.6;box(landmark,0,4.7,12.08,23,.5,.1,neon);}
    if(theme==='park'){const p=local(bx,bz);box(g,p.x,.24,p.z,8,.3,8,mat(0xbbb8a3));box(g,p.x,.42,p.z,6.6,.05,6.6,mat(0x528b9e,.3));box(g,p.x,1.2,p.z,1.3,1.6,1.3,mat(0xc6c3b0));}
   }
   for(const cell of block.cells){
    const {x,z}=cell,p=local(x,z),seed=hash(Math.round(x),Math.round(z)),rot=(seed%4)*Math.PI/2;
    const model=(path:string,mx:number,mz:number,w:number,h:number,d:number,rotation=0)=>cellModel(path,x+(mx-x)*.75,z+(mz-z)*.75,w*.75,h,d*.75,rotation);
    const prop=(path:string,mx:number,mz:number,w:number,h:number,d:number,rotation=0,breakable=true)=>cellProp(path,x+(mx-x)*.75,z+(mz-z)*.75,w*.75,h,d*.75,rotation,breakable);
    const building=(path:string,mx:number,mz:number,w:number,h:number,d:number,seed:number,rotation=0)=>cellBuilding(path,x+(mx-x)*.75,z+(mz-z)*.75,w*.75,h,d*.75,seed,rotation);
    const dress=(parent:THREE.Object3D,mx:number,y:number,mz:number,w:number,h:number,d:number,m:THREE.Material)=>box(parent,p.x+(mx-p.x)*.75,y,p.z+(mz-p.z)*.75,w*.75,h,d*.75,m);
    box(g,p.x,.015,p.z,15,.15,15,theme==='park'?mat(0x527953):theme==='suburb'?mat(0x63745a):walk);
    // Removed internal roads become green walks/courts between the joined cells.
    for(const q of block.cells)if(q.x===x+30&&q.z===z){const c=local(x+15,z);box(g,c.x,.015,c.z,15,.15,15,theme==='park'?mat(0x527953):walk);}
    else if(q.z===z+30&&q.x===x){const c=local(x,z+15);box(g,c.x,.015,c.z,15,.15,15,theme==='park'?mat(0x527953):walk);}
    if(landmark){
     const dx=Math.sign(x-bx)*7,dz=Math.sign(z-bz)*7;prop(palette.tree,x+dx,z+dz,3,5,3);
    }else if(theme==='park'){
     dress(g,p.x,.15,p.z,2.6,.035,20,mat(0xb3a995));dress(g,p.x,.15,p.z,20,.035,2.6,mat(0xb3a995));
     for(const dx of [-6,6])for(const dz of [-6,6])prop(palette.tree,x+dx,z+dz,4.4,7+rand(seed+dx)*3,4.4);
     prop(palette.bench,x+3,z+4,2.5,1.2,1,Math.PI/2);
    }else if(theme==='suburb'){
     building(palette.house,x-3,z-2,9,5.5+rand(seed),8,seed,rot);
     dress(g,p.x+5,.105,p.z+3,3,.035,12,mat(0xb2ada0));
     prop(palette.tree,x+6,z-6,3.5,5,3.5);prop(palette.hedge,x,z+8,13,1.3,.9);
    }else if(theme==='industrial'){
     building('buildings/building-a.glb',x-3,z-2,11,5.5,12,seed,rot);
     for(const dz of [-5,0,5]){const wx=x+4.5,wz=z+dz*.75;if(!clearFootprint(wx,wz,3,4))continue;dress(g,p.x+6,1.35,p.z+dz,3,2.6,4,mat(dz===0?0xa15c47:0x456c77,.2));walls.push({x:wx,z:wz,w:2.25,d:3,kind:'freight'});}
     if(seed%3===0){const tower=model(palette.waterTower,x-3,z-2,4,5,4);tower.position.y=5.5;}
     prop('streets/dumpster.glb',x-6,z+7,2,1.4,1.5,0,true);
    }else if(theme==='commercial'){
     building(palette.store,x,z-4,15,5+rand(seed)*3,8,seed,rot);
     dress(g,p.x,.1,p.z+5,16,.025,8,asphalt);
     for(const dx of [-6,-2,2,6])dress(g,p.x+dx,.125,p.z+5,.08,.01,6,mat(0xabb3b2));
     prop(palette.tree,x-8,z+8,2.5,4,2.5);
    }else if(theme==='historic'){
     building('buildings/building-d.glb',x-5,z,7,6,15,seed);building(palette.store,x+5,z-4,7,5,7,seed+1,Math.PI);
     prop(palette.tree,x+3,z+5,3,5,3);prop(palette.bench,x,z+3,2.2,1,1);
    }else if(theme==='waterfront'){
     building(palette.store,x-4,z-3,9,6,10,seed,rot);prop(palette.palm,x+6,z+6,3.5,7,3.5);
     dress(g,p.x+5,.1,p.z-4,4,.025,11,mat(0x8c8069));
     prop(palette.bench,x+5,z+3,2.5,1,1,Math.PI/2);
    }else{
     const tall=theme==='downtown',club=theme==='nightlife';
     const shop=building(palette.store,x-5,z-4,8,club?6:7,9,seed,seed%2?Math.PI:0);
     building(tall?palette.apartmentTall:palette.apartment,x+5,z-3,8,tall?15+rand(seed)*13:8+rand(seed)*5,10,seed+1,rot);
     if(seed%3===0)building(tall?'buildings/building-skyscraper-a.glb':palette.house,x-4,z+6,8,tall?20+rand(seed)*9:5,6,seed+2);
     else prop(palette.tree,x-5,z+6,3.8,6,3.8);
     prop('streets/dumpster.glb',x+5,z+7,1.8,1.3,1.3,0,true);
     if(club&&shop){const neon=mat(seed%2?0xdf49c0:0x39d6e2);neon.emissive.set(seed%2?0xd92eb5:0x24c5dd);neon.emissiveIntensity=1.2;box(shop,0,3.3,4.56,6,.35,.08,neon);}
    }
   }
  }
  const pools:THREE.Matrix4[]=[],bulbs:THREE.Matrix4[]=[],lampSlots:THREE.Group[]=[];
  for(const lamp of ROAD_LAMPS){if(!belongs(lamp.x,lamp.z))continue;
   const slot=prop(palette.streetlight??'streets/light-curved.glb',lamp.x,lamp.z,1.5,5.8,1.5);if(!slot)continue;
   slot.userData.lampKey=lamp.x+':'+lamp.z;lampSlots.push(slot);
   const p=local(lamp.x,lamp.z),bulb=new THREE.Object3D();bulb.position.set(p.x,5.25,p.z);bulb.scale.set(.3,.13,.3);bulb.updateMatrix();bulbs.push(bulb.matrix.clone());
   const pool=new THREE.Object3D();pool.rotation.x=-Math.PI/2;pool.position.set(p.x,.12,p.z);pool.updateMatrix();pools.push(pool.matrix.clone());
  }
  if(pools.length){
   const glow=new THREE.InstancedMesh(lampPoolGeometry,this.lampMaterial,pools.length),bulb=new THREE.InstancedMesh(unitBox,this.windowMaterial,bulbs.length);
   for(const mesh of [glow,bulb]){const matrices=mesh===glow?pools:bulbs;matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);const refs=(lampSlots[i].userData.instanceRefs??=[]) as InstanceRef[];refs.push({mesh,index:i});const glowRefs=(lampSlots[i].userData.lampGlowRefs??=[]) as Array<InstanceRef&{bulb:boolean}>;glowRefs.push({mesh,index:i,bulb:mesh===bulb});});mesh.userData.sharedGeometry=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();g.add(mesh);}
  }
  // Roadside furniture is rooted on the sidewalk, never on a driving lane.
  for(const tile of ROAD_TILES){if(!belongs(tile.x,tile.z)||tile.kind==='straight')continue;const seed=hash(Math.round(tile.x),Math.round(tile.z));
   const sx=tile.x+6.35,sz=tile.z-6.35;
   prop(seed%2?'streets/road-sign-stop.glb':'streets/road-sign-warning.glb',sx,sz,.9,2.7,.8,tile.rotation);
   if(seed%3===0)prop('streets/traffic-light.glb',tile.x-6.35,tile.z+6.35,1,4.7,1,tile.rotation);
   if(seed%5===0)prop('streets/electricity-pole.glb',tile.x+6.9,tile.z+6.9,1.6,6.5,1.6);
   if(seed%4===0)prop('streets/construction-cone.glb',tile.x-6.35,tile.z-6.35,.65,.8,.65);
   if(seed%7===0)prop('streets/construction-fence.glb',tile.x+8,tile.z-6.5,2.4,1.5,.4,tile.rotation);
  }
  // A visible harbour edge: promenade, water, and collision rail beyond the city.
  if(cx===-3&&cz< -1){box(g,-13,-.07,30,26,.15,60,mat(0x416d7b,.2));box(g,-6,.4,30,.3,.6,60,mat(0xb1afa0));walls.push({x:cx*60-6,z:cz*60+30,w:.3,d:60,kind:'harbour-rail'});for(const dz of [12,42])box(g,-12,.1,dz,20,.22,4,mat(0x8c8069));}
  this.batchBoxes(g);this.attachModels(g);return {group:g,walls,props};
 }
 /** Only chunks touching the visible footprint plus a 34m collision safety margin are instantiated.
  * Quantized refresh makes unloading stable while crossing local street blocks. */
 stream(x:number,z:number){
  const qx=Math.floor(x/16),qz=Math.floor(z/16);if(qx===this.lastcx&&qz===this.lastcz)return;
  this.lastcx=qx;this.lastcz=qz;
  const wanted=new Set<string>();
  // Four by four bounds include the complete ownership chunk of every visible merged block.
  const baseX=Math.floor(x/CHUNK_SIZE),baseZ=Math.floor(z/CHUNK_SIZE);
  const startX=baseX-(x-baseX*60<30?2:1),startZ=baseZ-(z-baseZ*60<30?2:1);
  for(let cx=startX;cx<startX+4;cx++)for(let cz=startZ;cz<startZ+4;cz++){
   if(cx< -3||cx>2||cz< -3||cz>2)continue;
   const key=cx+':'+cz;wanted.add(key);
   if(!this.map.has(key))this.map.set(key,this.makeChunk(cx,cz));
  }
  for(const [k,c]of this.map)if(!wanted.has(k)){
   c.props.forEach(p=>{this.activeProps.delete(p);if(p.root.userData.lampKey)this.brokenLamps.delete(p.root.userData.lampKey);});
   this.root.remove(c.group);
   c.props.forEach(p=>{const i=this.props.indexOf(p);if(i>=0)this.props.splice(i,1);});
   disposeWorldVisuals(c.group);
   this.map.delete(k);
  }
  this.walls.length=0;this.map.forEach(c=>this.walls.push(...c.walls));this.applyLiveTuning();
 }
 destroyProp(w:Wall,vx:number,vz:number){
  const p=this.props.find(p=>p.wall===w);if(!p||p.fall)return;
  p.wall.broken=true;
  // Release just this object's instances; all other lamps/models retain their shared materials.
  const zero=new THREE.Matrix4().makeScale(0,0,0);
  for(const ref of (p.root.userData.instanceRefs??[]) as InstanceRef[]){ref.mesh.setMatrixAt(ref.index,zero);ref.mesh.instanceMatrix.needsUpdate=true;}
  const template=p.root.userData.propTemplate as THREE.Group|undefined;
  if(template){const clone=template.clone(true);clone.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});p.root.add(clone);}
  const key=p.root.userData.lampKey as string|undefined;if(key){this.brokenLamps.add(key);this.lampRefresh=Infinity;}
  p.root.updateWorldMatrix(true,true);const inv=p.root.matrixWorld.clone().invert(),bounds=new THREE.Box3();
  p.root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));});
  if(bounds.isEmpty()){const spec=p.root.userData.streetSlot;bounds.set(new THREE.Vector3(-spec.w/2,0,-spec.d/2),new THREE.Vector3(spec.w/2,spec.h,spec.d/2));}
  const direction=new THREE.Vector3(vx,0,vz);if(direction.lengthSq()<.01)direction.set(1,0,0);direction.normalize();
  const momentum=Math.min(9,Math.hypot(vx,vz)*130/(p.wall.mass??50));
  p.fall={root:p.root,bounds,velX:direction.x*momentum,velY:Math.min(1.4,momentum*.15),velZ:direction.z*momentum,angle:.06,angularSpeed:.9,axis:new THREE.Vector3(direction.z,0,-direction.x),baseRotation:p.root.quaternion.clone(),age:0,settled:false,ground:.09};
  p.root.userData.fallingBody=p.fall;this.activeProps.add(p);
 }
 applyLiveTuning(){for(const w of this.walls){let base=this.testWallSizes.get(w);if(!base){base={w:w.w,d:w.d};this.testWallSizes.set(w,base);}const scale=w.breakable?LIVE.propCollisionScale:LIVE.wallCollisionScale;w.w=base.w*scale;w.d=base.d*scale;}for(const p of this.props)if(p.wall.kind&&p.wall.breakable)Object.assign(p.wall,SCENERY_RESPONSE[sceneryKind(p.wall.kind)]);}
 tickProps(dt:number){
  let budget=96;
  for(const p of this.activeProps){if(!p.fall){this.activeProps.delete(p);continue;}const px=p.root.position.x+(p.root.parent?.position.x??0),pz=p.root.position.z+(p.root.parent?.position.z??0);if(Math.hypot(px-this.cameraFocus.x,pz-this.cameraFocus.z)>90)continue;if(budget--<=0)break;stepFallingScenery(p.fall,dt);if(p.fall.settled)this.activeProps.delete(p);}
 }
 marker(id:string,x:number,z:number,color:number){
  const o=new THREE.Mesh(new THREE.TorusGeometry(2,.2,6,30),new THREE.MeshBasicMaterial({color,depthWrite:false}));o.rotation.x=-Math.PI/2;o.position.set(x,.2,z);this.scene.add(o);this.markers.set(id,o);
 }
 nearMarker(x:number,z:number,rad=7):string|null{
  for(const [id,m]of this.markers)if(Math.hypot(m.position.x-x,m.position.z-z)<rad)return id;
  return null;
 }
 follow(x:number,z:number,speed:number,heading:number,dt:number,interior=false,onFoot=false){
  const smooth=1-Math.exp(-Math.max(0,dt)*LIVE.cameraFollow);
  if(interior){
   const entering=!this.interior.visible;this.root.visible=false;this.navigation.visible=false;this.interior.visible=true;
   const desired=new THREE.Vector3(10000+THREE.MathUtils.clamp(x*.45,-2.2,2.2),0,10000+THREE.MathUtils.clamp(z*.35,-1.8,1.8));if(entering)this.cameraFocus.copy(desired);
   this.cameraFocus.lerp(desired,smooth);this.camera.position.set(this.cameraFocus.x,LIVE.interiorHeight,this.cameraFocus.z-LIVE.interiorDistance);this.camera.lookAt(this.cameraFocus);this.camera.zoom=LIVE.interiorZoom*this.cameraScale;this.camera.updateProjectionMatrix();
   (this.scene.background as THREE.Color).set(0x27313a);this.sun.position.set(9990,20,9985);this.sun.target.position.set(10000,0,10000);this.sun.target.updateMatrixWorld();this.streetLights.forEach(l=>l.intensity=0);return;
  }
  if(this.interior.visible||!this.cameraReady){this.cameraFocus.set(x,0,z);this.cameraHeading=onFoot?0:heading;this.cameraReady=true;}
  this.root.visible=true;this.navigation.visible=true;this.interior.visible=false;
  const wantedHeading=LIVE.cameraHeading>=0?THREE.MathUtils.degToRad(LIVE.cameraHeading):onFoot?0:heading;
  const angle=Math.atan2(Math.sin(wantedHeading-this.cameraHeading),Math.cos(wantedHeading-this.cameraHeading));
  this.cameraHeading+=Math.max(-dt*LIVE.cameraTurnRate,Math.min(dt*LIVE.cameraTurnRate,angle*(1-Math.exp(-dt*LIVE.cameraTurnSmoothing))));
  const fx=Math.sin(this.cameraHeading),fz=Math.cos(this.cameraHeading),ahead=onFoot?LIVE.walkingLookAhead:LIVE.drivingLookAhead+Math.min(Math.abs(speed)*LIVE.speedLookAhead,LIVE.maxLookAhead);
  this.cameraFocus.lerp(new THREE.Vector3(x+fx*ahead,0,z+fz*ahead),smooth);
  this.camera.position.set(this.cameraFocus.x-fx*(onFoot?LIVE.walkingDistance:LIVE.drivingDistance),(LIVE.cameraPitch>=0?Math.tan(THREE.MathUtils.degToRad(LIVE.cameraPitch))*(onFoot?LIVE.walkingDistance:LIVE.drivingDistance):onFoot?LIVE.walkingHeight:LIVE.drivingHeight),this.cameraFocus.z-fz*(onFoot?LIVE.walkingDistance:LIVE.drivingDistance));this.camera.lookAt(this.cameraFocus);
  this.camera.far=Math.max(.2,LIVE.cameraFar);const targetZoom=Math.max(.05,(onFoot?LIVE.walkingZoom:LIVE.drivingZoom-Math.min(Math.abs(speed)/LIVE.speedZoomScale,LIVE.speedZoomRange))*this.cameraScale);
  this.camera.zoom+=(targetZoom-this.camera.zoom)*(1-Math.exp(-dt*LIVE.cameraZoomSmoothing));this.camera.updateProjectionMatrix();
  this.sun.position.set(x-32,60,z-22);this.sun.target.position.set(x,0,z);this.sun.target.updateMatrixWorld();
  this.lampRefresh+=dt;
  if(this.lampRefresh>=.5||Math.hypot(x-this.lampX,z-this.lampZ)>4){
   this.lampRefresh=0;this.lampX=x;this.lampZ=z;
   // Anchors are deterministic, so no scene traversal/matrix update is required.
   const candidates=this.props.filter(p=>p.root.userData.lampKey&&!p.wall.broken&&Math.hypot(p.wall.x-x,p.wall.z-z)<28).map(p=>(p.root.userData.lampHead as THREE.Vector3|undefined)?.clone()??new THREE.Vector3(p.wall.x,4.5,p.wall.z));
   candidates.sort((a,b)=>a.distanceToSquared(this.cameraFocus)-b.distanceToSquared(this.cameraFocus));this.lampAnchors=candidates.slice(0,3);
  }
  this.streetLights.forEach((l,i)=>{const anchor=this.lampAnchors[i];l.intensity=anchor?this.night*LIVE.streetLight:0;if(anchor)l.position.copy(anchor);});
 }
 restoreClock(elapsedSeconds:number){
  this.environmentTime=(17.5*3600+Math.max(0,Number.isFinite(elapsedSeconds)?elapsedSeconds:0)*72)%86400;this.updateEnvironment(0);
 }
 updateEnvironment(dt:number){
  this.environmentTime=(this.environmentTime+Math.max(0,dt)*LIVE.clockSpeed)%86400;
  if(LIVE.clockOverride>=0)this.environmentTime=LIVE.clockOverride*3600;
  const hours=this.environmentTime/3600;this.clockLabel=String(Math.floor(hours)).padStart(2,'0')+':'+String(Math.floor(hours%1*60)).padStart(2,'0');
  this.skids.tick(dt);
  const light=daylightAt(hours),daylight=light.day;this.night=light.night;
  this.sky.intensity=(.9+daylight*1.05)*LIVE.ambientLight;this.sky.color.set(0x9bb6e2).lerp(new THREE.Color(0xcbddea),daylight);
  this.sky.color.lerp(new THREE.Color(0xffda8b),(light.dawn+light.golden)*.22).lerp(new THREE.Color(0xe696af),light.dusk*.22);
  this.sky.groundColor.set(0x3a4965).lerp(new THREE.Color(0x636858),daylight).lerp(new THREE.Color(0xaa8750),(light.dawn+light.golden)*.20).lerp(new THREE.Color(0x9b6571),light.dusk*.18);
  this.sun.intensity=(.32+daylight*2.35)*LIVE.sunLight;this.sun.color.set(0xffebce).lerp(new THREE.Color(0xffd473),light.dawn+light.golden).lerp(new THREE.Color(0xfa919e),light.dusk);
  (this.scene.background as THREE.Color).set(0x17243d).lerp(new THREE.Color(0x849da8),daylight).lerp(new THREE.Color(0xdcc59b),(light.dawn+light.golden)*.18).lerp(new THREE.Color(0xba91a3),light.dusk*.20);
  this.lampMaterial.opacity=this.night*LIVE.streetGlow;this.windowMaterial.opacity=this.night*LIVE.windowGlow;
  this.routeMaterial.opacity=.58+Math.sin(this.environmentTime*.07)*.14;
  this.renderer.toneMappingExposure=(1.16+daylight*.12)*LIVE.exposure;
  this.renderer.shadowMap.enabled=LIVE.shadows>=.5;const pixel=Math.min(globalThis.devicePixelRatio||1,LIVE.pixelRatio);if(this.renderer.getPixelRatio()!==pixel){this.renderer.setPixelRatio(pixel);this.resize();};
 }
 setNavigation(target:{x:number;z:number;label?:string}|null,player:{x:number;z:number;heading:number}):void{
  const key=target?`${Math.round(player.x/4)},${Math.round(player.z/4)}:${target.x},${target.z}`:'';if(key===this.navigationKey)return;this.navigationKey=key;disposeWorldVisuals(this.navigation);this.navigation.clear();if(!target)return;
  const points=roadRoute({x:player.x,z:player.z},{x:target.x,z:target.z});
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)continue;
   const angle=Math.atan2(b.x-a.x,b.z-a.z);
   for(let distance=2;distance<length;distance+=7){
    const t=distance/length,arrow=new THREE.Group();arrow.position.set(a.x+(b.x-a.x)*t,.15,a.z+(b.z-a.z)*t);arrow.rotation.y=angle;
    for(const side of [-1,1]){const arm=box(arrow,side*.25,0,-.22,.09,.012,.72,this.routeMaterial);arm.rotation.y=-side*Math.PI/4;}
    this.navigation.add(arrow);
   }
  }

 }
 private interiorModel(parent:THREE.Group,path:string,x:number,z:number,w:number,h:number,d:number,rotation=0,y=0){
  const slot=new THREE.Group();slot.position.set(x,y,z);slot.rotation.y=rotation;slot.userData.streetSlot={name:path,w,h,d};slot.userData.buildingSlot=true;parent.add(slot);
  const fallback=box(slot,0,h/2,0,w,h,d,mat(0x596267));fallback.name='fallback';return slot;
 }
 private makeInterior(){
  const room=this.interior,palette=CITY_MODELS;room.position.set(10000,0,10000);room.add(this.propertyUpgrades);
  // Narrow, staggered floorboards and skirting keep this an actual furnished room.
  box(room,0,-.13,0,16,.2,17,mat(0x35302d));
  for(let row=0;row<24;row++)for(let plank=0;plank<4;plank++)box(room,-6+plank*4,-.016,-8.12+row*.7,3.98,.035,.676,mat([0x65564a,0x716052,0x796555,0x695747][(row+plank)%4]));
  box(room,0,1.4,8.5,16,2.8,.3,mat(0x656c69));
  box(room,-8,1.2,0,.3,2.4,17,mat(0x424b50));box(room,8,1.2,0,.3,2.4,17,mat(0x424b50));
  for(const side of [-1,1])box(room,side*7.8,.16,0,.15,.32,17,mat(0x272d30));
  box(room,0,.16,8.25,16,.32,.15,mat(0x2b3236));
  // Port-facing sash window on the rear wall; no near-camera wall blocks the entrance.
  box(room,-1,1.8,8.30,4.6,1.55,.11,mat(0x20292d));box(room,-1,1.8,8.22,4.3,1.28,.10,mat(0x80999a,.15));
  for(const x of [-2.4,-1,.4])box(room,x,1.8,8.13,.065,1.4,.1,mat(0xc4c9bf));box(room,-1,1.8,8.13,4.3,.065,.1,mat(0xc4c9bf));
  const bed=this.interiorModel(room,palette.bed,-4,-4,4.6,1.05,3.6);bed.rotation.y=Math.PI/2;bed.userData.streetSlot={name:palette.bed,w:3.6,h:1.05,d:4.6};
  // These footprints match engine bedroom, kitchen and table blockers.
  for(const offset of [-1.55,0,1.55])this.interiorModel(room,palette.kitchenCabinet,4+offset,-5,1.45,1.55,2.0);
  this.interiorModel(room,palette.table,4,2,2.5,1.1,3.35);
  this.interiorModel(room,palette.chair,4,3.25,.68,1.35,.68,Math.PI);
  this.interiorModel(room,palette.chair,4,.75,.68,1.35,.68);
  this.interiorModel(room,palette.bookcase,-6,-4,1.1,2.5,.65,Math.PI/2);
  this.interiorModel(room,palette.pottedPlant,6.1,-5,.64,1.65,.64);
  this.interiorModel(room,palette.floorLamp,-5.8,-2.7,.65,2.5,.65);
  // A woven entry rug remains entirely traversable.
  box(room,-2,.015,3.8,4.5,.025,3.1,mat(0x3a575d));
  for(const x of [-4.08,.08])box(room,x,.035,3.8,.15,.015,2.9,mat(0xb09a78));
  for(let i=0;i<9;i++)box(room,-2,.036,2.5+i*.32,4.05,.008,.075,mat(i%2?0x65797a:0x527076));
  // Warm room illumination and close directional shadows ground every model.
  const light=new THREE.PointLight(0xffdec0,65,23,2);light.position.set(-2,4.4,1);room.add(light);
  const fill=new THREE.PointLight(0xadc8d5,25,16,2);fill.position.set(5,3,5);room.add(fill);
  this.batchBoxes(room);this.attachModels(room);
 }
 addSkidMark(x:number,z:number,heading:number){this.skids.add(x,z,heading);}
 /** Real room dressing changes as money is invested in the property. */
 setInteriorLevels(houseLevel:number,garageLevel:number){
  const g=this.propertyUpgrades;
  // Dynamic room furniture is rebuilt only on purchase, never every frame.
  for(const child of [...g.children]){
   g.remove(child);disposeWorldVisuals(child);
  }
  const create=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>box(g,x,y,z,w,h,d,mat(color));
  // Functional garage workbench, laptop and money safe, then higher-end upgrades.
  if(garageLevel>=1){
   this.interiorModel(g,CITY_MODELS.table,3,5,3.8,1.05,1.4);this.interiorModel(g,CITY_MODELS.chair,3,5.2,.65,1.2,.65);
   create(4.3,1.35,5,.9,.6,.09,0x344a54);
  }
  if(garageLevel>=2){
   create(6,1,1,.35,2.0,.35,0xc18532);create(7,1,1,.35,2.0,.35,0xc18532);
   create(6.5,2.04,1,2.1,.2,.45,0xd6b076);
   create(6.5,.12,1,2.4,.19,4.6,0x4b555d);
  }
  if(garageLevel>=3){
   create(5,2.55,-4,2,.22,1,0xf1c266);create(5,1.9,-4,1.5,1,.2,0x40494c);
   create(3,.4,5.85,4,.3,.2,0x446a52);
  }
  if(houseLevel>=1){
   this.interiorModel(g,CITY_MODELS.sofa,-5.5,4,3.2,1.4,1.35,Math.PI/2);this.interiorModel(g,CITY_MODELS.pottedPlant,-6.8,5.8,.75,1.8,.75);
   create(-4.8,.18,1.3,4,.12,2.8,0x856c52);
  }
  if(houseLevel>=2){
   create(-4,2.1,-7.9,5,2.2,.22,0x232d3f);
   create(-4,2.1,-7.72,4.5,1.7,.14,0x2f7180);
   create(-6,1,-6.7,.9,2.0,.9,0x252b30);
  }
  if(houseLevel>=3){
   create(-6.5,1.8,-1.3,.18,3.4,.18,0xd4a05a);
   create(-6.5,3.4,-1.3,2.4,.18,1.3,0xf9cd8e);
   this.interiorModel(g,CITY_MODELS.floorLamp,-6.5,-1.3,.7,3.2,.7);
   const lamp=new THREE.PointLight(0x90b0ff,12,12);lamp.position.set(-4.2,2.3,-3);g.add(lamp);
  }
  this.batchBoxes(g);this.attachModels(g);
 }
 render(){this.renderer.render(this.scene,this.camera);}
 dispose(){
  this.disposed=true;
  this.mountResize?.disconnect();
  this.map.forEach(c=>{disposeWorldVisuals(c.group);c.group.removeFromParent();});
  this.map.clear();this.activeProps.clear();this.brokenLamps.clear();this.props.length=0;this.walls.length=0;
  this.skids.dispose();
  this.renderer.dispose();this.renderer.domElement.remove();
  disposeWorldVisuals(this.navigation);this.navigation.clear();this.routeMaterial.dispose();this.lampMaterial.dispose();this.windowMaterial.dispose();
  disposeWorldVisuals(this.interior);this.interior.removeFromParent();
  this.markers.forEach(o=>{o.geometry.dispose();(o.material as THREE.Material).dispose();o.removeFromParent();});
 }
}

