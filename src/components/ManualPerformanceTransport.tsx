import { useEffect, useRef, useState } from 'react';

/** Solo piano has no backing transport to invent: prepare the existing audio
 * lifecycle, then keep its real keyboard input completely unchanged. */
export default function ManualPerformanceTransport({prepare,stop}:{prepare:()=>Promise<boolean>;stop:()=>void}){
  const [armed,setArmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0),pending=useRef(false);
  useEffect(()=>()=>{generation.current++;},[]);
  async function start(){
    if(pending.current)return;
    const token=++generation.current;pending.current=true;setBusy(true);setError('');
    try{const ready=await prepare();if(token!==generation.current)return;if(ready)setArmed(true);else setError('Audio is not ready. Enable audio and retry.');}
    catch{if(token===generation.current)setError('Audio could not initialize. Retry when ready.');}
    finally{if(token===generation.current){pending.current=false;setBusy(false);}}
  }
  function reset(){generation.current++;pending.current=false;stop();setArmed(false);setBusy(false);setError('');}
  return <div className="manual-stage-transport" aria-label="Live piano readiness"><div>
    {!armed?<button className="stage-arm-start" disabled={busy} onClick={start}><span className="stage-start-symbol" aria-hidden="true">▷</span>{busy?'PREPARING…':'ARM + START'}</button>:<><button className="stage-secondary-control" onClick={()=>{reset();void start();}}>Restart</button><button className="stage-secondary-control" onClick={reset}>Stop</button></>}
    {busy&&<button className="stage-secondary-control" onClick={reset}>Cancel</button>}
  </div><small>{armed?'LIVE INPUT READY · PLAY YOUR KEYS':'LIVE PIANO · YOUR KEYS SET THE TEMPO'}</small>{error&&<small role="alert">{error}</small>}</div>;
}
