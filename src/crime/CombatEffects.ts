import * as THREE from 'three';
import type {VisualWeapon} from './WeaponVisuals';
export interface EffectPoint {x:number;z:number;y?:number}
export type ImpactKind='actor'|'wall'|'car';
interface Particle {object:THREE.Sprite|THREE.Mesh;material:THREE.SpriteMaterial|THREE.MeshBasicMaterial;age:number;life:number;size:number;velocity:THREE.Vector3;kind:'flash'|'impact'|'trace'}
const point=(p:EffectPoint)=>new THREE.Vector3(p.x,p.y??1.2,p.z);
const finite=(p:EffectPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&(p.y===undefined||Number.isFinite(p.y));
/** Fixed GPU pool; automatic-fire and shotgun effects cannot grow scene resources. */
export class CombatEffects {
 readonly root=new THREE.Group();
 readonly capacity=96;
 private texture:THREE.DataTexture;
 private geometry=new THREE.BoxGeometry(1,1,1);
 private particles:Particle[]=[];
 private cursor=0;
 private disposed=false;
 cameraImpulse=0;
 constructor(scene:THREE.Scene){
  this.root.name='CombatEffects';scene.add(this.root);
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x+ .5-size/2)/(size/2),(y+.5-size/2)/(size/2)),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.max(0,1-r)**2*255);}
  this.texture=new THREE.DataTexture(data,size,size);this.texture.needsUpdate=true;
  for(let i=0;i<this.capacity;i++){
   const trace=i<32;
   const material=trace?new THREE.MeshBasicMaterial({color:0xffd57c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}):new THREE.SpriteMaterial({map:this.texture,color:0xffbb56,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
   const object=trace?new THREE.Mesh(this.geometry,material):new THREE.Sprite(material as THREE.SpriteMaterial);object.visible=false;object.frustumCulled=false;this.root.add(object);
   this.particles.push({object,material,age:0,life:0,size:1,velocity:new THREE.Vector3(),kind:trace?'trace':'impact'});
  }
 }
 private allocate(trace=false):Particle|null{if(this.disposed)return null;const start=trace?0:32,count=trace?32:64;const particle=this.particles[start+(this.cursor++%count)];particle.age=0;particle.object.visible=true;particle.velocity.set(0,0,0);return particle;}
 shot(weapon:VisualWeapon,start:EffectPoint,end:EffectPoint,hit:ImpactKind|null=null,emitMuzzle=true):number{
  if(this.disposed||!finite(start)||!finite(end))return 0;
  const from=point(start),to=point(end),flash=emitMuzzle?this.allocate():null;
  if(flash){flash.kind='flash';flash.life=.065;flash.size=weapon==='shotgun'?.65:weapon==='smg'?.28:.36;flash.object.position.copy(from);flash.object.scale.setScalar(flash.size);flash.material.color.setHex(0xffd477);flash.material.opacity=.95;}
  const trace=this.allocate(true),length=from.distanceTo(to);
  if(trace){trace.kind='trace';trace.life=.075;trace.object.position.copy(from).lerp(to,.5);trace.object.scale.set(.018,.018,Math.max(.001,length));trace.object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),to.sub(from).normalize());trace.material.opacity=.65;}
  if(hit)this.impact(end,hit);
  const strength=emitMuzzle?(weapon==='shotgun'?.11:weapon==='smg'?.026:.045):0;this.cameraImpulse=Math.min(.16,this.cameraImpulse+strength);return strength;
 }
 impact(position:EffectPoint,kind:ImpactKind='wall'):void{
  if(!finite(position))return;const centre=point(position);
  for(let i=0;i<(kind==='actor'?4:6);i++){
   const p=this.allocate();if(!p)break;p.kind='impact';p.life=kind==='actor'?.25:.34;p.size=kind==='actor'?.17:.11;p.object.position.copy(centre);p.object.scale.setScalar(p.size);p.material.color.setHex(kind==='actor'?0xff976c:kind==='car'?0xaad8ff:0xffcf7c);p.material.opacity=.9;
   const angle=i*2.399963;p.velocity.set(Math.cos(angle)*(.6+i*.16),.4+(i%3)*.35,Math.sin(angle)*(.6+i*.16));
  }
 }
 update(dt:number):void{
  if(this.disposed)return;const step=Number.isFinite(dt)?Math.min(.25,Math.max(0,dt)):0;this.cameraImpulse*=Math.exp(-step*24);
  for(const p of this.particles){if(!p.object.visible)continue;p.age+=step;if(p.age>=p.life){p.object.visible=false;continue;}const remaining=1-p.age/p.life;p.material.opacity=remaining*(p.kind==='trace'?.65:.95);
   if(p.kind==='impact'){p.object.position.addScaledVector(p.velocity,step);p.velocity.y-=step*3;p.object.scale.setScalar(p.size*(.6+remaining*.4));}
   else if(p.kind==='flash')p.object.scale.setScalar(p.size*(.4+remaining));
  }
 }
 get activeCount():number{return this.particles.filter(p=>p.object.visible).length;}
 clear():void{this.particles.forEach(p=>p.object.visible=false);this.cameraImpulse=0;}
 dispose():void{if(this.disposed)return;this.disposed=true;this.clear();this.root.removeFromParent();this.root.clear();this.particles.forEach(p=>p.material.dispose());this.geometry.dispose();this.texture.dispose();}
}
