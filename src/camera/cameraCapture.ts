export type CameraState = {
  devices: MediaDeviceInfo[];
  selected: string;
  stream: MediaStream | null;
  status: string;
  busy: boolean;
};

export function cameraError(error: unknown): string {
  switch ((error as { name?: string })?.name) {
    case 'NotAllowedError': case 'SecurityError':
      return 'Camera access denied. Allow camera access in your browser and macOS Privacy & Security, then retry.';
    case 'NotFoundError': case 'OverconstrainedError':
      return 'The selected camera is unavailable. Reconnect it or select another camera, then retry.';
    case 'NotReadableError': case 'AbortError':
      return 'Camera could not start. Check the camera connection or source app. For Camo, keep Camo Studio running, then retry.';
    default: return 'Camera unavailable. Check its connection and retry.';
  }
}

// This owner lives outside scenes. Visibility changes never stop capture.
export class CameraCapture {
  state: CameraState;
  private generation = 0;
  private enumeration = 0;
  private disposed = false;
  private listeners = new Set<() => void>();
  constructor(private media: MediaDevices | undefined, selected = '') {
    this.state = { devices: [], selected, stream: null, status: media ? 'Camera off' : 'Camera requires HTTPS or localhost and a supported browser.', busy: false };
    media?.addEventListener('devicechange', this.refresh);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(patch: Partial<CameraState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  refresh = async () => {
    if (!this.media || this.disposed) return;
    const version = ++this.enumeration;
    try {
      const devices = (await this.media.enumerateDevices()).filter(device => device.kind === 'videoinput');
      if (this.disposed || version !== this.enumeration) return;
      this.update({ devices });
      const active = this.state.stream?.getVideoTracks()[0];
      const id = active?.getSettings().deviceId;
      if (id && !devices.some(device => device.deviceId === id)) this.disconnected(this.state.stream!);
    } catch { this.update({ status: 'Could not list cameras. Check browser camera permissions, then refresh.' }); }
  };
  private disconnected(stream: MediaStream) {
    if (this.state.stream !== stream) return;
    stream.getTracks().forEach(track => track.stop());
    this.update({ stream: null, status: 'Camera disconnected. Reconnect it and retry, or select another camera.' });
  }
  select = (selected: string) => {
    const active = !!this.state.stream || this.state.busy;
    this.update({ selected });
    if (active) void this.start();
  };
  start = async () => {
    if (!this.media || this.disposed) return;
    const generation = ++this.generation;
    // Release the old device before switching; some native camera drivers require it.
    this.state.stream?.getTracks().forEach(track => track.stop());
    this.update({ stream: null, busy: true, status: 'Connecting camera…' });
    try {
      const stream = await this.media.getUserMedia({
        audio: false,
        video: {
          ...(this.state.selected ? { deviceId: { exact: this.state.selected } } : {}),
          width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 },
        },
      });
      if (this.disposed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') { stream.getTracks().forEach(item => item.stop()); throw new DOMException('No video track', 'NotReadableError'); }
      const selected = track.getSettings().deviceId || this.state.selected;
      track.addEventListener('ended', () => this.disconnected(stream));
      track.addEventListener('mute', () => { if (this.state.stream === stream) this.update({ status: 'Camera paused. Check Camo Studio or your camera connection.' }); });
      track.addEventListener('unmute', () => { if (this.state.stream === stream) this.update({ status: 'Live · microphone off' }); });
      this.update({ stream, selected, busy: false, status: 'Live · microphone off' });
      await this.refresh(); // Permission unlocks device labels, including Camo Camera.
    } catch (error) {
      if (generation === this.generation) this.update({ busy: false, status: cameraError(error) });
    }
  };
  stop = () => {
    ++this.generation;
    this.state.stream?.getTracks().forEach(track => track.stop());
    this.update({ stream: null, busy: false, status: 'Camera off' });
  };
  dispose = () => {
    this.stop(); this.disposed = true;
    this.media?.removeEventListener('devicechange', this.refresh);
    this.listeners.clear();
  };
}
