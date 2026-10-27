import {manualBuildupLeadKeys,type BuildupLeadPlaybackMode} from '../piano/rosesManualBuildupLead';
import type {RosesIntroEngine,RosesIntroSnapshot} from '../piano/rosesIntroEngine';

export default function RosesBuildupLeadControls({engine,clock}:{engine:RosesIntroEngine|null;clock:RosesIntroSnapshot|null}){
  const mode=clock?.buildupLeadPlaybackMode??'auto',playing=clock?.status==='running'||clock?.status==='paused';
  return <div className="sandbox-control-line">
    <label>Lead · bars 29–35 <select aria-label="Bars 29–35 lead playback" value={mode} disabled={!engine||playing} onChange={event=>engine?.setBuildupLeadPlaybackMode(event.target.value as BuildupLeadPlaybackMode)}><option value="auto">Automatic · Arm Buildup</option><option value="manual">Manual keys · HWM lead</option></select></label>
    {mode==='manual'&&<span>{manualBuildupLeadKeys.map(key=><span key={key.code}><kbd>{key.label}</kbd> {key.name} · </span>)}Hold/release to play the existing four-layer buildup lead. J / H / F / D / S / A remain visual-only in bars 29–35. Automatic melody is off; bass, drums, vocals and drop continue. These lead keys work in bars 29–35, or while stopped for auditioning.</span>}
    {mode==='auto'&&<span>J / H / F / D / S / A / W are visual-only during bars 29–35: play JHHFFDS, then JHHFFDSAW. Piano keys depress and note trails appear, with no extra live sound over the automatic melody.</span>}
    {playing&&<small>Stop playback to change Lead mode.</small>}
  </div>;
}
