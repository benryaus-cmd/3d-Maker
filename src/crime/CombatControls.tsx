import {useEffect,useRef,useState,type MutableRefObject,type PointerEvent as RP} from 'react';
import {type Controls,type ControlField} from './Controls';
import {WEAPON_DEFINITIONS,type Arsenal,type WeaponId} from './Firearms';
import './combat-ui.css';

export interface CombatControlsProps {controls:MutableRefObject<Controls>;onReload:()=>void;onHolster:()=>void;onPunch:()=>void}
const weaponIds:WeaponId[]=['pistol','shotgun','smg'];
const cash=(value:number)=>'$'+value.toLocaleString('en-AU');

/** Match the movement stick's screen coordinates: right +X, up +Z. */
export function aimStickVector(x:number,y:number,radius:number){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(radius)||radius<=0)return {x:0,z:0,active:false};
 const length=Math.hypot(x,y),scale=Math.max(radius,length),active=length>radius*.18;
 return {x:active?x/scale:0,z:active?-y/scale:0,active};
}

function CombatAction({controls,field,label,onAction}:{controls:MutableRefObject<Controls>;field?:ControlField;label:string;onAction:()=>void}){
 const ids=useRef(new Set<number>()),[held,setHeld]=useState(false);
 useEffect(()=>{
  const reset=()=>{for(const id of ids.current)controls.current.release(id);ids.current.clear();setHeld(false);};
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);reset();};
 },[controls]);
 const down=(e:RP<HTMLButtonElement>)=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);ids.current.add(e.pointerId);setHeld(true);if(field)controls.current.pointer(e.pointerId,field);onAction();};
 const up=(e:RP<HTMLButtonElement>)=>{ids.current.delete(e.pointerId);controls.current.release(e.pointerId);setHeld(ids.current.size>0);};
 return <button type="button" className={'be-combat-action'+(held?' is-held':'')} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onClick={e=>{if(e.detail===0)onAction();}}>{label}</button>;
}

export function CombatControls({controls,onReload,onHolster,onPunch}:CombatControlsProps){
 const pointer=useRef<number|null>(null),[offset,setOffset]=useState<[number,number]>([0,0]),[active,setActive]=useState(false);
 useEffect(()=>{
  const reset=()=>{if(pointer.current!==null)controls.current.releaseAim(pointer.current);pointer.current=null;setOffset([0,0]);setActive(false);};
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);reset();};
 },[controls]);
 const move=(e:RP<HTMLDivElement>)=>{
  if(pointer.current!==e.pointerId)return;
  const box=e.currentTarget.getBoundingClientRect(),radius=box.width*.32,x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2,aim=aimStickVector(x,y,radius);
  controls.current.pointerAim(e.pointerId,aim.x,aim.z,aim.active);setOffset([aim.x*radius,-aim.z*radius]);setActive(aim.active);
 };
 const down=(e:RP<HTMLDivElement>)=>{if(pointer.current!==null)return;e.preventDefault();e.stopPropagation();pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);move(e);};
 const up=(e:RP<HTMLDivElement>)=>{if(pointer.current!==e.pointerId)return;controls.current.releaseAim(e.pointerId);pointer.current=null;setOffset([0,0]);setActive(false);};
 return <div className="be-combat-controls">
  <div className="be-combat-actions"><CombatAction controls={controls} field="reload" label="RELOAD" onAction={onReload}/><CombatAction controls={controls} label="HOLSTER" onAction={onHolster}/><CombatAction controls={controls} field="punch" label="PUNCH" onAction={onPunch}/></div>
  <div className={'be-stick be-aim-stick'+(active?' is-firing':'')} role="group" aria-label="Aim and fire. Drag to aim and shoot; release to stop." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
   <span className="be-stick-guide">{active?'FIRING':'AIM / FIRE'}</span><i className="be-aim-ring"/><span className="be-stick-knob" style={{transform:`translate(${offset[0]}px,${offset[1]}px)`}}><svg viewBox="0 0 24 24" width="25" height="25" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" strokeWidth="1.5"/></svg></span>
  </div>
  <small className="be-combat-hint">J fire · R reload · F punch</small>
 </div>;
}

