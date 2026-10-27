import type { HwmVinylTimeline } from '../piano/rosesHwmVisuals';
import PerformanceEnergyOrb,{type OrbReveal} from './PerformanceEnergyOrb';
import type { StageActivity } from './stageEnergy';
import * as Tone from 'tone';
import { useEffect, useRef, type CSSProperties, type ReactNode, type MutableRefObject } from 'react';
import type { InputSnapshot } from '../piano/keyboardInput';
import type { LiveNotes } from '../piano/liveNotes';
import { padNoteLevel, physicalKeyLabel, type PerformancePad } from '../piano/performancePads';
import './performanceWorkstation.css';
import { observeOutput } from '../piano/outputObserver';

function InstrumentGlyph({group}:{group:PerformancePad['group']}) {
  const paths:Record<PerformancePad['group'],string>={
    Drums:'M3 7 Q12 2 21 7 L21 17 Q12 23 3 17 Z M3 7 Q12 12 21 7 M7 9 V19 M17 9 V19',
    Synth:'M2 13 L5 13 L7 4 L11 21 L15 6 L18 13 L22 13',
    Bass:'M4 6 H20 M4 12 H16 M4 18 H11',
    Chords:'M3 5 H21 V20 H3 Z M8 5 V20 M14 5 V20 M6 5 V11 M12 5 V11 M18 5 V11',
    Vocal:'M9 4 Q12 1 15 4 V12 Q12 16 9 12 Z M5 10 V12 Q5 20 12 20 Q19 20 19 12 V10 M12 20 V23',
    FX:'M12 2 L14 9 L22 12 L14 15 L12 22 L10 15 L2 12 L10 9 Z',
    Backing:'M4 5 H20 M4 12 H20 M4 19 H20 M8 3 V7 M16 10 V14 M10 17 V21',
  };
  return <svg className="pad-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[group]}/></svg>;
}

export function OutputSignal({level,waveform}:{level:MutableRefObject<number>;waveform:MutableRefObject<Float32Array|undefined>}) {
  useEffect(() => {
    let observerTap: ReturnType<typeof observeOutput<Tone.Waveform>> | undefined;
    const destination = Tone.getDestination();
    // Parallel analysis sink: never insert effects, start audio, or alter the speaker path.
    try { observerTap = observeOutput<Tone.Waveform>(destination, () => new Tone.Waveform(256)); } catch { /* Silence is shown if analysis is unavailable. */ }
    let frame = 0, last = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (now: number) => {
      frame=requestAnimationFrame(draw);
      if (document.hidden || now-last<(reduced?100:33)) return;
      last=now;
      let values:Float32Array|undefined;
      try { values=observerTap?.node.getValue(); } catch { level.current=0; waveform.current=undefined; return; }
      waveform.current=values;
      let square=0;
      for(let i=0;i<256;i++) {
        const sample=values?.[i]??0; square+=sample*sample;
      }
      level.current=Math.min(1,Math.sqrt(square/256)*4);
    };
    frame=requestAnimationFrame(draw);
    return () => {cancelAnimationFrame(frame);observerTap?.dispose();level.current=0;waveform.current=undefined;};
  }, []);
  return null;
}

