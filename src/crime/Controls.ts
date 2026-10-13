export type ControlField='throttle'|'brake'|'left'|'right'|'handbrake'|'nitro'|'punch'|'fire'|'reload';
const keys:Record<ControlField,string[]>={throttle:['w','arrowup'],brake:['s','arrowdown'],left:['a','arrowleft'],right:['d','arrowright'],handbrake:[' '],nitro:['shift'],punch:['f'],fire:['j'],reload:['r']};
type Aim={x:number;z:number;active:boolean};
const aimVector=(x:number,z:number,active:boolean):Aim=>{
 x=Number.isFinite(x)?x:0;z=Number.isFinite(z)?z:0;
 const length=Math.max(1,Math.hypot(x,z));return {x:x/length,z:z/length,active:active&&Math.hypot(x,z)>0};
};

/** Keep each keyboard key and captured finger independent until it releases. */
export class Controls{
 throttle=false;brake=false;left=false;right=false;handbrake=false;nitro=false;punch=false;steer=0;moveX=0;moveZ=0;
 fire=false;reload=false;aimX=0;aimZ=0;aiming=false;
 private pressed=new Set<string>();
 private pointers=new Map<number,ControlField>();
 private aims=new Map<number,Aim>();
 private directAim:Aim={x:0,z:0,active:false};
 key(key:string,down:boolean){if(down)this.pressed.add(key);else this.pressed.delete(key);this.apply();}
 pointer(id:number,field:ControlField){this.pointers.set(id,field);this.apply();}
 release(id:number){this.pointers.delete(id);this.aims.delete(id);this.apply();}
 /** Screen-space direction: right is +X, up is +Z; world projection belongs to the camera. */
 setAim(x:number,z:number,active:boolean){this.directAim=aimVector(x,z,active);this.apply();}
 pointerAim(id:number,x:number,z:number,active:boolean){this.aims.set(id,aimVector(x,z,active));this.apply();}
 releaseAim(id:number){this.aims.delete(id);this.apply();}
 clearAim(){this.aims.clear();this.directAim={x:0,z:0,active:false};this.apply();}
 setStick(x:number,z:number){
  x=Number.isFinite(x)?x:0;z=Number.isFinite(z)?z:0;
  this.steer=Math.max(-1,Math.min(1,x));
  const length=Math.max(1,Math.hypot(x,z));this.moveX=x/length;this.moveZ=z/length;
 }
 clear(){this.pressed.clear();this.pointers.clear();this.aims.clear();this.directAim={x:0,z:0,active:false};this.steer=this.moveX=this.moveZ=0;this.apply();}
 private apply(){
  for(const field of Object.keys(keys) as ControlField[])
   this[field]=keys[field].some(key=>this.pressed.has(key))||[...this.pointers.values()].includes(field);
  const activeAims=[...this.aims.values()].filter(a=>a.active),aim=activeAims[activeAims.length-1]??this.directAim;
  this.aiming=aim.active;this.aimX=aim.active?aim.x:0;this.aimZ=aim.active?aim.z:0;
  this.fire=this.fire||this.aiming;
 }
}
