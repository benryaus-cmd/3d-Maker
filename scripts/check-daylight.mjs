import assert from 'node:assert/strict';
import {daylightAt} from '../src/crime/Daylight.ts';
for(const h of [0,1,4.99,22,23.99,24,48,-1])assert.deepEqual(daylightAt(h),{day:0,night:1,dawn:0,dusk:0,golden:0});
for(const h of [6,12,19.99,20])assert.deepEqual(daylightAt(h),{day:1,night:0,dawn:0,dusk:0,golden:0});
assert.deepEqual(daylightAt(5),{day:0,night:1,dawn:0,dusk:0,golden:0});
assert.deepEqual(daylightAt(21),{day:1,night:0,dawn:0,dusk:0,golden:0});
assert.ok(daylightAt(5.5).dawn>.99&&daylightAt(5.5).night===.5,'yellow dawn window');
assert.ok(daylightAt(20.5).golden===1&&daylightAt(20.5).dusk===0&&daylightAt(20.5).day===1,'golden shoulder preserves full daylight');
assert.ok(daylightAt(21.5).dusk===1&&daylightAt(21.5).golden===0&&daylightAt(21.5).night===.5,'pink dusk window');
for(let h=0;h<24;h+=.01){const d=daylightAt(h);for(const v of Object.values(d))assert.ok(v>=0&&v<=1);assert.ok(Math.abs(d.day+d.night-1)<1e-12);if(h<5||h>6)assert.equal(d.dawn,0);if(h<21||h>22)assert.equal(d.dusk,0);if(h<20||h>21)assert.equal(d.golden,0);}
for(const h of [0,5,6,20,21,22,24])for(const key of ['day','night','dawn','dusk','golden']){const eps=1e-5,left=(daylightAt(h)[key]-daylightAt(h-eps)[key])/eps,right=(daylightAt(h+eps)[key]-daylightAt(h)[key])/eps;assert.ok(Math.abs(left-right)<.001,`${h}: ${key} C1 transition`);}
console.log('Daylight boundaries, night wrap, hue windows and smooth C1 fades passed.');
