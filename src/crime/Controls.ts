export type ControlField='throttle'|'brake'|'left'|'right'|'handbrake'|'nitro'|'punch';
const keys:Record<ControlField,string[]>={throttle:['w','arrowup'],brake:['s','arrowdown'],left:['a','arrowleft'],right:['d','arrowright'],handbrake:[' '],nitro:['shift'],punch:['f']};

/** Keep each keyboard key and captured finger independent until it releases. */
export class Controls{
 throttle=false;brake=false;left=false;right=false;handbrake=false;nitro=false;punch=false;steer=0;moveX=0;moveZ=0;
 private pressed=new Set<string>();
 private pointers=new Map<number,ControlField>();
 key(key:string,down:boolean){if(down)this.pressed.add(key);else this.pressed.delete(key);this.apply();}
 pointer(id:number,field:ControlField){this.pointers.set(id,field);this.apply();}
 release(id:number){this.pointers.delete(id);this.apply();}
 setStick(x:number,z:number){
  x=Number.isFinite(x)?x:0;z=Number.isFinite(z)?z:0;
  this.steer=Math.max(-1,Math.min(1,x));
  const length=Math.max(1,Math.hypot(x,z));this.moveX=x/length;this.moveZ=z/length;
 }
 clear(){this.pressed.clear();this.pointers.clear();this.steer=this.moveX=this.moveZ=0;this.apply();}
 private apply(){
  for(const field of Object.keys(keys) as ControlField[])
   this[field]=keys[field].some(key=>this.pressed.has(key))||[...this.pointers.values()].includes(field);
 }
}
