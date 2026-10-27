/** Space toggles the pedal once per physical press, independent of key repeat. */
export function spaceStartsRosesPerformance(view: string, song: string, status: string | undefined): boolean {
  return view === 'performance' && song === 'roses' && (status === 'idle' || status === 'finished');
}

export class PedalInput {
  private held = false;

  constructor(private toggle: () => void) {}

  keydown(event: KeyboardEvent): void {
    if (event.code !== "Space" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.repeat || this.held) return;
    this.held = true;
    this.toggle();
  }

  keyup(event: KeyboardEvent): void {
    if (event.code !== "Space") return;
    event.preventDefault();
    this.held = false;
  }

  reset(): void { this.held = false; }
}
