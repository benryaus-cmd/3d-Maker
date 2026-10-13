import assert from 'node:assert/strict';import {initial,saveGame,readSave} from '../src/crime/Systems.ts';
const fresh=initial();assert.ok(fresh.arsenal&&fresh.empire&&fresh.police,'fresh game must persist combat, factions and police state');
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
fresh.arsenal.ammo.pistol.magazine=3;fresh.arsenal.ammo.pistol.reserve=7;fresh.health=62;fresh.empire.streetReputation=18;fresh.empire.businesses['midtown-garage'].owned=true;
assert.ok(saveGame(fresh));const reload=readSave();assert.equal(reload.arsenal.ammo.pistol.magazine,3);assert.equal(reload.arsenal.ammo.pistol.reserve,7);assert.equal(reload.health,62);assert.equal(reload.empire.streetReputation,18);assert.ok(reload.empire.businesses['midtown-garage'].owned);
const legacy=initial();delete legacy.arsenal;delete legacy.empire;delete legacy.police;delete legacy.health;delete legacy.encounters;legacy.version=3;legacy.money=4321;legacy.economy.sequence=19;
memory.set('blacktop-empire-save-v2',JSON.stringify(legacy));const migrated=readSave();assert.equal(migrated.money,4321);assert.equal(migrated.economy.sequence,19);assert.equal(migrated.arsenal.ammo.pistol.magazine,12);assert.equal(migrated.version,4);
console.log('PASS integrated combat/empire save and v3 migration preserve economy');
