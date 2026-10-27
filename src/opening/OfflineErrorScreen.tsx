import {memo,useMemo,type CSSProperties} from 'react';
import {introTypingConfig} from './typingTest';
import type {OpeningSnapshot} from './sequence';
import './offlineError.css';

/** Delays are measured from the existing controller's physical-completion timestamp. */
export function offlineErrorStyle(snapshot:OpeningSnapshot,now:number):CSSProperties {
  const elapsed=Math.max(0,now-(snapshot.introOrigin??now)-introTypingConfig.completionHold);
  return {
    '--offline-glitch':`${introTypingConfig.offlineGlitch}ms`,
    '--offline-fade':`${introTypingConfig.offlineFade}ms`,
    '--offline-glitch-at':`${introTypingConfig.offlineHold-elapsed}ms`,
    '--offline-fade-at':`${introTypingConfig.offlineHold+introTypingConfig.offlineGlitch-elapsed}ms`,
  } as CSSProperties;
}
function ErrorContent(){
  return <>
    <svg className="offline-dinosaur" viewBox="0 0 48 52" shapeRendering="crispEdges" aria-label="Dinosaur" role="img">
      <path fill="currentColor" d="M24 0h16v2h2v12H30v2h9v2H28v6h5v2h-3v3h-2v-3h-2v8h-2v4h-2v8h3v2h-5V38h-4v2h-2v6h3v2h-5V36H8v-2H6v-2H4v-2H2v-2H0V16h2v6h2v2h2v2h2v2h4v-2h2v-2h2v-2h2V4h2V2h4z"/>
      <path fill="#fff" d="M25 3h2v2h-2z"/>
      <path fill="currentColor" d="M0 40h8v1H0zm29 0h16v1H29zM0 47h4v1H0zm6-3h4v1H6zm36 2h1v1h-1z"/>
    </svg>
    <h1>No internet</h1>
    <div className="offline-instructions"><p>Try:</p><ul><li>Checking the network cables, modem, and router</li><li>Reconnecting to Wi-Fi</li></ul></div>
    <div className="offline-error-code">ERR_INTERNET_DISCONNECTED</div>
  </>;
}
/** Inline vector + local HTML/CSS only. This page never navigates or checks a network. */
export default memo(function OfflineErrorScreen({snapshot}:{snapshot:OpeningSnapshot}) {
  // Latch commit correction once so unrelated app updates cannot advance CSS twice.
  const style=useMemo(()=>offlineErrorStyle(snapshot,performance.now()),[snapshot.run,snapshot.introOrigin]);
  return <section className="offline-error-screen" style={style} aria-label="Simulated Chrome offline error">
    <div className="offline-content"><ErrorContent/></div>
    <div className="offline-content offline-echo" aria-hidden="true"><ErrorContent/></div>
    <div className="offline-content offline-echo is-secondary" aria-hidden="true"><ErrorContent/></div>
    <div className="offline-blackout" aria-hidden="true"/>
  </section>;
});
