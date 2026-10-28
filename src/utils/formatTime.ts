/** Format race seconds as "12.34s" or "1:05.20". Returns an em dash when unavailable. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

/** Format a gap between two finishers, e.g. "+0.12s". */
export function formatMargin(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  return `+${seconds.toFixed(2)}s`;
}
