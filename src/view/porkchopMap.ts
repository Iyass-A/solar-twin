// The porkchop map of the trip planner (phase 6, step 3), drawn on a canvas: launch day across, time on the way
// up, colour by cost in bands of one blue (sequential, validated with the dataviz skill's validator for the dark
// card: light is cheap, the dark end clears 2:1 against the card). Values between grid points are interpolated,
// so the band edges are smooth. A dashed line separates type I (below) from type II (above), for a planet (to an
// asteroid or comet, whole turns round the Sun cut the map into a mosaic, and the tooltip names them). Markers: the
// cheapest trip of each type, the Hohmann estimate, and the trip worked out below (a white circle). Hover or tap
// shows a tooltip; a click, a tap or the arrow keys pick a trip. Time runs left to right, as on the time bar.

import { bandEdges, kindsOf, mapMin, type Measure, type Porkchop } from '../transfer/porkchop';
import type { RealTrip } from '../transfer/lambert';
import { t, num, langInfo, dayMonthYear, lang, LANGS } from '../i18n';

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const jdToMs = (jd: number) => (jd - UNIX_EPOCH_JD) * DAY_MS;

/** Cheap to dear: blue 100, 200, 300, 400, 500, 600 of the dataviz palette; then "off the scale" and no path. */
export const BAND_COLORS = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
const BEYOND = '#1d2340';
const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const BAND_RGB = BAND_COLORS.map(rgb);
const BEYOND_RGB = rgb(BEYOND);

export interface Pick { departJd: number; arriveJd: number }

export class PorkchopMap {
  /** A trip was picked on the map (whole days). */
  onPick: ((p: Pick) => void) | null = null;

  private map: Porkchop | null = null;
  private measure: Measure = 'c3';
  private best: Partial<Record<1 | 2, RealTrip>> = {};
  private selected: Pick | null = null;
  private edges: number[] = [];
  private readonly box: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLDivElement;
  private geom = { left: 0, top: 0, pw: 0, ph: 0 };
  private heat: { key: string; image: HTMLCanvasElement } | null = null;

  constructor(box: HTMLElement) {
    this.box = box;
    box.setAttribute('dir', 'ltr'); // time runs left to right, as on the time bar
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tp-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.tip = document.createElement('div');
    this.tip.className = 'kp-tip tp-tip';
    this.tip.hidden = true;
    box.replaceChildren(this.canvas, this.tip);
    new ResizeObserver(() => this.draw()).observe(box);
    this.canvas.addEventListener('pointermove', (e) => this.hover(e));
    this.canvas.addEventListener('pointerleave', () => { this.tip.hidden = true; });
    this.canvas.addEventListener('click', (e) => {
      const p = this.at(e);
      if (p) { this.onPick?.(p); this.hover(e); }
    });
    this.canvas.addEventListener('keydown', (e) => this.key(e));
  }

  /** The map, what it is coloured by, the cheapest trips, and the trip worked out below. */
  set(map: Porkchop | null, measure: Measure, best: Partial<Record<1 | 2, RealTrip>>, selected: Pick | null) {
    this.map = map;
    this.measure = measure;
    this.best = best;
    this.selected = selected;
    this.edges = map ? bandEdges(mapMin(map, measure)) : [];
    this.draw();
  }

  setSelected(selected: Pick | null) {
    this.selected = selected;
    this.draw();
  }

  /** The band edges in use (for the legend). */
  get bands(): number[] { return this.edges; }

  draw() {
    const map = this.map;
    const width = this.box.clientWidth;
    if (!width) return;
    const height = width < 520 ? 240 : 290;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.setAttribute('aria-label', t().trip.mapAria);
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!map) return;

    const m = { left: 40, right: 8, top: 8, bottom: 22 };
    const pw = width - m.left - m.right, ph = height - m.top - m.bottom;
    this.geom = { left: m.left, top: m.top, pw, ph };

    // The coloured bands, one image per map, measure and size, at the screen's pixels
    const key = `${map.depart0}/${map.tof0}/${map.nx}x${map.ny}/${this.measure}/${pw}x${ph}/${dpr}`;
    if (this.heat?.key !== key) this.heat = { key, image: this.paint(map, Math.round(pw * dpr), Math.round(ph * dpr)) };
    ctx.drawImage(this.heat.image, m.left, m.top, pw, ph);

    const x = (jd: number) => m.left + ((jd - map.depart0) / ((map.nx - 1) * map.departStep)) * pw;
    const y = (days: number) => m.top + ph - ((days - map.tof0) / ((map.ny - 1) * map.tofStep)) * ph;

