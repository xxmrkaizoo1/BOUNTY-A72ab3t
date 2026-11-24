/**
 * Audio files stored inside Firestore, so MyMusic runs on the free Spark plan
 * (Cloud Storage needs Blaze on new projects).
 *
 *   files/{fileId}                 { contentType, size, chunks, createdBy, createdAt }
 *   files/{fileId}/chunks/{000…}   { data: Bytes }   ≤ 900 KB each
 *
 * Songs reference a file as `fsfile:{fileId}`. Chunks are written first and the
 * `files/{fileId}` document last, so a file only "exists" once fully uploaded.
 * Played files are kept in the browser's Cache Storage so replays cost nothing.
 */
import { Bytes, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebase } from './firebase';
import { FS_PREFIX, isFsFile } from './fsref';

export { FS_PREFIX, isFsFile };
export const CHUNK_BYTES = 900_000;
/** Keep in sync with firestore.rules. */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const CACHE_NAME = 'mymusic-audio-v1';

const fileIdOf = (ref: string) => ref.replace(FS_PREFIX, '').replace(/^files\//, '');
const chunkId = (i: number) => String(i).padStart(3, '0');

export interface UploadedFile {
  /** What a song stores in `audioUrl`. */
  url: string;
  /** What a song stores in `audioPath` (used for deletion). */
  path: string;
}

export async function uploadAudio(file: File, uid: string, onProgress: (fraction: number) => void): Promise<UploadedFile> {
  if (file.size > MAX_AUDIO_BYTES) throw new Error(`Audio must be under ${MAX_AUDIO_BYTES / 1024 / 1024} MB.`);
  const { db } = firebase();
  const fileRef = doc(collection(db, 'files'));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));

  try {
    for (let i = 0; i < chunks; i++) {
      const part = bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
      await setDoc(doc(fileRef, 'chunks', chunkId(i)), { data: Bytes.fromUint8Array(part) });
      onProgress((i + 1) / chunks);
    }
    await setDoc(fileRef, {
      contentType: file.type || 'audio/mpeg',
      size: bytes.length,
      chunks,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    await deleteChunks(fileRef.id, chunks).catch(() => undefined);
    throw e;
  }
  return { url: FS_PREFIX + fileRef.id, path: `files/${fileRef.id}` };
}

async function deleteChunks(fileId: string, chunks: number): Promise<void> {
  const { db } = firebase();
  await Promise.all(Array.from({ length: chunks }, (_, i) => deleteDoc(doc(db, 'files', fileId, 'chunks', chunkId(i)))));
}

/** Delete a stored file. Accepts `files/{id}` or `fsfile:{id}`; anything else (e.g. demo URLs) is ignored. */
export async function removeAudio(ref: string | null | undefined): Promise<void> {
  if (!ref || !(ref.startsWith('files/') || isFsFile(ref))) return;
  const { db } = firebase();
  const id = fileIdOf(ref);
  const meta = await getDoc(doc(db, 'files', id));
  if (!meta.exists()) return;
  await deleteChunks(id, Number(meta.data().chunks) || 0);
  await deleteDoc(doc(db, 'files', id));
  try {
    await (await caches.open(CACHE_NAME)).delete(cacheKey(id));
  } catch {
    /* no Cache Storage */
  }
}

const cacheKey = (id: string) => `/__mymusic-audio/${id}`;
const resolved = new Map<string, Promise<string>>();

/** Turn a track's `src` into something an <audio> element can play. */
export function resolveAudio(src: string): Promise<string> {
  if (!isFsFile(src)) return Promise.resolve(src);
  const id = fileIdOf(src);
  let p = resolved.get(id);
  if (!p) {
    p = loadBlobUrl(id);
    resolved.set(id, p);
    p.catch(() => resolved.delete(id)); // allow a retry after a network error
  }
  return p;
}

async function loadBlobUrl(id: string): Promise<string> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheKey(id));
    if (hit) return URL.createObjectURL(await hit.blob());
  } catch {
    cache = null;
  }

  const { db } = firebase();
  const meta = await getDoc(doc(db, 'files', id));
  if (!meta.exists()) throw new Error('Audio file not found.');
  const { chunks, contentType } = meta.data() as { chunks: number; contentType: string };
  const parts = await Promise.all(
    Array.from({ length: chunks }, async (_, i) => {
      const snap = await getDoc(doc(db, 'files', id, 'chunks', chunkId(i)));
      const data = snap.get('data') as Bytes | undefined;
      if (!data) throw new Error(`Audio chunk ${i} missing.`);
      return data.toUint8Array();
    }),
  );
  const blob = new Blob(parts as BlobPart[], { type: contentType });
  try {
    await cache?.put(cacheKey(id), new Response(blob, { headers: { 'Content-Type': contentType } }));
  } catch {
    /* quota exceeded — just don't cache */
  }
  return URL.createObjectURL(blob);
}

/** Shrink a cover image to a small JPEG data URL that fits inside the song document. */
export async function coverToDataUrl(file: File, size = 320, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported.');
  // centre-crop to a square
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  let q = quality;
  let url = canvas.toDataURL('image/jpeg', q);
  while (url.length > 150_000 && q > 0.4) {
    q -= 0.1;
    url = canvas.toDataURL('image/jpeg', q);
  }
  return url;
}
