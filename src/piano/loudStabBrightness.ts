/** Recorded hits already contain their bright tone. The default is neutral;
 * the shared Brightness knob adds/removes upper harmonics without replacing it.
 */
export function loudStabBrightnessDb(brightness: number): number {
  const value = Math.max(650, Math.min(4000, Number.isFinite(brightness) ? brightness : 2800));
  return Math.max(-12, Math.min(6, 6 * Math.log(value / 2800) / Math.log(4000 / 2800)));
}
