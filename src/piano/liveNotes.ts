export type LiveNote = { id: number; code: string; midi: number; startMs: number; endMs: number | null };

export class LiveNotes {
  private nextId = 1;
  private active = new Map<string, LiveNote>();
  private released: LiveNote[] = [];

  on(code: string, midi: number, startMs: number): void {
    if (this.active.has(code)) return;
    this.active.set(code, { id: this.nextId++, code, midi, startMs, endMs: null });
  }

  off(code: string, endMs: number): void {
    const note = this.active.get(code);
    if (!note) return;
    note.endMs = Math.max(endMs, note.startMs + 35);
    this.active.delete(code);
    this.released.push(note);
    if (this.released.length > 600) this.released.splice(0, this.released.length - 600);
  }

  visible(now: number, travelMs: number): LiveNote[] {
    this.released = this.released.filter(note => now - note.endMs! < travelMs);
    return [...this.released, ...this.active.values()];
  }

  clear(): void { this.active.clear(); this.released = []; }
}
