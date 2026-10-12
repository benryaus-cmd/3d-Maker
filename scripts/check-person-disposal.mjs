import assert from 'node:assert/strict';
import * as THREE from 'three';
const module=await import('../src/crime/PersonVisuals.ts').catch(()=>null);
for(const heading of [0,Math.PI/2,-Math.PI/2,Math.PI]){
 const right=module.screenMovement(1,0,heading),up=module.screenMovement(0,1,heading);
 assert.ok(Math.abs(right.x+Math.cos(heading))<1e-9&&Math.abs(right.z-Math.sin(heading))<1e-9);
 assert.ok(Math.abs(up.x-Math.sin(heading))<1e-9&&Math.abs(up.z-Math.cos(heading))<1e-9);
}
assert.equal(typeof module?.disposePersonVisual,'function','retiring characters must release their own GPU resources');
const root=new THREE.Group(),bone=new THREE.Bone(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.SkinnedMesh(geometry,material),skeleton=new THREE.Skeleton([bone]);mesh.add(bone);mesh.bind(skeleton);skeleton.computeBoneTexture();root.add(mesh);
let geometryGone=0,materialGone=0,bonesGone=0;geometry.addEventListener('dispose',()=>geometryGone++);material.addEventListener('dispose',()=>materialGone++);skeleton.boneTexture.addEventListener('dispose',()=>bonesGone++);
module.disposePersonVisual(root);assert.equal(geometryGone,1);assert.equal(materialGone,1);assert.equal(bonesGone,1);assert.equal(root.children.length,0);
const cachedRoot=new THREE.Group(),cachedGeo=new THREE.BoxGeometry(),cachedMat=new THREE.MeshStandardMaterial(),cachedMesh=new THREE.Mesh(cachedGeo,cachedMat);cachedMesh.userData.sharedGeometry=cachedMesh.userData.sharedMaterial=true;cachedRoot.add(cachedMesh);let touched=0;cachedGeo.addEventListener('dispose',()=>touched++);cachedMat.addEventListener('dispose',()=>touched++);module.disposePersonVisual(cachedRoot);assert.equal(touched,0,'model cache geometry and textures remain reusable');cachedGeo.dispose();cachedMat.dispose();
const rigRoot=new THREE.Group(),rigBone=new THREE.Bone(),g=new THREE.BoxGeometry(),m=new THREE.MeshStandardMaterial(),one=new THREE.SkinnedMesh(g,m),two=new THREE.SkinnedMesh(g,m),rig=new THREE.Skeleton([rigBone]);rigRoot.add(rigBone,one,two);one.bind(rig);two.bind(rig.clone());module.markSharedPersonModel(rigRoot);assert.equal(one.skeleton,two.skeleton,'primitives on one rig share the bone texture and update');module.disposePersonVisual(rigRoot);g.dispose();m.dispose();
console.log('Character geometry/material/bone texture disposal and rig sharing: PASS');
