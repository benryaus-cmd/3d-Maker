import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {crimeAssetURL} from './assets';
import {CITY_MODELS} from './CityModels';
import {type CarState,type Wall} from './vehiclePhysics';

type Prop={root:THREE.Group;wall:Wall;velX:number;velZ:number;life:number};
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
const ground=mat(0x4c5750),lineWhite=new THREE.MeshBasicMaterial({color:0xb5b5a9}),lineYellow=new THREE.MeshBasicMaterial({color:0xe9b95b});
const unitBox=new THREE.BoxGeometry(1,1,1);
// InstancedMesh owns matrix buffers even when its geometry/material are cached.
function disposeWorldVisuals(root:THREE.Object3D){
 root.traverse(o=>{
  if(o instanceof THREE.InstancedMesh)o.dispose();
  if(o instanceof THREE.Mesh&&!o.userData.sharedGeometry)o.geometry.dispose();
 });
}
const box=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const o=new THREE.Mesh(unitBox,m);o.scale.set(w,h,d);o.userData.sharedGeometry=true;o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o;};
const hash=(x:number,z:number)=>((Math.imul(x+2903,73856093)^Math.imul(z+9851,19349663))>>>0);
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
 root.userData.currentDamage={...damage};
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
export function renderCar(root:THREE.Group,s:CarState,dt:number,braking=false){
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
 private tyreMarks:THREE.InstancedMesh;
 private skidCursor=0;private skidSide=0;private skidPrevious:Array<{x:number;z:number;time:number}|null>=[null,null];
 private skidDummy=new THREE.Object3D();
 private environmentTime=17.5*3600;clockLabel='17:30';
 private night=0;private cameraHeading=0;private cameraReady=false;
 private navigation=new THREE.Group();private navigationKey='';
 private routeMaterial=new THREE.MeshBasicMaterial({color:0xf5ba59,transparent:true,opacity:.7,depthWrite:false});
 private lampMaterial=new THREE.MeshBasicMaterial({color:0xffcc82,transparent:true,opacity:0,depthWrite:false});
 private windowMaterial=new THREE.MeshBasicMaterial({color:0xffcf8c,transparent:true,opacity:0,depthWrite:false});
 private streetLights:THREE.PointLight[]=[];
 private lampAnchors:THREE.Vector3[]=[];private lampRefresh=Infinity;private lampX=Infinity;private lampZ=Infinity;
 get viewHeading():number{return this.interior.visible?0:this.cameraHeading;}
 surfaceHeight(x:number,z:number):number{
  const nearestX=Math.round(x/32)*32,nearestZ=Math.round(z/32)*32;
  if(Math.abs(x-nearestX)<=5.75||Math.abs(z-nearestZ)<=5.75)return .055;
  const blockX=Math.floor(x/32),blockZ=Math.floor(z/32),localX=x-(blockX*32+16),localZ=z-(blockZ*32+16);
  const kind=hash(blockX,blockZ)%7;
  if(kind===0&&Math.abs(localX)<8.5&&Math.abs(localZ)<8.5){if(Math.abs(localX)<1.5||Math.abs(localZ)<1.3)return .17;return .135;}
  if((kind===1||kind===2)&&Math.abs(localX)<9&&Math.abs(localZ)<9)return .14;
  if(Math.abs(localX)>10.1||Math.abs(localZ)>10.1)return -.065;
  return .09;
 }
 readonly sky=new THREE.HemisphereLight(0xc7d7ef,0x394033,2.05);
 readonly sun=new THREE.DirectionalLight(0xffdcac,2.35);
 readonly maxChunks=16;
 private w=1;private h=1;private disposed=false;private lastcx=Infinity;private lastcz=Infinity;
 private cameraFocus=new THREE.Vector3();
 private mountResize:ResizeObserver|null=null;
 private buildingAssets=new Map<string,THREE.Group>();
 constructor(private mount:HTMLElement){
  this.scene.background=new THREE.Color(0x4a555b);this.scene.add(this.root,this.sky,this.sun,this.sun.target,this.interior,this.navigation);
  // Fixed-size 3D roadway skid decals: one GPU draw call regardless of how far user drives.
  this.tyreMarks=new THREE.InstancedMesh(new THREE.PlaneGeometry(.20,1),
   new THREE.MeshBasicMaterial({color:0x14191e,transparent:true,opacity:.61,depthWrite:false,side:THREE.DoubleSide}),420);
  this.tyreMarks.count=0;this.tyreMarks.frustumCulled=false;
  this.tyreMarks.renderOrder=2;this.scene.add(this.tyreMarks);
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
  const buckets=new Map<string,{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];matrices:THREE.Matrix4[];road:boolean}>();
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
   const wall=obj.userData.wall as Wall|undefined;
   if(wall&&!obj.userData.buildingSlot){const bounds=new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3());const rot=Math.abs(Math.sin(obj.rotation.y))>.5;wall.w=rot?bounds.z:bounds.x;wall.d=rot?bounds.x:bounds.z;}
   obj.userData.visualAttached=true;const fallback=obj.getObjectByName('fallback');if(fallback)fallback.visible=false;
   const roadFallback=obj.userData.roadFallback as THREE.Mesh|undefined;if(roadFallback)roadFallback.visible=false;
   if(obj.userData.dynamicProp){obj.add(clone);continue;}
   // Static GLB primitives share GPU buffers and are batched per material in each chunk.
   obj.updateWorldMatrix(true,false);clone.updateMatrixWorld(true);const transform=inverse.clone().multiply(obj.matrixWorld);
   clone.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material],key=o.geometry.uuid+materials.map(m=>m.uuid).join();let bucket=buckets.get(key);if(!bucket){bucket={geometry:o.geometry,material:o.material,matrices:[],road:!!obj.userData.roadSlot};buckets.set(key,bucket);}bucket.matrices.push(transform.clone().multiply(o.matrixWorld));});
  }
  for(const bucket of buckets.values()){const mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.matrices.length);bucket.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.userData.sharedGeometry=true;mesh.castShadow=!bucket.road;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);}
 }
 private batchBoxes(group:THREE.Group){
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert();const buckets=new Map<THREE.Material,{meshes:THREE.Mesh[];matrices:THREE.Matrix4[]}>();
  group.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.geometry!==unitBox||Array.isArray(o.material)||o.name==='fallback'||o.name==='fallback-road')return;let p=o.parent;while(p&&p!==group){if(p.userData.dynamicProp)return;p=p.parent;}let b=buckets.get(o.material);if(!b){b={meshes:[],matrices:[]};buckets.set(o.material,b);}b.meshes.push(o);b.matrices.push(inverse.clone().multiply(o.matrixWorld));});
  for(const [material,b]of buckets){if(b.meshes.length<2)continue;const mesh=new THREE.InstancedMesh(unitBox,material,b.meshes.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.userData.sharedGeometry=true;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);b.meshes.forEach(o=>o.removeFromParent());}
 }
 private makeChunk(cx:number,cz:number):Chunk{
  const g=new THREE.Group();g.position.set(cx*96,0,cz*96);this.root.add(g);
  const walls:Wall[]=[],props:Prop[]=[];box(g,48,-.24,48,96,.35,96,ground);
  const model=(path:string,x:number,z:number,w:number,h:number,d:number,rotation=0,road=false)=>{
   const slot=new THREE.Group();slot.position.set(x,road?-.10:0,z);slot.rotation.y=rotation;
   slot.userData.streetSlot={name:path,w,h,d};slot.userData.roadSlot=road;g.add(slot);return slot;
  };
  const palette=CITY_MODELS as Record<string,string>;
  // The 32m street graph remains exact; detailed tiles occupy its 11.5m road width.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
   const x=a*32,z=b*32;
   box(g,x,.0,z,11.5,.045,11.5,asphalt);
   model(palette.roadCross??'roads/road-crossroad-path.glb',x,z,11.5,.3,11.5,0,true);
   for(const turn of [false,true]){
    const sx=turn?x+16:x,sz=turn?z:z+16;
    const fall=box(g,sx,.0,sz,turn?20.5:11.5,.045,turn?11.5:20.5,asphalt);
    const tile=model(palette.roadStraight??'roads/road-straight.glb',sx,sz,11.5,.3,20.5,turn?Math.PI/2:0,true);
    fall.name='fallback-road';tile.userData.roadFallback=fall;
    // Painted central dashes remain legible under the imported dark road surface.
    for(let n=-6;n<=6;n+=6)box(g,sx+(turn?n:0),.13,sz+(turn?0:n),turn?2.5:.13,.012,turn?.13:2.5,lineYellow);
   }
  }
  const prop=(path:string,x:number,z:number,w:number,h:number,d:number,rotation=0,breakable=false)=>{
   const obj=model(path,x,z,w,h,d,rotation);obj.userData.dynamicProp=breakable;const wall:Wall={x:cx*96+x,z:cz*96+z,w:rotation?d:w,d:rotation?w:d,kind:path,breakable};obj.userData.wall=wall;walls.push(wall);
   if(breakable){const entry={root:obj,wall,velX:0,velZ:0,life:0};props.push(entry);this.props.push(entry);}return obj;
  };
  const building=(path:string,x:number,z:number,w:number,h:number,d:number,seed:number,rot=0)=>{
   const obj=model(path,x,z,w,h,d,rot);const shell=box(obj,0,h/2,0,w,h,d,buildingMats[seed%5]);shell.name='fallback';
   const wall:Wall={x:cx*96+x,z:cz*96+z,w:rot?d:w,d:rot?w:d,kind:'building'};obj.userData.buildingSlot=true;obj.userData.wall=wall;walls.push(wall);
   // Contact shadow and emissive shop/window accents are inexpensive shared geometry.
   box(g,x,.07,z,w+.5,.015,d+.5,mat(0x343a3c));
   for(const side of [-1,1])for(let n=-1;n<=1;n++)box(obj,n*w*.25,2,side*(d/2+.025),w*.12,.7,.025,this.windowMaterial);
   return obj;
  };
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
   const x=a*32+16,z=b*32+16,seed=hash(cx*3+a,cz*3+b),kind=seed%7;
   box(g,x,.015,z,20.2,.15,20.2,walk);
   if(kind===0){
    // A planted neighbourhood pocket, traversable paths, real benches and trees.
    box(g,x,.105,z,17,.06,17,mat(0x526d51));box(g,x,.15,z,3,.04,18,mat(0xa49b87));box(g,x,.15,z,18,.04,2.6,mat(0xa49b87));
    for(const dx of [-6,6])for(const dz of [-6,6])prop(palette.tree,x+dx,z+dz,3.8,5,3.8);
    for(const dz of [-4.5,4.5])prop(palette.bench,x+3,z+dz,2.3,1.2,1,Math.PI/2);
    for(const dx of [-8,8])model(palette.hedge,x+dx,z,1.1,1,8);
   }else if(kind===1||kind===2){
    // Freight yards alternate with service warehouses; open loading space is a shortcut.
    box(g,x,.11,z,18,.06,18,mat(0x535958));
    building('buildings/building-a.glb',x-4,z-3,8,5.5,12,seed);
    if(kind===2){const tower=model(palette.waterTower,x-4,z-3,3,4,3);tower.position.y=5.5;}
    for(const dz of [-5,0,5]){
     box(g,x+4,1.35,z+dz,3.5,2.6,4.2,mat(dz===0?0x895145:0x426f72,.2));
     walls.push({x:cx*96+x+4,z:cz*96+z+dz,w:3.5,d:4.2,kind:'freight'});
     for(const offset of [-1.4,-.7,0,.7,1.4])box(g,x+4+offset,1.35,z+dz+2.12,.07,2.4,.035,mat(0x334e51));
    }
    prop('streets/construction-fence.glb',x,z+8.4,8,1.8,.35,0,true);
    prop('streets/dumpster.glb',x-7,z+6.5,2,1.4,1.5,0,true);
   }else{
    // Closely grouped shopfronts/apartments leave a proper 3m service alley.
    building(palette.store,x-5,z-4.8,7.7,6.3,9,seed);
    building(kind===3?palette.apartmentTall:palette.apartment,x+5,z-4,7.6,kind===3?11:8,10.5,seed+2);
    building('buildings/'+buildingPaths[(seed>>>3)%4]+'.glb',x-4.8,z+5.5,8,6+rand(seed)*4,6.8,seed+1);
    if(kind===6)building(palette.house,x+5,z+6,7,5,6,seed+3);
    else{box(g,x+5,.13,z+5.5,7,.025,7,asphalt);for(const dz of [3.3,5.5,7.7])box(g,x+5,.15,z+dz,6,.02,.08,lineWhite);}
    prop('streets/dumpster.glb',x,z+6,1.7,1.3,1.2,0,true);
    prop(palette.tree,x+8,z+8,2.4,3.7,2.4);
   }
   // Consistent curbs and corner lamps make roads read as one district.
   for(const dx of [-10,10])box(g,x+dx,.16,z,.19,.19,20.2,mat(0xaaa594));
   for(const dz of [-10,10])box(g,x,.16,z+dz,20.2,.19,.19,mat(0xaaa594));
   model(palette.streetlight??'streets/light-curved.glb',x-8.4,z-8.4,.9,5.8,.9);
   const glow=new THREE.Mesh(new THREE.CircleGeometry(3.5,16),this.lampMaterial);glow.rotation.x=-Math.PI/2;glow.position.set(x-8.4,.19,z-8.4);glow.userData.lampPool=true;g.add(glow);
   box(g,x-8.4,5.25,z-8.4,.28,.13,.3,this.windowMaterial);
   if(seed%2===0)prop('streets/construction-cone.glb',x+8.1,z-8.1,.7,.9,.7,0,true);
  }
  this.batchBoxes(g);this.attachModels(g);return {group:g,walls,props};
 }
 /** Only chunks touching the visible footprint plus a 34m collision safety margin are instantiated.
  * Quantized refresh makes unloading stable while crossing local street blocks. */
 stream(x:number,z:number){
  const qx=Math.floor(x/16),qz=Math.floor(z/16);if(qx===this.lastcx&&qz===this.lastcz)return;
  this.lastcx=qx;this.lastcz=qz;
  const wanted=new Set<string>();
  const cameraDepth=Math.max(42,25/Math.max(.45,this.w/this.h));
  const radiusX=27+34,radiusZ=cameraDepth+26;
  for(let cx=Math.floor((x-radiusX)/96);cx<=Math.floor((x+radiusX)/96);cx++)
   for(let cz=Math.floor((z-radiusZ)/96);cz<=Math.floor((z+radiusZ)/96);cz++){
   const key=cx+':'+cz;wanted.add(key);
   if(!this.map.has(key))this.map.set(key,this.makeChunk(cx,cz));
  }
  for(const [k,c]of this.map)if(!wanted.has(k)){
   this.root.remove(c.group);
   c.props.forEach(p=>{const i=this.props.indexOf(p);if(i>=0)this.props.splice(i,1);});
   disposeWorldVisuals(c.group);
   this.map.delete(k);
  }
  this.walls.length=0;this.map.forEach(c=>this.walls.push(...c.walls));
 }
 destroyProp(w:Wall,vx:number,vz:number){
  const p=this.props.find(p=>p.wall===w);if(!p)return;
  p.wall.broken=true;p.velX=vx*.55+(Math.random()-.5)*2;p.velZ=vz*.55+(Math.random()-.5)*2;p.life=2.5;
  p.root.rotation.x=.5;p.root.rotation.z=.6;
 }
 tickProps(dt:number){
  for(const p of this.props)if(p.life>0){p.life-=dt;p.root.position.x+=p.velX*dt;p.root.position.z+=p.velZ*dt;p.root.rotation.x+=dt*3;p.root.rotation.z+=dt*4;p.velX*=.95;p.velZ*=.95;p.root.visible=p.life>0;}
 }
 marker(id:string,x:number,z:number,color:number){
  const o=new THREE.Mesh(new THREE.TorusGeometry(2,.2,6,30),new THREE.MeshBasicMaterial({color,depthWrite:false}));o.rotation.x=-Math.PI/2;o.position.set(x,.2,z);this.scene.add(o);this.markers.set(id,o);
 }
 nearMarker(x:number,z:number,rad=7):string|null{
  for(const [id,m]of this.markers)if(Math.hypot(m.position.x-x,m.position.z-z)<rad)return id;
  return null;
 }
 follow(x:number,z:number,speed:number,heading:number,dt:number,interior=false,onFoot=false){
  const smooth=1-Math.exp(-Math.max(0,dt)*5);
  if(interior){
   const entering=!this.interior.visible;this.root.visible=false;this.navigation.visible=false;this.interior.visible=true;
   const desired=new THREE.Vector3(10000+THREE.MathUtils.clamp(x*.45,-2.2,2.2),0,10000+THREE.MathUtils.clamp(z*.35,-1.8,1.8));if(entering)this.cameraFocus.copy(desired);
   this.cameraFocus.lerp(desired,smooth);this.camera.position.set(this.cameraFocus.x,20,this.cameraFocus.z-16);this.camera.lookAt(this.cameraFocus);this.camera.zoom=1.52;this.camera.updateProjectionMatrix();
   (this.scene.background as THREE.Color).set(0x27313a);this.sun.position.set(9990,20,9985);this.sun.target.position.set(10000,0,10000);this.sun.target.updateMatrixWorld();this.streetLights.forEach(l=>l.intensity=0);return;
  }
  if(this.interior.visible||!this.cameraReady){this.cameraFocus.set(x,0,z);this.cameraHeading=onFoot?0:heading;this.cameraReady=true;}
  this.root.visible=true;this.navigation.visible=true;this.interior.visible=false;
  const wantedHeading=onFoot?0:heading;
  const angle=Math.atan2(Math.sin(wantedHeading-this.cameraHeading),Math.cos(wantedHeading-this.cameraHeading));
  this.cameraHeading+=Math.max(-dt*.95,Math.min(dt*.95,angle*(1-Math.exp(-dt*2.2))));
  const fx=Math.sin(this.cameraHeading),fz=Math.cos(this.cameraHeading),ahead=onFoot?1.4:3.5+Math.min(Math.abs(speed)*.12,6);
  this.cameraFocus.lerp(new THREE.Vector3(x+fx*ahead,0,z+fz*ahead),smooth);
  this.camera.position.set(this.cameraFocus.x-fx*(onFoot?20:28),onFoot?25:40,this.cameraFocus.z-fz*(onFoot?20:28));this.camera.lookAt(this.cameraFocus);
  const targetZoom=onFoot?2.3:1.22-Math.min(Math.abs(speed)/55,.22);
  this.camera.zoom+=(targetZoom-this.camera.zoom)*(1-Math.exp(-dt*2.8));this.camera.updateProjectionMatrix();
  this.sun.position.set(x-32,60,z-22);this.sun.target.position.set(x,0,z);this.sun.target.updateMatrixWorld();
  this.lampRefresh+=dt;
  if(this.lampRefresh>=.5||Math.hypot(x-this.lampX,z-this.lampZ)>4){
   this.lampRefresh=0;this.lampX=x;this.lampZ=z;
   // Anchors are deterministic, so no scene traversal/matrix update is required.
   const candidates:THREE.Vector3[]=[];
   for(let bx=Math.floor((x-24)/32);bx<=Math.floor((x+24)/32);bx++)for(let bz=Math.floor((z-24)/32);bz<=Math.floor((z+24)/32);bz++){
    const lx=bx*32+7.6,lz=bz*32+7.6;if(Math.hypot(lx-x,lz-z)<25)candidates.push(new THREE.Vector3(lx,4.5,lz));
   }
   candidates.sort((a,b)=>a.distanceToSquared(this.cameraFocus)-b.distanceToSquared(this.cameraFocus));this.lampAnchors=candidates.slice(0,3);
  }
  this.streetLights.forEach((l,i)=>{const anchor=this.lampAnchors[i];l.intensity=anchor?this.night*18:0;if(anchor)l.position.copy(anchor);});
 }
 updateEnvironment(dt:number){
  this.environmentTime=(this.environmentTime+Math.max(0,dt)*72)%86400;
  const hours=this.environmentTime/3600;this.clockLabel=String(Math.floor(hours)).padStart(2,'0')+':'+String(Math.floor(hours%1*60)).padStart(2,'0');
  const daylight=THREE.MathUtils.smoothstep(Math.sin((hours-6)/24*Math.PI*2),-.15,.35);this.night=1-daylight;
  this.sky.intensity=.48+daylight*1.25;this.sky.color.set(0x798cb4).lerp(new THREE.Color(0xcbddea),daylight);this.sky.groundColor.set(0x252a39).lerp(new THREE.Color(0x636858),daylight);
  this.sun.intensity=.18+daylight*2.35;this.sun.color.set(hours>15&&hours<20?0xffbd79:0xffebce);
  (this.scene.background as THREE.Color).set(0x17243d).lerp(new THREE.Color(0x849da8),daylight);
  this.lampMaterial.opacity=this.night*.17;this.windowMaterial.opacity=this.night*.85;
  this.renderer.toneMappingExposure=1.05+daylight*.12;
 }
 setNavigation(target:{x:number;z:number;label?:string}|null,player:{x:number;z:number;heading:number}):void{
  const key=target?`${Math.round(player.x/4)},${Math.round(player.z/4)}:${target.x},${target.z}`:'';if(key===this.navigationKey)return;this.navigationKey=key;disposeWorldVisuals(this.navigation);this.navigation.clear();if(!target)return;
  const start={x:player.x,z:player.z},end={x:target.x,z:target.z};const nx=Math.round(start.x/32)*32,nz=Math.round(start.z/32)*32,tx=Math.round(end.x/32)*32,tz=Math.round(end.z/32)*32;
  const points=Math.abs(start.x-nx)<Math.abs(start.z-nz)?[start,{x:nx,z:start.z},{x:nx,z:tz},{x:tx,z:tz},end]:[start,{x:start.x,z:nz},{x:tx,z:nz},{x:tx,z:tz},end];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)continue;const route=box(this.navigation,(a.x+b.x)/2,.24,(a.z+b.z)/2,.19,.012,length,this.routeMaterial);route.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);}
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
 addSkidMark(x:number,z:number,heading:number){
  const side=this.skidSide++%2,now=performance.now(),prior=this.skidPrevious[side];this.skidPrevious[side]={x,z,time:now};
  if(!prior||now-prior.time>250)return;
  const distance=Math.hypot(x-prior.x,z-prior.z);if(distance<.025||distance>4)return;
  const index=this.skidCursor%420,dummy=this.skidDummy;
  dummy.position.set((x+prior.x)/2,.115,(z+prior.z)/2);dummy.rotation.set(-Math.PI/2,0,Math.atan2(x-prior.x,z-prior.z));dummy.scale.set(1,distance+.03,1);dummy.updateMatrix();this.tyreMarks.setMatrixAt(index,dummy.matrix);
  this.skidCursor++;this.tyreMarks.count=Math.min(420,this.skidCursor);this.tyreMarks.instanceMatrix.needsUpdate=true;
 }
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
  this.map.clear();
  this.tyreMarks.dispose();this.tyreMarks.geometry.dispose();for(const mat of (Array.isArray(this.tyreMarks.material)?this.tyreMarks.material:[this.tyreMarks.material]))mat.dispose();
  this.tyreMarks.removeFromParent();
  this.renderer.dispose();this.renderer.domElement.remove();
  disposeWorldVisuals(this.navigation);this.navigation.clear();this.routeMaterial.dispose();this.lampMaterial.dispose();this.windowMaterial.dispose();
  disposeWorldVisuals(this.interior);this.interior.removeFromParent();
  this.markers.forEach(o=>{o.geometry.dispose();(o.material as THREE.Material).dispose();o.removeFromParent();});
 }
}

