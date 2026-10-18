export type SustainSettingsValue = {
  releaseSeconds: number;
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
    <span>Space toggles sustain</span>
    <label>Release <input type="range" min="0.1" max="2" step="0.05" value={value.releaseSeconds} onChange={event => update({ releaseSeconds: Number(event.target.value) })} /><output>{value.releaseSeconds.toFixed(2)} s</output></label>
    <label><input type="checkbox" checked={value.showIndicator} onChange={event => update({ showIndicator: event.target.checked })} /> Performance indicator</label>
  </div>;
}