type Props={vinylTimeline?:HwmVinylTimeline;reveal?:OrbReveal;audience?:boolean;pads:PerformancePad[];snapshot:InputSnapshot;notes:LiveNotes;mappingName:string;activity?:StageActivity;stageLevel?:MutableRefObject<number>;introLoop?:ReactNode};
export default function PerformanceWorkstation({vinylTimeline,reveal,pads:allPads,snapshot,notes,mappingName,activity={},stageLevel,audience=false,introLoop}:Props) {
  const pads = audience ? allPads.filter(pad => pad.kind === 'live') : allPads;
  const root=useRef<HTMLDivElement>(null);
  const audioLevel=useRef(0),localStageLevel=useRef(0),waveform=useRef<Float32Array|undefined>(undefined);
  const values=useRef({pads,snapshot,notes});values.current={pads,snapshot,notes};
  useEffect(()=>{
    let frame=0,last=0;
    let cachedPads: PerformancePad[] | undefined;
    let elements: { element: HTMLElement; pad: PerformancePad }[] = [];
    const flashes=new Map<string,{pressed:boolean;pulse?:string;at:number;strike:number;glow?:number}>();
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(document.hidden||now-last<33)return;last=now;
      const current=values.current, live=[...current.notes.soundingNotes(),...current.notes.recentReleases(now,360)];
      if (cachedPads !== current.pads) {
        cachedPads = current.pads;
        const byId = new Map(current.pads.map(pad => [pad.id, pad]));
        elements = [...(root.current?.querySelectorAll<HTMLElement>('[data-pad-id]') ?? [])].flatMap(element => {
          const pad = byId.get(element.dataset.padId!); return pad ? [{ element, pad }] : [];
        });
        for (const id of flashes.keys()) if (!byId.has(id)) flashes.delete(id);
      }
      elements.forEach(({element,pad})=>{
        const pressed=!!pad.code&&current.snapshot.detected.includes(pad.code)&&pad.available!==false;
        const prior=flashes.get(pad.id)??{pressed:false,pulse:pad.pulse,at:-Infinity,strike:0};
        const hit=(pressed&&!prior.pressed)||(pad.pulse!==undefined&&prior.pulse!==pad.pulse);
        if(hit){prior.at=now;prior.strike++;element.dataset.strike=prior.strike%2?'a':'b';}
        prior.pressed=pressed;prior.pulse=pad.pulse;flashes.set(pad.id,prior);
        const inputGlow=pad.available===false?0:Math.max(pressed?1:0,Math.max(0,1-(now-prior.at)/360));
        // A sample can finish after its trigger window closes; keep its tail visible.
        const glow=Math.max(inputGlow,pad.active ? .6 : 0,pad.playing?.() ? .85 : 0,padNoteLevel(pad.code,live,now));
        if (prior.glow !== glow) {
          element.style.setProperty('--pad-level',String(glow));
          if (prior.glow === undefined || (prior.glow > .02) !== (glow > .02)) element.classList.toggle('is-lit',glow>.02);
          prior.glow = glow;
        }
      });
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  const concealed=!!reveal?.state.enabled&&reveal.state.revealedAt===null;
  const groups=[...new Set(pads.map(pad=>pad.group))];
  const loopAnchorIndex = Math.max(0, groups.flatMap(group => pads.filter(pad => pad.group === group)).findIndex(pad => pad.id === 'chord:Digit2'));
  const loopPlacement = Object.fromEntries([2, 3, 4, 6].flatMap(columns => [
    [`--loop-column-${columns}`, Math.min(loopAnchorIndex % columns + 1, columns - 1)],
    [`--loop-row-${columns}`, Math.floor(loopAnchorIndex / columns) + 2],
  ])) as CSSProperties;
  const downCodes=audience
    ? [...new Set(snapshot.detected)]
    : [...new Set([...snapshot.pressed.map(key=>key.code),...pads.filter(pad=>pad.code&&snapshot.detected.includes(pad.code)).map(pad=>pad.code!)])];
  return <div className={`performance-workstation ${groups.length?'':'is-piano-only'} ${audience?'is-audience':''}`} ref={root}>
    <div className="workstation-live"><span>{audience?'LIVE KEYS':'PHYSICAL INPUT'}</span><div>{snapshot.shift&&<kbd>⇧</kbd>}{downCodes.length?downCodes.map(code=><kbd key={code}>{physicalKeyLabel(code)}</kbd>):<small>Ready for your next note</small>}</div>{!audience&&!concealed&&<small>{mappingName}</small>}</div>
    <PerformanceEnergyOrb vinylTimeline={vinylTimeline} reveal={reveal} notes={notes} activity={activity} audioLevel={audioLevel} waveform={waveform} stageLevel={stageLevel??localStageLevel} />
    <OutputSignal level={audioLevel} waveform={waveform} />
    {groups.length>0&&<section className="workstation-instrument-field" aria-label="Performance instruments"><div className="workstation-field-heading"><span>{audience?'LIVE INSTRUMENTS':'INSTRUMENTS'}</span>{!audience && <small><i/>LIVE KEYS<i/>SEQUENCE / AUTO</small>}</div><div className="workstation-instruments" aria-label={audience?'Live instrument key bindings':'Instrument key bindings'}>{groups.map(group=><section className="workstation-group" key={group} aria-label={`${group} pads`}><h2>{group}{!audience && <small>{group==='Backing'?'AUTOMATED':'PHYSICAL KEYS'}</small>}</h2><div className="workstation-pad-grid">{pads.filter(pad=>pad.group===group).map(pad=><div key={pad.id} data-pad-id={pad.id} data-instrument={pad.group} className={`instrument-pad ${pad.kind==='auto'?'is-automatic':''} ${pad.available===false?'is-unavailable':''}`} title={audience ? pad.label : `${pad.label} · ${pad.key??'automatic backing'}${pad.detail?` · ${pad.detail}`:''}`}>
      {audience ? <div><InstrumentGlyph group={pad.group}/>{pad.key&&<kbd>{pad.key}</kbd>}</div> : <div>{pad.key?<kbd>{pad.key}</kbd>:<span className="pad-auto">AUTO</span>}<small className="pad-kind"><InstrumentGlyph group={pad.group}/>{pad.group} · {pad.queued?'QUEUED':pad.kind==='auto'?'BACKING':pad.kind==='cue'?'CUE':'LIVE'}</small></div>}<strong>{audience&&pad.group==='Chords'?'Chord':pad.label}</strong>{!audience&&pad.detail&&<span>{pad.detail}</span>}
    </div>)}</div></section>)}{introLoop&&<div className="workstation-intro-loop" data-anchor-pad="chord:Digit2" style={loopPlacement}>{introLoop}</div>}</div></section>}
  </div>;
}
