import './style.css';
import { CATALOG } from './catalog';
import { firebaseEnabled } from './firebase';
import { Player } from './player';
import { bindMediaSession } from './pwa';
import { Recommender } from './recommender';
import { Store } from './store';
import type { Track } from './types';
import { App } from './ui';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app not found');

const store = new Store();
document.documentElement.dataset.theme = store.theme;

/** Songs published from /admin come first; the demo set is optional. */
async function loadTracks(): Promise<Track[]> {
  let published: Track[] = [];
  if (firebaseEnabled) {
    try {
      const { fetchPublishedSongs, songToTrack } = await import('./songs');
      published = (await fetchPublishedSongs()).map(songToTrack);
    } catch (e) {
      console.warn('Could not load published songs from Firestore:', e);
    }
  }
  const includeDemo = import.meta.env.VITE_INCLUDE_DEMO_SONGS !== 'false' || published.length === 0;
  return [...published, ...(includeDemo ? CATALOG : [])];
}

root.innerHTML = '<div class="boot"><span class="boot-dot"></span>Loading your music…</div>';

loadTracks().then((tracks) => {
  for (const t of tracks) if (t.duration) store.setDuration(t.id, t.duration);

  const byId = new Map(tracks.map((t) => [t.id, t]));
  const rec = new Recommender(tracks, store);

  let app: App | null = null;
  const player = new Player(
    byId,
    store,
    (current, queued) => rec.nextAutoplay(current, queued),
    (msg) => app?.toast(msg),
    // Songs uploaded from Studio live in Firestore; load that code only when needed.
    (src) => import('./filestore').then((m) => m.resolveAudio(src)),
  );

  app = new App(root, tracks, byId, store, rec, player);
  app.mount();
  bindMediaSession(player);
});
