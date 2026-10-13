import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import ts from 'typescript';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
// Compile only the three real UI/domain modules using the project's declared TypeScript dependency.
// Keep temporary modules under the repo so Node resolves the same React installation as the game.
const dir=await mkdtemp(path.resolve('scripts/.economy-ui-'));
try{
 for(const name of ['Economy','Systems','EconomyPanels','Firearms','Empire','PoliceDirector','CityLayout','LiveTuning']){
  const file=name+(name==='EconomyPanels'?'.tsx':'.ts');let source=await readFile('src/crime/'+file,'utf8');
  source=source.replace(/(['"])\.\/([A-Za-z]+)(?:\.ts)?\1/g,(_match,_quote,name)=>"'./"+name+".mjs'");
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  await writeFile(path.join(dir,name+'.mjs'),compiled);
 }
 const {MarketIntel}=await import(pathToFileURL(path.join(dir,'EconomyPanels.mjs')).href),{initial}=await import(pathToFileURL(path.join(dir,'Systems.mjs')).href);
 for(const at of [.1,.5,59.7,60.1,119.5,179.9]){const save=initial();save.economy.seconds=at;
  const markup=renderToStaticMarkup(createElement(MarketIntel,{save,onNavigate:()=>{}}));assert.doesNotMatch(markup,/\d+:60 left/,'rounded event countdown must carry seconds into minutes');
 }
 console.log('PASS fractional event countdowns carry seconds correctly');
}finally{await rm(dir,{recursive:true,force:true});}
