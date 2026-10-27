import { Component, type ReactNode } from 'react';

type Props = { feature: 'performance' | 'camera'; children: ReactNode };
export default class StartupBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(`Mr. Pink ${this.props.feature} error:`, error); }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.feature === 'camera') return <aside className="camera-failure" role="status">
      <span>Camera unavailable. Your performance can continue.</span>
      <button onClick={() => this.setState({ error: null })}>Retry camera</button>
    </aside>;
    return <section className="startup-screen" role="alert">
      <div><p className="startup-brand">MR. PINK</p><h1>The performance could not start.</h1>
        <p>Reload to try again. Your saved settings have not been cleared.</p>
        <details><summary>Error details</summary><pre>{this.state.error.stack || this.state.error.message}</pre></details>
        <button onClick={() => window.location.reload()}>Reload Mr. Pink</button>
      </div>
    </section>;
  }
}
