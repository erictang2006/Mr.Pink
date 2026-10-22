import {hybridPercussion,hybridBreakBeat,hybridRiserEndBeat,defaultRiserSettings,type RiserSettings} from "./hybridBacking";
import samples from "../../reference/here-with-me-remake/analysis/normalized-samples.json";
import preparedFx from "../../reference/here-with-me-remake/analysis/sample-fx-preparation.json";
import source from "../../reference/here-with-me-remake/backing-events-e-major.json";
import {buildupEvents,buildupBass,buildupStatusText} from "./rosesBuildup";
import vox from "./voxMelody.json";
import {backingChoices,type BackingMode,type BackingGroup} from "./rosesBacking";
import {audibleDropLayer,type DropLayer,type DropRow} from "./rosesDropMixer";

export type VisualLayer = "chords" | "pad" | "guitar" | "bass" | "lead" | "drums" | "fx" | "riser";
export type BackingVisualEvent = {id:string;layer:VisualLayer;start:number;end:number;pitches:number[];channels:number[];label:string;automatic:true};
export const visualLayerNames: Record<VisualLayer,string> = {chords:"CHORDS",pad:"SOFT PAD",guitar:"GUITAR",bass:"BASS / LOW GUITAR",lead:"MELODY",drums:"PERCUSSION",fx:"FX / TRANSITION",riser:"PRE-DROP RISER"};
const noteNames=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
export const visualPitch=(midi:number)=>noteNames[midi%12]+(Math.floor(midi/12)-1);
function harmonicName(pitches:number[]):string {
 const pcs=[...new Set(pitches.map(n=>n%12))].sort((a,b)=>a-b).join(',');
 return ({'1,4,8':'C♯m','3,6,11':'B','1,4,9,11':'Aadd9','4,8,11':'E'} as Record<string,string>)[pcs]??pitches.map(visualPitch).join(' · ');
}
const layerFor=(channel:number):VisualLayer=>channel===2?"chords":channel===3?"pad":channel===14?"guitar":[13,23,24,26].includes(channel)?"bass":channel===29?"drums":"lead";
function hwmEvents(mode:"build"|"drop"):BackingVisualEvent[]{
 const result:BackingVisualEvent[]=[],grouped=new Map<string,BackingVisualEvent>();
 for(const note of source.selections[mode].notes){
  const layer=layerFor(note.channel),key=`${layer}:${note.tick}:${note.durationTicks}`;
  let event=grouped.get(key);if(!event){event={id:key,layer,start:112+note.tick/96,end:112+(note.tick+note.durationTicks)/96,pitches:[],channels:[],label:'',automatic:true};grouped.set(key,event);result.push(event);}
  if(layer!=="drums"&&!event.pitches.includes(note.midi))event.pitches.push(note.midi);
  if(!event.channels.includes(note.channel))event.channels.push(note.channel);
 }
 for(const event of result){event.pitches.sort((a,b)=>a-b);event.label=event.layer==='chords'?harmonicName(event.pitches):event.pitches.map(visualPitch).join(' · ')||'Hi-hat';}
 source.selections[mode].audio.forEach((clip,index)=>{const sample=samples.find(s=>s.file===clip.file),fx=preparedFx.find(s=>s.channel===clip.channel);const seconds=fx?.seconds??(sample?sample.frames/sample.rate:clip.durationTicks/96*.6);result.push({id:`audio:${index}`,layer:clip.group as 'drums'|'fx',start:112+clip.tick/96,end:Math.min(144,112+clip.tick/96+Math.min(clip.durationTicks/96,Math.max(0,seconds-clip.offsetSeconds)/.6)),pitches:[],channels:[clip.channel],label:source.channels.find(c=>c.id===clip.channel)?.name??clip.file,automatic:true});});
 return result.sort((a,b)=>a.start-b.start);
}
const roses:BackingVisualEvent[]=[
 ...buildupBass.map((n,i)=>({id:`bass:${i}`,layer:'bass' as const,start:n.beat,end:n.end,pitches:[n.midi],channels:[],label:visualPitch(n.midi),automatic:true as const})),
 ...buildupEvents.filter(e=>e.layer!=='vox').map((n,i)=>({id:`clip:${i}`,layer:n.layer==='chops'?'fx' as const:'drums' as const,start:n.beat,end:n.end,pitches:[],channels:[],label:n.layer,automatic:true as const})),
 ...[...vox.notes,...vox.notes.filter(n=>n.beat<12).map(n=>({...n,beat:n.beat+16}))].map((n,i)=>({id:`vox:${i}`,layer:'lead' as const,start:112+n.beat,end:112+n.beat+n.duration,pitches:[n.midi],channels:[],label:visualPitch(n.midi),automatic:true as const})),
].sort((a,b)=>a.start-b.start);
const hwmDrop=hwmEvents('drop');
const hybrid:BackingVisualEvent[]=[
 ...hwmDrop.filter(event=>event.pitches.length&&event.start<hybridBreakBeat).map(event=>({...event,id:`hybrid:${event.id}`,end:Math.min(event.end,hybridBreakBeat)})),
 ...hybridPercussion.map((event,index)=>({id:`hybrid-drum:${index}`,layer:'drums' as const,start:event.beat,end:event.end,pitches:[],channels:[],label:event.layer==='spacy'?'Spacy Drum':event.layer==='roll'?'Snare roll':'Final snap',automatic:true as const})),
 {id:'hybrid-riser',layer:'riser' as const,start:hybridBreakBeat,end:hybridRiserEndBeat,pitches:[],channels:[],label:'Pre-Drop Riser',automatic:true as const},
].sort((a,b)=>a.start-b.start);
export const backingVisualEvents:Record<BackingMode,BackingVisualEvent[]>={roses,'hwm-build':hwmEvents('build'),'hwm-drop':hwmDrop,hybrid};
// Index once, rather than scanning all source notes on every animation frame.
const bars=Object.fromEntries(Object.entries(backingVisualEvents).map(([mode,events])=>[mode,Array.from({length:8},(_,i)=>events.filter(e=>e.start<(29+i)*4&&e.end>(28+i)*4))])) as Record<BackingMode,BackingVisualEvent[][]>;
export const backingBarEvents=(mode:BackingMode,bar:number)=>bars[mode][bar-29]??[];
// The full drop reuses these pitched sources, but uses Roses percussion.
// Its four lead banks have the same exact source notes (checked in tests).
const dropVisualEvents = backingVisualEvents['hwm-drop'].filter(event=>event.pitches.length).map(event => ({ ...event, id: `drop:${event.id}`, start: event.start + 32, end: event.end + 32 }));
type BackingMix = {gain:number;levels:Record<BackingGroup,number>;solo:BackingGroup|null;riser?:RiserSettings};
const eventGroup=(event:BackingVisualEvent):BackingGroup=>event.layer==='riser'?'fx':['chords','pad','guitar','lead'].includes(event.layer)?'chords':event.layer as BackingGroup;
export function backingFrame(mode:BackingMode,beat:number,dropSource?:'roses'|'hwm',mix?:BackingMix,rows?:Record<DropLayer,DropRow>){
 const inBuild=beat>=112&&beat<144,inDrop=beat>=144&&beat<176&&dropSource==='hwm',hwm=inBuild&&mode!=='roses'||inDrop;
 const breakdown=mode==='hybrid'&&inBuild&&beat>=hybridBreakBeat;
 const riser=mix?.riser??defaultRiserSettings;
 const riserAudible=riser.enabled&&riser.volume>0&&(!mix||mix.gain>0&&mix.levels.fx>0&&(!mix.solo||mix.solo==='fx'));
 const riserProgress=breakdown&&beat<hybridRiserEndBeat&&riserAudible?(beat-hybridBreakBeat)/(hybridRiserEndBeat-hybridBreakBeat):0;
 const region=inBuild?backingVisualEvents[mode]:inDrop?dropVisualEvents:[];
 const events=region.filter(event=>{
  if(event.start>=beat+4||event.end<=beat-8)return false;
  if(breakdown&&event.pitches.length)return false;
  if(event.layer==='riser'&&(!riser.enabled||riser.volume===0))return false;
  if(inBuild&&mix){if(mix.gain<=0)return false;if(mode!=='roses'){const group=eventGroup(event);if(mix.levels[group]<=0||mix.solo&&mix.solo!==group)return false;}}
  if(inDrop&&rows){const layer=event.layer==='bass'?'bass':event.layer==='lead'?'lead':'chords';if(!audibleDropLayer(rows,layer)||rows[layer].volume<=0)return false;}
  return true;
 });
 const active=events.filter(e=>e.start<=beat&&e.end>beat);
 const chord=inDrop?dropVisualEvents.filter(e=>e.layer==='chords'&&e.start<=beat).at(-1)?.label:mode==='roses'?undefined:backingVisualEvents[mode].filter(e=>e.layer==='chords'&&e.start<=beat).at(-1)?.label;
 return {mode,source:beat>=144&&beat<176&&dropSource?(inDrop?'Here With Me · Drop':'Roses · Original drop'):backingChoices.find(c=>c.value===mode)!.label,inBuild,hwm,title:hwm?'HERE WITH ME':'ROSES',role:breakdown?'Breakdown · Measure 36':inBuild?'Buildup · Measures 29–36':beat>=144?'Drop · Measures 37–44':'',chord:!breakdown&&(inBuild||inDrop)?chord:undefined,
  breakdown,riserProgress,riserIntensity:riser.intensity,active,events,upcoming:inBuild?backingVisualEvents[mode].filter(e=>e.start>=beat&&e.start<Math.min(144,beat+4)).slice(0,8):[],
  activity:[...new Set(active.map(e=>e.layer))],intensity:breakdown?.06+.2*riserProgress:inDrop?1:hwm?.18+.45*Math.max(0,(beat-112)/32):0,
  transition:breakdown?'BREAKDOWN · riser → snap → drop':mode==='hybrid'&&beat>=136?'Thinning harmony · sixteenth-note roll':mode==='hybrid'&&beat>=128?'Roses eighth-note Spacy + snare roll':mode==='hybrid'?'Here With Me harmony · Roses Spacy Drum':mode==='roses'?buildupStatusText(beat):beat>=140?'Transition → drop at 37':beat>=128?'Building toward the drop':'Vocal passage',
 };
}
export type BackingFrame=ReturnType<typeof backingFrame>;
