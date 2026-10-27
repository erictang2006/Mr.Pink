import * as Tone from 'tone';

/** Initialize voice parameters at audio time, then assign pitch before attack. */
export class PitchFirstSynth extends Tone.Synth {
  constructor(options?: Omit<NonNullable<ConstructorParameters<typeof Tone.Synth>[0]>, 'context'> & { context?: ReturnType<typeof Tone.getContext> }) {
    const context = options?.context ?? Tone.getContext();
    let initializing = true;
    const boundMethods = new Map<PropertyKey, unknown>();
    // Give only this voice an immediate clock during construction. Changing
    // the shared Context.lookAhead also posts ticker-interval changes to its
    // worker on every cold note, disturbing the rest of the running show.
    const voiceContext = new Proxy(context, {
      get(target, key) {
        if (key === 'now') return voiceNow;
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        if (!boundMethods.has(key)) boundMethods.set(key, value.bind(target));
        return boundMethods.get(key);
      },
    });
    const voiceNow = () => initializing ? context.immediate() : context.now();
    try {
      // FatOscillator.spread assigns each child's detune via Signal.value,
      // which uses context.now(). With scheduler look-ahead this leaves new
      // voices at zero spread for 100–200 ms. The opposite-phase saws then
      // cancel their fundamental and emphasize the octave. Construction is
      // synchronous: apply initial values now, then use the regular clock.
      super({ ...options, context: voiceContext });
    } finally {
      initializing = false;
    }
  }

  override triggerAttack(
    note: Parameters<Tone.Synth['triggerAttack']>[0],
    time?: Parameters<Tone.Synth['triggerAttack']>[1],
    velocity = 1,
  ): this {
    const at = this.toSeconds(time);
    this.setNote(note, at);
    this._triggerEnvelopeAttack(at, velocity);
    return this;
  }
}
