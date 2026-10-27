import { rosesHwmVisuals, type HwmVinylTimeline } from '../piano/rosesHwmVisuals';
import {sodaPop} from '../finale/sodaPopEngine';
import {introRevealBuild,type RosesRevealSnapshot,type RevealClock} from '../piano/rosesReveal';
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import type { LiveNotes } from '../piano/liveNotes';
import {PerformanceRenderBudget} from './performanceRenderBudget';
import { StageEnergy, type StageActivity } from './stageEnergy';

import { drawRecordOrb } from './recordOrb';
export { drawRecordOrb as drawEnergyOrb } from './recordOrb';

export type OrbReveal={transitioning?:boolean;state:RosesRevealSnapshot;clock:RevealClock|null};
type Props={vinylTimeline?:HwmVinylTimeline;reveal?:OrbReveal;notes:LiveNotes;activity:StageActivity;audioLevel:MutableRefObject<number>;stageLevel:MutableRefObject<number>;waveform?:MutableRefObject<Float32Array|undefined>};
export default function PerformanceEnergyOrb({vinylTimeline,notes,activity,audioLevel,stageLevel,waveform,reveal}:Props){
  const [artworkMissing,setArtworkMissing]=useState(false);
  const ref=useRef<HTMLCanvasElement>(null),art=useRef<HTMLImageElement>(null),hwmArt=useRef<HTMLImageElement>(null),values=useRef({notes,activity,audioLevel,stageLevel,waveform,reveal,vinylTimeline});values.current={notes,activity,audioLevel,stageLevel,waveform,reveal,vinylTimeline};
  useEffect(()=>{
    const canvas=ref.current!,ctx=canvas.getContext('2d');
    if(!ctx){canvas.parentElement?.setAttribute('data-renderer','fallback');return;}
    const energy=new StageEnergy(),budget=new PerformanceRenderBudget();let lastNote=0;let frame=0,last=0,width=0,height=0,slowFrames=0,interval=32,rotation=0,particleOffset:number|undefined;let lastArt=-1,lastTitle=-1,lastMix=-1,lastDrop=-1;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(600000/Math.max(1,width*height)));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const clearStageStyle=()=>{
      const stage=canvas.closest<HTMLElement>('.performance-stage');
      for(const property of ['--hwm-title-mix','--hwm-visual-mix','--hwm-drop-contrast'])stage?.style.removeProperty(property);
    };
    const fallback=()=>{cancelAnimationFrame(frame);observer.disconnect();clearStageStyle();values.current.stageLevel.current=0;canvas.style.visibility='hidden';canvas.parentElement?.setAttribute('data-renderer','fallback');};
    const lost=(event:Event)=>{event.preventDefault();fallback();};
    canvas.addEventListener('contextlost',lost);
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(document.hidden){last=now;return;}if(now-last<(reduced?100:interval))return;
      const elapsed=last?Math.min(250,now-last):16.7;last=now;
      const current=values.current,started=performance.now();
      const live=[...current.notes.soundingNotes(),...current.notes.recentReleases(now,250)];
      const attacks=live.filter(note=>note.id>lastNote).length;
      for(const note of live)lastNote=Math.max(lastNote,note.id);
      const economical=budget.update(now,live.length,attacks);
      energy.update(elapsed,live,current.activity,current.audioLevel.current);
      current.stageLevel.current=energy.level;
      const finale=sodaPop.active()?sodaPop.frame():undefined;
      if(!reduced&&sodaPop.snapshot().status!=='paused')rotation=(rotation+elapsed*(current.activity.playing || current.audioLevel.current>.02?.000035:.000009)*(current.vinylTimeline?1:1+energy.build*.45)*(finale?.rotationRate??1))%(Math.PI*2);
      if(current.reveal?.transitioning)return;
      if(finale&&finale.artwork<=0){ctx.clearRect(0,0,width,height);return;}
      const artwork=art.current?.complete&&art.current.naturalWidth>0?art.current:null;
      const hwmArtwork=hwmArt.current?.complete&&hwmArt.current.naturalWidth>0?hwmArt.current:null;
      const hwm=current.vinylTimeline?rosesHwmVisuals(current.vinylTimeline.getBeat()):undefined;
      const stage=canvas.closest<HTMLElement>('.performance-stage');
      if(hwm){
        if(hwm.artworkMix!==lastArt){canvas.parentElement?.style.setProperty('--hwm-art-mix',String(hwm.artworkMix));lastArt=hwm.artworkMix;}
        if(hwm.titleMix!==lastTitle){canvas.parentElement?.style.setProperty('--hwm-title-mix',String(hwm.titleMix));stage?.style.setProperty('--hwm-title-mix',String(hwm.titleMix));lastTitle=hwm.titleMix;}
        if(hwm.mix!==lastMix){stage?.style.setProperty('--hwm-visual-mix',String(hwm.mix));lastMix=hwm.mix;}
        const drop=hwm.drop?1:0;if(drop!==lastDrop){stage?.style.setProperty('--hwm-drop-contrast',String(drop));lastDrop=drop;}
      }
      if(hwm&&(particleOffset===undefined||hwm.beat<=112))particleOffset=now-hwm.beat*600;
      const particleClock=hwm?hwm.beat*600+(particleOffset??0):now;
      try { ctx.clearRect(0,0,width,height);ctx.globalAlpha=finale?.artwork??1;drawRecordOrb(ctx,width,height,now,energy,reduced,{economical,artwork,hwmArtwork,hwm,particleClock,rotation,waveform:current.waveform?.current,concealed:!!current.reveal?.state.enabled&&current.reveal.state.revealedAt===null,revealMs:current.reveal?.state.revealedAt!=null?now-current.reveal.state.revealedAt:undefined,introBuild:introRevealBuild(current.reveal?.clock??null)});ctx.globalAlpha=1; }
      catch { fallback();return; }
      // Decorative record targets 30 Hz, leaving input/audio room; recover after slow draws.
      budget.record(performance.now()-started);
      slowFrames=performance.now()-started>9?slowFrames+1:Math.max(0,slowFrames-1);
      if(slowFrames>6)interval=48;else if(slowFrames===0)interval=32;
    };
    frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();clearStageStyle();canvas.removeEventListener('contextlost',lost);values.current.stageLevel.current=0;};
  },[]);
  const concealed=!!reveal?.state.enabled&&reveal.state.revealedAt===null;
  const phase=vinylTimeline?rosesHwmVisuals(vinylTimeline.beat):undefined;
  return <div className={`workstation-orb record-orb ${concealed?"is-concealed":""}`} style={{'--hwm-art-mix':phase?.artworkMix??0,'--hwm-title-mix':phase?.titleMix??0} as CSSProperties}>
    <img ref={art} className="record-fallback-art" src="/assets/roses-cover.png" alt={concealed?"":"Roses · The Chainsmokers featuring ROZES · original pink floral artwork"} draggable={false}/>
    <div className="record-hwm-fallback" aria-hidden="true"><img ref={hwmArt} className="record-hwm-source" src="/assets/here-with-me-cover.jpg" alt="" draggable={false} onError={()=>setArtworkMissing(true)} onLoad={()=>setArtworkMissing(false)}/></div>
    <canvas ref={ref} role="img" aria-label={concealed?"Black-hole vinyl responding to live notes":phase&&phase.mix>=.5?"Here With Me vinyl · original Marshmello and CHVRCHES artwork":"Dynamic Roses record disc responding to live notes and music"}/>
    {artworkMissing&&phase&&phase.mix>0&&<small className="record-artwork-warning" role="status">Here With Me cover unavailable</small>}
    {!concealed&&<span className="vinyl-song-caption" aria-label={phase&&phase.titleMix>=.5?"Here With Me · Marshmello ft. CHVRCHES":"Roses · Live record"}><span aria-hidden="true" style={{opacity:'calc(1 - var(--hwm-title-mix,0))'}}>ROSES · LIVE RECORD</span><span aria-hidden="true" style={{opacity:'var(--hwm-title-mix,0)'}}>HERE WITH ME · MARSHMELLO FT. CHVRCHES</span></span>}
  </div>;
}
