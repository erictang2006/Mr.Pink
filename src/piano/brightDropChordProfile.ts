import * as Tone from "tone";
import { defaultRosesDropSettings, type RosesDropSettings } from "./rosesDropSettings";

/** Generation-only settings: the app plays prepared tracks, not this dense graph. */
export const brightDropChordSettings: RosesDropSettings = {
  ...defaultRosesDropSettings, mode: "drop", brightness: 5600,
  decay: .34, release: .32, punch: .48, body: 1,
};

/** Gentle upper-harmonic emphasis, filtered stereo echo and beat-synchronous recovery.
 * This is an audition alternative, not a recreation of a proprietary plugin chain.
 */
export class BrightDropChordProfile extends Tone.ToneAudioNode {
  readonly name = "BrightDropChordProfile";
  readonly input = new Tone.Gain(1);
  readonly output = new Tone.Gain(1);
  private lowShelf = new Tone.Filter({ type: "lowshelf", frequency: 340, gain: -1.5 });
  private presence = new Tone.Filter({ type: "peaking", frequency: 1800, Q: .7, gain: 1.5 });
  private highShelf = new Tone.Filter({ type: "highshelf", frequency: 2600, gain: 4 });
  private echoHighPass = new Tone.Filter({ type: "highpass", frequency: 600, rolloff: -12 });
  private echoLowPass = new Tone.Filter({ type: "lowpass", frequency: 4200, rolloff: -12 });
  private echoes: Tone.Delay[] = [];
  private feedback: Tone.Gain[] = [];
  private pans: Tone.Panner[] = [];
  private wet = new Tone.Gain(.09);
  constructor() {
    super();
    this.input.chain(this.lowShelf, this.presence, this.highShelf, this.output);
    this.highShelf.chain(this.echoHighPass, this.echoLowPass);
    for (const [delayTime, pan] of [[.3, -.55], [.45, .55]]) {
      const delay = new Tone.Delay(delayTime, .5), gain = new Tone.Gain(.22), panner = new Tone.Panner(pan);
      this.echoLowPass.connect(delay); delay.chain(gain, delay); delay.chain(panner, this.wet);
      this.echoes.push(delay); this.feedback.push(gain); this.pans.push(panner);
    }
    this.wet.connect(this.output);
  }
  tick(beat: number, time: number): void {
    if (beat < 144 || beat >= 176 || beat % 1 !== 0) return;
    this.output.gain.setValueAtTime(.58, time);
    this.output.gain.linearRampToValueAtTime(.78, time + .035);
    this.output.gain.linearRampToValueAtTime(1, time + .16);
  }
  dispose(): this {
    super.dispose();
    for (const node of [this.input, this.output, this.lowShelf, this.presence, this.highShelf, this.echoHighPass, this.echoLowPass, this.wet, ...this.echoes, ...this.feedback, ...this.pans]) node.dispose();
    return this;
  }
}
