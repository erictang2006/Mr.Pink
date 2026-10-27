import { rosesHwmVisuals } from './piano/rosesHwmVisuals';
import { usePreference } from './settings/usePreference';
import {LevelsWarpController,levelsWarpSettings} from './piano/levelsInterstellarTransition';
import {cosmicGalaxyGeometry} from './piano/cosmicGeometry';
import {TransitionSounds,isMessageTap} from './opening/transitionSounds';
import PianoSceneGhost,{capturePianoFrame} from './components/PianoSceneGhost';
import './components/levelsInterstellarTransition.css';
import GalaxyVinylTransition from './components/GalaxyVinylTransition';
import {RosesReveal,rosesRevealSettings,type GalaxyOrigin} from './piano/rosesReveal';
import { pressVisualDropChord, releaseVisualDropChord, visualDropChordShortcuts } from "./piano/visualDropChords";
import PerformanceTransition from "./components/PerformanceTransition";
import { nextPerformanceStep } from "./piano/performanceSetlist";
import { normalizeRosesVocalKey } from "./piano/rosesIntroKeys";
import type { StageActivity } from './components/stageEnergy';
import PerformanceWorkstation from "./components/PerformanceWorkstation";
import { performancePads } from "./piano/performancePads";
import { levelsEMajor, levelsRealDrums, levelsIndividualGuide, levelsDrumHint, type LevelsPlayingMode } from "./piano/levelsRealPiano";
import LiveKeysHud from './components/LiveKeysHud';
import {LiveKeyHistory} from './piano/liveKeyHistory';
import {performanceKeyPitch} from './piano/performanceKeyPitch';
import PianoTypingReveal from './opening/PianoTypingReveal';
import OfflineErrorScreen from './opening/OfflineErrorScreen';
import TypingTestScreen from './opening/TypingTestScreen';
import {isTypingScene} from './opening/typingTest';
import OpeningGuard from './opening/OpeningGuard';
import {openingReliability} from './opening/renderBudget';
import FirstNoteRipple from './opening/FirstNoteRipple';
import {FirstNoteCue} from './opening/choreography';
import OpeningReveal, { csaLogoMask, openingStyle } from './opening/OpeningReveal';
import { OpeningSequence, type OpeningStart } from './opening/sequence';
import { interstellarThemeShortcut, interstellarRobloxMap } from './piano/interstellarRoblox';
import { interstellarKeyGuide, interstellarDisplayPressedKeys, interstellarProminentPitches, interstellarSoundingKeys } from './piano/interstellarPresentation';
import { rosesKeyGuide } from './piano/rosesPresentation';
import {backingFrame} from "./piano/backingVisuals";
import {defaultBackingMode} from "./piano/rosesBacking";
import {finalizedRosesBuildup, finalizedRosesDrop} from "./piano/rosesAudioSelection";
import RosesBackingControls from "./components/RosesBackingControls";
import RosesBassControls from "./components/RosesBassControls";
import RosesPerformanceTransport from "./components/RosesPerformanceTransport";
import RosesIntroLoopDeck from "./components/RosesIntroLoopDeck";
import { rosesManualBassNote, silentAutomaticBassActive } from "./piano/rosesManualBass";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import * as Tone from "tone";
import { flushSync } from "react-dom";
import PianoCanvas from "./components/PianoCanvas";
import {sodaPop} from './finale/sodaPopEngine';
import SodaPopFinale from './finale/SodaPopFinale';
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
import { DeferredAudioPreparation } from './piano/audioPreparation';
import {
  KeyboardInputManager,
  type InputSnapshot,
} from "./piano/keyboardInput";
import { midiToName, standardMap, type KeyboardMap } from "./piano/noteMapping";
import { LiveNotes } from "./piano/liveNotes";
import { PedalInput, spaceStartsRosesPerformance } from "./piano/pedalInput";
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
import { rosesChordShortcuts, rosesChordSource } from "./piano/rosesChords";
import { rosesChordHint, rosesChordBindings, rosesChordEngineCode, rosesIndividualChordPitch } from "./piano/rosesIndividualChords";
import { validHereWithMeChordSound } from "./piano/hereWithMeChords";
import { RosesChordStabEngine } from "./piano/rosesChordStabEngine";
import { validRosesDropSettings } from "./piano/rosesDropSettings";
import { RosesIntroEngine, type LiveDrumHit, type RosesIntroSnapshot } from "./piano/rosesIntroEngine";
import { rosesIntroLoopActive, rosesIntroLoopPianoKeys, rosesVocalCue } from "./piano/rosesIntro";
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
const levelsOpeningFirstLoad = savedValue("stage-piano-levels-opening-v1", "") !== "ready";

