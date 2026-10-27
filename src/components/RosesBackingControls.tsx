import {defaultHybridDrums} from "../piano/hybridDrumTransition";
import {defaultRiserSettings} from "../piano/hybridBacking";
import type { RosesIntroEngine, RosesIntroSnapshot } from "../piano/rosesIntroEngine";
import { backingChoices, backingGroups } from "../piano/rosesBacking";
import { finalizedRosesBuildup } from "../piano/rosesAudioSelection";

type Props = { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; audioReady: boolean; startAudio: () => void | Promise<void>; vocalLevel: number; onVocalLevel: (level:number) => void; onStart25?: () => void | Promise<void> };
export default function RosesBackingControls({engine,clock,audioReady,startAudio,vocalLevel,onVocalLevel,onStart25}:Props) {
  const state=clock?.buildup,mode=state?.mode??finalizedRosesBuildup.value,ready=(engine?.isReady()??false)&&clock?.drop?.status!=="loading";
  const riser=state?.riser??defaultRiserSettings;
  const hybridDrums=state?.hybridDrums??defaultHybridDrums;
  async function start(bar:25|29) {
    if(!audioReady)await startAudio();
    if(bar===25){if(onStart25)await onStart25();else await engine?.rehearseFrom25("timed");}
    else await engine?.rehearseFrom29("timed");
  }
  return <section className="sandbox-details" aria-label="Bars 29–36 backing">
    <div className="sandbox-control-line"><strong>BARS 29–36 BACKING</strong><span role="status">{backingChoices.find(choice=>choice.value===mode)?.label} · {state?.status??"NOT ARMED"}</span></div>
    <div className="sandbox-control-line">
      <label>Bars 29–36 Backing Source <select aria-label="Bars 29–36 Backing Source" disabled={!ready} value={mode} onChange={()=>engine?.setBackingMode(finalizedRosesBuildup.value)}><option value={finalizedRosesBuildup.value}>{finalizedRosesBuildup.label}</option></select></label>
      {!onStart25&&<button className="practice-primary" disabled={!ready} onClick={()=>start(25)}>Start Bar 25 + Backing + Lead</button>}
      <button disabled={!ready} onClick={()=>start(29)}>Start Bar 29</button>
      <button onClick={()=>engine?.reset(25)}>Stop / reset</button>
    </div>
    <div className="sandbox-control-line">
      <label>Backing volume <output>{Math.round((state?.gain??1)*100)}%</output><input aria-label="Bars 29–36 backing volume" type="range" min="0" max="1.5" step=".05" value={state?.gain??1} onChange={event=>engine?.setBackingMix({gain:Number(event.target.value)})}/></label>
      <label>Here With Me vocal <output>{Math.round(vocalLevel*100)}%</output><input aria-label="Here With Me vocal volume" type="range" min="0" max="1.5" step=".05" value={vocalLevel} onChange={event=>onVocalLevel(Number(event.target.value))}/></label>
    </div>
    {mode!=="roses"&&<div className="sandbox-control-line">{backingGroups.map(group=><div key={group}><label>{group==="chords"?"Harmony / guitar / leads":mode==="hybrid"&&group==="fx"?"FX / RISER":group.toUpperCase()} <output>{Math.round((state?.levels[group]??1)*100)}%</output><input aria-label={`Here With Me backing ${group} level`} type="range" min="0" max="1.5" step=".05" value={state?.levels[group]??1} onChange={event=>engine?.setBackingMix({group,level:Number(event.target.value)})}/></label><button aria-label={`Solo Here With Me backing ${group}`} aria-pressed={state?.solo===group} onClick={()=>engine?.setBackingMix({solo:state?.solo===group?null:group})}>Solo</button></div>)}</div>}
    <small>{mode==="roses"?"Uses your existing Roses backing and Vox instrument choice below, plus the pre-drop riser in bar 36.":mode==="hybrid"?"Here With Me groove through bar 32; automatic drum handoff in 33–34; Roses acceleration in 35. Instruments break at bar 36; the vocal continues over an airy riser and beat-4 snap.":mode==="hwm-build"?"Source bars 18–25 → Roses 29–36: harmony, Piezo guitar, bass, rising lead, percussion and transition fill.":"Source bars 26–33 → Roses 29–36: full drop harmony, guitar, pad, four lead layers, bass, low guitar, drums and FX."} One backing source plays at a time. Both start buttons automatically continue into the selected drop at bar 37, using its existing mixer settings.</small>
    {mode==="hybrid"?<small>Here With Me harmony, bass and early drums; Roses Spacy Drum, snare roll and snap take over. The vocal keeps its existing cue.</small>:mode!=="roses"&&<small>Uses the actual supplied drum, FX and Piezo samples. Missing Kontakt/Nexus/DUNE/Spire/Sylenth/electric-guitar sounds use distinct local synth approximations. Pitched source MIDI is permanently raised one semitone to E major; submixes are prepared locally for stable playback.</small>}
    {mode==='hybrid'&&<section className="hybrid-drum-transition" aria-label="Hybrid drum transition">
      <div className="sandbox-control-line"><strong>Automatic drum transition</strong>
        {([{key:'hwmVolume',label:'Here With Me Drums Volume'},{key:'rosesVolume',label:'Roses Buildup Drums Volume'},{key:'balance',label:'Drum Transition Balance'}] as const).map(control=><label key={control.key}>{control.label} <output>{Math.round(hybridDrums[control.key]*100)}%</output><input aria-label={control.label} type="range" min="0" max="100" value={Math.round(hybridDrums[control.key]*100)} onChange={event=>engine?.setHybridDrums({[control.key]:Number(event.target.value)/100})}/></label>)}
      </div><small>29–32: Here With Me groove · 33–34: gradual handoff · 35: Roses build · 36: break. Higher balance brings Roses forward earlier; the handoff runs automatically.</small>
    </section>}
    {(mode==='hybrid'||mode==='roses')&&<section className="pre-drop-riser" aria-label="Pre-Drop Riser">
      <div className="sandbox-control-line"><strong>Pre-Drop Riser</strong>
        <label><input aria-label="Pre-Drop Riser enabled" type="checkbox" checked={riser.enabled} onChange={event=>engine?.setPreDropRiser({enabled:event.target.checked})}/> Enabled</label>
        <label>Riser Volume <output>{Math.round(riser.volume*100)}%</output><input aria-label="Riser Volume" type="range" min="0" max="100" value={Math.round(riser.volume*100)} onChange={event=>engine?.setPreDropRiser({volume:Number(event.target.value)/100})}/></label>
        <label>Riser Intensity <output>{Math.round(riser.intensity*100)}%</output><input aria-label="Riser Intensity" type="range" min="0" max="100" value={Math.round(riser.intensity*100)} onChange={event=>engine?.setPreDropRiser({intensity:Number(event.target.value)/100})}/></label>
        <button disabled={!ready||clock?.status==='running'||clock?.status==='paused'} onClick={async()=>{if(!audioReady)await startAudio();engine?.previewPreDropRiser();}}>Preview riser</button>
      </div><small>Automatic in bar 36. Intensity blends a gentle sweep into a wider, brighter rise; volume controls loudness. Snap on beat 4, then a short gap before the drop.</small>
    </section>}
    <small>Start Bar 29 joins the vocal at its existing timeline position. Use Start Bar 25 to hear the full vocal pickup.</small>
  </section>;
}
