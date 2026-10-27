/** One source of geometry for the live galaxy and both cinematic handoffs. */
export function cosmicGalaxyGeometry(width: number, height: number) {
  return { x: width * .8, y: height * .49, radius: Math.min(width * .29, height * .64) };
}
