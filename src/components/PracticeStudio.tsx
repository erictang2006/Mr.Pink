import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import PianoCanvas from "./PianoCanvas";
import AssistedPractice from "./AssistedPractice";
import SustainSettings, { type SustainSettingsValue } from "./SustainSettings";
import InterstellarAudioSettings from "./InterstellarAudioSettings";
import { assistedInterstellarMap, interstellarMap } from "../piano/profiles";
import { assistedEvents } from "../piano/assistedSong";
import { interstellarPracticeGroups, interstellarSong } from "../piano/interstellarPractice";
import type { InterstellarMix } from "../piano/interstellarMix";
import type { LiveNotes } from "../piano/liveNotes";
import type { AssistedEvent } from "../piano/assistedSong";
import { midiToName, type KeyboardMap } from "../piano/noteMapping";
import {
  beatAtSeconds,
  bindingsForPitch,
  secondsAtBeat,
} from "../piano/practiceSong";
import type { InputSnapshot } from "../piano/keyboardInput";
import type { SongId } from "./SandboxMode";

const song = interstellarSong;
type NoteHandler = (midi: number, code: string, at: number) => void;
type Props = {
  map: KeyboardMap;
  snapshot: InputSnapshot;
  soundingPitches: number[];
  audioReady: boolean;
  startAudio: () => void;
  selectProfile: (id: string) => void;
  profiles: KeyboardMap[];
  onNoteRef: MutableRefObject<NoteHandler | null>;
  onUnmappedRef: MutableRefObject<((code: string, at: number) => void) | null>;
  onExit: () => void;
  sustainSettings: SustainSettingsValue;
  setSustainSettings: (value: SustainSettingsValue) => void;
  sustainActive: boolean;
  showAssistedNotes: boolean;
  setShowAssistedNotes: (value: boolean) => void;
  liveNotes: LiveNotes;
  onMeasureChange: (measure: number) => void;
  triggerAssisted: (event: AssistedEvent) => void;
  resetAssisted: () => void;
  interstellarMix: InterstellarMix;
  setInterstellarMix: (value: InterstellarMix) => void;
  onSongChange: (song: SongId) => void;
  onSandbox: () => void;
};
type Mode = "step" | "timed";
type Labels = "computer" | "piano" | "both" | "none";
const groups = interstellarPracticeGroups;
const preference = (key: string, fallback: string) => {
  try { return localStorage.getItem(`stage-piano-practice-${key}`) ?? fallback; }
  catch { return fallback; }
};
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export default function PracticeStudio(props: Props) {
  const [assisted, setAssisted] = useState(() => new URLSearchParams(window.location.search).get("view") === "assisted");
  const priorProfile = useRef(props.map.id === assistedInterstellarMap.id ? "interstellar-roblox-aligned" : props.map.id);
  function enterAssisted() {
    priorProfile.current = props.map.id;
    props.selectProfile(assistedInterstellarMap.id);
    setAssisted(true);
  }
  function exitAssisted() {
    props.resetAssisted();
    props.selectProfile(priorProfile.current);
    setAssisted(false);
  }
  return assisted
    ? <AssistedPractice {...props} onExit={() => { exitAssisted(); props.onExit(); }} onExitAssisted={exitAssisted} />
    : <RegularPractice {...props} onEnterAssisted={enterAssisted} />;
}

