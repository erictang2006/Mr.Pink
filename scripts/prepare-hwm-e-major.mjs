// Permanent arrangement copies. Original FLP/MIDI extraction remains untouched.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const backingPath='reference/here-with-me-remake/backing-source-events.json';
const leadPath='reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json';
const backingBytes=await readFile(backingPath),leadBytes=await readFile(leadPath);
const backing=JSON.parse(backingBytes),lead=JSON.parse(leadBytes);
const provenance={sourceKey:'E♭ major / C minor',playbackKey:'E major / C♯ minor',transposeSemitones:1};
backing.arrangement={...provenance,source:backingPath,sourceSha256:hash(backingBytes),unpitchedMidiChannels:[29]};
for(const selection of Object.values(backing.selections))for(const note of selection.notes)if(note.channel!==29)note.midi+=1;
lead.arrangement={...provenance,source:leadPath,sourceSha256:hash(leadBytes)};
for(const note of lead.events)note.midi_pitch+=1;
await writeFile('reference/here-with-me-remake/backing-events-e-major.json',JSON.stringify(backing,null,2)+'\n');
await writeFile('reference/here-with-me-drop-lead/lead-events-e-major.json',JSON.stringify(lead,null,2)+'\n');
console.log('Generated E-major arrangement MIDI: +1 exactly once; percussion unchanged.');
