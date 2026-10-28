import type { CircleObstacle, SegmentObstacle, SpinnerObstacle, Track } from '../types/game';
import { Rng, range, sign } from '../utils/random';

/** World geometry (all units are "world pixels"; the renderer scales to fit the canvas). */
export const WORLD_WIDTH = 800;
export const START_Y = 60;
export const FINISH_Y = 5000;
export const FLOOR_Y = 5170;
export const WORLD_HEIGHT = 5200;

/**
 * Builds the "Rush Canyon" course, a vertical drop with five sections:
 *   A) a peg field (plinko)      B) eight zig-zag ramps with bumpers
 *   C) rotating bars             D) a bumper cluster       E) a funnel into the finish
 * Every ramp leaves a gap of >= 160px and every other opening is >= 3x the largest ball
 * diameter, so every ball can always reach the finish line.
 * The layout is fixed; only spinner phase and direction are randomised per race.
 */
export function buildTrack(rng: Rng): Track {
  let nextId = 1;
  const circles: CircleObstacle[] = [];
  const segments: SegmentObstacle[] = [];
  const spinners: SpinnerObstacle[] = [];

  const peg = (x: number, y: number) =>
    circles.push({ id: nextId++, kind: 'peg', x, y, r: 9, hue: 225 });
  const bumper = (x: number, y: number, r: number, hue: number) =>
    circles.push({ id: nextId++, kind: 'bumper', x, y, r, hue });
  const ramp = (ax: number, ay: number, bx: number, by: number) =>
    segments.push({ id: nextId++, kind: 'ramp', ax, ay, bx, by, thickness: 8 });
  const spinner = (cx: number, cy: number, halfLength: number, omega: number) =>
    spinners.push({
      id: nextId++,
      kind: 'spinner',
      cx,
      cy,
      halfLength,
      thickness: 9,
      angle: range(rng, 0, Math.PI * 2),
      omega: omega * sign(rng),
    });

  // A) Peg field
  for (let row = 0; row < 9; row++) {
    const y = 330 + row * 85;
    if (row % 2 === 0) for (let k = 0; k < 8; k++) peg(50 + 100 * k, y);
    else for (let k = 0; k < 7; k++) peg(100 + 100 * k, y);
  }

  // B) Zig-zag ramps (even: open on the right, odd: open on the left)
  for (let i = 0; i < 8; i++) {
    const y0 = 1150 + i * 250;
    if (i % 2 === 0) {
      ramp(0, y0, 640, y0 + 100);
      bumper(260, y0 + (260 / 640) * 100 - 62, 12, 175 + i * 12);
    } else {
      ramp(800, y0, 160, y0 + 100);
      bumper(540, y0 + (260 / 640) * 100 - 62, 12, 175 + i * 12);
    }
  }

  // C) Rotating bars
  spinner(200, 3200, 85, 1.9);
  spinner(600, 3200, 85, 1.9);
  spinner(400, 3430, 105, 1.6);
  spinner(200, 3660, 85, 1.9);
  spinner(600, 3660, 85, 1.9);
  spinner(400, 3890, 105, 1.6);

  // D) Bumper cluster
  [200, 400, 600].forEach((x) => bumper(x, 4080, 22, 320));
  [100, 300, 500, 700].forEach((x) => bumper(x, 4230, 22, 290));
  [200, 400, 600].forEach((x) => bumper(x, 4380, 22, 200));

  // E) Funnel into the finish (200px opening)
  ramp(0, 4560, 300, 4790);
  ramp(800, 4560, 500, 4790);

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    finishY: FINISH_Y,
    floorY: FLOOR_Y,
    circles,
    segments,
    spinners,
  };
}
