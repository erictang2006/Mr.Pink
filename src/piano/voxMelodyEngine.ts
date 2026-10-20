import * as Tone from "tone";
import melody from "./voxMelody.json";
import { HereWithMeLeadEngine } from "./hereWithMeLeadEngine";

export const voxStabNoteUrl = "/roses/buildup/loud-stabs-single-E4.wav";
export const voxMelodyNotes = [
  ...melody.notes.map(note => ({ ...note, beat: note.beat + 112 })),
  ...melody.notes.filter(note => note.beat < 12).map(note => ({ ...note, beat: note.beat + 128 })),
];

/** Two alternative timbres for the Vox melody, independent of live chords/drop lead. */
export class VoxMelodyEngine {
  private stab = new Tone.ToneAudioBuffer();
  private lead: HereWithMeLeadEngine;
  private sources = new Set<Tone.ToneBufferSource>();
  private offlineEnded = new Set<Tone.ToneBufferSource>();
  private lastBeat = -1;
  private disposed = false;

  constructor(private output: Tone.InputNode) {
    this.lead = new HereWithMeLeadEngine(output);
    this.lead.configure({ volume: 1 });
  }
  async load(): Promise<void> { await this.stab.load(voxStabNoteUrl); if (this.disposed) this.stab.dispose(); }
  tick(beat: number, time: number, secondsPerBeat: number, mode: "stabs" | "lead"): void {
    if (beat === this.lastBeat || beat < 112 || beat >= 140) return;
    this.lastBeat = beat;
    for (const note of voxMelodyNotes.filter(note => note.beat === beat)) {
      const duration = note.duration * secondsPerBeat;
      if (mode === "lead") this.lead.triggerMelodyNote(note.midi, duration, time);
      else {
        const rate = 2 ** ((note.midi - 64) / 12);
        const length = Math.min(duration + .12, this.stab.duration / rate);
        const source = new Tone.ToneBufferSource({ url: this.stab, playbackRate: rate, fadeIn: .001, fadeOut: Math.min(.12, length / 2),
          onended: () => {
            this.sources.delete(source);
            if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose();
          },
        }).connect(this.output);
        this.sources.add(source); source.start(time, 0, undefined, .8); source.stop(time + length);
      }
    }
  }
  prepareLead(): void { this.lead.prepareVoices(); }
  pause(): void {
    const beat = this.lastBeat;
    this.stop(); this.lastBeat = beat;
  }
  stop(): void {
    this.lead.stop();
    for (const source of this.sources) source.dispose();
    this.sources.clear();
    this.lastBeat = -1;
  }
  dispose(): void {
    this.disposed = true; this.lead.dispose();
    for (const source of this.sources) source.dispose();
    for (const source of this.offlineEnded) source.dispose();
    this.sources.clear(); this.offlineEnded.clear(); this.stab.dispose();
  }
}
