/** Active-time empire domain. Wallet changes commit only after all world checks pass. */
import type {Commodity, Quantities, EconomyState} from './Economy.ts';
export type FactionId='breakwater'|'velvet'|'ashline'|'crown';
export const FACTIONS=[
 {id:'breakwater' as const,name:'Breakwater Union',leader:'Mara Voss',district:'Dockside',color:'#53b6c4',business:'Freight',vehicle:'Utility vans',tactic:'Convoy roadblocks'},
 {id:'velvet' as const,name:'Velvet Circuit',leader:'Inez Vale',district:'Neon Strip',color:'#bc79dc',business:'Nightlife',vehicle:'Sports coupes',tactic:'Fast flanking pairs'},
 {id:'ashline' as const,name:'Ashline Crew',leader:'Dax Flint',district:'Industrial Yard',color:'#e88744',business:'Parts resale',vehicle:'Armoured pickups',tactic:'Close range ambush'},
 {id:'crown' as const,name:'Crown Syndicate',leader:'Leon Crest',district:'Financial District',color:'#dbbd66',business:'Luxury brokerage',vehicle:'Executive sedans',tactic:'Disciplined ranged guards'}
];
export type Point={x:number;z:number};
export type ContractDefinition={id:string;title:string;giver:Point;destination:Point;contact:string;brief:string;kind:'delivery'|'clearance'|'takeover';faction:FactionId;reward:number;maxHeat:number;seconds:number;cooldown:number;good?:Commodity;quantity?:number;requires?:string;enemyCount?:number;territory?:string;respectRequired?:{faction:FactionId;min:number}};
export const CONTRACTS:ContractDefinition[]=[
 {id:'midtown-courier',title:'FIRST RUN',giver:{x:0,z:30},destination:{x:-120,z:0},contact:'Mara Voss',brief:'Buy 1 Ember at Midtown. Carry it to Old Quarter; the buyer pays for the cargo and your run.',kind:'delivery',faction:'breakwater',reward:210,maxHeat:2,seconds:420,cooldown:90,good:'Ember',quantity:1},
 {id:'dockside-freight',title:'FREIGHT FAVOUR',giver:{x:-120,z:-120},destination:{x:120,z:0},contact:'Inez Vale',brief:'Carry 2 Glitch from Port Market to Neon Club. Arrive below heat 3.',kind:'delivery',faction:'velvet',reward:460,maxHeat:3,seconds:540,cooldown:150,respectRequired:{faction:'breakwater',min:8},good:'Glitch',quantity:2},
 {id:'ashline-ambush',title:'BREAK THE AMBUSH',giver:{x:0,z:30},destination:{x:0,z:-120},contact:'Mara Voss',brief:'Clear the three Ashline rivals at the Industrial Yard. Their income disruption unlocks the Midtown block.',kind:'clearance',faction:'breakwater',reward:360,maxHeat:4,seconds:600,cooldown:0,enemyCount:3},
 {id:'midtown-takeover',title:'TAKE THE BLOCK',giver:{x:0,z:-12},destination:{x:30,z:-30},contact:'Mara Voss',brief:'After disrupting Ashline, defeat the two block guards. Ownership faces an announced counterattack after five active minutes.',kind:'takeover',faction:'breakwater',reward:280,maxHeat:4,seconds:480,cooldown:0,requires:'ashline-ambush',enemyCount:2,territory:'midtown-block'}
];
export const BUSINESSES=[{id:'midtown-garage',name:'MIDTOWN MOTOR WORKS',x:0,z:-12,price:900,upgradeCost:500,cap:240,fee:15,period:60,netPerPeriod:35}];
export type ActiveContract={id:string;instanceId:string;stage:'travel'|'ready';beganAt:number;deadline:number;encounterSeen:boolean;maxEnemiesSeen:number};
export type BusinessState={owned:boolean;level:number;accrued:number;incomeSeconds:number};
export type TerritoryState={status:'rival'|'owned'|'contested';influence:number;nextAttack:number;responseUntil:number;defenceSeen:boolean};
export type EmpireState={version:1;seconds:number;sequence:number;streetReputation:number;relations:Record<FactionId,{respect:number;hostility:number}>;businesses:Record<string,BusinessState>;territories:Record<string,TerritoryState>;active:ActiveContract|null;completed:string[];cooldowns:Record<string,number>;events:string[];ledger:{at:number;text:string;amount:number}[]};
export type EmpireAccount={money:number;cargo:Quantities;empire:EmpireState;economy?:EconomyState;car?:string};
export type EmpireContext=Point&{heat:number;remainingEnemies?:number;encounterTag?:string;alive?:boolean;cargoAccessible?:boolean};
export type EmpireResult={ok:boolean;text:string;consumedGood?:Commodity;quantity?:number;instanceId?:string;spawnEnemies?:number;encounterTag?:string};
const clamp=(v:unknown,f=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,v)):f;
const near=(p:Point,c:EmpireContext)=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&Math.hypot(c.x-p.x,c.z-p.z)<=8;
const result=(ok:boolean,text:string):EmpireResult=>({ok,text});
export function createEmpire():EmpireState{return {version:1,seconds:0,sequence:0,streetReputation:0,relations:Object.fromEntries(FACTIONS.map(f=>[f.id,{respect:0,hostility:0}])) as EmpireState['relations'],businesses:{'midtown-garage':{owned:false,level:0,accrued:0,incomeSeconds:0}},territories:{'midtown-block':{status:'rival',influence:0,nextAttack:0,responseUntil:0,defenceSeen:false}},active:null,completed:[],cooldowns:{},events:[],ledger:[]};}
export function restoreEmpire(raw:unknown):EmpireState{
 const e=createEmpire(),r=raw as EmpireState;if(!r||r.version!==1)return e;
 e.seconds=clamp(r.seconds);e.sequence=Math.floor(clamp(r.sequence));e.streetReputation=clamp(r.streetReputation,0,100);
 for(const f of FACTIONS){e.relations[f.id]={respect:clamp(r.relations?.[f.id]?.respect,0,100),hostility:clamp(r.relations?.[f.id]?.hostility,0,100)};}
 for(const b of BUSINESSES){const v=r.businesses?.[b.id];if(v)e.businesses[b.id]={owned:v.owned===true,level:Math.floor(clamp(v.level,0,3)),accrued:clamp(v.accrued,0,b.cap),incomeSeconds:clamp(v.incomeSeconds,0,b.period)};}
 const t=r.territories?.['midtown-block'];if(t)e.territories['midtown-block']={status:['rival','owned','contested'].includes(t.status)?t.status:'rival',influence:clamp(t.influence,0,100),nextAttack:clamp(t.nextAttack),responseUntil:clamp(t.responseUntil),defenceSeen:t.defenceSeen===true};
 e.completed=Array.isArray(r.completed)?[...new Set(r.completed.filter(id=>CONTRACTS.some(j=>j.id===id)))]:[];
 for(const j of CONTRACTS)e.cooldowns[j.id]=clamp(r.cooldowns?.[j.id]);
 // Preserve absence of untouched cooldown keys for stable migrations.
 for(const j of CONTRACTS)if(!r.cooldowns?.[j.id])delete e.cooldowns[j.id];
 e.events=Array.isArray(r.events)?r.events.filter(id=>typeof id==='string'&&id.length<160).slice(-512):[];
 e.ledger=Array.isArray(r.ledger)?r.ledger.filter(l=>l&&typeof l.text==='string'&&Number.isFinite(l.amount)&&Number.isFinite(l.at)).slice(-24):[];
 const a=r.active;if(a&&CONTRACTS.some(j=>j.id===a.id)&&typeof a.instanceId==='string'&&a.instanceId.length<160&&a.deadline>e.seconds)e.active={id:a.id,instanceId:a.instanceId,stage:a.stage==='ready'?'ready':'travel',beganAt:clamp(a.beganAt),deadline:clamp(a.deadline),encounterSeen:a.encounterSeen===true,maxEnemiesSeen:Math.floor(clamp(a.maxEnemiesSeen,0,20))};
 return e;
}
const log=(e:EmpireState,text:string,amount=0)=>{e.ledger.push({at:e.seconds,text,amount});if(e.ledger.length>24)e.ledger.shift();};
export function recordFactionEvent(e:EmpireState,event:{id:string;faction:FactionId;kind:'trade'|'harm'|'contract'|'betrayal';witnessed:boolean}):boolean{
 if(!event.witnessed||!event.id||event.id.length>159||e.events.includes(event.id)||!e.relations[event.faction])return false;
 e.events.push(event.id);if(e.events.length>512)e.events.shift();const r=e.relations[event.faction];
 if(event.kind==='harm'||event.kind==='betrayal'){r.hostility=Math.min(100,r.hostility+(event.kind==='harm'?6:15));r.respect=Math.max(0,r.respect-3);}else{r.respect=Math.min(100,r.respect+(event.kind==='contract'?8:1));e.streetReputation=Math.min(100,e.streetReputation+(event.kind==='contract'?4:1));}
 return true;
}
export function tickEmpire(e:EmpireState,dt:number){
 if(!Number.isFinite(dt)||dt<=0)return;e.seconds+=Math.min(dt,300); // active simulation only; never use wall-clock timestamps
 for(const b of BUSINESSES){const s=e.businesses[b.id];if(!s.owned)continue;s.incomeSeconds+=Math.min(dt,300);const periods=Math.floor(s.incomeSeconds/b.period);s.incomeSeconds%=b.period;s.accrued=Math.min(b.cap,s.accrued+periods*(b.netPerPeriod+s.level*15));}
 const t=e.territories['midtown-block'];if(t.status==='owned'&&e.seconds>=t.nextAttack){t.status='contested';t.responseUntil=e.seconds+180;t.defenceSeen=false;log(e,'ASHLINE COUNTERATTACK · 180 active seconds to defend or delegate');}
 if(t.status==='contested'&&e.seconds>=t.responseUntil){t.status='rival';t.influence=40;log(e,'MIDTOWN BLOCK LOST · business remains yours');}
}
function cargo(s:EmpireAccount){return s.economy&&s.car?s.economy.inventories['vehicle:'+s.car]?.goods:s.cargo;}
export function beginContract(s:EmpireAccount,id:string,c:EmpireContext):EmpireResult{
 const e=s.empire,j=CONTRACTS.find(j=>j.id===id);if(!j)return result(false,'JOB UNAVAILABLE');if(e.active)return result(false,'FINISH OR ABANDON THE ACTIVE JOB');
 if(!near(j.giver,c))return result(false,'REACH THE CONTACT FIRST');if(c.alive===false||!Number.isFinite(c.heat)||c.heat>j.maxHeat)return result(false,'LOSE THE HEAT BEFORE TAKING WORK');
 if((j.cooldown===0&&e.completed.includes(id)&&!(j.territory&&e.territories[j.territory].status==='rival'))||(e.cooldowns[id]??0)>e.seconds)return result(false,'THIS CONTACT HAS NO NEW WORK YET');if(j.requires&&!e.completed.includes(j.requires))return result(false,'DISRUPT ASHLINE BEFORE TAKING THE BLOCK');
 if(j.respectRequired&&e.relations[j.respectRequired.faction].respect<j.respectRequired.min)return result(false,'EARN BREAKWATER RESPECT 8 · COMPLETE FIRST RUN');
 if(j.good&&(c.cargoAccessible===false||(cargo(s)?.[j.good]??0)<j.quantity!))return result(false,`BUY ${j.quantity} ${j.good.toUpperCase()} AT THE CONTACT FIRST`);
 const instanceId=`contract:${++e.sequence}:${id}`;e.active={id,instanceId,stage:'travel',beganAt:e.seconds,deadline:e.seconds+j.seconds,encounterSeen:false,maxEnemiesSeen:0};log(e,j.title+' ACCEPTED');
 return {ok:true,text:j.brief,instanceId,spawnEnemies:j.enemyCount,encounterTag:instanceId};
}
export function failContract(s:EmpireAccount,reason='ABANDONED'):EmpireResult{const a=s.empire.active;if(!a)return result(false,'NO ACTIVE JOB');const j=CONTRACTS.find(j=>j.id===a.id)!;s.empire.cooldowns[a.id]=s.empire.seconds+Math.max(15,j.cooldown/2);s.empire.active=null;log(s.empire,j.title+' · '+reason);return result(true,'JOB '+reason+' · RETURN TO THE CONTACT TO RETRY');}
export function updateContract(s:EmpireAccount,c:EmpireContext):EmpireResult|null{
 const a=s.empire.active;if(!a)return null;const j=CONTRACTS.find(j=>j.id===a.id)!;
 if(c.alive===false)return failContract(s,'FAILED · HOSPITAL');if(s.empire.seconds>=a.deadline)return failContract(s,'FAILED · TIME EXPIRED');
 if(!near(j.destination,c))return null;
 if(j.enemyCount){if(c.encounterTag!==undefined&&c.encounterTag!==a.instanceId)return null;if(Number.isInteger(c.remainingEnemies)&&c.remainingEnemies!>0){a.maxEnemiesSeen=Math.max(a.maxEnemiesSeen,c.remainingEnemies!);a.encounterSeen=a.maxEnemiesSeen>=j.enemyCount;}if(!a.encounterSeen||c.remainingEnemies!==0)return null;}
 if(c.heat>j.maxHeat)return result(false,'LOSE THE HEAT BEFORE HANDOFF');a.stage='ready';return result(true,'OBJECTIVE READY · CONFIRM THE HANDOFF');
}
export function completeContract(s:EmpireAccount,c:EmpireContext):EmpireResult{
 const e=s.empire,a=e.active;if(!a)return result(false,'NO ACTIVE JOB');const j=CONTRACTS.find(j=>j.id===a.id)!;
 if(a.stage!=='ready'||!near(j.destination,c)||e.seconds>=a.deadline||!Number.isFinite(c.heat)||c.heat>j.maxHeat||c.alive===false)return result(false,'COMPLETE THE OBJECTIVE AT ITS DESTINATION');
 if(j.enemyCount&&(!a.encounterSeen||c.remainingEnemies!==0||(c.encounterTag!==undefined&&c.encounterTag!==a.instanceId)))return result(false,'CLEAR ALL CONTRACT RIVALS FIRST');
 const reward=j.territory&&e.completed.includes(j.id)?0:j.reward;
 const inv=cargo(s);if(j.good&&(!inv||!Number.isInteger(inv[j.good])||inv[j.good]<j.quantity!||c.cargoAccessible===false))return result(false,'THE REQUIRED CARGO IS MISSING');if(!Number.isFinite(s.money)||s.money<0||s.money+reward>1e9)return result(false,'WALLET UNAVAILABLE');
 if(j.good){const n=j.quantity!,old=inv![j.good];inv![j.good]-=n;const inventory=s.economy&&s.car?s.economy.inventories['vehicle:'+s.car]:null;if(inventory)inventory.cost[j.good]=inv![j.good]===0?0:inventory.cost[j.good]===null?null:inventory.cost[j.good]!*(1-n/old);s.cargo={...inv!};}
 s.money+=reward;e.completed=[...new Set([...e.completed,j.id])];e.cooldowns[j.id]=e.seconds+j.cooldown;recordFactionEvent(e,{id:a.instanceId,faction:j.faction,kind:'contract',witnessed:true});
 if(j.kind==='clearance'){e.territories['midtown-block'].influence=60;recordFactionEvent(e,{id:a.instanceId+':rival',faction:'ashline',kind:'harm',witnessed:true});}
 if(j.territory)e.territories[j.territory]={status:'owned',influence:100,nextAttack:e.seconds+300,responseUntil:0,defenceSeen:false};e.active=null;log(e,j.title+' COMPLETE',reward);
 return {ok:true,text:`${j.title} COMPLETE · +$${reward}`,consumedGood:j.good,quantity:j.quantity};
}
export function contractMarker(e:EmpireState):(Point&{label:string})|null{const j=CONTRACTS.find(j=>j.id===e.active?.id);return j?{...j.destination,label:j.kind==='delivery'?'DELIVER '+j.good?.toUpperCase():j.title}:null;}
export function buyBusiness(s:EmpireAccount,id:string,c:EmpireContext):EmpireResult{const b=BUSINESSES.find(b=>b.id===id),v=s.empire.businesses[id];if(!b||!v)return result(false,'BUSINESS UNAVAILABLE');if(!near(b,c))return result(false,'VISIT THE GARAGE TO BUY');if(v.owned)return result(false,'ALREADY OWNED');if(!Number.isFinite(s.money)||s.money<b.price)return result(false,'NOT ENOUGH CASH');s.money-=b.price;v.owned=true;log(s.empire,b.name+' PURCHASED',-b.price);return result(true,'GARAGE OWNED · REPAIRS 20% CHEAPER · ACTIVE INCOME $35/MIN');}
export function upgradeBusiness(s:EmpireAccount,id:string,c:EmpireContext):EmpireResult{const b=BUSINESSES.find(b=>b.id===id),v=s.empire.businesses[id];if(!b||!v?.owned||!near(b,c))return result(false,'VISIT YOUR OWNED GARAGE');if(v.level>=3)return result(false,'GARAGE FULLY UPGRADED');const price=b.upgradeCost*(v.level+1);if(!Number.isFinite(s.money)||s.money<price)return result(false,'NOT ENOUGH CASH');s.money-=price;v.level++;log(s.empire,'GARAGE UPGRADE '+v.level,-price);return result(true,'GARAGE UPGRADED · +$15/MIN');}
export function collectBusiness(s:EmpireAccount,id:string,c:EmpireContext):EmpireResult{const b=BUSINESSES.find(b=>b.id===id),v=s.empire.businesses[id];if(!b||!v?.owned||!near(b,c))return result(false,'VISIT YOUR GARAGE TO COLLECT');const payout=Math.floor(v.accrued)-b.fee;if(payout<=0)return result(false,'EARNINGS MUST EXCEED THE $15 COLLECTION FEE');if(!Number.isFinite(s.money)||s.money<0||s.money+payout>1e9)return result(false,'WALLET UNAVAILABLE');s.money+=payout;v.accrued=0;log(s.empire,'GARAGE COLLECTION · $15 FEE',payout);return result(true,`COLLECTED $${payout} AFTER $15 FEE`);}
export function defendTerritory(s:EmpireAccount,c:EmpireContext,delegate=false):EmpireResult{const t=s.empire.territories['midtown-block'];if(t.status!=='contested'||s.empire.seconds>=t.responseUntil)return result(false,'NO ACTIVE COUNTERATTACK');if(delegate){if(!Number.isFinite(s.money)||s.money<180)return result(false,'GUARDS COST $180');s.money-=180;}else{if(!near({x:30,z:-30},c))return result(false,'REACH THE BLOCK');if(c.remainingEnemies&&c.remainingEnemies>=2){t.defenceSeen=true;return result(true,'DEFEND THE BLOCK · CLEAR THE TWO RIVALS');}if(!t.defenceSeen||c.remainingEnemies!==0)return result(false,'CLEAR THE COUNTERATTACK RIVALS');}t.status='owned';t.nextAttack=s.empire.seconds+600;t.responseUntil=0;t.defenceSeen=false;log(s.empire,delegate?'DEFENCE DELEGATED':'BLOCK DEFENDED',delegate?-180:0);return result(true,'MIDTOWN BLOCK SECURED');}
export function garageRepairMultiplier(e:EmpireState){return e.businesses['midtown-garage']?.owned ? .8 : 1;}
export type EmpireAction={type:'begin';id:string}|{type:'complete'}|{type:'fail'}|{type:'buy'|'upgrade'|'collect';id:string}|{type:'defend';delegate:boolean}|{type:'route';x:number;z:number;label:string};
