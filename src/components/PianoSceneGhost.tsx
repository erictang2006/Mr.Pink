import {useLayoutEffect,useRef} from 'react';
/** One bounded copy bridges the map/label change; the real piano component stays mounted. */
export function capturePianoFrame(root:HTMLElement|null){
 const source=root?.querySelector<HTMLCanvasElement>('.performance-piano .piano-canvas');
 if(!source||source.width<1||source.height<1)return null;
 try{const image=document.createElement('canvas'),ratio=Math.min(1,1600/source.width,240/source.height);image.width=Math.max(1,Math.round(source.width*ratio));image.height=Math.max(1,Math.round(source.height*ratio));const ctx=image.getContext('2d');if(!ctx)return null;ctx.drawImage(source,0,0,image.width,image.height);return image;}catch{return null;}
}
export default function PianoSceneGhost({image}:{image:HTMLCanvasElement}){
 const ref=useRef<HTMLCanvasElement>(null);
 useLayoutEffect(()=>{const canvas=ref.current!;canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d')?.drawImage(image,0,0);return()=>{canvas.width=canvas.height=1;image.width=image.height=1;};},[image]);
 return <canvas ref={ref} className="levels-warp-keyboard-ghost" aria-hidden="true"/>;
}
