/**
 * Installable-app support: service worker registration, the browser's install
 * prompt, and lock-screen / media-key controls via the Media Session API.
 */
import type { Player } from './player';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad have no install prompt; installing is Share → Add to Home Screen. */
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initPwa(onChange: () => void): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    // The app mounts after songs load, often after `load` has already fired — handle both cases.
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    onChange();
  });
}

export const canInstall = () => !isStandalone() && (deferred !== null || isIOS());

export async function install(): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> {
  if (deferred) {
    const prompt = deferred;
    deferred = null;
    await prompt.prompt();
    return (await prompt.userChoice).outcome;
  }
  return isIOS() ? 'ios' : 'unavailable';
}

/** Show the current song on the lock screen / in media notifications and wire hardware keys. */
export function bindMediaSession(player: Player): void {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const set = (action: MediaSessionAction, fn: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      /* action not supported in this browser */
    }
  };
  set('play', () => player.playing || player.toggle());
  set('pause', () => player.playing && player.toggle());
  set('nexttrack', () => player.next());
  set('previoustrack', () => player.prev());
  set('seekto', (d) => d.seekTime != null && player.seek(d.seekTime / (player.audio.duration || 1)));
  set('seekforward', (d) => player.seekBy(d.seekOffset ?? 10));
  set('seekbackward', (d) => player.seekBy(-(d.seekOffset ?? 10)));

  let lastId = '';
  player.on(() => {
    const t = player.current;
    ms.playbackState = player.playing ? 'playing' : 'paused';
    if (!t || t.id === lastId) return;
    lastId = t.id;
    ms.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album,
      artwork: t.coverUrl
        ? [{ src: t.coverUrl, sizes: '320x320', type: 'image/jpeg' }]
        : [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
    });
  });
  player.audio.addEventListener('loadedmetadata', () => {
    const d = player.audio.duration;
    if (Number.isFinite(d) && 'setPositionState' in ms) {
      try {
        ms.setPositionState({ duration: d, position: Math.min(player.audio.currentTime, d), playbackRate: 1 });
      } catch {
        /* ignore */
      }
    }
  });
}
