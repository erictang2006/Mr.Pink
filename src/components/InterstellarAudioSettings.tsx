import { defaultInterstellarMix, type InterstellarMix } from "../piano/interstellarMix";

export default function InterstellarAudioSettings({ value, onChange }: { value: InterstellarMix; onChange: (value: InterstellarMix) => void }) {
  return <div className="practice-control-row practice-mix"><span>INTERSTELLAR AUDIO</span>
    {([["accompaniment", "Sixteenths"], ["melody", "Melody"], ["assisted", "Assisted"], ["octave", "High E octave"]] as const).map(([key, title]) =>
      <label key={key}>{title} <output>{Math.round(value[key] * 100)}%</output><input type="range" min="0" max="100" step="5" value={Math.round(value[key] * 100)} onChange={event => onChange({ ...value, [key]: Number(event.target.value) / 100 })} /></label>)}
    <label><input type="checkbox" checked={value.octaveEnabled} onChange={event => onChange({ ...value, octaveEnabled: event.target.checked })} /> Double High E Melody</label>
    <button onClick={() => onChange(defaultInterstellarMix)}>Reset mix</button>
  </div>;
}
