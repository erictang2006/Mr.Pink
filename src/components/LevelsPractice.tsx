import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import PianoCanvas from "./PianoCanvas";
import SustainSettings, { type SustainSettingsValue } from "./SustainSettings";
import { beatAtSeconds, secondsAtBeat } from "../piano/practiceSong";
import { levelsCodeLabels, levelsInputs, levelsLabel, levelsSong, levelsTransitionChords } from "../piano/levels";
import { midiToName, type KeyboardMap } from "../piano/noteMapping";
import type { InputSnapshot } from "../piano/keyboardInput";

type Props = {
  map: KeyboardMap; range: { low: number; high: number }; snapshot: InputSnapshot; pressedPitches: number[]; audioReady: boolean; startAudio: () => void;
  onNoteRef: MutableRefObject<((midi: number, code: string, at: number) => void) | null>;
  onUnmappedRef: MutableRefObject<((code: string, at: number) => void) | null>;
  onExit: () => void; onMeasureChange: (measure: number) => void; resetVoices: () => void;
  transitionGain: number; setTransitionGain: (gain: number) => void;
  chords: Record<string, number[]>; setChords: (chords: Record<string, number[]>) => void;
  sustainSettings: SustainSettingsValue; setSustainSettings: (value: SustainSettingsValue) => void;
  sustainActive: boolean; showAssistedNotes: boolean; setShowAssistedNotes: (value: boolean) => void;
  onSongChange: (song: "interstellar" | "levels") => void;
};
type Mode = "step" | "timed";
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const read = (key: string, fallback: string) => { try { return localStorage.getItem(`stage-piano-levels-${key}`) ?? fallback; } catch { return fallback; } };

