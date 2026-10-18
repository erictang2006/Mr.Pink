import source from "./interstellar_assisted_bars_9_13.json";
import scoreData from "./interstellar.song.json";
import type { PracticeSong } from "./practiceSong";

export type AssistedEvent = {
  id: string;
  bar: number;
  beat: number;
  code: string;
  label: string;
  liveMidi: number;
  assistedMidi: number[];
  durationBeats: number;
};

function fraction(value: string): number {
  const parts = value.split("/");
  const top = Number(parts[0]);
  const bottom = Number(parts[1] ?? "1");
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0)
    throw Error(`Invalid assisted score beat: ${value}`);
  return top / bottom;
}

const song = scoreData as unknown as PracticeSong;
export const assistedEvents: AssistedEvent[] = source.bars.flatMap(bar => {
  const measure = song.measures[bar.bar - 1];
  if (!measure || bar.bar < 9 || bar.bar > 13 || bar.events.length !== 12)
    throw Error(`Unexpected assisted measure ${bar.bar}`);
  return bar.events.map((event, index) => {
    const beat = fraction(event.beat) - 1;
    const durationBeats = fraction(event.durationBeats);
    const binding = source.keyboardMapping[event.physicalKey as keyof typeof source.keyboardMapping];
    if (!binding || binding.midi !== event.liveMidi || binding.label !== event.displayKey)
      throw Error(`Assisted mapping mismatch at bar ${bar.bar}, event ${index + 1}`);
    if (!measure.notes.some(note => note.hand === "right" && note.midi === event.liveMidi && note.beat === beat))
      throw Error(`Assisted live note differs from MuseScore at bar ${bar.bar}, beat ${event.beat}`);
    for (const midi of event.assistedMidi)
      if (!measure.notes.some(note => note.hand === "left" && note.midi === midi && note.beat === beat))
        throw Error(`Assisted note differs from MuseScore at bar ${bar.bar}, beat ${event.beat}`);
    return { id: `${bar.bar}:${index}`, bar: bar.bar, beat, code: event.physicalKey,
      label: event.displayKey, liveMidi: event.liveMidi, assistedMidi: event.assistedMidi,
      durationBeats };
  });
});

if (assistedEvents.length !== 60)
  throw Error(`Expected 60 assisted events, found ${assistedEvents.length}`);
