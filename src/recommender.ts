import { GENRES, GENRE_LABEL, MOODS, MOOD_LABEL } from './catalog';
import type { Store } from './store';
import type { Mood, Recommendation, Track, TrackStats } from './types';

/**
 * Content-based recommender.
 *
 * Every track becomes a feature vector (genre one-hot, mood one-hot, tempo,
 * energy, acousticness). The listener's taste profile is the weighted average of
 * the vectors of tracks they interacted with — likes and full plays pull it
 * toward a track, skips and dislikes push it away. Candidates are ranked by
 * cosine similarity to that profile, blended with similarity to what's playing.
 */

const vectorize = (t: Track): number[] => [
  ...GENRES.map((g) => (g === t.genre ? 1 : 0)),
  ...MOODS.map((m) => (m === t.mood ? 0.8 : 0)),
  (t.bpm - 60) / 120,
  t.energy,
  t.acousticness,
];

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Stable pseudo-random value in [0, 1) so cold-start picks don't reshuffle on every render. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const FRESH_MS = 14 * 24 * 60 * 60 * 1000;
const isFresh = (t: Track) => !!t.releasedAt && Date.now() - t.releasedAt < FRESH_MS;

/** How strongly a track's stats say "more like this" (positive) or "less" (negative). */
export function signal(s: TrackStats): number {
  let w = 0;
  if (s.liked) w += 3;
  if (s.disliked) w -= 4;
  w += Math.log1p(s.plays) * 1.2;
  w -= Math.min(s.skips, 5) * 0.7;
  return w;
}

export interface TasteBar {
  label: string;
  value: number;
}

export class Recommender {
  private vecs: Map<string, number[]>;

  constructor(
    private tracks: Track[],
    private store: Store,
  ) {
    this.vecs = new Map(tracks.map((t) => [t.id, vectorize(t)]));
  }

  private vec(t: Track): number[] {
    return this.vecs.get(t.id) ?? vectorize(t);
  }

  private allowed(t: Track): boolean {
    return !this.store.stats(t.id).disliked;
  }

  profile(): number[] | null {
    if (!this.tracks.length) return null;
    const acc = new Array<number>(this.vec(this.tracks[0]).length).fill(0);
    let total = 0;
    for (const t of this.tracks) {
      const w = signal(this.store.stats(t.id));
      if (!w) continue;
      this.vec(t).forEach((x, i) => (acc[i] += x * w));
      total += Math.abs(w);
    }
    return total ? acc.map((x) => x / total) : null;
  }

  /** Genre affinities for the "Your taste" panel, scaled so the top genre = 1. */
  tasteSummary(): TasteBar[] {
    const p = this.profile();
    if (!p) return [];
    const bars = GENRES.map((g, i) => ({ label: GENRE_LABEL[g], value: Math.max(0, p[i]) }))
      .filter((b) => b.value > 0.01)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
    const max = bars[0]?.value ?? 1;
    return bars.map((b) => ({ ...b, value: b.value / max }));
  }

  private explain(t: Track, current: Track | null, taste: number, ctx: number): string {
    const s = this.store.stats(t.id);
    if (current && ctx >= taste && ctx > 0.6) return `Similar to ${current.title}`;

    let best: Track | null = null;
    let bestSim = 0.6;
    for (const a of this.tracks) {
      if (a.id === t.id || signal(this.store.stats(a.id)) <= 0) continue;
      const sim = cosine(this.vec(a), this.vec(t));
      if (sim > bestSim) {
        best = a;
        bestSim = sim;
      }
    }
    if (s.plays === 0 && isFresh(t)) return 'Just released on MyMusic';
    if (best) return this.store.stats(best.id).liked ? `Because you liked ${best.title}` : `Because you played ${best.title}`;
    if (s.liked) return 'One of your favourites';
    if (s.plays === 0) return `New ${GENRE_LABEL[t.genre]} for you`;
    return `${MOOD_LABEL[t.mood]} ${GENRE_LABEL[t.genre]} pick`;
  }

  /** Main "Made for you" ranking. */
  forYou(current: Track | null, n = 8, exclude: ReadonlySet<string> = new Set()): Recommendation[] {
    const p = this.profile();
    const cv = current ? this.vec(current) : null;
    const recent = new Set(this.store.history.slice(-6));

    return this.tracks
      .filter((t) => this.allowed(t) && t.id !== current?.id && !exclude.has(t.id))
      .map((t) => {
        const s = this.store.stats(t.id);
        const v = this.vec(t);
        if (!p && !cv) {
          return { track: t, score: t.energy * 0.3 + hash(t.id) * 0.7, reason: 'Popular on MyMusic' };
        }
        const taste = p ? cosine(p, v) : 0;
        const ctx = cv ? cosine(cv, v) : 0;
        const score =
          0.6 * taste +
          0.3 * ctx +
          (s.plays === 0 ? 0.12 : 0) +
          (s.plays === 0 && isFresh(t) ? 0.1 : 0) +
          (s.liked ? 0.08 : 0) -
          (recent.has(t.id) ? 0.35 : 0);
        return { track: t, score, reason: this.explain(t, current, taste, ctx) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  /** Tracks that sound like `track`, regardless of taste. */
  similar(track: Track, n = 6): Recommendation[] {
    const base = this.vec(track);
    return this.tracks
      .filter((t) => t.id !== track.id && this.allowed(t))
      .map((t) => {
        let reason: string;
        if (t.genre === track.genre && t.mood === track.mood) reason = `Same ${MOOD_LABEL[t.mood].toLowerCase()} ${GENRE_LABEL[t.genre]} vibe`;
        else if (t.genre === track.genre) reason = `More ${GENRE_LABEL[t.genre]}`;
        else if (t.mood === track.mood) reason = `Also ${MOOD_LABEL[t.mood].toLowerCase()}`;
        else if (t.artist === track.artist) reason = `More from ${t.artist}`;
        else reason = `${t.bpm} BPM, similar energy`;
        return { track: t, score: cosine(base, this.vec(t)) + (t.artist === track.artist ? 0.1 : 0), reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  /** Never-played tracks, best taste match first. */
  discover(n = 6): Recommendation[] {
    const p = this.profile();
    return this.tracks
      .filter((t) => this.allowed(t) && this.store.stats(t.id).plays === 0)
      .map((t) => ({
        track: t,
        score: (p ? cosine(p, this.vec(t)) : hash(t.id)) + (isFresh(t) ? 0.25 : 0),
        reason: isFresh(t) ? 'Just released on MyMusic' : "You haven't heard this yet",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  /** A mood mix ranked by taste. */
  byMood(mood: Mood | 'all'): Track[] {
    const p = this.profile();
    return this.tracks
      .filter((t) => this.allowed(t) && (mood === 'all' || t.mood === mood))
      .map((t) => ({ t, score: p ? cosine(p, this.vec(t)) : hash(t.id) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t);
  }

  /** Next track for autoplay when the queue runs out. */
  nextAutoplay(current: Track | null, queued: ReadonlySet<string>): Track | null {
    return this.forYou(current, 1, queued)[0]?.track ?? this.forYou(current, 1)[0]?.track ?? null;
  }
}
