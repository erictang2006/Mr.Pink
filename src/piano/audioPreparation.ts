/** Share asset preparation across enable clicks and song switches. Failed loads
 * can retry; an old rejection must never clear a newer request after reset. */
export class DeferredAudioPreparation {
  private pending?: Promise<void>;
  prepare(load: () => Promise<unknown>): Promise<void> {
    if (!this.pending) {
      const request = Promise.resolve().then(load).then(() => {});
      this.pending = request;
      void request.catch(() => { if (this.pending === request) this.pending = undefined; });
    }
    return this.pending;
  }
  reset(): void { this.pending = undefined; }
}
