import { starlightColor, type KeyLight } from './starlight';
import type { pianoGeometry } from '../piano/geometry';
import type { StageKeyGuide } from '../piano/performancePresentation';

/** Interstellar-only surface; physical input owns every press and release. */
export function drawInterstellarPiano(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  geometry: ReturnType<typeof pianoGeometry>, guide: StageKeyGuide,
  active: Set<number>, pressedCodes: Set<string>, _depths: Map<number, number>,
  hovered?: number, hoverProgress = 1, prominentPitches?: Set<number>, pressedKeys?: {code: string; midi: number}[],
  lights?: Map<number, KeyLight>,
) {
  const blackHeight = height * .63;
  const gap = Math.max(1, Math.min(1.7, geometry.whiteWidth * .035));
  ctx.fillStyle = '#020711';
  ctx.fillRect(0, 0, width, height);
  const energy = Math.min(1, [...(lights?.values() ?? [])].reduce((sum, light) => sum + light.level, 0) / 7);

  const draw = (midi: number, black: boolean) => {
    const key = geometry.keys.get(midi)!;
    const labels = guide[midi] ?? [];
    const pressed = active.has(midi);
    const illumination = lights?.get(midi)?.level ?? (pressed ? 1 : 0);
    const color = starlightColor(midi);
    const prominent = midi < 84 || !prominentPitches || prominentPitches.has(midi);
    const x = key.x + (black ? 0 : gap / 2);
    const w = key.width - (black ? 0 : gap);
    const y = 2;
    const h = black ? blackHeight : height - 3;
    ctx.save();

    // Flat, quiet key faces; depth comes from the light above the piano.
    const face = ctx.createLinearGradient(0,y,0,h);
    face.addColorStop(0,black?'#192438':prominent?'#e1e9ed':'#bcc8d2');
    face.addColorStop(1,black?'#0c1422':prominent?'#d4dfe5':'#afbecb');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h - 1, [0, 0, 2, 2]);
    ctx.fill();
    if (illumination > .001) {
      ctx.save(); ctx.globalAlpha = illumination;
      const internal = ctx.createLinearGradient(0, y, 0, h);
      internal.addColorStop(0, `${color}ed`);
      internal.addColorStop(.24, `${color}b0`);
      internal.addColorStop(.82, `${color}48`);
      internal.addColorStop(1, `${color}a8`);
      ctx.fillStyle = internal; ctx.fill();
      ctx.restore();
    }
    if (hovered === midi && !pressed) {
      ctx.fillStyle = `rgba(154,216,255,${hoverProgress * .14})`;
      ctx.fill();
    }
    ctx.strokeStyle = pressed ? '#dff6ff' : black ? '#7c94ae55' : '#ffffff66';
    ctx.lineWidth = pressed ? 1.3 : .7;
    ctx.stroke();

    // A fine upper edge keeps the flat key boundary clear.
    ctx.strokeStyle = black ? '#95b5d340' : '#f5fbff9c';
    ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(x+2,y+2); ctx.lineTo(x+w-2,y+2); ctx.stroke();
    if (illumination > .001) {
      ctx.save(); ctx.globalAlpha = illumination;
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.fillRect(x+1,y,w-2,3);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    const fontSize = Math.max(12, Math.min(17, geometry.whiteWidth * .36));
    const slot = Math.min(29, Math.max(22, height * .12));
    const capWidth = Math.min(w - (black ? 4 : 7), 38);
    const startY = h - 16 - labels.length * slot;
    labels.forEach((entry, index) => {
      const lit = pressed && (pressedKeys ? pressedKeys.some(key => key.code === entry.code && key.midi === (entry.label.includes('×') ? 76 : midi)) : pressedCodes.has(entry.code));
      const capY = startY + index * slot;
      ctx.fillStyle = lit ? '#b9efff' : black ? '#080f1ca8' : '#1b2731c2';
      ctx.strokeStyle = lit ? '#f1fdff' : prominent ? '#90bcd080' : '#607b9250';
      ctx.lineWidth = lit ? 1.2 : .8;
      ctx.beginPath();
      ctx.roundRect(x + (w - capWidth) / 2, capY, capWidth, slot - 4, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = lit ? '#09273a' : prominent ? '#e1f5ff' : '#9aafbf';
      ctx.font = `600 ${entry.label.includes('×') ? fontSize * .75 : fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(entry.label, x + w / 2, capY + (slot - 4) / 2, capWidth - (black ? 2 : 5));
    });
    ctx.restore();
  };
  for (const midi of geometry.whites) draw(midi, false);
  for (const [midi, key] of geometry.keys) if (key.black) draw(midi, true);

  // Tiny pools spill onto adjacent edges without washing out keycaps.
  for (const [midi, light] of lights ?? []) {
    if (light.level < .001) continue;
    const key=geometry.keys.get(midi); if(!key)continue;
    const x=key.x+key.width/2,r=geometry.whiteWidth*.95,color=starlightColor(midi);
    ctx.save(); ctx.globalAlpha=light.level*.17;
    const spill=ctx.createRadialGradient(x,5,0,x,5,r);
    spill.addColorStop(0,`${color}cc`);spill.addColorStop(1,`${color}00`);
    ctx.fillStyle=spill;ctx.fillRect(x-r,0,r*2,r);
    ctx.restore();
  }
  // Only a narrow shared rim is ambient; the keys themselves stay unlit at rest.
  const rim = ctx.createLinearGradient(0,0,width,0);
  rim.addColorStop(0,'#4c8bb805'); rim.addColorStop(.35,`rgba(118,201,255,${.13+energy*.13})`);
  rim.addColorStop(.72,`rgba(197,155,255,${.11+energy*.13})`); rim.addColorStop(1,'#c59bff05');
  ctx.fillStyle=rim;ctx.fillRect(0,0,width,1.5);
  const rail = ctx.createLinearGradient(0, 0, 0, 12);
  rail.addColorStop(0, '#020710cc'); rail.addColorStop(1, '#02071000');
  ctx.fillStyle = rail; ctx.fillRect(0, 0, width, 12);
}