export default function App() {
  const sodaState=useSyncExternalStore(sodaPop.subscribe,sodaPop.snapshot,sodaPop.snapshot);
  const finaleActive=sodaState.status==='running'||sodaState.status==='paused'||sodaState.status==='finished';
  const [audioState, setAudioState] = useState<
    "locked" | "loading" | "ready" | "error"
  >("locked");
  const [captureEnabled, setCaptureEnabled] = usePreference('keyboard-capture', true);
  const [liveKeyHistory] = useState(() => new LiveKeyHistory());
  const [showLiveKeys, setShowLiveKeys] = useState(true);
  const liveKeysEnabledRef=useRef(showLiveKeys);
  liveKeysEnabledRef.current=showLiveKeys;
  const [rosesReveal] = useState(()=>new RosesReveal());
  const rosesRevealState=useSyncExternalStore(rosesReveal.subscribe,rosesReveal.getSnapshot,rosesReveal.getSnapshot);
  const [galaxyBridge,setGalaxyBridge]=useState<{origin:GalaxyOrigin;at:number}|null>(null);
  const galaxyBridgeRunning=useRef(false);
  const levelsWarpActions=useRef({switchSong:()=>{},ready:()=>{}});
  const [levelsWarp]=useState(()=>new LevelsWarpController({switchSong:()=>levelsWarpActions.current.switchSong(),ready:()=>levelsWarpActions.current.ready()}));
  const levelsWarpState=useSyncExternalStore(levelsWarp.subscribe,levelsWarp.getSnapshot,levelsWarp.getSnapshot);
  const [levelsPianoGhost,setLevelsPianoGhost]=useState<HTMLCanvasElement|null>(null);
  const [openingSequence] = useState(() => new OpeningSequence());
  const [openingSnapshot, setOpeningSnapshot] = useState(openingSequence.getSnapshot);
  const [openingAsset, setOpeningAsset] = useState<'loading'|'ready'|'error'>('loading');
  const openingAssetRef=useRef(openingAsset);openingAssetRef.current=openingAsset;
  const [openingError, setOpeningError] = useState('');
  const openingFirstNote=useRef(new FirstNoteCue());
  const [openingFirstNoteAt,setOpeningFirstNoteAt]=useState<number|null>(null);
  const openingActions = useRef<{start:(mode:OpeningStart)=>boolean;cancel:()=>void}>({start:()=>false,cancel:()=>{}});

  const [songId, setSongId] = useState<SongId>(() => {
    if (levelsOpeningFirstLoad) return "levels";
    const saved = savedValue("stage-piano-song", "levels");
    return saved === "levels" || saved === "roses" || saved === "interstellar" ? saved : "levels";
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
  const [rosesVocalKey] = useState<string>(() => {
    return normalizeRosesVocalKey(savedValue("stage-piano-roses-vocal-key", "KeyG"));
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
    return Number.isFinite(stored) ? Math.max(-60, Math.min(60, stored)) : 20;
  });
  const [levelsPlayingMode, setLevelsPlayingMode] = useState<LevelsPlayingMode>(()=>savedValue("stage-piano-levels-playing-mode","assisted")==="real"?"real":"assisted");
  const [levelsPerformanceMode, setLevelsPerformanceMode] = useState<LevelsPlayingMode>(()=>savedValue("stage-piano-levels-performance-mode","real")==="assisted"?"assisted":"real");
  useEffect(()=>{
    try { localStorage.setItem('stage-piano-levels-playing-mode',levelsPlayingMode); localStorage.setItem('stage-piano-levels-performance-mode',levelsPerformanceMode); } catch { /* Session settings remain usable. */ }
  },[levelsPlayingMode,levelsPerformanceMode]);
  const levelsRealRef = useRef(false);
  const stageVisualLevel = useRef(0);
  const [levelsSection, setLevelsSection] = useState<LevelsSection>("main");
  const [levelsGain, setLevelsGain] = useState(() => Math.max(0.1, Math.min(1, Number(savedValue("stage-piano-levels-transition-gain", "0.4")) || 0.4)));
  const [drumMix, setDrumMix] = useState<DrumMix>(() => { try { return { ...defaultDrumMix, ...JSON.parse(localStorage.getItem("stage-piano-drum-mix") || "{}") }; } catch { return defaultDrumMix; } });
  const [drumSnapshot, setDrumSnapshot] = useState<DrumSnapshot | null>(null);
  const [levelsChords, setLevelsChords] = useState<Record<string, number[]>>(() => {
    try { return validatedLevelsChords(JSON.parse(localStorage.getItem("stage-piano-levels-chords") || "null"));
    } catch { return levelsChordDefaults; }
  });
  const [view, setView] = useState<"practice" | "studio" | "sandbox" | "performance">(
    () => new URLSearchParams(window.location.search).get("view") === "sandbox" || (!levelsOpeningFirstLoad && savedValue("stage-piano-song", "levels") === "roses" && new URLSearchParams(window.location.search).get("view") !== "performance") ? "sandbox" : ["practice", "assisted"].includes(new URLSearchParams(window.location.search).get("view") ?? "") ? "studio" : "practice",
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
  const [volume, setVolume] = usePreference('master-volume', 72, value => value >= 0 && value <= 100);
  const [transpose, setTranspose] = usePreference('transpose', 0, value => Number.isInteger(value) && value >= -12 && value <= 12);
  const liveKeysTransposeRef=useRef(transpose);
  liveKeysTransposeRef.current=transpose;
  const [showGuide, setShowGuide] = usePreference('show-guide', false);
  const [practiceLabels, setPracticeLabels] = usePreference('practice-labels', true);
  const [performanceLabels, setPerformanceLabels] = usePreference('performance-labels', false);
  const [songTransition, setSongTransition] = useState<string | null>(null);
  const [rosesPerformanceSetup, setRosesPerformanceSetup] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = usePreference('keyboard-height', 330, value => value >= 280 && value <= 400);
  const [sustainSettings, setSustainSettings] = useState<SustainSettingsValue>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("stage-piano-sustain-settings") || "{}");
      return { releaseSeconds: Number.isFinite(saved.releaseSeconds) ? saved.releaseSeconds : 0.55, showIndicator: saved.showIndicator !== false };
    } catch { return { releaseSeconds: 0.55, showIndicator: true }; }
  });
  const [sustainActive, setSustainActive] = useState(false);
  const [showAssistedNotes, setShowAssistedNotes] = usePreference('assisted-notes', false);
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
  levelsRealRef.current = songId === "levels" && (view === "performance" ? levelsPerformanceMode === "real" : (view === "studio" || view === "sandbox") && levelsPlayingMode === "real");
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
  const [rosesPreparation] = useState(() => new DeferredAudioPreparation());
  const drums = useRef<DrumEngine | null>(null);
  const drumMode = useRef<"performance" | "step" | "timed">("performance");
  const keyboard = useRef<KeyboardInputManager | null>(null);
  const liveNotes = useRef(new LiveNotes());
  const stage = useRef<HTMLElement | null>(null);
  const transitionSounds=useRef<TransitionSounds|null>(null);
  const importInput = useRef<HTMLInputElement | null>(null);
  const testTimer = useRef<number | null>(null);
  const testNotes = useRef<number[]>([]);
  const practiceNote = useRef<((midi: number, code: string, at: number) => void) | null>(null);
  const practiceDrum = useRef<((hit: LiveDrumHit) => void) | null>(null);
  const practiceUnmapped = useRef<((code: string, at: number) => void) | null>(null);
  const previousTranspose = useRef(0);

  useEffect(() => {
    let disposed=false;
    const finish=(state:'ready'|'error')=>{
      if(disposed)return;
      window.clearTimeout(timeout);openingAssetRef.current=state;setOpeningAsset(state);
      if(state==='error')openingSequence.revealPiano('asset');
    };
    const timeout=window.setTimeout(()=>finish('error'),openingReliability.assetTimeout);
    let image:HTMLImageElement|null=null;
    try{image=new Image();image.onload=()=>finish('ready');image.onerror=()=>finish('error');image.src=csaLogoMask;}catch{finish('error');}
    return()=>{disposed=true;window.clearTimeout(timeout);if(image){image.onload=null;image.onerror=null;}};
  },[openingSequence]);
  useEffect(() => {
    let previousScene=openingSequence.getSnapshot().scene;
    const unsubscribe=openingSequence.subscribe(state=>{
      const wasPlayable=previousScene==='TYPING_PIANO_REVEAL'||previousScene==='INTERSTELLAR_ACTIVE';
      previousScene=state.scene;
      setOpeningSnapshot(state);
      transitionSounds.current?.syncOpening(state);
      if(state.scene==='MESSAGE_COMPLETE'&&openingAssetRef.current!=='ready'){openingSequence.revealPiano('asset');return;}
      if(state.scene!=='INTERSTELLAR_ACTIVE'){openingFirstNote.current.reset();setOpeningFirstNoteAt(null);}
      if(state.scene==='TYPING_PIANO_REVEAL'||state.scene==='INTERSTELLAR_ACTIVE') {
        if(!wasPlayable){keyboard.current?.releaseAll();pedalInput.current?.reset();liveNotes.current.clear();}
        keyboard.current?.setEnabled(true);
        if(state.scene==='INTERSTELLAR_ACTIVE'){openingFirstNote.current.arm();setStartedAt(performance.now());setElapsed(0);}
      }
      if(state.scene==='IDLE'&&state.reason==='cancel') {
        keyboard.current?.setEnabled(false);panic();setProfileId(levelsEMajor.id);setView('practice');
        if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
      }
    });
    return()=>{unsubscribe();openingSequence.dispose();};
  },[openingSequence]);
  useEffect(() => {
    const integration={
      crashComplete:()=>openingSequence.getSnapshot().scene!=='IDLE'?false:openingActions.current.start('message'),
      cancel:()=>openingActions.current.cancel(),
    };
    window.mrPinkOpening=integration;
    const onCrashComplete=()=>{integration.crashComplete();};
    window.addEventListener('mr-pink:crash-complete',onCrashComplete);
    if(import.meta.env.DEV)window.mrPinkRehearsal={
      message:()=>openingActions.current.start('message'),
      typing:()=>openingActions.current.start('typing'),
      replay:()=>openingActions.current.start('typing'),
      logo:()=>openingActions.current.start('logo'),
      interstellar:()=>openingActions.current.start('piano'),
      levels:()=>openingActions.current.start('piano'),
      pianoTyping:()=>openingActions.current.start('pianoTyping'),
      resetPianoTyping:()=>openingActions.current.start('pianoTyping'),
      skipPianoTyping:()=>openingSequence.finishPianoTyping(),
      reset:()=>openingActions.current.start('message'),
      cancel:()=>openingActions.current.cancel(),
    };
    return()=>{
      window.removeEventListener('mr-pink:crash-complete',onCrashComplete);
      if(window.mrPinkOpening===integration)delete window.mrPinkOpening;
      delete window.mrPinkRehearsal;
    };
  },[openingSequence]);
  useEffect(() => {
    if(view!=="performance"||songId!=="interstellar"||openingSequence.capturing||(!openingSequence.pianoTyping&&!showLiveKeys))liveKeyHistory.clear();
  },[view,songId,openingSnapshot.scene,openingSnapshot.run,openingSequence,liveKeyHistory,showLiveKeys]);
  useEffect(()=>()=>liveKeyHistory.clear(),[liveKeyHistory]);
  useEffect(()=>()=>levelsWarp.dispose(),[levelsWarp]);
  useEffect(()=>{
    const effects=new TransitionSounds();transitionSounds.current=effects;
    effects.setVolume(volume/100);
    void effects.load().then(()=>effects.syncOpening(openingSequence.getSnapshot())).catch(()=>{/* Optional effects cannot prevent the performance. */});
    return()=>{effects.dispose();if(transitionSounds.current===effects)transitionSounds.current=null;};
  },[openingSequence]);
  useEffect(()=>{
    if(levelsWarpState.active)transitionSounds.current?.transition('levels',levelsWarpState.startedAt);
    else transitionSounds.current?.stop('levels');
  },[levelsWarpState.active,levelsWarpState.run,levelsWarpState.startedAt]);
  useEffect(()=>{
    if(galaxyBridge)transitionSounds.current?.transition('roses',galaxyBridge.at);
    else transitionSounds.current?.stop('roses');
  },[galaxyBridge]);
  useLayoutEffect(()=>{
    if(!levelsWarpState.active)return;
    const elapsed=Math.max(0,performance.now()-levelsWarpState.startedAt);
    try{for(const node of stage.current?.querySelectorAll('.stage-header,.performance-piano,.levels-warp-keyboard-ghost')??[])for(const animation of node.getAnimations())animation.currentTime=elapsed;}catch{levelsWarp.finish();}
  },[levelsWarpState.active,levelsWarpState.run,levelsWarpState.switched]);
  const openingRunning=openingSequence.capturing&&openingSnapshot.timelineOrigin!==undefined;
  useLayoutEffect(() => {
    if(!openingRunning)return;
    // Correct for React commit delays and logo-only replay offsets using the input clock.
    const elapsed=openingSequence.timelineElapsed()-openingSnapshot.animationOffset;
    try{for(const element of stage.current?.querySelectorAll('.csa-opening, .csa-opening *, .visualizer-canvas, .performance-piano, .stage-header')??[]){
      for(const animation of element.getAnimations())animation.currentTime=elapsed;
    }}catch{openingSequence.revealPiano('render');}
  },[openingSnapshot.run,openingRunning,openingSequence]);
  useLayoutEffect(()=>{
    if(openingSnapshot.scene==='TYPING_TEST'||openingSnapshot.scene==='MESSAGE_ENTRY'||openingSnapshot.scene==='TYPING_PIANO_REVEAL')stage.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus({preventScroll:true});
  },[openingSnapshot.run,openingSnapshot.scene]);

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
    chordStabEngine.setGlobalVolume(volume / 100);
    const introEngine = new RosesIntroEngine(synthEngine, value=>{rosesReveal.update(value,performance.now());startTransition(()=>setRosesIntroSnapshot(value));}, () => rosesTransposeRef.current);
    introEngine.setBackingMode(finalizedRosesBuildup.value);
    introEngine.setDropBackingSource(finalizedRosesDrop.value);
    introEngine.setDropLeadSettings(rosesDropSettings);
    rosesIntro.current = introEngine;
    setRosesIntroSnapshot(introEngine.snapshot());
    const drumEngine = new DrumEngine(setDrumSnapshot, bar => {
      if (viewRef.current === "performance") {
        performanceMeasureRef.current = bar;
        setPerformanceMeasure(bar);
        setLevelsSection(bar <= 8 ? "main" : bar <= 11 ? "transition" : "roses");
      }
    });
    drums.current = drumEngine;
    const manualBuildupLeadOwners = new Set<string>(),silentRosesGestureOwners = new Set<string>();
    const input = new KeyboardInputManager(standardMap, {
      routeKeyDown: event => {
        if(levelsWarp.keyDown(event))return true;
        const tap=isMessageTap(openingSequence.getSnapshot(),event);
        const handled=openingSequence.keyDown(event);
        if(handled&&tap)transitionSounds.current?.tap();
        return handled;
      },
      routeKeyUp: event => levelsWarp.keyUp(event)||openingSequence.keyUp(event),
      pitchForKey: (event, transpose) => performanceKeyPitch(event,transpose,songRef.current,openingSequence.pianoTyping,rosesTransposeRef.current,rosesVocalKeyRef.current,introEngine),
      noteOn: (midi, code, at) => {
        if (songRef.current === "roses") {
          if (introEngine.isSilentBuildupLeadGesture(code) || introEngine.isSilentBassGesture(code) || viewRef.current === "performance" && introEngine.isSilentIntroLoopGesture(code)) {
            silentRosesGestureOwners.add(code);
            liveNotes.current.on(`roses-gesture:${code}:${midi}`,midi,at);
            return;
          }
          if (introEngine.manualBuildupLeadPitch(code) !== undefined) {
            if (introEngine.manualBuildupLeadNoteOn(code)) {
              manualBuildupLeadOwners.add(code);
              liveNotes.current.on(`roses-build-lead:${code}:${midi}`,midi,at);
              if(viewRef.current === "studio")practiceNote.current?.(midi,code,at);
            }
            return;
          }
          if (rosesManualBassNote(code)) {
            if (introEngine.manualBassNoteOn(code)) liveNotes.current.on(`roses-bass:${code}`, midi, at);
            return;
          }
          if (rosesIndividualChordPitch(code) !== undefined) {
            silentRosesGestureOwners.add(code);
            liveNotes.current.on(`roses-gesture:${code}:${midi}`, midi, at);
            return;
          }
          if (synthEngine.noteOn(code, midi)) {
            liveNotes.current.on(code, midi, at);
            if (viewRef.current === "studio") practiceNote.current?.(midi, code, at);
          }
          return;
        }
        if (songRef.current === "levels") {
          const measure = viewRef.current === "studio" ? measureRef.current : performanceMeasureRef.current;
          const chords = measure <= 8 ? levelsChordsRef.current : measure <= 11 ? levelsTransitionChords : levelsRosesChords;
          const pitches = levelsRealRef.current ? [midi] : chords[code] ?? [midi];
          levelsHeld.current.set(code, pitches);
          const gain = measure >= 9 && measure <= 11 ? levelsGainRef.current : 1;
          let sounded = false;
          pitches.forEach((pitch, index) => {
            const source = `levels:${code}:${pitch}`;
            if (engine.noteOnSource(source, pitch, gain)) { sounded = true; liveNotes.current.dampPitch(pitch, at); }
            liveNotes.current.on(source, pitch, at, index > 0);
          });
          if (sounded && openingFirstNote.current.consume()) setOpeningFirstNoteAt(at);
          practiceNote.current?.(midi, code, at);
          if (measure >= 9 && measure <= 11 && drumMode.current === "step") drumEngine.noteStepInput(measure);
          return;
        }
        if (songRef.current === "interstellar" && viewRef.current === "performance") {
          const section = performanceSectionRef.current;
          const plan = planInterstellarPress(section, code, midi, assistedCursor.current, mixRef.current);
          assistedCursor.current = plan.nextCursor;
          const sources: { source: string; midi: number }[] = [];
          let sounded=false;
          for (const voice of plan.voices) {
            const source = `interstellar:${code}:${assistedNextId.current++}`;
            if (engine.noteOnSource(source, voice.midi, voice.gain)) {sounded=true;liveNotes.current.dampPitch(voice.midi, at);}
            liveNotes.current.on(source, voice.midi, at, voice.assisted, voice.octave);
            sources.push({ source, midi: voice.midi });
          }
          interstellarHeld.current.set(code, sources);
          if(!openingSequence.capturing&&(openingSequence.pianoTyping||liveKeysEnabledRef.current)){
            liveKeyHistory.appendMany(interstellarSoundingKeys(plan.voices.filter(voice=>voice.gain>0).map(voice=>voice.midi),code,at,liveKeysTransposeRef.current));
          }
          if(sounded&&openingFirstNote.current.consume())setOpeningFirstNoteAt(at);
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
          if (silentRosesGestureOwners.delete(code)) {
            liveNotes.current.off(`roses-gesture:${code}:${midi}`,at,false);
            return;
          }
          if (manualBuildupLeadOwners.delete(code)) {
            introEngine.manualBuildupLeadNoteOff(code);
            liveNotes.current.off(`roses-build-lead:${code}:${midi}`,at,false);
            return;
          }
          if (rosesManualBassNote(code)) {
            introEngine.manualBassNoteOff(code);
            liveNotes.current.off(`roses-bass:${code}`, at, false);
            return;
          }
          if (rosesIndividualChordPitch(code) !== undefined) {
            const source = rosesChordSource(code, midi);
            chordStabEngine.noteOff(source);
            liveNotes.current.off(source, at, sustainRef.current);
            return;
          }
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
            liveNotes.current.off(source, at, (viewRef.current === "performance" || levelsRealRef.current) && sustainRef.current);
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
        if (pressVisualDropChord(liveNotes.current, code, pitches, at)) return;
        const audioAt = Tone.immediate();
        for (const midi of pitches) {
          const engineCode = rosesChordEngineCode(code);
          const source = rosesChordSource(engineCode, midi);
          if (chordStabEngine.noteOn(source, midi, engineCode, audioAt)) liveNotes.current.on(rosesChordSource(code, midi), midi, at);
        }
      },
      chordOff: (pitches, code, at) => {
        if (releaseVisualDropChord(liveNotes.current, code, pitches, at)) return;
        for (const midi of pitches) {
          chordStabEngine.noteOff(rosesChordSource(rosesChordEngineCode(code), midi));
          liveNotes.current.off(rosesChordSource(code, midi), at, false);
        }
      },
      // Note callbacks above remain synchronous; expensive UI reconciliation is interruptible.
      change: next => startTransition(()=>setSnapshot(next)),
      unmappedKeyDown: (code, at) => practiceUnmapped.current?.(code, at),
      controlKeyDown: code => {
        if (songRef.current === "roses" && (viewRef.current === "studio" || viewRef.current === "performance")) {
          if (code === "KeyV") { introEngine.armSynth(); return true; }
          if (code === "KeyN") { introEngine.armBass(); return true; }
          if (code === rosesVocalKeyRef.current) { introEngine.armVocal(); return true; }
          if (code === "KeyB") { introEngine.stopLoop(); return true; }
          if (code === "KeyC") { introEngine.hitAccent(); return true; }
          if (code === "KeyZ" || code === "KeyX") {
            const hit = introEngine.hitDrum(code === "KeyZ" ? "kick" : "clap", viewRef.current === "performance");
            if (hit && code === "KeyZ") chordStabEngine.duck();
            if (hit && viewRef.current === "studio") practiceDrum.current?.(hit);
            return true;
          }
        }
        if (songRef.current !== "levels" || !drumEngine.isReady()) return false;
        const bar = viewRef.current === "studio" ? measureRef.current : performanceMeasureRef.current;
        const drumKeys = levelsRealRef.current ? levelsRealDrums : drumCodeToLayer;
        if (bar < 9 || bar > 11 || !drumKeys[code]) return false;
        const layer = drumKeys[code];
        if (layer === "fill" || layer === "riser") drumEngine.oneShot(layer, bar, drumMode.current);
        else drumEngine.toggle(layer, bar, drumMode.current);
        return true;
      },
    }, { batchChanges: true });
    keyboard.current = input;
    const detachFinale=sodaPop.attach({
      beforeStart: time => {
        input.setEnabled(false); audio.current?.releaseAll(); chordStabEngine.releaseAll();
        if(songRef.current!=='roses')drumEngine.reset();
        synthEngine.releaseAll();
        liveNotes.current.clear(); introEngine.stopForFinale(time);
        songRef.current='roses';setSongId('roses');setView('performance');
      },
      rehearse: async valid => {
        await Promise.all([synthEngine.start(),prepareRosesAudioAssets()]);
        if(!valid())return;
        songRef.current='roses';setSongId('roses');setView('performance');setAudioState('ready');
        setRosesPerformanceSetup(false);
        if(!await introEngine.playDrop(44,'performance'))throw Error('Last DJ bar unavailable.');
      },
      back: () => { introEngine.reset(44); input.setEnabled(true); },
    });
    introEngine.setPerformanceFinale({ready:()=>viewRef.current==='performance'&&songRef.current==='roses'&&sodaPop.readyForAutomatic(),start:time=>sodaPop.automatic(time)});
    return () => {
      introEngine.setPerformanceFinale();detachFinale();sodaPop.dispose();
      rosesPreparation.reset();
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
    if (songId !== 'roses') return;
    let cancelled = false;
    if (!rosesIntro.current?.isReady() || !chordStabs.current?.isReady()) setRosesIntroLoadState('loading');
    void prepareRosesAudioAssets().then(() => { if (!cancelled) setRosesIntroLoadState('ready'); }, () => { if (!cancelled) setRosesIntroLoadState('error'); });
    return () => { cancelled = true; };
  }, [songId, rosesPreparation]);

  useEffect(() => {
    keyboard.current?.setEnabled(
      audioState === "ready" && !finaleActive && !levelsWarpState.active && !openingSequence.capturing && (captureEnabled || view === "performance" || view === "studio" || view === "sandbox"),
    );
  }, [audioState, captureEnabled, view, openingSnapshot.scene, openingSequence,levelsWarpState.active,finaleActive]);
  useEffect(() => {
    audio.current?.setVolume(volume / 100);
    sodaPop.setVolume(volume / 100);
    transitionSounds.current?.setVolume(volume/100);
    synth.current?.setGlobalVolume(finaleActive ? 0 : volume / 100);
    chordStabs.current?.setGlobalVolume(finaleActive ? 0 : volume / 100);
    rosesIntro.current?.setMaster(volume / 100);
    drums.current?.setMaster(volume / 100);
  }, [volume,finaleActive]);
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
    if (!engine || songId !== 'roses') return;
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
  }, [instrumentId, songId]);
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
    const onDown = (event: KeyboardEvent) => {
      // Before a Roses stage start, Space belongs to the four-beat count-in.
      // Once transport runs, the existing Space pedal route takes over again.
      if(event.code==='Space'&&spaceStartsRosesPerformance(viewRef.current,songRef.current,rosesIntro.current?.snapshot().status))return;
      if(!event.defaultPrevented && !openingSequence.capturing && !openingSequence.isQuarantined(event.code))input.keydown(event);
    };
    const onUp = (event: KeyboardEvent) => input.keyup(event);
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => { window.removeEventListener("keydown", onDown, true); window.removeEventListener("keyup", onUp, true); pedalInput.current = null; };
  }, []);
  useEffect(() => {
    const onBlur = () => { transitionSounds.current?.stop();levelsWarp.finish();openingSequence.releasePhysicalKeys();if(openingSequence.capturing)openingSequence.revealPiano('focus');pedalInput.current?.reset(); panic(); };
    const onHidden = () => { if (document.hidden) { transitionSounds.current?.stop();levelsWarp.finish();openingSequence.releasePhysicalKeys();if(openingSequence.capturing)openingSequence.revealPiano('focus');pedalInput.current?.reset();panic(); } };
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
        ? [songId === "interstellar" ? interstellarThemeShortcut(themeShortcut) : themeShortcut, "F7", "F8", "F9", ...(songId === "roses" ? ["F10"] : []), "Escape", "Space", "ArrowLeft", "ArrowRight"]
        : ["F9", "Space"],
    );
  }, [view, themeShortcut, songId]);
  useEffect(() => {
    rosesIntro.current?.setBuildupSettings(rosesBuildupSettings);
    try { localStorage.setItem("stage-piano-roses-buildup-v1", JSON.stringify(rosesBuildupSettings)); } catch { /* local settings are optional */ }
  }, [rosesBuildupSettings]);
  const activeProfile = songId === "interstellar" && view === "performance" ? mapForInterstellarSection(performanceSection) : songId === "roses" ? rosesMap : songId === "levels" ? levelsRealRef.current ? levelsEMajor : levelsMap(levelsSection, levelsChords) : songId === "rush-e" ? profiles.find(profile => profile.id === "rush-e") ?? standardMap :
    profiles.find((profile) => profile.id === profileId) ?? profiles[0] ?? standardMap;
  profileRef.current = activeProfile.id;
  const isBundledInterstellar = activeProfile.id === interstellarMap.id || activeProfile.id === assistedInterstellarMap.id;
  const keyboardRange = songId === "interstellar" && view === "performance" ? { low: 36, high: 96 } : pianoRange(songId === "levels" ? levelsMap("main", levelsChords).bindings : activeProfile.bindings);
  if (songId === "levels" && view === "performance" && levelsRealRef.current) keyboardRange.high = Math.max(keyboardRange.high, ...activeProfile.bindings.map(binding => binding.midi));
  const activeTranspose = songId === "roses" ? rosesTranspose - 4 : transpose;
  if (songId === "roses") keyboardRange.low = Math.min(keyboardRange.low, Math.min(...Object.values({...rosesChordShortcuts, ...visualDropChordShortcuts}).flat()) - activeTranspose);
  const stagePresentation: StagePresentation | undefined = songId === "interstellar" || songId === "levels" || songId === "roses" ? songId : undefined;
  const audiencePerformance = songId === "roses" && !rosesPerformanceSetup;
  const cinematicPerformance = songId === "roses" && !openingSequence.capturing && !openingSequence.pianoTyping;
  const selectedBacking=rosesIntroSnapshot?.buildup?.mode??defaultBackingMode;
  const rosesBeat=rosesIntroSnapshot?(rosesIntroSnapshot.measure-1)*4+rosesIntroSnapshot.beat-1:0;
  const introLoopPianoKeys=songId==='roses'&&rosesIntroSnapshot?rosesIntroLoopPianoKeys(rosesBeat,rosesIntroSnapshot.status,rosesIntroSnapshot.measure,rosesIntroSnapshot.synthActive,rosesTranspose-4):[];
  const rosesBackingView=useMemo(()=>backingFrame(selectedBacking,rosesBeat,rosesIntroSnapshot?.drop?.backingSource,rosesIntroSnapshot?.buildup,rosesIntroSnapshot?.drop?.rows,rosesIntroSnapshot?.drop),[selectedBacking,rosesBeat,rosesIntroSnapshot?.buildup,rosesIntroSnapshot?.drop]);
  const rosesHwmScene=rosesBackingView.hwm;
  const vinylVisual=rosesHwmVisuals(rosesBeat);
  const rosesAutomatic=rosesBackingView.events;
  const stageActivity:StageActivity = songId === "levels" ? {
    playing:drumSnapshot?.status==="running" && Object.values(drumSnapshot.active).some(Boolean),
    intensity:drumSnapshot?.status==="running"?Object.values(drumSnapshot.active).filter(Boolean).length/3:0,
    beatKey:drumSnapshot?`${drumSnapshot.measure}:${Math.floor(drumSnapshot.beat)}`:undefined,
  } : songId === "roses" ? {
    playing:rosesIntroSnapshot?.status==="running",
    intensity:rosesBackingView.intensity,
    drop:rosesBeat>=144 && rosesBeat<176 && rosesIntroSnapshot?.drop?.status==="running",
    buildProgress:rosesBeat>=112 && rosesBeat<144 ? (rosesBeat-112)/32 : 0,
    beatKey:rosesBackingView.activity.includes("drums")?`${rosesIntroSnapshot?.measure}:${Math.floor(rosesIntroSnapshot?.beat??1)}`:undefined,
    hitKey:rosesIntroSnapshot?.lastDrum || rosesIntroSnapshot?.lastAccent ? `${rosesIntroSnapshot?.lastDrum?.sequence??0}:${rosesIntroSnapshot?.lastAccent??0}`:undefined,
    hitKind:rosesIntroSnapshot?.lastDrum?.kind,
    drumKey:rosesIntroSnapshot?.lastDrum?.sequence,
  } : {playing:snapshot.pressed.length>0,intensity:songId === "interstellar" && performanceSection === 3 ? .3 : 0};
  const stageTheme: Theme = songId === "interstellar" ? "cosmic" : songId === "levels" ? "levels" : songId === "roses" ? "roses" : theme;
  const stageChords = songId === "levels" && !levelsRealRef.current ? levelsSection === "main" ? levelsChords : levelsSection === "transition" ? levelsTransitionChords : levelsRosesChords : undefined;
  const performanceGuide = useMemo(() => {
    if (songId === "levels" && activeProfile.id === levelsEMajor.id) return levelsIndividualGuide(activeTranspose);
    const guide = songId === "roses" ? rosesKeyGuide(activeProfile, activeTranspose, rosesVocalKey, (rosesIntroSnapshot?.bassPlaybackMode === "manual" || silentAutomaticBassActive(rosesIntroSnapshot)), rosesIntroSnapshot?.manualBuildupLeadActive) : stageKeyGuide(activeProfile, activeTranspose, stageChords);
    if (songId === "interstellar") return interstellarKeyGuide(interstellarRobloxMap, activeTranspose, 1, false);
    return guide;
  }, [activeProfile, activeTranspose, stageChords, songId, performanceSection, interstellarMix.octaveEnabled, rosesVocalKey, rosesIntroSnapshot?.bassPlaybackMode, rosesIntroSnapshot?.status, rosesIntroSnapshot?.measure, rosesIntroSnapshot?.bassActive, rosesIntroSnapshot?.manualBuildupLeadActive]);
  useEffect(() => {
    keyboard.current?.setMap(activeProfile, songId === "levels" || (songId === "interstellar" && view === "performance"));
  }, [songId, levelsSection, levelsChords, profileId, profiles, view, performanceSection, levelsPlayingMode, levelsPerformanceMode]);
  useEffect(() => {
    keyboard.current?.setChords(songId === "roses" ? { ...rosesChordBindings(rosesIntroSnapshot?.manualBuildupLeadActive), ...visualDropChordShortcuts } : {});
  }, [songId, rosesIntroSnapshot?.manualBuildupLeadActive]);
  useEffect(() => { keyboard.current?.releaseAll(); }, [rosesIntroSnapshot?.buildupLeadPlaybackMode]);
  useEffect(() => {
    if (songId !== "roses") return;
    synth.current?.releaseAll();
    chordStabs.current?.releaseAll();
    liveNotes.current.clear();
    keyboard.current?.setTranspose(rosesTranspose - 4);
  }, [songId, rosesTranspose]);
  useEffect(() => { try { localStorage.setItem("stage-piano-song", songId); localStorage.setItem("stage-piano-levels-opening-v1", "ready"); localStorage.setItem("stage-piano-levels-chords", JSON.stringify(levelsChords)); localStorage.setItem("stage-piano-levels-transition-gain", String(levelsGain)); } catch { /* storage unavailable */ } }, [songId, levelsChords, levelsGain]);
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
    if (showHud) setElapsed(Math.floor((performance.now() - startedAt) / 1000));
    const timer = showHud ? window.setInterval(
      () => setElapsed(Math.floor((performance.now() - startedAt) / 1000)),
      250,
    ) : null;
    const onFullscreen = () => {
      if (!document.fullscreenElement && stage.current) {
        if(openingSequence.capturing){openingSequence.revealPiano('focus');panic();}
        else exitPerformance();
      }
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [view, startedAt, showHud]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if(event.defaultPrevented || openingSequence.capturing || openingSequence.pianoTyping || openingSequence.isQuarantined(event.code))return;
      if (event.code === "F9" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        transitionSounds.current?.stop();levelsWarp.finish();panic();
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
      if(sodaPop.active()&&event.code!=='Escape')return;
      if (event.code === "Escape") {
        event.preventDefault();
        exitPerformance();
      } else if (event.code === "ArrowRight" && !event.shiftKey) {
        event.preventDefault();
        if (!event.repeat) {
          const next = nextPerformanceStep(songRef.current, performanceSectionRef.current);
          if (next && "section" in next) changeInterstellarSection(1);
          else if (next && "song" in next) {
            if(next.song==='soda-pop')void sodaPop.launch();
            else if(songRef.current==='interstellar'&&next.song==='roses')beginGalaxyVinylTransition();
            else if(songRef.current==='levels'&&next.song==='interstellar')beginLevelsInterstellarTransition();
            else {selectSong(next.song, true);setSongTransition(next.song);}
          }
        }
      } else if (songId === "interstellar" && (event.code === "ArrowLeft" || event.code === "ArrowRight")) {
        event.preventDefault();
        if (!event.repeat) changeInterstellarSection(event.code === "ArrowRight" ? 1 : -1);
      } else if (songId === "levels" && (event.code === "ArrowLeft" || event.code === "ArrowRight")) {
        event.preventDefault();
        if (!event.repeat) setPerformanceBar(performanceMeasureRef.current + (event.code === "ArrowRight" ? 1 : -1), true);
      } else if (songId === "roses" && event.code === "F10") {
        event.preventDefault();
        if (!event.repeat) setRosesPerformanceSetup(value => !value);
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

  function releaseLevelsModeVoices() {
    keyboard.current?.releaseAll();
    levelsHeld.current.clear();
    audio.current?.releaseAll();
    liveNotes.current.clear();
    audio.current?.setSustain(sustainRef.current);
  }

  function panic(preservePedal = false) {
    liveKeyHistory.clear();
    sodaPop.stop();
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
  function selectSong(next: SongId, stayOnStage = false,preserveLevelsWarp=false) {
    if (next === songId) return;
    if(next!=="levels"&&openingSequence.pianoTyping)openingSequence.finishPianoTyping();
    if(!preserveLevelsWarp){transitionSounds.current?.stop();levelsWarp.cancel();setLevelsPianoGhost(null);}
    rosesReveal.disable();galaxyBridgeRunning.current=false;setGalaxyBridge(null);
    panic(!stayOnStage);
    songRef.current = next;
    setSongId(next);
    if (next === "interstellar") {
      performanceSectionRef.current = 1;
      setPerformanceSection(1);
      assistedCursor.current = 0;
      setProfileId(interstellarMap.id);
    }
    if (next === "rush-e") setProfileId("rush-e");
    if (next === "levels" || next === "interstellar") { keyboard.current?.setTranspose(0); setTranspose(0); }
    if (next === "roses") {
      if (!stayOnStage) setView("sandbox");
      else { setPerformanceLabels(true); setRosesPerformanceSetup(false); void startAudio(); }
      if (!stayOnStage) setAudioState(synth.current?.isReady() && chordStabs.current?.isReady() ? "ready" : "locked");
    } else {
      keyboard.current?.setTranspose(next === "rush-e" ? transpose : 0);
      if (next === "rush-e") setView("sandbox");
      else if (!stayOnStage && viewRef.current === "sandbox") setView("studio");
      if (audio.current?.isReady() || synth.current?.isReady()) void ensurePianoAudio();
      else setAudioState('locked');
    }
    measureRef.current = 1;
    performanceMeasureRef.current = 1;
    setPerformanceMeasure(1);
    setLevelsSection("main");
  }
  levelsWarpActions.current={
    switchSong:()=>{
      setLevelsPianoGhost(capturePianoFrame(stage.current));
      selectSong('interstellar',true,true);
      keyboard.current?.setMap(mapForInterstellarSection(1));
    },
    ready:()=>{
      setLevelsPianoGhost(null);
      keyboard.current?.setEnabled(viewRef.current==='performance'&&songRef.current==='interstellar'&&!!audio.current?.isReady()&&!openingSequence.capturing);
    },
  };
  function beginLevelsInterstellarTransition(){
    if(songRef.current!=='levels'||viewRef.current!=='performance'||levelsWarp.getSnapshot().active||openingSequence.capturing||openingSequence.pianoTyping)return;
    keyboard.current?.setEnabled(false);pedalInput.current?.reset();panic();setLevelsPianoGhost(null);setSongTransition(null);levelsWarp.start();
  }
  function finishGalaxyVinylTransition(){transitionSounds.current?.stop('roses');galaxyBridgeRunning.current=false;setGalaxyBridge(null);}
  function beginGalaxyVinylTransition(){
    if(songRef.current!=='interstellar'||galaxyBridgeRunning.current||viewRef.current!=='performance')return;
    const root=stage.current,rect=root?.getBoundingClientRect();
    if(!root||!rect)return;
    const sky=root.querySelector('.visualizer-canvas')?.getBoundingClientRect(),pianoCanvas=root.querySelector<HTMLCanvasElement>('.performance-piano .piano-canvas'),piano=root.querySelector('.performance-piano')?.getBoundingClientRect();
    const skyHeight=sky?.height??rect.height*.7;
    const origin:GalaxyOrigin={...cosmicGalaxyGeometry(rect.width,skyHeight),width:rect.width,height:rect.height,skyHeight,piano:{x:0,y:skyHeight,width:rect.width,height:rect.height-skyHeight}};
    if(piano){origin.piano={x:piano.left-rect.left,y:piano.top-rect.top,width:piano.width,height:piano.height};}
    // Copy only the outgoing piano's existing pixels; cap the temporary buffer for fullscreen.
    if(pianoCanvas&&piano)try{
      const image=document.createElement('canvas'),scale=Math.min(1,1600/piano.width,240/piano.height);image.width=Math.round(piano.width*scale);image.height=Math.round(piano.height*scale);image.getContext('2d')?.drawImage(pianoCanvas,0,0,image.width,image.height);origin.image=image;
    }catch{/* The real incoming piano remains available if a preview copy is unavailable. */}
    selectSong('roses',true);rosesReveal.enable();galaxyBridgeRunning.current=true;setSongTransition(null);setGalaxyBridge({origin,at:performance.now()});
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
    transitionSounds.current?.stop();
    levelsWarp.cancel();setLevelsPianoGhost(null);
    finishGalaxyVinylTransition();
    if(openingSequence.getSnapshot().scene!=='IDLE')openingSequence.cancel();
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
    if (songId === "levels") releaseLevelsModeVoices();
    if (songId === "roses") { rosesIntro.current?.reset(); setPerformanceLabels(true); setRosesPerformanceSetup(false); }
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
  function beginOpening(mode:OpeningStart):boolean {
    if(audioState!=='ready'||!audio.current?.isReady()) {
      setOpeningError('Enable piano audio before starting the CSA opening.');
      return false;
    }
    transitionSounds.current?.stop();levelsWarp.cancel();setLevelsPianoGhost(null);finishGalaxyVinylTransition();
    setOpeningError('');keyboard.current?.setEnabled(false);panic();pedalInput.current?.reset();
    songRef.current='levels';setSongId('levels');
    setLevelsPerformanceMode('real');levelsRealRef.current=true;
    setLevelsSection('main');drums.current?.reset();drumMode.current='performance';
    performanceMeasureRef.current=1;setPerformanceMeasure(1);
    profileRef.current=levelsEMajor.id;setProfileId(levelsEMajor.id);
    keyboard.current?.setMap(levelsEMajor,true);
    liveNotes.current.clear();setShowHud(false);
    keyboard.current?.setChords({});
    const launchMode=mode==='message'||mode==='typing'||mode==='pianoTyping'||openingAssetRef.current==='ready'?mode:'piano';
    flushSync(()=>{setView('performance');openingSequence.start(launchMode);});
    stage.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus({preventScroll:true});
    try{if(!document.fullscreenElement)void stage.current?.requestFullscreen?.().catch(()=>{});}catch{/* The same stage remains usable in the window. */}
    return true;
  }
  openingActions.current={start:beginOpening,cancel:()=>openingSequence.cancel()};

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
  function prepareRosesAudioAssets(): Promise<void> {
    const intro = rosesIntro.current, chords = chordStabs.current;
    if (!intro || !chords) return Promise.reject(new Error('Roses audio is not initialized.'));
    return rosesPreparation.prepare(() => Promise.all([intro.load(), chords.load()]));
  }
  async function startAudio() {
    if (!synth.current || audioState === "loading") return;
    // Optional decoding cannot prevent the piano/DJ show from starting.
    void sodaPop.prepare().catch(()=>{});
    const requestedSong = songRef.current;
    if (requestedSong !== 'roses') { await ensurePianoAudio(); return; }
    setAudioState("loading");
    try {
      await Promise.all([synth.current.start(), prepareRosesAudioAssets()]);
      if (songRef.current === requestedSong) setAudioState("ready");
    } catch { if (songRef.current === requestedSong) setAudioState("error"); }
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

  if (view === "sandbox") return <SandboxMode levelsPlayingMode={levelsPlayingMode} onLevelsPlayingMode={mode => { releaseLevelsModeVoices(); setLevelsPlayingMode(mode); }} vocalKey={rosesVocalKey} hereWithMeHarmonyVolume={hereWithMeHarmonyVolume} onHereWithMeHarmonyVolume={setHereWithMeHarmonyVolume} hereWithMeChordSound={hereWithMeChordSound} onHereWithMeChordSound={setHereWithMeChordSound} closerSettings={rosesCloserSettings} onCloserSettings={setRosesCloserSettings} introEngine={rosesIntro.current} introClock={rosesIntroSnapshot} buildupSettings={rosesBuildupSettings} onBuildupSettings={setRosesBuildupSettings} dropSettings={rosesDropSettings} setDropSettings={setRosesDropSettings} compareLoudStab={async side => { if (audioState !== "ready") await startAudio(); if (chordStabs.current?.isReady()) chordStabs.current.compareLoudStab(side); }} songId={songId} map={activeProfile} transpose={activeTranspose} range={keyboardRange} snapshot={snapshot} activePitches={activePitches} liveNotes={liveNotes.current} audioReady={audioState === "ready"} startAudio={startAudio} volume={volume} setVolume={setVolume} rosesTranspose={rosesTranspose} setRosesTranspose={setRosesTranspose} synthSettings={synthSettings} setSynthSettings={setSynthSettings} instrumentId={instrumentId} setInstrumentId={selectRosesInstrument} instrumentError={instrumentError} previewInstrument={(midi) => synth.current?.preview(midi)} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} onSongChange={selectSong} onSheet={sandboxToSheet} onExit={exitSandbox} onPerformance={enterPerformance} />;

  if (view === "studio")
    return songId === "roses"
      ? <RosesPractice buildupSettings={rosesBuildupSettings} onBuildupSettings={setRosesBuildupSettings} liveNotes={liveNotes.current} map={activeProfile} transpose={activeTranspose} range={keyboardRange} snapshot={snapshot} audioReady={audioState === "ready"} startAudio={startAudio} engine={rosesIntro.current} clock={rosesIntroSnapshot} drumStatus={rosesIntroLoadState} onNoteRef={practiceNote} onDrumRef={practiceDrum} onExit={exitStudio} onSandbox={enterSandbox} onPerformance={enterPerformance} onSongChange={selectSong} instrumentId={instrumentId} onInstrument={selectRosesInstrument} instrumentError={instrumentError} synthLevel={rosesSynthLevel} onSynthLevel={setRosesSynthLevel} synthLeadMs={rosesSynthLeadMs} onSynthLeadMs={setRosesSynthLeadMs} bassLevels={rosesBassLevels} onBassLevels={setRosesBassLevels} vocalOffset={rosesVocalOffset} onVocalOffset={setRosesVocalOffset} vocalKey={rosesVocalKey} closerSettings={rosesCloserSettings} onCloserSettings={setRosesCloserSettings} calibration={rosesCalibration} onCalibration={setRosesCalibration} output={rosesOutput} />
      : songId === "levels"
      ? <LevelsPractice playingMode={levelsPlayingMode} setPlayingMode={setLevelsPlayingMode} getHeldPitches={() => keyboard.current?.heldPitches() ?? []} releaseModeVoices={releaseLevelsModeVoices} map={activeProfile} range={keyboardRange} snapshot={snapshot} pressedPitches={activePitches} audioReady={audioState === "ready"} startAudio={startAudio} onNoteRef={practiceNote} onUnmappedRef={practiceUnmapped} onExit={exitStudio} onMeasureChange={setLevelsMeasure} resetVoices={() => panic(true)} transitionGain={levelsGain} setTransitionGain={setLevelsGain} chords={levelsChords} setChords={setLevelsChords} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} showAssistedNotes={showAssistedNotes} setShowAssistedNotes={setShowAssistedNotes} onSongChange={selectSong} onSandbox={enterSandbox} drums={drums.current} drumSnapshot={drumSnapshot} drumMix={drumMix} setDrumMix={setDrumMix} setDrumMode={mode => { drumMode.current = mode; }} />
      : <PracticeStudio map={activeProfile} snapshot={snapshot} soundingPitches={activePitches} audioReady={audioState === "ready"} startAudio={startAudio} selectProfile={selectProfile} profiles={profiles} onNoteRef={practiceNote} onUnmappedRef={practiceUnmapped} onExit={exitStudio} sustainSettings={sustainSettings} setSustainSettings={setSustainSettings} sustainActive={sustainActive} showAssistedNotes={showAssistedNotes} setShowAssistedNotes={setShowAssistedNotes} liveNotes={liveNotes.current} onMeasureChange={measure => { measureRef.current = measure; }} triggerAssisted={triggerAssisted} resetAssisted={resetAssistedSection} interstellarMix={interstellarMix} setInterstellarMix={setInterstellarMix} onSongChange={selectSong} onSandbox={enterSandbox} />;

  if (view === "performance")
    return (
      <main
        ref={stage}
        style={levelsWarpState.active?{'--levels-warp-duration':`${levelsWarpSettings.duration}ms`} as CSSProperties:openingSequence.capturing?openingStyle(openingSnapshot):galaxyBridge?{'--galaxy-duration':`${rosesRevealSettings.transition}ms`} as CSSProperties:undefined}
        className={`performance-stage ${levelsWarpState.active?"levels-warp-running":""} ${galaxyBridge?"galaxy-vinyl-running":""} ${songId==='roses'&&rosesRevealState.enabled?(rosesRevealState.revealedAt===null?"roses-identity-hidden":"roses-identity-reveal"):""} ${cinematicPerformance ? "workstation-stage" : ""} ${audiencePerformance ? "audience-stage" : ""} ${openingSequence.capturing?`csa-reveal-stage opening-pending ${openingRunning?"opening-running":""}`:""} ${songId==="roses"&&rosesHwmScene&&rosesBeat>=144&&rosesBeat<176?"hwm-drop-scene":""} ${rosesHwmScene&&songId==="roses"?"hwm-scene":""} theme-${stageTheme} ${stagePresentation ? `stage-presentation stage-${stagePresentation}` : ""} ${cursorHidden ? "cursor-hidden" : ""}`}
      >
        {finaleActive&&<SodaPopFinale level={stageVisualLevel} />}
        {galaxyBridge&&<OpeningGuard key={`galaxy-${galaxyBridge.at}`} onFailure={finishGalaxyVinylTransition}><GalaxyVinylTransition origin={galaxyBridge.origin} startedAt={galaxyBridge.at} level={stageVisualLevel} onComplete={finishGalaxyVinylTransition}/></OpeningGuard>}
        {songTransition && <PerformanceTransition key={songTransition} song={songTransition} onComplete={()=>setSongTransition(null)}/>}
        {songId==='levels'&&openingSequence.pianoTyping&&<OpeningGuard key={`piano-typing-${openingSnapshot.run}`} onFailure={openingSequence.finishPianoTyping}><PianoTypingReveal snapshot={openingSnapshot} map={activeProfile} transpose={activeTranspose}/></OpeningGuard>}
        {songId==='levels'&&openingFirstNoteAt!==null&&<OpeningGuard key={`first-note-${openingSnapshot.run}`} onFailure={()=>setOpeningFirstNoteAt(null)}><FirstNoteRipple at={openingFirstNoteAt}/></OpeningGuard>}
        {openingSequence.capturing && <OpeningGuard key={`${openingSnapshot.run}-${isTypingScene(openingSnapshot.scene)?'typing':'csa'}`} onFailure={openingSequence.revealPiano}>{isTypingScene(openingSnapshot.scene)?openingSnapshot.scene==='SIMULATED_CRASH'?<OfflineErrorScreen snapshot={openingSnapshot}/>:<TypingTestScreen snapshot={openingSnapshot}/>:<OpeningReveal snapshot={openingSnapshot} onFailure={openingSequence.revealPiano}/>}</OpeningGuard>}
        <PerformanceVisualizer
          levelsWarp={levelsWarpState.active?levelsWarpState:undefined} onWarpFailure={levelsWarp.finish}
          lightweight={songId==='levels'}
          introLoop={songId==='roses'&&rosesIntroSnapshot ? {
            getBeat:()=> (rosesIntro.current?.scoreBeat()??rosesBeat) + (rosesIntroSnapshot.status==='running' ? rosesCalibration.leadMs * (rosesIntro.current?.tempo()??100) / 60000 : 0),
            status:rosesIntroSnapshot.status, synthActive:rosesIntroSnapshot.synthActive, tempo:rosesIntro.current?.tempo()??100,
          } : undefined}
          workstation={cinematicPerformance} stageLevel={stageVisualLevel}
          notes={liveNotes.current}
          map={activeProfile}
          transpose={activeTranspose}
          theme={stageTheme}
          automaticGuide={songId==="roses"?{events:rosesAutomatic,hwm:rosesHwmScene,recorded:rosesBackingView.recorded,intensity:rosesBeat>=144&&!rosesBackingView.recorded?1:rosesBackingView.intensity,riserProgress:rosesBackingView.riserProgress,riserIntensity:rosesBackingView.riserIntensity,beat:rosesBeat,playing:rosesIntroSnapshot?.status==="running"&&(rosesBeat>=144?rosesIntroSnapshot?.drop?.status==="running":["PLAYING","BREAK"].includes(rosesIntroSnapshot?.buildup?.status??"")),getBeat:()=>rosesIntroSnapshot?.status==='running'||rosesIntroSnapshot?.status==='paused'?rosesIntro.current?.scoreBeat()??rosesBeat:rosesBeat}:undefined}
          presentation={stagePresentation}
          keyGuide={performanceGuide}
          notesPerSecond={snapshot.notesPerSecond}
          showAssisted={!!stagePresentation || showAssistedNotes}
          range={songId === "interstellar" || songId === "levels" || songId === "roses" ? keyboardRange : undefined}
        />
        {cinematicPerformance && <PerformanceWorkstation vinylTimeline={songId==='roses'?{getBeat:()=>rosesIntroSnapshot?.status==='running'||rosesIntroSnapshot?.status==='paused'?rosesIntro.current?.scoreBeat()??rosesBeat:rosesBeat,beat:rosesBeat,playing:rosesIntroSnapshot?.status==='running'}:undefined} reveal={rosesRevealState.enabled?{state:rosesRevealState,clock:rosesIntroSnapshot,transitioning:!!galaxyBridge}:undefined} audience={audiencePerformance}
          introLoop={songId==='roses'&&rosesIntroSnapshot&&rosesIntroLoopActive(rosesIntroSnapshot.status,rosesIntroSnapshot.measure,rosesIntroSnapshot.synthActive) ? <RosesIntroLoopDeck engine={rosesIntro.current} clock={rosesIntroSnapshot} leadMs={rosesCalibration.leadMs} /> : undefined}
          pads={performancePads({song:songId,real:levelsRealRef.current,measure:performanceMeasure,guide:performanceGuide,drums:drumSnapshot,roses:rosesIntroSnapshot,levelsPlaying:name=>drums.current?.isLayerPlaying(name)??false,rosesPlaying:name=>rosesIntro.current?.isDrumPlaying(name)??false,vocalKey:rosesVocalKey,backing:songId==="roses"?rosesBackingView:undefined,backingPlaying:songId==="roses"&&rosesIntroSnapshot?.status==="running"&&(rosesBeat>=144?rosesIntroSnapshot.drop?.status==="running":["PLAYING","BREAK"].includes(rosesIntroSnapshot.buildup?.status??""))})}
          snapshot={snapshot} notes={liveNotes.current} mappingName={activeProfile.name} activity={stageActivity} stageLevel={stageVisualLevel}
        />}
        {stagePresentation && <PerformanceHeader titleTransition={songId==='roses'?{from:'Roses',to:'Here With Me',mix:vinylVisual.titleMix}:undefined} concealed={songId==='roses'&&rosesRevealState.enabled&&rosesRevealState.revealedAt===null} audience={audiencePerformance} playbackStatus={!cinematicPerformance ? undefined : audioState !== "ready" ? "LOADING" : songId === "roses" ? rosesIntroSnapshot?.status === "running" ? "PLAYING" : rosesIntroSnapshot?.status === "paused" ? "PAUSED" : rosesIntroSnapshot?.status === "finished" ? "FINISHED" : "READY" : snapshot.pressed.length ? "LIVE" : "READY"} controls={songId === "roses" ? <RosesPerformanceTransport disabled={!!galaxyBridge||finaleActive} concealed={rosesRevealState.enabled&&rosesRevealState.revealedAt===null} audience={audiencePerformance} engine={rosesIntro.current} clock={rosesIntroSnapshot} ready={audioState === "ready" && rosesIntroLoadState === "ready" && !instrumentError} prepareAudio={startAudio} leadMs={rosesCalibration.leadMs} /> : songId==='levels'&&!openingSequence.capturing&&!openingSequence.pianoTyping?<button className="galaxy-transition-trigger" onClick={beginLevelsInterstellarTransition}>NEXT SCENE →</button>:songId==='interstellar'&&performanceSection===3?<button className="galaxy-transition-trigger" onClick={beginGalaxyVinylTransition}>NEXT SCENE →</button>:undefined} inputHud={songId==='interstellar'&&!openingSequence.capturing&&(openingSequence.pianoTyping||showLiveKeys)?<LiveKeysHud history={liveKeyHistory} transpose={activeTranspose} reveal={openingSequence.pianoTyping} reduced={performanceSection===3}/>:undefined} song={stagePresentation} title={songId==="roses"?(audiencePerformance ? (rosesHwmScene ? "Here With Me" : "Roses") : rosesBackingView.recorded?"ROSES — ORIGINAL RECORDING":rosesHwmScene?"Here With Me":"Roses"):undefined} section={songId==="roses"?rosesBackingView.role:undefined} chord={songId==="roses"?rosesBackingView.chord:undefined} measure={songId==="roses"?rosesIntroSnapshot?.measure??1:performanceMeasure} bpm={songId === "levels" ? performanceMeasure >= 12 ? 100 : 126 : 100} beat={songId === "roses"?rosesIntroSnapshot?.beat:songId === "levels" && drumSnapshot?.status === "running" ? drumSnapshot.beat : undefined} sustain={sustainActive} showPedal={sustainSettings.showIndicator} elapsed={showHud ? elapsed : undefined} />}
        {!stagePresentation && sustainSettings.showIndicator && <div className={`performance-sustain ${sustainActive ? "is-active" : ""}`}>PEDAL {sustainActive ? "ON" : "OFF"}</div>}
        {!stagePresentation && <div className="performance-profile">
          {activeProfile.name}{" "}
          <span>· F7 LABELS {performanceLabels ? "ON" : "OFF"}</span>
        </div>}
        {songId === "roses" && rosesPerformanceSetup && <details hidden className="roses-performance-controls"><summary>Performance controls</summary><div className="roses-performance-status">
          <strong>{rosesHwmScene?"HERE WITH ME":"ROSES"} · BAR {String(rosesIntroSnapshot?.measure ?? 1).padStart(2, "0")} / 44 · BEAT {(rosesIntroSnapshot?.beat ?? 1).toFixed(2)} · 100 BPM{rosesIntroSnapshot?.status === "finished" ? " · FINISHED" : ""}</strong>
          <span>SYNTH {rosesIntroSnapshot?.synthPending !== undefined ? rosesIntroSnapshot.synthPending ? "ARMED" : "STOP QUEUED" : rosesIntroSnapshot?.synthActive ? "ON" : "OFF"} · BASS/SUB {rosesIntroSnapshot?.bassPlaybackMode === "manual" ? "MANUAL · , . /" : rosesIntroSnapshot?.bassPending !== undefined ? rosesIntroSnapshot.bassPending ? "ARMED" : "STOP QUEUED" : rosesIntroSnapshot?.bassActive ? "PLAYING" : "NOT ARMED"} · VOCAL {rosesIntroSnapshot?.vocalStatus ?? "NOT ARMED"}</span>
          <span>{rosesIntroSnapshot?.status === "finished" ? "Finished · Reset to rehearse" : rosesIntroSnapshot?.missedBassHandoff && !rosesIntroSnapshot.bassActive ? "MISSED BASS HANDOFF · N recovers on the next bar" : (rosesIntroSnapshot?.measure ?? 1) === 4 ? `Arm V synth and ${rosesVocalKey.replace("Key", "")} vocal for bar 5` : (rosesIntroSnapshot?.measure ?? 1) < 5 ? "Play live synth · V arms synth for bar 5" : (rosesIntroSnapshot?.measure ?? 1) < 13 ? "Play Z/X drums · N arms bass for bar 13" : (rosesIntroSnapshot?.measure ?? 1) >= 29 ? `${rosesBackingView.source} · ${rosesBackingView.chord??"automatic backing"}` : (rosesIntroSnapshot?.measure ?? 1) >= 21 ? "Vocals + live drums · no required drum hits" : (rosesIntroSnapshot?.measure ?? 1) >= 20 ? "Play X clap · C accent optional" : "Play Z kick / X clap · C accent at bar 16"}</span>
          {rosesIntroSnapshot?.lastDrum && <span className="roses-drum-flash" key={rosesIntroSnapshot.lastDrum.sequence}>{rosesIntroSnapshot.lastDrum.kind.toUpperCase()} HIT</span>}
          {rosesIntroSnapshot?.lastAccent && <span className="roses-drum-flash" key={`accent-${rosesIntroSnapshot.lastAccent}`}>VOCAL ACCENT HIT</span>}
          <div><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError || rosesIntroSnapshot?.drop?.status === "loading"} onClick={() => rosesIntro.current?.startWithDrop(1, "performance")}>Start bar 1</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(5, "performance")}>Start bar 5</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(9, "performance")}>Start bar 9</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(13, "performance")}>Start bar 13</button><button disabled={rosesIntroLoadState !== "ready" || !!instrumentError} onClick={() => rosesIntro.current?.startAt(21, "performance")}>Start bar 21</button><button onClick={() => rosesIntro.current?.armSynth()}>V Arm synth</button><button disabled={rosesIntroSnapshot?.bassPlaybackMode === "manual"} onClick={() => rosesIntro.current?.armBass()}>N Arm bass</button><button onClick={() => rosesIntro.current?.armVocal()} disabled={!rosesIntroSnapshot?.vocalReady || rosesIntroSnapshot.status === "running" && rosesIntroSnapshot.measure !== 4}>{rosesVocalKey.replace("Key", "")} Arm vocal</button><button disabled={!rosesIntroSnapshot || !["running", "paused"].includes(rosesIntroSnapshot.status)} onClick={() => rosesIntroSnapshot?.status === "paused" ? rosesIntro.current?.resume() : rosesIntro.current?.pause()}>{rosesIntroSnapshot?.status === "paused" ? "Resume" : "Pause"}</button><button onClick={() => setRosesBeatHud(value => !value)}>Beat HUD {rosesBeatHud ? "ON" : "OFF"}</button><button onClick={() => rosesIntro.current?.stopLoop()}>B Stop backing</button><button onClick={() => rosesIntro.current?.reset()}>Reset</button></div>
          <RosesBassControls engine={rosesIntro.current} clock={rosesIntroSnapshot} />
          <label className="roses-performance-synth-level">V Synth <output>{Math.round(rosesSynthLevel * 100)}%</output><input aria-label="V Synth backing level" type="range" min="0" max="150" step="5" value={Math.round(rosesSynthLevel * 100)} onChange={event => setRosesSynthLevel(Number(event.target.value) / 100)} /></label>
          <label className="roses-performance-synth-level">Synth lead <output>{rosesSynthLeadMs} ms</output><input aria-label="V Synth timing lead" title="Negative = later; positive = earlier" type="range" min="-60" max="60" step="5" value={rosesSynthLeadMs} onChange={event => setRosesSynthLeadMs(Number(event.target.value))} /></label>
          <small>{rosesChordHint}</small>
          <small>V synth · N bass/sub · {rosesVocalKey.replace("Key", "")} vocal at bar 4 for bar 5 · Z kick · X clap · C accent · B stop · Space starts with four beats; pedal during playback · samples {rosesIntroLoadState}{instrumentError ? ` · ${instrumentError}` : ""}</small>
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
          {levelsWarpState.active&&levelsPianoGhost&&<PianoSceneGhost image={levelsPianoGhost}/>}
          {songId === "roses" && !audiencePerformance && <div className="piano-input-legend"><span>● LIVE · KEYCAPS</span><span>━ AUTO · ACTIVITY</span></div>}
          <PianoCanvas
            active={[...activePitches,...introLoopPianoKeys.map(key=>key.midi)]}
            automatic={songId==="roses"&&rosesIntroSnapshot?.status==="running"&&(rosesBeat>=144?rosesIntroSnapshot?.drop?.status==="running":["PLAYING","BREAK"].includes(rosesIntroSnapshot?.buildup?.status??""))?rosesBackingView.active.flatMap(e=>e.pitches):[]}
            map={activeProfile}
            range={songId === "interstellar" || songId === "levels" || songId === "roses" ? keyboardRange : undefined}
            transpose={activeTranspose}
            showLabels={true}
            showKeyLabels={true}
            presentation={stagePresentation}
            keyGuide={performanceGuide}
            prominentPitches={songId === "interstellar" ? interstellarProminentPitches(performanceSection, interstellarMix.octaveEnabled, activeTranspose) : undefined}
            coolLighting={songId === "roses" && rosesHwmScene}
            cinematicLighting={cinematicPerformance}
            pressedCodes={[...snapshot.pressed.map(key => key.code),...introLoopPianoKeys.map(key=>key.code)]}
            pressedKeys={songId === "interstellar" ? interstellarDisplayPressedKeys(activePitches.map(midi => ({code:"",midi})), activeTranspose) : undefined}
            starlightNotes={songId === "interstellar" ? liveNotes.current : undefined}
          />
        </div>
        {showHud && !stagePresentation && (
          <div className="performance-hud">
            {songId === "levels" && performanceMeasure >= 9 && <><span>Bar {performanceMeasure} · beat {drumSnapshot?.beat ?? 1} · {Math.round(drumSnapshot?.tempo ?? 126)} BPM</span><span>{levelsRealRef.current ? "F1" : "Z"} {drumSnapshot?.active.kick ? "ON" : "OFF"} · {levelsRealRef.current ? "F2" : "X"} {drumSnapshot?.active.clap ? "ON" : "OFF"} · {levelsRealRef.current ? "F3" : "C"} {drumSnapshot?.active.hat ? "ON" : "OFF"}</span><span>{levelsDrumHint(drumSnapshot?.nextAction ?? "Press Z for kick", levelsRealRef.current)}</span><span>Pedal {sustainActive ? "ON" : "OFF"}</span></>}
            {songId === "interstellar" && <span>{performanceSection}/3 · {interstellarSections[performanceSection].label}</span>}
            <span>{snapshot.notesPerSecond} notes/s</span>
            <span>{snapshot.pressed.length} active</span>
            <span>
              {songId === "roses" ? "Roses Synth" : theme === "rush"
                ? "Neon"
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
          <button className="start-button performance-enter" disabled={audioState!=='ready'} onClick={()=>beginOpening('typing')}>Start opening → Levels <span className="arrow">↗</span></button>
          {openingError&&<span className="practice-warning" role="status">{openingError}</span>}
          {openingAsset==='error'&&<span className="practice-warning">CSA logo unavailable; completing the message will open the live piano directly.</span>}
          {import.meta.env.DEV&&new URLSearchParams(window.location.search).get('openingDebug')==='1'&&<details className="opening-rehearsal"><summary>CSA opening rehearsal · operator controls</summary>
            <button onClick={()=>beginOpening('typing')}>Replay full intro</button><button onClick={()=>beginOpening('message')}>Message entry</button><button onClick={()=>beginOpening('full')}>Replay CSA reveal</button><button onClick={()=>beginOpening('logo')}>Replay CSA transformation</button><button onClick={()=>beginOpening('pianoTyping')}>Typing piano reveal</button><button onClick={()=>beginOpening('pianoTyping')}>Reset piano text</button><button onClick={()=>beginOpening('piano')}>Skip to Levels</button><button onClick={()=>beginOpening('message')}>Reset to message entry</button><button onClick={()=>openingSequence.cancel()}>Restore clean setup</button>
          </details>}
          <label className="performance-start-bar">Song <select value={songId} onChange={event => selectSong(event.target.value as SongId)}><option value="interstellar">Interstellar</option><option value="levels">Levels — Avicii</option><option value="roses">Roses — The Chainsmokers</option></select></label>
          {songId === "levels" && <label className="performance-start-bar">Performance keys <select value={levelsPerformanceMode} onChange={event => setLevelsPerformanceMode(event.target.value as LevelsPlayingMode)}><option value="real">Real Piano · individual keys</option><option value="assisted">Assisted · chord triggers</option></select></label>}
          {songId === "levels" && <label className="performance-start-bar">Levels bar <input type="number" min="1" max={levelsSong.measureCount} value={performanceMeasure} onChange={event => setPerformanceBar(Number(event.target.value))} /> <small>Shift + ← / → changes bars · → next song</small></label>}
          {songId === "interstellar" && <><span className="control-hint">← / → changes sections · → after section 3 opens Roses</span><label className="performance-start-bar"><input type="checkbox" checked={showLiveKeys} onChange={event=>setShowLiveKeys(event.target.checked)} /> Live keys during performance</label><label className="performance-start-bar"><input type="checkbox" checked={interstellarMix.octaveEnabled} onChange={event => setInterstellarMix({ ...interstellarMix, octaveEnabled: event.target.checked })} /> Climax F → E5 + E6</label></>}
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
              <option value="rush">Neon</option>
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
              {profiles.filter((profile) => profile.id !== assistedInterstellarMap.id && profile.id !== "rush-e").map((profile) => (
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
