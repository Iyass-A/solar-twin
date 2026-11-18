// Trip planner (phase 6): a card under "branch reality". Step 1: the Hohmann transfer from the Earth to a
// planet (src/transfer/hohmann.ts): how long the trip takes, the two burns, and the launch window next to
// the time on screen, with a button that goes there. Step 2: the exact trip for two dates the visitor picks
// (Lambert's problem on the real orbits, src/transfer/lambert.ts), starting from that window's dates.
// Step 3: the porkchop map of launch dates round that window (src/transfer/porkchop.ts, drawn by
// src/view/porkchopMap.ts), worked out a few rows at a time once the card is in view; once it is done, the
// exact trip moves to the cheapest one, unless the visitor has already picked dates.
// Step 4: the exact trip in the views (frame(), drawn by src/view/orrery.ts and scene3d.ts): its path round the
// Sun, flown from its start with the universal-variable propagator, and a button that runs time from launch to
// arrival, so the craft can be watched on its way; time stops when it arrives.
// Step 5: the signal delay on the way (src/transfer/signal.ts, drawn by src/view/signalChart.ts): how long a
// message between the Earth and the craft takes on each day, the longest, at arrival and at the time on screen,
// and when the craft is too close to the Sun in the Earth's sky for commands; the delay also rides next to the craft.

