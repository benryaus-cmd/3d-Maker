import * as THREE from 'three';
import {CITY_BLOCKS,CITY_EDGE,DISTRICTS,districtAt,isRoad,roadDistance} from './CityLayout.ts';
import type {Wall} from './vehiclePhysics.ts';

/** Original local brands; façade accents complement the licensed city kit. */
export const DISTRICT_BRANDS:Record<string,readonly string[]>={
 hills:['CEDAR HOUSE','RIDGELINE COFFEE','HILLS MOTOR CLUB'],
 financial:['VESPER TRUST','NORTHSTAR CAPITAL','CORE EXCHANGE'],
 gardens:['FERN CONSERVATORY','CIVIC TEA ROOM','GREENWAY STUDIO'],
 'old-quarter':['LANTERN RECORDS','COPPER BAKERY','QUARTER ATELIER'],
 midtown:['MIDTOWN GARAGE','NIGHT OWL DINER','CROSSROADS RADIO'],
 neon:['AFTERIMAGE CLUB','VIOLET ARCADE','ECHO LOUNGE'],
 dockside:['ANCHOR FREIGHT','TIDELINE CANTEEN','BAY REPAIR'],
 industrial:['FORGE WORKS','BELT TOOL SUPPLY','IRONLINE DEPOT'],
 market:['SAFFRON MARKET','SUNSET TEXTILES','WARD FOOD HALL'],
};
export type DistrictIdentityState={x:number;z:number;night:number|boolean;ownedBusinessIds?:Iterable<string>;territoryOwners?:Record<string,string>|ReadonlyMap<string,string>};
type Face={x:number;z:number;rotation:number;wall:Wall;distance:number};
type Slot={group:THREE.Group;district:string;index:number;flag:THREE.Mesh;sign:THREE.Mesh;normal:THREE.Material;owned?:THREE.Material;wall?:Wall;wallBounds?:string;posts:THREE.Group};

