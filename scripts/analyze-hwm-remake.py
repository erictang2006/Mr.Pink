"""Read-only FL 12 analysis. Generation dependency: PyFLP 2.2.1 (outside app).
Playlist/notes independently decoded from the event stream; PyFLP supplies channel/plugin models.
"""
from pathlib import Path
import struct,json,hashlib,re,collections,math
import pyflp
from pyflp.pattern import PatternID
from pyflp.plugin import PluginID
from pyflp.arrangement import TrackID
from pyflp.mixer import InsertID,MixerID,SlotID
root=Path('reference/here-with-me-remake');src=root/'extracted';report=root/'analysis';report.mkdir(exist_ok=True)
flp=src/'Remake.flp';data=flp.read_bytes();p=pyflp.parse(flp)
sha=lambda b:hashlib.sha256(b).hexdigest()
# Independent FL event framing: fixed 1/2/4 bytes below 192, varint otherwise.
off=22;events=[]
assert data[:4]==b'FLhd' and data[14:18]==b'FLdt' and p.ppq==96
while off<len(data):
 eid=data[off];off+=1
 if eid<192:length=1 if eid<64 else 2 if eid<128 else 4
 else:
  length=0;shift=0
  while True:
   v=data[off];off+=1;length|=(v&127)<<shift;shift+=7
   if not v&128:break
 payload=data[off:off+length];off+=length;events.append((eid,payload))
assert off==len(data)
playlist=[];patterns={};pid=None
for eid,raw in events:
 if eid==int(PatternID.New):pid=struct.unpack('<H',raw)[0]
 if eid==int(PatternID.Notes):
  notes=[]
  assert len(raw)%24==0
  for at in range(0,len(raw),24):
   n=raw[at:at+24];pos,flags,ch,length,key,group=struct.unpack_from('<IHHIHH',n)
   notes.append(dict(tick=pos,flags=flags,channel=ch,durationTicks=length,midi=key,velocity=n[21],pan=n[20]))
  patterns[pid]=notes
 if eid==233:
  assert len(raw)%32==0
  for at in range(0,len(raw),32):
   pos,base,index,length,track,group=struct.unpack_from('<IHHIHH',raw,at)
   flags=struct.unpack_from('<H',raw,at+18)[0]
   # Pattern offsets are signed ticks; audio offsets are floating milliseconds.
   pat=index>base;start=struct.unpack_from('<i' if pat else '<f',raw,at+24)[0]
   playlist.append(dict(index=len(playlist),position=pos,length=length,pattern=index-base if pat else None,channel=None if pat else index,track=199-track,flags=flags,offset=max(0,start),startBar=pos/384+1,endBar=(pos+length)/384+1))
assert len(playlist)==524 and {x['flags'] for x in playlist}=={64}
# Cross-check every raw note against the parser, not just the lead reference.
for pattern in p.patterns:
 actual=[(n.position,n.rack_channel,n.length,n._item.key,n.velocity) for n in pattern.notes]
 expected=[(n['tick'],n['channel'],n['durationTicks'],n['midi'],n['velocity']) for n in patterns[pattern.iid]]
 assert actual==expected
