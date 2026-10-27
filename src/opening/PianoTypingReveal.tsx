import {useMemo,type CSSProperties} from 'react';
import {getPitch,type KeyboardMap} from '../piano/noteMapping';
import {starlightColor} from '../components/starlight';
import type {OpeningSnapshot} from './sequence';
import {pianoTypingConfig,pianoTypingParticles,pianoTypingPitch} from './pianoTyping';
import './pianoTyping.css';

export function pianoTypingStyle(snapshot:OpeningSnapshot,now:number):CSSProperties {
  const elapsed=snapshot.pianoCompletedAt===undefined?0:Math.max(0,now-snapshot.pianoCompletedAt);
  return {'--piano-text-hold':`${pianoTypingConfig.hold}ms`,'--piano-text-dissolve':`${pianoTypingConfig.dissolve}ms`,'--piano-text-pulse':`${pianoTypingConfig.characterPulse}ms`,'--piano-text-offset':`${-elapsed}ms`,'--piano-text-dissolve-at':`${pianoTypingConfig.hold-elapsed}ms`} as CSSProperties;
}
/** Transparent text only; the existing keyboard, engine and starfield remain mounted below. */
export default function PianoTypingReveal({snapshot,map,transpose=0}:{snapshot:OpeningSnapshot;map:KeyboardMap;transpose?:number}) {
  const text=snapshot.pianoText??'',complete=snapshot.pianoCompletedAt!==undefined,last=snapshot.pianoLastInput;
  const style=useMemo(()=>pianoTypingStyle(snapshot,performance.now()),[snapshot.run,snapshot.pianoCompletedAt]);
  const midi=last?(pianoTypingPitch(last.code,last.shift,transpose,map)??getPitch(map,last.code,last.shift,transpose)):null;
  const color=midi===null?'#e7e8df':starlightColor(midi);
  let index=0;
  return <section className={`piano-typing-reveal ${complete?'is-complete':''}`} aria-label="Piano typing reveal" style={style}>
    <div className="piano-typing-message" role="textbox" aria-label="Piano typing message" aria-readonly={complete} aria-multiline="true" tabIndex={0}>
      <span className="piano-typing-letters">{text.split(/(\s+)/).map((word,wordIndex)=>{
        const letters=Array.from(word).map(character=>{
          const at=index++,fresh=last?.index===at&&last.code!=='Backspace'&&!complete;
          return <span key={fresh?`${at}-${last.serial}`:at} className={fresh?'piano-typed-character is-fresh':'piano-typed-character'} style={fresh?{'--typed-note-color':color} as CSSProperties:undefined}>{character}</span>;
        });
        return /^\s+$/.test(word)?letters:<span className="piano-typing-word" key={wordIndex}>{letters}</span>;
      })}</span><i className="piano-typing-caret" aria-hidden="true"/>
    </div>
    {complete&&<div className="piano-typing-stardust" aria-hidden="true">{pianoTypingParticles.map((particle,i)=><i key={i} style={{left:`${particle.left}%`,top:`${particle.top}%`,width:particle.size,height:particle.size,'--dust-x':`${particle.x}px`,'--dust-y':`${particle.y}px`,'--dust-delay':`${particle.delay}ms`} as CSSProperties}/>)}</div>}
  </section>;
}
