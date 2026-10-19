import type { RosesClockMode, RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { buildupStatusText, validBuildupSettings, type BuildupSettings } from "../piano/rosesBuildup";
type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; settings: BuildupSettings; onChange: (value: BuildupSettings) => void; mode?: RosesClockMode; compact?: boolean; onRehearse?: (bar: 29 | 33 | 36) => void };
export default function RosesBuildupControls({ engine, clock, settings, onChange, mode = "performance", compact = false, onRehearse }: Props) {
  const state = clock?.buildup;
  const update = (patch: Partial<BuildupSettings>) => onChange(validBuildupSettings({ ...settings, ...patch }));
  return <details className="sandbox-details" open={compact ? undefined : true}>
    <summary>Buildup 29–36 · {state?.status ?? "NOT ARMED"}{compact && state?.status === "PLAYING" ? ` · VOX ${state.layers.includes("vox") ? "ON" : "OFF"} · SPACY ${state.layers.includes("spacy") ? "ON" : "OFF"} · BASS ${state.bass ? "ON" : "OFF"}` : ""}{clock && clock.measure >= 37 ? " · DROP NEXT (not implemented)" : ""}</summary>
    <div className="sandbox-control-line">
      <button onClick={() => engine?.armBuildup()} disabled={!state?.ready || !!clock && clock.status !== "idle" && clock.measure >= 29}>Arm Buildup 29–36</button>
      <button onClick={() => engine?.cancelBuildup()}>Cancel buildup</button>
      {[29, 33, 36].map(bar => <button key={bar} disabled={!state?.ready} onClick={() => onRehearse ? onRehearse(bar as 29 | 33 | 36) : engine?.rehearseBuildup(bar as 29 | 33 | 36, mode)}>Rehearse {bar}</button>)}
      <button disabled={!clock || !["running", "paused"].includes(clock.status)} onClick={() => clock?.status === "paused" ? mode === "step" ? engine?.resumeStep() : engine?.resume() : engine?.pause()}>{clock?.status === "paused" ? "Resume" : "Pause"}</button>
    </div>
    <div className="sandbox-control-line">
      <label>Vox sound <select aria-label="Buildup Vox sound" value={settings.voxMode} onChange={event => update({ voxMode: event.target.value === "original" ? "original" : "light" })}><option value="original">A · Original Vox Synth</option><option value="light">B · Light Ping Vox</option></select></label>
      {(["vox", "spacy", "roll", "chops"] as const).map(layer => <label key={layer}>{layer === "chops" ? "Vocal chops" : layer} <output>{Math.round(settings[layer] * 100)}%</output><input aria-label={`Buildup ${layer} level`} type="range" min="0" max="1.5" step=".05" value={settings[layer]} onChange={event => update({ [layer]: Number(event.target.value) })} /></label>)}
      <label><input type="checkbox" checked={settings.chopsMuted} onChange={event => update({ chopsMuted: event.target.checked })} /> Mute vocal chops</label>
    </div>
    <small>VOX {state?.layers.includes("vox") ? "ON" : "OFF"} · SPACY {state?.layers.includes("spacy") ? "ON" : "OFF"} · BASS {state?.bass ? "ON" : "OFF"} · CHOPS {state?.layers.includes("chops") && !settings.chopsMuted ? "ON" : "OFF"} · {buildupStatusText(clock ? (clock.measure - 1) * 4 + clock.beat - 1 : 112)}</small>
    {!compact && <p>Arm before bar 29, or explicitly rehearse a section. Z kick and X clap stay physical. No drop at bar 37. Use 100% speed for the original recorded phrases.</p>}
  </details>;
}
