export type CarStyle='sedan'|'sedan-sports'|'police'|'taxi'|'suv'|'race';
export type Commodity='Ember'|'Glitch'|'Velvet'|'Crown';
export const GOODS:Commodity[]=['Ember','Glitch','Velvet','Crown'];
export const MARKETS=[
 {id:'port',name:'PORT MARKET',x:-120,z:-120},
 {id:'club',name:'NEON CLUB',x:120,z:0},
 {id:'yard',name:'INDUSTRIAL YARD',x:0,z:-120},
 {id:'tower',name:'FINANCIAL BROKER',x:0,z:120},
 {id:'hills',name:'HILLS CONTACT',x:-120,z:120},
 {id:'gardens',name:'GARDENS EXCHANGE',x:120,z:120},
 {id:'quarter',name:'OLD QUARTER MARKET',x:-120,z:0},
 {id:'midtown',name:'MIDTOWN DEALER',x:0,z:30},
 {id:'market',name:'MARKET WARD',x:120,z:-120}
];
export type Market=typeof MARKETS[number];
export type Mods={engine:number;tires:number;brakes:number;armor:number};
export type Damage={front:number;rear:number;left:number;right:number};
export type VehicleBuild={mods:Mods;paint:number;spoiler:boolean;neon:boolean;hp:number;damage:Damage};
const defaultVehicleBuild=():VehicleBuild=>({mods:{engine:0,tires:0,brakes:0,armor:0},paint:0xd45f3d,spoiler:false,neon:false,hp:100,damage:{front:0,rear:0,left:0,right:0}});
export function activeBuild(s:GameSave,car:CarStyle=s.car):VehicleBuild{
 if(!s.builds)s.builds={};
 return s.builds[car]??(s.builds[car]=defaultVehicleBuild());
}
export type GameSave={version:2;money:number;bank:number;heat:number;mode:'campaign'|'freeroam';mission:number;missionStep:number;
 x:number;z:number;heading:number;car:CarStyle;carHP:number;carDamage:Damage;owned:CarStyle[];mods:Mods;builds:Partial<Record<CarStyle,VehicleBuild>>;garageLevel:number;houseLevel:number;stash:number;cargo:Record<Commodity,number>;lastSave:number;day:number;completed:number[]};
const key='blacktop-empire-save-v2';
const initialCargo=():Record<Commodity,number>=>({Ember:0,Glitch:0,Velvet:0,Crown:0});
const initialMods=():Mods=>({engine:0,tires:0,brakes:0,armor:0});
export function initial():GameSave{return {version:2,money:1200,bank:0,heat:0,mode:'campaign',mission:0,missionStep:0,x:0,z:0,heading:0,
 car:'sedan',carHP:100,carDamage:{front:0,rear:0,left:0,right:0},owned:['sedan'],mods:initialMods(),builds:{sedan:defaultVehicleBuild()},garageLevel:0,houseLevel:0,stash:0,cargo:initialCargo(),lastSave:Date.now(),day:1,completed:[]};}
