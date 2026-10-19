import * as Tone from "tone";
import { closerCuePlan, closerSource, defaultCloserSettings, validCloserSettings, type CloserStatus, type RosesCloserSettings } from "./rosesCloser";

/** An independent original-speed overlay; it never changes any Roses voice. */
export class RosesCloserEngine {
  private player: Tone.Player;
  private gain: Tone.Gain;
  private settings = { ...defaultCloserSettings };
  private status: CloserStatus = "LOADING";
  private ready = false;
  private failed = false;
  private disposed = false;
  private fired = false;
  private startedAt = 0;
  private sourceOffset = 0;

  constructor(output: Tone.ToneAudioNode, onChange: () => void) {
    this.gain = new Tone.Gain(this.settings.closerLevel).connect(output);
    this.player = new Tone.Player({
      url: closerSource.file, playbackRate: 1, fadeIn: .005, fadeOut: .02,
      onload: () => { if (this.disposed) return; this.ready = true; this.status = this.settings.enabled ? "WAITING" : "OFF"; onChange(); },
      onerror: () => { if (this.disposed) return; this.failed = true; this.status = "UNAVAILABLE"; onChange(); },
      onstop: () => { if (!this.disposed && this.fired && this.status === "PLAYING") { this.status = "FINISHED"; onChange(); } },
    }).connect(this.gain);
  }
  snapshot() { return { closerStatus: this.settings.enabled ? this.status : "OFF" as CloserStatus, closerReady: this.ready }; }
  configure(value: RosesCloserSettings): void {
    const previous = this.settings.enabled;
    this.settings = validCloserSettings(value);
    this.gain.gain.rampTo(this.settings.enabled ? this.settings.closerLevel : 0, this.settings.fadeSeconds);
    // During a chorus, A/B mutes only its bus so returning to the vocal stays in place.
    if (!this.settings.enabled && this.status !== "PLAYING" && this.status !== "PAUSED") this.status = "OFF";
    else if (this.settings.enabled && !previous && this.status === "OFF") this.reset();
  }
  reset(time = Tone.immediate()): void {
    this.fired = false; this.sourceOffset = 0;
    this.status = this.failed ? "UNAVAILABLE" : !this.ready ? "LOADING" : this.settings.enabled ? "WAITING" : "OFF";
    this.player.stop(time);
  }
  stop(time = Tone.immediate(), finished = false): void {
    this.fired = true;
    this.status = finished ? "FINISHED" : "STOPPED";
    this.player.stop(time);
  }
  /** The vocal continues naturally after the Roses section boundary. */
  finishSection(time: number): void {
    if (this.status !== "PLAYING" && this.status !== "PAUSED") this.stop(time, true);
  }
  tick(scoreBeat: number, time: number, secondsPerBeat: number): void {
    if (!this.settings.enabled || !this.ready || this.fired) return;
    const plan = closerCuePlan(this.settings, secondsPerBeat);
    if (scoreBeat > plan.onsetBeat + 1e-7) { this.status = "MISSED"; this.fired = true; return; }
    if (plan.startBeat >= scoreBeat + .25 - 1e-7) return;
    // If a section starts exactly on the target, omit only the preceding pickup.
    this.sourceOffset = Math.max(0, (scoreBeat - plan.startBeat) * secondsPerBeat);
    this.startedAt = time + Math.max(0, (plan.startBeat - scoreBeat) * secondsPerBeat);
    this.player.start(this.startedAt, this.sourceOffset);
    this.status = "PLAYING"; this.fired = true;
  }
  pause(time = Tone.immediate()): void {
    if (this.status !== "PLAYING") return;
    this.sourceOffset += Math.max(0, time - this.startedAt);
    this.status = "PAUSED"; this.player.stop(time);
  }
  resume(time: number): void {
    if (this.status !== "PAUSED") return;
    this.startedAt = time; this.player.start(time, this.sourceOffset); this.status = "PLAYING";
  }
  dispose(): void { this.disposed = true; this.player.dispose(); this.gain.dispose(); }
}
