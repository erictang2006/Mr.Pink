import { useEffect, useRef } from "react";
import {
  labelForMidi,
  midiToName,
  type KeyboardMap,
} from "../piano/noteMapping";
import { pianoGeometry, pianoRange, isBlack } from "../piano/geometry";

type Props = {
  active: number[];
  expected?: number[];
  wrong?: number[];
  completed?: number[];
  map: KeyboardMap;
  transpose: number;
  showLabels?: boolean;
  labelMode?: "computer" | "piano" | "both" | "none";
  practicePalette?: boolean;
  preferredLabels?: Record<number, string>;
};

export default function PianoCanvas({
  active,
  expected = [],
  wrong = [],
  completed = [],
  map,
  transpose,
  showLabels = false,
  labelMode,
  practicePalette = false,
  preferredLabels = {},
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
        const displayComputer = computer || (midi > range.high - 12 + transpose ? midiToName(midi) : "");
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
        const displayComputer = computer || (midi > range.high - 12 + transpose ? midiToName(midi) : "");
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
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [active, expected, wrong, completed, map, transpose, showLabels, labelMode, practicePalette, preferredLabels]);

  return (
    <canvas
      ref={ref}
      className="piano-canvas"
      role="img"
      aria-label={`Piano keyboard for ${map.name}, showing active notes${showLabels ? " and physical key labels" : ""}`}
    />
  );
}
