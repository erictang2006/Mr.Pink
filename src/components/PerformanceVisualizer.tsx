import { useEffect, useRef } from "react";
import { pianoGeometry, pianoRange } from "../piano/geometry";
import { type LiveNotes } from "../piano/liveNotes";
import { type KeyboardMap } from "../piano/noteMapping";

export type Theme = "rush" | "cosmic" | "minimal";
type Props = {
  notes: LiveNotes;
  map: KeyboardMap;
  transpose: number;
  theme: Theme;
  notesPerSecond: number;
};
const colors: Record<Theme, string[]> = {
  rush: ["#61f4ef", "#f664d2", "#538cff", "#a987ff"],
  cosmic: ["#90bfff", "#b4a9ff", "#e4ebff", "#6bd2ea"],
  minimal: ["#e7f0f2", "#66d8d1"],
};

export default function PerformanceVisualizer({
  notes,
  map,
  transpose,
  theme,
  notesPerSecond,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const values = useRef({ transpose, theme, notesPerSecond, map });
  values.current = { transpose, theme, notesPerSecond, map };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let frame = 0;
    let width = 0;
    let height = 0;
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
      const { transpose, theme, notesPerSecond, map } = values.current;
      const travelMs = 4400;
      const speed = height / travelMs;
      const range = pianoRange(map.bindings);
      const geometry = pianoGeometry(width, transpose, range.low, range.high);
      ctx.fillStyle = theme === "cosmic" ? "#070c19" : "#05070b";
      ctx.fillRect(0, 0, width, height);
      if (theme === "cosmic") {
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
      for (const note of notes.visible(now, travelMs)) {
        const key = geometry.keys.get(note.midi);
        if (!key) continue;
        const top = height - (now - note.startMs) * speed;
        const bottom =
          note.endMs === null ? height : height - (now - note.endMs) * speed;
        if (bottom <= 0) continue;
        const barHeight = Math.max(5, bottom - top);
        const inset = key.black ? 2 : Math.max(2, key.width * 0.12);
        const x = key.x + inset;
        const w = Math.max(2, key.width - inset * 2);
        const color =
          palette[
            ((note.midi % palette.length) + palette.length) % palette.length
          ];
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = theme === "minimal" ? 0 : theme === "rush" ? 13 : 8;
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, theme === "minimal" ? color : `${color}99`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, top, w, barHeight, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffffaa";
        ctx.fillRect(x + 1, Math.max(0, top), Math.max(1, w - 2), 2);
        if (note.endMs === null && theme !== "minimal") {
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
