import * as Tone from "tone";
import { buildupAssets, buildupBass, buildupBreak, buildupEnd, buildupEvents, buildupStart, defaultBuildupSettings, snareTranspose, validBuildupSettings, type BuildupEvent, type BuildupLayer, type BuildupSettings } from "./rosesBuildup";
import type { RosesBassEngine } from "./rosesBassEngine";
export type BuildupStatus = "NOT ARMED" | "ARMED" | "PLAYING" | "BREAK" | "FINISHED";
type Clip = { event: BuildupEvent; source: Tone.ToneBufferSource; start: number; offset: number; duration: number; rate: number };
/** Called by the existing sixteenth-note transport callback. No independent musical timer. */
export class RosesBuildupEngine {
  private settings = { ...defaultBuildupSettings };
  private status: BuildupStatus = "NOT ARMED";
  private ready = false;
  private disposed = false;
  private entry = buildupStart;
  private initialized = false;
  private authorized = false;
  private lastBeat = -1;
  private beatsPerSecond = 100 / 60;
  private pausedBeat: number | null = null;
  private sources = new Set<Clip>();
  private offlineEnded = new Set<Tone.ToneBufferSource>();
  private paused: Omit<Clip, "source" | "start">[] = [];
  private buffers = new Map<BuildupLayer, Tone.ToneAudioBuffer>();
  private gains = new Map<BuildupLayer, Tone.Gain>();
  private voxOriginal = new Tone.Gain(0);
  private voxLight = new Tone.Gain(1);
  private voxHighPass = new Tone.Filter({ type: "highpass", frequency: 380, Q: .5, rolloff: -24 });
  private voxEQ = new Tone.EQ3({ low: -5, mid: 2, high: -1, lowFrequency: 700, highFrequency: 4200 });
  private voxLowPass = new Tone.Filter({ type: "lowpass", frequency: 6800, Q: .5, rolloff: -12 });
  private voxShape = new Tone.Compressor({ threshold: -23, ratio: 2, attack: .025, release: .075 });
  private mix = new Tone.Gain(1);
  private safety = new Tone.WaveShaper(value => .9 * Math.tanh(value / .9), 2048);
  private limiter = new Tone.Limiter(-2);
  private loading: Promise<void> | null = null;
  constructor(output: Tone.InputNode, private bass: RosesBassEngine) {
    for (const layer of Object.keys(buildupAssets) as BuildupLayer[]) {
      this.buffers.set(layer, new Tone.ToneAudioBuffer());
      const gain = new Tone.Gain(defaultBuildupSettings[layer === "snap" ? "spacy" : layer]);
      this.gains.set(layer, gain);
      if (layer === "vox") {
        gain.chain(this.voxOriginal, this.mix);
        gain.chain(this.voxHighPass, this.voxEQ, this.voxLowPass, this.voxShape, this.voxLight, this.mix);
      } else gain.connect(this.mix);
    }
    this.mix.chain(this.safety, this.limiter);
    this.limiter.connect(output);
    this.configure(this.settings);
  }
  load(): Promise<void> {
    if (!this.loading) this.loading = Promise.all([...this.buffers].map(async ([layer, buffer]) => {
      await buffer.load(buildupAssets[layer]); if (this.disposed) buffer.dispose();
    })).then(() => { if (!this.disposed) this.ready = true; }).catch(error => { this.loading = null; throw error; });
    return this.loading;
  }
  configure(value: BuildupSettings): void {
    this.settings = validBuildupSettings(value);
    for (const [layer, gain] of this.gains) gain.gain.rampTo(layer === "chops" && this.settings.chopsMuted ? 0 : layer === "snap" ? .6 : this.settings[layer], .015);
    this.voxOriginal.gain.rampTo(this.settings.voxMode === "original" ? 1 : 0, .015);
    this.voxLight.gain.rampTo(this.settings.voxMode === "light" ? 1.08 : 0, .015);
  }
  snapshot() {
    const layers = [...new Set([...this.sources].map(clip => clip.event.layer))];
    return { status: this.status, ready: this.ready, layers, bass: this.authorized && this.lastBeat >= buildupStart && this.lastBeat < buildupBreak };
  }
  arm(scoreBeat: number, running: boolean): boolean {
    if (!this.ready || running && scoreBeat >= buildupStart || this.status === "PLAYING" || this.status === "BREAK") return false;
    this.status = this.status === "ARMED" ? "NOT ARMED" : "ARMED";
    this.authorized = this.status === "ARMED";
    return true;
  }
  begin(startBeat: number, repeat = false): void {
    const armed = this.status === "ARMED" || repeat && this.authorized;
    this.stop(Tone.immediate());
    this.authorized = armed; this.status = armed ? "ARMED" : "NOT ARMED";
    this.entry = Math.max(buildupStart, startBeat); this.lastBeat = -1; this.initialized = false;
  }
  tick(beat: number, time: number, secondsPerBeat: number): void {
    this.beatsPerSecond = 1 / secondsPerBeat;
    if (!this.authorized || beat < this.entry || beat === this.lastBeat || beat >= buildupEnd && this.status === "FINISHED") return;
    this.lastBeat = beat;
    if (beat >= buildupEnd) { this.status = "FINISHED"; return; }
    this.status = beat >= buildupBreak ? "BREAK" : "PLAYING";
    const seeking = !this.initialized;
    this.initialized = true;
    if (seeking) this.bass.releaseAll(time);
    for (const event of buildupEvents) {
      if (event.beat === beat || seeking && ["vox", "chops"].includes(event.layer) && event.beat < beat && beat < event.end) {
        const offset = event.offset + (beat - event.beat) * .6;
        this.play(event, time, offset, (event.end - beat) * secondsPerBeat, event.layer === "roll" ? 2 ** (snareTranspose(beat) / 12) : 1);
      }
    }
    for (const note of buildupBass) if (note.beat === beat || seeking && note.beat < beat && beat < note.end) this.playBass(note, beat, time, secondsPerBeat);
  }
  private playBass(note: typeof buildupBass[number], beat: number, time: number, secondsPerBeat: number): void {
    this.bass.triggerBuild([{ midi: note.midi, velocity: note.velocity, startBeat: beat, durationBeats: note.end - beat, bar: Math.floor(beat / 4) + 1, beatInBar: beat % 4 + 1 }], time, secondsPerBeat, true);
  }
  private play(event: BuildupEvent, time: number, offset: number, duration: number, rate: number): void {
    if ([...this.sources].filter(clip => clip.start + clip.duration > time).length >= 24) return;
    const buffer = this.buffers.get(event.layer)!;
    const length = Math.min(duration, (buffer.duration - offset) / rate);
    if (length <= 0) return;
    const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: rate, loop: false, fadeIn: .001, fadeOut: .003,
      onended: () => {
        this.sources.delete(clip);
        // Like Tone.OneShotSource, retain the graph until offline audio has actually rendered.
        if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose();
      },
    });
    const clip: Clip = { event, source, start: time, offset, duration: length, rate };
    source.connect(this.gains.get(event.layer)!); this.sources.add(clip);
    source.start(time, offset, undefined, event.gain);
    source.stop(time + Math.max(.001, length - .003));
  }
  pause(time: number, beat: number): void {
    this.paused = [];
    for (const clip of this.sources) {
      const elapsed = Math.max(0, time - clip.start);
      if (elapsed < clip.duration) this.paused.push({ event: clip.event, offset: clip.offset + elapsed * clip.rate, duration: clip.duration - elapsed, rate: clip.rate });
      clip.source.stop(time);
    }
    if (this.authorized && beat >= buildupStart && beat < buildupBreak) this.bass.releaseAll(time);
    this.pausedBeat = beat;
  }
  resume(time: number): void {
    for (const clip of this.paused) this.play(clip.event, time, clip.offset, clip.duration, clip.rate);
    this.paused = [];
    const beat = this.pausedBeat;
    if (beat !== null && this.authorized) for (const note of buildupBass) if (note.beat < beat && beat < note.end) this.playBass(note, beat, time, 1 / this.beatsPerSecond);
    this.pausedBeat = null;
  }
  stop(time = Tone.immediate()): void {
    if (this.authorized && this.lastBeat >= buildupStart && this.lastBeat < buildupBreak) this.bass.releaseAll(time);
    for (const clip of this.sources) clip.source.stop(time);
    this.paused = []; this.pausedBeat = null; this.status = "NOT ARMED"; this.authorized = false;
  }
  dispose(): void {
    this.disposed = true;
    for (const clip of this.sources) clip.source.dispose(); this.sources.clear();
    for (const source of this.offlineEnded) source.dispose(); this.offlineEnded.clear();
    for (const buffer of this.buffers.values()) buffer.dispose();
    for (const gain of this.gains.values()) gain.dispose();
    this.voxOriginal.dispose(); this.voxLight.dispose(); this.voxHighPass.dispose(); this.voxEQ.dispose(); this.voxLowPass.dispose(); this.voxShape.dispose(); this.mix.dispose(); this.safety.dispose(); this.limiter.dispose();
  }
}
