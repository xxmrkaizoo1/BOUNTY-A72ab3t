import type { Genre, Mood, Track } from './types';

export const GENRES: Genre[] = ['electronic', 'ambient', 'rock', 'jazz', 'hiphop', 'classical'];
export const MOODS: Mood[] = ['chill', 'energetic', 'focus', 'happy', 'melancholy'];

export const GENRE_LABEL: Record<Genre, string> = {
  electronic: 'Electronic',
  ambient: 'Ambient',
  rock: 'Rock',
  jazz: 'Jazz',
  hiphop: 'Hip-Hop',
  classical: 'Classical',
};

export const MOOD_LABEL: Record<Mood, string> = {
  chill: 'Chill',
  energetic: 'Energetic',
  focus: 'Focus',
  happy: 'Happy',
  melancholy: 'Melancholy',
};

/**
 * Demo catalog. Audio is the free SoundHelix sample set; titles, artists and
 * audio features are made-up metadata so the recommender has something to work with.
 * Replace `src` with your own files (e.g. in /public/music or Firebase Storage).
 */
const sh = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

type Seed = Omit<Track, 'id' | 'src'>;

const seeds: Seed[] = [
  { title: 'Neon Tide', artist: 'Lumen Drift', album: 'Afterglow', genre: 'electronic', mood: 'energetic', bpm: 128, energy: 0.86, acousticness: 0.05, hue: 190 },
  { title: 'Paper Satellites', artist: 'Orbit Bloom', album: 'Low Orbit', genre: 'ambient', mood: 'chill', bpm: 72, energy: 0.25, acousticness: 0.4, hue: 250 },
  { title: 'Rust & Thunder', artist: 'The Kilnmen', album: 'Forge', genre: 'rock', mood: 'energetic', bpm: 142, energy: 0.92, acousticness: 0.2, hue: 12 },
  { title: 'Late Bloom Blue', artist: 'Mara Quintet', album: 'Smoke Rings', genre: 'jazz', mood: 'chill', bpm: 88, energy: 0.35, acousticness: 0.85, hue: 220 },
  { title: 'Concrete Halo', artist: 'Vexa Rae', album: 'Blocks', genre: 'hiphop', mood: 'focus', bpm: 92, energy: 0.6, acousticness: 0.15, hue: 40 },
  { title: 'Glass Cathedral', artist: 'Aurel Strings', album: 'Nocturnes', genre: 'classical', mood: 'melancholy', bpm: 66, energy: 0.2, acousticness: 0.95, hue: 280 },
  { title: 'Pixel Sunrise', artist: 'Lumen Drift', album: 'Afterglow', genre: 'electronic', mood: 'happy', bpm: 118, energy: 0.74, acousticness: 0.08, hue: 160 },
  { title: 'Fog Index', artist: 'Orbit Bloom', album: 'Low Orbit', genre: 'ambient', mood: 'focus', bpm: 80, energy: 0.3, acousticness: 0.35, hue: 200 },
  { title: 'Highway Saints', artist: 'The Kilnmen', album: 'Forge', genre: 'rock', mood: 'happy', bpm: 132, energy: 0.8, acousticness: 0.3, hue: 30 },
  { title: 'Velvet Detour', artist: 'Mara Quintet', album: 'Smoke Rings', genre: 'jazz', mood: 'happy', bpm: 104, energy: 0.55, acousticness: 0.8, hue: 330 },
  { title: 'Night Shift Cipher', artist: 'Vexa Rae', album: 'Blocks', genre: 'hiphop', mood: 'energetic', bpm: 96, energy: 0.78, acousticness: 0.1, hue: 300 },
  { title: 'Winter Etude', artist: 'Aurel Strings', album: 'Nocturnes', genre: 'classical', mood: 'focus', bpm: 76, energy: 0.28, acousticness: 0.92, hue: 210 },
  { title: 'Static Hearts', artist: 'Kiro Vale', album: 'Signal Loss', genre: 'electronic', mood: 'melancholy', bpm: 100, energy: 0.5, acousticness: 0.1, hue: 270 },
  { title: 'Tidal Hours', artist: 'Kiro Vale', album: 'Signal Loss', genre: 'ambient', mood: 'melancholy', bpm: 68, energy: 0.22, acousticness: 0.5, hue: 230 },
  { title: 'Desert Engine', artist: 'Sable Run', album: 'Mirage', genre: 'rock', mood: 'focus', bpm: 120, energy: 0.66, acousticness: 0.4, hue: 25 },
  { title: 'Soft Focus', artist: 'Sable Run', album: 'Mirage', genre: 'electronic', mood: 'chill', bpm: 96, energy: 0.42, acousticness: 0.2, hue: 175 },
];

export const CATALOG: Track[] = seeds.map((s, i) => ({ ...s, id: `t${i + 1}`, src: sh(i + 1) }));
