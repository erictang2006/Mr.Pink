import { getPitch, type KeyboardMap } from "./noteMapping";

export type InputSnapshot = {
  pressed: { code: string; label: string; midi: number }[];
  detected: string[];
  shift: boolean;
  notesPerSecond: number;
};
type Callbacks = {
  noteOn: (midi: number, code: string, at: number) => void;
  noteOff: (midi: number, code: string, at: number) => void;
  change: (snapshot: InputSnapshot) => void;
  unmappedKeyDown?: (code: string, at: number) => void;
  controlKeyDown?: (code: string, at: number) => boolean;
  chordOn?: (pitches: readonly number[], code: string, at: number) => void;
  chordOff?: (pitches: readonly number[], code: string, at: number) => void;
};

export class KeyboardInputManager {
  private held = new Map<string, { label: string; midi: number; chord?: readonly number[] }>();
  private chords: Readonly<Record<string, readonly number[]>> = {};
  private heldControls = new Set<string>();
  private detected = new Set<string>();
  private shift = false;
  private recentAttacks: number[] = [];
  private enabled = false;
  private reservedCodes = new Set<string>();
  private transpose = 0;
  private ticker: number;

  constructor(
    private map: KeyboardMap,
    private callbacks: Callbacks,
  ) {
    window.addEventListener("keydown", this.onKeyDown, { capture: true });
    window.addEventListener("keyup", this.onKeyUp, { capture: true });
    window.addEventListener("blur", this.releaseAll);
    document.addEventListener("visibilitychange", this.onVisibility);
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

  setMap(map: KeyboardMap, preserveHeld = false): void {
    if (!preserveHeld) this.releaseAll();
    this.map = map;
  }

  setReservedCodes(codes: string[]): void {
    this.reservedCodes = new Set(codes);
  }

  setChords(chords: Readonly<Record<string, readonly number[]>>): void {
    this.releaseAll();
    this.chords = chords;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]'))
      return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (this.reservedCodes.has(event.code)) return;
    this.detected.add(event.code);
    this.shift = event.shiftKey || event.code.startsWith("Shift");
    if (this.heldControls.has(event.code)) { event.preventDefault(); return; }
    if (!event.repeat && this.callbacks.controlKeyDown?.(event.code, performance.now())) {
      event.preventDefault();
      this.heldControls.add(event.code);
      this.emit();
      return;
    }
    const chord = this.chords[event.code];
    if (chord?.length && this.callbacks.chordOn) {
      event.preventDefault();
      if (event.repeat || this.held.has(event.code)) return;
      const pitches = [...chord];
      const at = performance.now();
      this.held.set(event.code, { label: event.code.replace(/^(Key|Digit)/, ""), midi: pitches[0], chord: pitches });
      this.recentAttacks.push(...pitches.map(() => at));
      this.callbacks.chordOn(pitches, event.code, at);
      this.emit();
      return;
    }
    const midi = getPitch(this.map, event.code, event.shiftKey, this.transpose);
    if (midi === null) {
      if (!event.repeat && !event.code.startsWith("Shift"))
        this.callbacks.unmappedKeyDown?.(event.code, performance.now());
      this.emit();
      return;
    }
    event.preventDefault();
    if (event.repeat || this.held.has(event.code)) return;
    const binding = this.map.bindings.find((item) => item.code === event.code)!;
    this.held.set(event.code, { label: binding.label, midi });
    const at = performance.now();
    this.recentAttacks.push(at);
    this.callbacks.noteOn(midi, event.code, at);
    this.emit();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.detected.delete(event.code);
    this.shift = event.shiftKey && !event.code.startsWith("Shift");
    if (this.heldControls.delete(event.code)) { event.preventDefault(); this.emit(); return; }
    const held = this.held.get(event.code);
    if (!held) {
      this.emit();
      return;
    }
    event.preventDefault();
    this.held.delete(event.code);
    this.releaseHeld(event.code, held, performance.now());
    this.emit();
  };

  private onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  private releaseHeld(code: string, held: { midi: number; chord?: readonly number[] }, at: number): void {
    if (held.chord) this.callbacks.chordOff?.(held.chord, code, at);
    else this.callbacks.noteOff(held.midi, code, at);
  }

  releaseAll = (): void => {
    const at = performance.now();
    for (const [code, held] of this.held)
      this.releaseHeld(code, held, at);
    this.held.clear();
    this.heldControls.clear();
    this.detected.clear();
    this.shift = false;
    this.emit();
  };

  private emit = (): void => {
    const now = performance.now();
    this.recentAttacks = this.recentAttacks.filter((time) => now - time < 1000);
    this.callbacks.change({
      pressed: [...this.held].flatMap(([code, value]) =>
        (value.chord ?? [value.midi]).map(midi => ({ code, label: value.label, midi }))),
      detected: [...this.detected],
      shift: this.shift,
      notesPerSecond: this.recentAttacks.length,
    });
  };

  dispose(): void {
    this.releaseAll();
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("blur", this.releaseAll);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.clearInterval(this.ticker);
  }
}
