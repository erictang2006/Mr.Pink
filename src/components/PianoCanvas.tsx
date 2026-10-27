import { StarlightKeys } from './starlight';
import type { LiveNotes } from '../piano/liveNotes';
import { drawInterstellarPiano } from './interstellarPiano';
import { memo, useEffect, useRef, useState } from "react";
import {
  labelForMidi,
  midiToName,
  type KeyboardMap,
} from "../piano/noteMapping";
import { PianoGeometryCache } from '../piano/pianoGeometryCache';
import type { StageKeyGuide, StagePresentation } from "../piano/performancePresentation";
import { drawPerformancePiano } from "./performancePiano";

type Props = {
  active: number[];
  automatic?: number[];
  expected?: number[];
  wrong?: number[];
  completed?: number[];
  map: KeyboardMap;
  transpose: number;
  showLabels?: boolean;
  showKeyLabels?: boolean;
  labelMode?: "computer" | "piano" | "both" | "none";
  practicePalette?: boolean;
  preferredLabels?: Record<number, string>;
  range?: { low: number; high: number };
  presentation?: StagePresentation;
  keyGuide?: StageKeyGuide;
  pressedCodes?: string[];
  coolLighting?: boolean;
  cinematicLighting?: boolean;
  prominentPitches?: Set<number>;
  pressedKeys?: { code: string; midi: number }[];
  starlightNotes?: LiveNotes;
};

