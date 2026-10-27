import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/piano/audioPreparation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {DeferredAudioPreparation}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('Roses preparation is deferred, shared during loading and retained across song switches',async()=>{
 const preparation=new DeferredAudioPreparation();let calls=0,finish;
 const load=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 assert.equal(calls,0);
 const first=preparation.prepare(load),second=preparation.prepare(load);assert.equal(first,second);
 await Promise.resolve();assert.equal(calls,1);finish();await first;
 await preparation.prepare(load);assert.equal(calls,1,'returning to Roses reuses decoded buffers');
});

test('failed preparation retries once and an old rejection cannot clear newer assets',async()=>{
 const preparation=new DeferredAudioPreparation();let calls=0;
 await assert.rejects(preparation.prepare(async()=>{calls++;throw Error('missing asset');}),/missing asset/);
 await preparation.prepare(async()=>{calls++;});assert.equal(calls,2);
 preparation.reset();let rejectOld;
 const old=preparation.prepare(()=>new Promise((_,reject)=>{rejectOld=reject;}));await Promise.resolve();
 preparation.reset();const current=preparation.prepare(async()=>{calls++;});await current;
 rejectOld(Error('stale request'));await assert.rejects(old,/stale request/);
 assert.equal(preparation.prepare(async()=>{assert.fail('new assets must remain cached');}),current);
});
