import '../style.css';
import './admin.css';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { GENRES, GENRE_LABEL, MOODS, MOOD_LABEL } from '../catalog';
import { firebase, firebaseEnabled, useEmulators } from '../firebase';
import {
  createSong,
  deleteSong,
  fetchAllSongs,
  updateSong,
  type Song,
  type SongDoc,
} from '../songs';
import type { Genre, Mood } from '../types';
import { coverToDataUrl, isFsFile, MAX_AUDIO_BYTES, removeAudio, uploadAudio } from '../filestore';
import { analyzeAudio, type Analysis } from './analyze';

// ---------------------------------------------------------------- helpers

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const fmt = (sec: number | null | undefined) =>
  sec != null && Number.isFinite(sec) ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '–:––';
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter((w) => /\w/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '♪';

const ICON = {
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2 6.2 6.5 1.3-6.5 1.8L12 18l-2-6.2L3.5 10l6.5-1.3z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12Z"/></svg>',
};

// ---------------------------------------------------------------- state

type Filter = 'all' | 'published' | 'draft';

interface FormState {
  editing: Song | null;
  audioFile: File | null;
  audioPreviewUrl: string | null;
  analysis: Analysis | null;
  analyzing: boolean;
  coverFile: File | null;
  coverPreviewUrl: string | null;
  removeCover: boolean;
}

const rootEl = document.querySelector<HTMLElement>('#studio');
if (!rootEl) throw new Error('#studio missing');
const root: HTMLElement = rootEl;

let user: User | null = null;
let songs: Song[] = [];
let filter: Filter = 'all';
let search = '';
let busy = false;
let toastTimer = 0;
let form: FormState = blankForm();

function blankForm(): FormState {
  return {
    editing: null,
    audioFile: null,
    audioPreviewUrl: null,
    analysis: null,
    analyzing: false,
    coverFile: null,
    coverPreviewUrl: null,
    removeCover: false,
  };
}

function resetForm(): void {
  if (form.audioPreviewUrl) URL.revokeObjectURL(form.audioPreviewUrl);
  if (form.coverPreviewUrl) URL.revokeObjectURL(form.coverPreviewUrl);
  form = blankForm();
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);

function toast(msg: string, kind: 'ok' | 'error' = 'ok'): void {
  const el = document.querySelector<HTMLElement>('#studio-toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
}

function errorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const known: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/email-already-in-use': 'That email already has an account — sign in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/unauthorized-domain': `Google sign-in isn't allowed on ${location.hostname} yet. Add it in Firebase console → Authentication → Settings → Authorized domains, or use email & password.`,
    'auth/operation-not-allowed': 'This sign-in method is turned off. Enable it in Firebase console → Authentication → Sign-in method.',
    'auth/popup-blocked': 'The browser blocked the sign-in popup — allow popups for this site and try again.',
    'auth/too-many-requests': 'Too many attempts — wait a minute and try again.',
    'auth/network-request-failed': 'Network error — check your connection.',
    'permission-denied': 'Permission denied — this account is not an admin.',
  };
  return known[code] ?? (e instanceof Error ? e.message : String(e));
}

// ---------------------------------------------------------------- frame

function frame(body: string): void {
  root.innerHTML = `
    <div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="studio">
      <header class="studio-head">
        <a class="studio-brand" href="/">${ICON.back}<span class="logo">${ICON.sparkle}</span><span>MyMusic <b>Studio</b></span></a>
        ${useEmulators ? '<span class="env-pill">Emulators</span>' : ''}
        ${
          user
            ? `<div class="who"><span title="${esc(user.uid)}">${esc(user.email ?? user.displayName ?? 'Signed in')}</span>
               <button class="ghost-btn" data-action="signout">Sign out</button></div>`
            : ''
        }
      </header>
      ${body}
    </div>
    <div class="studio-toast" id="studio-toast" role="status"></div>`;
}

// ---------------------------------------------------------------- screens

function renderNoConfig(): void {
  frame(`
    <section class="panel narrow">
      <h1>Connect Firebase</h1>
      <p class="muted">MyMusic Studio stores songs in Firestore (works on the free Spark plan). Add your web-app config to <code>.env.local</code>:</p>
      <ol class="steps">
        <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in the values from <em>Firebase console → Project settings → Your apps</em>.</li>
        <li>Enable <b>Authentication</b> (Email/Password and/or Google) and create a <b>Firestore</b> database.</li>
        <li>Run <code>firebase deploy --only firestore:rules</code>, then restart <code>npm run dev</code>.</li>
      </ol>
      <p class="muted">Want to try it locally first? Run <code>npm run emulators</code> and <code>npm run dev:emulator</code>.</p>
    </section>`);
}

function renderSignIn(): void {
  frame(`
    <section class="panel narrow auth">
      <h1>Sign in to publish</h1>
      <p class="muted">Only admins can upload and publish songs to MyMusic.</p>
      <form id="auth-form" class="fields">
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>
        <div class="row-actions">
          <button class="pill" type="submit" name="mode" value="signin">Sign in</button>
          <button class="ghost-btn" type="submit" name="mode" value="signup">Create account</button>
        </div>
      </form>
      <div class="or"><span>or</span></div>
      <button class="ghost-btn wide" data-action="google">${ICON.google}Continue with Google</button>
    </section>`);
}

function renderNotAdmin(): void {
  frame(`
    <section class="panel narrow">
      <h1>Almost there</h1>
      <p class="muted">You're signed in, but this account isn't an admin yet. To grant access, create this Firestore document (any fields, e.g. <code>{ role: "admin" }</code>):</p>
      <pre class="code">admins/${esc(user?.uid ?? '')}</pre>
      <button class="ghost-btn" data-action="copy-uid">Copy my UID</button>
      <p class="muted small">Firebase console → Firestore → Start collection <b>admins</b> → Document ID = your UID. Then:</p>
      <button class="pill" data-action="recheck">I've added it — check again</button>
    </section>`);
}

function renderDashboard(): void {
  frame(`
    <div class="dash">
      <section class="panel form-panel" id="form-panel"></section>
      <section class="panel list-panel">
        <header class="list-head">
          <div>
            <h2>Catalog</h2>
            <p class="muted" id="stats"></p>
          </div>
          <input class="search" id="search" type="search" placeholder="Search songs…" value="${esc(search)}" />
        </header>
        <div class="tabs" id="tabs"></div>
        <ul class="song-list" id="song-list"></ul>
      </section>
    </div>`);
  renderForm();
  renderList();
}

// ---------------------------------------------------------------- form

function coverStyle(hue: number, url: string | null): string {
  return url
    ? `--h:${hue};background-image:url(&quot;${esc(url)}&quot;)`
    : `--h:${hue}`;
}

function renderForm(): void {
  const panel = $('#form-panel');
  if (!panel) return;
  const e = form.editing;
  const a = form.analysis;
  const hue = e?.hue ?? Math.floor(Math.random() * 360);
  const coverUrl = form.coverPreviewUrl ?? (form.removeCover ? null : e?.coverUrl ?? null);
  const audioName = form.audioFile?.name ?? (e ? 'Current audio file' : null);

  panel.innerHTML = `
    <header class="form-head">
      <div>
        <p class="eyebrow">${e ? 'Editing' : 'New release'}</p>
        <h2>${e ? esc(e.title) : 'Publish a song'}</h2>
      </div>
      ${e ? `<button class="ghost-btn" data-action="cancel-edit">Cancel</button>` : ''}
    </header>

    <form id="song-form" class="fields" novalidate>
      <div class="drop ${form.audioFile || e ? 'filled' : ''}" id="drop-audio" data-kind="audio" tabindex="0" role="button" aria-label="Choose audio file">
        <input type="file" id="audio-input" accept="audio/*" hidden />
        ${
          audioName
            ? `<div class="drop-file">
                 <span class="drop-icon">${ICON.music}</span>
                 <div class="drop-meta">
                   <strong>${esc(audioName)}</strong>
                   <span class="muted">${
                     form.audioFile
                       ? `${mb(form.audioFile.size)} · ${form.analyzing ? 'Analysing…' : a ? fmt(a.duration) : '—'}`
                       : `${fmt(e?.duration)} · drop a new file to replace`
                   }</span>
                 </div>
                 <span class="muted small">Replace</span>
               </div>
               ${a ? '<canvas class="wave" id="wave"></canvas>' : form.analyzing ? '<div class="wave shimmer"></div>' : ''}
               ${form.audioPreviewUrl || (e?.audioUrl && !isFsFile(e.audioUrl)) ? `<audio controls preload="metadata" src="${esc(form.audioPreviewUrl ?? e?.audioUrl ?? '')}"></audio>` : ''}`
            : `<span class="drop-icon big">${ICON.upload}</span>
               <strong>Drop an audio file or click to browse</strong>
               <span class="muted small">MP3, M4A, OGG, WAV · up to 15 MB · BPM &amp; energy are detected automatically</span>`
        }
      </div>

      <div class="grid2">
        <label>Title<input name="title" maxlength="120" required value="${esc(e?.title ?? '')}" /></label>
        <label>Artist<input name="artist" maxlength="120" required value="${esc(e?.artist ?? '')}" /></label>
        <label>Album<input name="album" maxlength="120" placeholder="Single" value="${esc(e?.album ?? '')}" /></label>
        <label>Genre<select name="genre">${GENRES.map((g) => `<option value="${g}" ${e?.genre === g ? 'selected' : ''}>${GENRE_LABEL[g]}</option>`).join('')}</select></label>
        <label>Mood<select name="mood">${MOODS.map((m) => `<option value="${m}" ${e?.mood === m ? 'selected' : ''}>${MOOD_LABEL[m]}</option>`).join('')}</select></label>
        <label>BPM <small class="hint" id="bpm-hint">${a?.bpm ? 'detected' : ''}</small>
          <input name="bpm" type="number" min="40" max="220" step="1" required value="${e?.bpm ?? a?.bpm ?? 110}" />
        </label>
      </div>

      <div class="sliders">
        <label class="slider">
          <span>Energy <small class="hint" id="energy-hint">${a ? 'detected' : ''}</small></span>
          <input name="energy" type="range" min="0" max="1" step="0.01" value="${e?.energy ?? a?.energy ?? 0.5}" />
          <output>${Math.round((e?.energy ?? a?.energy ?? 0.5) * 100)}</output>
        </label>
        <label class="slider">
          <span>Acoustic</span>
          <input name="acousticness" type="range" min="0" max="1" step="0.01" value="${e?.acousticness ?? 0.3}" />
          <output>${Math.round((e?.acousticness ?? 0.3) * 100)}</output>
        </label>
      </div>

      <div class="cover-row">
        <div class="drop cover-drop" id="drop-cover" data-kind="cover" tabindex="0" role="button" aria-label="Choose cover image">
          <input type="file" id="cover-input" accept="image/png,image/jpeg,image/webp,image/avif" hidden />
          <div class="cover big ${coverUrl ? 'has-art' : ''}" id="cover-preview" style="${coverStyle(hue, coverUrl)}">
            ${coverUrl ? '' : `<span>${esc(initials(e?.title ?? ''))}</span>`}
          </div>
          <span class="cover-hint">${ICON.image}${coverUrl ? 'Change' : 'Add cover'}</span>
        </div>
        <div class="cover-side">
          <label class="slider">
            <span>Accent colour</span>
            <input name="hue" type="range" min="0" max="360" step="1" value="${hue}" class="hue" />
            <output>${hue}°</output>
          </label>
          <p class="muted small">Tints the player while this song plays, and is the cover when there's no image.</p>
          ${coverUrl ? `<button type="button" class="ghost-btn" data-action="remove-cover">Remove image</button>` : ''}
        </div>
      </div>

      <div class="upload" id="upload" hidden><div class="upbar"><i id="upbar"></i></div><span id="upload-label">Uploading…</span></div>

      <div class="form-actions">
        <button class="ghost-btn" type="submit" name="intent" value="draft" ${busy ? 'disabled' : ''}>${e ? 'Save' : 'Save draft'}${e?.published ? ' (stays live)' : ''}</button>
        <button class="pill" type="submit" name="intent" value="publish" ${busy ? 'disabled' : ''}>${ICON.sparkle}${e?.published ? 'Save & keep published' : 'Publish now'}</button>
      </div>
    </form>`;

  if (a) drawWave(a.peaks, hue);
}

function drawWave(peaks: Float32Array, hue: number): void {
  const canvas = $<HTMLCanvasElement>('#wave');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const bw = w / peaks.length;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, `hsl(${hue - 60} 90% 65%)`);
  grad.addColorStop(1, `hsl(${hue + 20} 95% 72%)`);
  ctx.fillStyle = grad;
  peaks.forEach((p, i) => {
    const bh = Math.max(2, p * (h - 4));
    ctx.fillRect(i * bw + 0.5, (h - bh) / 2, Math.max(1, bw - 1.5), bh);
  });
}

async function chooseAudio(file: File): Promise<void> {
  if (!file.type.startsWith('audio/')) return toast('That is not an audio file.', 'error');
  if (file.size > MAX_AUDIO_BYTES) return toast(`Audio must be under ${MAX_AUDIO_BYTES / 1024 / 1024} MB (free-plan storage).`, 'error');
  const snapshot = readForm();
  if (form.audioPreviewUrl) URL.revokeObjectURL(form.audioPreviewUrl);
  form.audioFile = file;
  form.audioPreviewUrl = URL.createObjectURL(file);
  form.analysis = null;
  form.analyzing = true;
  renderForm();
  restoreForm(snapshot);

  // Fill the title from the filename if it's empty ("01 - My Song.mp3" → "My Song").
  const title = $<HTMLInputElement>('input[name=title]');
  if (title && !title.value) title.value = file.name.replace(/\.[^.]+$/, '').replace(/^\d+\s*[-_.]\s*/, '').replace(/[_]+/g, ' ').trim();

  try {
    const analysis = await analyzeAudio(file);
    if (form.audioFile !== file) return; // a newer file was chosen meanwhile
    form.analysis = analysis;
  } catch (e) {
    console.warn(e);
    toast("Couldn't analyse this file — fill BPM and energy by hand.", 'error');
  } finally {
    if (form.audioFile === file) {
      form.analyzing = false;
      const keep = readForm();
      renderForm();
      restoreForm(keep, true);
    }
  }
}

function chooseCover(file: File): void {
  if (!file.type.startsWith('image/')) return toast('That is not an image.', 'error');
  if (file.size > 20 * 1024 * 1024) return toast('Cover image must be under 20 MB.', 'error');
  const snapshot = readForm();
  if (form.coverPreviewUrl) URL.revokeObjectURL(form.coverPreviewUrl);
  form.coverFile = file;
  form.coverPreviewUrl = URL.createObjectURL(file);
  form.removeCover = false;
  renderForm();
  restoreForm(snapshot);
}

type FormValues = Record<string, string>;

function readForm(): FormValues {
  const f = $<HTMLFormElement>('#song-form');
  if (!f) return {};
  const out: FormValues = {};
  new FormData(f).forEach((v, k) => (out[k] = String(v)));
  return out;
}

/** Re-apply typed values after a re-render; optionally let fresh analysis overwrite BPM/energy. */
function restoreForm(values: FormValues, applyAnalysis = false): void {
  const f = $<HTMLFormElement>('#song-form');
  if (!f) return;
  for (const [k, v] of Object.entries(values)) {
    const el = f.elements.namedItem(k);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = v;
  }
  const a = form.analysis;
  if (applyAnalysis && a && !form.editing) {
    if (a.bpm) (f.elements.namedItem('bpm') as HTMLInputElement).value = String(a.bpm);
    (f.elements.namedItem('energy') as HTMLInputElement).value = String(a.energy);
  }
  f.querySelectorAll<HTMLInputElement>('input[type=range]').forEach(syncOutput);
  syncCoverPreview();
}

function syncOutput(input: HTMLInputElement): void {
  const out = input.parentElement?.querySelector('output');
  if (!out) return;
  out.textContent = input.name === 'hue' ? `${input.value}°` : String(Math.round(Number(input.value) * 100));
}

function syncCoverPreview(): void {
  const hue = $<HTMLInputElement>('input[name=hue]')?.value ?? '0';
  const prev = $('#cover-preview');
  if (!prev) return;
  prev.style.setProperty('--h', hue);
  const span = prev.querySelector('span');
  const title = $<HTMLInputElement>('input[name=title]')?.value ?? '';
  if (span) span.textContent = initials(title);
  const wave = form.analysis;
  if (wave) drawWave(wave.peaks, Number(hue));
}

async function submit(intent: 'draft' | 'publish'): Promise<void> {
  if (busy || !user) return;
  const f = $<HTMLFormElement>('#song-form');
  if (!f) return;
  const v = readForm();
  const editing = form.editing;

  if (!editing && !form.audioFile) return toast('Choose an audio file first.', 'error');
  if (form.analyzing) return toast('Still analysing the audio — one moment.', 'error');
  if (!v.title?.trim() || !v.artist?.trim()) return toast('Title and artist are required.', 'error');
  const bpm = Number(v.bpm);
  if (!(bpm >= 40 && bpm <= 220)) return toast('BPM must be between 40 and 220.', 'error');

  const published = intent === 'publish' ? true : editing ? editing.published : false;
  let uploadedAudio: string | null = null;

  busy = true;
  setUploading(0, 'Starting…');
  f.querySelectorAll('button').forEach((b) => (b.disabled = true));

  try {
    let audioUrl = editing?.audioUrl ?? '';
    let audioPath = editing?.audioPath ?? '';
    let duration = editing?.duration ?? null;
    let coverUrl = form.removeCover ? null : editing?.coverUrl ?? null;

    if (form.coverFile) {
      setUploading(0, 'Preparing cover…');
      coverUrl = await coverToDataUrl(form.coverFile);
    }
    if (form.audioFile) {
      const up = await uploadAudio(form.audioFile, user.uid, (p) => setUploading(p, `Uploading audio · ${Math.round(p * 100)}%`));
      uploadedAudio = up.path;
      audioUrl = up.url;
      audioPath = up.path;
      duration = form.analysis?.duration ?? null;
    }
    setUploading(1, 'Saving…');

    const data: Omit<SongDoc, 'createdAt' | 'updatedAt' | 'publishedAt'> = {
      title: v.title.trim(),
      artist: v.artist.trim(),
      album: (v.album ?? '').trim(),
      genre: v.genre as Genre,
      mood: v.mood as Mood,
      bpm: Math.round(bpm),
      energy: Number(v.energy),
      acousticness: Number(v.acousticness),
      hue: Number(v.hue),
      audioUrl,
      audioPath,
      coverUrl,
      coverPath: null,
      duration,
      published,
      createdBy: editing?.createdBy ?? user.uid,
    };

    if (editing) {
      await updateSong(editing.id, data, editing.published);
      // The old audio is only removed once the document points at the new one.
      if (form.audioFile && editing.audioPath !== audioPath) await removeAudio(editing.audioPath).catch(console.warn);
    } else {
      await createSong(data);
    }

    toast(published ? `“${data.title}” is live on MyMusic` : `Saved “${data.title}” as a draft`);
    resetForm();
    await refresh(true);
  } catch (e) {
    console.error(e);
    // Don't leave an orphaned upload behind when the save failed.
    if (uploadedAudio) await removeAudio(uploadedAudio).catch(() => undefined);
    toast(errorMessage(e), 'error');
  } finally {
    busy = false;
    setUploading(null);
    $<HTMLFormElement>('#song-form')?.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }
}

function setUploading(fraction: number | null, label = ''): void {
  const wrap = $('#upload');
  if (!wrap) return;
  wrap.hidden = fraction === null;
  if (fraction === null) return;
  $('#upbar')?.style.setProperty('width', `${Math.round(fraction * 100)}%`);
  const l = $('#upload-label');
  if (l) l.textContent = label;
}

// ---------------------------------------------------------------- list

function renderList(): void {
  const list = $('#song-list');
  if (!list) return;
  const live = songs.filter((s) => s.published).length;
  const stats = $('#stats');
  if (stats) stats.textContent = `${songs.length} song${songs.length === 1 ? '' : 's'} · ${live} live · ${songs.length - live} draft${songs.length - live === 1 ? '' : 's'}`;

  const tabs = $('#tabs');
  if (tabs)
    tabs.innerHTML = (['all', 'published', 'draft'] as Filter[])
      .map((t) => `<button class="chip ${filter === t ? 'on' : ''}" data-action="filter" data-filter="${t}">${t === 'all' ? 'All' : t === 'published' ? 'Live' : 'Drafts'}</button>`)
      .join('');

  const q = search.trim().toLowerCase();
  const shown = songs.filter(
    (s) =>
      (filter === 'all' || (filter === 'published' ? s.published : !s.published)) &&
      (!q || [s.title, s.artist, s.album].some((x) => x.toLowerCase().includes(q))),
  );

  list.innerHTML = shown.length
    ? shown
        .map(
          (s, i) => `
      <li class="song ${form.editing?.id === s.id ? 'editing' : ''}" style="--i:${Math.min(i, 10)}">
        <div class="cover xs ${s.coverUrl ? 'has-art' : ''}" style="${coverStyle(s.hue, s.coverUrl)}">${s.coverUrl ? '' : `<span>${esc(initials(s.title))}</span>`}</div>
        <div class="song-main">
          <strong>${esc(s.title)}</strong>
          <span class="muted">${esc(s.artist)}${s.album ? ` · ${esc(s.album)}` : ''}</span>
        </div>
        <span class="song-tags muted">${GENRE_LABEL[s.genre]} · ${MOOD_LABEL[s.mood]} · ${s.bpm} BPM</span>
        <span class="muted song-dur">${fmt(s.duration)}</span>
        <span class="status ${s.published ? 'live' : 'draft'}">${s.published ? 'Live' : 'Draft'}</span>
        <span class="song-actions">
          <button class="icon-btn sm" data-action="toggle-publish" data-id="${s.id}" title="${s.published ? 'Unpublish' : 'Publish'}" aria-label="${s.published ? 'Unpublish' : 'Publish'} ${esc(s.title)}">${s.published ? ICON.eyeOff : ICON.eye}</button>
          <button class="icon-btn sm" data-action="edit" data-id="${s.id}" title="Edit" aria-label="Edit ${esc(s.title)}">${ICON.edit}</button>
          <button class="icon-btn sm danger" data-action="delete" data-id="${s.id}" title="Delete" aria-label="Delete ${esc(s.title)}">${ICON.trash}</button>
        </span>
      </li>`,
        )
        .join('')
    : `<li class="empty">${songs.length ? 'No songs match.' : 'No songs yet — publish your first one on the left.'}</li>`;
}

/** Reload the catalog. The form is only re-rendered when asked, so a half-filled upload survives list actions. */
async function refresh(withForm = false): Promise<void> {
  songs = await fetchAllSongs();
  // Keep the song being edited in sync (e.g. it was published from the list meanwhile).
  if (form.editing) form.editing = songs.find((x) => x.id === form.editing?.id) ?? null;
  if (withForm) renderForm();
  renderList();
}

// ---------------------------------------------------------------- events

root.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const drop = target.closest<HTMLElement>('.drop');
  if (drop && !target.closest('audio, button, input')) {
    $<HTMLInputElement>(drop.dataset.kind === 'audio' ? '#audio-input' : '#cover-input')?.click();
    return;
  }

  const el = target.closest<HTMLElement>('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  const { auth } = firebase();
  const song = songs.find((s) => s.id === id);

  try {
    switch (action) {
      case 'signout':
        await signOut(auth);
        break;
      case 'google':
        await signInWithPopup(auth, new GoogleAuthProvider());
        break;
      case 'copy-uid':
        await navigator.clipboard.writeText(user?.uid ?? '');
        toast('UID copied');
        break;
      case 'recheck':
        await route();
        break;
      case 'filter':
        filter = (el.dataset.filter as Filter) ?? 'all';
        renderList();
        break;
      case 'cancel-edit':
        resetForm();
        renderForm();
        renderList();
        break;
      case 'remove-cover': {
        const snap = readForm();
        if (form.coverPreviewUrl) URL.revokeObjectURL(form.coverPreviewUrl);
        form.coverFile = null;
        form.coverPreviewUrl = null;
        form.removeCover = true;
        renderForm();
        restoreForm(snap);
        break;
      }
      case 'edit':
        if (!song) break;
        resetForm();
        form.editing = song;
        renderForm();
        renderList();
        $('#form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'toggle-publish':
        if (!song) break;
        el.setAttribute('disabled', '');
        await updateSong(song.id, { published: !song.published }, song.published);
        toast(song.published ? `“${song.title}” unpublished` : `“${song.title}” is live on MyMusic`);
        await refresh();
        break;
      case 'delete':
        if (!song || !confirm(`Delete “${song.title}”? The audio and cover files are removed too. This can't be undone.`)) break;
        el.setAttribute('disabled', '');
        await deleteSong(song);
        const wasEditing = form.editing?.id === song.id;
        if (wasEditing) resetForm();
        toast(`Deleted “${song.title}”`);
        await refresh(wasEditing);
        break;
    }
  } catch (err) {
    console.error(err);
    toast(errorMessage(err), 'error');
    el.removeAttribute('disabled');
  }
});

