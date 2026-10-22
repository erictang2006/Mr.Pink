import {buildupEvents,defaultBuildupSettings,snareTranspose,buildupAssets} from './rosesBuildup';

export const hybridBreakBeat=140;
export const hybridRiserEndBeat=143.8; // 120 ms of space before bar 37 at 100 BPM.
export const hybridFadeStartBeat=136;
export const hybridPercussion=buildupEvents.filter(event=>['spacy','roll','snap'].includes(event.layer)).map(event=>({
 ...event,end:Math.min(event.end,event.layer==='snap'?hybridRiserEndBeat:hybridBreakBeat),
 rate:event.layer==='roll'?2**(snareTranspose(event.beat)/12):1,
 level:event.layer==='snap'?.6:defaultBuildupSettings[event.layer as 'spacy'|'roll'],
 file:buildupAssets[event.layer],
}));
/** Applied once to prepared E-major harmony, never to the separate vocal bus. */
export function hybridHarmonyGain(beat:number):number {
 if(beat>=hybridBreakBeat)return 0;
 const fadeEnd=hybridBreakBeat-.04/.6;
 if(beat>=fadeEnd)return .45*(hybridBreakBeat-beat)/(hybridBreakBeat-fadeEnd);
 if(beat>=hybridFadeStartBeat)return 1-.55*(beat-hybridFadeStartBeat)/(fadeEnd-hybridFadeStartBeat);
 return 1;
}
export type RiserSettings={enabled:boolean;volume:number;intensity:number};
export const defaultRiserSettings:RiserSettings={enabled:true,volume:.35,intensity:.65};
export function validRiserSettings(value:Partial<RiserSettings>,previous:RiserSettings=defaultRiserSettings):RiserSettings {
 const result={...previous};if(typeof value.enabled==='boolean')result.enabled=value.enabled;
 for(const key of ['volume','intensity'] as const)if(typeof value[key]==='number'&&Number.isFinite(value[key]))result[key]=Math.max(0,Math.min(1,value[key]));
 return result;
}
export const riserUrls={soft:'/roses/hybrid/riser-soft.wav',strong:'/roses/hybrid/riser-strong.wav'};