    // The line between the types: in each column, where the path turns from less to more than half a turn
    // (not to an asteroid or comet: there whole turns round the Sun cut the map into pieces, each with its own types)
    if (map.hohmannJd !== null) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 232, 240, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      let open = false;
      const { angle } = kindsOf(map, this.measure);
      for (let i = 0; i < map.nx; i++) {
        let yy = NaN;
        for (let j = 1; j < map.ny; j++) {
          const a = angle[(j - 1) * map.nx + i], b = angle[j * map.nx + i];
          if (a < 180 && b >= 180) { yy = y(map.tof0 + (j - 1 + (180 - a) / (b - a)) * map.tofStep); break; }
        }
        if (Number.isNaN(yy)) { open = false; continue; }
        const xx = x(map.depart0 + i * map.departStep);
        if (open) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
        open = true;
      }
      ctx.stroke();
      ctx.restore();
    }

    // Axes: a frame, launch months across, days or years up
    ctx.strokeStyle = '#3a4166';
    ctx.lineWidth = 1;
    ctx.strokeRect(m.left + 0.5, m.top + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = '#8a90a6';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const locale = LANGS.find((l) => l.id === lang())!.dateLocale;
    const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const yearFmt = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const first = new Date(jdToMs(map.depart0)), lastJd = map.depart0 + (map.nx - 1) * map.departStep;
    const months: Date[] = [];
    for (let d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)); jdToMs(lastJd) >= d.getTime(); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push(d);
    const every = Math.max(1, Math.ceil((months.length * 44) / pw));
    months.forEach((d, k) => {
      const xx = x(d.getTime() / DAY_MS + UNIX_EPOCH_JD);
      ctx.fillRect(Math.round(xx), m.top + ph, 1, 4);
      if (k % every) return;
      ctx.fillText((k === 0 || d.getUTCMonth() === 0 ? yearFmt : monthFmt).format(d), xx, m.top + ph + 6);
    });
    const years = map.tof0 + (map.ny - 1) * map.tofStep > 1000;
    const unit = years ? 365.25 : 1;
    const lo = map.tof0 / unit, hi = (map.tof0 + (map.ny - 1) * map.tofStep) / unit;
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((s) => (hi - lo) / s <= 6) ?? 1000;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const yy = y(v * unit);
      ctx.fillRect(m.left - 4, Math.round(yy), 4, 1);
      ctx.fillText(num(v, 0), m.left - 6, yy);
    }

    // Markers: the Hohmann estimate (a diamond), the cheapest of each type (dots), the trip below (a ring)
    const halo = (text: string, xx: number, yy: number) => {
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0b0d17';
      ctx.strokeText(text, xx, yy);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, xx, yy);
    };
    const inside = (xx: number, yy: number) => xx >= m.left && xx <= m.left + pw && yy >= m.top && yy <= m.top + ph;
    if (map.hohmannJd !== null && map.hohmannDays !== null) { // (none for an asteroid or comet)
      const xx = x(map.hohmannJd), yy = y(map.hohmannDays);
      if (inside(xx, yy)) {
        ctx.beginPath();
        ctx.moveTo(xx, yy - 6); ctx.lineTo(xx + 6, yy); ctx.lineTo(xx, yy + 6); ctx.lineTo(xx - 6, yy); ctx.closePath();
        ctx.lineWidth = 3; ctx.strokeStyle = '#0b0d17'; ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        halo('H', xx + 8, yy);
      }
    }
    for (const type of [1, 2] as const) {
      const b = this.best[type];
      if (!b) continue;
      const xx = x(b.departJd), yy = y(b.tofDays);
      ctx.beginPath();
      ctx.arc(xx, yy, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#0b0d17'; ctx.stroke();
      halo(type === 1 ? 'I' : 'II', xx + 11, yy); // clear of the ring round a picked trip
    }
    if (this.selected) {
      const xx = x(this.selected.departJd), yy = y(this.selected.arriveJd - this.selected.departJd);
      if (inside(xx, yy)) {
        ctx.beginPath();
        ctx.arc(xx, yy, 8, 0, 2 * Math.PI);
        ctx.lineWidth = 4; ctx.strokeStyle = '#0b0d17'; ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      }
    }
  }

  /** The bands as an image, plot pixel by plot pixel, from the grid interpolated between its points. */
  private paint(map: Porkchop, w: number, h: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = Math.max(1, w); out.height = Math.max(1, h);
    const c = out.getContext('2d')!;
    const img = c.createImageData(out.width, out.height);
    const values = this.measure === 'c3' ? map.c3 : map.dv;
    const edges = this.edges;
    const { nx, ny } = map;
    for (let py = 0; py < out.height; py++) {
      const gy = (1 - (py + 0.5) / out.height) * (ny - 1);
      const j0 = Math.min(ny - 2, Math.floor(gy)), fy = gy - j0;
      for (let px = 0; px < out.width; px++) {
        const gx = ((px + 0.5) / out.width) * (nx - 1);
        const i0 = Math.min(nx - 2, Math.floor(gx)), fx = gx - i0;
        const a = values[j0 * nx + i0], b = values[j0 * nx + i0 + 1], cc = values[(j0 + 1) * nx + i0], d = values[(j0 + 1) * nx + i0 + 1];
        let v: number;
        if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(cc) && Number.isFinite(d)) {
          v = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
        } else {
          v = [[a, (1 - fx) * (1 - fy)], [b, fx * (1 - fy)], [cc, (1 - fx) * fy], [d, fx * fy]]
            .filter(([q]) => Number.isFinite(q)).sort((p, q) => q[1] - p[1])[0]?.[0] ?? NaN;
        }
        const o = (py * out.width + px) * 4;
        if (!Number.isFinite(v)) { img.data[o + 3] = 0; continue; }
        let k = 0;
        while (k < edges.length && v >= edges[k]) k++;
        const col = k <= edges.length && k < BAND_RGB.length ? BAND_RGB[k] : BEYOND_RGB;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    return out;
  }

  /** The grid point under the pointer, as whole days. */
  private at(e: PointerEvent | MouseEvent): Pick | null {
    const map = this.map;
    if (!map) return null;
    const r = this.canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left - this.geom.left) / this.geom.pw, fy = 1 - (e.clientY - r.top - this.geom.top) / this.geom.ph;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    const dep = map.depart0 + fx * (map.nx - 1) * map.departStep;
    const tof = map.tof0 + fy * (map.ny - 1) * map.tofStep;
    const d = Math.round(dep - 0.5) + 0.5; // UTC midnight
    return { departJd: d, arriveJd: d + Math.max(1, Math.round(tof)) };
  }

  private hover(e: PointerEvent | MouseEvent) {
    const map = this.map, p = this.at(e);
    if (!map || !p) { this.tip.hidden = true; return; }
    const i = Math.round((p.departJd - map.depart0) / map.departStep), j = Math.round((p.arriveJd - p.departJd - map.tof0) / map.tofStep);
    const at = Math.min(map.ny - 1, Math.max(0, j)) * map.nx + Math.min(map.nx - 1, Math.max(0, i));
    const s = t().trip;
    const days = p.arriveJd - p.departJd;
    const value = this.measure === 'c3' ? map.c3[at] : map.dv[at], { type, revs } = kindsOf(map, this.measure);
    const lines = [
      Number.isFinite(value) ? `${num(value, 2)} ${s.units[this.measure]}` : '—',
      `${s.departDate}: ${dayMonthYear(jdToMs(p.departJd), undefined, 'UTC')}`,
      `${s.arriveDate}: ${dayMonthYear(jdToMs(p.arriveJd), undefined, 'UTC')}`,
      `${days < 730 ? s.tripDays(String(days)) : s.tripYears(num(days / 365.25, 1))}${type[at] ? ` · ${s.typeName(type[at] as 1 | 2)}` : ''}${revs[at] ? ` · ${s.turns(revs[at])}` : ''}`,
    ];
    this.tip.dir = langInfo().dir;
    this.tip.replaceChildren(...lines.map((l, k) => {
      const el = document.createElement(k ? 'div' : 'strong');
      el.textContent = l;
      if (k) el.className = 'kp-tip-sub';
      return el;
    }));
    this.tip.hidden = false;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const tw = this.tip.offsetWidth;
    this.tip.style.left = `${Math.min(Math.max(0, px - tw / 2), this.box.clientWidth - tw)}px`;
    this.tip.style.top = `${Math.max(py - 10, this.tip.offsetHeight)}px`;
  }

  /** Arrow keys move the trip worked out below by a day (with Shift, ten): left and right the launch, up and down the time on the way. */
  private key(e: KeyboardEvent) {
    const map = this.map;
    if (!map) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    const n = e.shiftKey ? 10 : 1;
    const start = this.selected ?? (this.best[2] ?? this.best[1] ? { departJd: Math.round((this.best[2] ?? this.best[1])!.departJd - 0.5) + 0.5, arriveJd: 0 } : null);
    if (!start) return;
    const tof = this.selected ? this.selected.arriveJd - this.selected.departJd : Math.round((this.best[2] ?? this.best[1])!.tofDays);
    const lastDep = map.depart0 + (map.nx - 1) * map.departStep, lastTof = map.tof0 + (map.ny - 1) * map.tofStep;
    const d = Math.min(Math.floor(lastDep - 0.5) + 0.5, Math.max(Math.ceil(map.depart0 - 0.5) + 0.5, start.departJd + mv[0] * n));
    const tt = Math.min(Math.floor(lastTof), Math.max(Math.ceil(map.tof0), tof + mv[1] * n));
    this.onPick?.({ departJd: d, arriveJd: d + tt });
  }
}
