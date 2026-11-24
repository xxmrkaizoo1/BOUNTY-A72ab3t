import type { Player } from './player';

type Mode = 'ring' | 'bars';

interface Target {
  canvas: HTMLCanvasElement;
  mode: Mode;
}

const BANDS = 48;

/**
 * Tempo-synced visualizer.
 *
 * The demo audio is served without CORS headers, so the Web Audio API can't
 * read its samples. Instead we synthesize a spectrum from the track's BPM and
 * energy, driven by the audio element's own clock, so it pauses, seeks and
 * changes speed with the music. `beat` (0–1) peaks on every beat and is exposed
 * to CSS as `--beat` for pulsing glows.
 */
export class Visualizer {
  beat = 0;
  private targets = new Set<Target>();
  private levels = new Float32Array(BANDS);
  private raf = 0;

  constructor(
    private player: Player,
    private onBeat: (beat: number) => void,
  ) {}

  attach(canvas: HTMLCanvasElement, mode: Mode): void {
    for (const t of this.targets) if (!t.canvas.isConnected) this.targets.delete(t);
    this.targets.add({ canvas, mode });
    this.draw({ canvas, mode });
  }

  start(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    this.raf = 0;
    const track = this.player.current;
    const playing = this.player.playing && !!track;
    const time = this.player.audio.currentTime;

    if (playing && track) {
      const phase = (time * track.bpm) / 60 % 1;
      this.beat = Math.pow(1 - phase, 4) * (0.45 + track.energy * 0.55);
      for (let k = 0; k < BANDS; k++) {
        const f = k / BANDS;
        const bass = (1 - f) ** 2 * this.beat;
        const wobble =
          (0.5 + 0.5 * Math.sin(time * (2.3 + f * 6.5) + k * 1.7)) *
          (0.55 + 0.45 * Math.sin(time * 0.8 + k * 0.41));
        const target = Math.min(1, bass * 1.1 + wobble * (0.2 + track.energy * 0.5) * (1 - f * 0.45));
        this.levels[k] += (target - this.levels[k]) * 0.3;
      }
    } else {
      this.beat *= 0.85;
      for (let k = 0; k < BANDS; k++) this.levels[k] *= 0.85;
    }

    this.onBeat(this.beat);
    for (const t of this.targets) {
      if (t.canvas.isConnected) this.draw(t);
      else this.targets.delete(t);
    }

    const alive = playing || this.beat > 0.005 || this.levels.some((v) => v > 0.005);
    if (alive) this.raf = requestAnimationFrame(this.tick);
  };

  private draw({ canvas, mode }: Target): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const hue = this.player.current?.hue ?? 262;
    ctx.lineCap = 'round';

    if (mode === 'ring') {
      const cx = w / 2;
      const cy = h / 2;
      const size = Math.min(w, h);
      const r0 = size * 0.36;
      const count = BANDS * 2;
      ctx.lineWidth = Math.max(2, size / 170);
      ctx.shadowBlur = 14;
      for (let i = 0; i < count; i++) {
        // mirror the bands so the ring is symmetric
        const level = this.levels[i < BANDS ? i : count - 1 - i];
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const len = 3 + level * size * 0.13;
        const color = `hsl(${hue + (i % BANDS) * 2.5} 95% ${62 + level * 18}% / ${0.35 + level * 0.65})`;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
    } else {
      const n = BANDS;
      const gap = 2;
      const bw = Math.max(1.5, (w - gap * (n - 1)) / n);
      for (let i = 0; i < n; i++) {
        // bass in the middle, highs to the edges
        const d = Math.abs(i - (n - 1) / 2) / (n / 2);
        const level = this.levels[Math.min(BANDS - 1, Math.floor(d * BANDS))];
        const bh = 2 + level * (h - 2);
        ctx.fillStyle = `hsl(${hue + d * 60} 95% 68% / ${0.4 + level * 0.6})`;
        ctx.fillRect(i * (bw + gap), (h - bh) / 2, bw, bh);
      }
    }
  }
}
