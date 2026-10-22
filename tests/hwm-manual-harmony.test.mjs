import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='public/roses/hwm-manual-harmony/';
const report=JSON.parse(readFileSync(root+'manifest.json'));
test('manual harmony samples use the existing E-major chord/pad/Piezo graph and exact manual voicings',()=>{
 const source=JSON.parse(readFileSync('reference/here-with-me-remake/backing-events-e-major.json'));
 for(const [file,hash] of Object.entries(report.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file+' needs regeneration');
 assert.equal(report.files.length,4);assert.equal(report.notes.length,18);
 for(const [index,file] of report.files.entries()){
  const tick=[0,144,384,528][index];const pitches=source.selections.drop.notes.filter(n=>n.channel===2&&n.tick===tick).map(n=>n.midi).sort((a,b)=>a-b);assert.deepEqual(file.notes,pitches);
  const wave=readFileSync(root+file.file);assert.equal(createHash('sha256').update(wave).digest('hex'),file.sha256);
  assert.equal(wave.readUInt32LE(24),44100);assert.equal(wave.readUInt16LE(22),2);assert.equal((wave.length-44)/4/44100,1.6);
  assert.ok(file.peak>0&&file.peak<1);assert.equal(file.loopStart,.8);assert.equal(file.loopEnd,1.4);
  for(const note of report.notes.filter(n=>n.code===file.code)){assert.deepEqual(note.channels,[2,3,14]);assert.equal(note.guitarRate,2**((note.midi-note.guitarRoot)/12));}
  for(let c=0;c<2;c++){const first=wave.readInt16LE(44+(Math.round(.8*44100)*2+c)*2),last=wave.readInt16LE(44+((Math.round(1.4*44100)-1)*2+c)*2);assert.ok(Math.abs(first-last)<327,'loop boundary is crossfaded');}
 }
});
