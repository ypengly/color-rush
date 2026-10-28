import type { EngineEvent, RacePhase } from '../types/game';
import { RaceEngine } from './RaceEngine';
import { FINISH_Y, START_Y, WORLD_HEIGHT, WORLD_WIDTH } from './Track';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'confetti';
  rot: number;
  vr: number;
  gravity: number;
}

export interface RenderView {
  phase: RacePhase;
  /** 0 = normal speed, 1 = full slow-motion drama (drives the vignette). */
  slowmo: number;
}

const CONFETTI_COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c', '#ffffff'];
const MAX_PARTICLES = 700;
const TRAIL_LENGTH = 16;
const LABEL_FONT = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const rgbCache = new Map<string, [number, number, number]>();
function hexToRgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
/** Mix a colour toward white (amt > 0) or black (amt < 0). */
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  return `rgb(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)})`;
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export class RaceRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private scale = 1;
  private camY = 0;
  private clock = 0;
  private finishFlash = 0;
  private particles: Particle[] = [];
  private trails = new Map<string, Array<{ x: number; y: number }>>();
  private rotations = new Map<string, number>();
  private flashes = new Map<number, number>();
  private labelWidths = new Map<string, number>();
  private reducedMotion: boolean;

  constructor(private canvas: HTMLCanvasElement, options: { reducedMotion: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
    this.ctx = ctx;
    this.reducedMotion = options.reducedMotion;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) {
      this.trails.clear();
      this.particles = [];
    }
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.dpr = dpr;
    this.w = Math.max(1, Math.floor(cssWidth));
    this.h = Math.max(1, Math.floor(cssHeight));
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.scale = this.w / WORLD_WIDTH;
  }

  /** Clears all transient visuals (call whenever a new race is prepared). */
  reset(): void {
    this.camY = 0;
    this.finishFlash = 0;
    this.particles = [];
    this.trails.clear();
    this.rotations.clear();
    this.flashes.clear();
  }

  handleEvents(events: EngineEvent[]): void {
    let sparkBudget = 18;
    for (const e of events) {
      if (e.type === 'collision') {
        if (e.obstacleId > 0 && !this.reducedMotion) this.flashes.set(e.obstacleId, 1);
        if (!this.reducedMotion && sparkBudget > 0) {
          const n = Math.min(sparkBudget, 2 + Math.floor(e.intensity * 5));
          sparkBudget -= n;
          this.spawnSparks(e.x, e.y, e.color, n, 90 + e.intensity * 260);
        }
      } else if (e.type === 'boost') {
        if (!this.reducedMotion) this.spawnSparks(e.x, e.y, e.color, 8, 220);
      } else if (e.type === 'finish') {
        this.finishFlash = Math.max(this.finishFlash, e.position === 1 ? 1.4 : 0.7);
        if (!this.reducedMotion) this.spawnSparks(e.x, FINISH_Y, e.color, e.position === 1 ? 36 : 14, 380);
      }
    }
  }

  /** Confetti shower for the winner. */
  celebrate(): void {
    this.finishFlash = 1.6;
    if (this.reducedMotion) return;
    for (let i = 0; i < 160; i++) {
      this.addParticle({
        x: Math.random() * WORLD_WIDTH,
        y: this.camY - Math.random() * 260,
        vx: (Math.random() - 0.5) * 160,
        vy: 40 + Math.random() * 180,
        life: 0,
        maxLife: 3.5 + Math.random() * 2.5,
        size: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        kind: 'confetti',
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        gravity: 170,
      });
    }
  }

  render(engine: RaceEngine, dt: number, view: RenderView): void {
    if (this.w === 0 || this.h === 0) return;
    const ctx = this.ctx;
    this.clock += dt;
    const running = view.phase === 'racing';
    this.updateCamera(engine, dt, view.phase);
    this.updateParticles(dt);
    this.updateTrailsAndSpin(engine, dt, running);
    for (const [id, v] of this.flashes) {
      const nv = v - dt * 4;
      if (nv <= 0) this.flashes.delete(id);
      else this.flashes.set(id, nv);
    }
    this.finishFlash = Math.max(0, this.finishFlash - dt * 1.2);

    this.drawBackground();

    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, 0, -this.camY * s);
    this.drawTrack(engine);
    this.drawGate(engine);
    this.drawTrails(engine);
    this.drawBalls(engine);
    this.drawParticles();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.drawLabels(engine);
    this.drawMinimap(engine);
    if (view.slowmo > 0.05) this.drawVignette(view.slowmo);
  }

  // --------------------------------------------------------------------- update

  private updateCamera(engine: RaceEngine, dt: number, phase: RacePhase): void {
    const viewH = this.h / this.scale;
    const maxCam = Math.max(0, WORLD_HEIGHT - viewH);
    let target = 0;
    if (phase === 'racing' || phase === 'paused') {
      const top = engine.getStandings();
      const lead = top[0].y;
      const avg3 = top.slice(0, 3).reduce((sum, b) => sum + b.y, 0) / Math.min(3, top.length);
      target = lead * 0.65 + avg3 * 0.35 - viewH * 0.42;
    } else if (phase === 'finished') {
      target = FINISH_Y - viewH * 0.62;
    }
    target = Math.min(maxCam, Math.max(0, target));
    if (this.reducedMotion) this.camY = target;
    else this.camY += (target - this.camY) * (1 - Math.exp(-dt * 5));
  }

  private updateTrailsAndSpin(engine: RaceEngine, dt: number, running: boolean): void {
    if (!running) return;
    for (const b of engine.balls) {
      this.rotations.set(b.id, (this.rotations.get(b.id) ?? 0) + (b.vx / b.radius) * dt);
      if (this.reducedMotion) continue;
      let trail = this.trails.get(b.id);
      if (!trail) {
        trail = [];
        this.trails.set(b.id, trail);
      }
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(b.x - last.x, b.y - last.y) > 3) {
        trail.push({ x: b.x, y: b.y });
        if (trail.length > TRAIL_LENGTH) trail.shift();
      } else if (trail.length > 1 && Math.random() < 0.3) {
        trail.shift();
      }
    }
  }

  private updateParticles(dt: number): void {
    const out: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += p.gravity * dt;
      if (p.kind === 'confetti') p.vx += Math.sin(this.clock * 4 + p.rot) * 30 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      out.push(p);
    }
    this.particles = out;
  }

  private addParticle(p: Particle): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push(p);
  }

  private spawnSparks(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.addParticle({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.35,
        size: 1.6 + Math.random() * 2.2,
        color,
        kind: 'spark',
        rot: 0,
        vr: 0,
        gravity: 500,
      });
    }
  }

  // --------------------------------------------------------------------- drawing

  private drawBackground(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const prog = Math.min(1, this.camY / FINISH_Y);
    const hue = 228 + prog * 95;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, `hsl(${hue}, 55%, 12%)`);
    g.addColorStop(1, `hsl(${hue + 25}, 60%, 7%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // Scrolling grid gives a sense of speed as the camera follows the leader.
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    const step = 100 * this.scale;
    const offset = -((this.camY * this.scale) % step);
    ctx.beginPath();
    for (let y = offset; y < this.h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
    }
    for (let x = step; x < this.w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h);
    }
    ctx.stroke();
  }

  private visible(y0: number, y1: number): boolean {
    const viewH = this.h / this.scale;
    return y1 >= this.camY - 60 && y0 <= this.camY + viewH + 60;
  }

  private drawTrack(engine: RaceEngine): void {
    const ctx = this.ctx;
    const track = engine.track;
    const viewH = this.h / this.scale;

    // Side rails
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : WORLD_WIDTH;
      const g = ctx.createLinearGradient(x, 0, x + (side === 0 ? 22 : -22), 0);
      g.addColorStop(0, 'rgba(140,170,255,0.35)');
      g.addColorStop(1, 'rgba(140,170,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(side === 0 ? 0 : WORLD_WIDTH - 22, this.camY, 22, viewH);
    }

    // Progress markers
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (const pct of [25, 50, 75]) {
      const y = (FINISH_Y * pct) / 100;
      if (!this.visible(y, y)) continue;
      ctx.fillRect(0, y, 40, 2);
      ctx.fillText(`${pct}%`, 46, y + 5);
    }

    // Start label
    if (this.visible(0, 140)) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('START', WORLD_WIDTH / 2, START_Y - 28);
    }

    // Ramps
    ctx.lineCap = 'round';
    for (const s of track.segments) {
      if (!this.visible(Math.min(s.ay, s.by), Math.max(s.ay, s.by))) continue;
      const flash = this.flashes.get(s.id) ?? 0;
      ctx.strokeStyle = flash > 0 ? '#ffffff' : '#38bdf8';
      ctx.lineWidth = s.thickness;
      ctx.beginPath();
      ctx.moveTo(s.ax, s.ay);
      ctx.lineTo(s.bx, s.by);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.ax, s.ay - 2);
      ctx.lineTo(s.bx, s.by - 2);
      ctx.stroke();
    }

    // Pegs & bumpers
    for (const c of track.circles) {
      if (!this.visible(c.y - c.r, c.y + c.r)) continue;
      const flash = this.flashes.get(c.id) ?? 0;
      const r = c.r * (1 + flash * 0.35);
      if (c.kind === 'peg') {
        ctx.fillStyle = flash > 0 ? '#ffffff' : '#c7d2fe';
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const glow = ctx.createRadialGradient(c.x, c.y, c.r * 0.4, c.x, c.y, c.r * 2.1);
        glow.addColorStop(0, `hsla(${c.hue},95%,65%,${0.45 + flash * 0.4})`);
        glow.addColorStop(1, `hsla(${c.hue},95%,65%,0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsl(${c.hue},85%,${flash > 0 ? 82 : 58}%)`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Spinners
    for (const sp of track.spinners) {
      if (!this.visible(sp.cy - sp.halfLength, sp.cy + sp.halfLength)) continue;
      ctx.save();
      ctx.translate(sp.cx, sp.cy);
      ctx.rotate(sp.angle);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = sp.thickness + 1;
      ctx.beginPath();
      ctx.moveTo(-sp.halfLength, 0);
      ctx.lineTo(sp.halfLength, 0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-sp.halfLength + 6, -2);
      ctx.lineTo(sp.halfLength - 6, -2);
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawFinishLine(track.floorY);
  }

  private drawFinishLine(floorY: number): void {
    if (!this.visible(FINISH_Y - 40, floorY)) return;
    const ctx = this.ctx;
    const sq = 25;
    const rowH = 18;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < WORLD_WIDTH / sq; i++) {
        ctx.fillStyle = (i + row) % 2 === 0 ? '#ffffff' : '#111827';
        ctx.fillRect(i * sq, FINISH_Y - rowH + row * (rowH / 2), sq, rowH / 2);
      }
    }
    if (this.finishFlash > 0) {
      const g = ctx.createLinearGradient(0, FINISH_Y - 120, 0, FINISH_Y + 60);
      g.addColorStop(0, 'rgba(255,230,120,0)');
      g.addColorStop(0.7, `rgba(255,230,120,${Math.min(0.55, this.finishFlash * 0.4)})`);
      g.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, FINISH_Y - 120, WORLD_WIDTH, 180);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', WORLD_WIDTH / 2, FINISH_Y + 34);
    // Floor
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, floorY, WORLD_WIDTH, 6);
  }

  private drawGate(engine: RaceEngine): void {
    if (engine.status !== 'ready') return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, engine.gateY);
    ctx.lineTo(WORLD_WIDTH - 30, engine.gateY);
    ctx.stroke();
    ctx.restore();
  }

  private drawTrails(engine: RaceEngine): void {
    if (this.reducedMotion) return;
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const b of engine.balls) {
      const trail = this.trails.get(b.id);
      if (!trail || trail.length < 2) continue;
      const n = trail.length;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        ctx.strokeStyle = rgba(b.color, 0.5 * f);
        ctx.lineWidth = b.radius * 1.5 * f;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
    }
  }

  private drawBalls(engine: RaceEngine): void {
    const ctx = this.ctx;
    const leaderId = engine.status === 'ready' ? null : engine.getLeader().id;
    const balls = engine.balls.slice().sort((a, b) => a.y - b.y);
    for (const b of balls) {
      if (!this.visible(b.y - b.radius * 3, b.y + b.radius * 3)) continue;
      const boosting = b.boostUntil > engine.time && engine.status !== 'ready';
      const r = b.radius;

      // Glow
      const gr = r * (boosting ? 3.6 : 2.4);
      const glow = ctx.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, gr);
      glow.addColorStop(0, rgba(b.color, boosting ? 0.6 : 0.38));
      glow.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, gr, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const body = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
      body.addColorStop(0, shade(b.color, 0.65));
      body.addColorStop(0.45, b.color);
      body.addColorStop(1, shade(b.color, -0.4));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Spin marker
      const rot = this.rotations.get(b.id) ?? 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.6, rot, rot + 1.1);
      ctx.stroke();

      // Outline (white = readable on any background, gold for the leader)
      ctx.strokeStyle = b.id === leaderId ? '#fde047' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = b.id === leaderId ? 2.6 : 1.6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const a = 1 - p.life / p.maxLife;
      if (p.kind === 'spark') {
        ctx.fillStyle = rgba(p.color, Math.min(1, a * 1.4));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Screen-space name labels with greedy overlap avoidance (leaders get first pick). */
  private drawLabels(engine: RaceEngine): void {
    const ctx = this.ctx;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const placed: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const standings = engine.getStandings();
    const leaderId = engine.status === 'ready' ? null : standings[0].id;
    const labelH = 18;

    for (const b of standings) {
      const sx = b.x * this.scale;
      const sy = (b.y - this.camY) * this.scale;
      const rs = b.radius * this.scale;
      if (sy < -30 || sy > this.h + 30) continue;

      let text = b.name;
      if (text.length > 14) text = `${text.slice(0, 13)}…`;
      if (b.id === leaderId) text = `★ ${text}`;
      let tw = this.labelWidths.get(text);
      if (tw === undefined) {
        tw = ctx.measureText(text).width;
        this.labelWidths.set(text, tw);
        if (this.labelWidths.size > 500) this.labelWidths.clear();
      }
      const bw = tw + 14;
      const cx = Math.min(this.w - bw / 2 - 2, Math.max(bw / 2 + 2, sx));

      // Candidate vertical offsets: above, stacked higher, then below.
      const baseY = sy - rs - 4 - labelH / 2;
      const candidates = [0, -labelH - 2, -(labelH + 2) * 2, rs * 2 + 8 + labelH, rs * 2 + 8 + labelH * 2 + 2];
      let chosen = candidates[0];
      let free = false;
      for (const off of candidates) {
        const y = baseY + off;
        const rect = { x0: cx - bw / 2, y0: y - labelH / 2, x1: cx + bw / 2, y1: y + labelH / 2 };
        if (!placed.some((p) => rect.x0 < p.x1 && rect.x1 > p.x0 && rect.y0 < p.y1 && rect.y1 > p.y0)) {
          chosen = off;
          free = true;
          break;
        }
      }
      const ly = baseY + chosen;
      if (!free && b.id !== leaderId) {
        // Crowded: draw a compact, faded label rather than a mess of overlapping text.
        ctx.globalAlpha = 0.55;
      }
      placed.push({ x0: cx - bw / 2, y0: ly - labelH / 2, x1: cx + bw / 2, y1: ly + labelH / 2 });

      this.pill(cx - bw / 2, ly - labelH / 2, bw, labelH, 9);
      ctx.fillStyle = 'rgba(8,10,25,0.78)';
      ctx.fill();
      ctx.strokeStyle = b.id === leaderId ? '#fde047' : b.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, cx, ly + 0.5);
      ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'alphabetic';
  }

  private pill(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Slim progress bar on the right edge showing where every ball is on the whole track. */
  private drawMinimap(engine: RaceEngine): void {
    const ctx = this.ctx;
    const x = this.w - 9;
    const top = 16;
    const bottom = this.h - 16;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    // Camera window
    const viewH = this.h / this.scale;
    const y0 = top + (this.camY / FINISH_Y) * (bottom - top);
    const y1 = top + ((this.camY + viewH) / FINISH_Y) * (bottom - top);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, Math.min(bottom, y0), 10, Math.max(4, Math.min(bottom, y1) - y0));

    const leaderId = engine.status === 'ready' ? null : engine.getLeader().id;
    for (const b of engine.balls) {
      const p = Math.min(1, Math.max(0, b.y / FINISH_Y));
      const y = top + p * (bottom - top);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, y, b.id === leaderId ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (b.id === leaderId) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // Flag at the end
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 5, bottom + 2, 10, 3);
  }

  private drawVignette(amount: number): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.25, this.w / 2, this.h / 2, this.h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(20,0,40,${0.55 * Math.min(1, amount)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
