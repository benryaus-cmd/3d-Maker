import {CITY_EDGE,DISTRICTS,ROAD_TILES,ROAD_TILE_SIZE,roadRoute} from './CityLayout';
import {MARKETS} from './Systems';
type MapRadar={player:[number,number];heading:number;parked:[number,number]|null;target:[number,number]|null;cops:[number,number][];traffic:[number,number][]};
const SCALE=178/CITY_EDGE;
export const mapPoint=(x:number,z:number)=>[200+x*SCALE,200-z*SCALE];
export function CityMap({radar,onPick}:{radar:MapRadar;onPick:(id:string)=>void}){
 const [px,py]=mapPoint(...radar.player),route=radar.target?roadRoute({x:radar.player[0],z:radar.player[1]},{x:radar.target[0],z:radar.target[1]}):[];
 const car=radar.parked?mapPoint(...radar.parked):null;
 return <div className="be-citymap"><p className="be-maphelp">Tap a market to set your route.</p><svg viewBox="0 0 400 400" role="img" aria-label="Expanded city map with nine districts, roads, markets and your location">
  <rect width="400" height="400" rx="12" fill="#102029"/>
  {DISTRICTS.map(d=>{const [x,y]=mapPoint(d.x-60,d.z+60);return <g key={d.id}><rect x={x} y={y} width={120*SCALE} height={120*SCALE} fill={'#'+d.color.toString(16).padStart(6,'0')} opacity=".18"/></g>;})}
  <g stroke="#576870" strokeWidth={10.5*SCALE} strokeLinecap="round">{ROAD_TILES.flatMap(t=>[1,2].filter(bit=>t.mask&bit).map(bit=>{const [x,y]=mapPoint(t.x,t.z),[nx,ny]=mapPoint(t.x+(bit===2?ROAD_TILE_SIZE:0),t.z+(bit===1?ROAD_TILE_SIZE:0));return <line key={t.x+':'+t.z+':'+bit} x1={x} y1={y} x2={nx} y2={ny}/>;}))}</g>
  {DISTRICTS.map(d=>{const [x,y]=mapPoint(d.x-60,d.z+60);return <g key={'label-'+d.id} pointerEvents="none"><rect x={x+5} y={y+5} width={Math.min(105,d.name.length*5.1+10)} height="15" rx="3" fill="#14262d" opacity=".88"/><text x={x+9} y={y+16} fill="#dce6e7" fontSize="10" fontFamily="Rajdhani,sans-serif" fontWeight="600">{d.name.toUpperCase()}</text></g>;})}
  {route.length>1&&<polyline points={route.map(p=>mapPoint(p.x,p.z).join(',')).join(' ')} fill="none" stroke="#67e2f5" strokeWidth="2" strokeDasharray="4 3"/>}
  {radar.traffic.map((p,i)=>{const [x,y]=mapPoint(...p);return <circle key={'t'+i} cx={x} cy={y} r="2" fill="#a1b2bd"/>;})}
  {radar.cops.map((p,i)=>{const [x,y]=mapPoint(...p);return <circle key={'p'+i} cx={x} cy={y} r="3" fill="#4c9aff"/>;})}
  {MARKETS.map(m=>{const [x,y]=mapPoint(m.x,m.z);return <g key={m.id} role="button" tabIndex={0} aria-label={'Route to '+m.name} className="be-mapmarket" onClick={()=>onPick(m.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(m.id);}}}><circle cx={x} cy={y} r="12" fill="transparent"/><circle cx={x} cy={y} r="5" fill="#e8ad62" stroke="#17232b" strokeWidth="2"/><text x={x+8} y={y+3} fill="#f6e2bd" fontSize="8" fontFamily="Rajdhani,sans-serif">{m.id==='midtown'?'M':m.name.split(' ')[0]}</text></g>;})}
  {car&&<rect x={car[0]-3.5} y={car[1]-5} width="7" height="10" rx="2" fill="#67d4e6" stroke="#0c1c24"/>}
  <g transform={`translate(${px} ${py}) rotate(${radar.heading*180/Math.PI})`}><circle r="9" fill="#f5d08c" opacity=".17"/><path d="M0 -7 L5 5 L0 2 L-5 5Z" fill="#ffe2a7" stroke="#102029" strokeWidth="1.2"/></g>
  <text x="383" y="16" textAnchor="middle" fill="#a9c7ca" fontSize="10">N ↑</text>
 </svg><div className="be-maplegend"><span><i style={{background:'#ffe2a7'}}/>YOU</span><span><i style={{background:'#e8ad62'}}/>MARKET</span><span><i style={{background:'#67d4e6'}}/>CAR</span><span><i style={{background:'#4c9aff'}}/>POLICE</span></div></div>;
}
