import type { BallState, EngineEvent, ObstacleKind, Track } from '../types/game';
import {
  BUMPER_KICK,
  BUMPER_RESTITUTION,
  REST_THRESHOLD,
  WALL_RESTITUTION,
  applyRollingFriction,
  circleContact,
  collidePair,
  reflect,
  segmentContact,
} from './Physics';

export interface StepContext {
  dt: number;
  time: number;
  emit: (event: EngineEvent) => void;
}

/** Only impacts above this speed produce sounds/sparks, so resting contact stays quiet. */
const EVENT_MIN_IMPACT = 110;

function note(ctx: StepContext, ball: BallState, kind: ObstacleKind, obstacleId: number, impact: number, x: number, y: number): void {
  if (impact < EVENT_MIN_IMPACT || ball.hitCooldown > 0) return;
  ball.hitCooldown = 0.07;
  ctx.emit({ type: 'collision', kind, obstacleId, x, y, intensity: Math.min(1, impact / 900), color: ball.color });
}

/** Keeps a ball inside the arena without producing events (final safety pass). */
export function clampToArena(ball: BallState, width: number, floorY: number): void {
  if (ball.x < ball.radius) ball.x = ball.radius;
  else if (ball.x > width - ball.radius) ball.x = width - ball.radius;
  if (ball.y < ball.radius) ball.y = ball.radius;
  if (ball.y > floorY - ball.radius) {
    ball.y = floorY - ball.radius;
    if (ball.vy > 0) ball.vy *= -0.25;
    ball.vx *= 0.98;
  }
}

export function collideWalls(ball: BallState, width: number, ctx: StepContext): void {
  const r = ball.radius;
  if (ball.x < r) {
    ball.x = r;
    if (ball.vx < 0) {
      const impact = -ball.vx;
      ball.vx = impact < REST_THRESHOLD ? 0 : impact * WALL_RESTITUTION;
      note(ctx, ball, 'wall', 0, impact, 0, ball.y);
    }
  } else if (ball.x > width - r) {
    ball.x = width - r;
    if (ball.vx > 0) {
      const impact = ball.vx;
      ball.vx = impact < REST_THRESHOLD ? 0 : -impact * WALL_RESTITUTION;
      note(ctx, ball, 'wall', 0, impact, width, ball.y);
    }
  }
  if (ball.y < r) {
    ball.y = r;
    if (ball.vy < 0) ball.vy = -ball.vy * 0.3;
  }
}

/** Collides one ball with every nearby static or rotating obstacle. */
export function collideTrack(ball: BallState, track: Track, ctx: StepContext): void {
  const r = ball.radius;

  for (const c of track.circles) {
    if (Math.abs(ball.y - c.y) > r + c.r || Math.abs(ball.x - c.x) > r + c.r) continue;
    const contact = circleContact(ball, c.x, c.y, c.r);
    if (!contact) continue;
    const bumper = c.kind === 'bumper';
    const impact = reflect(
      ball,
      contact,
      bumper ? BUMPER_RESTITUTION : ball.restitution,
      0,
      0,
      bumper ? BUMPER_KICK : 0,
    );
    note(ctx, ball, c.kind, c.id, impact, c.x, c.y);
  }

  for (const s of track.segments) {
    const half = s.thickness / 2;
    if (ball.y + r + half < Math.min(s.ay, s.by) || ball.y - r - half > Math.max(s.ay, s.by)) continue;
    const hit = segmentContact(ball, s.ax, s.ay, s.bx, s.by, half);
    if (!hit) continue;
    const impact = reflect(ball, hit.contact, ball.restitution * 0.75);
    applyRollingFriction(ball, hit.contact, ctx.dt);
    note(ctx, ball, 'ramp', s.id, impact, hit.px, hit.py);
  }

  for (const sp of track.spinners) {
    const reach = sp.halfLength + sp.thickness / 2 + r;
    if (Math.abs(ball.y - sp.cy) > reach || Math.abs(ball.x - sp.cx) > reach) continue;
    const ca = Math.cos(sp.angle) * sp.halfLength;
    const sa = Math.sin(sp.angle) * sp.halfLength;
    const hit = segmentContact(ball, sp.cx - ca, sp.cy - sa, sp.cx + ca, sp.cy + sa, sp.thickness / 2);
    if (!hit) continue;
    // Surface velocity of the rotating bar at the contact point: omega x (p - c)
    const svx = -sp.omega * (hit.py - sp.cy);
    const svy = sp.omega * (hit.px - sp.cx);
    const impact = reflect(ball, hit.contact, 0.65, svx, svy);
    note(ctx, ball, 'spinner', sp.id, impact, hit.px, hit.py);
  }
}

/** Ball-ball collisions. `order` is iterated as given (the engine alternates direction). */
export function collidePairs(order: BallState[], ctx: StepContext): void {
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j];
      const impact = collidePair(a, b);
      if (impact > 0) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        note(ctx, a, 'ball', 0, impact, mx, my);
        if (a.hitCooldown === 0) note(ctx, b, 'ball', 0, impact, mx, my);
      }
    }
  }
}
