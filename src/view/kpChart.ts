// Column chart of the 3-hour Kp index: the last 3 days and the forecast, one bar per 3 hours.
// Colours carry storm level (NOAA G scale), always with a legend and a tooltip in words:
// below 5 no storm, 5-6 G1-G2, 7 and up G3+. Forecast bars are lighter and sit after the "now" line.
// Built with DOM calls (no innerHTML for data); sized to its box, redrawn when that changes.

import { gFromKp, type KpPoint } from '../live/spaceWeather';
import { clock, dateTime, num, t, weekdayDay } from '../i18n';

const SVG = 'http://www.w3.org/2000/svg';
const HOUR_MS = 3_600_000;
const BLOCK_MS = 3 * HOUR_MS;

export const KP_COLORS = { quiet: '#3987e5', storm: '#fab219', strong: '#d03b3b' };
export const kpClass = (kp: number): keyof typeof KP_COLORS => {
  const g = gFromKp(kp);
  return g === 0 ? 'quiet' : g <= 2 ? 'storm' : 'strong';
};

const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, parent?: Element) => {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};

/** A column with a rounded top (r) and a square foot. */
function columnPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export class KpChart {
  private points: KpPoint[] = [];
  private now = 0;
  private active = -1;
  private readonly box: HTMLElement;
  private readonly tip: HTMLDivElement;
  private svg: SVGSVGElement | null = null;
  private bars: SVGPathElement[] = [];
  private geom = { left: 0, band: 0, top: 0, plotH: 0 };

  constructor(box: HTMLElement) {
    this.box = box;
    this.box.setAttribute('dir', 'ltr'); // time runs left to right, as on the time bar
    this.tip = document.createElement('div');
    this.tip.className = 'kp-tip';
    this.tip.hidden = true;
    new ResizeObserver(() => this.draw()).observe(box);
  }

  set(points: KpPoint[], now: number) {
    this.points = points;
    this.now = now;
    this.draw();
  }

  private kindOf(p: KpPoint): string {
    const k = t().swKpKind;
    if (Date.parse(p.t) >= this.now) return k.predicted;
    return p.kind === 'observed' ? k.observed : k.estimated;
  }

  draw() {
    const width = this.box.clientWidth;
    if (!width || !this.points.length) return;
    const s = t();
    const height = 190;
    const m = { left: 26, right: 6, top: 22, bottom: 24 };
    const plotW = width - m.left - m.right, plotH = height - m.top - m.bottom;
    const n = this.points.length;
    const band = plotW / n;
    const barW = Math.max(2, Math.min(24, band - 2)); // 2px surface gap between bars
    const y = (kp: number) => m.top + plotH * (1 - kp / 9);
    this.geom = { left: m.left, band, top: m.top, plotH };

    const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'kp-svg', role: 'img', tabindex: 0 });
    svg.setAttribute('aria-label', `${s.swKpTitle}. ${s.swKpWhat}`);
    this.box.replaceChildren(svg, this.tip); // in the page first, so labels can be measured

    // Grid: hairlines at 0, 3, 6, 9, and the storm threshold at 5 with its label
    for (const v of [0, 3, 6, 9]) {
      el('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: v === 0 ? 'kp-base' : 'kp-grid' }, svg);
      const lab = el('text', { x: m.left - 6, y: y(v) + 4, class: 'kp-axis', 'text-anchor': 'end' }, svg);
      lab.textContent = String(v);
    }
    el('line', { x1: m.left, x2: width - m.right, y1: y(5), y2: y(5), class: 'kp-threshold' }, svg);
    const thr = el('text', { x: m.left - 6, y: y(5) + 4, class: 'kp-axis', 'text-anchor': 'end' }, svg);
    thr.textContent = '5';

    // Days: a tick where the local date changes, the day's name in the middle of its bars
    let dayStart = 0;
    const dayKey = (ms: number) => new Date(ms).toDateString();
    const labelDay = (from: number, to: number) => {
      const lab = el('text', { x: m.left + band * (from + to) / 2, y: height - 6, class: 'kp-axis', 'text-anchor': 'middle' }, svg);
      lab.textContent = weekdayDay(Date.parse(this.points[from].t));
      if (lab.getComputedTextLength() > (to - from) * band - 6) lab.remove(); // a day too short for its name
    };
    for (let i = 1; i <= n; i++) {
      if (i === n || dayKey(Date.parse(this.points[i].t)) !== dayKey(Date.parse(this.points[i - 1].t))) {
        labelDay(dayStart, i);
        if (i < n) el('line', { x1: m.left + band * i, x2: m.left + band * i, y1: m.top + plotH, y2: m.top + plotH + 5, class: 'kp-base' }, svg);
        dayStart = i;
      }
    }

    // Bars
    this.bars = this.points.map((p, i) => {
      const x = m.left + band * i + (band - barW) / 2;
      const h = Math.max(1, plotH * p.kp / 9);
      const future = Date.parse(p.t) >= this.now;
      return el('path', {
        d: columnPath(x, m.top + plotH - h, barW, h, barW >= 8 ? 4 : 2),
        fill: KP_COLORS[kpClass(p.kp)],
        class: future ? 'kp-bar kp-future' : 'kp-bar',
      }, svg);
    });

    // Now: a line, and "forecast" over the bars after it
    const nowIdx = this.points.findIndex((p) => Date.parse(p.t) + BLOCK_MS > this.now);
    if (nowIdx >= 0) {
      const frac = (this.now - Date.parse(this.points[nowIdx].t)) / BLOCK_MS;
      const xNow = m.left + band * (nowIdx + Math.min(1, Math.max(0, frac)));
      el('line', { x1: xNow, x2: xNow, y1: m.top - 4, y2: m.top + plotH, class: 'kp-now' }, svg);
      const nowLab = el('text', { x: xNow - 4, y: m.top - 8, class: 'kp-label', 'text-anchor': 'end' }, svg);
      nowLab.textContent = s.now;
      const fc = el('text', { x: xNow + 4, y: m.top - 8, class: 'kp-label kp-muted', 'text-anchor': 'start' }, svg);
      fc.textContent = `${s.swKpKind.predicted} →`;
    }

    // Hover, touch and keys: the nearest bar
    const pick = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      this.show(Math.floor((clientX - r.left - m.left) / band));
    };
    svg.addEventListener('pointermove', (e) => pick(e.clientX));
    svg.addEventListener('pointerdown', (e) => pick(e.clientX));
    svg.addEventListener('pointerleave', () => this.show(-1));
    svg.addEventListener('blur', () => this.show(-1));
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const start = this.active < 0 ? Math.max(0, nowIdx) : this.active;
      this.show(Math.min(n - 1, Math.max(0, start + (e.key === 'ArrowRight' ? 1 : -1))));
    });

    this.svg = svg;
    this.active = -1;
  }

  private show(i: number) {
    if (this.active >= 0) this.bars[this.active]?.classList.remove('kp-active');
    if (i < 0 || i >= this.points.length || !this.svg) { this.active = -1; this.tip.hidden = true; return; }
    this.active = i;
    this.bars[i].classList.add('kp-active');
    const p = this.points[i];
    const s = t();
    const g = gFromKp(p.kp);
    // Value first, then what it means and when
    this.tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = `Kp ${num(p.kp, 2)}`;
    const what = document.createElement('div');
    what.textContent = g ? `${s.swScale.g}: G${g} · ${s.swLevels[g]}` : s.swKpQuiet;
    const when = document.createElement('div');
    when.className = 'kp-tip-sub';
    const start = Date.parse(p.t);
    when.textContent = `${dateTime(start)}–${clock(start + BLOCK_MS)} · ${this.kindOf(p)}`;
    this.tip.append(strong, what, when);
    this.tip.hidden = false;
    const { left, band, top } = this.geom;
    const x = left + band * (i + 0.5);
    const w = this.tip.offsetWidth;
    this.tip.style.left = `${Math.min(this.box.clientWidth - w, Math.max(0, x - w / 2))}px`;
    this.tip.style.top = `${Math.max(0, top - 4)}px`;
  }
}
