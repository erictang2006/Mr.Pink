import { useSyncExternalStore } from 'react';
import { exportSettings, saveSharedSettings, settingsStatus, subscribeSettings } from './sharedSettings';
export default function SharedSettingsPanel() {
  const status = useSyncExternalStore(subscribeSettings, settingsStatus);
  return <section className="shared-settings-panel" aria-label="Settings across laptops">
    <strong>Settings across laptops</strong>
    <p role="status">{status}</p>
    <div className="camera-actions">
      {import.meta.env.DEV && <button onClick={() => void saveSharedSettings()}>Save now</button>}
      <button onClick={exportSettings}>Export settings</button>
    </div>
    <small>Commit and push public/shared-settings.json, then pull and reload on the other laptop. Camera devices, hardware calibration, and imported audio files stay local.</small>
  </section>;
}
