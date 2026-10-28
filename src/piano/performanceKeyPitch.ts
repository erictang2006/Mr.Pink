import {pianoTypingPitch} from '../opening/pianoTyping';
import {levelsEMajor} from './levelsRealPiano';
import {rosesIntroKeyPitch} from './rosesIntroKeys';
import {rosesIndividualChordPitch} from './rosesIndividualChords';
import {buildupLeadGesturePitches} from './rosesManualBuildupLead';
import type {RosesIntroEngine} from './rosesIntroEngine';

/** Song identity wins over an opening animation whose UI update may still be pending. */
export function performanceKeyPitch(
 event:Pick<KeyboardEvent,'code'|'shiftKey'>,transpose:number,song:string,pianoTyping:boolean,
 rosesTranspose:number,vocalKey:string,roses:Pick<RosesIntroEngine,'manualBuildupLeadPitch'|'bassInputPitch'> & Partial<Pick<RosesIntroEngine,'isSilentBuildupLeadGesture'>>,
):number|undefined {
 if(song==='roses'&&roses.isSilentBuildupLeadGesture?.(event.code))return buildupLeadGesturePitches[event.code];
 if(song==='roses')return rosesIntroKeyPitch(event.code,rosesTranspose-4,vocalKey)
  ??roses.manualBuildupLeadPitch(event.code)??rosesIndividualChordPitch(event.code)??roses.bassInputPitch(event.code);
 if(song==='levels'&&pianoTyping)return pianoTypingPitch(event.code,event.shiftKey,transpose,levelsEMajor);
 return undefined;
}
