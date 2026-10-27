import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const result=await build({stdin:{contents:`export {default as Piano} from './src/components/PianoCanvas';export {begin,commit,unmount} from 'react';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'piano-hooks',setup(builder){
 builder.onResolve({filter:/^react(?:\/jsx-runtime)?$/},args=>({path:args.path,namespace:'piano-test'}));
 builder.onLoad({filter:/.*/,namespace:'piano-test'},args=>({loader:'js',contents:args.path==='react/jsx-runtime'?`
 export const jsx=(type,props)=>{if(type==='canvas')props.ref.current=globalThis.__pianoCanvas;return {type,props};};
 `:`
 const slots=[];let index=0;const effects=[];
 export const begin=()=>{index=0;};
 export const memo=fn=>fn;
 export const useRef=value=>slots[index++]??(slots[index-1]={current:value});
 export const useState=value=>[value,()=>{}];
 export const useEffect=(fn,deps)=>{const id=index++,old=slots[id];if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i])))effects.push(()=>{old?.cleanup?.();slots[id]={deps,cleanup:fn()};});};
 export const commit=()=>{for(const effect of effects.splice(0))effect();};
 export const unmount=()=>{for(const slot of slots)slot?.cleanup?.();slots.length=0;};
 `}));
}}]});
const {Piano,begin,commit,unmount}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('Roses piano coalesces resize and rapid key paints and cancels obsolete frames',()=>{
 const names=['window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','__pianoCanvas'];
 const saved=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
 const frames=new Map(),observers=new Set();let serial=0,paints=0;
 globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
 globalThis.requestAnimationFrame=callback=>{frames.set(++serial,callback);return serial;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;observers.add(this);}observe(){}disconnect(){observers.delete(this);}};
 const ctx=new Proxy({clearRect(){paints++;},createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}});
 globalThis.__pianoCanvas={getBoundingClientRect:()=>({width:1200,height:220}),getContext:()=>ctx};
 const props={active:[],map:{id:'test',name:'Test',bindings:[{code:'KeyT',label:'T',midi:64}]},transpose:0,range:{low:60,high:72},presentation:'roses',cinematicLighting:true};
 const render=active=>{begin();Piano({...props,active});commit();};
 const tick=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback());};
 try{
  render([]);
  for(let i=0;i<12;i++){render([60+i]);for(const observer of observers)observer.callback();}
  assert.equal(paints,0,'React commits and resize callbacks never paint synchronously');
  assert.equal(frames.size,1);tick();assert.equal(paints,1);assert.equal(frames.size,0);
  render([]);tick();assert.equal(paints,2,'key release paints on the next frame');
  render([64]);unmount();assert.equal(frames.size,0);assert.equal(observers.size,0);
 }finally{unmount();for(const [name,value] of Object.entries(saved))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