/** Signs and canopies sit above head height on existing walls; this adds no colliders. */
export class DistrictIdentity {
 readonly root=new THREE.Group();
 readonly physicalFootprints:Wall[]=[];
 private readonly box=new THREE.BoxGeometry(1,1,1);
 private readonly plane=new THREE.PlaneGeometry(1,1);
 private readonly materials:THREE.Material[]=[];
 private readonly textures:THREE.Texture[]=[];
 private readonly slots:Slot[]=[];
 private readonly accents:THREE.MeshStandardMaterial[]=[];
 private readonly flags:THREE.MeshStandardMaterial[]=[];
 private disposed=false;
 private lastX=Infinity;private lastZ=Infinity;private lastCount=-1;private lastFirst?:Wall;
 constructor(scene:THREE.Scene){
  this.root.name='district-identity';scene.add(this.root);
  const frame=this.material(0x293137),trim=this.material(0xe4d7bd),dark=this.material(0x162329);
  for(const color of [0xa66b60,0x4ba0ad,0x9670b5,0xcfa15f,0x6ba784])this.flags.push(this.material(color));
  for(const [di,district]of DISTRICTS.entries()){
   const accent=this.material(district.color);accent.emissive.set(di%2?0x669ad0:0xffbd76);this.accents.push(accent);
   for(let index=0;index<3;index++){
    const group=new THREE.Group();group.name=`identity:${district.id}:${index}`;group.visible=false;this.root.add(group);
    const normal=this.signMaterial(district.name,DISTRICT_BRANDS[district.id][index],district.color,index===0?'LOCAL LANDMARK':'VESPER BAY • INDEPENDENT');
    this.mesh(group,this.box,frame,0,3.3,.12,5.8,1.8,.22);
    const sign=this.mesh(group,this.plane,normal,0,3.3,.24,5.5,1.56,1);
    this.mesh(group,this.box,accent,0,4.25,.2,5.8,.13,.22);
    this.mesh(group,this.box,trim,0,2.38,.46,5.9,.12,.9);
    for(let stripe=0;stripe<3;stripe++)this.mesh(group,this.box,accent,-1.96+stripe*1.96,2.45,.45,.85,.045,.9);
    // A compact faction pennant with a diamond motif reads without text from above.
    this.mesh(group,this.box,dark,2.68,3.4,.42,.075,1.6,.075);
    const flag=this.mesh(group,this.box,this.flags[di%this.flags.length],2.26,3.93,.43,.68,.64,.055);
    const emblem=this.mesh(group,this.box,trim,2.26,3.93,.47,.23,.23,.035);emblem.rotation.z=Math.PI/4;
    this.mesh(group,this.box,accent,-2.48,3.42,.35,.08,.95,.08);
    const posts=new THREE.Group();posts.visible=false;group.add(posts);
    for(const x of [-2.5,2.5])this.mesh(posts,this.box,frame,x,1.6,.12,.12,3.2,.12);
    const slot:Slot={group,district:district.id,index,flag,sign,normal,posts};
    if(district.id==='midtown'&&index===0)slot.owned=this.signMaterial('MIDTOWN','MIDTOWN GARAGE',0x69ac89,'YOUR BUSINESS • REPAIR / TUNE');
    this.slots.push(slot);
   }
  }
 }
 private material(color:number){const material=new THREE.MeshStandardMaterial({color,roughness:.8});this.materials.push(material);return material;}
 private mesh(group:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;
 }
 private signMaterial(district:string,brand:string,color:number,subtitle:string){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=216;
  const ctx=canvas.getContext('2d');
  if(ctx){
   ctx.fillStyle='#17252b';ctx.fillRect(0,0,768,216);ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`;ctx.fillRect(0,0,12,216);
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#dfceb4';ctx.font='600 24px sans-serif';ctx.fillText(district.toUpperCase(),390,34,710);
   ctx.fillStyle='#fff5df';ctx.font='bold 45px sans-serif';ctx.fillText(brand,390,104,710);
   ctx.fillStyle='#a9c0be';ctx.font='600 20px sans-serif';ctx.fillText(subtitle,390,174,710);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;this.textures.push(texture);
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});this.materials.push(material);return material;
 }
 private face(wall:Wall):Face|undefined{
  if(wall.broken||![wall.x,wall.z,wall.w,wall.d].every(Number.isFinite)||wall.w<3||wall.d<3)return;
  const options:Face[]=[];
  if(wall.w>=6.2)for(const side of [-1,1])options.push({x:wall.x,z:wall.z+side*(wall.d/2+.05),rotation:side>0?0:Math.PI,wall,distance:0});
  if(wall.d>=6.2)for(const side of [-1,1])options.push({x:wall.x+side*(wall.w/2+.05),z:wall.z,rotation:side>0?Math.PI/2:-Math.PI/2,wall,distance:0});
  return options.filter(face=>{
   // Validate the entire projected canopy rectangle, not merely its centre.
   for(const tangent of [-3.05,0,3.05])for(const depth of [.02,.94]){
    const x=face.x+Math.cos(face.rotation)*tangent+Math.sin(face.rotation)*depth;
    const z=face.z-Math.sin(face.rotation)*tangent+Math.cos(face.rotation)*depth;
    if(Math.abs(x)>CITY_EDGE-1||Math.abs(z)>CITY_EDGE-1||isRoad(x,z,.45))return false;
   }
   face.distance=roadDistance(face.x,face.z);return true;
  }).sort((a,b)=>a.distance-b.distance)[0];
 }
 update(state:DistrictIdentityState,walls:readonly Wall[]){
  if(this.disposed)return;
  const night=typeof state.night==='boolean'?Number(state.night):Math.max(0,Math.min(1,state.night));
  for(const material of this.accents)material.emissiveIntensity=.12+night*.8;
  const owned=new Set(state.ownedBusinessIds??[]);
  for(const slot of this.slots){
   if(slot.owned)slot.sign.material=owned.has('garage')||owned.has('midtown-garage')?slot.owned:slot.normal;
   const owners=state.territoryOwners;const owner=owners instanceof Map?owners.get(slot.district):(owners as Record<string,string>|undefined)?.[slot.district];
   if(owner){let hash=0;for(const c of owner)hash=(hash*31+c.charCodeAt(0))>>>0;slot.flag.material=this.flags[hash%this.flags.length];}
   else slot.flag.material=this.flags[DISTRICTS.findIndex(d=>d.id===slot.district)%this.flags.length];
  }
  if((state.x-this.lastX)**2+(state.z-this.lastZ)**2<100&&walls.length===this.lastCount&&walls[0]===this.lastFirst&&this.slots.every(s=>!s.wall||(!s.wall.broken&&s.wallBounds===`${s.wall.x}:${s.wall.z}:${s.wall.w}:${s.wall.d}`)))return;
  this.lastX=state.x;this.lastZ=state.z;this.lastCount=walls.length;this.lastFirst=walls[0];
  const used=new Set<Wall>();this.physicalFootprints.length=0;
  for(const slot of this.slots){
   slot.group.visible=false;slot.posts.visible=false;slot.wall=undefined;
   const district=DISTRICTS.find(d=>d.id===slot.district)!;
   if(Math.hypot(state.x-district.x,state.z-district.z)>165)continue;
   const blocks=CITY_BLOCKS.filter(b=>b.district===district.id);
   const target=blocks.find(b=>slot.index===0?b.cells.length===4:slot.index===1?b.cells.length===3:b.cells.length===2)??blocks[slot.index];
   const garage=slot.district==='midtown'&&slot.index===0;
   const tx=garage?0:(target.minX+target.maxX)/2,tz=garage?-12:(target.minZ+target.maxZ)/2;
   const candidates=walls.filter(w=>w.kind==='building'&&!used.has(w)&&districtAt(w.x,w.z).id===district.id&&Math.hypot(w.x-state.x,w.z-state.z)<112)
    .sort((a,b)=>Math.hypot(a.x-tx,a.z-tz)-Math.hypot(b.x-tx,b.z-tz));
   let face:Face|undefined;
   for(const wall of candidates){face=this.face(wall);if(face)break;}
   if(!face){
    // Gardens has no building walls. Grounded wayfinding boards occupy a clear
    // pedestrian patch, with real narrow posts exposed separately to physics.
    if(district.id==='gardens')for(const cell of target.cells){
     const x=cell.x,z=cell.z+6.5;
     if(Math.hypot(x-state.x,z-state.z)>112||!walls.some(w=>Math.hypot(w.x-x,w.z-z)<25))continue;
     if([-3.05,0,3.05].some(dx=>isRoad(x+dx,z,.95)))continue;
     if(walls.some(w=>!w.broken&&Math.abs(w.x-x)<w.w/2+3.05&&Math.abs(w.z-z)<w.d/2+1))continue;
     slot.group.position.set(x,0,z);slot.group.rotation.y=0;slot.group.visible=true;slot.posts.visible=true;
     slot.group.userData.brand=DISTRICT_BRANDS[district.id][slot.index];
     for(const dx of [-2.5,2.5])this.physicalFootprints.push({x:x+dx,z:z+.12,w:.12,d:.12,kind:'identity-post'});
     break;
    }
    continue;
   }
   used.add(face.wall);slot.wall=face.wall;slot.wallBounds=`${face.wall.x}:${face.wall.z}:${face.wall.w}:${face.wall.d}`;slot.group.position.set(face.x,0,face.z);slot.group.rotation.y=face.rotation;slot.group.visible=true;
   slot.group.userData.wall=face.wall;slot.group.userData.brand=DISTRICT_BRANDS[district.id][slot.index];
  }
 }
 debugStats(){return {groups:this.slots.length,visible:this.slots.filter(s=>s.group.visible).length,geometries:2,materials:this.materials.length,textures:this.textures.length,physicalFootprints:this.physicalFootprints.length};}
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.root.clear();this.box.dispose();this.plane.dispose();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
