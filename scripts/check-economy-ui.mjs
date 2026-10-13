import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'blacktop-economy-ui-'));
try{
 const file=path.join(dir,'ui.cjs');await build({stdin:{contents:"import {renderToStaticMarkup} from 'react-dom/server'; import {createElement} from 'react'; import {MarketIntel} from './src/crime/EconomyPanels.tsx'; import {initial} from './src/crime/Systems.ts'; export function renderAt(time){const s=initial();s.economy.seconds=time;return renderToStaticMarkup(createElement(MarketIntel,{save:s,onNavigate:()=>{}}));}",resolveDir:process.cwd(),loader:'tsx'},jsx:'automatic',bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});
 const {renderAt}=(await import(pathToFileURL(file).href)).default;
 for(const at of [.1,.5,59.7,60.1,119.5,179.9]){const markup=renderAt(at);assert.doesNotMatch(markup,/\d+:60 left/,'rounded event countdown must carry seconds into minutes');}
 console.log('PASS fractional event countdowns carry seconds correctly');
}finally{await rm(dir,{recursive:true,force:true});}
