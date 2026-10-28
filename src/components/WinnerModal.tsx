import { useEffect, useMemo, useRef } from 'react';
import type { RaceResult, RaceStats } from '../types/game';
import { formatMargin, formatTime } from '../utils/formatTime';
import { BallPreview } from './BallPreview';

interface Props {
  open: boolean;
  results: RaceResult[] | null;
  stats: RaceStats | null;
  onRaceAgain: () => void;
  onClose: () => void;
}

const CONFETTI = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];

export function WinnerModal({ open, results, stats, onRaceAgain, onClose }: Props) {
  const againRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    againRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.8,
        duration: 2.6 + Math.random() * 2.2,
        color: CONFETTI[i % CONFETTI.length],
        rotate: Math.random() * 360,
      })),
    // regenerate each time the modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  if (!open || !results || !stats) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confetti" aria-hidden="true">
          {pieces.map((p, i) => (
            <i
              key={i}
              style={{
                left: `${p.left}%`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotate}deg)`,
              }}
            />
          ))}
        </div>

        {stats.photoFinish && <div className="photo-tag">PHOTO FINISH!</div>}
        <p className="modal-kicker">WINNER</p>
        <div className="winner-ball">
          <BallPreview color={stats.winnerColor} size={84} />
        </div>
        <h2 id="winner-title" className="winner-name" style={{ color: stats.winnerColor }}>
          {stats.winnerName}
        </h2>
        <p className="muted winner-meta">
          {formatTime(stats.winnerTime)}
          {stats.margin !== null && <> · won by {formatMargin(stats.margin).slice(1)}</>}
        </p>

        <ol className="board modal-board">
          {results.map((r) => (
            <li key={r.id} className={`board-row${r.position === 1 ? ' first' : ''}`}>
              <span className="board-pos">{r.position}</span>
              <BallPreview color={r.color} size={20} />
              <span className="board-name" title={r.name}>
                {r.name}
              </span>
              <span className="board-time">{r.finishTime === null ? 'DNF' : formatTime(r.finishTime)}</span>
            </li>
          ))}
        </ol>
        <p className="muted small">
          {stats.finishedCount} of {stats.totalCount} crossed the line
          {stats.averageTime !== null && <> · average {formatTime(stats.averageTime)}</>}
        </p>

        <div className="modal-actions">
          <button ref={againRef} className="btn btn-primary" onClick={onRaceAgain}>
            RACE AGAIN
          </button>
          <button className="btn" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
