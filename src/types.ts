export type Genre = 'electronic' | 'ambient' | 'rock' | 'jazz' | 'hiphop' | 'classical';
export type Mood = 'chill' | 'energetic' | 'focus' | 'happy' | 'melancholy';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: Genre;
  mood: Mood;
  /** Beats per minute, roughly 60–180. */
  bpm: number;
  /** 0–1: how intense the track feels. */
  energy: number;
  /** 0–1: acoustic (1) vs. synthetic (0). */
  acousticness: number;
  /** Hue used to generate the cover art (and tint the UI) when there's no image. */
  hue: number;
  src: string;
  /** Uploaded cover image (songs published from the admin). */
  coverUrl?: string;
  /** Seconds, if known up front. */
  duration?: number;
  /** ms timestamp — songs published recently get a "Just released" boost. */
  releasedAt?: number;
}

export interface TrackStats {
  plays: number;
  skips: number;
  liked: boolean;
  disliked: boolean;
  lastPlayed: number;
}

export interface Recommendation {
  track: Track;
  score: number;
  reason: string;
}

/** What changed, so the UI only re-renders what it has to. */
export type ChangeKind = 'track' | 'state' | 'queue' | 'stats';
