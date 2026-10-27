import { useEffect, useState } from 'react';

type PreferenceValue<T> = T extends number ? number : boolean;

export function usePreference<T extends number | boolean>(name: string, fallback: T, valid: (value: PreferenceValue<T>) => boolean = () => true) {
  const key = `stage-piano-ui-${name}`;
  const [value, setValue] = useState<PreferenceValue<T>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      return typeof stored === typeof fallback && (typeof stored !== 'number' || Number.isFinite(stored)) && valid(stored) ? stored as PreferenceValue<T> : fallback as PreferenceValue<T>;
    } catch { return fallback as PreferenceValue<T>; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Continue with session preferences. */ }
  }, [key, value]);
  return [value, setValue] as const;
}
