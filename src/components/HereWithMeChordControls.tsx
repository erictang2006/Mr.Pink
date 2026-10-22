import { hereWithMeChords, hereWithMeChordSounds, validHereWithMeChordSound, type HereWithMeChordSound } from "../piano/hereWithMeChords";

type Props = { volume: number; onVolume: (value:number)=>void; value: HereWithMeChordSound; onChange: (value: HereWithMeChordSound) => void };
export default function HereWithMeChordControls({ value, onChange, volume, onVolume }: Props) {
  return <section className="sandbox-details" aria-label="Here With Me manual chords">
    <div className="sandbox-control-line"><strong>HERE WITH ME · MANUAL CHORDS</strong>
      <label>Here With Me chord instrument <select aria-label="Here With Me chord instrument" value={value} onChange={event => onChange(validHereWithMeChordSound(event.target.value))}>
        {hereWithMeChordSounds.map(sound => <option key={sound.value} value={sound.value}>{sound.label}</option>)}
      </select></label>
      {value === "harmony" && <label>Volume <output>{Math.round(volume*100)}%</output><input aria-label="Here With Me chords guitar pad volume" type="range" min="0" max="8" step=".05" value={volume} onChange={event=>onVolume(Number(event.target.value))}/></label>}
    </div>
    <div className="sandbox-phrase">{hereWithMeChords.map(chord => <span key={chord.code}><b>[{chord.key}]</b><small>{chord.name}</small></span>)}</div>
    <p>Enable audio, then play = → - → 0 → 9 in any rhythm. Hold to play; release to stop. No start button or playback clock is needed.</p>
    <small>{value === "keys678" ? "Follows the Keys 1–8 Chord instrument and sound controls below, just like Keys 6–8." : value === "keys123" ? "Follows Closer keys 1–3 below. Loud Stabs uses the existing single-note reconstruction to play the Here With Me chord pitches, rather than the finished Roses chord recordings." : value === "harmony" ? "Uses the drop’s Here With Me chord, guitar and soft pad layers. Hold to sustain the chord; release to stop." : "Uses the existing four-layer Here With Me lead synth sound: one lower layer and three layers an octave above."} Changing this selector affects only these four manual chord keys.</small>
  </section>;
}
