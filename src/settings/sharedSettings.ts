import { applySettings, fingerprint, snapshotSettings, validateSettings, type SharedSettings } from './schema';
let sharedDocument: SharedSettings | null = null;
let lastSaved = '';
let inFlight: Promise<void> | null = null;
let conflict = false;
let status = 'Loading shared settings…';
const listeners = new Set<() => void>();
const notify = (message: string) => { status = message; listeners.forEach(listener => listener()); };
export const settingsStatus = () => status;
export const subscribeSettings = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const development = import.meta.env.DEV;
const endpoint = '/__mr-pink/settings';
const checkpointKey = 'mr-pink-settings-checkpoint-v1';
const pendingKey = 'mr-pink-settings-pending-v1';
type Checkpoint = { revision: string; fingerprint: string };
function readCheckpoint(key: string): Checkpoint | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value.revision === 'string' && typeof value.fingerprint === 'string' ? value : null;
  } catch { return null; }
}
function checkpoint(key: string, revision: string, value: string): void {
  try { localStorage.setItem(key, JSON.stringify({ revision, fingerprint: value })); } catch { /* Browser preferences still work if metadata cannot save. */ }
}

function pendingCheckpoints(): Checkpoint[] {
  try {
    const value = JSON.parse(localStorage.getItem(pendingKey) || 'null');
    return (Array.isArray(value) ? value : value ? [value] : []).filter(item => item && typeof item.revision === 'string' && typeof item.fingerprint === 'string').slice(-4);
  } catch { return []; }
}
function savePending(items: Checkpoint[]): void {
  try { if (items.length) localStorage.setItem(pendingKey, JSON.stringify(items)); else localStorage.removeItem(pendingKey); } catch { /* Optional metadata. */ }
}
function markPending(revision: string, value: string): void {
  const previous = pendingCheckpoints().filter(item => item.fingerprint !== value);
  savePending([...previous, { revision, fingerprint: value }].slice(-4));
}
function acknowledgePending(value: string): void {
  const pending = pendingCheckpoints(), index = pending.findIndex(item => item.fingerprint === value);
  if (index >= 0) savePending(pending.slice(index + 1));
}
export async function initializeSettings(): Promise<void> {
  try {
    const response = await fetch(development ? endpoint : '/shared-settings.json', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Could not load shared settings.');
    sharedDocument = validateSettings(await response.json());
    const remoteFingerprint = fingerprint(sharedDocument.settings);
    const previous = readCheckpoint(checkpointKey), pending = pendingCheckpoints();
    // Same repository revision: keep newer browser changes, even after an immediate reload.
    // A completed request from the previous page is also ours if its saved content matches.
    const sameProfile = previous?.revision === sharedDocument.revision || pending.some(item => item.fingerprint === remoteFingerprint);
    if (sharedDocument.revision !== 'initial' && !sameProfile) applySettings(localStorage, sharedDocument.settings);
    lastSaved = remoteFingerprint;
    checkpoint(checkpointKey, sharedDocument.revision, remoteFingerprint);
    if (sameProfile) acknowledgePending(remoteFingerprint); else savePending([]);
    notify(development ? 'Settings save automatically to this repository.' : 'Loaded repository settings. Use Export to carry further changes.');
  } catch {
    notify('Shared settings could not load. Your browser settings are still available; reload to retry.');
    // Never overwrite an unreadable repository file with a partial local copy.
    sharedDocument = null;
  }
}
export function saveSharedSettings(): Promise<void> {
  if (inFlight) return inFlight;
  if (!development || !sharedDocument || conflict) return Promise.resolve();
  let settings: Record<string, string>;
  try { settings = snapshotSettings(localStorage); } catch { notify('Browser storage is unavailable. Settings could not save.'); return Promise.resolve(); }
  const nextFingerprint = fingerprint(settings);
  if (nextFingerprint === lastSaved) return Promise.resolve();
  const payload = { ...sharedDocument, settings };
  markPending(payload.revision, nextFingerprint);
  inFlight = (async () => {
    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
      if (response.status === 409) { conflict = true; notify('Repository settings changed. Reload to use them before saving more settings.'); return; }
      if (!response.ok) throw new Error('Save failed');
      sharedDocument = validateSettings(await response.json());
      lastSaved = nextFingerprint;
      checkpoint(checkpointKey, sharedDocument.revision, nextFingerprint);
      acknowledgePending(nextFingerprint);
      notify('Saved to public/shared-settings.json. Commit and push to transfer.');
    } catch { notify('Settings remain in this browser. Repository save failed; retry with Save now.'); }
    finally { inFlight = null; }
  })();
  return inFlight;
}
export function startSettingsSync(): () => void {
  if (!development) return () => {};
  const timer = window.setInterval(() => { void saveSharedSettings(); }, 1000);
  const flush = () => { void saveSharedSettings(); };
  const hidden = () => { if (globalThis.document.hidden) flush(); };
  window.addEventListener('pagehide', flush);
  globalThis.document.addEventListener('visibilitychange', hidden);
  return () => { window.clearInterval(timer); window.removeEventListener('pagehide', flush); globalThis.document.removeEventListener('visibilitychange', hidden); };
}
export function exportSettings(): void {
  try {
    const settings = snapshotSettings(localStorage);
    const blob = new Blob([`${JSON.stringify({ version: 1, revision: crypto.randomUUID(), settings }, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = globalThis.document.createElement('a');
    anchor.href = url; anchor.download = 'shared-settings.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { notify('Could not export settings from browser storage.'); }
}
