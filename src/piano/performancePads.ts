import { rosesXUsesSpacy } from "./rosesDrumInput";
import { rosesIntroKeys } from './rosesIntroKeys';
import {manualBuildupLeadKeys} from './rosesManualBuildupLead';
import { drumCodeToLayer } from './levels';
import { levelsRealDrums } from './levelsRealPiano';
import { midiToName } from './noteMapping';
import { stageSourceCode, type StageKeyGuide } from './performancePresentation';
import { rosesDrumTargets } from './rosesIntro';
import { rosesManualBassKeys, silentAutomaticBassActive } from './rosesManualBass';
import { visualLayerNames, type BackingFrame } from './backingVisuals';
import type { RosesIntroSnapshot } from './rosesIntroEngine';
import type { DrumName, DrumSnapshot } from './drumEngine';
import type { LiveNote } from './liveNotes';

export type PerformancePad = {
  id: string; label: string; code?: string; key?: string;
  group: 'Drums' | 'Synth' | 'Bass' | 'Chords' | 'Vocal' | 'FX' | 'Backing';
  kind: 'live' | 'cue' | 'auto'; active?: boolean; queued?: boolean;
  playing?: () => boolean;
  available?: boolean; detail?: string; pulse?: string;
};
export function physicalKeyLabel(code: string): string {
  return ({Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Backquote:'`',Minus:'-',Equal:'=',Space:'SPACE'} as Record<string,string>)[code] ?? code.replace(/^(Key|Digit)/, '');
}

type PadContext = {
  song: string; real: boolean; measure: number; guide: StageKeyGuide;
  drums?: DrumSnapshot | null; roses?: RosesIntroSnapshot | null;
  levelsPlaying?: (name: DrumName) => boolean;
  rosesPlaying?: (name: "kick" | "clap" | "accent") => boolean;
  vocalKey: string; backing?: BackingFrame; backingPlaying: boolean;
};
/** Presentation only: describes current input routes and observed playback state. */
export function performancePads({song, real, measure, guide, drums, roses, vocalKey, backing, backingPlaying, levelsPlaying, rosesPlaying}: PadContext): PerformancePad[] {
  const pads: PerformancePad[] = [];
  if (song === 'levels') {
    for (const [code, layer] of Object.entries(real ? levelsRealDrums : drumCodeToLayer)) {
      const loop = layer === 'kick' || layer === 'clap' || layer === 'hat';
      pads.push({id:`levels:${layer}`,label:layer === 'hat' ? 'Hi-hat' : layer,code,key:physicalKeyLabel(code),group:loop?'Drums':'FX',kind:'cue',playing:levelsPlaying?()=>levelsPlaying(layer):undefined,available:measure>=9&&measure<=11,
        active:loop && drums?.status==='running' && drums.active[layer],
        queued:loop ? drums?.pending[layer] !== undefined : layer === 'fill' ? drums?.fillPending : drums?.riserPending,
        detail:measure>=9&&measure<=11?(loop?'Loop toggle':'One-shot cue'):'Bars 9–11'});
    }
  }
  if (song === 'roses') {
    for (const kind of ['kick','clap'] as const) {
      const code = rosesDrumTargets.find(target => target.kind === kind)!.code;
      pads.push({id:`roses:${kind}`,label:kind==='clap'&&rosesXUsesSpacy(roses?.measure??1)?'Spacy Drum':kind,code,key:physicalKeyLabel(code),group:'Drums',kind:'live',playing:rosesPlaying?()=>rosesPlaying(kind):undefined,pulse:roses?.lastDrum?.kind===kind?String(roses.lastDrum.sequence):undefined});
    }
    pads.push(
      {id:'roses:synth',label:'Synth backing',code:'KeyV',key:'V',group:'Synth',kind:'cue',active:roses?.status==='running'&&roses.synthActive&&roses.measure>=5&&roses.measure<21,queued:roses?.synthPending !== undefined,detail:'Arm / stop sequence'},
      {id:'roses:vocal',label:'Vocal',code:vocalKey,key:physicalKeyLabel(vocalKey),group:'Vocal',kind:'cue',active:roses?.vocalStatus==='PLAYING'||roses?.vocalStatus==='FADING',queued:roses?.vocalStatus==='ARMED'},
      {id:'roses:accent',label:'Vocal accent',code:'KeyC',key:'C',group:'Vocal',kind:'live',playing:rosesPlaying?()=>rosesPlaying('accent'):undefined,pulse:roses?.lastAccent===undefined?undefined:String(roses.lastAccent)},
      {id:'roses:stop',label:'Stop backing',code:'KeyB',key:'B',group:'FX',kind:'cue',detail:'Transport control'},
    );
    for (const note of rosesIntroKeys(vocalKey)) pads.push({id:`intro:${note.code}`,label:'Intro synth',code:note.code,key:note.label,group:'Synth',kind:'live',detail:'Original Roses intro sound'});
    if(roses?.buildupLeadPlaybackMode==='manual')for(const note of manualBuildupLeadKeys)pads.push({id:`build-lead:${note.code}`,label:`HWM lead · ${note.name}`,code:note.code,key:note.label,group:'Synth',kind:'live',available:roses.manualBuildupLeadActive,detail:'Bars 29–35 · hold / release'});
    if (roses?.bassPlaybackMode === 'manual') {
      for (const note of rosesManualBassKeys) pads.push({id:`bass:${note.code}`,label:note.name,code:note.code,key:note.label,group:'Bass',kind:'live'});
    } else pads.push({id:'roses:bass',label:'Bass / sub',code:'KeyN',key:'N',group:'Bass',kind:'cue',active:roses?.status==='running'&&roses.bassActive&&roses.measure>=13&&roses.measure<21,queued:roses?.bassPending !== undefined,detail:'Arm / stop sequence'});
    if (silentAutomaticBassActive(roses)) for (const note of rosesManualBassKeys) pads.push({id:`bass-gesture:${note.code}`,label:note.name,code:note.code,key:note.label,group:'Bass',kind:'live',detail:'Visual only · automatic bass/sub'});
    if (backing) for (const layer of new Set(backing.events.map(event => event.layer))) pads.push({id:`auto:${layer}`,label:visualLayerNames[layer],group:'Backing',kind:'auto',active:backingPlaying&&backing.active.some(event => event.layer===layer)});
  }
  // Shared chord labels come from the same guide used to draw the piano.
  const byCode = new Map<string, {label:string;pitches:number[]}>();
  for (const [pitch, entries] of Object.entries(guide)) for (const entry of entries) {
    const item = byCode.get(entry.code) ?? {label:entry.label,pitches:[]};
    item.pitches.push(Number(pitch)); byCode.set(entry.code,item);
  }
  if (song === 'levels' || song === 'roses') for (const [code,item] of byCode) {
    if (item.pitches.length > 1 && !pads.some(pad => pad.code===code)) pads.push({id:`chord:${code}`,label:item.pitches.map(midiToName).join(' · '),code,key:physicalKeyLabel(code),group:'Chords',kind:'live',detail:song==='roses'&&/^Digit[1-5]$/.test(code)?'Visual only':undefined});
  }
  return pads;
}

/** Live note lifetimes (including pedal) own sustained pad light; release fades visually. */
export function padNoteLevel(code: string | undefined, notes: readonly LiveNote[], now: number): number {
  if (!code) return 0;
  let level = 0;
  for (const note of notes) if (stageSourceCode(note.code) === code) {
    level = Math.max(level, note.endMs === null ? 1 : Math.max(0, 1-(now-note.endMs)/320));
  }
  return level;
}
