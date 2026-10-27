import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle=await build({entryPoints:['src/camera/CameraFeature.tsx'],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.DEV':'true'},plugins:[{name:'camera-hooks',setup(b){
 b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},a=>({path:a.path,namespace:'hooks'}));
 b.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'portal'}));
 b.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal = children => children;'}));
 b.onLoad({filter:/.*/,namespace:'hooks'},a=>({contents:a.path==='react'?`export const useState=(...a)=>globalThis.cameraHooks.state(...a),useRef=(...a)=>globalThis.cameraHooks.ref(...a),useEffect=()=>{},useSyncExternalStore=(_subscribe,snapshot)=>snapshot();`:`export const Fragment='fragment',jsx=(type,props)=>({type,props}),jsxs=jsx;`}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
}}]});
const {default:CameraFeature}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function nodes(node){return node==null?[]:Array.isArray(node)?node.flatMap(nodes):typeof node==='object'?[node,...nodes(node.props?.children)]:[];}
const find=(tree,predicate)=>nodes(tree).find(predicate)?.props;
function mount(){let cursor=0;const slots=[];const hooks={state(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},ref(initial){const i=cursor++;return slots[i]??={current:initial};}};return {slots,render(){cursor=0;globalThis.cameraHooks=hooks;return CameraFeature();}};}

test('Enable Camera switch is optional, cancels pending capture, lists Camo, and hiding never reconnects',async()=>{
 const previous=Object.fromEntries(['navigator','window','document','localStorage','cameraHooks'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const requests=[];
 const media={addEventListener(){},removeEventListener(){},enumerateDevices:async()=>[{kind:'videoinput',deviceId:'camo',label:'Camo Camera'}],getUserMedia:constraints=>new Promise(resolve=>requests.push({constraints,resolve}))};
 const replace=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 replace('navigator',{mediaDevices:media});replace('window',{innerWidth:1280,innerHeight:800});replace('document',{body:{},fullscreenElement:null});replace('localStorage',{getItem:()=>null,setItem(){}});
 let capture;
 try{
  const ui=mount();let tree=ui.render();capture=ui.slots[0];
  const toggle=()=>find(tree,node=>node.props?.role==='switch');
  const overlay=()=>find(tree,node=>node.props?.['aria-label']==='Live camera overlay');
  assert.equal(toggle()['aria-checked'],false);assert.equal(overlay().hidden,true);assert.equal(requests.length,0);
  await capture.refresh();tree=ui.render();assert.ok(find(tree,node=>node.type==='option'&&node.props.children==='Camo Camera'));
  find(tree,node=>node.type==='select').onChange({target:{value:'camo'}});tree=ui.render();toggle().onClick();tree=ui.render();
  assert.equal(toggle()['aria-checked'],true);assert.equal(overlay().hidden,false);assert.equal(requests[0].constraints.audio,false);assert.deepEqual(requests[0].constraints.video.deviceId,{exact:'camo'});
  toggle().onClick();tree=ui.render();assert.equal(toggle()['aria-checked'],false);
  let abandonedStops=0;requests[0].resolve({getTracks:()=>[{stop(){abandonedStops++;}}]});await new Promise(resolve=>setImmediate(resolve));assert.equal(abandonedStops,1);
  toggle().onClick();let stops=0;const track={label:'Camo Camera',readyState:'live',getSettings:()=>({deviceId:'camo'}),addEventListener(){},stop(){stops++;}};
  requests[1].resolve({getVideoTracks:()=>[track],getTracks:()=>[track]});await new Promise(resolve=>setImmediate(resolve));tree=ui.render();
  find(tree,node=>node.props?.['aria-label']==='Hide camera overlay').onClick();tree=ui.render();assert.equal(overlay().hidden,true);assert.equal(toggle()['aria-checked'],true);assert.equal(stops,0);
  find(tree,node=>node.type==='input'&&node.props.type==='checkbox').onChange({target:{checked:true}});tree=ui.render();assert.equal(overlay().hidden,false);assert.equal(requests.length,2);assert.equal(find(tree,node=>node.type==='video')['aria-label'],'Camo Camera');
  toggle().onClick();assert.equal(stops,1);
 }finally{capture?.dispose();for(const [key,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
