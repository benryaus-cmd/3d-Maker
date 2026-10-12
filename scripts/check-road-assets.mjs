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
// Build all six actual GLB mesh hierarchies (without browser image decoding).
function sourceCar(name){
 const bytes=fs.readFileSync(new URL(`../src/crime/bundled/vehicles/${name}.glb`,import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 const read=(id)=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],size=a.componentType===5126?4:2;return {n,values:Array.from({length:a.count*n},(_,i)=>{const at=(v.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/n)*(v.byteStride??n*size)+(i%n)*size;return a.componentType===5126?bin.readFloatLE(at):bin.readUInt16LE(at);})};};
 const nodes=json.nodes.map(n=>{const p=json.meshes[n.mesh].primitives[0],g=new THREE.BufferGeometry();for(const [key,attr] of [['POSITION','position'],['TEXCOORD_0','uv']]){const a=read(p.attributes[key]);g.setAttribute(attr,new THREE.Float32BufferAttribute(a.values,a.n));}g.setIndex(read(p.indices).values);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial());m.name=n.name;m.position.fromArray(n.translation??[0,0,0]);return m;});
 json.nodes.forEach((n,i)=>n.children?.forEach(child=>nodes[i].add(nodes[child])));
 const body=new THREE.Group();body.name='loaded-body';json.scenes[json.scene??0].nodes.forEach(i=>body.add(nodes[i]));body.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(body),size=b.getSize(new THREE.Vector3());body.scale.set(2.2/size.x,Math.min(2.2/size.x,1.65/size.y,4.5/size.z),4.5/size.z);body.updateMatrixWorld(true);const fitted=new THREE.Box3().setFromObject(body),mid=fitted.getCenter(new THREE.Vector3());body.position.set(-mid.x,-fitted.min.y,-mid.z);
 const root=new THREE.Group();root.add(body);return {root,body};
}
for(const name of ['sedan','sedan-sports','taxi','police','race','suv']){
 const {root,body}=sourceCar(name);attachVehicleLights(root);attachVehicleLights(root);assert.equal(root.children.filter(c=>c.name==='custom-vehicle-lights').length,1);
 updateVehicleLights(root,1,false);root.updateMatrixWorld(true);const group=root.getObjectByName('custom-vehicle-lights'),heads=[],tails=[],beams=[];group.traverse(o=>{if(o.name==='headlamp')heads.push(o);if(o.name==='taillamp')tails.push(o);if(o.name==='headlight-footprint')beams.push(o);});
 assert.equal(heads.length,2,`${name}: two geometry-derived headlamps`);assert.equal(tails.length,2,`${name}: two geometry-derived tails`);
 const bounds=new THREE.Box3().setFromObject(body);
 for(const lamp of [...heads,...tails]){const p=lamp.geometry.getAttribute('position');if(name!=='race')assert.ok(p.count>=6,`${name}: ${lamp.name} ${p.count} vertices use source triangles instead of generic planes`);for(let i=0;i<p.count;i++){const v=lamp.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i));assert.ok(bounds.clone().expandByScalar(1e-6).containsPoint(v),`${name}: lamp lies inside real hull`);}}
 const running=tails[0].material.emissiveIntensity;updateVehicleLights(root,1,true);assert.ok(tails[0].material.emissiveIntensity>running,'braking brightens');updateVehicleLights(root,0,true);assert.equal(heads[0].material.emissiveIntensity,0);assert.ok(beams.every(b=>!b.visible));assert.ok(tails[0].material.emissiveIntensity>running,'daytime brakes brighten');
 root.rotation.y=Math.PI/2;body.rotation.z=.1;body.rotation.x=.05;root.position.set(3,.13,-2);updateVehicleLights(root,1,false);root.updateMatrixWorld(true);
 for(const beam of beams){assert.ok(beam.visible&&beam.material.transparent&&beam.material.depthTest&&!beam.material.depthWrite);const p=beam.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Math.abs(beam.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)).y-.045)<1e-6,'grounded regardless of pitch/roll');}
 const scene=new THREE.Scene();scene.add(root);const rig=new VehicleLightRig(scene);rig.update(root,1);assert.equal(rig.lights.length,2);assert.ok(rig.lights.every(l=>l.visible&&l.target.position.x>l.position.x));rig.update(root,0);assert.ok(rig.lights.every(l=>!l.visible&&l.intensity===0));rig.update(null,1);assert.ok(rig.lights.every(l=>!l.visible));rig.dispose();rig.dispose();assert.equal(scene.children.length,1);
 const counts=new Map();group.traverse(o=>{if(o instanceof THREE.Mesh)for(const r of [o.geometry,o.material])if(!counts.has(r)){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}});counts.set(beams[0].material.map,0);beams[0].material.map.addEventListener('dispose',()=>counts.set(beams[0].material.map,counts.get(beams[0].material.map)+1));disposeVehicleLights(root);disposeVehicleLights(root);assert.ok([...counts.values()].every(n=>n===1));console.log(`${name}: actual hull anchors, day/night, brakes, roll, ground projection and resource disposal passed`);
}
// Async body replacement refreshes lamps while preserving the custom group.
const {root,body}=sourceCar('sedan');body.name='body';attachVehicleLights(root);const group=root.getObjectByName('custom-vehicle-lights'),replacement=sourceCar('race').body;root.add(replacement);updateVehicleLights(root,1,false);assert.equal(root.getObjectByName('custom-vehicle-lights'),group);assert.equal(group.children[0].children.length,4);disposeVehicleLights(root);
// Collision damage edits source positions in place: the render update refreshes
// overlays on revision, without allocating materials or real lights per impact.
const damaged=sourceCar('sedan');attachVehicleLights(damaged.root);updateVehicleLights(damaged.root,1,false);
const damageGroup=damaged.root.getObjectByName('custom-vehicle-lights'),sourceBody=damaged.body.getObjectByName('body'),sourcePositions=sourceBody.geometry.getAttribute('position');
const disposalCounts=new Map(),ownedMaterials=new Set();
const watchLamps=()=>damageGroup.children[0].traverse(o=>{if(!(o instanceof THREE.Mesh))return;ownedMaterials.add(o.material);if(!disposalCounts.has(o.geometry)){disposalCounts.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>disposalCounts.set(o.geometry,disposalCounts.get(o.geometry)+1));}});
watchLamps();let lamp=damageGroup.getObjectByName('headlamp'),before=lamp.geometry.boundingBox.getCenter(new THREE.Vector3()).z;
for(let revision=1;revision<=3;revision++){
 for(let i=0;i<sourcePositions.count;i++)if(sourcePositions.getZ(i)>0)sourcePositions.setZ(i,sourcePositions.getZ(i)-.025);
 sourcePositions.needsUpdate=true;sourceBody.geometry.computeBoundingBox();damaged.root.userData.damageRevision=revision;
 updateVehicleLights(damaged.root,1,true);lamp=damageGroup.getObjectByName('headlamp');const after=lamp.geometry.boundingBox.getCenter(new THREE.Vector3()).z;
 assert.ok(Math.abs(after-before+.025)<1e-6,'in-place source deformation moves actual lamp center');before=after;
 assert.equal(damageGroup.children[0].children.length,4,'damage refresh keeps exactly four lamps');watchLamps();
}
assert.equal(ownedMaterials.size,2,'head/tail materials are reused across damage revisions');
assert.equal([...disposalCounts.values()].filter(n=>n===1).length,12,'every replaced lamp geometry disposed once');
disposeVehicleLights(damaged.root);assert.ok([...disposalCounts.values()].every(n=>n===1),'final damage geometry resources disposed exactly once');
console.log('Actual GLB deformation refresh and bounded lamp disposal passed.');
console.log('Original GLB openings, geometry-derived vehicle lamps and async replacement checks passed.');
