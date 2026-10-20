import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const report=JSON.parse(readFileSync('docs/roses-reference/vox-melody-analysis.json'));
const notes=JSON.parse(readFileSync('src/piano/voxMelody.json')).notes;
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');

test('Vox melody follows the recorded phrase rather than the separate Here With Me drop melody',()=>{
 assert.equal(hash('public/roses/buildup/Vox synth.wav'),report.source_sha256);
 assert.equal(notes.length,16);
 assert.deepEqual(notes.map(n=>n.beat),[.5,.75,1.5,2,2.5,2.75,3.5,8.5,8.75,9.5,10,10.5,10.75,11.5,12.5,13.5]);
 assert.deepEqual(notes.map(n=>n.midi),[73,71,71,68,68,66,64,73,71,71,68,68,66,64,63,59]);
 for(const [i,note] of notes.entries()) {
   assert.equal(note.duration,.25);
   const measured=report.notes[i].measured_fundamental_hz;
   const target=440*2**((note.midi-69)/12);
   assert.ok(Math.abs(12*Math.log2(measured/target))<.35);
 }
});

test('Loud Stabs alternate is a safe single-note E4 reconstruction without the source chord fundamentals',()=>{
 assert.equal(hash('public/roses/chords/loud-stabs-am-hit.wav'),report.stab_source_sha256);
 assert.equal(hash('public/roses/buildup/loud-stabs-single-E4.wav'),report.stab_note_sha256);
 const bytes=readFileSync('public/roses/buildup/loud-stabs-single-E4.wav');
 let cursor=12,pcm,rate,channels;
 while(cursor+8<=bytes.length){
   const name=bytes.toString('ascii',cursor,cursor+4),length=bytes.readUInt32LE(cursor+4);
   if(name==='fmt '){channels=bytes.readUInt16LE(cursor+10);rate=bytes.readUInt32LE(cursor+12);assert.equal(bytes.readUInt16LE(cursor+22),16);}
   if(name==='data')pcm=bytes.subarray(cursor+8,cursor+8+length);
   cursor+=8+length+(length%2);
 }
 assert.equal(rate,44100);assert.equal(channels,2);
 const frames=pcm.length/4,mono=[];let peak=0;
 for(let i=0;i<frames;i++){
   const l=pcm.readInt16LE(i*4)/32768,r=pcm.readInt16LE(i*4+2)/32768;
   mono.push((l+r)/2);peak=Math.max(peak,Math.abs(l),Math.abs(r));
 }
 assert.ok(peak>.7&&peak<.73);
 assert.ok(Math.abs(frames/rate-.785)<.002);
 const level=frequency=>{
   const start=Math.round(.08*rate),end=Math.round(.65*rate);let real=0,imag=0;
   for(let i=start;i<end;i++){
     const value=mono[i]*(.5-.5*Math.cos(2*Math.PI*(i-start)/(end-start-1)));
     real+=value*Math.cos(2*Math.PI*frequency*i/rate);imag+=value*Math.sin(2*Math.PI*frequency*i/rate);
   }
   return Math.hypot(real,imag);
 };
 const e4=level(440*2**((64-69)/12));
 assert.ok(e4>level(220)*100,'A3 chord fundamental is excluded');
 assert.ok(e4>level(440*2**((60-69)/12))*100,'C4 chord fundamental is excluded');
});
