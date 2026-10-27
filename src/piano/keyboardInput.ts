import { getPitch, type KeyboardMap } from "./noteMapping";

export type InputSnapshot = {
  pressed: { code: string; label: string; midi: number }[];
  detected: string[];
  shift: boolean;
  notesPerSecond: number;
};
type Callbacks = {
  routeKeyDown?: (event: KeyboardEvent) => boolean;
  routeKeyUp?: (event: KeyboardEvent) => boolean;
  pitchForKey?: (event: KeyboardEvent, transpose: number) => number | undefined;
  mappedKeyDown?: (key: {code:string;label:string;midi:number;at:number}) => void;
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
  // Several physical keys can own one effective key (e.g. 5 also holds ]).
  private physicalNotes = new Map<string, string[]>();
  private noteOwners = new Map<string, Set<string>>();
  private heldControls = new Set<string>();
  private detected = new Set<string>();
  private shift = false;
  private recentAttacks: number[] = [];
  private enabled = false;
  private reservedCodes = new Set<string>();
  private transpose = 0;
  private ticker: number;
  private lastSnapshot?: InputSnapshot;
  private changeFrame: number | null = null;

  constructor(
    private map: KeyboardMap,
    private callbacks: Callbacks,
    private options: { batchChanges?: boolean } = {},
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

  heldPitches(): number[] {
    return [...this.held.values()].flatMap(held => held.chord ?? [held.midi]);
  }

  setReservedCodes(codes: string[]): void {
    this.reservedCodes = new Set(codes);
  }

  setChords(chords: Readonly<Record<string, readonly number[]>>): void {
    this.releaseAll();
    this.chords = chords;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.callbacks.routeKeyDown?.(event)) { event.preventDefault(); return; }
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
      this.held.set(event.code, { label: event.code === "Equal" ? "=" : event.code === "Minus" ? "-" : event.code.replace(/^(Key|Digit)/, ""), midi: pitches[0], chord: pitches });
      this.recentAttacks.push(...pitches.map(() => at));
      this.callbacks.chordOn(pitches, event.code, at);
      this.emit();
      return;
    }
    const midi = this.callbacks.pitchForKey?.(event, this.transpose) ?? getPitch(this.map, event.code, event.shiftKey, this.transpose);
    if (midi === null) {
      if (!event.repeat && !event.code.startsWith("Shift"))
        this.callbacks.unmappedKeyDown?.(event.code, performance.now());
      this.emit();
      return;
    }
    event.preventDefault();
    if (event.repeat || this.physicalNotes.has(event.code)) return;
    const pair = this.map.pairedKeys?.[event.code];
    const codes = [event.code, ...(pair && pair !== event.code ? [pair] : [])];
    const at = performance.now();
    const attacks: { code: string; label: string; midi: number }[] = [];
    const owned: string[] = [];
    for (const code of codes) {
      const pitch = code === event.code ? midi : getPitch(this.map, code, event.shiftKey, this.transpose);
      if (pitch === null) continue;
      const owners = this.noteOwners.get(code) ?? new Set<string>();
      owners.add(event.code); this.noteOwners.set(code, owners); owned.push(code);
      if (this.held.has(code)) continue;
      const binding = this.map.bindings.find(item => item.code === code);
      const note = { code, label: binding?.label ?? event.key, midi: pitch };
      this.held.set(code, note); attacks.push(note);
    }
    this.physicalNotes.set(event.code, owned);
    // Register both keys before validation observes the simultaneous chord.
    for (const note of attacks) {
      this.recentAttacks.push(at);
      this.callbacks.noteOn(note.midi, note.code, at);
      this.callbacks.mappedKeyDown?.({ ...note, label: note.code === event.code && event.key?.length === 1 ? event.key.toUpperCase() : note.label, at });
    }
    this.emit();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.callbacks.routeKeyUp?.(event)) { event.preventDefault(); return; }
    this.detected.delete(event.code);
    this.shift = event.shiftKey && !event.code.startsWith("Shift");
    if (this.heldControls.delete(event.code)) { event.preventDefault(); this.emit(); return; }
    const owned = this.physicalNotes.get(event.code);
    if (owned) {
      event.preventDefault();
      this.physicalNotes.delete(event.code);
      for (const code of owned) {
        const owners = this.noteOwners.get(code);
        owners?.delete(event.code);
        if (owners?.size) continue;
        this.noteOwners.delete(code);
        const note = this.held.get(code);
        if (note) { this.held.delete(code); this.releaseHeld(code, note, performance.now()); }
      }
      this.emit();
      return;
    }
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
    this.physicalNotes.clear();
    this.noteOwners.clear();
    this.heldControls.clear();
    this.detected.clear();
    this.shift = false;
    this.emit();
  };

  private emit = (): void => {
    const now = performance.now();
    this.recentAttacks = this.recentAttacks.filter((time) => now - time < 1000);
    const snapshot: InputSnapshot = {
      pressed: [...this.held].flatMap(([code, value]) =>
        (value.chord ?? [value.midi]).map(midi => ({ code, label: value.label, midi }))),
      detected: [...this.detected],
      shift: this.shift,
      notesPerSecond: this.recentAttacks.length,
    };
    const previous = this.lastSnapshot;
    if (previous && previous.shift === snapshot.shift && previous.notesPerSecond === snapshot.notesPerSecond &&
      previous.detected.length === snapshot.detected.length && previous.detected.every((code, index) => code === snapshot.detected[index]) &&
      previous.pressed.length === snapshot.pressed.length && previous.pressed.every((key, index) => {
        const next = snapshot.pressed[index]; return key.code === next.code && key.label === next.label && key.midi === next.midi;
      })) return;
    this.lastSnapshot = snapshot;
    if (!this.options.batchChanges) this.callbacks.change(snapshot);
    else if (this.changeFrame === null) this.changeFrame = requestAnimationFrame(() => {
      this.changeFrame = null;
      this.callbacks.change(this.lastSnapshot!);
    });
  };

  dispose(): void {
    this.releaseAll();
    if (this.changeFrame !== null) cancelAnimationFrame(this.changeFrame);
    this.changeFrame = null;
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("blur", this.releaseAll);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.clearInterval(this.ticker);
  }
}
