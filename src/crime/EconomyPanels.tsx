import {useState} from 'react';
import {GOODS,MARKETS,STORAGE_ID,activeInventory,cargoProfit,marketEvents,marketQuote,nextTradeId,type Commodity,type Market,type TradeRequest,type TradeResult} from './Economy';
import {cargoCap,cargoCount,type GameSave} from './Systems';
const cash=(n:number)=>'$'+Math.round(n).toLocaleString('en-AU');
const signedCash=(n:number)=>(n>=0?'+':'−')+cash(Math.abs(n));
const duration=(s:number)=>{const seconds=Math.max(0,Math.ceil(s));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const elapsed=(s:number)=>s<60?'just now':Math.floor(s/60)+'m ago';
const DESCRIPTIONS:Record<Commodity,string>={Ember:'Affordable bulk · steady street demand',Glitch:'Small electronics · industrial supply',Velvet:'Club luxury · nightlife demand',Crown:'Rare premium stock · high capital risk'};
function Quantity({value,onChange}:{value:number;onChange:(n:number)=>void}){
 const change=(n:number)=>onChange(Math.max(1,Math.min(20,Math.trunc(n)||1)));
 return <div className="be-deal-quantity"><span>QUANTITY</span><div><button type="button" aria-label="Decrease quantity" onClick={()=>change(value-1)} disabled={value<=1}>−</button><input aria-label="Quantity" type="number" inputMode="numeric" min="1" max="20" value={value} onChange={e=>change(Number(e.target.value))}/><button type="button" aria-label="Increase quantity" onClick={()=>change(value+1)} disabled={value>=20}>+</button></div></div>;
}
export function MarketIntel({save,onNavigate}:{save:GameSave;onNavigate:(id:string)=>void}){
 const events=marketEvents(save.economy);
 return <details className="be-market-intel"><summary>STREET INTEL <span>{events.length?events.length+' LIVE EVENT'+(events.length===1?'':'S'):'OBSERVED PRICES'}</span></summary>
  {events.map(event=><button key={event.market} className="be-intel-event" onClick={()=>onNavigate(event.market)}><strong>{event.title}<em>{duration(event.endsAt-save.economy.seconds)} left</em></strong><span>{event.detail}</span><small>SET ROUTE → {MARKETS.find(m=>m.id===event.market)?.name}</small></button>)}
  <p className="be-intel-note">Quotes below are from your visits. Prices and demand may change before arrival.</p>
  <div className="be-observed-markets">{MARKETS.map(m=>{
   const observed=GOODS.flatMap(g=>{const h=save.economy.observed[m.id+':'+g];return h?.length?[{good:g,quote:h[h.length-1]}]:[];});
   return <button key={m.id} onClick={()=>onNavigate(m.id)}><b>{m.name}</b>{observed.length?<span>{observed.map(o=><small key={o.good}>{o.good} · buyer {cash(o.quote.sell)} <i>{elapsed(save.economy.seconds-o.quote.at)}</i></small>)}</span>:<small>VISIT FOR A PRICE CHECK</small>}</button>;
  })}</div>
 </details>;
}
export function TradePanel({save,market,onDeal,onNavigate}:{save:GameSave;market:Market|null;onDeal:(request:TradeRequest)=>TradeResult;onNavigate:(id:string)=>void}){
 const [good,setGood]=useState<Commodity>('Ember'),[quantity,setQuantity]=useState(1),[result,setResult]=useState<TradeResult|null>(null);
 if(!market)return <p>Reach a street contact to trade.</p>;
 const q=marketQuote(save.economy,market.id,good)!,inventory=activeInventory(save),held=inventory.goods[good],basis=inventory.cost[good];
 const profit=held>=quantity?cargoProfit(save,good,quantity,q.sell):null;
 const free=Math.max(0,cargoCap(save)-cargoCount(save));
 const canBuy=q.stock>=quantity&&free>=quantity&&save.money>=q.buy*quantity;
 const canSell=held>=quantity&&q.demand>=quantity;
 const id=nextTradeId(save.economy);
 const submit=(qty:number)=>setResult(onDeal({id,market:market.id,good,qty,quoteId:q.id}));
 const receipt=result?.receipt??save.economy.ledger[save.economy.ledger.length-1],history=save.economy.observed[market.id+':'+good]??[];
 return <div className="be-trade-screen">
  <div className="be-contact-title"><small>Limited supply. Local buyers. Every run counts.</small></div>
  <div className="be-deal-wallet"><span>CASH <b>{cash(save.money)}</b></span><span>BOOT <b>{cargoCount(save)}/{cargoCap(save)}</b></span><span>BANK <b>{cash(save.bank)}</b></span></div>
  {q.event&&<div className="be-market-event"><b>{q.event.title}</b><span>{duration(q.event.endsAt-save.economy.seconds)} remaining · {q.event.kind==='supply'?'lower supplier prices':'higher buyer prices'}</span></div>}
  <div className="be-goods-grid" role="group" aria-label="Commodity selection">{GOODS.map(g=>{
   const offer=marketQuote(save.economy,market.id,g)!;return <button key={g} className={good===g?'active':''} aria-pressed={good===g} aria-label={'Select '+g} onClick={()=>{setGood(g);setResult(null);}}><strong>{g.toUpperCase()}<i>{save.cargo[g]} IN CAR</i></strong><span>Buy {cash(offer.buy)} <em>Sell {cash(offer.sell)}</em></span></button>;
  })}</div>
  <div className="be-commodity-detail"><h3>{good.toUpperCase()}</h3><p>{DESCRIPTIONS[good]}</p><div className="be-market-limits"><span>FOR SALE <b>{q.stock} units</b></span><span>BUYER NEEDS <b>{q.demand} units</b></span><span>YOU HOLD <b>{held} units</b></span></div>
   <Quantity value={quantity} onChange={setQuantity}/>
   <div className="be-deal-totals"><span>Buy {quantity} <b>{cash(q.buy*quantity)}</b></span><span>Sell {quantity} <b>{cash(q.sell*quantity)}</b></span></div>
   <div className="be-cost-basis"><span>YOUR AVG. COST <b>{!held?'—':basis===null?'UNKNOWN':cash(basis/held)+'/unit'}</b></span><span>SALE PROFIT <b className={profit===null?'':profit>=0?'be-profit':'be-loss'}>{profit===null?'—':signedCash(profit)}</b></span></div>
   <small className="be-cost-note">{held&&basis===null?'Older cargo has no recorded purchase cost.':'Profit uses the purchase cost of your cargo, before repairs or fines.'}</small>
   
   {!canBuy&&<p className="be-deal-reason">{q.stock<quantity?'Not enough contact stock.':free<quantity?'Boot full. Store cargo at your safehouse.':'Not enough cash for this purchase.'}</p>}
   {!canSell&&held>0&&<p className="be-deal-reason">{held<quantity?'Choose fewer units to sell.':'The buyer cannot take this much yet.'}</p>}
   <small className="be-restock">Supplier and buyer refresh in {Math.ceil(q.restockIn)}s of street time. Menus pause the market.</small>
  </div>
  {result&&!result.ok&&<div className="be-trade-error" role="alert">{result.text}</div>}
  {receipt&&<div className="be-trade-receipt" role="status" aria-label="Last trade receipt"><small>LAST DEAL · {MARKETS.find(m=>m.id===receipt.market)?.name}</small><b>{receipt.qty>0?'Bought':'Sold'} {Math.abs(receipt.qty)} {receipt.good} <span>{receipt.qty>0?'−':'+'}{cash(receipt.total)}</span></b><span>{receipt.profit===null?(receipt.qty>0?'Purchase cost recorded.':'Purchase cost unknown.'):signedCash(receipt.profit)+' realised profit'}</span></div>}
  <details className="be-price-history"><summary>PRICE HISTORY <span>{history.length} observations</span></summary><div>{history.slice().reverse().map((p,i)=><span key={i}>Buy {cash(p.buy)} · Sell {cash(p.sell)} <small>{elapsed(save.economy.seconds-p.at)}</small></span>)}</div></details>
  <MarketIntel save={save} onNavigate={onNavigate}/>
  <div className="be-deal-actions"><button className="be-buy" aria-label="BUY" disabled={!canBuy} onClick={()=>submit(quantity)}>BUY <b>{cash(q.buy*quantity)}</b></button><button className="be-sell" aria-label="SELL" disabled={!canSell} onClick={()=>submit(-quantity)}>SELL <b>{cash(q.sell*quantity)}</b></button></div>
 </div>;
}
export function SafehouseStorage({save,canTransfer,onTransfer,onBank}:{save:GameSave;canTransfer:boolean;onTransfer:(good:Commodity,qty:number)=>TradeResult;onBank:(amount:number)=>TradeResult}){
 const [good,setGood]=useState<Commodity>('Ember'),[quantity,setQuantity]=useState(1),[result,setResult]=useState<TradeResult|null>(null);
 const stash=save.economy.inventories[STORAGE_ID],capacity=48+24*save.garageLevel,stored=GOODS.reduce((n,g)=>n+stash.goods[g],0);
 return <details className="be-safe-storage"><summary>STASH & BANK <span>{stored}/{capacity} · {cash(save.bank)}</span></summary>
  <div className="be-stash-goods">{GOODS.map(g=><button aria-pressed={g===good} className={g===good?'active':''} key={g} onClick={()=>setGood(g)}>{g.toUpperCase()}<small>CAR {save.cargo[g]} · STASH {stash.goods[g]}</small></button>)}</div>
  <Quantity value={quantity} onChange={setQuantity}/><div className="be-deal-actions"><button disabled={!canTransfer||save.cargo[good]<quantity||stored+quantity>capacity} onClick={()=>setResult(onTransfer(good,quantity))}>STORE {quantity}</button><button disabled={!canTransfer||stash.goods[good]<quantity||cargoCount(save)+quantity>cargoCap(save)} onClick={()=>setResult(onTransfer(good,-quantity))}>LOAD {quantity}</button></div>
  <p>{canTransfer?'Cargo stays in its car. Stashed goods survive cargo confiscation.':'Park your active car within 12 m of the safehouse to store or load cargo.'}</p><div className="be-deal-wallet"><span>ON HAND <b>{cash(save.money)}</b></span><span>BANKED <b>{cash(save.bank)}</b></span></div>
  <div className="be-deal-actions"><button disabled={save.money<=0} onClick={()=>setResult(onBank(save.money))}>BANK ALL CASH</button><button disabled={save.bank<=0} onClick={()=>setResult(onBank(-save.bank))}>WITHDRAW ALL</button></div>
  {result&&<p role="status" className={result.ok?'be-profit':'be-loss'}>{result.text}</p>}
 </details>;
}
