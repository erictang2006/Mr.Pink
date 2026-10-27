/** Local, headless stress audit. This measures JS dispatch, never browser/GPU/audio latency. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const work=await mkdtemp(join(tmpdir(),'mr-pink-stress-'));
try{
 const result=await build({stdin:{contents:`
 export {KeyboardInputManager} from './src/piano/keyboardInput';
 export {levelsEMajor} from './src/piano/levelsRealPiano';
 export {mapForInterstellarSection} from './src/piano/interstellarPerformance';
 export {rosesMap} from './src/piano/roses';
 export {rosesLiveChordShortcuts} from './src/piano/rosesIndividualChords';
 export {StarlightScene,starlightLimits} from './src/components/starlight';
 export {LiveNotes} from './src/piano/liveNotes';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
 const entry=join(work,'runtime.mjs');await writeFile(entry,result.outputFiles[0].text);
 const api=await import(pathToFileURL(entry).href);
 class Target{
  listeners=new Map();timers=new Map();serial=0;
  addEventListener(type,fn){const list=this.listeners.get(type)??new Set();list.add(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  send(type,event){for(const fn of this.listeners.get(type)??[])fn(event);}
  setInterval=(fn)=>{const id=++this.serial;this.timers.set(id,fn);return id;};
  clearInterval=(id)=>this.timers.delete(id);
  count(){return [...this.listeners.values()].reduce((n,list)=>n+list.size,0);}
 }
 const samples=[],cases=[];let dispatched=0;
 for(const [name,map,chords] of [
  ['Levels real piano',api.levelsEMajor],
  ...[1,2,3].map(section=>[`Interstellar section ${section}`,api.mapForInterstellarSection(section)]),
  ['Roses live chords',api.rosesMap,api.rosesLiveChordShortcuts],
 ]){
  globalThis.window=new Target();globalThis.document=new Target();document.hidden=false;
  const held=new Map();let attacks=0,releases=0,snapshots=0;
  const on=(midi,code)=>{const key=`${code}:${midi}`;held.set(key,(held.get(key)??0)+1);attacks++;};
  const off=(midi,code)=>{const key=`${code}:${midi}`,count=held.get(key)??0;assert.ok(count>0,`unmatched release ${key}`);if(count===1)held.delete(key);else held.set(key,count-1);releases++;};
  const manager=new api.KeyboardInputManager(map,{noteOn:on,noteOff:off,chordOn:(pitches,code)=>pitches.forEach(p=>on(p,code)),chordOff:(pitches,code)=>pitches.forEach(p=>off(p,code)),change(){snapshots++;}});
  if(chords)manager.setChords(chords);manager.setEnabled(true);
  const codes=[...new Set([...Object.keys(chords??{}),...map.bindings.map(b=>b.code)])];
  const send=(type,code,repeat=false)=>{
   const event={code,key:code,repeat,shiftKey:false,metaKey:false,ctrlKey:false,altKey:false,isComposing:false,target:null,preventDefault(){}};
   const start=performance.now();window.send(type,event);samples.push(performance.now()-start);dispatched++;
  };
  const start=performance.now();
  for(let cycle=0;cycle<3000;cycle++){
   const chord=Array.from({length:Math.min(codes.length,1+cycle%12)},(_,i)=>codes[(cycle*7+i)%codes.length]);
   for(const code of chord){send('keydown',code);if(cycle%5===0)send('keydown',code,true);}
   if(cycle%17===0)window.send('blur');
   if(cycle%31===0){manager.setTranspose(1);manager.setTranspose(0);}
   if(cycle%97===0)manager.setMap(map);
   if(cycle%43===0){document.hidden=true;document.send('visibilitychange');document.hidden=false;}
   for(const code of chord.reverse())send('keyup',code);
   if(cycle%100===0){manager.setEnabled(false);manager.setEnabled(true);}
   assert.equal(held.size,0,`${name} cycle ${cycle} leaves no held voice`);
  }
  manager.dispose();assert.equal(attacks,releases);assert.equal(window.count()+document.count(),0);assert.equal(window.timers.size,0);
  cases.push({name,cycles:3000,attacks,releases,snapshots,jsStressDurationMs:Number((performance.now()-start).toFixed(2)),remainingHeld:held.size,remainingListeners:window.count()+document.count(),remainingTimers:window.timers.size});
 }
 // Ten simulated minutes of dense Interstellar effects; time advances explicitly.
 const scene=new api.StarlightScene(),notes=new api.LiveNotes();let id=0,peakParticles=0,peakVisible=0;
 for(let frame=0;frame<36000;frame++){
  const now=frame*1000/60;
  if(frame%6===0)for(let pitch=0;pitch<8;pitch++){const code=`stress:${id++}`;notes.on(code,48+pitch,now);notes.off(code,now+25,frame%12===0);}
  if(frame%60===0)notes.pedalUp(now);
  const visible=notes.visible(now,4400);scene.update(visible,now,false,true);
  peakParticles=Math.max(peakParticles,scene.particles.length);peakVisible=Math.max(peakVisible,visible.length);
  assert.ok(scene.particles.length<=192);assert.ok(scene.pulses.length<=api.starlightLimits.pulses);
 }
 notes.pedalUp(600100);notes.clear();scene.update([],610000);assert.equal(scene.particles.length,0);assert.equal(scene.pulses.length,0);assert.equal(notes.soundingNotes().length,0);
 samples.sort((a,b)=>a-b);
 const percentile=p=>Number(samples[Math.min(samples.length-1,Math.floor(samples.length*p))].toFixed(4));
 const report={createdAt:new Date().toISOString(),scope:'Headless JavaScript dispatch/state stress only. No browser paint, Web Audio rendering, speaker latency, GPU, or hardware keyboard rollover measurement.',input:{dispatched,cases,dispatchJsMs:{median:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:percentile(1)}},visualSoak:{simulatedMinutes:10,frames:36000,generatedNotes:id,peakParticles,peakVisibleNotes:peakVisible,remainingParticles:scene.particles.length,remainingPulses:scene.pulses.length,remainingSoundingNotes:notes.soundingNotes().length}};
 const output=process.argv[2];if(output)await writeFile(resolve(output),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await rm(work,{recursive:true,force:true});}
