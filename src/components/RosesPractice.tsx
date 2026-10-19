import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import PianoCanvas from "./PianoCanvas";
import PerformanceVisualizer from "./PerformanceVisualizer";
import type { LiveNotes } from "../piano/liveNotes";
import { rosesChordHint } from "../piano/rosesChords";
import RosesBeatClock from "./RosesBeatClock";
import RosesCalibration from "./RosesCalibration";
import RosesBuildupControls from "./RosesBuildupControls";
import { buildupEvents, buildupBass, buildupKick, buildupStatusText, type BuildupSettings } from "../piano/rosesBuildup";
import RosesCloserControls from "./RosesCloserControls";
import { closerCuePlan, closerTarget, type RosesCloserSettings } from "../piano/rosesCloser";
import type { RosesCalibrationSettings } from "../piano/rosesCalibration";
import type { InputSnapshot } from "../piano/keyboardInput";
import type { KeyboardMap } from "../piano/noteMapping";
import { labelForMidi, midiToName } from "../piano/noteMapping";
import { bundledRosesInstrument } from "../piano/sampleLibrary";
import { rosesAccentTargets, rosesBassNotes, rosesBuildBassNotes, rosesDrumTargets, rosesIntroBarNotes, rosesIntroBars, rosesIntroBeats, rosesIntroNotes, rosesIntroTempo, rosesSubNotes, } from "../piano/rosesIntro";
import type { LiveDrumHit, RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import type { SongId } from "./SandboxMode";

type NoteHandler = (midi: number, code: string, at: number) => void;
type Props = {
  buildupSettings: BuildupSettings; onBuildupSettings: (value: BuildupSettings) => void;
  map: KeyboardMap; transpose: number; range: { low: number; high: number }; snapshot: InputSnapshot;
  liveNotes: LiveNotes;
  audioReady: boolean; startAudio: () => void; engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null;
  drumStatus: "loading" | "ready" | "error";
  onNoteRef: MutableRefObject<NoteHandler | null>; onDrumRef: MutableRefObject<((hit: LiveDrumHit) => void) | null>;
  onExit: () => void; onSandbox: () => void; onPerformance: () => void;
  onSongChange: (song: SongId) => void; instrumentId: string; onInstrument: (id: string) => void; instrumentError: string;
  synthLevel: number; onSynthLevel: (level: number) => void;
  synthLeadMs: number; onSynthLeadMs: (milliseconds: number) => void;
  bassLevels: { bass: number; sub: number }; onBassLevels: (levels: { bass: number; sub: number }) => void;
  vocalOffset: number; onVocalOffset: (seconds: number) => void; vocalKey: string; onVocalKey: (code: string) => void;
  closerSettings: RosesCloserSettings; onCloserSettings: (settings: RosesCloserSettings) => void;
  calibration: RosesCalibrationSettings; onCalibration: (value: RosesCalibrationSettings) => void;
  output: { label: string; base: number | null; output: number | null };
};
type Mode = "step" | "timed";
const introNotes = rosesIntroNotes.filter(note => note.bar <= 4);
const modeSaved = (): Mode => { try { return localStorage.getItem("stage-piano-roses-intro-mode") === "timed" ? "timed" : "step"; } catch { return "step"; } };

export default function RosesPractice({ buildupSettings, onBuildupSettings, map, transpose, range, snapshot, liveNotes, audioReady, startAudio, engine, clock, drumStatus, onNoteRef, onDrumRef, onExit, onSandbox, onPerformance, onSongChange, instrumentId, onInstrument, instrumentError, synthLevel, onSynthLevel, synthLeadMs, onSynthLeadMs, bassLevels, onBassLevels, vocalOffset, onVocalOffset, vocalKey, onVocalKey, closerSettings, onCloserSettings, calibration, onCalibration, output }: Props) {
  const [mode, setMode] = useState<Mode>(modeSaved);
  const [bar, setBar] = useState(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [matchedDrums, setMatchedDrums] = useState<string[]>([]);
  const [drumMistakes, setDrumMistakes] = useState(0);
  const [drumFeedback, setDrumFeedback] = useState("");
  const [drumAttempts, setDrumAttempts] = useState<{ kind: "kick" | "clap"; bar: number; beat: number; result: "early" | "late" }[]>([]);
  const [sessionStartBar, setSessionStartBar] = useState(1);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [speed, setSpeed] = useState(100);
  const [tolerance, setTolerance] = useState(220);
  const [message, setMessage] = useState("");
  const sheet = useRef<HTMLDivElement>(null);
  const lastScrolledBar = useRef(1);
  const wrongTimer = useRef<number | null>(null);
  const matchedDrumsRef = useRef(new Set<string>());
  const lastCycle = useRef(0);
  const currentNote = mode === "step" && bar <= 4 ? introNotes[stepIndex] : undefined;
  const currentBeat = clock?.status === "finished" ? rosesIntroBeats : clock && clock.status !== "idle" ? (clock.measure - 1) * 4 + clock.beat - 1 : (bar - 1) * 4 + (currentNote?.beatInBar ?? 1) - 1;
  const expected = currentNote ? [currentNote.midi + transpose] : [];
  const pressed = snapshot.pressed.map(item => item.midi);
  const stepBeat = clock && clock.status === "paused" && clock.mode === "step" ? (clock.measure - 1) * 4 + clock.beat - 1 : -1;
  const stepTargets = rosesDrumTargets.filter(target => target.startBeat === stepBeat && !matchedDrumsRef.current.has(target.id));
  const instrumentName = instrumentId === bundledRosesInstrument.id ? "Experimental E4 sample" : instrumentId === "roses" ? "Roses Future Bass Lead" : "Selected sandbox instrument";
  const introMatched = useMemo(() => new Set(matched), [matched]);

  useEffect(() => {
    try { localStorage.setItem("stage-piano-roses-intro-mode", mode); } catch { /* storage unavailable */ }
  }, [mode]);
  useEffect(() => { engine?.setSpeed(speed / 100); }, [engine, speed]);
  useEffect(() => { engine?.setPracticeLoop(loopRange); }, [engine, loopRange]);
  useEffect(() => {
    if (!clock || clock.cycle === lastCycle.current) return;
    lastCycle.current = clock.cycle;
    matchedDrumsRef.current.clear(); setMatchedDrums([]); setDrumAttempts([]); setDrumFeedback("");
    setMatched([]); setWrong([]); setWrongCount(0); setDrumMistakes(0);
    if (loopRange) setBar(loopRange.start);
    if (loopRange?.start === 1) setStepIndex(0);
  }, [clock?.cycle, loopRange?.start]);
  useEffect(() => {
    if (!clock || clock.status === "idle") return;
    if (mode === "timed" || clock.measure >= 5) setBar(clock.measure);
  }, [clock?.measure, clock?.status, mode]);
  useEffect(() => {
    sheet.current?.querySelector(`[data-measure="${bar}"]`)?.scrollIntoView({ behavior: Math.abs(bar - lastScrolledBar.current) <= 1 ? "smooth" : "auto", inline: "start", block: "nearest" });
    lastScrolledBar.current = bar;
  }, [bar]);
  useEffect(() => {
    onNoteRef.current = (midi, _code, _at) => {
      if (!audioReady) return;
      if (mode === "step") {
        if (bar > 4) return;
        const note = introNotes[stepIndex]; if (!note) return;
        if (midi === note.midi + transpose) {
          setMatched(previous => [...previous, stepIndex]);
          const next = stepIndex + 1;
          setStepIndex(next);
          setBar(next < introNotes.length ? introNotes[next].bar : 5);
          setWrong([]);
        } else showWrong(midi);
        return;
      }
      if (clock?.status !== "running" || bar > 4 || !engine) return;
      const beat = engine.scoreBeat() - calibration.gradingMs * rosesIntroTempo * speed / 100 / 60000;
      const windowBeats = tolerance / 1000 * rosesIntroTempo * speed / 100 / 60;
      const candidate = introNotes.map((note, index) => ({ note, index }))
        .filter(item => item.note.midi + transpose === midi && !introMatched.has(item.index) && Math.abs(item.note.startBeat - beat) <= windowBeats)
        .sort((a, b) => Math.abs(a.note.startBeat - beat) - Math.abs(b.note.startBeat - beat))[0];
      if (candidate) setMatched(previous => [...previous, candidate.index]);
      else { showWrong(midi); setWrongCount(value => value + 1); }
    };
    return () => { onNoteRef.current = null; };
  }, [audioReady, mode, bar, stepIndex, transpose, clock?.status, engine, tolerance, speed, calibration.gradingMs, introMatched, onNoteRef]);
  useEffect(() => {
    onDrumRef.current = hit => {
      if (!audioReady || hit.bar < 5) return;
      if (hit.bar >= 21) { setDrumFeedback("Z/X live · no required drum hits in bars 21–28"); return; }
      if (mode === "step") {
        const beat = clock && clock.status === "paused" ? (clock.measure - 1) * 4 + clock.beat - 1 : -1;
        const targets = rosesDrumTargets.filter(target => target.startBeat === beat && !matchedDrumsRef.current.has(target.id));
        const match = targets.find(target => target.kind === hit.kind);
        if (!match) { setDrumFeedback(`Expected ${targets.map(target => target.code === "KeyZ" ? "Z kick" : "X clap").join(" + ") || "the next grid hit"}`); return; }
        matchedDrumsRef.current.add(match.id); setMatchedDrums([...matchedDrumsRef.current]);
        setDrumFeedback(`Correct ${hit.kind} · bar ${match.bar}, beat ${match.beatInBar}`);
        if (targets.every(target => target.id === match.id)) engine?.resumeStep();
        return;
      }
      if (clock?.status !== "running") return;
      const gradedBeat = hit.scoreBeat - calibration.gradingMs * rosesIntroTempo * speed / 100 / 60000;
      const targets = rosesDrumTargets.filter(target => target.kind === hit.kind && target.bar >= sessionStartBar && !matchedDrumsRef.current.has(target.id));
      const nearest = targets.sort((a, b) => Math.abs(a.startBeat - gradedBeat) - Math.abs(b.startBeat - gradedBeat))[0];
      const offset = nearest ? gradedBeat - nearest.startBeat : 0;
      const windowBeats = tolerance / 1000 * rosesIntroTempo * speed / 100 / 60;
      if (nearest && Math.abs(offset) <= windowBeats) {
        matchedDrumsRef.current.add(nearest.id); setMatchedDrums([...matchedDrumsRef.current]);
        setDrumFeedback(`Correct ${hit.kind} · bar ${nearest.bar}, beat ${nearest.beatInBar}`);
      } else {
        setDrumMistakes(value => value + 1);
        const attemptBar = Math.floor(hit.scoreBeat / 4) + 1;
        setDrumAttempts(previous => [...previous.slice(-60), { kind: hit.kind, bar: attemptBar, beat: hit.scoreBeat % 4 + 1, result: offset < 0 ? "early" : "late" }]);
        setDrumFeedback(`${offset < 0 ? "Early" : "Late"} ${hit.kind}${nearest ? ` · target bar ${nearest.bar}, beat ${nearest.beatInBar}` : ""}`);
      }
    };
    return () => { onDrumRef.current = null; };
  }, [audioReady, mode, clock?.status, clock?.measure, clock?.beat, engine, tolerance, speed, sessionStartBar, calibration.gradingMs, onDrumRef]);
  useEffect(() => () => { if (wrongTimer.current !== null) clearTimeout(wrongTimer.current); onNoteRef.current = null; onDrumRef.current = null; }, [onNoteRef, onDrumRef]);
  function showWrong(midi: number) {
    setWrong([midi]);
    if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => setWrong([]), 450);
  }
  function seek(next: number, keepLoop = false) {
    if (!keepLoop && loopRange) { setLoopRange(null); engine?.setPracticeLoop(null); }
    engine?.reset(next); setBar(next); setSessionStartBar(next); setMatched([]); setWrong([]); setWrongCount(0); setMessage("");
    matchedDrumsRef.current.clear(); setMatchedDrums([]); setDrumMistakes(0); setDrumFeedback(""); setDrumAttempts([]); lastCycle.current = 0;
    setStepIndex(Math.max(0, introNotes.findIndex(note => note.bar >= next)));
  }
  function chooseLoop(range: { start: number; end: number } | null) {
    setLoopRange(range); engine?.setPracticeLoop(range);
    seek(range?.start ?? 1, true);
  }
  function changeMode(next: Mode) { if (next === mode) return; seek(bar); setMode(next); }
  function start() {
    if (!audioReady) { setMessage("Enable audio first."); return; }
    if (instrumentError) { setMessage("Wait for the selected instrument to load."); return; }
    if (!engine) return;
    if (mode === "step" && bar <= 4) { setMessage("Play the highlighted physical keys to reach bar 5."); return; }
    if (mode === "step" && clock?.status === "paused") { setMessage("Play the highlighted Z or X drum hit to continue."); return; }
    if (mode === "timed" && clock?.status === "paused") { engine.resume(); return; }
    const started = engine.startAt(bar, mode, mode === "step" && bar > 5);
    setMessage(started ? "" : "Instrument or drum samples are still loading.");
  }
  const liveTargets = introNotes.filter(note => note.bar >= sessionStartBar);
  const missed = mode === "timed" ? introNotes.filter((note, index) => note.bar >= sessionStartBar && note.startBeat < currentBeat - tolerance / 1000 * rosesIntroTempo * speed / 100 / 60 && !introMatched.has(index)).length : 0;
  const accuracy = matched.length + missed + wrongCount ? Math.round(matched.length / (matched.length + missed + wrongCount) * 100) : 100;
  const drumMissed = mode === "timed" ? rosesDrumTargets.filter(target => target.bar >= sessionStartBar && target.startBeat < currentBeat - tolerance / 1000 * rosesIntroTempo * speed / 100 / 60 && !matchedDrumsRef.current.has(target.id)).length : 0;
  const drumAccuracy = matchedDrums.length + drumMissed + drumMistakes ? Math.round(matchedDrums.length / (matchedDrums.length + drumMissed + drumMistakes) * 100) : 100;

  return <main className="practice-studio roses-practice">
    <header className="practice-header"><div><span className="practice-overline">STAGE PIANO / ROSES INTRO BUILDER</span><h1>Roses — first 36 bars</h1><span>100 BPM · 4/4 · T / U / Y live · Z kick / X clap</span></div><div className="practice-header-actions">{!audioReady && <button className="practice-primary" onClick={startAudio}>Enable audio</button>}<button onClick={onSandbox}>Sandbox</button><button onClick={onPerformance}>Fullscreen performance</button><button onClick={onExit}>Back</button></div></header>
    <section className="practice-sheet" aria-label="Roses interactive keyboard sheet"><div className="practice-sheet-top"><div><strong>KEYBOARD SHEET</strong><span>Bar {bar} / {rosesIntroBars} · Beat {clock && clock.status !== "idle" ? clock.beat.toFixed(2) : currentNote?.beatInBar.toFixed(1) ?? "1.0"}</span></div><span>{mode === "step" ? bar <= 4 ? "Play each highlighted note" : clock?.status === "paused" ? "Play the highlighted drum hit" : "Start the drum drill" : clock?.status === "running" ? "Score clock running" : "Score clock stopped"}</span></div>
      <RosesBeatClock engine={engine} clock={clock} leadMs={calibration.leadMs} feedback={drumFeedback} closerSettings={closerSettings} />
      <div className="roses-closer-cue">BUILD {clock?.buildPending ? "ARMED" : clock?.buildActive ? "PLAYING" : "OFF"} · HERE WITH ME {closerSettings.enabled ? clock?.closerStatus ?? "LOADING" : "OFF"} → {closerTarget(closerSettings).label}</div>
      <div className="practice-measures" ref={sheet}>{Array.from({ length: rosesIntroBars }, (_, index) => index + 1).map(measure => {
        const notes = rosesIntroBarNotes(measure);
        const active = bar === measure;
        const beat = clock?.status !== "idle" && clock?.measure === measure ? clock.beat : 0;
        const measureStart = (measure - 1) * 4;
        const closerBeat = closerCuePlan(closerSettings, 60 / (rosesIntroTempo * speed / 100)).onsetBeat;
        return <div className={`practice-measure ${active ? "is-current" : ""} ${measure < bar ? "is-past" : ""}`} data-measure={measure} key={measure}>
          <button className="practice-measure-head" onClick={() => seek(measure)}><b>{String(measure).padStart(2, "0")}</b><span>{measure >= 29 ? measure === 36 ? "FINAL BREAK → DROP NEXT" : "VOX + BASS + BUILD PERCUSSION" : measure >= 21 ? "GUITAR + BUILD BASS" : measure <= 4 ? "LIVE SYNTH" : measure <= 8 ? "SYNTH + KICK" : measure <= 12 ? "SYNTH + KICK + CLAP" : "SYNTH + BASS + LIVE DRUMS"}</span></button>
          {measure <= 4 ? <div className="roses-note-grid">{notes.map(note => {
            const noteIndex = introNotes.indexOf(note);
            const current = mode === "step" && stepIndex === noteIndex && active;
            const done = introMatched.has(noteIndex);
            return <div key={note.startBeat} className={`roses-note-bar ${current ? "is-active" : ""} ${done ? "is-done" : ""}`} style={{ left: `${(note.beatInBar - 1) * 25}%`, width: `${note.durationBeats * 25}%`, top: note.midi === 64 ? "58%" : "20%" }} title={`${midiToName(note.midi)} · beat ${note.beatInBar} · ${note.durationBeats} beats`}><strong>{labelForMidi(map, note.midi + transpose, transpose) || "?"}</strong><small>{midiToName(note.midi)} · {note.durationBeats} beats</small></div>;
          })}{beat > 0 && <i className="roses-playhead" style={{ left: `${(beat - 1) * 25}%` }} />}</div> : measure >= 29 ? <div className="roses-layer-grid has-bass">
            <div className="roses-layer-row"><b>BUILD BASS</b><span>{buildupBass.filter(note => note.beat < measureStart + 4 && note.end > measureStart).map(note => <i key={note.beat} className="roses-bass-hit" style={{ left: `${Math.max(0, note.beat - measureStart) * 25}%`, width: `${(Math.min(note.end, measureStart + 4) - Math.max(note.beat, measureStart)) * 25}%` }}>{midiToName(note.midi)}</i>)}</span></div>
            {(["vox", "spacy", "roll", "chops", "snap"] as const).map(layer => <div className="roses-layer-row" key={layer}><b>{layer.toUpperCase()} AUTO</b><span>{buildupEvents.filter(event => event.layer === layer && event.beat < measureStart + 4 && event.end > measureStart).map(event => <i key={event.beat} className={`roses-layer-hit ${layer === "spacy" || layer === "roll" ? "clap" : "synth"}`} style={{ left: `${Math.max(0, event.beat - measureStart) * 25}%`, width: ["vox", "chops"].includes(layer) ? `${(Math.min(event.end, measureStart + 4) - Math.max(event.beat, measureStart)) * 25}%` : undefined }} title={`${layer} · ${(event.beat % 4) + 1} · ends ${event.end}`} />)}</span></div>)}
            <div className="roses-layer-row"><b>Z KICK LIVE</b><span>{buildupKick.filter(at => at >= measureStart && at < measureStart + 4).map(at => <i key={at} className={`roses-layer-hit kick ${matchedDrums.includes(`buildup-kick-${buildupKick.indexOf(at)}`) ? "is-done" : ""}`} style={{ left: `${(at - measureStart) * 25}%` }} title={`Z · beat ${at % 4 + 1}`} />)}</span></div>
            <small>{buildupStatusText(measureStart)}</small>{beat > 0 && <i className="roses-playhead" style={{ left: `${(beat - 1) * 25}%` }} />}
          </div> : measure >= 21 ? <div className="roses-layer-grid has-bass">
            <div className="roses-layer-row"><b>GUITAR WAV</b><span><i className="roses-bass-hit" style={{ left: "0%", width: "100%" }} title="Guitar build runs from bar 21 to bar 25" /></span></div>
            <div className="roses-layer-row"><b>BUILD BASS</b><span>{rosesBuildBassNotes.filter(note => note.startBeat < measureStart + 4 && note.startBeat + note.durationBeats > measureStart).map(note => <i key={note.startBeat} className="roses-bass-hit" style={{ left: `${Math.max(0, note.startBeat - measureStart) * 25}%`, width: `${(Math.min(measureStart + 4, note.startBeat + note.durationBeats) - Math.max(measureStart, note.startBeat)) * 25}%` }} title={`${midiToName(note.midi)} · ${note.durationBeats} beats`}>{midiToName(note.midi)}{note.bar < measure ? " held" : ""}</i>)}</span></div>
            <div className="roses-layer-row"><b>Z / X LIVE</b><span>No required drum hits</span></div>
            {closerBeat >= measureStart && closerBeat < measureStart + 4 && <div className="roses-layer-row roses-closer-marker"><b>HERE WITH ME {closerSettings.enabled ? "AUTO" : "OFF"}</b><span><i className="roses-accent-cue" style={{ left: `${(closerBeat - measureStart) * 25}%` }} title={`Here With Me entrance · ${closerTarget(closerSettings).label}`} /></span></div>}
            {beat > 0 && <i className="roses-playhead" style={{ left: `${(beat - 1) * 25}%` }} />}
          </div> : <div className={`roses-layer-grid ${measure >= 13 ? "has-bass" : ""}`}>
            <div className="roses-layer-row"><b>LOOP SYNTH</b><span>{notes.map(note => <i key={note.startBeat} className="roses-layer-hit synth" style={{ left: `${(note.beatInBar - 1) * 25}%` }} title={`MIDI ${note.midi} · beat ${note.beatInBar}`} />)}</span></div>
            {measure >= 13 && <><div className="roses-layer-row"><b>BASS AUTO</b><span>{rosesBassNotes.filter(note => note.bar === measure).map(note => <i key={note.startBeat} className="roses-bass-hit" style={{ left: `${(note.beatInBar - 1) * 25}%`, width: `${note.durationBeats * 25}%` }} title={`${midiToName(note.midi)} · ${note.durationBeats} beats`}>{midiToName(note.midi)}</i>)}</span></div><div className="roses-layer-row"><b>SUB AUTO</b><span>{rosesSubNotes.filter(note => note.bar === measure).map(note => <i key={note.startBeat} className="roses-bass-hit sub" style={{ left: `${(note.beatInBar - 1) * 25}%`, width: `${note.durationBeats * 25}%` }} title={`${midiToName(note.midi)} · ${note.durationBeats} beats`} />)}</span></div></>}
            <div className="roses-layer-row"><b>Z · KICK</b><span>{rosesDrumTargets.filter(target => target.bar === measure && target.kind === "kick").map(target => <i key={target.id} className={`roses-layer-hit kick ${matchedDrums.includes(target.id) ? "is-done" : stepTargets.some(item => item.id === target.id) ? "is-active" : mode === "timed" && target.startBeat < currentBeat - tolerance / 1000 * rosesIntroTempo * speed / 100 / 60 ? "is-missed" : ""}`} style={{ left: `${(target.beatInBar - 1) * 25}%` }} title={`Z kick · beat ${target.beatInBar}`} />)}{drumAttempts.filter(attempt => attempt.bar === measure && attempt.kind === "kick").map((attempt, index) => <i key={`kick-attempt-${index}`} className={`roses-drum-attempt ${attempt.result}`} style={{ left: `${(attempt.beat - 1) * 25}%` }} title={`${attempt.result} kick`} />)}</span></div>
            {measure >= 9 && <div className="roses-layer-row"><b>X · CLAP</b><span>{rosesDrumTargets.filter(target => target.bar === measure && target.kind === "clap").map(target => <i key={target.id} className={`roses-layer-hit clap ${matchedDrums.includes(target.id) ? "is-done" : stepTargets.some(item => item.id === target.id) ? "is-active" : mode === "timed" && target.startBeat < currentBeat - tolerance / 1000 * rosesIntroTempo * speed / 100 / 60 ? "is-missed" : ""}`} style={{ left: `${(target.beatInBar - 1) * 25}%` }} title={`X clap · beat ${target.beatInBar}`} />)}{drumAttempts.filter(attempt => attempt.bar === measure && attempt.kind === "clap").map((attempt, index) => <i key={`clap-attempt-${index}`} className={`roses-drum-attempt ${attempt.result}`} style={{ left: `${(attempt.beat - 1) * 25}%` }} title={`${attempt.result} clap`} />)}</span></div>}
            {rosesAccentTargets.some(target => target.bar === measure) && <div className="roses-layer-row"><b>M · ACCENT</b><span><i className="roses-accent-cue" style={{ left: "75%" }} title="Suggested vocal accent · beat 4" /></span></div>}
            {beat > 0 && <i className="roses-playhead" style={{ left: `${(beat - 1) * 25}%` }} />}
          </div>}
          <div className="practice-beats">{[1, 2, 3, 4].map(value => <span key={value} style={{ left: `${(value - 1) * 25}%` }}>{value}</span>)}</div>
        </div>;
      })}</div>
      <div className="practice-prompt"><span>NEXT</span><strong>{currentNote ? `[${labelForMidi(map, currentNote.midi + transpose, transpose)}]` : bar > 4 ? stepTargets.length ? `[${stepTargets.map(target => target.code === "KeyZ" ? "Z" : "X").join("")}]` : `BAR ${bar}` : "INTRO"}</strong><small>{currentNote ? `${midiToName(currentNote.midi)} · beat ${currentNote.beatInBar} · hold ${currentNote.durationBeats} beats${bar === 4 ? ` · Arm ${vocalKey.replace("Key", "")} for bar 5` : ""}` : bar >= 21 ? "Armed guitar/bass continue through bar 28 automatically. Z/X stay live without required hits." : bar >= 13 ? "Synth continues · N arms bass/sub · Z/X drums stay live" : bar > 4 ? "V arms the synth loop; play drums yourself with Z and X" : "Play the exact intro notes"}</small>{wrong.length > 0 && <em>Wrong pitch: {wrong.map(midiToName).join(", ")}</em>}{drumFeedback && <em>{drumFeedback}</em>}</div>
    </section>
    <section className="practice-controls roses-practice-controls" aria-label="Roses practice controls"><div className="practice-control-row"><label>Song <select value="roses" onChange={event => onSongChange(event.target.value as SongId)}><option value="roses">Roses — Intro Builder</option><option value="interstellar">Interstellar</option><option value="levels">Levels</option><option value="rush-e">Rush E</option></select></label><div className="practice-segment"><button className={mode === "step" ? "selected" : ""} onClick={() => changeMode("step")}>Step</button><button className={mode === "timed" ? "selected" : ""} onClick={() => changeMode("timed")}>Timed</button><button onClick={onSandbox}>Sandbox</button></div><button className="practice-primary" onClick={start} disabled={!audioReady || drumStatus !== "ready" || clock?.status === "running" || mode === "step" && clock?.status === "paused"}>{mode === "step" ? clock?.status === "paused" ? "Play Z / X" : "Start drum drill" : clock?.status === "running" ? "Running" : clock?.status === "paused" ? "Resume" : "Start"}</button>{(mode === "timed" || bar > rosesIntroBars) && <button onClick={() => clock?.status === "paused" ? mode === "step" ? engine?.resumeStep() : engine?.resume() : engine?.pause()} disabled={clock?.status !== "running" && clock?.status !== "paused"}>{clock?.status === "paused" ? "Resume" : "Pause"}</button>}<button onClick={() => seek(bar)}>Restart bar</button><button onClick={() => seek(1)}>Reset intro</button></div>
      <div className="practice-control-row"><span>Jump to</span>{[1, 5, 9, 13, 17, 19, 21, 23, 25, 27, 29, 33, 36].map(value => <button key={value} onClick={() => seek(value)}>Bar {value}</button>)}<label>Speed <output>{speed}%</output><input type="range" min="50" max="125" step="5" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label><label>Timing ±<output>{tolerance} ms</output><input type="range" min="100" max="500" step="10" value={tolerance} onChange={event => setTolerance(Number(event.target.value))} disabled={mode !== "timed"} /></label><span className="practice-accuracy">{liveTargets.length > 0 && `${mode === "timed" ? matched.length : Math.min(stepIndex, 8)}/${liveTargets.length} live notes${mode === "timed" ? ` · ${accuracy}%` : ""} · `}{matchedDrums.length} drums {mode === "timed" ? `· ${drumMissed} missed · ${drumAccuracy}%` : "correct"}</span></div>
      <div className="practice-control-row roses-loop-controls"><span>Practice loop</span>{[[13, 16], [17, 20], [19, 24], [21, 24], [25, 28], [21, 28], [19, 28], [1, 24], [1, 28]].map(([start, end]) => <button key={`${start}-${end}`} className={loopRange?.start === start && loopRange.end === end ? "selected" : ""} onClick={() => chooseLoop({ start, end })}>{start}–{end}</button>)}<button onClick={() => chooseLoop(null)}>No loop</button><span>{loopRange?.start && loopRange.start >= 13 ? "Prepare backing before Start. Armed F6 backing repeats at bar 25 automatically." : "Loop repeats at its end; Step returns to the first bar."}</span></div>
      <RosesBuildupControls engine={engine} clock={clock} settings={buildupSettings} onChange={onBuildupSettings} mode={mode} onRehearse={start => { seek(start); engine?.rehearseBuildup(start, mode); }} />
      <RosesCloserControls settings={closerSettings} onChange={onCloserSettings} status={clock?.closerStatus} />
      {speed !== 100 && closerSettings.enabled && <p className="practice-warning">Here With Me stays at its original speed. Use 100% Practice speed to audition this entrance against the 100 BPM backing.</p>}
      <div className="practice-control-row roses-layer-controls"><button className={clock?.synthActive ? "selected" : ""} onClick={() => engine?.armSynth()} disabled={!audioReady}>V · Synth {clock?.synthPending !== undefined ? clock.synthPending ? "ARMED" : "STOP QUEUED" : clock?.synthActive ? "ON" : "OFF"}</button><button className={clock?.bassActive ? "selected" : ""} onClick={() => engine?.armBass()} disabled={!audioReady}>N · Bass/Sub {clock?.bassPending !== undefined ? clock.bassPending ? "ARMED" : "STOP QUEUED" : clock?.bassActive ? "PLAYING" : "NOT ARMED"}</button><button className={clock?.buildActive || clock?.buildPending ? "selected" : ""} onClick={() => engine?.armBuild()} disabled={!audioReady || clock?.status === "running" && clock.measure >= 21}>F6 · Build {clock?.buildPending ? "ARMED" : clock?.buildActive ? "PLAYING" : "NOT ARMED"}</button><button className={clock?.vocalStatus === "ARMED" || clock?.vocalStatus === "PLAYING" ? "selected" : ""} onClick={() => engine?.armVocal()} disabled={!audioReady || !clock?.vocalReady || clock?.status === "running" && clock.measure !== 4}>{vocalKey.replace("Key", "")} · Vocal {clock?.vocalStatus ?? "NOT ARMED"}</button><button onClick={() => engine?.stopLoop()}>B · Stop backing</button><span>{clock?.missedBassHandoff && !clock.bassActive ? "MISSED BASS HANDOFF · N recovers on next downbeat" : clock?.status === "finished" ? "FINISHED after bar 28" : "Z kick · X clap live · M accent optional"}</span></div>
      <div className="practice-control-row roses-vocal-controls"><span>Vocal WAV {clock?.vocalReady ? "READY" : "LOADING / UNAVAILABLE"} · arm in bar 4 → plays at bar 5 (first lyric near beat 3)</span><label>Arm key <select value={vocalKey} onChange={event => onVocalKey(event.target.value)}><option value="KeyL">L</option><option value="KeyC">C</option><option value="KeyG">G</option></select></label><label>Source offset <input type="number" min="0" max="225" step="0.01" value={vocalOffset} onChange={event => onVocalOffset(Number(event.target.value))} /> seconds</label><input aria-label="Vocal source offset" type="range" min="8.6" max="10.6" step="0.01" value={vocalOffset} onChange={event => onVocalOffset(Number(event.target.value))} /><small>9.60 s is the supplied starting estimate; adjust by ear against the synth loop.</small></div>
      <div className="practice-control-row roses-bass-mix"><label>V Synth <output>{Math.round(synthLevel * 100)}%</output><input aria-label="V Synth backing level" type="range" min="0" max="150" step="5" value={Math.round(synthLevel * 100)} onChange={event => onSynthLevel(Number(event.target.value) / 100)} /></label><label>Synth lead <output>{synthLeadMs} ms</output><input aria-label="V Synth timing lead" type="range" min="0" max="60" step="5" value={synthLeadMs} onChange={event => onSynthLeadMs(Number(event.target.value))} /></label><label>Bass <output>{Math.round(bassLevels.bass * 100)}%</output><input type="range" min="0" max="100" value={Math.round(bassLevels.bass * 100)} onChange={event => onBassLevels({ ...bassLevels, bass: Number(event.target.value) / 100 })} /></label><label>Sub <output>{Math.round(bassLevels.sub * 100)}%</output><input type="range" min="0" max="100" value={Math.round(bassLevels.sub * 100)} onChange={event => onBassLevels({ ...bassLevels, sub: Number(event.target.value) / 100 })} /></label><span>Sylenth1/Nexus sounds are approximated locally; MIDI timing is exact.</span></div>
      <div className="practice-control-row"><label>Instrument <select value={instrumentId} onChange={event => onInstrument(event.target.value)}><option value="roses">Roses Future Bass Lead</option><option value={bundledRosesInstrument.id}>Experimental E4 Sample</option>{instrumentId !== "roses" && instrumentId !== bundledRosesInstrument.id && <option value={instrumentId}>Selected Sandbox Instrument</option>}</select></label><span>{instrumentName}</span><span className="instrument-hint">The E4 slice is 0.8 s; sustained notes may end early. Open Sandbox for all sounds and A/B settings.</span></div>
      <RosesCalibration engine={engine} clock={clock} settings={calibration} onSettings={onCalibration} outputLabel={output.label} latency={{ base: output.base, output: output.output }} audioReady={audioReady} onStartTest={() => { chooseLoop(null); setSpeed(100); engine?.setSpeed(1); engine?.startAt(1, "timed"); setMode("timed"); }} />
      {drumStatus !== "ready" && <p className="practice-warning">Roses drum samples: {drumStatus === "loading" ? "loading…" : "could not load; free-play synth remains available"}</p>}{instrumentError && <p className="practice-warning">{instrumentError}</p>}{message && <p className="practice-warning">{message}</p>}
      <p className="roses-practice-hint">T = E4 · U = G♯4 · Y = F♯4. V arms synth at bar 5; {vocalKey.replace("Key", "")} arms vocals in bar 4 for bar 5; N arms bass/sub at bar 13; F6 arms guitar/build bass. Guitar/bass repeat automatically at bar 25. Here With Me enters automatically at the selected cue (default 27:1&amp;). Z kick, X clap, M accent, B stop, Space pedal.</p>
    </section>
    <section className="practice-piano" aria-label="Roses practice piano"><div className="practice-piano-top"><span>VIRTUAL PIANO · {map.name}</span><span>{snapshot.pressed.length} notes down · {snapshot.notesPerSecond} notes/s</span></div><p className="roses-practice-hint">{rosesChordHint}</p><div className="roses-live-trails"><PerformanceVisualizer notes={liveNotes} map={map} transpose={transpose} theme="roses" notesPerSecond={snapshot.notesPerSecond} range={range} /></div><PianoCanvas active={pressed} expected={expected} wrong={wrong} map={map} transpose={transpose} range={range} labelMode="computer" practicePalette /></section>
  </main>;
}
