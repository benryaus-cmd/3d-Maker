import {LIVE} from './LiveTuning.ts';
import * as THREE from 'three';

const GROUP_NAME='custom-vehicle-lights';
type LightVisual={group:THREE.Group;lamps:THREE.Group;beams:THREE.MeshBasicMaterial;heads:THREE.MeshStandardMaterial;tails:THREE.MeshStandardMaterial;texture:THREE.DataTexture;body?:THREE.Object3D;damageRevision?:number;anchors:THREE.Vector3[]};
const visuals=new WeakMap<THREE.Group,LightVisual>();
const nightAmount=(value:number)=>Number.isFinite(value)?THREE.MathUtils.clamp(value,0,1):0;

/** Kenney's single colormap primitive includes the lamps. Copy their actual triangles,
 * selected by the original yellow/white and red palette swatches and outward end faces. */
function lampFaces(body:THREE.Object3D,front:boolean,side:number):THREE.BufferGeometry|null {
 const vertices:number[]=[];body.updateWorldMatrix(true,true);
 const inverse=body.matrixWorld.clone().invert(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
 body.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh)||!/^body$/i.test(obj.name))return;
  const p=obj.geometry.getAttribute('position'),uv=obj.geometry.getAttribute('uv'),index=obj.geometry.index;if(!uv)return;
  const matrix=new THREE.Matrix4().multiplyMatrices(inverse,obj.matrixWorld);
  for(let i=0;i<(index?.count??p.count);i+=3){
   const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
   a.fromBufferAttribute(p,ids[0]).applyMatrix4(matrix);b.fromBufferAttribute(p,ids[1]).applyMatrix4(matrix);c.fromBufferAttribute(p,ids[2]).applyMatrix4(matrix);
   const x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;
   if(x*side<=0||z*(front?1:-1)<=0)continue;
   normal.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();if(normal.z*(front?1:-1)<.3)continue;
   const palette=ids.every(id=>{
    const u=uv.getX(id),v=uv.getY(id);
    return front?v>.77&&[.03125,.09375,.15625,.21875].some(swatch=>Math.abs(u-swatch)<.002):v>.77&&[.28125,.34375].some(swatch=>Math.abs(u-swatch)<.002);
   });
   if(palette)vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
  }
 });
 if(!vertices.length)return null;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}
function refreshBody(root:THREE.Group,visual:LightVisual):void {
 const body=root.getObjectByName('loaded-body')??root.getObjectByName('body'),revision=Number(root.userData.damageRevision??0);if(!body||(body===visual.body&&revision===visual.damageRevision))return;
 visual.lamps.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});visual.lamps.clear();visual.body=body;visual.damageRevision=revision;visual.anchors=[];
 for(const front of [true,false])for(const side of [-1,1]){
  let geometry=lampFaces(body,front,side);
  // The deterministic shell has separate lamps; reuse its geometry and transform.
  if(!geometry){
   body.updateWorldMatrix(true,true);const bounds=new THREE.Box3();
   body.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrix));}});
   const size=bounds.getSize(new THREE.Vector3());
   if(bounds.isEmpty())continue;
   const origin=new THREE.Vector3(bounds.getCenter(new THREE.Vector3()).x+side*size.x*.3,bounds.min.y+size.y*.38,front?bounds.max.z+1:bounds.min.z-1);
   const ray=new THREE.Raycaster();ray.set(body.localToWorld(origin),new THREE.Vector3(0,0,front?-1:1).transformDirection(body.matrixWorld));
   const hit=ray.intersectObject(body,true).find(h=>h.object instanceof THREE.Mesh);if(!hit)continue;
   const point=body.worldToLocal(hit.point);geometry=new THREE.PlaneGeometry(size.x*.13,size.y*.09);
   const positions=geometry.getAttribute('position') as THREE.BufferAttribute;
   for(let i=0;i<positions.count;i++){
    const sample=new THREE.Vector3(point.x+positions.getX(i),point.y+positions.getY(i),front?bounds.max.z+1:bounds.min.z-1);
    ray.set(body.localToWorld(sample),new THREE.Vector3(0,0,front?-1:1).transformDirection(body.matrixWorld));
    const surface=ray.intersectObject(body,true)[0],fitted=surface?body.worldToLocal(surface.point):point;
    positions.setXYZ(i,fitted.x,fitted.y,fitted.z);
   }
   geometry.computeVertexNormals();
  }
  const mesh=new THREE.Mesh(geometry,front?visual.heads:visual.tails);mesh.name=front?'headlamp':'taillamp';mesh.userData.ownMaterial=true;mesh.userData.vehicleLight=true;visual.lamps.add(mesh);
  if(front){geometry.computeBoundingBox();visual.anchors.push(geometry.boundingBox!.getCenter(new THREE.Vector3()));}
 }
}

