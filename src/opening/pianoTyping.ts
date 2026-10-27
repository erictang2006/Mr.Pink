import {interstellarRobloxMap} from '../piano/interstellarRoblox';
import {getPitch} from '../piano/noteMapping';
import type {KeyboardMap} from '../piano/noteMapping';

/** Presentation only. Actual physical pitch lookup stays in KeyboardInputManager. */
export const pianoTypingConfig = {
  message:'WAIT!!! I CAN PLAY PIANO?',
  hold:1000,dissolve:650,characterPulse:320,particles:36,maxCharacters:96,
  get duration(){return this.hold+this.dissolve;},
} as const;
export type PianoTypingInput={serial:number;index:number;code:string;shift:boolean;at:number};
export const isPianoTypingScene=(scene:string)=>scene==='TYPING_PIANO_REVEAL';
export function editPianoTyping(text:string,key:string):string {
  if(key==='Backspace')return text.slice(0,-1);
  return key.length===1&&text.length<pianoTypingConfig.maxCharacters?text+key.toUpperCase():text;
}
/** Seeded, bounded finishing stardust; no sound, key events, or musical scheduling. */
export const pianoTypingParticles=Array.from({length:pianoTypingConfig.particles},(_,i)=>{
  const seed=(n:number)=>{const value=Math.sin(n*127.1+19.7)*43758.5453;return value-Math.floor(value);};
  return {left:5+seed(i+1)*90,top:28+seed(i+13)*44,x:(seed(i+21)-.5)*110,y:-24-seed(i+31)*95,size:i%9===0?2.5:i%3===0?1.6:.9,delay:seed(i+45)*90};
});

/** Reveal-only Shift+1 follows the active piano map, including Levels' E-major notes. */
export function pianoTypingPitch(code:string,shift:boolean,transpose=0,map:KeyboardMap=interstellarRobloxMap):number|undefined {
  return code==='Digit1'&&shift ? getPitch(map,code,shift,transpose)??undefined : undefined;
}
