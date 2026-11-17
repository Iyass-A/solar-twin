// Trip planner (phase 6): a card under "branch reality". Step 1: the Hohmann transfer from the Earth to a
// planet (src/transfer/hohmann.ts): how long the trip takes, the two burns, and the launch window next to
// the time on screen, with a button that goes there.

import { PARKING_ALT_KM, TARGETS, leadAngle, tripTo, windows, type Trip } from '../transfer/hohmann';
import { toJulianDate } from '../astro/julian';
import type { PlanetId } from '../astro/elements';
import { t, num, numGrouped, dayMonthYear } from '../i18n';

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const jdToMs = (jd: number) => (jd - UNIX_EPOCH_JD) * DAY_MS;
const GIANTS: PlanetId[] = ['jupiter', 'saturn', 'uranus', 'neptune'];
/** A window this recent is still shown next to the coming one. */
const RECENT_DAYS = 60;

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
  private readonly clock: () => { ms: number; min: number; max: number };

  private readonly el: {
    title: HTMLElement; badge: HTMLElement; intro: HTMLElement; toLabel: HTMLElement; select: HTMLSelectElement;
    facts: HTMLElement; whenTitle: HTMLElement; when: HTMLElement; jump: HTMLButtonElement; note: HTMLElement; giants: HTMLElement;
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
      <p class="sub tp-giants" hidden></p>`;
    const q = <T extends HTMLElement>(c: string) => root.querySelector<T>(c)!;
    this.el = {
      title: q('.tp-title'), badge: q('.tp-badge'), intro: q('.tp-intro'), toLabel: q('.tp-to-label'), select: q('.tp-target'),
      facts: q('.tp-facts'), whenTitle: q('.tp-when-title'), when: q('.tp-when'), jump: q('.tp-jump'), note: q('.tp-note'),
      giants: q('.tp-giants'),
    };
    this.el.select.value = this.target;
    this.el.select.addEventListener('change', () => {
      this.target = this.el.select.value as PlanetId;
      this.render();
    });
    this.el.jump.addEventListener('click', () => {
      if (this.jumpMs !== null) this.onJump?.(this.jumpMs, this.target);
    });
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
    this.el.select.querySelectorAll('option').forEach((o) => { o.textContent = t().planets[o.value as PlanetId]; });
    this.shown = '';
    this.update();
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
    const name = t().planets[target];
    const kmS = (v: number) => nw(s.kmS(ltr(num(v, 2))));

    // The nearest window: one that began less than a day ago, or else the next
    const current = jd - a.prev < 1 ? a.prev : a.next;
    const days = trip.h.tofDays;
    const facts = [
      days < 730
        ? [s.duration, s.tripDays(ltr(numGrouped(days))), s.aboutMonths(ltr(num(days / 30.44, 1)))]
        : [s.duration, s.tripYears(ltr(num(days / 365.25, 1))), s.tripDays(ltr(numGrouped(days)))],
      [s.leave, kmS(trip.leave), s.leaveNote(ltr(numGrouped(PARKING_ALT_KM)), nw(s.c3(ltr(num(trip.c3, 2)))))],
      [s.arrive, kmS(trip.arrive), s.arriveNote(ltr(numGrouped(PARKING_ALT_KM)), name, kmS(trip.h.dv2))],
      [s.total, kmS(trip.total), ''],
    ];
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

    const html = facts.map(([label, value, note]) => `<div><dt>${label}</dt><dd><span class="tp-v">${value}</span>${note ? `<span class="tp-n">${note}</span>` : ''}</dd></div>`).join('')
      + '\u0000' + lines.map((l) => `<p>${l}</p>`).join('');
    if (html === this.shown) return;
    this.shown = html;
    const [f, w] = html.split('\u0000');
    this.el.facts.innerHTML = f;
    this.el.when.innerHTML = w;
    this.el.jump.hidden = !inRange;
    this.el.giants.hidden = !GIANTS.includes(target);
  }
}
