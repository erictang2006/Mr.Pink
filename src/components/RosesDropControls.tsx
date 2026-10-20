import { defaultRosesDropSettings, type RosesDropSettings } from "../piano/rosesDropSettings";

type Props = { value: RosesDropSettings; onChange: (value: RosesDropSettings) => void; onCompare?: (side: "A" | "B") => void };
const controls = [
  { key: "body", label: "Chord Body", min: 0, max: 1.5, step: .05 },
  { key: "bonk", label: "Bonk Level", min: 0, max: 1.5, step: .05 },
  { key: "space", label: "Reverb / Space", min: 0, max: 1, step: .05 },
  { key: "punch", label: "Punch", min: 0, max: 1.5, step: .05 },
  { key: "bass", label: "Bass", min: 0, max: 1.5, step: .05 },
  { key: "brightness", label: "Brightness", min: 650, max: 4000, step: 50 },
  { key: "decay", label: "Decay", min: .2, max: .75, step: .01 },
  { key: "release", label: "Release", min: .35, max: 1.2, step: .05 },
  { key: "output", label: "Output", min: 0, max: 1, step: .05 },
] as const;

export default function RosesDropControls({ value, onChange, onCompare }: Props) {
  return <details className="sandbox-details">
    <summary>Keys 1–8 · Roses drop synth</summary>
    <div className="sandbox-control-line">
      <label>Chord instrument <select aria-label="Chord instrument" value={value.mode} onChange={event => onChange({ ...value, mode: event.target.value === "drop" ? "drop" : "bonk" })}>
        <option value="bonk">Bonk + Future Bass</option>
        <option value="drop">Original Drop Synth</option>
      </select></label>
      <button onClick={() => onChange({ ...defaultRosesDropSettings })}>Reset drop sound</button>
    </div>
    <div className="sandbox-control-line">
      <label>Closer keys 1–3 <select aria-label="Closer chord sound" value={value.closerMode} onChange={event => onChange({ ...value, closerMode: event.target.value === "current" ? "current" : "loud" })}>
        <option value="current">A · Current chord sound</option>
        <option value="loud">Recorded Loud Stabs</option>
      </select></label>
      {value.closerMode === "loud" && <label>Closer keyup fade <output>{Math.round(value.closerRelease * 1000)} ms</output>
        <input aria-label="Closer chord release" type="range" min=".05" max=".4" step=".01" value={value.closerRelease} onChange={event => onChange({ ...value, closerRelease: Number(event.target.value) })} />
      </label>}
    </div>
    <p>Recorded Loud Stabs uses the finished chord WAVs on keys 1–3. Short taps end shortly after keyup; long holds keep the recorded body looping until release. Keys 4–8 retain the chord instrument selected above.</p>
    {value.closerMode === "loud" && <small>Brightness also controls Recorded Loud Stabs and its drop-lead option. 2800 Hz keeps the original recorded tone; lower values soften it and higher values brighten it. The Body, Bonk, Space and Decay sliders affect the synth instrument.</small>}
    {onCompare && <div className="sandbox-control-line" aria-label="Loud Stabs A/B comparison">
      <strong>Loud Stabs source / finished hit</strong>
      <button type="button" onClick={() => onCompare("A")}>A · Original WAV hit</button>
      <button type="button" onClick={() => onCompare("B")}>B · Recorded Fm7 hit</button>
      <small>A is the original A minor source; B is the shifted Fm7 used by key 3. Their pitches differ.</small>
    </div>}
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      {value.mode === "drop" && <label><input type="checkbox" checked={value.bassEnabled} onChange={event => onChange({ ...value, bassEnabled: event.target.checked })} /> Add mono root bass</label>}
      <div className="instrument-sliders">{controls.filter(control => value.mode === "bonk" ? control.key !== "punch" && control.key !== "bass" : control.key !== "bonk" && control.key !== "space").map(control => <label key={control.key}>{control.label} <output>{control.key === "brightness" ? `${value.brightness} Hz` : control.key === "decay" || control.key === "release" ? `${Math.round(value[control.key] * 1000)} ms` : `${Math.round(value[control.key] * 100)}%`}</output>
        <input aria-label={`Drop ${control.label}`} type="range" min={control.min} max={control.max} step={control.step} value={value[control.key]} onChange={event => onChange({ ...value, [control.key]: Number(event.target.value) })} />
      </label>)}</div>
      <label><input type="checkbox" checked={value.duck} onChange={event => onChange({ ...value, duck: event.target.checked })} /> Duck on manual Z kick in Practice/Performance</label>
    </fieldset>
    <p>Bonk plays once per chord and keeps its recorded decay. Chord release and physical note trails remain independent. Settings are saved locally.</p>
  </details>;
}
