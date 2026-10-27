export type BuildupLeadPlaybackMode = 'auto' | 'manual';
export const manualBuildupLeadKeys = [
  {code:'KeyW',label:'W',midi:59,name:'B3'}, {code:'KeyR',label:'R',midi:63,name:'D♯4'},
  {code:'KeyT',label:'T',midi:64,name:'E4'}, {code:'KeyY',label:'Y',midi:66,name:'F♯4'},
  {code:'KeyU',label:'U',midi:68,name:'G♯4'}, {code:'KeyO',label:'O',midi:71,name:'B4'},
  {code:'KeyP',label:'P',midi:73,name:'C♯5'},
] as const;
export const manualBuildupLeadKey=(code:string)=>manualBuildupLeadKeys.find(key=>key.code===code);
export function silentBuildupLeadGesture(mode:BuildupLeadPlaybackMode,status:string,measure:number,backing:string,code:string){
  // Include the A–W ending of the second phrase. W remains an audible B3
  // only when the operator explicitly selects the separate manual lead mode.
  const gesture=['KeyJ','KeyH','KeyF','KeyD','KeyS','KeyA'].includes(code)||mode==='auto'&&code==='KeyW';
  return (mode==='auto'||mode==='manual') && backing==='roses' && (status==='running'||status==='paused') && measure>=29 && measure<=35 && gesture;
}
export function manualBuildupLeadActive(mode:BuildupLeadPlaybackMode,status:string,measure:number,backing:string){
  return mode==='manual' && backing==='roses' && (status==='idle'||status==='finished'||measure>=29&&measure<=35);
}
const storageKey='stage-piano-roses-buildup-lead-playback-v1';
export function loadBuildupLeadPlayback():BuildupLeadPlaybackMode {try{return localStorage.getItem(storageKey)==='manual'?'manual':'auto';}catch{return 'auto';}}
export function saveBuildupLeadPlayback(mode:BuildupLeadPlaybackMode){try{localStorage.setItem(storageKey,mode);}catch{/* Optional local storage. */}}
