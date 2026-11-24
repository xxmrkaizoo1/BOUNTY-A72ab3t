import type { TrackStats } from './types';

export type Theme = 'glass' | 'vinyl' | 'midnight';
export const THEMES: Theme[] = ['glass', 'vinyl', 'midnight'];

/** Bump to move everyone onto DEFAULT_THEME once; later choices via the Theme button stick. */
const THEME_VERSION = 2;
export const DEFAULT_THEME: Theme = 'glass';

interface Persisted {
  theme: Theme;
  themeVersion: number;
  stats: Record<string, TrackStats>;
  history: string[];
  volume: number;
  durations: Record<string, number>;
}

const KEY = 'pulse-music:v1';
const MAX_HISTORY = 200;

const empty = (): Persisted => ({
  theme: DEFAULT_THEME,
  themeVersion: THEME_VERSION,
  stats: {},
  history: [],
  volume: 0.8,
  durations: {},
});

export const blankStats = (): TrackStats => ({
  plays: 0,
  skips: 0,
  liked: false,
  disliked: false,
  lastPlayed: 0,
});

/** Listening data, kept in localStorage so the taste profile survives reloads. */
export class Store {
  private data: Persisted = this.load();

  private load(): Persisted {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Persisted>;
        const data = { ...empty(), ...saved };
        // Older saves (e.g. Vinyl from when it was the default) move to Glass once.
        if ((saved.themeVersion ?? 0) < THEME_VERSION || !THEMES.includes(data.theme)) {
          data.theme = DEFAULT_THEME;
          data.themeVersion = THEME_VERSION;
        }
        return data;
      }
    } catch {
      /* storage blocked or corrupt — start fresh */
    }
    return empty();
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore quota / private mode */
    }
  }

  stats(id: string): TrackStats {
    return this.data.stats[id] ?? blankStats();
  }

  update(id: string, fn: (s: TrackStats) => void): TrackStats {
    const s = { ...this.stats(id) };
    fn(s);
    this.data.stats[id] = s;
    this.save();
    return s;
  }

  get history(): readonly string[] {
    return this.data.history;
  }

  pushHistory(id: string): void {
    this.data.history.push(id);
    if (this.data.history.length > MAX_HISTORY) this.data.history.splice(0, this.data.history.length - MAX_HISTORY);
    this.save();
  }

  get theme(): Theme {
    return this.data.theme;
  }

  set theme(t: Theme) {
    this.data.theme = t;
    this.save();
  }

  get volume(): number {
    return this.data.volume;
  }

  set volume(v: number) {
    this.data.volume = v;
    this.save();
  }

  duration(id: string): number {
    return this.data.durations[id] ?? NaN;
  }

  setDuration(id: string, seconds: number): void {
    if (!Number.isFinite(seconds) || this.data.durations[id] === seconds) return;
    this.data.durations[id] = seconds;
    this.save();
  }

  reset(): void {
    const { volume, durations, theme } = this.data;
    this.data = { ...empty(), volume, durations, theme };
    this.save();
  }
}
