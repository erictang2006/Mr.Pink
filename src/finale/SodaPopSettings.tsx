import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {sodaPop} from './sodaPopEngine';
import './sodaPop.css';
function NumberSetting({label,value,min,max,step,disabled,onChange}:{label:string;value:number;min:number;max:number;step:number;disabled:boolean;onChange:(value:number)=>number}){
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{const number=Number(draft);if(draft!==''&&Number.isFinite(number))setDraft(String(onChange(number)));else setDraft(String(value));};
 return <label>{label}<input type="number" min={min} max={max} step={step} value={draft} disabled={disabled} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></label>;
}
function SodaPopPlaybackControls(){
 const state=useSyncExternalStore(sodaPop.subscribe,sodaPop.snapshot),controls=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState(0);
 const busy=sodaPop.active(),finished=state.status==='finished',length=state.settings.end-state.settings.start+state.settings.fadeSeconds;
 useEffect(()=>{
  if(!busy)return;
  const timer=window.setInterval(()=>{if(controls.current?.closest('details')?.open)setPosition(sodaPop.frame().music);},150);
  return()=>window.clearInterval(timer);
 },[busy]);
 if(!busy)return null;
 return (  <div ref={controls} className="soda-transport" aria-label="Soda Pop playback controls"><span>04 / SODA POP · {finished?'FINISHED':state.status==='paused'?'PAUSED':'AUDIO ONLY'}</span>
   {!finished&&<button onClick={()=>state.status==='paused'?sodaPop.resume():sodaPop.pause()}>{state.status==='paused'?'Resume':'Pause'}</button>}
   <button onClick={()=>sodaPop.restart()}>Restart finale</button><button onClick={()=>sodaPop.back()}>Stop / DJ</button>
   <label>Excerpt <input type="range" aria-label="Seek Soda Pop excerpt" min="0" max={length} step="0.01" value={Math.min(length,position)} onChange={event=>{const seconds=Number(event.target.value);setPosition(seconds);sodaPop.seek(state.settings.transition-state.settings.firstBeat+seconds);}}/><output>{(state.settings.start+position).toFixed(1)} s</output></label>
  </div>);
}
export default function SodaPopSettings(){
 const state=useSyncExternalStore(sodaPop.subscribe,sodaPop.snapshot),settings=state.settings,busy=sodaPop.active();
 const number=(label:string,key:'start'|'end'|'transition'|'bpm'|'firstBeat'|'fadeInSeconds',min:number,max:number,step:number)=><NumberSetting label={label} value={settings[key]} min={min} max={max} step={step} disabled={busy} onChange={value=>{sodaPop.configure({[key]:value});return sodaPop.snapshot().settings[key];}}/>;
 return <section className="soda-settings" aria-label="Soda Pop finale settings"><strong>Soda Pop · audio-only finale</strong>
  <small>Manual start only · Roses finishes without launching Soda Pop.</small>
  <label><input type="checkbox" checked={settings.countIn} disabled={busy} onChange={event=>sodaPop.configure({countIn:event.target.checked})}/>Four-beat metronome before Soda Pop</label>
  <label>Practice speed<select aria-label="Soda Pop practice speed" value={settings.speed} disabled={busy} onChange={event=>sodaPop.configure({speed:Number(event.target.value)===.5?.5:1})}><option value="1">1× · normal</option><option value="0.5">0.5× · slow practice</option></select></label>
  <small>0.5× slows the Soda Pop transition, count-in and excerpt together, with lower audio pitch. Choose the speed before starting or rehearsing.</small>
  <div className="soda-setting-grid">{number('Audio start (seconds)','start',0,3600,.01)}{number('Fade-in (seconds)','fadeInSeconds',0,5,.1)}{number('Fade starts (seconds)','end',.25,3600,.01)}{number('Transition (seconds)','transition',1,4.5,.025)}{number('First beat after cut (s)','firstBeat',0,.5,.01)}{number('Visual pulse BPM','bpm',60,200,.1)}</div>
  <details><summary>Transition cue positions</summary>{(['scratch','glitch','can'] as const).map(key=><label key={key}>{key==='can'?'Can opening':key==='scratch'?'Record scratch':'Digital glitch'} · {Math.round(settings[key]*100)}%<input type="range" min={key==='scratch'?12:key==='glitch'?30:55} max={key==='scratch'?40:key==='glitch'?60:88} step="1" disabled={busy} value={settings[key]*100} onChange={event=>sodaPop.configure({[key]:Number(event.target.value)/100})}/></label>)}</details>
  <small>Initial cut: 00:39, fading in over two seconds, full volume through 01:22, then a six-second fade-out. The metronome uses the pulse BPM; the transition fits at least four beats when enabled. Both fades follow practice speed. Fine-tune the cut and fade-in by ear; 1× plays at the original pitch and speed. Settings save automatically.</small>
  <div className="camera-actions"><button disabled={!state.connected||state.loading||busy} onClick={()=>void sodaPop.launch()}>{state.loading?'Preloading…':'Play Soda Pop finale'}</button><button disabled={!state.connected||state.loading||busy} onClick={()=>void sodaPop.rehearse()}>Rehearse bar 44 → Soda Pop</button>{busy&&<button onClick={()=>sodaPop.back()}>Stop / return to DJ</button>}</div>
  <SodaPopPlaybackControls />
  <small role={state.error?'alert':'status'}>{state.error||(!state.connected?'Open the performance to prepare the finale.':state.ready?'Audio preloaded · ready for manual start':'Audio preloads with Start, or when you rehearse.')}</small>
 </section>;
}
