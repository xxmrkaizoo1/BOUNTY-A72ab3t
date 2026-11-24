import { GENRE_LABEL, MOODS, MOOD_LABEL } from './catalog';
import type { Player } from './player';
import type { Recommender } from './recommender';
import { THEMES, type Store, type Theme } from './store';
import { canInstall, initPwa, install, isIOS } from './pwa';
import { Visualizer } from './visualizer';
import type { ChangeKind, Mood, Recommendation, Track } from './types';

type View = 'home' | 'library' | 'liked' | 'queue';

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l9-5.8a.8.8 0 0 0 0-1.4l-9-5.8A.8.8 0 0 0 5 6.2Z"/><rect x="17" y="5" width="2.5" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M19 6.2v11.6a.8.8 0 0 1-1.2.7l-9-5.8a.8.8 0 0 1 0-1.4l9-5.8a.8.8 0 0 1 1.2.7Z"/><rect x="4.5" y="5" width="2.5" height="14" rx="1"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9.3-9.3C1.6 7.7 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.4 3.2 4.3 6.2C19.5 15.4 12 20 12 20Z"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4v16M10 4v16M15 4.5l4 15"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h10"/><path d="M18 14v6l3-3z" fill="currentColor"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2 6.2 6.5 1.3-6.5 1.8L12 18l-2-6.2L3.5 10l6.5-1.3z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke-linecap="round"/></svg>',
};

const THEME_LABEL: Record<Theme, string> = { glass: 'Glass', vinyl: 'Vinyl', midnight: 'Midnight' };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const fmt = (sec: number) =>
  Number.isFinite(sec) && sec >= 0 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '–:––';

