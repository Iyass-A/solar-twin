// Top-down 2D view of the solar system on a <canvas>.
// Looking down on the J2000 ecliptic from the north: x points to the
// vernal equinox (right), y is up, planets move counter-clockwise.
// The z coordinate (height above the ecliptic) is ignored.
// Asteroids and comets are small dots; the selected one also gets its orbit, its name and its
// uncertainty cloud (enlarged when it is too small to see, with a label saying how much).

import type { PlanetId } from '../astro/elements';
import type { Vec3 } from '../astro/kepler';
import { VIEWS, COLORS, radialScale, type BodyFrame, type ViewMode } from './views';
import { langInfo, numGrouped, t } from '../i18n';
import { SMALL_COLORS, cloudZoom, type SmallFrame } from './smallbodies';
import type { Ghost } from './branch';

const CLOUD_PX = 14; // the cloud's 1-sigma size on screen when it has to be enlarged

const DOT: Partial<Record<PlanetId, number>> = { jupiter: 6, saturn: 5.5, uranus: 4.5, neptune: 4.5 };

// A taken area on screen. `id` marks a planet's own dot, which must not hide its own name.
interface Box { x0: number; y0: number; x1: number; y1: number; id?: string; }

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 40;

// How close a tap must be to a planet to select it [px]
const HIT_RADIUS = 18;
// Asteroids and comets count as this much farther away, so a tap near a planet picks the planet
const SMALL_HIT_PENALTY = 6;

export class Orrery {
  mode: ViewMode = 'compressed';
  zoom = 1;
  selected: string | null = null; // a planet id, or a small body's "sb-..." id

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private lastScreen: { id: string; x: number; y: number; small: boolean }[] = [];