tracks={e.value.iid:bool(e.value.enabled) for e in p.events if e.id==TrackID.Data}
channels={};blobs={}
for c in p.channels:
 row=dict(id=c.iid,name=c.name,kind=type(c).__name__,enabled=bool(c.enabled),volumeRaw=c.volume,panRaw=c.pan)
 try:row['mixerInsert']=c.insert
 except AttributeError:pass
 if row['kind']=='Sampler':
  row['samplePath']=str(c.sample_path) if c.sample_path else None
  row['sampleFile']=str(c.sample_path).replace('\\','/').split('/')[-1] if c.sample_path else None
  row['assetPresent']=bool(row['sampleFile'] and (src/row['sampleFile']).exists())
  row['rootMidi']=c.keyboard.root_note
  row['pitchCents']=c.pitch_shift or 0
  row['reverse']=bool(c.fx.reverse)
  t=c.stretching.time
  row['stretchBeats']=(t.bars*4+t.beats+t.ticks/96) if t else 0
  row['stretchMode']=str(c.stretching.mode)
 if row['kind']=='Automation':row['points']=[dict(beat=x.position,value=x.value,tension=x.tension) for x in c]
 if row['kind']=='Instrument':
  plugin=c.plugin;ev=plugin.events.first(PluginID.Data);blob=bytes(ev);blobs[c.iid]=blob
  (report/f'channel-{c.iid}-plugin-event.bin').write_bytes(blob)
  row.update(plugin=getattr(plugin,'name',None) or c.internal_name,vendor=getattr(plugin,'vendor',None),stateSha256=sha(blob),stateBytes=len(blob))
  row['stateTextHints']=[s.decode('utf-16-le',errors='ignore') for s in re.findall(rb'(?:[ -~]\x00){6,}',blob)][:12]
  if c.internal_name=='DirectWave':
   raw=ev.value;zones=[]
   for match in re.finditer(re.escape(struct.pack('<I',500)+struct.pack('<Q',25)),raw):
    z=match.start()+12;rootKey,low,high,velLow,velHigh=raw[z:z+5]
    npos=raw.find(struct.pack('<I',502),z+25)
    if npos<0:continue
    nlen=struct.unpack_from('<Q',raw,npos+4)[0];path=raw[npos+12:npos+12+nlen].decode('utf8',errors='replace').strip('\x00')
    name=path.replace('\\','/').split('/')[-1]
    zones.append(dict(root=rootKey,low=low,high=high,velocityLow=velLow,velocityHigh=velHigh,file=name,present=(src/name).exists()))
   row['zones']=zones;row['missingFiles']=sorted({z['file'] for z in zones if not z['present']})
  else:row['originalSoundAvailable']=False
 channels[c.iid]=row
# FL 12's mixer blocks end with Output. Preserve effects, routing and opaque states.
blocks=[];block=None;effect=None;inside=False
for e in p.events:
 if e.id==MixerID.APDC:inside=True
 if not inside:continue
 if block is None:block=dict(index=len(blocks),name=None,effects=[])
 if e.id==InsertID.Name:block['name']=e.value
 if e.id==InsertID.Flags:block['flags']=str(e.value.flags)
 if e.id==InsertID.Routing:block['routes']=[i for i,on in enumerate(e.value) if on]
 if e.id==PluginID.InternalName:effect=dict(plugin=e.value)
 if e.id==PluginID.Data and effect is not None:
  raw=bytes(e);effect.update(stateSha256=sha(raw),stateBytes=len(raw));effect['_raw']=raw
  if e.__class__.__name__=='VSTPluginEvent':
   for entry in e.value.events:
    if str(entry.id).endswith('.Name'):effect['pluginName']=entry.data
 if e.id==SlotID.Index:
  if effect is not None:
   effect['slot']=e.value
   if '_raw' in effect:
    file=f'mixer-{block["index"]}-slot-{e.value}.bin';(report/file).write_bytes(effect.pop('_raw'));effect['stateFile']=file
   block['effects'].append(effect);effect=None
 if e.id==InsertID.Output:blocks.append(block);block=None
# Keep the raw mixer parameter payload: old-version packing is not assumed to be a modern schema.
for eid,raw in events:
 if eid==int(MixerID.Params):(report/'mixer-parameters.bin').write_bytes(raw)
