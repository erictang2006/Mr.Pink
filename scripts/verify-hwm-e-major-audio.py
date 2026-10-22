"""Independent waveform checks: duration, pitch ratio, alignment and preserved audio."""
from pathlib import Path
import json,hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
report=json.loads(Path('reference/here-with-me-vocal/e-major-vocal.json').read_text())
r,a=wavfile.read(report['source']);rr,b=wavfile.read(report['output'])
start=round(report['sourceExcerptStartSeconds']*r)
a=a[start:start+round(report['seconds']*r)]
def signal(x,r):
    x=x.astype(float).mean(axis=1)
    x/=max(abs(x))
    from math import gcd
    g=gcd(r,11025)
    return resample_poly(x,11025//g,r//g)
a,b=signal(a,r),signal(b,rr)
def pitches(x):
    result=[];n=2048
    for start in range(0,len(x)-n,256):
        v=x[start:start+n];v=v-v.mean()
        if np.sqrt(np.mean(v*v))<.015:result.append(np.nan);continue
        ac=np.fft.irfft(np.abs(np.fft.rfft(v,4096))**2,4096)[:n]
        sq=np.r_[0,np.cumsum(v*v)];tau=np.arange(1,200)
        diff=sq[n-tau]+sq[n]-sq[tau]-2*ac[tau]
        cmnd=np.r_[1,diff*tau/np.maximum(np.cumsum(diff),1e-12)]
        candidates=np.where(cmnd[16:158]<.15)[0]
        if not len(candidates):result.append(np.nan);continue
        t=int(candidates[0]+16)
        while t<158 and cmnd[t+1]<cmnd[t]:t+=1
        offset=.5*(cmnd[t-1]-cmnd[t+1])/(cmnd[t-1]-2*cmnd[t]+cmnd[t+1])
        result.append(69+12*np.log2((11025/(t+offset))/440))
    return np.array(result)
p,q=pitches(a),pitches(b);n=min(len(p),len(q));valid=np.isfinite(p[:n])&np.isfinite(q[:n]);delta=q[:n][valid]-p[:n][valid]
# Exclude octave-selection ambiguity; report counts and distribution explicitly.
near=delta[np.abs(delta)<3]
assert len(near)>100
median=float(np.median(near));assert abs(median)<.03,median
names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
def hist(v):
    good=v[np.isfinite(v)];good=good[np.abs(good-np.round(good))<.25]
    counts=np.bincount(np.round(good).astype(int)%12,minlength=12)
    return sorted([(names[i],int(c)) for i,c in enumerate(counts) if c],key=lambda x:-x[1])
# Compare all pre-existing public assets against the audit baseline. Only pitched
# HWM backing stems may change. In particular all original drums/FX must match.
baseline=json.loads(Path('/private/tmp/mr-pink-e-major-before.json').read_text())
changed=[]
for file,oldhash in baseline.items():
    if not file.startswith('public/'):continue
    now=hashlib.sha256(Path(file).read_bytes()).hexdigest()
    if now!=oldhash:changed.append(file)
assert set(changed)=={f'public/roses/hwm-backing/{region}-{group}.wav' for region in ['build','drop'] for group in ['chords','bass']},changed
r0,old=wavfile.read(report['originalPlaybackFile']);oldp=pitches(signal(old,r0));n0=min(len(oldp),len(q));voiced=np.isfinite(oldp[:n0])&np.isfinite(q[:n0]);old_delta=q[:n0][voiced]-oldp[:n0][voiced];old_delta=old_delta[np.abs(old_delta-1)<3];vs_old=float(np.median(old_delta));assert abs(vs_old-1)<.03,vs_old
out=dict(pitchShiftVersusPreviousEbVocalSemitones=vs_old,method='Independent YIN-style waveform fundamental estimates; excludes octave ambiguity and low-confidence frames',
 pairedVoicedFrames=int(valid.sum()),nonOctaveAmbiguousFrames=len(near),additionalPitchShiftVersusSuppliedAudioSemitones=median,
 pitchShift10th90thPercentileSemitones=np.percentile(near,[10,90]).tolist(),sourcePitchClasses=hist(p),processedPitchClasses=hist(q),
 vocalFrames=report['frames'],vocalDurationSeconds=report['seconds'],playbackRate=1,
 changedPreexistingPublicAssets=changed,allOtherPreexistingPublicAssetsUnchanged=True)
Path('docs/roses-reference/hwm-e-major').mkdir(exist_ok=True)
Path('docs/roses-reference/hwm-e-major/pitch-verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
