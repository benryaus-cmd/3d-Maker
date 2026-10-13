import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CITY_BLOCKS,DISTRICTS,isRoad,districtAt} from '../src/crime/CityLayout.ts';
import {DistrictIdentity,DISTRICT_BRANDS} from '../src/crime/DistrictIdentity.ts';
const labels=[];
globalThis.document={createElement(name){assert.equal(name,'canvas');return {width:0,height:0,getContext(){return {fillRect(){},fillText(text){labels.push(text);}};}};}};
const scene=new THREE.Scene();const identity=new DistrictIdentity(scene);
assert.equal(identity.debugStats().groups,27);assert.equal(identity.debugStats().textures,28);
assert.equal(new Set(Object.values(DISTRICT_BRANDS).flat()).size,27);
for(const district of DISTRICTS)assert.ok(labels.includes(district.name.toUpperCase()));
const walls=CITY_BLOCKS.flatMap(b=>b.cells.map(c=>({x:c.x,z:c.z,w:8,d:8,kind:'building'})));
const before=identity.debugStats();
for(let iteration=0;iteration<6;iteration++)for(const district of DISTRICTS){
 identity.update({x:district.x,z:district.z,night:iteration%2,ownedBusinessIds:['garage'],territoryOwners:{[district.id]:'player'}},walls);
 const local=identity.root.children.filter(g=>g.visible&&g.name.startsWith(`identity:${district.id}:`));
 assert.equal(local.length,3,`${district.id} has three grounded brands`);
 for(const group of identity.root.children.filter(g=>g.visible)){
  const wall=group.userData.wall;assert.ok(walls.includes(wall),'sign is attached to a real loaded wall');
  assert.equal(districtAt(wall.x,wall.z).id,group.name.split(':')[1]);
  const bounds=new THREE.Box3();group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh&&o.parent.visible)bounds.union(new THREE.Box3().setFromObject(o));});
  for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z])assert.equal(isRoad(x,z,.4),false,'decor stays outside driving road');
  assert.ok(bounds.min.y>=2.3,'façades preserve ground-level pedestrian access');
 }
 const stats=identity.debugStats();for(const k of ['groups','geometries','materials','textures'])assert.equal(stats[k],before[k],`${k} stays bounded during streaming`);
}
identity.update({x:0,z:0,night:1,ownedBusinessIds:['garage']},walls);
const garage=identity.root.children.find(g=>g.name==='identity:midtown:0');assert.equal(garage.visible,true);
assert.ok(labels.includes('YOUR BUSINESS • REPAIR / TUNE'));
const gardens=CITY_BLOCKS.filter(b=>b.district==='gardens').flatMap(b=>b.cells.map(c=>({x:c.x+6,z:c.z-6,w:2,d:2,kind:'tree'})));
identity.update({x:120,z:120,night:1},gardens);
assert.ok(identity.root.children.some(g=>g.visible&&g.name.startsWith('identity:gardens:')),'park gets grounded wayfinding when no building exists');
assert.ok(identity.physicalFootprints.length>0);assert.ok(identity.physicalFootprints.every(w=>w.w===.12&&w.d===.12&&!isRoad(w.x,w.z)));
identity.update({x:0,z:0,night:0},[]);assert.equal(identity.debugStats().visible,0,'unloaded buildings leave no floating façades');
let geometries=0,materials=0,textures=0;
for(const geometry of [identity.box,identity.plane])geometry.addEventListener('dispose',()=>geometries++);
for(const material of identity.materials)material.addEventListener('dispose',()=>materials++);
for(const texture of identity.textures)texture.addEventListener('dispose',()=>textures++);
identity.dispose();identity.dispose();assert.equal(scene.children.length,0);assert.equal(geometries,2);assert.equal(materials,before.materials);assert.equal(textures,before.textures);
console.log('District identity: nine brands, wall attachment, safe roads, bounded streaming, garage ownership, gardens supports and disposal PASS');
