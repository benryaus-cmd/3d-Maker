import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {CITY_ROAD_ORIENTATION,CITY_ROAD_SOURCE_OPENINGS} from '../src/crime/CityModels.ts';
import {attachVehicleLights,updateVehicleLights,disposeVehicleLights,VehicleLightRig} from '../src/crime/VehicleLights.ts';

// Read source triangles rather than trusting filenames or a graph implementation.
const sources={straight:['road-straight','8707b6f3bf7c6f5fda3bb01f164a9ef0b09f6eb2'],crossing:['road-crossing','240ac05f10d5912cb5a8fb9fbc4dcb58ce82b82e'],bend:['road-bend','241878bb63fec4d0dbf6f338bbf0cc3eb89dbc9d'],tee:['road-intersection','b48e5e355f93f070426468353f8fd75abeffdab3'],cross:['road-crossroad-path','cc470c95dc635ce879638889e2c60b8493bf1bed']};
for(const [kind,[name,sha]] of Object.entries(sources)){
 const bytes=fs.readFileSync(new URL(`../src/crime/bundled/roads/${name}.glb`,import.meta.url));
 assert.equal(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),sha,`${name}: original Kenney bytes`);
 const jsonSize=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonSize)),bin=bytes.subarray(28+jsonSize);
 for(const node of json.nodes)assert.ok(!node.matrix&&!node.rotation&&!node.translation&&!node.scale,'source vertices are already in scene coordinates');
 const accessor=(index)=>{
  const ac=json.accessors[index],view=json.bufferViews[ac.bufferView],size={VEC3:3,VEC2:2,SCALAR:1}[ac.type],component={5121:1,5123:2,5126:4}[ac.componentType];
  return Array.from({length:ac.count},(_,i)=>Array.from({length:size},(_,c)=>{
   const offset=(view.byteOffset??0)+(ac.byteOffset??0)+i*(view.byteStride??size*component)+c*component;
   return ac.componentType===5126?bin.readFloatLE(offset):ac.componentType===5123?bin.readUInt16LE(offset):bin.readUInt8(offset);
  }));
 };
 const primitive=json.meshes[0].primitives[0],positions=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices).flat();
 // Kenney's asphalt is at y=.01, raised sidewalk at y=.02. Missing surface is closed too.
 const top=(x,z)=>{
  let result=-Infinity;
  for(let i=0;i<indices.length;i+=3){
   const [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]=indices.slice(i,i+3).map(index=>positions[index]);
   const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(denominator)<1e-8)continue;
   const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator,w=1-u-v;
   if(Math.min(u,v,w)>=-1e-5)result=Math.max(result,u*ay+v*by+w*cy);
  }return result;
 };
 let measured=0;
 const edges=[t=>[t,.49],t=>[.49,t],t=>[t,-.49],t=>[-.49,t]];
 edges.forEach((point,i)=>{if([-.15,0,.15].every(t=>{const h=top(...point(t));return h>.005&&h<.015;}))measured|=1<<i;});
 assert.equal(measured,CITY_ROAD_SOURCE_OPENINGS[kind].sourceMask,`${name}: source asphalt openings`);
 const quarterTurns=Math.round(CITY_ROAD_ORIENTATION[kind]/(Math.PI/2));
 const rotated=((measured<<quarterTurns)|(measured>>(4-quarterTurns)))&15;
 assert.equal(rotated,CITY_ROAD_SOURCE_OPENINGS[kind].canonicalMask,`${name}: graph canonical openings`);
 console.log(`${kind}: source ${measured}, canonical ${rotated}, correction ${quarterTurns} quarter turns`);
}
const root=new THREE.Group();attachVehicleLights(root);attachVehicleLights(root);
assert.equal(root.children.length,1,'attachment is idempotent');
const group=root.children[0],beam=group.getObjectByName('headlight-footprint');
const positions=beam.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){assert.ok(positions.getZ(i)>2,'beam projects ahead of +Z front');assert.equal(Math.round(positions.getY(i)*1000),45,'footprint is grounded');}
assert.ok(beam.material.transparent&&beam.material.depthTest&&!beam.material.depthWrite,'gradient never forms an opaque road overlay');
updateVehicleLights(root,1,false);assert.ok(beam.visible&&beam.material.opacity>0);
const tail=group.getObjectByName('taillamp'),running=tail.material.emissiveIntensity;updateVehicleLights(root,1,true);assert.ok(tail.material.emissiveIntensity>running,'braking intensifies tail lights');
root.rotation.y=Math.PI/2;root.updateMatrixWorld(true);assert.ok(beam.localToWorld(new THREE.Vector3(0,.045,10)).x>9,'heading rotates forward footprint');
const scene=new THREE.Scene();scene.add(root);const rig=new VehicleLightRig(scene);rig.update(root,1);
assert.equal(scene.children.filter(o=>o instanceof THREE.SpotLight).length,2,'real lights are bounded');assert.ok(rig.lights.every(light=>light.target.position.x>light.position.x),'real headlights follow rotated heading');
rig.update(null,1);assert.ok(rig.lights.every(light=>!light.visible),'on-foot player releases real illumination');rig.dispose();rig.dispose();assert.equal(scene.children.length,1,'rig removes light targets and lights');
const geometryCounts=new Map(),materialCounts=new Map();let textureDisposals=0;
group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;if(!geometryCounts.has(o.geometry)){geometryCounts.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>geometryCounts.set(o.geometry,geometryCounts.get(o.geometry)+1));}if(!materialCounts.has(o.material)){materialCounts.set(o.material,0);o.material.addEventListener('dispose',()=>materialCounts.set(o.material,materialCounts.get(o.material)+1));}});
beam.material.map.addEventListener('dispose',()=>textureDisposals++);
disposeVehicleLights(root);disposeVehicleLights(root);assert.equal(root.children.length,0);assert.ok([...geometryCounts.values(),...materialCounts.values(),textureDisposals].every(count=>count===1),'owned GPU resources disposed exactly once');
console.log('Original GLB openings, canonical rotations, grounded beams, brake response and bounded light cleanup passed.');
