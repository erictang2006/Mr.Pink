import * as Tone from "tone";
import { rosesChordShortcuts } from "./rosesChords";
import { loudStabBrightnessDb } from "./loudStabBrightness";

export const loudStabSampleUrl = "/roses/chords/loud-stabs-am-hit.wav";
const recordedUrls = {
  Digit1: "/roses/chords/loud-stabs-recorded-dbadd9.wav",
  Digit2: "/roses/chords/loud-stabs-recorded-eb-major.wav",
  Digit3: "/roses/chords/loud-stabs-recorded-fm7.wav",
} as const;
const sustainUrls = {
  Digit1: "/roses/chords/loud-stabs-recorded-dbadd9-sustain.wav",
  Digit2: "/roses/chords/loud-stabs-recorded-eb-major-sustain.wav",
  Digit3: "/roses/chords/loud-stabs-recorded-fm7-sustain.wav",
} as const;
type CloserKey = keyof typeof recordedUrls;
type RecordedVoice = { source: Tone.ToneBufferSource; gain: Tone.Gain };

/** Recorded chord hits for keys 1–3, with a loop of each hit's own steady body for long holds. */
export class RosesLoudStabsEngine {
  private reference = new Tone.ToneAudioBuffer();
  private hits: Record<CloserKey, Tone.ToneAudioBuffer> = {
    Digit1: new Tone.ToneAudioBuffer(), Digit2: new Tone.ToneAudioBuffer(), Digit3: new Tone.ToneAudioBuffer(),
  };
  private sustains: Record<CloserKey, Tone.ToneAudioBuffer> = {
    Digit1: new Tone.ToneAudioBuffer(), Digit2: new Tone.ToneAudioBuffer(), Digit3: new Tone.ToneAudioBuffer(),
  };
  private loading: Promise<void> | null = null;
  private disposed = false;
  private releaseSeconds = .12;
  private hitGain = new Tone.Gain(.85);
  private output = new Tone.Gain(.85);
  private tone = new Tone.Filter({ type: "highshelf", frequency: 2800, gain: 0 });
  private rawReference = new Tone.Gain(.37).toDestination();
  private samples = new Set<RecordedVoice>();
  private offlineEnded = new Set<RecordedVoice>();
  private heldSamples = new Map<CloserKey, RecordedVoice[]>();
  private activeLoops = new Set<RecordedVoice>();
  private heldLoops = new Map<CloserKey, RecordedVoice[]>();
  private previewSample: RecordedVoice | null = null;

