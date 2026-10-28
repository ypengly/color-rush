import type {
  BallState,
  EngineEvent,
  EngineStatus,
  LiveEntry,
  Participant,
  RaceResult,
  Track,
} from '../types/game';
import { Rng, mulberry32, randomSeed, range, shuffle } from '../utils/random';
import { ballRadiusFor, boostBall, createBall, launchBall, speedOf } from './Ball';
import { StepContext, clampToArena, collidePairs, collideTrack, collideWalls } from './CollisionSystem';
import { FIXED_DT, integrate } from './Physics';
import { FINISH_Y, START_Y, buildTrack } from './Track';

export const MIN_BALLS = 2;
export const MAX_BALLS = 20;
/** Seconds the simulation keeps running after the winner crosses, so close finishers get times. */
export const FINISH_GRACE = 1.8;
/** Failsafe: a race that somehow lasts this long is ended and ranked by progress. */
export const MAX_RACE_TIME = 120;
const MAX_STEPS_PER_ADVANCE = 80;

/**
 * Headless race simulation. It knows nothing about React or the canvas, so it can be
 * driven (and tested) with plain function calls: `start()` then `advance(dt)` / `step()`.
 */
export class RaceEngine {
  readonly seed: number;
  readonly track: Track;
  readonly balls: BallState[];
  /** Y coordinate of the (purely visual) starting gate under the spawn area. */
  readonly gateY: number;

  status: EngineStatus = 'ready';
  time = 0;
  winner: BallState | null = null;

  private readonly rng: Rng;
  /** Balls in randomly shuffled slot order; used for every iteration so no list position is favoured. */
  private readonly simOrder: BallState[];
  private readonly ctx: StepContext;
  private events: EngineEvent[] = [];
  private accumulator = 0;
  private finishCount = 0;
  private finishingEndsAt = 0;
  private parity = false;
  private results: RaceResult[] | null = null;

  constructor(participants: readonly Participant[], seed: number = randomSeed()) {
    if (participants.length < MIN_BALLS || participants.length > MAX_BALLS) {
      throw new Error(`A race needs between ${MIN_BALLS} and ${MAX_BALLS} participants.`);
    }
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.track = buildTrack(this.rng);

    const n = participants.length;
    const radius = ballRadiusFor(n);
    const spacing = radius * 2.4;
    const cols = Math.max(1, Math.floor((this.track.width - 120) / spacing));
    const rows = Math.ceil(n / cols);
    this.gateY = START_Y + (rows - 1) * spacing + radius + 10;

    // Random slot for every participant, so starting position is never tied to list order.
    const slotOrder = shuffle(this.rng, participants.map((_, i) => i));
    const balls: BallState[] = new Array(n);
    const order: BallState[] = [];
    for (let slot = 0; slot < n; slot++) {
      const row = Math.floor(slot / cols);
      const inRow = Math.min(cols, n - row * cols);
      const col = slot - row * cols;
      const x =
        this.track.width / 2 + (col - (inRow - 1) / 2) * spacing + range(this.rng, -0.15, 0.15) * radius;
      const y = START_Y + row * spacing;
      const idx = slotOrder[slot];
      const ball = createBall(participants[idx], radius, x, y, this.rng);
      balls[idx] = ball;
      order.push(ball);
    }
    this.balls = balls;
    this.simOrder = order;
    this.ctx = { dt: FIXED_DT, time: 0, emit: (e) => this.pushEvent(e) };
  }

  /** Releases the balls. Does nothing unless the race is in the 'ready' state. */
  start(): void {
    if (this.status !== 'ready') return;
    this.status = 'racing';
    this.time = 0;
    for (const b of this.simOrder) launchBall(b, this.rng, 0);
  }

