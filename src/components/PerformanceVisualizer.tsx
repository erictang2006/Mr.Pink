import { rosesHwmVisuals } from '../piano/rosesHwmVisuals';
import {prepareCosmicGalaxy} from './cosmicGalaxy';
import {drawLevelsInterstellar} from './LevelsInterstellarScene';
import {CosmicBackdropCache} from './performanceAtmosphere';
import {CosmicResponse} from './cosmicObservatory';
import {PerformanceRenderBudget} from './performanceRenderBudget';
import type {LevelsWarpSnapshot} from '../piano/levelsInterstellarTransition';
import { drawCosmicStage, CosmicStageCache } from './cosmicStage';
import { drawStarlightBeam } from './starlightBeam';
import { StarlightScene, starlightColor, starlightNoteShape } from './starlight';
import { drawStarlightScene } from './starlightScene';
import type {AutomaticGuide} from "./BackingGuide";
import { useEffect, useRef, type MutableRefObject } from "react";
import { PianoGeometryCache } from '../piano/pianoGeometryCache';
import { type LiveNotes } from "../piano/liveNotes";
import { type KeyboardMap } from "../piano/noteMapping";
import { physicalNoteBar, stageNoteColor, type StageKeyGuide, type StagePresentation } from "../piano/performancePresentation";
import { drawCosmicScene, drawLevelsScene } from "./performanceAtmosphere";
import { LevelsOrb, orbDirection } from "./levelsOrb";
import { rosesIntroLoopTrails } from '../piano/rosesIntro';

