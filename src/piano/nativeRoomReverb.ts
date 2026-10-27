import * as Tone from "tone";

/** Schroeder room using native delay feedback instead of JS audio worklets.
 * Its shortest delay (64 ms) comfortably exceeds a Web Audio processing block.
 * Match JCReverb's allpass frequencies, delay times, room size and wet balance.
 */
export class NativeRoomReverb extends Tone.ToneAudioNode {
  readonly name: string = "NativeRoomReverb";
  readonly input = new Tone.Gain(1);
  readonly output: Tone.CrossFade;
  readonly wet: Tone.Signal<'normalRange'>;
  private split = new Tone.Split(2);
  private merge = new Tone.Merge(2);
  private allpass = [347, 113, 37].map(frequency => new Tone.Filter({ type: "allpass", frequency, Q: 1 }));
  private delays: Tone.Delay[] = [];
  private feedback: Tone.Gain[] = [];

  constructor({ roomSize = .12, wet = .025 }: { roomSize?: number; wet?: number } = {}) {
    super();
    this.output = new Tone.CrossFade(wet);
    this.wet = this.output.fade;
    this.input.channelCount = 2;
    this.input.channelCountMode = "explicit";
    this.input.connect(this.output.a);
    this.input.connect(this.split);
    // JCReverb sums both inputs through the same three allpass filters.
    this.split.connect(this.allpass[0], 0, 0);
    this.split.connect(this.allpass[0], 1, 0);
    this.allpass[0].chain(this.allpass[1], this.allpass[2]);
    const roomScale = -.733 + roomSize * (.197 + .733);
    [1687 / 25000, 1601 / 25000, 2053 / 25000, 2251 / 25000].forEach((delayTime, index) => {
      const delay = new Tone.Delay(delayTime, .1);
      const feedback = new Tone.Gain([.773, .802, .753, .733][index] + roomScale);
      this.allpass[2].connect(delay);
      delay.chain(feedback, delay);
      delay.connect(this.merge, 0, index < 2 ? 0 : 1);
      this.delays.push(delay); this.feedback.push(feedback);
    });
    this.merge.connect(this.output.b);
  }
  dispose(): this {
    super.dispose();
    for (const node of [this.input, this.output, this.split, this.merge, ...this.allpass, ...this.delays, ...this.feedback]) node.dispose();
    return this;
  }
}
