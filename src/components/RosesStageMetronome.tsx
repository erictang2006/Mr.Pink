import { useEffect, useState } from 'react';
import type { RosesIntroEngine, RosesIntroSnapshot } from '../piano/rosesIntroEngine';

/** Live lights read the existing Tone transport; count-in runs only before it starts. */
export default function RosesStageMetronome({engine,clock,leadMs=0,countInBeat=0}:{engine:RosesIntroEngine|null;clock:RosesIntroSnapshot|null;leadMs?:number;countInBeat?:number}) {
  const [liveBeat,setLiveBeat]=useState(1);
  useEffect(()=>{
    if(!engine || !clock || !['running','paused'].includes(clock.status)) return;
    let frame=0;
    const update=()=>{
      if(!document.hidden){
        const lead=clock.status==='running' ? leadMs*engine.tempo()/60000 : 0;
        const score=Math.max(0,engine.scoreBeat()+lead);
        const beat=Math.floor(score%4)+1;
        setLiveBeat(previous=>previous===beat?previous:beat);
      }
      frame=requestAnimationFrame(update);
    };
    frame=requestAnimationFrame(update);
    return()=>cancelAnimationFrame(frame);
  },[engine,clock?.status,leadMs]);
  const counting=countInBeat>=1 && countInBeat<=4;
  const playing=clock?.status==='running'||clock?.status==='paused';
  const active=counting?countInBeat:playing&&(clock?.pulse??0)>0?liveBeat:0;
  return <div className={`roses-stage-metronome ${counting?'is-counting':''}`} aria-label="Roses visual metronome">
    <span aria-live="polite">{counting?`COUNT IN · ${countInBeat} / 4`:clock?.status==='paused'?'PAUSED':playing?`BEAT ${liveBeat} / 4`:'READY · 100 BPM'}</span>
    <div className="roses-stage-beat-lights">{[1,2,3,4].map(beat=><i key={beat} className={beat===active?'active':''}>{beat}</i>)}</div>
  </div>;
}
