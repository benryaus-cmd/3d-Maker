/** Aippy nested-host asset bridge.
 * Vite inlines these binary GLBs/OGGs as data URLs in the generated JS bundle.
 * Never rely on upstream/public being served as the host's root public directory.
 * This works both from the standalone 3d-Maker Vite build and from
 * src/games/importedGame/upstream/src/ in the existing Aippy host. */
import a0 from './bundled/vehicles/sedan.glb?url&inline';
import a1 from './bundled/vehicles/sedan-sports.glb?url&inline';
import a2 from './bundled/vehicles/police.glb?url&inline';
import a3 from './bundled/vehicles/taxi.glb?url&inline';
import a4 from './bundled/vehicles/suv.glb?url&inline';
import a5 from './bundled/vehicles/race.glb?url&inline';
import a6 from './bundled/buildings/building-a.glb?url&inline';
import a7 from './bundled/buildings/building-b.glb?url&inline';
import a8 from './bundled/buildings/building-c.glb?url&inline';
import a9 from './bundled/buildings/building-d.glb?url&inline';
import a10 from './bundled/buildings/building-skyscraper-a.glb?url&inline';
import a11 from './bundled/streets/dumpster.glb?url&inline';
import a12 from './bundled/streets/construction-barrier.glb?url&inline';
import a13 from './bundled/streets/construction-fence.glb?url&inline';
import a14 from './bundled/streets/light-curved.glb?url&inline';
import a15 from './bundled/streets/traffic-light.glb?url&inline';
import a16 from './bundled/streets/road-sign-stop.glb?url&inline';
import a17 from './bundled/streets/road-sign-warning.glb?url&inline';
import a18 from './bundled/streets/construction-cone.glb?url&inline';
import a19 from './bundled/streets/electricity-pole.glb?url&inline';
import a20 from './bundled/characters/casual-male.glb?url&inline';
import a21 from './bundled/characters/casual-female.glb?url&inline';
import a22 from './bundled/characters/worker-male.glb?url&inline';
import a23 from './bundled/characters/suit-female.glb?url&inline';
import a24 from './bundled/audio/engine.ogg?url&inline';
import a25 from './bundled/audio/skid.ogg?url&inline';
import a26 from './bundled/audio/impact.ogg?url&inline';
const assets:Record<string,string>={
 'vehicles/sedan.glb': a0,
 'vehicles/sedan-sports.glb': a1,
 'vehicles/police.glb': a2,
 'vehicles/taxi.glb': a3,
 'vehicles/suv.glb': a4,
 'vehicles/race.glb': a5,
 'buildings/building-a.glb': a6,
 'buildings/building-b.glb': a7,
 'buildings/building-c.glb': a8,
 'buildings/building-d.glb': a9,
 'buildings/building-skyscraper-a.glb': a10,
 'streets/dumpster.glb': a11,
 'streets/construction-barrier.glb': a12,
 'streets/construction-fence.glb': a13,
 'streets/light-curved.glb': a14,
 'streets/traffic-light.glb': a15,
 'streets/road-sign-stop.glb': a16,
 'streets/road-sign-warning.glb': a17,
 'streets/construction-cone.glb': a18,
 'streets/electricity-pole.glb': a19,
 'characters/casual-male.glb': a20,
 'characters/casual-female.glb': a21,
 'characters/worker-male.glb': a22,
 'characters/suit-female.glb': a23,
 'audio/engine.ogg': a24,
 'audio/skid.ogg': a25,
 'audio/impact.ogg': a26,
};
export function crimeAssetURL(path:string):string{
 const url=assets[path];
 if(!url)throw new Error('BLACKTOP ASSET NOT BUNDLED: '+path);
 return url;
}
export function checkCrimeAssets():{fileCount:number;missing:string[]}{
 const missing=Object.entries(assets).filter(([,url])=>!url||(!url.startsWith('data:')&&!url.startsWith('blob:')&&!url.startsWith('/')));
 return {fileCount:Object.keys(assets).length,missing:missing.map(([path])=>path)};
}
