"""Align the supplied, already E-major take to the existing cue.
Usage: audio-venv/bin/python scripts/prepare-hwm-vocal-e-major.py SOURCE
Original source and original playback WAV are preserved; no runtime pitch effect.
"""
import sys,json,hashlib,shutil
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly,correlate
source=Path(sys.argv[1])
rate,a=wavfile.read(source)
# Independent waveform verification found +0.997 semitones versus the previous
# E-flat excerpt. Preserve this supplied pitch: another +1 would produce F.
b=a.astype(np.float64)/32768
old_path=Path('public/roses/here_with_me_chorus_original.wav');old_rate,old=wavfile.read(old_path)
assert a.dtype==np.int16 and a.shape==b.shape
# Match amplitude envelopes, allowing the supplied master to have a different
# encoding/mix and leading silence. No tempo change is introduced.
def envelope(x,r):
    x=np.abs(x.astype(np.float64)).mean(axis=1)
    return resample_poly(x,1000,r)
x,y=envelope(a,rate),envelope(old,old_rate)
y-=y.mean()
first,last=30000,40000
window=x[first:last+len(y)]
c=correlate(window,y,mode='valid',method='fft')
sums=np.convolve(window,np.ones(len(y)),mode='valid')
squares=np.convolve(window**2,np.ones(len(y)),mode='valid')
norm=np.sqrt(np.maximum(0,squares-sums**2/len(y)))*np.linalg.norm(y)
scores=c/np.maximum(norm,1e-12);offset=(first+int(np.argmax(scores)))/1000
assert float(scores.max())>.75, 'Supplied source no longer matches the existing vocal passage'
start=round(offset*rate);frames=old.shape[0]
clip=resample_poly(b[start:start+round(frames/old_rate*rate)].astype(np.float64),147,160)
assert rate==48000 and old_rate==44100
clip=np.pad(clip,((0,max(0,frames-len(clip))),(0,0)))[:frames]
peak=float(np.max(np.abs(clip)));gain=min(1,.98/max(peak,1e-12));clip*=gain
out=Path('public/roses/here_with_me_chorus_e_major.wav')
wavfile.write(out,old_rate,np.round(np.clip(clip,-1,1)*32767).astype(np.int16))
ref=Path('reference/here-with-me-vocal');ref.mkdir(exist_ok=True)
kept=ref/'here-with-me-vocals-source.wav'
if source.resolve()!=kept.resolve():shutil.copyfile(source,kept)
hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=dict(source=str(kept),sourceSha256=hash(source),originalPlaybackFile=str(old_path),originalPlaybackSha256=hash(old_path),
 output=str(out),outputSha256=hash(out),sourceKey='E major / C♯ minor (supplied audio already transposed)',key='E major / C♯ minor',transposeSemitones=1,additionalTransposeSemitones=0,
 processor='Supplied E-major vocal retained at its existing pitch; high-quality polyphase 48 kHz to 44.1 kHz conversion only',
 fullSourceFrames=len(a),fullProcessedFrames=len(b),sourceSampleRate=rate,sourceExcerptStartSeconds=offset,
 previousSourceExcerptStartSeconds=33.98,envelopeAlignmentCorrelation=float(scores.max()),alignmentResolutionMs=1,
 frames=frames,sampleRate=old_rate,seconds=frames/old_rate,playbackRate=1,outputGain=gain,
 note='New source has a different lead-in. Only extraction offset changes; existing transport cue/pickup and playback length are retained. Supplied vocal is already +1 versus the prior E-flat excerpt; no second shift is applied. No pitch shift follows MIDI backing renders.')
(ref/'e-major-vocal.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
