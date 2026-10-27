import { rosesManualBassKeys, type RosesBassPlaybackMode } from "../piano/rosesManualBass";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";

export default function RosesBassControls({ engine, clock }: { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null }) {
  const mode = clock?.bassPlaybackMode ?? "auto";
  const playing = clock?.status === "running" || clock?.status === "paused";
  return <div className="sandbox-control-line">
    <label>Bass / Sub · bars 13–20 <select aria-label="Bass / Sub playback" value={mode} disabled={!engine || playing} onChange={event => engine?.setBassPlaybackMode(event.target.value as RosesBassPlaybackMode)}><option value="auto">Automatic · N to arm</option><option value="manual">Manual keys</option></select></label>
    {mode === "manual" && <span>{rosesManualBassKeys.map(key => <span key={key.code}><kbd>{key.label}</kbd> {key.name} · </span>)}Hold to play bass + sub; release to stop. Automatic bass/sub is off. Buildup and drop stay unchanged.</span>}
    {mode === "auto" && <span><kbd>,</kbd> C♯3 · <kbd>.</kbd> A2 · <kbd>/</kbd> E2 · Visual only while armed automatic bass/sub plays in bars 13–20.</span>}
    {playing && <small>Stop playback to change Bass / Sub mode.</small>}
  </div>;
}
