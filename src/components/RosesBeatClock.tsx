import {backingFrame} from "../piano/backingVisuals";
import {defaultBackingMode} from "../piano/rosesBacking";
import { useEffect, useState } from "react";
import { rosesDrumTargets, rosesIntroBeats, rosesIntroTempo } from "../piano/rosesIntro";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { closerTarget, type RosesCloserSettings } from "../piano/rosesCloser";
import { leadEndBeat } from "../piano/hereWithMeLead";

type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; leadMs?: number; compact?: boolean; feedback?: string; closerSettings?: RosesCloserSettings };

/** Animation frames read Tone.Transport's beat position; they do not create a second clock. */
export default function RosesBeatClock({ engine, clock, leadMs = 0, compact = false, feedback, closerSettings }: Props) {
  const [position, setPosition] = useState({ beat: 0, bpm: rosesIntroTempo });
  useEffect(() => {
    if (!engine || !clock || clock.status === "idle" || clock.status === "finished") {
      setPosition({ beat: clock?.status === "finished" ? clock.drop?.status === "done" ? leadEndBeat : rosesIntroBeats : clock ? (clock.measure - 1) * 4 + clock.beat - 1 : 0, bpm: engine?.tempo() ?? rosesIntroTempo });
      return;
    }
    let frame = 0;
    const draw = () => {
      const beat = engine.scoreBeat();
      const bpm = engine.tempo();
      const lead = clock.status === "running" ? leadMs * bpm / 60000 : 0;
      setPosition({ beat: Math.max(0, beat + lead), bpm });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [engine, clock?.status, clock?.mode, leadMs]);

  const scoreBeat = position.beat;
  const view=backingFrame(clock?.buildup?.mode??defaultBackingMode,scoreBeat,clock?.drop?.backingSource,clock?.buildup,clock?.drop?.rows,clock?.drop);
  const bar = Math.floor(scoreBeat / 4) + 1;
  const beatInBar = Math.floor(scoreBeat % 4) + 1;
  const progress = scoreBeat % 1 * 100;
  const upcoming = rosesDrumTargets.filter(target => target.startBeat >= scoreBeat - .04 && target.startBeat < scoreBeat + 4).slice(0, 4);
  return <div className={`roses-beat-clock ${compact ? "compact" : ""}`} aria-label="Roses visual metronome">
    <div className="roses-beat-heading"><strong>BAR {bar} · {Math.round(position.bpm)} BPM</strong><span>{clock?.status === "finished" ? "FINISHED" : `BEAT ${beatInBar} / 4`}</span></div>
    <div className="roses-beat-lights">{[1, 2, 3, 4].map(beat => <span key={beat} className={beat === beatInBar && clock?.status !== "idle" && clock?.status !== "finished" ? "active" : ""}>{beat}</span>)}</div>
    <div className="roses-beat-progress"><i style={{ width: `${progress}%` }} /></div>
    <div className="roses-beat-cues">{view.inBuild ? <><span>{view.title} · {view.chord??view.source} · AUTO</span>{view.upcoming.filter(event=>event.layer==='drums').slice(0,2).map(event=><span key={event.id}>{event.label} · {Math.floor(event.start/4)+1}:{Number((event.start%4+1).toFixed(2))}</span>)}</> : upcoming.length ? upcoming.map(target => <span key={target.id}>{target.code === "KeyZ" ? "Z KICK" : "X CLAP"} · {target.bar}:{target.beatInBar}</span>) : <span>No drum cue in next 4 beats</span>}</div>
    {closerSettings && <div className="roses-beat-cues"><span>HERE WITH ME → {closerTarget(closerSettings).label} · {closerSettings.enabled ? clock?.closerStatus ?? "WAITING" : "OFF"}</span></div>}
    {compact && view.inBuild ? <small>{view.role} · {clock?.status === "paused"?"PAUSED":clock?.buildup?.status??"NOT ARMED"}</small> : compact && <small>VOCAL {clock?.vocalStatus ?? "NOT ARMED"}</small>}
    {!compact && feedback && <small>{feedback}</small>}
  </div>;
}
