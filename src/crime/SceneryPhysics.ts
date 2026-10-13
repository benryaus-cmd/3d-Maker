import {registerTuningObject} from './LiveTuning.ts';
import * as THREE from 'three';

export type SceneryKind='cone'|'sign'|'bench'|'fence'|'dumpster'|'lamp'|'tree'|'pole'|'hedge';
export const SCENERY_RESPONSE:Record<SceneryKind,{mass:number;hitThreshold:number}>={
 cone:{mass:4,hitThreshold:3},sign:{mass:24,hitThreshold:5},bench:{mass:65,hitThreshold:6},
 fence:{mass:90,hitThreshold:8},dumpster:{mass:190,hitThreshold:10},lamp:{mass:110,hitThreshold:12},
 tree:{mass:380,hitThreshold:14},pole:{mass:280,hitThreshold:16},hedge:{mass:45,hitThreshold:5},
};
for(const [kind,response]of Object.entries(SCENERY_RESPONSE))registerTuningObject('Destructible '+kind,'scenery.'+kind,response);
export function sceneryKind(path:string):SceneryKind{
 path=path.split('/').pop()??path;
 if(/^(tree|palm)/.test(path))return 'tree';if(/light/.test(path))return 'lamp';if(/pole/.test(path))return 'pole';
 if(/cone/.test(path))return 'cone';if(/sign/.test(path))return 'sign';if(/bench/.test(path))return 'bench';
 if(/dumpster/.test(path))return 'dumpster';if(/hedge|bush/.test(path))return 'hedge';return 'fence';
}
/** Measure the low solid vertices in fitted model coordinates. Canopies, roof eaves,
 * sign panels and lamp arms do not become an invisible ground-level obstacle. */
export function solidFootprint(model:THREE.Object3D,kind:SceneryKind|'building'):THREE.Box3{
 model.updateMatrixWorld(true);const full=new THREE.Box3().setFromObject(model),height=full.max.y-full.min.y;
 const slender=['tree','lamp','pole','sign'].includes(kind),cut=full.min.y+(slender?height*.26:kind==='building'?Math.min(1.6,height*.7):height);
 const solid=new THREE.Box3(),v=new THREE.Vector3();
 model.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const positions=o.geometry.getAttribute('position');if(!positions)return;
  for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);if(v.y<=cut+.0001)solid.expandByPoint(v);}
 });
 if(solid.isEmpty())return full;return solid;
}
export type FallingScenery={root:THREE.Group;bounds:THREE.Box3;velX:number;velY:number;velZ:number;angle:number;angularSpeed:number;axis:THREE.Vector3;baseRotation:THREE.Quaternion;age:number;settled:boolean;ground:number};
const corners=Array.from({length:8},()=>new THREE.Vector3());
/** Active objects only: gravity, angular torque, contact bounce and friction. At
 * rest the object stays visible and incurs no frame work until its chunk unloads. */
export function stepFallingScenery(p:FallingScenery,elapsed:number):void{
 if(p.settled)return;const dt=Math.min(.04,Math.max(0,elapsed));p.age+=dt;
 p.velY-=9.81*dt;p.root.position.x+=p.velX*dt;p.root.position.z+=p.velZ*dt;p.root.position.y+=p.velY*dt;
 p.angularSpeed+=(7*Math.max(.18,Math.sin(p.angle)) -p.angularSpeed*1.8)*dt;p.angle=Math.min(Math.PI/2,p.angle+p.angularSpeed*dt);
 p.root.quaternion.setFromAxisAngle(p.axis,p.angle).multiply(p.baseRotation);p.root.updateMatrix();let low=Infinity;
 for(let i=0;i<8;i++){const v=corners[i].set(i&1?p.bounds.max.x:p.bounds.min.x,i&2?p.bounds.max.y:p.bounds.min.y,i&4?p.bounds.max.z:p.bounds.min.z).applyMatrix4(p.root.matrix);low=Math.min(low,v.y);}
 if(low<p.ground){p.root.position.y+=p.ground-low;if(p.velY<0)p.velY=-p.velY*.14;p.velX*=Math.exp(-dt*6);p.velZ*=Math.exp(-dt*6);}
 const drag=Math.exp(-dt*1.2);p.velX*=drag;p.velZ*=drag;
 if(p.age>1.5&&p.angle>=Math.PI/2-.001&&Math.hypot(p.velX,p.velZ)<.12&&Math.abs(p.velY)<.12){p.settled=true;p.velX=p.velY=p.velZ=0;}
}
