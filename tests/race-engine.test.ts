import { describe, expect, it } from 'vitest';
import { RaceEngine, FINISH_GRACE, MAX_BALLS, MIN_BALLS } from '../src/game/RaceEngine';
import { FINISH_Y } from '../src/game/Track';
import { computeStats } from '../src/game/results';
import type { Participant } from '../src/types/game';

const roster = (n: number): Participant[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Ball ${i + 1}`,
    color: `#${((i + 1) * 0x0b3d5f).toString(16).padStart(6, '0').slice(-6)}`,
  }));

/** Runs the engine in 60fps frames until it finishes (or the frame budget runs out). */
function runToEnd(engine: RaceEngine, maxFrames = 20000): number {
  let frames = 0;
  while (engine.status !== 'finished' && frames++ < maxFrames) engine.advance(1 / 60);
  return frames;
}

describe('RaceEngine setup', () => {
  it('rejects fewer than 2 or more than 20 participants', () => {
    expect(() => new RaceEngine(roster(MIN_BALLS - 1))).toThrow();
    expect(() => new RaceEngine(roster(MAX_BALLS + 1))).toThrow();
    expect(() => new RaceEngine(roster(MIN_BALLS))).not.toThrow();
    expect(() => new RaceEngine(roster(MAX_BALLS))).not.toThrow();
  });

  it('places every ball in the start area without overlaps', () => {
    for (const n of [2, 5, 10, 20]) {
      const e = new RaceEngine(roster(n), 99);
      for (let i = 0; i < n; i++) {
        const a = e.balls[i];
        expect(a.y).toBeLessThan(e.gateY);
        expect(a.x).toBeGreaterThan(a.radius);
        expect(a.x).toBeLessThan(e.track.width - a.radius);
        for (let j = i + 1; j < n; j++) {
          const b = e.balls[j];
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.radius + b.radius);
        }
      }
    }
  });

  it('does not move anything until start() is called', () => {
    const e = new RaceEngine(roster(5), 1);
    const before = e.balls.map((b) => [b.x, b.y]);
    e.advance(5);
    e.step();
    expect(e.status).toBe('ready');
    expect(e.time).toBe(0);
    expect(e.balls.map((b) => [b.x, b.y])).toEqual(before);
  });
});

