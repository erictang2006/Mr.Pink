import type { KeyboardMap } from './noteMapping';
import { stageKeyGuide } from './performancePresentation';
import { rosesChordShortcuts } from './rosesChords';
import { hereWithMeChordShortcuts } from './hereWithMeChords';

/** Mirror input priority: controls, then fixed chord shortcuts, then transposed notes. */
export function rosesKeyGuide(map: KeyboardMap, transpose: number, vocalKey: string) {
  const controls = new Set(['KeyV', 'KeyN', 'KeyB', 'KeyM', 'KeyZ', 'KeyX', vocalKey]);
  return stageKeyGuide({ ...map, bindings: map.bindings.filter(binding => !controls.has(binding.code)) }, transpose,
    Object.fromEntries(Object.entries({ ...rosesChordShortcuts, ...hereWithMeChordShortcuts }).map(([code, notes]) => [code, [...notes]])));
}
