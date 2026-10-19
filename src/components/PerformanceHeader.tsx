import type { StagePresentation } from "../piano/performancePresentation";

type Props = { song: StagePresentation; measure: number; bpm: number; beat?: number; sustain: boolean; showPedal: boolean; elapsed?: number };

export default function PerformanceHeader({ song, measure, bpm, beat, sustain, showPedal, elapsed }: Props) {
  return <header className="stage-header">
    <div className="stage-identity">
      <div className="stage-wordmark"><span className="stage-mark" aria-hidden="true"><i /><i /><i /><i /></span>MR PINK <span className="stage-edition">{song === "interstellar" ? "01" : "02"} / LIVE PERFORMANCE</span></div>
      <h1>{song === "interstellar" ? "Interstellar" : "Levels"}<span className="stage-title-line" /></h1>
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
