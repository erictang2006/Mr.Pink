import { getPitch, type KeyboardMap } from './noteMapping';

export type InputSnapshot = { pressed: { code: string; label: string; midi: number }[]; notesPerSecond: number };
type Callbacks = { noteOn: (midi: number) => void; noteOff: (midi: number) => void; change: (snapshot: InputSnapshot) => void };

export class KeyboardInputManager {
  private held = new Map<string, { label: string; midi: number }>();
  private recentAttacks: number[] = [];
  private enabled = false;
  private transpose = 0;
  private ticker: number;

  constructor(private map: KeyboardMap, private callbacks: Callbacks) {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.ticker = window.setInterval(this.emit, 250);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  setTranspose(semitones: number): void {
    this.transpose = semitones;
    this.releaseAll();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const midi = getPitch(this.map, event.code, event.shiftKey, this.transpose);
    if (midi === null) {
      if (['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.code)) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (event.repeat || this.held.has(event.code)) return;
    const binding = this.map.bindings.find(item => item.code === event.code)!;
    this.held.set(event.code, { label: binding.label, midi });
    this.recentAttacks.push(performance.now());
    this.callbacks.noteOn(midi);
    this.emit();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const held = this.held.get(event.code);
    if (!held) return;
    event.preventDefault();
    this.held.delete(event.code);
    this.callbacks.noteOff(held.midi);
    this.emit();
  };

  private onVisibility = (): void => { if (document.hidden) this.releaseAll(); };

  releaseAll = (): void => {
    for (const held of this.held.values()) this.callbacks.noteOff(held.midi);
    this.held.clear();
    this.emit();
  };

  private emit = (): void => {
    const now = performance.now();
    this.recentAttacks = this.recentAttacks.filter(time => now - time < 1000);
    this.callbacks.change({
      pressed: [...this.held].map(([code, value]) => ({ code, ...value })),
      notesPerSecond: this.recentAttacks.length,
    });
  };

  dispose(): void {
    this.releaseAll();
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.clearInterval(this.ticker);
  }
}
