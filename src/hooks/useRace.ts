import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioManager } from '../game/AudioManager';
import { sanitizeForRace } from '../game/participants';
import { RaceEngine } from '../game/RaceEngine';
import { RaceRenderer } from '../game/RaceRenderer';
import { StoredRace, loadLastRace, saveLastRace } from '../game/results';
import type { LiveEntry, Participant, RacePhase, RaceResult, SpeedOption } from '../types/game';
import { randomSeed } from '../utils/random';

const COUNTDOWN_SECONDS = 3;
const GO_DISPLAY_SECONDS = 0.8;
const STANDINGS_INTERVAL = 0.2;
/** How slow the simulation runs during a photo-finish (1 = normal). */
const SLOWMO_FACTOR = 0.4;

export interface UseRace {
  phase: RacePhase;
  countdown: string | null;
  speed: SpeedOption;
  soundOn: boolean;
  standings: LiveEntry[];
  results: RaceResult[] | null;
  lastRace: StoredRace | null;
  modalOpen: boolean;
  closeCall: boolean;
  attachCanvas: (canvas: HTMLCanvasElement | null) => void;
  resize: (width: number, height: number, dpr: number) => void;
  startRace: () => void;
  togglePause: () => void;
  restart: () => void;
  raceAgain: () => void;
  setSpeed: (speed: SpeedOption) => void;
  toggleSound: () => void;
  closeModal: () => void;
}

/**
 * Owns the engine, renderer, audio and the (single) animation loop, and exposes the
 * race as plain React state. All timing lives in refs so the loop never re-subscribes.
 */
