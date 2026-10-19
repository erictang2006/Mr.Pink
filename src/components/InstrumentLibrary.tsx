import { useRef, useState } from "react";
import { midiToToneName } from "../piano/noteMapping";
import { audioDuration, bundledRosesInstrument, exportManifest, importProjectManifest, inferredMidi, saveImportedInstrument, savedInstruments, type ImportedInstrument, type SampleDraft } from "../piano/sampleLibrary";
import { presetGroups, presetNames, presetSettings, validSynthSettings, type SynthPreset, type SynthSettings } from "../piano/synthEngine";

type Props = {
  instrumentId: string; onInstrument: (id: string) => void; settings: SynthSettings; onSettings: (settings: SynthSettings) => void;
  error: string; audioReady: boolean; startAudio: () => void; preview: (midi: number) => void;
};
const customKey = "stage-piano-roses-user-presets-v1";
const settingsKey = "stage-piano-roses-instrument-settings-v1";
type UserPreset = { id: string; name: string; settings: SynthSettings };
function readPresets(): UserPreset[] { try { const value = JSON.parse(localStorage.getItem(customKey) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
function readSettings(): Record<string, SynthSettings> { try { return JSON.parse(localStorage.getItem(settingsKey) || "{}"); } catch { return {}; } }
const controls: { key: Exclude<keyof SynthSettings, "preset">; name: string; min: number; max: number; step: number; format?: (n: number) => string }[] = [
  { key: "attack", name: "Attack", min: .001, max: 1, step: .001, format: n => `${Math.round(n * 1000)} ms` },
  { key: "decay", name: "Decay", min: .02, max: 2, step: .01, format: n => `${Math.round(n * 1000)} ms` },
  { key: "sustain", name: "Sustain", min: 0, max: 1, step: .01 },
  { key: "release", name: "Release", min: .05, max: 3, step: .01, format: n => `${Math.round(n * 1000)} ms` },
  { key: "cutoff", name: "Filter cutoff", min: 300, max: 16000, step: 100, format: n => `${Math.round(n)} Hz` },
  { key: "resonance", name: "Resonance", min: .1, max: 8, step: .1 },
  { key: "detune", name: "Detune", min: 0, max: 50, step: 1, format: n => `${n} cents` },
  { key: "chorus", name: "Chorus", min: 0, max: .5, step: .01 },
  { key: "reverb", name: "Reverb", min: 0, max: .5, step: .01 },
  { key: "delay", name: "Delay", min: 0, max: .4, step: .01 },
  { key: "volume", name: "Instrument volume", min: 0, max: 1, step: .01 },
];
const noteOptions = Array.from({ length: 85 }, (_, i) => i + 24);

export default function InstrumentLibrary({ instrumentId, onInstrument, settings, onSettings, error, audioReady, startAudio, preview }: Props) {
  const [imports, setImports] = useState<ImportedInstrument[]>(savedInstruments);
  const [presets, setPresets] = useState<UserPreset[]>(readPresets);
  const [drafts, setDrafts] = useState<SampleDraft[]>([]);
  const [name, setName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [message, setMessage] = useState("");
  const [slotA, setSlotA] = useState(() => localStorage.getItem("stage-piano-roses-ab-a") || "roses");
  const [slotB, setSlotB] = useState(() => localStorage.getItem("stage-piano-roses-ab-b") || "supersaw");
  const [defaultId, setDefaultId] = useState(() => localStorage.getItem("stage-piano-roses-default") || "roses");
  const manifestInput = useRef<HTMLInputElement>(null);
  const entries = [
    ...Object.keys(presetNames).map(id => ({ id, name: presetNames[id as SynthPreset] })),
    ...presets.map(item => ({ id: item.id, name: item.name })),
    ...[bundledRosesInstrument, ...imports].map(item => ({ id: item.id, name: item.name })),
  ];
  const select = (id: string) => {
    const custom = readPresets().find(item => item.id === id);
    const saved = readSettings()[id];
    const base = id in presetSettings ? presetSettings[id as SynthPreset] : custom?.settings ?? presetSettings.roses;
    onSettings(validSynthSettings(saved ?? base)); onInstrument(id);
  };
  const change = (key: Exclude<keyof SynthSettings, "preset">, value: number) => {
    const next = validSynthSettings({ ...settings, [key]: value });
    onSettings(next);
    try { localStorage.setItem(settingsKey, JSON.stringify({ ...readSettings(), [instrumentId]: next })); } catch { setMessage("Could not save sound settings in this browser."); }
  };
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    try {
      const next = await Promise.all([...files].map(async file => ({ file, rootMidi: inferredMidi(file.name), duration: await audioDuration(file) })));
      if (next.some(item => item.duration > 8)) throw new Error("Choose isolated note samples no longer than 8 seconds; musical loops cannot become chromatic instruments.");
      setDrafts(next); setMessage("");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not read the audio files."); }
  };
  const saveSamples = async () => {
    try {
      const instrument = await saveImportedInstrument(name, drafts);
      setImports(savedInstruments()); setDrafts([]); setName(""); select(instrument.id); setMessage(`${instrument.name} saved locally. Copy its files into public/instruments/${instrument.id}/ for project bundling.`);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not save samples. Browser storage may be full; use the project manifest workflow."); }
  };
  const savePreset = () => {
    if (!presetName.trim()) { setMessage("Enter a name for your preset."); return; }
    const item = { id: `user-${crypto.randomUUID()}`, name: presetName.trim(), settings };
    try { const next = [...presets, item]; localStorage.setItem(customKey, JSON.stringify(next)); setPresets(next); setPresetName(""); select(item.id); setMessage("Sound preset saved locally."); }
    catch { setMessage("Could not save the preset in this browser."); }
  };
  const option = (entry: { id: string; name: string }) => <option value={entry.id} key={entry.id}>{entry.name}</option>;
  const instrumentOptions = <>{presetGroups.map(group => <optgroup key={group.label} label={group.label}>{group.ids.map(id => option({ id, name: presetNames[id] }))}</optgroup>)}<optgroup label="Saved Synths">{presets.map(option)}</optgroup><optgroup label="Imported Instruments">{[bundledRosesInstrument, ...imports].map(option)}</optgroup></>;
  const named = (id: string) => entries.find(entry => entry.id === id)?.name ?? "Roses Future Bass Lead";
  const activeImport = [bundledRosesInstrument, ...imports].find(item => item.id === instrumentId);
  return <div className="instrument-library">
    <div className="sandbox-control-line"><label>Instrument <select value={entries.some(item => item.id === instrumentId) ? instrumentId : "roses"} onChange={event => select(event.target.value)}>{instrumentOptions}</select></label><span className="instrument-hint">{activeImport ? `${activeImport.samples.length} samples · Tone.Sampler fills missing notes` : "Polyphonic synth · physical mapping unchanged"}</span>{!audioReady && <button onClick={startAudio}>Enable audio</button>}{audioReady && <button onClick={() => preview(activeImport?.samples[0]?.rootMidi ?? 60)}>Preview note</button>}</div>
    {activeImport?.id === bundledRosesInstrument.id && <p className="instrument-hint">This 0.8-second processed E4 slice is useful for comparison, but cannot sustain the 2.4-second opening E4 note cleanly.</p>}
    {error && <p role="status">{error}</p>}
    <details className="sandbox-details"><summary>Sound design controls</summary><div className="instrument-sliders">{controls.map(control => <label key={control.key}>{control.name} <output>{control.format ? control.format(settings[control.key]) : control.key === "resonance" ? settings[control.key].toFixed(1) : `${Math.round(settings[control.key] * 100)}%`}</output><input type="range" min={control.min} max={control.max} step={control.step} value={settings[control.key]} onChange={event => change(control.key, Number(event.target.value))} /></label>)}</div><div className="sandbox-control-line"><label>Save current synth <input value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Preset name" /></label><button onClick={savePreset}>Save preset</button></div></details>
    <details className="sandbox-details"><summary>A/B compare and Roses default</summary><div className="sandbox-control-line"><label>A <select value={entries.some(item => item.id === slotA) ? slotA : "roses"} onChange={event => { setSlotA(event.target.value); localStorage.setItem("stage-piano-roses-ab-a", event.target.value); }}>{instrumentOptions}</select></label><button className={instrumentId === slotA ? "selected" : ""} onClick={() => select(slotA)}>Play A</button><label>B <select value={entries.some(item => item.id === slotB) ? slotB : "supersaw"} onChange={event => { setSlotB(event.target.value); localStorage.setItem("stage-piano-roses-ab-b", event.target.value); }}>{instrumentOptions}</select></label><button className={instrumentId === slotB ? "selected" : ""} onClick={() => select(slotB)}>Play B</button><button onClick={() => { localStorage.setItem("stage-piano-roses-default", instrumentId); setDefaultId(instrumentId); setMessage(`${named(instrumentId)} is your Roses default.`); }}>Save active as default</button><span className="instrument-hint">Default: {named(defaultId)}</span></div><p>Play the same physical keys in A, then B. The supplied 4-bar remake pad below is for manual reference listening only.</p><audio controls preload="none" src="/roses/original_intro_pad_bars_1_to_4.wav" aria-label="Supplied Roses intro pad reference" /></details>
    <details className="sandbox-details"><summary>Import note samples</summary><p>Choose individual notes only (WAV, MP3, OGG; up to 8 seconds each). Confirm each root pitch before saving. Keep the files for project bundling.</p><div className="sandbox-control-line"><label>Instrument name <input value={name} onChange={event => setName(event.target.value)} placeholder="My synth samples" /></label><label>Audio files <input type="file" accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg" multiple onChange={event => void addFiles(event.target.files)} /></label></div>{drafts.map((draft, index) => <div className="sample-row" key={`${draft.file.name}-${index}`}><span>{draft.file.name} · {draft.duration.toFixed(1)} s</span><label>Root note <select value={draft.rootMidi} onChange={event => setDrafts(drafts.map((item, i) => i === index ? { ...item, rootMidi: Number(event.target.value) } : item))}>{noteOptions.map(midi => <option key={midi} value={midi}>{midiToToneName(midi)}</option>)}</select></label><button onClick={() => { const url = URL.createObjectURL(draft.file); const audio = new Audio(url); audio.volume = .35; audio.onended = () => URL.revokeObjectURL(url); audio.onerror = () => URL.revokeObjectURL(url); void audio.play().catch(() => { URL.revokeObjectURL(url); setMessage(`Could not preview ${draft.file.name}.`); }); }}>Preview sample</button></div>)}<div className="sandbox-control-line"><button disabled={!drafts.length || !name.trim()} onClick={() => void saveSamples()}>Save sampled instrument</button>{activeImport && activeImport.id !== bundledRosesInstrument.id && <button onClick={() => exportManifest(activeImport)}>Export project manifest</button>}<button onClick={() => manifestInput.current?.click()}>Load project manifest</button><input ref={manifestInput} hidden type="file" accept=".json" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { const item = importProjectManifest(JSON.parse(await file.text())); setImports(savedInstruments()); select(item.id); setMessage(`Loaded project manifest: ${item.name}`); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Invalid manifest."); } }} /></div></details>
    {message && <p className="instrument-message" role="status">{message}</p>}
  </div>;
}
