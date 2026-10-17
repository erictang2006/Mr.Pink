import { useEffect, useMemo, useRef, useState } from 'react';
import PianoCanvas from './components/PianoCanvas';
import { PianoAudioEngine } from './piano/audioEngine';
import { KeyboardInputManager, type InputSnapshot } from './piano/keyboardInput';
import { midiToName, standardMap } from './piano/noteMapping';

const emptySnapshot: InputSnapshot = { pressed: [], notesPerSecond: 0 };

export default function App() {
  const [audioState, setAudioState] = useState<'locked' | 'loading' | 'ready' | 'error'>('locked');
  const [performanceMode, setPerformanceMode] = useState(true);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [volume, setVolume] = useState(72);
  const [transpose, setTranspose] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const audio = useRef<PianoAudioEngine | null>(null);
  const keyboard = useRef<KeyboardInputManager | null>(null);
  const testTimer = useRef<number | null>(null);
  const testNotes = useRef<number[]>([]);

  useEffect(() => {
    const engine = new PianoAudioEngine();
    audio.current = engine;
    engine.setVolume(volume / 100);
    const input = new KeyboardInputManager(standardMap, {
      noteOn: midi => engine.noteOn(midi),
      noteOff: midi => engine.noteOff(midi),
      change: setSnapshot,
    });
    keyboard.current = input;
    return () => {
      input.dispose();
      testNotes.current.forEach(note => engine.noteOff(note));
      engine.dispose();
      if (testTimer.current !== null) window.clearTimeout(testTimer.current);
      keyboard.current = null;
      audio.current = null;
    };
  }, []);

  useEffect(() => { keyboard.current?.setEnabled(audioState === 'ready' && performanceMode); }, [audioState, performanceMode]);
  useEffect(() => { audio.current?.setVolume(volume / 100); }, [volume]);
  useEffect(() => { keyboard.current?.setTranspose(transpose); }, [transpose]);

  const activePitches = useMemo(() => [...new Set(snapshot.pressed.map(key => key.midi))].sort((a, b) => a - b), [snapshot]);

  async function startAudio() {
    if (!audio.current || audioState === 'loading') return;
    setAudioState('loading');
    try {
      await audio.current.start();
      setAudioState('ready');
    } catch {
      setAudioState('error');
    }
  }

  function soundTest() {
    const engine = audio.current;
    if (!engine?.isReady()) return;
    if (testTimer.current !== null) window.clearTimeout(testTimer.current);
    testNotes.current.forEach(note => engine.noteOff(note));
    const notes = [60 + transpose, 64 + transpose, 67 + transpose];
    testNotes.current = notes;
    notes.forEach(note => engine.noteOn(note));
    testTimer.current = window.setTimeout(() => {
      notes.forEach(note => engine.noteOff(note));
      testNotes.current = [];
      testTimer.current = null;
    }, 600);
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><i/><i/><i/><i/></span><span>STAGE<span className="brand-light">PIANO</span></span></div>
      <div className="topbar-right"><span className="version">PERFORMANCE INSTRUMENT · V1</span><span className={`connection ${audioState === 'ready' ? 'is-ready' : ''}`}><span className="status-dot" />{audioState === 'ready' ? 'AUDIO READY' : audioState === 'loading' ? 'LOADING SAMPLES' : audioState === 'error' ? 'AUDIO ERROR' : 'AUDIO LOCKED'}</span></div>
    </header>

    <section className="stage-panel">
      <div className="eyebrow"><span className="eyebrow-line" /> YOUR KEYBOARD IS THE INSTRUMENT</div>
      <h1>Every keystroke,<br/><em>a note in the room.</em></h1>
      <p className="intro">A responsive piano built for the stage. Unlock audio, focus this window, and play directly from your MacBook keyboard.</p>
      <div className="primary-controls">
        {audioState !== 'ready' ? <button className="start-button" onClick={startAudio} disabled={audioState === 'loading'}><span className="button-icon">▶</span>{audioState === 'loading' ? 'Loading piano samples…' : audioState === 'error' ? 'Retry audio' : 'Enable piano audio'}<span className="arrow">↗</span></button> : <div className="ready-pill"><span className="pulse-dot" /> Piano ready to play</div>}
        <span className="control-hint">Audio starts with your click, as required by the browser.</span>
      </div>
      <div className="stage-art" aria-hidden="true"><div className="halo halo-one"/><div className="halo halo-two"/><div className="stage-wave">{Array.from({length: 28}, (_, i) => <span key={i} style={{height: `${15 + Math.abs(Math.sin(i * .61) * Math.cos(i * .23)) * 80}%`, animationDelay: `${i * 38}ms`}} />)}</div><div className="art-caption">LIVE INPUT / ZERO SEQUENCING</div></div>
    </section>

    <section className="workbench" aria-label="Piano controls and diagnostics">
      <div className="panel panel-diagnostics">
        <div className="panel-title"><span>01 / LIVE MONITOR</span><span className="live-marker"><span/>LIVE</span></div>
        <div className="stat-grid"><div className="stat"><strong>{snapshot.pressed.length.toString().padStart(2, '0')}</strong><span>KEYS DOWN</span></div><div className="stat"><strong>{activePitches.length.toString().padStart(2, '0')}</strong><span>SOUNDING PITCHES</span></div><div className="stat"><strong>{snapshot.notesPerSecond.toString().padStart(2, '0')}</strong><span>NOTES / SEC</span></div></div>
        <div className="monitor-row"><span>PHYSICAL KEYS</span><div className="chip-list">{snapshot.pressed.length ? snapshot.pressed.map(key => <kbd key={key.code}>{key.label}</kbd>) : <span className="monitor-empty">Awaiting input</span>}</div></div>
        <div className="monitor-row"><span>MIDI PITCHES</span><div className="chip-list">{activePitches.length ? activePitches.map(midi => <span className="pitch-chip" key={midi}>{midiToName(midi)} <small>{midi}</small></span>) : <span className="monitor-empty">No active notes</span>}</div></div>
      </div>

      <div className="panel panel-settings">
        <div className="panel-title"><span>02 / INSTRUMENT SETUP</span><span className="subtle">SALAMANDER GRAND</span></div>
        <div className="setting-row"><div><strong>Performance mode</strong><small>Capture mapped keys while this window is focused</small></div><button className={`toggle ${performanceMode ? 'on' : ''}`} role="switch" aria-checked={performanceMode} aria-label="Performance mode" onClick={() => setPerformanceMode(value => !value)}><span /></button></div>
        <div className="setting-row volume-row"><div><strong>Master volume</strong><small>Set a comfortable output level</small></div><div className="volume-control"><input aria-label="Master volume" type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /><span>{volume}%</span></div></div>
        <div className="setting-row"><div><strong>Octave range</strong><small>Shift the full keyboard by one octave</small></div><div className="stepper"><button aria-label="Lower octave" onClick={() => setTranspose(value => Math.max(-12, value - 12))} disabled={transpose <= -12}>−</button><span>{transpose === 0 ? 'STANDARD' : transpose > 0 ? '+1 OCT' : '−1 OCT'}</span><button aria-label="Raise octave" onClick={() => setTranspose(value => Math.min(12, value + 12))} disabled={transpose >= 12}>+</button></div></div>
        <button className="sound-test" onClick={soundTest} disabled={audioState !== 'ready'}><span>♪</span> Play sound test <span className="test-arrow">↗</span></button>
      </div>
    </section>

    <section className="keyboard-section" aria-label="Visual piano keyboard">
      <div className="keyboard-topline"><div><span className="section-index">03 / THE KEYBOARD</span><h2>Play what you feel.</h2></div><button className="guide-button" onClick={() => setShowGuide(value => !value)} aria-expanded={showGuide}>{showGuide ? 'Hide' : 'Show'} key guide <span>{showGuide ? '−' : '+'}</span></button></div>
      {showGuide && <div className="key-guide"><p><strong>Lower row</strong> Z X C V B N M for white notes; S D G H J for black notes.</p><p><strong>Upper row</strong> Q W E R T Y U for white notes; 2 3 5 6 7 for black notes.</p><p><strong>Shift</strong> raises a new note one octave. Notes already held keep their original pitch until their physical key is released.</p></div>}
      <div className="piano-frame"><div className="piano-meta"><span><span className="tiny-led"/> 36 SEMITONES · POLYPHONIC</span><span>SHIFT + KEY = +1 OCTAVE</span></div><PianoCanvas active={activePitches} map={standardMap} transpose={transpose} /></div>
      <div className="keyboard-foot"><span>BUILT FOR PHYSICAL KEYBOARD INPUT</span><span>CLICK THE PAGE AFTER USING A CONTROL TO RETURN FOCUS</span></div>
      <div className="sample-credit">Piano samples: <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noreferrer">Salamander Grand Piano V3</a> by Alexander Holm · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a></div>
    </section>
  </main>;
}