export function useRace(participants: readonly Participant[], valid: boolean): UseRace {
  const [phase, setPhaseState] = useState<RacePhase>('setup');
  const [countdown, setCountdown] = useState<string | null>(null);
  const [speed, setSpeedState] = useState<SpeedOption>(1);
  const [soundOn, setSoundOn] = useState(true);
  const [standings, setStandings] = useState<LiveEntry[]>([]);
  const [results, setResults] = useState<RaceResult[] | null>(null);
  const [lastRace, setLastRace] = useState<StoredRace | null>(() => loadLastRace());
  const [modalOpen, setModalOpen] = useState(false);
  const [closeCall, setCloseCall] = useState(false);

  const phaseRef = useRef<RacePhase>('setup');
  const speedRef = useRef<SpeedOption>(1);
  const validRef = useRef(valid);
  const participantsRef = useRef(participants);
  const engineRef = useRef<RaceEngine | null>(null);
  const rendererRef = useRef<RaceRenderer | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const seedRef = useRef<number>(randomSeed());
  const sizeRef = useRef<{ w: number; h: number; dpr: number } | null>(null);
  const reducedRef = useRef(false);

  // Loop-local state (never rendered directly)
  const cdElapsed = useRef(0);
  const cdLabel = useRef('');
  const goTimer = useRef(0);
  const slow = useRef(1);
  const standingsTimer = useRef(0);
  const closeRef = useRef(false);
  const winnerSeen = useRef(false);

  validRef.current = valid;

  const getAudio = (): AudioManager => {
    if (!audioRef.current) audioRef.current = new AudioManager();
    return audioRef.current;
  };

  const setPhase = useCallback((p: RacePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  /** (Re)builds the engine for the current participants and seed, back at the starting line. */
  const buildEngine = useCallback(() => {
    const engine = new RaceEngine(sanitizeForRace(participantsRef.current), seedRef.current);
    engineRef.current = engine;
    rendererRef.current?.reset();
    cdElapsed.current = 0;
    cdLabel.current = '';
    goTimer.current = 0;
    slow.current = 1;
    standingsTimer.current = 0;
    winnerSeen.current = false;
    if (closeRef.current) {
      closeRef.current = false;
      setCloseCall(false);
    }
    setStandings(engine.getLive());
    setResults(null);
  }, []);

  const resetToSetup = useCallback(() => {
    seedRef.current = randomSeed(); // every new race gets fresh random conditions
    buildEngine();
    setCountdown(null);
    setModalOpen(false);
    setPhase('setup');
  }, [buildEngine, setPhase]);

  // Rebuild the starting grid whenever the roster changes (only while in setup).
  useEffect(() => {
    participantsRef.current = participants;
    if (phaseRef.current === 'setup' || engineRef.current === null) buildEngine();
  }, [participants, buildEngine]);

  // Reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedRef.current = mq.matches;
      rendererRef.current?.setReducedMotion(mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      rendererRef.current = null;
      return;
    }
    const renderer = new RaceRenderer(canvas, { reducedMotion: reducedRef.current });
    const size = sizeRef.current;
    if (size) renderer.resize(size.w, size.h, size.dpr);
    rendererRef.current = renderer;
  }, []);

  const resize = useCallback((w: number, h: number, dpr: number) => {
    sizeRef.current = { w, h, dpr };
    rendererRef.current?.resize(w, h, dpr);
  }, []);

  // The one and only animation loop. Cleanup cancels it, so StrictMode/HMR can't stack loops.
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    let alive = true;

    const tick = (now: number) => {
      if (!alive) return;
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const engine = engineRef.current;
      const renderer = rendererRef.current;
      if (!engine) return;
      const audio = getAudio();
      const current = phaseRef.current;

      if (current === 'setup' || current === 'finished' || current === 'countdown') engine.idleSpin(dt);

      if (current === 'countdown') {
        cdElapsed.current += dt;
        const e = cdElapsed.current;
        const label = e < 1 ? '3' : e < 2 ? '2' : e < 3 ? '1' : 'GO!';
        if (label !== cdLabel.current) {
          cdLabel.current = label;
          setCountdown(label);
          audio.countdown(label);
        }
        if (e >= COUNTDOWN_SECONDS) {
          engine.start();
          goTimer.current = GO_DISPLAY_SECONDS;
          setPhase('racing');
        }
      } else if (current === 'racing') {
        if (goTimer.current > 0) {
          goTimer.current -= dt;
          if (goTimer.current <= 0) setCountdown(null);
        }

        const closeNow = !reducedRef.current && engine.isCloseFinish();
        slow.current += ((closeNow ? SLOWMO_FACTOR : 1) - slow.current) * (1 - Math.exp(-dt * 6));
        if (closeNow !== closeRef.current) {
          closeRef.current = closeNow;
          setCloseCall(closeNow);
        }

        const events = engine.advance(dt * speedRef.current * slow.current);
        if (events.length) {
          renderer?.handleEvents(events);
          for (const e of events) {
            if (e.type === 'collision') audio.collision(e.intensity);
            else if (e.type === 'boost') audio.boost();
            else if (e.type === 'winner' && !winnerSeen.current) {
              winnerSeen.current = true;
              renderer?.celebrate();
              audio.victory();
            }
          }
        }

        standingsTimer.current += dt;
        if (standingsTimer.current >= STANDINGS_INTERVAL || engine.status === 'finished') {
          standingsTimer.current = 0;
          setStandings(engine.getLive());
        }

        if (engine.status === 'finished') {
          const final = engine.getResults();
          if (final) {
            setResults(final);
            setLastRace(saveLastRace(final));
          }
          if (closeRef.current) {
            closeRef.current = false;
            setCloseCall(false);
          }
          setPhase('finished');
          setModalOpen(true);
        }
      }

      renderer?.render(engine, dt, {
        phase: phaseRef.current,
        slowmo: Math.max(0, Math.min(1, (1 - slow.current) / (1 - SLOWMO_FACTOR))),
      });
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [setPhase]);

  // Auto-pause when the tab is hidden so the race never silently runs (or jumps) in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'racing') setPhase('paused');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setPhase]);

  useEffect(
    () => () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  const startRace = useCallback(() => {
    if (!validRef.current) return;
    if (phaseRef.current === 'finished') resetToSetup();
    if (phaseRef.current !== 'setup') return;
    getAudio().unlock();
    cdElapsed.current = 0;
    cdLabel.current = '';
    setModalOpen(false);
    setPhase('countdown');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToSetup, setPhase]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'racing') setPhase('paused');
    else if (phaseRef.current === 'paused') setPhase('racing');
  }, [setPhase]);

  const restart = useCallback(() => {
    if (phaseRef.current === 'setup') return;
    resetToSetup();
  }, [resetToSetup]);

  const raceAgain = useCallback(() => {
    resetToSetup();
    startRace();
  }, [resetToSetup, startRace]);

  const setSpeed = useCallback((s: SpeedOption) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      getAudio().setEnabled(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  return {
    phase,
    countdown,
    speed,
    soundOn,
    standings,
    results,
    lastRace,
    modalOpen,
    closeCall,
    attachCanvas,
    resize,
    startRace,
    togglePause,
    restart,
    raceAgain,
    setSpeed,
    toggleSound,
    closeModal,
  };
}