function PianoCanvas({
  active,
  automatic = [],
  expected = [],
  wrong = [],
  completed = [],
  map,
  transpose,
  showLabels = false,
  showKeyLabels = true,
  labelMode,
  practicePalette = false,
  preferredLabels = {},
  range: rangeOverride,
  presentation,
  keyGuide = {},
  pressedCodes = [],
  coolLighting = false,
  cinematicLighting = false,
  prominentPitches,
  pressedKeys,
  starlightNotes,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hoverStart = useRef(0);
  const starlightKeys = useRef(new StarlightKeys());
  const geometryCache = useRef<PianoGeometryCache | null>(null);
  if (!geometryCache.current) geometryCache.current = new PianoGeometryCache();
  const [hovered, setHovered] = useState<number | undefined>();

  useEffect(() => () => starlightKeys.current.clear(), [presentation]);

  useEffect(() => {
    const canvas = ref.current!;
    let hoverFrame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      cancelAnimationFrame(hoverFrame);
      const hoverProgress = reducedMotion ? 1 : Math.min(1, (performance.now() - hoverStart.current) / 90);
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, cinematicLighting ? 1.5 : 2);
      const pixelWidth = Math.round(rect.width * dpr), pixelHeight = Math.round(rect.height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      const { whites, whiteWidth, blackWidth, keys } = geometryCache.current!.get(map, width, transpose, rangeOverride, presentation);
      const blackHeight = height * 0.62;
      const activeSet = new Set(active);
      const automaticMarkers=()=>{
        ctx.save();ctx.strokeStyle="#66d9ef99";ctx.lineWidth=1.2;ctx.fillStyle="#66d9ef66";
        for(const midi of new Set(automatic)){const key=keys.get(midi);if(!key||activeSet.has(midi))continue;const y=(key.black?height*.62:height)-12;ctx.fillRect(key.x+key.width*.25,y,key.width*.5,2);}
        ctx.restore();
      };
      if (presentation === "interstellar") {
        const now = performance.now();
        const lights = starlightKeys.current.update(activeSet, new Set(starlightNotes?.soundingPitches() ?? []), now, reducedMotion);
        const depths = new Map([...lights].map(([midi, light]) => [midi, light.depth]));
        drawInterstellarPiano(ctx, width, height, { whites, whiteWidth, blackWidth, keys }, keyGuide, activeSet, new Set(pressedCodes), depths, hovered, hoverProgress, prominentPitches, pressedKeys, lights);
        if (starlightKeys.current.needsFrame || (hovered !== undefined && hoverProgress < 1)) hoverFrame = requestAnimationFrame(draw);
        return;
      }
      if (presentation) {
        // `active` comes only from currently held physical input, never audio sustain.
        drawPerformancePiano(ctx, width, height, { whites, whiteWidth, blackWidth, keys }, keyGuide, activeSet, new Set(pressedCodes), presentation, hovered, new Set(expected), new Set(wrong), coolLighting, hoverProgress, showKeyLabels, cinematicLighting);
        automaticMarkers();
        if (hovered !== undefined && hoverProgress < 1) hoverFrame = requestAnimationFrame(draw);
        return;
      }
      const expectedSet = new Set(expected);
      const wrongSet = new Set(wrong);
      const completedSet = new Set(completed);
      const mode = labelMode ?? (showLabels ? "computer" : "none");
      const interstellarKeys = map.id === "interstellar-roblox-aligned" || map.id === "interstellar-assisted-9-13";
      const keyColors = (midi: number, black: boolean): [string, string] => {
        if (wrongSet.has(midi)) return ["#fb7886", "#bc3349"];
        if (activeSet.has(midi)) return practicePalette ? ["#d7a3ff", "#8a54c7"] : ["#7de7df", black ? "#1e8b91" : "#3aa8a5"];
        if (completedSet.has(midi)) return ["#a0e9ba", "#48a773"];
        if (expectedSet.has(midi)) return ["#9bf4ff", "#3aafc0"];
        return black ? ["#323b49", "#0b111b"] : ["#f5f4f0", "#c9d0d4"];
      };

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0d111a";
      ctx.fillRect(0, 0, width, height);

      whites.forEach((midi, i) => {
        const x = i * whiteWidth;
        const pressed = activeSet.has(midi);
        const [top, bottom] = keyColors(midi, false);
        const fill = ctx.createLinearGradient(0, 0, 0, height);
        fill.addColorStop(0, top);
        fill.addColorStop(1, bottom);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x + 1, 2, whiteWidth - 2, height - 5, [3, 3, 7, 7]);
        ctx.fill();
        ctx.strokeStyle = pressed ? "#c5ffff" : "#85919b";
        ctx.lineWidth = 1;
        ctx.stroke();

        const computer = preferredLabels[midi] ?? labelForMidi(map, midi, transpose);
        const displayComputer = computer;
        const label = mode === "piano" ? midiToName(midi) : mode === "both" ? `${displayComputer} · ${midiToName(midi)}` : displayComputer;
        const visibleLabel = mode === "none" && interstellarKeys && midi === 88 + transpose ? "E6" : mode === "none" ? "" : label;
        if (visibleLabel) {
          ctx.textAlign = "center";
          ctx.fillStyle = pressed ? "#092e34" : "#3c4855";
          ctx.font = `700 ${Math.max(15, Math.min(23, whiteWidth * 0.55))}px Inter, system-ui, sans-serif`;
          ctx.fillText(visibleLabel, x + whiteWidth / 2, height - 27, whiteWidth - 5);
        }
        if (
          mode === "computer" &&
          computer &&
          map.id !== "interstellar-roblox-aligned" &&
          map.id !== "interstellar-assisted-9-13" &&
          (midi % 12 === 0 || map.displayPitchOffset !== undefined)
        ) {
          ctx.textAlign = "center";
          ctx.fillStyle = pressed ? "#0b454a" : "#7a8994";
          ctx.font = "10px Inter, system-ui, sans-serif";
          ctx.fillText(midiToName(midi), x + whiteWidth / 2, height - 7);
        }
      });

      for (const [midi, key] of keys) {
        if (!key.black) continue;
        const x = key.x;
        const pressed = activeSet.has(midi);
        const [top, bottom] = keyColors(midi, true);
        const fill = ctx.createLinearGradient(0, 0, 0, blackHeight);
        fill.addColorStop(0, top);
        fill.addColorStop(1, bottom);
        ctx.fillStyle = "#090d14";
        ctx.beginPath();
        ctx.roundRect(x - 2, 0, blackWidth + 4, blackHeight + 3, [0, 0, 5, 5]);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x, 0, blackWidth, blackHeight, [0, 0, 4, 4]);
        ctx.fill();
        const computer = preferredLabels[midi] ?? labelForMidi(map, midi, transpose);
        const displayComputer = computer;
        const label = mode === "piano" ? midiToName(midi) : mode === "both" ? `${displayComputer}·${midiToName(midi)}` : displayComputer;
        if (mode !== "none" && label) {
          ctx.textAlign = "center";
          ctx.fillStyle = pressed ? "#09343b" : "#d5e0e5";
          ctx.font = `700 ${Math.max(12, Math.min(18, blackWidth * 0.58))}px Inter, system-ui, sans-serif`;
          ctx.fillText(
            label,
            x + blackWidth / 2,
            blackHeight - 19,
            blackWidth - 3,
          );
        }
        if (mode === "computer" && computer && map.displayPitchOffset !== undefined) {
          ctx.fillStyle = "#9bb2bc"; ctx.font = "9px Inter, system-ui, sans-serif";
          ctx.fillText(midiToName(midi), x + blackWidth / 2, blackHeight - 5, blackWidth - 3);
        }
      }
      if (interstellarKeys) {
        const c6 = keys.get(84 + transpose);
        const c7 = keys.get(96 + transpose);
        if (c6 && c7) {
          const span = c7.x + c7.width - c6.x;
          ctx.fillStyle = "#081a23d9";
          ctx.fillRect(c6.x, 0, span, 20);
          ctx.fillStyle = "#6ddfe8";
          ctx.fillRect(c6.x + 2, 0, span - 4, 3);
          ctx.fillStyle = "#8beaf1";
          ctx.font = "700 10px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("C6–C7 UPPER OCTAVE", c6.x + span / 2, 16, span - 8);
        }
      }
      automaticMarkers();
    };
    // Paint at most once per frame, after rapid input has settled. Audio never waits here.
    const scheduleDraw = () => { cancelAnimationFrame(hoverFrame); hoverFrame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(canvas);
    scheduleDraw();
    return () => { observer.disconnect(); cancelAnimationFrame(hoverFrame); };
  }, [active, automatic, expected, wrong, completed, map, transpose, showLabels, showKeyLabels, labelMode, practicePalette, preferredLabels, rangeOverride, presentation, keyGuide, pressedCodes, hovered, coolLighting, cinematicLighting, prominentPitches, pressedKeys, starlightNotes]);

  return (
    <canvas
      ref={ref}
      className="piano-canvas"
      onPointerLeave={() => setHovered(undefined)}
      onPointerMove={event => {
        if (!presentation) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const { keys } = geometryCache.current!.get(map, rect.width, transpose, rangeOverride, presentation);
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        const entries = [...keys];
        const key = entries.find(([, key]) => key.black && y <= rect.height * (presentation === "interstellar" ? .63 : .62) && x >= key.x && x <= key.x + key.width)
          ?? entries.find(([, key]) => !key.black && x >= key.x && x <= key.x + key.width);
        if (key?.[0] !== hovered) { hoverStart.current = performance.now(); setHovered(key?.[0]); }
      }}
      role="img"
      aria-label={`Piano keyboard for ${map.name}, showing active notes${showKeyLabels && (showLabels || presentation) ? " and physical key labels" : ""}`}
    />
  );
}

