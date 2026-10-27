import {memo,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {introTypingConfig,typingMetrics,type TypingSnapshot} from './typingTest';
import type {OpeningSnapshot} from './sequence';
import './typingTest.css';

const Passage=memo(function Passage({state}:{state:TypingSnapshot}) {
  let index=0;
  return <>{state.passage.split(/(\s+)/).map((word,wordIndex)=>{
    const characters=Array.from(word).map(character=>{
      const at=index++,typed=state.input[at],status=typed===undefined?'upcoming':typed===character?'correct':'incorrect';
      return <span key={at} data-typing-index={at} data-typing-current={at===state.input.length?'true':undefined} className={`intro-character is-${status} ${character===' '?'is-space':''}`} title={status==='incorrect'?`Typed ${typed===' '?'space':typed}; expected ${character===' '?'space':character}`:undefined}>{character}</span>;
    });
    return /^\s+$/.test(word)?characters:<span className="intro-word" key={wordIndex}>{characters}</span>;
  })}<span data-typing-end data-typing-current={state.input.length===state.passage.length?'true':undefined}>{'\u200b'}</span></>;
});
export default function TypingTestScreen({snapshot}:{snapshot:OpeningSnapshot}) {
  const state=snapshot.typing!;
  const [,setNow]=useState(0);
  const [caret,setCaret]=useState({left:0,top:0,height:32});
  const text=useRef<HTMLDivElement>(null);
  const complete=state.finishedAt!==null;
  const metrics=typingMetrics(state,performance.now());
  useEffect(()=>{
    if(state.startedAt===null||complete)return;
    setNow(performance.now());
    const timer=window.setInterval(()=>setNow(performance.now()),introTypingConfig.metricInterval);
    return()=>window.clearInterval(timer);
  },[state.startedAt,complete]);
  useLayoutEffect(()=>{
    const container=text.current!;
    const measure=()=>{
      const current=container.querySelector<HTMLElement>('[data-typing-current="true"]');if(!current)return;
      const rect=current.getBoundingClientRect(),parent=container.getBoundingClientRect();
      const next={left:rect.left-parent.left,top:rect.top-parent.top+rect.height*.07,height:rect.height*.88};
      setCaret(previous=>previous.left===next.left&&previous.top===next.top&&previous.height===next.height?previous:next);
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(container);
    return()=>observer.disconnect();
  },[state.input.length]);
  return <section className="intro-typing-screen" aria-label="Opening typing test">
    <div className="intro-typing-layout">
      <div className="intro-test-brand" aria-hidden="true">typing test</div>
      <div className="intro-metrics" aria-live="off"><div><output aria-label="Words per minute">{Math.round(metrics.wpm)}</output><span>wpm</span></div><div className="intro-accuracy"><output aria-label="Typing accuracy">{Math.round(metrics.accuracy)}<small>%</small></output><span>accuracy</span></div></div>
      <div ref={text} className={`intro-passage ${complete?'is-complete':''}`} role="textbox" aria-label="Type the displayed introduction" aria-multiline="true" aria-readonly={complete} tabIndex={0} spellCheck={false}>
        <Passage state={state}/>
        <i className={`intro-typing-caret ${state.startedAt===null?'is-idle':''}`} aria-hidden="true" style={{left:caret.left,top:caret.top,height:caret.height}}/>
      </div>
    </div>
  </section>;
}
