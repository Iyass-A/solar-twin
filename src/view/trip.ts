// Trip planner (phase 6): a card under "branch reality". Step 1: the Hohmann transfer from the Earth to a
// planet (src/transfer/hohmann.ts): how long the trip takes, the two burns, and the launch window next to
// the time on screen, with a button that goes there. Step 2: the exact trip for two dates the visitor picks
// (Lambert's problem on the real orbits, src/transfer/lambert.ts), starting from that window's dates.

import { PARKING_ALT_KM, TARGETS, leadAngle, tripTo, windows, type Trip } from '../transfer/hohmann';
import { realTrip, type RealTrip } from '../transfer/lambert';
import { toJulianDate } from '../astro/julian';
import type { PlanetId } from '../astro/elements';
import { t, num, numGrouped, dayMonthYear } from '../i18n';

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const jdToMs = (jd: number) => (jd - UNIX_EPOCH_JD) * DAY_MS;
const GIANTS: PlanetId[] = ['jupiter', 'saturn', 'uranus', 'neptune'];
/** A window this recent is still shown next to the coming one. */
const RECENT_DAYS = 60;
/** The first and last day a date field takes (the time bar's range). */
const FIRST_DAY = '1800-01-01', LAST_DAY = '2050-12-31';
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (ms: number) => Math.round(ms / DAY_MS) * DAY_MS;

/** A number that keeps its left-to-right order inside Arabic text. */
const ltr = (s: string) => `<span dir="ltr">${s}</span>`;
/** A value with its unit, kept on one line. */
const nw = (s: string) => `<span class="nw">${s}</span>`;

export class TripCard {
  /** Called to move the time on screen to a launch date and pick the target planet. */
  onJump: ((ms: number, target: PlanetId) => void) | null = null;

  private target: PlanetId = 'mars';
  // The windows around the time on screen, kept while that time stays between them
  private around: { target: PlanetId; prev: number; next: number; trip: Trip } | null = null;
  private jumpMs: number | null = null;
  private shown = '';
  // The exact trip: its two dates (UTC midnight), the target they were set for, and its result
  private exact: { target: PlanetId; depart: number; arrive: number; trip: RealTrip | null } | null = null;
  private exactShown = '';
  private readonly clock: () => { ms: number; min: number; max: number };

  private readonly el: {
    title: HTMLElement; badge: HTMLElement; intro: HTMLElement; toLabel: HTMLElement; select: HTMLSelectElement;
    facts: HTMLElement; whenTitle: HTMLElement; when: HTMLElement; jump: HTMLButtonElement; note: HTMLElement; giants: HTMLElement;
    exactTitle: HTMLElement; exactIntro: HTMLElement; departLabel: HTMLElement; arriveLabel: HTMLElement;
    depart: HTMLInputElement; arrive: HTMLInputElement; exactFacts: HTMLElement; exactLines: HTMLElement;
  };

