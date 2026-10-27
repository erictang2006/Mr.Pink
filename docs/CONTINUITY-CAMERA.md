# Native camera overlay

Open **Performance settings** in the lower-left corner. Click **Enable camera**, allow camera access, then choose the iPhone or another camera from **Camera source**. **Refresh cameras** updates the list; device changes also refresh it automatically. Camera labels may remain hidden until access is granted. Serve the app over HTTPS or localhost.

For iPhone setup, enable Continuity Camera in iPhone Settings → General → AirPlay & Continuity. Use the same Apple Account on both devices, enable Wi-Fi and Bluetooth, and keep the iPhone nearby, locked, and positioned for use as a camera. A trusted USB connection is also supported by macOS. See [Apple’s Continuity Camera setup and troubleshooting](https://support.apple.com/en-us/102546). The app lists the video devices exposed by the browser; it cannot force macOS to advertise an unavailable iPhone.

Use **Show overlay** in Performance settings to show or hide the overlay. Hiding retains capture; **Stop camera** releases it. Camera activation requires an explicit Enable action. There are no custom keyboard shortcuts for the camera.

Drag the overlay header to move it; drag the lower-right corner to resize it. The frame stays at 16:9 and within the viewport. The camera choice is saved locally; position and size are included in the shared repository settings; activation is not restored automatically on reload.

Capture is owned by a root component alongside App, outside all scene branches. The display moves into the native fullscreen element when needed; that move reattaches the existing MediaStream without requesting another capture. No microphone is requested (`audio: false`), and preview playback is muted. Nothing connects to the piano/audio/MIDI path. The only existing source change is mounting the camera feature in main.tsx.

When a feed ends or its device disappears, the overlay reports disconnection and keeps the selected device. It does not silently switch cameras. Reconnect and click Retry / Enable camera, or choose another source and enable it. Permission failures explain how to allow access and can be retried. Muted native tracks show a paused message until they resume. Stopping or switching during an unresolved permission request discards and stops any stale stream that later arrives.

## Validation

`npm run build` checks TypeScript and production bundling. `npm test` includes camera capture tests for video-only constraints, native device labels, exact iPhone selection, switching races, cancellation, permissions, device disappearance, track mute/end, and disposal.

Hardware/browser acceptance checks:

1. Enable a real Mac camera, then select an available iPhone and confirm the picture changes. Confirm no microphone access is requested.
2. Move and resize with the pointer, hide/show with **Show overlay**, and confirm capture stays active while hidden.
3. Play the full scene sequence and enter/exit fullscreen; confirm the selected feed stays live without another permission prompt.
4. Disconnect the iPhone; confirm the status message, then reconnect, refresh, and retry.
5. Deny browser/macOS camera permission; confirm the message, allow access, and retry.
6. Stop capture and verify the camera-use indicator clears. Reload and verify the camera remains off while the choice and frame are remembered.

Automated browser and real Continuity Camera checks require an available browser and connected hardware; neither was available in the implementation session.
