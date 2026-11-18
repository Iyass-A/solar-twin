// The "Now in space" screen: one tile per live source (Deep Space Network, space weather, close
// approaches) with its headline and when it was last updated, and one for the sky events of the next days
// (worked out in the browser). A tile opens its card below, so only one card is shown at a time.
// #now, #now-dsn, #now-weather, #now-approaches and #now-events in the address open the screen (and a card)
// directly, so a link can point there.
// The tiles' texts come from the cards (tile()); they contain no markup of their own beyond what the
// cards already escape.

import { lang, t } from '../i18n';

export interface Tile {
  ok: boolean;
  main: string;            // HTML
  sub: string;             // HTML
  updatedMs: number | null;
}

export type NowTab = 'dsn' | 'weather' | 'approaches' | 'events';
export const NOW_TABS: NowTab[] = ['dsn', 'weather', 'approaches', 'events'];

const HOUR_MS = 3_600_000;

interface Source { tile(): Tile; render(): void; }

export class NowScreen {
  private current: NowTab = 'dsn';
  private readonly buttons = new Map<NowTab, HTMLButtonElement>();
  private readonly root: HTMLElement;
  private readonly panels: Record<NowTab, HTMLElement>;
  private readonly sources: Record<NowTab, Source>;

  constructor(root: HTMLElement, panels: Record<NowTab, HTMLElement>, sources: Record<NowTab, Source>) {
    this.root = root;
    this.panels = panels;
    this.sources = sources;
    const list = root.querySelector<HTMLElement>('.now-tiles')!;
    for (const tab of NOW_TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'now-tile';
      b.id = `now-tab-${tab}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', panels[tab].id);
      b.innerHTML = '<span class="label"></span><span class="now-main"></span><span class="now-sub"></span><span class="now-updated"></span>';
      b.addEventListener('click', () => this.select(tab, true));
      b.addEventListener('keydown', (ev) => this.key(ev, tab));
      list.append(b);
      this.buttons.set(tab, b);
      panels[tab].setAttribute('role', 'tabpanel');
    }
    const fromHash = this.fromHash();
    this.select(fromHash ?? 'dsn', false);
    if (fromHash || location.hash === '#now') requestAnimationFrame(() => this.root.scrollIntoView({ block: 'start' }));
    window.addEventListener('hashchange', () => {
      const tab = this.fromHash();
      if (tab) this.select(tab, false);
      if (tab || location.hash === '#now') this.root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setInterval(() => this.render(), 30_000); // "updated … ago" moves on
  }

  private fromHash(): NowTab | null {
    const m = /^#now-(dsn|weather|approaches|events)$/.exec(location.hash);
    return m ? (m[1] as NowTab) : null;
  }

  select(tab: NowTab, byUser: boolean) {
    this.current = tab;
    for (const x of NOW_TABS) {
      const on = x === tab;
      const b = this.buttons.get(x)!;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      this.panels[x].hidden = !on;
    }
    // The address remembers the open card, without jumping the page
    if (byUser) history.replaceState(null, '', `${location.pathname}${location.search}#now-${tab}`);
    this.sources[tab].render();
  }

  /** Arrow keys move between tiles (mirrored in Arabic), Home and End go to the first and last. */
  private key(ev: KeyboardEvent, tab: NowTab) {
    const i = NOW_TABS.indexOf(tab);
    const rtl = lang() === 'ar';
    let next = -1;
    if (ev.key === 'ArrowRight') next = i + (rtl ? -1 : 1);
    else if (ev.key === 'ArrowLeft') next = i + (rtl ? 1 : -1);
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = NOW_TABS.length - 1;
    else return;
    ev.preventDefault();
    const to = NOW_TABS[(next + NOW_TABS.length) % NOW_TABS.length];
    this.select(to, true);
    this.buttons.get(to)!.focus();
  }

  render() {
    const s = t();
    this.root.querySelector('.now-title')!.textContent = s.nowTitle;
    this.root.querySelector('.now-intro')!.textContent = s.nowIntro;
    const now = Date.now();
    for (const tab of NOW_TABS) {
      const b = this.buttons.get(tab)!;
      const tile = this.sources[tab].tile();
      b.classList.toggle('empty', !tile.ok);
      b.querySelector('.label')!.textContent = s.nowTabs[tab];
      b.querySelector('.now-main')!.innerHTML = tile.main;
      b.querySelector('.now-sub')!.innerHTML = tile.sub;
      let ago = '';
      if (tile.updatedMs !== null) {
        const age = Math.max(0, now - tile.updatedMs);
        ago = s.nowUpdated(tab === 'dsn' ? s.dsnAgo(age / 1000) : s.relTime(-age / HOUR_MS));
      }
      b.querySelector('.now-updated')!.textContent = ago;
    }
  }

  get selected(): NowTab { return this.current; }
}
