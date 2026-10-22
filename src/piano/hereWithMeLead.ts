import source from "../../reference/here-with-me-drop-lead/lead-events-e-major.json";

export const leadStartBeat = 144;
export const leadEndBeat = 176;
export const leadEndBar = leadEndBeat / 4;
export const leadPpq = source.source_ppq;
// Keep the supplied reference intact; the current arrangement uses its first two phrases.
export const leadEvents = source.events.filter(event =>
  event.start_tick_relative_to_rose_bar37 < (leadEndBeat - leadStartBeat) * leadPpq,
).map(event => ({
  channel: event.track_channel,
  tick: event.start_tick_relative_to_rose_bar37,
  durationTicks: event.duration_ticks,
  midi: event.midi_pitch,
  velocity: event.velocity_raw / 127,
}));

/** Select exact source ticks inside this existing transport callback's sixteenth. */
export function leadEventsAtBeat(beat: number) {
  const tick = Math.round((beat - leadStartBeat) * leadPpq);
  return leadEvents.filter(event => event.tick >= tick && event.tick < tick + leadPpq / 4);
}
