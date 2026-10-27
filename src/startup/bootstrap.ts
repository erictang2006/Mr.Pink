export type StartupSteps<T> = {
  initialize: () => Promise<void>;
  load: () => Promise<T>;
  mount: (application: T) => void;
  onStatus: (status: string) => void;
  onFailure: (error: unknown) => void;
};

export async function bootstrap<T>(steps: StartupSteps<T>): Promise<void> {
  try {
    steps.onStatus('Loading your settings…');
    await steps.initialize();
    // App reads preferences at module scope, so import only after hydration.
    steps.onStatus('Loading the performance…');
    const application = await steps.load();
    steps.mount(application);
  } catch (error) {
    steps.onFailure(error);
  }
}

export function showStartupFailure(error: unknown): void {
  console.error('Mr. Pink could not start:', error);
  const status = document.getElementById('startup-status');
  if (status) status.textContent = 'Mr. Pink could not start. Reload to try again. Your saved settings have not been cleared.';
  const details = document.getElementById('startup-error');
  if (details) { details.hidden = false; details.textContent = error instanceof Error ? error.message : 'The application could not finish loading.'; }
}
