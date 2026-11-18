// The "Sky events" card (phase 8, step 1), on the "Now in space" screen: what happens in the sky in the next
// 7 or 30 days, worked out in the browser (src/events/events.ts), in real time whatever the simulation clock says.
// A button by each event takes the views to its moment. Asteroids passing the Earth come from the live CNEOS file
// of the close-approaches card. Our texts (src/i18n.ts) contain no markup; JPL's names are escaped.

import { eventPlanet, findEvents, GLARE_DEG, type SkyEvent } from '../events/events';
import { AU_KM, LD_AU, type CloseApproach } from '../live/closeApproaches';
import { dateTime, lang, num, numGrouped, t } from '../i18n';
import type { EventPlanet } from '../events/events';
import type { Tile } from './now';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const EVENT_DAYS = [7, 30] as const;
export type EventDays = (typeof EVENT_DAYS)[number];
/** Optics needed above this brightness (magnitude) */
const NAKED_EYE_MAG = 5;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ltr = (s: string) => `<span dir="ltr">${s}</span>`;
const deg = (d: number, digits = 1) => ltr(`${num(d, digits)}°`);
const mag = (m: number) => ltr(num(m, 1).replace('-', '−'));
const millionKm = (au: number) => `<span class="nowrap">${ltr(numGrouped(au * AU_KM / 1e6))} ${t().millionKm}</span>`;

export function latLon(lat: number, lon: number): string {
  const e = t().events;
  return `<span class="nowrap">${deg(Math.abs(lat))} ${lat >= 0 ? e.north : e.south}</span>${t().comma}`
    + `<span class="nowrap">${deg(Math.abs(lon))} ${lon >= 0 ? e.east : e.west}</span>`;
}

/** The name of a body of an event, in the current language */
function bodyName(b: 'moon' | EventPlanet): string {
  return b === 'moon' ? t().events.moonName : t().planets[b];
}

/** What the event is, in a few words (HTML). */
export function eventTitle(e: SkyEvent): string {
  const s = t().events;
  switch (e.kind) {
    case 'moon': return s.moon[e.phase];
    case 'conjunction': return s.conjunction[e.side ?? 'plain'](bodyName(e.body));
    case 'opposition': return s.opposition(bodyName(e.body));
    case 'elongation': return s.elongation(bodyName(e.body), e.sky);
    case 'solarEclipse': return s.solar[e.type];
    case 'lunarEclipse': return s.lunar[e.type];
    case 'season': return s.seasons[e.season];
    case 'perihelion': return s.perihelion;
    case 'aphelion': return s.aphelion;
    case 'pair': return s.pair(bodyName(e.a), bodyName(e.b));
    case 'neo': return s.neo(`<bdi>${esc(e.name)}</bdi>`);
  }
}

/** One or two sentences about it: how to see it, how close, how bright (HTML). */
export function eventNote(e: SkyEvent): string {
  const s = t().events;
  switch (e.kind) {
    case 'moon': return s.moonNotes[e.phase];
    case 'conjunction': return s.conjunctionNotes[e.side ?? 'plain'];
    case 'opposition':
      return `${s.oppositionNote} ${s.brightDistance(mag(e.mag), millionKm(e.distAu))}${e.mag > NAKED_EYE_MAG ? ` ${s.optics}` : ''}`;
    case 'elongation': return `${s.elongationNote(deg(e.deg), e.sky)} ${s.brightness(mag(e.mag))}`;
    case 'solarEclipse':
      return `${e.lat !== null && e.lon !== null ? s.solarWhere(latLon(e.lat, e.lon)) : s.solarPartial} ${s.solarSafety}`;
    case 'lunarEclipse': return s.lunarNotes[e.type](t().duration(e.minutes));
    case 'season': return s.seasonNotes[e.season];
    case 'perihelion': return s.perihelionNote(millionKm(e.distAu));
    case 'aphelion': return s.aphelionNote(millionKm(e.distAu));
    case 'pair': return `${s.pairNote(deg(e.sepDeg))}${e.sunDeg < GLARE_DEG ? ` ${s.glare}` : ''}`;
    case 'neo': {
      const km = e.distAu * AU_KM;
      const dist = `${t().lunar(ltr(num(e.distAu / LD_AU, e.distAu < LD_AU ? 2 : 1)))} (${km < 1e6 ? `${ltr(numGrouped(Number(km.toPrecision(2))))} ${t().km}` : millionKm(e.distAu)})`;
      return `${s.neoNote(dist)} ${e.closerThanMoon ? s.neoCloser : s.neoClosest}`;
    }
  }
}