  /** Advances the simulation by `dt` seconds of race time using fixed steps. Returns new events. */
  advance(dt: number): EngineEvent[] {
    if (this.status === 'ready' || this.status === 'finished' || !(dt > 0)) return [];
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_ADVANCE && !this.isFinished()) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_ADVANCE) this.accumulator = 0;
    return this.drainEvents();
  }

  /** One fixed physics step. No-op unless the race is running. */
  step(dt: number = FIXED_DT): void {
    if (this.status !== 'racing' && this.status !== 'finishing') return;
    this.time += dt;
    this.ctx.dt = dt;
    this.ctx.time = this.time;
    this.parity = !this.parity;

    for (const s of this.track.spinners) s.angle += s.omega * dt;

    const order = this.parity ? this.simOrder : this.reversedOrder();
    for (const b of order) {
      b.hitCooldown = Math.max(0, b.hitCooldown - dt);
      if (b.finishTime === null && this.time >= b.nextBoostAt) {
        boostBall(b, this.rng, this.time);
        this.pushEvent({ type: 'boost', id: b.id, x: b.x, y: b.y, color: b.color });
      }
      integrate(b, dt);
    }
    for (const b of order) {
      collideWalls(b, this.track.width, this.ctx);
      collideTrack(b, this.track, this.ctx);
    }
    collidePairs(order, this.ctx);
    for (const b of order) clampToArena(b, this.track.width, this.track.floorY);

    this.detectFinishes(dt);
    this.nudgeStuckBalls(dt);
    this.updateStatus();
  }

  /** Rotates the spinners while no race is running (idle animation). Never affects race state. */
  idleSpin(dt: number): void {
    if (this.status === 'racing' || this.status === 'finishing') return;
    for (const s of this.track.spinners) s.angle += s.omega * dt;
  }

  /** All balls, best first: finishers by time, then everyone else by distance travelled. */
  getStandings(): BallState[] {
    return this.balls.slice().sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      return b.y - a.y;
    });
  }

  getLeader(): BallState {
    return this.getStandings()[0];
  }

  getLive(): LiveEntry[] {
    return this.getStandings().map((b, i) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      position: i + 1,
      progress: b.finishTime !== null ? 1 : Math.max(0, Math.min(1, b.y / FINISH_Y)),
      finishTime: b.finishTime,
    }));
  }

  /** Final ranking. Null until the race has finished. */
  getResults(): RaceResult[] | null {
    return this.results;
  }

  /** True when two balls are fighting for the line, used to trigger slow motion. */
  isCloseFinish(): boolean {
    if (this.status !== 'racing') return false;
    let first: BallState | null = null;
    let second: BallState | null = null;
    for (const b of this.balls) {
      if (!first || b.y > first.y) {
        second = first;
        first = b;
      } else if (!second || b.y > second.y) {
        second = b;
      }
    }
    if (!first || !second) return false;
    return first.y > FINISH_Y - 380 && second.y > first.y - 110 && second.y > FINISH_Y - 460;
  }

  // ---------------------------------------------------------------------------

  /** Method (not a property read) so TypeScript doesn't keep a stale narrowed status inside loops. */
  private isFinished(): boolean {
    return this.status === 'finished';
  }

  private reversedOrder(): BallState[] {
    return this.simOrder.slice().reverse();
  }

  private pushEvent(e: EngineEvent): void {
    if (this.events.length < 400) this.events.push(e);
  }

  private drainEvents(): EngineEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private detectFinishes(dt: number): void {
    const crossed: BallState[] = [];
    for (const b of this.simOrder) {
      if (b.finishTime !== null || b.y < FINISH_Y) continue;
      // Interpolate the exact crossing time within this step.
      const travelled = b.y - b.prevY;
      const frac = travelled > 1e-9 ? Math.min(1, Math.max(0, (FINISH_Y - b.prevY) / travelled)) : 1;
      b.finishTime = this.time - dt + dt * frac;
      crossed.push(b);
    }
    crossed.sort((a, b) => (a.finishTime as number) - (b.finishTime as number));
    for (const b of crossed) {
      b.finishPosition = ++this.finishCount;
      this.pushEvent({
        type: 'finish',
        id: b.id,
        name: b.name,
        position: b.finishPosition,
        x: b.x,
        y: FINISH_Y,
        color: b.color,
        time: b.finishTime as number,
      });
      if (!this.winner) this.declareWinner(b);
    }
  }

  private declareWinner(b: BallState): void {
    this.winner = b;
    this.status = 'finishing';
    this.finishingEndsAt = this.time + FINISH_GRACE;
    this.pushEvent({ type: 'winner', id: b.id, name: b.name, color: b.color, time: b.finishTime as number });
  }

  private updateStatus(): void {
    if (this.status === 'racing' && this.time >= MAX_RACE_TIME) {
      // Failsafe: crown whoever is furthest along and end the race.
      const leader = this.getStandings()[0];
      leader.finishTime = this.time;
      leader.finishPosition = ++this.finishCount;
      this.declareWinner(leader);
      this.finalize();
      return;
    }
    if (
      this.status === 'finishing' &&
      (this.time >= this.finishingEndsAt || this.finishCount >= this.balls.length)
    ) {
      this.finalize();
    }
  }

  private finalize(): void {
    this.status = 'finished';
    this.results = this.getStandings().map((b, i) => ({
      position: i + 1,
      id: b.id,
      name: b.name,
      color: b.color,
      finishTime: b.finishTime,
    }));
    this.accumulator = 0;
  }

  /** Random kick for any ball that has been (nearly) motionless for too long. */
  private nudgeStuckBalls(dt: number): void {
    for (const b of this.simOrder) {
      if (b.finishTime !== null) {
        b.stillTime = 0;
        continue;
      }
      if (speedOf(b) < 35) b.stillTime += dt;
      else b.stillTime = 0;
      if (b.stillTime > 1.0) {
        b.vx += range(this.rng, -180, 180);
        b.vy -= range(this.rng, 60, 150);
        b.stillTime = 0;
      }
    }
  }
}
