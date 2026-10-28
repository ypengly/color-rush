/**
 * Tiny WebAudio synthesiser. Every sound is generated on the fly, so there are no audio
 * files to load. The AudioContext is created lazily from a user gesture (START RACE).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private lastCollision = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.35 : 0;
  }

  /** Call from a click/tap handler so browsers allow audio playback. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.35 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  collision(intensity: number): void {
    const now = performance.now();
    if (now - this.lastCollision < 35) return;
    this.lastCollision = now;
    const base = 240 + intensity * 520 + Math.random() * 70;
    this.tone(base, 0.09, 'triangle', 0.04 + 0.14 * intensity);
  }

  boost(): void {
    this.tone(320, 0.18, 'sawtooth', 0.05, 0, 900);
  }

  countdown(label: string): void {
    if (label === 'GO!') {
      this.tone(523, 0.35, 'square', 0.08);
      this.tone(784, 0.35, 'square', 0.08);
      this.tone(1046, 0.45, 'square', 0.08);
    } else {
      this.tone(label === '1' ? 660 : 520, 0.16, 'square', 0.08);
    }
  }

  victory(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, 0.28, 'triangle', 0.14, i * 0.11);
      this.tone(f / 2, 0.28, 'sine', 0.08, i * 0.11);
    });
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }
}
