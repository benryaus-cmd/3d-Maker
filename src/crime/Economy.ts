/** Persistent, deterministic street markets. All money moves through validated transactions. */
export type Commodity='Ember'|'Glitch'|'Velvet'|'Crown';
export const GOODS:Commodity[]=['Ember','Glitch','Velvet','Crown'];
export const MARKETS=[
 {id:'port',name:'PORT MARKET',x:-120,z:-120}, {id:'club',name:'NEON CLUB',x:120,z:0},
 {id:'yard',name:'INDUSTRIAL YARD',x:0,z:-120}, {id:'tower',name:'FINANCIAL BROKER',x:0,z:120},
 {id:'hills',name:'HILLS CONTACT',x:-120,z:120}, {id:'gardens',name:'GARDENS EXCHANGE',x:120,z:120},
 {id:'quarter',name:'OLD QUARTER MARKET',x:-120,z:0}, {id:'midtown',name:'MIDTOWN DEALER',x:0,z:30},
 {id:'market',name:'MARKET WARD',x:120,z:-120}
];
export type Market=typeof MARKETS[number];
export type Quantities=Record<Commodity,number>;
export type Inventory={goods:Quantities;cost:Record<Commodity,number|null>};
export type MarketCell={stock:number;demand:number;revision:number};
export type MarketEvent={kind:'supply'|'demand';market:string;title:string;detail:string;startsAt:number;endsAt:number;goods:Commodity[]};
export type PriceObservation={at:number;buy:number;sell:number};
export type TradeReceipt={id:string;at:number;market:string;good:Commodity;qty:number;unitPrice:number;total:number;profit:number|null};
export type EconomyState={version:1;seed:number;seconds:number;restockTick:number;sequence:number;
 markets:Record<string,Record<Commodity,MarketCell>>;inventories:Record<string,Inventory>;
 ledger:TradeReceipt[];observed:Record<string,PriceObservation[]>};