  constructor(root: HTMLElement, clock: () => { ms: number; min: number; max: number }) {
    this.clock = clock;
    root.innerHTML = `
      <h2 class="card-title"><span class="tp-title"></span> <span class="badge tp-badge"></span></h2>
      <p class="sub tp-intro"></p>
      <div class="row"><label><span class="tp-to-label"></span> <select class="tp-target">
        ${TARGETS.map((id) => `<option value="${id}"></option>`).join('')}
      </select></label></div>
      <dl class="tp-facts"></dl>
      <h3 class="tp-when-title"></h3>
      <div class="tp-when"></div>
      <div class="row tp-buttons"><button type="button" class="tp-jump"></button></div>
      <p class="sub tp-note"></p>
      <p class="sub tp-giants" hidden></p>
      <h3 class="tp-exact-title"></h3>
      <p class="sub tp-exact-intro"></p>
      <div class="row tp-dates">
        <label><span class="tp-depart-label"></span> <input class="tp-depart" type="date" dir="ltr" min="${FIRST_DAY}" max="${LAST_DAY}"></label>
        <label><span class="tp-arrive-label"></span> <input class="tp-arrive" type="date" dir="ltr" min="${FIRST_DAY}" max="${LAST_DAY}"></label>
      </div>
      <dl class="tp-facts tp-exact-facts"></dl>
      <div class="tp-when tp-exact-lines"></div>`;
    const q = <T extends HTMLElement>(c: string) => root.querySelector<T>(c)!;
    this.el = {
      title: q('.tp-title'), badge: q('.tp-badge'), intro: q('.tp-intro'), toLabel: q('.tp-to-label'), select: q('.tp-target'),
      facts: q('.tp-facts'), whenTitle: q('.tp-when-title'), when: q('.tp-when'), jump: q('.tp-jump'), note: q('.tp-note'),
      giants: q('.tp-giants'),
      exactTitle: q('.tp-exact-title'), exactIntro: q('.tp-exact-intro'), departLabel: q('.tp-depart-label'),
      arriveLabel: q('.tp-arrive-label'), depart: q('.tp-depart'), arrive: q('.tp-arrive'),
      exactFacts: q('.tp-exact-facts'), exactLines: q('.tp-exact-lines'),
    };
    this.el.select.value = this.target;
    this.el.select.addEventListener('change', () => {
      this.target = this.el.select.value as PlanetId;
      this.render();
    });
    this.el.jump.addEventListener('click', () => {
      if (this.jumpMs !== null) this.onJump?.(this.jumpMs, this.target);
    });
    for (const input of [this.el.depart, this.el.arrive]) {
      input.addEventListener('change', () => {
        const d = this.el.depart.valueAsNumber, a = this.el.arrive.valueAsNumber;
        if (Number.isNaN(d) || Number.isNaN(a)) return;
        this.setExact(this.target, d, a);
      });
    }
  }

  /** Works out the exact trip for two dates (UTC midnight) and shows them in the fields. */
  private setExact(target: PlanetId, depart: number, arrive: number) {
    const trip = arrive > depart ? realTrip(target, toJulianDate(new Date(depart)), toJulianDate(new Date(arrive))) : null;
    this.exact = { target, depart, arrive, trip };
    if (this.el.depart.value !== isoDay(depart)) this.el.depart.value = isoDay(depart);
    if (this.el.arrive.value !== isoDay(arrive)) this.el.arrive.value = isoDay(arrive);
    this.renderExact();
  }

  private renderExact() {
    const x = this.exact;
    if (!x) return;
    const s = t().trip;
    let facts = '', lines: string[];
    if (!(x.arrive > x.depart)) lines = [s.badDates];
    else if (!x.trip) lines = [s.noTrip];
    else {
      const r = x.trip;
      facts = factsHtml(tripFacts(r.tofDays, r.leave, r.c3, r.arrive, r.vInfArrive, r.total, x.target));
      lines = [s.way(ltr(`${num(r.angleDeg, 0)}°`), r.type)];
    }
    const html = facts + '\u0000' + lines.map((l) => `<p>${l}</p>`).join('');
    if (html === this.exactShown) return;
    this.exactShown = html;
    this.el.exactFacts.innerHTML = facts;
    this.el.exactFacts.hidden = !facts;
    this.el.exactLines.innerHTML = html.split('\u0000')[1];
  }

  /** Texts for the language, then the numbers. */
  render() {
    const s = t().trip;
    this.el.title.textContent = s.title;
    this.el.badge.textContent = s.badge;
    this.el.intro.textContent = s.intro;
    this.el.toLabel.textContent = s.to;
    this.el.whenTitle.textContent = s.whenTitle;
    this.el.jump.textContent = s.jump;
    this.el.note.textContent = s.note;
    this.el.giants.textContent = s.giants;
    this.el.exactTitle.textContent = s.exactTitle;
    this.el.exactIntro.textContent = s.exactIntro;
    this.el.departLabel.textContent = s.departDate;
    this.el.arriveLabel.textContent = s.arriveDate;
    this.el.select.querySelectorAll('option').forEach((o) => { o.textContent = t().planets[o.value as PlanetId]; });
    this.shown = '';
    this.exactShown = '';
    this.update();
    this.renderExact();
  }

