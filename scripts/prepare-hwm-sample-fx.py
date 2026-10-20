"""Source sampler reverse/pitch/stretch preparation; no invented hits or vocals."""
from pathlib import Path
import json,hashlib
import numpy as np
from scipy import signal
from scipy.io import wavfile
root=Path('reference/here-with-me-remake');data=json.loads((root/'backing-source-events.json').read_text());out=root/'normalized-samples'
report=[]
for ch in data['channels']:
 if not ch.get('assetPresent') or ch['id'] not in {9,17,30}:continue
 rate,a=wavfile.read(out/(ch['sampleFile']+'.wav'));a=a.astype(np.float64)
 if a.ndim==1:a=a[:,None]
 if ch['reverse']:a=a[::-1].copy()
 pitch=2**(ch['pitchCents']/1200)
 if ch['stretchBeats']:
  # Resample pitch first, then a phase vocoder restores the actual FL clip duration.
  pitched=signal.resample_poly(a,10000,round(pitch*10000),axis=0)
  length=round(ch['stretchBeats']*.6*rate);stretchRate=len(pitched)/length;result=[]
  for c in range(pitched.shape[1]):
   _,_,d=signal.stft(pitched[:,c],fs=rate,nperseg=2048,noverlap=1536,boundary='zeros',padded=True)
   steps=np.arange(0,d.shape[1]-1,stretchRate);phase=np.angle(d[:,0]);advance=np.linspace(0,np.pi*512,d.shape[0]);v=np.zeros((d.shape[0],len(steps)),complex)
   for i,t in enumerate(steps):
    k=int(t);alpha=t-k;mag=(1-alpha)*np.abs(d[:,k])+alpha*np.abs(d[:,k+1]);v[:,i]=mag*np.exp(1j*phase)
    delta=np.angle(d[:,k+1])-np.angle(d[:,k])-advance;phase+=advance+delta-2*np.pi*np.round(delta/(2*np.pi))
   _,wave=signal.istft(v,fs=rate,nperseg=2048,noverlap=1536,boundary=True)
   result.append(np.pad(wave,(0,max(0,length-len(wave))))[:length])
  a=np.stack(result,axis=1)
 elif pitch!=1:a=signal.resample_poly(a,10000,round(pitch*10000),axis=0)
 filename=f'channel-{ch["id"]}.wav';wavfile.write(out/filename,rate,a.astype(np.float32))
 report.append(dict(channel=ch['id'],file=filename,sourceFile=ch['sampleFile'],reverse=ch['reverse'],pitchCents=ch['pitchCents'],stretchBeats=ch['stretchBeats'],seconds=len(a)/rate,sha256=hashlib.sha256((out/filename).read_bytes()).hexdigest(),limitation='Phase-vocoder approximation of FL Auto/Elastique time stretching' if ch['stretchBeats'] else None))
(root/'analysis/sample-fx-preparation.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