export function readSave():GameSave{
 try{const s=JSON.parse(localStorage.getItem(key)||'null') as Partial<GameSave>;
  if(!s||s.version!==2||!Number.isFinite(s.money)||!Number.isFinite(s.x)||!Number.isFinite(s.z))return initial();
  const def=initial(),owned=s.owned?.filter(x=>['sedan','sedan-sports','police','taxi','suv','race'].includes(x))??def.owned;
  const builds:Partial<Record<CarStyle,VehicleBuild>>={};
  const cars=['sedan','sedan-sports','police','taxi','suv','race'] as CarStyle[];
  for(const car of cars){
   const old=s.builds?.[car];
   if(!old)continue;
   const build=defaultVehicleBuild();
   builds[car]={...build,...old,
    hp:Math.max(0,Math.min(100,Number(old.hp)||0)),
    paint:Number.isInteger(old.paint)&&old.paint>=0&&old.paint<=0xffffff?old.paint:build.paint,
    spoiler:!!old.spoiler,neon:!!old.neon,
    mods:Object.fromEntries(Object.keys(build.mods).map(key=>[key,Math.max(0,Math.min(3,Math.floor(Number(old.mods?.[key as keyof Mods])||0)))])) as Mods,
    damage:Object.fromEntries(Object.keys(build.damage).map(key=>[key,Math.max(0,Math.min(1,Number(old.damage?.[key as keyof Damage])||0))])) as Damage};
  }
  // A save from the earlier prototype used global mods / condition; upgrade it once.
  const selected=(s.car??'sedan') as CarStyle;
  if(!builds[selected])builds[selected]={...defaultVehicleBuild(),mods:{...def.mods,...s.mods},
   hp:Number.isFinite(s.carHP)?Math.max(0,Math.min(100,s.carHP!)):100,
   damage:{...def.carDamage,...s.carDamage}};
  const active=builds[selected]!;
  return {...def,...s,owned:owned.length?owned:def.owned,mods:{...active.mods},builds,cargo:{...def.cargo,...s.cargo},completed:Array.isArray(s.completed)?s.completed:[],
   carHP:Number.isFinite(s.carHP)?Math.max(0,Math.min(100,s.carHP!)):100,
   carDamage:Object.fromEntries((['front','rear','left','right'] as const).map(k=>[k,Math.max(0,Math.min(1,Number(s.carDamage?.[k])||0))])) as GameSave['carDamage'],
   money:Math.max(0,Math.min(1e9,s.money)),heat:Math.max(0,Math.min(5,s.heat??0)),stash:Math.max(0,s.stash??0)};
 }catch{return initial();}
}
export function saveGame(s:GameSave){try{localStorage.setItem(key,JSON.stringify({...s,lastSave:Date.now()}));}catch(e){console.warn('Saving unavailable',e);}}
export function cargoCount(s:GameSave){return GOODS.reduce((n,k)=>n+s.cargo[k],0);}
export function cargoCap(s:GameSave){return 12+12*s.garageLevel;}
function hash(x:number){x=Math.imul((x^61),2654435761);x=Math.imul(x^(x>>>15),1|x);return ((x^(x>>>14))>>>0)/4294967296;}
export function quote(marketId:string,good:Commodity,clock:number){
 const mk=Math.max(0,MARKETS.findIndex(m=>m.id===marketId));
 const base=({Ember:60,Glitch:105,Velvet:170,Crown:280})[good];
 const idx=GOODS.indexOf(good),day=Math.floor(clock/75);
 const bias=[1.30,.67,1.1,.86][(mk+idx)%4];
 const swing=.74+hash(day*41+mk*97+idx*9)*.59;
 return Math.max(5,Math.round(base*bias*swing));
}
export function trade(s:GameSave,marketId:string,good:Commodity,qty:number,clock:number):{ok:boolean;text:string}{
 const price=quote(marketId,good,clock);qty=Math.trunc(qty);
 if(!qty||Math.abs(qty)>20)return {ok:false,text:'INVALID QUANTITY'};
 if(qty>0){
  if(cargoCount(s)+qty>cargoCap(s))return {ok:false,text:'BOOT FULL · UPGRADE GARAGE STORAGE'};
  if(s.money<price*qty)return {ok:false,text:'NOT ENOUGH CASH'};
  s.money-=price*qty;s.cargo[good]+=qty;return {ok:true,text:`BOUGHT ${qty} ${good.toUpperCase()} · $${price*qty}`};
 }
 if(s.cargo[good]<-qty)return {ok:false,text:'NOT ENOUGH STOCK'};
 s.cargo[good]+=qty;s.money+=price*(-qty);
 return {ok:true,text:`SOLD ${-qty} ${good.toUpperCase()} · +$${price*-qty}`};
}
export const MISSIONS=[
 {title:'LAST $200',brief:'Get to your Midtown safehouse.',reward:400,marker:'safehouse'},
 {title:'HOT DELIVERY',brief:'Pick up the package at Port Market, drop it at Neon Club.',reward:750,marker:'port'},
 {title:'BURN RUBBER',brief:'Win the Midtown street circuit.',reward:950,marker:'race'},
 {title:'BLUE LIGHT SPECIAL',brief:'Get police attention, then lose the pursuit.',reward:1300,marker:'chase'},
 {title:'THE TAKE',brief:'Secure the industrial pickup and deliver it Uptown.',reward:2250,marker:'yard'}
] as const;
export function missionMarker(s:GameSave):{x:number;z:number;label:string}|null{
 if(s.mode==='freeroam'||s.mission>=MISSIONS.length)return null;
 if(s.mission===0)return {x:7,z:7,label:'SAFEHOUSE'};
 if(s.mission===1){const m=MARKETS.find(m=>m.id===(s.missionStep===0?'port':'club'))!;return {...m,label:s.missionStep===0?'PICK UP':'DELIVER'};}
 if(s.mission===2){const checkpoints=[[0,0],[32,0],[32,-32],[0,-32]];const [x,z]=checkpoints[Math.min(s.missionStep,3)];return {x,z,label:'RACE '+(s.missionStep+1)+'/4'};}
 if(s.mission===3)return {x:0,z:0,label:s.missionStep?'ESCAPE THE POLICE':'GET WANTED'};
 if(s.mission===4){const m=MARKETS.find(m=>m.id===(s.missionStep===0?'yard':'tower'))!;return {...m,label:s.missionStep===0?'TAKE THE PACKAGE':'FINANCIAL DELIVERY'};}
 return null;
}
export function missionUpdate(s:GameSave,x:number,z:number,heat:number):string|null{
 if(s.mode!=='campaign'||s.mission>=MISSIONS.length)return null;
 const mission=s.mission,m=missionMarker(s);
 let advance=false;
 if(mission===3){
  if(s.missionStep===0&&heat>=2)advance=true;
  if(s.missionStep===1&&heat<.25)advance=true;
 }else if(m&&Math.hypot(x-m.x,z-m.z)<6)advance=true;
 if(!advance)return null;
 const done=mission===0||mission===1&&s.missionStep===1||mission===2&&s.missionStep===3||mission===3&&s.missionStep===1||mission===4&&s.missionStep===1;
 if(done){s.money+=MISSIONS[mission].reward;s.completed.push(mission);s.mission++;s.missionStep=0;return 'MISSION COMPLETE · +$'+MISSIONS[mission].reward;}
 s.missionStep++;return mission===1?'PACKAGE SECURED · REACH NEON CLUB':mission===2?'CHECKPOINT '+s.missionStep+'/4':'OBJECTIVE UPDATED';
}
export function buyUpgrade(s:GameSave,key: keyof Mods|'house'|'garage'):{ok:boolean;text:string}{
 const build=activeBuild(s),level=key==='house'?s.houseLevel:key==='garage'?s.garageLevel:build.mods[key];
 if(level>=3)return {ok:false,text:'MAX LEVEL'};
 const cost=(key==='house'?550:key==='garage'?650:350)*(level+1);
 if(s.money<cost)return {ok:false,text:'NOT ENOUGH CASH · $'+cost};
 s.money-=cost;if(key==='house')s.houseLevel++;else if(key==='garage')s.garageLevel++;else {build.mods[key]++;s.mods[key]=build.mods[key];}
 return {ok:true,text:key.toUpperCase()+' UPGRADED · $'+cost};
}
export function buyCar(s:GameSave,car:CarStyle):{ok:boolean;text:string}{
 const costs:Record<CarStyle,number>={sedan:800,'sedan-sports':5500,police:9000,taxi:1700,suv:3800,race:11000};
 if(s.owned.includes(car)){s.car=car;s.mods={...activeBuild(s,car).mods};return {ok:true,text:'VEHICLE SELECTED'};}
 if(s.money<costs[car])return {ok:false,text:'NOT ENOUGH CASH · $'+costs[car]};
 s.money-=costs[car];s.owned.push(car);s.car=car;s.mods={...activeBuild(s,car).mods};return {ok:true,text:'PURCHASED '+car.toUpperCase()};
}

