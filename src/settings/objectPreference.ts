/** Optional local persistence; settings must remain usable when browser storage is blocked. */
export function readObjectPreference<T>(key: string, normalize: (value: Partial<T>) => T): T {
  let value: unknown;
  try { value = JSON.parse(globalThis.localStorage?.getItem(key) || 'null'); } catch { /* Default below. */ }
  return normalize(value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<T> : {});
}
export function writeObjectPreference(key: string, value: unknown): void {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* Preserve in-session settings. */ }
}
