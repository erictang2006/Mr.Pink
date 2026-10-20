import { hereWithMeChords, hereWithMeChordSounds, validHereWithMeChordSound, type HereWithMeChordSound } from "../piano/hereWithMeChords";

type Props = { value: HereWithMeChordSound; onChange: (value: HereWithMeChordSound) => void };
export default function HereWithMeChordControls({ value, onChange }: Props) {
  return <section className="sandbox-details" aria-label="Here With Me manual chords">
    <div className="sandbox-control-line"><strong>HERE WITH ME · MANUAL CHORDS</strong>
      <label>Here With Me chord instrument <select aria-label="Here With Me chord instrument" value={value} onChange={event => onChange(validHereWithMeChordSound(event.target.value))}>
        {hereWithMeChordSounds.map(sound => <option key={sound.value} value={sound.value}>{sound.label}</option>)}
      </select></label>
    </div>
    <div className="sandbox-phrase">{hereWithMeChords.map(chord => <span key={chord.code}><b>[{chord.key}]</b><small>{chord.name}</small></span>)}</div>
    <p>Enable audio, then play = → - → 0 → 9 in any rhythm. Hold to play; release to stop. No start button or playback clock is needed.</p>
    <small>{value === "keys678" ? "Follows the Keys 1–8 Chord instrument and sound controls below, just like Keys 6–8." : value === "keys123" ? "Follows Closer keys 1–3 below. Loud Stabs uses the existing single-note reconstruction to play the Here With Me chord pitches, rather than the finished Roses chord recordings." : "Uses the existing four-layer Here With Me lead synth sound: one lower layer and three layers an octave above."} Changing this selector affects only these four manual chord keys.</small>
  </section>;
}
