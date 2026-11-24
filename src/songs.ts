import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type UpdateData,
} from 'firebase/firestore';
import { firebase } from './firebase';
import { removeAudio } from './filestore';
import type { Genre, Mood, Track } from './types';

/** Shape of a document in the `songs` collection. */
export interface SongDoc {
  title: string;
  artist: string;
  album: string;
  genre: Genre;
  mood: Mood;
  bpm: number;
  energy: number;
  acousticness: number;
  hue: number;
  /** `fsfile:{id}` for uploaded audio (see filestore.ts). */
  audioUrl: string;
  /** `files/{id}` — used to delete the audio. */
  audioPath: string;
  /** Small JPEG data URL stored inline, or null for a generated cover. */
  coverUrl: string | null;
  /** Unused since covers are inline; kept for older documents. */
  coverPath: string | null;
  duration: number | null;
  published: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp | null;
  createdBy?: string;
}

export interface Song extends SongDoc {
  id: string;
}

const songsCol = () => collection(firebase().db, 'songs');

export function songToTrack(s: Song): Track {
  return {
    id: `fs_${s.id}`,
    title: s.title,
    artist: s.artist,
    album: s.album || 'Single',
    genre: s.genre,
    mood: s.mood,
    bpm: s.bpm,
    energy: s.energy,
    acousticness: s.acousticness,
    hue: s.hue,
    src: s.audioUrl,
    coverUrl: s.coverUrl ?? undefined,
    duration: s.duration ?? undefined,
    releasedAt: (s.publishedAt ?? s.createdAt)?.toMillis(),
  };
}

const sortNewest = (a: Song, b: Song) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);

/** Songs visible to listeners. The `where` clause is required: rules reject unfiltered reads. */
export async function fetchPublishedSongs(): Promise<Song[]> {
  const snap = await getDocs(query(songsCol(), where('published', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SongDoc) })).sort(sortNewest);
}

/** Every song including drafts — admins only. */
export async function fetchAllSongs(): Promise<Song[]> {
  const snap = await getDocs(songsCol());
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SongDoc) })).sort(sortNewest);
}

export async function createSong(data: Omit<SongDoc, 'createdAt' | 'updatedAt' | 'publishedAt'>): Promise<string> {
  const ref = await addDoc(songsCol(), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: data.published ? serverTimestamp() : null,
  });
  return ref.id;
}

export async function updateSong(id: string, data: Partial<SongDoc>, wasPublished: boolean): Promise<void> {
  const patch: UpdateData<SongDoc> = { ...data, updatedAt: serverTimestamp() };
  if (data.published === true && !wasPublished) patch.publishedAt = serverTimestamp();
  await updateDoc(doc(firebase().db, 'songs', id), patch);
}

export async function deleteSong(song: Song): Promise<void> {
  await deleteDoc(doc(firebase().db, 'songs', song.id));
  await removeAudio(song.audioPath);
}
