import { closerSource, closerTarget, closerTimingPresets, defaultCloserSettings, validCloserSettings, type CloserStatus, type RosesCloserSettings } from "../piano/rosesCloser";

type Props = {
  settings: RosesCloserSettings;
  onChange: (settings: RosesCloserSettings) => void;
  status?: CloserStatus;
  compact?: boolean;
};

export default function RosesCloserControls({ settings, onChange, status = "LOADING", compact = false }: Props) {
  const update = (patch: Partial<RosesCloserSettings>) => onChange(validCloserSettings({ ...settings, ...patch }));
  const target = closerTarget(settings);
  const targetSeconds = target.beat * .6 + settings.offsetMs / 1000;
  const controls = <section className={`roses-closer-controls ${compact ? "compact" : ""}`} aria-label="Here With Me vocal overlay">
    <div className="roses-closer-heading"><strong>HERE WITH ME · {settings.enabled ? status : "OFF"}</strong><span>“I” → {target.label} · {targetSeconds.toFixed(2)} s at 100 BPM</span></div>
    <div className="roses-closer-row">
      <div className="practice-segment" aria-label="Vocal comparison"><button className={!settings.enabled ? "selected" : ""} onClick={() => update({ enabled: false })}>Original Roses</button><button className={settings.enabled ? "selected" : ""} onClick={() => update({ enabled: true })}>Roses + Here With Me</button></div>
      <label>Entrance <select aria-label="Here With Me timing preset" value={settings.preset} onChange={event => update({ preset: event.target.value })}>{closerTimingPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
      <label>Entrance offset <input aria-label="Here With Me entrance offset milliseconds" type="number" min="-1000" max="1000" step="10" value={settings.offsetMs} onChange={event => update({ offsetMs: Number(event.target.value) })} /> ms</label><button onClick={() => update({ preset: defaultCloserSettings.preset, offsetMs: 0 })}>Reset timing</button>
    </div>
    <div className="roses-closer-row">
      <label>Roses vocal <output>{Math.round(settings.rosesLevel * 100)}%</output><input aria-label="Roses vocal level" type="range" min="0" max="150" step="5" value={Math.round(settings.rosesLevel * 100)} onChange={event => update({ rosesLevel: Number(event.target.value) / 100 })} /></label>
      <label>Here With Me vocal <output>{Math.round(settings.closerLevel * 100)}%</output><input aria-label="Here With Me vocal level" type="range" min="0" max="150" step="5" value={Math.round(settings.closerLevel * 100)} onChange={event => update({ closerLevel: Number(event.target.value) / 100 })} /></label>
      <label>Volume fade <input aria-label="Vocal volume fade seconds" type="number" min="0" max="3" step="0.05" value={settings.fadeSeconds} onChange={event => update({ fadeSeconds: Number(event.target.value) })} /> s</label>
    </div>
    <small>Automatic entrance · original pitch and speed · source {closerSource.onsetSeconds.toFixed(3)} s. Roses stays on. Timing changes apply before entry or on the next restart/loop; negative offset = earlier.</small>
    {status === "MISSED" && <small className="practice-warning">The selected entrance is before this starting position. Restart before the selected entrance.</small>}
    {status === "UNAVAILABLE" && <small className="practice-warning">Here With Me audio could not load. Reload to retry; Roses remains available.</small>}
  </section>;
  return compact ? <details className="roses-closer-panel"><summary>Here With Me {settings.enabled ? status : "OFF"} · {target.label} · {targetSeconds.toFixed(2)} s · Timing &amp; mix</summary>{controls}</details> : controls;
}
