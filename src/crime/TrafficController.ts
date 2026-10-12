import {roadRoute,STREET_NODES,nearestStreet,ROAD_TILE_SIZE} from './CityLayout';
import type {CarState,DriverInput,Wall} from './vehiclePhysics';
type Point={x:number;z:number};
export type TrafficPlan={path:Point[];index:number;goal:Point;stuck:number;reverseTime:number;lastX:number;lastZ:number};
export const TRAFFIC_LANE_OFFSET=2.4;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
/** Australia's left lanes stay offset from the graph's road centerline. */
export function trafficPlan(car:CarState,goal:Point,previous?:TrafficPlan):TrafficPlan{
 const start=nearestStreet(car.x,car.z),node=STREET_NODES.get(start.nodeId)!,target=nearestStreet(goal.x,goal.z).nodeId;
 const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
 const forward=node.neighbors.map(id=>STREET_NODES.get(id)!).sort((a,b)=>((b.x-node.x)*fx+(b.z-node.z)*fz)-((a.x-node.x)*fx+(a.z-node.z)*fz))[0];
 let centers=roadRoute(car,goal);
 if(forward&&((forward.x-node.x)*fx+(forward.z-node.z)*fz)>2){
  const parents=new Map<string,string|null>([[forward.id,null]]),queue=[forward.id];
  for(let i=0;i<queue.length&&!parents.has(target);i++)for(const id of STREET_NODES.get(queue[i])!.neighbors){
   if(queue[i]===forward.id&&id===node.id||parents.has(id))continue;
   parents.set(id,queue[i]);queue.push(id);
  }
  if(parents.has(target)){
   const ids:string[]=[];for(let id:string|null=target;id;id=parents.get(id)??null)ids.push(id);
   centers=[node,...ids.reverse().map(id=>STREET_NODES.get(id)!)];
  }
 }
 const path:Point[]=[];
 centers.forEach((p,i)=>{
  const before=centers[Math.max(0,i-1)],after=centers[Math.min(centers.length-1,i+1)];
  const incoming={x:p.x-before.x,z:p.z-before.z},outgoing={x:after.x-p.x,z:after.z-p.z};
  const inLength=Math.hypot(incoming.x,incoming.z),outLength=Math.hypot(outgoing.x,outgoing.z);
  const a={x:incoming.x/(inLength||1),z:incoming.z/(inLength||1)},b={x:outgoing.x/(outLength||1),z:outgoing.z/(outLength||1)};
  const turn=a.z*b.x-a.x*b.z;
  if(inLength&&outLength&&Math.abs(turn)>.5){
   // Round each ninety-degree turn within its junction. Lane offsets follow
   // the tangent around the arc, keeping the whole chassis on the asphalt.
   const radius=Math.min(inLength,outLength)*.36,center={x:p.x-a.x*radius+b.x*radius,z:p.z-a.z*radius+b.z*radius};
   const entry={x:p.x-a.x*radius-a.z*TRAFFIC_LANE_OFFSET,z:p.z-a.z*radius+a.x*TRAFFIC_LANE_OFFSET};
   const arcRadius=radius+turn*TRAFFIC_LANE_OFFSET,start=Math.atan2(entry.z-center.z,entry.x-center.x);
   for(let step=0;step<=4;step++){
    const angle=start-turn*Math.PI/2*step/4;
    path.push({x:center.x+Math.cos(angle)*arcRadius,z:center.z+Math.sin(angle)*arcRadius});
   }
  }else{
   const direction=outLength?b:a;
   path.push({x:p.x-direction.z*TRAFFIC_LANE_OFFSET,z:p.z+direction.x*TRAFFIC_LANE_OFFSET});
  }
 });
 return {path,index:Math.min(1,path.length-1),goal,stuck:previous?.stuck??0,reverseTime:previous?.reverseTime??0,lastX:car.x,lastZ:car.z};
}
export function spawnLane(point:Point,choice=0):Point&{heading:number}{
 const near=nearestStreet(point.x,point.z),node=STREET_NODES.get(near.nodeId)!;
 const choices=node.neighbors.map(id=>STREET_NODES.get(id)!).filter(Boolean);
 const next=choices[Math.abs(choice)%choices.length]??{x:node.x,z:node.z+ROAD_TILE_SIZE};
 const heading=Math.atan2(next.x-node.x,next.z-node.z);
 return {x:node.x-Math.cos(heading)*TRAFFIC_LANE_OFFSET,z:node.z+Math.sin(heading)*TRAFFIC_LANE_OFFSET,heading};
}
/** Pure pursuit steering, stopping-distance sensors and physical reverse recovery. */
export function trafficInput(car:CarState,plan:TrafficPlan,others:CarState[],walls:Wall[],dt:number,cruise=9):DriverInput{
 const v=Math.hypot(car.vx,car.vz),fx=Math.sin(car.heading),fz=Math.cos(car.heading),rx=fz,rz=-fx;
 while(plan.index<plan.path.length-1){
  const p=plan.path[plan.index],prev=plan.path[Math.max(0,plan.index-1)],dx=p.x-prev.x,dz=p.z-prev.z;
  if(Math.hypot(p.x-car.x,p.z-car.z)<1.5||(car.x-p.x)*dx+(car.z-p.z)*dz>0)plan.index++;else break;
 }
 let target=plan.path[plan.index]??plan.goal,desired=cruise;
 const look=ROAD_TILE_SIZE*.24+v*.35;
 // Spend the remaining lookahead along the next edge rather than jumping
 // an entire 15 m tile at once; the pursuit target moves continuously.
 let remaining=look-Math.hypot(target.x-car.x,target.z-car.z);
 for(let i=plan.index;remaining>0&&i<plan.path.length-1;i++){
  const p=plan.path[i],n=plan.path[i+1],length=Math.hypot(n.x-p.x,n.z-p.z);
  const fraction=Math.min(1,remaining/Math.max(.001,length));
  target={x:p.x+(n.x-p.x)*fraction,z:p.z+(n.z-p.z)*fraction};
  remaining-=length;
 }
 const error=wrap(Math.atan2(target.x-car.x,target.z-car.z)-car.heading);
 const steering=clamp(Math.atan2(5.4*Math.sin(error),Math.max(3,Math.hypot(target.x-car.x,target.z-car.z)))/.60,-1,1);
 // Look ahead further than steering so braking starts before the junction.
 for(let i=Math.max(1,plan.index-1);i<Math.min(plan.path.length-1,plan.index+4);i++){
  const prev=plan.path[Math.max(0,i-1)],p=plan.path[i],n=plan.path[i+1];
  const a=Math.atan2(p.x-prev.x,p.z-prev.z),b=Math.atan2(n.x-p.x,n.z-p.z),bend=Math.abs(wrap(b-a));
  if(bend>.25){const distance=Math.hypot(p.x-car.x,p.z-car.z);desired=Math.min(desired,Math.sqrt(3.5*3.5+2*3.3*Math.max(0,distance-ROAD_TILE_SIZE*.6)));}
 }
 desired*=Math.max(.22,Math.cos(Math.min(1.35,Math.abs(error))));
 let gap=Infinity;
 for(const other of others){
  if(other===car)continue;const dx=other.x-car.x,dz=other.z-car.z,ahead=dx*fx+dz*fz,lateral=Math.abs(dx*rx+dz*rz);
  if(ahead>-.5&&lateral<2.35)gap=Math.min(gap,ahead-4.5);
  // Crossing traffic: predict two seconds ahead; stable heading priority prevents symmetric yielding.
  const dist=Math.hypot(dx,dz);if(dist>5&&dist<14&&car.heading>other.heading){
   const rvx=other.vx-car.vx,rvz=other.vz-car.vz,rv2=rvx*rvx+rvz*rvz;
   const t=rv2>.01?clamp(-(dx*rvx+dz*rvz)/rv2,0,2):0;
   if(t>.15&&Math.hypot(dx+rvx*t,dz+rvz*t)<3.2)gap=Math.min(gap,dist-4.5);
  }
 }
 for(const wall of walls){
  if(wall.broken)continue;const dx=wall.x-car.x,dz=wall.z-car.z,ahead=dx*fx+dz*fz;
  if(ahead<0||ahead>30)continue;
  const lateral=Math.abs(dx*rx+dz*rz),halfSide=Math.abs(rx)*wall.w/2+Math.abs(rz)*wall.d/2;
  if(lateral<halfSide+1.15){const halfFront=Math.abs(fx)*wall.w/2+Math.abs(fz)*wall.d/2;gap=Math.min(gap,ahead-halfFront-2.25);}
 }
 if(gap<30)desired=Math.min(desired,Math.sqrt(2*4*Math.max(0,gap-1.6)));
 const throttle=clamp((desired-v)*.27,0,.85),brake=clamp((v-desired)*.24,0,1);
 const traveled=Math.hypot(car.x-plan.lastX,car.z-plan.lastZ);plan.lastX=car.x;plan.lastZ=car.z;
 if(traveled<dt*.12&&(throttle>.15||gap<1.6))plan.stuck+=dt;else plan.stuck=Math.max(0,plan.stuck-dt*2);
 if(plan.stuck>3.4){plan.reverseTime=1.6;plan.stuck=0;}
 if(plan.reverseTime>0){plan.reverseTime-=dt;return {throttle:0,brake:1,steer:steering>0?-.65:.65,handbrake:false,nitro:false,reverse:true};}
 return {throttle:gap<1.6?0:throttle,brake:gap<1.6?Math.max(.65,brake):brake,steer:steering,handbrake:false,nitro:false,reverse:false};
}
