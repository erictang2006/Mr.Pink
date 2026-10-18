/** Tracks physical voice lifetimes separately from notes held by the damper pedal. */
export class SustainVoices {
  private held = new Map<number, number>();
  private sustained = new Set<number>();
  private pedal = false;

  attack(midi: number): boolean {
    const releasePrior = !this.held.has(midi) && this.sustained.delete(midi);
    this.held.set(midi, (this.held.get(midi) ?? 0) + 1);
    return releasePrior;
  }

  release(midi: number): boolean {
    const count = this.held.get(midi) ?? 0;
    if (count === 0) return false;
    if (count > 1) { this.held.set(midi, count - 1); return false; }
    this.held.delete(midi);
    if (this.pedal) { this.sustained.add(midi); return false; }
    return true;
  }

  setPedal(enabled: boolean): number[] {
    if (enabled === this.pedal) return [];
    this.pedal = enabled;
    if (enabled) return [];
    const releases = [...this.sustained].filter(midi => !this.held.has(midi));
    this.sustained.clear();
    return releases;
  }

  clear(): void {
    this.held.clear();
    this.sustained.clear();
    this.pedal = false;
  }

  isHeld(midi: number): boolean { return this.held.has(midi); }
  isSustained(midi: number): boolean { return this.sustained.has(midi); }
}
