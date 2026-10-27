#!/usr/bin/env python3
"""Local preparation after AVFoundation PCM extraction; requires numpy/scipy.
Usage: python scripts/prepare-roses-original-recording.py decoded-stereo-48000.f32
No normalization, tempo/pitch change or resynthesis. Original MOV stays intact.
"""
from pathlib import Path
import sys, json, hashlib, wave
import numpy as np
from scipy import signal
from scipy.io import wavfile
root=Path(__file__).resolve().parents[1]
source=root/'reference/roses-original-recording/source.mov'
x=np.fromfile(sys.argv[1],dtype='<f4').reshape(-1,2);rate=48000
r,s=wavfile.read(root/'public/roses/Roses SnareClap.wav')
s=s.astype(float)/(2**(s.dtype.itemsize*8-1));s=s.mean(axis=1) if s.ndim>1 else s
x8=signal.resample_poly(x.mean(axis=1),1,6);s8=signal.resample_poly(s,8000,r)[:1600];s8-=s8.mean()
cross=signal.correlate(x8,s8,mode='valid',method='fft');power=signal.convolve(x8*x8,np.ones(len(s8)),mode='valid',method='fft')
norm=cross/np.sqrt(np.maximum(1e-12,power)*np.sum(s8*s8));norm[power<1e-7]=0
peaks,_=signal.find_peaks(norm,height=.2,distance=8000)
peaks=peaks[(peaks/8000>2)&(peaks/8000<21)]
assert len(peaks)==16
onsets=peaks/8000
start=float(np.median(onsets-np.arange(16)*1.2)-.6)
assert np.max(abs(onsets-(start+.6+np.arange(16)*1.2)))<.001
first=round(start*rate);frames=round(19.2*rate);audio=x[first:first+frames].astype(np.float64).copy();assert len(audio)==frames
# Two-sample safety ramp at the in-point; 10 ms end fade excludes the next bar's attack.
audio[:2]*=np.linspace(0,1,2)[:,None];fade=480;audio[-fade:]*=np.linspace(1,0,fade)[:,None]
assert np.max(abs(audio))<1
ints=np.rint(audio*8388608).astype('<i4').reshape(-1)
packed=ints.view(np.uint8).reshape(-1,4)[:,:3].copy().tobytes()
out=root/'public/roses/drop/roses-original-recording-8bars-100bpm.wav'
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(3);w.setframerate(rate);w.writeframes(packed)
hop=2400;levels=np.sqrt(np.mean(audio.reshape(-1,hop,2)**2,axis=(1,2)));scale=float(np.percentile(levels,95));visual=np.clip(levels/scale,0,1)
envelope={'hopSeconds':.05,'levels':[round(float(v),4) for v in visual]}
(root/'src/piano/rosesRecordedEnvelope.json').write_text(json.dumps(envelope,separators=(',',':'))+'\n')
meta={'source':'/Users/etang1/Movies/2026-10-22 17-41-09.mov','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'decoder':'macOS AVFoundation AVAssetReader, native float32; stereo 48000 Hz','sourceContainerSeconds':24.45,'sourceAudioSeconds':len(x)/rate,'inPointSeconds':first/rate,'outPointSeconds':(first+frames)/rate,'method':'16 original snare/clap waveform correlations at 8 kHz, 1.2 seconds apart; first clap minus 0.6 seconds is bar 37','clapOnsetsSeconds':onsets.tolist(),'maxTimingResidualSeconds':float(np.max(abs(onsets-(start+.6+np.arange(16)*1.2)))),'output':str(out.relative_to(root)),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'frames':frames,'sampleRate':rate,'channels':2,'bitsPerSample':24,'seconds':frames/rate,'bpm':100,'playbackRate':1,'pitchShiftSemitones':0,'normalization':False,'startRampSamples':2,'endFadeSeconds':.01,'peakDbfs':float(20*np.log10(np.max(abs(audio)))),'rmsDbfs':float(20*np.log10(np.sqrt(np.mean(audio**2)))),'content':'Original recorded instrumental: drums, bass, chords, original effects/decay. User confirmed instrumental only; no sung vocals. This is a full mix, not isolated stems.','limitations':'Lossy screen/system-audio capture of a YouTube Ableton remake; cannot recover an isolated or lossless source. Other existing WAV references are labeled FULL_MIX and are not verified as clean vocal-free instrumental exports of this approved recording; this mode uses the specified MOV.'}
(root/'reference/roses-original-recording/analysis.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
