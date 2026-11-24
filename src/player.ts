import { isFsFile } from './fsref';
import type { Store } from './store';
import type { ChangeKind, Track } from './types';

export type Repeat = 'off' | 'all' | 'one';

/**
 * A 0-length WAV. Played synchronously inside the user's click so browsers (Safari
 * especially) treat the element as user-started, then swapped for the real song
 * once its chunks have downloaded.
 */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/** Seconds of listening that count as a real play (or half the track if shorter). */
const PLAY_THRESHOLD = 30;

export class Player {
  readonly audio = new Audio();
  queue: string[] = [];
  index = -1;
  shuffle = false;
  repeat: Repeat = 'off';
  /** Tracks the recommender added because the queue ran out. */
  readonly autoplayed = new Set<string>();

  /** True while a Firestore-stored song is being downloaded. */
  loading = false;
  private loadToken = 0;
  private counted = false;
  private listeners = new Set<(kind: ChangeKind) => void>();
  private timeListeners = new Set<() => void>();

  constructor(
    private byId: Map<string, Track>,
    private store: Store,
    private autoplay: (current: Track | null, queued: ReadonlySet<string>) => Track | null,
    private onError: (msg: string) => void,
    /** Turns `fsfile:` references into playable URLs (download + cache). */
    private resolveSrc: (src: string) => Promise<string> = (src) => Promise.resolve(src),
  ) {
    this.audio.preload = 'metadata';
    this.audio.volume = store.volume;

    this.audio.addEventListener('timeupdate', () => {
      this.checkCounted();
      this.timeListeners.forEach((fn) => fn());
    });
    this.audio.addEventListener('loadedmetadata', () => {
      const t = this.current;
      if (t) this.store.setDuration(t.id, this.audio.duration);
      this.timeListeners.forEach((fn) => fn());
    });
    this.audio.addEventListener('play', () => this.emit('state'));
    this.audio.addEventListener('pause', () => this.emit('state'));
    this.audio.addEventListener('ended', () => {
      if (!this.loading) this.onEnded(); // ignore the silent placeholder ending
    });
    this.audio.addEventListener('error', () => {
      if (this.loading) return;
      this.onError("Couldn't load this track — check your connection.");
      this.emit('state');
    });
  }

  on(fn: (kind: ChangeKind) => void): void {
    this.listeners.add(fn);
  }

  onTime(fn: () => void): void {
    this.timeListeners.add(fn);
  }

  private emit(kind: ChangeKind): void {
    this.listeners.forEach((fn) => fn(kind));
  }

