import ReactDOM from 'react-dom/client';
import { useEffect } from 'react';
import CameraFeature from './camera/CameraFeature';
import './styles.css';
import { initializeSettings, startSettingsSync } from './settings/sharedSettings';
import { bootstrap, showStartupFailure } from './startup/bootstrap';
import StartupBoundary from './startup/StartupBoundary';

function SettingsSync() {
  // Save only after the performance successfully commits; stop if it fails later.
  useEffect(startSettingsSync, []);
  return null;
}

void bootstrap({
  initialize: initializeSettings,
  load: () => import('./App'),
  onStatus: message => {
    const status = document.getElementById('startup-status');
    if (status) status.textContent = message;
  },
  onFailure: showStartupFailure,
  mount: ({ default: App }) => {
    const container = document.getElementById('root');
    if (!container) throw new Error('The application container is missing.');
    const root = ReactDOM.createRoot(container);
    root.render(<>
      <StartupBoundary feature="performance"><App /><SettingsSync /></StartupBoundary>
      <StartupBoundary feature="camera"><CameraFeature /></StartupBoundary>
    </>);
    import.meta.hot?.dispose(() => root.unmount());
  },
});