const initials = (t: Track) =>
  t.title
    .split(/\s+/)
    .filter((w) => /\w/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const cover = (t: Track, size = '') =>
  t.coverUrl
    ? `<div class="cover has-art ${size}" style="--h:${t.hue};background-image:url(&quot;${esc(t.coverUrl)}&quot;)"><i class="eq" aria-hidden="true"><b></b><b></b><b></b></i></div>`
    : `<div class="cover ${size}" style="--h:${t.hue}"><span>${esc(initials(t))}</span><i class="eq" aria-hidden="true"><b></b><b></b><b></b></i></div>`;

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export class App {
  private view: View = 'home';
  private mood: Mood | 'all' = 'all';
  private query = '';
  private lists = new Map<string, string[]>();
  private seeking = false;
  private toastTimer = 0;
  private flowIndex = 2;
  private flowRecs: Recommendation[] = [];
  private immersive = false;
  private viz!: Visualizer;
  private appEl!: HTMLElement;

  private main!: HTMLElement;
  private taste!: HTMLElement;
  private seek!: HTMLInputElement;
  private volume!: HTMLInputElement;

  constructor(
    private root: HTMLElement,
    private tracks: Track[],
    private byId: Map<string, Track>,
    private store: Store,
    private rec: Recommender,
    private player: Player,
  ) {}

  mount(): void {
    this.root.innerHTML = this.shell();
    this.main = this.$('#main');
    this.taste = this.$('#taste');
    this.seek = this.$<HTMLInputElement>('#seek');
    this.volume = this.$<HTMLInputElement>('#volume');
    this.appEl = this.$('.app');
    this.viz = new Visualizer(this.player, (beat) => this.appEl.style.setProperty('--beat', beat.toFixed(3)));
    this.viz.attach(this.$<HTMLCanvasElement>('#bar-viz'), 'bars');
    this.volume.value = String(this.store.volume);
    this.paintRange(this.volume, this.store.volume);

    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.seek.addEventListener('change', () => {
      this.player.seek(Number(this.seek.value) / 1000);
      this.seeking = false;
    });
    document.addEventListener('keydown', (e) => this.onKey(e));

    this.player.on((kind) => this.onChange(kind));
    this.player.onTime(() => this.renderTime());

    this.bindTilt();
    this.bindFlowGestures();

    const startView = new URLSearchParams(location.search).get('view');
    if (startView === 'library' || startView === 'liked' || startView === 'queue') this.view = startView;
    initPwa(() => this.syncInstall());
    this.syncInstall();

    this.renderMain(true);
    this.renderTaste();
    this.renderBar();
  }

  /** 3D tilt + glare that follows the pointer over cards (Glass design). */
  private bindTilt(): void {
    let active: HTMLElement | null = null;
    let frame = 0;
    const reset = (el: HTMLElement | null) => {
      el?.style.removeProperty('--rx');
      el?.style.removeProperty('--ry');
      el?.classList.remove('tilting');
    };
    let spot = 0;
    this.root.addEventListener('pointermove', (e) => {
      if (!canHover() || reducedMotion()) return;
      if (this.immersive) {
        cancelAnimationFrame(spot);
        spot = requestAnimationFrame(() => {
          const imm = this.$('#imm');
          imm.style.setProperty('--ry', `${((e.clientX / window.innerWidth - 0.5) * 24).toFixed(2)}deg`);
          imm.style.setProperty('--rx', `${((0.5 - e.clientY / window.innerHeight) * 20).toFixed(2)}deg`);
        });
        return;
      }
      if (document.documentElement.dataset.theme !== 'glass') return;
      cancelAnimationFrame(spot);
      spot = requestAnimationFrame(() => {
        this.appEl.style.setProperty('--cx', `${e.clientX}px`);
        this.appEl.style.setProperty('--cy', `${e.clientY}px`);
      });
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
      if (card !== active) {
        reset(active);
        active = card;
      }
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.classList.add('tilting');
        card.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
    });
    this.root.addEventListener('pointerleave', () => {
      reset(active);
      active = null;
    });
  }

  /** Show the Install button only when this browser can actually install the app. */
  private syncInstall(): void {
    const btn = this.root.querySelector<HTMLElement>('#install-btn');
    if (!btn) return;
    btn.hidden = !canInstall();
    btn.title = isIOS() ? 'Add MyMusic to your Home Screen' : 'Install MyMusic as an app';
  }

  toast(msg: string, ms = 2400): void {
    const el = this.$('#toast');
    el.textContent = msg;
    el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    const el = this.root.querySelector<T>(sel);
    if (!el) throw new Error(`Missing element ${sel}`);
    return el;
  }

  // ---------- events ----------

  private onChange(kind: ChangeKind): void {
    if (this.player.playing) this.viz.start();
    if (kind === 'track') {
      this.renderMain();
      this.renderTaste();
      this.renderBar();
    } else if (kind === 'stats') {
      // Don't reshuffle what the listener is browsing mid-song; just update the taste panel.
      this.renderTaste();
      this.renderNowPlaying();
    } else if (kind === 'queue') {
      if (this.view === 'queue') this.renderMain();
      this.renderNowPlaying();
    } else {
      this.renderBar();
    }
  }

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el) return;
    const { action, id, list, view, mood, index, dir } = el.dataset;
    const p = this.player;

    switch (action) {
      case 'view':
        this.view = view as View;
        this.renderMain(true);
        this.main.scrollTo({ top: 0 });
        break;
      case 'play':
        if (!id) break;
        if (list && this.lists.has(list)) p.playList(this.lists.get(list) ?? [], id);
        else p.playNow(id);
        break;
      case 'play-all': {
        const ids = list ? this.lists.get(list) : undefined;
        if (ids?.length) p.playList(ids, ids[0]);
        break;
      }
      case 'enqueue':
        if (id) this.toast(p.enqueue(id) ? `Added "${this.byId.get(id)?.title}" to queue` : 'Already up next');
        break;
      case 'like':
        if (id) this.toggleLike(id);
        break;
      case 'dislike':
        if (id) this.toggleDislike(id);
        break;
      case 'like-current':
        if (p.current) this.toggleLike(p.current.id);
        break;
      case 'mood':
        this.mood = mood as Mood | 'all';
        this.renderMain();
        break;
      case 'remove':
        p.removeAt(Number(index));
        break;
      case 'toggle':
        p.toggle();
        break;
      case 'next':
        p.next();
        break;
      case 'prev':
        p.prev();
        break;
      case 'shuffle':
        p.toggleShuffle();
        break;
      case 'repeat':
        p.cycleRepeat();
        break;
      case 'theme': {
        const nextTheme = THEMES[(THEMES.indexOf(this.store.theme) + 1) % THEMES.length];
        this.store.theme = nextTheme;
        document.documentElement.dataset.theme = nextTheme;
        this.$('#theme-label').textContent = THEME_LABEL[nextTheme];
        this.toast(`${THEME_LABEL[nextTheme]} theme`);
        this.renderMain(true);
        this.renderNowPlaying();
        break;
      }
      case 'flow': {
        const i = Number(index);
        const r = this.flowRecs[i];
        if (!r) break;
        if (i === this.flowIndex) p.playList(this.flowRecs.map((x) => x.track.id), r.track.id);
        else this.setFlow(i);
        break;
      }
      case 'flow-step':
        this.setFlow(this.flowIndex + Number(dir));
        break;
      case 'immersive':
        this.immersive = !this.immersive;
        this.syncImmersive();
        break;
      case 'imm-seek': {
        const r = el.getBoundingClientRect();
        p.seek(((e as MouseEvent).clientX - r.left) / r.width);
        break;
      }
      case 'install':
        void install().then((r) => {
          if (r === 'ios') this.toast('To install: tap the Share button, then “Add to Home Screen”.', 6000);
          else if (r === 'accepted') this.toast('MyMusic installed — find it with your apps');
          this.syncInstall();
        });
        break;
      case 'reset':
        if (confirm('Clear your likes, plays and skips? Recommendations will start over.')) {
          this.store.reset();
          this.renderMain();
          this.renderTaste();
          this.renderBar();
          this.toast('Taste profile reset');
        }
        break;
    }
  }

  private onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    if (el.id === 'seek') {
      this.seeking = true;
      this.paintRange(el, Number(el.value) / 1000);
      this.$('#t-cur').textContent = fmt((Number(el.value) / 1000) * this.player.audio.duration);
    } else if (el.id === 'volume') {
      this.player.setVolume(Number(el.value));
      this.paintRange(el, Number(el.value));
    } else if (el.id === 'search') {
      this.query = el.value;
      this.$('#lib-list').innerHTML = this.libraryRows();
      this.markCurrent();
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.immersive) {
      this.immersive = false;
      this.syncImmersive();
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.player.toggle();
    } else if (e.key === 'ArrowRight' && e.shiftKey) this.player.next();
    else if (e.key === 'ArrowLeft' && e.shiftKey) this.player.prev();
    else if (e.key === 'ArrowRight') this.player.seekBy(5);
    else if (e.key === 'ArrowLeft') this.player.seekBy(-5);
    else if (e.key.toLowerCase() === 'l' && this.player.current) this.toggleLike(this.player.current.id);
  }

  private toggleLike(id: string): void {
    const s = this.store.update(id, (s) => {
      s.liked = !s.liked;
      if (s.liked) s.disliked = false;
    });
    this.toast(s.liked ? 'Added to Liked — tuning your recommendations' : 'Removed from Liked');
    this.renderMain();
    this.renderTaste();
    this.renderBar();
  }

  private toggleDislike(id: string): void {
    const s = this.store.update(id, (s) => {
      s.disliked = !s.disliked;
      if (s.disliked) s.liked = false;
    });
    this.toast(s.disliked ? "Got it — we'll play less like this" : 'Restored to recommendations');
    if (s.disliked && this.player.current?.id === id) this.player.next(false);
    this.renderMain();
    this.renderTaste();
    this.renderBar();
  }

  // ---------- shell & player bar ----------

  private shell(): string {
    const nav = (v: View, icon: string, label: string) =>
      `<button class="nav-btn" data-action="view" data-view="${v}">${icon}<span>${label}</span></button>`;
    return `
      <div class="app">
        <div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
        <aside class="sidebar">
          <div class="brand"><span class="logo">${ICON.sparkle}</span>MyMusic</div>
          <nav class="nav">
            ${nav('home', ICON.home, 'For you')}
            ${nav('library', ICON.library, 'Library')}
            ${nav('liked', ICON.heart, 'Liked')}
            ${nav('queue', ICON.queue, 'Queue')}
            <button class="nav-btn theme-btn" data-action="theme" aria-label="Switch theme">${ICON.theme}<span id="theme-label">${THEME_LABEL[this.store.theme]}</span></button>
          </nav>
          <section class="taste" id="taste"></section>
          <a class="studio-link" href="/admin.html">${ICON.sparkle}MyMusic Studio</a>
        </aside>
        <main class="main" id="main"></main>
        <button class="install-btn" id="install-btn" data-action="install" hidden>${ICON.download}<span>Install app</span></button>
        <aside class="np" id="np" aria-label="Now playing"></aside>
        <footer class="bar">
          <div class="bar-track">
            <div id="bar-cover" class="cover sm empty"></div>
            <div class="bar-meta">
              <strong id="bar-title">Nothing playing</strong>
              <span id="bar-artist">Press play for a recommendation</span>
            </div>
            <button class="icon-btn like-btn" id="bar-like" data-action="like-current" aria-label="Like">${ICON.heart}</button>
            <button class="icon-btn expand-btn" data-action="immersive" aria-label="Full-screen player" title="Full-screen player">${ICON.expand}</button>
          </div>
          <div class="bar-center">
            <div class="controls">
              <button class="icon-btn" id="btn-shuffle" data-action="shuffle" aria-label="Shuffle">${ICON.shuffle}</button>
              <button class="icon-btn" data-action="prev" aria-label="Previous">${ICON.prev}</button>
              <button class="play-btn" id="btn-play" data-action="toggle" aria-label="Play">${ICON.play}</button>
              <button class="icon-btn" data-action="next" aria-label="Next">${ICON.next}</button>
              <button class="icon-btn" id="btn-repeat" data-action="repeat" aria-label="Repeat">${ICON.repeat}<sup id="repeat-one">1</sup></button>
            </div>
            <div class="progress">
              <span id="t-cur">0:00</span>
              <input type="range" id="seek" class="range" min="0" max="1000" value="0" aria-label="Seek" />
              <span id="t-dur">–:––</span>
            </div>
          </div>
          <div class="bar-right">
            <span class="autoplay-tag" id="autoplay-tag" title="Autoplay: recommended for you">${ICON.sparkle}Autoplay</span>
            <canvas class="viz-bars" id="bar-viz" aria-hidden="true"></canvas>
            <button class="icon-btn" data-action="view" data-view="queue" aria-label="Queue">${ICON.queue}</button>
            <span class="vol-icon">${ICON.volume}</span>
            <input type="range" id="volume" class="range vol" min="0" max="1" step="0.01" aria-label="Volume" />
          </div>
        </footer>
        <section class="imm" id="imm" hidden aria-label="Full-screen player"></section>
        <div class="toast" id="toast" role="status"></div>
      </div>`;
  }

  private renderBar(): void {
    const p = this.player;
    const t = p.current;
    const barCover = this.$('#bar-cover');
    if (t) {
      document.documentElement.style.setProperty('--np-h', String(t.hue));
      barCover.outerHTML = cover(t, 'sm').replace('<div class="cover', '<div id="bar-cover" class="cover');
      this.$('#bar-title').textContent = t.title;
      this.$('#bar-artist').textContent = `${t.artist} · ${GENRE_LABEL[t.genre]}`;
    }
    const liked = t ? this.store.stats(t.id).liked : false;
    this.$('#bar-like').classList.toggle('on', liked);
    this.$('#bar-like').setAttribute('aria-pressed', String(liked));

    const play = this.$('#btn-play');
    play.innerHTML = p.playing ? ICON.pause : ICON.play;
    play.setAttribute('aria-label', p.loading ? 'Loading' : p.playing ? 'Pause' : 'Play');
    play.classList.toggle('loading', p.loading);
    this.$('#btn-shuffle').classList.toggle('on', p.shuffle);
    this.$('#btn-repeat').classList.toggle('on', p.repeat !== 'off');
    this.$('#repeat-one').hidden = p.repeat !== 'one';
    this.$('#autoplay-tag').classList.toggle('show', !!t && p.autoplayed.has(t.id));

    this.root.querySelector('.app')?.classList.toggle('is-playing', p.playing);
    this.root.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
    this.renderNowPlaying();
    this.syncImmersive();
    this.markCurrent();
    this.renderTime();
  }

  /** Side panel used by the Vinyl design: spinning record + what plays next. */
  private renderNowPlaying(): void {
    const p = this.player;
    const t = p.current;
    const np = this.root.querySelector<HTMLElement>('#np');
    if (!np) return;

    const upcoming = p.queue
      .slice(p.index + 1, p.index + 4)
      .map((id) => this.byId.get(id))
      .filter((x): x is Track => !!x)
      .map((x) => ({ track: x, auto: false }));
    if (!upcoming.length) {
      const auto = this.rec.nextAutoplay(t, new Set(p.queue));
      if (auto) upcoming.push({ track: auto, auto: true });
    }
    const s = t ? this.store.stats(t.id) : null;

    np.innerHTML = `
      <p class="eyebrow">Now playing</p>
      <div class="np-art" ${t ? `data-track="${t.id}"` : ''}>
        <canvas class="viz-ring" aria-hidden="true"></canvas>
        ${t ? cover(t) : '<div class="cover empty"><span>♪</span></div>'}
      </div>
      <div class="record" ${t ? `data-track="${t.id}"` : ''}>
        <div class="disc">${t ? `<div class="disc-label" style="--h:${t.hue}"><span>${esc(initials(t))}</span></div>` : '<div class="disc-label empty"></div>'}</div>
        <div class="tonearm" aria-hidden="true"></div>
      </div>
      ${
        t
          ? `<h2 class="np-title">${esc(t.title)}</h2>
             <p class="np-artist">${esc(t.artist)} — <em>${esc(t.album)}</em></p>
             <div class="np-tags">
               <span class="tag">${GENRE_LABEL[t.genre]}</span>
               <span class="tag ghost">${MOOD_LABEL[t.mood]}</span>
               <span class="tag ghost">${t.bpm} BPM</span>
             </div>
             <p class="np-stats muted">${s?.plays ? `Played ${s.plays}×` : 'First listen'}${s?.liked ? ' · in your Liked songs' : ''}</p>`
          : this.store.theme === 'vinyl'
            ? `<h2 class="np-title">Nothing on the turntable</h2>
               <p class="np-artist muted">Press play and MyMusic picks a record for you.</p>`
            : `<h2 class="np-title">Nothing playing yet</h2>
               <p class="np-artist muted">Press play and MyMusic picks something for you.</p>`
      }
      ${
        upcoming.length
          ? `<h4 class="np-next-head">${upcoming[0].auto ? `${ICON.sparkle} Autoplay next` : 'Up next'}</h4>
             <ol class="np-next">${upcoming
               .map(
                 ({ track: u }) => `
                 <li data-track="${u.id}">
                   <button data-action="play" data-id="${u.id}">
                     ${cover(u, 'xs')}
                     <span class="row-title"><strong>${esc(u.title)}</strong><span class="muted">${esc(u.artist)}</span></span>
                   </button>
                 </li>`,
               )
               .join('')}</ol>`
          : ''
      }`;
    const ring = np.querySelector<HTMLCanvasElement>('.viz-ring');
    if (ring && this.store.theme === 'glass') this.viz.attach(ring, 'ring');
  }

  /** Full-screen "immersive" player: giant 3D cover wrapped in a visualizer ring. */
  private syncImmersive(): void {
    const imm = this.$('#imm');
    imm.hidden = !this.immersive;
    this.appEl.classList.toggle('imm-open', this.immersive);
    if (!this.immersive) return;

    const p = this.player;
    const t = p.current;
    const liked = t ? this.store.stats(t.id).liked : false;
    if (imm.dataset.track !== (t?.id ?? '') || !imm.firstElementChild) {
      imm.dataset.track = t?.id ?? '';
      imm.style.setProperty('--h', String(t?.hue ?? 262));
      const nextId = p.queue[p.index + 1];
      const next = (nextId ? this.byId.get(nextId) : null) ?? this.rec.nextAutoplay(t, new Set(p.queue));
      imm.innerHTML = `
        <div class="imm-bg" aria-hidden="true"><i></i><i></i><i></i></div>
        <button class="icon-btn imm-close" data-action="immersive" aria-label="Close full-screen player">${ICON.close}</button>
        <div class="imm-stage">
          <div class="imm-art" ${t ? `data-track="${t.id}"` : ''}>
            <canvas class="viz-ring" aria-hidden="true"></canvas>
            <div class="imm-cover">${t ? cover(t) : '<div class="cover empty"><span>♪</span></div>'}</div>
          </div>
          <div class="imm-meta">
            <p class="eyebrow">${t && p.autoplayed.has(t.id) ? `${ICON.sparkle} Autoplay · picked for you` : 'Now playing'}</p>
            <h2 class="imm-title">${t ? esc(t.title) : 'Nothing playing yet'}</h2>
            <p class="imm-artist">${t ? `${esc(t.artist)} — <em>${esc(t.album)}</em>` : 'Press play and MyMusic picks something for you.'}</p>
            ${
              t
                ? `<div class="np-tags"><span class="tag">${GENRE_LABEL[t.genre]}</span><span class="tag ghost">${MOOD_LABEL[t.mood]}</span><span class="tag ghost">${t.bpm} BPM</span></div>`
                : ''
            }
            <div class="imm-progress">
              <span id="imm-cur">0:00</span>
              <button class="imm-line" data-action="imm-seek" aria-label="Seek"><i id="imm-fill"></i></button>
              <span id="imm-dur">–:––</span>
            </div>
            <div class="imm-controls">
              <button class="icon-btn like-btn" id="imm-like" data-action="like-current" aria-label="Like">${ICON.heart}</button>
              <button class="icon-btn" data-action="prev" aria-label="Previous">${ICON.prev}</button>
              <button class="play-btn imm-play" id="imm-play" data-action="toggle" aria-label="Play">${ICON.play}</button>
              <button class="icon-btn" data-action="next" aria-label="Next">${ICON.next}</button>
              <button class="icon-btn" data-action="dislike" data-id="${t?.id ?? ''}" aria-label="Not for me">${ICON.ban}</button>
            </div>
            ${
              next
                ? `<button class="imm-next" data-action="play" data-id="${next.id}">
                     ${cover(next, 'xs')}
                     <span><small>Up next</small><strong>${esc(next.title)}</strong><span class="muted">${esc(next.artist)}</span></span>
                   </button>`
                : ''
            }
          </div>
        </div>`;
      const ring = imm.querySelector<HTMLCanvasElement>('.viz-ring');
      if (ring) this.viz.attach(ring, 'ring');
    }
    const play = this.$('#imm-play');
    play.innerHTML = p.playing ? ICON.pause : ICON.play;
    play.setAttribute('aria-label', p.loading ? 'Loading' : p.playing ? 'Pause' : 'Play');
    play.classList.toggle('loading', p.loading);
    this.$('#imm-like').classList.toggle('on', liked);
    this.renderTime();
  }

  private renderTime(): void {
    const a = this.player.audio;
    const t = this.player.current;
    const dur = Number.isFinite(a.duration) ? a.duration : t ? this.store.duration(t.id) : NaN;
    this.$('#t-dur').textContent = fmt(dur);
    if (this.seeking) return;
    this.$('#t-cur').textContent = fmt(t ? a.currentTime : 0);
    const frac = Number.isFinite(dur) && dur > 0 ? a.currentTime / dur : 0;
    this.seek.value = String(Math.round(frac * 1000));
    this.paintRange(this.seek, frac);
    if (this.immersive) {
      const cur = this.root.querySelector('#imm-cur');
      if (cur) cur.textContent = fmt(t ? a.currentTime : 0);
      const d = this.root.querySelector('#imm-dur');
      if (d) d.textContent = fmt(dur);
      this.root.querySelector<HTMLElement>('#imm-fill')?.style.setProperty('width', `${(frac * 100).toFixed(2)}%`);
    }
  }

  private paintRange(el: HTMLInputElement, frac: number): void {
    el.style.setProperty('--p', `${(frac * 100).toFixed(2)}%`);
  }

  private markCurrent(): void {
    const id = this.player.current?.id;
    this.root.querySelectorAll<HTMLElement>('[data-track]').forEach((el) => el.classList.toggle('current', el.dataset.track === id));
  }

  private renderTaste(): void {
    const bars = this.rec.tasteSummary();
    const liked = this.tracks.filter((t) => this.store.stats(t.id).liked).length;
    const plays = this.tracks.reduce((n, t) => n + this.store.stats(t.id).plays, 0);
    this.taste.innerHTML = `
      <h4>Your taste</h4>
      ${
        bars.length
          ? `<ul class="taste-bars">${bars
              .map((b) => `<li><span>${esc(b.label)}</span><div class="meter"><i style="width:${Math.round(b.value * 100)}%"></i></div></li>`)
              .join('')}</ul>`
          : '<p class="muted">Play, like and skip songs — MyMusic learns what you enjoy.</p>'
      }
      <p class="taste-stats">${plays} plays · ${liked} liked</p>
      <button class="link-btn" data-action="reset">Reset taste</button>`;
  }

  // ---------- main views ----------

  private renderMain(enter = false): void {
    if (enter && !reducedMotion()) {
      // Replay the staggered entrance only on navigation, not on every like/track change.
      this.main.classList.remove('enter');
      void this.main.offsetWidth;
      this.main.classList.add('enter');
      window.setTimeout(() => this.main.classList.remove('enter'), 1400);
    }
    this.lists.clear();
    const views: Record<View, () => string> = {
      home: () => this.homeView(),
      library: () => this.libraryView(),
      liked: () => this.likedView(),
      queue: () => this.queueView(),
    };
    this.main.innerHTML = views[this.view]();
    this.updateFlow();
    this.root.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
    this.markCurrent();
  }

  private register(key: string, ids: string[]): string {
    this.lists.set(key, ids);
    return key;
  }

  private card(r: Recommendation, list: string, i = 0): string {
    const t = r.track;
    const s = this.store.stats(t.id);
    return `
      <article class="card" data-track="${t.id}" style="--h:${t.hue};--i:${i}">
        <div class="card-art">
          ${cover(t)}
          <button class="card-play" data-action="play" data-id="${t.id}" data-list="${list}" aria-label="Play ${esc(t.title)}">${ICON.play}</button>
        </div>
        <h3 title="${esc(t.title)}">${esc(t.title)}</h3>
        <p class="muted">${esc(t.artist)}</p>
        <p class="reason">${ICON.sparkle}<span>${esc(r.reason)}</span></p>
        <div class="card-actions">
          <button class="icon-btn sm like-btn ${s.liked ? 'on' : ''}" data-action="like" data-id="${t.id}" aria-label="Like" title="Like">${ICON.heart}</button>
          <button class="icon-btn sm" data-action="dislike" data-id="${t.id}" aria-label="Not for me" title="Not for me">${ICON.ban}</button>
          <button class="icon-btn sm" data-action="enqueue" data-id="${t.id}" aria-label="Add to queue" title="Add to queue">${ICON.plus}</button>
        </div>
      </article>`;
  }

  private shelf(title: string, sub: string, recs: Recommendation[], key: string): string {
    if (!recs.length) return '';
    const list = this.register(key, recs.map((r) => r.track.id));
    return `
      <section class="section">
        <header class="section-head">
          <div><h2>${title}</h2><p class="muted">${sub}</p></div>
          <button class="pill" data-action="play-all" data-list="${list}">${ICON.play}Play all</button>
        </header>
        <div class="shelf">${recs.map((r, i) => this.card(r, list, i)).join('')}</div>
      </section>`;
  }

  private row(t: Track, i: number, list: string, extra = ''): string {
    const s = this.store.stats(t.id);
    return `
      <li class="row ${s.disliked ? 'dim' : ''}" data-track="${t.id}" style="--i:${Math.min(i, 12)}">
        <button class="row-main" data-action="play" data-id="${t.id}" data-list="${list}">
          <span class="row-num">${i + 1}</span>
          ${cover(t, 'xs')}
          <span class="row-title"><strong>${esc(t.title)}</strong><span class="muted">${esc(t.artist)}</span></span>
        </button>
        <span class="tag">${GENRE_LABEL[t.genre]}</span>
        <span class="tag ghost">${MOOD_LABEL[t.mood]}</span>
        <span class="row-plays muted">${s.plays ? `${s.plays} play${s.plays > 1 ? 's' : ''}` : ''}</span>
        <span class="row-actions">
          <button class="icon-btn sm like-btn ${s.liked ? 'on' : ''}" data-action="like" data-id="${t.id}" aria-label="Like">${ICON.heart}</button>
          <button class="icon-btn sm ${s.disliked ? 'on warn' : ''}" data-action="dislike" data-id="${t.id}" aria-label="Not for me">${ICON.ban}</button>
          <button class="icon-btn sm" data-action="enqueue" data-id="${t.id}" aria-label="Add to queue">${ICON.plus}</button>
          ${extra}
        </span>
        <span class="row-dur muted">${fmt(this.store.duration(t.id))}</span>
      </li>`;
  }

  // ---------- 3D coverflow (Glass home) ----------

  private flowHtml(recs: Recommendation[]): string {
    if (!recs.length) return '';
    this.flowRecs = recs;
    this.register('flow', recs.map((r) => r.track.id));
    this.flowIndex = Math.min(Math.max(this.flowIndex, 0), recs.length - 1);
    return `
      <section class="flow" id="flow" aria-roledescription="carousel" aria-label="Top picks">
        <div class="flow-stage" id="flow-stage">
          ${recs
            .map(
              (r, i) => `
            <button class="flow-item" data-action="flow" data-index="${i}" data-track="${r.track.id}" style="--h:${r.track.hue}" aria-label="${esc(r.track.title)} by ${esc(r.track.artist)}">
              ${cover(r.track)}
            </button>`,
            )
            .join('')}
        </div>
        <button class="flow-arrow prev" data-action="flow-step" data-dir="-1" aria-label="Previous pick">${ICON.chevL}</button>
        <button class="flow-arrow next" data-action="flow-step" data-dir="1" aria-label="Next pick">${ICON.chevR}</button>
        <div class="flow-info" id="flow-info" aria-live="polite"></div>
      </section>`;
  }

  private setFlow(i: number): void {
    if (!this.flowRecs.length) return;
    this.flowIndex = Math.min(Math.max(i, 0), this.flowRecs.length - 1);
    this.updateFlow();
  }

  /** Position every cover in 3D relative to the focused one (CSS does the math from --d/--ad/--s). */
  private updateFlow(): void {
    const flow = this.root.querySelector<HTMLElement>('#flow');
    if (!flow) return;
    const idx = this.flowIndex;
    flow.querySelectorAll<HTMLElement>('.flow-item').forEach((el, i) => {
      const d = i - idx;
      el.style.setProperty('--d', String(d));
      el.style.setProperty('--ad', String(Math.abs(d)));
      el.style.setProperty('--s', String(Math.sign(d)));
      el.classList.toggle('active', d === 0);
      el.tabIndex = Math.abs(d) > 3 ? -1 : 0;
    });
    const r = this.flowRecs[idx];
    if (!r) return;
    const t = r.track;
    const s = this.store.stats(t.id);
    flow.style.setProperty('--h', String(t.hue));
    this.$('#flow-info').innerHTML = `
      <p class="eyebrow">Top pick ${idx + 1} of ${this.flowRecs.length}</p>
      <h2 class="flow-title">${esc(t.title)}</h2>
      <p class="muted">${esc(t.artist)} · ${GENRE_LABEL[t.genre]} · ${MOOD_LABEL[t.mood]}</p>
      <p class="reason">${ICON.sparkle}<span>${esc(r.reason)}</span></p>
      <div class="flow-actions">
        <button class="pill" data-action="play" data-id="${t.id}" data-list="flow">${ICON.play}Play</button>
        <button class="icon-btn like-btn ${s.liked ? 'on' : ''}" data-action="like" data-id="${t.id}" aria-label="Like">${ICON.heart}</button>
        <button class="icon-btn" data-action="enqueue" data-id="${t.id}" aria-label="Add to queue">${ICON.plus}</button>
        <button class="icon-btn" data-action="dislike" data-id="${t.id}" aria-label="Not for me">${ICON.ban}</button>
      </div>`;
  }

  /** Swipe / trackpad-scroll through the coverflow. */
  private bindFlowGestures(): void {
    let startX: number | null = null;
    let lastWheel = 0;
    this.root.addEventListener('pointerdown', (e) => {
      startX = (e.target as HTMLElement).closest('#flow-stage') ? e.clientX : null;
    });
    this.root.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) {
        this.setFlow(this.flowIndex + (dx < 0 ? 1 : -1));
        // swallow the click that follows a swipe
        const swallow = (ev: Event) => ev.stopPropagation();
        this.root.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => this.root.removeEventListener('click', swallow, { capture: true }), 0);
      }
    });
    this.root.addEventListener(
      'wheel',
      (e) => {
        if (!(e.target as HTMLElement).closest('#flow-stage') || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        e.preventDefault();
        const now = performance.now();
        if (now - lastWheel < 260 || Math.abs(e.deltaX) < 8) return;
        lastWheel = now;
        this.setFlow(this.flowIndex + Math.sign(e.deltaX));
      },
      { passive: false },
    );
  }

  private homeView(): string {
    const current = this.player.current;
    const glass = this.store.theme === 'glass';
    const forYou = this.rec.forYou(current, glass ? 9 : 8);
    const recentIds = [...new Set([...this.store.history].reverse())].slice(0, 8);
    const recent = recentIds
      .map((id) => this.byId.get(id))
      .filter((t): t is Track => !!t && !this.store.stats(t.id).disliked)
      .map((t) => ({ track: t, score: 0, reason: this.store.stats(t.id).liked ? 'In your Liked songs' : 'Played recently' }));

    const moods = this.rec.byMood(this.mood);
    const moodList = this.register('mood', moods.map((t) => t.id));
    const chip = (m: Mood | 'all', label: string) =>
      `<button class="chip ${this.mood === m ? 'on' : ''}" data-action="mood" data-mood="${m}">${label}</button>`;

    return `
      <header class="hero">
        <p class="eyebrow">${greeting()}</p>
        <h1>Made for you</h1>
        <p class="muted">Ranked live from what you play, like and skip.</p>
      </header>
      ${glass ? this.flowHtml(forYou) : this.shelf('Top picks', 'Your best matches right now', forYou, 'foryou')}
      ${current ? this.shelf(`Because you're listening to ${esc(current.title)}`, `Tracks that sound like ${esc(current.artist)}`, this.rec.similar(current), 'similar') : ''}
      ${this.shelf('Discover something new', "Haven't heard these yet — picked for your taste", this.rec.discover(), 'discover')}
      ${this.shelf('Jump back in', 'Recently played', recent, 'recent')}
      <section class="section">
        <header class="section-head">
          <div><h2>Mood mixes</h2><p class="muted">Sorted by how well each track fits your taste</p></div>
          <button class="pill" data-action="play-all" data-list="${moodList}">${ICON.play}Play mix</button>
        </header>
        <div class="chips">${chip('all', 'All')}${MOODS.map((m) => chip(m, MOOD_LABEL[m])).join('')}</div>
        <ol class="rows">${moods.map((t, i) => this.row(t, i, moodList)).join('')}</ol>
      </section>`;
  }

  private libraryRows(): string {
    const q = this.query.trim().toLowerCase();
    const hits = this.tracks.filter((t) =>
      !q ? true : [t.title, t.artist, t.album, GENRE_LABEL[t.genre], MOOD_LABEL[t.mood]].some((f) => f.toLowerCase().includes(q)),
    );
    const list = this.register('library', hits.map((t) => t.id));
    return hits.length ? hits.map((t, i) => this.row(t, i, list)).join('') : '<li class="empty-state">No tracks match your search.</li>';
  }

  private libraryView(): string {
    return `
      <header class="hero compact">
        <h1>Library</h1>
        <input id="search" class="search" type="search" placeholder="Search title, artist, genre, mood…" value="${esc(this.query)}" autocomplete="off" />
      </header>
      <ol class="rows" id="lib-list">${this.libraryRows()}</ol>`;
  }

  private likedView(): string {
    const liked = this.tracks.filter((t) => this.store.stats(t.id).liked);
    const list = this.register('liked', liked.map((t) => t.id));
    return `
      <header class="hero compact liked-hero">
        <div>
          <p class="eyebrow">Playlist</p>
          <h1>Liked songs</h1>
          <p class="muted">${liked.length} song${liked.length === 1 ? '' : 's'} · each like makes your recommendations sharper</p>
        </div>
        ${liked.length ? `<button class="pill" data-action="play-all" data-list="${list}">${ICON.play}Play</button>` : ''}
      </header>
      ${
        liked.length
          ? `<ol class="rows">${liked.map((t, i) => this.row(t, i, list)).join('')}</ol>`
          : `<div class="empty-state">Tap ${ICON.heart} on any song to save it here.</div>`
      }`;
  }

  private queueView(): string {
    const p = this.player;
    const cur = p.current;
    const upcoming = p.queue.slice(p.index + 1);
    const next = this.rec.nextAutoplay(cur, new Set(p.queue));
    const list = this.register('queue', p.queue);
    return `
      <header class="hero compact"><h1>Queue</h1></header>
      <section class="section">
        <h2 class="label">Now playing</h2>
        ${cur ? `<ol class="rows">${this.row(cur, p.index, list)}</ol>` : '<p class="muted">Nothing yet — pick a song or press play.</p>'}
      </section>
      <section class="section">
        <h2 class="label">Up next</h2>
        ${
          upcoming.length
            ? `<ol class="rows">${upcoming
                .map((id, k) => {
                  const t = this.byId.get(id);
                  const i = p.index + 1 + k;
                  return t
                    ? this.row(t, i, list, `<button class="icon-btn sm" data-action="remove" data-index="${i}" aria-label="Remove from queue">${ICON.close}</button>`)
                    : '';
                })
                .join('')}</ol>`
            : '<p class="muted">Your queue is empty.</p>'
        }
      </section>
      ${
        next
          ? `<section class="section autoplay-note">
               <h2 class="label">${ICON.sparkle} Autoplay</h2>
               <p class="muted">When the queue ends, MyMusic keeps going with recommendations. Next up would be
               <strong>${esc(next.title)}</strong> by ${esc(next.artist)}.</p>
             </section>`
          : ''
      }`;
  }
}
