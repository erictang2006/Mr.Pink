export type SustainMode = "hold" | "toggle" | "automatic";
export type SustainSettingsValue = {
  mode: SustainMode;
  shortcut: string;
  releaseSeconds: number;
  autoStart: number;
  autoEnd: number;
  showIndicator: boolean;
};
type Props = {
  value: SustainSettingsValue;
  active: boolean;
  onChange: (value: SustainSettingsValue) => void;
};
export default function SustainSettings({ value, active, onChange }: Props) {
  const update = (changes: Partial<SustainSettingsValue>) => onChange({ ...value, ...changes });
  return <div className="sustain-settings" aria-label="Sustain pedal settings">
    <strong className={active ? "is-active" : ""}>PEDAL {active ? "ON" : "OFF"}</strong>
    <label>Mode <select value={value.mode} onChange={event => update({ mode: event.target.value as SustainMode })}><option value="toggle">Toggle</option><option value="hold">Hold</option><option value="automatic">Automatic</option></select></label>
    <label>Key <select value={value.shortcut} onChange={event => update({ shortcut: event.target.value })}><option value="Space">Space</option><option value="Backslash">Backslash</option><option value="Semicolon">Semicolon</option><option value="Quote">Quote</option></select></label>
    <label>Release <input type="range" min="0.1" max="2" step="0.05" value={value.releaseSeconds} onChange={event => update({ releaseSeconds: Number(event.target.value) })} /><output>{value.releaseSeconds.toFixed(2)} s</output></label>
    {value.mode === "automatic" && <><label>On at bar <input type="number" min="1" max="30" value={value.autoStart} onChange={event => update({ autoStart: Math.max(1, Math.min(value.autoEnd, Number(event.target.value) || 1)) })} /></label><label>Off after bar <input type="number" min={value.autoStart} max="30" value={value.autoEnd} onChange={event => update({ autoEnd: Math.min(30, Math.max(value.autoStart, Number(event.target.value) || 30)) })} /></label></>}
    <label><input type="checkbox" checked={value.showIndicator} onChange={event => update({ showIndicator: event.target.checked })} /> Performance indicator</label>
  </div>;
}
