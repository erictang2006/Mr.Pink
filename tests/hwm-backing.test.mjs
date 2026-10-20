import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='reference/here-with-me-remake/';
const raw=readFileSync(root+'extracted/Remake.flp');
const source=JSON.parse(readFileSync(root+'backing-source-events.json'));
const inventory=JSON.parse(readFileSync(root+'analysis/inventory.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function events(){
 const result=[];let at=22;
 while(at<raw.length){
  const id=raw[at++];let length;
  if(id<192)length=id<64?1:id<128?2:4;
  else{length=0;let shift=0,next;do{next=raw[at++];length+=(next&127)*2**shift;shift+=7;}while(next&128);}
  result.push({id,data:raw.subarray(at,at+length)});at+=length;
 }
 assert.equal(at,raw.length);return result;
}
const framed=events(),patterns=new Map();let current;
for(const {id,data} of framed){
 if(id===65)current=data.readUInt16LE(0);
 if(id===224){
  const notes=[];for(let at=0;at<data.length;at+=24)notes.push({tick:data.readUInt32LE(at),channel:data.readUInt16LE(at+6),durationTicks:data.readUInt32LE(at+8),midi:data.readUInt16LE(at+12),velocity:data[at+21]});patterns.set(current,notes);
 }
}
const playlist=[];const bytes=framed.find(e=>e.id===233).data;
for(let at=0;at<bytes.length;at+=32){
 const base=bytes.readUInt16LE(at+4),index=bytes.readUInt16LE(at+6);
 playlist.push({position:bytes.readUInt32LE(at),length:bytes.readUInt32LE(at+8),pattern:index>base?index-base:null,offset:Math.max(0,bytes.readInt32LE(at+24))});
}

test('local archive, FL12 timing and independently decoded playlist and pattern notes match the inventory',()=>{
 assert.equal(raw.subarray(0,4).toString(),'FLhd');assert.equal(raw.readUInt16LE(12),96);
 assert.equal(raw.readUInt16LE(10),42);assert.equal(source.bpm,100);assert.deepEqual(inventory.timeSignature,[4,4]);
 assert.equal(source.sourceSha256,hash(raw));assert.equal(playlist.length,524);
 const archive=JSON.parse(readFileSync(root+'manifest.json'));
 assert.equal(hash(readFileSync(root+archive.archive)),archive.archive_sha256);
 for(const [id,notes] of patterns){
  assert.deepEqual(notes,inventory.patterns[id].map(({tick,channel,durationTicks,midi,velocity})=>({tick,channel,durationTicks,midi,velocity})));
 }
 for(const [mode,first,last] of [['build',18,25],['drop',26,33]]){
  const sel=source.selections[mode];assert.deepEqual(sel.sourceBars,[first,last]);assert.deepEqual(sel.targetBars,[29,36]);
  for(const note of sel.notes){
   const clip=playlist[note.sourceClip];
   const sourceNote=patterns.get(note.sourcePattern).find(n=>n.channel===note.channel&&n.midi===note.midi&&n.tick===note.sourceTick-clip.position+clip.offset&&n.velocity===note.velocity);
   assert.ok(sourceNote);assert.equal(note.tick,note.sourceTick-(first-1)*384);
   assert.ok(note.tick>=0&&note.tick<3072);assert.ok(note.tick+note.durationTicks<=3072);
  }
 }
});

test('the full drop contains its actual lower backing, with inactive and unassigned instruments excluded',()=>{
 const build=source.selections.build,drop=source.selections.drop;
 assert.equal(build.notes.length,523);assert.equal(build.audio.length,49);
 assert.equal(drop.notes.length,1068);assert.equal(drop.audio.length,102);
 const channels=new Set(drop.notes.map(n=>n.channel));
 for(const id of [2,3,13,14,19,20,21,22,23,24,29])assert.ok(channels.has(id));
 assert.equal(drop.notes.filter(n=>n.channel===24).length,128);
 assert.ok(drop.notes.filter(n=>n.channel===24).every(n=>n.midi>=32&&n.midi<=39));
 assert.equal(drop.notes.filter(n=>n.channel===23).length,16);
 assert.equal(drop.notes.filter(n=>n.channel>=19&&n.channel<=22).length,224);
 assert.equal(build.notes.filter(n=>n.channel===26).length,6,'actual bar-25 transition fill');
 for(const sel of [build,drop]){
  assert.equal(sel.notes.some(n=>[0,1,36,41].includes(n.channel)),false,'no vocal, inactive Kontakt guitar/piano or empty sampler is invented');
  assert.equal(sel.audio.some(n=>n.channel===0),false);
 }
 const lead=JSON.parse(readFileSync('reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json')).events.filter(e=>e.repeat_index<2);
 const tuple=n=>[n.tick,n.channel,n.midi,n.durationTicks,n.velocity].join(':');
 assert.deepEqual(drop.notes.filter(n=>n.channel>=19&&n.channel<=22).map(tuple).sort(),lead.map(e=>tuple({tick:e.start_tick_relative_to_rose_bar37,channel:e.track_channel,midi:e.midi_pitch,durationTicks:e.duration_ticks,velocity:e.velocity_raw})).sort());
});

test('prepared submixes retain source provenance, actual sample transformations, sound in all groups and bounded tails',()=>{
 const normalized=JSON.parse(readFileSync(root+'analysis/normalized-samples.json'));
 assert.equal(normalized.length,26);assert.equal(normalized.some(s=>/ACAPELLA/i.test(s.file)),false);
 for(const sample of normalized){assert.equal(hash(readFileSync(root+'extracted/'+sample.file)),sample.sourceSha256);assert.equal(hash(readFileSync(root+'normalized-samples/'+sample.normalized)),sample.normalizedSha256);}
 const fx=JSON.parse(readFileSync(root+'analysis/sample-fx-preparation.json'));
 assert.equal(fx.find(s=>s.channel===9).reverse,true);assert.equal(fx.find(s=>s.channel===17).pitchCents,200);assert.equal(fx.find(s=>s.channel===30).seconds,9.6);
 for(const mode of ['build','drop']){
  const report=JSON.parse(readFileSync(root+`analysis/${mode}-render.json`));
  for(const [file,expected] of Object.entries(report.sourceHashes))assert.equal(hash(readFileSync(file)),expected,file+' requires submix regeneration');
  assert.equal(report.scheduled.length,source.selections[mode].notes.length+source.selections[mode].audio.length);
  for(const stem of report.files){
   const audio=readFileSync('public/roses/hwm-backing/'+stem.file);assert.equal(hash(audio),stem.sha256);
   assert.equal(audio.readUInt16LE(20),1);assert.equal(audio.readUInt16LE(22),2);assert.equal(audio.readUInt32LE(24),44100);
   assert.equal((audio.length-44)/4/44100,19.35);assert.ok(stem.peak>0&&stem.peak<1);assert.ok(stem.rmsDb>-65);
   assert.ok(audio.subarray(-1764).every(value=>value===0),'last 10 ms is silent after the 150 ms boundary tail');
  }
 }
});
