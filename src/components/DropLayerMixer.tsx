import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { defaultDropVolumes, dropLayerIds, newDropRows } from "../piano/rosesDropMixer";
import type { DropDrum } from "../piano/rosesDropAuditionEngine";
import { dropChordPresets, type DropChordPreset } from "../piano/rosesDropPresets";
import { dropLeadSounds, type DropLeadSound } from "../piano/recordedDropLeadEngine";

type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; audioReady: boolean; startAudio: () => void; onPlayDrop?: () => void | Promise<void> };
const names = { lead: "HERE WITH ME LEAD", bass: "ROSES DROP BASS", chords: "ORIGINAL ROSES DROP CHORDS", bonkChords: "KEYS 6–8 · BONK + FUTURE BASS", drums: "ROSES DROP DRUMS" };
export default function DropLayerMixer({ engine, clock, audioReady, startAudio, onPlayDrop }: Props) {
  const drop = clock?.drop, rows = drop?.rows ?? newDropRows();
  const loading = drop?.status === "loading";
  const queued = drop?.status === "running" && (clock?.measure ?? 37) < 37;
  return <section className="drop-layer-mixer sandbox-details" aria-label="Drop Layer Mixer">
    <div className="sandbox-control-line"><strong>DROP LAYER MIXER · BARS 37–44</strong><span role="status">{queued ? "QUEUED FOR BAR 37" : drop?.status.toUpperCase() ?? "IDLE"}</span></div>
    <div className="sandbox-control-line">
      <button className="practice-primary" disabled={!engine?.isReady() || loading} onClick={async () => { if (!audioReady) await startAudio(); if (onPlayDrop) await onPlayDrop(); else await engine?.playDrop(); }}>{loading ? "Loading drop samples…" : "Play Drop"}</button>
      <label>Original chord sound <select aria-label="Drop chord preset" value={drop?.chordPreset ?? "original"} onChange={event => engine?.setDropChordPreset(event.target.value as DropChordPreset)}>{dropChordPresets.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select></label>
      <label>Here With Me lead sound <select aria-label="Here With Me drop lead sound" value={drop?.leadSound ?? "original"} onChange={event => engine?.setDropLeadSound(event.target.value as DropLeadSound)}>{dropLeadSounds.map(sound => <option key={sound.value} value={sound.value}>{sound.label}</option>)}</select></label>
      <button onClick={() => engine?.reset(37)}>Stop</button><button onClick={() => engine?.reset(37)}>Return to bar 37</button>
      <button onClick={() => engine?.dropAllOn()}>All On</button><button onClick={() => engine?.dropMuteAll()}>Mute All</button><button onClick={() => engine?.resetDropVolumes()}>Reset volume levels</button>
    </div>
    <div className="drop-mixer-rows">{dropLayerIds.map(id => {
      const row = rows[id];
      const soloElsewhere = dropLayerIds.some(key => key !== id && rows[key].enabled && rows[key].solo);
      const state = !row.enabled ? "DISABLED" : row.muted || soloElsewhere ? "MUTED" : queued ? "ARMED" : drop?.status === "running" ? "PLAYING" : drop?.status === "done" ? "DONE" : "READY";
      return <div className="drop-mixer-row" key={id}>
        <strong>{names[id]}<small>{state}</small></strong>
        <label><input aria-label={`${names[id]} enabled`} type="checkbox" checked={row.enabled} onChange={event => engine?.setDropRow(id, { enabled: event.target.checked })} /> Enable</label>
        <label>Volume <output>{Math.round(row.volume * 100)}%</output><input aria-label={`${names[id]} volume`} type="range" min="0" max="1" step=".01" value={row.volume ?? defaultDropVolumes[id]} onChange={event => engine?.setDropRow(id, { volume: Number(event.target.value) })} /></label>
        <button aria-label={`Mute ${names[id]}`} aria-pressed={row.muted} className={row.muted ? "selected" : ""} onClick={() => engine?.setDropRow(id, { muted: !row.muted })}>Mute</button>
        <button aria-label={`Solo ${names[id]}`} aria-pressed={row.solo} className={row.solo ? "selected" : ""} onClick={() => engine?.setDropRow(id, { solo: !row.solo })}>Solo</button>
      </div>;
    })}</div>
    {drop?.leadSound === "loud-stabs" && <small>Recorded Loud Stabs follows the Here With Me lead MIDI with the actual Key-3 recording, including its chord harmonics. Shared Brightness: {drop.leadBrightness} Hz · keyup fade: {Math.round(drop.leadRelease * 1000)} ms. Adjust the same controls under “Keys 1–8 · Roses drop synth” in Sandbox. The lead row still controls volume, mute and solo.</small>}
    <small>Both chord sounds can play together. Enable either one on its own to compare; each has its own volume, mute and solo.</small>
    <small>Brighter / Punchier opens the chord filters, adds attack, shortens dry tails and adds rhythmic pumping with a light stereo echo. It changes the Original Roses Drop Chords row. Solo that row for a clear comparison.</small>
    <small>For live keyboard filter settings, open “Keys 1–8 · Roses drop synth” below and use the Brightness slider. The preset above controls Play Drop.</small>
    <details><summary>Drum mutes &amp; chord A/B balance (both sounds)</summary><div className="sandbox-control-line">
      {(["kick", "clap", "hat"] as DropDrum[]).map(kind => <label key={kind}><input aria-label={`Mute drop ${kind}`} type="checkbox" checked={drop?.drumMutes[kind] ?? false} onChange={event => engine?.muteDropDrum(kind, event.target.checked)} /> Mute {kind === "hat" ? "hi-hat" : kind}</label>)}
      {[0, 1].map(index => <label key={index}>Chord layer {index === 0 ? "A" : "B"}<input aria-label={`Drop chord layer ${index === 0 ? "A" : "B"} volume`} type="range" min="0" max="1.5" step=".01" value={drop?.chordLevels[index] ?? (index === 0 ? .3981071115 : .9332544208)} onChange={event => engine?.setDropChordLevel(index, Number(event.target.value))} /></label>)}
    </div></details>
    <small>Start from bar 1, Start Bar 25 and Start Bar 29 automatically enter this drop at bar 37 with these settings. Play Drop starts directly at 37. Full takes run at 100 BPM and finish after bar 44. Hi-hats enter at 41:1&amp;. Earlier instrument arming stays manual.</small>
    <small>Lead and bass use browser synths; chord tracks use local renders of the same synths; drums use source WAV samples. Original Roses harmony is preserved for comparison with the Here With Me melody.</small>
    <details><summary>Playback diagnostics</summary><small>Delayed note callbacks: {drop?.lateCallbacks ?? 0} · Largest delay: {Math.round(drop?.maxLatenessMs ?? 0)} ms. This checks scheduling delays; audio device interruptions may not appear here.</small></details>
    {drop?.error && <p className="practice-warning" role="alert">{drop.error}</p>}
  </section>;
}
