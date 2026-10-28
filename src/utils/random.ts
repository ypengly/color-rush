/** Seeded random helpers. Every random decision in a race flows through one seeded generator. */

export type Rng = () => number;

/** mulberry32: small, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, unpredictable seed for a new race. */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 4294967296);
}

export const range = (rng: Rng, min: number, max: number): number => min + (max - min) * rng();

export const sign = (rng: Rng): 1 | -1 => (rng() < 0.5 ? -1 : 1);

/** Exponentially distributed sample with the given mean. */
export const exponential = (rng: Rng, mean: number): number => -Math.log(1 - rng()) * mean;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Fisher-Yates shuffle returning a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
