Opening typing test

Current production routing ends in Levels Performance; see [levels-opening.md](levels-opening.md). The Interstellar references below describe the earlier route.

Start from setup: select Interstellar, enable audio, click Start opening typing test. The entire introduction is visible immediately. There is no simulated typing or predetermined speed. Replay full intro in the development-only ?openingDebug=1 setup controls returns to the same physical typing test. Message entry, CSA-only reveal, transformation-only rehearsal and direct piano jump remain separate operator controls.

The exact default passage is configured in src/opening/typingTest.ts:

"Hi, my name is Eric, and I can type relatively fast. I'm a junior and I represent CSA. I made this entire program for you guys, so I hope you enjoy the show"

Changing introTypingConfig.passage changes both the model and screen. The controller also accepts a passage in its constructor for focused rehearsals/tests. The logic does not depend on particular words or a fixed character count.

Input is routed through the existing KeyboardInputManager before normal note dispatch, including while piano capture is disabled. Capitalization, punctuation and spaces must match exactly. Wrong characters remain marked against the displayed passage; Backspace rewinds the caret and permits correction. Printable auto-repeat events do not manufacture characters or inflate speed. Backspace may repeat for deletion. Modifiers, composition and non-character controls do not count as typing attempts. Paste is not used to fill the passage.

The timer starts on the first printable character, including an incorrect one, rather than page entry or Shift. Empty Backspace does not start it. Net WPM = (currently correct characters / 5) / elapsed minutes. This counts spaces and punctuation, includes pauses, and returns zero while elapsed time is zero. Accuracy = correct printable attempts / all accepted printable attempts × 100. Backspace does not erase earlier mistakes from accuracy. The screen refreshes elapsed metrics at 100 ms intervals; the passage is memoized so clock updates do not rebuild its character nodes. The caret updates on input and viewport changes using a lightweight ResizeObserver.

Only input exactly equal to the configured passage completes the test. With the current passage, the final character triggers completion only if every earlier character is also correct. Incorrect full-length input must be corrected with Backspace. Both metrics freeze using the completion timestamp.

The same OpeningSequence controller owns:

TYPING_TEST → TYPING_COMPLETE (400 ms hold) → SIMULATED_CRASH (2620 ms: local Chrome-style error, glitch and blackout) → MESSAGE_ENTRY → existing CSA sequence → TYPING_PIANO_REVEAL → INTERSTELLAR_ACTIVE.

No deadline is armed while waiting for passage input. Hold/crash deadlines are created only after exact physical completion. They are cancellable and protected against stale replay callbacks; animation frames are not required to reach message entry. Once the crash ends, message entry is empty and waits for physical I LOVE CSA. The CSA timeline still starts only after that message, and still takes 3.55 seconds. The Monkeytype, offline-error, I LOVE CSA and CSA transformation scenes remain silent. The new final typing-piano demonstration intentionally uses live physical piano notes; see piano-typing-reveal.md. Held typing keys are quarantined through handoff until their actual keyup.

Inspection found no prior typing-test/crash component or Monkeytype screenshot in this workspace. The prior opening exposed only a post-crash hook. This implementation adds the missing screen and a compact deterministic signal-loss animation, keeping the existing external mrPinkOpening.crashComplete() compatibility hook. That hook cannot bypass an active typing test. The replacement crash is a local Chrome-style offline page based on the supplied screenshot: white background, inline pixel dinosaur, No internet heading, the two troubleshooting bullets and ERR_INTERNET_DISCONNECTED. It hard-cuts from the completed typing test, stays clean for 1800 ms, distorts subtly for 450 ms, fades to black for 250 ms and holds black for 120 ms. The existing 400 ms completed-result hold precedes it. These values are configurable in introTypingConfig; crashDuration is derived from their sum, keeping CSS and scene deadlines aligned. The error screen makes no requests and contains no navigation, application branding or piano controls. Its dinosaur is inline vector artwork, not a remotely fetched asset. It does not crash the browser or alter audio. Reduced-motion mode removes displacement while keeping the clean hold and fade.

The visual layout uses a dark gray surface, system monospace type, dim readable upcoming text, bright correct text, red underlined errors, a thin amber caret, a prominent WPM value and secondary accuracy. It stays visually separate from the space/piano scene. The 16:9 layout uses a centered constrained-width paragraph and natural word wrapping.

Verification: automated tests cover the exact visible passage before input, zero pre-start time, known five-character WPM examples, pauses, correction-history accuracy, case/punctuation, frozen final metrics, no timer-triggered completion, the 400 ms boundary, crash-to-empty-message transition, required CSA progression, replay/cancellation, and silent input through the actual keyboard manager. Browser discovery returned no graphical browser. Actual wrapping, caret movement, fullscreen/projector readability, the CSS crash and audible first-note response still require local rehearsal. No deployment is involved.

The replacement is implemented in OfflineErrorScreen.tsx and offlineError.css. TypingTestScreen now renders only the typing test and frozen-result hold; its previous cinematic crash layers were removed. The same SIMULATED_CRASH state and input quarantine remain in use, and full-intro rehearsal/reset behavior is unchanged. The dinosaur geometry was rasterized locally for an isolated icon inspection. Full-page layout and the actual CSS transition still require browser/projector QA.

Phase 4 adds the physical WAIT... I CAN PLAY PIANO? moment after the real keyboard appears. The same controller handles it, and the normal performance starts after its one-second hold and 650 ms dissolution. See piano-typing-reveal.md for the shared event path and new rehearsal methods.

Rehearsal shortcut: press Enter (or numpad Enter) during the initial typing test to fill the entire introduction and continue through the normal 400 ms result hold and Chrome offline error. This works before or after partial typing. Auto-filled characters do not count toward measured WPM or accuracy. Enter does not complete the later I LOVE CSA or WAIT... I CAN PLAY PIANO? scenes.
