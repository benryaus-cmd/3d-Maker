import {GOODS,MARKETS,createEconomy,restoreEconomy,validEconomyHeader,syncCargo,switchCargo,emptyGoods,requestTrade,type EconomyState,type Quantities,type TradeContext,marketQuote,nextTradeId} from './Economy.ts';
export {GOODS,MARKETS,type Commodity,type Market} from './Economy.ts';
export type CarStyle='sedan'|'sedan-sports'|'police'|'taxi'|'suv'|'race';
export type Mods={engine:number;tires:number;brakes:number;armor:number};
export type Damage={front:number;rear:number;left:number;right:number};
export type VehicleBuild={mods:Mods;paint:number;spoiler:boolean;neon:boolean;hp:number;damage:Damage};
const CARS:CarStyle[]=['sedan','sedan-sports','police','taxi','suv','race'];
const KEY='blacktop-empire-save-v2',BACKUP=KEY+'-backup',LEGACY=KEY+'-legacy';
const safeNumber=(v:unknown,fallback:number,min=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const level=(v:unknown)=>Math.floor(safeNumber(v,0,0,3));
const initialMods=():Mods=>({engine:0,tires:0,brakes:0,armor:0});
const defaultVehicleBuild=():VehicleBuild=>({mods:initialMods(),paint:0xd45f3d,spoiler:false,neon:false,hp:100,damage:{front:0,rear:0,left:0,right:0}});
export function activeBuild(s:GameSave,car:CarStyle=s.car):VehicleBuild{
 if(!s.builds)s.builds={};return s.builds[car]??(s.builds[car]=defaultVehicleBuild());
}
export type GameSave={version:3;money:number;bank:number;heat:number;mode:'campaign'|'freeroam';mission:number;missionStep:number;
 x:number;z:number;heading:number;car:CarStyle;carHP:number;carDamage:Damage;owned:CarStyle[];mods:Mods;builds:Partial<Record<CarStyle,VehicleBuild>>;garageLevel:number;houseLevel:number;stash:number;cargo:Quantities;economy:EconomyState;lastSave:number;day:number;completed:number[]};
export function initial():GameSave{
 const s:GameSave={version:3,money:1200,bank:0,heat:0,mode:'campaign',mission:0,missionStep:0,x:0,z:0,heading:0,
 car:'sedan',carHP:100,carDamage:{front:0,rear:0,left:0,right:0},owned:['sedan'],mods:initialMods(),builds:{sedan:defaultVehicleBuild()},garageLevel:0,houseLevel:0,stash:0,cargo:emptyGoods(),economy:createEconomy(),lastSave:Date.now(),day:1,completed:[]};
 syncCargo(s);return s;
}
function decodeSave(text:string|null):GameSave|null{
 try{
  const raw=JSON.parse(text??'null');if(!raw||![2,3].includes(raw.version)||!Number.isFinite(raw.money)||!Number.isFinite(raw.x)||!Number.isFinite(raw.z))return null;
  if(raw.version===3&&!validEconomyHeader(raw.economy))return null;
  const s=initial();const owned=Array.isArray(raw.owned)?raw.owned.filter((v:CarStyle)=>CARS.includes(v)):['sedan'];
  s.owned=owned.length?[...new Set(owned)] as CarStyle[]:['sedan'];s.car=CARS.includes(raw.car)&&s.owned.includes(raw.car)?raw.car:s.owned[0];
  if(raw.version===3&&!raw.economy.inventories['vehicle:'+s.car])return null;
  for(const car of CARS){const old=raw.builds?.[car]??(car===s.car?{mods:raw.mods,hp:raw.carHP,damage:raw.carDamage}:null);if(!old)continue;
   const b=defaultVehicleBuild();for(const k of Object.keys(b.mods) as (keyof Mods)[])b.mods[k]=level(old.mods?.[k]);
   for(const k of Object.keys(b.damage) as (keyof Damage)[])b.damage[k]=safeNumber(old.damage?.[k],0,0,1);
   b.hp=safeNumber(old.hp,100,0,100);b.paint=Math.floor(safeNumber(old.paint,b.paint,0,0xffffff));b.neon=!!old.neon;b.spoiler=!!old.spoiler;s.builds[car]=b;
  }
  const b=activeBuild(s);s.mods={...b.mods};s.carHP=b.hp;s.carDamage={...b.damage};
  s.money=safeNumber(raw.money,1200);s.bank=safeNumber(raw.bank,0);s.heat=safeNumber(raw.heat,0,0,5);
  s.x=safeNumber(raw.x,0,-187.5,187.5);s.z=safeNumber(raw.z,0,-187.5,187.5);s.heading=safeNumber(raw.heading,0,-Math.PI*2,Math.PI*2);
  s.mode=raw.mode==='freeroam'?'freeroam':'campaign';s.mission=Math.floor(safeNumber(raw.mission,0,0,5));s.missionStep=Math.floor(safeNumber(raw.missionStep,0,0,4));
  s.completed=Array.isArray(raw.completed)?[...new Set(raw.completed.filter((n:number)=>Number.isInteger(n)&&n>=0&&n<5))] as number[]:[];
  s.garageLevel=level(raw.garageLevel);s.houseLevel=level(raw.houseLevel);s.stash=safeNumber(raw.stash,0);s.lastSave=safeNumber(raw.lastSave,0);
  s.economy=restoreEconomy(raw.version===3?raw.economy:null,raw.cargo??{},s.car);syncCargo(s);s.day=1+Math.floor(s.economy.seconds/1200);
  return s;
 }catch{return null;}
}
export function readSave():GameSave{
 try{for(const key of [KEY,BACKUP,LEGACY]){const s=decodeSave(localStorage.getItem(key));if(s)return s;}}catch(e){console.warn('Saving unavailable',e);}
 return initial();
}
export function saveGame(s:GameSave):boolean{
 try{
  syncCargo(s);const serialized=JSON.stringify({...s,lastSave:Date.now()});
  if(!decodeSave(serialized))return false;
  const previous=localStorage.getItem(KEY);
  if(previous&&decodeSave(previous)){
   if(JSON.parse(previous).version===2&&!localStorage.getItem(LEGACY))localStorage.setItem(LEGACY,previous);
   // Save backup first; a failed primary write leaves either intact primary or prior backup.
   localStorage.setItem(BACKUP,previous);
  }
  localStorage.setItem(KEY,serialized);return true;
 }catch(e){console.warn('Saving unavailable',e);return false;}
}
export function cargoCount(s:GameSave){return Object.values(s.cargo).reduce((n,v)=>n+v,0);}
export function cargoCap(s:GameSave){return 12+12*s.garageLevel;}
/** Compatibility facade; every caller must supply the real contact context. */
export function trade(s:GameSave,market:string,good:import('./Economy.ts').Commodity,qty:number,context:TradeContext){
 const quote=marketQuote(s.economy,market,good);return requestTrade(s,{market,good,qty,id:nextTradeId(s.economy),quoteId:quote?.id??''},context);
}
export function bankMoney(s:GameSave,amount:number,atSafehouse:boolean):{ok:boolean;text:string}{
 if(!atSafehouse)return {ok:false,text:'USE THE SAFEHOUSE BANK'};
 if(!Number.isInteger(amount)||!amount)return {ok:false,text:'CHOOSE A CASH AMOUNT'};
 if(amount>0&&s.money<amount)return {ok:false,text:'NOT ENOUGH CASH'};
 if(amount<0&&s.bank<-amount)return {ok:false,text:'NOT ENOUGH BANKED CASH'};
 if(s.bank+amount>1e9||s.money-amount>1e9)return {ok:false,text:'BALANCE LIMIT REACHED'};
 s.money-=amount;s.bank+=amount;return {ok:true,text:`${amount>0?'BANKED':'WITHDREW'} $${Math.abs(amount)}`};
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
 if(s.owned.includes(car)){switchCargo(s,car);s.mods={...activeBuild(s,car).mods};return {ok:true,text:'VEHICLE SELECTED'};}
 if(s.money<costs[car])return {ok:false,text:'NOT ENOUGH CASH · $'+costs[car]};
 s.money-=costs[car];s.owned.push(car);switchCargo(s,car);s.mods={...activeBuild(s,car).mods};return {ok:true,text:'PURCHASED '+car.toUpperCase()};
}

