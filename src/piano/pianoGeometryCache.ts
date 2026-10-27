import { mappedPianoGeometry, pianoRange } from './geometry';
import { interstellarPianoGeometry } from './interstellarPresentation';
import type { KeyboardMap } from './noteMapping';
import type { StagePresentation } from './performancePresentation';

/** One layout per canvas. Note activity never changes key geometry. */
export class PianoGeometryCache {
  private previous?: { map: KeyboardMap; width: number; transpose: number; low?: number; high?: number; presentation?: StagePresentation };
  private geometry?: ReturnType<typeof mappedPianoGeometry>;

  get(map: KeyboardMap, width: number, transpose: number, range?: { low: number; high: number }, presentation?: StagePresentation) {
    const previous = this.previous;
    if (this.geometry && previous && previous.map === map && previous.width === width && previous.transpose === transpose && previous.low === range?.low && previous.high === range?.high && previous.presentation === presentation) return this.geometry;
    const visible = range ?? pianoRange(map.bindings);
    this.geometry = presentation === 'interstellar'
      ? interstellarPianoGeometry(width, transpose, visible.low, visible.high)
      : mappedPianoGeometry(map, width, transpose, visible.low, visible.high, presentation === 'levels');
    this.previous = { map, width, transpose, low: range?.low, high: range?.high, presentation };
    return this.geometry;
  }
}
