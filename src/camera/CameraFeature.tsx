import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { CameraCapture } from './cameraCapture';
import './camera.css';
import SharedSettingsPanel from '../settings/SharedSettingsPanel';
import SodaPopSettings from '../finale/SodaPopSettings';

type Frame = { x: number; y: number; width: number };
const saved = (key: string) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Optional preference. */ } };
function fit(frame: Frame): Frame {
  const width = Math.min(Math.max(180, frame.width), 800, Math.max(120, window.innerWidth - 16), Math.max(120, (window.innerHeight - 16) * 16 / 9));
  return { width, x: Math.max(8, Math.min(frame.x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(frame.y, window.innerHeight - width * 9 / 16 - 8)) };
}
function initialFrame(): Frame {
  try {
    const frame = JSON.parse(saved('mr-pink-camera-frame')) as Frame;
    if ([frame.x, frame.y, frame.width].every(Number.isFinite)) return fit(frame);
  } catch { /* Default position. */ }
  return fit({ x: 24, y: 90, width: 320 });
}
export default function CameraFeature() {
  const [capture] = useState(() => new CameraCapture(navigator.mediaDevices, saved('mr-pink-camera-device')));
  const camera = useSyncExternalStore(capture.subscribe, capture.snapshot);
  const [visible, setVisible] = useState(false);
  const [frame, setFrame] = useState(initialFrame);
  const [host, setHost] = useState<Element>(document.fullscreenElement || document.body);
  const video = useRef<HTMLVideoElement>(null);
  const [playbackError, setPlaybackError] = useState(false);
  const enabled = camera.busy || !!camera.stream;
  const selectedDevice = camera.devices.find(device => device.deviceId === camera.selected);
  const sourceName = selectedDevice?.label || camera.stream?.getVideoTracks()[0]?.label || 'Selected camera';
  const camoAvailable = camera.devices.some(device => /camo/i.test(device.label));
  const labelsAvailable = camera.devices.some(device => !!device.label);
  const setEnabled = (next: boolean) => {
    if (next) { setVisible(true); void capture.start(); }
    else { capture.stop(); setVisible(false); }
  };
  const playPreview = () => {
    void video.current?.play().then(() => setPlaybackError(false)).catch(() => setPlaybackError(true));
  };
  const gesture = useRef<{ x: number; y: number; frame: Frame; resize: boolean } | null>(null);
  useEffect(() => {
    void capture.refresh();
    return capture.dispose;
  }, [capture]);
  useEffect(() => { save('mr-pink-camera-device', camera.selected); }, [camera.selected]);
  useEffect(() => { save('mr-pink-camera-frame', JSON.stringify(frame)); }, [frame]);
  useEffect(() => {
    const fullscreen = () => { setHost(document.fullscreenElement || document.body); setFrame(value => fit(value)); };
    const resize = () => setFrame(value => fit(value));
    window.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('fullscreenchange', fullscreen); };
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    element.srcObject = camera.stream;
    setPlaybackError(false);
    if (camera.stream) void element.play().catch(() => { if (!cancelled) setPlaybackError(true); });
    return () => { cancelled = true; element.srcObject = null; };
  }, [camera.stream, host]);
  const begin = (event: PointerEvent<HTMLButtonElement>, resize: boolean) => {
    if (event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, frame, resize };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current;
    if (!start) return;
    setFrame(fit(start.resize ? { ...start.frame, width: start.frame.width + event.clientX - start.x } : { ...start.frame, x: start.frame.x + event.clientX - start.x, y: start.frame.y + event.clientY - start.y }));
  };
  const pointerProps = { onPointerMove: move, onPointerUp: () => { gesture.current = null; }, onPointerCancel: () => { gesture.current = null; }, onLostPointerCapture: () => { gesture.current = null; } };
  return createPortal(<>
    <details className="camera-settings">
      <summary>Performance settings</summary>
      <SharedSettingsPanel />
      <SodaPopSettings />
      <div className="camera-enable-row">
        <label htmlFor="enable-performance-camera">Enable Camera</label>
        <button id="enable-performance-camera" className={`toggle ${enabled ? 'on' : ''}`} role="switch" aria-checked={enabled} aria-label="Enable Camera" disabled={!navigator.mediaDevices} onClick={() => setEnabled(!enabled)}><span /></button>
      </div>
      <label htmlFor="performance-camera">Camera source</label>
      <select id="performance-camera" value={camera.selected} onChange={event => capture.select(event.target.value)}>
        <option value="">System default camera</option>
        {camera.selected && !camera.devices.some(device => device.deviceId === camera.selected) && <option value={camera.selected}>Saved camera · unavailable</option>}
        {camera.devices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
      </select>
      <div className="camera-actions">
        <button disabled={!navigator.mediaDevices || camera.busy} onClick={() => setEnabled(true)}>{camera.busy ? 'Connecting…' : camera.stream ? 'Reconnect' : 'Retry / Enable camera'}</button>
        <button onClick={() => void capture.refresh()}>Refresh cameras</button>
        <button disabled={!camera.stream && !camera.busy} onClick={() => setEnabled(false)}>Stop camera</button>
      </div>
      <label><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />Show overlay</label>
      <p role="status">{camera.status}</p>
      <small>{camoAvailable ? 'Camo is available. Choose Camo Camera above to show your iPhone feed.' : labelsAvailable ? 'Camo Camera is not listed. Keep Camo Studio running with your iPhone feed, then refresh cameras. You can use another listed camera or leave capture off.' : 'Enable Camera and allow camera access to reveal device names, then choose Camo Camera. Keep Camo Studio running with your iPhone feed.'}</small>
      <small>Drag the overlay header; resize from its corner. Hide the overlay here while capture stays live. Turn off Enable Camera to release it. Microphone capture is off.</small>
    </details>
    <section className="camera-overlay" aria-label="Live camera overlay" hidden={!visible} style={{ left: frame.x, top: frame.y, width: frame.width }}>
      <video ref={video} autoPlay muted playsInline disablePictureInPicture aria-label={sourceName} />
      {!camera.stream && <div className="camera-placeholder" role="status">{camera.status}<button disabled={!navigator.mediaDevices || camera.busy} onClick={() => setEnabled(true)}>Retry / Enable camera</button></div>}
      <button className="camera-drag" aria-label="Move camera overlay" onPointerDown={event => begin(event, false)} {...pointerProps}><i />{camera.stream ? 'LIVE' : 'CAMERA'}<span title={sourceName}>{camera.stream ? sourceName : 'MR. PINK'}</span></button>
      <button className="camera-hide" aria-label="Hide camera overlay" onClick={() => setVisible(false)}>×</button>
      {camera.stream && playbackError && <div className="camera-playback-error" role="status">Preview paused.<button onClick={playPreview}>Resume video</button></div>}
      {camera.stream && camera.status !== 'Live · microphone off' && <div className="camera-feed-status" role="status">{camera.status}</div>}
      <button className="camera-resize" aria-label="Resize camera overlay" onPointerDown={event => begin(event, true)} {...pointerProps}>◢</button>
    </section>
  </>, host);
}
