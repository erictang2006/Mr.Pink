import BackingGuide from "./BackingGuide";
import {backingFrame} from "../piano/backingVisuals";
import {defaultBackingMode} from "../piano/rosesBacking";
import {rosesKeyGuide} from "../piano/rosesPresentation";
import { useEffect, useRef, useState } from "react";
import RosesBuildupControls from "./RosesBuildupControls";
import HereWithMeLeadControls from "./HereWithMeLeadControls";
import DropLayerMixer from "./DropLayerMixer";
import RosesBackingControls from "./RosesBackingControls";
import HereWithMeChordControls from "./HereWithMeChordControls";
import type { HereWithMeChordSound } from "../piano/hereWithMeChords";
import type { RosesCloserSettings } from "../piano/rosesCloser";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import type { BuildupSettings } from "../piano/rosesBuildup";
import PianoCanvas from "./PianoCanvas";
import PerformanceVisualizer from "./PerformanceVisualizer";
import SustainSettings, { type SustainSettingsValue } from "./SustainSettings";
import type { KeyboardMap } from "../piano/noteMapping";
import type { InputSnapshot } from "../piano/keyboardInput";
import type { LiveNotes } from "../piano/liveNotes";
import { phrasePitches, rosesPhrase } from "../piano/roses";
import type { SynthSettings } from "../piano/synthEngine";
import InstrumentLibrary from "./InstrumentLibrary";
import RosesDropControls from "./RosesDropControls";
import type { RosesDropSettings } from "../piano/rosesDropSettings";

export type SongId = "interstellar" | "levels" | "rush-e" | "roses";
type Labels = "computer" | "piano" | "both" | "none";
type Props = {
  vocalKey?: string;
  hereWithMeHarmonyVolume: number; onHereWithMeHarmonyVolume: (value:number) => void;
  hereWithMeChordSound: HereWithMeChordSound; onHereWithMeChordSound: (value: HereWithMeChordSound) => void;
  closerSettings: RosesCloserSettings; onCloserSettings: (settings:RosesCloserSettings) => void;
  introEngine: RosesIntroEngine | null; introClock: RosesIntroSnapshot | null; buildupSettings: BuildupSettings; onBuildupSettings: (value: BuildupSettings) => void;
  songId: SongId; map: KeyboardMap; transpose: number; range: { low: number; high: number };
  snapshot: InputSnapshot; activePitches: number[]; liveNotes: LiveNotes;
  audioReady: boolean; startAudio: () => void;
  volume: number; setVolume: (value: number) => void;
  rosesTranspose: number; setRosesTranspose: (value: number) => void;
  synthSettings: SynthSettings; setSynthSettings: (value: SynthSettings) => void;
  dropSettings: RosesDropSettings; setDropSettings: (value: RosesDropSettings) => void;
  compareLoudStab: (side: "A" | "B") => void;
  instrumentId: string; setInstrumentId: (id: string) => void; instrumentError: string; previewInstrument: (midi: number) => void;
  sustainSettings: SustainSettingsValue; setSustainSettings: (value: SustainSettingsValue) => void;
  sustainActive: boolean; onSongChange: (song: SongId) => void;
  onSheet: (mode: "step" | "timed") => void; onExit: () => void; onPerformance: () => void;
};

const titles: Record<SongId, string> = { interstellar: "Interstellar", levels: "Levels — Avicii", "rush-e": "Rush E", roses: "Roses — The Chainsmokers" };

