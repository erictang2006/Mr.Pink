import * as Tone from "tone";

/** JCReverb's .22 room setting and fully wet path, using native delay feedback
 * so rapid live chords do not depend on JS audio-worklet comb filters.
 */
export class LiveBonkRoom extends Tone.ToneAudioNode {
  readonly name = "LiveBonkRoom";
  readonly input = new Tone.Gain(1);
  readonly output = new Tone.Merge(2);
  private split = new Tone.Split(2);
  private allpass = [347,113,37].map(frequency=>new Tone.Filter({type:"allpass",frequency,Q:1}));
  private delays: Tone.Delay[] = [];
  private feedback: Tone.Gain[] = [];
  constructor(){
    super();this.input.channelCount=2;this.input.channelCountMode="explicit";this.input.connect(this.split);
    this.split.connect(this.allpass[0],0,0);this.split.connect(this.allpass[0],1,0);this.allpass[0].chain(this.allpass[1],this.allpass[2]);
    const scale=-.733+.22*(.197+.733);
    [1687/25000,1601/25000,2053/25000,2251/25000].forEach((seconds,index)=>{
      const delay=new Tone.Delay(seconds,.1),gain=new Tone.Gain([.773,.802,.753,.733][index]+scale);
      this.allpass[2].connect(delay);delay.chain(gain,delay);delay.connect(this.output,0,index<2?0:1);this.delays.push(delay);this.feedback.push(gain);
    });
  }
  dispose(): this {super.dispose();for(const node of [this.input,this.output,this.split,...this.allpass,...this.delays,...this.feedback])node.dispose();return this;}
}
