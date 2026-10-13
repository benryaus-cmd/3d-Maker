const BASE_TUNE={mass:1320,power:8200,grip:1.05,brakeForce:11700,steerLock:.60,drag:.42,wheelbase:2.7,topSpeed:49,durability:100};
/** Authoritative live test values. Defaults are captured before saved test overrides. */
export type TuneField={key:string;label:string;group:string;defaultValue:number;min:number;max:number;step:number};
export const fields:TuneField[]=[];
const bindings=new Map<string,{get:()=>number;set:(v:number)=>void}>(),listeners=new Set<()=>void>();
const KEY='blacktop-live-test-v1';let saved:Record<string,number>={};
try{const raw=JSON.parse(globalThis.localStorage?.getItem(KEY)??'{}');if(raw&&typeof raw==='object')saved=raw;}catch{}
const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
export function registerTuningObject(group:string,prefix:string,object:object,defaults:object=object,exclude:readonly string[]=[]){
 const obj=object as Record<string,number|boolean>,base=defaults as Record<string,number|boolean>;
 for(const name of Object.keys(obj)){
  if(exclude.includes(name))continue;
  if(typeof obj[name]!=='number'&&typeof obj[name]!=='boolean')continue;
  const key=prefix+'.'+name,bool=typeof obj[name]==='boolean',value=Number(base[name]);
  const existing=fields.find(f=>f.key===key);
  const field=existing??{key,label:label(name),group,defaultValue:value,min:bool?0:value<0?value:0,max:bool?1:Math.max(10,value*20),step:bool||Number.isInteger(value)?1:.001};
  if((prefix.startsWith('car.')&&['mass','durability'].includes(name))||(prefix.startsWith('business.')&&name==='period'))field.min=1;if((prefix.startsWith('car.')&&name==='wheelbase')||(prefix.startsWith('scenery.')&&name==='mass'))field.min=.01;if(prefix==='live'&&['throttleRise','throttleFall','brakeResponse','steerResponse','speedZoomScale','stickRadius'].includes(name))field.min=.001;
  if(/Deadzone/.test(name)){field.min=0;field.max=1;field.step=.01;}if(/Sensitivity|CollisionScale|HalfWidth|HalfLength/.test(name))field.step=.01;
  if(prefix==='preferences'&&!bool){field.step=.01;if(name==='combatVolume'||name==='shake'){field.min=0;field.max=1;}if(name==='cameraScale'){field.min=.05;field.max=10;}}
  if(key.startsWith('live.')){if(/Volume|Light|Glow|Power|exposure|Zoom|LookAhead|Smoothing|Response|Rate|Speed|Falloff|selfAlign|Seconds|Hold|Fade/.test(name))field.step=.01;if(/Volume|Light|Glow|shadows|invulnerable|Count|clockSpeed|economySpeed|empireSpeed|policeSpeed|LookAhead|speedZoomRange/.test(name))field.min=0;if(name==='clockOverride'){field.min=-1;field.max=24;field.step=.1;}if(name==='cameraPitch'){field.min=-1;field.max=89;field.step=.1;}if(name==='cameraHeading'){field.min=-1;field.max=360;field.step=.1;}if(name==='pixelRatio'){field.min=.25;field.max=4;field.step=.05;}if(name==='shadows'||name==='invulnerable'){field.max=1;field.step=1;}if(name.includes('Count')){field.max=name==='trafficCount'?50:100;field.step=1;}}
  if(!existing)fields.push(field);
  bindings.set(key,{get:()=>Number(obj[name]),set:v=>obj[name]=bool?v>=.5:v});
  if(Number.isFinite(saved[key]))bindings.get(key)!.set(Math.max(field.min,Math.min(field.max,field.step===1?Math.round(saved[key]):saved[key])));
 }
}
const flush=()=>{saved=getTuning();try{globalThis.localStorage?.setItem(KEY,JSON.stringify(saved));}catch{}listeners.forEach(fn=>fn());};
export function getTuning(){return Object.fromEntries([...bindings].map(([key,b])=>[key,b.get()]));}
export function setTuning(key:string,value:number){const f=fields.find(f=>f.key===key);if(!f||!Number.isFinite(value))return;bindings.get(key)!.set(Math.max(f.min,Math.min(f.max,f.step===1?Math.round(value):value)));flush();}
export function resetTuning(key?:string){for(const f of fields)if(!key||f.key===key)bindings.get(f.key)!.set(f.defaultValue);flush();}
export function subscribeTuning(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function tuningJSON(){return JSON.stringify({version:'blacktop-live-test-v1',game:'BLACKTOP EMPIRE',settings:getTuning()},null,2);}
export const LIVE={
 cameraFollow:5,cameraTurnRate:.95,cameraTurnSmoothing:2.2,cameraZoomSmoothing:2.8,
 drivingHeight:40,drivingDistance:28,walkingHeight:25,walkingDistance:20,interiorHeight:20,interiorDistance:16,
 drivingZoom:1.22,walkingZoom:2.3,interiorZoom:1.52,speedZoomRange:.22,speedZoomScale:55,
 cameraPitch:-1,cameraHeading:-1,cameraFar:400,drivingLookAhead:3.5,walkingLookAhead:1.4,speedLookAhead:.12,maxLookAhead:6,
 exposure:1,ambientLight:1,sunLight:1,streetLight:18,windowGlow:.85,streetGlow:.23,
 pixelRatio:1.65,shadows:1,clockSpeed:72,clockOverride:-1,
 walkSpeed:5,interiorWalkSpeed:4.6,steeringSensitivity:1,stickRadius:.32,stickDeadzone:.08,aimDeadzone:.18,aimAssistAngle:.18,carHalfWidth:1.1,carHalfLength:2.25,wallCollisionScale:1,propCollisionScale:1,trafficCount:10,pedestrianCount:24,maxPeople:32,maxRivals:8,retiredLifetime:12,
 engineVolume:1,skidVolume:1,sirenVolume:1,crashVolume:1,
 incomingFootDamage:.45,incomingCarDamage:.35,carBulletDamage:.55,invulnerable:0,
 economySpeed:1,empireSpeed:1,policeSpeed:1,
 throttleRise:.18,throttleFall:.09,brakeResponse:.10,steerResponse:.13,steerSpeedFalloff:.028,selfAlign:.7,
 headlightBeam:.34,headlightGlow:2.4,tailGlow:1.3,brakeGlow:3.8,headlightPower:48,
 policeSight:65,arrestRange:5.5,arrestSpeed:3.5,arrestSeconds:3.3,searchSeconds:18,cooldownSeconds:8,
 skidHold:10,skidFade:10,
};
const groups:Record<string,string>={};
for(const k of Object.keys(LIVE))groups[k]=/^camera|Height$|Distance$|Zoom|LookAhead/.test(k)?'Camera':/Light|Glow|headlight|tailGlow|brakeGlow|exposure/.test(k)?'Lighting':/Volume/.test(k)?'Audio':/Response|throttle|brakeResponse|steerSpeed|selfAlign/.test(k)?'Driving response':/police|arrest|search|cooldown/.test(k)?'Police':/clock/.test(k)?'Time of day':/pixel|shadows|Count/.test(k)?'Performance':/skidHold|skidFade/.test(k)?'Skid marks':'Gameplay';
for(const [name,group]of Object.entries(groups)){const proxy={get [name](){return (LIVE as any)[name];},set [name](v:number){(LIVE as any)[name]=v;}};registerTuningObject(group,'live',proxy);}
for(const f of fields){if(f.key==='live.clockOverride'){f.min=-1;f.max=24;f.step=.1;}if(f.key==='live.pixelRatio'){f.min=.25;f.max=4;f.step=.05;}if(f.key==='live.shadows'||f.key==='live.invulnerable'){f.min=0;f.max=1;f.step=1;}if(f.key.includes('Count')){f.min=0;f.max=f.key.includes('traffic')?50:100;}}
export const CAR_TUNES:Record<string,Record<string,number>>={
 sedan:{power:6900,topSpeed:40,grip:.99,mass:1380},
 'sedan-sports':{power:12700,topSpeed:59,grip:1.22,mass:1180},
 police:{power:11000,topSpeed:52,grip:1.16,mass:1480,durability:150},
 taxi:{power:6600,topSpeed:38,mass:1430},
 suv:{power:9100,topSpeed:43,mass:2030,durability:160,grip:.9},
 race:{power:16000,topSpeed:68,grip:1.34,mass:1030,durability:85}
};

for(const [style,tune]of Object.entries(CAR_TUNES)){CAR_TUNES[style]={...BASE_TUNE,...tune};registerTuningObject('Vehicle '+style,'car.'+style,CAR_TUNES[style]);}
