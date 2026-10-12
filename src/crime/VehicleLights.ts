import * as THREE from 'three';

const GROUP_NAME = 'custom-vehicle-lights';
type LightVisual = {group:THREE.Group; beams:THREE.MeshBasicMaterial; heads:THREE.MeshStandardMaterial; tails:THREE.MeshStandardMaterial; texture:THREE.DataTexture};
const visuals = new WeakMap<THREE.Group,LightVisual>();
const nightAmount=(value:number)=>Number.isFinite(value)?THREE.MathUtils.clamp(value,0,1):0;

/** Cheap ground-projected gradients follow every vehicle; only the player rig uses real lights. */
export function attachVehicleLights(root:THREE.Group):void {
 if(visuals.has(root))return;
 const group=new THREE.Group();group.name=GROUP_NAME;root.add(group);
 const width=64,height=128,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width*2-1,v=(y+.5)/height;
  const a=Math.pow(Math.max(0,1-u*u),2)*Math.pow(1-v,1.6)*Math.min(1,v*14);
  const i=(y*width+x)*4;data[i]=255;data[i+1]=241;data[i+2]=208;data[i+3]=Math.round(a*255);
 }
 const texture=new THREE.DataTexture(data,width,height);texture.needsUpdate=true;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
 const beams=new THREE.MeshBasicMaterial({map:texture,color:0xfff2d3,transparent:true,opacity:0,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const heads=new THREE.MeshStandardMaterial({color:0xffefc9,emissive:0xffe2ad,emissiveIntensity:.18,roughness:.3,toneMapped:false});
 const tails=new THREE.MeshStandardMaterial({color:0xaa1820,emissive:0xff172b,emissiveIntensity:.15,roughness:.35,toneMapped:false});
 const lampGeometry=new THREE.BoxGeometry(.38,.16,.075);
 const beamGeometry=new THREE.BufferGeometry();
 beamGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.24,.045,2.28,.24,.045,2.28,-2.8,.045,16,2.8,.045,16],3));
 beamGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));beamGeometry.setIndex([0,2,1,1,2,3]);beamGeometry.computeVertexNormals();
 for(const x of [-.73,.73]){
  const head=new THREE.Mesh(lampGeometry,heads);head.name='headlamp';head.position.set(x,.7,2.25);group.add(head);
  const tail=new THREE.Mesh(lampGeometry,tails);tail.name='taillamp';tail.position.set(x,.72,-2.25);group.add(tail);
  const beam=new THREE.Mesh(beamGeometry,beams);beam.name='headlight-footprint';beam.position.x=x;beam.renderOrder=2;group.add(beam);
 }
 group.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.ownMaterial=true;o.userData.vehicleLight=true;}});
 visuals.set(root,{group,beams,heads,tails,texture});updateVehicleLights(root,0,false);
}

export function updateVehicleLights(root:THREE.Group,night:number,braking:boolean):void {
 const visual=visuals.get(root);if(!visual)return;
 const level=nightAmount(night);
 visual.beams.opacity=level*.34;visual.heads.emissiveIntensity=.18+level*2.2;
 visual.tails.emissiveIntensity=braking?3.8:.15+level*1.15;
 for(const child of visual.group.children)if(child.name==='headlight-footprint')child.visible=level>.02;
}

/** Call before the general car disposer. Removing the group prevents double-disposal. */
export function disposeVehicleLights(root:THREE.Group):void {
 const visual=visuals.get(root);if(!visual)return;
 visual.group.removeFromParent();
 const geometries=new Set<THREE.BufferGeometry>();visual.group.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});
 for(const geometry of geometries)geometry.dispose();
 visual.beams.dispose();visual.heads.dispose();visual.tails.dispose();visual.texture.dispose();visual.group.clear();visuals.delete(root);
}

/** Exactly two non-shadow-casting spotlights, reused when the controlled car changes. */
export class VehicleLightRig {
 readonly lights:readonly THREE.SpotLight[];
 private readonly targets:THREE.Object3D[]=[];
 private readonly position=new THREE.Vector3();
 private disposed=false;
 constructor(scene:THREE.Scene){
  this.lights=[-1,1].map(()=>{
   const light=new THREE.SpotLight(0xffefd4,0,30,.35,.72,1.5);light.castShadow=false;
   const target=new THREE.Object3D();light.target=target;this.targets.push(target);scene.add(light,target);return light;
  });
 }
 update(root:THREE.Group|null,night:number):void {
  if(this.disposed)return;
  const level=root?nightAmount(night):0;
  root?.updateWorldMatrix(true,false);
  this.lights.forEach((light,i)=>{
   light.intensity=level*48;light.visible=level>.02;
   if(!root)return;
   root.localToWorld(this.position.set(i===0?-.73:.73,.72,2.25));light.position.copy(this.position);
   root.localToWorld(this.position.set(i===0?-.73:.73,.05,18));this.targets[i].position.copy(this.position);this.targets[i].updateMatrixWorld();
  });
 }
 dispose():void {
  if(this.disposed)return;this.disposed=true;
  for(const light of this.lights){light.removeFromParent();light.dispose();}
  for(const target of this.targets)target.removeFromParent();
 }
}
