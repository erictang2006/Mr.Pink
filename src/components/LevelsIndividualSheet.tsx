import type { RefObject } from 'react';
import { levelsSong, type LevelsInput } from '../piano/levels';
import { levelsEMajor, levelsPracticeHand, levelsRightHandSequence } from '../piano/levelsRealPiano';
import { midiToName } from '../piano/noteMapping';
import type { SongMeasure } from '../piano/practiceSong';

/** Allocate overlapping notes to separate rows; duration and ties stay score-exact. */
export function levelsNoteRows(bar: SongMeasure, hand?: 'right' | 'left') {
  const ends: number[] = [];
  return bar.notes.filter(note => !hand || levelsPracticeHand(note.midi) === hand).sort((a, b) => a.beat - b.beat || b.midi - a.midi).map(note => {
    let row = ends.findIndex(end => end <= note.beat);
    if (row < 0) row = ends.length;
    ends[row] = note.beat + note.duration;
    return { ...note, row };
  });
}

export function levelsHandRests(bar: SongMeasure, hand: 'right' | 'left') {
  const rests: { beat: number; duration: number }[] = [];
  let end = 0;
  for (const note of levelsNoteRows(bar, hand)) {
    if (note.beat > end) rests.push({ beat: end, duration: note.beat - end });
    end = Math.max(end, note.beat + note.duration);
  }
  if (end < bar.beats) rests.push({ beat: end, duration: bar.beats - end });
  return rests;
}

type Props = {
  scoreRef: RefObject<HTMLDivElement | null>; onScroll: (source: HTMLDivElement) => void;
  measure: number; groups: LevelsInput[]; expectedIds: string[]; collected: number[]; active: number[];
  matched: string[]; finished: boolean; timed: boolean; playhead: number;
  showUpcoming: boolean; seek: (bar: number) => void; real: boolean;
};

export default function LevelsIndividualSheet({ scoreRef, onScroll, measure, groups, expectedIds, collected, active, matched, finished, timed, playhead, showUpcoming, seek, real }: Props) {
  return <section className="practice-sheet levels-individual-sheet" aria-label="Individual note keybinds">
    <div className="practice-sheet-top"><span>INDIVIDUAL NOTE KEYBINDS · E MAJOR</span><span>{real ? 'REAL PIANO ACTIVE' : 'REFERENCE · SELECT REAL PIANO TO PLAY'}</span></div>
    <div className="levels-hand-reference"><span>RIGHT HAND</span><code>{levelsRightHandSequence}</code><span>LEFT HAND · remaining keys</span></div>
    <div className="practice-measures" ref={scoreRef} onScroll={event => onScroll(event.currentTarget)}>
      {levelsSong.measures.map(bar => <div key={bar.number} className={`practice-measure ${bar.number === measure ? 'is-current' : ''} ${bar.number < measure ? 'is-past' : ''}`}>
        <button className="practice-measure-head" onClick={() => seek(bar.number)}><b>{String(bar.number).padStart(2, '0')}</b><span>Individual notes · {bar.beats} beats</span></button>
        {(['right', 'left'] as const).map(hand => <div className={`levels-hand-sheet levels-hand-${hand}`} key={hand}>
        <div className="levels-hand-heading">{hand === 'right' ? 'RIGHT HAND' : 'LEFT HAND'}</div>
        <div className="levels-individual-lane" aria-label={`${hand} hand · measure ${bar.number}`}>

          {groups.filter(group => group.measure === bar.number && group.pitches.some(pitch => levelsPracticeHand(pitch) === hand)).map(group => <span key={group.id}
            className={`levels-chord-guide ${real && !finished && expectedIds.includes(group.id) ? 'is-expected' : ''}`}
            style={{ left: `${group.beat / bar.beats * 100}%` }} title={`Simultaneous: ${group.pitches.map(midiToName).join(' + ')}`} />)}
          {levelsNoteRows(bar, hand).map((note, i) => {
            const label = levelsEMajor.bindings.find(binding => binding.midi === note.midi)?.label ?? '?';
            const id = `${bar.number}:${note.beat}`;
            const isExpected = real && !finished && !note.tieFromPrevious && expectedIds.includes(id);
            const hidden = !showUpcoming && bar.number > measure;
            return <button key={i} className={`levels-individual-note ${isExpected ? 'is-expected' : ''} ${real && active.includes(note.midi) && bar.number === measure ? 'is-held' : ''} ${matched.includes(id) ? 'is-done' : ''} ${isExpected && collected.includes(note.midi) ? 'is-collected' : ''}`}
              style={{ left: `${note.beat / bar.beats * 100}%`, top: `${note.row * 33 + 5}px`, width: `${Math.min(note.duration, bar.beats - note.beat) / bar.beats * 100}%` }}
              title={`${label} · ${midiToName(note.midi)} · ${hand} hand · beat ${note.beat + 1} · ${note.duration} beats${note.tieFromPrevious ? ' · tied from previous bar, keep holding' : ''}${note.tieToNext ? ' · hold into next bar' : ''}`}
              onClick={() => seek(bar.number)}>
              <strong>{hidden ? '·' : `${note.tieFromPrevious ? '↪ ' : ''}${label}${note.tieToNext ? ' →' : ''}`}</strong>
              <small>{hidden ? '·' : midiToName(note.midi)}</small>
            </button>;
          })}
          {!levelsNoteRows(bar, hand).length && <span className="levels-empty">REST · {bar.beats} BEATS</span>}
          {levelsHandRests(bar, hand).map((rest, i) => <span key={`rest:${i}`} className="levels-individual-rest" style={{ left: `${rest.beat / bar.beats * 100}%`, width: `${rest.duration / bar.beats * 100}%`, bottom: 2 }} title={`${hand} hand rest · ${rest.duration} beats`}>—</span>)}
          {timed && playhead >= bar.startBeat && playhead < bar.startBeat + bar.beats && <span className="practice-playhead" style={{ left: `${(playhead - bar.startBeat) / bar.beats * 100}%` }} />}
        </div>
        </div>)}
        <div className="practice-beats">{Array.from({ length: bar.beats }, (_, beat) => <span key={beat} style={{ left: `${beat / bar.beats * 100}%` }}>{beat + 1}</span>)}</div>
      </div>)}
    </div>
  </section>;
}
