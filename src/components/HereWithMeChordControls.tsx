import { visualDropChords } from "../piano/visualDropChords";
import type { HereWithMeChordSound } from "../piano/hereWithMeChords";

type Props = { volume: number; onVolume: (value:number)=>void; value: HereWithMeChordSound; onChange: (value: HereWithMeChordSound) => void };
export default function HereWithMeChordControls(_props: Props) {
  return <section className="sandbox-details" aria-label="Roses drop visual chords">
    <div className="sandbox-control-line"><strong>ROSES DROP · VISUAL CHORDS</strong><span>Silent · extra octave above</span></div>
    <div className="sandbox-phrase">{visualDropChords.map(chord=><span key={chord.code}><b>[{chord.key}]</b><small>{chord.name}</small></span>)}</div>
    <p>Press = / − / 0 / 9 to light the Roses drop chord notes and an octave above, with rising piano trails. Hold to show the chord; release to lift the keys.</p>
    <small>These four keys create visuals only. The prerecorded drop and other automatic audio continue with their existing sound, timing and volume. P / O / I keep their live chord sound.</small>
  </section>;
}
