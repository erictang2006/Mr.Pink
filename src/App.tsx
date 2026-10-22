import { interstellarRobloxMap, interstellarThemeShortcut } from './piano/interstellarRoblox';
import { interstellarKeyGuide, interstellarProminentPitches, interstellarDisplayPressedKeys } from './piano/interstellarPresentation';
import { rosesKeyGuide } from './piano/rosesPresentation';
import {backingFrame} from "./piano/backingVisuals";
import {defaultBackingMode} from "./piano/rosesBacking";
import RosesBackingControls from "./components/RosesBackingControls";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import * as Tone from "tone";
import { flushSync } from "react-dom";
import PianoCanvas from "./components/PianoCanvas";
import PracticeStudio from "./components/PracticeStudio";
import LevelsPractice from "./components/LevelsPractice";
import SandboxMode, { type SongId } from "./components/SandboxMode";
import RosesPractice from "./components/RosesPractice";
import RosesBeatClock from "./components/RosesBeatClock";
import RosesBuildupControls from "./components/RosesBuildupControls";
import HereWithMeLeadControls from "./components/HereWithMeLeadControls";
import { validBuildupSettings } from "./piano/rosesBuildup";
import RosesCloserControls from "./components/RosesCloserControls";
import SustainSettings, { type SustainSettingsValue } from "./components/SustainSettings";
import PerformanceVisualizer, {
  type Theme,
} from "./components/PerformanceVisualizer";
import PerformanceHeader from "./components/PerformanceHeader";
import { stageKeyGuide, type StagePresentation } from "./piano/performancePresentation";
import { PianoAudioEngine } from "./piano/audioEngine";
import {
  KeyboardInputManager,
  type InputSnapshot,
} from "./piano/keyboardInput";
import { midiToName, standardMap, type KeyboardMap } from "./piano/noteMapping";
import { LiveNotes } from "./piano/liveNotes";
import { PedalInput } from "./piano/pedalInput";
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
import { climaxStart, defaultInterstellarMix, highEOctaveMidi, liveNoteGain, sectionGain, shouldDoubleHighE, type InterstellarMix } from "./piano/interstellarMix";
import { interstellarSections, mapForInterstellarSection, moveInterstellarSection, planInterstellarPress, type InterstellarSection } from "./piano/interstellarPerformance";
import { levelsChordDefaults, levelsTransitionChords, levelsRosesChords, levelsMap, levelsSong, validatedLevelsChords, drumCodeToLayer, type LevelsSection } from "./piano/levels";
import { DrumEngine, defaultDrumMix, type DrumMix, type DrumSnapshot } from "./piano/drumEngine";
import { rosesMap } from "./piano/roses";
import { rosesChordHint, rosesChordShortcuts, rosesChordSource } from "./piano/rosesChords";
import { hereWithMeChordShortcuts, validHereWithMeChordSound } from "./piano/hereWithMeChords";
import { RosesChordStabEngine } from "./piano/rosesChordStabEngine";
import { validRosesDropSettings } from "./piano/rosesDropSettings";
import { RosesIntroEngine, type LiveDrumHit, type RosesIntroSnapshot } from "./piano/rosesIntroEngine";
import { rosesVocalCue } from "./piano/rosesIntro";
import { migrateCloserSettings, validCloserSettings, type RosesCloserSettings } from "./piano/rosesCloser";
import { loadRosesCalibration, saveRosesCalibration, type RosesCalibrationSettings } from "./piano/rosesCalibration";
import { SynthEngine, presetSettings, validSynthSettings, type SynthSettings } from "./piano/synthEngine";
import { bundledRosesInstrument, savedInstruments } from "./piano/sampleLibrary";

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
  const [songId, setSongId] = useState<SongId>(() => {
    const saved = savedValue("stage-piano-song", "interstellar");
    return saved === "levels" || saved === "rush-e" || saved === "roses" ? saved : "interstellar";
  });
  const [rosesTranspose, setRosesTranspose] = useState(() => {
    const saved = Number(savedValue("stage-piano-roses-transpose", "4"));
    return Number.isFinite(saved) ? Math.max(-12, Math.min(12, saved)) : 4;
  });
  const [synthSettings, setSynthSettings] = useState<SynthSettings>(() => {
    try {
      const id = savedValue("stage-piano-roses-default", "roses");
      const perInstrument = JSON.parse(localStorage.getItem("stage-piano-roses-instrument-settings-v1") || "{}");
      const savedPresets = JSON.parse(localStorage.getItem("stage-piano-roses-user-presets-v1") || "[]");
      return validSynthSettings(perInstrument[id] ?? presetSettings[id as keyof typeof presetSettings] ?? savedPresets.find((item: { id: string; settings: SynthSettings }) => item.id === id)?.settings ?? presetSettings.roses);
    }
    catch { return presetSettings.roses; }
  });
  const [instrumentId, setInstrumentId] = useState(() => savedValue("stage-piano-roses-default", "roses"));
  const [instrumentError, setInstrumentError] = useState("");
  const [rosesDropSettings, setRosesDropSettings] = useState(() => {
    try {
      const current = savedValue("stage-piano-roses-drop-v4", "");
      if (current) return validRosesDropSettings(JSON.parse(current));
      const legacy = JSON.parse(savedValue("stage-piano-roses-drop-v3", "{}"));
      return validRosesDropSettings({ ...legacy, mode: "bonk", bonk: .35, space: .15 });
    }
    catch { return validRosesDropSettings(); }
  });
  const [rosesIntroSnapshot, setRosesIntroSnapshot] = useState<RosesIntroSnapshot | null>(null);
  const [hereWithMeHarmonyVolume, setHereWithMeHarmonyVolume] = useState(() => {
    const value=Number(savedValue("stage-piano-hwm-harmony-volume", "4"));
    return Number.isFinite(value) ? Math.max(0,Math.min(8,value)) : 4;
  });
  const [hereWithMeChordSound, setHereWithMeChordSound] = useState(() => validHereWithMeChordSound(savedValue("stage-piano-hwm-chord-sound", "keys678")));
  const [rosesIntroLoadState, setRosesIntroLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [rosesVocalOffset, setRosesVocalOffset] = useState(() => {
    const value = Number(savedValue("stage-piano-roses-vocal-offset-v2", String(rosesVocalCue.sourceOffsetSeconds)));
    return Number.isFinite(value) ? Math.max(0, Math.min(225, value)) : rosesVocalCue.sourceOffsetSeconds;
  });
  const [rosesVocalKey, setRosesVocalKey] = useState(() => {
    const saved = savedValue("stage-piano-roses-vocal-key", "KeyL");
    return ["KeyL", "KeyC", "KeyG"].includes(saved) ? saved : "KeyL";
  });
  const [rosesBuildupSettings, setRosesBuildupSettings] = useState(() => {
    try { return validBuildupSettings(JSON.parse(savedValue("stage-piano-roses-buildup-v1", "{}"))); } catch { return validBuildupSettings(); }
  });
  const [rosesCloserSettings, setRosesCloserSettings] = useState<RosesCloserSettings>(() => {
    try {
      const current = savedValue("stage-piano-roses-here-with-me-v2", "");
      return current ? validCloserSettings(JSON.parse(current)) : migrateCloserSettings(JSON.parse(savedValue("stage-piano-roses-here-with-me-v1", savedValue("stage-piano-roses-closer-v2", savedValue("stage-piano-roses-closer-v1", "{}")))));
    }
    catch { return validCloserSettings(); }
  });
  const [rosesBeatHud, setRosesBeatHud] = useState(() => savedValue("stage-piano-roses-beat-hud", "on") !== "off");
  const [rosesOutput, setRosesOutput] = useState({ id: "default", label: "System default output", base: null as number | null, output: null as number | null });
  const [rosesCalibration, setRosesCalibration] = useState<RosesCalibrationSettings>(() => loadRosesCalibration("default"));
  const [rosesBassLevels, setRosesBassLevels] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("stage-piano-roses-bass-levels") || "{}");
      const level = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
      return { bass: level(stored.bass, .45), sub: level(stored.sub, .35) };
    } catch { return { bass: .45, sub: .35 }; }
  });
  const [rosesSynthLevel, setRosesSynthLevel] = useState(() => {
    const stored = Number(savedValue("stage-piano-roses-loop-level", "0.55"));
    return Number.isFinite(stored) ? Math.max(0, Math.min(1.5, stored)) : .55;
  });
  const [rosesSynthLeadMs, setRosesSynthLeadMs] = useState(() => {
    const stored = Number(savedValue("stage-piano-roses-synth-lead-ms", "20"));
    return Number.isFinite(stored) ? Math.max(0, Math.min(60, stored)) : 20;
  });
  const [levelsSection, setLevelsSection] = useState<LevelsSection>("main");
  const [levelsGain, setLevelsGain] = useState(() => Math.max(0.1, Math.min(1, Number(savedValue("stage-piano-levels-transition-gain", "0.4")) || 0.4)));
  const [drumMix, setDrumMix] = useState<DrumMix>(() => { try { return { ...defaultDrumMix, ...JSON.parse(localStorage.getItem("stage-piano-drum-mix") || "{}") }; } catch { return defaultDrumMix; } });
  const [drumSnapshot, setDrumSnapshot] = useState<DrumSnapshot | null>(null);
  const [levelsChords, setLevelsChords] = useState<Record<string, number[]>>(() => {
    try { return validatedLevelsChords(JSON.parse(localStorage.getItem("stage-piano-levels-chords") || "null"));
    } catch { return levelsChordDefaults; }
  });
  const [view, setView] = useState<"practice" | "studio" | "sandbox" | "performance">(
    () => new URLSearchParams(window.location.search).get("view") === "sandbox" || (["roses", "rush-e"].includes(savedValue("stage-piano-song", "interstellar")) && new URLSearchParams(window.location.search).get("view") !== "performance") ? "sandbox" : ["practice", "assisted"].includes(new URLSearchParams(window.location.search).get("view") ?? "") ? "studio" : "practice",
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
    try {
      const saved = JSON.parse(localStorage.getItem("stage-piano-sustain-settings") || "{}");
      return { releaseSeconds: Number.isFinite(saved.releaseSeconds) ? saved.releaseSeconds : 0.55, showIndicator: saved.showIndicator !== false };
    } catch { return { releaseSeconds: 0.55, showIndicator: true }; }
  });
  const [sustainActive, setSustainActive] = useState(false);
  const [showAssistedNotes, setShowAssistedNotes] = useState(false);
  const [performanceMeasure, setPerformanceMeasure] = useState(songId === "levels" ? 1 : climaxStart);
  const [performanceSection, setPerformanceSection] = useState<InterstellarSection>(1);
  const [interstellarMix, setInterstellarMix] = useState<InterstellarMix>(() => {
    try {
      const current = localStorage.getItem("stage-piano-interstellar-mix-v2");
      if (current) return { ...defaultInterstellarMix, ...JSON.parse(current) };
      const previous = JSON.parse(localStorage.getItem("stage-piano-interstellar-mix") || "{}");
      return { ...defaultInterstellarMix, accompaniment: previous.accompaniment ?? defaultInterstellarMix.accompaniment,
        melody: previous.melody ?? defaultInterstellarMix.melody, assisted: previous.assisted ?? defaultInterstellarMix.assisted };
    } catch { return defaultInterstellarMix; }
  });
  const mixRef = useRef(interstellarMix);
  const songRef = useRef(songId);
  const levelsChordsRef = useRef(levelsChords);
  const levelsGainRef = useRef(levelsGain);
  const rosesSettingsRef = useRef(synthSettings);
  const rosesTransposeRef = useRef(rosesTranspose);
  const rosesVocalKeyRef = useRef(rosesVocalKey);
  const levelsHeld = useRef(new Map<string, number[]>());
  const measureRef = useRef(1);
  const performanceMeasureRef = useRef(performanceMeasure);
  const performanceSectionRef = useRef<InterstellarSection>(1);
  const assistedCursor = useRef(0);
  const interstellarHeld = useRef(new Map<string, { source: string; midi: number }[]>());
  const practiceAssistedCounts = useRef(new Map<number, number>());
  const [practiceAssistedPitches, setPracticeAssistedPitches] = useState<number[]>([]);
  const profileRef = useRef(profileId);
  const viewRef = useRef(view);
  mixRef.current = interstellarMix;
  songRef.current = songId;
  levelsChordsRef.current = levelsChords;
  levelsGainRef.current = levelsGain;
  rosesSettingsRef.current = synthSettings;
  rosesTransposeRef.current = rosesTranspose;
  rosesVocalKeyRef.current = rosesVocalKey;
  viewRef.current = view;
  const doubledByCode = useRef(new Map<string, number>());
  const sustainRef = useRef(false);
  const pedalInput = useRef<PedalInput | null>(null);
  const assistedTimers = useRef(new Map<number, { timer: number; midi: number; code: string }>());
  const assistedNextId = useRef(1);
  const audio = useRef<PianoAudioEngine | null>(null);
  const synth = useRef<SynthEngine | null>(null);
  const chordStabs = useRef<RosesChordStabEngine | null>(null);
  const rosesIntro = useRef<RosesIntroEngine | null>(null);
  const drums = useRef<DrumEngine | null>(null);
  const drumMode = useRef<"performance" | "step" | "timed">("performance");
  const keyboard = useRef<KeyboardInputManager | null>(null);
  const liveNotes = useRef(new LiveNotes());
  const stage = useRef<HTMLElement | null>(null);
  const importInput = useRef<HTMLInputElement | null>(null);
  const testTimer = useRef<number | null>(null);
  const testNotes = useRef<number[]>([]);
  const practiceNote = useRef<((midi: number, code: string, at: number) => void) | null>(null);
  const practiceDrum = useRef<((hit: LiveDrumHit) => void) | null>(null);
  const practiceUnmapped = useRef<((code: string, at: number) => void) | null>(null);
  const previousTranspose = useRef(0);

  useEffect(() => {
    const engine = new PianoAudioEngine();
    audio.current = engine;
    engine.setVolume(volume / 100);
    const synthEngine = new SynthEngine(rosesSettingsRef.current);
    synth.current = synthEngine;
    synthEngine.setGlobalVolume(volume / 100);
    const chordStabEngine = new RosesChordStabEngine();
    chordStabEngine.setSettings(rosesDropSettings);
    chordStabEngine.setHereWithMeSound(hereWithMeChordSound);
    chordStabEngine.setHereWithMeHarmonyVolume(hereWithMeHarmonyVolume);
    chordStabs.current = chordStabEngine;
    void chordStabEngine.load().catch(() => { /* Explicit Enable audio retries and reports failure. */ });
    chordStabEngine.setGlobalVolume(volume / 100);
    const introEngine = new RosesIntroEngine(synthEngine, setRosesIntroSnapshot, () => rosesTransposeRef.current);
    introEngine.setDropLeadSettings(rosesDropSettings);
    rosesIntro.current = introEngine;
    setRosesIntroSnapshot(introEngine.snapshot());
    let introMounted = true;
    void introEngine.load().then(() => { if (introMounted) setRosesIntroLoadState("ready"); }, () => { if (introMounted) setRosesIntroLoadState("error"); });
    const drumEngine = new DrumEngine(setDrumSnapshot, bar => {
      if (viewRef.current === "performance") {
        performanceMeasureRef.current = bar;
        setPerformanceMeasure(bar);
        setLevelsSection(bar <= 8 ? "main" : bar <= 11 ? "transition" : "roses");
      }
    });
    drums.current = drumEngine;
    const input = new KeyboardInputManager(standardMap, {
      noteOn: (midi, code, at) => {
        if (songRef.current === "roses") {
          if (synthEngine.noteOn(code, midi)) {
            liveNotes.current.on(code, midi, at);
            if (viewRef.current === "studio") practiceNote.current?.(midi, code, at);
          }
          return;
        }
        if (songRef.current === "levels") {
          const measure = viewRef.current === "studio" ? measureRef.current : performanceMeasureRef.current;
          const chords = measure <= 8 ? levelsChordsRef.current : measure <= 11 ? levelsTransitionChords : levelsRosesChords;
          const pitches = chords[code] ?? [midi];
          levelsHeld.current.set(code, pitches);
          const gain = measure >= 9 && measure <= 11 ? levelsGainRef.current : 1;
          pitches.forEach((pitch, index) => {
            const source = `levels:${code}:${pitch}`;
            if (engine.noteOnSource(source, pitch, gain)) liveNotes.current.dampPitch(pitch, at);
            liveNotes.current.on(source, pitch, at, index > 0);
          });
          practiceNote.current?.(midi, code, at);
          if (measure >= 9 && measure <= 11 && drumMode.current === "step") drumEngine.noteStepInput(measure);
          return;
        }
        if (songRef.current === "interstellar" && viewRef.current === "performance") {
          const section = performanceSectionRef.current;
          const plan = planInterstellarPress(section, code, midi, assistedCursor.current, mixRef.current);
          assistedCursor.current = plan.nextCursor;
          const sources: { source: string; midi: number }[] = [];
          for (const voice of plan.voices) {
            const source = `interstellar:${code}:${assistedNextId.current++}`;
            if (engine.noteOnSource(source, voice.midi, voice.gain)) liveNotes.current.dampPitch(voice.midi, at);
            liveNotes.current.on(source, voice.midi, at, voice.assisted, voice.octave);
            sources.push({ source, midi: voice.midi });
          }
          interstellarHeld.current.set(code, sources);
          return;
        }
        const inStudio = viewRef.current === "studio";
        const interstellarProfile = profileRef.current === interstellarMap.id || profileRef.current === assistedInterstellarMap.id;
        const measure = inStudio ? measureRef.current : performanceMeasureRef.current;
        const gain = liveNoteGain(measure, midi, code, profileRef.current, inStudio, mixRef.current);
        if (engine.noteOn(midi, gain)) liveNotes.current.dampPitch(midi, at);
        if (interstellarProfile && shouldDoubleHighE(code, midi, mixRef.current.octaveEnabled)) {
          if (engine.noteOn(highEOctaveMidi, gain * mixRef.current.octave)) liveNotes.current.dampPitch(highEOctaveMidi, at);
          doubledByCode.current.set(code, highEOctaveMidi);
          liveNotes.current.on(`octave:${code}`, highEOctaveMidi, at, false, true);
        }
        liveNotes.current.on(code, midi, at);
        practiceNote.current?.(midi, code, at);
      },
      noteOff: (midi, code, at) => {
        if (songRef.current === "roses") {
          synthEngine.noteOff(code);
          liveNotes.current.off(code, at, false);
          return;
        }
        const interstellarSources = interstellarHeld.current.get(code);
        if (interstellarSources) {
          for (const { source } of interstellarSources) {
            engine.noteOffSource(source);
            liveNotes.current.off(source, at, sustainRef.current);
          }
          interstellarHeld.current.delete(code);
          return;
        }
        const levelsPitches = levelsHeld.current.get(code);
        if (levelsPitches) {
          for (const pitch of levelsPitches) {
            const source = `levels:${code}:${pitch}`;
            engine.noteOffSource(source);
            liveNotes.current.off(source, at, viewRef.current === "performance" && sustainRef.current);
          }
          levelsHeld.current.delete(code);
          return;
        }
        engine.noteOff(midi);
        const doubled = doubledByCode.current.get(code);
        if (doubled !== undefined) {
          engine.noteOff(doubled);
          liveNotes.current.off(`octave:${code}`, at, sustainRef.current);
          doubledByCode.current.delete(code);
        }
        liveNotes.current.off(code, at, sustainRef.current);
      },
      chordOn: (pitches, code, at) => {
        const audioAt = Tone.immediate();
        for (const midi of pitches) {
          const source = rosesChordSource(code, midi);
          if (chordStabEngine.noteOn(source, midi, code, audioAt)) liveNotes.current.on(source, midi, at);
        }
      },
      chordOff: (pitches, code, at) => {
        for (const midi of pitches) {
          const source = rosesChordSource(code, midi);
          chordStabEngine.noteOff(source);
          liveNotes.current.off(source, at, false);
        }
      },
      change: setSnapshot,
      unmappedKeyDown: (code, at) => practiceUnmapped.current?.(code, at),
      controlKeyDown: code => {
        if (songRef.current === "roses" && (viewRef.current === "studio" || viewRef.current === "performance")) {
          if (code === "KeyV") { introEngine.armSynth(); return true; }
          if (code === "KeyN") { introEngine.armBass(); return true; }
          if (code === "F6") { introEngine.armBuild(); return true; }
          if (code === rosesVocalKeyRef.current) { introEngine.armVocal(); return true; }
          if (code === "KeyB") { introEngine.stopLoop(); return true; }
          if (code === "KeyM") { introEngine.hitAccent(); return true; }
          if (code === "KeyZ" || code === "KeyX") {
            const hit = introEngine.hitDrum(code === "KeyZ" ? "kick" : "clap");
            if (hit && code === "KeyZ") chordStabEngine.duck();
            if (hit && viewRef.current === "studio") practiceDrum.current?.(hit);
            return true;
          }
        }
        if (songRef.current !== "levels" || !drumEngine.isReady()) return false;
        const bar = viewRef.current === "studio" ? measureRef.current : performanceMeasureRef.current;
        if (bar < 9 || bar > 11 || !drumCodeToLayer[code]) return false;
        const layer = drumCodeToLayer[code];
        if (layer === "fill" || layer === "riser") drumEngine.oneShot(layer, bar, drumMode.current);
        else drumEngine.toggle(layer, bar, drumMode.current);
        return true;
      },
    });
    keyboard.current = input;
    return () => {
      introMounted = false;
      input.dispose();
      testNotes.current.forEach((note) => engine.noteOff(note));
      for (const voice of assistedTimers.current.values()) window.clearTimeout(voice.timer);
      assistedTimers.current.clear();
      doubledByCode.current.clear();
      interstellarHeld.current.clear();
      levelsHeld.current.clear();
      engine.dispose();
      introEngine.dispose();
      rosesIntro.current = null;
      synthEngine.dispose();
      synth.current = null;
      chordStabEngine.dispose();
      chordStabs.current = null;
      drumEngine.dispose();
      drums.current = null;
      if (testTimer.current !== null) window.clearTimeout(testTimer.current);
      keyboard.current = null;
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    keyboard.current?.setEnabled(
      audioState === "ready" && (captureEnabled || view === "performance" || view === "studio" || view === "sandbox"),
    );
  }, [audioState, captureEnabled, view]);
  useEffect(() => {
    audio.current?.setVolume(volume / 100);
    synth.current?.setGlobalVolume(volume / 100);
    chordStabs.current?.setGlobalVolume(volume / 100);
    rosesIntro.current?.setMaster(volume / 100);
    drums.current?.setMaster(volume / 100);
  }, [volume]);
  useEffect(() => {
    chordStabs.current?.setSettings(rosesDropSettings);
    rosesIntro.current?.setDropLeadSettings(rosesDropSettings);
    try { localStorage.setItem("stage-piano-roses-drop-v4", JSON.stringify(rosesDropSettings)); } catch { /* storage unavailable */ }
  }, [rosesDropSettings]);
  useEffect(() => {
    keyboard.current?.releaseAll();
    chordStabs.current?.setHereWithMeSound(hereWithMeChordSound);
    try { localStorage.setItem("stage-piano-hwm-chord-sound", hereWithMeChordSound); } catch { /* storage unavailable */ }
  }, [hereWithMeChordSound]);
  useEffect(() => {
    chordStabs.current?.setHereWithMeHarmonyVolume(hereWithMeHarmonyVolume);
    try { localStorage.setItem("stage-piano-hwm-harmony-volume",String(hereWithMeHarmonyVolume)); } catch { /* storage unavailable */ }
  },[hereWithMeHarmonyVolume]);

  useEffect(() => {
    rosesIntro.current?.setBassVolumes(rosesBassLevels.bass, rosesBassLevels.sub);
    try { localStorage.setItem("stage-piano-roses-bass-levels", JSON.stringify(rosesBassLevels)); } catch { /* storage unavailable */ }
  }, [rosesBassLevels]);
  useEffect(() => {
    synth.current?.setLoopLevel(rosesSynthLevel);
    try { localStorage.setItem("stage-piano-roses-loop-level", String(rosesSynthLevel)); } catch { /* storage unavailable */ }
  }, [rosesSynthLevel]);
  useEffect(() => {
    rosesIntro.current?.setSynthLeadMs(rosesSynthLeadMs);
    try { localStorage.setItem("stage-piano-roses-synth-lead-ms", String(rosesSynthLeadMs)); } catch { /* storage unavailable */ }
  }, [rosesSynthLeadMs]);
  useEffect(() => {
    rosesIntro.current?.setVocalOffset(rosesVocalOffset, true);
    try { localStorage.setItem("stage-piano-roses-vocal-offset-v2", String(rosesVocalOffset)); } catch { /* storage unavailable */ }
  }, [rosesVocalOffset]);
  useEffect(() => { try { localStorage.setItem("stage-piano-roses-vocal-key", rosesVocalKey); } catch { /* storage unavailable */ } }, [rosesVocalKey]);
  useEffect(() => {
    const settings = validCloserSettings(rosesCloserSettings);
    rosesIntro.current?.setCloserSettings(settings);
    try { localStorage.setItem("stage-piano-roses-here-with-me-v2", JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }, [rosesCloserSettings]);
  useEffect(() => { try { localStorage.setItem("stage-piano-roses-beat-hud", rosesBeatHud ? "on" : "off"); } catch { /* storage unavailable */ } }, [rosesBeatHud]);
  useEffect(() => { saveRosesCalibration(rosesOutput.id, rosesCalibration); rosesIntro.current?.setAudibleClick(rosesCalibration.audibleClick); }, [rosesCalibration, rosesOutput.id]);
  useEffect(() => {
    if (audioState !== "ready") return;
    let cancelled = false;
    const detect = async () => {
      const context = Tone.getContext().rawContext as AudioContext;
      const sink = (context as AudioContext & { sinkId?: string }).sinkId || "default";
      const devices = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) ?? [];
      if (cancelled) return;
      const device = devices.find(item => item.kind === "audiooutput" && item.deviceId === sink);
      setRosesOutput({ id: sink, label: device?.label || (sink === "default" ? "System default output" : "Audio output"), base: Number.isFinite(context.baseLatency) ? context.baseLatency * 1000 : null, output: Number.isFinite(context.outputLatency) ? context.outputLatency * 1000 : null });
      setRosesCalibration(loadRosesCalibration(sink));
    };
    void detect();
    return () => { cancelled = true; };
  }, [audioState]);
  useEffect(() => { synth.current?.setSettings(synthSettings); try { localStorage.setItem("stage-piano-roses-synth", JSON.stringify(synthSettings)); } catch { /* storage unavailable */ } }, [synthSettings]);
  useEffect(() => {
    let cancelled = false;
    try { localStorage.setItem("stage-piano-roses-instrument", instrumentId); } catch { /* storage unavailable */ }
    const engine = synth.current;
    if (!engine) return;
    const instrument = [bundledRosesInstrument, ...savedInstruments()].find(item => item.id === instrumentId);
    if (instrument) {
      setInstrumentError("Loading instrument samples…");
      void engine.useImported(instrument, rosesSettingsRef.current).then(() => { if (!cancelled) setInstrumentError(""); }, error => { if (!cancelled) setInstrumentError(error instanceof Error ? error.message : "Could not load instrument samples."); });
    } else if (Object.hasOwn(presetSettings, instrumentId) || instrumentId.startsWith("user-")) {
      engine.useSynth(rosesSettingsRef.current);
      setInstrumentError("");
    } else {
      setInstrumentId("roses");
    }
    return () => { cancelled = true; };
  }, [instrumentId]);
  useEffect(() => { try { localStorage.setItem("stage-piano-roses-transpose", String(rosesTranspose)); } catch { /* storage unavailable */ } }, [rosesTranspose]);
  useEffect(() => { drums.current?.setMix(drumMix); try { localStorage.setItem("stage-piano-drum-mix", JSON.stringify(drumMix)); } catch { /* storage unavailable */ } }, [drumMix]);
  useEffect(() => {
    audio.current?.setRelease(sustainSettings.releaseSeconds);
    try { localStorage.setItem("stage-piano-sustain-settings", JSON.stringify(sustainSettings)); } catch { /* storage unavailable */ }
  }, [sustainSettings]);
  useEffect(() => {
    try { localStorage.setItem("stage-piano-interstellar-mix-v2", JSON.stringify(interstellarMix)); } catch { /* storage unavailable */ }
  }, [interstellarMix]);
  useEffect(() => {
    const input = new PedalInput(() => setPedal(!sustainRef.current));
    pedalInput.current = input;
    const onDown = (event: KeyboardEvent) => input.keydown(event);
    const onUp = (event: KeyboardEvent) => input.keyup(event);
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => { window.removeEventListener("keydown", onDown, true); window.removeEventListener("keyup", onUp, true); pedalInput.current = null; };
  }, []);
  useEffect(() => {
    const onBlur = () => { pedalInput.current?.reset(); panic(); };
    const onHidden = () => { if (document.hidden) { pedalInput.current?.reset(); panic(); } };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHidden);
    return () => { window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onHidden); };
  }, []);
  useEffect(() => {
    keyboard.current?.setTranspose(transpose);
  }, [transpose]);
  useEffect(() => {
    keyboard.current?.setReservedCodes(
      view === "performance"
        ? [songId === "interstellar" ? interstellarThemeShortcut(themeShortcut) : themeShortcut, "F7", "F8", "F9", "Escape", "Space", "ArrowLeft", "ArrowRight"]
        : ["F9", "Space"],
    );
  }, [view, themeShortcut, songId]);
  useEffect(() => {
    rosesIntro.current?.setBuildupSettings(rosesBuildupSettings);
    try { localStorage.setItem("stage-piano-roses-buildup-v1", JSON.stringify(rosesBuildupSettings)); } catch { /* local settings are optional */ }
  }, [rosesBuildupSettings]);
  const activeProfile = songId === "interstellar" && view === "performance" ? mapForInterstellarSection(performanceSection) : songId === "roses" ? rosesMap : songId === "levels" ? levelsMap(levelsSection, levelsChords) : songId === "rush-e" ? profiles.find(profile => profile.id === "rush-e") ?? standardMap :
    profiles.find((profile) => profile.id === profileId) ?? profiles[0] ?? standardMap;
  profileRef.current = activeProfile.id;
  const isBundledInterstellar = activeProfile.id === interstellarMap.id || activeProfile.id === assistedInterstellarMap.id;
  const keyboardRange = songId === "interstellar" && view === "performance" ? { low: 36, high: 96 } : pianoRange(songId === "levels" ? levelsMap("main", levelsChords).bindings : activeProfile.bindings);
  const activeTranspose = songId === "roses" ? rosesTranspose - 4 : transpose;
  if (songId === "roses") keyboardRange.low = Math.min(keyboardRange.low, Math.min(...Object.values({...rosesChordShortcuts, ...hereWithMeChordShortcuts}).flat()) - activeTranspose);
  const stagePresentation: StagePresentation | undefined = songId === "interstellar" || songId === "levels" || songId === "roses" ? songId : undefined;
  const selectedBacking=rosesIntroSnapshot?.buildup?.mode??defaultBackingMode;
  const rosesBeat=rosesIntroSnapshot?(rosesIntroSnapshot.measure-1)*4+rosesIntroSnapshot.beat-1:0;
  const rosesBackingView=useMemo(()=>backingFrame(selectedBacking,rosesBeat,rosesIntroSnapshot?.drop?.backingSource,rosesIntroSnapshot?.buildup,rosesIntroSnapshot?.drop?.rows),[selectedBacking,rosesBeat,rosesIntroSnapshot?.buildup,rosesIntroSnapshot?.drop]);
  const rosesHwmScene=rosesBackingView.hwm;
  const rosesAutomatic=rosesBackingView.events;
  const stageTheme: Theme = songId === "interstellar" ? "cosmic" : songId === "levels" ? "levels" : songId === "roses" ? "roses" : theme;
  const stageChords = songId === "levels" ? levelsSection === "main" ? levelsChords : levelsSection === "transition" ? levelsTransitionChords : levelsRosesChords : undefined;
  const performanceGuide = useMemo(() => {
    const guide = songId === "roses" ? rosesKeyGuide(activeProfile, activeTranspose, rosesVocalKey) : stageKeyGuide(activeProfile, activeTranspose, stageChords);
    if (songId === "interstellar") return interstellarKeyGuide(interstellarRobloxMap, activeTranspose, performanceSection, interstellarMix.octaveEnabled);
    return guide;
  }, [activeProfile, activeTranspose, stageChords, songId, performanceSection, interstellarMix.octaveEnabled, rosesVocalKey]);
  useEffect(() => {
    keyboard.current?.setMap(activeProfile, songId === "levels" || (songId === "interstellar" && view === "performance"));
  }, [songId, levelsSection, levelsChords, profileId, profiles, view, performanceSection]);
  useEffect(() => {
    keyboard.current?.setChords(songId === "roses" ? { ...rosesChordShortcuts, ...hereWithMeChordShortcuts } : {});
  }, [songId]);
  useEffect(() => {
    if (songId !== "roses") return;
    synth.current?.releaseAll();
    chordStabs.current?.releaseAll();
    liveNotes.current.clear();
    keyboard.current?.setTranspose(rosesTranspose - 4);
  }, [songId, rosesTranspose]);
  useEffect(() => { try { localStorage.setItem("stage-piano-song", songId); localStorage.setItem("stage-piano-levels-chords", JSON.stringify(levelsChords)); localStorage.setItem("stage-piano-levels-transition-gain", String(levelsGain)); } catch { /* storage unavailable */ } }, [songId, levelsChords, levelsGain]);
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
      if (event.code === "F9" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        panic();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (view !== "performance") return;
      if (event.code === "Escape") {
        event.preventDefault();
        exitPerformance();
      } else if (songId === "interstellar" && (event.code === "ArrowLeft" || event.code === "ArrowRight")) {
        event.preventDefault();
        if (!event.repeat) changeInterstellarSection(event.code === "ArrowRight" ? 1 : -1);
      } else if (songId === "levels" && (event.code === "ArrowLeft" || event.code === "ArrowRight")) {
        event.preventDefault();
        if (!event.repeat) setPerformanceBar(performanceMeasureRef.current + (event.code === "ArrowRight" ? 1 : -1), true);
      } else if (event.code === "F7") {
        event.preventDefault();
        if (!event.repeat) setPerformanceLabels((value) => !value);
      } else if (event.code === "F8") {
        event.preventDefault();
        setShowHud((value) => !value);
      } else if (event.code === (songId === "interstellar" ? interstellarThemeShortcut(themeShortcut) : themeShortcut) && !event.repeat) {
        event.preventDefault();
        setTheme(
          (value) => themes[(themes.indexOf(value) + 1) % themes.length],
        );
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view, themeShortcut, songId]);

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
      [...new Set([...snapshot.pressed.flatMap((key) => {
        if (songId === "levels") return levelsHeld.current.get(key.code) ?? [key.midi];
        if (songId === "interstellar" && view === "performance") return interstellarHeld.current.get(key.code)?.map(voice => voice.midi) ?? [key.midi];
        const upper = doubledByCode.current.get(key.code);
        return upper === undefined ? [key.midi] : [key.midi, upper];
      }), ...(songId === "interstellar" && view === "studio" ? practiceAssistedPitches : [])])].sort(
        (a, b) => a - b,
      ),
    [snapshot, songId, view, practiceAssistedPitches],
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

  function panic(preservePedal = false) {
    drums.current?.reset();
    const pedalWasActive = sustainRef.current;
    for (const voice of assistedTimers.current.values()) window.clearTimeout(voice.timer);
    assistedTimers.current.clear();
    doubledByCode.current.clear();
    keyboard.current?.releaseAll();
    interstellarHeld.current.clear();
    practiceAssistedCounts.current.clear();
    setPracticeAssistedPitches([]);
    levelsHeld.current.clear();
    audio.current?.releaseAll();
    rosesIntro.current?.reset();
    synth.current?.releaseAll();
    chordStabs.current?.releaseAll();
    liveNotes.current.clear();
    if (preservePedal && pedalWasActive) { audio.current?.setSustain(true); synth.current?.setSustain(true); chordStabs.current?.setSustain(true); }
    else setPedal(false);
  }
  function setPedal(enabled: boolean) {
    if (sustainRef.current === enabled) return;
    sustainRef.current = enabled;
    audio.current?.setSustain(enabled);
    synth.current?.setSustain(enabled);
    chordStabs.current?.setSustain(enabled);
    if (!enabled) liveNotes.current.pedalUp(performance.now());
    setSustainActive(enabled);
  }
  function changeInterstellarSection(delta: number) {
    const next = moveInterstellarSection(performanceSectionRef.current, delta);
    if (next === performanceSectionRef.current) return;
    performanceSectionRef.current = next;
    if (next === 2) assistedCursor.current = 0;
    const map = mapForInterstellarSection(next);
    keyboard.current?.setMap(map, true);
    profileRef.current = map.id;
    setProfileId(map.id);
    setPerformanceSection(next);
    const bar = interstellarSections[next].firstBar;
    performanceMeasureRef.current = bar;
    setPerformanceMeasure(bar);
  }
  function setPerformanceBar(value: number, sequential = false) {
    const next = Math.max(1, Math.min(songId === "levels" ? levelsSong.measureCount : importedSong.measureCount, Math.round(value) || 1));
    if (songId === "levels" && sequential && performanceMeasureRef.current >= 9 && performanceMeasureRef.current <= 11 && drums.current?.snapshot().status === "running") return;
    if (songId === "levels" && sequential && performanceMeasureRef.current === 11 && next === 12 && drums.current?.snapshot().status !== "roses-ready") return;
    performanceMeasureRef.current = next;
    setPerformanceMeasure(next);
    if (songId === "levels") { if (next >= 12) drums.current?.startAt(12); else drums.current?.reset(); setLevelsSection(next <= 8 ? "main" : next <= 11 ? "transition" : "roses"); }
  }
  function setLevelsMeasure(measure: number) {
    measureRef.current = measure;
    setLevelsSection(measure <= 8 ? "main" : measure <= 11 ? "transition" : "roses");
  }
  function selectSong(next: SongId) {
    if (next === songId) return;
    panic(true);
    songRef.current = next;
    setSongId(next);
    if (next === "interstellar") setProfileId(interstellarMap.id);
    if (next === "rush-e") setProfileId("rush-e");
    if (next === "levels" || next === "interstellar") { keyboard.current?.setTranspose(0); setTranspose(0); }
    if (next === "roses") {
      setView("sandbox");
      setAudioState(synth.current?.isReady() && chordStabs.current?.isReady() ? "ready" : "locked");
    } else {
      keyboard.current?.setTranspose(next === "rush-e" ? transpose : 0);
      if (next === "rush-e") setView("sandbox");
      else if (viewRef.current === "sandbox") setView("studio");
      if (synth.current?.isReady()) void ensurePianoAudio();
    }
    measureRef.current = 1;
    performanceMeasureRef.current = 1;
    setPerformanceMeasure(1);
    setLevelsSection("main");
  }
  function selectRosesInstrument(id: string) {
    keyboard.current?.releaseAll();
    chordStabs.current?.releaseAll();
    liveNotes.current.clear();
    try {
      const saved = JSON.parse(localStorage.getItem("stage-piano-roses-instrument-settings-v1") || "{}");
      const customs = JSON.parse(localStorage.getItem("stage-piano-roses-user-presets-v1") || "[]");
      const custom = Array.isArray(customs) ? customs.find((item: { id: string; settings: SynthSettings }) => item.id === id) : undefined;
      setSynthSettings(validSynthSettings(saved[id] ?? presetSettings[id as keyof typeof presetSettings] ?? custom?.settings ?? presetSettings.roses));
    } catch { setSynthSettings(presetSettings.roses); }
    setInstrumentId(id);
  }
  function triggerAssisted(event: AssistedEvent) {
    if (!audio.current?.isReady()) return;
    const bpm = importedSong.measures[event.bar - 1].tempoBpm;
    for (const midi of event.assistedMidi) {
      const id = assistedNextId.current++;
      const code = `assisted:${id}`;
      const at = performance.now();
      if (audio.current.noteOn(midi, mixRef.current.assisted * sectionGain(event.bar))) liveNotes.current.dampPitch(midi, at);
      liveNotes.current.on(code, midi, at, true);
      practiceAssistedCounts.current.set(midi, (practiceAssistedCounts.current.get(midi) ?? 0) + 1);
      setPracticeAssistedPitches([...practiceAssistedCounts.current.keys()]);
      const timer = window.setTimeout(() => {
        audio.current?.noteOff(midi);
        liveNotes.current.off(code, performance.now(), sustainRef.current);
        const remaining = (practiceAssistedCounts.current.get(midi) ?? 1) - 1;
        if (remaining > 0) practiceAssistedCounts.current.set(midi, remaining);
        else practiceAssistedCounts.current.delete(midi);
        setPracticeAssistedPitches([...practiceAssistedCounts.current.keys()]);
        assistedTimers.current.delete(id);
      }, event.durationBeats * 60000 / bpm);
      assistedTimers.current.set(id, { timer, midi, code });
    }
  }
  function resetAssistedSection() {
    panic(true);
  }
  function selectProfile(id: string) {
    const next = profiles.find((profile) => profile.id === id);
    if (!next || next.id === activeProfile.id) return;
    if (next.id === interstellarMap.id || next.id === assistedInterstellarMap.id) {
      keyboard.current?.setTranspose(0);
      setTranspose(0);
    }
    panic(true);
    keyboard.current?.setMap(next);
    liveNotes.current.clear();
    setProfileId(next.id);
  }
  function exitPerformance() {
    panic(true);
    if (songId === "interstellar") {
      setProfileId(interstellarMap.id);
    }
    setView("practice");
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }
  function enterStudio() {
    panic(true);
    if (songId === "rush-e") { setView("sandbox"); return; }
    if (songId === "roses") { setView("studio"); return; }
    previousTranspose.current = transpose;
    keyboard.current?.setTranspose(0);
    setTranspose(0);
    if (songId === "interstellar") selectProfile(interstellarMap.id);
    setView("studio");
  }
  function exitStudio() {
    panic(true);
    if (songId === "roses") { keyboard.current?.setTranspose(rosesTranspose - 4); setView("sandbox"); return; }
    if (songId === "interstellar" && activeProfile.id === assistedInterstellarMap.id) selectProfile(interstellarMap.id);
    keyboard.current?.setTranspose(previousTranspose.current);
    setTranspose(previousTranspose.current);
    setView("practice");
  }
  function enterSandbox() {
    panic(true);
    if (songId === "levels") { measureRef.current = 1; setLevelsSection("main"); }
    setView("sandbox");
  }
  function exitSandbox() { panic(true); setView("practice"); }
  function sandboxToSheet(mode: "step" | "timed") {
    if (songId !== "interstellar" && songId !== "levels" && songId !== "roses") return;
    panic(true);
    if (songId === "levels") { measureRef.current = 1; setLevelsSection("main"); }
    try { localStorage.setItem(songId === "levels" ? "stage-piano-levels-mode" : songId === "roses" ? "stage-piano-roses-intro-mode" : "stage-piano-practice-mode", mode); } catch { /* storage unavailable */ }
    setView("studio");
  }
  async function enterPerformance() {
    if (audioState !== "ready") return;
    drumMode.current = "performance";
    if (songId === "roses") { rosesIntro.current?.reset(); setPerformanceLabels(true); }
    if (songId === "interstellar") {
      panic(true);
      performanceSectionRef.current = 1;
      setPerformanceSection(1);
      assistedCursor.current = 0;
      performanceMeasureRef.current = 1;
      setPerformanceMeasure(1);
      profileRef.current = interstellarMap.id;
      setProfileId(interstellarMap.id);
      keyboard.current?.setMap(mapForInterstellarSection(1));
    }
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

  async function ensurePianoAudio() {
    const requestedSong = songRef.current;
    const needsDrums = requestedSong === "levels";
    if (audio.current?.isReady() && (!needsDrums || drums.current?.isReady())) { setAudioState("ready"); return; }
    setAudioState("loading");
    try {
      await Promise.all([audio.current?.start(), needsDrums ? drums.current?.load() : Promise.resolve()]);
      if (songRef.current === requestedSong) setAudioState("ready");
    } catch {
      if (songRef.current === requestedSong) setAudioState("error");
    }
  }
  async function startAudio() {
    if (!synth.current || audioState === "loading") return;
    setAudioState("loading");
    try {
      await Promise.all([synth.current.start(), songRef.current === "roses" ? chordStabs.current?.load() : Promise.resolve()]);
      if (songRef.current === "roses") setAudioState("ready");
      else await ensurePianoAudio();
    } catch { setAudioState("error"); }
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

  if (view === "sandbox") return <SandboxMode vocalKey={rosesVocalKey} hereWithMeHarmonyVolume={hereWithMeHarmonyVolume} onHereWithMeHarmonyVolume={setHereWithMeHarmonyVolume} hereWithMeChordSound={hereWithMeChordSound} onHereWithMeChordSound={setHereWithMeChordSound} closerSettings={rosesCloserSettings} onCloserSettings={setRosesCloserSettings} introEngine={rosesIntro.current} introClock={rosesIntroSnapshot} buildupSettings={rosesBuildupSettings} onBuildupSettings={setRosesBuildupSettings} dropSettings={rosesDropSettings} setDropSettings={setRosesDropSettings} compareLoudStab={async side => { if (audioState !== "ready") await startAudio(); if (chordStabs.current?.isReady()) chordStabs.current.compareLoudStab(side); }} songId={songId} map={activeProfile} transpose={activeTranspose} range={keyboardRange} snapshot={snapshot} activePitches={activePitches} liveNotes={liveNotes.current} audioReady={audioState === "ready"} startAudio={startAudio} volume={volume} setVolume={setVolume} rosesTranspose={rosesTranspose} setRosesTranspose={setRosesTranspose} synthSettings={synthSettings} setSynthSettings={setSynthSettings} instrumentId={instrumentId} setInstrumentId={selectRosesInstrument} instrumentError={instrumentError} previewInstrument={(midi) => synth.current?.preview(midi)} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} onSongChange={selectSong} onSheet={sandboxToSheet} onExit={exitSandbox} onPerformance={enterPerformance} />;

  if (view === "studio")
    return songId === "roses"
      ? <RosesPractice buildupSettings={rosesBuildupSettings} onBuildupSettings={setRosesBuildupSettings} liveNotes={liveNotes.current} map={activeProfile} transpose={activeTranspose} range={keyboardRange} snapshot={snapshot} audioReady={audioState === "ready"} startAudio={startAudio} engine={rosesIntro.current} clock={rosesIntroSnapshot} drumStatus={rosesIntroLoadState} onNoteRef={practiceNote} onDrumRef={practiceDrum} onExit={exitStudio} onSandbox={enterSandbox} onPerformance={enterPerformance} onSongChange={selectSong} instrumentId={instrumentId} onInstrument={selectRosesInstrument} instrumentError={instrumentError} synthLevel={rosesSynthLevel} onSynthLevel={setRosesSynthLevel} synthLeadMs={rosesSynthLeadMs} onSynthLeadMs={setRosesSynthLeadMs} bassLevels={rosesBassLevels} onBassLevels={setRosesBassLevels} vocalOffset={rosesVocalOffset} onVocalOffset={setRosesVocalOffset} vocalKey={rosesVocalKey} onVocalKey={setRosesVocalKey} closerSettings={rosesCloserSettings} onCloserSettings={setRosesCloserSettings} calibration={rosesCalibration} onCalibration={setRosesCalibration} output={rosesOutput} />
      : songId === "levels"
      ? <LevelsPractice map={activeProfile} range={keyboardRange} snapshot={snapshot} pressedPitches={activePitches} audioReady={audioState === "ready"} startAudio={startAudio} onNoteRef={practiceNote} onUnmappedRef={practiceUnmapped} onExit={exitStudio} onMeasureChange={setLevelsMeasure} resetVoices={() => panic(true)} transitionGain={levelsGain} setTransitionGain={setLevelsGain} chords={levelsChords} setChords={setLevelsChords} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} showAssistedNotes={showAssistedNotes} setShowAssistedNotes={setShowAssistedNotes} onSongChange={selectSong} onSandbox={enterSandbox} drums={drums.current} drumSnapshot={drumSnapshot} drumMix={drumMix} setDrumMix={setDrumMix} setDrumMode={mode => { drumMode.current = mode; }} />
      : <PracticeStudio map={activeProfile} snapshot={snapshot} soundingPitches={activePitches} audioReady={audioState === "ready"} startAudio={startAudio} selectProfile={selectProfile} profiles={profiles} onNoteRef={practiceNote} onUnmappedRef={practiceUnmapped} onExit={exitStudio} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} showAssistedNotes={showAssistedNotes} setShowAssistedNotes={setShowAssistedNotes} liveNotes={liveNotes.current} onMeasureChange={measure => { measureRef.current = measure; }} triggerAssisted={triggerAssisted} resetAssisted={resetAssistedSection} interstellarMix={interstellarMix} setInterstellarMix={setInterstellarMix} onSongChange={selectSong} onSandbox={enterSandbox} />;

  if (view === "performance")
    return (
      <main
        ref={stage}
        className={`performance-stage ${songId==="roses"&&rosesHwmScene&&rosesBeat>=144&&rosesBeat<176?"hwm-drop-scene":""} ${rosesHwmScene&&songId==="roses"?"hwm-scene":""} theme-${stageTheme} ${stagePresentation ? `stage-presentation stage-${stagePresentation}` : ""} ${cursorHidden ? "cursor-hidden" : ""}`}
      >
        <PerformanceVisualizer
          notes={liveNotes.current}
          map={activeProfile}
          transpose={activeTranspose}
          theme={stageTheme}
          automaticGuide={songId==="roses"?{events:rosesAutomatic,hwm:rosesHwmScene,intensity:rosesBeat>=144?1:rosesBackingView.intensity,riserProgress:rosesBackingView.riserProgress,riserIntensity:rosesBackingView.riserIntensity,beat:rosesBeat,playing:rosesIntroSnapshot?.status==="running"&&(rosesBeat>=144?rosesIntroSnapshot?.drop?.status==="running":["PLAYING","BREAK"].includes(rosesIntroSnapshot?.buildup?.status??"")),getBeat:()=>rosesIntro.current?.scoreBeat()??rosesBeat}:undefined}
          presentation={stagePresentation}
          keyGuide={performanceGuide}
          notesPerSecond={snapshot.notesPerSecond}
          showAssisted={!!stagePresentation || showAssistedNotes}
          range={songId === "interstellar" || songId === "levels" || songId === "roses" ? keyboardRange : undefined}
        />
        {stagePresentation && <PerformanceHeader song={stagePresentation} title={songId==="roses"?(rosesHwmScene?"Here With Me":"Roses"):undefined} section={songId==="roses"?rosesBackingView.role:undefined} chord={songId==="roses"?rosesBackingView.chord:undefined} measure={songId==="roses"?rosesIntroSnapshot?.measure??1:performanceMeasure} bpm={songId === "levels" ? performanceMeasure >= 12 ? 100 : 126 : 100} beat={songId === "roses"?rosesIntroSnapshot?.beat:songId === "levels" && drumSnapshot?.status === "running" ? drumSnapshot.beat : undefined} sustain={sustainActive} showPedal={sustainSettings.showIndicator} elapsed={showHud ? elapsed : undefined} />}
        {!stagePresentation && sustainSettings.showIndicator && <div className={`performance-sustain ${sustainActive ? "is-active" : ""}`}>PEDAL {sustainActive ? "ON" : "OFF"}</div>}
        {!stagePresentation && <div className="performance-profile">
          {activeProfile.name}{" "}
          <span>· F7 LABELS {performanceLabels ? "ON" : "OFF"}</span>
        </div>}
        {songId === "roses" && <details className="roses-performance-controls"><summary>Performance controls</summary><div className="roses-performance-status">
          <strong>{rosesHwmScene?"HERE WITH ME":"ROSES"} · BAR {String(rosesIntroSnapshot?.measure ?? 1).padStart(2, "0")} / 44 · BEAT {(rosesIntroSnapshot?.beat ?? 1).toFixed(2)} · 100 BPM{rosesIntroSnapshot?.status === "finished" ? " · FINISHED" : ""}</strong>
          <span>SYNTH {rosesIntroSnapshot?.synthPending !== undefined ? rosesIntroSnapshot.synthPending ? "ARMED" : "STOP QUEUED" : rosesIntroSnapshot?.synthActive ? "ON" : "OFF"} · BASS/SUB {rosesIntroSnapshot?.bassPending !== undefined ? rosesIntroSnapshot.bassPending ? "ARMED" : "STOP QUEUED" : rosesIntroSnapshot?.bassActive ? "PLAYING" : "NOT ARMED"} · BUILD {rosesIntroSnapshot?.buildPending ? "ARMED" : rosesIntroSnapshot?.buildActive ? "PLAYING" : "NOT ARMED"} · VOCAL {rosesIntroSnapshot?.vocalStatus ?? "NOT ARMED"}</span>
          <span>{rosesIntroSnapshot?.status === "finished" ? "Finished · Reset to rehearse" : rosesIntroSnapshot?.missedBassHandoff && !rosesIntroSnapshot.bassActive ? "MISSED BASS HANDOFF · N recovers on the next bar" : (rosesIntroSnapshot?.measure ?? 1) === 4 ? `Arm V synth and ${rosesVocalKey.replace("Key", "")} vocal for bar 5` : (rosesIntroSnapshot?.measure ?? 1) < 5 ? "Play live synth · V arms synth for bar 5" : (rosesIntroSnapshot?.measure ?? 1) < 13 ? "Play Z/X drums · N arms bass for bar 13" : (rosesIntroSnapshot?.measure ?? 1) >= 29 ? `${rosesBackingView.source} · ${rosesBackingView.chord??"automatic backing"}` : (rosesIntroSnapshot?.measure ?? 1) >= 21 ? "Guitar + build bass · no required drums" : (rosesIntroSnapshot?.measure ?? 1) >= 20 ? "Play X clap · M accent optional" : "Play Z kick / X clap · M accent at bar 16"}</span>
          {rosesIntroSnapshot?.lastDrum && <span className="roses-drum-flash" key={rosesIntroSnapshot.lastDrum.sequence}>{rosesIntroSnapshot.lastDrum.kind.toUpperCase()} HIT</span>}
          {rosesIntroSnapshot?.lastAccent && <span className="roses-drum-flash" key={`accent-${rosesIntroSnapshot.lastAccent}`}>VOCAL ACCENT HIT</span>}
          <div><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError || rosesIntroSnapshot?.drop?.status === "loading"} onClick={() => rosesIntro.current?.startWithDrop(1, "performance")}>Start bar 1</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(5, "performance")}>Start bar 5</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(9, "performance")}>Start bar 9</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(13, "performance")}>Start bar 13</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(21, "performance")}>Start bar 21</button><button onClick={() => rosesIntro.current?.armSynth()}>V Arm synth</button><button onClick={() => rosesIntro.current?.armBass()}>N Arm bass</button><button onClick={() => rosesIntro.current?.armBuild()} disabled={rosesIntroSnapshot?.status === "running" && rosesIntroSnapshot.measure >= 21}>F6 Arm build</button><button onClick={() => rosesIntro.current?.armVocal()} disabled={!rosesIntroSnapshot?.vocalReady || rosesIntroSnapshot.status === "running" && rosesIntroSnapshot.measure !== 4}>{rosesVocalKey.replace("Key", "")} Arm vocal</button><button disabled={!rosesIntroSnapshot || !["running", "paused"].includes(rosesIntroSnapshot.status)} onClick={() => rosesIntroSnapshot?.status === "paused" ? rosesIntro.current?.resume() : rosesIntro.current?.pause()}>{rosesIntroSnapshot?.status === "paused" ? "Resume" : "Pause"}</button><button onClick={() => setRosesBeatHud(value => !value)}>Beat HUD {rosesBeatHud ? "ON" : "OFF"}</button><button onClick={() => rosesIntro.current?.stopLoop()}>B Stop backing</button><button onClick={() => rosesIntro.current?.reset()}>Reset</button></div>
          <label className="roses-performance-synth-level">V Synth <output>{Math.round(rosesSynthLevel * 100)}%</output><input aria-label="V Synth backing level" type="range" min="0" max="150" step="5" value={Math.round(rosesSynthLevel * 100)} onChange={event => setRosesSynthLevel(Number(event.target.value) / 100)} /></label>
          <label className="roses-performance-synth-level">Synth lead <output>{rosesSynthLeadMs} ms</output><input aria-label="V Synth timing lead" type="range" min="0" max="60" step="5" value={rosesSynthLeadMs} onChange={event => setRosesSynthLeadMs(Number(event.target.value))} /></label>
          <small>{rosesChordHint}</small>
          <small>V synth · N bass/sub · F6 build at bar 21 · {rosesVocalKey.replace("Key", "")} vocal at bar 4 for bar 5 · Z kick · X clap · M accent · B stop · Space pedal {sustainActive ? "ON" : "OFF"} · samples {rosesIntroLoadState}{instrumentError ? ` · ${instrumentError}` : ""}</small>
          <RosesBackingControls engine={rosesIntro.current} clock={rosesIntroSnapshot} audioReady={audioState==="ready"} startAudio={startAudio} vocalLevel={rosesCloserSettings.closerLevel} onVocalLevel={level=>setRosesCloserSettings({...rosesCloserSettings,closerLevel:level})}/>
          <RosesBuildupControls engine={rosesIntro.current} clock={rosesIntroSnapshot} settings={rosesBuildupSettings} onChange={setRosesBuildupSettings} compact />
          <HereWithMeLeadControls engine={rosesIntro.current} clock={rosesIntroSnapshot} compact />
          <RosesCloserControls settings={rosesCloserSettings} onChange={setRosesCloserSettings} status={rosesIntroSnapshot?.closerStatus} compact />
          <div><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(25, "performance")}>Start bar 25</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(27, "performance")}>Start bar 27</button></div>
          {rosesIntroSnapshot?.status === "finished" && <span>{rosesIntroSnapshot.sectionTails ? "Roses section complete · audio tails releasing" : "Roses section complete"}{rosesIntroSnapshot.closerStatus === "PLAYING" ? " · Here With Me continues" : ""}</span>}
        </div></details>}
        {songId === "roses" && rosesBeatHud && <div className="roses-performance-beat"><RosesBeatClock engine={rosesIntro.current} clock={rosesIntroSnapshot} leadMs={rosesCalibration.leadMs} closerSettings={rosesCloserSettings} compact /></div>}
        {songId === "levels" && performanceMeasure >= 9 && performanceMeasure <= 11 && <div className="performance-drum-pulse" key={drumSnapshot?.pulse} />}
        <div className="performance-piano">
          {songId === "roses" && <div className="piano-input-legend"><span>● LIVE · KEYCAPS</span><span>━ AUTO · ACTIVITY</span></div>}
          <PianoCanvas
            active={activePitches}
            automatic={songId==="roses"&&rosesIntroSnapshot?.status==="running"&&(rosesBeat>=144?rosesIntroSnapshot?.drop?.status==="running":["PLAYING","BREAK"].includes(rosesIntroSnapshot?.buildup?.status??""))?rosesBackingView.active.flatMap(e=>e.pitches):[]}
            map={activeProfile}
            range={songId === "interstellar" || songId === "levels" || songId === "roses" ? keyboardRange : undefined}
            transpose={activeTranspose}
            showLabels={performanceLabels}
            presentation={stagePresentation}
            keyGuide={performanceGuide}
            prominentPitches={songId === "interstellar" ? interstellarProminentPitches(performanceSection, interstellarMix.octaveEnabled, activeTranspose) : undefined}
            coolLighting={songId === "roses" && rosesHwmScene}
            pressedCodes={snapshot.pressed.map(key => key.code)}
            pressedKeys={songId === "interstellar" ? interstellarDisplayPressedKeys(snapshot.pressed, activeTranspose) : undefined}
            starlightNotes={songId === "interstellar" ? liveNotes.current : undefined}
          />
        </div>
        {showHud && !stagePresentation && (
          <div className="performance-hud">
            {songId === "levels" && performanceMeasure >= 9 && <><span>Bar {performanceMeasure} · beat {drumSnapshot?.beat ?? 1} · {Math.round(drumSnapshot?.tempo ?? 126)} BPM</span><span>Z {drumSnapshot?.active.kick ? "ON" : "OFF"} · X {drumSnapshot?.active.clap ? "ON" : "OFF"} · C {drumSnapshot?.active.hat ? "ON" : "OFF"}</span><span>{drumSnapshot?.nextAction ?? "Press Z for kick"}</span><span>Pedal {sustainActive ? "ON" : "OFF"}</span></>}
            {songId === "interstellar" && <span>{performanceSection}/3 · {interstellarSections[performanceSection].label}</span>}
            <span>{snapshot.notesPerSecond} notes/s</span>
            <span>{snapshot.pressed.length} active</span>
            <span>
              {songId === "roses" ? "Roses Synth" : theme === "rush"
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
          <label className="performance-start-bar">Song <select value={songId} onChange={event => selectSong(event.target.value as SongId)}><option value="interstellar">Interstellar</option><option value="levels">Levels — Avicii</option><option value="rush-e">Rush E — piano preset</option><option value="roses">Roses — The Chainsmokers</option></select></label>
          {songId === "levels" && <label className="performance-start-bar">Levels bar <input type="number" min="1" max={levelsSong.measureCount} value={performanceMeasure} onChange={event => setPerformanceBar(Number(event.target.value))} /> <small>← / → on stage</small></label>}
          {songId === "interstellar" && <><span className="control-hint">Starts in Opening · ← / → changes sections</span><label className="performance-start-bar"><input type="checkbox" checked={interstellarMix.octaveEnabled} onChange={event => setInterstellarMix({ ...interstellarMix, octaveEnabled: event.target.checked })} /> Climax F → E5 + E6</label></>}
          <button className="start-button performance-enter" onClick={enterStudio}>
            Open Practice Studio <span className="arrow">↗</span>
          </button>
          {songId !== "roses" && <button className="start-button performance-enter" onClick={enterSandbox}>Open Sandbox <span className="arrow">↗</span></button>}
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
                  <kbd key={`${key.code}:${key.midi}`}>{key.label}</kbd>
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
                {isBundledInterstellar || songId === "levels" || songId === "roses"
                  ? songId === "roses" ? "Adjust transposition in Roses Sandbox" : "Fixed to the imported MIDI pitches"
                  : "Shift the full keyboard by one octave"}
              </small>
            </div>
            <div className="stepper">
              <button
                aria-label="Lower octave"
                onClick={() =>
                  setTranspose((value) => Math.max(-12, value - 12))
                }
                disabled={isBundledInterstellar || songId === "levels" || songId === "roses" || transpose <= -12}
              >
                −
              </button>
              <span>
                {isBundledInterstellar || songId === "levels" || songId === "roses"
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
                disabled={isBundledInterstellar || songId === "levels" || songId === "roses" || transpose >= 12}
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

      {songId === "levels" ? <section className="mapping-panel" aria-label="Levels assisted mapping"><div className="keyboard-topline"><div><span className="section-index">03 / LEVELS MAPPING</span><h2>Single-key assisted chords</h2></div><button className="guide-button" onClick={enterStudio}>Adjust keys in Practice Studio ↗</button></div><p className="active-mapping">A/S/D/F trigger the left-hand stacks. U/I/O and J/K/L trigger the main chords. Six additional dyads use Y/P/;/H/N/,. At bar 9, J and M switch to individual notes. Remap any trigger in Practice Studio after a keyboard rollover test.</p></section> : <section className="mapping-panel" aria-label="Keyboard mapping editor">
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
      </section>}

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
            <span>{isBundledInterstellar ? "UPPER OCTAVE: E6 VISIBLE · " : ""}CURRENT PROFILE: {activeProfile.name.toUpperCase()}</span>
          </div>
          <PianoCanvas
            active={activePitches}
            map={activeProfile}
            range={songId === "levels" || songId === "roses" ? keyboardRange : undefined}
            transpose={activeTranspose}
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
