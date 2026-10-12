import * as THREE from 'three';

/** Screen-space walking stays aligned while the follow camera turns. */
export function screenMovement(x:number,z:number,heading:number){
 const c=Math.cos(heading),s=Math.sin(heading);
 return {x:-c*x+s*z,z:s*x+c*z};
}

/** Release actor-owned rig textures and fallback meshes, retaining shared GLB caches. */
export function disposePersonVisual(root:THREE.Object3D):void{
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),skeletons=new Set<THREE.Skeleton>();
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  if(!object.userData.sharedGeometry)geometries.add(object.geometry);
  if(!object.userData.sharedMaterial)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  if(object instanceof THREE.SkinnedMesh)skeletons.add(object.skeleton);
 });
 skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 root.removeFromParent();root.clear();
}

/** SkeletonUtils clones actor rigs but intentionally shares model geometry/materials. */
export function markSharedPersonModel(model:THREE.Object3D):void{
 const rigs:THREE.Skeleton[]=[];
 model.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  object.userData.sharedGeometry=true;object.userData.sharedMaterial=true;
  if(object instanceof THREE.SkinnedMesh){
   const rig=object.skeleton;
   const shared=rigs.find(other=>other.bones.length===rig.bones.length&&other.bones.every((bone,i)=>bone===rig.bones[i]&&other.boneInverses[i].equals(rig.boneInverses[i])));
   if(shared)object.skeleton=shared;else rigs.push(rig);
  }
 });
}
