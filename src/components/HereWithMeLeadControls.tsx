import type { RosesClockMode, RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";

type Props = {
  engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null;
  mode?: RosesClockMode; compact?: boolean; onRehearse?: (bar: 36 | 37) => void;
};
export default function HereWithMeLeadControls({ engine, clock, mode = "performance", compact, onRehearse }: Props) {
  const lead = clock?.lead;
  const active = lead?.status === "ARMED" || lead?.status === "PLAYING";
  const mixerOwnsLead = clock?.drop?.status === "running" || clock?.drop?.status === "paused";
  const late = !!clock && clock.status !== "idle" && clock.measure >= 37;
  return <section className="sandbox-details" aria-label="Here With Me drop lead">
    <strong aria-live="polite">HERE WITH ME LEAD — {mixerOwnsLead ? "MIXER CONTROLLED" : lead?.status ?? "OFF"}</strong>
    <div className="sandbox-control-line">
      <button disabled={!engine?.isReady() || active || late || mixerOwnsLead} onClick={() => engine?.armLead()}>Arm lead for bar 37</button>
      <button disabled={!active && lead?.status !== "DONE"} onClick={() => engine?.disarmLead()}>Disarm lead</button>
      <label>Lead volume <output>{Math.round((lead?.volume ?? .65) * 100)}%</output><input aria-label="Here With Me lead volume" type="range" min="0" max="1" step=".05" value={lead?.volume ?? .65} onChange={event => engine?.setLeadSettings({ volume: Number(event.target.value) })} /></label>
      <label>Lower lead <output>{Math.round((lead?.lower ?? .8) * 100)}%</output><input aria-label="Here With Me lower lead volume" type="range" min="0" max="1" step=".05" value={lead?.lower ?? .8} onChange={event => engine?.setLeadSettings({ lower: Number(event.target.value) })} /></label>
      <label><input type="checkbox" checked={lead?.muted ?? false} onChange={event => engine?.setLeadSettings({ muted: event.target.checked })} /> Mute lead</label>
      {!compact && <>{([36, 37] as const).map(bar => <button key={bar} disabled={!engine?.isReady()} onClick={() => onRehearse ? onRehearse(bar) : engine?.rehearseLead(bar, mode)}>Audition lead · bar {bar}</button>)}
        <button disabled={!clock || !["running", "paused"].includes(clock.status)} onClick={() => clock?.status === "paused" ? engine?.resume() : engine?.pause()}>{clock?.status === "paused" ? "Resume lead audition" : "Pause lead audition"}</button>
        <button onClick={() => engine?.reset()}>Stop lead audition</button></>}
    </div>
    {mixerOwnsLead ? <small>The Drop Layer Mixer controls the automatic lead for this take. Use its lead row for volume, mute and solo.</small> : !compact && <small>Arm before bar 37 · two phrases through bar 44 · auditions start at 100 BPM. Original pitches; harmony may clash with Roses.</small>}
  </section>;
}
