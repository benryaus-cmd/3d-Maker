export type Daylight = {day:number;night:number;dawn:number;dusk:number;golden:number};
const smooth=(t:number)=>t*t*(3-2*t);
/** Full day 06–20; golden shoulder 20–21; pink dusk 21–22; night 22–05. */
export function daylightAt(hours:number):Daylight {
 const h=Number.isFinite(hours)?((hours%24)+24)%24:12;
 if(h<5||h>=22)return {day:0,night:1,dawn:0,dusk:0,golden:0};
 if(h<6){const day=smooth(h-5);return {day,night:1-day,dawn:Math.sin(Math.PI*(h-5))**2,dusk:0,golden:0};}
 if(h<=20)return {day:1,night:0,dawn:0,dusk:0,golden:0};
 if(h<21)return {day:1,night:0,dawn:0,dusk:0,golden:Math.sin(Math.PI*(h-20))**2};
 const night=smooth(h-21);return {day:1-night,night,dawn:0,dusk:Math.sin(Math.PI*(h-21))**2,golden:0};
}
