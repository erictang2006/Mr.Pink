import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Exercise the actual handlers with deterministic hook state, without an audio
// context or a browser. Browser layout and real device latency need manual QA.
const bundle=await build({stdin:{contents:`export {default as Roses} from './src/components/RosesPerformanceTransport';export {default as Manual} from './src/components/ManualPerformanceTransport';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'hook-harness',setup(b){
 b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},a=>({path:a.path,namespace:'hooks'}));
 b.onLoad({filter:/.*/,namespace:'hooks'},a=>({contents:a.path==='react'?`export const useState=(...a)=>globalThis.cinematicHooks.state(...a),useRef=(...a)=>globalThis.cinematicHooks.ref(...a),useEffect=(...a)=>globalThis.cinematicHooks.effect(...a);`:`export const Fragment='fragment',jsx=(type,props)=>({type,props}),jsxs=jsx;`}));
}}]});
const {Roses,Manual}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function mount(Component,props){
 let cursor=0;const slots=[],cleanups=[];
 const hooks={state(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=v;}];},ref(initial){const i=cursor++;return slots[i]??=( {current:initial});},effect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;cleanups.push(fn());}}};
 const render=()=>{cursor=0;globalThis.cinematicHooks=hooks;return Component(props);};
 return {render,unmount(){for(const cleanup of cleanups)cleanup?.();},props};
}
const text=node=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
function button(node,label){if(Array.isArray(node)){for(const child of node){const found=button(child,label);if(found)return found;}}else if(node&&typeof node==='object'){if(node.type==='button'&&text(node).includes(label))return node.props;return button(node.props?.children,label);}return undefined;}
const readyClock={status:'idle',vocalReady:true,closerReady:true,drop:{status:'idle'},bassPlaybackMode:'manual'};
const instantCountIn=(_beatMs,onBeat)=>{for(let beat=1;beat<=4;beat++)onBeat(beat);return {promise:Promise.resolve('complete'),cancel(){}};};
const transport=node=>Array.isArray(node)?node.map(transport).find(Boolean):node&&typeof node==='object'?(typeof node.props?.className==='string'&&node.props.className.includes('roses-stage-transport')?node:transport(node.props?.children)):undefined;

test('stage start prepares audio once, then starts the existing armed arrangement',async()=>{
 const gate=deferred();let prepares=0,starts=0;
 const ui=mount(Roses,{countIn:instantCountIn,ready:true,clock:readyClock,prepareAudio:()=>{prepares++;return gate.promise;},engine:{isReady:()=>true,preparePerformanceAudio:async()=>true,tempo:()=>100,snapshot:()=>({status:'idle'}),startArmedPerformance:async()=>{starts++;return true;}}});
 const click=button(ui.render(),'ARM + START').onClick;
 const first=click(),duplicate=click();assert.equal(prepares,1);assert.equal(starts,0);
 assert.ok(button(ui.render(),'PREPARING').disabled);
 gate.resolve();await Promise.all([first,duplicate]);assert.equal(starts,1);
 ui.props.clock={...readyClock,status:'running'};
 assert.ok(button(ui.render(),'Pause'));assert.equal(button(ui.render(),'ARM + START'),undefined);ui.unmount();
});

test('Stop and unmount cancel pending initialization without starting backing',async()=>{
 for(const cancel of ['stop','unmount']){
  const gate=deferred();let starts=0,resets=0;
  const ui=mount(Roses,{countIn:instantCountIn,ready:true,clock:readyClock,prepareAudio:()=>gate.promise,engine:{isReady:()=>true,preparePerformanceAudio:async()=>true,tempo:()=>100,snapshot:()=>({status:'idle'}),startArmedPerformance:async()=>{starts++;return true;},reset:bar=>{assert.equal(bar,1);resets++;}}});
  const pending=button(ui.render(),'ARM + START').onClick();
  if(cancel==='stop')button(ui.render(),'Stop').onClick();else ui.unmount();
  gate.resolve();await pending;assert.equal(starts,0);assert.equal(resets,cancel==='stop'?1:0);
 }
});

test('failed initialization or backing start never claims playback success',async()=>{
 for(const failPrepare of [true,false]){
  let starts=0;
  const ui=mount(Roses,{countIn:instantCountIn,ready:true,clock:readyClock,prepareAudio:async()=>{if(failPrepare)throw Error('unavailable');},engine:{isReady:()=>true,preparePerformanceAudio:async()=>true,tempo:()=>100,snapshot:()=>({status:'idle'}),startArmedPerformance:async()=>{starts++;return false;}}});
  await button(ui.render(),'ARM + START').onClick();
  assert.equal(starts,failPrepare?0:1);assert.match(text(ui.render()),/could not start/);assert.equal(button(ui.render(),'Pause'),undefined);ui.unmount();
 }
});

test('solo piano readiness reflects actual initialization and Cancel prevents a stale ready state',async()=>{
 const gate=deferred();let stops=0;
 const ui=mount(Manual,{prepare:()=>gate.promise,stop:()=>{stops++;}});
 const pending=button(ui.render(),'ARM + START').onClick();
 button(ui.render(),'Cancel').onClick();gate.resolve(true);await pending;
 assert.ok(button(ui.render(),'ARM + START'));assert.doesNotMatch(text(ui.render()),/LIVE INPUT READY/);assert.equal(stops,1);
 ui.props.prepare=async()=>false;await button(ui.render(),'ARM + START').onClick();assert.match(text(ui.render()),/not ready/);
 ui.props.prepare=async()=>true;await button(ui.render(),'ARM + START').onClick();assert.match(text(ui.render()),/LIVE INPUT READY/);assert.ok(button(ui.render(),'Stop'));ui.unmount();
});

test('audience start uses the same arrangement and revealing setup never restarts playback',async()=>{
 let starts=0,pauses=0;
 const ui=mount(Roses,{countIn:instantCountIn,audience:true,ready:true,clock:readyClock,engine:{isReady:()=>true,preparePerformanceAudio:async()=>true,tempo:()=>100,snapshot:()=>({status:'idle'}),startArmedPerformance:async()=>{starts++;return true;},pause:()=>pauses++}});
 try {
  assert.equal(button(ui.render(),'ARM + START'),undefined);
  await button(ui.render(),'START PERFORMANCE').onClick();assert.equal(starts,1);
  ui.props.clock={...readyClock,status:'running'};
  assert.equal(transport(ui.render()).props.hidden,true);
  ui.props.audience=false;
  assert.equal(transport(ui.render()).props.hidden,false);
  assert.equal(starts,1,'revealing controls does not restart or reschedule audio');
  button(ui.render(),'Pause').onClick();assert.equal(pauses,1);
  ui.props.audience=true;assert.equal(transport(ui.render()).props.hidden,true);assert.equal(starts,1);
 }finally{ui.unmount();}
});

test('Space triggers one count-in before Roses starts; stopping cancels a pending start',async()=>{
 const priorWindow=globalThis.window,priorDocument=globalThis.document;
 const listeners=new Map();
 const surface={addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)??[]),fn]);},removeEventListener(name,fn){listeners.set(name,(listeners.get(name)??[]).filter(item=>item!==fn));},dispatch(name,event){for(const fn of listeners.get(name)??[])fn(event);}};
 globalThis.window=surface;globalThis.document=surface;
 let status='idle',starts=0,resets=0,created=0,gate=deferred(),beats=[];
 const countIn=(_ms,onBeat)=>{created++;onBeat(1);beats.push(1);return{promise:gate.promise,cancel(){gate.resolve('cancelled');}};};
 const engine={isReady:()=>true,preparePerformanceAudio:async()=>true,tempo:()=>100,snapshot:()=>({status}),startArmedPerformance:async()=>{starts++;status='running';return true;},reset(){resets++;status='idle';}};
 const ui=mount(Roses,{audience:true,ready:true,clock:readyClock,countIn,engine});
 const press=()=>{let prevented=false;surface.dispatch('keydown',{code:'Space',repeat:false,defaultPrevented:false,metaKey:false,ctrlKey:false,altKey:false,target:null,preventDefault(){prevented=true;}});return prevented;};
 try{
  ui.render();assert.equal(press(),true);await Promise.resolve();await Promise.resolve();
  assert.equal(created,1);assert.equal(starts,0);assert.ok(button(ui.render(),'COUNTING IN'));
  assert.equal(press(),true);assert.equal(created,1,'a repeated physical start cannot queue a second take');
  gate.resolve('complete');await Promise.resolve();await Promise.resolve();
  assert.equal(starts,1);assert.equal(press(),false,'running Space is left to the pedal');assert.equal(created,1);
  status='idle';ui.props.clock=readyClock;gate=deferred();beats=[];
  assert.equal(press(),true);await Promise.resolve();await Promise.resolve();assert.equal(created,2);
  button(ui.render(),'Stop').onClick();await Promise.resolve();
  assert.equal(resets,1);assert.equal(starts,1,'Stop during count-in prevents later playback');
 }finally{ui.unmount();globalThis.window=priorWindow;globalThis.document=priorDocument;}
});
