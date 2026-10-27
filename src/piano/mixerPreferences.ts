import { backingGroups, type BackingGroup } from './rosesBacking';
import { dropLayerIds, newDropRows, type DropLayer, type DropRow } from './rosesDropMixer';
import { recordedDropMaxVolume } from './rosesRecordedDrop';
export const riserPreferenceKey = 'stage-piano-pre-drop-riser-v1';
export const hybridDrumPreferenceKey = 'stage-piano-hybrid-drums-v1';
export const backingMixPreferenceKey = 'stage-piano-backing-mix-v1';
export const dropMixPreferenceKey = 'stage-piano-drop-mixer-v1';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const level = (value: unknown, fallback: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
export type BackingMixPreferences = { gain: number; levels: Record<BackingGroup, number>; solo: BackingGroup | null };
export function validBackingMix(raw: unknown): BackingMixPreferences {
  const input = object(raw), levels = object(input.levels);
  return { gain: level(input.gain, 1, 1.5), levels: Object.fromEntries(backingGroups.map(group => [group, level(levels[group], 1, 1.5)])) as Record<BackingGroup, number>, solo: backingGroups.includes(input.solo as BackingGroup) ? input.solo as BackingGroup : null };
}
export type DropMixerPreferences = {
  rows: Record<DropLayer, DropRow>; drumMutes: { kick: boolean; clap: boolean; hat: boolean };
  recordedLeadEnabled: boolean; chordPreset: 'original' | 'bright'; chordLevels: number[];
};
export function validDropMixer(raw: unknown): DropMixerPreferences {
  const input = object(raw), savedRows = object(input.rows), rows = newDropRows();
  for (const id of dropLayerIds) {
    const saved = object(savedRows[id]);
    for (const key of ['enabled', 'muted', 'solo'] as const) if (typeof saved[key] === 'boolean') rows[id][key] = saved[key];
    rows[id].volume = level(saved.volume, rows[id].volume, id === 'recorded' ? recordedDropMaxVolume : 1);
  }
  rows.bonkChords.enabled = false;
  const mutes = object(input.drumMutes), levels = Array.isArray(input.chordLevels) ? input.chordLevels : [];
  return { rows, drumMutes: { kick: mutes.kick === true, clap: mutes.clap === true, hat: mutes.hat === true }, recordedLeadEnabled: input.recordedLeadEnabled === true, chordPreset: input.chordPreset === 'bright' ? 'bright' : 'original', chordLevels: [level(levels[0], .3981071115, 1.5), level(levels[1], .9332544208, 1.5)] };
}
