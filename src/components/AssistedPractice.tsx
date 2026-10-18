import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import PianoCanvas from "./PianoCanvas";
import PerformanceVisualizer from "./PerformanceVisualizer";
import SustainSettings, { type SustainSettingsValue } from "./SustainSettings";
import InterstellarAudioSettings from "./InterstellarAudioSettings";
import type { InterstellarMix } from "../piano/interstellarMix";
import { assistedEvents, type AssistedEvent } from "../piano/assistedSong";
import assistedSource from "../piano/interstellar_assisted_bars_9_13.json";
import { midiToName, type KeyboardMap } from "../piano/noteMapping";
import type { InputSnapshot } from "../piano/keyboardInput";
import type { LiveNotes } from "../piano/liveNotes";

type Props = {
  map: KeyboardMap;
  snapshot: InputSnapshot;
  audioReady: boolean;
  startAudio: () => void;
  onNoteRef: MutableRefObject<((midi: number, code: string, at: number) => void) | null>;
  onUnmappedRef: MutableRefObject<((code: string, at: number) => void) | null>;
  onExit: () => void;
  onExitAssisted: () => void;
  onSandbox: () => void;
  triggerAssisted: (event: AssistedEvent) => void;
  resetAssisted: () => void;
  sustainSettings: SustainSettingsValue;
  setSustainSettings: (value: SustainSettingsValue) => void;
  sustainActive: boolean;
  showAssistedNotes: boolean;
  setShowAssistedNotes: (value: boolean) => void;
  liveNotes: LiveNotes;
  onMeasureChange: (measure: number) => void;
  interstellarMix: InterstellarMix;
  setInterstellarMix: (value: InterstellarMix) => void;
};

