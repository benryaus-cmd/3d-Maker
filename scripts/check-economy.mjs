import assert from 'node:assert/strict';
import * as S from '../src/crime/Systems.ts';
const baseline=S.initial();
assert.ok(baseline.economy,'a fresh game must contain persistent dealer inventory and economic time');
const E=await import('../src/crime/Economy.ts');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
const contact=(id,extra={})=>({...S.MARKETS.find(m=>m.id===id),speed:0,open:true,cargoAccessible:true,...extra});
const make=()=>{const s=S.initial();s.money=100000;return s;};
const submit=(s,id,good,qty,extra={})=>{const q=E.marketQuote(s.economy,id,good);return E.requestTrade(s,{market:id,good,qty,quoteId:q.id,id:E.nextTradeId(s.economy)},contact(id,extra));};
test('fresh games have finite distinct dealer stock and a buy/sell spread',()=>{
 const s=make();for(const m of S.MARKETS)for(const good of S.GOODS){const q=E.marketQuote(s.economy,m.id,good);assert.ok(q.stock>0&&q.demand>0);assert.ok(q.buy>q.sell&&q.sell>0);}
 assert.notEqual(E.marketQuote(s.economy,'port','Ember').buy,E.marketQuote(s.economy,'club','Ember').buy);
});
test('a trade conserves cash cargo stock and acquisition cost with one ledger receipt',()=>{
 const s=make(),q=E.marketQuote(s.economy,'port','Ember'),money=s.money,r=submit(s,'port','Ember',3);
 assert.ok(r.ok);assert.equal(s.money,money-q.buy*3);assert.equal(s.cargo.Ember,3);assert.equal(E.marketQuote(s.economy,'port','Ember').stock,q.stock-3);
 assert.equal(E.activeInventory(s).cost.Ember,q.buy*3);assert.equal(s.economy.ledger.length,1);assert.equal(r.receipt.total,q.buy*3);
});
test('replaying a transaction cannot move money or stock twice even with a refreshed quote',()=>{
 const s=make(),q=E.marketQuote(s.economy,'port','Ember'),r={market:'port',good:'Ember',qty:1,quoteId:q.id,id:E.nextTradeId(s.economy)};
 assert.ok(E.requestTrade(s,r,contact('port')).ok);const snapshot=JSON.stringify(s);
 const again=E.requestTrade(s,{...r,quoteId:E.marketQuote(s.economy,'port','Ember').id},contact('port'));
 assert.ok(!again.ok);assert.equal(JSON.stringify(s),snapshot);
});
test('stale remote closed moving and inaccessible cargo requests fail without mutation',()=>{
 const s=make(),q=E.marketQuote(s.economy,'port','Ember');submit(s,'port','Ember',1);
 const requests=[{quoteId:q.id},{context:{x:0,z:0}},{context:{open:false}},{context:{speed:7}},{context:{cargoAccessible:false}},{market:'fake'},{good:'fake'},{qty:NaN},{qty:.5},{qty:0},{qty:21}];
 for(const bad of requests){const now=E.marketQuote(s.economy,'port','Ember');const before=JSON.stringify(s);const {context,...change}=bad;
  assert.ok(!E.requestTrade(s,{market:'port',good:'Ember',qty:1,quoteId:now.id,id:E.nextTradeId(s.economy),...change},contact('port',context)).ok);assert.equal(JSON.stringify(s),before);
 }
});
test('finite stock demand capacity money and owned inventory gate trades',()=>{
 const s=make();s.garageLevel=3;const cell=s.economy.markets.port.Ember;cell.stock=2;assert.ok(!submit(s,'port','Ember',3).ok);assert.ok(submit(s,'port','Ember',2).ok);
 assert.ok(!submit(s,'port','Ember',1).ok);s.economy.markets.club.Ember.demand=1;assert.ok(!submit(s,'club','Ember',-2).ok);assert.ok(submit(s,'club','Ember',-1).ok);
 assert.ok(!submit(s,'club','Crown',-1).ok);const cash=make();cash.money=0;assert.ok(!submit(cash,'port','Ember',1).ok);
 const full=make();full.cargo.Glitch=12;assert.ok(!submit(full,'port','Ember',1).ok);
});
test('sale reports realised profit and removes proportional acquisition cost',()=>{
 const s=make();assert.ok(submit(s,'port','Ember',4).ok);const cost=E.activeInventory(s).cost.Ember,q=E.marketQuote(s.economy,'club','Ember');
 const r=submit(s,'club','Ember',-2);assert.ok(r.ok);assert.equal(r.receipt.profit,q.sell*2-cost/2);assert.equal(E.activeInventory(s).cost.Ember,cost/2);assert.equal(s.cargo.Ember,2);
});
test('buying and selling back at the same contact loses money',()=>{
 const s=make(),before=s.money;assert.ok(submit(s,'midtown','Ember',1).ok);assert.ok(submit(s,'midtown','Ember',-1).ok);assert.ok(s.money<before);
});
test('clock replenishes only on active simulation and survives serialisation without offline accrual',()=>{
 const s=make();s.economy.markets.port.Ember.stock=0;E.advanceEconomy(s.economy,29);assert.equal(s.economy.markets.port.Ember.stock,0);
 E.advanceEconomy(s.economy,2);assert.ok(s.economy.markets.port.Ember.stock>0);const saved=JSON.stringify(s.economy),restored=E.restoreEconomy(JSON.parse(saved),s.cargo,s.car);
 assert.equal(restored.seconds,s.economy.seconds);assert.deepEqual(restored.markets,s.economy.markets);assert.equal(JSON.stringify(restored),saved);
});
test('event boundaries invalidate quotes even inside one price/restock interval',()=>{
 const s=make();E.advanceEconomy(s.economy,199);const before=E.marketQuote(s.economy,'club','Velvet');
 E.advanceEconomy(s.economy,2);const after=E.marketQuote(s.economy,'club','Velvet');assert.notEqual(before.sell,after.sell);assert.notEqual(before.id,after.id);
});
test('port supply and nightlife demand events are deterministic finite opportunities',()=>{
 const s=make(),port=E.marketQuote(s.economy,'port','Ember');assert.equal(port.event.kind,'supply');assert.ok(port.event.endsAt>s.economy.seconds);
 E.advanceEconomy(s.economy,205);assert.equal(E.marketQuote(s.economy,'port','Ember').event,null);assert.equal(E.marketQuote(s.economy,'club','Velvet').event.kind,'demand');
 E.advanceEconomy(s.economy,200);assert.equal(E.marketQuote(s.economy,'club','Velvet').event,null);
});
test('switching vehicle keeps cargo and costs with its stable vehicle inventory',()=>{
 const s=make();assert.ok(submit(s,'port','Ember',2).ok);const cost=E.activeInventory(s).cost.Ember;
 assert.ok(S.buyCar(s,'race').ok);assert.equal(s.cargo.Ember,0);assert.ok(submit(s,'club','Velvet',1).ok);
 assert.ok(S.buyCar(s,'sedan').ok);assert.equal(s.cargo.Ember,2);assert.equal(s.cargo.Velvet,0);assert.equal(E.activeInventory(s).cost.Ember,cost);
});
test('safehouse transfers preserve cost and enforce storage and vehicle capacities',()=>{
 const s=make();assert.ok(submit(s,'port','Ember',2).ok);const cost=E.activeInventory(s).cost.Ember;
 assert.ok(!E.transferCargo(s,'Ember',2,false,true).ok);assert.ok(E.transferCargo(s,'Ember',2,true,true).ok);assert.equal(s.cargo.Ember,0);assert.equal(s.economy.inventories['stash:midtown'].cost.Ember,cost);
 assert.ok(E.transferCargo(s,'Ember',-1,true,true).ok);assert.equal(s.cargo.Ember,1);assert.equal(E.activeInventory(s).cost.Ember,cost/2);
 s.cargo.Glitch=12;assert.ok(!E.transferCargo(s,'Ember',-1,true,true).ok);
});
test('safehouse cannot transfer cargo to or from a remotely parked car',()=>{
 const s=make();submit(s,'port','Ember',2);const before=JSON.stringify(s);
 assert.ok(!E.transferCargo(s,'Ember',1,true,false).ok);assert.equal(JSON.stringify(s),before);
 E.transferCargo(s,'Ember',1,true,true);const stashed=JSON.stringify(s);assert.ok(!E.transferCargo(s,'Ember',-1,true,false).ok);assert.equal(JSON.stringify(s),stashed);
});
test('confiscation clears only active vehicle stock and acquisition cost',()=>{
 const s=make();submit(s,'port','Ember',2);E.transferCargo(s,'Ember',1,true,true);E.seizeCargo(s);assert.equal(s.cargo.Ember,0);assert.equal(E.activeInventory(s).cost.Ember,0);assert.equal(s.economy.inventories['stash:midtown'].goods.Ember,1);
});
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
test('save migration preserves legacy cash cars upgrades cargo and unknown cost basis',()=>{
 memory.clear();const legacy=S.initial();delete legacy.economy;legacy.version=2;legacy.money=3210;legacy.bank=190;legacy.cargo.Ember=3;legacy.builds.sedan.paint=0x123456;
 memory.set('blacktop-empire-save-v2',JSON.stringify(legacy));const s=S.readSave();assert.equal(s.version,3);assert.equal(s.money,3210);assert.equal(s.bank,190);assert.equal(s.cargo.Ember,3);assert.equal(s.builds.sedan.paint,0x123456);assert.equal(E.activeInventory(s).cost.Ember,null);
 assert.ok(S.saveGame(s));const restored=S.readSave();assert.equal(restored.economy.sequence,s.economy.sequence);assert.ok(memory.has('blacktop-empire-save-v2-legacy'));
});
test('reload preserves market time prices depleted stock cost and transaction identity',()=>{
 memory.clear();const s=make();E.advanceEconomy(s.economy,211);submit(s,'club','Velvet',2);S.saveGame(s);const n=S.readSave();assert.deepEqual(n.economy,s.economy);assert.deepEqual(n.cargo,s.cargo);assert.deepEqual(E.marketQuote(n.economy,'club','Velvet'),E.marketQuote(s.economy,'club','Velvet'));
});
test('corrupt primary save restores last known good backup instead of resetting wealth',()=>{
 memory.clear();const s=make();submit(s,'port','Ember',1);S.saveGame(s);s.money=1234;S.saveGame(s);const previous=JSON.parse(memory.get('blacktop-empire-save-v2-backup'));
 memory.set('blacktop-empire-save-v2','broken');const n=S.readSave();assert.equal(n.money,previous.money);assert.equal(n.economy.sequence,previous.economy.sequence);
});
test('structurally corrupt inventory restores backup instead of silently deleting cargo',()=>{
 memory.clear();const s=make();submit(s,'port','Ember',2);S.saveGame(s);const expected=JSON.parse(memory.get('blacktop-empire-save-v2'));S.saveGame(s);
 for(const field of ['goods','cost','quantity','active']){const corrupt=JSON.parse(JSON.stringify(expected));const inv=corrupt.economy.inventories['vehicle:sedan'];if(field==='quantity')inv.goods.Ember='broken';else if(field==='active')delete corrupt.economy.inventories['vehicle:sedan'];else delete inv[field];
 memory.set('blacktop-empire-save-v2',JSON.stringify(corrupt));const recovered=S.readSave();assert.equal(recovered.cargo.Ember,expected.cargo.Ember);assert.equal(recovered.money,expected.money);assert.equal(E.activeInventory(recovered).cost.Ember,expected.economy.inventories['vehicle:sedan'].cost.Ember);}
});
test('invalid save quantities are repaired finite and safe',()=>{
 memory.clear();const s=make();s.cargo.Ember=-4;s.cargo.Glitch='oops';s.car='fake';s.bank=-4;memory.set('blacktop-empire-save-v2',JSON.stringify(s));const n=S.readSave();assert.equal(n.car,'sedan');assert.ok(Number.isFinite(n.bank)&&n.bank>=0);for(const good of S.GOODS)assert.ok(Number.isInteger(n.cargo[good])&&n.cargo[good]>=0);
});
test('banking preserves money and cannot be done away from the safehouse',()=>{
 const s=make(),sum=s.money+s.bank;assert.ok(!S.bankMoney(s,100,false).ok);assert.ok(S.bankMoney(s,100,true).ok);assert.equal(s.money+s.bank,sum);assert.ok(S.bankMoney(s,-50,true).ok);assert.equal(s.money+s.bank,sum);assert.ok(!S.bankMoney(s,-999999,true).ok);
});
test('observed quote history and receipts remain bounded over 100 simulated days',()=>{
 const s=make();let max=0,min=Infinity;
 for(let day=0;day<100;day++){E.advanceEconomy(s.economy,1200);for(const m of S.MARKETS){E.observeMarket(s.economy,m.id);for(const good of S.GOODS){const q=E.marketQuote(s.economy,m.id,good);max=Math.max(max,q.buy);min=Math.min(min,q.sell);assert.ok(q.stock<=256&&q.demand<=256);}}
 submit(s,'port','Ember',1);submit(s,'club','Ember',-1);
 }
 assert.ok(s.economy.ledger.length<=40);for(const h of Object.values(s.economy.observed))assert.ok(h.length<=8);assert.ok(min>0&&max<2000);console.log('BALANCE',JSON.stringify({days:100,minPrice:min,maxPrice:max,cash:s.money,receipts:s.economy.ledger.length,bytes:JSON.stringify(s.economy).length}));
});
console.log('COMPLETE',passed,'economy groups');
