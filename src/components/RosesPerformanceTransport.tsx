import { useEffect, useRef, useState } from "react";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import {fourBeatCountIn, type CountInHandle} from "../piano/fourBeatCountIn";
import RosesStageMetronome from "./RosesStageMetronome";
import {rosesIntroTempo} from "../piano/rosesIntro";

export default function RosesPerformanceTransport({ disabled=false,concealed=false,engine, clock, ready, prepareAudio, audience = false, leadMs = 0, countIn = fourBeatCountIn }: {disabled?:boolean;concealed?:boolean; audience?: boolean; engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; ready: boolean; prepareAudio?: () => Promise<void>; leadMs?: number; countIn?: typeof fourBeatCountIn }) {
  const [preparing, setPreparing] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const generation = useRef(0);
  const countInHandle = useRef<CountInHandle | null>(null);
  const startFromKey = useRef<() => void>(() => {});
  const cancelFromEvent = useRef<() => void>(() => {});
  useEffect(() => () => { generation.current++; countInHandle.current?.cancel(); countInHandle.current=null; }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey=(event:KeyboardEvent)=>{
      if((event.code==='F9'||event.code==='KeyB')&&pending.current){cancelFromEvent.current();return;}
      if(disabled)return;
      if(event.code!=='Space'||event.repeat||event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey)return;
      if(!['idle','finished'].includes(engine?.snapshot().status??''))return;
      if((event.target as HTMLElement|null)?.closest('input, textarea, select, [contenteditable="true"]'))return;
      event.preventDefault();
      startFromKey.current();
    };
    const onBlur=()=>{if(pending.current)cancelFromEvent.current();};
    const onHidden=()=>{if(document.hidden&&pending.current)cancelFromEvent.current();};
    window.addEventListener('keydown',onKey,true);
    window.addEventListener('blur',onBlur);
    document.addEventListener('visibilitychange',onHidden);
    return()=>{window.removeEventListener('keydown',onKey,true);window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onHidden);};
  },[engine,disabled]);
  const running = clock?.status === "running", paused = clock?.status === "paused";
  const loaded = ready && !!engine?.isReady() && clock?.vocalReady && (clock.closerReady || clock.closerStatus === "OFF") && clock?.drop?.status !== "loading";
  const cancelStart=()=>{
    generation.current++;
    countInHandle.current?.cancel();countInHandle.current=null;
    pending.current=false;setCountInBeat(0);setPreparing(false);
  };
  async function start() {
    if (disabled || !engine || !loaded || pending.current) return;
    const token = ++generation.current;
    pending.current = true; setPreparing(true); setError("");
    try {
      await prepareAudio?.();
      if (token !== generation.current) return;
      if (!await engine.preparePerformanceAudio()) {
        if (token === generation.current) setError("Drop audio could not load. Check the selected recording and retry.");
        return;
      }
      if (token !== generation.current) return;
      // startAt schedules Tone.Transport +0.05; call it just before beat five.
      countInHandle.current=countIn(60000/rosesIntroTempo,setCountInBeat,globalThis,50);
      const result=await countInHandle.current.promise;
      if (token !== generation.current || result==='cancelled') return;
      countInHandle.current=null;
      if(!['idle','finished'].includes(engine.snapshot().status))return;
      if (!await engine.startArmedPerformance() && token === generation.current) setError("Backing could not start. Check that the vocal and drop audio are ready, then retry.");
    } catch { if (token === generation.current) setError("Backing could not start. Stop and retry."); }
    finally { if (token === generation.current) { pending.current = false; setPreparing(false); setCountInBeat(0); } }
  }
  startFromKey.current=()=>{void start();};
  cancelFromEvent.current=cancelStart;
  return <><div hidden={audience && (running || paused)} className="roses-stage-transport" data-state={countInBeat?'counting':preparing ? "preparing" : running ? "playing" : paused ? "paused" : "ready"} aria-label={concealed?"Performance playback":"Roses performance playback"}>
    <div>
      {!running && !paused ? <button className="stage-arm-start" disabled={disabled || !loaded || preparing} onClick={start}><span className="stage-start-symbol" aria-hidden="true">▷</span>{countInBeat?"COUNTING IN…":preparing ? "PREPARING…" : audience ? "START PERFORMANCE" : "ARM + START"}</button> : <>
        <button className="stage-secondary-control" disabled={preparing} onClick={() => paused ? engine?.resume() : engine?.pause()}>{paused ? "Resume" : "Pause"}</button>
        <button className="stage-secondary-control" disabled={preparing} onClick={() => { engine?.reset(1); void start(); }}>Restart</button>
      </>}
      {(running || paused || preparing) && <button className="stage-secondary-control" disabled={!engine} onClick={() => { cancelStart(); engine?.reset(1); setError(""); }}>Stop</button>}
    </div>
    {audience && !running && !paused && !preparing && <small>SPACE OR CLICK · FOUR-BEAT COUNTDOWN</small>}
    {!audience && <small>{running ? "PERFORMANCE LIVE" : paused ? "PAUSED" : "BAR 01 · CONFIGURED BACKING"} · {clock?.bassPlaybackMode === "manual" ? "BASS/SUB MANUAL" : "BASS/SUB AUTO"}</small>}
    {error && <small role="alert">{error}</small>}
  </div><RosesStageMetronome engine={engine} clock={clock} leadMs={leadMs} countInBeat={countInBeat}/></>;
}
