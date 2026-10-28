import type { LiveEntry, RacePhase, RaceResult } from '../types/game';
import type { StoredRace } from '../game/results';
import { formatTime } from '../utils/formatTime';
import { BallPreview } from './BallPreview';

interface Props {
  phase: RacePhase;
  standings: LiveEntry[];
  results: RaceResult[] | null;
  lastRace: StoredRace | null;
}

export function Leaderboard({ phase, standings, results, lastRace }: Props) {
  let title = 'Standings';
  let rows: Array<{ id: string; position: number; name: string; color: string; right: string; progress?: number }> = [];
  let empty: string | null = null;

  if (phase === 'finished' && results) {
    title = 'Final results';
    rows = results.map((r) => ({
      id: r.id,
      position: r.position,
      name: r.name,
      color: r.color,
      right: r.finishTime === null ? 'DNF' : formatTime(r.finishTime),
    }));
  } else if (phase === 'setup') {
    if (lastRace) {
      title = 'Last race';
      rows = lastRace.results.map((r) => ({
        id: r.id,
        position: r.position,
        name: r.name,
        color: r.color,
        right: r.finishTime === null ? 'DNF' : formatTime(r.finishTime),
      }));
    } else {
      empty = 'Live standings appear here once the race starts.';
    }
  } else {
    title = phase === 'countdown' ? 'Get ready…' : 'Live standings';
    rows = standings.map((s) => ({
      id: s.id,
      position: s.position,
      name: s.name,
      color: s.color,
      right: s.finishTime !== null ? formatTime(s.finishTime) : `${Math.round(s.progress * 100)}%`,
      progress: s.progress,
    }));
  }

  return (
    <section className="panel leaderboard" aria-label={title}>
      <h2 className="panel-title">{title}</h2>
      {empty ? (
        <p className="muted">{empty}</p>
      ) : (
        <ol className="board">
          {rows.map((r) => (
            <li key={r.id} className={`board-row${r.position === 1 ? ' first' : ''}`}>
              <span className="board-pos">{r.position}</span>
              <BallPreview color={r.color} size={20} />
              <span className="board-name" title={r.name}>
                {r.name}
              </span>
              <span className="board-time">{r.right}</span>
              {r.progress !== undefined && (
                <span className="board-bar" style={{ width: `${r.progress * 100}%`, background: r.color }} />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
