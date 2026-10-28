/** Shared types for Color Rush. */

export interface Participant {
  id: string;
  name: string;
  color: string; // #rrggbb
}

export type RacePhase = 'setup' | 'countdown' | 'racing' | 'paused' | 'finished';
export type SpeedOption = 1 | 2 | 4;
export type EngineStatus = 'ready' | 'racing' | 'finishing' | 'finished';

export interface BallState {
  id: string;
  name: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Per-ball random physical traits (drawn from identical distributions for everyone). */
  restitution: number;
  dragFactor: number;
  nextBoostAt: number;
  boostUntil: number;
  stillTime: number;
  hitCooldown: number;
  finishTime: number | null;
  finishPosition: number | null;
}

export interface RaceResult {
  position: number;
  id: string;
  name: string;
  color: string;
  /** Seconds of race time, or null when the ball had not finished when the race ended. */
  finishTime: number | null;
}

export interface LiveEntry {
  id: string;
  name: string;
  color: string;
  position: number;
  /** 0..1 progress along the track. */
  progress: number;
  finishTime: number | null;
}

export type ObstacleKind = 'peg' | 'bumper' | 'ramp' | 'spinner' | 'wall' | 'ball';

export type EngineEvent =
  | { type: 'collision'; kind: ObstacleKind; obstacleId: number; x: number; y: number; intensity: number; color: string }
  | { type: 'boost'; id: string; x: number; y: number; color: string }
  | { type: 'finish'; id: string; name: string; position: number; x: number; y: number; color: string; time: number }
  | { type: 'winner'; id: string; name: string; color: string; time: number };

export interface CircleObstacle {
  id: number;
  kind: 'peg' | 'bumper';
  x: number;
  y: number;
  r: number;
  hue: number;
}

export interface SegmentObstacle {
  id: number;
  kind: 'ramp';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  thickness: number;
}

export interface SpinnerObstacle {
  id: number;
  kind: 'spinner';
  cx: number;
  cy: number;
  halfLength: number;
  thickness: number;
  angle: number;
  omega: number; // rad/s
}

export interface Track {
  width: number;
  height: number;
  finishY: number;
  floorY: number;
  circles: CircleObstacle[];
  segments: SegmentObstacle[];
  spinners: SpinnerObstacle[];
}

export interface RaceStats {
  winnerName: string;
  winnerColor: string;
  winnerTime: number | null;
  /** Gap between first and second place in seconds (null if unavailable). */
  margin: number | null;
  photoFinish: boolean;
  finishedCount: number;
  totalCount: number;
  averageTime: number | null;
}