export default function LevelsPractice({ map, range, snapshot, pressedPitches, audioReady, startAudio, onNoteRef, onUnmappedRef, onExit, onMeasureChange, resetVoices, transitionGain, setTransitionGain, chords, setChords, sustainSettings, setSustainSettings, sustainActive, showAssistedNotes, setShowAssistedNotes, onSongChange }: Props) {
  const groups = useMemo(() => levelsInputs(chords), [chords]);
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
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);
  const scoreSeconds = useRef(0);
  const clockStart = useRef(0);
  const scoreRef = useRef<HTMLDivElement>(null);
  const loopTimer = useRef<number | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const endIndex = groups.findIndex(group => group.measure > loopEnd);
  const last = endIndex < 0 ? groups.length : endIndex;
  const current = groups[index] ?? groups[0];
  const measure = mode === "timed" ? levelsSong.measures.find(m => playhead >= m.startBeat && playhead < m.startBeat + m.beats)?.number ?? 16 : emptyBar ?? current?.measure ?? loopStart;
  const currentMeasure = levelsSong.measures[measure - 1];
  const expectedCodes = mode === "step" ? finished ? [] : current?.codes ?? [] : groups.filter(group => Math.abs(secondsAtBeat(levelsSong, group.absoluteBeat) - secondsAtBeat(levelsSong, playhead)) * 1000 <= tolerance).flatMap(group => group.codes);
  const pitchesFor = (codes: string[]) => [...new Set(codes.flatMap(code => (measure <= 8 ? chords : levelsTransitionChords)[code] ?? []))];
  const expected = mode === "step" ? finished ? [] : current?.pitches ?? [] : groups.filter(group => Math.abs(secondsAtBeat(levelsSong, group.absoluteBeat) - secondsAtBeat(levelsSong, playhead)) * 1000 <= tolerance).flatMap(group => group.pitches);
  const completed = pitchesFor(collected);
  const preferredLabels = Object.fromEntries(Object.entries(chords).flatMap(([code, pitches]) => pitches.map(pitch => [pitch, levelsLabel(code)])));
  if (measure >= 9) { preferredLabels[68] = "J"; preferredLabels[64] = "M"; }

  useEffect(() => { onMeasureChange(measure); }, [measure, onMeasureChange]);
  useEffect(() => { scoreRef.current?.querySelector(`[data-measure="${measure}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" }); }, [measure]);
  useEffect(() => { for (const [key, value] of [["mode", mode], ["speed", speed], ["tolerance", tolerance], ["chord-window", chordWindow]]) try { localStorage.setItem(`stage-piano-levels-${key}`, String(value)); } catch { /* storage unavailable */ } }, [mode, speed, tolerance, chordWindow]);
  useEffect(() => () => { if (loopTimer.current !== null) clearTimeout(loopTimer.current); if (wrongTimer.current !== null) clearTimeout(wrongTimer.current); onNoteRef.current = null; onUnmappedRef.current = null; }, [onNoteRef, onUnmappedRef]);

  function setCurrent(next: number) { indexRef.current = next; setIndex(next); setEmptyBar(null); }
  function clearCollected() { collectedRef.current = []; setCollected([]); firstChordAt.current = 0; }
  function seek(bar: number) {
    resetVoices(); setPlaying(false); setFinished(false); setWrong([]); clearCollected();
    matchedRef.current.clear(); setMatched([]); setWrongCount(0);
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
    const played = code ? (measure <= 8 ? chords : levelsTransitionChords)[code] : undefined;
    setWrong(played ?? [midi]); setWrongCount(count => count + 1);
    if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => setWrong([]), 500);
  }

  useEffect(() => {
    onUnmappedRef.current = (code) => { if (audioReady && !finished && (mode === "step" || playing) && code !== "Space" && code !== "F9") showWrong(-1); };
    onNoteRef.current = (midi, code, at) => {
      if (!audioReady || finished || loopTimer.current !== null) return;
      if (mode === "step") {
        const group = groups[indexRef.current];
        if (!group || !group.codes.includes(code) || collectedRef.current.includes(code)) { showWrong(midi, code); return; }
        if (at - firstChordAt.current > chordWindow) clearCollected();
        if (!collectedRef.current.length) firstChordAt.current = at;
        const next = [...collectedRef.current, code]; collectedRef.current = next; setCollected(next);
        if (group.codes.every(required => next.includes(required))) {
          matchedRef.current.add(group.id); setMatched([...matchedRef.current]); clearCollected();
          const following = indexRef.current + 1;
          if (following >= last) {
            if (loopEnabled) loopTimer.current = window.setTimeout(() => { loopTimer.current = null; seek(loopStart); }, loopPause);
            else setFinished(true);
          } else { onMeasureChange(groups[following].measure); setCurrent(following); }
        }
        return;
      }
      if (!playing) return;
      const scoreTime = secondsAtBeat(levelsSong, playheadRef.current);
      const candidates = groups.filter(group => group.measure >= loopStart && group.measure <= loopEnd && group.codes.includes(code) && !matchedRef.current.has(`${group.id}:${code}`) && Math.abs(secondsAtBeat(levelsSong, group.absoluteBeat) - scoreTime) * 1000 <= tolerance);
      const closest = candidates.sort((a, b) => Math.abs(a.absoluteBeat - playheadRef.current) - Math.abs(b.absoluteBeat - playheadRef.current))[0];
      if (!closest) { showWrong(midi, code); return; }
      matchedRef.current.add(`${closest.id}:${code}`); setMatched([...matchedRef.current]);
    };
  }, [audioReady, mode, finished, groups, chordWindow, last, loopEnabled, loopPause, loopStart, loopEnd, playing, tolerance, onUnmappedRef, onNoteRef, measure, chords]);

  useEffect(() => {
    if (!playing || mode !== "timed") return;
    clockStart.current = performance.now();
    let frame = 0;
    const tick = () => {
      const seconds = scoreSeconds.current + (performance.now() - clockStart.current) / 1000 * speed / 100;
      const beat = beatAtSeconds(levelsSong, seconds);
      playheadRef.current = beat; setPlayhead(beat);
      const next = groups.findIndex(group => group.measure >= loopStart && group.measure <= loopEnd && group.absoluteBeat >= beat);
      if (next >= 0) setCurrent(next);
      const ending = levelsSong.measures[loopEnd - 1].startBeat + levelsSong.measures[loopEnd - 1].beats;
      if (beat >= ending) {
        scoreSeconds.current = secondsAtBeat(levelsSong, ending); setPlaying(false);
        if (loopEnabled) loopTimer.current = window.setTimeout(() => { loopTimer.current = null; seek(loopStart); setPlaying(true); }, loopPause);
        else setFinished(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { scoreSeconds.current += (performance.now() - clockStart.current) / 1000 * speed / 100; cancelAnimationFrame(frame); };
  }, [playing, mode, speed, groups, loopStart, loopEnd, loopEnabled, loopPause]);

  function changeMode(next: Mode) { seek(measure); setMode(next); }
  function remap(oldCode: string, newCode: string) {
    if (oldCode === newCode || chords[newCode]) return;
    const updated = { ...chords, [newCode]: chords[oldCode] }; delete updated[oldCode];
    resetVoices(); setChords(updated);
  }
  const total = groups.filter(group => group.measure >= loopStart && group.measure <= loopEnd).reduce((sum, group) => sum + group.codes.length, 0);
  const accuracy = total ? Math.round(matched.length / total * 100) : 0;

  return <main className="practice-studio levels-practice">
    <header className="practice-header"><div><span className="eyebrow">PRACTICE STUDIO / LEVELS</span><h1>Levels <em>→ Roses</em></h1><p>Play the physical keys shown below. Each assisted key sounds its full scored chord.</p></div><div className="practice-header-actions">{!audioReady && <button className="practice-primary" onClick={startAudio}>Enable piano audio</button>}<button onClick={onExit}>← Piano</button></div></header>
    <section className="practice-sheet"><div className="practice-sheet-top"><span>PHYSICAL KEY SHEET · BAR {measure} / 16</span><span>{currentMeasure.timeSignature.join("/")} · {Math.round(currentMeasure.tempoBpm)} BPM · {measure <= 8 ? "LEVELS" : "ROSES TRANSITION"}</span></div><div className="practice-measures" ref={scoreRef}>
      {levelsSong.measures.map(bar => <div className={`practice-measure levels-measure ${bar.number < measure ? "is-past" : ""} ${bar.number === measure ? "is-current" : ""}`} data-measure={bar.number} key={bar.number}><button className="practice-measure-head" onClick={() => seek(bar.number)}><b>{String(bar.number).padStart(2, "0")}</b><span>{bar.number <= 8 ? "Levels" : "Roses transition"}</span></button><div className="practice-note-lanes levels-lane">
        {groups.filter(group => group.measure === bar.number).map(group => <button key={group.id} className={`practice-token ${current?.id === group.id && !finished ? "is-active" : ""} ${matchedRef.current.has(group.id) || (mode === "timed" && group.absoluteBeat < playhead) ? "is-done" : ""}`} style={{ left: `${group.beat / bar.beats * 100}%` }} title={`Beat ${group.beat + 1} · ${group.duration} beats · ${group.pitches.map(midiToName).join(" + ")}`} onClick={() => seek(bar.number)}>{!showUpcoming && bar.number > measure ? "·" : group.codes.length > 1 ? `[${group.codes.map(levelsLabel).join(" ")}]` : levelsLabel(group.codes[0])}</button>)}
        {bar.notes.length === 0 && <span className="levels-empty">REST · 4 BEATS</span>}
        {bar.rests.filter(rest => rest.hand === "right" && bar.notes.length > 0).map((rest, i) => <span key={i} className="practice-rest" style={{ left: `${rest.beat / bar.beats * 100}%` }} title={`Rest ${rest.duration} beats`}>—</span>)}
        {mode === "timed" && playhead >= bar.startBeat && playhead <= bar.startBeat + bar.beats && <span className="practice-playhead" style={{ left: `${(playhead - bar.startBeat) / bar.beats * 100}%` }} />}
      </div><div className="practice-beats">{[0,1,2,3].map(beat => <span key={beat} style={{ left: `${beat / bar.beats * 100}%` }}>{beat + 1}</span>)}</div></div>)}
    </div><div className="practice-prompt"><span>{finished ? "DONE" : "NEXT"}</span><strong>{emptyBar ? "Rest · no notes written" : finished ? "Section complete" : current ? current.codes.length > 1 ? `[${current.codes.map(levelsLabel).join(" ")}]` : levelsLabel(current.codes[0]) : "Rest"}</strong><small>{emptyBar ? "Bars 12–16 are empty in the score" : current?.pitches.map(midiToName).join(" · ")}</small>{wrong.length > 0 && <em>Wrong input · expected {expectedCodes.map(levelsLabel).join(" + ")}</em>}</div></section>
    <section className="practice-controls"><div className="practice-control-row"><label>Song <select value="levels" onChange={event => onSongChange(event.target.value as "interstellar" | "levels")}><option value="interstellar">Interstellar</option><option value="levels">Levels — Avicii</option></select></label><div className="practice-segment"><button className={mode === "step" ? "selected" : ""} onClick={() => changeMode("step")}>Step</button><button className={mode === "timed" ? "selected" : ""} onClick={() => changeMode("timed")}>Timed</button></div>{mode === "timed" && <button className="practice-primary" disabled={!audioReady} onClick={() => { if (finished) seek(loopStart); setPlaying(value => !value); }}>{playing ? "Pause" : "Start"}</button>}<button onClick={restart}>Restart measure</button><button onClick={reset}>Reset session</button><span className="practice-accuracy">{mode === "step" ? `${collected.length}/${current?.codes.length ?? 0} keys` : `${matched.length}/${total} keys · ${accuracy}%`} · {wrongCount} wrong</span></div>
      <div className="practice-control-row"><label>Speed <output>{speed}%</output><input type="range" min="25" max="125" step="5" value={speed} disabled={mode !== "timed"} onChange={event => setSpeed(Number(event.target.value))} /></label><label>Timing ±<output>{tolerance} ms</output><input type="range" min="50" max="500" step="10" value={tolerance} disabled={mode !== "timed"} onChange={event => setTolerance(Number(event.target.value))} /></label><label>Chord window <output>{chordWindow} ms</output><input type="range" min="100" max="1500" step="50" value={chordWindow} disabled={mode !== "step"} onChange={event => setChordWindow(Number(event.target.value))} /></label><label>Loop <input type="checkbox" checked={loopEnabled} onChange={event => setLoopEnabled(event.target.checked)} /></label><label>From <input className="practice-number" type="number" min="1" max={loopEnd} value={loopStart} onChange={event => setLoopStart(clamp(Number(event.target.value), 1, loopEnd))} /></label><label>To <input className="practice-number" type="number" min={loopStart} max="16" value={loopEnd} onChange={event => setLoopEnd(clamp(Number(event.target.value), loopStart, 16))} /></label><label>Pause <select value={loopPause} onChange={event => setLoopPause(Number(event.target.value))}><option value="0">0 s</option><option value="600">0.6 s</option><option value="1500">1.5 s</option><option value="3000">3 s</option></select></label></div>
      <div className="practice-control-row"><button onClick={() => { setLoopStart(1); setLoopEnd(8); setLoopEnabled(true); seek(1); }}>Bars 1–8</button><button onClick={() => { setLoopStart(9); setLoopEnd(11); setLoopEnabled(true); seek(9); }}>Bars 9–11</button><label>Go to bar <input className="practice-number" type="number" min="1" max="16" value={measure} onChange={event => seek(clamp(Number(event.target.value) || 1, 1, 16))} /></label><label><input type="checkbox" checked={showUpcoming} onChange={event => setShowUpcoming(event.target.checked)} /> Upcoming</label><label><input type="checkbox" checked={showGuide} onChange={event => setShowGuide(event.target.checked)} /> Guide</label><label>Labels <select value={labels} onChange={event => setLabels(event.target.value as typeof labels)}><option value="computer">Computer</option><option value="piano">Piano</option><option value="both">Both</option><option value="none">None</option></select></label><label><input type="checkbox" checked={showAssistedNotes} onChange={event => setShowAssistedNotes(event.target.checked)} /> Show Assisted Notes</label></div>
      {showGuide && <p className="practice-guide">The sheet shows one key per assisted chord. Brackets mean press those physical keys together. Space toggles sustain; F9 releases all notes. This diagnostic shows only keys received by the browser: {snapshot.detected.join(" + ") || "none"}.</p>}
      <div className="practice-control-row"><label>Transition gain <output>{Math.round(transitionGain * 100)}%</output><input type="range" min="10" max="100" step="5" value={transitionGain * 100} onChange={event => setTransitionGain(Number(event.target.value) / 100)} /></label><span>Bars 9–12 only</span></div>
      <details className="levels-mapping"><summary>Assisted key mapping and rollover test</summary><div className="practice-control-row">{Object.entries(chords).map(([code, pitches]) => <label key={code}>{pitches.map(midiToName).join(" + ")} <select value={code} onChange={event => remap(code, event.target.value)}>{[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(letter => <option value={`Key${letter}`} key={letter} disabled={!!chords[`Key${letter}`] && code !== `Key${letter}`}>{letter}</option>)}{["Comma", "Period", "Semicolon", "Slash", "Quote"].map(value => <option value={value} key={value} disabled={!!chords[value] && code !== value}>{levelsCodeLabels[value] ?? value}</option>)}</select></label>)}</div><p>Try A+U, A+I, S+O, D+J, F+L. Browser received: {snapshot.detected.join(" + ") || "none"}. If a combination fails, choose an unused trigger. Hardware rollover can prevent missing key events.</p></details>
      <SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} />
    </section>
    <section className="practice-piano" aria-label="Practice piano"><div className="practice-piano-top"><span>VIRTUAL PIANO · {map.name}</span><span>{snapshot.pressed.length} keys down · {snapshot.notesPerSecond} notes/s</span></div><PianoCanvas active={pressedPitches} expected={expected} wrong={wrong} completed={completed} map={map} range={range} transpose={0} labelMode={labels} preferredLabels={preferredLabels} practicePalette /></section>
  </main>;
}
