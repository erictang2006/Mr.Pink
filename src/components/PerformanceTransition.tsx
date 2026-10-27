import type { CSSProperties } from 'react';
import './performanceTransition.css';

/** Finite decorative layers: no audio hooks, timers, canvas or frame loop. */
export default function PerformanceTransition({song,onComplete}:{song:string;onComplete:()=>void}) {
  const roses=song==='roses';
  const title=roses?'Roses':song==='levels'?'Levels':'Interstellar';
  return <div className={`setlist-transition transition-${song}`} aria-hidden="true"
    onAnimationEnd={event=>{if(event.target===event.currentTarget)onComplete();}}>
    <div className="setlist-curtain curtain-left"/>
    <div className="setlist-curtain curtain-right"/>
    <div className="setlist-horizon"/>
    <div className="setlist-orbit orbit-one"/>
    <div className="setlist-orbit orbit-two"/>
    <div className="setlist-orbit orbit-three"/>
    <div className="setlist-sweep"/>
    <div className="setlist-sparks">{Array.from({length:12},(_,i)=><i key={i} style={{'--angle':`${i*30+8}deg`,'--delay':`${i%4*45}ms`,'--reach':`${120+i%3*55}px`} as CSSProperties}/>)}</div>
    <div className="setlist-title-card">
      <span className="setlist-chapter">{roses?'03 / THE BLOOM':song==='levels'?'01 / THE SPARK':'02 / INTO THE STARS'}</span>
      <div className="setlist-title-mask"><strong>{title}</strong></div>
      <span className="setlist-title-rule"/>
      <span className="setlist-artist">{roses?'THE CHAINSMOKERS':song==='levels'?'AVICII':'HANS ZIMMER'}</span>
    </div>
    <span className="setlist-signature">MR PINK · LIVE PERFORMANCE</span>
  </div>;
}
