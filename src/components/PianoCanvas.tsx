import { useEffect, useRef } from "react";
import {
  labelForMidi,
  midiToName,
  type KeyboardMap,
} from "../piano/noteMapping";
import { pianoGeometry, pianoRange, isBlack } from "../piano/geometry";

type Props = {
  active: number[];
  map: KeyboardMap;
  transpose: number;
  showLabels?: boolean;
};

export default function PianoCanvas({
  active,
  map,
  transpose,
  showLabels = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;
      const range = pianoRange(map.bindings);
      const start = range.low + transpose;
      const end = range.high + transpose;
      const { whites, whiteWidth, blackWidth, keys } = pianoGeometry(
        width,
        transpose,
        range.low,
        range.high,
      );
      const blackHeight = height * 0.62;
      const activeSet = new Set(active);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0d111a";
      ctx.fillRect(0, 0, width, height);

      whites.forEach((midi, i) => {
        const x = i * whiteWidth;
        const pressed = activeSet.has(midi);
        const fill = ctx.createLinearGradient(0, 0, 0, height);
        fill.addColorStop(0, pressed ? "#7de7df" : "#f5f4f0");
        fill.addColorStop(1, pressed ? "#3aa8a5" : "#c9d0d4");
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x + 1, 2, whiteWidth - 2, height - 5, [3, 3, 7, 7]);
        ctx.fill();
        ctx.strokeStyle = pressed ? "#c5ffff" : "#85919b";
        ctx.lineWidth = 1;
        ctx.stroke();

        const label = labelForMidi(map, midi, transpose);
        if (showLabels && label) {
          ctx.textAlign = "center";
          ctx.fillStyle = pressed ? "#092e34" : "#3c4855";
          ctx.font = `700 ${Math.max(15, Math.min(23, whiteWidth * 0.55))}px Inter, system-ui, sans-serif`;
          ctx.fillText(label, x + whiteWidth / 2, height - 27, whiteWidth - 5);
        }
        if (
          showLabels &&
          label &&
          map.id !== "interstellar-roblox-aligned" &&
          midi % 12 === 0
        ) {
          ctx.textAlign = "center";
          ctx.fillStyle = pressed ? "#0b454a" : "#7a8994";
          ctx.font = "10px Inter, system-ui, sans-serif";
          ctx.fillText(midiToName(midi), x + whiteWidth / 2, height - 7);
        }
      });

      for (let midi = start; midi <= end; midi++) {
        if (!isBlack(midi)) continue;
        const key = keys.get(midi);
        if (!key) continue;
        const x = key.x;
        const pressed = activeSet.has(midi);
        const fill = ctx.createLinearGradient(0, 0, 0, blackHeight);
        fill.addColorStop(0, pressed ? "#7de7df" : "#323b49");
        fill.addColorStop(1, pressed ? "#1e8b91" : "#0b111b");
        ctx.fillStyle = "#090d14";
        ctx.beginPath();
        ctx.roundRect(x - 2, 0, blackWidth + 4, blackHeight + 3, [0, 0, 5, 5]);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x, 0, blackWidth, blackHeight, [0, 0, 4, 4]);
        ctx.fill();
        const label = labelForMidi(map, midi, transpose);
        if (showLabels && label) {
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
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [active, map, transpose, showLabels]);

  return (
    <canvas
      ref={ref}
      className="piano-canvas"
      role="img"
      aria-label={`Piano keyboard for ${map.name}, showing active notes${showLabels ? " and physical key labels" : ""}`}
    />
  );
}
