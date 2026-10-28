import { rosesIntroKeys } from './rosesIntroKeys';
import type { KeyboardMap } from './noteMapping';
import { stageKeyGuide,type StageKeyGuide } from './performancePresentation';
import { rosesChordBindings, rosesIndividualChordNotes } from './rosesIndividualChords';
import { visualDropChordShortcuts } from './visualDropChords';
import { rosesManualBassKeys } from './rosesManualBass';
import { buildupLeadGesturePitches } from './rosesManualBuildupLead';

/** Audience presentation only; operator controls and physical input routes remain intact. */
export const rosesHiddenAudienceChordPads=new Set(['Digit1','Digit2','Digit3','Digit4','Digit5','KeyI','KeyO','KeyP']);
const audiencePianoCodes=new Set([
  'KeyL','Semicolon','Quote','KeyJ','KeyH','KeyF','KeyD','KeyS','KeyA',
  'KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP',
  'Equal','Minus','Digit0','Digit9','Comma','Period','Slash',
]);
export function rosesAudiencePianoGuide(guide:StageKeyGuide):StageKeyGuide {
  return Object.fromEntries(Object.entries(guide).flatMap(([midi,entries])=>{
    const visible=entries.filter(entry=>audiencePianoCodes.has(entry.code)&&!entry.label.startsWith('⇧'));
    return visible.length?[[midi,visible]]:[];
  }));
}

/** Mirror input priority: controls, then fixed chord shortcuts, then transposed notes. */
export function rosesKeyGuide(map: KeyboardMap, transpose: number, vocalKey: string, manualBass = false, manualLead = false, buildupGestures = false) {
  const controls = new Set(['KeyV', 'KeyN', 'KeyB', 'KeyC', 'KeyZ', 'KeyX', vocalKey]);
  const bassKeys = manualBass ? rosesManualBassKeys.map(key => ({ code: key.code, label: key.label, midi: key.midi - transpose })) : [];
  return stageKeyGuide({ ...map, bindings: [...map.bindings.filter(binding => !controls.has(binding.code)).map(binding => {
    const midi=(buildupGestures?buildupLeadGesturePitches[binding.code]:undefined)??rosesIndividualChordNotes[binding.code];
    return midi === undefined ? binding : {...binding,midi:midi-transpose};
  }), ...bassKeys, ...rosesIntroKeys(vocalKey)] }, transpose,
    Object.fromEntries(Object.entries({ ...rosesChordBindings(manualLead), ...visualDropChordShortcuts }).map(([code, notes]) => [code, [...notes]])));
}
