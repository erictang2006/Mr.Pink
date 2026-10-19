import { useEffect, useState } from "react";
import { beatErrorMs, type RosesCalibrationSettings } from "../piano/rosesCalibration";
import { rosesIntroTempo } from "../piano/rosesIntro";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";

type Props = {
  engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; settings: RosesCalibrationSettings;
  onSettings: (value: RosesCalibrationSettings) => void; outputLabel: string;
  latency: { base: number | null; output: number | null }; onStartTest: () => void; audioReady: boolean;
};

export default function RosesCalibration({ engine, clock, settings, onSettings, outputLabel, latency, onStartTest, audioReady }: Props) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const tap = () => {
    if (!testing || clock?.status !== "running" || !engine) return;
    const error = beatErrorMs(engine.scoreBeat(), rosesIntroTempo);
    setTaps(previous => {
      const next = [...previous, error];
      if (next.length === 8) setTesting(false);
      return next;
    });
  };
  useEffect(() => {
    if (!testing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault(); tap();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [testing, clock?.status, engine]);
  useEffect(() => { engine?.setAudibleClick(settings.audibleClick); }, [engine, settings.audibleClick]);
  const sorted = [...taps].sort((a, b) => a - b);
  const median = sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : 0;
  const spread = taps.length ? Math.sqrt(taps.reduce((total, error) => total + (error - median) ** 2, 0) / taps.length) : 0;
  return <details className="roses-calibration" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Audio Calibration · {outputLabel}</summary>
    <div className="roses-calibration-body">
      <span>Context base latency: {latency.base === null ? "unavailable" : `${Math.round(latency.base)} ms`} · output latency: {latency.output === null ? "unavailable" : `${Math.round(latency.output)} ms`}</span>
      <label>Visual cue lead <output>{settings.leadMs} ms</output><input type="range" min="-250" max="250" step="5" value={settings.leadMs} onChange={event => onSettings({ ...settings, leadMs: Number(event.target.value) })} /></label>
      <label>Input grading offset <output>{settings.gradingMs} ms</output><input type="range" min="-250" max="250" step="5" value={settings.gradingMs} onChange={event => onSettings({ ...settings, gradingMs: Number(event.target.value) })} /></label>
      <label><input type="checkbox" checked={settings.audibleClick} onChange={event => onSettings({ ...settings, audibleClick: event.target.checked })} /> Audible beat click</label>
      <div><button disabled={!audioReady || !engine?.isReady()} onClick={() => { setTaps([]); setTesting(true); onStartTest(); }}>Start 8-tap test</button><button onClick={tap} disabled={!testing}>Tap beat ({taps.length}/8)</button>{taps.length === 8 && <button onClick={() => onSettings({ ...settings, gradingMs: Math.round(Math.max(-250, Math.min(250, median))) })}>Apply {Math.round(median)} ms to grading</button>}</div>
      <small>After starting, tap Enter eight times with the beat, or click Tap beat. Median {taps.length ? `${Math.round(median)} ms` : "—"} · spread {taps.length ? `${Math.round(spread)} ms` : "—"}. Positive grading offset treats a later physical input as on time. Settings are saved for this detected output. Visual lead changes only the guide; it cannot remove audio hardware latency.</small>
    </div>
  </details>;
}
