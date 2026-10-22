import {memo} from "react";
import {backingBarEvents,backingFrame,visualLayerNames,visualPitch,type BackingFrame,type VisualLayer} from '../piano/backingVisuals';
import type {BackingMode} from '../piano/rosesBacking';

function BackingBarGuideView({mode,bar,beat=0}:{mode:BackingMode;bar:number;beat?:number}){
 const start=(bar-1)*4,events=backingBarEvents(mode,bar);
 const layers=Object.keys(visualLayerNames) as VisualLayer[];
 return <div className="roses-layer-grid hwm-backing-grid" aria-label={`${mode} automatic backing bar ${bar}`}>
  {layers.filter(layer=>events.some(e=>e.layer===layer)).map(layer=><div className="roses-layer-row" key={layer}><b>{visualLayerNames[layer]} AUTO</b><span>{events.filter(e=>e.layer===layer).map(event=>{
   const left=Math.max(start,event.start),end=Math.min(start+4,event.end);
   return <i key={event.id} className={`backing-event ${event.pitches.length?'pitched':'sample-activity'} ${layer}`} style={{left:`${(left-start)*25}%`,width:`${Math.max(.8,(end-left)*25)}%`}} title={`${event.label} · ${event.pitches.map(visualPitch).join(', ')} · automatic · beat ${event.start%4+1}${event.pitches.length?'':' · recorded audio activity'}`}>{event.pitches.length?event.layer==='chords'?event.label:event.pitches.length>2?`${event.label.split(' · ')[0]} +${event.pitches.length-1}`:event.label:event.layer==='riser'?'Rising sweep':''}</i>;
  })}</span></div>)}
  <small>Automatic backing · guide only · not graded</small>
  {beat>0&&<i className="roses-playhead" style={{left:`${(beat-1)*25}%`}}/>}
 </div>;
}
export const BackingBarGuide=memo(BackingBarGuideView);
export default function BackingGuide({mode,beat,status,compact=false,mix}:{mode:BackingMode;beat:number;status?:string;compact?:boolean;mix?:Parameters<typeof backingFrame>[3]}){
 const view=backingFrame(mode,beat,undefined,mix);
 return <div className={`backing-guide ${view.hwm?'is-hwm':''} ${compact?'compact':''}`} aria-label="Selected backing guide">
  <div><strong>{view.title}</strong><span>{view.role||'Measures 29–36'}{view.chord&&<> · <b>{view.chord}</b></>}</span><small>{status??'NOT ARMED'}</small></div>
  {!compact&&<><small>{view.source} · automatic parts; physical keys remain independent.</small><p>{view.activity.map(layer=>visualLayerNames[layer]).join(' · ')||'Waiting for the selected arrangement'} · {view.transition}</p>{view.breakdown&&<div className="pre-drop-sweep" role="progressbar" aria-label="Automatic pre-drop riser progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.riserProgress*100)}><i style={{width:`${view.riserProgress*100}%`}}/></div>}<div className="backing-upcoming">{view.upcoming.slice(0,5).map(event=><span key={event.id}>{Math.floor(event.start/4)+1}:{Number((event.start%4+1).toFixed(2))} · {visualLayerNames[event.layer]} {event.pitches.length?event.label:'audio'}</span>)}</div></>}
 </div>;
}
export type AutomaticGuide = Pick<BackingFrame,'events'|'hwm'|'intensity'> & {beat:number;playing:boolean;getBeat?:()=>number;riserProgress?:number;riserIntensity?:number};
