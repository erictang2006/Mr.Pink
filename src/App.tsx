import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import PianoCanvas from "./components/PianoCanvas";
import PracticeStudio from "./components/PracticeStudio";
import SustainSettings, { type SustainSettingsValue } from "./components/SustainSettings";
import PerformanceVisualizer, {
  type Theme,
} from "./components/PerformanceVisualizer";
import { PianoAudioEngine } from "./piano/audioEngine";
import {
  KeyboardInputManager,
  type InputSnapshot,
} from "./piano/keyboardInput";
import { midiToName, standardMap, type KeyboardMap } from "./piano/noteMapping";
import { LiveNotes } from "./piano/liveNotes";
import { pianoRange } from "./piano/geometry";
import {
  duplicatePitches,
  assistedInterstellarMap,
  interstellarMap,
  loadProfiles,
  physicalCodes,
  saveProfiles,
  validateProfile,
} from "./piano/profiles";
import type { AssistedEvent } from "./piano/assistedSong";
import importedSong from "./piano/interstellar.song.json";

const emptySnapshot: InputSnapshot = {
  pressed: [],
  detected: [],
  shift: false,
  notesPerSecond: 0,
};
const themes: Theme[] = ["rush", "cosmic", "minimal"];
const shortcutOptions = [
  "Backquote",
  "BracketLeft",
  "BracketRight",
  "Backslash",
];
const savedValue = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [audioState, setAudioState] = useState<
    "locked" | "loading" | "ready" | "error"
  >("locked");
  const [captureEnabled, setCaptureEnabled] = useState(true);
  const [view, setView] = useState<"practice" | "studio" | "performance">(
    () => ["practice", "assisted"].includes(new URLSearchParams(window.location.search).get("view") ?? "") ? "studio" : "practice",
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = savedValue("stage-piano-theme", "rush") as Theme;
    return themes.includes(saved) ? saved : "rush";
  });
  const [themeShortcut, setThemeShortcut] = useState(() => {
    const saved = savedValue("stage-piano-theme-shortcut", "Backquote");
    return shortcutOptions.includes(saved) ? saved : "Backquote";
  });
  const [showHud, setShowHud] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [profiles, setProfiles] = useState<KeyboardMap[]>(loadProfiles);
  const [profileId, setProfileId] = useState(() =>
    ["practice", "assisted"].includes(new URLSearchParams(window.location.search).get("view") ?? "")
      ? new URLSearchParams(window.location.search).get("view") === "assisted" ? assistedInterstellarMap.id : interstellarMap.id
      : savedValue("stage-piano-active-profile", "standard") === assistedInterstellarMap.id ? interstellarMap.id : savedValue("stage-piano-active-profile", "standard"),
  );
  const [expected, setExpected] = useState("");
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingMessage, setMappingMessage] = useState("");
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [volume, setVolume] = useState(72);
  const [transpose, setTranspose] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [practiceLabels, setPracticeLabels] = useState(true);
  const [performanceLabels, setPerformanceLabels] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(330);
  const [sustainSettings, setSustainSettings] = useState<SustainSettingsValue>(() => {
    const defaults: SustainSettingsValue = { mode: "toggle", shortcut: "Space", releaseSeconds: 0.55, autoStart: 9, autoEnd: 13, showIndicator: true };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem("stage-piano-sustain-settings") || "{}") }; }
    catch { return defaults; }
  });
  const [sustainActive, setSustainActive] = useState(false);
  const [showAssistedNotes, setShowAssistedNotes] = useState(false);
  const [practiceMeasure, setPracticeMeasure] = useState(1);
  const sustainRef = useRef(false);
  const pedalKeyHeld = useRef(false);
  const assistedTimers = useRef(new Map<number, { timer: number; midi: number; code: string }>());
  const assistedNextId = useRef(1);
  const audio = useRef<PianoAudioEngine | null>(null);
  const keyboard = useRef<KeyboardInputManager | null>(null);
  const liveNotes = useRef(new LiveNotes());
  const stage = useRef<HTMLElement | null>(null);
  const importInput = useRef<HTMLInputElement | null>(null);
  const testTimer = useRef<number | null>(null);
  const testNotes = useRef<number[]>([]);
  const practiceNote = useRef<((midi: number, code: string, at: number) => void) | null>(null);
  const practiceUnmapped = useRef<((code: string, at: number) => void) | null>(null);
  const previousTranspose = useRef(0);

  useEffect(() => {
    const engine = new PianoAudioEngine();
    audio.current = engine;
    engine.setVolume(volume / 100);
    const input = new KeyboardInputManager(standardMap, {
      noteOn: (midi, code, at) => {
        if (engine.noteOn(midi)) liveNotes.current.dampPitch(midi, at);
        liveNotes.current.on(code, midi, at);
        practiceNote.current?.(midi, code, at);
      },
      noteOff: (midi, code, at) => {
        engine.noteOff(midi);
        liveNotes.current.off(code, at, sustainRef.current);
      },
      change: setSnapshot,
      unmappedKeyDown: (code, at) => practiceUnmapped.current?.(code, at),
    });
    keyboard.current = input;
    return () => {
      input.dispose();
      testNotes.current.forEach((note) => engine.noteOff(note));
      for (const voice of assistedTimers.current.values()) window.clearTimeout(voice.timer);
      assistedTimers.current.clear();
      engine.dispose();
      if (testTimer.current !== null) window.clearTimeout(testTimer.current);
      keyboard.current = null;
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    keyboard.current?.setEnabled(
      audioState === "ready" && (captureEnabled || view === "performance" || view === "studio"),
    );
  }, [audioState, captureEnabled, view]);
  useEffect(() => {
    audio.current?.setVolume(volume / 100);
  }, [volume]);
  useEffect(() => {
    audio.current?.setRelease(sustainSettings.releaseSeconds);
    try { localStorage.setItem("stage-piano-sustain-settings", JSON.stringify(sustainSettings)); } catch { /* storage unavailable */ }
  }, [sustainSettings]);
  useEffect(() => {
    if (sustainSettings.mode === "automatic")
      setPedal(view === "studio" && practiceMeasure >= sustainSettings.autoStart && practiceMeasure <= sustainSettings.autoEnd);
    else if (sustainRef.current && sustainSettings.mode === "hold" && !pedalKeyHeld.current) setPedal(false);
  }, [sustainSettings.mode, sustainSettings.autoStart, sustainSettings.autoEnd, practiceMeasure, view]);
  useEffect(() => {
    const code = sustainSettings.shortcut;
    const onDown = (event: KeyboardEvent) => {
      if (event.code !== code) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      if (event.repeat || pedalKeyHeld.current) return;
      pedalKeyHeld.current = true;
      if (sustainSettings.mode === "hold") setPedal(true);
      if (sustainSettings.mode === "toggle") setPedal(!sustainRef.current);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.code !== code) return;
      event.preventDefault();
      pedalKeyHeld.current = false;
      if (sustainSettings.mode === "hold") setPedal(false);
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => { window.removeEventListener("keydown", onDown, true); window.removeEventListener("keyup", onUp, true); };
  }, [sustainSettings.mode, sustainSettings.shortcut]);
  useEffect(() => {
    const onBlur = () => { pedalKeyHeld.current = false; panic(); };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);
  useEffect(() => {
    keyboard.current?.setTranspose(transpose);
  }, [transpose]);
  useEffect(() => {
    keyboard.current?.setReservedCodes(
      view === "performance"
        ? [themeShortcut, "F7", "F8", "F9", "Escape", sustainSettings.shortcut]
        : ["F9", sustainSettings.shortcut],
    );
  }, [view, themeShortcut, sustainSettings.shortcut]);
  const activeProfile =
    profiles.find((profile) => profile.id === profileId) ??
    profiles[0] ??
    standardMap;
  const isBundledInterstellar = activeProfile.id === interstellarMap.id || activeProfile.id === assistedInterstellarMap.id;
  const keyboardRange = pianoRange(activeProfile.bindings);
  useEffect(() => {
    keyboard.current?.setMap(activeProfile);
  }, [activeProfile]);
  useEffect(() => {
    try {
      saveProfiles(profiles);
    } catch {
      setMappingMessage(
        "Local storage is unavailable; export your mappings to keep them.",
      );
    }
  }, [profiles]);
  useEffect(() => {
    try {
      localStorage.setItem("stage-piano-active-profile", profileId);
    } catch {
      /* private browsing */
    }
  }, [profileId]);
  useEffect(() => {
    try {
      localStorage.setItem("stage-piano-theme", theme);
      localStorage.setItem("stage-piano-theme-shortcut", themeShortcut);
    } catch {
      /* private browsing */
    }
  }, [theme, themeShortcut]);

  useEffect(() => {
    if (view !== "performance") return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((performance.now() - startedAt) / 1000)),
      250,
    );
    const onFullscreen = () => {
      if (!document.fullscreenElement && stage.current) exitPerformance();
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [view, startedAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.code === "F9") {
        event.preventDefault();
        panic();
        return;
      }
      if (view !== "performance") return;
      if (event.code === "Escape") {
        event.preventDefault();
        exitPerformance();
      } else if (event.code === "F7") {
        event.preventDefault();
        if (!event.repeat) setPerformanceLabels((value) => !value);
      } else if (event.code === "F8") {
        event.preventDefault();
        setShowHud((value) => !value);
      } else if (event.code === themeShortcut && !event.repeat) {
        event.preventDefault();
        setTheme(
          (value) => themes[(themes.indexOf(value) + 1) % themes.length],
        );
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view, themeShortcut]);

  useEffect(() => {
    if (view !== "performance") return;
    let timer: number;
    const move = () => {
      setCursorHidden(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorHidden(true), 1800);
    };
    window.addEventListener("pointermove", move);
    move();
    return () => {
      window.removeEventListener("pointermove", move);
      window.clearTimeout(timer);
      setCursorHidden(false);
    };
  }, [view]);

  const activePitches = useMemo(
    () =>
      [...new Set(snapshot.pressed.map((key) => key.midi))].sort(
        (a, b) => a - b,
      ),
    [snapshot],
  );
  const expectedCodes = expected
    .toUpperCase()
    .split(/[\s,+]+/)
    .filter(Boolean)
    .map((value) =>
      value === "SHIFT"
        ? "ShiftLeft"
        : value.length === 1 && /[A-Z]/.test(value)
          ? `Key${value}`
          : value.length === 1 && /\d/.test(value)
            ? `Digit${value}`
            : value,
    );
  const missingCodes = expectedCodes.filter(
    (code) => !snapshot.detected.includes(code),
  );

  function panic() {
    for (const voice of assistedTimers.current.values()) window.clearTimeout(voice.timer);
    assistedTimers.current.clear();
    keyboard.current?.releaseAll();
    audio.current?.releaseAll();
    liveNotes.current.clear();
    setPedal(false);
  }
  function setPedal(enabled: boolean) {
    if (sustainRef.current === enabled) return;
    sustainRef.current = enabled;
    audio.current?.setSustain(enabled);
    if (!enabled) liveNotes.current.pedalUp(performance.now());
    setSustainActive(enabled);
  }
  function triggerAssisted(event: AssistedEvent) {
    if (!audio.current?.isReady()) return;
    const bpm = importedSong.measures[event.bar - 1].tempoBpm;
    for (const midi of event.assistedMidi) {
      const id = assistedNextId.current++;
      const code = `assisted:${id}`;
      const at = performance.now();
      if (audio.current.noteOn(midi)) liveNotes.current.dampPitch(midi, at);
      liveNotes.current.on(code, midi, at, true);
      const timer = window.setTimeout(() => {
        audio.current?.noteOff(midi);
        liveNotes.current.off(code, performance.now(), sustainRef.current);
        assistedTimers.current.delete(id);
      }, event.durationBeats * 60000 / bpm);
      assistedTimers.current.set(id, { timer, midi, code });
    }
  }
  function resetAssistedSection() {
    panic();
    if (sustainSettings.mode === "automatic" && view === "studio" && practiceMeasure >= sustainSettings.autoStart && practiceMeasure <= sustainSettings.autoEnd)
      setPedal(true);
  }
  function selectProfile(id: string) {
    const next = profiles.find((profile) => profile.id === id);
    if (!next || next.id === activeProfile.id) return;
    if (next.id === interstellarMap.id || next.id === assistedInterstellarMap.id) {
      keyboard.current?.setTranspose(0);
      setTranspose(0);
    }
    panic();
    keyboard.current?.setMap(next);
    if (sustainSettings.mode === "automatic" && view === "studio" && practiceMeasure >= sustainSettings.autoStart && practiceMeasure <= sustainSettings.autoEnd)
      setPedal(true);
    liveNotes.current.clear();
    setProfileId(next.id);
  }
  function exitPerformance() {
    panic();
    setView("practice");
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }
  function enterStudio() {
    panic();
    previousTranspose.current = transpose;
    keyboard.current?.setTranspose(0);
    setTranspose(0);
    selectProfile(interstellarMap.id);
    setView("studio");
  }
  function exitStudio() {
    panic();
    keyboard.current?.setTranspose(previousTranspose.current);
    setTranspose(previousTranspose.current);
    setView("practice");
  }
  async function enterPerformance() {
    if (audioState !== "ready") return;
    liveNotes.current.clear();
    setStartedAt(performance.now());
    setElapsed(0);
    setShowHud(false);
    flushSync(() => setView("performance"));
    try {
      await stage.current?.requestFullscreen?.();
    } catch {
      /* CSS fills the viewport when fullscreen is blocked */
    }
  }
  function updateBinding(
    code: string,
    layer: "midi" | "shiftedMidi",
    value: number,
  ) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id !== activeProfile.id
          ? profile
          : {
              ...profile,
              bindings: profile.bindings.map((binding) =>
                binding.code === code
                  ? { ...binding, [layer]: value }
                  : binding,
              ),
            },
      ),
    );
  }
  function addBinding(code: string) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id !== activeProfile.id
          ? profile
          : {
              ...profile,
              bindings: [
                ...profile.bindings,
                {
                  code,
                  label: code.replace(/^(Key|Digit)/, ""),
                  midi: 60,
                  shiftedMidi: 72,
                },
              ],
            },
      ),
    );
  }
  function exportProfile() {
    const blob = new Blob([JSON.stringify(activeProfile, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeProfile.id}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importProfile(file?: File) {
    if (!file) return;
    try {
      const imported = validateProfile(JSON.parse(await file.text()));
      const profile = { ...imported, id: `import-${Date.now()}` };
      keyboard.current?.setMap(profile);
      liveNotes.current.clear();
      setProfiles((current) => [...current, profile]);
      setProfileId(profile.id);
      setMappingMessage(`Imported ${profile.name}.`);
    } catch (error) {
      setMappingMessage(
        error instanceof Error
          ? error.message
          : "Could not import this mapping.",
      );
    }
  }

  async function startAudio() {
    if (!audio.current || audioState === "loading") return;
    setAudioState("loading");
    try {
      await audio.current.start();
      setAudioState("ready");
    } catch {
      setAudioState("error");
    }
  }

  function soundTest() {
    const engine = audio.current;
    if (!engine?.isReady()) return;
    if (testTimer.current !== null) window.clearTimeout(testTimer.current);
    testNotes.current.forEach((note) => engine.noteOff(note));
    const notes = [60 + transpose, 64 + transpose, 67 + transpose];
    testNotes.current = notes;
    notes.forEach((note) => engine.noteOn(note));
    testTimer.current = window.setTimeout(() => {
      notes.forEach((note) => engine.noteOff(note));
      testNotes.current = [];
      testTimer.current = null;
    }, 600);
  }

  if (view === "studio")
    return <PracticeStudio map={activeProfile} snapshot={snapshot} audioReady={audioState === "ready"} startAudio={startAudio} selectProfile={selectProfile} profiles={profiles} onNoteRef={practiceNote} onUnmappedRef={practiceUnmapped} onExit={exitStudio} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} showAssistedNotes={showAssistedNotes} setShowAssistedNotes={setShowAssistedNotes} liveNotes={liveNotes.current} onMeasureChange={setPracticeMeasure} triggerAssisted={triggerAssisted} resetAssisted={resetAssistedSection} />;

  if (view === "performance")
    return (
      <main
        ref={stage}
        className={`performance-stage theme-${theme} ${cursorHidden ? "cursor-hidden" : ""}`}
      >
        <PerformanceVisualizer
          notes={liveNotes.current}
          map={activeProfile}
          transpose={transpose}
          theme={theme}
          notesPerSecond={snapshot.notesPerSecond}
          showAssisted={showAssistedNotes}
        />
        {sustainSettings.showIndicator && <div className={`performance-sustain ${sustainActive ? "is-active" : ""}`}>PEDAL {sustainActive ? "ON" : "OFF"}</div>}
        <div className="performance-profile">
          {activeProfile.name}{" "}
          <span>· F7 LABELS {performanceLabels ? "ON" : "OFF"}</span>
        </div>
        <div className="performance-piano">
          <PianoCanvas
            active={activePitches}
            map={activeProfile}
            transpose={transpose}
            showLabels={performanceLabels}
          />
        </div>
        {showHud && (
          <div className="performance-hud">
            <span>{snapshot.notesPerSecond} notes/s</span>
            <span>{snapshot.pressed.length} active</span>
            <span>
              {theme === "rush"
                ? "Rush E"
                : theme === "cosmic"
                  ? "Interstellar"
                  : "Minimal"}
            </span>
            <span>
              {Math.floor(elapsed / 60)}:
              {(elapsed % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}
      </main>
    );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            STAGE<span className="brand-light">PIANO</span>
          </span>
        </div>
        <div className="topbar-right">
          <span className="version">PERFORMANCE INSTRUMENT · V1</span>
          <span
            className={`connection ${audioState === "ready" ? "is-ready" : ""}`}
          >
            <span className="status-dot" />
            {audioState === "ready"
              ? "AUDIO READY"
              : audioState === "loading"
                ? "LOADING SAMPLES"
                : audioState === "error"
                  ? "AUDIO ERROR"
                  : "AUDIO LOCKED"}
          </span>
        </div>
      </header>

      <section className="stage-panel">
        <div className="eyebrow">
          <span className="eyebrow-line" /> YOUR KEYBOARD IS THE INSTRUMENT
        </div>
        <h1>
          Every keystroke,
          <br />
          <em>a note in the room.</em>
        </h1>
        <p className="intro">
          A responsive piano built for the stage. Unlock audio, focus this
          window, and play directly from your MacBook keyboard.
        </p>
        <div className="primary-controls">
          {audioState !== "ready" ? (
            <button
              className="start-button"
              onClick={startAudio}
              disabled={audioState === "loading"}
            >
              <span className="button-icon">▶</span>
              {audioState === "loading"
                ? "Loading piano samples…"
                : audioState === "error"
                  ? "Retry audio"
                  : "Enable piano audio"}
              <span className="arrow">↗</span>
            </button>
          ) : (
            <div className="ready-pill">
              <span className="pulse-dot" /> Piano ready to play
            </div>
          )}
          <button
            className="start-button performance-enter"
            disabled={audioState !== "ready"}
            onClick={enterPerformance}
          >
            Enter Performance Mode <span className="arrow">↗</span>
          </button>
          <button className="start-button performance-enter" onClick={enterStudio}>
            Open Practice Studio <span className="arrow">↗</span>
          </button>
          <span className="control-hint">
            Audio starts with your click, as required by the browser.
          </span>
        </div>
        <div className="stage-art" aria-hidden="true">
          <div className="halo halo-one" />
          <div className="halo halo-two" />
          <div className="stage-wave">
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                style={{
                  height: `${15 + Math.abs(Math.sin(i * 0.61) * Math.cos(i * 0.23)) * 80}%`,
                  animationDelay: `${i * 38}ms`,
                }}
              />
            ))}
          </div>
          <div className="art-caption">LIVE INPUT / ZERO SEQUENCING</div>
        </div>
      </section>

      <section
        className="workbench"
        aria-label="Piano controls and diagnostics"
      >
        <SustainSettings value={sustainSettings} active={sustainActive} onChange={setSustainSettings} />
        <div className="panel panel-diagnostics">
          <div className="panel-title">
            <span>01 / LIVE MONITOR</span>
            <span className="live-marker">
              <span />
              LIVE
            </span>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <strong>
                {snapshot.pressed.length.toString().padStart(2, "0")}
              </strong>
              <span>KEYS DOWN</span>
            </div>
            <div className="stat">
              <strong>
                {activePitches.length.toString().padStart(2, "0")}
              </strong>
              <span>SOUNDING PITCHES</span>
            </div>
            <div className="stat">
              <strong>
                {snapshot.notesPerSecond.toString().padStart(2, "0")}
              </strong>
              <span>NOTES / SEC</span>
            </div>
          </div>
          <div className="monitor-row">
            <span>PHYSICAL KEYS</span>
            <div className="chip-list">
              {snapshot.pressed.length ? (
                snapshot.pressed.map((key) => (
                  <kbd key={key.code}>{key.label}</kbd>
                ))
              ) : (
                <span className="monitor-empty">Awaiting input</span>
              )}
            </div>
          </div>
          <div className="monitor-row">
            <span>MIDI PITCHES</span>
            <div className="chip-list">
              {activePitches.length ? (
                activePitches.map((midi) => (
                  <span className="pitch-chip" key={midi}>
                    {midiToName(midi)} <small>{midi}</small>
                  </span>
                ))
              ) : (
                <span className="monitor-empty">No active notes</span>
              )}
            </div>
          </div>
          <div className="keyboard-test">
            <strong>KEYBOARD TEST</strong>
            <div>
              Detected:{" "}
              {snapshot.detected.length
                ? snapshot.detected.join(" · ")
                : "None"}{" "}
              · Shift: {snapshot.shift ? "down" : "up"}
            </div>
            <label>
              Expected chord{" "}
              <input
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                placeholder="e.g. Q W E Shift"
              />
            </label>
            {expectedCodes.length > 0 && (
              <div>
                {missingCodes.length
                  ? `Not reported by browser: ${missingCodes.join(", ")}`
                  : "All expected physical keys reported"}
              </div>
            )}
          </div>
        </div>

        <div className="panel panel-settings">
          <div className="panel-title">
            <span>02 / INSTRUMENT SETUP</span>
            <span className="subtle">SALAMANDER GRAND</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Keyboard capture</strong>
              <small>Capture mapped keys while this window is focused</small>
            </div>
            <button
              className={`toggle ${captureEnabled ? "on" : ""}`}
              role="switch"
              aria-checked={captureEnabled}
              aria-label="Keyboard capture"
              onClick={() => setCaptureEnabled((value) => !value)}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Performance labels</strong>
              <small>Off by default · F7 toggles during performance</small>
            </div>
            <button
              className={`toggle ${performanceLabels ? "on" : ""}`}
              role="switch"
              aria-checked={performanceLabels}
              aria-label="Performance keyboard labels"
              onClick={() => setPerformanceLabels((value) => !value)}
            >
              <span />
            </button>
          </div>
          <div className="setting-row volume-row">
            <div>
              <strong>Master volume</strong>
              <small>Set a comfortable output level</small>
            </div>
            <div className="volume-control">
              <input
                aria-label="Master volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <span>{volume}%</span>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Octave range</strong>
              <small>
                {isBundledInterstellar
                  ? "Fixed to the imported MIDI pitches"
                  : "Shift the full keyboard by one octave"}
              </small>
            </div>
            <div className="stepper">
              <button
                aria-label="Lower octave"
                onClick={() =>
                  setTranspose((value) => Math.max(-12, value - 12))
                }
                disabled={isBundledInterstellar || transpose <= -12}
              >
                −
              </button>
              <span>
                {isBundledInterstellar
                  ? "FIXED"
                  : transpose === 0
                    ? "STANDARD"
                    : transpose > 0
                      ? "+1 OCT"
                      : "−1 OCT"}
              </span>
              <button
                aria-label="Raise octave"
                onClick={() =>
                  setTranspose((value) => Math.min(12, value + 12))
                }
                disabled={isBundledInterstellar || transpose >= 12}
              >
                +
              </button>
            </div>
          </div>
          <button
            className="sound-test"
            onClick={soundTest}
            disabled={audioState !== "ready"}
          >
            <span>♪</span> Play sound test <span className="test-arrow">↗</span>
          </button>
          <div className="setting-row">
            <div>
              <strong>Visual theme</strong>
              <small>
                Change live with {themeShortcut}; F7 labels · F8 HUD · F9 panic
              </small>
            </div>
            <select
              aria-label="Visual theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              <option value="rush">Rush E · Neon</option>
              <option value="cosmic">Interstellar · Cosmic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>Theme shortcut</strong>
              <small>Physical key, separate from note keys</small>
            </div>
            <select
              aria-label="Theme shortcut"
              value={themeShortcut}
              onChange={(event) => setThemeShortcut(event.target.value)}
            >
              {shortcutOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mapping-panel" aria-label="Keyboard mapping editor">
        <div className="keyboard-topline">
          <div>
            <span className="section-index">03 / KEY MAPPINGS</span>
            <h2>Make it yours.</h2>
          </div>
          <button
            className="guide-button"
            onClick={() => setMappingOpen((value) => !value)}
            aria-expanded={mappingOpen}
          >
            {mappingOpen ? "Close editor" : "Edit mappings"}{" "}
            <span>{mappingOpen ? "−" : "+"}</span>
          </button>
        </div>
        <div className="mapping-toolbar">
          <label>
            Profile{" "}
            <select
              aria-label="Keyboard mapping"
              value={activeProfile.id}
              onChange={(event) => selectProfile(event.target.value)}
            >
              {profiles.filter((profile) => profile.id !== assistedInterstellarMap.id).map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              const name = window.prompt(
                "New profile name",
                `${activeProfile.name} copy`,
              );
              if (!name?.trim()) return;
              const profile = {
                ...activeProfile,
                id: `custom-${Date.now()}`,
                name: name.trim(),
                bindings: activeProfile.bindings.map((binding) => ({
                  ...binding,
                })),
              };
              keyboard.current?.setMap(profile);
              liveNotes.current.clear();
              setProfiles((current) => [...current, profile]);
              setProfileId(profile.id);
            }}
          >
            Save as new profile
          </button>
          <button
            disabled={isBundledInterstellar}
            onClick={() => {
              setProfiles((current) =>
                current.map((profile) =>
                  profile.id === activeProfile.id
                    ? {
                        ...profile,
                        bindings: standardMap.bindings.map((binding) => ({
                          ...binding,
                        })),
                      }
                    : profile,
                ),
              );
              setMappingMessage("Restored standard mapping for this profile.");
            }}
          >
            Restore standard
          </button>
          <button onClick={exportProfile}>Export JSON</button>
          <button onClick={() => importInput.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importInput}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void importProfile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <p className="active-mapping">
          Selected mapping: <strong>{activeProfile.name}</strong>
          {isBundledInterstellar
            ? " · 24 notes from the supplied JSON · Shift does not change pitch"
            : ""}
        </p>
        {mappingMessage && <p className="mapping-message">{mappingMessage}</p>}
        {mappingOpen && (
          <>
            <p className="mapping-intro">
              {isBundledInterstellar
                ? "This bundled mapping follows the supplied JSON exactly. Save as a new profile to edit it."
                : "MIDI note numbers 21–108. Normal and Shift pitches are independent; changing profiles releases held notes."}
            </p>
            <div className="mapping-grid">
              {physicalCodes.map((code) => {
                const binding = activeProfile.bindings.find(
                  (item) => item.code === code,
                );
                return binding ? (
                  <div className="mapping-key" key={code}>
                    <kbd>{binding.label}</kbd>
                    <small>{binding.code}</small>
                    <label>
                      Normal
                      <input
                        aria-label={`${binding.label} normal MIDI pitch`}
                        type="number"
                        min="21"
                        max="108"
                        disabled={isBundledInterstellar}
                        value={binding.midi}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (
                            Number.isInteger(value) &&
                            value >= 21 &&
                            value <= 108
                          )
                            updateBinding(binding.code, "midi", value);
                        }}
                      />
                    </label>
                    {!isBundledInterstellar && (
                      <label>
                        Shift
                        <input
                          aria-label={`${binding.label} Shift MIDI pitch`}
                          type="number"
                          min="21"
                          max="108"
                          value={binding.shiftedMidi ?? ""}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (
                              Number.isInteger(value) &&
                              value >= 21 &&
                              value <= 108
                            )
                              updateBinding(binding.code, "shiftedMidi", value);
                          }}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="mapping-key mapping-key-empty" key={code}>
                    <kbd>{code.replace(/^(Key|Digit)/, "")}</kbd>
                    <small>{code}</small>
                    {!isBundledInterstellar && (
                      <button onClick={() => addBinding(code)}>
                        Assign pitch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {duplicatePitches(activeProfile).length > 0 && (
              <p className="mapping-warning">
                Duplicate pitches: {duplicatePitches(activeProfile).join(" · ")}
              </p>
            )}
          </>
        )}
      </section>

      <section className="keyboard-section" aria-label="Visual piano keyboard">
        <div className="keyboard-topline">
          <div>
            <span className="section-index">04 / THE KEYBOARD</span>
            <h2>Play what you feel.</h2>
          </div>
          <button
            className="guide-button"
            onClick={() => setShowGuide((value) => !value)}
            aria-expanded={showGuide}
          >
            {showGuide ? "Hide" : "Show"} key guide{" "}
            <span>{showGuide ? "−" : "+"}</span>
          </button>
        </div>
        {showGuide &&
          (isBundledInterstellar ? (
            <div className="key-guide">
              <p>
                <strong>Lower notes</strong> 4–0 play F2–E3.
              </p>
              <p>
                <strong>Middle notes</strong> Q–P play F3–A4.
              </p>
              <p>
                <strong>Upper notes</strong> A S D F H J K play B4–B5. Shift
                keeps the same pitch.
              </p>
            </div>
          ) : (
            <div className="key-guide">
              <p>
                <strong>Lower row</strong> Z X C V B N M for white notes; S D G
                H J for black notes.
              </p>
              <p>
                <strong>Upper row</strong> Q W E R T Y U for white notes; 2 3 5
                6 7 for black notes.
              </p>
              <p>
                <strong>Shift</strong> raises a new note one octave. Notes
                already held keep their original pitch until their physical key
                is released.
              </p>
            </div>
          ))}
        <div className="piano-adjustments">
          <label>
            Keyboard height{" "}
            <input
              aria-label="Practice keyboard height"
              type="range"
              min="280"
              max="400"
              step="10"
              value={keyboardHeight}
              onChange={(event) =>
                setKeyboardHeight(Number(event.target.value))
              }
            />{" "}
            <output>{keyboardHeight}px</output>
          </label>
          <label className="label-option">
            Show key labels{" "}
            <button
              className={`toggle ${practiceLabels ? "on" : ""}`}
              role="switch"
              aria-checked={practiceLabels}
              aria-label="Practice keyboard labels"
              onClick={() => setPracticeLabels((value) => !value)}
            >
              <span />
            </button>
          </label>
        </div>
        <div
          className="piano-frame"
          style={
            {
              "--practice-keyboard-height": `${keyboardHeight}px`,
            } as CSSProperties
          }
        >
          <div className="piano-meta">
            <span>
              <span className="tiny-led" />{" "}
              {keyboardRange.high - keyboardRange.low}{" "}
              SEMITONES · POLYPHONIC
            </span>
            <span>CURRENT PROFILE: {activeProfile.name.toUpperCase()}</span>
          </div>
          <PianoCanvas
            active={activePitches}
            map={activeProfile}
            transpose={transpose}
            showLabels={practiceLabels}
          />
        </div>
        <div className="keyboard-foot">
          <span>BUILT FOR PHYSICAL KEYBOARD INPUT</span>
          <span>CLICK THE PAGE AFTER USING A CONTROL TO RETURN FOCUS</span>
        </div>
        <div className="sample-credit">
          Piano samples:{" "}
          <a
            href="https://archive.org/details/SalamanderGrandPianoV3"
            target="_blank"
            rel="noreferrer"
          >
            Salamander Grand Piano V3
          </a>{" "}
          by Alexander Holm ·{" "}
          <a
            href="https://creativecommons.org/licenses/by/3.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 3.0
          </a>
        </div>
      </section>
    </main>
  );
}
