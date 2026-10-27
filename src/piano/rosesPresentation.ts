import { rosesIntroKeys } from './rosesIntroKeys';
import type { KeyboardMap } from './noteMapping';
import { stageKeyGuide } from './performancePresentation';
import { rosesChordBindings, rosesIndividualChordNotes } from './rosesIndividualChords';
import { visualDropChordShortcuts } from './visualDropChords';
import { rosesManualBassKeys } from './rosesManualBass';

/** Mirror input priority: controls, then fixed chord shortcuts, then transposed notes. */
export function rosesKeyGuide(map: KeyboardMap, transpose: number, vocalKey: string, manualBass = false, manualLead = false) {
  const controls = new Set(['KeyV', 'KeyN', 'KeyB', 'KeyC', 'KeyZ', 'KeyX', vocalKey]);
  const bassKeys = manualBass ? rosesManualBassKeys.map(key => ({ code: key.code, label: key.label, midi: key.midi - transpose })) : [];
  return stageKeyGuide({ ...map, bindings: [...map.bindings.filter(binding => !controls.has(binding.code)).map(binding =>
    rosesIndividualChordNotes[binding.code] === undefined ? binding : {...binding,midi:rosesIndividualChordNotes[binding.code]-transpose}), ...bassKeys, ...rosesIntroKeys(vocalKey)] }, transpose,
    Object.fromEntries(Object.entries({ ...rosesChordBindings(manualLead), ...visualDropChordShortcuts }).map(([code, notes]) => [code, [...notes]])));
}
