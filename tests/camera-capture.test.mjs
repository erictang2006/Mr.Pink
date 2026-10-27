import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({entryPoints:['src/camera/cameraCapture.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {CameraCapture}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function stream(id){
 const listeners={};const track={readyState:'live',stops:0,getSettings:()=>({deviceId:id}),stop(){this.stops++;this.readyState='ended';},addEventListener:(name,fn)=>{listeners[name]=fn;}};
 return {getTracks:()=>[track],getVideoTracks:()=>[track],track,listeners};
}
function media(){
 const requests=[],events={};let devices=[{kind:'videoinput',deviceId:'mac',label:'Mac camera'},{kind:'videoinput',deviceId:'iphone',label:'Eric’s iPhone'},{kind:'audioinput',deviceId:'mic'}];
 return {requests,events,setDevices:value=>{devices=value;},enumerateDevices:async()=>devices,getUserMedia:args=>{const gate=deferred();requests.push({args,...gate});return gate.promise;},addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener:name=>{delete events[name];}};
}
test('native camera labels, exact iPhone selection, and video-only constraints',async()=>{
 const api=media(),capture=new CameraCapture(api,'iphone');
 await capture.refresh();assert.equal(capture.state.devices.length,2);assert.equal(capture.state.devices[1].label,'Eric’s iPhone');
 const pending=capture.start(),feed=stream('iphone');
 assert.equal(api.requests[0].args.audio,false);assert.deepEqual(api.requests[0].args.video.deviceId,{exact:'iphone'});
 api.requests[0].resolve(feed);await pending;assert.equal(capture.state.stream,feed);assert.equal(capture.state.busy,false);
 capture.dispose();assert.equal(feed.track.stops,1);assert.equal(api.events.devicechange,undefined);
});
test('switching and Stop discard late camera grants and release their tracks',async()=>{
 const api=media(),capture=new CameraCapture(api);
 const first=capture.start();capture.select('iphone');
 const stale=stream('mac'),chosen=stream('iphone');
 api.requests[1].resolve(chosen);await new Promise(resolve=>setImmediate(resolve));
 api.requests[0].resolve(stale);await first;assert.equal(stale.track.stops,1);assert.equal(capture.state.stream,chosen);
 const next=capture.start();assert.equal(chosen.track.stops,1);capture.stop();
 const late=stream('iphone');api.requests[2].resolve(late);await next;
 assert.equal(late.track.stops,1);assert.equal(capture.state.stream,null);assert.equal(capture.state.status,'Camera off');capture.dispose();
});
test('permission denial is retryable and a disconnected feed never silently changes source',async()=>{
 const api=media(),capture=new CameraCapture(api,'iphone');
 const denied=capture.start();api.requests[0].reject({name:'NotAllowedError'});await denied;
 assert.match(capture.state.status,/access denied/);assert.equal(capture.state.busy,false);
 const retry=capture.start(),feed=stream('iphone');api.requests[1].resolve(feed);await retry;
 feed.listeners.mute();assert.match(capture.state.status,/paused/);feed.listeners.unmute();assert.match(capture.state.status,/Live/);
 api.setDevices([{kind:'videoinput',deviceId:'mac',label:'Mac camera'}]);await api.events.devicechange();
 assert.equal(capture.state.stream,null);assert.equal(capture.state.selected,'iphone');assert.match(capture.state.status,/disconnected/);assert.equal(api.requests.length,2);capture.dispose();
});
test('ended tracks and disposal during permission prompts clean up safely',async()=>{
 const api=media(),capture=new CameraCapture(api,'iphone');const pending=capture.start(),feed=stream('iphone');
 api.requests[0].resolve(feed);await pending;feed.listeners.ended();assert.equal(capture.state.stream,null);assert.match(capture.state.status,/disconnected/);
 const late=capture.start();capture.dispose();const abandoned=stream('iphone');api.requests[1].resolve(abandoned);await late;assert.equal(abandoned.track.stops,1);
});

test('Camo is enumerated as a video source and stays captured through passive device refreshes',async()=>{
 const api=media(),capture=new CameraCapture(api,'camo-virtual');
 api.setDevices([{kind:'videoinput',deviceId:'mac',label:'Mac camera'},{kind:'videoinput',deviceId:'camo-virtual',label:'Camo Camera'},{kind:'audioinput',deviceId:'camo-mic',label:'Camo Microphone'}]);
 await capture.refresh();assert.equal(api.requests.length,0,'discovery never enables optional capture');
 assert.deepEqual(capture.state.devices.map(device=>device.label),['Mac camera','Camo Camera']);
 const pending=capture.start(),feed=stream('camo-virtual');
 assert.deepEqual(api.requests[0].args.video.deviceId,{exact:'camo-virtual'});assert.equal(api.requests[0].args.audio,false);
 api.requests[0].resolve(feed);await pending;
 for(let index=0;index<3;index++)await capture.refresh();
 assert.equal(capture.state.stream,feed);assert.equal(api.requests.length,1);assert.equal(feed.track.stops,0);
 capture.dispose();
});
test('Camo is optional: no browser API, no devices, and unavailable saved sources are recoverable',async()=>{
 const unsupported=new CameraCapture(undefined);await unsupported.start();await unsupported.refresh();assert.match(unsupported.state.status,/supported browser/);unsupported.dispose();
 const api=media(),capture=new CameraCapture(api,'camo-virtual');api.setDevices([]);await capture.refresh();assert.equal(api.requests.length,0);
 const pending=capture.start();api.requests[0].reject({name:'OverconstrainedError'});await pending;
 assert.equal(capture.state.busy,false);assert.equal(capture.state.stream,null);assert.match(capture.state.status,/unavailable/);
 capture.select('mac');const retry=capture.start(),feed=stream('mac');api.setDevices([{kind:'videoinput',deviceId:'mac',label:'Mac camera'}]);api.requests[1].resolve(feed);await retry;assert.equal(capture.state.stream,feed);capture.dispose();
});
