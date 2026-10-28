import { useEffect, useRef } from 'react';
import type { LiveEntry, RacePhase } from '../types/game';
import { Countdown } from './Countdown';

interface Props {
  phase: RacePhase;
  countdown: string | null;
  leader: LiveEntry | null;
  closeCall: boolean;
  attachCanvas: (canvas: HTMLCanvasElement | null) => void;
  resize: (width: number, height: number, dpr: number) => void;
}

export function RaceArena({ phase, countdown, leader, closeCall, attachCanvas, resize }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the canvas sized to its container (window resizes, orientation changes, DPR).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const apply = () => {
      const w = wrap.clientWidth;
      if (w === 0) return;
      const h = Math.round(Math.min(Math.max(w * 0.9, 380), Math.max(380, window.innerHeight * 0.78)));
      wrap.style.height = `${h}px`;
      resize(w, h, Math.min(2, window.devicePixelRatio || 1));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [resize]);

  const live = phase === 'racing' || phase === 'paused';

  return (
    <div className="arena" ref={wrapRef}>
      <canvas ref={attachCanvas} className="arena-canvas" role="img" aria-label="Ball race arena" />

      {live && leader && (
        <div className="leader-chip" aria-live="polite">
          <span className="leader-dot" style={{ background: leader.color }} />
          <span className="leader-label">LEADER</span>
          <strong>{leader.name}</strong>
        </div>
      )}

      {phase === 'racing' && closeCall && <div className="photo-banner">CLOSE FINISH!</div>}
      {phase === 'paused' && <div className="paused-overlay">PAUSED</div>}
      {phase === 'setup' && (
        <div className="arena-hint">Press START RACE — the balls do the rest.</div>
      )}

      <Countdown value={countdown} />
    </div>
  );
}