export type EconomyAccount={money:number;car:string;garageLevel:number;cargo:Quantities;economy:EconomyState};
export type TradeContext={x:number;z:number;speed:number;open:boolean;cargoAccessible:boolean};
export type TradeRequest={id:string;market:string;good:Commodity;qty:number;quoteId:string};
export type TradeResult={ok:boolean;text:string;receipt?:TradeReceipt};
export type MarketQuote={id:string;buy:number;sell:number;stock:number;demand:number;event:MarketEvent|null;restockIn:number};
export const STORAGE_ID='stash:midtown';
const CAR_IDS=['sedan','sedan-sports','police','taxi','suv','race'];
const BASE:Quantities={Ember:60,Glitch:105,Velvet:170,Crown:280};
const STOCK:Quantities={Ember:24,Glitch:18,Velvet:12,Crown:8};
const DEMAND:Quantities={Ember:30,Glitch:24,Velvet:18,Crown:12};
const PROFILE:Record<string,number[]>={port:[.72,.82,1.12,1.08],club:[1.20,1.12,1.48,1.25],yard:[.95,.68,.92,1.14],tower:[1.16,1.22,1.20,1.48],hills:[1.04,1.15,1.35,1.38],gardens:[.97,1.03,1.18,1.12],quarter:[1.10,.94,.90,1.06],midtown:[1.05,1.00,1.06,1.10],market:[.90,1.08,.86,.98]};
const finite=(v:unknown,fallback:number,min=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const integer=(v:unknown,fallback=0,max=1e9)=>Math.floor(finite(v,fallback,0,max));
export const emptyGoods=():Quantities=>({Ember:0,Glitch:0,Velvet:0,Crown:0});
const emptyInventory=():Inventory=>({goods:emptyGoods(),cost:emptyGoods()});
export const vehicleInventoryId=(car:string)=>'vehicle:'+car;
function hash(x:number){x=Math.imul(x^61,2654435761);x=Math.imul(x^(x>>>15),1|x);return ((x^(x>>>14))>>>0)/4294967296;}
export function createEconomy(seed=74193):EconomyState{
 const markets:EconomyState['markets']={};
 for(const m of MARKETS){markets[m.id]={} as Record<Commodity,MarketCell>;for(const g of GOODS)markets[m.id][g]={stock:STOCK[g],demand:DEMAND[g],revision:0};}
 return {version:1,seed,seconds:0,restockTick:0,sequence:0,markets,inventories:{[STORAGE_ID]:emptyInventory()},ledger:[],observed:{}};
}
export function validEconomyHeader(value:unknown):boolean{
 const e=value as EconomyState,whole=(n:unknown,max:number)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=max;
 if(!e||e.version!==1||!whole(e.seed,2147483647)||!Number.isFinite(e.seconds)||e.seconds<0||e.seconds>1e9||!whole(e.sequence,1e9)||!e.inventories||!e.markets)return false;
 if(!MARKETS.every(m=>e.markets[m.id]&&GOODS.every(g=>{const c=e.markets[m.id][g];return c&&whole(c.stock,256)&&whole(c.demand,256)&&whole(c.revision,1e9);})))return false;
 if(!e.inventories[STORAGE_ID])return false;
 const allowed=[STORAGE_ID,...CAR_IDS.map(vehicleInventoryId)];
 return Object.entries(e.inventories).every(([id,inv])=>allowed.includes(id)&&inv&&inv.goods&&inv.cost&&GOODS.every(g=>whole(inv.goods[g],10000)&&
  (inv.cost[g]===null||typeof inv.cost[g]==='number'&&Number.isFinite(inv.cost[g])&&inv.cost[g]>=0&&inv.cost[g]<=1e9)&&
  (inv.goods[g]>0||inv.cost[g]===0)));
}
export function restoreEconomy(raw:Partial<EconomyState>|null|undefined,legacy:Partial<Quantities>,car:string):EconomyState{
 const e=createEconomy(integer(raw?.seed,74193,2147483647));
 e.seconds=finite(raw?.seconds,0,0,1e9);e.restockTick=Math.floor(e.seconds/30);e.sequence=integer(raw?.sequence);
 for(const m of MARKETS)for(const g of GOODS){const c=raw?.markets?.[m.id]?.[g];if(c)e.markets[m.id][g]={stock:integer(c.stock,STOCK[g],256),demand:integer(c.demand,DEMAND[g],256),revision:integer(c.revision)};}
 for(const id of [STORAGE_ID,...CAR_IDS.map(vehicleInventoryId)]){
  const saved=raw?.inventories?.[id];if(!saved)continue;
  const inv=emptyInventory();for(const g of GOODS){inv.goods[g]=integer(saved.goods?.[g],0,10000);inv.cost[g]=inv.goods[g]===0?0:saved.cost?.[g]===null?null:finite(saved.cost?.[g],0);}
  e.inventories[id]=inv;
 }
 const id=vehicleInventoryId(car);
 if(!e.inventories[id]){const inv=emptyInventory();for(const g of GOODS){inv.goods[g]=integer(legacy?.[g],0,10000);inv.cost[g]=inv.goods[g]?null:0;}e.inventories[id]=inv;}
 if(Array.isArray(raw?.ledger))e.ledger=raw.ledger.filter(r=>r&&typeof r.id==='string'&&MARKETS.some(m=>m.id===r.market)&&GOODS.includes(r.good)&&Number.isInteger(r.qty)&&Math.abs(r.qty)>0&&Math.abs(r.qty)<=20&&Number.isFinite(r.total)&&r.total>=0&&Number.isFinite(r.unitPrice)&&Number.isFinite(r.at)&&(r.profit===null||Number.isFinite(r.profit))).slice(-40).map(r=>({...r}));
 for(const m of MARKETS)for(const g of GOODS){const id=m.id+':'+g,h=raw?.observed?.[id];if(Array.isArray(h))e.observed[id]=h.filter(p=>p&&Number.isFinite(p.at)&&p.at>=0&&p.at<=e.seconds&&Number.isFinite(p.buy)&&p.buy>0&&Number.isFinite(p.sell)&&p.sell>0).slice(-8).map(p=>({...p}));}
 return e;
}
export function activeInventory(s:EconomyAccount):Inventory{
 const id=vehicleInventoryId(s.car);return s.economy.inventories[id]??(s.economy.inventories[id]=emptyInventory());
}
export function syncCargo(s:EconomyAccount){s.cargo=activeInventory(s).goods;}
export function switchCargo(s:EconomyAccount,car:string){s.car=car;syncCargo(s);}
export function seizeCargo(s:EconomyAccount){const inv=activeInventory(s);for(const g of GOODS){inv.goods[g]=0;inv.cost[g]=0;}syncCargo(s);}
export function advanceEconomy(e:EconomyState,dt:number){
 if(!Number.isFinite(dt)||dt<=0)return;
 e.seconds=Math.min(1e9,e.seconds+dt);const tick=Math.floor(e.seconds/30),steps=tick-e.restockTick;
 if(steps<=0)return;e.restockTick=tick;
 for(const m of MARKETS)for(const g of GOODS){const cell=e.markets[m.id][g],supply=g==='Crown'?1:2;
  const stock=cell.stock<STOCK[g]?Math.min(STOCK[g],cell.stock+steps*supply):cell.stock;
  const demand=Math.min(DEMAND[g],cell.demand+steps*2);
  if(stock!==cell.stock||demand!==cell.demand){cell.stock=stock;cell.demand=demand;cell.revision++;}
 }
}
export function marketEvents(e:EconomyState):MarketEvent[]{
 const start=Math.floor(e.seconds/600)*600;
 return [
  {kind:'supply' as const,market:'port',title:'PORT SHIPMENT',detail:'Ember and Glitch prices fall while a fresh shipment clears the docks.',startsAt:start,endsAt:start+180,goods:['Ember','Glitch'] as Commodity[]},
  {kind:'demand' as const,market:'club',title:'NEON WEEKENDER',detail:'The club pays more for Velvet and Crown for a limited time.',startsAt:start+200,endsAt:start+380,goods:['Velvet','Crown'] as Commodity[]}
 ].filter(event=>e.seconds>=event.startsAt&&e.seconds<event.endsAt);
}
export function marketQuote(e:EconomyState,market:string,good:Commodity):MarketQuote|null{
 if(!MARKETS.some(m=>m.id===market)||!GOODS.includes(good))return null;
 const c=e.markets[market][good],index=GOODS.indexOf(good),marketIndex=MARKETS.findIndex(m=>m.id===market),period=Math.floor(e.seconds/180);
 const event=marketEvents(e).find(x=>x.market===market&&x.goods.includes(good))??null;
 const swing=.92+hash(e.seed+period*41+marketIndex*97+index*9)*.16;
 const scarcity=1+.12*(1-c.stock/STOCK[good]);
 const appetite=.86+.14*Math.min(1,c.demand/DEMAND[good]);
 const fair=BASE[good]*PROFILE[market][index]*swing*Math.max(.82,Math.min(1.15,scarcity))*(event?.kind==='supply'?.76:event?.kind==='demand'?1.32:1);
 return {id:`${e.seed}:${market}:${good}:${period}:${Math.floor(e.seconds/30)}:${c.revision}:${event?.startsAt??'none'}`,buy:Math.max(5,Math.round(fair*1.07)),sell:Math.max(3,Math.floor(fair*.88*appetite)),stock:c.stock,demand:c.demand,event,restockIn:30-e.seconds%30};
}
export function nextTradeId(e:EconomyState){return `trade:${e.seed}:${e.sequence+1}`;}
export function cargoProfit(s:EconomyAccount,good:Commodity,quantity:number,sellPrice:number):number|null{
 const inv=activeInventory(s),cost=inv.cost[good];if(cost===null||!inv.goods[good])return null;
 return quantity*sellPrice-cost*quantity/inv.goods[good];
}
export function requestTrade(s:EconomyAccount,r:TradeRequest,context:TradeContext):TradeResult{
 const fail=(text:string):TradeResult=>({ok:false,text});
 const market=MARKETS.find(m=>m.id===r.market);
 if(!market||!GOODS.includes(r.good))return fail('CONTACT OR GOODS UNAVAILABLE');
 if(!context||!context.open)return fail('OPEN THE CONTACT TO TRADE');
 if(!Number.isFinite(context.x)||!Number.isFinite(context.z)||Math.hypot(context.x-market.x,context.z-market.z)>7.5)return fail('REACH THIS CONTACT FIRST');
 if(!Number.isFinite(context.speed)||context.speed>6||context.speed<0)return fail('PARK BEFORE TRADING');
 if(!context.cargoAccessible)return fail('RETURN TO YOUR CAR FOR CARGO');
 if(!Number.isInteger(r.qty)||!r.qty||Math.abs(r.qty)>20)return fail('CHOOSE 1–20 UNITS');
 if(r.id!==nextTradeId(s.economy))return fail('THIS DEAL WAS ALREADY HANDLED');
 const q=marketQuote(s.economy,r.market,r.good);
 if(!q||r.quoteId!==q.id)return fail('PRICE CHANGED · REVIEW THE NEW QUOTE');
 const inv=s.economy.inventories[vehicleInventoryId(s.car)];
 if(!inv||!Number.isFinite(s.money)||s.money<0||GOODS.some(g=>!Number.isInteger(inv.goods[g])||inv.goods[g]<0))return fail('INVENTORY UNAVAILABLE');
 const quantity=Math.abs(r.qty),buy=r.qty>0,price=buy?q.buy:q.sell,total=quantity*price;
 if(buy){
  if(q.stock<quantity)return fail('CONTACT HAS ONLY '+q.stock+' UNITS');
  if(GOODS.reduce((n,g)=>n+inv.goods[g],0)+quantity>12+12*s.garageLevel)return fail('BOOT FULL · STORE CARGO OR UPGRADE');
  if(s.money<total)return fail('NOT ENOUGH CASH');
 }else{
  if(inv.goods[r.good]<quantity)return fail('NOT ENOUGH CARGO TO SELL');
  if(q.demand<quantity)return fail('BUYER NEEDS ONLY '+q.demand+' UNITS');
  if(s.money+total>1e9)return fail('BANK SOME CASH BEFORE SELLING');
 }
 const cell=s.economy.markets[r.market][r.good],oldQty=inv.goods[r.good],oldCost=inv.cost[r.good];
 const profit=buy?null:cargoProfit(s,r.good,quantity,price);
 // Everything below is one synchronous commit; validation above changes no state.
 s.money+=buy?-total:total;inv.goods[r.good]+=r.qty;
 inv.cost[r.good]=inv.goods[r.good]===0?0:oldCost===null?null:buy?oldCost+total:oldCost*(1-quantity/oldQty);
 if(buy)cell.stock-=quantity;else{cell.demand-=quantity;cell.stock=Math.min(256,cell.stock+quantity);}cell.revision++;
 s.economy.sequence++;
 const receipt:TradeReceipt={id:r.id,at:s.economy.seconds,market:r.market,good:r.good,qty:r.qty,unitPrice:price,total,profit};
 s.economy.ledger.push(receipt);if(s.economy.ledger.length>40)s.economy.ledger.shift();syncCargo(s);observeMarket(s.economy,r.market);
 return {ok:true,receipt,text:`${buy?'BOUGHT':'SOLD'} ${quantity} ${r.good.toUpperCase()} · ${buy?'−':'+'}$${total}${profit===null?'':` · ${profit>=0?'PROFIT':'LOSS'} $${Math.round(Math.abs(profit))}`}`};
}
export function observeMarket(e:EconomyState,market:string){
 for(const good of GOODS){const q=marketQuote(e,market,good);if(!q)continue;const key=market+':'+good,h=e.observed[key]??(e.observed[key]=[]),last=h[h.length-1];
  if(!last||last.buy!==q.buy||last.sell!==q.sell||e.seconds-last.at>=30){h.push({at:e.seconds,buy:q.buy,sell:q.sell});if(h.length>8)h.shift();}
 }
}
export function transferCargo(s:EconomyAccount,good:Commodity,qty:number,atSafehouse:boolean,carNearby=false):TradeResult{
 if(!atSafehouse)return {ok:false,text:'USE YOUR SAFEHOUSE STASH'};
 if(!carNearby)return {ok:false,text:'PARK YOUR CAR NEAR THE SAFEHOUSE FOR CARGO'};
 if(!GOODS.includes(good)||!Number.isInteger(qty)||!qty)return {ok:false,text:'CHOOSE A CARGO QUANTITY'};
 const vehicle=activeInventory(s),stash=s.economy.inventories[STORAGE_ID],from=qty>0?vehicle:stash,to=qty>0?stash:vehicle,n=Math.abs(qty);
 if(from.goods[good]<n)return {ok:false,text:'NOT ENOUGH CARGO'};
 const limit=qty>0?48+24*s.garageLevel:12+12*s.garageLevel;
 if(GOODS.reduce((sum,g)=>sum+to.goods[g],0)+n>limit)return {ok:false,text:qty>0?'STASH FULL':'BOOT FULL'};
 const basis=from.cost[good]===null?null:from.cost[good]*n/from.goods[good];
 from.goods[good]-=n;from.cost[good]=from.goods[good]===0?0:from.cost[good]===null?null:from.cost[good]-basis!;
 to.cost[good]=to.cost[good]===null||basis===null?null:to.cost[good]+basis;to.goods[good]+=n;syncCargo(s);
 return {ok:true,text:`${n} ${good.toUpperCase()} ${qty>0?'STORED SAFELY':'LOADED INTO CAR'}`};
}
