import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Exercise the real animation frame with measured canvas/piano rectangles.
const bundle=await build({stdin:{contents:`export {default as Visualizer} from './src/components/PerformanceVisualizer';export {effects} from 'react';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'canvas-hooks',setup(builder){
 builder.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'canvas-test'}));
 builder.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'canvas-test'}));
 builder.onLoad({filter:/.*/,namespace:'canvas-test'},args=>({contents:args.path==='jsx'?`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`:`export const effects=[];export const useRef=value=>({current:value===null?globalThis.__stageCanvas:value});export const useEffect=callback=>effects.push(callback);`,loader:'js'}));
}}]});
const output='/private/tmp/mr-pink-performance-background-test.mjs';writeFileSync(output,bundle.outputFiles[0].text);
const {Visualizer,effects}=await import(pathToFileURL(output).href);

test('Roses paints the entire viewport while rising notes still start at the right-side piano edge',()=>{
 const originals=Object.fromEntries(['window','document','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','__stageCanvas'].map(key=>[key,globalThis[key]]));
 globalThis.window={devicePixelRatio:2,matchMedia:()=>({matches:false})};globalThis.document={hidden:false};
 globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 let draw;globalThis.requestAnimationFrame=callback=>{draw=callback;return 1;};globalThis.cancelAnimationFrame=()=>{};
 try{
  for(const [width,height,top] of [[1920,1080,880],[3840,2160,1900],[1280,720,590]]){
   const fills=[],bars=[],translations=[];
   const ctx=new Proxy({
    createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
    fillRect:(...args)=>fills.push(args),roundRect:(...args)=>bars.push(args),translate:(...args)=>translations.push(args),
   },{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
   const piano={getBoundingClientRect:()=>({left:width*.51,top,width:width*.6,height:height-top})};
   const canvas={getBoundingClientRect:()=>({left:0,top:0,width,height}),getContext:()=>ctx,parentElement:{querySelector:()=>piano}};
   globalThis.__stageCanvas=canvas;
   Visualizer({workstation:true,notes:{visible:now=>[{id:1,code:'KeyL',midi:64,startMs:now-1000,physicalEndMs:null,endMs:null,assisted:false,octave:false}]},map:{id:'test',bindings:[{code:'KeyL',label:'L',midi:64}]},range:{low:60,high:72},transpose:0,theme:'roses',notesPerSecond:1,presentation:'roses'});
   const cleanups=effects.splice(0).map(effect=>effect()).filter(Boolean);draw();
   assert.ok(fills.some(rect=>rect[0]===0&&rect[1]===0&&rect[2]===width&&rect[3]===height),'background includes the full piano/floor region');
   assert.ok(bars.length>0);assert.ok(bars.every(rect=>Math.abs(rect[1]+rect[3]-top)<1e-8),'note bars remain attached to the actual piano top');
   assert.ok(translations.some(([x,y])=>x===width*.51&&y===0),'notes align with the cropped right-side keyboard');
   assert.ok(canvas.width*canvas.height<=3205000,'the full-screen canvas respects its pixel budget');
   for(const cleanup of cleanups.reverse())cleanup();
  }
 }finally{for(const [key,value] of Object.entries(originals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
