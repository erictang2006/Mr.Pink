Phase 4 — physical typing becomes live piano

Current production routing uses Levels notes and sound during this phrase and continues into Levels Performance. See [levels-opening.md](levels-opening.md). The Interstellar-specific notes below describe the earlier route.

The existing controller now enters TYPING_PIANO_REVEAL at the end of the CSA piano reveal (3.55 s after I LOVE CSA is completed). The existing keyboard, PerformanceVisualizer, header and audio engine remain mounted. Only a transparent text layer is added above the piano. It starts with a blinking caret and no preset phrase.

Physically type WAIT!!! I CAN PLAY PIANO? (lowercase typing is displayed uppercase). Actual input is appended rather than advancing through expected letters. Mistakes must be corrected with Backspace. Holding a key cannot append repeated letters or generate duplicate attacks. Shift alone is silent; each exclamation mark uses a physical Shift+1 press. Modifier shortcuts are ignored by both the text path and ordinary piano handler.

How the shared event works:

1. KeyboardInputManager's existing routeKeyDown calls OpeningSequence.keyDown.
2. In TYPING_PIANO_REVEAL, the controller updates pianoText from that event's actual key and returns the same event to the existing manager for normal pitch lookup and dispatch.
3. The existing App note callback calls planInterstellarPress and the current PianoAudioEngine, updates LiveNotes and pressed-key state, and the existing keyboard/visualizer produce their normal lighting and trails.
4. Actual keyup still passes through the same manager and releases the same captured note. Backspace changes only text; it does not invent a note or release a different held key.

No second global keydown/keyup listener, piano engine, musical sequence or sample-loading path was added. Physical key codes determine sound; text does not determine the next musical note. W/A/I/T retain their section-1 pitches (55/71/65/60). During this reveal only, Shift+1 resolves through the existing full Roblox map to ! / C♯2 (MIDI 37), with ordinary note-on, physical keyup and visual feedback. The phrase produces sixteen mapped attacks, including three separately played exclamation marks. The assisted performance mappings remain unchanged after the demonstration.

Space is consumed as text throughout the interactive sentence and its completion animation, so it does not accidentally toggle the existing Space sustain shortcut. After the sentence disappears, Space immediately resumes its normal pedal behavior. The completion handoff does not reset pedal state, release held voices, clear live trails, reload samples or remount the keyboard. A note held through that boundary releases on its actual later keyup.

Completion is strict equality with pianoTypingConfig.message after uppercase display conversion. The final question mark only completes a correct full phrase. Completion locks the displayed sentence, holds/glows for 1000 ms, then dissolves over 650 ms into 36 seeded blue-white particles. The controller owns the final deadline; it does not wait for CSS animationend. A key-event deadline check also handles a delayed browser timer. Musical keys remain playable during the hold/fade. No Interstellar melody starts automatically. The first NEW physical note after INTERSTELLAR_ACTIVE can consume the existing subtle starfield cue; the typing notes cannot consume it.

Configuration lives in src/opening/pianoTyping.ts: target phrase, hold/dissolve timings, character pulse duration and finishing particle count. The letter pulse uses getPitch on the current actual keyboard map and the existing starlightColor palette. The text layer has pointer-events:none, cream type, no background panel, no instructions and no visible native form control. It sits below the title and above the piano; reduced motion removes the moving dust and per-character animation. Finishing particles are bounded CSS elements, with no continuous scene-specific JavaScript loop or extra keyboard listeners.

Rehearsal:

- Run npm run dev and open the printed local URL with ?openingDebug=1. Select Interstellar and enable audio.
- For the complete show, Start opening typing test → type the introduction correctly → Chrome offline error → physically type I LOVE CSA → CSA transformation → physically type WAIT!!! I CAN PLAY PIANO? → play Interstellar.
- For this scene alone, return to setup with Escape, expand the development rehearsal controls, and click Typing piano reveal. Reset piano text restarts this scene cleanly, releasing any held voices through the existing panic/reset path. Skip to Interstellar opens normal performance directly. None of these buttons appears on the stage.
- Development console methods are window.mrPinkRehearsal.pianoTyping(), resetPianoTyping(), and skipPianoTyping(). The first two reset/jump into the demo; skipPianoTyping() removes the text without interrupting an already held note. Existing replay(), typing(), message(), logo(), interstellar() and cancel() methods remain available. No rehearsal shortcuts were added.
- Test typing slowly and quickly, hold W while adding A, use Backspace, release both keys, and type the shifted question mark. Hold O through the final question mark and dissolve; confirm that later keyup releases it once. Test Space after the text disappears. Right Arrow then accesses the unchanged assisted section; Right Arrow again accesses the unchanged climax section.

Reliability: focus loss releases actual notes/pedal using the existing safety path and retains the entered sentence. Reset/replay cancels the old completion timer. Intro typing keys held through the CSA reveal remain quarantined until keyup. If the optional text layer fails, the controller skips it and preserves live piano input. The completion transition keeps the existing audio resources intact. No changes were made to musical arrangements, note mappings, drums, samples or other songs.

Changed files: src/App.tsx; src/opening/sequence.ts and integration.d.ts; new src/opening/pianoTyping.ts, PianoTypingReveal.tsx and pianoTyping.css; tests/opening-sequence.test.mjs; opening documentation.

Automated checks exercise event-to-text/pitch/pressed-key/trail synchronization, all phrase notes against the real mapping, Roblox exclamation notes and unmapped letters, repeats, simultaneous keys, Backspace, shifted input, indefinite waiting/slow typing, held-note completion, delayed deadlines, sustain restoration, assisted/climax mappings, focus loss, replay/reset, listener cleanup and bounded overlay rendering. These are input/data/renderer tests, not audible or graphical device verification. Browser discovery found no connected graphical browser; fullscreen at laptop/projector resolution, final text/galaxy spacing, visible dissolution and actual first-note audio latency remain manual rehearsal checks. Nothing is deployed.
