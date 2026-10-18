export type LiveNote = { id: number; code: string; midi: number; startMs: number; physicalEndMs: number | null; endMs: number | null; assisted: boolean; octave: boolean };

export class LiveNotes {
  private nextId = 1;
  private active = new Map<string, LiveNote>();
  private sustained: LiveNote[] = [];
  private released: LiveNote[] = [];

  on(code: string, midi: number, startMs: number, assisted = false, octave = false): void {
    if (this.active.has(code)) return;
    this.active.set(code, { id: this.nextId++, code, midi, startMs, physicalEndMs: null, endMs: null, assisted, octave });
  }

  off(code: string, endMs: number, sustain = false): void {
    const note = this.active.get(code);
    if (!note) return;
    note.physicalEndMs = Math.max(endMs, note.startMs);
    this.active.delete(code);
    if (sustain) this.sustained.push(note);
    else {
      note.endMs = note.physicalEndMs;
      this.released.push(note);
    }
    if (this.released.length > 600) this.released.splice(0, this.released.length - 600);
  }

  pedalUp(at: number): void {
    for (const note of this.sustained) {
      note.endMs = Math.max(at, note.physicalEndMs ?? note.startMs);
      this.released.push(note);
    }
    this.sustained = [];
    if (this.released.length > 600) this.released.splice(0, this.released.length - 600);
  }

  dampPitch(midi: number, at: number): void {
    const remaining: LiveNote[] = [];
    for (const note of this.sustained) {
      if (note.midi === midi) {
        note.endMs = Math.max(at, note.physicalEndMs ?? note.startMs);
        this.released.push(note);
      } else remaining.push(note);
    }
    this.sustained = remaining;
  }

  visible(now: number, travelMs: number): LiveNote[] {
    this.released = this.released.filter(note => now - (note.physicalEndMs ?? note.startMs) < travelMs);
    return [...this.released, ...this.sustained.filter(note => now - (note.physicalEndMs ?? note.startMs) < travelMs), ...this.active.values()];
  }

  clear(): void { this.active.clear(); this.sustained = []; this.released = []; }
}
