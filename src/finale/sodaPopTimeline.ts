export const sodaPopAsset='/audio/soda-pop/soda-pop.mp3';
export const sodaPopSettingsKey='stage-piano-soda-pop-v1';
export const sodaPopFadeSeconds=6;
export type SodaPopSettings={automatic:boolean;countIn:boolean;speed:0.5|1;start:number;end:number;fadeSeconds:number;fadeInSeconds:number;transition:number;firstBeat:number;bpm:number;scratch:number;glitch:number;can:number};
// End marks the start of the fade; retain editable timestamps for musical fine-tuning.
export const defaultSodaPopSettings:SodaPopSettings={automatic:false,countIn:true,speed:1,start:39,end:82,fadeSeconds:sodaPopFadeSeconds,fadeInSeconds:2,transition:1.875,firstBeat:0,bpm:128,scratch:.22,glitch:.43,can:.68};
export function validSodaPopSettings(value:Partial<SodaPopSettings>={},duration=Infinity):SodaPopSettings {
 // Move only the old default cut; retain deliberately edited source timestamps.
 if(value.fadeInSeconds===undefined&&value.start===41)value={...value,start:39};
 const bound=(key:keyof SodaPopSettings,min:number,max:number)=>{const n=value[key];return typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):defaultSodaPopSettings[key] as number;};
 const start=Math.min(bound('start',0,3600),Math.max(0,duration-.25));
 const scratch=bound('scratch',.12,.4),glitch=Math.max(scratch+.08,bound('glitch',.3,.6)),can=Math.max(glitch+.12,bound('can',.55,.88));
 const countIn=typeof value.countIn==='boolean'?value.countIn:true,bpm=bound('bpm',60,200);
 // Saved v1 profiles used 80 seconds as a hard cutoff. Migrate that default once.
 const legacyEnd=value.fadeSeconds===undefined&&value.end===80?82:value.end;
 const end=Math.min(Math.max(start+.25,duration-sodaPopFadeSeconds),Math.max(start+.25,typeof legacyEnd==='number'&&Number.isFinite(legacyEnd)?Math.max(.25,Math.min(3600,legacyEnd)):defaultSodaPopSettings.end));
 const firstBeat=Math.min(bound('firstBeat',0,.5),end-start-.05);
 const transition=Math.max(bound('transition',1,4.5),countIn?240/bpm+firstBeat:0);
 // Keep the legacy field for saved-profile compatibility; the finale is manual-only.
 return {automatic:false,countIn,speed:value.speed===.5?.5:1,start,end,fadeSeconds:sodaPopFadeSeconds,fadeInSeconds:Math.min(bound('fadeInSeconds',0,5),end-start),transition,firstBeat:Math.min(firstBeat,transition*(1-can)-.02),bpm,scratch,glitch,can};
}
export function sodaPopFrame(elapsed:number,settings:SodaPopSettings){
 const musicStart=settings.transition-settings.firstBeat,music=Math.max(0,elapsed-musicStart),length=settings.end-settings.start;
 const progress=Math.max(0,elapsed/settings.transition);
 const fade= Math.max(0,Math.min(1,(music-length)/settings.fadeSeconds));
 const phase=music>=length+settings.fadeSeconds?'finished':music>=length?'fading':progress>=1?'playing':progress>=settings.can?'pop':progress>=settings.glitch+.12?'anticipation':progress>=settings.glitch?'glitch':progress>=settings.scratch?'scratch':'braking';
 const beat=Math.max(0,elapsed-settings.transition)*settings.bpm/60;
 const countStart=musicStart-240/settings.bpm;
 const countBeat=settings.countIn&&elapsed>=countStart-1e-8&&elapsed<musicStart?Math.min(4,Math.floor((elapsed-countStart+1e-8)*settings.bpm/60)+1):0;
 return {elapsed,music,progress,phase,beat,countBeat,pulse:phase==='playing'||phase==='fading'?Math.exp(-(beat%1)*7)*(1-fade):0,rotationRate:Math.max(0,1-progress/settings.scratch),artwork:1-Math.max(0,Math.min(1,(progress-settings.scratch)/(settings.glitch-settings.scratch))),fade};
}
export type SodaPopFrame=ReturnType<typeof sodaPopFrame>;