  get current(): Track | null {
    return this.byId.get(this.queue[this.index]) ?? null;
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  /** Replace the queue with `ids` and start at `startId`. */
  playList(ids: string[], startId: string): void {
    if (this.current?.id === startId) return this.toggle();
    this.markSkip();
    this.queue = [...ids];
    this.load(Math.max(0, this.queue.indexOf(startId)));
  }

  /** Play a single track now, keeping the rest of the queue. */
  playNow(id: string): void {
    if (this.current?.id === id) return this.toggle();
    this.markSkip();
    const i = this.queue.indexOf(id);
    if (i >= 0) return this.load(i);
    this.queue.splice(this.index + 1, 0, id);
    this.load(this.index + 1);
  }

  enqueue(id: string): boolean {
    if (this.queue.slice(this.index + 1).includes(id)) return false;
    this.queue.push(id);
    this.emit('queue');
    return true;
  }

  removeAt(i: number): void {
    if (i === this.index || i < 0 || i >= this.queue.length) return;
    this.queue.splice(i, 1);
    if (i < this.index) this.index--;
    this.emit('queue');
  }

  toggle(): void {
    if (this.loading) return;
    if (this.index < 0) {
      const t = this.autoplay(null, new Set());
      if (t) {
        this.queue = [t.id];
        this.autoplayed.add(t.id);
        this.load(0);
      }
      return;
    }
    if (this.audio.paused) this.audio.play().catch(() => this.emit('state'));
    else this.audio.pause();
  }

  next(user = true): void {
    if (user) this.markSkip();
    const i = this.pickNext();
    if (i === null) {
      this.audio.pause();
      return;
    }
    this.load(i);
  }

  prev(): void {
    if (this.audio.currentTime > 3 || this.index <= 0) {
      this.audio.currentTime = 0;
      return;
    }
    this.load(this.index - 1);
  }

  seek(fraction: number): void {
    const d = this.audio.duration;
    if (Number.isFinite(d)) this.audio.currentTime = Math.min(Math.max(fraction, 0), 1) * d;
  }

  seekBy(seconds: number): void {
    if (this.index >= 0) this.audio.currentTime = Math.max(0, this.audio.currentTime + seconds);
  }

  setVolume(v: number): void {
    this.audio.volume = v;
    this.store.volume = v;
  }

  toggleShuffle(): void {
    this.shuffle = !this.shuffle;
    this.emit('state');
  }

  cycleRepeat(): void {
    this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
    this.emit('state');
  }

  private pickNext(): number | null {
    const upcoming = this.queue.length - this.index - 1;
    if (this.shuffle && upcoming > 0) {
      // Move a random upcoming track to the next slot so "Up next" stays truthful.
      const pick = this.index + 1 + Math.floor(Math.random() * upcoming);
      const [id] = this.queue.splice(pick, 1);
      this.queue.splice(this.index + 1, 0, id);
      return this.index + 1;
    }
    if (upcoming > 0) return this.index + 1;
    if (this.repeat === 'all' && this.queue.length) return 0;

    const t = this.autoplay(this.current, new Set(this.queue));
    if (!t) return null;
    this.queue.push(t.id);
    this.autoplayed.add(t.id);
    return this.queue.length - 1;
  }

  private onEnded(): void {
    if (this.repeat === 'one') {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => this.emit('state'));
      return;
    }
    this.next(false);
  }

  /** Leaving a track before it counted as a play is a negative signal. */
  private markSkip(): void {
    const t = this.current;
    if (!t || this.counted || this.audio.currentTime < 1) return;
    this.store.update(t.id, (s) => s.skips++);
    this.emit('stats');
  }

  private checkCounted(): void {
    const t = this.current;
    if (this.counted || !t) return;
    const d = this.audio.duration;
    const threshold = Number.isFinite(d) ? Math.min(PLAY_THRESHOLD, d * 0.5) : PLAY_THRESHOLD;
    if (this.audio.currentTime < threshold) return;
    this.counted = true;
    this.store.update(t.id, (s) => {
      s.plays++;
      s.lastPlayed = Date.now();
    });
    this.emit('stats');
  }

  private load(i: number): void {
    if (i < 0 || i >= this.queue.length) return;
    this.index = i;
    this.counted = false;
    const t = this.current;
    if (!t) return;
    this.store.pushHistory(t.id);
    const token = ++this.loadToken;

    if (!isFsFile(t.src)) {
      this.loading = false;
      this.audio.src = t.src;
      this.audio.play().catch(() => this.emit('state'));
      this.emit('track');
      this.prefetchNext();
      return;
    }

    this.loading = true;
    this.audio.src = SILENT;
    this.audio.play().catch(() => undefined);
    this.emit('track');
    this.resolveSrc(t.src).then(
      (url) => {
        if (token !== this.loadToken) return; // user moved on meanwhile
        this.loading = false;
        this.audio.src = url;
        this.audio.play().catch(() => this.emit('state'));
        this.emit('state');
        this.prefetchNext();
      },
      () => {
        if (token !== this.loadToken) return;
        this.loading = false;
        this.audio.pause();
        this.onError("Couldn't load this song — check your connection.");
        this.emit('state');
      },
    );
  }

  /** Warm the cache for the next queued song so it starts instantly. */
  private prefetchNext(): void {
    const next = this.byId.get(this.queue[this.index + 1]);
    if (next && isFsFile(next.src)) this.resolveSrc(next.src).catch(() => undefined);
  }

}