/** Cheap grounded gradients for traffic; only the player uses real spotlights. */
export function attachVehicleLights(root:THREE.Group):void {
 if(visuals.has(root))return;
 const group=new THREE.Group();group.name=GROUP_NAME;root.add(group);const lamps=new THREE.Group();group.add(lamps);lamps.matrixAutoUpdate=false;
 const width=64,height=128,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width*2-1,v=(y+.5)/height,a=Math.pow(Math.max(0,1-u*u),2)*Math.pow(1-v,1.6)*Math.min(1,v*14),i=(y*width+x)*4;
  data[i]=255;data[i+1]=241;data[i+2]=208;data[i+3]=Math.round(a*255);
 }
 const texture=new THREE.DataTexture(data,width,height);texture.needsUpdate=true;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
 const beams=new THREE.MeshBasicMaterial({map:texture,color:0xfff2d3,transparent:true,opacity:0,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const options={roughness:.3,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide};
 const heads=new THREE.MeshStandardMaterial({...options,color:0xffefc9,emissive:0xffe2ad,emissiveIntensity:0});
 const tails=new THREE.MeshStandardMaterial({...options,color:0xaa1820,emissive:0xff172b,emissiveIntensity:0});
 for(let i=0;i<2;i++){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(12,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geometry.setIndex([0,2,1,1,2,3]);
  const beam=new THREE.Mesh(geometry,beams);beam.name='headlight-footprint';beam.renderOrder=2;beam.frustumCulled=false;group.add(beam);
 }
 const visual={group,lamps,beams,heads,tails,texture,anchors:[]};visuals.set(root,visual);updateVehicleLights(root,0,false);
}
export function updateVehicleLights(root:THREE.Group,night:number,braking:boolean):void {
 const visual=visuals.get(root);if(!visual)return;refreshBody(root,visual);
 const level=nightAmount(night),on=level>.02;
 visual.beams.opacity=on?level*LIVE.headlightBeam:0;visual.heads.emissiveIntensity=on?level*LIVE.headlightGlow:0;visual.tails.emissiveIntensity=braking?LIVE.brakeGlow:(on?level*LIVE.tailGlow:0);
 if(!visual.body)return;
 root.updateWorldMatrix(true,true);const relative=new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(),visual.body.matrixWorld);visual.lamps.matrix.copy(relative);
 let i=0;for(const child of visual.group.children){
  if(!(child instanceof THREE.Mesh))continue;const anchor=visual.anchors[i++];child.visible=on&&!!anchor;if(!anchor)continue;
  const start=anchor.clone().applyMatrix4(relative),p=child.geometry.getAttribute('position') as THREE.BufferAttribute;
  // Project vertically onto the road rather than applying the body's roll/pitch.
  const y=.045-root.position.y;
  [[start.x-.2,y,start.z],[start.x+.2,y,start.z],[start.x-2.6,y,start.z+13.5],[start.x+2.6,y,start.z+13.5]].forEach((v,k)=>p.setXYZ(k,...v as [number,number,number]));p.needsUpdate=true;
 }
}
export function disposeVehicleLights(root:THREE.Group):void {
 const visual=visuals.get(root);if(!visual)return;visual.group.removeFromParent();
 visual.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
 visual.beams.dispose();visual.heads.dispose();visual.tails.dispose();visual.texture.dispose();visual.group.clear();visuals.delete(root);
}
/** Exactly two reusable, non-shadow-casting real headlights. */
export class VehicleLightRig {
 readonly lights:readonly THREE.SpotLight[];private readonly targets:THREE.Object3D[]=[];private disposed=false;
 constructor(scene:THREE.Scene){this.lights=[-1,1].map(()=>{const light=new THREE.SpotLight(0xffefd4,0,30,.35,.72,1.5);light.castShadow=false;const target=new THREE.Object3D();light.target=target;this.targets.push(target);scene.add(light,target);return light;});}
 update(root:THREE.Group|null,night:number):void {
  if(this.disposed)return;const visual=root?visuals.get(root):undefined;if(root&&visual)refreshBody(root,visual);
  const level=root?nightAmount(night):0;root?.updateWorldMatrix(true,true);
  this.lights.forEach((light,i)=>{
   const anchor=visual?.anchors[i];light.visible=level>.02&&!!anchor;light.intensity=light.visible?level*LIVE.headlightPower:0;
   if(!root||!visual?.body||!anchor)return;
   light.position.copy(visual.body.localToWorld(anchor.clone()));
   const ahead=new THREE.Vector3(0,0,1).transformDirection(root.matrixWorld);
   this.targets[i].position.copy(light.position).addScaledVector(ahead,16);this.targets[i].position.y=.05;this.targets[i].updateMatrixWorld();
  });
 }
 dispose():void {if(this.disposed)return;this.disposed=true;for(const light of this.lights){light.removeFromParent();light.dispose();}for(const target of this.targets)target.removeFromParent();}
}
