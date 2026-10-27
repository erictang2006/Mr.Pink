import { LevelsChordCollector, levelsEMajor, levelsRealInputs, levelsRealDrums, levelsDrumHint, type LevelsPlayingMode } from "../piano/levelsRealPiano";
import LevelsIndividualSheet from "./LevelsIndividualSheet";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import PianoCanvas from "./PianoCanvas";
import SustainSettings, { type SustainSettingsValue } from "./SustainSettings";
import { secondsAtBeat } from "../piano/practiceSong";
import { levelsCodeLabels, levelsDrumCues, levelsInputs, levelsLabel, levelsSong, levelsTransitionChords, levelsRosesChords, type DrumLayer } from "../piano/levels";
import type { DrumEngine, DrumMix, DrumName, DrumSnapshot } from "../piano/drumEngine";
import { midiToName, type KeyboardMap } from "../piano/noteMapping";
import type { InputSnapshot } from "../piano/keyboardInput";
import type { SongId } from "./SandboxMode";

type Props = {
  playingMode: LevelsPlayingMode; setPlayingMode: (mode: LevelsPlayingMode) => void;
  getHeldPitches: () => number[]; releaseModeVoices: () => void;
  map: KeyboardMap; range: { low: number; high: number }; snapshot: InputSnapshot; pressedPitches: number[]; audioReady: boolean; startAudio: () => void;
  onNoteRef: MutableRefObject<((midi: number, code: string, at: number) => void) | null>;
  onUnmappedRef: MutableRefObject<((code: string, at: number) => void) | null>;
  onExit: () => void; onMeasureChange: (measure: number) => void; resetVoices: () => void;
  transitionGain: number; setTransitionGain: (gain: number) => void;
  chords: Record<string, number[]>; setChords: (chords: Record<string, number[]>) => void;
  sustainSettings: SustainSettingsValue; setSustainSettings: (value: SustainSettingsValue) => void;
  sustainActive: boolean; showAssistedNotes: boolean; setShowAssistedNotes: (value: boolean) => void;
  onSongChange: (song: SongId) => void; onSandbox: () => void;
  drums: DrumEngine | null; drumSnapshot: DrumSnapshot | null; drumMix: DrumMix; setDrumMix: (mix: DrumMix) => void; setDrumMode: (mode: "step" | "timed") => void;
};
type Mode = "step" | "timed";
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const read = (key: string, fallback: string) => { try { return localStorage.getItem(`stage-piano-levels-${key}`) ?? fallback; } catch { return fallback; } };

