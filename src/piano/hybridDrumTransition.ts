export type HybridDrumSettings={hwmVolume:number;rosesVolume:number;balance:number};
export const defaultHybridDrums:HybridDrumSettings={hwmVolume:1,rosesVolume:1,balance:.5};
export const hybridDrumChangeBeats=[128,132,136,144] as const;
export function validHybridDrums(patch:Partial<HybridDrumSettings>,previous:HybridDrumSettings=defaultHybridDrums):HybridDrumSettings {
 const next={...previous};
 for(const key of ['hwmVolume','rosesVolume','balance'] as const)if(typeof patch[key]==='number'&&Number.isFinite(patch[key]))next[key]=Math.max(0,Math.min(1,patch[key]));
 return next;
}
/** Complementary gain handoff. Both patterns retain their original timing.
 * Balance changes the bar-34 midpoint, never the full-groove/full-build endpoints.
 * Roses remains at unity after bar 35 so its existing bar-36 snap is preserved.
 */
export function hybridDrumGains(beat:number,settings:HybridDrumSettings=defaultHybridDrums){
 if(beat<112||beat>=144)return {hwm:0,roses:0};
 const middle=.2+.6*settings.balance;
 const roses=beat<128?0:beat<132?middle*(beat-128)/4:beat<136?middle+(1-middle)*(beat-132)/4:1;
 return {hwm:(1-roses)*settings.hwmVolume,roses:roses*settings.rosesVolume};
}
