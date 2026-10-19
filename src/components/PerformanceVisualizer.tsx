import { useEffect, useRef } from "react";
import { pianoGeometry, pianoRange } from "../piano/geometry";
import { type LiveNotes } from "../piano/liveNotes";
import { type KeyboardMap } from "../piano/noteMapping";
import { physicalNoteBar, stageNoteColor, type StageKeyGuide, type StagePresentation } from "../piano/performancePresentation";
import { drawCosmicScene, drawLevelsScene } from "./performanceAtmosphere";
import { LevelsOrb, orbDirection } from "./levelsOrb";

export type Theme = "rush" | "cosmic" | "minimal" | "roses" | "levels";
type Props = {
  notes: LiveNotes;
  map: KeyboardMap;
  transpose: number;
  theme: Theme;
  notesPerSecond: number;
  showAssisted?: boolean;
  range?: { low: number; high: number };
  presentation?: StagePresentation;
  keyGuide?: StageKeyGuide;
};
const colors: Record<Theme, string[]> = {
  rush: ["#61f4ef", "#f664d2", "#538cff", "#a987ff"],
  cosmic: ["#90bfff", "#b4a9ff", "#e4ebff", "#6bd2ea"],
  minimal: ["#e7f0f2", "#66d8d1"],
  roses: ["#f59bcc", "#d891f2", "#b99bff", "#eb87b6"],
  levels: ["#46e8ee", "#cf83ff"],
};

export default function PerformanceVisualizer({
  notes,
  map,
  transpose,
  theme,
  notesPerSecond,
  showAssisted = false,
  range,
  presentation,
  keyGuide = {},
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const values = useRef({ transpose, theme, notesPerSecond, map, showAssisted, range, presentation, keyGuide });
  values.current = { transpose, theme, notesPerSecond, map, showAssisted, range, presentation, keyGuide };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastSeenId = 0;
    let previousFrame = performance.now();
    let energy = 0;
    const orb = new LevelsOrb();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const draw = () => {
      const now = performance.now();
      const { transpose, theme, notesPerSecond, map, showAssisted, range, presentation, keyGuide } = values.current;
      const travelMs = 4400;
      const visibleRange = range ?? pianoRange(map.bindings);
      const geometry = pianoGeometry(width, transpose, visibleRange.low, visibleRange.high);
      const visibleNotes = notes.visible(now, travelMs);
      const attacks = visibleNotes.filter(note => note.id > lastSeenId && now - note.startMs < 100);
      for (const note of visibleNotes) lastSeenId = Math.max(lastSeenId, note.id);
      const elapsed = now - previousFrame;
      energy *= Math.exp(-Math.min(100, elapsed) / 320);
      previousFrame = now;
      if (presentation === "levels" && attacks.length) {
        const strength = Math.min(1.5, .25 + attacks.length * .13);
        energy = Math.min(2, energy + strength);
        const pitches = Object.keys(keyGuide).map(Number);
        const low = pitches.length ? Math.min(...pitches) : 36;
        const high = pitches.length ? Math.max(...pitches) : 84;
        // Computer keys carry no velocity: chord size and recent hit density drive intensity.
        const force = Math.min(1.8, .4 + Math.sqrt(attacks.length) * .25 + energy * .35);
        for (const note of attacks.slice(0, 16)) {
          const sharpness = Math.min(1, .25 + attacks.length * .065 + energy * .16 + (note.id % 3 === 0 ? .25 : 0));
          orb.impulse(orbDirection(note.midi, note.id, low, high), force, sharpness);
        }
      }
      orb.update(elapsed);
      if (presentation === "interstellar") drawCosmicScene(ctx, width, height, now, reducedMotion);
      else if (presentation === "levels") drawLevelsScene(ctx, width, height, now, energy, reducedMotion, orb);
      else {
        ctx.fillStyle = theme === "cosmic" ? "#070c19" : theme === "roses" ? "#100b18" : "#05070b";
        ctx.fillRect(0, 0, width, height);
      }
      if (theme === "cosmic" && !presentation) {
        ctx.fillStyle = "#d4e4ff";
        for (let i = 0; i < 75; i++) {
          const x = ((i * 97.13) % 1) * width;
          const y = ((i * 53.71) % 1) * height;
          ctx.globalAlpha = 0.12 + ((i * 13) % 7) * 0.045;
          ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }
      const palette = colors[theme];
      for (const note of visibleNotes) {
        if (note.assisted && !showAssisted) continue;
        const key = geometry.keys.get(note.midi);
        if (!key) continue;
        const { top, bottom, height: barHeight, held } = physicalNoteBar(note, now, height, travelMs);
        if (bottom <= 0) continue;
        const inset = key.black ? 2 : Math.max(2, key.width * 0.12);
        const x = key.x + inset;
        const w = Math.max(2, key.width - inset * 2);
        const color = presentation ? (presentation === "interstellar" && note.assisted ? "#cfbd94" : stageNoteColor(presentation, note.midi, note.code, keyGuide)) : note.assisted ? "#d8ad65" : palette[
            ((note.midi % palette.length) + palette.length) % palette.length
          ];
        ctx.save();
        if (note.assisted && presentation !== "levels") ctx.globalAlpha = 0.5;
        else if (note.octave) ctx.globalAlpha = 0.58;
        if (presentation && !held) ctx.globalAlpha *= .78;
        ctx.shadowColor = color;
        ctx.shadowBlur = presentation && !held ? 2 : presentation === "levels" ? 14 : presentation === "interstellar" ? 10 : theme === "minimal" ? 0 : theme === "rush" ? 13 : theme === "roses" ? 5 : 8;
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, theme === "minimal" ? color : `${color}99`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, top, w, barHeight, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (presentation) {
          ctx.strokeStyle = `${color}99`; ctx.lineWidth = .7;
          ctx.stroke();
        }
        ctx.fillStyle = "#ffffffaa";
        ctx.fillRect(x + 1, Math.max(0, top), Math.max(1, w - 2), 2);
        if (held && theme !== "minimal") {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x - 2, height - 3, w + 4, 3);
        }
        ctx.restore();
      }
      if (theme === "rush" && notesPerSecond >= 12) {
        ctx.fillStyle = `rgba(120,220,255,${Math.min(0.035, (notesPerSecond - 11) * 0.002)})`;
        ctx.fillRect(0, 0, width, height);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [notes]);

  return (
    <canvas
      className="visualizer-canvas"
      ref={canvasRef}
      aria-label="Live notes rising from the piano"
      role="img"
    />
  );
}
