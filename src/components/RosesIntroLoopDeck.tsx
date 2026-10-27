import { useEffect, useState, type CSSProperties } from 'react';
import { rosesIntroLoopActive, rosesIntroLoopVisual } from '../piano/rosesIntro';
import type { RosesIntroEngine, RosesIntroSnapshot } from '../piano/rosesIntroEngine';

/** Reveal the armed source phrase at bar 13, separate from physical piano input. */
export default function RosesIntroLoopDeck({ engine, clock, leadMs = 0 }: { engine: RosesIntroEngine | null; clock: RosesIntroSnapshot | null; leadMs?: number }) {
  const [visual, setVisual] = useState(() => rosesIntroLoopVisual(16));
  const visible = !!clock && rosesIntroLoopActive(clock.status, clock.measure, clock.synthActive);
  useEffect(() => {
    if (!engine || !visible) return;
    let frame = 0, last = 0;
    const update = (now: number) => {
      if (!document.hidden && now - last >= 30) {
        last = now;
        const lead = clock?.status === 'running' ? leadMs * engine.tempo() / 60000 : 0;
        setVisual(rosesIntroLoopVisual(engine.scoreBeat() + lead));
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [engine, visible, clock?.status, leadMs]);
  if (!visible) return null;
  const dialStyle = { '--loop-progress': `${visual.progress * 100}%` } as CSSProperties;
  return <aside className="roses-intro-loop-deck" aria-label="Intro loop">
    <div className="roses-intro-loop-dial" style={dialStyle} aria-hidden="true"><span>↻</span></div>
    <div className="roses-intro-loop-content">
      <div className="roses-intro-loop-heading"><strong>INTRO LOOP</strong><span>BAR {visual.bar} / 4</span></div>
      <div className="roses-intro-loop-bars" aria-hidden="true">{[1, 2, 3, 4].map(bar => <i key={bar} className={bar === visual.bar ? 'active' : bar < visual.bar ? 'complete' : ''} />)}</div>
      <div className="roses-intro-loop-keys">{visual.keys.map(key => <kbd key={key.code} className={key.active ? 'active' : ''}>{key.label}</kbd>)}<small>{clock?.status === 'paused' ? 'PAUSED' : 'AUTO · 4 BARS'}</small></div>
    </div>
  </aside>;
}
