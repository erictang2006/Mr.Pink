# Subtle Mr Pink show palette — October 28

This is a reversible visual experiment requested by the user: add a little more pink across the show while retaining the established layout and each song's identity.

The performance root receives `mr-pink-show` when `mrPinkShowEnabled` is true. `src/theme/mrPinkShow.css` adds restrained rose/pearl accents to MR PINK branding, title rules, piano edge trim, live-key pills, selected instrument lighting, start/transition button borders, and finale branding. The authentic white Chrome error page and exact red CSA logo are untouched.

The typing follow-up uses subdued gray-blush upcoming letters (`#a99ca3`) and stronger, deeper pink correct letters (`#f08abc`). Upcoming text was softened after screenshot feedback; completed characters were subsequently made a richer pink at the user’s request on the initial test's unchanged gray background (`#323437`). Calculated WCAG solid-color contrast is 4.74:1 upcoming and 5.39:1 correct; the pale pink WPM counter (`#e4c0d2`) is 7.59:1. Errors remain distinct through amber text and an underline. The “I LOVE CSA” message uses brighter pink on navy, including during charge/glitch; the piano-text reveal uses pale pink with dark edging and pink fresh-letter/finishing glows. These replace existing color/glow animation names without changing their timing, input behavior, geometry, sounds or reduced-motion rules. The contrast calculations are not a claim of projector or moving-background visual verification.

`showColor(original,pink)` selects small existing canvas-palette substitutions in `performanceAtmosphere.ts`, `cosmicGalaxy.ts`, `cosmicObservatory.ts` and `cosmicStage.ts`. Levels retains its cyan plasma identity with a slightly warmer violet side. Interstellar remains mainly blue/cyan, with a subtle rose-violet cast in a minority of arm/dust details. Roses' existing cloud colors gain a small warm shift. Shared transition renderers inherit the same palettes, so the galaxy/record handoffs remain consistent.

The original 4–11% CSS keyboard overlay looked nearly neutral in the user's screenshot and is superseded. The performance piano now receives an explicit `blush` flag from the show-theme switch. Interstellar, Levels/Roses, and generic performance key renderers paint pale blush white-key gradients directly (`pianoBlush` in `mrPinkShow.ts`), with dark plum/charcoal black keys. Labels and physical-note lighting draw above the base colors and retain their prior contrast/behavior. The CSS overlay is removed. Practice/Sandbox default to the original palette. No extra drawing passes are added, and disabling the theme restores the previous performance colors.

No full-screen tint overlay, CSS color filter, additional canvas drawing passes, particles, animation loops, offscreen buffers or audio work were added. Physical mapping, musical timing, samples, settings, layouts and the finale's fade to black remain unchanged.

## Reverse this experiment

Set `mrPinkShowEnabled=false` in `src/theme/mrPinkShow.ts` and reload the app. That removes the skin's root class and makes the canvas helper return its original colors. This restores the preceding palette without touching unrelated work, reverting commits or clearing preferences.

## Verification

Build/TypeScript and 45 focused tests pass across performance presentation, stage energy, cosmic observatory rendering, Levels → Interstellar and Interstellar → Roses. These cover finite/bounded drawing, shared handoff geometry, cache behavior and preserved visual/input lifetimes. The palette itself still needs a graphical review; no screenshot or projector appearance verification is claimed. Work is local; nothing was deployed.

Typing follow-up verification: build/TypeScript and the focused opening-sequence tests pass; no new application logic or test-only implementation mirrors were added.

Visible-piano correction verification: build/TypeScript and 39 focused piano/presentation tests pass. A renderer regression confirms that both performance piano paths receive visible pink base colors with identical geometry, labels, pressed styling and drawing-pass counts. Screenshot/projector verification still requires an available browser.

## Exact white-key gradient refinement

Each performance white key now gets its own vertical gradient with the requested #FFF9FC top, #FCE6F0 at 50%, and #F3A7C8 bottom. The existing Interstellar, Levels/Roses and generic performance renderers apply it per key. Pressed white keys add #FF91C7 glow and a subtle #FFE2F0 highlight using the existing physical-hold/press animation paths. Existing black-key colors, borders, shadows, geometry, sizing and shortcut labels are preserved. Practice defaults and input/audio behavior are unchanged.

Build/TypeScript and 26 focused piano tests pass, including exact per-key gradient stops, unchanged black faces, pink pressed lighting, physical releases and mapping/geometry checks. The earlier 39-test result above predates this refinement. No graphical browser or projector verification is claimed.
