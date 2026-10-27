import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
async function load(entryPoints,plugins=[]){const result=await build({entryPoints,bundle:true,platform:'node',format:'esm',write:false,plugins});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);}
const schema=await load(['src/settings/schema.ts']);
const config=await load(['vite.config.ts'],[{name:'vite-config-stub',setup(build){build.onResolve({filter:/^vite$/},()=>({path:'vite',namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const defineConfig = value => value;'}));}}]);
function storage(initial={}){const data=new Map(Object.entries(initial));return {get length(){return data.size;},key:index=>[...data.keys()][index]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
test('portable snapshot includes settings and overlay layout, preserving device data locally',()=>{
 const local=storage({'stage-piano-theme':'cosmic','stage-piano-roses-drop-v4':'{"bonk":0.5}','mr-pink-camera-frame':'{"x":24,"y":90,"width":320}','mr-pink-camera-device':'laptop-camera-id','stage-piano-roses-calibration:default':'{"leadMs":35}','stage-piano-imported-instruments-v1':'[]','unrelated-token':'secret'});
 const snapshot=schema.snapshotSettings(local);
 assert.deepEqual(Object.keys(snapshot).sort(),['mr-pink-camera-frame','stage-piano-roses-drop-v4','stage-piano-theme']);
 schema.applySettings(local,{'stage-piano-theme':'minimal'});
 assert.equal(local.getItem('stage-piano-theme'),'minimal');assert.equal(local.getItem('stage-piano-roses-drop-v4'),null);
 assert.equal(local.getItem('mr-pink-camera-device'),'laptop-camera-id');assert.equal(local.getItem('unrelated-token'),'secret');assert.match(local.getItem('stage-piano-roses-calibration:default'),/35/);
});
test('schema rejects unrelated keys, malformed values, versions and oversized settings',()=>{
 for(const bad of [{version:2,revision:'a',settings:{}},{version:1,revision:'a',settings:{'stage-piano-theme':2}},{version:1,revision:'a',settings:{password:'x'}},{version:1,revision:'a',settings:{'stage-piano-large':'x'.repeat(500001)}}])assert.throws(()=>schema.validateSettings(bad));
 assert.equal(schema.fingerprint({b:'2',a:'1'}),schema.fingerprint({a:'1',b:'2'}));
});
test('repository service saves atomically, loads across sessions and rejects stale writes and foreign requests',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mr-pink-settings-'));await mkdir(join(root,'public'));
 const path=join(root,'public/shared-settings.json');await writeFile(path,JSON.stringify(schema.initialSettings));
 let handler,unwatched;
 config.default.plugins[0].configureServer({config:{root},watcher:{unwatch:p=>{unwatched=p;}},middlewares:{use:(route,fn)=>{assert.equal(route,'/__mr-pink/settings');handler=fn;}}});
 assert.equal(unwatched,path);
 const request=(method,body,origin='http://localhost:5173',type='application/json')=>new Promise(resolve=>{
  const req=new EventEmitter();req.method=method;req.headers={'content-type':type,origin,host:'localhost:5173'};
  const res={setHeader(){},end(value){resolve({status:this.statusCode,body:JSON.parse(value)});}};
  handler(req,res);if(method==='PUT'&&body!==undefined){req.emit('data',JSON.stringify(body));req.emit('end');}
 });
 try{
  assert.equal((await request('GET')).body.revision,'initial');
  const payload={version:1,revision:'initial',settings:{'stage-piano-theme':'cosmic'}};
  assert.equal((await request('PUT',payload,'http://other.example')).status,403);
  assert.equal((await request('PUT',payload,'http://localhost:5173','text/plain')).status,403);
  assert.equal((await request('PUT',{...payload,settings:{unrelated:'secret'}})).status,400);
  const result=await request('PUT',payload);assert.equal(result.status,200);assert.notEqual(result.body.revision,'initial');
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')),result.body);
  assert.equal((await request('PUT',payload)).status,409);assert.deepEqual((await request('GET')).body,result.body);
  const concurrent=await Promise.all([request('PUT',{...result.body,settings:{'stage-piano-theme':'minimal'}}),request('PUT',{...result.body,settings:{'stage-piano-theme':'rush'}})]);
  assert.deepEqual(concurrent.map(item=>item.status),[200,409]);
 }finally{await rm(root,{recursive:true,force:true});}
});

const syncBundle=await build({entryPoints:['src/settings/sharedSettings.ts'],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.DEV':'true'}});
let instance=0;
const syncModule=()=>import(`data:text/javascript;base64,${Buffer.from(syncBundle.outputFiles[0].text).toString('base64')}#${instance++}`);
async function withBrowser(initial,fetcher,run){
 const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),priorFetch=globalThis.fetch;
 const local=storage(initial);Object.defineProperty(globalThis,'localStorage',{configurable:true,value:local});globalThis.fetch=fetcher;
 try{await run(await syncModule(),local);}finally{if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);else delete globalThis.localStorage;globalThis.fetch=priorFetch;}
}
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('a pulled repository profile hydrates before app startup and does not rewrite identical values',async()=>{
 let puts=0;
 await withBrowser({'stage-piano-theme':'rush','mr-pink-camera-device':'local-id'},async(_url,options)=>{
  if(options.method==='PUT'){puts++;throw Error('Unexpected save');}
  return response(200,{version:1,revision:'from-other-laptop',settings:{'stage-piano-theme':'cosmic'}});
 },async(sync,local)=>{
  await sync.initializeSettings();assert.equal(local.getItem('stage-piano-theme'),'cosmic');assert.equal(local.getItem('mr-pink-camera-device'),'local-id');
  await sync.saveSharedSettings();assert.equal(puts,0);
 });
});
test('first run migrates current browser preferences into the repository and retries failed writes',async()=>{
 let puts=0;
 await withBrowser({'stage-piano-theme':'cosmic'},async(_url,options)=>{
  if(options.method!=='PUT')return response(200,schema.initialSettings);
  puts++;const payload=JSON.parse(options.body);assert.equal(payload.settings['stage-piano-theme'],'cosmic');
  return puts===1?response(500,{}):response(200,{...payload,revision:'saved'});
 },async(sync)=>{
  await sync.initializeSettings();await sync.saveSharedSettings();assert.match(sync.settingsStatus(),/save failed/);
  await sync.saveSharedSettings();assert.match(sync.settingsStatus(),/Saved/);await sync.saveSharedSettings();assert.equal(puts,2);
 });
});
test('failed hydration and repository conflicts never overwrite a pulled profile',async()=>{
 for(const unreadable of [true,false]){
  let puts=0;
  await withBrowser({'stage-piano-theme':'local'},async(_url,options)=>{
   if(options.method==='PUT'){puts++;return response(409,{});}
   return unreadable?response(500,{}):response(200,schema.initialSettings);
  },async(sync,local)=>{
   await sync.initializeSettings();assert.equal(local.getItem('stage-piano-theme'),'local');
   await sync.saveSharedSettings();await sync.saveSharedSettings();assert.equal(puts,unreadable?0:1);
   assert.match(sync.settingsStatus(),unreadable?/could not load/:/Repository settings changed/);
  });
 }
});

test('an immediate reload keeps newer browser settings when the repository revision is unchanged',async()=>{
 const repository={version:1,revision:'same',settings:{'stage-piano-pre-drop-riser-v1':'{"volume":0.35}'}};
 const checkpoint=JSON.stringify({revision:'same',fingerprint:schema.fingerprint(repository.settings)});
 let payload;
 await withBrowser({'mr-pink-settings-checkpoint-v1':checkpoint,'stage-piano-pre-drop-riser-v1':'{"volume":0.85}'},async(_url,options)=>{
  if(options.method==='PUT'){payload=JSON.parse(options.body);return response(200,{...payload,revision:'next'});}
  return response(200,repository);
 },async(sync,local)=>{
  await sync.initializeSettings();assert.equal(JSON.parse(local.getItem('stage-piano-pre-drop-riser-v1')).volume,.85);
  await sync.saveSharedSettings();assert.equal(JSON.parse(payload.settings['stage-piano-pre-drop-riser-v1']).volume,.85);
 });
});
test('a pull from another laptop still replaces browser preferences with a different repository revision',async()=>{
 const repository={version:1,revision:'pulled',settings:{'stage-piano-theme':'cosmic'}};
 await withBrowser({'mr-pink-settings-checkpoint-v1':JSON.stringify({revision:'previous',fingerprint:'old'}),'stage-piano-theme':'minimal'},async()=>response(200,repository),async(sync,local)=>{
  await sync.initializeSettings();assert.equal(local.getItem('stage-piano-theme'),'cosmic');
 });
});
test('a save finishing after page unload does not erase an even newer local slider value',async()=>{
 const submitted={'stage-piano-pre-drop-riser-v1':'{"volume":0.6}'},latest='{"volume":0.9}';
 await withBrowser({'mr-pink-settings-checkpoint-v1':JSON.stringify({revision:'old',fingerprint:'old'}),'mr-pink-settings-pending-v1':JSON.stringify({revision:'old',fingerprint:schema.fingerprint(submitted)}),'stage-piano-pre-drop-riser-v1':latest},async()=>response(200,{version:1,revision:'finished-after-unload',settings:submitted}),async(sync,local)=>{
  await sync.initializeSettings();assert.equal(local.getItem('stage-piano-pre-drop-riser-v1'),latest);
 });
});

test('repeated reloads during an in-flight save keep the final slider value through a revision conflict',async()=>{
 const oldSettings={'stage-piano-pre-drop-riser-v1':'{"volume":0.35}'},submitted={'stage-piano-pre-drop-riser-v1':'{"volume":0.6}'};
 let repository={version:1,revision:'old',settings:oldSettings};
 await withBrowser({'mr-pink-settings-checkpoint-v1':JSON.stringify({revision:'old',fingerprint:schema.fingerprint(oldSettings)}),'mr-pink-settings-pending-v1':JSON.stringify({revision:'old',fingerprint:schema.fingerprint(submitted)}),'stage-piano-pre-drop-riser-v1':'{"volume":0.9}'},async(_url,options)=>options.method==='PUT'?response(409,{}):response(200,repository),async(sync,local)=>{
  await sync.initializeSettings();await sync.saveSharedSettings();
  repository={version:1,revision:'older-request-just-finished',settings:submitted};
  const reload=await syncModule();await reload.initializeSettings();
  assert.equal(JSON.parse(local.getItem('stage-piano-pre-drop-riser-v1')).volume,.9);
 });
});
