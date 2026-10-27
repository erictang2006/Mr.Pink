import {interstellarPianoNoteLabel} from '../piano/interstellarPresentation';
import {useSyncExternalStore,useState,type CSSProperties} from 'react';
import {LiveKeyHistory,liveKeySettings,type RecentKey} from '../piano/liveKeyHistory';
import './liveKeysHud.css';

/** Only the small HUD subscribes; expiry never rerenders the piano or visualizer. */
export default function LiveKeysHud({history,reveal=false,reduced=false,transpose=0}:{history:LiveKeyHistory;reveal?:boolean;reduced?:boolean;transpose?:number}){
  const entries=useSyncExternalStore(history.subscribe,history.getSnapshot,history.getSnapshot);
  return <div className={`live-keys-hud ${reveal?'is-reveal':reduced?'is-reduced':''}`} role="group" aria-label="Recent piano notes and their displayed key labels">
    <span className="live-keys-history">{entries.slice(reduced&&!reveal?-3:-liveKeySettings.limit).map(key=><LiveKeyPill key={key.id} entry={key} transpose={transpose}/>)}</span>
  </div>;
}

function LiveKeyPill({entry,transpose}:{entry:RecentKey;transpose:number}){
  const [offset]=useState(()=>-Math.max(0,performance.now()-entry.at));
  const {keyLabel}=interstellarPianoNoteLabel(entry.midi,transpose);
  if(!keyLabel)return null;
  return <span className="live-key-pill" title={`Piano key ${keyLabel}`} style={{'--key-lifetime':`${liveKeySettings.lifetime}ms`,animationDelay:`${offset}ms`} as CSSProperties}><kbd className="live-key-binding">{keyLabel}</kbd></span>;
}
