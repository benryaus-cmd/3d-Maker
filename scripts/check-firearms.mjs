import assert from 'node:assert/strict';
import console from 'node:console';
import {createArsenal,restoreArsenal,stepArsenal,selectWeapon,reloadWeapon,unlockWeapon,shootWeapon,WEAPON_DEFINITIONS,createEnemyCombat,enemyCombatIntent,hasLineOfSight,hearGunshot} from '../src/crime/Firearms.ts';
const actor=(id,z,x=0)=>({id,x,z,hp:100,radius:.5});
const muzzle={x:0,z:0,heading:0};
const fire=(s,t=[],w=[])=>shootWeapon(s,muzzle,t,w,0);
let s=createArsenal();
assert.equal(s.selected,'pistol');assert.equal(selectWeapon(s,'smg'),false);
let shot=fire(s,[actor('far',12),actor('near',6)]);
assert.equal(shot.hits[0].id,'near');assert.equal(shot.hits[0].damage,WEAPON_DEFINITIONS.pistol.damage);assert.equal(shot.rays[0].end.z,5.5);
assert.equal(fire(s).fired,false);stepArsenal(s,1);assert.equal(fire(s).fired,true);
s=createArsenal();const wall={x:0,z:3,w:2,d:1};shot=fire(s,[actor('behind',6)],[wall]);assert.equal(shot.hits[0].kind,'wall');assert.equal(shot.damage,0);assert.equal(shot.rays[0].end.z,2.5);
s=createArsenal();shot=fire(s,[actor('behind',6)],[{...wall,broken:true}]);assert.equal(shot.hits[0].id,'behind');
s=createArsenal();shot=fire(s,[actor('dead',2),actor('live',6)].map(t=>({...t,hp:t.id==='dead'?0:100})));assert.equal(shot.hits[0].id,'live');
s=createArsenal();shot=fire(s,[{kind:'car',id:'car',x:0,z:4,hp:100,heading:Math.PI/2,halfWidth:1,halfLength:2},actor('behind',8)]);assert.equal(shot.hits[0].kind,'car');assert.ok(Math.abs(shot.rays[0].end.z-3)<1e-8);
s=createArsenal();for(let i=0;i<WEAPON_DEFINITIONS.pistol.magazine;i++){assert.ok(fire(s).fired);stepArsenal(s,1);}assert.equal(fire(s).reason,'empty');let before=s.ammo.pistol.reserve;assert.ok(reloadWeapon(s));assert.equal(fire(s).reason,'reloading');stepArsenal(s,.5);assert.equal(s.ammo.pistol.magazine,0);stepArsenal(s,2);assert.equal(s.ammo.pistol.magazine,WEAPON_DEFINITIONS.pistol.magazine);assert.equal(s.ammo.pistol.reserve,before-WEAPON_DEFINITIONS.pistol.magazine);
assert.ok(unlockWeapon(s,'shotgun'));fire(s);assert.ok(reloadWeapon(s));const ammo=s.ammo.pistol.magazine;assert.ok(selectWeapon(s,'shotgun'));stepArsenal(s,3);assert.equal(s.ammo.pistol.magazine,ammo);assert.equal(s.reloading,null);assert.equal(fire(s,[actor('near',6)]).rays.length,7);
const restored=restoreArsenal({selected:'smg',unlocked:['pistol','smg'],ammo:{pistol:{magazine:Infinity,reserve:-1},smg:{magazine:9999,reserve:99999}},cooldown:NaN,reloadRemaining:Infinity,shotsFired:Infinity});assert.ok(Number.isFinite(restored.cooldown));assert.equal(restored.ammo.smg.magazine,WEAPON_DEFINITIONS.smg.magazine);assert.ok(restored.ammo.smg.reserve<=999);assert.equal(restored.ammo.pistol.reserve,0);assert.deepEqual(restoreArsenal(JSON.parse(JSON.stringify(s))),s);
s=createArsenal();assert.equal(shootWeapon(s,{x:NaN,z:0,heading:0},[],[],0).fired,false);assert.ok(fire(s).rays.every(r=>[r.start.x,r.start.z,r.end.x,r.end.z].every(Number.isFinite)));
assert.equal(hasLineOfSight(muzzle,actor('player',10),[wall]),false);assert.equal(hasLineOfSight(muzzle,actor('player',10),[{...wall,broken:true}]),true);
let e=createEnemyCombat();const enemy={x:0,z:0,heading:0,hp:100};let intent=enemyCombatIntent(e,enemy,actor('player',10),.1,0,[]);assert.equal(intent.mode,'windup');assert.equal(intent.shoot,false);assert.ok(intent.windup>0);intent=enemyCombatIntent(e,enemy,actor('player',10),.5,.5,[]);assert.equal(intent.shoot,true);intent=enemyCombatIntent(e,enemy,actor('player',10),.1,.6,[]);assert.equal(intent.shoot,false);
e=createEnemyCombat();intent=enemyCombatIntent(e,enemy,actor('player',10),.5,0,[wall]);assert.equal(intent.visible,false);assert.equal(intent.shoot,false);assert.equal(intent.mode,'idle');
e=createEnemyCombat();enemyCombatIntent(e,enemy,actor('player',10),.1,0,[]);intent=enemyCombatIntent(e,enemy,actor('player',10),.5,.5,[wall]);assert.equal(intent.shoot,false);assert.ok(['investigate','cover'].includes(intent.mode));
e=createEnemyCombat();intent=enemyCombatIntent(e,{...enemy,hp:20},actor('player',10),.1,0,[]);assert.equal(intent.mode,'retreat');assert.ok(intent.vz<0);
e=createEnemyCombat();intent=enemyCombatIntent(e,enemy,actor('player',30),.1,0,[]);assert.equal(intent.mode,'reposition');assert.ok(intent.vz>0);

for(const id of ['pistol','shotgun','smg']){const d=WEAPON_DEFINITIONS[id];assert.ok(Number.isFinite(d.unlockCost));assert.equal(d.ammoPackCost,d.ammoCost*d.ammoPackSize);}
s=createArsenal();unlockWeapon(s,'smg');unlockWeapon(s,'shotgun');assert.deepEqual(restoreArsenal(JSON.parse(JSON.stringify(s))),s);
e=createEnemyCombat();enemyCombatIntent(e,enemy,actor('player',10),.1,0,[]);enemyCombatIntent(e,enemy,actor('player',10),.5,.5,[]);intent=enemyCombatIntent(e,enemy,actor('player',10),.1,.6,[{x:2,z:4,w:2,d:1}]);assert.equal(intent.mode,'cover');assert.ok(e.coverGoal&&Number.isFinite(e.coverGoal.x));

s=createArsenal();shot=fire(s,[{kind:"car",id:"wreck",x:0,z:4,hp:0,heading:0,halfWidth:1,halfLength:2},actor("behind",8)]);assert.equal(shot.hits[0].id,"wreck");assert.equal(shot.damage,0);
e=createEnemyCombat();assert.equal(hearGunshot(e,enemy,{x:0,z:12}),true);intent=enemyCombatIntent(e,enemy,actor("player",10),.1,0,[wall]);assert.equal(intent.mode,"investigate");assert.equal(intent.shoot,false);assert.equal(hearGunshot(e,enemy,{x:0,z:100}),false);

console.log('PASS firearms: nearest hit, walls/broken cover, actor/car hulls, finite geometry, cadence/ammo/reload/switch/save, enemy perception/windup/retreat/reposition');
