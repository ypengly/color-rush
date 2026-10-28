import type { BallState, Participant } from '../types/game';
import { Rng, clamp, exponential, range } from '../utils/random';

/** Smaller balls when there are more of them, so 20 racers still fit through every gap. */
export function ballRadiusFor(count: number): number {
  return clamp(18 - (count - 2) * 0.45, 9.5, 18);
}

/**
 * Creates a ball. The random traits below are drawn from the same distribution for every
 * ball, regardless of name, colour or list position, so nobody is secretly favoured.
 */
export function createBall(p: Participant, radius: number, x: number, y: number, rng: Rng): BallState {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    radius,
    x,
    y,
    prevY: y,
    vx: 0,
    vy: 0,
    restitution: range(rng, 0.38, 0.52),
    dragFactor: range(rng, 0.92, 1.08),
    nextBoostAt: Infinity,
    boostUntil: 0,
    stillTime: 0,
    hitCooldown: 0,
    finishTime: null,
    finishPosition: null,
  };
}

/** Gives the ball its random initial velocity and schedules its first boost. */
export function launchBall(ball: BallState, rng: Rng, time: number): void {
  ball.vx = range(rng, -140, 140);
  ball.vy = range(rng, 0, 90);
  ball.nextBoostAt = time + 1.2 + exponential(rng, 3.5);
}

/** Occasional random boost: a downward-ish burst with a sideways kick. */
export function boostBall(ball: BallState, rng: Rng, time: number): void {
  ball.vy += range(rng, 160, 300);
  ball.vx += range(rng, -140, 140);
  ball.boostUntil = time + 0.6;
  ball.nextBoostAt = time + 2 + exponential(rng, 4);
}

export const speedOf = (ball: BallState): number => Math.hypot(ball.vx, ball.vy);
