// The "Deep Space Network now" card: which spacecraft NASA's antennas at Goldstone, Madrid and Canberra
// are talking to. Live from our small server on Cloudflare (workers/dsn/), which gets NASA's DSN Now at
// most once a minute. The page asks it once a minute while the tab is visible, and not at all while hidden.
// It always shows real time, whatever the simulation clock says.
// Our texts (src/i18n.ts) contain no markup; values from the server pass dsnProblems() and are escaped anyway.

import { contacts, dsnProblems, inContact, type DsnDish, type DsnFile, type DsnLink } from '../live/dsn';
import { SPACECRAFT, spacecraftName } from '../data/spacecraft';
import { STRINGS, clock, lang, num, numGrouped, t, type Lang, type Strings } from '../i18n';

const POLL_MS = 60_000;
const OLD_MS = 10 * 60_000;   // NASA's own time this far back: something is stuck there

/** Real time zones of the three sites (NASA's offsets in the file can lag behind daylight saving). */
const ZONES: Record<string, string> = { gdscc: 'America/Los_Angeles', mdscc: 'Europe/Madrid', cdscc: 'Australia/Sydney' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ltr = (s: string) => `<span dir="ltr">${s}</span>`;

/** Three significant digits, with the decimals that leaves. */
function sig3(x: number, l: Lang): string {
  const v = Number(x.toPrecision(3));
  if (v >= 1000 || Number.isInteger(v)) return numGrouped(v, l);
  return num(v, v < 10 ? 2 : 1, l);
}

export function distanceText(km: number, l: Lang = lang()): string {
  const s = STRINGS[l];
  if (km < 1e6) return `${ltr(numGrouped(Number(km.toPrecision(3)), l))} ${s.km}`;
  if (km < 1e9) return `${ltr(sig3(km / 1e6, l))} ${s.millionKm}`;
  return `${ltr(sig3(km / 1e9, l))} ${s.billionKm}`;
}

export function rateText(bps: number, l: Lang = lang()): string {
  const s = STRINGS[l];
  if (bps >= 1e6) return `${ltr(sig3(bps / 1e6, l))} ${s.dsnRate[2]}`;
  if (bps >= 1e3) return `${ltr(sig3(bps / 1e3, l))} ${s.dsnRate[1]}`;
  return `${ltr(numGrouped(bps, l))} ${s.dsnRate[0]}`;
}

type ActivityKind = keyof Strings['dsnActivity'];
export function activityKind(a: string): ActivityKind | null {
  const x = a.toLowerCase();
  if (/telemetry|tracking|command/.test(x)) return 'link';
  if (/upgrade|maint/.test(x)) return 'maint';
  if (/interferometry|vlbi/.test(x)) return 'vlbi';
  if (/radar/.test(x)) return 'radar';
  if (/astronomy/.test(x)) return 'astro';
  if (/calibrat/.test(x)) return 'calib';
  if (/\btest/.test(x)) return 'test';
  return null;
}

export class DsnCard {
  private file: DsnFile | null = null;
  private state: 'loading' | 'off' | 'none' | 'ok' = 'loading';
  private url = '';
  private timer: number | undefined;
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.body = root.querySelector<HTMLElement>('.dsn-body')!;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.url) return;
      const age = this.file ? Date.now() - Date.parse(this.file.fetchedAt) : Infinity;
      if (age > POLL_MS) void this.fetchNow();
      else this.schedule(POLL_MS - age);
    });
  }

  /** Starts asking the server (url empty: the server is not set up yet, the card says so). */
  load(url: string) {
    this.url = url;
    if (!url) { this.state = 'off'; this.render(); return; }
    void this.fetchNow();
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') void this.fetchNow();
    }, ms);
  }

  private async fetchNow() {
    clearTimeout(this.timer);
    try {
      const r = await fetch(this.url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const f = await r.json();
      const problems = dsnProblems(f);
      if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
      this.file = f;
      this.state = 'ok';
    } catch (err) {
      console.info('No DSN data:', err);
      // A copy we already have stays until it is old (the note below says so)
      if (!this.file) this.state = 'none';
    }
    this.render();
    this.schedule(POLL_MS);
  }

  render() {
    const s = t();
    const l = lang();
    this.root.querySelector('.dsn-intro')!.textContent = s.dsnIntro;
    const f = this.file;
    if (this.state !== 'ok' || !f) {
      const msg = { loading: s.caLoading, off: s.dsnOff, none: s.dsnNone, ok: '' }[this.state];
      this.body.innerHTML = `<p class="sub">${msg}</p>`;
      return;
    }
    const now = Date.now();
    const name = (x: DsnLink) => `<bdi>${esc(spacecraftName(x.sc, x.name, l))}</bdi>`;
    const signal = (x: DsnLink) => (x.rtlt ? s.dsnSignalTime(esc(s.dsnLight(x.rtlt / 2))) : '');

    // Summary: how many are in contact, and the farthest of them
    const c = contacts(f);
    let html = `<p class="dsn-summary">${s.dsnSummary(c.links.length, c.dishes)}`;
    const far = c.links.filter((x) => x.link.km).sort((a, b) => b.link.km! - a.link.km!)[0];
    if (far?.link.km && far.link.rtlt) html += ` ${s.dsnFarthest(name(far.link), distanceText(far.link.km), esc(s.dsnLight(far.link.rtlt / 2)))}`;
    html += '</p>';

    // The three sites, each with its antennas
    html += '<div class="dsn-sites">';
    for (const st of f.stations) {
      const known = (s.dsnStations as Record<string, string>)[st.id];
      const zone = ZONES[st.id];
      const local = zone ? clock(now, l, zone) : st.utcOffsetMin !== null ? clock(now + st.utcOffsetMin * 60_000, l, 'UTC') : null;
      // Antennas in contact first, then those pointed at a spacecraft, then the rest
      const rank = (d: DsnDish) => (d.links.some(inContact) ? 0 : d.links.length ? 1 : 2);
      const dishes = [...st.dishes].sort((a, b) => rank(a) - rank(b));
      html += `<section class="dsn-site"><h3 class="sw-h">${esc(known ?? st.name)}</h3>
        ${local ? `<p class="sw-small">${s.dsnLocalTime(ltr(esc(local)))}</p>` : ''}<ul class="dsn-dishes">`;
      for (const d of dishes) {
        const busy = d.links.length > 0;
        const bits = [ltr(esc(d.id.replace(/^DSS/, 'DSS ')))];
        const m = /^(\d+)M/.exec(d.size ?? '');
        if (m) bits.push(s.dsnSize(ltr(m[1])));
        if (busy && d.el !== null && d.el > 0 && d.el < 89.5) bits.push(s.dsnElevation(ltr(`${num(d.el, 0)}°`)));
        const kind = activityKind(d.activity);
        const activity = kind ? s.dsnActivity[kind] : `<bdi>${esc(d.activity)}</bdi>`;
        // Not talking to a spacecraft (maintenance, radio astronomy ...): one line
        if (!busy) { html += `<li class="dsn-dish idle"><div class="dsn-dish-head">${bits.join(' · ')} · ${activity}</div></li>`; continue; }
        html += `<li class="dsn-dish"><div class="dsn-dish-head">${bits.join(' · ')}</div>`;
        if (kind !== 'link') html += `<div class="sw-small">${activity}</div>`;
        html += '<ul class="dsn-links">';
        for (const x of d.links.filter(inContact)) {
          const where = SPACECRAFT[x.sc]?.where;
          const parts: string[] = [];
          const down = x.down.filter((y) => y.bps);
          if (down.length) parts.push(`<span class="nowrap" title="${s.dsnDown}">↓ ${down.map((y) => rateText(y.bps!)).join(' + ')}</span>`);
          else if (x.down.length) parts.push(`<span title="${s.dsnDown}">↓</span>`);
          if (x.up) parts.push(`<span title="${s.dsnUp}">↑</span>`);
          if (x.km) parts.push(`<span class="nowrap">${distanceText(x.km)}</span>`);
          const sig = signal(x);
          if (sig) parts.push(`<span class="nowrap">${sig}</span>`);
          html += `<li><span class="dsn-craft">${name(x)}</span>`
            + `${where ? ` <span class="sw-small">${s.dsnWhere[where]}</span>` : ''}`
            + `<span class="dsn-line">${parts.join(' · ')}</span></li>`;
        }
        // Pointed at, but no signal right now (often between two passes): names only
        const off = d.links.filter((x) => !inContact(x));
        if (off.length) html += `<li class="off"><span class="dsn-craft">${off.map(name).join(s.comma)}</span><span class="dsn-line">${s.dsnNoSignal(off.length)}</span></li>`;
        html += '</ul>';
        if (d.mspa && d.links.filter(inContact).length > 1) html += `<div class="sw-small">${s.dsnMspa}</div>`;
        html += '</li>';
      }
      html += '</ul></section>';
    }
    html += '</div>';

    // Footer: how old, where from
    const at = Date.parse(f.at);
    const ago = s.dsnAgo(Math.max(0, (now - at) / 1000));
    if (now - at > OLD_MS) html += `<p class="ca-stale">${s.dsnOld(esc(ago))}</p>`;
    html += `<p class="sub ca-note">${s.dsnNote}</p>
      <p class="sub ca-note">${s.dsnUpdated(ltr(esc(clock(at, l))), esc(ago))} ·
        ${ltr('<a href="https://eyes.nasa.gov/dsn/" target="_blank" rel="noopener">NASA DSN Now</a>')}</p>`;
    this.body.innerHTML = html;
  }
}
