import type { BallState } from '../types/game';
import { clamp } from '../utils/random';

/** Fixed simulation step (240 Hz keeps fast balls from tunnelling through thin obstacles). */
export const FIXED_DT = 1 / 240;
export const GRAVITY = 900;
export const AIR_DRAG = 0.1;
export const MAX_SPEED = 1500;
export const ROLL_FRICTION = 0.45;
/** Impacts slower than this don't bounce, which lets balls settle into rolling contact. */
export const REST_THRESHOLD = 45;
export const PAIR_RESTITUTION = 0.65;
export const WALL_RESTITUTION = 0.5;
export const BUMPER_RESTITUTION = 1.1;
export const BUMPER_KICK = 300;

export interface Contact {
  nx: number; // unit normal pointing from the obstacle toward the ball
  ny: number;
  depth: number; // penetration depth
}

/** Semi-implicit Euler step with gravity and air drag. */
export function integrate(ball: BallState, dt: number): void {
  ball.prevY = ball.y;
  ball.vy += GRAVITY * dt;
  const drag = Math.max(0, 1 - AIR_DRAG * ball.dragFactor * dt);
  ball.vx *= drag;
  ball.vy *= drag;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    const k = MAX_SPEED / speed;
    ball.vx *= k;
    ball.vy *= k;
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}

export function circleContact(ball: BallState, cx: number, cy: number, cr: number): Contact | null {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const reach = ball.radius + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-6) return { nx: 0, ny: -1, depth: reach };
  return { nx: dx / d, ny: dy / d, depth: reach - d };
}

/** Contact between a ball and a thick line segment (a capsule). */
export function segmentContact(
  ball: BallState,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  halfThickness: number,
): { contact: Contact; px: number; py: number } | null {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : clamp(((ball.x - ax) * abx + (ball.y - ay) * aby) / len2, 0, 1);
  const px = ax + abx * t;
  const py = ay + aby * t;
  const contact = circleContact(ball, px, py, halfThickness);
  return contact ? { contact, px, py } : null;
}

/**
 * Pushes the ball out of the obstacle and reflects its velocity (relative to the obstacle surface).
 * Returns the impact speed along the normal (0 when the ball was already separating).
 */
export function reflect(
  ball: BallState,
  c: Contact,
  restitution: number,
  surfaceVx = 0,
  surfaceVy = 0,
  minOutSpeed = 0,
): number {
  ball.x += c.nx * c.depth;
  ball.y += c.ny * c.depth;
  const rvx = ball.vx - surfaceVx;
  const rvy = ball.vy - surfaceVy;
  const vn = rvx * c.nx + rvy * c.ny;
  if (vn >= 0) return 0;
  const impact = -vn;
  const e = impact < REST_THRESHOLD ? 0 : restitution;
  let out = e * impact;
  if (minOutSpeed > 0 && out < minOutSpeed) out = minOutSpeed;
  ball.vx = surfaceVx + rvx - vn * c.nx + out * c.nx;
  ball.vy = surfaceVy + rvy - vn * c.ny + out * c.ny;
  return impact;
}

/** Small rolling resistance along a surface so balls don't accelerate forever on ramps. */
export function applyRollingFriction(ball: BallState, c: Contact, dt: number): void {
  const tx = -c.ny;
  const ty = c.nx;
  const vt = ball.vx * tx + ball.vy * ty;
  const k = ROLL_FRICTION * dt;
  ball.vx -= tx * vt * k;
  ball.vy -= ty * vt * k;
}

/** Equal-mass ball-ball collision. Returns the impact speed (0 if no collision). */
export function collidePair(a: BallState, b: BallState): number {
  const minDist = a.radius + b.radius;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) return 0;
  let dist = Math.hypot(dx, dy);
  if (dist >= minDist) return 0;
  if (dist < 1e-6) {
    dx = 1;
    dy = 0;
    dist = 1e-6;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;
  const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rvn >= 0) return 0;
  const impact = -rvn;
  const e = impact < REST_THRESHOLD ? 0 : PAIR_RESTITUTION;
  const j = (-(1 + e) * rvn) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  return impact;
}