export default function LevelsPractice({ playingMode, setPlayingMode, getHeldPitches, releaseModeVoices, map, range, snapshot, pressedPitches, audioReady, startAudio, onNoteRef, onUnmappedRef, onExit, onMeasureChange, resetVoices, transitionGain, setTransitionGain, chords, setChords, sustainSettings, setSustainSettings, sustainActive, showAssistedNotes, setShowAssistedNotes, onSongChange, onSandbox, drums, drumSnapshot, drumMix, setDrumMix, setDrumMode }: Props) {
  const real = playingMode === "real";
  const assistedGroups = useMemo(() => levelsInputs(chords), [chords]);
  const individualGroups = useMemo(() => levelsRealInputs(), []);
  const groups = real ? individualGroups : assistedGroups;
  const collector = useRef(new LevelsChordCollector());
  const progress = useRef<Record<LevelsPlayingMode, { matched: string[]; wrong: number }>>({ assisted: { matched: [], wrong: 0 }, real: { matched: [], wrong: 0 } });
  const [mode, setMode] = useState<Mode>(() => read("mode", "step") === "timed" ? "timed" : "step");
  const [speed, setSpeed] = useState(() => clamp(Number(read("speed", "75")), 25, 125));
  const [tolerance, setTolerance] = useState(() => clamp(Number(read("tolerance", "180")), 50, 500));
  const [chordWindow, setChordWindow] = useState(() => clamp(Number(read("chord-window", "450")), 100, 1500));
  const [loopStart, setLoopStart] = useState(1);
  const [loopEnd, setLoopEnd] = useState(11);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopPause, setLoopPause] = useState(600);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [labels, setLabels] = useState<"computer" | "piano" | "both" | "none">("computer");
  const [index, setIndex] = useState(0);
  const [emptyBar, setEmptyBar] = useState<number | null>(null);
  const indexRef = useRef(0);
  const [collected, setCollected] = useState<string[]>([]);
  const collectedRef = useRef<string[]>([]);
  const firstChordAt = useRef(0);
  const [matched, setMatched] = useState<string[]>([]);
  const matchedRef = useRef(new Set<string>());
  const [wrong, setWrong] = useState<number[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [waitingForRoses, setWaitingForRoses] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);
  const scoreSeconds = useRef(0);
  const scoreRef = useRef<HTMLDivElement>(null);
  const individualScoreRef = useRef<HTMLDivElement>(null);
  const loopTimer = useRef<number | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const endIndex = groups.findIndex(group => group.measure > loopEnd);
  const last = endIndex < 0 ? groups.length : endIndex;
  const current = groups[index] ?? groups[0];
  const measure = mode === "timed" ? levelsSong.measures.find(m => playhead >= m.startBeat && playhead < m.startBeat + m.beats)?.number ?? 16 : emptyBar ?? current?.measure ?? loopStart;
  const currentMeasure = levelsSong.measures[measure - 1];
  const expectedGroups = mode === "step" ? finished || waitingForRoses ? [] : current ? [current] : [] : groups.filter(group => Math.abs(secondsAtBeat(levelsSong, group.absoluteBeat) - secondsAtBeat(levelsSong, playhead)) * 1000 <= tolerance);
  const expectedCodes = expectedGroups.flatMap(group => group.codes);
  const sectionChords = measure <= 8 ? chords : measure <= 11 ? levelsTransitionChords : levelsRosesChords;
  const pitchesFor = (codes: string[]) => [...new Set(codes.flatMap(code => sectionChords[code] ?? []))];
  const expected = expectedGroups.flatMap(group => group.pitches);
  const completed = real ? collected.map(code => levelsEMajor.bindings.find(binding => binding.code === code)!.midi).filter(pitch => pressedPitches.includes(pitch)) : pitchesFor(collected);
  const preferredLabels = real ? Object.fromEntries(levelsEMajor.bindings.map(binding => [binding.midi, binding.label])) : Object.fromEntries(Object.entries(chords).flatMap(([code, pitches]) => pitches.map(pitch => [pitch, levelsLabel(code)])));
  if (!real && measure >= 9) { preferredLabels[68] = "J"; preferredLabels[71] = "K"; preferredLabels[76] = "L"; preferredLabels[64] = "M"; }

  useEffect(() => { onMeasureChange(measure); }, [measure, onMeasureChange]);
  useEffect(() => {
    if (!waitingForRoses || drumSnapshot?.status !== "roses-ready") return;
    setWaitingForRoses(false);
    const next = indexRef.current + 1;
    if (next < groups.length) setCurrent(next);
  }, [waitingForRoses, drumSnapshot?.status, groups.length]);
  useEffect(() => { setDrumMode(mode); }, [mode, setDrumMode]);
  useEffect(() => { if (mode === "timed" && playing) drums?.setSpeed(speed / 100); }, [speed, mode, playing, drums]);
  useEffect(() => { scoreRef.current?.querySelector(`[data-measure="${measure}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" }); }, [measure]);
  useEffect(() => { for (const [key, value] of [["mode", mode], ["speed", speed], ["tolerance", tolerance], ["chord-window", chordWindow]]) try { localStorage.setItem(`stage-piano-levels-${key}`, String(value)); } catch { /* storage unavailable */ } }, [mode, speed, tolerance, chordWindow]);
  useEffect(() => () => { if (loopTimer.current !== null) clearTimeout(loopTimer.current); if (wrongTimer.current !== null) clearTimeout(wrongTimer.current); onNoteRef.current = null; onUnmappedRef.current = null; }, [onNoteRef, onUnmappedRef]);

  function setCurrent(next: number) { indexRef.current = next; setIndex(next); setEmptyBar(null); }
  function clearCollected() { collector.current.clear(); collectedRef.current = []; setCollected([]); firstChordAt.current = 0; }
  function seek(bar: number) {
    if (loopTimer.current !== null) { clearTimeout(loopTimer.current); loopTimer.current = null; }
    resetVoices(); setPlaying(false); setFinished(false); setWaitingForRoses(false); setWrong([]); clearCollected();
    if (bar >= 12) drums?.startAt(12, 1, mode);
    matchedRef.current.clear(); setMatched([]); setWrongCount(0);
    progress.current = { assisted: { matched: [], wrong: 0 }, real: { matched: [], wrong: 0 } };
    if (bar > loopEnd) setLoopEnd(bar);
    if (bar < loopStart) setLoopStart(bar);
    const next = groups.findIndex(group => group.measure >= bar);
    if (next >= 0) setCurrent(next);
    else { setCurrent(groups.length - 1); setEmptyBar(bar); if (mode === "step") setFinished(true); }
    const beat = levelsSong.measures[bar - 1].startBeat;
    playheadRef.current = beat; setPlayhead(beat); scoreSeconds.current = secondsAtBeat(levelsSong, beat);
    onMeasureChange(bar);
  }
  function restart() { seek(measure); }
  function reset() { seek(loopEnabled ? loopStart : 1); }
  function showWrong(midi: number, code?: string) {
    const played = !real && code ? sectionChords[code] : undefined;
    setWrong(played ?? [midi]); setWrongCount(count => count + 1);
    if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => setWrong([]), 500);
  }

  useEffect(() => {
    onUnmappedRef.current = (code) => { if (audioReady && !finished && (mode === "step" || playing) && code !== "Space" && code !== "F9") showWrong(-1); };
    onNoteRef.current = (midi, code, at) => {
      if (!audioReady || finished || waitingForRoses || loopTimer.current !== null) return;
      if (mode === "step") {
        const group = groups[indexRef.current];
        if (!group || !group.codes.includes(code) || (!real && collectedRef.current.includes(code))) { showWrong(midi, code); return; }
        let complete: boolean;
        if (real) {
          if (!group.pitches.includes(midi)) { showWrong(midi); return; }
          const result = collector.current.press(group.id, group.pitches, midi, at, getHeldPitches(), chordWindow);
          const next = result.collected.map(pitch => levelsEMajor.bindings.find(binding => binding.midi === pitch)!.code);
          collectedRef.current = next; setCollected(next); complete = result.complete;
        } else {
          if (at - firstChordAt.current > chordWindow) clearCollected();
          if (!collectedRef.current.length) firstChordAt.current = at;
          const next = [...collectedRef.current, code]; collectedRef.current = next; setCollected(next);
          complete = group.codes.every(required => next.includes(required));
        }
        if (complete) {
          matchedRef.current.add(group.id); setMatched([...matchedRef.current]); clearCollected();
          const following = indexRef.current + 1;
          if (following >= last) {
            if (loopEnabled) loopTimer.current = window.setTimeout(() => { loopTimer.current = null; seek(loopStart); }, loopPause);
            else setFinished(true);
          } else if (group.measure === 11 && groups[following].measure === 12 && drumSnapshot?.status !== "roses-ready") {
            setWaitingForRoses(true);
          } else { onMeasureChange(groups[following].measure); setCurrent(following); }
        }
        return;
      }
      if (!playing) return;
      const scoreTime = secondsAtBeat(levelsSong, playheadRef.current);
      const candidates = groups.filter(group => group.measure >= loopStart && group.measure <= loopEnd && (real ? group.pitches.includes(midi) : group.codes.includes(code)) && !(real ? matchedRef.current.has(group.id) : matchedRef.current.has(`${group.id}:${code}`)) && Math.abs(secondsAtBeat(levelsSong, group.absoluteBeat) - scoreTime) * 1000 <= tolerance);
      const held = real ? getHeldPitches() : [];
      const closest = candidates.sort((a, b) => {
        // Finish an overlapping chord before assigning a shared pitch to its next repetition.
        const pending = real ? Number(collector.current.hasPending(b.id, at, held, chordWindow)) - Number(collector.current.hasPending(a.id, at, held, chordWindow)) : 0;
        return pending || Math.abs(a.absoluteBeat - playheadRef.current) - Math.abs(b.absoluteBeat - playheadRef.current);
      })[0];
      if (!closest) { showWrong(midi, code); return; }
      if (real) {
        const result = collector.current.press(closest.id, closest.pitches, midi, at, held, chordWindow);
        setCollected(result.collected.map(pitch => levelsEMajor.bindings.find(binding => binding.midi === pitch)!.code));
        if (!result.complete) return;
        matchedRef.current.add(closest.id); collector.current.clear(closest.id); setCollected([]);
      } else matchedRef.current.add(`${closest.id}:${code}`);
      setMatched([...matchedRef.current]);
      if (closest.measure === 12) { drums?.pause(); setPlaying(false); setFinished(true); }
    };
  }, [audioReady, mode, finished, waitingForRoses, groups, chordWindow, last, loopEnabled, loopPause, loopStart, loopEnd, playing, tolerance, onUnmappedRef, onNoteRef, measure, chords, drumSnapshot?.status, drums, real, getHeldPitches]);

  useEffect(() => {
    if (!playing || mode !== "timed") return;
    let frame = 0;
    const tick = () => {
      const beat = drums?.getScoreBeat() ?? playheadRef.current;
      playheadRef.current = beat; setPlayhead(beat);
      const next = groups.findIndex(group => group.measure >= loopStart && group.measure <= loopEnd && group.absoluteBeat >= beat);
      if (next >= 0) setCurrent(next);
      const ending = levelsSong.measures[loopEnd - 1].startBeat + levelsSong.measures[loopEnd - 1].beats;
      if (beat >= ending || (loopEnd === 11 && ["awaiting-cue", "break", "roses-ready"].includes(drums?.snapshot().status ?? ""))) {
        scoreSeconds.current = secondsAtBeat(levelsSong, ending); drums?.pause(); setPlaying(false);
        if (loopEnabled) loopTimer.current = window.setTimeout(() => { loopTimer.current = null; seek(loopStart); drums?.startAt(loopStart, speed / 100, "timed"); setPlaying(true); }, loopPause);
        else setFinished(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, mode, groups, loopStart, loopEnd, loopEnabled, loopPause, drums, speed]);

  function toggleTimed() {
    if (!drums || !audioReady) return;
    if (playing) { drums.pause(); setPlaying(false); return; }
    if (finished) seek(loopStart);
    const bar = finished ? loopStart : measure;
    if (drums.snapshot().status === "paused") drums.resume();
    else drums.startAt(bar, speed / 100, "timed");
    setPlaying(true);
  }

  function changeMode(next: Mode) { seek(measure); setMode(next); }
  function remap(oldCode: string, newCode: string) {
    if (oldCode === newCode || chords[newCode]) return;
    const updated = { ...chords, [newCode]: chords[oldCode] }; delete updated[oldCode];
    resetVoices(); setChords(updated);
  }
  const total = groups.filter(group => group.measure >= loopStart && group.measure <= loopEnd).reduce((sum, group) => sum + group.codes.length, 0);
  const matchedCount = real || mode === "step" ? groups.filter(group => matched.includes(group.id)).reduce((sum, group) => sum + group.codes.length, 0) : matched.length;
  const accuracy = total ? Math.round(matchedCount / total * 100) : 0;
  const displayKey = (code: string) => real ? levelsEMajor.bindings.find(binding => binding.code === code)?.label ?? code : levelsLabel(code);
  const drumKey = (layer: DrumName) => real ? Object.keys(levelsRealDrums).find(code => levelsRealDrums[code] === layer)! : ({ kick: "Z", clap: "X", hat: "C", fill: "V", riser: "B" }[layer]);
  function switchPlayingMode(next: LevelsPlayingMode) {
    if (next === playingMode) return;
    progress.current[playingMode] = { matched: [...matchedRef.current], wrong: wrongCount };
    releaseModeVoices(); clearCollected(); setWrong([]);
    const saved = progress.current[next];
    matchedRef.current = new Set(saved.matched); setMatched(saved.matched); setWrongCount(saved.wrong);
    setPlayingMode(next);
  }
  function syncScroll(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (target && Math.abs(target.scrollLeft - source.scrollLeft) > 1) target.scrollLeft = source.scrollLeft;
  }

  return <main className="practice-studio levels-practice">
    <header className="practice-header"><div><span className="eyebrow">PRACTICE STUDIO / LEVELS</span><h1>Levels <em>→ Roses</em></h1><p>Play the physical keys shown below. Each assisted key sounds its full scored chord.</p></div><div className="practice-header-actions"><div className="practice-segment" aria-label="Levels playing mode"><button aria-pressed={!real} className={!real ? "selected" : ""} onClick={() => switchPlayingMode("assisted")}>Assisted</button><button aria-pressed={real} className={real ? "selected" : ""} onClick={() => switchPlayingMode("real")}>Real Piano</button></div>{!audioReady && <button className="practice-primary" onClick={startAudio}>Enable piano audio</button>}<button onClick={onExit}>← Piano</button></div></header>
    <section className="practice-sheet"><div className="practice-sheet-top"><span>ASSISTED KEYBINDS · BAR {measure} / 16</span><span>{currentMeasure.timeSignature.join("/")} · {Math.round(currentMeasure.tempoBpm)} BPM · {measure <= 8 ? "LEVELS" : measure <= 11 ? "LIVE DRUM TRANSITION" : "ROSES ENTRY"} {mode === "timed" && `· BEAT ${(playhead - currentMeasure.startBeat + 1).toFixed(1)}`}</span></div><div className="practice-measures" ref={scoreRef} onScroll={event => syncScroll(event.currentTarget, individualScoreRef.current)}>
      {levelsSong.measures.map(bar => <div className={`practice-measure levels-measure ${bar.number < measure ? "is-past" : ""} ${bar.number === measure ? "is-current" : ""}`} data-measure={bar.number} key={bar.number}><button className="practice-measure-head" onClick={() => seek(bar.number)}><b>{String(bar.number).padStart(2, "0")}</b><span>{bar.number <= 8 ? "Levels" : bar.number <= 11 ? "Live transition" : "Roses entry"}</span></button><div className="practice-note-lanes levels-lane">
        {assistedGroups.filter(group => group.measure === bar.number).map(group => <button key={group.id} className={`practice-token ${current?.id === group.id && !finished ? "is-active" : ""} ${matchedRef.current.has(group.id) || (mode === "timed" && group.absoluteBeat < playhead) ? "is-done" : ""}`} style={{ left: `${group.beat / bar.beats * 100}%` }} title={`Beat ${group.beat + 1} · ${group.duration} beats · ${group.pitches.map(midiToName).join(" + ")}`} onClick={() => seek(bar.number)}>{!showUpcoming && bar.number > measure ? "·" : group.codes.length > 1 ? `[${group.codes.map(levelsLabel).join(" ")}]` : levelsLabel(group.codes[0])}</button>)}
        {bar.notes.length === 0 && <span className="levels-empty">REST · 4 BEATS</span>}
        {bar.rests.filter(rest => rest.hand === "right" && bar.notes.length > 0).map((rest, i) => <span key={i} className="practice-rest" style={{ left: `${rest.beat / bar.beats * 100}%` }} title={`Rest ${rest.duration} beats`}>—</span>)}
        {mode === "timed" && playhead >= bar.startBeat && playhead <= bar.startBeat + bar.beats && <span className="practice-playhead" style={{ left: `${(playhead - bar.startBeat) / bar.beats * 100}%` }} />}
      </div>{bar.number >= 9 && bar.number <= 11 && <div className="levels-drum-grid">{(["kick", "clap", "hat", "fill", "riser"] as DrumName[]).map(layer => {
        const cue = levelsDrumCues.find(event => event.measure === bar.number && event.layer === layer);
        const active = layer === "fill" || layer === "riser" ? drumSnapshot?.cuePlayed : drumSnapshot?.active[layer as DrumLayer];
        const pending = layer === "fill" ? drumSnapshot?.fillPending : layer === "riser" ? drumSnapshot?.riserPending : drumSnapshot?.pending[layer as DrumLayer] !== undefined;
        const pattern = layer === "kick" ? [0,1,2,3] : layer === "clap" ? [1,3] : layer === "hat" ? [0,.5,1,1.5,2,2.5,3,3.5] : cue ? [cue.beat] : [];
        return <div className={`levels-drum-row ${active ? "is-on" : ""}`} key={layer}><span className="levels-drum-name">{layer === "hat" ? "HI-HAT" : layer.toUpperCase()}</span><span className="levels-drum-track">{pattern.map(beat => <i key={beat} className={cue && Math.abs(cue.beat - beat) < .01 ? "is-cue" : ""} style={{ left: `${beat / 4 * 100}%` }} />)}{cue && <b style={{ left: `${cue.beat / 4 * 100}%` }}>{real ? drumKey(layer) : levelsLabel(cue.code)}</b>}{bar.number === drumSnapshot?.measure && drumSnapshot.status === "running" && <em className="levels-drum-playhead" style={{ left: `${(drumSnapshot.beat - 1) / 4 * 100}%` }} />}</span><span className="levels-drum-state">{pending ? "QUEUED" : active ? "ON" : cue ? cue.optional ? "OPTIONAL" : "ACTIVATE" : "OFF"}</span></div>;
      })}</div>}<div className="practice-beats">{[0,1,2,3].map(beat => <span key={beat} style={{ left: `${beat / bar.beats * 100}%` }}>{beat + 1}</span>)}</div></div>)}
    </div><div className="practice-prompt"><span>{finished ? "DONE" : waitingForRoses ? "WAIT" : "NEXT"}</span><strong>{waitingForRoses ? real ? "F4 / F5" : "V / B" : emptyBar ? "Rest · no notes written" : finished ? "Section complete" : current ? current.codes.length > 1 ? `[${current.codes.map(displayKey).join(" ")}]` : displayKey(current.codes[0]) : "Rest"}</strong><small>{waitingForRoses ? levelsDrumHint(drumSnapshot?.nextAction, real) ?? "Trigger fill or riser to cue Roses" : emptyBar ? "Later Roses bars are empty in this score" : current?.pitches.map(midiToName).join(" · ")}</small>{wrong.length > 0 && <em>Wrong input · expected {expectedCodes.map(displayKey).join(" + ")}</em>}</div></section>
    <LevelsIndividualSheet scoreRef={individualScoreRef} onScroll={source => syncScroll(source, scoreRef.current)} measure={measure} groups={individualGroups} expectedIds={real ? expectedGroups.map(group => group.id) : []} collected={completed} active={pressedPitches} matched={real ? matched : progress.current.real.matched} finished={finished || waitingForRoses} timed={mode === "timed"} playhead={playhead} showUpcoming={showUpcoming} seek={seek} real={real} />
    <section className="practice-controls"><div className="practice-control-row"><label>Song <select value="levels" onChange={event => onSongChange(event.target.value as SongId)}><option value="interstellar">Interstellar</option><option value="levels">Levels — Avicii</option><option value="roses">Roses — The Chainsmokers</option></select></label><div className="practice-segment"><button className={mode === "step" ? "selected" : ""} onClick={() => changeMode("step")}>Step</button><button className={mode === "timed" ? "selected" : ""} onClick={() => changeMode("timed")}>Timed</button><button onClick={onSandbox}>Sandbox</button></div>{mode === "timed" && <button className="practice-primary" disabled={!audioReady} onClick={toggleTimed}>{playing ? "Pause" : drumSnapshot?.status === "paused" ? "Resume" : "Start"}</button>}<button onClick={restart}>Restart measure</button><button onClick={reset}>Reset session</button><span className="practice-accuracy">{mode === "step" ? `${real ? completed.length : collected.length}/${current?.codes.length ?? 0} keys` : `${matchedCount}/${total} keys · ${accuracy}%`} · {wrongCount} wrong</span></div>
      <div className="practice-control-row"><label>Speed <output>{speed}%</output><input type="range" min="25" max="125" step="5" value={speed} disabled={mode !== "timed"} onChange={event => setSpeed(Number(event.target.value))} /></label><label>Timing ±<output>{tolerance} ms</output><input type="range" min="50" max="500" step="10" value={tolerance} disabled={mode !== "timed"} onChange={event => setTolerance(Number(event.target.value))} /></label><label>Chord window <output>{chordWindow} ms</output><input type="range" min="100" max="1500" step="50" value={chordWindow} disabled={mode !== "step" && !real} onChange={event => setChordWindow(Number(event.target.value))} /></label><label>Loop <input type="checkbox" checked={loopEnabled} onChange={event => setLoopEnabled(event.target.checked)} /></label><label>From <input className="practice-number" type="number" min="1" max={loopEnd} value={loopStart} onChange={event => setLoopStart(clamp(Number(event.target.value), 1, loopEnd))} /></label><label>To <input className="practice-number" type="number" min={loopStart} max="16" value={loopEnd} onChange={event => setLoopEnd(clamp(Number(event.target.value), loopStart, 16))} /></label><label>Pause <select value={loopPause} onChange={event => setLoopPause(Number(event.target.value))}><option value="0">0 s</option><option value="600">0.6 s</option><option value="1500">1.5 s</option><option value="3000">3 s</option></select></label></div>
      <div className="practice-control-row"><button onClick={() => { setLoopStart(1); setLoopEnd(8); setLoopEnabled(true); seek(1); }}>Bars 1–8</button><button onClick={() => { setLoopStart(9); setLoopEnd(11); setLoopEnabled(true); seek(9); }}>Bars 9–11</button><label>Go to bar <input className="practice-number" type="number" min="1" max="16" value={measure} onChange={event => seek(clamp(Number(event.target.value) || 1, 1, 16))} /></label><label><input type="checkbox" checked={showUpcoming} onChange={event => setShowUpcoming(event.target.checked)} /> Upcoming</label><label><input type="checkbox" checked={showGuide} onChange={event => setShowGuide(event.target.checked)} /> Guide</label><label>Labels <select value={labels} onChange={event => setLabels(event.target.value as typeof labels)}><option value="computer">Computer</option><option value="piano">Piano</option><option value="both">Both</option><option value="none">None</option></select></label><label><input type="checkbox" checked={showAssistedNotes} onChange={event => setShowAssistedNotes(event.target.checked)} /> Show Assisted Notes</label></div>
      {showGuide && <p className="practice-guide">{real ? "E-major white keys: t E4 · y F♯4 · u G♯4 · i A4 · o B4 · p C♯5 · a D♯5. Bass: [ A1 · ] B1 · \\ C♯2. Bars 9–11: F1 kick · F2 clap · F3 hats · F4 fill · F5 riser." : "Bars 9–11: J/K/L/M piano · Z kick · X clap · C hats · V fill · B riser. Press Z/X/C again to stop a loop."} Space toggles sustain; F9 stops all sounds. Browser received: {snapshot.detected.join(" + ") || "none"}. Test held piano and drum keys together here; your keyboard hardware may limit some combinations.</p>}
      <div className="practice-control-row levels-drum-controls"><strong>LIVE DRUMS</strong>{(["kick", "clap", "hat", "fill", "riser"] as DrumName[]).map(layer => <span key={layer}>{drumKey(layer)} {layer.toUpperCase()} {layer === "fill" || layer === "riser" ? drumSnapshot?.cuePlayed ? "PLAYED" : "READY" : drumSnapshot?.pending[layer as DrumLayer] !== undefined ? "QUEUED" : drumSnapshot?.active[layer as DrumLayer] ? "ON" : "OFF"}</span>)}<small>{levelsDrumHint(drumSnapshot?.nextAction, real)}</small></div>
      <div className="practice-control-row"><label>Piano <output>{Math.round(transitionGain * 100)}%</output><input type="range" min="10" max="100" step="5" value={transitionGain * 100} onChange={event => setTransitionGain(Number(event.target.value) / 100)} /></label>{(["kick", "clap", "hat", "fill", "riser"] as DrumName[]).map(layer => <label key={layer}>{layer === "hat" ? "Hi-hat" : layer[0].toUpperCase() + layer.slice(1)} <output>{Math.round(drumMix[layer] * 100)}%</output><input type="range" min="0" max="100" step="5" value={Math.round(drumMix[layer] * 100)} onChange={event => setDrumMix({ ...drumMix, [layer]: Number(event.target.value) / 100 })} /></label>)}</div>
      <details className="levels-mapping"><summary>Assisted key mapping and rollover test</summary><div className="practice-control-row">{Object.entries(chords).map(([code, pitches]) => <label key={code}>{pitches.map(midiToName).join(" + ")} <select value={code} onChange={event => remap(code, event.target.value)}>{[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(letter => <option value={`Key${letter}`} key={letter} disabled={!!chords[`Key${letter}`] && code !== `Key${letter}`}>{letter}</option>)}{["Comma", "Period", "Semicolon", "Slash", "Quote"].map(value => <option value={value} key={value} disabled={!!chords[value] && code !== value}>{levelsCodeLabels[value] ?? value}</option>)}</select></label>)}</div><p>Try A+U, A+I, S+O, D+J, F+L. Browser received: {snapshot.detected.join(" + ") || "none"}. If a combination fails, choose an unused trigger. Hardware rollover can prevent missing key events.</p></details>
      <SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} />
    </section>
    <section className="practice-piano" aria-label="Practice piano"><div className="practice-piano-top"><span>VIRTUAL PIANO · {map.name}</span><span>{snapshot.pressed.length} keys down · {snapshot.notesPerSecond} notes/s</span></div><PianoCanvas active={pressedPitches} expected={expected} wrong={wrong} completed={completed} map={map} range={range} transpose={0} labelMode={labels} preferredLabels={preferredLabels} practicePalette /></section>
  </main>;
}
