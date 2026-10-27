/** Visual choreography only: all positions are zero-based score beats from the existing transport. */
export type HwmVinylTimeline = { getBeat: () => number; beat: number; playing: boolean };
export type HwmVisualFrame = {
  beat: number; mix: number; artworkMix: number; titleMix: number; buildup: number;
  drop: boolean; bassPulse: number; dropFlash: number; dropWave: number; labelWave: number;
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function rosesHwmVisuals(scoreBeat: number): HwmVisualFrame {
  const beat = Number.isFinite(scoreBeat) ? Math.max(0, scoreBeat) : 0;
  const buildup = clamp((beat - 112) / 32), drop = beat >= 144 && beat < 176;
  const dropAge = beat - 144, labelAge = beat - 120;
  const fraction = beat - Math.floor(beat);
  return {
    beat, mix: smooth(buildup), artworkMix: smooth((beat - 112) / 24), titleMix: smooth((beat - 116) / 12), buildup, drop,
    bassPulse: drop ? Math.exp(-fraction * 7) * (Math.floor(beat) % 2 === 0 ? 1 : .62) : 0,
    dropFlash: drop && dropAge < .65 ? (1 - dropAge / .65) ** 3 : 0,
    dropWave: drop && dropAge < 3 ? dropAge / 3 : -1,
    labelWave: labelAge >= 0 && labelAge < 3 ? labelAge / 3 : -1,
  };
}

/** Crop the supplied 600px cover around the helmet, excluding its top/bottom lettering. */
export function helmetCrop(width: number, height: number) {
  const size = Math.min(width, height) * (2 / 3);
  return { x: Math.max(0, Math.min(width - size, width * (29 / 60) - size / 2)), y: Math.max(0, Math.min(height - size, height * (61 / 120) - size / 2)), size };
}
const blend = (from: string, to: string, t: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(from.slice(i, i + 2), 16) * (1 - t) + parseInt(to.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
// Precompute a small palette table; the frame loop performs no color parsing or path creation.
const palettes = Array.from({ length: 65 }, (_, i) => {
  const t = i / 64;
  return {
    pink: blend('#f077ce', '#287bff', t), pale: blend('#ffb0dc', '#f3fcff', t),
    cyan: blend('#63edff', '#55dfff', t), violet: blend('#a9b9ff', '#b99aff', t),
    petal: blend('#e775b6', '#46cbff', t), spark: blend('#ffc5ed', '#ecfaff', t),
    spectra: ['#edb6ff', '#59edff', '#ff73d6', '#edb6ff'].map((color, index) => blend(color, ['#d7f6ff', '#59ddff', '#4b83ff', '#f4fbff'][index], t)),
  };
});
export const hwmVinylPalette = (mix: number) => palettes[Math.round(clamp(mix) * 64)];
