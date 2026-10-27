# Armed start in Roses Performance Mode

The Roses stage header now has visible **Start bar 1 · All armed**, **Pause/Resume**, and **Stop** buttons. The former detailed controls remain hidden; the new buttons sit under the existing stage status and accept pointer input despite the header's presentation-only default.

Start resets the current take, clears a practice loop, arms V synth, N bass/sub when Automatic is selected, F6 guitar/build bass, and the original Roses vocal. It then uses the existing full-performance start path to prepare the selected drop and arm the selected 29–36 buildup before starting at bar 1, 100 BPM.

The timeline is unchanged: the first four bars remain live piano; the armed synth and original vocal enter at bar 5; automatic bass/sub, when selected, enters at bar 13; guitar/build bass at 21; selected buildup at 29; selected drop at 37. The Roses vocal still fades to silence at bar 29, and the independent Here With Me vocal keeps its existing configured cue and gain. Z/X drums and the optional C accent remain physical hits. G arms the Roses vocal.

Manual Bass/Sub stays manual; the button never re-enables its automatic pattern. Source choices, gains, sync offset, mute/solo settings, optional drop lead and enabled vocal choices are preserved. No standalone lead is armed alongside the drop mixer's lead. No audio, MIDI, keyboard mapping or instrument setting changes.

The start button waits for the required audio readiness. Preparing blocks duplicate clicks; Stop cancels a pending preparation through the existing generation check. Starting again resets arming before applying it, so toggle-based arm methods cannot turn previously armed parts off. Leaving the stage prevents pending component-state updates. Failures are reported locally beside the controls.

Validation uses the actual transport engine with mocked audio nodes: repeated full takes cover Manual/Automatic bass and optional recorded-drop lead off/on, exact original entrances, one vocal/recording instance, expected 32 early synth notes and 48 or zero early bass/sub notes, unchanged five chop clips and preserved mixer levels/sync. Cancellation prevents a queued start from restarting after Stop. Server-rendered header checks confirm the controls are outside the hidden panel and expose their running/paused/loading states. Browser/device playback and final visual placement require a local rehearsal.