roles={2:'chords',3:'chords',13:'bass',14:'chords',18:'chords',19:'chords',20:'chords',21:'chords',22:'chords',23:'bass',24:'bass',26:'bass'}
fx={7,9,11,12,15,16,30,31,32};drums={4,5,6,8,10,17,27,28,29,33,34,35}
selections={}
for mode,first,last in [('build',18,25),('drop',26,33)]:
 start=(first-1)*384;end=last*384;notes=[];clips=[];automations=[];excluded=[]
 for clip in playlist:
  if clip['position']>=end or clip['position']+clip['length']<=start:continue
  if not tracks.get(clip['track'],True):excluded.append(dict(clip=clip['index'],reason='disabled playlist track'));continue
  if clip['pattern'] is not None:
   for n in patterns[clip['pattern']]:
    ch=channels[n['channel']];at=clip['position']+n['tick']-clip['offset'];limit=clip['position']+clip['length']
    if at<clip['position'] or at>=limit or at>=end or at+max(1,n['durationTicks'])<=start:continue
    if not ch['enabled'] or n['channel'] not in roles and n['channel'] not in drums:
     excluded.append(dict(clip=clip['index'],channel=n['channel'],reason='unassigned/unsupported silent sampler' if n['channel']==41 else 'not a selected instrumental channel'));continue
    duration=min(at+n['durationTicks'],limit,end)-max(at,start)
    notes.append(dict(n,tick=max(start,at)-start,sourceTick=at,sourcePattern=clip['pattern'],sourceClip=clip['index'],durationTicks=max(0,duration),group=roles.get(n['channel'],'drums')))
  else:
   ch=channels[clip['channel']]
   if ch['kind']=='Automation':
    automations.append(dict(channel=clip['channel'],tick=clip['position']-start,lengthTicks=clip['length'],offsetBeats=clip['offset']/1000,points=ch['points']));continue
   if clip['channel']==0:excluded.append(dict(clip=clip['index'],channel=0,reason='source vocal deliberately excluded; existing Mr Pink vocal retained'));continue
   if not ch['enabled'] or not ch.get('assetPresent'):excluded.append(dict(clip=clip['index'],channel=ch['id'],reason='disabled or missing sample'));continue
   at=max(start,clip['position']);duration=min(end,clip['position']+clip['length'])-at
   clips.append(dict(channel=ch['id'],tick=at-start,sourceTick=clip['position'],sourceClip=clip['index'],durationTicks=duration,offsetSeconds=clip['offset']/1000+(at-clip['position'])/96*.6,file=ch['sampleFile'],group='fx' if ch['id'] in fx else 'drums'))
 notes.sort(key=lambda n:(n['tick'],n['channel'],n['midi']));clips.sort(key=lambda n:(n['tick'],n['channel']))
 selections[mode]=dict(sourceBars=[first,last],targetBars=[29,36],notes=notes,audio=clips,automation=automations,excluded=excluded)
 for ch in channels.values():
  n=[n for n in notes if n['channel']==ch['id']];a=[n for n in clips if n['channel']==ch['id']]
  ch.setdefault('selectedRegions',{})[mode]=dict(noteCount=len(n),audioClipCount=len(a),bars=sorted({int((start+x['tick'])//384+1) for x in n+a}))
for ch in channels.values():
 ch['role']='automation control' if ch['kind']=='Automation' else 'vocal (excluded)' if ch['id']==0 else roles.get(ch['id'],'FX' if ch['id'] in fx else 'drum/percussion' if ch['id'] in drums else 'not used in selected regions')
 if ch['kind']=='Instrument':ch['reproduction']='included Piezo zones; local sampler' if ch['id']==14 else 'source MIDI with distinct synth approximation; original plugin/library not available'
 elif ch['kind']=='Sampler':ch['reproduction']='actual supplied sample' if ch.get('assetPresent') else 'no assigned/present sample; not synthesized'
rawReport=dict(sourceSha256=sha(data),version=str(p.version),bpm=p.tempo,ppq=p.ppq,timeSignature=[p.arrangements.time_signature.num,p.arrangements.time_signature.beat],parser='PyFLP 2.2.1 plus independent framing/notes/FL12 playlist-offset decoder',playlistFlags=dict(collections.Counter(x['flags'] for x in playlist)),playlistTracks=tracks,channels=list(channels.values()),patterns=patterns,playlist=playlist,mixer=blocks,selections=selections)
(report/'inventory.json').write_text(json.dumps(rawReport,indent=2)+'\n')
# Generation data only, kept outside the runtime web assets.
(root/'backing-source-events.json').write_text(json.dumps(dict(sourceSha256=sha(data),bpm=p.tempo,ppq=p.ppq,channels=list(channels.values()),mixer=blocks,selections=selections),indent=2)+'\n')
for mode,sel in selections.items():
 print(mode,'source',sel['sourceBars'],'notes',len(sel['notes']),'audio',len(sel['audio']),'channels',dict(collections.Counter(n['channel'] for n in sel['notes'])), 'clips',dict(collections.Counter(n['channel'] for n in sel['audio'])))
print('Mixer',[(b['index'],b['name'],[e.get('pluginName',e['plugin']) for e in b['effects']],b.get('routes',[])) for b in blocks if b['effects']])