export type Theme = "rush" | "cosmic" | "minimal" | "roses" | "levels";
type Props = {
  levelsWarp?:LevelsWarpSnapshot; onWarpFailure?:()=>void;
  workstation?:boolean; lightweight?:boolean; stageLevel?:MutableRefObject<number>;
  notes: LiveNotes;
  automaticGuide?: AutomaticGuide;
  introLoop?: { getBeat: () => number; status: string; synthActive: boolean; tempo: number };
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
  notes,levelsWarp,onWarpFailure,
  workstation = false, lightweight = false, stageLevel,
  automaticGuide,
  introLoop,
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
  const resizeRef=useRef<()=>void>(()=>{});
  const values = useRef({ transpose, theme, notesPerSecond, map, showAssisted, range, presentation, keyGuide, automaticGuide, introLoop, workstation, lightweight, stageLevel,levelsWarp,onWarpFailure });
  values.current = { transpose, theme, notesPerSecond, map, showAssisted, range, presentation, keyGuide, automaticGuide, introLoop, workstation, lightweight, stageLevel,levelsWarp,onWarpFailure };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    let pianoLeft = 0;
    let pianoWidth = 0;
    let pianoTop = 0;
    let lastSeenId = 0;
    let previousFrame = performance.now();
    let lastDraw = 0;
    let energy = 0;
    let hwmBlend = 0;
    const orb = new LevelsOrb();
    const starlight = new StarlightScene();
    const warpBackdrop=new CosmicBackdropCache();let wasWarping=false;
    const observatoryBackdrop=new CosmicBackdropCache(),cosmicResponse=new CosmicResponse();let wasInterstellar=false;
    const renderBudget=new PerformanceRenderBudget();
    const workstationBackdrop=new CosmicStageCache();let wasWorkstation=false;
    const pianoLayout = new PianoGeometryCache();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const piano = canvas.parentElement?.querySelector<HTMLCanvasElement>('.performance-piano .piano-canvas');
      const pianoRect = piano?.getBoundingClientRect();
      pianoLeft = pianoRect ? pianoRect.left - rect.left : 0;
      pianoWidth = pianoRect?.width || width;
      pianoTop = pianoRect ? Math.max(0, Math.min(height, pianoRect.top - rect.top)) : height;
      // The full-stage atmosphere stays bounded even on a 4K projector; UI text
      // and piano keys render on their own surfaces at their existing resolution.
      const stagePixelRatio = values.current.workstation || values.current.levelsWarp?.active || values.current.presentation==='interstellar' ? Math.sqrt((values.current.levelsWarp?.active?2800000:values.current.workstation?1800000:3200000) / Math.max(1, width * height)) : Infinity;
      const dpr = Math.min(window.devicePixelRatio || 1, values.current.workstation || values.current.lightweight || values.current.levelsWarp?.active ? 1.5 : 2, stagePixelRatio);
      const nextWidth=Math.round(width*dpr),nextHeight=Math.round(height*dpr);
      if(canvas.width!==nextWidth)canvas.width=nextWidth;
      if(canvas.height!==nextHeight)canvas.height=nextHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeRef.current=resize;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const pianoCanvas = canvas.parentElement?.querySelector<HTMLCanvasElement>('.performance-piano .piano-canvas');
    if (pianoCanvas) observer.observe(pianoCanvas);
    resize();
    const draw = () => {
      const now = performance.now();
      if (document.hidden || now-lastDraw<(values.current.levelsWarp?.active?16:values.current.workstation || values.current.lightweight?33:0)) {
        if(document.hidden) previousFrame=now;
        frame=requestAnimationFrame(draw);return;
      }
      lastDraw=now;
      const renderStarted=performance.now();
      const { transpose, theme, notesPerSecond, map, showAssisted, range, presentation, keyGuide, automaticGuide, introLoop, workstation, stageLevel,levelsWarp,onWarpFailure } = values.current;
      const travelMs = 4400;
      const alignWithPiano = workstation && presentation === 'roses';
      const noteHeight = alignWithPiano ? pianoTop : height;
      const geometry = pianoLayout.get(map, alignWithPiano ? pianoWidth : width, transpose, range, presentation);
      const visibleNotes = notes.visible(now, travelMs);
      const loopNotes = introLoop ? rosesIntroLoopTrails(introLoop.getBeat(), introLoop.status, introLoop.synthActive, introLoop.tempo, now, travelMs, transpose) : [];
      const attacks = visibleNotes.filter(note => note.id > lastSeenId && now - note.startMs < 100);
      const economical=(presentation==='interstellar'||workstation)&&renderBudget.update(now,visibleNotes.length,attacks.length);
      for (const note of visibleNotes) lastSeenId = Math.max(lastSeenId, note.id);
      const elapsed = now - previousFrame;
      energy *= Math.exp(-Math.min(100, elapsed) / 320);
      previousFrame = now;
      if(workstation&&presentation==='roses')hwmBlend=rosesHwmVisuals(automaticGuide?.getBeat?.()??automaticGuide?.beat??0).mix;
      else hwmBlend+=((automaticGuide?.hwm||automaticGuide?.recorded?1:0)-hwmBlend)*Math.min(1,elapsed/550);
      if (!workstation && presentation === "levels" && attacks.length) {
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
      if(!workstation&&(presentation==='levels'||levelsWarp?.active))orb.update(elapsed);
      if(levelsWarp?.active){
        wasWarping=true;
        try{drawLevelsInterstellar(ctx,width,height,now,now-levelsWarp.startedAt,energy,orb,reducedMotion,warpBackdrop.get(width,height));}
        catch{try{canvas.width=canvas.width;resize();}catch{/* Keep the independent handoff available. */}onWarpFailure?.();}
        frame=requestAnimationFrame(draw);return;
      }
      if(wasWarping){warpBackdrop.release();wasWarping=false;}
      const interstellar=!workstation&&presentation==='interstellar';
      if(wasInterstellar&&!interstellar){observatoryBackdrop.release();cosmicResponse.clear();}
      wasInterstellar=interstellar;
      if(interstellar)for(const note of attacks){
        const key=geometry.keys.get(note.midi);
        if(key)cosmicResponse.impulse(note.midi,(key.x+key.width*.5)/Math.max(1,width),now);
      }
      if(wasWorkstation&&!workstation)workstationBackdrop.release();wasWorkstation=workstation;
      if (workstation) {
        const background=workstationBackdrop.get(width,height,now,stageLevel?.current??0,reducedMotion);
        if(background)ctx.drawImage(background,0,0,width,height);
        else drawCosmicStage(ctx,width,height,now,stageLevel?.current??0,reducedMotion);
      }
      else if (interstellar) drawCosmicScene(ctx, width, height, now, reducedMotion,false,1,observatoryBackdrop.get(width,height),cosmicResponse.frame(now),!economical);
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
      const automaticBeat=automaticGuide?.getBeat?.()??automaticGuide?.beat??0;
      if(theme === "roses" && hwmBlend>.005){
        const drop=(automaticGuide?.getBeat?.()??automaticGuide?.beat??0)>=144;
        const intensity=automaticGuide?.intensity??0;
        const pulse=automaticGuide?.playing&&automaticGuide.events.some(event=>event.layer==='drums'&&automaticBeat-event.start>=0&&automaticBeat-event.start<.15)?1:0;
        ctx.fillStyle=`rgba(2,19,34,${hwmBlend*.7})`;ctx.fillRect(0,0,width,height);
        const glow=ctx.createRadialGradient(width*.5,height*.8,0,width*.5,height*.8,width*.65);
        glow.addColorStop(0,`rgba(40,132,225,${hwmBlend*(.05+intensity*(drop?.23:.12)+pulse*(drop?.065:.025))})`);glow.addColorStop(.6,`rgba(100,64,200,${hwmBlend*intensity*(drop?.09:.035)})`);glow.addColorStop(1,'rgba(70,30,130,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      }
      const riserEvent=automaticGuide?.playing?automaticGuide.events.find(event=>event.layer==='riser'&&event.start<=automaticBeat&&event.end>automaticBeat):undefined;
      if(riserEvent){
        const progress=(automaticBeat-riserEvent.start)/(riserEvent.end-riserEvent.start),strength=automaticGuide?.riserIntensity??.65;
        const sweep=ctx.createLinearGradient(0,noteHeight,0,noteHeight*(.85-.55*progress));
        sweep.addColorStop(0,'rgba(63,126,220,0)');sweep.addColorStop(1,`rgba(123,223,243,${.06+progress*.15})`);
        ctx.save();ctx.strokeStyle=sweep;ctx.lineWidth=2+strength*8*progress;ctx.beginPath();ctx.moveTo(width*.5,noteHeight-45);ctx.bezierCurveTo(width*.47,noteHeight*.75,width*.53,noteHeight*.65,width*.5,noteHeight*(.85-.55*progress));ctx.stroke();ctx.restore();
      }
      // Automatic parts use a compact activity rail, never physical note columns.
      if (automaticGuide?.playing && !workstation) {
        const score = automaticGuide.getBeat?.() ?? automaticGuide.beat;
        const layers = [...new Set(automaticGuide.events.filter(event => event.start <= score && event.end > score).map(event => event.layer))];
        ctx.save();
        ctx.font = "9px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        layers.slice(0, 7).forEach((layer, index) => {
          const x = width - 18 - index * 72;
          ctx.fillStyle = "#65cde0";
          ctx.globalAlpha = .55;
          ctx.fillRect(x - 48, height - 22, 48, 2);
          ctx.globalAlpha = .75;
          ctx.fillText(layer.toUpperCase(), x, height - 29);
        });
        ctx.restore();
      }
      if (!workstation && presentation === "interstellar") drawStarlightScene(ctx, width, height, geometry, visibleNotes, starlight, now, reducedMotion,economical);
      const palette = colors[theme];
      const blendColor=(from:string,to:string)=>'#'+[1,3,5].map(i=>Math.round(parseInt(from.slice(i,i+2),16)*(1-hwmBlend)+parseInt(to.slice(i,i+2),16)*hwmBlend).toString(16).padStart(2,'0')).join('');
      const rosesLow=blendColor('#f59bcc','#5de1ef'),rosesHigh=blendColor('#d891f2','#a6a4ff');
      if (alignWithPiano) { ctx.save(); ctx.translate(pianoLeft, 0); }
      for (const note of [...visibleNotes, ...loopNotes]) {
        if (note.assisted && !showAssisted) continue;
        const key = geometry.keys.get(note.midi);
        if (!key) continue;
        const trail = physicalNoteBar(note, now, noteHeight, travelMs);
        const { bottom, held } = trail;
        const top = workstation ? Math.max(trail.top, bottom - 150) : trail.top;
        const barHeight = workstation ? Math.max(5, bottom - top) : trail.height;
        if (bottom <= 0) continue;
        const inset = key.black ? 2 : Math.max(2, key.width * 0.12);
        const shape = !workstation && presentation === "interstellar" ? starlightNoteShape(key, top, bottom) : undefined;
        const w = shape?.width ?? Math.max(2, key.width - inset * 2);
        const x = shape?.x ?? key.x + inset;
        const drawTop = shape?.top ?? top;
        const color = theme === "roses" ? (note.midi<62?rosesLow:rosesHigh) : presentation ? (presentation === "interstellar" ? starlightColor(note.midi) : stageNoteColor(presentation, note.midi, note.code, keyGuide)) : note.assisted ? "#d8ad65" : palette[
            ((note.midi % palette.length) + palette.length) % palette.length
          ];
        ctx.save();
        if(workstation)ctx.globalAlpha=.38;
        if (note.assisted && presentation !== "levels") ctx.globalAlpha = 0.5;
        else if (note.octave) ctx.globalAlpha = 0.58;
        if (presentation && !held) ctx.globalAlpha *= .78;
        if (shape) {
          drawStarlightBeam(ctx,shape,color,held,now,reducedMotion,economical);
        } else {
          ctx.shadowColor = color;
          ctx.shadowBlur = economical ? 0 : presentation && !held ? 2 : presentation === "levels" ? 14 : theme === "minimal" ? 0 : theme === "rush" ? 13 : theme === "roses" ? 5 : 8;
          const gradient = ctx.createLinearGradient(0,drawTop,0,bottom);
          gradient.addColorStop(0,color);
          gradient.addColorStop(1,theme === "minimal" ? color : `${color}99`);
          ctx.fillStyle=gradient;
          ctx.beginPath();ctx.roundRect(x,drawTop,w,barHeight,3);ctx.fill();ctx.shadowBlur=0;
          if(presentation){ctx.strokeStyle=`${color}99`;ctx.lineWidth=.7;ctx.stroke();}
          ctx.fillStyle="#ffffffaa";ctx.fillRect(x+1,Math.max(0,top),Math.max(1,w-2),2);
        }
        if (held && theme !== "minimal") {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x - 2, noteHeight - 3, w + 4, 3);
        }
        ctx.restore();
        if(workstation && held && !reducedMotion){
          ctx.save();ctx.fillStyle=color;
          for(let i=0;i<3;i++){
            const t=((now-note.startMs+i*190)%900)/900;
            ctx.globalAlpha=(1-t)*.6;
            ctx.beginPath();ctx.arc(key.x+key.width*.5+Math.sin(i*2.4+t*3)*key.width*.22,noteHeight-t*95,1.2*(1-t)+.4,0,Math.PI*2);ctx.fill();
          }
          ctx.restore();
        }
      }
      if (alignWithPiano) ctx.restore();
      if (theme === "rush" && notesPerSecond >= 12) {
        ctx.fillStyle = `rgba(120,220,255,${Math.min(0.035, (notesPerSecond - 11) * 0.002)})`;
        ctx.fillRect(0, 0, width, height);
      }
      renderBudget.record(performance.now()-renderStarted);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      starlight.clear();warpBackdrop.release();observatoryBackdrop.release();workstationBackdrop.release();cosmicResponse.clear();resizeRef.current=()=>{};
    };
  }, [notes]);
  useEffect(()=>{resizeRef.current();},[lightweight,workstation,presentation,levelsWarp?.active]);
  useEffect(()=>{
    if(!levelsWarp?.active&&presentation!=='interstellar')return;
    const warm=()=>{const rect=canvasRef.current?.getBoundingClientRect();if(rect)try{prepareCosmicGalaxy(rect.width,rect.height);}catch{/* The renderer retains its safe fallback. */}};
    if(typeof window.requestIdleCallback==='function'){const id=window.requestIdleCallback(warm,{timeout:900});return()=>window.cancelIdleCallback(id);}
    const id=window.setTimeout(warm,0);return()=>window.clearTimeout(id);
  },[levelsWarp?.run,levelsWarp?.active,presentation]);

  return (
    <canvas
      className="visualizer-canvas"
      ref={canvasRef}
      aria-label="Live notes rising from the piano"
      role="img"
    />
  );
}