function RegularPractice({ map, snapshot, soundingPitches, audioReady, startAudio, selectProfile, profiles, onNoteRef, onExit, onEnterAssisted, sustainSettings, setSustainSettings, sustainActive, onMeasureChange, triggerAssisted, resetAssisted, showAssistedNotes, setShowAssistedNotes, interstellarMix, setInterstellarMix, onSongChange, onSandbox }: Props & { onEnterAssisted: () => void }) {
  const [mode, setMode] = useState<Mode>(() => preference("mode", "step") === "timed" ? "timed" : "step");
  const [speed, setSpeed] = useState(() => clamp(Number(preference("speed", "75")) || 75, 25, 125));
  const [tolerance, setTolerance] = useState(() => clamp(Number(preference("tolerance", "180")) || 180, 50, 500));
  const [chordTolerance, setChordTolerance] = useState(() => clamp(Number(preference("chord", "350")) || 350, 100, 1500));
  const [loopStart, setLoopStart] = useState(1);
  const [loopEnd, setLoopEnd] = useState(30);
  const [loopPause, setLoopPause] = useState(600);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [countIn, setCountIn] = useState(false);
  const [upcoming, setUpcoming] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [labels, setLabels] = useState<Labels>(() => {
    const saved = preference("labels", "computer");
    return (["computer", "piano", "both", "none"].includes(saved) ? saved : "computer") as Labels;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [collected, setCollected] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const firstChordAt = useRef(0);
  const scoreSeconds = useRef(0);
  const clockStart = useRef(0);
  const scoreRef = useRef<HTMLDivElement>(null);
  const loopTimer = useRef<number | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const countTimer = useRef<number | null>(null);
  const priorProfile = useRef(map.id === assistedInterstellarMap.id ? interstellarMap.id : map.id);
  const acceptedAssisted = useRef(new Set<string>());

  const firstIndex = useMemo(() => Math.max(0, groups.findIndex(group => group.measure >= loopStart)), [loopStart]);
  const lastIndex = useMemo(() => {
    const next = groups.findIndex(group => group.measure > loopEnd);
    return next < 0 ? groups.length : next;
  }, [loopEnd]);
  const current = groups[currentIndex] ?? groups[0];
  useEffect(() => { onMeasureChange(current?.measure ?? 1); }, [current?.measure, onMeasureChange]);
  useEffect(() => {
    const inAssistedBars = !!current && current.measure >= 9 && current.measure <= 13;
    if (inAssistedBars && map.id !== assistedInterstellarMap.id) {
      priorProfile.current = map.id;
      selectProfile(assistedInterstellarMap.id);
    } else if (!inAssistedBars && map.id === assistedInterstellarMap.id) {
      selectProfile(priorProfile.current);
    }
  }, [current?.measure, map.id, selectProfile]);
  const expected = mode === "step" ? finished ? [] : current?.pitches ?? [] : groups.filter(group =>
    Math.abs(secondsAtBeat(song, group.absoluteBeat) - secondsAtBeat(song, playhead)) * 1000 <= tolerance
  ).flatMap(group => group.pitches);
  const completed = mode === "step" ? collected : current?.pitches.filter(midi => matched.includes(`${current.id}:${midi}`)) ?? [];
  const unmapped = song.pitches.filter(midi => bindingsForPitch(map, midi).length === 0);
  const alternatives = song.pitches.filter(midi => bindingsForPitch(map, midi).length > 1);
  const [preferred, setPreferred] = useState<Record<number, string>>({});
  const preferredLabels = useMemo(() => Object.fromEntries(song.pitches.map(midi => [midi,
    bindingsForPitch(map, midi).find(option => option.id === preferred[midi])?.label ?? bindingsForPitch(map, midi)[0]?.label ?? "",
  ])), [map, preferred]);
  const visibleLabels = current?.assistedEvent
    ? { ...preferredLabels, ...Object.fromEntries(assistedEvents.map(event => [event.liveMidi, event.label])) }
    : preferredLabels;

  useEffect(() => {
    if (currentIndex < firstIndex || currentIndex >= lastIndex) seek(loopStart);
  }, [firstIndex, lastIndex, loopStart]);
  useEffect(() => {
    if (mode !== "timed" && countTimer.current !== null) {
      clearInterval(countTimer.current);
      countTimer.current = null;
      setCountdown(0);
    }
  }, [mode]);

  useEffect(() => {
    for (const [key, value] of [["mode", mode], ["speed", speed], ["tolerance", tolerance], ["chord", chordTolerance], ["labels", labels]] as const) {
      try { localStorage.setItem(`stage-piano-practice-${key}`, String(value)); } catch { /* storage unavailable */ }
    }
  }, [mode, speed, tolerance, chordTolerance, labels]);

  useEffect(() => {
    scoreRef.current?.querySelector(`[data-measure="${current?.measure}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [current?.measure]);

  useEffect(() => {
    if (!playing || mode !== "timed") return;
    let frame = 0;
    const tick = () => {
      const elapsed = scoreSeconds.current + (performance.now() - clockStart.current) / 1000 * speed / 100;
      const beat = beatAtSeconds(song, elapsed);
      setPlayhead(beat);
      const next = groups.findIndex((group, index) => index >= firstIndex && index < lastIndex && group.absoluteBeat >= beat);
      setCurrentIndex(next < 0 ? Math.max(firstIndex, lastIndex - 1) : next);
      const endBeat = song.measures[loopEnd - 1].startBeat + song.measures[loopEnd - 1].beats;
      if (beat >= endBeat) {
        setPlaying(false);
        if (loopEnabled) {
          loopTimer.current = window.setTimeout(() => {
            loopTimer.current = null;
            resetAssisted();
            setCurrentIndex(firstIndex);
            setMatched([]);
            acceptedAssisted.current.clear();
            setWrongCount(0);
            setPlayhead(song.measures[loopStart - 1].startBeat);
            scoreSeconds.current = secondsAtBeat(song, song.measures[loopStart - 1].startBeat);
            clockStart.current = performance.now();
            setPlaying(true);
          }, loopPause);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    clockStart.current = performance.now();
    frame = requestAnimationFrame(tick);
    return () => {
      scoreSeconds.current += (performance.now() - clockStart.current) / 1000 * speed / 100;
      cancelAnimationFrame(frame);
    };
  }, [playing, mode, speed, firstIndex, lastIndex, loopEnd, loopStart, loopEnabled, loopPause, resetAssisted]);

  useEffect(() => {
    onNoteRef.current = (midi, code, at) => {
      if (!audioReady || countdown > 0 || unmapped.length > 0 || finished || loopTimer.current !== null) return;
      if (mode === "step") {
        const group = groups[currentIndex];
        if (!group) return;
        if (!group.pitches.includes(midi) || (group.assistedEvent && group.assistedEvent.code !== code)) {
          setWrong([midi]);
          if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
          wrongTimer.current = window.setTimeout(() => setWrong([]), 450);
          return;
        }
        if (group.assistedEvent) {
          if (acceptedAssisted.current.has(group.id)) return;
          acceptedAssisted.current.add(group.id);
          triggerAssisted(group.assistedEvent);
        }
        const old = at - firstChordAt.current <= chordTolerance ? collected : [];
        const next = [...new Set([...old, midi])];
        if (old.length === 0) firstChordAt.current = at;
        setCollected(next);
        if (group.pitches.every(pitch => next.includes(pitch))) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= lastIndex) {
            if (loopEnabled) {
              loopTimer.current = window.setTimeout(() => {
                loopTimer.current = null;
                resetAssisted(); acceptedAssisted.current.clear();
                setCurrentIndex(firstIndex); setCollected([]); firstChordAt.current = 0;
              }, loopPause);
            } else setFinished(true);
          } else {
            setCurrentIndex(nextIndex);
            setCollected([]);
            firstChordAt.current = 0;
          }
        }
        return;
      }
      if (!playing) return;
      const scoreTime = scoreSeconds.current + (at - clockStart.current) / 1000 * speed / 100;
      const firstPendingAssisted = groups.slice(firstIndex, lastIndex).find(group =>
        group.assistedEvent && !acceptedAssisted.current.has(group.id) &&
        secondsAtBeat(song, group.absoluteBeat) >= scoreTime - tolerance / 1000
      );
      const candidate = groups.slice(firstIndex, lastIndex)
        .filter(group => group.pitches.includes(midi) && (!group.assistedEvent || (group.id === firstPendingAssisted?.id && group.assistedEvent.code === code)) && !matched.includes(`${group.id}:${midi}`) && !acceptedAssisted.current.has(group.id))
        .map(group => ({ group, distance: Math.abs(secondsAtBeat(song, group.absoluteBeat) - scoreTime) * 1000 }))
        .filter(item => item.distance <= tolerance)
        .sort((a, b) => a.distance - b.distance)[0];
      if (candidate) {
        if (candidate.group.assistedEvent) {
          acceptedAssisted.current.add(candidate.group.id);
          triggerAssisted(candidate.group.assistedEvent);
        }
        setMatched(previous => [...previous, `${candidate.group.id}:${midi}`]);
      }
      else {
        setWrongCount(value => value + 1);
        setWrong([midi]);
        if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
        wrongTimer.current = window.setTimeout(() => setWrong([]), 450);
      }
    };
    return () => { onNoteRef.current = null; };
  }, [audioReady, mode, currentIndex, collected, chordTolerance, firstIndex, lastIndex, loopEnabled, loopPause, playing, matched, speed, tolerance, countdown, unmapped.length, finished, onNoteRef, triggerAssisted, resetAssisted]);

  useEffect(() => () => {
    if (loopTimer.current !== null) { clearTimeout(loopTimer.current); loopTimer.current = null; }
    if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
    if (countTimer.current !== null) clearInterval(countTimer.current);
  }, []);

  function seek(measure: number) {
    resetAssisted(); acceptedAssisted.current.clear();
    if (loopTimer.current !== null) { clearTimeout(loopTimer.current); loopTimer.current = null; }
    if (countTimer.current !== null) { clearInterval(countTimer.current); countTimer.current = null; }
    setCountdown(0);
    const index = groups.findIndex(group => group.measure >= measure);
    setPlaying(false);
    setFinished(false);
    setCurrentIndex(index < 0 ? groups.length - 1 : index);
    setCollected([]); setMatched([]); setWrong([]); setWrongCount(0); firstChordAt.current = 0;
    const beat = song.measures[measure - 1].startBeat;
    setPlayhead(beat);
    scoreSeconds.current = secondsAtBeat(song, beat);
  }
  function restart() { seek(current?.measure ?? loopStart); }
  function reset() { seek(loopStart); }
  function switchMode(next: Mode) { if (next !== mode) { seek(current?.measure ?? loopStart); setMode(next); } }
  function toggleTimed() {
    if (countdown > 0) return;
    if (playing) { setPlaying(false); return; }
    if (!countIn) { setPlaying(true); return; }
    setCountdown(3);
    let remaining = 3;
    countTimer.current = window.setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining === 0) { if (countTimer.current !== null) clearInterval(countTimer.current); countTimer.current = null; setPlaying(true); }
    }, 60000 / (song.measures[current?.measure - 1]?.tempoBpm ?? 100));
  }
  function label(midi: number) {
    const options = bindingsForPitch(map, midi);
    return options.find(option => option.id === preferred[midi])?.label ?? options[0]?.label ?? `?${midi}`;
  }
  const totalTargets = groups.slice(firstIndex, lastIndex).reduce((sum, group) => sum + group.pitches.length, 0);
  const missed = groups.slice(firstIndex, lastIndex).reduce((count, group) => count + group.pitches.filter(midi =>
    !matched.includes(`${group.id}:${midi}`) && secondsAtBeat(song, group.absoluteBeat) < secondsAtBeat(song, playhead) - tolerance / 1000
  ).length, 0);
  const accuracy = matched.length + missed + wrongCount ? Math.round(matched.length / (matched.length + missed + wrongCount) * 100) : 100;

  return <main className="practice-studio">
    <header className="practice-header">
      <div><span className="practice-overline">STAGE PIANO / PRACTICE</span><h1>{song.title}</h1><span>{song.measureCount} measures · {song.measures[0].timeSignature.join("/")} · physical keyboard</span></div>
      <div className="practice-header-actions">
        {!audioReady && <button className="practice-primary" onClick={startAudio}>Enable piano audio</button>}
        <button onClick={onEnterAssisted}>Assisted bars 9–13</button>
        <button onClick={onExit}>Back to piano</button>
      </div>
    </header>
    <section className="practice-sheet" aria-label="Interactive keyboard sheet">
      <div className="practice-sheet-top"><div><strong>KEYBOARD SHEET</strong><span>Measure {current?.measure ?? 1} / 30 · Beat {((playhead || current?.absoluteBeat || 0) - song.measures[(current?.measure ?? 1) - 1].startBeat + 1).toFixed(1)}</span></div><span>{mode === "step" ? "Play the highlighted notes to advance" : playing ? "Timeline running" : "Timeline paused"}</span></div>
      <div className="practice-measures" ref={scoreRef}>
        {song.measures.map(measure => {
          const measureGroups = groups.filter(group => group.measure === measure.number);
          const isPast = measure.number < (current?.measure ?? 1);
          const isHidden = !upcoming && measure.number > (current?.measure ?? 1);
          return <div className={`practice-measure ${isPast ? "is-past" : ""} ${measure.number === current?.measure ? "is-current" : ""}`} data-measure={measure.number} key={measure.number}>
            <button className="practice-measure-head" onClick={() => seek(measure.number)}><b>{String(measure.number).padStart(2, "0")}</b><span>{measure.timeSignature.join("/")} · {Math.round(measure.tempoBpm)} BPM</span></button>
            {measure.number >= 9 && measure.number <= 13 ? <div className="assisted-fingering-grid practice-assisted-grid">
              {measureGroups.map(group => <button key={group.id} className={`assisted-event ${group.id === current?.id && !finished ? "is-active" : ""} ${group.absoluteBeat < (mode === "step" ? current?.absoluteBeat ?? 0 : playhead) ? "is-done" : ""}`} onClick={() => seek(measure.number)} title={`Beat ${group.beat + 1} · ${midiToName(group.pitches[0])}`}>
                <strong>{isHidden ? "·" : group.assistedEvent?.label}</strong>
              </button>)}
            </div> : <div className="practice-note-lanes">
              {(["right", "left"] as const).map(hand => <div className="practice-lane" key={hand}>
                <span className="practice-hand">{hand === "right" ? "R" : "L"}</span>
                {measureGroups.filter(group => group.notes.some(note => note.hand === hand)).map(group => {
                  const notes = group.notes.filter(note => note.hand === hand);
                  const active = group.id === current?.id;
                  const finished = group.absoluteBeat < (mode === "step" ? current?.absoluteBeat ?? 0 : playhead);
                  return <button key={group.id} className={`practice-token ${active ? "is-active" : ""} ${finished ? "is-done" : ""}`} style={{ left: `${group.beat / measure.beats * 100}%` }} onClick={() => seek(measure.number)} title={`${notes.map(note => midiToName(note.midi)).join(" + ")} · ${notes[0].duration} beats`}>
                    {isHidden ? "·" : `[${notes.map(note => label(note.midi)).join("")}]`}
                  </button>;
                })}
                {measure.rests.filter(rest => rest.hand === hand).map((rest, index) => <span className="practice-rest" style={{ left: `${rest.beat / measure.beats * 100}%` }} title={`Rest ${rest.duration} beats`} key={index}>—</span>)}
              </div>)}
              {mode === "timed" && playhead >= measure.startBeat && playhead <= measure.startBeat + measure.beats && <span className="practice-playhead" style={{ left: `${(playhead - measure.startBeat) / measure.beats * 100}%` }} />}
            </div>}
            <div className="practice-beats">{Array.from({ length: measure.timeSignature[0] }, (_, i) => <span key={i} style={{ left: `${i / measure.beats * 100}%` }}>{i + 1}</span>)}</div>
          </div>;
        })}
      </div>
      <div className="practice-prompt"><span>{finished ? "DONE" : "NEXT"}</span><strong>{finished ? "Section complete" : current?.assistedEvent ? current.assistedEvent.label : current ? `[${current.pitches.map(label).join("")}]` : "Finished"}</strong><small>{finished ? "Restart or choose another measure" : current?.assistedEvent ? `${midiToName(current.assistedEvent.liveMidi)} · left hand follows your press` : current?.pitches.map(midiToName).join(" · ")}</small>{wrong.length > 0 && <em>Wrong pitch: {wrong.map(midiToName).join(", ")}</em>}</div>
    </section>
    <section className="practice-controls" aria-label="Practice controls">
      <div className="practice-control-row">
        <label>Song<select value="interstellar" onChange={event => onSongChange(event.target.value as SongId)}><option value="interstellar">Interstellar — imported score</option><option value="levels">Levels — Avicii</option><option value="rush-e">Rush E — piano preset</option><option value="roses">Roses — The Chainsmokers</option></select></label>
        <label>Mapping<select value={map.id} onChange={event => selectProfile(event.target.value)} disabled={!!current?.assistedEvent}>{profiles.filter(profile => profile.id !== assistedInterstellarMap.id || !!current?.assistedEvent).map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label>
        <div className="practice-segment"><button className={mode === "step" ? "selected" : ""} onClick={() => switchMode("step")}>Step</button><button className={mode === "timed" ? "selected" : ""} onClick={() => switchMode("timed")}>Timed</button><button onClick={onSandbox}>Sandbox</button></div>
        {mode === "timed" && <button className="practice-primary" onClick={toggleTimed} disabled={!audioReady || unmapped.length > 0}>{playing ? "Pause" : "Start"}</button>}
        <button onClick={restart}>Restart measure</button><button onClick={reset}>Reset session</button>
      </div>
      <div className="practice-control-row">
        <label>Speed <output>{speed}%</output><input type="range" min="25" max="125" step="5" value={speed} onChange={event => setSpeed(Number(event.target.value))} disabled={mode !== "timed"} /></label>
        <label>Timing ±<output>{tolerance} ms</output><input type="range" min="50" max="500" step="10" value={tolerance} onChange={event => setTolerance(Number(event.target.value))} disabled={mode !== "timed"} /></label>
        <label>Chord window <output>{chordTolerance} ms</output><input type="range" min="100" max="1500" step="50" value={chordTolerance} onChange={event => setChordTolerance(Number(event.target.value))} disabled={mode !== "step"} /></label>
        <label>Loop <input type="checkbox" checked={loopEnabled} onChange={event => setLoopEnabled(event.target.checked)} /></label>
        <label>From <input className="practice-number" type="number" min="1" max={loopEnd} value={loopStart} onChange={event => setLoopStart(clamp(Number(event.target.value) || 1, 1, loopEnd))} /></label>
        <label>To <input className="practice-number" type="number" min={loopStart} max="30" value={loopEnd} onChange={event => setLoopEnd(clamp(Number(event.target.value) || 30, loopStart, 30))} /></label>
        <label>Pause <select value={loopPause} onChange={event => setLoopPause(Number(event.target.value))}><option value="0">0 s</option><option value="600">0.6 s</option><option value="1500">1.5 s</option><option value="3000">3 s</option></select></label>
        {mode === "timed" && <label>Count-in <input type="checkbox" checked={countIn} onChange={event => setCountIn(event.target.checked)} /></label>}
      </div>
      <div className="practice-control-row practice-options"><span>Quick loops</span>{[[1,4],[9,13],[14,17]] .map(([start,end]) => <button key={start} onClick={() => { setLoopStart(start); setLoopEnd(end); setLoopEnabled(true); seek(start); }}>{start}–{end}</button>)}<label><input type="checkbox" checked={upcoming} onChange={event => setUpcoming(event.target.checked)} /> Upcoming</label><label><input type="checkbox" checked={showGuide} onChange={event => setShowGuide(event.target.checked)} /> Guide</label><label>Labels <select value={labels} onChange={event => setLabels(event.target.value as Labels)}><option value="computer">Computer</option><option value="piano">Piano</option><option value="both">Both</option><option value="none">None</option></select></label><span className="practice-accuracy">{mode === "timed" ? `${matched.length}/${totalTargets} notes · ${accuracy}%` : `${collected.length}/${current?.pitches.length ?? 0} pitches`}</span></div>
      {countdown > 0 && <div className="practice-countdown">{countdown}</div>}
      {unmapped.length > 0 && <p className="practice-warning">Unmapped score pitches: {unmapped.map(midiToName).join(", ")}. Select a mapping that covers them to practice.</p>}
      {alternatives.length > 0 && <div className="practice-alternatives">Preferred keys: {alternatives.map(midi => <label key={midi}>{midiToName(midi)} <select value={preferred[midi] ?? bindingsForPitch(map,midi)[0].id} onChange={event => setPreferred(value => ({...value,[midi]:event.target.value}))}>{bindingsForPitch(map,midi).map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>)}</div>}
      {showGuide && <p className="practice-guide">Play the highlighted characters on your physical keyboard. Shift labels use ⇧. Notes sound only when you press a key. Click a measure number to jump there.</p>}
      <InterstellarAudioSettings value={interstellarMix} onChange={setInterstellarMix} />
      <div className="practice-control-row"><label><input type="checkbox" checked={showAssistedNotes} onChange={event => setShowAssistedNotes(event.target.checked)} /> Show Assisted Notes</label></div>
      <SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} />
    </section>
    <section className="practice-piano" aria-label="Practice piano"><div className="practice-piano-top"><span>VIRTUAL PIANO · {map.name}</span><span>{snapshot.pressed.length} keys down · {snapshot.notesPerSecond} notes/s</span></div><PianoCanvas active={soundingPitches} expected={expected} wrong={wrong} completed={completed} map={map} transpose={0} labelMode={labels} preferredLabels={visibleLabels} practicePalette /></section>
  </main>;
}
