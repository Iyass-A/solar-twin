// The "Close approaches to Earth" card: live data from CNEOS (JPL), fetched on GitHub before each
// deploy into data/live/close-approaches.json on our own site (see scripts/fetch-close-approaches.ts).
// It always shows real time, whatever the simulation clock says.
// Our texts (src/i18n.ts) contain no markup, so they go into the HTML as they are; JPL's names are escaped.

import { AU_KM, DIST_MAX_AU, LD_AU, fileProblems, sizeRange, tdbToUtcMs, type CloseApproach, type CloseApproachFile } from '../live/closeApproaches';
import { dateTime, dayMonth, dayMonthTime, lang, num, numGrouped, t } from '../i18n';

const HOUR_MS = 3_600_000;
const UPCOMING_SHOWN = 10;
const STALE_MS = 36 * HOUR_MS; // the daily fetch is late or failed: say so
const SHOW_SIGMA_MIN = 30;     // time uncertainty worth showing [minutes]
const WIDE_RANGE = 1.2;        // show the 3σ distances when the largest is this many times the smallest

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ltr = (s: string) => `<span dir="ltr">${s}</span>`;

/** Two significant digits, in m below 1 km (or in km for both ends of a range that reaches 1 km). */
function size(km: number, inKm: boolean): string {
  const v = Number((inKm ? km : km * 1000).toPrecision(2));
  return v >= 100 ? numGrouped(v) : num(v, v === Math.round(v) ? 0 : 1);
}

/** Measured diameter, or a range estimated from the brightness. */
export function sizeHtml(a: CloseApproach): string {
  const s = t();
  if (a.diameter !== null) {
    const km = a.diameter >= 1;
    return `<span class="nowrap">${ltr(size(a.diameter, km))} ${km ? s.km : s.metres}</span>`;
  }
  if (a.h === null) return '';
  const [lo, hi] = sizeRange(a.h);
  const km = hi >= 1;
  return `<span class="nowrap" title="${s.caEstimate}">≈ ${ltr(`${size(lo, km)}–${size(hi, km)}`)} ${km ? s.km : s.metres}</span>`;
}

const lunar = (au: number) => num(au / LD_AU, au / LD_AU < 1 ? 2 : 1);
const lunarHtml = (au: number) => t().lunar(ltr(lunar(au)));

function kmHtml(au: number): string {
  const km = au * AU_KM;
  return km < 1e6 ? `${ltr(numGrouped(Number(km.toPrecision(2))))} ${t().km}` : `${ltr(num(km / 1e6, 2))} ${t().millionKm}`;
}

const nameHtml = (a: CloseApproach, ours?: string) => `<bdi>${esc(ours ?? a.name)}</bdi>`;
/** When the 3σ distances spread wide (often a body seen for a few days only), they are shown too. */
const isWide = (a: CloseApproach) => a.distMax / a.distMin > WIDE_RANGE;
const uncertainHtml = (a: CloseApproach) => t().caUncertain(ltr(lunar(a.distMin)), ltr(lunar(a.distMax)));
const when = (a: CloseApproach) => tdbToUtcMs(a.jd);
const closerThanMoon = (list: CloseApproach[]) => list.filter((a) => a.dist < LD_AU).length;
const closest = (list: CloseApproach[]) => list.reduce<CloseApproach | null>((c, a) => (!c || a.dist < c.dist ? a : c), null);

export class ApproachesCard {
  /** Picks a body on the map; set by the page. */
  onPick: (id: string) => void = () => {};
  /** Our id and name (in the current language) for a JPL designation, if the body is one of the dots on the map. */
  catalog: (des: string) => { id: string; name: string } | undefined = () => undefined;

