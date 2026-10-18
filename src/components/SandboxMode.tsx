import { useEffect, useRef, useState } from "react";
import PianoCanvas from "./PianoCanvas";
import PerformanceVisualizer from "./PerformanceVisualizer";
import SustainSettings, { type SustainSettingsValue } from "./SustainSettings";
import type { KeyboardMap } from "../piano/noteMapping";
import type { InputSnapshot } from "../piano/keyboardInput";
import type { LiveNotes } from "../piano/liveNotes";
import { phrasePitches, rosesPhrase } from "../piano/roses";
import { presetSettings, type SynthPreset, type SynthSettings } from "../piano/synthEngine";

export type SongId = "interstellar" | "levels" | "rush-e" | "roses";
type Labels = "computer" | "piano" | "both" | "none";
type Props = {
  songId: SongId; map: KeyboardMap; transpose: number; range: { low: number; high: number };
  snapshot: InputSnapshot; activePitches: number[]; liveNotes: LiveNotes;
  audioReady: boolean; startAudio: () => void;
  volume: number; setVolume: (value: number) => void;
  rosesTranspose: number; setRosesTranspose: (value: number) => void;
  synthSettings: SynthSettings; setSynthSettings: (value: SynthSettings) => void;
  sustainSettings: SustainSettingsValue; setSustainSettings: (value: SustainSettingsValue) => void;
  sustainActive: boolean; onSongChange: (song: SongId) => void;
  onSheet: (mode: "step" | "timed") => void; onExit: () => void; onPerformance: () => void;
};

const titles: Record<SongId, string> = { interstellar: "Interstellar", levels: "Levels — Avicii", "rush-e": "Rush E", roses: "Roses — The Chainsmokers" };

export default function SandboxMode({ songId, map, transpose, range, snapshot, activePitches, liveNotes, audioReady, startAudio, volume, setVolume, rosesTranspose, setRosesTranspose, synthSettings, setSynthSettings, sustainSettings, setSustainSettings, sustainActive, onSongChange, onSheet, onExit, onPerformance }: Props) {
  const [labels, setLabels] = useState<Labels>(() => {
    try { const value = localStorage.getItem("stage-piano-sandbox-labels"); return value === "piano" || value === "both" || value === "none" ? value : "computer"; }
    catch { return "computer"; }
  });
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => { try { localStorage.setItem("stage-piano-sandbox-labels", labels); } catch { /* storage unavailable */ } }, [labels]);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  async function toggleFullscreen() {
    if (document.fullscreenElement === root.current) await document.exitFullscreen();
    else await root.current?.requestFullscreen();
  }
  const synthControl = (key: "volume" | "attack" | "release" | "reverb" | "delay" | "chorus", label: string, min: number, max: number, step: number) =>
    <label key={key}>{label} <output>{key === "attack" || key === "release" ? `${Math.round(synthSettings[key] * 1000)} ms` : `${Math.round(synthSettings[key] * 100)}%`}</output><input type="range" min={min} max={max} step={step} value={synthSettings[key]} onChange={event => setSynthSettings({ ...synthSettings, [key]: Number(event.target.value) })} /></label>;

  return <main className={`sandbox-mode ${songId === "roses" ? "sandbox-roses" : ""}`} ref={root}>
    <header className="sandbox-header">
      <div><span className="practice-overline">STAGE PIANO / SANDBOX</span><h1>{titles[songId]}</h1><small>{songId === "roses" ? "Synth free play · Interstellar finger positions" : `${map.name} · free play`}</small></div>
      <div className="sandbox-actions">
        <label>Song <select value={songId} onChange={event => onSongChange(event.target.value as SongId)}><option value="interstellar">Interstellar</option><option value="levels">Levels — Avicii</option><option value="rush-e">Rush E — piano preset</option><option value="roses">Roses — The Chainsmokers</option></select></label>
        {(songId === "interstellar" || songId === "levels") && <div className="practice-segment"><button onClick={() => onSheet("step")}>Step</button><button onClick={() => onSheet("timed")}>Timed</button><button className="selected">Sandbox</button></div>}
        {(songId === "roses" || songId === "rush-e") && <span className="sandbox-mode-pill">SANDBOX</span>}
        {!audioReady && <button className="practice-primary" onClick={startAudio}>Enable audio</button>}
        <button onClick={toggleFullscreen}>{fullscreen ? "Exit Fullscreen" : "Fullscreen Sandbox"}</button>
        <button onClick={onPerformance}>Performance</button>
        <button onClick={onExit}>← Piano</button>
      </div>
    </header>
    <section className="sandbox-trails" aria-label="Live note trails"><PerformanceVisualizer notes={liveNotes} map={map} transpose={transpose} theme={songId === "roses" ? "roses" : "minimal"} notesPerSecond={snapshot.notesPerSecond} range={range} /></section>
    <section className="sandbox-keyboard" aria-label="Free play piano"><div className="sandbox-keyboard-head"><span>{map.name}</span><span>{snapshot.pressed.length} keys down · {snapshot.notesPerSecond} notes/s · Pedal {sustainActive ? "ON" : "OFF"}</span></div><PianoCanvas active={activePitches} map={map} transpose={transpose} range={range} labelMode={labels} practicePalette={songId === "roses"} /></section>
    <section className="sandbox-controls">
      <div className="sandbox-control-line"><label>Labels <select value={labels} onChange={event => setLabels(event.target.value as Labels)}><option value="computer">Computer keys</option><option value="piano">Piano notes</option><option value="both">Both</option><option value="none">None</option></select></label><label>Master <output>{volume}%</output><input type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>{songId === "roses" && <><label>Preset <select value={synthSettings.preset} onChange={event => setSynthSettings(presetSettings[event.target.value as SynthPreset])}><option value="bright">Bright Synth Lead</option><option value="warm">Warm Synth</option><option value="pluck">Pluck Synth</option></select></label><label>Transpose <output>{rosesTranspose > 0 ? "+" : ""}{rosesTranspose}</output><input type="range" min="-12" max="12" step="1" value={rosesTranspose} onChange={event => setRosesTranspose(Number(event.target.value))} /></label></>}</div>
      {songId === "roses" && <details className="sandbox-details"><summary>Synth sound settings</summary><div className="sandbox-control-line">{synthControl("volume", "Synth volume", 0, 1, .01)}{synthControl("attack", "Attack", .001, .4, .001)}{synthControl("release", "Release", .05, 2, .01)}{synthControl("reverb", "Reverb", 0, .65, .01)}{synthControl("delay", "Delay", 0, .5, .01)}{synthControl("chorus", "Chorus", 0, .5, .01)}</div></details>}
      {songId === "roses" && <details className="sandbox-details"><summary>Optional opening phrase reference · physical keys</summary><div className="sandbox-phrase">{rosesPhrase.map((keys, index) => <span key={index}><b>{keys.length > 1 ? `[${keys}]` : keys}</b><small>{phrasePitches(keys, rosesTranspose).join(" + ")}</small></span>)}</div><p>Play freely. Unmapped keys remain unmapped; this phrase is a reference, not a scored song.</p></details>}
      <details className="sandbox-details"><summary>Sustain and shortcuts</summary><SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} /><p>Space toggles sustain · F9 stops all sounds. Note trails show physical key hold time.</p></details>
    </section>
  </main>;
}