/** Ignore fresh array wrappers from unrelated clock updates, never changed notes.
 * Interstellar's mutable sustain lighting continues to receive parent updates. */
export function samePianoFrame(previous: Props, next: Props): boolean {
  if (previous.starlightNotes || next.starlightNotes) return false;
  const arrays = ['active', 'automatic', 'expected', 'wrong', 'completed', 'pressedCodes'] as const;
  for (const key of arrays) {
    const a = previous[key] ?? [], b = next[key] ?? [];
    if (a.length !== b.length || a.some((value, index) => value !== b[index])) return false;
  }
  if (previous.range?.low !== next.range?.low || previous.range?.high !== next.range?.high) return false;
  const a = previous.pressedKeys ?? [], b = next.pressedKeys ?? [];
  if (a.length !== b.length || a.some((key, index) => key.code !== b[index].code || key.midi !== b[index].midi)) return false;
  if (previous.prominentPitches !== next.prominentPitches) {
    if (!previous.prominentPitches || !next.prominentPitches || previous.prominentPitches.size !== next.prominentPitches.size || [...previous.prominentPitches].some(pitch => !next.prominentPitches!.has(pitch))) return false;
  }
  const compared = new Set<string>([...arrays, 'range', 'pressedKeys', 'prominentPitches']);
  return (Object.keys({ ...previous, ...next }) as (keyof Props)[]).every(key => compared.has(key) || Object.is(previous[key], next[key]));
}

export default memo(PianoCanvas, samePianoFrame);
