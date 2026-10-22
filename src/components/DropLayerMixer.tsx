import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { defaultDropVolumes, dropLayerIds, newDropRows } from "../piano/rosesDropMixer";
import { dropChordPresets, type DropChordPreset } from "../piano/rosesDropPresets";
import type { DropBackingSource } from "../piano/rosesDropAuditionEngine";
import type { DropDrum } from "../piano/rosesDropAuditionEngine";

type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; audioReady: boolean; startAudio: () => void; onPlayDrop?: () => void | Promise<void> };
const names = { lead: "HERE WITH ME LEAD", bass: "HERE WITH ME BASS", chords: "HERE WITH ME CHORDS / GUITAR / PAD", bonkChords: "KEYS 6–8 · BONK + FUTURE BASS", drums: "ROSES DROP DRUMS" };
export default function DropLayerMixer({ engine, clock, audioReady, startAudio, onPlayDrop }: Props) {
  const drop = clock?.drop, rows = drop?.rows ?? newDropRows();
  const roses = drop?.backingSource === "roses";
  const rowNames = {...names, bass:roses ? "ROSES DROP BASS" : names.bass, chords:roses ? "ORIGINAL ROSES DROP CHORDS" : names.chords};
  const loading = drop?.status === "loading";
  const queued = drop?.status === "running" && (clock?.measure ?? 37) < 37;
  return <section className="drop-layer-mixer sandbox-details" aria-label="Drop Layer Mixer">
    <div className="sandbox-control-line"><strong>DROP LAYER MIXER · BARS 37–44</strong><span role="status">{queued ? "QUEUED FOR BAR 37" : drop?.status.toUpperCase() ?? "IDLE"}</span></div>
    <div className="sandbox-control-line">
      <button className="practice-primary" disabled={!engine?.isReady() || loading} onClick={async () => { if (!audioReady) await startAudio(); if (onPlayDrop) await onPlayDrop(); else await engine?.playDrop(); }}>{loading ? "Loading drop samples…" : "Play Drop"}</button>
      <label>Drop backing <select aria-label="Drop backing" value={drop?.backingSource ?? "hwm"} onChange={event => engine?.setDropBackingSource(event.target.value as DropBackingSource)}><option value="hwm">Here With Me · E major</option><option value="roses">Roses · Original drop</option></select></label>
      {roses && <label>Original chord sound <select aria-label="Drop chord preset" value={drop?.chordPreset ?? "original"} onChange={event => engine?.setDropChordPreset(event.target.value as DropChordPreset)}>{dropChordPresets.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select></label>}
      <button onClick={() => engine?.reset(37)}>Stop</button><button onClick={() => engine?.reset(37)}>Return to bar 37</button>
      <button onClick={() => engine?.dropAllOn()}>All On</button><button onClick={() => engine?.dropMuteAll()}>Mute All</button><button onClick={() => engine?.resetDropVolumes()}>Reset volume levels</button>
    </div>
    <div className="drop-mixer-rows">{dropLayerIds.filter(id => roses || id !== "bonkChords").map(id => {
      const row = rows[id];
      const soloElsewhere = dropLayerIds.some(key => (roses || key !== "bonkChords") && key !== id && rows[key].enabled && rows[key].solo);
      const state = !row.enabled ? "DISABLED" : row.muted || soloElsewhere ? "MUTED" : queued ? "ARMED" : drop?.status === "running" ? "PLAYING" : drop?.status === "done" ? "DONE" : "READY";
      return <div className="drop-mixer-row" key={id}>
        <strong>{rowNames[id]}<small>{state}</small></strong>
        <label><input aria-label={`${rowNames[id]} enabled`} type="checkbox" checked={row.enabled} onChange={event => engine?.setDropRow(id, { enabled: event.target.checked })} /> Enable</label>
        <label>Volume <output>{Math.round(row.volume * 100)}%</output><input aria-label={`${rowNames[id]} volume`} type="range" min="0" max="1" step=".01" value={row.volume ?? defaultDropVolumes[id]} onChange={event => engine?.setDropRow(id, { volume: Number(event.target.value) })} /></label>
        <button aria-label={`Mute ${rowNames[id]}`} aria-pressed={row.muted} className={row.muted ? "selected" : ""} onClick={() => engine?.setDropRow(id, { muted: !row.muted })}>Mute</button>
        <button aria-label={`Solo ${rowNames[id]}`} aria-pressed={row.solo} className={row.solo ? "selected" : ""} onClick={() => engine?.setDropRow(id, { solo: !row.solo })}>Solo</button>
      </div>;
    })}</div>
    {roses && <><small>Original Roses bass and chords are restored, including the separate Keys 6–8 chord layer. Enable, mute or solo either chord sound to compare or combine them. Brighter / Punchier affects the Original Roses chord row.</small><div className="sandbox-control-line">{[0,1].map(index => <label key={index}>Chord layer {index === 0 ? "A" : "B"}<input aria-label={`Drop chord layer ${index === 0 ? "A" : "B"} volume`} type="range" min="0" max="1.5" step=".01" value={drop?.chordLevels[index] ?? (index === 0 ? .3981071115 : .9332544208)} onChange={event => engine?.setDropChordLevel(index,Number(event.target.value))}/></label>)}</div></>}
    <details><summary>Drum mutes</summary><div className="sandbox-control-line">
      {(["kick", "clap", "hat"] as DropDrum[]).map(kind => <label key={kind}><input aria-label={`Mute drop ${kind}`} type="checkbox" checked={drop?.drumMutes[kind] ?? false} onChange={event => engine?.muteDropDrum(kind, event.target.checked)} /> Mute {kind === "hat" ? "hi-hat" : kind}</label>)}
    </div></details>
    <small>Start from bar 1, Start Bar 25 and Start Bar 29 automatically enter this drop at bar 37 with these settings. Play Drop starts directly at 37. Full takes run at 100 BPM and finish after bar 44. Hi-hats enter at 41:1&amp;. Earlier instrument arming stays manual.</small>
    <small>E major / C♯ minor: the four-layer Here With Me lead stays available with either backing. Choose Here With Me for its transposed chords, guitar, pad and bass, or Roses for the original drop harmony. Roses drum samples and timing are unchanged. Live keys 1–8 remain independent.</small>
    <details><summary>Playback diagnostics</summary><small>Delayed note callbacks: {drop?.lateCallbacks ?? 0} · Largest delay: {Math.round(drop?.maxLatenessMs ?? 0)} ms. This checks scheduling delays; audio device interruptions may not appear here.</small></details>
    {drop?.error && <p className="practice-warning" role="alert">{drop.error}</p>}
  </section>;
}