  /** The body nearest to a point on the canvas (CSS pixels), or null if none is close. */
  hitTest(x: number, y: number): string | null {
    let best: string | null = null;
    let bestD = HIT_RADIUS;
    for (const p of this.lastScreen) {
      const d = Math.hypot(p.x - x, p.y - y) + (p.small ? SMALL_HIT_PENALTY : 0);
      if (d < bestD) { bestD = d; best = p.id; }
    }
    return best;
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();

    // Mouse wheel zooms around the Sun, double-click resets.
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * Math.exp(-ev.deltaY * 0.0015)));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => { this.zoom = 1; });
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const box = this.canvas.getBoundingClientRect();
    this.w = box.width;
    this.h = box.height;
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(bodies: BodyFrame[], smalls: SmallFrame[] = [], selectedOrbit: { path: Vec3[]; color: string } | null = null,
    cloud: { offsets: Vec3[]; color: string } | null = null, ghosts: Ghost[] | null = null) {
    // Hidden (3D tab), or just shown and not measured yet: the ResizeObserver catches up next frame
    if (this.w < 60 || this.h < 60) return;
    const { ctx, w, h } = this;
    const view = VIEWS[this.mode];
    const cx = w / 2;
    const cy = h / 2;
    const R = (Math.min(w, h) / 2 - 28) * this.zoom;

    // Distance from the Sun [au] -> distance on screen [px]
    const scale = (r: number) => radialScale(view, r) * R;
    const project = (v: Vec3): [number, number] => {
      const r = Math.hypot(v.x, v.y);
      if (r === 0) return [cx, cy];
      const s = scale(r) / r;
      return [cx + v.x * s, cy - v.y * s];
    };

    ctx.clearRect(0, 0, w, h);

    // Distance rings with their value in au
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const r of view.rings) {
      const s = scale(r);
      ctx.strokeStyle = 'rgba(120, 130, 170, 0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(150, 160, 195, 0.6)';
      ctx.fillText(String(r), cx + s * Math.cos(0.9) + 3, cy + s * Math.sin(0.9));
    }

    // Direction of the vernal equinox (x axis), with a small arrow
    ctx.strokeStyle = 'rgba(120, 130, 170, 0.35)';
    ctx.fillStyle = 'rgba(120, 130, 170, 0.6)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(w - 6, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(w - 4, cy);
    ctx.lineTo(w - 11, cy - 4);
    ctx.lineTo(w - 11, cy + 4);
    ctx.fill();

    // Boxes already taken on screen, so labels don't overlap
    const taken: Box[] = [];
    ctx.direction = langInfo().dir;
    ctx.textBaseline = 'alphabetic';

    // Orbits
    for (const b of bodies) {
      ctx.strokeStyle = COLORS[b.id];
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      b.orbit.forEach((v, i) => {
        const [x, y] = project(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    // Orbit of the selected asteroid or comet
    if (selectedOrbit) {
      ctx.strokeStyle = selectedOrbit.color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      selectedOrbit.path.forEach((v, i) => {
        const [x, y] = project(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Sun
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    glow.addColorStop(0, 'rgba(255, 214, 90, 0.9)');
    glow.addColorStop(1, 'rgba(255, 214, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd65a';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Asteroids and comets, under the planets: one path per colour and size (thousands of dots)
    const smallScreen = smalls.map((b) => project(b.pos));
    const bulk = w < 600 ? 1.2 : 1.6; // phones: less crowded
    const radius = (b: SmallFrame) => (b.group === 'dwarf' ? 3 : b.famous ? 2.3 : bulk);
    // The thousands of less-known ones a little dimmer, so the planets stand out
    const batches = new Map<string, number[]>();
    smalls.forEach((b, i) => {
      const [x, y] = smallScreen[i];
      if (x < -5 || y < -5 || x > w + 5 || y > h + 5) return;
      const k = `${SMALL_COLORS[b.group]} ${radius(b)} ${b.famous || b.group === 'dwarf' ? 1 : 0.7}`;
      let list = batches.get(k);
      if (!list) batches.set(k, list = []);
      list.push(x, y);
    });
    for (const [k, xy] of batches) {
      const [color, r, alpha] = k.split(' ');
      const rr = Number(r);
      ctx.fillStyle = color;
      ctx.globalAlpha = Number(alpha);
      ctx.beginPath();
      for (let j = 0; j < xy.length; j += 2) { ctx.moveTo(xy[j] + rr, xy[j + 1]); ctx.arc(xy[j], xy[j + 1], rr, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    let selectedSmall: { b: SmallFrame; x: number; y: number } | null = null;
    const si = smalls.findIndex((b) => b.id === this.selected);
    if (si >= 0) {
      const b = smalls[si], [x, y] = smallScreen[si], r = radius(b);
      selectedSmall = { b, x, y };
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      taken.push({ x0: x - r - 5, y0: y - r - 5, x1: x + r + 5, y1: y + r + 5, id: b.id });
    }

    // Uncertainty cloud of the selected asteroid or comet: its offsets in pixels, enlarged if tiny
    let cloudText: { text: string; x: number; y: number; r: number; color: string } | null = null;
    const selNow = selectedSmall as { b: SmallFrame; x: number; y: number } | null;
    if (cloud && selNow && cloud.offsets.length) {
      const p = selNow.b.pos;
      const d = cloud.offsets.map((o) => {
        const [x, y] = project({ x: p.x + o.x, y: p.y + o.y, z: p.z + o.z });
        return [x - selNow.x, y - selNow.y];
      });
      const rms = Math.sqrt(d.reduce((sum, [x, y]) => sum + x * x + y * y, 0) / d.length);
      const zoom = cloudZoom(rms, CLOUD_PX);
      ctx.fillStyle = cloud.color;
      ctx.globalAlpha = 0.75;
      for (const [x, y] of d) ctx.fillRect(selNow.x + x * zoom - 0.75, selNow.y + y * zoom - 0.75, 1.5, 1.5);
      ctx.globalAlpha = 1;
      cloudText = {
        text: zoom === 1 ? t().trueSize : t().cloudZoom(numGrouped(zoom)),
        x: selNow.x, y: selNow.y, r: Math.max(rms * zoom * 2, 8), color: cloud.color,
      };
    }

    // Planets
    const screen = bodies.map((b) => project(b.pos));
    this.lastScreen = [
      ...bodies.map((b, i) => ({ id: b.id as string, x: screen[i][0], y: screen[i][1], small: false })),
      ...smalls.map((b, i) => ({ id: b.id, x: smallScreen[i][0], y: smallScreen[i][1], small: true })),
    ];
    bodies.forEach((b, i) => {
      const [x, y] = screen[i];
      const r = DOT[b.id] ?? 4;
      ctx.fillStyle = COLORS[b.id];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (b.id === this.selected) {
        // Ring around the selected planet
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      taken.push({ x0: x - r - 5, y0: y - r - 5, x1: x + r + 5, y1: y + r + 5, id: b.id });
    });
    taken.push({ x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 }); // the Sun

    // "Branch reality": each body of the branch as an empty circle, with its recent path, and a
    // dotted line to the same planet in reality once they have drifted apart
    for (const g of ghosts ?? []) {
      ctx.strokeStyle = g.color;
      if (g.trail.length > 1) {
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        g.trail.forEach((v, i) => { const [x, y] = project(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
      }
      const [x, y] = project(g.pos);
      const ri = bodies.findIndex((b) => b.id === g.id);
      // Off the map: a planet is left out like the real one; a passing star (which has no real twin)
      // gets an arrow at the edge, pointing to it, with its distance in au
      const M = 14;
      if (x < M || x > w - M || y < M || y > h - M) {
        if (ri >= 0) continue;
        const dx = x - cx, dy = y - cy;
        const k = Math.min((dx > 0 ? w - M - cx : cx - M) / Math.abs(dx || 1e-9), (dy > 0 ? h - M - cy : cy - M) / Math.abs(dy || 1e-9));
        const ex = cx + dx * k, ey = cy + dy * k, a = Math.atan2(dy, dx);
        ctx.globalAlpha = 1;
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.moveTo(ex + 8 * Math.cos(a), ey + 8 * Math.sin(a));
        ctx.lineTo(ex + 6 * Math.cos(a + 2.3), ey + 6 * Math.sin(a + 2.3));
        ctx.lineTo(ex + 6 * Math.cos(a - 2.3), ey + 6 * Math.sin(a - 2.3));
        ctx.fill();
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numGrouped(Math.round(Math.hypot(g.pos.x, g.pos.y, g.pos.z))), ex - 16 * Math.cos(a) - 12 * Math.sin(a), ey - 16 * Math.sin(a) + 12 * Math.cos(a));
        continue;
      }
      if (ri >= 0 && Math.hypot(screen[ri][0] - x, screen[ri][1] - y) > 4) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(screen[ri][0], screen[ri][1]);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x, y, (DOT[g.id as PlanetId] ?? 4) + 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Arabic names: try a few spots around each planet, skip the label if all are taken.
    // (Crowded labels show up again in the inner view or when zooming in.)
    ctx.font = '13px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'left';
    const label = (id: string, name: string, x: number, y: number, color: string) => {
      ctx.direction = /[\u0600-\u06FF]/.test(name) ? 'rtl' : 'ltr'; // "2024 YR4" keeps its order
      const tw = ctx.measureText(name).width;
      const spots: [number, number][] = [
        [8, -7], [8, 16], [-8 - tw, -7], [-8 - tw, 16], [-tw / 2, -11], [-tw / 2, 21],
      ];
      for (const [dx, dy] of spots) {
        const box = { x0: x + dx - 2, y0: y + dy - 12, x1: x + dx + tw + 2, y1: y + dy + 4 };
        const inside = box.x0 >= 0 && box.y0 >= 0 && box.x1 <= w && box.y1 <= h;
        if (inside && !taken.some((t) => t.id !== id && overlaps(t, box))) {
          ctx.fillStyle = color;
          ctx.fillText(name, x + dx, y + dy);
          taken.push(box);
          break;
        }
      }
    };
    // The selected asteroid or comet first, so its name always shows
    const sel = selectedSmall as { b: SmallFrame; x: number; y: number } | null;
    if (sel) label(sel.b.id, sel.b.label, sel.x, sel.y, SMALL_COLORS[sel.b.group]);
    bodies.forEach((b, i) => label(b.id, b.name, screen[i][0], screen[i][1], '#e8e8f0'));

    // How much the cloud is enlarged, under or above it
    const ct = cloudText as { text: string; x: number; y: number; r: number; color: string } | null;
    if (ct) {
      ctx.font = '11px system-ui, "Segoe UI", Tahoma, sans-serif';
      const tw = ctx.measureText(ct.text).width;
      for (const dy of [ct.r + 14, -ct.r - 6]) {
        const box = { x0: ct.x - tw / 2 - 2, y0: ct.y + dy - 11, x1: ct.x + tw / 2 + 2, y1: ct.y + dy + 3 };
        const inside = box.x0 >= 0 && box.y0 >= 0 && box.x1 <= w && box.y1 <= h;
        if (inside && !taken.some((t) => overlaps(t, box))) {
          ctx.fillStyle = ct.color;
          ctx.globalAlpha = 0.85;
          ctx.fillText(ct.text, ct.x - tw / 2, ct.y + dy);
          ctx.globalAlpha = 1;
          break;
        }
      }
    }

    // Name of the equinox direction, above or below the arrow, wherever there is room
    ctx.font = '11px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.fillStyle = 'rgba(150, 160, 195, 0.75)';
    const equinox = t().equinox;
    const ew = ctx.measureText(equinox).width;
    for (const dy of [-9, 18]) {
      const box = { x0: w - 8 - ew, y0: cy + dy - 11, x1: w, y1: cy + dy + 3 };
      if (!taken.some((t) => overlaps(t, box))) {
        ctx.fillText(equinox, w - 6 - ew, cy + dy);
        break;
      }
    }
    ctx.direction = 'ltr';
  }
}
