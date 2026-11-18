// Line chart of the signal delay along a trip (phase 6, step 5): one way, from launch to arrival, with the
// stretches where the craft is near the Sun in the Earth's sky as light bands, the longest delay and the
// arrival labelled, and the time on screen as a line with a dot. One series, so no legend box: the card's
// title names it, and the bands are named on the chart. Hover, touch and the arrow keys (Shift: ten times
// as far) show the nearest day in a tooltip; every number is in the table under it as well.
// Built with DOM calls (no innerHTML for data); sized to its box, redrawn when that changes.

import { CONJUNCTION_DEG, type Signal, type SignalProfile } from '../transfer/signal';
import { dayMonthYear, num, numGrouped, t } from '../i18n';

const SVG = 'http://www.w3.org/2000/svg';
const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const jdToMs = (jd: number) => (jd - UNIX_EPOCH_JD) * DAY_MS;
/** The line: categorical slot 1 (blue) for a dark surface, checked with the dataviz validator against #151a2e. */
export const SIGNAL_COLOR = '#3987e5';
/** From this length on, the x axis counts years. */
const YEARS_FROM_DAYS = 1000;
/** Up to this many stretches near the Sun are drawn as bands; more, as marks along the top. */
const MAX_BANDS = 8, RUG_PX = 7;
/** From this longest delay on, the y axis counts hours [s]. */
const HOURS_FROM_S = 2 * 3600;

const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, parent?: Element) => {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};

/** A centred label's x, moved in so that its half-width `half` stays inside 0..width. */
const inside = (x: number, half: number, width: number) => Math.min(width - half, Math.max(half, x));

