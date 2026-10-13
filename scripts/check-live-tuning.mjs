import assert from 'node:assert/strict';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const m=await import('../src/crime/LiveTuning.ts');
const object={power:10,volume:.4,flag:true};m.registerTuningObject('Fixture','fixture',object);
m.setTuning('fixture.power',17);m.setTuning('fixture.volume',.8);m.resetTuning('fixture.power');
assert.equal(object.power,10);assert.equal(object.volume,.8,'individual reset leaves other edits');
m.setTuning('fixture.flag',0);assert.equal(object.flag,false);
m.setTuning('live.clockOverride',-1);m.setTuning('live.engineVolume',0);
const encoded=JSON.parse(m.tuningJSON());assert.equal(encoded.game,'BLACKTOP EMPIRE');assert.equal(encoded.settings['live.engineVolume'],0);
const reloaded=await import('../src/crime/LiveTuning.ts?reload-test');assert.equal(reloaded.LIVE.clockOverride,-1,'automatic clock survives reload');assert.equal(reloaded.LIVE.engineVolume,0,'mute survives reload');
const before=m.tuningJSON();m.setTuning('fixture.power',NaN);assert.equal(m.tuningJSON(),before,'non-finite edits are ignored');
m.resetTuning();assert.equal(object.flag,true);assert.equal(m.LIVE.engineVolume,1);
console.log('PASS live registry: object bindings, individual/default reset, export, persistence, zero values, automatic clock and invalid edit');

const {WEAPON_DEFINITIONS,createArsenal}=await import('../src/crime/Firearms.ts');m.setTuning('weapon.pistol.startingReserve',9);assert.equal(createArsenal().ammo.pistol.reserve,9);assert.ok(!m.fields.some(f=>f.key.endsWith('.ammoCost')||f.key.endsWith('.recoil')));m.resetTuning();
const {newCar,pointTouchesCar}=await import('../src/crime/vehiclePhysics.ts');const car=newCar();assert.equal(pointTouchesCar(car,1.9,0,.1),false);m.setTuning('live.carHalfWidth',2.2);assert.equal(pointTouchesCar(car,1.9,0,.1),true);m.resetTuning();console.log('PASS starting ammunition uses live definitions and collision hull changes actual query');