export default function AssistedPractice({ map, snapshot, audioReady, startAudio, onNoteRef, onUnmappedRef, onExit, onExitAssisted, onSandbox, triggerAssisted, resetAssisted, sustainSettings, setSustainSettings, sustainActive, showAssistedNotes, setShowAssistedNotes, liveNotes, onMeasureChange, interstellarMix, setInterstellarMix }: Props) {
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [wrongCode, setWrongCode] = useState("");
  const [complete, setComplete] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const wrongTimer = useRef<number | null>(null);
  const loopTimer = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const current = assistedEvents[index];
  const measure = current?.bar ?? 13;
  const preferredLabels = useMemo(() => Object.fromEntries(Object.values(assistedSource.keyboardMapping).map(item => [item.midi, item.label])), []);
  const held = snapshot.pressed.map(item => item.midi);

  useEffect(() => { onMeasureChange(measure); }, [measure, onMeasureChange]);
  useEffect(() => {
    sheetRef.current?.querySelector(`[data-measure="${measure}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [measure]);
  useEffect(() => {
    onNoteRef.current = (midi, code) => {
      if (!audioReady || complete || loopTimer.current !== null) return;
      const event = assistedEvents[index];
      if (!event || event.code !== code || event.liveMidi !== midi) {
        setWrongCode("");
        setWrong([midi]);
        if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
        wrongTimer.current = window.setTimeout(() => setWrong([]), 500);
        return;
      }
      setWrong([]);
      setWrongCode("");
      if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
      triggerAssisted(event);
      if (index === assistedEvents.length - 1) {
        if (repeat) {
          loopTimer.current = window.setTimeout(() => {
            loopTimer.current = null;
            resetAssisted();
            setIndex(0);
          }, 600);
        } else setComplete(true);
      } else setIndex(index + 1);
    };
    return () => { onNoteRef.current = null; };
  }, [audioReady, complete, index, repeat, triggerAssisted, resetAssisted, onNoteRef]);
  useEffect(() => {
    onUnmappedRef.current = code => {
      if (!audioReady || complete) return;
      setWrong([]);
      setWrongCode(code);
      if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrongCode(""), 500);
    };
    return () => { onUnmappedRef.current = null; };
  }, [audioReady, complete, onUnmappedRef]);
  useEffect(() => () => {
    if (wrongTimer.current !== null) clearTimeout(wrongTimer.current);
    if (loopTimer.current !== null) clearTimeout(loopTimer.current);
    resetAssisted();
  }, []);

  function restart() {
    if (loopTimer.current !== null) { clearTimeout(loopTimer.current); loopTimer.current = null; }
    resetAssisted();
    setIndex(0);
    setComplete(false);
    setWrong([]);
    setWrongCode("");
  }
  function chooseBar(bar: number) {
    if (loopTimer.current !== null) { clearTimeout(loopTimer.current); loopTimer.current = null; }
    resetAssisted();
    setIndex(assistedEvents.findIndex(event => event.bar === bar));
    setComplete(false);
    setWrong([]);
    setWrongCode("");
  }

  return <main className="practice-studio assisted-studio">
    <header className="practice-header"><div><span className="practice-overline">STAGE PIANO / ASSISTED PRACTICE</span><h1>Interstellar · Bars 9–13</h1><span>Right hand: physical keys · left hand: follows each correct press</span></div><div className="practice-header-actions">{!audioReady && <button className="practice-primary" onClick={startAudio}>Enable piano audio</button>}<button onClick={onExitAssisted}>Full score</button><button onClick={onSandbox}>Sandbox</button><button onClick={onExit}>Back to piano</button></div></header>
    <section className="practice-sheet" aria-label="Assisted keyboard sheet"><div className="practice-sheet-top"><div><strong>ASSISTED FINGERING</strong><span>Bar {measure} / 13 · Event {Math.min(index + 1, 60)} / 60</span></div><span>Accompaniment follows your keys</span></div><div className="practice-measures" ref={sheetRef}>
      {assistedSource.bars.map(bar => <div className={`practice-measure ${bar.bar === measure ? "is-current" : ""} ${bar.bar < measure ? "is-past" : ""}`} data-measure={bar.bar} key={bar.bar}>
        <button className="practice-measure-head" onClick={() => chooseBar(bar.bar)}><b>{String(bar.bar).padStart(2, "0")}</b><span>3/4 · 12 events</span></button>
        <div className="assisted-fingering-grid">{bar.events.map((event, offset) => {
          const absolute = (bar.bar - 9) * 12 + offset;
          return <div className={`assisted-event ${absolute === index && !complete ? "is-active" : ""} ${absolute < index || complete ? "is-done" : ""}`} key={offset} title={`Beat ${event.beat} · ${event.livePitch} with ${event.assistedPitches.join(" + ")}`}>
            <strong>{event.displayKey}</strong><small>{event.assistedPitches.join("+")}</small>
          </div>;
        })}</div>
        <div className="practice-beats"><span>1</span><span style={{ left: "33.33%" }}>2</span><span style={{ left: "66.66%" }}>3</span></div>
      </div>)}
    </div><div className="practice-prompt"><span>{complete ? "DONE" : "NEXT"}</span><strong>{complete ? "Section complete" : current?.label}</strong><small>{complete ? "Restart to play again" : `${current && midiToName(current.liveMidi)} + assisted ${current?.assistedMidi.map(midiToName).join(" · ")}`}</small>{wrong.length > 0 && <em>Expected {current?.label}; heard {wrong.map(midiToName).join(", ")}</em>}{wrongCode && <em>Expected {current?.label}; {wrongCode} is unmapped</em>}</div></section>
    <section className="practice-controls assisted-controls"><div className="practice-control-row"><button className="practice-primary" onClick={restart}>Restart section</button><label><input type="checkbox" checked={repeat} onChange={event => setRepeat(event.target.checked)} /> Repeat section</label><label><input type="checkbox" checked={showAssistedNotes} onChange={event => setShowAssistedNotes(event.target.checked)} /> Show Assisted Notes</label><span className="practice-accuracy">{index + (complete ? 1 : 0)} / 60 correct events</span></div><InterstellarAudioSettings value={interstellarMix} onChange={setInterstellarMix} /><SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} /></section>
    <div className="assisted-trails"><PerformanceVisualizer notes={liveNotes} map={map} transpose={0} theme="cosmic" notesPerSecond={snapshot.notesPerSecond} showAssisted={showAssistedNotes} /></div>
    <section className="practice-piano" aria-label="Assisted piano"><div className="practice-piano-top"><span>LIVE KEYBOARD · {map.name}</span><span>{snapshot.pressed.length} keys down · {snapshot.notesPerSecond} notes/s</span></div><PianoCanvas active={held} expected={current && !complete ? [current.liveMidi] : []} wrong={wrong} completed={[]} map={map} transpose={0} labelMode="computer" preferredLabels={preferredLabels} practicePalette /></section>
  </main>;
}
