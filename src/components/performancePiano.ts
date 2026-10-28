import { pianoGeometry } from "../piano/geometry";
import type { StageKeyGuide, StageKeyLabel, StagePresentation } from "../piano/performancePresentation";
import {pianoBlush} from '../theme/mrPinkShow';

const accent = (entry: StageKeyLabel | undefined, presentation: StagePresentation) => presentation === "interstellar" ? "#b5eaff" : presentation === "roses" ? "#e9a2dc" : entry?.hand === "left" ? "#52edf0" : "#d397ff";

export function drawPerformancePiano(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  geometry: ReturnType<typeof pianoGeometry>, guide: StageKeyGuide,
  active: Set<number>, pressedCodes: Set<string>, presentation: StagePresentation,
  hovered?: number, expected = new Set<number>(), wrong = new Set<number>(), coolLighting = false, hoverProgress = 1, showKeyLabels = true, cinematicLighting = false,blush=false,
) {
  const blackHeight = height * .62;
  const roses = presentation === 'roses' && cinematicLighting;
  const whiteFace=[roses?'#edf0ff':'#f4f3ef',roses?'#dfe5f0':'#e7e8e5','#c2c8cc','#8e9aa5'];
  const blackFace=blush?[pianoBlush.blackTop,pianoBlush.blackBottom,'#17202d','#060b12']:[roses?'#3c3d59':'#303947','#080d16','#17202d','#060b12'];
  if (roses) ctx.clearRect(0, 0, width, height);
  else { ctx.fillStyle = "#040a12"; ctx.fillRect(0, 0, width, height); }
  const drawKey = (midi: number, black: boolean) => {
    const key = geometry.keys.get(midi)!;
    const labels = guide[midi] ?? [];
    const mapped = labels.length > 0, sounding = active.has(midi);
    const color = wrong.has(midi) ? "#ff7a91" : expected.has(midi) ? "#65e8ff" : blush&&!black&&sounding?pianoBlush.pressGlow:coolLighting ? (midi < 62 ? "#65e5f5" : "#a6abff") : accent(labels[0], presentation);
    const cue = expected.has(midi) || wrong.has(midi);
    const over = midi === hovered;
    const x = key.x + (black ? 0 : 1), w = key.width - (black ? 0 : 2);
    const h = (black ? blackHeight : height - 3) - (sounding ? 2 : 0);
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    const surface=black?blackFace:whiteFace;
    if(blush&&!black&&!cue){
      fill.addColorStop(0,pianoBlush.whiteTop);
      fill.addColorStop(.5,sounding?pianoBlush.pressHighlight:pianoBlush.whiteBody);
      fill.addColorStop(1,pianoBlush.whiteDepth);
    }else{
      fill.addColorStop(0,sounding||cue?color:surface[0]);
      fill.addColorStop(.72,sounding?color:surface[1]);
      fill.addColorStop(.96,sounding?'#e8fcff':surface[2]);
      fill.addColorStop(1,sounding?color:surface[3]);
    }
    ctx.save();
    if (black) {
      ctx.shadowColor = "#000000bb"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#030711"; ctx.fillRect(x - 2, 0, w + 4, h + 4);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    ctx.fillStyle = fill;
    if (sounding) { ctx.shadowColor = color; ctx.shadowBlur = roses ? 21 : 13; }
    ctx.beginPath(); ctx.roundRect(x, black ? 0 : roses && sounding ? 4 : 2, w, h - 2, [0, 0, 4, 4]); ctx.fill();
    ctx.shadowBlur = 0;
    if (over && !sounding) {
      ctx.fillStyle = `rgba(195,224,255,${hoverProgress * (black ? .12 : .2)})`;
      ctx.fill();
    }
    ctx.strokeStyle = sounding ? "#effaff" : black ? "#58647a66" : "#eff9ff44"; ctx.lineWidth = sounding ? 1.5 : .7; ctx.stroke();
    if (roses) {
      ctx.fillStyle = sounding ? '#fceeff99' : black ? '#c1bcff24' : '#ffffff99';
      ctx.fillRect(x + 1, black ? 3 : 5, 1, Math.max(1, h - 13));
      ctx.fillStyle = sounding ? `${color}cc` : black ? '#07091b99' : '#667aa15c';
      ctx.fillRect(x + 1, h - 5, Math.max(1, w - 2), 2);
    }
    if (mapped || sounding) {
      ctx.fillStyle = sounding ? blush&&!black?pianoBlush.pressHighlight:"#f2fcff" : `${color}99`;
      ctx.shadowColor = color; ctx.shadowBlur = sounding ? roses ? 22 : 15 : 0;
      ctx.fillRect(x + 1, 1, Math.max(1, w - 2), sounding ? 4 : 2);
      ctx.shadowBlur = 0;
    }
    if (black) {
      ctx.strokeStyle = sounding ? `${color}aa` : "#66748a44";
      ctx.beginPath(); ctx.moveTo(x + 3, h - 7); ctx.lineTo(x + w - 3, h - 7); ctx.stroke();
    }
    if (mapped && showKeyLabels) {
      const cols = w >= 29 && labels.length > 2 ? 2 : 1;
      const rows = Math.ceil(labels.length / cols);
      const available = black ? h - 30 : height - blackHeight - 18;
      const slot = Math.max(10, Math.min(28, available / rows));
      const capWidth = Math.min(cols === 2 ? 24 : 40, (w - 4) / cols - (cols === 2 ? 1 : 0));
      const startY = h - rows * slot - (black ? 10 : 13);
      for (let i = 0; i < labels.length; i++) {
        const entry = labels[i];
        const pressed = sounding && pressedCodes.has(entry.code);
        const tint = coolLighting ? (midi < 62 ? "#65e5f5" : "#b5baff") : accent(entry, presentation);
        const cx = x + w / 2 + (cols === 2 ? (i % 2 === 0 ? -1 : 1) * (capWidth + 2) / 2 : 0);
        const cy = startY + Math.floor(i / cols) * slot;
        ctx.fillStyle = pressed ? tint : black ? "#0a1325dd" : "#152438ed";
        ctx.strokeStyle = pressed ? "#f2fbff" : `${tint}66`;
        ctx.lineWidth = pressed ? 1 : .65;
        ctx.shadowColor = tint; ctx.shadowBlur = pressed ? 9 : 0;
        ctx.beginPath(); ctx.roundRect(cx - capWidth / 2, cy, capWidth, slot - 3, 3); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = pressed ? "#06111f" : tint;
        ctx.font = `600 ${Math.min(18, Math.max(10, slot * .68))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(entry.label, cx, cy + (slot - 3) / 2, capWidth - 2);
      }
    }
    ctx.restore();
  };
  for (const midi of geometry.whites) drawKey(midi, false);
  for (const [midi, key] of geometry.keys) if (key.black) drawKey(midi, true);
}
