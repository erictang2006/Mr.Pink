# Settings across laptops

Settings are saved automatically to `public/shared-settings.json` while running `npm run dev`. Open **Performance settings** in the lower-left corner to see save status or click **Save now**. This is the normal Git-tracked project file: commit and push it along with your code changes.

## First transfer from this laptop

1. Restart `npm run dev` to load the new settings support.
2. Open the app in the same browser and local URL you normally use on this laptop. Its existing browser preferences are captured on the first run, within a second of startup. Click **Save now** and confirm the saved status before closing.
3. Commit and push `public/shared-settings.json` with the code changes.
4. Pull on the other laptop, restart `npm run dev`, and reload the app. Shared settings load before the app initializes, replacing that browser's shared preferences.

Future changes follow the same commit/push/pull/reload workflow. The app does not run Git or push automatically. Reload an already-open app after pulling to apply the new settings. If an old tab tries to save after the file changed, saving stops and asks you to reload rather than overwriting the pulled profile. Resolve a Git merge conflict in the settings file before starting the app.

## Included

All existing `stage-piano-*` preferences, including instrument presets and settings, user key mappings, mixes, song and practice preferences, sustain, and appearance. Master volume, general transpose, keyboard capture, guide visibility, practice/performance labels, assisted notes, and keyboard height now also persist. Camera overlay position and size travel with the setup and are clamped to the destination screen.

Pre-drop riser volume, intensity and enable state, hybrid drum settings, backing group levels and solo, drop mixer levels and mute/solo choices, lead controls, and Levels playing modes save in browser storage when changed. They restore when the app recreates its engines. Reloading preserves local changes while the repository copy is catching up; pulling a different repository revision still loads that transferred profile.

Live playback, held notes, microphone/camera activation, fullscreen, and scene animation state are not preferences and are not restored.

## Local to each laptop

- Camera device IDs and camera/browser/macOS permissions. Choose the camera on each laptop.
- Audio output calibration (`stage-piano-roses-calibration:*`), which depends on that laptop's hardware.
- Imported audio stored in the browser's IndexedDB and its instrument metadata. Copy samples into project assets using the existing sample workflow to carry them through Git; settings alone do not transfer audio files. Presets that reference a browser-only instrument still need the corresponding sample installed on the destination laptop.

## Production builds and export

`npm run build` includes the current shared settings file in `dist`. Production and preview load it on startup but cannot write back to the source repository. **Export settings** downloads the current portable settings as `shared-settings.json`; replace `public/shared-settings.json` with that download and commit it to transfer production changes. No separate service or account is needed.

## Implementation and verification

The dev-only Vite middleware writes one fixed file, validates the settings schema and request origin, serializes writes, and uses an atomic rename plus revision checking. Changes to the shared settings file do not reload a live performance. A small polling task collects existing browser preferences once per second, avoiding changes to the piano, MIDI, and audio engines. Startup fetches are bounded to four seconds; failures retain local browser preferences and disable repository writes for that session.

Automated tests cover migration, destination hydration, local hardware exclusions, malformed input, atomic saves, simultaneous/stale writes, foreign requests, save retries, and load failures. A real two-browser transfer still needs the initial browser capture on the source laptop.
