# Camo Camera in Mr. Pink

With the iPhone feed already running in Camo Studio:

1. Open **Performance settings** in the lower-left corner of Mr. Pink.
2. Turn on **Enable Camera** and allow the browser's camera permission. Device labels may be hidden until permission is granted.
3. Choose **Camo Camera** (or the Camo-named source exposed by your browser) in **Camera source**. If it is not listed, keep Camo Studio running and click **Refresh cameras**. Mr. Pink lists the actual video devices reported by the browser; it does not invent a Camo option when the driver is unavailable.
4. Drag the overlay header to move it, and drag the lower-right corner to resize it. Its default position is near the top left, with saved positions restored.
5. Use **Show overlay** in Performance settings to hide/show the overlay. Hiding it keeps capture running. Turn off **Enable Camera** to stop capture and release the device; turning it off also cancels an outstanding permission request.

The camera is optional and initially off. Camo is accessed only through `navigator.mediaDevices.getUserMedia()` with `audio: false`, using the selected video device ID. Mr. Pink does not connect to a Camo API or add a streaming server. Keep the current Camo Studio feed running. See [Camo's troubleshooting guide](https://camo.com/support/camo/troubleshooting-camo) if its virtual camera does not appear in your browser.

Capture belongs to the existing root-level CameraFeature, outside App's Interstellar, Roses, and Levels scene branches. Scene transitions do not stop or reacquire it. Entering fullscreen moves the display into the fullscreen element and reattaches the same stream. The video is muted and never connected to the music audio graph. Existing piano/MIDI input and animation/timing code are unchanged. The camera has no custom keyboard shortcuts; visibility and capture are controlled manually in settings.

Permission failures, unavailable devices, native track pauses, and disconnections appear in the camera settings and overlay. Select another source or use **Retry / Enable camera** after fixing the connection. Device disappearance never silently switches the camera. A browser playback rejection shows **Resume video**, which resumes the existing stream without reconnecting. If Camo continues to publish a live virtual-camera track while showing its own disconnected-phone screen, Mr. Pink will display that screen; reconnect the phone in Camo Studio.

Camera selection and permissions remain local to each laptop; overlay layout participates in the existing shared settings file. Reloading the app never activates capture automatically. The performance application continues normally when Camo or the entire camera API is unavailable.

Verification includes video-only Camo device selection, optional/unavailable cameras, permission failure and retries, track mute/end, device loss, stale grants, the Enable Camera switch, pending-request cancellation, and overlay hiding without stopping/reacquiring capture. Actual iPhone/Camo output and visual layout should also be checked in a browser with Camo available.
