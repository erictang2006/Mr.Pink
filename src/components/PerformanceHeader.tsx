import type {ReactNode} from "react";
import type { StagePresentation } from "../piano/performancePresentation";

type Props = { titleTransition?:{from:string;to:string;mix:number}; concealed?:boolean; audience?:boolean; song: StagePresentation; measure: number; bpm: number; beat?: number; sustain: boolean; showPedal: boolean; elapsed?: number; title?:string; section?:string; chord?:string; inputHud?:ReactNode; controls?:ReactNode; playbackStatus?:string };

export default function PerformanceHeader({ titleTransition, concealed=false, audience = false, song, measure, bpm, beat, sustain, showPedal, elapsed, title, section, chord, inputHud, controls, playbackStatus = "LIVE" }: Props) {
  const status=<div className="stage-status" aria-label="Performance status">
      <span className="stage-live"><i />{playbackStatus}</span>
      {!audience && <><span className="stage-tempo">{bpm}<small>BPM</small></span>
      <span className="stage-measure">M.{String(measure).padStart(2, "0")}{beat !== undefined && <small> / {Math.floor(beat)}</small>}</span>
      {showPedal && <span className={`stage-pedal ${sustain ? "is-on" : ""}`}><i />PEDAL {sustain ? "ON" : "OFF"}</span>}
      {elapsed !== undefined && <span className="stage-time">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}</>}
    </div>;
  return <header className="stage-header">
    <div className="stage-identity">
      <div className="stage-wordmark"><span className="stage-mark" aria-hidden="true"><i /><i /><i /><i /></span>MR PINK <span className="stage-edition">{song === "levels" ? "01" : song === "roses" ? "03" : "02"} / LIVE PERFORMANCE</span></div>
      {!concealed&&song!=="levels"&&<h1>{titleTransition?<span className="stage-song-morph" aria-label={titleTransition.mix<.5?titleTransition.from:titleTransition.to}><span aria-hidden="true" style={{opacity:`calc(1 - var(--hwm-title-mix,${titleTransition.mix}))`}}>{titleTransition.from}</span><span aria-hidden="true" style={{opacity:`var(--hwm-title-mix,${titleTransition.mix})`}}>{titleTransition.to}</span></span>:title??(song === "interstellar" ? "Interstellar" : "Roses")}<span className="stage-title-line" /></h1>}
      {song === "interstellar" && <p className="stage-composer">Hans Zimmer</p>}
      {section&&!audience&&!concealed&&<p className="stage-section">{section}{chord&&<b>{chord}</b>}</p>}
    </div>
    {inputHud || controls ? <div className="stage-status-stack">{status}{!audience && inputHud}{controls}</div> : status}
  </header>;
}