/** Clean tick steps (1, 2 or 5 × 10^k) for about `count` ticks from 0 to max. */
export function niceStep(max: number, count = 4): number {
  const raw = max / count, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export interface SignalText {
  /** A delay in words ("12.4 minutes", "4 hours 3 minutes", "25 seconds"). */
  delay: (seconds: number) => string;
  /** A distance from the Earth ("282 million km"). */
  distance: (km: number) => string;
}

export class SignalChart {
  private profile: SignalProfile | null = null;
  private text: SignalText | null = null;
  private nowDay: number | null = null;
  private active = -1;
  private readonly box: HTMLElement;
  private readonly tip: HTMLDivElement;
  private svg: SVGSVGElement | null = null;
  private geom = { x: (_d: number) => 0, y: (_s: number) => 0, top: 0, bottom: 0 };
  private cross: { line: SVGLineElement; dot: SVGCircleElement } | null = null;
  private now: { line: SVGLineElement; dot: SVGCircleElement; label: SVGTextElement } | null = null;

  constructor(box: HTMLElement) {
    this.box = box;
    this.box.setAttribute('dir', 'ltr'); // time runs left to right, as on the time bar
    this.tip = document.createElement('div');
    this.tip.className = 'kp-tip';
    this.tip.hidden = true;
    new ResizeObserver(() => this.draw()).observe(box);
  }

  set(profile: SignalProfile | null, text: SignalText) {
    this.profile = profile;
    this.text = text;
    this.draw();
  }

  /** The time on screen as a day of the trip, or null when it is outside the trip. */
  setNow(day: number | null) {
    if (day === this.nowDay) return;
    this.nowDay = day;
    this.placeNow();
  }

  draw() {
    const width = this.box.clientWidth, p = this.profile, text = this.text;
    if (!width || !p || !text) { this.box.replaceChildren(); this.svg = null; return; }
    const s = t().trip;
    const height = 180;
    const m = { left: 34, right: 12, top: 26, bottom: 24 };
    const plotW = width - m.left - m.right, plotH = height - m.top - m.bottom;
    const tof = p.arrival.day;
    const years = tof > YEARS_FROM_DAYS, hours = p.max.seconds >= HOURS_FROM_S;
    const xUnit = years ? 365.25 : 1, yUnit = hours ? 3600 : 60;
    const yMaxUnits = (p.max.seconds / yUnit) * 1.08;
    const yStep = niceStep(yMaxUnits), yTop = Math.ceil(yMaxUnits / yStep) * yStep;
    const x = (day: number) => m.left + (plotW * day) / tof;
    const y = (sec: number) => m.top + plotH * (1 - sec / yUnit / yTop);
    this.geom = { x, y, top: m.top, bottom: m.top + plotH };

    const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'kp-svg', role: 'img', tabindex: 0 });
    svg.setAttribute('aria-label', `${s.sigAria}. ${s.sigArrive(text.delay(p.arrival.seconds), text.delay(2 * p.arrival.seconds))}`);
    this.box.replaceChildren(svg, this.tip); // in the page first, so labels can be measured

    // The stretches near the Sun: light bands over the whole height (at least 3px, so a short one shows on a long
    // trip); past a few of them, short marks along the top instead, or the bands would stripe the whole chart
    let named = false;
    const rug = p.conjunctions.length > MAX_BANDS;
    for (const c of p.conjunctions) {
      const x0 = x(c.from - p.samples[0].jd), x1 = x(c.to - p.samples[0].jd);
      const w = Math.max(rug ? 2 : 3, x1 - x0), cx = (x0 + x1) / 2;
      el('rect', { x: cx - w / 2, y: m.top, width: w, height: rug ? RUG_PX : plotH, class: rug ? 'sig-sun sig-rug' : 'sig-sun' }, svg);
      if (!named) { // its name once, over the first band, if it fits there
        const lab = el('text', { x: cx, y: m.top - 6, class: 'kp-axis', 'text-anchor': 'middle' }, svg);
        lab.textContent = s.sigSun;
        lab.setAttribute('x', String(inside(cx, lab.getComputedTextLength() / 2, width)));
        named = true;
      }
    }

    // Grid and axes: hairlines at clean values, the baseline a step stronger
    for (let v = 0; v <= yTop + 1e-9; v += yStep) {
      el('line', { x1: m.left, x2: width - m.right, y1: y(v * yUnit), y2: y(v * yUnit), class: v === 0 ? 'kp-base' : 'kp-grid' }, svg);
      const lab = el('text', { x: m.left - 6, y: y(v * yUnit) + 4, class: 'kp-axis', 'text-anchor': 'end' }, svg);
      lab.textContent = num(v, yStep < 1 ? 1 : 0);
    }
    const xMax = tof / xUnit, xStep = niceStep(xMax, Math.max(2, Math.floor(plotW / 60)));
    for (let v = 0; v <= xMax + 1e-9; v += xStep) {
      const px = x(v * xUnit);
      el('line', { x1: px, x2: px, y1: m.top + plotH, y2: m.top + plotH + 4, class: 'kp-base' }, svg);
      const lab = el('text', { x: px, y: height - 6, class: 'kp-axis', 'text-anchor': 'middle' }, svg);
      lab.textContent = num(v, xStep < 1 ? 1 : 0);
    }

    // The line, with a faint wash under it
    const pts = p.samples.map((q) => `${x(q.day).toFixed(1)},${y(q.seconds).toFixed(1)}`);
    el('path', { d: `M${x(0)},${y(0)}L${pts.join('L')}L${x(tof)},${y(0)}Z`, class: 'sig-area', fill: SIGNAL_COLOR }, svg);
    el('path', { d: `M${pts.join('L')}`, class: 'sig-line', stroke: SIGNAL_COLOR }, svg);

    // Labels: the longest delay and the arrival (once, if they are the same or too close to tell apart)
    const mark = (q: Signal, anchor: 'start' | 'middle' | 'end') => {
      el('circle', { cx: x(q.day), cy: y(q.seconds), r: 4, class: 'sig-dot', fill: SIGNAL_COLOR }, svg);
      const lab = el('text', { x: x(q.day), y: y(q.seconds) - 9, class: 'kp-label', 'text-anchor': anchor }, svg);
      lab.textContent = num(q.seconds / yUnit, 1); // in the axis' unit, which the axis title names
      if (anchor === 'middle') lab.setAttribute('x', String(inside(x(q.day), lab.getComputedTextLength() / 2, width)));
      return lab;
    };
    const endLab = mark(p.arrival, 'end');
    if (x(p.arrival.day) - x(p.max.day) > 8) {
      const maxLab = mark(p.max, 'middle');
      const a = maxLab.getBBox(), b = endLab.getBBox();
      if (a.x + a.width + 6 > b.x && a.y + a.height > b.y && b.y + b.height > a.y) maxLab.remove(); // the end label wins
    }

    // The time on screen, and the crosshair (both placed later)
    const nowLine = el('line', { x1: 0, x2: 0, y1: m.top - 2, y2: m.top + plotH, class: 'kp-now' }, svg);
    const nowDot = el('circle', { cx: 0, cy: 0, r: 4, class: 'sig-dot sig-now', fill: '#e8e8f0' }, svg);
    const nowLab = el('text', { x: 0, y: m.top - 6, class: 'kp-label', 'text-anchor': 'middle' }, svg);
    nowLab.textContent = t().now;
    this.now = { line: nowLine, dot: nowDot, label: nowLab };
    const crossLine = el('line', { x1: 0, x2: 0, y1: m.top, y2: m.top + plotH, class: 'kp-now sig-cross' }, svg);
    const crossDot = el('circle', { cx: 0, cy: 0, r: 4, class: 'sig-dot', fill: SIGNAL_COLOR }, svg);
    this.cross = { line: crossLine, dot: crossDot };
    this.svg = svg;
    this.placeNow();

    // Hover, touch and keys: the nearest sample
    const n = p.samples.length;
    const pick = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      const day = ((clientX - r.left - m.left) / plotW) * tof;
      this.show(Math.round(Math.min(1, Math.max(0, day / tof)) * (n - 1)));
    };
    svg.addEventListener('pointermove', (e) => pick(e.clientX));
    svg.addEventListener('pointerdown', (e) => pick(e.clientX));
    svg.addEventListener('pointerleave', () => this.show(-1));
    svg.addEventListener('blur', () => this.show(-1));
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const start = this.active >= 0 ? this.active
        : this.nowDay !== null ? Math.round((this.nowDay / tof) * (n - 1)) : 0;
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowRight' ? 1 : -1);
      this.show(Math.min(n - 1, Math.max(0, (this.active < 0 ? start : start + step))));
    });
    this.active = -1;
    this.show(-1);
  }

  private placeNow() {
    const o = this.now, p = this.profile;
    if (!o || !p) return;
    const day = this.nowDay;
    const on = day !== null && day >= 0 && day <= p.arrival.day;
    for (const e of [o.line, o.dot, o.label]) e.style.display = on ? '' : 'none';
    if (!on) return;
    // The delay at that moment, between the samples round it
    const i = Math.min(p.samples.length - 2, Math.floor((day / p.arrival.day) * (p.samples.length - 1)));
    const a = p.samples[i], b = p.samples[i + 1];
    const f = b.day > a.day ? (day - a.day) / (b.day - a.day) : 0;
    const sec = a.seconds + (b.seconds - a.seconds) * f;
    const px = this.geom.x(day);
    o.line.setAttribute('x1', String(px)); o.line.setAttribute('x2', String(px));
    o.dot.setAttribute('cx', String(px)); o.dot.setAttribute('cy', String(this.geom.y(sec)));
    o.label.setAttribute('x', String(inside(px, o.label.getComputedTextLength() / 2, this.box.clientWidth)));
  }

  private show(i: number) {
    const p = this.profile, text = this.text, c = this.cross;
    if (!p || !text || !c || i < 0 || i >= p.samples.length || !this.svg) {
      this.active = -1;
      this.tip.hidden = true;
      if (c) { c.line.style.display = 'none'; c.dot.style.display = 'none'; }
      return;
    }
    this.active = i;
    const q = p.samples[i];
    const s = t().trip;
    const px = this.geom.x(q.day), py = this.geom.y(q.seconds);
    c.line.style.display = ''; c.dot.style.display = '';
    c.line.setAttribute('x1', String(px)); c.line.setAttribute('x2', String(px));
    c.dot.setAttribute('cx', String(px)); c.dot.setAttribute('cy', String(py));
    // Value first, then when and how far
    this.tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = text.delay(q.seconds);
    const when = document.createElement('div');
    when.textContent = `${dayMonthYear(jdToMs(q.jd), undefined, 'UTC')} · ${s.sigDay(numGrouped(Math.round(q.day)))}`;
    const far = document.createElement('div');
    far.className = 'kp-tip-sub';
    far.textContent = text.distance(q.km);
    this.tip.append(strong, when, far);
    if (q.sepDeg < CONJUNCTION_DEG) {
      const sun = document.createElement('div');
      sun.className = 'kp-tip-sub';
      sun.textContent = `${s.sigSun} (${num(q.sepDeg, 1)}°)`;
      this.tip.append(sun);
    }
    this.tip.dir = document.documentElement.dir; // the words in the page's direction
    this.tip.hidden = false;
    const w = this.tip.offsetWidth;
    this.tip.style.left = `${Math.min(this.box.clientWidth - w, Math.max(0, px - w / 2))}px`;
    this.tip.style.top = `${Math.max(0, this.geom.top - 4)}px`;
  }
}
