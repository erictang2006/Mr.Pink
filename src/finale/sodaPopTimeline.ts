export const sodaPopAsset='/audio/soda-pop/soda-pop.mp3';
export const sodaPopSettingsKey='stage-piano-soda-pop-v1';
export type SodaPopSettings={automatic:boolean;countIn:boolean;speed:0.5|1;start:number;end:number;transition:number;firstBeat:number;bpm:number;scratch:number;glitch:number;can:number};
// Operator-selected cut; retain editable timestamps for musical fine-tuning.
export const defaultSodaPopSettings:SodaPopSettings={automatic:false,countIn:true,speed:1,start:41,end:80,transition:1.875,firstBeat:0,bpm:128,scratch:.22,glitch:.43,can:.68};
export function validSodaPopSettings(value:Partial<SodaPopSettings>={},duration=Infinity):SodaPopSettings {
 const bound=(key:keyof SodaPopSettings,min:number,max:number)=>{const n=value[key];return typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):defaultSodaPopSettings[key] as number;};
 const start=Math.min(bound('start',0,3600),Math.max(0,duration-.25));
 const scratch=bound('scratch',.12,.4),glitch=Math.max(scratch+.08,bound('glitch',.3,.6)),can=Math.max(glitch+.12,bound('can',.55,.88));
 const countIn=typeof value.countIn==='boolean'?value.countIn:true,bpm=bound('bpm',60,200);
 const end=Math.min(duration,Math.max(start+.25,bound('end',.25,3600))),firstBeat=Math.min(bound('firstBeat',0,.5),end-start-.05);
 const transition=Math.max(bound('transition',1,4.5),countIn?240/bpm+firstBeat:0);
 // Keep the legacy field for saved-profile compatibility; the finale is manual-only.
 return {automatic:false,countIn,speed:value.speed===.5?.5:1,start,end,transition,firstBeat:Math.min(firstBeat,transition*(1-can)-.02),bpm,scratch,glitch,can};
}
export function sodaPopFrame(elapsed:number,settings:SodaPopSettings){
 const musicStart=settings.transition-settings.firstBeat,music=Math.max(0,elapsed-musicStart),length=settings.end-settings.start;
 const progress=Math.max(0,elapsed/settings.transition);
 const phase=elapsed>=musicStart+length+.65?'finished':elapsed>=musicStart+length?'burst':progress>=1?'playing':progress>=settings.can?'pop':progress>=settings.glitch+.12?'anticipation':progress>=settings.glitch?'glitch':progress>=settings.scratch?'scratch':'braking';
 const beat=Math.max(0,elapsed-settings.transition)*settings.bpm/60;
 const countStart=musicStart-240/settings.bpm;
 const countBeat=settings.countIn&&elapsed>=countStart-1e-8&&elapsed<musicStart?Math.min(4,Math.floor((elapsed-countStart+1e-8)*settings.bpm/60)+1):0;
 return {elapsed,music,progress,phase,beat,countBeat,pulse:phase==='playing'?Math.exp(-(beat%1)*7):0,rotationRate:Math.max(0,1-progress/settings.scratch),artwork:1-Math.max(0,Math.min(1,(progress-settings.scratch)/(settings.glitch-settings.scratch))),ending:Math.max(0,elapsed-musicStart-length)};
}
export type SodaPopFrame=ReturnType<typeof sodaPopFrame>;
