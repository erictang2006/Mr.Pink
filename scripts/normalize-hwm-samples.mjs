// Generation-only: decode supplied files, including Vorbis-in-WAV Piezo samples.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {OfflineAudioContext}=await import(process.env.NODE_AUDIO_MODULE);
const root='reference/here-with-me-remake',source=root+'/extracted/',dest=root+'/normalized-samples/';
const manifest=JSON.parse(await readFile(root+'/backing-source-events.json','utf8'));
const channels=manifest.channels;
const files=new Set(Object.values(manifest.selections).flatMap(s=>[...s.audio.map(x=>x.file),...s.notes.filter(x=>x.channel===29).map(()=>channels.find(c=>c.id===29).sampleFile)]));
for(const zone of channels.find(c=>c.id===14).zones)if(zone.present)files.add(zone.file);
await mkdir(dest,{recursive:true});const report=[];
const ctx=new OfflineAudioContext(2,44100,44100);
for(const file of files){
 let bytes=await readFile(source+file);const hash=createHash('sha256').update(bytes).digest('hex');
 let vorbis=false;
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.indexOf('OggS')>0){bytes=bytes.subarray(bytes.indexOf('OggS'));vorbis=true;}
 const audio=await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const count=audio.numberOfChannels,channels=Array.from({length:count},(_,i)=>audio.getChannelData(i));
 const out=Buffer.alloc(44+audio.length*count*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(3,20);out.writeUInt16LE(count,22);out.writeUInt32LE(44100,24);out.writeUInt32LE(44100*count*4,28);out.writeUInt16LE(count*4,32);out.writeUInt16LE(32,34);out.write('data',36);out.writeUInt32LE(out.length-44,40);
 for(let i=0;i<audio.length;i++)for(let c=0;c<count;c++)out.writeFloatLE(channels[c][i],44+(i*count+c)*4);
 await writeFile(dest+file+'.wav',out);
 report.push({file,sourceSha256:hash,normalized:file+'.wav',normalizedSha256:createHash('sha256').update(out).digest('hex'),frames:audio.length,channels:count,rate:44100,vorbisUnwrapped:vorbis});
}
await writeFile(root+'/analysis/normalized-samples.json',JSON.stringify(report,null,2)+'\n');
console.log('Decoded',report.length,'actual supplied samples; vocal excluded.');
