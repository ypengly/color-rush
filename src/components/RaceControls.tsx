import type { RacePhase, SpeedOption } from '../types/game';

interface Props {
  phase: RacePhase;
  canStart: boolean;
  speed: SpeedOption;
  soundOn: boolean;
  onStart: () => void;
  onPause: () => void;
  onRestart: () => void;
  onToggleSound: () => void;
  onSpeed: (speed: SpeedOption) => void;
}

const SPEEDS: SpeedOption[] = [1, 2, 4];

export function RaceControls({ phase, canStart, speed, soundOn, onStart, onPause, onRestart, onToggleSound, onSpeed }: Props) {
  const startable = phase === 'setup' || phase === 'finished';
  const pausable = phase === 'racing' || phase === 'paused';

  return (
    <div className="controls" role="group" aria-label="Race controls">
      <button className="btn btn-primary" onClick={onStart} disabled={!startable || !canStart}>
        {phase === 'finished' ? 'RACE AGAIN' : 'START RACE'}
      </button>
      <button className="btn" onClick={onPause} disabled={!pausable}>
        {phase === 'paused' ? 'RESUME' : 'PAUSE'}
      </button>
      <button className="btn" onClick={onRestart} disabled={phase === 'setup'}>
        RESTART
      </button>
      <button className="btn" onClick={onToggleSound} aria-pressed={soundOn}>
        SOUND {soundOn ? 'ON' : 'OFF'}
      </button>
      <div className="speed" role="group" aria-label="Race speed">
        <span className="speed-label">SPEED</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`btn btn-speed${speed === s ? ' active' : ''}`}
            onClick={() => onSpeed(s)}
            aria-pressed={speed === s}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
