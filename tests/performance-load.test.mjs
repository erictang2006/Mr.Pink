import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const bundle=await build({stdin:{contents:`export {OutputSignal,default as Workstation} from './src/components/PerformanceWorkstation';export {effects} from 'react';export {observed} from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},plugins:[{name:'frame-runtime',setup(builder){
 builder.onResolve({filter:/^(react|react\/jsx-runtime|tone)$/},args=>({path:args.path,namespace:'frame-test'}));
 builder.onLoad({filter:/.*/,namespace:'frame-test'},args=>({loader:'js',contents:args.path==='react'?`export const effects=[];export const useState=value=>[typeof value==='function'?value():value,()=>{}];export const useEffect=fn=>effects.push(fn);export const useRef=value=>({current:value===null?globalThis.__padRoot:value});`:args.path==='react/jsx-runtime'?`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`:`
 export const observed={created:0,disposed:0,reads:0,connected:[],disconnected:[],samples:new Float32Array(256).fill(.125)};
 const destination={connect(node){observed.connected.push(node);},disconnect(node){observed.disconnected.push(node);}};
 export const getDestination=()=>destination;
 export class Waveform {constructor(size){if(size!==256)throw Error('changed sample size');observed.created++;}getValue(){observed.reads++;return observed.samples;}dispose(){observed.disposed++;}}
 `}));
}}]});
const output='/private/tmp/mr-pink-performance-load-test.mjs';writeFileSync(output,bundle.outputFiles[0].text);
const {OutputSignal,Workstation,effects,observed}=await import(pathToFileURL(output).href);

function runtime(run){
 const saved=Object.fromEntries(['window','document','requestAnimationFrame','cancelAnimationFrame','__padRoot'].map(key=>[key,globalThis[key]]));
 const frames=new Map();let serial=0;
 globalThis.window={matchMedia:()=>({matches:false})};globalThis.document={hidden:false};
 globalThis.requestAnimationFrame=callback=>{frames.set(++serial,callback);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const tick=now=>{const current=[...frames.values()];frames.clear();for(const callback of current)callback(now);};
 try{run(tick,frames);}finally{for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}

test('output analysis preserves the exact waveform and RMS without drawing a hidden canvas',()=>runtime((tick,frames)=>{
 const level={current:0},waveform={current:undefined};
 assert.equal(OutputSignal({level,waveform}),null);
 const cleanup=effects.shift()();tick(100);
 assert.equal(waveform.current,observed.samples);assert.equal(level.current,.5);assert.equal(observed.reads,1);
 tick(120);assert.equal(observed.reads,1,'analysis keeps its existing 30 Hz budget');
 tick(140);assert.equal(observed.reads,2);
 document.hidden=true;tick(200);assert.equal(observed.reads,2);
 cleanup();assert.equal(observed.created,1);assert.equal(observed.disposed,1);
 assert.deepEqual(observed.disconnected,observed.connected);assert.equal(frames.size,0);assert.equal(level.current,0);assert.equal(waveform.current,undefined);
}));

test('idle instrument pads avoid repeated DOM scans and writes while live hits and fades still update',()=>runtime((tick,frames)=>{
 let scans=0,writes=0;const classes=[];
 const pad={dataset:{padId:'kick'},style:{setProperty(){writes++;}},classList:{toggle(name,value){classes.push({name,value});}}};
 globalThis.__padRoot={querySelectorAll(){scans++;return [pad];}};
 const snapshot={pressed:[],detected:[],shift:false};
 const props={pads:[{id:'kick',code:'KeyZ',key:'Z',label:'Kick',group:'Drums',kind:'live'}],snapshot,notes:{soundingNotes:()=>[],recentReleases:()=>[]},mappingName:'Roses',audience:true};
 Workstation(props);const cleanup=effects.shift()();tick(100);assert.equal(scans,1);assert.equal(writes,1);
 for(let now=140;now<1000;now+=40)tick(now);
 assert.equal(scans,1);assert.equal(writes,1,'unchanged pads are not restyled each frame');
 snapshot.detected=['KeyZ'];tick(1040);assert.equal(pad.dataset.strike,'a');assert.equal(classes.at(-1).value,true);assert.equal(writes,2);
 snapshot.detected=[];tick(1080);assert.equal(classes.at(-1).value,true,'release preserves the existing visual fade');
 tick(1440);assert.equal(classes.at(-1).value,false);const settled=writes;tick(1480);assert.equal(writes,settled);
 cleanup();assert.equal(frames.size,0);
}));
