import scoreData from "./interstellar.song.json";
import { assistedEvents, type AssistedEvent } from "./assistedSong";
import { songGroups, type PracticeGroup, type PracticeSong } from "./practiceSong";

export type StudioGroup = PracticeGroup & { assistedEvent?: AssistedEvent };
export const interstellarSong = scoreData as unknown as PracticeSong;

/** The score stays intact; only the player-facing events for bars 9–13 change. */
export const interstellarPracticeGroups: StudioGroup[] = [
  ...songGroups(interstellarSong).filter(group => group.measure < 9 || group.measure > 13),
  ...assistedEvents.map(event => ({
    id: `assisted:${event.id}`,
    measure: event.bar,
    beat: event.beat,
    absoluteBeat: interstellarSong.measures[event.bar - 1].startBeat + event.beat,
    notes: interstellarSong.measures[event.bar - 1].notes.filter(note => note.hand === "right" && note.beat === event.beat && note.midi === event.liveMidi),
    pitches: [event.liveMidi],
    assistedEvent: event,
  })),
].sort((a, b) => a.absoluteBeat - b.absoluteBeat);
