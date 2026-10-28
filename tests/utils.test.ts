import { describe, expect, it } from 'vitest';
import { formatMargin, formatTime } from '../src/utils/formatTime';
import { mulberry32, shuffle } from '../src/utils/random';

describe('formatTime', () => {
  it('formats seconds, minutes and missing values', () => {
    expect(formatTime(12.345)).toBe('12.35s');
    expect(formatTime(65.2)).toBe('1:05.20');
    expect(formatTime(null)).toBe('—');
    expect(formatTime(NaN)).toBe('—');
    expect(formatMargin(0.123)).toBe('+0.12s');
  });
});

describe('random', () => {
  it('mulberry32 is repeatable and stays in [0, 1)', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffle returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(mulberry32(1), input);
    expect(out.slice().sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
