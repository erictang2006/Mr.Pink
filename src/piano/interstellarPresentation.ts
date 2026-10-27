import { interstellarRobloxMap, robloxShiftCharacter } from './interstellarRoblox';
import score from './interstellar.song.json';
import { pianoGeometry } from './geometry';
import { getPitch, midiToName, type KeyboardMap } from './noteMapping';
import { stageKeyGuide } from './performancePresentation';
import type { InterstellarSection } from './interstellarPerformance';

/** Labels describe live input; the lone generated upper voice is identified as a double. */
export function interstellarKeyGuide(map: KeyboardMap, transpose: number, section: InterstellarSection, octaveEnabled: boolean) {
  const guide = stageKeyGuide(map, transpose);
  if (map.id === interstellarRobloxMap.id) {
    for (const binding of map.bindings) {
      guide[binding.midi + transpose] = [{ code: binding.code, label: binding.label, hand: 'neutral' }];
      if (binding.shiftedMidi !== undefined) guide[binding.shiftedMidi + transpose] = [{ code: binding.code, label: robloxShiftCharacter(binding.label), hand: 'neutral' }];
    }
  }
  // planInterstellarPress doubles F only when its captured pitch is E5 (76).
  if (section === 3 && octaveEnabled && getPitch(map, 'KeyF', false, transpose) === 76) {
    guide[88] = [...(guide[88] ?? []), { code: 'KeyF', label: 'F ×2', hand: 'neutral' }];
  }
  return guide;
}

/** Keep the continuous range, with black keys sized consistently at every resolution. */
export function interstellarPianoGeometry(width: number, transpose: number, low: number, high: number) {
  const geometry = pianoGeometry(width, transpose, low, high);
  const blackWidth = geometry.whiteWidth * .6;
  for (const key of geometry.keys.values()) if (key.black) {
    key.x += (key.width - blackWidth) / 2;
    key.width = blackWidth;
  }
  return { ...geometry, blackWidth };
}

/** Only score-derived upper-register notes receive the prominent performance treatment. */
export function interstellarProminentPitches(section: InterstellarSection, octaveEnabled: boolean, transpose = 0): Set<number> {
  const [low, high] = section === 1 ? [1,8] : section === 2 ? [9,13] : [14,30];
  const pitches = new Set(score.measures.filter(measure => measure.number >= low && measure.number <= high).flatMap(measure => measure.notes.map(note => note.midi + transpose)));
  if (section === 3 && octaveEnabled && transpose === 0) pitches.add(88);
  return pitches;
}

/** Roblox labels are a pitch reference, independent of the actual assisted fingering. */
export function interstellarDisplayPressedKeys(pressed: readonly {code:string;midi:number}[], transpose=0): {code:string;midi:number}[] {
  return pressed.map(key => {
    const reference=interstellarRobloxMap.bindings.find(binding => binding.midi+transpose===key.midi || binding.shiftedMidi!==undefined && binding.shiftedMidi+transpose===key.midi);
    return {code:reference?.code ?? key.code,midi:key.midi};
  });
}

/** HUD follows the same sounding pitch/reference labels as the visible piano, not the typed character. */
export function interstellarPianoNoteLabel(midi:number,transpose=0){
  const reference=interstellarRobloxMap.bindings.find(binding=>binding.midi+transpose===midi||binding.shiftedMidi!==undefined&&binding.shiftedMidi+transpose===midi);
  const keyLabel=reference?(reference.midi+transpose===midi?reference.label:robloxShiftCharacter(reference.label)):null;
  return {note:midiToName(midi),keyLabel};
}

/** One live gesture can light several piano keys, including its assisted and octave voices. */
export function interstellarSoundingKeys(pitches:readonly number[],code:string,at:number,transpose=0){
  return [...new Set(pitches)].flatMap(midi=>{
    const {keyLabel}=interstellarPianoNoteLabel(midi,transpose);
    return keyLabel?[{code,label:keyLabel,midi,at}]:[];
  });
}
