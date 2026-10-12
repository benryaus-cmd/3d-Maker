import * as THREE from 'three';
export const SKID_CAPACITY=2560;
export const skidOpacity=(age:number)=>Math.max(0,Math.min(1,1-(age-10)/10));
/** Fixed-step maximum is120segments/s;2560 retains the entire20s lifetime. */
export class TimedSkids{
 readonly mesh:THREE.InstancedMesh;time=0;liveCount=0;
 private cursor=0;private written=0;private side=0;
 private previous:Array<{x:number;z:number;time:number}|null>=[null,null];
 private births=new Float32Array(SKID_CAPACITY).fill(-100);
 private active=new Uint8Array(SKID_CAPACITY);
 private clock={value:0};private dummy=new THREE.Object3D();private disposed=false;
 constructor(scene:THREE.Scene,private height:(x:number,z:number)=>number){
  const geometry=new THREE.PlaneGeometry(.20,1);geometry.setAttribute('skidBorn',new THREE.InstancedBufferAttribute(this.births,1));
  const material=new THREE.MeshBasicMaterial({color:0x11171d,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
   shader.uniforms.uSkidTime=this.clock;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float skidBorn; varying float vSkidBorn; varying vec2 vSkidUV;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSkidBorn=skidBorn; vSkidUV=uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSkidTime; varying float vSkidBorn; varying vec2 vSkidUV;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat skidFade=clamp(1.0-(uSkidTime-vSkidBorn-10.0)/10.0,0.0,1.0);\nfloat skidEdge=smoothstep(0.0,.12,vSkidUV.x)*(1.0-smoothstep(.88,1.0,vSkidUV.x));\ndiffuseColor.a*=skidFade*skidEdge; if(diffuseColor.a<.002) discard;');
  };
  material.customProgramCacheKey=()=> 'blacktop-timed-skids-v1';
  this.mesh=new THREE.InstancedMesh(geometry,material,SKID_CAPACITY);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=2;this.mesh.name='timed-skid-pool';scene.add(this.mesh);
 }
 add(x:number,z:number,_heading:number){
  const side=this.side;this.side=1-side;const prior=this.previous[side];this.previous[side]={x,z,time:this.time};
  if(!prior||this.time-prior.time>.15)return;
  const distance=Math.hypot(x-prior.x,z-prior.z);if(distance<.02||distance>3)return;
  const i=this.cursor++%SKID_CAPACITY;if(!this.active[i])this.liveCount++;this.active[i]=1;this.births[i]=this.time;
  const cx=(x+prior.x)/2,cz=(z+prior.z)/2;
  this.dummy.position.set(cx,this.height(cx,cz)+.012,cz);this.dummy.rotation.set(-Math.PI/2,0,Math.atan2(x-prior.x,z-prior.z));this.dummy.scale.set(1,distance+.04,1);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
  this.written=Math.max(this.written,i+1);this.mesh.count=this.written;this.mesh.instanceMatrix.needsUpdate=true;(this.mesh.geometry.getAttribute('skidBorn') as THREE.InstancedBufferAttribute).needsUpdate=true;
 }
 tick(dt:number){
  if(this.disposed)return;this.time+=Math.max(0,dt);this.clock.value=this.time;
  let changed=false;
  for(let i=0;i<this.written;i++)if(this.active[i]&&this.time-this.births[i]>=20-1e-4){
   this.active[i]=0;this.liveCount--;this.dummy.position.set(0,-100,0);this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);changed=true;
  }
  if(changed)this.mesh.instanceMatrix.needsUpdate=true;if(this.liveCount===0)this.mesh.count=0;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}