export function CombatHUD({arsenal,holstered=false}:{arsenal:Arsenal;holstered?:boolean}){
 const definition=WEAPON_DEFINITIONS[arsenal.selected],ammo=arsenal.ammo[arsenal.selected],reloading=arsenal.reloading===arsenal.selected;
 const progress=reloading?Math.max(0,Math.min(1,1-arsenal.reloadRemaining/definition.reload)):Math.max(0,ammo.magazine/definition.magazine);
 return <div className={'be-combat-hud'+(!ammo.magazine?' is-empty':'')} aria-label={`${holstered?'Holstered ':''}${definition.name}, ${ammo.magazine} loaded, ${ammo.reserve} reserve${reloading?', reloading':''}`}>
  <div><small>{holstered?'HOLSTERED':reloading?'RELOADING':definition.name.toUpperCase()}</small><b>{ammo.magazine}<span> / {ammo.reserve}</span></b></div>
  <i className="be-ammo-meter"><u style={{width:progress*100+'%'}}/></i>
  <span className="be-ammo-status">{reloading?arsenal.reloadRemaining.toFixed(1)+'s':!ammo.magazine?(ammo.reserve?'R · RELOAD':'OUT OF AMMO'):'LOADED / RESERVE'}</span>
 </div>;
}

export interface ArmouryPanelProps {arsenal:Arsenal;money:number;onWeapon:(id:WeaponId)=>void;onAmmo:(id:WeaponId)=>void;onUnlock:(id:WeaponId)=>void}
export function ArmouryPanel({arsenal,money,onWeapon,onAmmo,onUnlock}:ArmouryPanelProps){
 return <div className="be-armoury"><p className="be-armoury-intro">Choose your loadout. Ammo and unlocked weapons stay with you.</p><div className="be-armoury-wallet"><span>AVAILABLE CASH</span><b>{cash(money)}</b></div>
  <div className="be-armoury-weapons">{weaponIds.map((id,index)=>{
   const d=WEAPON_DEFINITIONS[id],unlocked=arsenal.unlocked.includes(id),ammo=arsenal.ammo[id],selected=arsenal.selected===id;
   return <article key={id} className={'be-armoury-weapon'+(selected?' is-selected':'')}>
    <header><span className="be-weapon-number">0{index+1}</span><div><h3>{d.name.toUpperCase()}</h3><small>{id==='pistol'?'PRECISE · SEMI AUTO':id==='shotgun'?'CLOSE RANGE · SPREAD':'FAST · AUTOMATIC'}</small></div><em>{unlocked?(selected?'EQUIPPED':'OWNED'):'LOCKED'}</em></header>
    <div className="be-weapon-stats"><span>MAGAZINE <b>{d.magazine}</b></span><span>RANGE <b>{d.range}m</b></span><span>RELOAD <b>{d.reload}s</b></span></div>
    {unlocked?<><p className="be-armoury-ammo">{ammo.magazine} loaded <span>·</span> {ammo.reserve} reserve</p><div className="be-armoury-buttons"><button type="button" onClick={()=>onWeapon(id)} aria-pressed={selected} disabled={selected}>{selected?'EQUIPPED':'EQUIP'}</button><button type="button" onClick={()=>onAmmo(id)} disabled={money<d.ammoPackCost||ammo.reserve>=999}>+{d.ammoPackSize} AMMO <b>{cash(d.ammoPackCost)}</b></button></div></>:<button type="button" className="be-unlock-weapon" disabled={money<d.unlockCost} onClick={()=>onUnlock(id)}>UNLOCK {d.name.toUpperCase()} <b>{cash(d.unlockCost)}</b></button>}
   </article>;
  })}</div><p className="be-armoury-help">On foot: left thumb moves, right thumb aims and fires. Release to stop shooting. Keyboard: 1 / 2 / 3 select, J fire, R reload, F punch.</p>
 </div>;
}
