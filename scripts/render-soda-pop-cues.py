"""Original non-musical Foley-style DJ / soda cues. The song MP3 is never modified."""
import math, random, struct, wave
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public/audio/soda-pop'
rate=44100
for name,length in [('scratch',.26),('glitch',.15),('can',.23),('fizz',.48),('click',.045)]:
 rng=random.Random(name);samples=[];low=phase=0
 for i in range(int(length*rate)):
  t=i/rate;u=t/length;n=rng.uniform(-1,1);low+=.2*(n-low)
  if name=='scratch':
   speed=(1-u)**2*(.25+.75*abs(math.sin(t*37)))
   phase+=(140+2200*speed)/rate
   sample=(math.sin(phase*math.tau)*.35+low*.65)*math.sin(math.pi*u)**.5*(.45+.55*abs(math.sin(t*91)))
  elif name=='glitch':
   sample=(n*.4+math.sin(math.tau*(600+int(t*65)%4*470)*t)*.22)*(1-u)*(int(t*95)%3!=0)
  elif name=='click':
   sample=(math.sin(math.tau*1600*t)*.7+n*.16)*math.exp(-t*120)
  elif name=='can':
   snap=math.exp(-t*110)*(math.sin(math.tau*2350*t)*.75+n*.35)
   release=max(0,t-.035)
   sample=snap+(n-low)*.65*math.exp(-release*19)*min(1,release/.008)
  else:
   sample=(n-low)*.3*(1-u)**1.4
   for at in [.03,.09,.16,.25,.34]:
    age=t-at
    if age>0:sample+=math.sin(math.tau*(1400+age*13000)*age)*.24*math.exp(-age*130)
  fade=min(1,t/.001,(length-t)/.012)
  samples.append(max(-.9,min(.9,sample*fade)))
 with wave.open(str(root/(name+'.wav')),'wb') as f:
  f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<h',round(v*32767)) for v in samples))
print('Rendered four short local DJ / soda cues; song unchanged.')

# A short real-record tail makes the turntable brake recognizable even when
# bar 44's original source has already reached its scheduled end. Only this
# transition Foley is pitched down; Soda Pop itself always remains at 1x.
with wave.open(str(root.parents[1]/'roses/drop/roses-original-recording-8bars-100bpm.wav'),'rb') as original:
 channels=original.getnchannels();width=original.getsampwidth();source_rate=original.getframerate()
 count=original.getnframes();original.setpos(max(0,count-int(source_rate*.34)))
 raw=original.readframes(int(source_rate*.34))
 mono=[sum(int.from_bytes(raw[i+c*width:i+(c+1)*width],'little',signed=True)/(2**(8*width-1)) for c in range(channels))/channels for i in range(0,len(raw),width*channels)]
 length=.3;out=[]
 for i in range(int(length*rate)):
  t=i/rate;u=t/length;position=source_rate*length*(u-u*u/2);index=min(len(mono)-2,int(position));blend=position-index
  sample=(mono[index]*(1-blend)+mono[index+1]*blend)*min(1,t/.003,(length-t)/.025)
  out.append(max(-.95,min(.95,sample)))
 with wave.open(str(root/'brake.wav'),'wb') as f:
  f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<h',round(v*32767)) for v in out))
print('Rendered a 300 ms turntable brake from the existing final-record tail.')
