import { isBlack } from './geometry';
import type { KeyboardMap } from './noteMapping';
import { assistedEvents } from './assistedSong';

export const robloxWhiteCharacters = '1234567890qwertyuiopasdfghjklzxcvbnm';
const shiftedDigits: Record<string, string> = { '1':'!', '2':'@', '3':'#', '4':'$', '5':'%', '6':'^', '7':'&', '8':'*', '9':'(', '0':')' };
export const robloxShiftCharacter = (label: string) => shiftedDigits[label] ?? label.toUpperCase();

let midi = 36;
/** Dedicated Performance map. Existing Practice profiles and other songs stay intact. */
export const interstellarRobloxMap: KeyboardMap = {
  id: 'interstellar-roblox-full', name: 'Interstellar · Roblox C2–C7',
  bindings: [...robloxWhiteCharacters].map(label => {
    while (isBlack(midi)) midi++;
    const pitch = midi++;
    return { code: /\d/.test(label) ? `Digit${label}` : `Key${label.toUpperCase()}`, label, midi: pitch,
      ...(pitch < 96 && isBlack(pitch + 1) ? { shiftedMidi: pitch + 1 } : {}) };
  }),
};

/** Adapt the old assisted fingering to standard keys by pitch, without editing the score or engine. */
export function interstellarAssistedCode(code: string, midi: number, cursor: number): string {
  for (let offset = 0; offset < assistedEvents.length; offset++) {
    const event = assistedEvents[(cursor + offset) % assistedEvents.length];
    if (event.liveMidi === midi) return event.code;
  }
  return code;
}

export function interstellarThemeShortcut(code: string): string {
  return interstellarRobloxMap.bindings.some(binding => binding.code === code) ? 'Backquote' : code;
}