  private file: CloseApproachFile | null = null;
  private state: 'loading' | 'none' | 'ok' = 'loading';
  private showPast = false;
  private showAll = false;
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.body = root.querySelector<HTMLElement>('.ca-body')!;
    this.body.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-ca="past"]')) { this.showPast = !this.showPast; this.render(); return; }
      if (el.closest('[data-ca="all"]')) { this.showAll = !this.showAll; this.render(); return; }
      const row = el.closest<HTMLTableRowElement>('tr[data-id]');
      if (row) this.onPick(row.dataset.id!);
    });
    setInterval(() => this.render(), 60_000); // relative times, and what has passed by now
  }

  async load(url: string) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const f = await r.json();
      const problems = fileProblems(f);
      if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
      this.file = f;
      this.state = 'ok';
    } catch (err) {
      console.info('No live close-approach data:', err);
      this.state = 'none';
    }
    this.render();
  }

  render() {
    const s = t();
    const l = lang();
    this.root.querySelector('.ca-intro')!.textContent = s.caIntro(num(DIST_MAX_AU * AU_KM / 1e6, 1), num(DIST_MAX_AU / LD_AU, 1));
    const f = this.file;
    if (this.state !== 'ok' || !f) {
      this.body.innerHTML = `<p class="sub">${this.state === 'loading' ? s.caLoading : s.caNone}</p>`;
      return;
    }
    const now = Date.now();
    const past = f.approaches.filter((a) => when(a) < now);
    const ahead = f.approaches.filter((a) => when(a) >= now);

    // Summary: what is coming, and what passed in the last week
    const until = dayMonth(Date.parse(`${f.dateMax}T00:00:00Z`), l, 'UTC');
    const cA = closest(ahead), cP = closest(past);
    const name = (a: CloseApproach) => nameHtml(a, this.catalog(a.des)?.name);
    let summary = `<p class="ca-summary">${s.caAhead(ahead.length, closerThanMoon(ahead), until)}`;
    if (cA) {
      const range = isWide(cA) ? ` (${uncertainHtml(cA)})` : '';
      summary += ` ${s.caClosest(name(cA), `${lunarHtml(cA.dist)}${range}${s.comma}${s.relTime((when(cA) - now) / HOUR_MS)}`)}`;
    }
    summary += '</p>';
    if (past.length) {
      summary += `<p class="sub">${s.caPast(past.length, closerThanMoon(past))}`
        + `${cP ? ` ${s.caClosest(name(cP), `${lunarHtml(cP.dist)} (${kmHtml(cP.dist)})`)}` : ''}</p>`;
    }

    // Table: the last week if asked for, then what is coming (the next ten, or all)
    const rows = [...(this.showPast ? past : []), ...(this.showAll ? ahead : ahead.slice(0, UPCOMING_SHOWN))];
    let anyOnMap = false;
    const speed = (a: CloseApproach) => `${ltr(num(a.vRel, 1))} ${s.kmPerS}`;
    const row = (a: CloseApproach) => {
      const ms = when(a);
      const id = this.catalog(a.des)?.id;
      anyOnMap ||= !!id;
      const sz = sizeHtml(a);
      const sigma = a.tSigmaMin !== null && a.tSigmaMin >= SHOW_SIGMA_MIN ? ` · <span class="nowrap">±${s.duration(a.tSigmaMin)}</span>` : '';
      const wide = isWide(a) ? `<span class="ca-line">${uncertainHtml(a)}</span>` : '';
      const moon = a.dist < LD_AU;
      const cls = [ms < now ? 'past' : '', moon ? 'moon' : ''].filter(Boolean).join(' ');
      return `<tr${cls ? ` class="${cls}"` : ''}${id ? ` data-id="${id}" title="${s.caOnMap}"` : ''}>
        <td class="ca-name">${id ? '<i class="ca-dot"></i>' : ''}${name(a)}${sz ? `<span class="ca-line">${sz}</span>` : ''}</td>
        <td class="ca-when">${dateTime(ms, l)}<span class="ca-line">${s.relTime((ms - now) / HOUR_MS)}${sigma}</span></td>
        <td class="ca-dist">${lunarHtml(a.dist)}${moon ? ` <span class="badge moon">${s.caCloserThanMoon}</span>` : ''}
          <span class="ca-line">${kmHtml(a.dist)}</span>${wide}
          <span class="ca-line ca-speed-inline">${speed(a)}</span></td>
        <td class="ca-speed">${speed(a)}</td>
      </tr>`;
    };
    // Between the last week and what is coming: a line for now
    const nowRow = `<tr class="ca-now"><td colspan="4"><span>${s.now}</span></td></tr>`;
    const table = rows.length ? `
      <div class="ca-table"><table>
        <thead><tr>
          <th>${s.caColObject}</th><th>${s.caColWhen}</th><th>${s.caColDistance}</th><th class="ca-speed">${s.caColSpeed}</th>
        </tr></thead>
        <tbody>${rows.map((a, k) => (k > 0 && when(rows[k - 1]) < now && when(a) >= now ? nowRow : '') + row(a)).join('')}</tbody>
      </table></div>` : '';

    const buttons = [
      past.length ? `<button type="button" data-ca="past" aria-pressed="${this.showPast}">${this.showPast ? s.caHidePast : s.caShowPast(past.length)}</button>` : '',
      ahead.length > UPCOMING_SHOWN ? `<button type="button" data-ca="all" aria-pressed="${this.showAll}">${this.showAll ? s.caShowFewer : s.caShowAll(ahead.length)}</button>` : '',
    ].join('');

    const fetched = Date.parse(f.fetchedAt);
    const stale = now - fetched > STALE_MS ? `<p class="ca-stale">${s.caStale(dayMonth(fetched, l))}</p>` : '';
    this.body.innerHTML = `${summary}${table}${buttons ? `<div class="ca-buttons">${buttons}</div>` : ''}${stale}
      <p class="sub ca-note">${anyOnMap ? `<i class="ca-dot"></i>${s.caOnMap}. ` : ''}${s.caNote}</p>
      <p class="sub ca-note">${s.caUpdated(dayMonthTime(fetched, l))} ·
        ${ltr('<a href="https://cneos.jpl.nasa.gov/ca/" target="_blank" rel="noopener">CNEOS (NASA/JPL)</a>')}</p>`;
  }
}