  constructor() { this.hitGain.connect(this.output); this.output.connect(this.tone); }
  connect(destination: Tone.InputNode): void { this.tone.connect(destination); }
  setBrightness(value: number): void {
    // Filter gain is signed dB (convert:false). Tone's generic rampTo chooses
    // exponential interpolation for dB, which produces NaN when crossing zero.
    this.tone.gain.linearRampTo(loudStabBrightnessDb(value), .025);
  }
  isReady(): boolean {
    return !this.disposed && this.reference.loaded &&
      Object.values(this.hits).every(buffer => buffer.loaded) &&
      Object.values(this.sustains).every(buffer => buffer.loaded);
  }
  load(): Promise<void> {
    if (this.isReady()) return Promise.resolve();
    if (!this.loading) this.loading = Promise.all([
      this.reference.load(loudStabSampleUrl),
      ...Object.entries(recordedUrls).map(([key, url]) => this.hits[key as CloserKey].load(url)),
      ...Object.entries(sustainUrls).map(([key, url]) => this.sustains[key as CloserKey].load(url)),
    ]).then(() => {}).catch(error => { this.loading = null; throw error; });
    return this.loading;
  }
  setRelease(seconds: number): void { this.releaseSeconds = seconds; }
  setReferenceLevel(master: number): void {
    this.rawReference.gain.rampTo(.37 * Math.max(0, Math.min(1, master)), .03);
  }
  private strikeRecording(buffer: Tone.ToneAudioBuffer, time: number, destination: Tone.InputNode, owner?: CloserKey, playbackRate = 1, velocity = 1): RecordedVoice | null {
    if (!this.isReady()) return null;
    const gain = new Tone.Gain(1).connect(destination);
    gain.gain.setValueAtTime(velocity, time);
    const hit: RecordedVoice = { source: null!, gain };
    const source = new Tone.ToneBufferSource({ url: buffer, playbackRate, fadeIn: .001,
      onended: () => {
        this.samples.delete(hit);
        if (owner) {
          const queue = this.heldSamples.get(owner);
          if (queue) {
            const index = queue.indexOf(hit);
            if (index >= 0) queue.splice(index, 1);
            if (!queue.length) this.heldSamples.delete(owner);
          }
        }
        if (this.previewSample === hit) this.previewSample = null;
        if (source.context?.isOffline) this.offlineEnded.add(hit);
        else { source.dispose(); gain.dispose(); }
      },
    });
    hit.source = source;
    source.connect(gain);
    this.samples.add(hit);
    source.start(time);
    return hit;
  }
  private startSustain(key: CloserKey, time: number): RecordedVoice | null {
    if (!this.isReady()) return null;
    const gain = new Tone.Gain(0).connect(this.output);
    const hit: RecordedVoice = { source: null!, gain };
    const source = new Tone.ToneBufferSource({ url: this.sustains[key], loop: true,
      loopStart: 0, loopEnd: this.sustains[key].duration, fadeIn: .001,
      onended: () => {
        this.activeLoops.delete(hit);
        const queue = this.heldLoops.get(key);
        if (queue) {
          const index = queue.indexOf(hit);
          if (index >= 0) queue.splice(index, 1);
          if (!queue.length) this.heldLoops.delete(key);
        }
        if (source.context?.isOffline) this.offlineEnded.add(hit);
        else { source.dispose(); gain.dispose(); }
      },
    });
    hit.source = source;
    source.connect(gain);
    this.activeLoops.add(hit);
    // The full recorded hit owns the attack and first decay. The recorded
    // body enters only for a long hold.
    gain.gain.setValueAtTime(0, time);
    gain.gain.setValueAtTime(0, time + .48);
    gain.gain.linearRampToValueAtTime(.72, time + .65);
    source.start(time);
    return hit;
  }
  private fadeVoice(hit: RecordedVoice, time: number, seconds: number): void {
    hit.gain.gain.cancelAndHoldAtTime(time);
    hit.gain.gain.linearRampToValueAtTime(0, time + seconds);
    hit.source.stop(time + seconds + .01);
  }
  /** The actual Key-3 Fm7 hit, transposed by its F4 root. Its chord harmonics
   * stay intact. Drop MIDI gates are <140 ms, before the long-hold loop enters.
   */
  triggerPitch(midi: number, duration: number, time: number, velocity = 1): void {
    const hit = this.strikeRecording(this.hits.Digit3, time, this.hitGain, undefined, 2 ** ((midi - 65) / 12), velocity);
    if (hit) this.fadeVoice(hit, time + duration, this.releaseSeconds);
  }
  cancel(): void {
    for (const hit of [...this.samples, ...this.activeLoops]) { hit.source.dispose(); hit.gain.dispose(); }
    this.samples.clear(); this.activeLoops.clear(); this.heldSamples.clear(); this.heldLoops.clear(); this.previewSample = null;
  }
  attack(code: string, time: number): void {
    if (!(code in rosesChordShortcuts) || !/^Digit[123]$/.test(code)) return;
    const key = code as CloserKey;
    const sample = this.strikeRecording(this.hits[key], time, this.hitGain, key);
    if (sample) this.heldSamples.set(key, [...(this.heldSamples.get(key) ?? []), sample]);
    const held = this.startSustain(key, time);
    if (held) this.heldLoops.set(key, [...(this.heldLoops.get(key) ?? []), held]);
  }
  release(code: string, time: number): void {
    if (!/^Digit[123]$/.test(code)) return;
    const key = code as CloserKey;
    const sampleQueue = this.heldSamples.get(key);
    const sample = sampleQueue?.shift();
    if (!sampleQueue?.length) this.heldSamples.delete(key);
    if (sample) this.fadeVoice(sample, time, this.releaseSeconds);
    const queue = this.heldLoops.get(key);
    const held = queue?.shift();
    if (!queue?.length) this.heldLoops.delete(key);
    if (held) this.fadeVoice(held, time, this.releaseSeconds);
  }
  /** A is the original A-minor hit; B is the finished recorded Fm7 preview. */
  compare(side: "A" | "B", time = Tone.immediate()): void {
    if (this.previewSample) { this.previewSample.source.stop(time + .008); this.previewSample = null; }
    this.previewSample = this.strikeRecording(side === "A" ? this.reference : this.hits.Digit3,
      time, side === "A" ? this.rawReference : this.hitGain);
  }
  releaseAll(time: number): void {
    this.heldSamples.clear(); this.heldLoops.clear(); this.previewSample = null;
    for (const hit of this.activeLoops) hit.source.stop(time);
    for (const hit of this.samples) hit.source.stop(time);
  }
  dispose(): void {
    this.disposed = true; this.releaseAll(Tone.immediate());
    for (const hit of this.offlineEnded) { hit.source.dispose(); hit.gain.dispose(); }
    this.offlineEnded.clear();
    this.reference.dispose();
    for (const buffer of Object.values(this.hits)) buffer.dispose();
    for (const buffer of Object.values(this.sustains)) buffer.dispose();
    this.hitGain.dispose(); this.output.dispose(); this.tone.dispose(); this.rawReference.dispose();
  }
}
