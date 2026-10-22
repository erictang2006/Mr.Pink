import BackingGuide from "./BackingGuide";
import {defaultBackingMode} from "../piano/rosesBacking";
import type { RosesClockMode, RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { buildupStatusText, validBuildupSettings, voxSoundChoices, type BuildupSettings, type VoxSound } from "../piano/rosesBuildup";
type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; settings: BuildupSettings; onChange: (value: BuildupSettings) => void; mode?: RosesClockMode; compact?: boolean; onRehearse?: (bar: 29 | 33 | 36) => void };
export default function RosesBuildupControls({ engine, clock, settings: rawSettings, onChange, mode = "performance", compact = false, onRehearse }: Props) {
  const settings = validBuildupSettings(rawSettings);
  const state = clock?.buildup;
  const selected=state?.mode??defaultBackingMode;
  const scoreBeat=clock?(clock.measure-1)*4+clock.beat-1:112;
  const melodyLabel = settings.voxMode === "lead" ? "HWM VOX" : settings.voxMode === "stabs" ? "STABS VOX" : "VOX";
  const update = (patch: Partial<BuildupSettings>) => onChange(validBuildupSettings({ ...settings, ...patch }));
  return <details className="sandbox-details" open={compact ? undefined : true}>
    <summary>Buildup 29–36 · {state?.status ?? "NOT ARMED"}{selected === "roses" && compact && state?.status === "PLAYING" ? ` · ${melodyLabel} ${state.layers.includes("vox") ? "ON" : "OFF"} · SPACY ${state.layers.includes("spacy") ? "ON" : "OFF"} · BASS ${state.bass ? "ON" : "OFF"}` : ""}{clock && clock.measure >= 37 ? " · buildup complete" : ""}</summary>
    <div className="sandbox-control-line">
      <button onClick={() => engine?.armBuildup()} disabled={!state?.ready || !!clock && clock.status !== "idle" && clock.measure >= 29}>Arm Buildup 29–36</button>
      <button onClick={() => engine?.cancelBuildup()}>Cancel buildup</button>
      {[29, 33, 36].map(bar => <button key={bar} disabled={!state?.ready} onClick={() => onRehearse ? onRehearse(bar as 29 | 33 | 36) : engine?.rehearseBuildup(bar as 29 | 33 | 36, mode)}>Rehearse {bar}</button>)}
      <button disabled={!clock || !["running", "paused"].includes(clock.status)} onClick={() => clock?.status === "paused" ? mode === "step" ? engine?.resumeStep() : engine?.resume() : engine?.pause()}>{clock?.status === "paused" ? "Resume" : "Pause"}</button>
    </div>
    {selected === "roses" ? <>
    <div className="sandbox-control-line">
      <label>Bars 29–36 instrument <select aria-label="Bars 29–36 instrument" value={settings.voxMode} onChange={event => update({ voxMode: event.target.value as VoxSound })}>{voxSoundChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
      {(["vox", "spacy", "roll", "chops"] as const).map(layer => <label key={layer}>{layer === "chops" ? "Vocal chops" : layer === "vox" ? "Vox" : layer} <output>{Math.round(settings[layer] * 100)}%</output><input aria-label={`Buildup ${layer} level`} type="range" min="0" max="1.5" step=".05" value={settings[layer]} onChange={event => update({ [layer]: Number(event.target.value) })} /></label>)}
      <label><input type="checkbox" checked={settings.chopsMuted} onChange={event => update({ chopsMuted: event.target.checked })} /> Mute vocal chops</label>
    </div>
    <small>Choose the instrument playing the original Vox melody: Original Vox Synth, Light Ping Vox, Loud Stabs or Here With Me lead synths. The Vox notes and rhythm stay the same, including the bar-36 break. The separate Here With Me drop melody still starts at bar 37.</small>
    <small>{melodyLabel} {state?.layers.includes("vox") ? "ON" : "OFF"} · SPACY {state?.layers.includes("spacy") ? "ON" : "OFF"} · BASS {state?.bass ? "ON" : "OFF"} · CHOPS {state?.layers.includes("chops") && !settings.chopsMuted ? "ON" : "OFF"} · {buildupStatusText(clock ? (clock.measure - 1) * 4 + clock.beat - 1 : 112)}</small>
    {!compact && <p>For backing at bar 29, arm this section before bar 29. V synth and N bass/sub cover bars 5–20; F6 guitar/build bass covers bars 21–28. Z kick and X clap stay physical. The optional Here With Me lead has its own arm control. Use 100% speed for the original recorded phrases.</p>}
    </> : <BackingGuide mix={clock?.buildup} mode={selected} beat={Math.max(112,Math.min(143.999,scoreBeat))} status={state?.status} compact={compact}/>}
  </details>;
}