/** Perihelion and aphelion are touchy to the minute (see scripts/check-events.ts): to the hour only. */
export const approximate = (e: SkyEvent) => e.kind === 'perihelion' || e.kind === 'aphelion';

export class SkyEventsCard {
  /** Takes the views to an event's moment, and picks its planet; set by the page. */
  onJump: (ms: number, planet: EventPlanet | null) => void = () => {};
  /** The asteroids passing the Earth, from the close-approaches card (empty until it has loaded). */
  neos: () => CloseApproach[] = () => [];

  private days: EventDays = 30;
  private events: SkyEvent[] = [];
  private key = '';
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.body = root.querySelector<HTMLElement>('.ev-body')!;
    this.body.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      const daysBtn = el.closest<HTMLButtonElement>('button[data-ev-days]');
      if (daysBtn) { this.days = Number(daysBtn.dataset.evDays) as EventDays; this.render(); return; }
      const jump = el.closest<HTMLButtonElement>('button[data-ev-jump]');
      if (jump) {
        const e = this.events.find((x) => String(x.ms) === jump.dataset.evJump);
        if (e) this.onJump(e.ms, eventPlanet(e));
      }
    });
    setInterval(() => this.render(), 60_000); // relative times, and what has passed by now
  }

  /** The events of the next 30 days from this hour (worked out again each hour, or when the asteroids come). */
  private list(now: number): SkyEvent[] {
    const from = Math.floor(now / HOUR_MS) * HOUR_MS;
    const neos = this.neos();
    const key = `${from}/${neos.length}`;
    if (key !== this.key) {
      this.key = key;
      try {
        this.events = findEvents(from, from + 30 * DAY_MS + HOUR_MS, neos);
      } catch (err) {
        console.error('Sky events not worked out', err);
        this.events = [];
      }
    }
    return this.events.filter((e) => e.ms >= now && e.ms < now + 30 * DAY_MS);
  }

  /** For the "Now in space" screen: how many in the next 30 days, and the next one. */
  tile(): Tile {
    const s = t();
    const now = Date.now();
    const list = this.list(now);
    const next = list[0];
    const sub = next ? s.events.next(eventTitle(next), s.relTime((next.ms - now) / HOUR_MS)) : '';
    return { ok: true, main: esc(s.events.tileMain(list.length)), sub, updatedMs: null };
  }

  render() {
    const s = t();
    const e = s.events;
    const l = lang();
    this.root.querySelector('#evTitle')!.textContent = e.title;
    this.root.querySelector('#evBadge')!.textContent = e.badge;
    this.root.querySelector('.ev-intro')!.textContent = e.intro;
    const now = Date.now();
    const list = this.list(now).filter((x) => x.ms < now + this.days * DAY_MS);

    const buttons = EVENT_DAYS.map((d) =>
      `<button type="button" data-ev-days="${d}" aria-pressed="${d === this.days}">${d === 7 ? e.days7 : e.days30}</button>`).join('');
    const rows = list.map((x) => {
      const ms = approximate(x) ? Math.round(x.ms / HOUR_MS) * HOUR_MS : x.ms;
      const when = approximate(x) ? e.about(dateTime(ms, l)) : dateTime(ms, l);
      const planet = eventPlanet(x);
      const cls = x.kind === 'solarEclipse' || x.kind === 'lunarEclipse' ? 'eclipse' : x.kind === 'neo' && x.closerThanMoon ? 'moon' : '';
      return `<li${cls ? ` class="${cls}"` : ''}>
        <div class="ev-when">${when}<span class="ev-line">${s.relTime((x.ms - now) / HOUR_MS)}</span></div>
        <div class="ev-what"><span class="ev-title">${eventTitle(x)}</span><span class="ev-line">${eventNote(x)}</span></div>
        <div class="ev-go"><button type="button" data-ev-jump="${x.ms}" title="${planet ? e.jumpPick(bodyName(planet)) : e.jumpTitle}">${e.jump}</button></div>
      </li>`;
    }).join('');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    this.body.innerHTML = `
      <div class="ca-buttons ev-days" role="group" aria-label="${e.daysLabel}">${buttons}</div>
      <p class="ev-summary">${e.summary(list.length, this.days)}</p>
      ${rows ? `<ol class="ev-list">${rows}</ol>` : ''}
      <p class="sub ca-note">${e.note(`<bdi>${esc(tz)}</bdi>`)}
        ${ltr('<a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a>')}</p>`;
  }
}
