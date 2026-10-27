import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export {default as Visualizer} from './src/components/PerformanceVisualizer';export {begin,flush,dispose} from 'react';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'persistent-hooks',setup(b){
 b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},args=>({path:args.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path.endsWith('jsx-runtime')?`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`:`
 let index=0;const slots=[],pending=[];export const begin=()=>{index=0;};
 export function useRef(value){const at=index++;return slots[at]??(slots[at]={current:value===null?globalThis.__warpCanvas:value});}
 export function useEffect(fn,deps){const at=index++,prior=slots[at];if(!prior||deps.some((value,i)=>value!==prior.deps[i])){const next={deps,cleanup:prior?.cleanup};slots[at]=next;pending.push(()=>{next.cleanup?.();next.cleanup=fn();});}}
 export const flush=()=>{for(const fn of pending.splice(0))fn();};
 export const dispose=()=>{for(const slot of slots)slot?.cleanup?.();slots.length=0;pending.length=0;};
 `,loader:'js'}));
}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('the real visualizer changes from Levels through warp to Interstellar with one frame loop and one main observer',()=>{
 const saved=Object.fromEntries(['window','document','performance','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','__warpCanvas'].map(key=>[key,globalThis[key]]));
 let now=10000,serial=0,observed=0,disconnected=0,cleanupReads=0;const frames=new Map(),timers=new Map();
 globalThis.performance={now:()=>now};globalThis.window={devicePixelRatio:2,matchMedia:()=>({matches:false}),setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
 const context=()=>new Proxy({globalAlpha:1,createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
 const main=context(),piano={getBoundingClientRect:()=>({left:0,top:538,width:1366,height:230})};
 globalThis.document={hidden:false,createElement:()=>({width:0,height:0,getContext:()=>context()})};globalThis.ResizeObserver=class{observe(){observed++;}disconnect(){disconnected++;}};
 globalThis.requestAnimationFrame=fn=>{const id=++serial;frames.set(id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.__warpCanvas={width:0,height:0,getContext(){cleanupReads++;return main;},getBoundingClientRect:()=>({left:0,top:0,width:1366,height:538}),parentElement:{querySelector:()=>piano}};
 const notes={visible:()=>[]},map={id:'test',bindings:[]};
 const render=props=>{api.begin();api.Visualizer({notes,map,transpose:0,theme:'levels',notesPerSecond:0,presentation:'levels',lightweight:true,...props});api.flush();};
 const tick=at=>{now=at;const work=[...frames.values()];frames.clear();for(const fn of work)fn();};
 try{
  render({});assert.equal(frames.size,1);assert.equal(cleanupReads,1);assert.equal(observed,2);
  const warp={active:true,startedAt:now,switched:false,run:1};render({levelsWarp:warp});tick(10500);assert.equal(frames.size,1);
  render({presentation:'interstellar',theme:'cosmic',lightweight:false,levelsWarp:{...warp,switched:true}});tick(14100);
  assert.equal(cleanupReads,1,'the canvas context and live orb were never remounted at the song switch');assert.equal(observed,2);assert.equal(frames.size,1);
  render({presentation:'interstellar',theme:'cosmic',lightweight:false});tick(15100);assert.equal(frames.size,1);assert.equal(cleanupReads,1);
  api.dispose();assert.equal(disconnected,1);assert.equal(frames.size,0);assert.equal(timers.size,0);
 }finally{api.dispose();for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
