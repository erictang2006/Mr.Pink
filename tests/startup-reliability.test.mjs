import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';
async function load(entry){const result=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);}
const {bootstrap}=await load('src/startup/bootstrap.ts');
const {default:Boundary}=await load('src/startup/StartupBoundary.tsx');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function text(node){return node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);}

test('slow settings retain visible startup status and App imports only after hydration',async()=>{
 const gate=deferred(),events=[];
 const pending=bootstrap({initialize:()=>gate.promise,load:async()=>{events.push('import');return 'app';},mount:app=>events.push(`mount:${app}`),onStatus:message=>events.push(message),onFailure:error=>assert.fail(String(error))});
 assert.deepEqual(events,['Loading your settings…']);
 gate.resolve();await pending;
 assert.deepEqual(events,['Loading your settings…','Loading the performance…','import','mount:app']);
});
test('settings, import and mount failures reach the recovery screen without unhandled rejections',async()=>{
 for(const step of ['initialize','load','mount']){
  const failure=new Error(`${step} failed`);let reported;
  await bootstrap({initialize:async()=>{if(step==='initialize')throw failure;},load:async()=>{if(step==='load')throw failure;return 'app';},mount:()=>{if(step==='mount')throw failure;},onStatus(){},onFailure:error=>{reported=error;}});
  assert.equal(reported,failure);
 }
});
test('performance and optional camera have independent recovery fallbacks',()=>{
 const performance=new Boundary({feature:'performance',children:'piano'}),camera=new Boundary({feature:'camera',children:'camera'});
 assert.equal(performance.render(),'piano');assert.equal(camera.render(),'camera');
 camera.state=Boundary.getDerivedStateFromError(new Error('No camera API'));
 assert.match(text(camera.render()),/performance can continue/);assert.equal(performance.render(),'piano');
 performance.state=Boundary.getDerivedStateFromError(new Error('Render failed'));
 assert.match(text(performance.render()),/saved settings have not been cleared/);assert.match(text(performance.render()),/Render failed/);assert.match(text(performance.render()),/Reload Mr. Pink/);
});
test('HTML startup fallback survives entry-module failure and never replaces a running performance',async()=>{
 const html=await readFile('index.html','utf8');
 assert.match(html,/<section id="startup-screen"/);assert.match(html,/id="startup-status" role="status"/);assert.match(html,/onclick="window.location.reload\(\)"/);
 const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 const events={},elements={'startup-status':{textContent:'Loading'},'startup-error':{hidden:true,textContent:''}};
 let delayed;
 const context={document:{getElementById:id=>elements[id]??null},window:{addEventListener:(type,fn)=>{events[type]=fn;},setTimeout:fn=>{delayed=fn;return 1;},clearTimeout(){}}};
 vm.runInNewContext(script,context);
 delayed();assert.match(elements['startup-status'].textContent,/Still loading/);
 events.error({message:'Failed to fetch module'});assert.match(elements['startup-status'].textContent,/could not finish loading/);assert.equal(elements['startup-error'].textContent,'Failed to fetch module');assert.equal(elements['startup-error'].hidden,false);
 delayed();assert.match(elements['startup-status'].textContent,/could not finish loading/,'slow-load timer cannot erase an error');
 delete elements['startup-status'];delete elements['startup-error'];
 assert.doesNotThrow(()=>events.error({message:'Unrelated audio error after startup'}));
 assert.doesNotThrow(()=>events.unhandledrejection({reason:new Error('Unrelated camera playback error')}));
});
