import type {CSSProperties} from 'react';
import FractureCanvas from './FractureCanvas';
import {openingCues,openingMessage,openingTiming,type OpeningSnapshot,type OpeningFallback} from './sequence';
import './opening.css';

export const csaLogoMask='/branding/csa/logo-mask.png';
const messageDust=Array.from({length:8},(_,i)=>({left:18+(i*37%67),top:23+(i*19%51),delay:-(i*.73),duration:6+i%4}));
export const openingStyle = (snapshot:OpeningSnapshot):CSSProperties => ({
  '--opening-easing':openingTiming.easing,
  '--opening-hold':`${openingTiming.messageHold}ms`,
  '--opening-convergence':`${openingTiming.convergence}ms`,
  '--opening-formation':`${openingTiming.logoFormation}ms`,
  '--opening-logo-hold':`${openingTiming.logoHold}ms`,
  '--opening-fracture':`${openingTiming.fracture}ms`,
  '--opening-reveal':`${openingTiming.pianoReveal}ms`,
  '--opening-formation-at':`${openingCues.formation-snapshot.animationOffset}ms`,
  '--opening-wipe-at':`${openingCues.formation+openingTiming.convergence-snapshot.animationOffset}ms`,
  '--opening-logo-hold-at':`${openingCues.hold-snapshot.animationOffset}ms`,
  '--opening-fracture-at':`${openingCues.fracture-snapshot.animationOffset}ms`,
  '--opening-reveal-at':`${openingCues.reveal-snapshot.animationOffset}ms`,
  '--opening-active-at':`${openingCues.active-snapshot.animationOffset}ms`,
  '--csa-logo-mask':`url("${csaLogoMask}")`,
}) as CSSProperties;

export default function OpeningReveal({snapshot,onFailure}:{snapshot:OpeningSnapshot;onFailure:(reason:OpeningFallback)=>void}) {
  const entry=snapshot.scene==='MESSAGE_ENTRY';
  return <div className={`csa-opening ${entry?'is-entry':'is-sequence'}`} data-scene={snapshot.scene} role="region" aria-label="CSA opening reveal" style={openingStyle(snapshot)}>
    <div className="csa-opening-curtain"/>
    <div className="csa-opening-bloom" aria-hidden="true"/>
    <div className="csa-message-atmosphere" aria-hidden="true">
      <div className="csa-message-aura"/>
      <div className="csa-message-dust">{messageDust.map((dust,i)=><i key={i} style={{left:`${dust.left}%`,top:`${dust.top}%`,animationDelay:`${dust.delay}s`,animationDuration:`${dust.duration}s`}}/>)}</div>
    </div>
    <div className="csa-message" aria-label="Type I LOVE CSA" role="textbox" aria-readonly={!entry} aria-multiline={false} tabIndex={0}>
      <span className="csa-message-copy">
        <span className="csa-message-text">{entry?snapshot.message:openingMessage}</span>
        <i className="csa-message-echo echo-cyan" data-text={openingMessage} aria-hidden="true"/>
        <i className="csa-message-echo echo-ruby" data-text={openingMessage} aria-hidden="true"/>
        <i className="csa-message-echo echo-slice" data-text={openingMessage} aria-hidden="true"/>
        <span className="csa-message-fragments" aria-hidden="true">{[12,27,42,61,76,91].map((left,i)=><i key={left} style={{left:`${left}%`,'--fragment-x':`${(2.5-i)*7}px`,'--fragment-y':`${i%2?9:-7}px`,'--fragment-delay':`${i*13}ms` } as CSSProperties}/>)}</span>
        <i className="csa-caret" aria-hidden="true"/>
      </span>
    </div>
    <div className="csa-convergence-lines" aria-hidden="true"><i/><i/><i/></div>
    <div className="csa-logo" role="img" aria-label="Original CSA logo">
      <span className="csa-logo-solid"/>

    </div>
    <FractureCanvas running={!entry} origin={snapshot.timelineOrigin} mask={csaLogoMask} onFailure={onFailure}/>
    <span className="sr-only" aria-live="polite">{entry?'Message entry':snapshot.scene==='LOGO_HOLD'?'CSA':snapshot.scene==='PIANO_REVEAL'?'Interstellar piano reveal':openingMessage}</span>
  </div>;
}
