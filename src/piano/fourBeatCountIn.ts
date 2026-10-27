export type CountInHandle = { promise: Promise<'complete' | 'cancelled'>; cancel: () => void };

/** Four silent visual beats, then resolve at the following downbeat. */
export function fourBeatCountIn(
  beatMs: number,
  onBeat: (beat: number) => void,
  clock: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis,
  startLeadMs = 0,
): CountInHandle {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let finish: (result: 'complete' | 'cancelled') => void = () => {};
  let settled = false;
  const complete = (result: 'complete' | 'cancelled') => {
    if (settled) return;
    settled = true;
    for (const timer of timers) clock.clearTimeout(timer);
    finish(result);
  };
  const promise = new Promise<'complete' | 'cancelled'>(resolve => { finish = resolve; });
  onBeat(1);
  for (let beat = 2; beat <= 4; beat++) timers.push(clock.setTimeout(() => onBeat(beat), beatMs * (beat - 1)));
  // The caller can prepare a scheduled audio start just before beat five.
  timers.push(clock.setTimeout(() => complete('complete'), Math.max(beatMs * 3, beatMs * 4 - startLeadMs)));
  return { promise, cancel: () => complete('cancelled') };
}
