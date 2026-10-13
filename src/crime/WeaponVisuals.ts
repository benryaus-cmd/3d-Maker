import * as THREE from 'three';

export type VisualWeapon = 'pistol'|'shotgun'|'smg';
const names=['Torso','UpperArmR','LowerArmR','UpperArmL','LowerArmL'] as const;
// Sampled from bundled CC0 casual-male.glb Shoot_OneHanded at 0.15 seconds.
const shoot=[[-.0068399,0,0,.9999766],[.1896267,.7563572,.5729888,.2522882],[-.0538258,-.0047646,.2089289,.9764368],[-.2842493,-.2266295,-.7723672,.5208555],[-.021539,.1305794,-.1842181,.9739347]].map(q=>new THREE.Quaternion(...q as [number,number,number,number]).normalize());
let geometry:THREE.BoxGeometry|null=null;
let materials:THREE.MeshStandardMaterial[]=[];
const rigs=new WeakMap<THREE.Object3D,{bones:(THREE.Object3D|null)[];base:THREE.Quaternion[];applied:boolean;gun:THREE.Group|null;weapon:VisualWeapon|null;fist:THREE.Object3D|null}>();
function rigFor(root:THREE.Object3D){
 let rig=rigs.get(root);const fist=root.getObjectByName('FistR')??null;
 if(!rig){rig={bones:names.map(n=>root.getObjectByName(n)??null),base:names.map(()=>new THREE.Quaternion()),applied:false,gun:null,weapon:null,fist};rigs.set(root,rig);}
 else if(rig.fist!==fist){
  // Stable actor roots outlive asynchronously loaded/replaced model hierarchies.
  // Restore the retired model before refreshing its pose references.
  if(rig.applied)rig.bones.forEach((bone,i)=>bone?.quaternion.copy(rig.base[i]));
  rig.applied=false;rig.bones=names.map(n=>root.getObjectByName(n)??null);rig.fist=fist;
  rig.gun?.removeFromParent();
 }
 return rig;
}
function resources(){if(!geometry){geometry=new THREE.BoxGeometry();materials=[new THREE.MeshStandardMaterial({color:0x202734,metalness:.65,roughness:.35}),new THREE.MeshStandardMaterial({color:0x656f7c,metalness:.8,roughness:.3}),new THREE.MeshStandardMaterial({color:0x54362a,roughness:.75}),new THREE.MeshStandardMaterial({color:0xe9ae46,metalness:.65,roughness:.35})];}}
function gunFor(weapon:VisualWeapon){resources();const gun=new THREE.Group();gun.name='BlacktopWeapon';
 const part=(x:number,y:number,z:number,w:number,h:number,d:number,m=0)=>{const mesh=new THREE.Mesh(geometry!,materials[m]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.userData.sharedGeometry=mesh.userData.sharedMaterial=true;gun.add(mesh);return mesh;};
 // Grip centre is exactly the attached fist. Barrel faces character-local +Z.
 part(0,-.018,.015,.055,.105,.065,2);
 const length=weapon==='shotgun'?.48:weapon==='smg'?.29:.19;
 part(0,.055,length*.36,.07,.065,length,0);
 part(0,.057,length*.86,.033,.033,.06,1);
 part(0,.099,length*.5,.019,.018,.023,3);
 part(0,.1,-.015,.024,.016,.021,1);
 if(weapon==='shotgun'){part(0,.012,.2,.078,.045,.13,2);part(0,.025,-.115,.075,.078,.17,2);}
 if(weapon==='smg'){part(0,-.035,.12,.047,.16,.06,0);part(0,.035,-.12,.048,.04,.16,1);}
 const muzzle=new THREE.Object3D();muzzle.name='BlacktopMuzzle';muzzle.position.set(0,.057,length*.86+.034);gun.add(muzzle);
 return gun;
}
/** Switching detaches old meshes, retaining module-owned shared geometry/materials. */
export function equipWeaponVisual(root:THREE.Object3D,weapon:VisualWeapon|null):void{
 const rig=rigFor(root);
 if(rig.weapon!==weapon){rig.gun?.removeFromParent();rig.gun=null;rig.weapon=weapon;}
 if(!weapon||!rig.fist)return;
 if(rig.gun?.parent===rig.fist)return;
 rig.gun??=gunFor(weapon);rig.fist.add(rig.gun);orientGun(root,rig.gun);
}
const worldQ=new THREE.Quaternion(),rootQ=new THREE.Quaternion(),targetQ=new THREE.Quaternion();
function orientGun(root:THREE.Object3D,gun:THREE.Group){root.updateMatrixWorld(true);gun.parent!.getWorldQuaternion(worldQ);root.getWorldQuaternion(rootQ);gun.quaternion.copy(worldQ.invert()).multiply(rootQ);gun.updateMatrixWorld(true);}
/** Restore overlays in reverse application order, then update mixer, then apply overlays. */
export function restoreWeaponPose(root:THREE.Object3D):void{if(!rigs.has(root))return;const rig=rigFor(root);if(!rig.applied)return;rig.bones.forEach((bone,i)=>bone?.quaternion.copy(rig.base[i]));rig.applied=false;}
export function applyWeaponPose(root:THREE.Object3D,weapon:VisualWeapon|null,aiming:boolean,recoilAge:number,reloadRemaining:number):void{
 equipWeaponVisual(root,weapon);const rig=rigFor(root);if(rig.applied)restoreWeaponPose(root);if(!weapon)return;
 const kick=recoilAge>=0&&recoilAge<.18?Math.sin(Math.PI*recoilAge/.18)*(weapon==='shotgun'?.24:.11):0;
 rig.bones.forEach((bone,i)=>{if(!bone)return;rig.base[i].copy(bone.quaternion);targetQ.copy(shoot[i]);if(i===1)targetQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-kick));const blend=reloadRemaining>0?.42:aiming?1:.72;bone.quaternion.slerp(targetQ,blend);});
 rig.applied=true;if(rig.gun){if(weapon!=='pistol'&&reloadRemaining<=0){root.updateMatrixWorld(true);const fist=root.getObjectByName('FistR');if(fist){const grip=fist.getWorldPosition(new THREE.Vector3()),offset=new THREE.Vector3(.07,0,-.18);root.getWorldQuaternion(rootQ);offset.applyQuaternion(rootQ);const scale=root.getWorldScale(new THREE.Vector3());offset.multiplyScalar(scale.y);solveArm(root,'R',grip.add(offset));}}orientGun(root,rig.gun);if(weapon!=='pistol'&&reloadRemaining<=0)supportHand(root,rig.gun);}
}
// Two-bone support arm: turns each verified +Y bone toward a reachable grip.
const target=new THREE.Vector3(),shoulder=new THREE.Vector3(),elbow=new THREE.Vector3(),current=new THREE.Vector3(),desired=new THREE.Vector3(),parentQ=new THREE.Quaternion();
function turnBone(bone:THREE.Object3D,child:THREE.Object3D,point:THREE.Vector3){bone.getWorldPosition(current);child.getWorldPosition(desired);desired.sub(current).normalize();target.copy(point).sub(current).normalize();worldQ.setFromUnitVectors(desired,target);bone.getWorldQuaternion(rootQ);rootQ.premultiply(worldQ);bone.parent!.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert()).multiply(rootQ);bone.updateMatrixWorld(true);}
function supportHand(root:THREE.Object3D,gun:THREE.Group){solveArm(root,'L',gun.localToWorld(new THREE.Vector3(0,.005,.17)));}
function solveArm(root:THREE.Object3D,side:'R'|'L',grip:THREE.Vector3){const upper=root.getObjectByName('UpperArm'+side),lower=root.getObjectByName('LowerArm'+side),fist=root.getObjectByName('Fist'+side);if(!upper||!lower||!fist)return;root.updateMatrixWorld(true);upper.getWorldPosition(shoulder);lower.getWorldPosition(elbow);fist.getWorldPosition(current);const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(current),d=Math.min(a+b-.001,shoulder.distanceTo(grip));desired.copy(grip).sub(shoulder).normalize();const along=(a*a-b*b+d*d)/(2*Math.max(.001,d));const bend=Math.sqrt(Math.max(0,a*a-along*along));elbow.copy(shoulder).addScaledVector(desired,along);const down=new THREE.Vector3(0,-1,0).addScaledVector(desired,desired.y).normalize();elbow.addScaledVector(down,bend);turnBone(upper,lower,elbow);turnBone(lower,fist,grip);}
/** Actual hand-anchored muzzle, suitable for effects; physics remains planar. */
export function getWeaponMuzzle(root:THREE.Object3D,target=new THREE.Vector3()):THREE.Vector3|null{if(!rigs.has(root))return null;const rig=rigFor(root);if(!rig.gun||rig.gun.parent!==rig.fist)return null;const muzzle=rig.gun.getObjectByName('BlacktopMuzzle');if(!muzzle)return null;root.updateMatrixWorld(true);return muzzle.getWorldPosition(target);}
/** Call after retiring all actors. Shared resources recreated on the next equip. */
export function disposeWeaponVisuals():void{geometry?.dispose();geometry=null;materials.forEach(m=>m.dispose());materials=[];}
