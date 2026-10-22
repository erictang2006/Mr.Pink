import type { StagePresentation } from "../piano/performancePresentation";

type Props = { song: StagePresentation; measure: number; bpm: number; beat?: number; sustain: boolean; showPedal: boolean; elapsed?: number; title?:string; section?:string; chord?:string };

export default function PerformanceHeader({ song, measure, bpm, beat, sustain, showPedal, elapsed, title, section, chord }: Props) {
  return <header className="stage-header">
    <div className="stage-identity">
      <div className="stage-wordmark"><span className="stage-mark" aria-hidden="true"><i /><i /><i /><i /></span>MR PINK <span className="stage-edition">{song === "interstellar" ? "01" : song === "roses" ? "03" : "02"} / LIVE PERFORMANCE</span></div>
      <h1>{title??(song === "interstellar" ? "Interstellar" : song === "roses" ? "Roses" : "Levels")}<span className="stage-title-line" /></h1>
      {song === "interstellar" && <p className="stage-composer">Hans Zimmer</p>}
      {section&&<p className="stage-section">{section}{chord&&<b>{chord}</b>}</p>}
    </div>
    <div className="stage-status" aria-label="Performance status">
      <span className="stage-live"><i />LIVE</span>
      <span className="stage-tempo">{bpm}<small>BPM</small></span>
      <span className="stage-measure">M.{String(measure).padStart(2, "0")}{beat !== undefined && <small> / {Math.floor(beat)}</small>}</span>
      {showPedal && <span className={`stage-pedal ${sustain ? "is-on" : ""}`}><i />PEDAL {sustain ? "ON" : "OFF"}</span>}
      {elapsed !== undefined && <span className="stage-time">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}
    </div>
  </header>;
}
