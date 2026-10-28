/** One reversible switch for the restrained show-wide pink accent experiment. */
export const mrPinkShowEnabled=true;
export const showColor=(original:string,pink:string)=>mrPinkShowEnabled?pink:original;
/** Painted into key faces, below labels and physical-note illumination. */
export const pianoBlush={
  whiteTop:'#FFF9FC',whiteBody:'#FCE6F0',whiteDepth:'#F3A7C8',
  pressGlow:'#FF91C7',pressHighlight:'#FFE2F0',
  mutedTop:'#ddcbd6',mutedBottom:'#ceb5c5',blackTop:'#302638',blackBottom:'#120f1b',
} as const;
