export type SharedSettings = { version: 1; revision: string; settings: Record<string, string> };
export const initialSettings: SharedSettings = { version: 1, revision: 'initial', settings: {} };
export function isSharedKey(key: string): boolean {
  return key === 'mr-pink-camera-frame' || (key.startsWith('stage-piano-') &&
    !key.startsWith('stage-piano-roses-calibration:') && key !== 'stage-piano-imported-instruments-v1');
}
export function validateSettings(value: unknown): SharedSettings {
  if (!value || typeof value !== 'object') throw new Error('Invalid settings file.');
  const item = value as SharedSettings;
  if (item.version !== 1 || typeof item.revision !== 'string' || item.revision.length > 120 ||
      !item.settings || typeof item.settings !== 'object' || Array.isArray(item.settings)) throw new Error('Unsupported settings file.');
  const settings: Record<string, string> = {};
  const entries = Object.entries(item.settings);
  if (entries.length > 300) throw new Error('Too many settings.');
  for (const [key, value] of entries) {
    if (!isSharedKey(key) || typeof value !== 'string' || value.length > 500_000) throw new Error('Invalid setting.');
    settings[key] = value;
  }
  if (JSON.stringify(settings).length > 1_000_000) throw new Error('Settings file is too large.');
  return { version: 1, revision: item.revision, settings };
}
export function snapshotSettings(storage: Storage): Record<string, string> {
  const settings: Record<string, string> = {};
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && isSharedKey(key)) {
      const value = storage.getItem(key);
      if (value !== null) settings[key] = value;
    }
  }
  return Object.fromEntries(Object.entries(settings).sort(([a], [b]) => a.localeCompare(b)));
}
export function applySettings(storage: Storage, settings: Record<string, string>): void {
  const previous = snapshotSettings(storage);
  try {
    for (const key of Object.keys(previous)) if (!(key in settings)) storage.removeItem(key);
    for (const [key, value] of Object.entries(settings)) storage.setItem(key, value);
  } catch (error) {
    // Preserve the prior setup if a quota or privacy restriction blocks hydration.
    for (const key of Object.keys(settings)) if (!(key in previous)) storage.removeItem(key);
    for (const [key, value] of Object.entries(previous)) storage.setItem(key, value);
    throw error;
  }
}
export const fingerprint = (settings: Record<string, string>) => JSON.stringify(Object.entries(settings).sort(([a], [b]) => a.localeCompare(b)));
