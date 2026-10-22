import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const mock=`export const voices=[];export class Gain{connect(){return this;}chain(){return this;}dispose(){this.disposed=true;}}export class MonoSynth extends Gain{constructor(options){super();this.options=options;this.attacks=[];this.releases=[];voices.push(this);}triggerAttack(note,time,velocity){this.attacks.push({note,time,velocity});}triggerRelease(time){this.releases.push(time);}set(options){this.settings=options;}}`;
const bundle=await build({stdin:{contents:`export {LiveBonkBank} from './src/piano/liveBonkBank';export {voices} from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'audio',setup(b){b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock}));}}]});
const {LiveBonkBank,voices}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function fresh(){voices.length=0;const template={get:()=>({oscillator:{type:'fatsawtooth',count:5}}),dispose(){this.disposed=true;}};const bank=new LiveBonkBank(template,[49,61,64,68,64]);assert.equal(template.disposed,true);return bank;}
test('rapid live Bonk repeats reuse a fixed bank without dropping or allocating another voice per tail',()=>{
 const bank=fresh();assert.equal(voices.length,4);
 for(let hit=0;hit<200;hit++){const time=1+hit*.05;for(const note of ['C#3','C#4','E4','G#4'])bank.triggerAttack(note,time,.86);for(const note of ['C#3','C#4','E4','G#4'])bank.triggerRelease(note,time+.025);}
 assert.equal(voices.length,4);for(const voice of voices){assert.equal(voice.attacks.length,200);assert.equal(voice.releases.length,200);assert.equal(voice.options.oscillator.count,5);}
 assert.equal(bank.owners.size,0);bank.dispose();assert.ok(voices.every(v=>v.disposed));
});
test('overlapping shared pitches, equal-time chords and pedal-held repeats preserve ownership',()=>{
 const bank=fresh(),e=bank.voices.get('E4');
 bank.triggerAttack('E4',1,.86);bank.triggerAttack('E4',1,.86);assert.equal(e.attacks.length,1);
 bank.triggerRelease('E4',1.1);assert.equal(e.releases.length,0);bank.triggerRelease('E4',1.2);assert.deepEqual(e.releases,[1.2]);
 bank.triggerAttack('E4',2,.86);bank.triggerAttack('E4',2.1,.86);bank.triggerAttack('E4',2.2,.86);
 bank.triggerRelease('E4',2.3);bank.triggerRelease('E4',2.3);assert.equal(e.releases.length,1,'pedal up leaves the physically held copy sounding');bank.triggerRelease('E4',2.4);assert.equal(e.releases.at(-1),2.4);
 bank.set({envelope:{release:.5}});assert.ok(voices.every(v=>v.settings.envelope.release===.5));
 bank.triggerAttack('C#3',3,.86);bank.releaseAll(3.1);assert.equal(bank.owners.size,0);bank.dispose();
});
