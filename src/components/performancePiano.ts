import { pianoGeometry } from "../piano/geometry";
import type { StageKeyGuide, StageKeyLabel, StagePresentation } from "../piano/performancePresentation";

const accent = (entry: StageKeyLabel | undefined, presentation: StagePresentation) => presentation === "interstellar" ? "#b5eaff" : entry?.hand === "left" ? "#52edf0" : "#d397ff";

export function drawPerformancePiano(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  geometry: ReturnType<typeof pianoGeometry>, guide: StageKeyGuide,
  active: Set<number>, pressedCodes: Set<string>, presentation: StagePresentation,
) {
  const blackHeight = height * .62;
  ctx.fillStyle = "#040a12"; ctx.fillRect(0, 0, width, height);
  const drawKey = (midi: number, black: boolean) => {
    const key = geometry.keys.get(midi)!;
    const labels = guide[midi] ?? [];
    const mapped = labels.length > 0, sounding = active.has(midi);
    const color = accent(labels[0], presentation);
    const x = key.x + (black ? 0 : 1), w = key.width - (black ? 0 : 2);
    const h = black ? blackHeight : height - 3;
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, sounding ? color : black ? "#273349" : mapped ? "#e2eaf2" : "#738297");
    fill.addColorStop(.72, sounding ? (presentation === "interstellar" ? "#7fbad9" : color) : black ? "#09101e" : mapped ? "#bccbd9" : "#4b5c71");
    fill.addColorStop(1, sounding ? "#f0fcff" : black ? "#172033" : mapped ? "#8d9fb4" : "#344457");
    ctx.save();
    if (black) {
      ctx.fillStyle = "#030711"; ctx.fillRect(x - 2, 0, w + 4, h + 4);
    }
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, black ? 0 : 2, w, h - 2, [0, 0, 4, 4]); ctx.fill();
    ctx.strokeStyle = sounding ? "#effaff" : black ? "#58647a66" : "#eff9ff44"; ctx.lineWidth = sounding ? 1.5 : .7; ctx.stroke();
    if (mapped || sounding) {
      ctx.fillStyle = sounding ? "#f2fcff" : `${color}99`;
      ctx.shadowColor = color; ctx.shadowBlur = sounding ? 15 : 0;
      ctx.fillRect(x + 1, 1, Math.max(1, w - 2), sounding ? 4 : 2);
      ctx.shadowBlur = 0;
    }
    if (black) {
      ctx.strokeStyle = sounding ? `${color}aa` : "#66748a44";
      ctx.beginPath(); ctx.moveTo(x + 3, h - 7); ctx.lineTo(x + w - 3, h - 7); ctx.stroke();
    }
    if (mapped) {
      const cols = !black && w >= 31 && labels.length > 2 ? 2 : 1;
      const rows = Math.ceil(labels.length / cols);
      const available = black ? h - 30 : height - blackHeight - 18;
      const slot = Math.max(12, Math.min(23, available / rows));
      const capWidth = Math.min(cols === 2 ? 17 : 27, (w - 6) / cols);
      const startY = h - rows * slot - (black ? 10 : 13);
      for (let i = 0; i < labels.length; i++) {
        const entry = labels[i];
        const pressed = pressedCodes.has(entry.code);
        const tint = accent(entry, presentation);
        const cx = x + w / 2 + (cols === 2 ? (i % 2 === 0 ? -1 : 1) * (capWidth + 2) / 2 : 0);
        const cy = startY + Math.floor(i / cols) * slot;
        ctx.fillStyle = pressed ? tint : black ? "#0a1325dd" : "#152438ed";
        ctx.strokeStyle = pressed ? "#f2fbff" : `${tint}66`;
        ctx.lineWidth = pressed ? 1 : .65;
        ctx.shadowColor = tint; ctx.shadowBlur = pressed ? 9 : 0;
        ctx.beginPath(); ctx.roundRect(cx - capWidth / 2, cy, capWidth, slot - 3, 3); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = pressed ? "#06111f" : tint;
        ctx.font = `600 ${Math.min(16, Math.max(10, slot * .66))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(entry.label, cx, cy + (slot - 3) / 2, capWidth - 2);
      }
    }
    ctx.restore();
  };
  for (const midi of geometry.whites) drawKey(midi, false);
  for (const [midi, key] of geometry.keys) if (key.black) drawKey(midi, true);
}