root.addEventListener('keydown', (e) => {
  const drop = (e.target as HTMLElement).closest<HTMLElement>('.drop');
  if (drop && (e.key === 'Enter' || e.key === ' ') && e.target === drop) {
    e.preventDefault();
    drop.click();
  }
});

root.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (input.id === 'audio-input' && file) void chooseAudio(file);
  if (input.id === 'cover-input' && file) chooseCover(file);
});

root.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.type === 'range') syncOutput(input);
  if (input.name === 'hue' || input.name === 'title') syncCoverPreview();
  if (input.id === 'search') {
    search = input.value;
    renderList();
  }
});

for (const type of ['dragenter', 'dragover'] as const) {
  root.addEventListener(type, (e) => {
    const drop = (e.target as HTMLElement).closest<HTMLElement>('.drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.add('over');
  });
}
root.addEventListener('dragleave', (e) => (e.target as HTMLElement).closest('.drop')?.classList.remove('over'));
root.addEventListener('drop', (e) => {
  const drop = (e.target as HTMLElement).closest<HTMLElement>('.drop');
  if (!drop) return;
  e.preventDefault();
  drop.classList.remove('over');
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  if (drop.dataset.kind === 'audio') void chooseAudio(file);
  else chooseCover(file);
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formEl = e.target as HTMLFormElement;
  const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;

  if (formEl.id === 'song-form') {
    await submit(submitter?.value === 'publish' ? 'publish' : 'draft');
    return;
  }
  if (formEl.id === 'auth-form') {
    const data = new FormData(formEl);
    const email = String(data.get('email'));
    const password = String(data.get('password'));
    const { auth } = firebase();
    try {
      if (submitter?.value === 'signup') await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }
});

window.addEventListener('beforeunload', (e) => {
  if (busy) e.preventDefault();
});

// ---------------------------------------------------------------- boot

async function isAdmin(u: User): Promise<boolean> {
  try {
    return (await getDoc(doc(firebase().db, 'admins', u.uid))).exists();
  } catch {
    return false;
  }
}

async function route(): Promise<void> {
  if (!user) return renderSignIn();
  if (!(await isAdmin(user))) return renderNotAdmin();
  renderDashboard();
  try {
    await refresh(); // the form is already drawn — redrawing it would wipe anything typed meanwhile
  } catch (e) {
    toast(errorMessage(e), 'error');
  }
}

if (!firebaseEnabled) {
  renderNoConfig();
} else {
  frame('<div class="boot"><span class="boot-dot"></span>Loading Studio…</div>');
  onAuthStateChanged(firebase().auth, (u) => {
    user = u;
    resetForm();
    void route();
  });
}
