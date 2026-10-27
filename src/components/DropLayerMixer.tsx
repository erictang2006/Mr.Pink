import { useEffect, useRef, useState } from "react";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { defaultDropVolumes, newDropRows } from "../piano/rosesDropMixer";
import { activeDropLayers } from "../piano/rosesDropAuditionEngine";
import { finalizedRosesDrop } from "../piano/rosesAudioSelection";
import type { DropDrum } from "../piano/rosesDropAuditionEngine";
import { recordedDropMaxVolume, validRecordedOffset } from "../piano/rosesRecordedDrop";

type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; audioReady: boolean; startAudio: () => void; onPlayDrop?: () => void | Promise<void> };
const names = { lead: "HERE WITH ME LEAD", bass: "HERE WITH ME BASS", chords: "HERE WITH ME CHORDS / GUITAR / PAD", bonkChords: "KEYS 6–8 · BONK + FUTURE BASS", drums: "ROSES DROP DRUMS", recorded: "Recorded Drop" };
export default function DropLayerMixer({ engine, clock, audioReady, startAudio, onPlayDrop }: Props) {
  const drop = clock?.drop, rows = drop?.rows ?? newDropRows();
  const roses = drop?.backingSource === "roses";
  const recorded = (drop?.backingSource ?? finalizedRosesDrop.value) === "recording";
  const offset = drop?.recordedOffsetMs ?? 0;
  const [offsetDraft, setOffsetDraft] = useState(String(offset));
  const editingOffset = useRef(false);
  useEffect(() => { if (!editingOffset.current) setOffsetDraft(String(offset)); }, [offset]);
  function commitOffset() {
    if (!editingOffset.current) return;
    editingOffset.current = false;
    const value = offsetDraft.trim() === "" ? NaN : Number(offsetDraft);
    const next = Number.isFinite(value) ? validRecordedOffset(value) : offset;
    setOffsetDraft(String(next));
    if (Number.isFinite(value)) engine?.setRecordedDropOffset(next);
  }
  const rowNames = {...names, chords:roses ? "ROSES DROP INSTRUMENTAL" : names.chords};
  const visibleLayers = activeDropLayers(drop?.backingSource ?? finalizedRosesDrop.value);
  const loading = drop?.status === "loading";
  const queued = drop?.status === "running" && (clock?.measure ?? 37) < 37;
  return <section className="drop-layer-mixer sandbox-details" aria-label="Drop Layer Mixer">
    <div className="sandbox-control-line"><strong>DROP LAYER MIXER · BARS 37–44</strong><span role="status">{queued ? "QUEUED FOR BAR 37" : drop?.status.toUpperCase() ?? "IDLE"}</span></div>
    <div className="sandbox-control-line">
      <button className="practice-primary" disabled={!engine?.isReady() || loading} onClick={async () => { if (!audioReady) await startAudio(); if (onPlayDrop) await onPlayDrop(); else await engine?.playDrop(); }}>{loading ? "Loading drop samples…" : "Play Drop"}</button>
      <label>Drop backing <select aria-label="Drop backing" value={drop?.backingSource ?? finalizedRosesDrop.value} onChange={() => engine?.setDropBackingSource(finalizedRosesDrop.value)}><option value={finalizedRosesDrop.value}>{finalizedRosesDrop.label}</option></select></label>
      <button onClick={() => engine?.reset(37)}>Stop</button><button onClick={() => engine?.reset(37)}>Return to bar 37</button>
      <button onClick={() => engine?.dropAllOn()}>All On</button><button onClick={() => engine?.dropMuteAll()}>Mute All</button><button onClick={() => engine?.resetDropVolumes()}>Reset volume levels</button>
    </div>
    {recorded && <div className="sandbox-control-line"><strong>ROSES — ORIGINAL RECORDING</strong><label>Recorded Drop Sync Offset <input aria-label="Recorded Drop Sync Offset" type="text" inputMode="numeric" value={offsetDraft} onFocus={event => { editingOffset.current = true; event.currentTarget.select(); }} onChange={event => setOffsetDraft(event.target.value)} onBlur={commitOffset} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") { event.preventDefault(); editingOffset.current = false; setOffsetDraft(String(offset)); event.currentTarget.blur(); }
    }} /> ms (−500 to +500)</label>{["running","paused"].includes(drop?.status ?? "") && offset !== drop?.activeRecordedOffsetMs && <small>Offset change applies on the next playback/restart.</small>}</div>}
    <div className="drop-mixer-rows">{visibleLayers.map(id => {
      const row = rows[id];
      const soloElsewhere = visibleLayers.some(key => key !== id && rows[key].enabled && rows[key].solo);
      const state = !row.enabled ? "DISABLED" : row.muted || soloElsewhere ? "MUTED" : queued ? "ARMED" : drop?.status === "running" ? "PLAYING" : drop?.status === "done" ? "DONE" : "READY";
      return <div className="drop-mixer-row" key={id}>
        <strong>{rowNames[id]}<small>{state}</small></strong>
        <label><input aria-label={`${rowNames[id]} enabled`} type="checkbox" checked={row.enabled} onChange={event => engine?.setDropRow(id, { enabled: event.target.checked })} /> Enable</label>
        <label>Volume <output>{Math.round(row.volume * 100)}%</output><input aria-label={id === "recorded" ? "Recorded Drop Volume" : `${rowNames[id]} volume`} type="range" min="0" max={id === "recorded" ? recordedDropMaxVolume : 1} step=".01" value={row.volume ?? defaultDropVolumes[id]} onChange={event => engine?.setDropRow(id, { volume: Number(event.target.value) })} /></label>
        <button aria-label={`Mute ${rowNames[id]}`} aria-pressed={row.muted} className={row.muted ? "selected" : ""} onClick={() => engine?.setDropRow(id, { muted: !row.muted })}>Mute</button>
        <button aria-label={`Solo ${rowNames[id]}`} aria-pressed={row.solo} className={row.solo ? "selected" : ""} onClick={() => engine?.setDropRow(id, { solo: !row.solo })}>Solo</button>
      </div>;
    })}</div>
    {roses && <small>Roses uses the approved punchy G♯ instrumental with subtle chord echo. Its drums, chords, bass and sub are combined in one recording; use the instrumental row for volume, mute or solo. The Here With Me lead remains separate.</small>}
    {recorded && <small>The supplied Roses instrumental WAV includes drums, bass, chords and effects. Enable HERE WITH ME LEAD above to add its existing four-layer melody in bars 37–44; it starts off and has separate volume, mute and solo controls. Other synth backing layers stay silent. Here With Me vocals retain their separate controls. Sync offset changes only the recording; playback ends at bar 45.</small>}
    {!roses && !recorded && <details><summary>Drum mutes</summary><div className="sandbox-control-line">
      {(["kick", "clap", "hat"] as DropDrum[]).map(kind => <label key={kind}><input aria-label={`Mute drop ${kind}`} type="checkbox" checked={drop?.drumMutes[kind] ?? false} onChange={event => engine?.muteDropDrum(kind, event.target.checked)} /> Mute {kind === "hat" ? "hi-hat" : kind}</label>)}
    </div></details>}
    <small>Start from bar 1, Start Bar 25 and Start Bar 29 automatically enter this drop at bar 37 with these settings. Play Drop starts directly at 37. Full takes run at 100 BPM and finish after bar 44. Earlier instrument arming stays manual.</small>
    {!recorded && <small>E major / C♯ minor: the four-layer Here With Me lead stays available with either backing. Choose Here With Me for its transposed chords, guitar, pad and bass, or Roses for the approved finished instrumental. Live keys 1–8 remain independent.</small>}
    <details><summary>Playback diagnostics</summary><small>Delayed note callbacks: {drop?.lateCallbacks ?? 0} · Largest delay: {Math.round(drop?.maxLatenessMs ?? 0)} ms. This checks scheduling delays; audio device interruptions may not appear here.</small></details>
    {drop?.error && <p className="practice-warning" role="alert">{drop.error}</p>}
  </section>;
}
