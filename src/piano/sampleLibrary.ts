import { midiToToneName } from "./noteMapping";

export type ImportedSample = { id: string; fileName: string; rootMidi: number; bytes: number; duration: number; url?: string };
export type ImportedInstrument = { id: string; name: string; samples: ImportedSample[]; source: "browser" | "project" };
export const bundledRosesInstrument: ImportedInstrument = {
  id: "roses-experimental-e4", name: "Roses Experimental E4 Sample", source: "project",
  samples: [{ id: "roses-e4", fileName: "experimental_E4_note_sample.wav", rootMidi: 64, bytes: 141164, duration: .8, url: "/roses/experimental_E4_note_sample.wav" }],
};
const storageKey = "stage-piano-imported-instruments-v1";
const dbName = "stage-piano-samples-v1";
const allowed = /\.(wav|mp3|ogg)$/i;
export function inferredMidi(name: string): number {
  const match = name.match(/(?:^|[^a-z])([a-g])([#b♯♭]?)(-?\d)(?=[^\da-z]|$)/i);
  if (!match) return 60;
  const semitone: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  return Math.max(0, Math.min(127, (Number(match[3]) + 1) * 12 + semitone[match[1].toLowerCase()] + (match[2] === "#" || match[2] === "♯" ? 1 : match[2] === "b" || match[2] === "♭" ? -1 : 0)));
}
export function savedInstruments(): ImportedInstrument[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(raw) ? raw.filter(validInstrument) : [];
  } catch { return []; }
}
function validInstrument(value: unknown): value is ImportedInstrument {
  if (!value || typeof value !== "object") return false;
  const item = value as ImportedInstrument;
  return typeof item.id === "string" && typeof item.name === "string" && (item.source === "browser" || item.source === "project") && Array.isArray(item.samples) && item.samples.length > 0 && item.samples.every(sample =>
    typeof sample.id === "string" && Number.isInteger(sample.rootMidi) && sample.rootMidi >= 0 && sample.rootMidi <= 127 && (item.source === "browser" || typeof sample.url === "string" && sample.url.startsWith("/instruments/")));
}
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("Browser sample storage is unavailable.")); return; }
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files"); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function storeBlobs(entries: { id: string; file: File }[]): Promise<void> {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      const store = transaction.objectStore("files"); entries.forEach(entry => store.put(entry.file, entry.id));
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
export async function loadSampleBlobs(instrument: ImportedInstrument): Promise<Blob[]> {
  if (instrument.source !== "browser") throw new Error("Project instruments use bundled URLs.");
  const database = await db();
  try {
    return await Promise.all(instrument.samples.map(sample => new Promise<Blob>((resolve, reject) => {
      const transaction = database.transaction("files", "readonly"); const request = transaction.objectStore("files").get(sample.id);
      request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error(`Missing saved sample: ${sample.fileName}`));
      request.onerror = () => reject(request.error);
    })));
  } finally { database.close(); }
}
export async function audioDuration(file: File): Promise<number> {
  if (!allowed.test(file.name)) throw new Error(`${file.name}: choose a WAV, MP3, or OGG file.`);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = new Audio(); audio.preload = "metadata"; audio.src = url;
      audio.onloadedmetadata = () => Number.isFinite(audio.duration) ? resolve(audio.duration) : reject(new Error(`${file.name}: cannot read audio duration.`));
      audio.onerror = () => reject(new Error(`${file.name}: cannot decode audio.`));
    });
  } finally { URL.revokeObjectURL(url); }
}
export type SampleDraft = { file: File; rootMidi: number; duration: number };
export async function saveImportedInstrument(name: string, drafts: SampleDraft[]): Promise<ImportedInstrument> {
  if (!name.trim() || !drafts.length) throw new Error("Name the instrument and choose at least one isolated note sample.");
  if (drafts.some(draft => !Number.isInteger(draft.rootMidi) || draft.rootMidi < 0 || draft.rootMidi > 127 || draft.duration > 8 || draft.duration <= 0)) throw new Error("Samples must be isolated notes of at most 8 seconds with valid root pitches.");
  if (new Set(drafts.map(draft => draft.rootMidi)).size !== drafts.length) throw new Error("Assign a different root pitch to each sample.");
  const id = crypto.randomUUID();
  const samples = drafts.map(draft => ({ id: crypto.randomUUID(), fileName: draft.file.name, rootMidi: draft.rootMidi, bytes: draft.file.size, duration: draft.duration }));
  await storeBlobs(drafts.map((draft, index) => ({ id: samples[index].id, file: draft.file })));
  const instrument: ImportedInstrument = { id, name: name.trim(), source: "browser", samples };
  localStorage.setItem(storageKey, JSON.stringify([...savedInstruments(), instrument]));
  return instrument;
}
export function exportManifest(instrument: ImportedInstrument): void {
  const manifest = { ...instrument, source: "project", samples: instrument.samples.map(sample => ({ ...sample, rootNote: midiToToneName(sample.rootMidi), url: `/instruments/${instrument.id}/${sample.fileName}` })) };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${instrument.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-manifest.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function importProjectManifest(raw: unknown): ImportedInstrument {
  if (!validInstrument(raw) || raw.source !== "project") throw new Error("Invalid project instrument manifest. Sample URLs must be under /instruments/.");
  const instrument = raw as ImportedInstrument;
  localStorage.setItem(storageKey, JSON.stringify([...savedInstruments().filter(item => item.id !== instrument.id), instrument]));
  return instrument;
}
