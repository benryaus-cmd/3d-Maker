import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CombatEffects} from '../src/crime/CombatEffects.ts';
import {equipWeaponVisual,restoreWeaponPose,applyWeaponPose,getWeaponMuzzle,disposeWeaponVisuals} from '../src/crime/WeaponVisuals.ts';
import {CombatAudio} from '../src/crime/CombatAudio.ts';
import {disposePersonVisual,markSharedPersonModel} from '../src/crime/PersonVisuals.ts';
const scene=new THREE.Scene(),effects=new CombatEffects(scene);
assert.equal(effects.root.children.length,effects.capacity);
for(let i=0;i<1000;i++)effects.shot('shotgun',{x:0,z:0},{x:2,z:3},i%2?'wall':'actor');
assert.ok(effects.activeCount<=96);assert.equal(effects.root.children.length,96,'burst load reuses fixed GPU pool');
const tracer=effects.root.children.find(x=>x.isMesh&&x.visible);assert.ok(tracer.scale.z>3);assert.equal(tracer.position.y,1.2);
const flash=effects.root.children.find(x=>x.isSprite&&x.visible);const opacity=flash.material.opacity;effects.update(.02);assert.ok(flash.material.opacity<opacity,'age fades flash');
for(let i=0;i<10;i++)effects.update(.1);assert.equal(effects.activeCount,0,'effects fully retire');
assert.equal(effects.shot('pistol',{x:NaN,z:0},{x:0,z:0}),0);
let textureDisposed=0,geometryDisposed=0,materialsDisposed=0;
const sprite=effects.root.children.find(x=>x.isSprite);sprite.material.map.addEventListener('dispose',()=>textureDisposed++);
tracer.geometry.addEventListener('dispose',()=>geometryDisposed++);
effects.root.children.forEach(x=>x.material.addEventListener('dispose',()=>materialsDisposed++));
effects.dispose();effects.dispose();assert.equal(scene.children.length,0);assert.equal(textureDisposed,1);assert.equal(geometryDisposed,1);assert.equal(materialsDisposed,96);assert.equal(effects.shot('pistol',{x:0,z:0},{x:0,z:1}),0);
let sharedGeometry,sharedMaterial;
for(const character of ['casual-male','casual-female','worker-male','suit-female']){
 const b=fs.readFileSync(new URL(`../src/crime/bundled/characters/${character}.glb`,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const root=gltf.scene;markSharedPersonModel(root);
 const mixer=new THREE.AnimationMixer(root);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')).play();mixer.update(.1);
 const arm=root.getObjectByName('UpperArmR'),base=arm.quaternion.clone(),fist=root.getObjectByName('FistR');assert.ok(fist);
 equipWeaponVisual(root,'pistol');const pistol=root.getObjectByName('BlacktopWeapon');assert.equal(pistol.parent,fist,'weapon is physically parented to animated hand');
 assert.ok(pistol.getWorldPosition(new THREE.Vector3()).distanceTo(fist.getWorldPosition(new THREE.Vector3()))<1e-6,'grip remains in hand');
 const mesh=pistol.children.find(x=>x.isMesh);sharedGeometry??=mesh.geometry;sharedMaterial??=mesh.material;assert.equal(mesh.geometry,sharedGeometry);assert.equal(mesh.material,sharedMaterial);
 applyWeaponPose(root,'pistol',true,.05,0);root.updateMatrixWorld(true);const once=arm.quaternion.clone();applyWeaponPose(root,'pistol',true,.05,0);assert.ok(arm.quaternion.angleTo(once)<1e-5,'pose is idempotent');
 const muzzle=getWeaponMuzzle(root);assert.ok(muzzle.z>fist.getWorldPosition(new THREE.Vector3()).z+.1,'gun barrel faces character forward');
 restoreWeaponPose(root);assert.ok(arm.quaternion.equals(base),'overlay restores locomotion base exactly');
 applyWeaponPose(root,'shotgun',true,1,0);root.updateMatrixWorld(true);const gun=root.getObjectByName('BlacktopWeapon'),grip=gun.localToWorld(new THREE.Vector3(0,.005,.17)),left=root.getObjectByName('FistL').getWorldPosition(new THREE.Vector3());assert.ok(grip.distanceTo(left)<.16,'support hand grips long weapon within reach');
 restoreWeaponPose(root);equipWeaponVisual(root,null);assert.equal(root.getObjectByName('BlacktopWeapon'),undefined);assert.equal(getWeaponMuzzle(root),null);disposePersonVisual(root);
}
// Models arrive asynchronously beneath a stable actor root, then may be replaced.
const stableRoot=new THREE.Group();stableRoot.add(new THREE.Group());
equipWeaponVisual(stableRoot,'pistol');applyWeaponPose(stableRoot,'pistol',true,1,0);
const bytes=fs.readFileSync(new URL('../src/crime/bundled/characters/casual-male.glb',import.meta.url));
const loadModel=async()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const firstModel=(await loadModel()).scene;stableRoot.clear();stableRoot.add(firstModel);
equipWeaponVisual(stableRoot,'pistol');
const firstFist=firstModel.getObjectByName('FistR'),firstArm=firstModel.getObjectByName('UpperArmR'),firstBase=firstArm.quaternion.clone();
assert.ok(stableRoot.getObjectByName('BlacktopWeapon')?.parent===firstFist,'same selection equips when actual asynchronous rig arrives');
applyWeaponPose(stableRoot,'pistol',true,1,0);assert.ok(firstArm.quaternion.angleTo(firstBase)>.1,'late-loaded bones receive pose');
const originalGun=stableRoot.getObjectByName('BlacktopWeapon');
const secondModel=(await loadModel()).scene;stableRoot.clear();stableRoot.add(secondModel);
equipWeaponVisual(stableRoot,'pistol');
const secondFist=secondModel.getObjectByName('FistR'),secondArm=secondModel.getObjectByName('UpperArmR'),secondBase=secondArm.quaternion.clone();
assert.ok(stableRoot.getObjectByName('BlacktopWeapon')?.parent===secondFist,'same selection reattaches after replacing an already loaded rig');
assert.equal(stableRoot.getObjectByName('BlacktopWeapon'),originalGun,'hierarchy replacement reuses the same gun');
assert.ok(firstArm.quaternion.equals(firstBase),'retired rig overlay is restored');
applyWeaponPose(stableRoot,'pistol',true,1,0);assert.ok(secondArm.quaternion.angleTo(secondBase)>.1,'replacement bones receive pose');restoreWeaponPose(stableRoot);assert.ok(secondArm.quaternion.equals(secondBase),'replacement pose restores its own base');
assert.equal(originalGun.children.find(x=>x.isMesh).geometry,sharedGeometry,'replacement retains shared geometry');
equipWeaponVisual(stableRoot,null);disposePersonVisual(stableRoot);disposePersonVisual(firstModel);
let gunGeoDisposed=0,gunMatDisposed=0;sharedGeometry.addEventListener('dispose',()=>gunGeoDisposed++);sharedMaterial.addEventListener('dispose',()=>gunMatDisposed++);disposeWeaponVisuals();assert.equal(gunGeoDisposed,1);assert.equal(gunMatDisposed,1);
// No AudioContext is touched before a gesture; unsupported/headless browser stays harmless.
const audio=new CombatAudio();audio.shot('pistol');audio.reload('shotgun');audio.unlock();audio.setMuted(true);audio.setVolume(NaN);audio.dispose();audio.dispose();audio.unlock();
// Exercise the actual synthesizer scheduler with inspectable WebAudio nodes.
let contextCount=0,ctx;
class Param {value=0;events=[];setValueAtTime(v,t){this.events.push([v,t]);}exponentialRampToValueAtTime(v,t){this.events.push([v,t]);}setTargetAtTime(v,t){this.events.push([v,t]);}}
class Node {disconnected=0;connect(){}disconnect(){this.disconnected++;}}
class Source extends Node {frequency=new Param();started=[];stopped=[];start(t){this.started.push(t);}stop(t){this.stopped.push(t);}}
class Context {state='running';currentTime=2;sampleRate=8000;destination=new Node();sources=[];gains=[];filters=[];closed=0;constructor(){contextCount++;ctx=this;}createGain(){const n=new Node();n.gain=new Param();this.gains.push(n);return n;}createBuffer(_,length){return {getChannelData:()=>new Float32Array(length)};}createBufferSource(){const n=new Source();this.sources.push(n);return n;}createOscillator(){const n=new Source();this.sources.push(n);return n;}createBiquadFilter(){const n=new Node();n.frequency=new Param();this.filters.push(n);return n;}resume(){return Promise.resolve();}close(){this.closed++;return Promise.resolve();}}
globalThis.window={AudioContext:Context};const sound=new CombatAudio();sound.shot('pistol');assert.equal(contextCount,0,'audio creates no context before input unlock');sound.unlock();assert.equal(contextCount,1);
for(const weapon of ['pistol','shotgun','smg'])sound.shot(weapon);assert.equal(ctx.sources.length,6);assert.equal(new Set(ctx.sources.filter(n=>n.frequency.events.length).map(n=>n.frequency.events[0][0])).size,3,'three distinct reports');
for(let i=0;i<100;i++)sound.shot('smg');assert.equal(ctx.sources.length,24,'voice count is bounded under automatic fire');sound.reload('shotgun');assert.equal(ctx.sources.length,24,'reload respects same bound');
ctx.sources.forEach(n=>n.onended?.());sound.reload('shotgun');assert.equal(ctx.sources.length,30);assert.ok(ctx.sources.slice(-6).every(n=>n.started.length===1&&n.stopped.length===1));sound.setMuted(true);sound.shot('pistol');assert.equal(ctx.sources.length,30);sound.dispose();sound.dispose();assert.equal(ctx.closed,1);assert.ok(ctx.sources.every(n=>n.disconnected>0),'all sound sources disconnected');delete globalThis.window;
console.log('PASS combat effects: four real GLB hand rigs, forward muzzle/support grip, pose restore, shared GPU assets, bounded pool/fade/disposal, headless audio lifecycle');
