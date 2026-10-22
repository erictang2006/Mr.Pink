import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(p));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
test('permanent backing MIDI is exactly +1 for every pitched source note; timing, velocity, drums and sample roots are unchanged',()=>{
 const original=read('reference/here-with-me-remake/backing-source-events.json'),current=read('reference/here-with-me-remake/backing-events-e-major.json');
 assert.equal(current.arrangement.transposeSemitones,1);
 assert.equal(current.arrangement.sourceSha256,hash(current.arrangement.source));
 assert.deepEqual(current.channels,original.channels,'sample roots and intentional percussion tuning must not move');
 for(const mode of ['build','drop']){
  const a=original.selections[mode],b=current.selections[mode];assert.equal(a.notes.length,b.notes.length);
  a.notes.forEach((n,i)=>assert.deepEqual(b.notes[i],{...n,midi:n.midi+(n.channel===29?0:1)}));
  assert.deepEqual(b.audio,a.audio);assert.deepEqual(b.automation,a.automation);
  const report=read(`reference/here-with-me-remake/analysis/${mode}-render.json`);
  assert.equal(report.transposeSemitones,1);assert.equal(report.bpm,100);
  assert.deepEqual(report.scheduled.filter(n=>n.midi!==undefined).map(({channel,tick,midi,durationTicks})=>({channel,tick,midi,durationTicks})),b.notes.map(({channel,tick,midi,durationTicks})=>({channel,tick,midi,durationTicks})).sort((a,b)=>a.tick-b.tick),'actual rendered note pitches must match transposed source exactly');
 }
});
test('all four lead banks move +1 exactly once with unchanged event timing and octave relationships',()=>{
 const a=read('reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json'),b=read('reference/here-with-me-drop-lead/lead-events-e-major.json');
 assert.equal(b.arrangement.transposeSemitones,1);assert.equal(b.arrangement.sourceSha256,hash(b.arrangement.source));
 a.events.forEach((e,i)=>assert.deepEqual(b.events[i],{...e,midi_pitch:e.midi_pitch+1}));
 assert.deepEqual(b.events.slice(0,4).map(e=>e.midi_pitch),[64,76,76,76]);
});
test('new vocal retains exact playback frame count, offline +100 cents and source provenance',()=>{
 const report=read('reference/here-with-me-vocal/e-major-vocal.json');
 assert.equal(hash(report.source),report.sourceSha256);assert.equal(hash(report.output),report.outputSha256);
 assert.equal(hash(report.originalPlaybackFile),report.originalPlaybackSha256);
 assert.equal(report.originalPlaybackSha256,'c84ff24ba29f46d3c94942b06a324af59a145f835858bfd71303aae728d62ce9');
 assert.equal(report.fullSourceFrames,report.fullProcessedFrames);assert.equal(report.transposeSemitones,1);assert.equal(report.playbackRate,1);
 const wave=readFileSync(report.output);assert.equal(wave.readUInt32LE(24),44100);assert.equal(wave.readUInt16LE(22),2);assert.equal((wave.length-44)/4,1853082);
 assert.ok(report.envelopeAlignmentCorrelation>.75);
});
test('automatic drop harmony render excludes the live lead and preserves all transposed HWM supporting MIDI',()=>{
 const report=read('reference/here-with-me-remake/analysis/drop-instrumental-render.json');
 assert.equal(report.includeLead,false);assert.deepEqual(report.targetBars,[37,44]);assert.equal(report.transposeSemitones,1);
 const file=report.files[0];assert.equal(file.file,'drop-instrumental-chords.wav');assert.equal(hash('public/roses/hwm-backing/'+file.file),file.sha256);
 for(const [file,expected] of Object.entries(report.sourceHashes))assert.equal(hash(file),expected,file);
});