export default function SandboxMode({ vocalKey="KeyL", hereWithMeHarmonyVolume, onHereWithMeHarmonyVolume, hereWithMeChordSound, onHereWithMeChordSound, closerSettings, onCloserSettings, introEngine, introClock, buildupSettings, onBuildupSettings, songId, map, transpose, range, snapshot, activePitches, liveNotes, audioReady, startAudio, volume, setVolume, rosesTranspose, setRosesTranspose, synthSettings, setSynthSettings, dropSettings, setDropSettings, compareLoudStab, instrumentId, setInstrumentId, instrumentError, previewInstrument, sustainSettings, setSustainSettings, sustainActive, onSongChange, onSheet, onExit, onPerformance }: Props) {
  const [labels, setLabels] = useState<Labels>(() => {
    try { const value = localStorage.getItem("stage-piano-sandbox-labels"); return value === "piano" || value === "both" || value === "none" ? value : "computer"; }
    catch { return "computer"; }
  });
  const backingMode=introClock?.buildup?.mode??defaultBackingMode;
  const scoreBeat=introClock?(introClock.measure-1)*4+introClock.beat-1:0;
  const guide=backingFrame(backingMode,scoreBeat,introClock?.drop?.backingSource,introClock?.buildup,introClock?.drop?.rows);
  const backingPlaying=songId==='roses'&&introClock?.status==='running'&&(scoreBeat>=144?introClock.drop?.status==='running':['PLAYING','BREAK'].includes(introClock.buildup?.status??''));
  const physicalGuide=rosesKeyGuide(map,transpose,vocalKey);
  const playableRange = songId === "roses" ? { ...range, low: Math.min(36, range.low) } : range;
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
  return <main className={`sandbox-mode ${songId === "roses" ? "sandbox-roses" : ""}`} ref={root}>
    <header className="sandbox-header">
      <div><span className="practice-overline">STAGE PIANO / SANDBOX</span><h1>{titles[songId]}</h1><small>{songId === "roses" ? "Synth free play · Interstellar finger positions" : `${map.name} · free play`}</small></div>
      <div className="sandbox-actions">
        <label>Song <select value={songId} onChange={event => onSongChange(event.target.value as SongId)}><option value="interstellar">Interstellar</option><option value="levels">Levels — Avicii</option><option value="rush-e">Rush E — piano preset</option><option value="roses">Roses — The Chainsmokers</option></select></label>
        {(songId === "interstellar" || songId === "levels" || songId === "roses") && <div className="practice-segment"><button onClick={() => onSheet("step")}>Step</button><button onClick={() => onSheet("timed")}>Timed</button><button className="selected">Sandbox</button></div>}
        {songId === "rush-e" && <span className="sandbox-mode-pill">SANDBOX</span>}
        {!audioReady && <button className="practice-primary" onClick={startAudio}>Enable audio</button>}
        <button onClick={toggleFullscreen}>{fullscreen ? "Exit Fullscreen" : "Fullscreen Sandbox"}</button>
        <button onClick={onPerformance}>Performance</button>
        <button onClick={onExit}>← Piano</button>
      </div>
    </header>
    <section className="sandbox-trails" aria-label="Live note trails"><PerformanceVisualizer automaticGuide={songId==='roses'?{events:guide.events,hwm:guide.hwm,intensity:guide.intensity,riserProgress:guide.riserProgress,riserIntensity:guide.riserIntensity,beat:scoreBeat,getBeat:()=>introEngine?.scoreBeat()??scoreBeat,playing:backingPlaying}:undefined} notes={liveNotes} map={map} transpose={transpose} theme={songId === "roses" ? "roses" : "minimal"} notesPerSecond={snapshot.notesPerSecond} range={playableRange} /></section>
    <section className="sandbox-keyboard" aria-label="Free play piano"><div className="sandbox-keyboard-head"><span>{map.name}</span><span>{snapshot.pressed.length} keys down · {snapshot.notesPerSecond} notes/s · Pedal {sustainActive ? "ON" : "OFF"}</span></div><PianoCanvas automatic={backingPlaying?guide.active.flatMap(event=>event.pitches):[]} preferredLabels={songId==='roses'?Object.fromEntries(Object.entries(physicalGuide).map(([pitch,entries])=>[pitch,entries.map(entry=>entry.label).join(' / ')])):undefined} pressedCodes={snapshot.pressed.map(key=>key.code)} active={activePitches} map={map} transpose={transpose} range={playableRange} labelMode={labels} practicePalette={songId === "roses"} /></section>
    <section className="sandbox-controls">
      {songId==='roses'&&guide.inBuild&&<BackingGuide mix={introClock?.buildup} mode={backingMode} beat={scoreBeat} status={introClock?.buildup?.status}/>}

      <div className="sandbox-control-line"><label>Labels <select value={labels} onChange={event => setLabels(event.target.value as Labels)}><option value="computer">Computer keys</option><option value="piano">Piano notes</option><option value="both">Both</option><option value="none">None</option></select></label><label>Master <output>{volume}%</output><input type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>{songId === "roses" && <label>Transpose <output>{rosesTranspose > 0 ? "+" : ""}{rosesTranspose}</output><input type="range" min="-12" max="12" step="1" value={rosesTranspose} onChange={event => setRosesTranspose(Number(event.target.value))} /></label>}</div>
      {songId === "roses" && <HereWithMeChordControls volume={hereWithMeHarmonyVolume} onVolume={onHereWithMeHarmonyVolume} value={hereWithMeChordSound} onChange={onHereWithMeChordSound} />}
      {songId === "roses" && <DropLayerMixer engine={introEngine} clock={introClock} audioReady={audioReady} startAudio={startAudio} />}
      {songId === "roses" && <InstrumentLibrary instrumentId={instrumentId} onInstrument={setInstrumentId} settings={synthSettings} onSettings={setSynthSettings} error={instrumentError} audioReady={audioReady} startAudio={startAudio} preview={previewInstrument} />}
      {songId === "roses" && <RosesDropControls value={dropSettings} onChange={setDropSettings} onCompare={compareLoudStab} />}
      {songId === "roses" && <RosesBackingControls engine={introEngine} clock={introClock} audioReady={audioReady} startAudio={startAudio} vocalLevel={closerSettings.closerLevel} onVocalLevel={level=>onCloserSettings({...closerSettings,closerLevel:level})} />}
      {songId === "roses" && <RosesBuildupControls engine={introEngine} clock={introClock} settings={buildupSettings} onChange={onBuildupSettings} />}
      {songId === "roses" && <HereWithMeLeadControls engine={introEngine} clock={introClock} />}
      {songId === "roses" && <details className="sandbox-details"><summary>Optional opening phrase reference · physical keys</summary><div className="sandbox-phrase">{rosesPhrase.map((keys, index) => <span key={index}><b>{keys.length > 1 ? `[${keys}]` : keys}</b><small>{phrasePitches(keys, rosesTranspose).join(" + ")}</small></span>)}</div><p>Play freely. Unmapped keys remain unmapped; this phrase is a reference, not a scored song.</p></details>}
      <details className="sandbox-details"><summary>Sustain and shortcuts</summary><SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} /><p>Space toggles sustain · F9 stops all sounds. Note trails show physical key hold time.</p></details>
    </section>
  </main>;
}
