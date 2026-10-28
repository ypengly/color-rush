import type { RaceResult, RaceStats } from '../types/game';

/** A gap smaller than this (seconds) is announced as a photo finish. */
export const PHOTO_FINISH_MARGIN = 0.15;

export function computeStats(results: readonly RaceResult[]): RaceStats | null {
  if (results.length === 0) return null;
  const [first, second] = results;
  const times = results.map((r) => r.finishTime).filter((t): t is number => t !== null);
  const margin =
    first.finishTime !== null && second && second.finishTime !== null ? second.finishTime - first.finishTime : null;
  return {
    winnerName: first.name,
    winnerColor: first.color,
    winnerTime: first.finishTime,
    margin,
    photoFinish: margin !== null && margin < PHOTO_FINISH_MARGIN,
    finishedCount: times.length,
    totalCount: results.length,
    averageTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
  };
}

export interface StoredRace {
  finishedAt: number;
  results: RaceResult[];
}

const STORAGE_KEY = 'colorrush:lastRace';

/** Keeps the most recent race for the current browser session (sessionStorage). */
export function saveLastRace(results: readonly RaceResult[]): StoredRace {
  const stored: StoredRace = { finishedAt: Date.now(), results: results.slice() };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* storage unavailable (private mode, tests): the in-memory copy is still returned */
  }
  return stored;
}

export function loadLastRace(): StoredRace | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRace;
    if (!parsed || !Array.isArray(parsed.results)) return null;
    return parsed;
  } catch {
    return null;
  }
}
