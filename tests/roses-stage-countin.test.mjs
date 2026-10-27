import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({stdin:{contents:`export {fourBeatCountIn} from './src/piano/fourBeatCountIn';export {spaceStartsRosesPerformance,PedalInput} from './src/piano/pedalInput';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {fourBeatCountIn,spaceStartsRosesPerformance,PedalInput}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function fakeClock(){
 let now=0,next=0;const timers=new Map();
 return {
  setTimeout(fn,delay){const id=++next;timers.set(id,{at:now+delay,fn});return id;},
  clearTimeout(id){timers.delete(id);},
  advance(ms){const end=now+ms;while(true){const due=[...timers].sort((a,b)=>a[1].at-b[1].at).find(([,value])=>value.at<=end);if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=end;},
  count:()=>timers.size,
 };
}

test('count-in shows 1–4 at 100 BPM and completes only on the next downbeat',async()=>{
 const clock=fakeClock(),beats=[];let complete=false;
 const count=fourBeatCountIn(600,beat=>beats.push(beat),clock);
 void count.promise.then(()=>{complete=true;});
 assert.deepEqual(beats,[1]);clock.advance(599);assert.deepEqual(beats,[1]);
 clock.advance(1);assert.deepEqual(beats,[1,2]);clock.advance(600);assert.deepEqual(beats,[1,2,3]);
 clock.advance(600);assert.deepEqual(beats,[1,2,3,4]);clock.advance(599);assert.equal(complete,false);
 clock.advance(1);assert.equal(await count.promise,'complete');assert.equal(clock.count(),0);
});

test('cancelling the count-in clears every later beat and cannot launch a stale start',async()=>{
 const clock=fakeClock(),beats=[];const count=fourBeatCountIn(600,beat=>beats.push(beat),clock);
 clock.advance(650);count.cancel();assert.equal(await count.promise,'cancelled');
 clock.advance(5000);assert.deepEqual(beats,[1,2]);assert.equal(clock.count(),0);
});

test('Space starts only an idle Roses performance and retains pedal behavior once running',()=>{
 let pedalToggles=0,starts=0;const pedal=new PedalInput(()=>pedalToggles++);
 const key=(status,repeat=false)=>({code:'Space',repeat,metaKey:false,ctrlKey:false,altKey:false,target:null,preventDefault(){}});
 const down=(view,song,status,event)=>{if(spaceStartsRosesPerformance(view,song,status)){if(!event.repeat)starts++;return;}pedal.keydown(event);};
 down('performance','roses','idle',key('idle'));assert.deepEqual([starts,pedalToggles],[1,0]);
 down('performance','roses','idle',key('idle',true));assert.deepEqual([starts,pedalToggles],[1,0]);
 pedal.keyup(key('idle'));down('performance','roses','running',key('running'));assert.deepEqual([starts,pedalToggles],[1,1]);
 down('performance','roses','running',key('running',true));assert.equal(pedalToggles,1);
 pedal.keyup(key('running'));down('performance','levels','idle',key('idle'));assert.equal(pedalToggles,2);
});


test('count-in hands off 50 ms early for Tone’s scheduled transport start',async()=>{
 const clock=fakeClock(),beats=[];const count=fourBeatCountIn(600,beat=>beats.push(beat),clock,50);
 clock.advance(2349);assert.deepEqual(beats,[1,2,3,4]);assert.equal(clock.count(),1);
 clock.advance(1);assert.equal(await count.promise,'complete');assert.equal(clock.count(),0);
});
