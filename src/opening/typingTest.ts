/** Edit the passage here; the interaction and scene controller do not depend on its wording. */
export const introTypingConfig = {
  passage:"Hi, my name is Eric, and I can type relatively fast. I'm a junior and I represent CSA. I made this entire program for you guys, so I hope you enjoy the show",
  completionHold:400,
  offlineHold:1800,
  offlineGlitch:450,
  offlineFade:250,
  offlineBlackout:120,
  get crashDuration(){return this.offlineHold+this.offlineGlitch+this.offlineFade+this.offlineBlackout;},
  metricInterval:100,
} as const;
export type TypingSnapshot={passage:string;input:string;startedAt:number|null;finishedAt:number|null;attempts:number;correctAttempts:number;measuredInput?:string};
export function typingMetrics(state:TypingSnapshot,now:number) {
  const elapsedMs=state.startedAt===null?0:Math.max(0,(state.finishedAt??now)-state.startedAt);
  const correctCharacters=Array.from(state.measuredInput??state.input).reduce((sum,character,index)=>sum+Number(character===state.passage[index]),0);
  return {elapsedMs,correctCharacters,wpm:elapsedMs>0?correctCharacters*12000/elapsedMs:0,accuracy:state.attempts?state.correctAttempts/state.attempts*100:100};
}
/** Physical input, plus an explicit Enter rehearsal completion. Attempt history stays real. */
export class IntroTypingTest {
  private state:TypingSnapshot;
  constructor(passage:string=introTypingConfig.passage){
    if(!passage.length)throw Error('The opening passage must contain text.');
    this.state={passage,input:'',startedAt:null,finishedAt:null,attempts:0,correctAttempts:0};
  }
  snapshot=():TypingSnapshot=>this.state;
  input(key:string,now:number):boolean {
    const state=this.state;if(state.finishedAt!==null)return false;
    if(key==='Enter'){
      this.state={...state,input:state.passage,finishedAt:now,measuredInput:state.input};return true;
    }
    if(key==='Backspace'){
      if(!state.input.length)return false;
      this.state={...state,input:state.input.slice(0,-1)};return true;
    }
    if(key.length!==1||state.input.length>=state.passage.length)return false;
    const input=state.input+key,correct=key===state.passage[state.input.length];
    this.state={...state,input,startedAt:state.startedAt??now,finishedAt:input===state.passage?now:null,attempts:state.attempts+1,correctAttempts:state.correctAttempts+Number(correct)};
    return true;
  }
}
export const isTypingScene=(scene:string)=>['TYPING_TEST','TYPING_COMPLETE','SIMULATED_CRASH'].includes(scene);
