import arrangement from "./rosesDropArrangement.json";
import type { LiveNotes } from './liveNotes';
import { rosesChordSource } from './rosesChords';

// Legacy number-row chords remain useful gestures, but no longer allocate
// chord, bass, impact or recorded-stab voices during the live performance.
const gestureCodes = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Equal', 'Minus', 'Digit0', 'Digit9']);
export const withUpperOctave = (notes: readonly number[]): number[] => [...new Set([...notes, ...notes.map(midi => midi + 12)])].sort((a,b) => a-b);

// Exact stacked chord voicings from the existing Roses drop MIDI, not HWM harmony.
export const visualDropChords = [
  {code:'Equal',key:'=',name:'C♯ minor',beat:144},
  {code:'Minus',key:'-',name:'A major',beat:146},
  {code:'Digit0',key:'0',name:'E major',beat:148},
  {code:'Digit9',key:'9',name:'E · D♯ top',beat:150.5},
].map(chord=>{
  const sourceNotes=[...new Set(arrangement.notes.filter(note=>note.group==='chords'&&note.beat===chord.beat).map(note=>note.midi))].sort((a,b)=>a-b);
  return {...chord,sourceNotes,notes:withUpperOctave(sourceNotes)};
});
export const visualDropChordShortcuts: Readonly<Record<string,readonly number[]>> = Object.fromEntries(visualDropChords.map(chord=>[chord.code,chord.notes]));

/** Consumed before any instrument engine; these keys own visuals only. */
export function pressVisualDropChord(notes: LiveNotes, code: string, pitches: readonly number[], at: number): boolean {
  if (!gestureCodes.has(code)) return false;
  for (const midi of pitches) notes.on(rosesChordSource(code,midi),midi,at);
  return true;
}
export function releaseVisualDropChord(notes: LiveNotes, code: string, pitches: readonly number[], at: number): boolean {
  if (!gestureCodes.has(code)) return false;
  for (const midi of pitches) notes.off(rosesChordSource(code,midi),at,false);
  return true;
}
