import {useEffect,useRef} from 'react';
import {startFracture} from './fractureRuntime';
import type {OpeningFallback} from './sequence';

/** No per-frame React state; the sequence supplies the SAME absolute clock as CSS/input. */
export default function FractureCanvas({running,origin,mask,onFailure}:{running:boolean;origin?:number;mask:string;onFailure:(reason:OpeningFallback)=>void}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!running||origin===undefined)return;
    return startFracture(ref.current!,origin,mask,onFailure);
  },[running,origin,mask,onFailure]);
  return <canvas ref={ref} className="csa-fracture-canvas" aria-hidden="true"/>;
}
