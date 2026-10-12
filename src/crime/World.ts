import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {type CarState,type Wall} from './vehiclePhysics';

type Prop={root:THREE.Group;wall:Wall;velX:number;velZ:number;life:number};
type Chunk={group:THREE.Group;walls:Wall[];props:Prop[]};
const loader=new GLTFLoader();
const carPaths=['sedan','sedan-sports','police','taxi','suv','race'] as const;
export type CarStyle=typeof carPaths[number];
const buildingPaths=['building-a','building-b','building-c','building-d','building-skyscraper-a'] as const;
const streetPaths=['dumpster','construction-barrier','construction-fence','light-curved','traffic-light','road-sign-stop','road-sign-warning','construction-cone','electricity-pole'] as const;
const base=import.meta.env.BASE_URL+'assets/crime/';
const assets=new Map<string,Promise<THREE.Group>>();
function getModel(path:string):Promise<THREE.Group>{
 let promise=assets.get(path);if(!promise){promise=loader.loadAsync(base+path).then(r=>r.scene);assets.set(path,promise);}return promise;
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
const box=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o;};
const hash=(x:number,z:number)=>((Math.imul(x+2903,73856093)^Math.imul(z+9851,19349663))>>>0);
const rand=(seed:number)=>((Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
function fitted(root:THREE.Group,targetX:number,targetY:number,targetZ:number):THREE.Group{
 const model=root.clone(true);
 model.traverse(o=>{if(o instanceof THREE.Mesh)o.userData.sharedGeometry=true;});
 const bb=new THREE.Box3().setFromObject(model),size=bb.getSize(new THREE.Vector3());
 if(size.x>size.z*1.25)model.rotation.y=Math.PI/2;
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
 // Real Kenney model is loaded locally; retained 3D shell serves as deterministic fallback.
 void getModel('vehicles/'+style+'.glb').then(original=>{
  if(!root.parent || root.userData.disposed)return;
  const replacement=fitted(original,2.28,1.76,4.62);
  const bodyBox=new THREE.Box3().setFromObject(replacement);
  if(!Number.isFinite(bodyBox.min.x))return;
  body.visible=false; for(const child of [...root.children])if(child!==body)child.visible=false;
  replacement.name='loaded-body';replacement.userData.originalGeometry=true;
  root.add(replacement);
  // Apply impacts that happened while the GLB was still loading, not just future collisions.
  const prior=root.userData.currentDamage as {front:number;rear:number;left:number;right:number}|undefined;
  if(prior)showCarDamage(root,prior);
 }).catch(e=>console.warn('Car GLB fallback:',style,e));
 return root;
}
/** Visibly deform actual GLB mesh vertices in the direction of the collision. */
export function showCarDamage(root:THREE.Group,damage:{front:number;rear:number;left:number;right:number}){
 root.userData.currentDamage={...damage};
 const model=root.getObjectByName('loaded-body');
 if(model){
  model.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   if(!o.userData.damagePositions){
    o.geometry=o.geometry.clone();
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
 root.position.set(s.x,0,s.z);root.rotation.y=s.heading;
 const body=root.getObjectByName('body')??root.getObjectByName('loaded-body');
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
 readonly sky=new THREE.HemisphereLight(0xc7d7ef,0x394033,2.05);
 readonly sun=new THREE.DirectionalLight(0xffdcac,2.35);
 readonly maxChunks=16;
 private w=1;private h=1;private disposed=false;private lastcx=Infinity;private lastcz=Infinity;
 private cameraFocus=new THREE.Vector3();
 private buildingAssets=new Map<string,THREE.Group>();
 constructor(private mount:HTMLElement){
  this.scene.background=new THREE.Color(0x4a555b);this.scene.add(this.root,this.sky,this.sun,this.interior);
  this.interior.visible=false;
  this.sun.position.set(-45,80,18);
  this.camera.position.set(0,67,21);this.camera.lookAt(0,0,0);
  this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;
  this.renderer.setSize(this.w,this.h);this.mount.appendChild(this.renderer.domElement);
  this.resize();
  this.makeInterior();
  for(const name of buildingPaths){void getModel('buildings/'+name+'.glb').then(m=>{this.buildingAssets.set(name,m);this.map.forEach(ch=>this.attachModels(ch.group));}).catch(()=>{});}
  for(const name of streetPaths){void getModel('streets/'+name+'.glb').then(m=>{this.buildingAssets.set(name,m);this.map.forEach(ch=>this.attachModels(ch.group));}).catch(()=>{});}
 }
 resize(){this.w=Math.max(1,this.mount.clientWidth);this.h=Math.max(1,this.mount.clientHeight);
  const halfH=25,halfW=halfH*this.w/this.h;
  this.camera.left=-halfW;this.camera.right=halfW;this.camera.top=halfH;this.camera.bottom=-halfH;this.camera.updateProjectionMatrix();
  this.renderer.setSize(this.w,this.h,false);
 }
 private attachModels(group:THREE.Group){
  group.traverse(obj=>{
   const spec=(obj.userData.buildingSlot??obj.userData.streetSlot) as {w:number;h:number;d:number;name:string}|undefined;
   if(!spec||obj.userData.visualAttached)return;
   const source=this.buildingAssets.get(spec.name);
   if(!source)return;
   // fitted() already translates bottom of 3D model to y=0; don't bury it half underground.
   const clone=fitted(source,spec.w,spec.h,spec.d);
   obj.add(clone);obj.userData.visualAttached=true;
   const fallback=obj.getObjectByName('fallback');if(fallback)fallback.visible=false;
  });
 }
 private makeChunk(cx:number,cz:number):Chunk{
  const g=new THREE.Group();g.position.set(cx*96,0,cz*96);this.root.add(g);
  const walls:Wall[]=[],props:Prop[]=[];
  box(g,48,-.22,48,96,.35,96,ground);
  // Three cross-town and north-south streets per chunk, no fog-dependent horizon.
  // Each group of 36 lane markers is ONE draw call, not 36 separate tiny meshes.
  const laneN=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,.016,3),lineYellow,36);
  const laneE=new THREE.InstancedMesh(new THREE.BoxGeometry(3,.016,.16),lineYellow,36);
  const dummy=new THREE.Object3D();let n=0;
  for(let k=0;k<3;k++){
   const p=k*32;
   box(g,p,-.007,48,11.5,.06,96,asphalt);
   box(g,48,-.003,p,96,.06,11.5,asphalt);
   for(let t=0;t<96;t+=8){
    dummy.position.set(p,.033,t+3);dummy.updateMatrix();laneN.setMatrixAt(n,dummy.matrix);
    dummy.position.set(t+3,.035,p);dummy.updateMatrix();laneE.setMatrixAt(n,dummy.matrix);n++;
   }
  }
  laneN.instanceMatrix.needsUpdate=true;laneE.instanceMatrix.needsUpdate=true;
  laneN.userData.chunkGeometry=true;laneE.userData.chunkGeometry=true;g.add(laneN,laneE);
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
   const x=a*32+16,z=b*32+16,seed=hash(cx*3+a,cz*3+b);
   box(g,x,-.002,z,18,.10,18,walk);
   const h=7+Math.floor(rand(seed)*6)*2,w=9+rand(seed^13)*3,d=9+rand(seed^39)*3;
   const bx=x+(rand(seed^31)-.5)*2,bz=z+(rand(seed^99)-.5)*2;
   const wall={x:cx*96+bx,z:cz*96+bz,w,d,kind:'building'};walls.push(wall);
   const build=new THREE.Group();build.position.set(bx,0,bz);g.add(build);
   const fallback=box(build,0,h/2,0,w,h,d,buildingMats[seed%buildingMats.length]);fallback.name='fallback';
   box(build,0,h+.12,0,w+.3,.22,d+.3,mat(0x40444b));
   if(seed%4===0)box(build,0,h+.55,0,1.7,.8,1.6,mat(0x7c7972));
   const name=buildingPaths[seed%buildingPaths.length];build.userData.buildingSlot={w,h,d,name};
   if(this.buildingAssets.has(name))this.attachModels(build);
   // Safe visual detail and real physical roadside props.
   if(seed%3!==0){
    const px=a*32+7.2,pz=b*32+7.2;
    const cone=new THREE.Group();g.add(cone);cone.position.set(px,0,pz);
    const fallback=new THREE.Group();fallback.name='fallback';cone.add(fallback);
    box(fallback,0,.07,0,.8,.14,.8,mat(0x25252a));
    const orange=new THREE.Mesh(new THREE.ConeGeometry(.39,.89,8),mat(0xf27631));orange.position.y=.48;fallback.add(orange);
    cone.userData.streetSlot={name:'construction-cone',w:.8,h:.95,d:.8};
    if(this.buildingAssets.has('construction-cone'))this.attachModels(cone);
    const body:Wall={x:cx*96+px,z:cz*96+pz,w:.8,d:.8,kind:'cone',breakable:true};
    walls.push(body);const entry={root:cone,wall:body,velX:0,velZ:0,life:0};props.push(entry);this.props.push(entry);
   }
   // CC0 imported street signs, lighting, fences and smashable roadside furniture.
   if(seed%4!==3){
    const fname=seed%9===0?'dumpster':seed%9===1?'construction-barrier':seed%9===2?'traffic-light':seed%9===3?'light-curved':
      seed%9===4?'road-sign-stop':seed%9===5?'electricity-pole':seed%9===6?'road-sign-warning':seed%9===7?'construction-fence':'construction-cone';
    const tall=fname==='light-curved'||fname==='electricity-pole'||fname==='traffic-light';
    const ww=fname==='dumpster'?2.0:fname==='construction-fence'?2.5:fname==='construction-barrier'?2.0:tall?.55:.7;
    const hh=fname==='dumpster'?1.35:fname==='construction-fence'?1.8:fname==='construction-barrier'?.8:tall?6:2.15;
    const dd=fname==='dumpster'?1.45:fname==='construction-fence'?.4:fname==='construction-barrier'?.6:.65;
    const px=x+7.3,pz=z+7.1;
    const furniture=new THREE.Group();furniture.position.set(px,0,pz);furniture.rotation.y=(seed%4)*Math.PI/2;g.add(furniture);
    const fall=box(furniture,0,hh/2,0,ww,hh,dd,mat(tall?0x515961:fname==='dumpster'?0x2d5450:0xe9a24c));fall.name='fallback';
    furniture.userData.streetSlot={name:fname,w:ww,h:hh,d:dd};
    if(this.buildingAssets.has(fname))this.attachModels(furniture);
    const body:Wall={x:cx*96+px,z:cz*96+pz,w:ww,d:dd,kind:fname,breakable:!tall};
    walls.push(body);
    if(body.breakable){const entry={root:furniture,wall:body,velX:0,velZ:0,life:0};props.push(entry);this.props.push(entry);}
   }
   if(seed%4===1){
    const tree=new THREE.Group();g.add(tree);tree.position.set(x+7.3,0,z+6.8);
    box(tree,0,.9,0,.35,1.8,.35,mat(0x755e48));
    const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,0),mat(0x5b8059));canopy.position.y=2.3;tree.add(canopy);
   }
  }
  const c={group:g,walls,props};return c;
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
   c.group.traverse(o=>{if(o instanceof THREE.Mesh && !o.userData.sharedGeometry)o.geometry.dispose();});
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
 follow(x:number,z:number,speed:number,heading:number,dt:number,interior=false){
  if(interior){this.root.visible=false;this.interior.visible=true;this.cameraFocus.set(10000,0,10000);this.camera.position.set(this.cameraFocus.x,36,this.cameraFocus.z+11);this.camera.lookAt(this.cameraFocus.x,0,this.cameraFocus.z);this.camera.zoom=1.35;this.camera.updateProjectionMatrix();return;}
  if(this.interior.visible)this.cameraFocus.set(x,0,z);
  this.root.visible=true;this.interior.visible=false;
  const fwd=new THREE.Vector3(Math.sin(heading)*Math.min(speed*.18,8),0,Math.cos(heading)*Math.min(speed*.18,8));
  this.cameraFocus.lerp(new THREE.Vector3(x+fwd.x,0,z+fwd.z),Math.min(1,dt*4.6));
  this.camera.position.set(this.cameraFocus.x,67,this.cameraFocus.z+21);
  this.camera.lookAt(this.cameraFocus.x,0,this.cameraFocus.z);
  this.camera.zoom=1/(1+Math.min(speed/115,.22));this.camera.updateProjectionMatrix();
 }
 private makeInterior(){
  this.interior.position.set(10000,0,10000);
  this.interior.add(this.propertyUpgrades);
  box(this.interior,0,-.1,0,16,.2,17,mat(0x5e5750));
  box(this.interior,0,1,-8.5,16,2,1,mat(0x343942));
  box(this.interior,-8,1,0,1,2,17,mat(0x45424a));
  box(this.interior,8,1,0,1,2,17,mat(0x45424a));
  box(this.interior,-4,.55,-4,4,1.1,2.4,mat(0x465c66));
  box(this.interior,-4,1.15,-4,3.4,.2,2.1,mat(0xccd6d4));
  box(this.interior,4,.8,-5,4,1.6,1.2,mat(0x644936));
  box(this.interior,4,.85,2,2,1.7,3.1,mat(0x41484a));
  box(this.interior,-2,.1,3,6,.1,4,mat(0x966850));
  const light=new THREE.PointLight(0xffd7a2,48,22);light.position.set(0,5,0);this.interior.add(light);
 }
 /** Real room dressing changes as money is invested in the property. */
 setInteriorLevels(houseLevel:number,garageLevel:number){
  const g=this.propertyUpgrades;
  // Dynamic room furniture is rebuilt only on purchase, never every frame.
  for(const child of [...g.children]){
   g.remove(child);child.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  }
  const create=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>box(g,x,y,z,w,h,d,mat(color));
  // Functional garage workbench, laptop and money safe, then higher-end upgrades.
  if(garageLevel>=1){
   create(3,.48,5,3.8,.96,1.2,0x494646);create(3,1.06,5,3.6,.15,1.5,0x96918a);
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
   create(-5.5,.45,4,2.8,.9,1.1,0x733f35);create(-4.2,.52,4.65,1.1,1,.65,0x9e756d);
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
   const lamp=new THREE.PointLight(0x90b0ff,12,12);lamp.position.set(-4.2,2.3,-3);g.add(lamp);
  }
 }
 render(){this.renderer.render(this.scene,this.camera);}
 dispose(){this.disposed=true;this.map.forEach(c=>c.group.removeFromParent());this.map.clear();this.renderer.dispose();this.renderer.domElement.remove();this.interior.removeFromParent();this.markers.forEach(o=>o.removeFromParent());}
}