describe('RaceEngine racing', () => {
  it('moves every ball automatically after start', () => {
    for (const n of [2, 5, 10, 20]) {
      const e = new RaceEngine(roster(n), 5);
      const startY = e.balls.map((b) => b.y);
      e.start();
      e.advance(1);
      e.balls.forEach((b, i) => expect(b.y).toBeGreaterThan(startY[i] + 10));
    }
  });

  for (const n of [2, 5, 10, 20]) {
    it(`finishes a race with ${n} balls and names a valid winner`, () => {
      const e = new RaceEngine(roster(n), 1000 + n);
      e.start();
      runToEnd(e);
      expect(e.status).toBe('finished');
      expect(e.winner).not.toBeNull();

      const results = e.getResults()!;
      expect(results).toHaveLength(n);
      expect(results[0].id).toBe(e.winner!.id);
      expect(results[0].finishTime).not.toBeNull();
      expect(new Set(results.map((r) => r.id)).size).toBe(n);
      expect(results.map((r) => r.position)).toEqual(results.map((_, i) => i + 1));

      // Finishers are ordered by time, and finishers come before non-finishers.
      const times = results.map((r) => r.finishTime);
      let seenNull = false;
      let prev = -Infinity;
      for (const t of times) {
        if (t === null) seenNull = true;
        else {
          expect(seenNull).toBe(false);
          expect(t).toBeGreaterThanOrEqual(prev);
          prev = t;
        }
      }
      // The winner really crossed the line.
      expect(e.winner!.y).toBeGreaterThanOrEqual(FINISH_Y - 1);
    });
  }

  it('keeps every ball inside the arena for the whole race', () => {
    const e = new RaceEngine(roster(20), 4242);
    e.start();
    let frames = 0;
    while (e.status !== 'finished' && frames++ < 20000) {
      e.advance(1 / 60);
      for (const b of e.balls) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(e.track.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThanOrEqual(e.track.floorY);
      }
    }
    expect(e.status).toBe('finished');
  });

  it('is deterministic for a given seed and different across seeds', () => {
    const run = (seed: number) => {
      const e = new RaceEngine(roster(8), seed);
      e.start();
      runToEnd(e);
      return e.getResults()!.map((r) => `${r.id}:${r.finishTime?.toFixed(4)}`).join('|');
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });

  it('emits collision, finish and winner events', () => {
    const e = new RaceEngine(roster(6), 31);
    e.start();
    const types = new Set<string>();
    let frames = 0;
    while (e.status !== 'finished' && frames++ < 20000) e.advance(1 / 60).forEach((ev) => types.add(ev.type));
    expect(types.has('collision')).toBe(true);
    expect(types.has('finish')).toBe(true);
    expect(types.has('winner')).toBe(true);
  });

  it('reports a leader and live standings during the race', () => {
    const e = new RaceEngine(roster(6), 12);
    e.start();
    e.advance(4);
    const live = e.getLive();
    expect(live).toHaveLength(6);
    expect(live[0].position).toBe(1);
    expect(live[0].progress).toBeGreaterThanOrEqual(live[5].progress);
    expect(e.getLeader().id).toBe(live[0].id);
  });
});

describe('RaceEngine ending and restarting', () => {
  it('stops completely once finished (no further movement or events)', () => {
    const e = new RaceEngine(roster(5), 77);
    e.start();
    runToEnd(e);
    const snapshot = e.balls.map((b) => [b.x, b.y, b.vx, b.vy]);
    const time = e.time;
    expect(e.advance(10)).toEqual([]);
    e.step();
    expect(e.time).toBe(time);
    expect(e.balls.map((b) => [b.x, b.y, b.vx, b.vy])).toEqual(snapshot);
  });

  it('start() is ignored after the race has begun', () => {
    const e = new RaceEngine(roster(3), 3);
    e.start();
    e.advance(2);
    const t = e.time;
    e.start();
    expect(e.time).toBe(t);
  });

  it('a new engine (restart) resets everything', () => {
    const p = roster(5);
    const first = new RaceEngine(p, 1);
    first.start();
    runToEnd(first);
    const second = new RaceEngine(p, 2);
    expect(second.status).toBe('ready');
    expect(second.time).toBe(0);
    expect(second.winner).toBeNull();
    expect(second.getResults()).toBeNull();
    second.balls.forEach((b) => expect(b.finishTime).toBeNull());
  });

  it('gives the pack a short grace period so close finishers get times', () => {
    const e = new RaceEngine(roster(10), 55);
    e.start();
    runToEnd(e);
    const winnerTime = e.winner!.finishTime!;
    for (const r of e.getResults()!) {
      if (r.finishTime !== null) expect(r.finishTime).toBeLessThanOrEqual(winnerTime + FINISH_GRACE + 0.05);
    }
  });
});

describe('Fairness', () => {
  it('does not favour any name, colour or list position', () => {
    const n = 4;
    const wins = new Array(n).fill(0);
    const races = 240;
    for (let s = 1; s <= races; s++) {
      const e = new RaceEngine(roster(n), s * 104729);
      e.start();
      runToEnd(e);
      wins[e.balls.findIndex((b) => b.id === e.winner!.id)]++;
    }
    // Expected 25% each; allow a generous statistical margin.
    for (const w of wins) {
      expect(w / races).toBeGreaterThan(0.12);
      expect(w / races).toBeLessThan(0.42);
    }
  });
});

describe('Results statistics', () => {
  it('computes winner, margin and photo-finish flag', () => {
    const stats = computeStats([
      { position: 1, id: 'a', name: 'A', color: '#111111', finishTime: 20.0 },
      { position: 2, id: 'b', name: 'B', color: '#222222', finishTime: 20.1 },
      { position: 3, id: 'c', name: 'C', color: '#333333', finishTime: null },
    ])!;
    expect(stats.winnerName).toBe('A');
    expect(stats.margin).toBeCloseTo(0.1, 5);
    expect(stats.photoFinish).toBe(true);
    expect(stats.finishedCount).toBe(2);
    expect(stats.totalCount).toBe(3);
    expect(stats.averageTime).toBeCloseTo(20.05, 5);
    expect(computeStats([])).toBeNull();
  });
});
