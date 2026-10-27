import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
export * from './src/components/performanceRenderBudget';export * from './src/components/starlight';
export * from './src/components/starlightBeam';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('dense input and slow drawing reduce secondary quality immediately, with a steady recovery window',()=>{
 const budget=new api.PerformanceRenderBudget();assert.equal(budget.update(0,0,0),false);
 assert.equal(budget.update(10,4,4),true);assert.equal(budget.update(909,0,0),true);assert.equal(budget.update(911,0,0),false);
 assert.equal(budget.update(1000,14,0),true);assert.equal(budget.update(1800,14,0),true);assert.equal(budget.update(2600,0,0),true);assert.equal(budget.update(2701,0,0),false);
 for(let i=0;i<5;i++)budget.record(18);assert.equal(budget.update(3000,0,0),true);
 for(let i=0;i<20;i++)budget.record(1);assert.equal(budget.update(3901,0,0),false);
});

test('economical beams retain every note shape, the exact body gradient, rim and impact edge while removing expensive blur passes',()=>{
 function context(){const calls=[],stack=[];let gradient;
  const ctx=new Proxy({globalAlpha:1,save(){stack.push(1);},restore(){assert.ok(stack.length);stack.pop();},
   createLinearGradient(...args){gradient=['linear',args,[]];calls.push(gradient);return {addColorStop:(...stop)=>gradient[2].push(stop)};},
   createRadialGradient(...args){gradient=['radial',args,[]];calls.push(gradient);return {addColorStop:(...stop)=>gradient[2].push(stop)};}
  },{get:(t,k)=>k in t?t[k]:(...args)=>calls.push([k,...args]),set(t,k,v){if(k==='shadowBlur')calls.push(['blur',v]);t[k]=v;return true;}});
  return {ctx,calls,stack};
 }
 const shape={x:350,top:90,width:24,height:320,radius:5},color=api.starlightColor(76),regular=context(),lean=context();
 api.drawStarlightBeam(regular.ctx,shape,color,true,10000,false);api.drawStarlightBeam(lean.ctx,shape,color,true,10000,false,true);
 assert.deepEqual(lean.calls.filter(c=>c[0]==='roundRect'),regular.calls.filter(c=>c[0]==='roundRect'));
 assert.deepEqual(lean.calls.find(c=>c[0]==='linear'&&c[1][1]===shape.top),regular.calls.find(c=>c[0]==='linear'&&c[1][1]===shape.top));
 assert.equal(lean.calls.filter(c=>c[0]==='radial').length,0);assert.equal(regular.calls.filter(c=>c[0]==='radial').length,3);
 assert.ok(regular.calls.some(c=>c[0]==='blur'&&c[1]>0));assert.ok(lean.calls.filter(c=>c[0]==='blur').every(c=>c[1]===0));
 assert.ok(lean.calls.some(c=>c[0]==='stroke'));assert.ok(lean.calls.some(c=>c[0]==='fillRect'&&c[2]===408.5));
 assert.equal(lean.stack.length,0);assert.equal(regular.stack.length,0);
});

test('dense-passage particles stay within the smaller budget without dropping contact events or changing physical-release data',()=>{
 const scene=new api.StarlightScene();
 const notes=Array.from({length:20},(_,i)=>({id:i+1,code:`test:${i}`,midi:48+i,startMs:0,physicalEndMs:null,endMs:null,assisted:false,octave:false}));
 scene.update(notes,0,false,true);assert.equal(scene.pulses.length,20);assert.ok(scene.particles.length<=192);
 for(let now=16;now<1500;now+=16){scene.update(notes,now,false,true);assert.ok(scene.particles.length<=192);}
 for(const note of notes)note.physicalEndMs=1500;
 scene.update(notes,1500,false,true);assert.ok(notes.every(note=>note.physicalEndMs===1500));assert.ok(scene.particles.length<=192);
 scene.update([],5000,false,true);assert.equal(scene.particles.length,0);assert.equal(scene.pulses.length,0);
});
