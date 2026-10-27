export {};
declare global {
  interface Window {
    mrPinkOpening?: {crashComplete:()=>boolean;cancel:()=>void};
    mrPinkRehearsal?: {typing:()=>boolean;message:()=>boolean;replay:()=>boolean;logo:()=>boolean;interstellar:()=>boolean;levels:()=>boolean;pianoTyping:()=>boolean;resetPianoTyping:()=>boolean;skipPianoTyping:()=>void;reset:()=>boolean;cancel:()=>void};
  }
}