import { PARKING_ALT_KM, TARGETS, leadAngle, tripTo, windows, type Trip } from '../transfer/hohmann';
import { planetState, realTrip, type RealTrip, type Vec } from '../transfer/lambert';
import { propagate } from '../physics/orbit';
import { AU_KM, SUN_GM } from '../physics/bodies';
import { COLORS, type TripPathFrame } from './views';
import type { Vec3 } from '../astro/kepler';
import { cheapest, nearHalfTurn, onEdge, porkchopRange, porkchopStepper, type Measure, type Porkchop } from '../transfer/porkchop';
import { BAND_COLORS, PorkchopMap, type Pick } from './porkchopMap';
import { toJulianDate } from '../astro/julian';
import type { PlanetId } from '../astro/elements';
import { t, num, numGrouped, dayMonthYear, dayMonthYearRange } from '../i18n';
import { signalAt, signalProfile, type Conjunction, type SignalProfile } from '../transfer/signal';
import { SignalChart, type SignalText } from './signalChart';

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const jdToMs = (jd: number) => (jd - UNIX_EPOCH_JD) * DAY_MS;
const GIANTS: PlanetId[] = ['jupiter', 'saturn', 'uranus', 'neptune'];
const DAY_S = 86400;
/** Points along a trip's path in the views. */
const PATH_POINTS = 240;
const au = (r: readonly number[]): Vec3 => ({ x: r[0] / AU_KM, y: r[1] / AU_KM, z: r[2] / AU_KM });
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
  /** Called to run a trip in the views: from its launch date, at a speed fitting its length, the target picked. */
  onPlay: ((departMs: number, tofDays: number, target: PlanetId) => void) | null = null;
  /** Called when a trip being run reaches its arrival (the page stops time there). */
  onArrive: ((ms: number) => void) | null = null;

  private target: PlanetId = 'mars';
  // The windows around the time on screen, kept while that time stays between them
  private around: { target: PlanetId; prev: number; next: number; trip: Trip } | null = null;
  private jumpMs: number | null = null;
  private shown = '';
  // The exact trip: its two dates (UTC midnight), the target they were set for, and its result
  private exact: { target: PlanetId; depart: number; arrive: number; trip: RealTrip | null } | null = null;
  private exactShown = '';
  private readonly clock: () => { ms: number; min: number; max: number };
  // The porkchop map: which window it is for, the grid (once done), what it is coloured by, the cheapest trips
  private chart: { key: string; map: Porkchop | null } | null = null;
  private chartGen = 0;
  private measure: Measure = 'c3';
  private best: Partial<Record<1 | 2, RealTrip>> = {};
  /** The visitor chose the exact trip's dates for this planet (on the map, in the fields, or with a button). */
  private picked = false;
  private visible = false;
  private readonly porkMap: PorkchopMap;
  // The exact trip in the views: whether to show it, its path (for the trip it was worked out for), and a run in progress
  private showPath = false;
  private path: { trip: RealTrip; points: Vec3[]; arrive: Vec3 } | null = null;
  private running = false;
  // Step 5: the signal delay along the exact trip, worked out once per trip
  private signal: { trip: RealTrip; profile: SignalProfile } | null = null;
  private readonly sigChart: SignalChart;
  private sigShown = '';

  private readonly el: {
    title: HTMLElement; badge: HTMLElement; intro: HTMLElement; toLabel: HTMLElement; select: HTMLSelectElement;
    facts: HTMLElement; whenTitle: HTMLElement; when: HTMLElement; jump: HTMLButtonElement; note: HTMLElement; giants: HTMLElement;
    exactTitle: HTMLElement; exactIntro: HTMLElement; departLabel: HTMLElement; arriveLabel: HTMLElement;
    depart: HTMLInputElement; arrive: HTMLInputElement; exactFacts: HTMLElement; exactLines: HTMLElement;
    mapTitle: HTMLElement; mapIntro: HTMLElement; colorBy: HTMLElement; measure: HTMLSelectElement; axisY: HTMLElement;
    axisX: HTMLElement; legend: HTMLElement; marks: HTMLElement; status: HTMLElement; best: HTMLElement;
    play: HTMLButtonElement; show: HTMLInputElement; showText: HTMLElement; playNote: HTMLElement;
    sig: HTMLElement; sigTitle: HTMLElement; sigIntro: HTMLElement; sigUnit: HTMLElement; sigAxis: HTMLElement;
    sigLines: HTMLElement; sigTable: HTMLElement; sigSummary: HTMLElement;
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
      <h3 class="tp-map-title"></h3>
      <p class="sub tp-map-intro"></p>
      <div class="row"><label><span class="tp-colorby"></span> <select class="tp-measure">
        <option value="c3"></option><option value="dv"></option>
      </select></label></div>
      <div class="sub tp-axis-y" dir="ltr"><span dir="auto"></span></div>
      <div class="tp-map"></div>
      <div class="sub tp-axis-x"></div>
      <div class="tp-legend"></div>
      <p class="sub tp-marks"></p>
      <p class="sub tp-map-status" hidden></p>
      <div class="tp-when tp-best"></div>
      <h3 class="tp-exact-title"></h3>
      <p class="sub tp-exact-intro"></p>
      <div class="row tp-dates">
        <label><span class="tp-depart-label"></span> <input class="tp-depart" type="date" dir="ltr" min="${FIRST_DAY}" max="${LAST_DAY}"></label>
        <label><span class="tp-arrive-label"></span> <input class="tp-arrive" type="date" dir="ltr" min="${FIRST_DAY}" max="${LAST_DAY}"></label>
      </div>
      <dl class="tp-facts tp-exact-facts"></dl>
      <div class="tp-when tp-exact-lines"></div>
      <div class="row tp-run">
        <button type="button" class="tp-play"></button>
        <label class="check"><input type="checkbox" class="tp-show"> <span class="tp-show-text"></span></label>
      </div>
      <p class="sub tp-play-note"></p>
      <div class="tp-sig">
        <h3 class="tp-sig-title"></h3>
        <p class="sub tp-sig-intro"></p>
        <div class="sub tp-axis-y tp-sig-unit" dir="ltr"><span dir="auto"></span></div>
        <div class="tp-sig-chart"></div>
        <div class="sub tp-axis-x tp-sig-axis"></div>
        <div class="tp-when tp-sig-lines"></div>
        <details class="sw-table tp-sig-table"><summary></summary><div></div></details>
      </div>`;
    const q = <T extends HTMLElement>(c: string) => root.querySelector<T>(c)!;
    this.el = {
      title: q('.tp-title'), badge: q('.tp-badge'), intro: q('.tp-intro'), toLabel: q('.tp-to-label'), select: q('.tp-target'),
      facts: q('.tp-facts'), whenTitle: q('.tp-when-title'), when: q('.tp-when'), jump: q('.tp-jump'), note: q('.tp-note'),
      giants: q('.tp-giants'),
      exactTitle: q('.tp-exact-title'), exactIntro: q('.tp-exact-intro'), departLabel: q('.tp-depart-label'),
      arriveLabel: q('.tp-arrive-label'), depart: q('.tp-depart'), arrive: q('.tp-arrive'),
      exactFacts: q('.tp-exact-facts'), exactLines: q('.tp-exact-lines'),
      mapTitle: q('.tp-map-title'), mapIntro: q('.tp-map-intro'), colorBy: q('.tp-colorby'), measure: q('.tp-measure'),
      axisY: q('.tp-axis-y span'), axisX: q('.tp-axis-x'), legend: q('.tp-legend'), marks: q('.tp-marks'),
      status: q('.tp-map-status'), best: q('.tp-best'),
      play: q('.tp-play'), show: q('.tp-show'), showText: q('.tp-show-text'), playNote: q('.tp-play-note'),
      sig: q('.tp-sig'), sigTitle: q('.tp-sig-title'), sigIntro: q('.tp-sig-intro'), sigUnit: q('.tp-sig-unit span'),
      sigAxis: q('.tp-sig-axis'), sigLines: q('.tp-sig-lines'), sigTable: q('.tp-sig-table div'), sigSummary: q('.tp-sig-table summary'),
    };
    this.sigChart = new SignalChart(q('.tp-sig-chart'));
    this.el.show.addEventListener('change', () => { this.showPath = this.el.show.checked; });
    this.el.play.addEventListener('click', () => {
      const tr = this.exact?.trip;
      if (!tr) return;
      this.picked = true; // the trip being run stays, whatever the map finds as time moves on
      this.showPath = this.el.show.checked = true;
      this.running = true;
      this.onPlay?.(jdToMs(tr.departJd), tr.tofDays, tr.target);
    });
    this.porkMap = new PorkchopMap(q('.tp-map'));
    this.porkMap.onPick = (p) => {
      this.picked = true;
      this.setExact(this.target, jdToMs(p.departJd), jdToMs(p.arriveJd));
    };
    this.el.measure.addEventListener('change', () => {
      this.measure = this.el.measure.value as Measure;
      this.refreshBest();
      if (!this.picked) this.exactToCheapest();
      this.renderMap();
    });
    this.el.best.addEventListener('click', (e) => {
      const type = Number((e.target as HTMLElement).closest<HTMLButtonElement>('button[data-type]')?.dataset.type);
      const b = this.best[type as 1 | 2];
      if (!b) return;
      this.picked = true;
      this.setExactFrom(b);
    });
    // The map is worked out only once the card comes into view
    new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      if (this.visible) this.update();
    }, { rootMargin: '300px' }).observe(root);
    this.el.select.value = this.target;
    this.el.select.addEventListener('change', () => {
      this.target = this.el.select.value as PlanetId;
      this.picked = false;
      this.render();
    });
    this.el.jump.addEventListener('click', () => {
      if (this.jumpMs !== null) this.onJump?.(this.jumpMs, this.target);
    });
    for (const input of [this.el.depart, this.el.arrive]) {
      input.addEventListener('change', () => {
        const d = this.el.depart.valueAsNumber, a = this.el.arrive.valueAsNumber;
        if (Number.isNaN(d) || Number.isNaN(a)) return;
        this.picked = true;
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

  /** The exact trip on a found trip's dates, each rounded to the nearest whole day (UTC midnight). */
  private setExactFrom(b: RealTrip) {
    this.setExact(b.target, dayMs(jdToMs(b.departJd)), dayMs(jdToMs(b.arriveJd)));
  }

  private exactToCheapest() {
    const c = [this.best[1], this.best[2]].filter((b): b is RealTrip => !!b)
      .sort((p, q) => (this.measure === 'c3' ? p.c3 - q.c3 : p.total - q.total))[0];
    if (c) this.setExactFrom(c);
  }

  private refreshBest() {
    const map = this.chart?.map;
    this.best = map ? { 1: cheapest(map, this.measure, 1) ?? undefined, 2: cheapest(map, this.measure, 2) ?? undefined } : {};
  }

  /** Starts working out the map for a window, a few rows each time the page is idle. */
  private startMap(key: string, jd: number) {
    const gen = ++this.chartGen;
    this.chart = { key, map: null };
    this.best = {};
    const { map, step } = porkchopStepper(porkchopRange(this.target, jd));
    const tick = () => {
      if (gen !== this.chartGen) return; // another planet or window since
      if (!step(12)) { setTimeout(tick, 0); return; }
      this.chart = { key, map };
      this.refreshBest();
      if (!this.picked) this.exactToCheapest();
      this.renderMap();
    };
    setTimeout(tick, 0);
    this.renderMap();
  }

  private renderMap() {
    const s = t().trip;
    const map = this.chart?.map ?? null;
    this.el.status.hidden = !!map;
    this.el.status.textContent = s.computing;
    this.porkMap.set(map, this.measure, this.best, this.selection());
    const years = !!map && map.tof0 + (map.ny - 1) * map.tofStep > 1000;
    this.el.axisY.textContent = map ? (years ? s.axisYears : s.axisDays) : '';
    this.el.axisX.textContent = map ? s.axisDepart : '';

    // Legend: the bands from cheap to dear, with where each begins and ends
    const edges = this.porkMap.bands, fmt = (v: number) => num(v, v >= 10 ? 0 : 1);
    const swatches = map ? BAND_COLORS.slice(0, edges.length + 1).map((c, k) => {
      const label = k === 0 ? `&lt; ${fmt(edges[0])}` : k === edges.length ? `&gt; ${fmt(edges[k - 1])}` : `${fmt(edges[k - 1])}–${fmt(edges[k])}`;
      return `<span class="tp-sw"><i style="background:${c}"></i><span dir="ltr">${label}</span></span>`;
    }).join('') : '';
    this.el.legend.innerHTML = map
      ? `<span class="tp-legend-title">${s.measures[this.measure]} · ${s.units[this.measure]}</span> <span class="tp-end">${s.cheaper}</span>${swatches}<span class="tp-end">${s.dearer}</span>`
      : '';
    this.el.marks.hidden = !map;

    // The cheapest trip of each type, with a button that works it out below
    // Dates rounded to whole days, as the button puts them in the fields
    const date = (ms: number) => `<bdi>${dayMonthYear(ms, undefined, 'UTC')}</bdi>`;
    const kmS = (v: number) => nw(s.kmS(ltr(num(v, 2))));
    this.el.best.innerHTML = ([1, 2] as const).filter((k) => this.best[k]).map((k) => {
      const b = this.best[k]!;
      const d = dayMs(jdToMs(b.departJd)), a = dayMs(jdToMs(b.arriveJd)), days = (a - d) / DAY_MS;
      const dur = days < 730 ? s.tripDays(ltr(numGrouped(days))) : s.tripYears(ltr(num(days / 365.25, 1)));
      const value = this.measure === 'c3' ? nw(s.c3(ltr(num(b.c3, 2)))) : `${s.total} ${kmS(b.total)}`;
      const edge = map && onEdge(map, b) ? ` ${s.edge}` : '';
      return `<p>${s.best(k, date(d), date(a), dur, value)}${edge} <button type="button" class="tp-pick" data-type="${k}">${s.pick}</button></p>`;
    }).join('');
  }

  /** The exact trip as a point on the map. */
  private selection(): Pick | null {
    const x = this.exact;
    if (!x?.trip || x.target !== this.target) return null;
    return { departJd: toJulianDate(new Date(x.depart)), arriveJd: toJulianDate(new Date(x.arrive)) };
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
      if (nearHalfTurn(r.angleDeg)) lines.push(s.nearHalf);
    }
    // The trip can be run from its launch day if that day is on the time bar
    const { min, max } = this.clock();
    this.el.play.disabled = !(x.trip && x.depart >= min && x.depart <= max);
    this.porkMap.setSelected(this.selection());
    this.renderSignal();
    const html = facts + '\u0000' + lines.map((l) => `<p>${l}</p>`).join('');
    if (html === this.exactShown) return;
    this.exactShown = html;
    this.el.exactFacts.innerHTML = facts;
    this.el.exactFacts.hidden = !facts;
    this.el.exactLines.innerHTML = html.split('\u0000')[1];
  }

  /** The signal delay along the exact trip: the chart (when the trip changes), its lines and table, and the time on screen. */
  private renderSignal(redraw = false) {
    const tr = this.exact?.trip ?? null;
    this.el.sig.hidden = !tr;
    if (!tr) { this.signal = null; this.sigShown = ''; return; }
    const s = t().trip;
    if (this.signal?.trip !== tr) { this.signal = { trip: tr, profile: signalProfile(tr) }; redraw = true; }
    const p = this.signal.profile, tof = p.arrival.day;
    if (redraw) {
      this.sigChart.set(p, SIGNAL_TEXT);
      this.el.sigUnit.textContent = p.max.seconds >= 2 * 3600 ? s.sigUnitHours : s.sigUnitMin;
      this.el.sigAxis.textContent = tof > 1000 ? s.sigAxisYears : s.sigAxisDays;
      this.el.sigTable.innerHTML = signalTable(p);
    }
    // The time on screen as a day of the trip
    const jd = toJulianDate(new Date(this.clock().ms));
    const day = jd - tr.departJd;
    const on = day >= 0 && day <= tof;
    this.sigChart.setNow(on ? day : null);

    const date = (wjd: number) => `<bdi>${dayMonthYear(jdToMs(wjd), undefined, 'UTC')}</bdi>`;
    const dayNo = (d: number) => ltr(numGrouped(Math.floor(d)));
    const lines = [s.sigArrive(nw(delayText(p.arrival.seconds)), nw(delayText(2 * p.arrival.seconds)))];
    if (tof - p.max.day > 1) lines.push(s.sigMax(nw(delayText(p.max.seconds)), date(p.max.jd), dayNo(p.max.day)));
    else lines[0] += ` ${s.sigMaxAtEnd}`;
    // The stretches near the Sun: all of them up to three, or else the first and the last and how far apart
    const cs = p.conjunctions, span = (c: Conjunction) => `<bdi>${dayMonthYearRange(jdToMs(c.from), jdToMs(c.to), undefined, 'UTC')}</bdi>`;
    lines.push(!cs.length ? s.sigNoConj
      : cs.length <= 3 ? s.sigConj(cs.length, cs.map(span).join(s.sigJoin))
        : s.sigConjMany(cs.length, Math.round((cs[cs.length - 1].from - cs[0].from) / (cs.length - 1) / 30.44), span(cs[0]), span(cs[cs.length - 1])));
    if (on) lines.push(s.sigNow(dayNo(day), nw(delayText(signalAt(tr, jd).seconds))));
    const html = lines.map((l) => `<p>${l}</p>`).join('');
    if (html === this.sigShown) return;
    this.sigShown = html;
    this.el.sigLines.innerHTML = html;
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
    this.el.mapTitle.textContent = s.mapTitle;
    this.el.mapIntro.textContent = s.mapIntro;
    this.el.colorBy.textContent = s.colorBy;
    this.el.measure.querySelectorAll('option').forEach((o) => { o.textContent = s.measures[o.value as Measure]; });
    this.el.marks.textContent = s.marks;
    this.el.play.textContent = s.playTrip;
    this.el.showText.textContent = s.showPath;
    this.el.playNote.textContent = s.playNote;
    this.el.sigTitle.textContent = s.sigTitle;
    this.el.sigIntro.textContent = s.sigIntro;
    this.el.sigSummary.textContent = s.sigTable;
    this.el.select.querySelectorAll('option').forEach((o) => { o.textContent = t().planets[o.value as PlanetId]; });
    this.shown = '';
    this.exactShown = '';
    this.update();
    this.renderExact();
    this.renderSignal(true);
    this.renderMap();
  }

  /**
   * The exact trip as the views draw it at the time on screen, or null when it is not to be shown. While a trip
   * is being run (playing is the page's clock), its arrival stops time there.
   */
  frame(ms: number, playing: boolean): TripPathFrame | null {
    if (!playing) this.running = false;
    const x = this.exact, tr = x?.trip;
    if (!x || !tr || x.target !== this.target) return null;
    const jd = toJulianDate(new Date(ms));
    const done = (jd - tr.departJd) / tr.tofDays;
    if (this.running && done >= 1) { // (even with the path hidden)
      this.running = false;
      this.onArrive?.(jdToMs(tr.arriveJd));
    }
    if (!this.showPath) return null;
    if (this.path?.trip !== tr) {
      // The path, flown from its start round the Sun (Lambert's orbit, so it ends at the target)
      const points: Vec3[] = [];
      for (let i = 0; i <= PATH_POINTS; i++) points.push(au(propagate(SUN_GM, tr.r1, tr.v1, (tr.tofDays * DAY_S * i) / PATH_POINTS).r));
      this.path = { trip: tr, points, arrive: au(planetState(tr.target, tr.arriveJd).r) };
    }
    const on = done >= 0 && done <= 1;
    return {
      path: this.path.points, done: Math.min(1, Math.max(0, done)),
      depart: au(tr.r1 as Vec), arrive: this.path.arrive,
      craft: on ? au(propagate(SUN_GM, tr.r1, tr.v1, (jd - tr.departJd) * DAY_S).r) : null,
      label: on ? t().trip.craftDelay(t().trip.craft, delayText(signalAt(tr, jd).seconds)) : t().trip.craft, departColor: COLORS.earth, arriveColor: COLORS[tr.target],
    };
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
    // The map for this window, once the card is in view
    const key = `${target}:${current.toFixed(2)}`;
    if (this.visible && this.chart?.key !== key) this.startMap(key, jd);
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

    this.renderSignal();
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

/** A delay in words: whole seconds under a minute, then minutes (one decimal), then hours and minutes. */
export function delayText(seconds: number): string {
  return seconds < 59.5 ? t().trip.seconds(Math.round(seconds)) : t().light(seconds / 60);
}

/** A distance from the Earth: km, million km, or au from a thousand million km on. */
export function distanceText(km: number): string {
  const s = t();
  if (km < 1e6) return `${numGrouped(km)} ${s.km}`;
  if (km < 1e9) return `${num(km / 1e6, km < 1e7 ? 1 : 0)} ${s.millionKm}`;
  return `${num(km / AU_KM, 2)} ${s.au}`;
}

const SIGNAL_TEXT: SignalText = { delay: delayText, distance: distanceText };

/** The chart's numbers as a table: thirteen days evenly along the trip, launch and arrival included. */
function signalTable(p: SignalProfile): string {
  const s = t().trip, c = s.sigCols, n = p.samples.length - 1;
  const rows = Array.from({ length: 13 }, (_, k) => p.samples[Math.round((k * n) / 12)]).map((q) =>
    `<tr><td><bdi>${dayMonthYear(jdToMs(q.jd), undefined, 'UTC')}</bdi></td><td>${ltr(numGrouped(Math.round(q.day)))}</td>`
    + `<td>${nw(distanceText(q.km))}</td><td>${nw(delayText(q.seconds))}</td>`
    + `<td>${Number.isFinite(q.sepDeg) ? ltr(`${num(q.sepDeg, 1)}°`) : '–'}</td></tr>`).join('');
  return `<table><thead><tr><th>${c.date}</th><th>${c.day}</th><th>${c.distance}</th><th>${c.delay}</th><th>${c.sun}</th></tr></thead><tbody>${rows}</tbody></table>`;
}