  /** The numbers for the time on screen (a few times a second). */
  update() {
    const { ms, min, max } = this.clock();
    const jd = toJulianDate(new Date(ms));
    const target = this.target;
    let a = this.around;
    if (!a || a.target !== target || !(jd > a.prev && jd <= a.next)) {
      const trip = tripTo(target, jd);
      a = this.around = { target, trip, ...windows(trip, jd) };
    }
    const { trip } = a;
    const s = t().trip;

    // The nearest window: one that began less than a day ago, or else the next
    const current = jd - a.prev < 1 ? a.prev : a.next;
    const days = trip.h.tofDays;
    const facts = tripFacts(days, trip.leave, trip.c3, trip.arrive, trip.h.dv2, trip.total, target);
    // The exact trip starts from this window's dates, for each planet picked
    if (this.exact?.target !== target) {
      const depart = dayMs(jdToMs(current));
      this.setExact(target, depart, dayMs(depart + days * DAY_MS));
    }
    const now = leadAngle(target, jd);
    const date = (wjd: number) => `<bdi>${dayMonthYear(jdToMs(wjd), undefined, 'UTC')}</bdi>`;
    const lines = [
      s.phase(target, ltr(`${num(Math.abs(trip.h.phaseDeg), 1)}°`), trip.h.phaseDeg >= 0, ltr(`${num(Math.abs(now), 1)}°`), now >= 0),
      s.window(date(current), s.rel(current - jd), date(current + days)),
    ];
    if (current === a.next && jd - a.prev < RECENT_DAYS) lines.push(s.prev(date(a.prev), s.rel(a.prev - jd)));
    lines.push(s.every(ltr(numGrouped(trip.synodicDays)), Math.round(trip.synodicDays / 30.44)));

    const departMs = jdToMs(current);
    const inRange = departMs >= min && departMs <= max;
    this.jumpMs = inRange ? departMs : null;
    if (!inRange) lines.push(s.outside);

    const html = factsHtml(facts) + '\u0000' + lines.map((l) => `<p>${l}</p>`).join('');
    if (html === this.shown) return;
    this.shown = html;
    const [f, w] = html.split('\u0000');
    this.el.facts.innerHTML = f;
    this.el.when.innerHTML = w;
    this.el.jump.hidden = !inRange;
    this.el.giants.hidden = !GIANTS.includes(target);
  }
}

/** The four boxes of a trip: time on the way, the two burns with their notes, and both together. */
function tripFacts(days: number, leave: number, c3: number, arrive: number, vInf: number, total: number, target: PlanetId): string[][] {
  const s = t().trip;
  const kmS = (v: number) => nw(s.kmS(ltr(num(v, 2))));
  return [
    days < 730
      ? [s.duration, s.tripDays(ltr(numGrouped(days))), s.aboutMonths(ltr(num(days / 30.44, 1)))]
      : [s.duration, s.tripYears(ltr(num(days / 365.25, 1))), s.tripDays(ltr(numGrouped(days)))],
    [s.leave, kmS(leave), s.leaveNote(ltr(numGrouped(PARKING_ALT_KM)), nw(s.c3(ltr(num(c3, 2)))))],
    [s.arrive, kmS(arrive), s.arriveNote(ltr(numGrouped(PARKING_ALT_KM)), t().planets[target], kmS(vInf))],
    [s.total, kmS(total), ''],
  ];
}

const factsHtml = (rows: string[][]) => rows.map(([label, value, note]) =>
  `<div><dt>${label}</dt><dd><span class="tp-v">${value}</span>${note ? `<span class="tp-n">${note}</span>` : ''}</dd></div>`).join('');
