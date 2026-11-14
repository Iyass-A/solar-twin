// Top-down 2D view of the solar system on a <canvas>.
// Looking down on the J2000 ecliptic from the north: x points to the
// vernal equinox (right), y is up, planets move counter-clockwise.
// The z coordinate (height above the ecliptic) is ignored.

import type { PlanetId } from '../astro/elements';
import type { Vec3 } from '../astro/kepler';

export type ViewMode = 'compressed' | 'true' | 'inner';

interface ViewInfo {
  label: string;
  caption: string;
  rMax: number;        // au shown at the edge (zoom 1)
  compressed: boolean; // square-root distances: true directions, squeezed distances
  rings: number[];     // distance rings to draw [au]
}

export const VIEWS: Record<ViewMode, ViewInfo> = {
  compressed: {
    label: 'كل الكواكب، مسافات مضغوطة',
    caption: 'المسافات مضغوطة لحتى يبينوا كل الكواكب، بس الاتجاهات صحيحة.',
    rMax: 31, compressed: true, rings: [1, 5, 10, 20, 30],
  },
  true: {
    label: 'كل الكواكب، مسافات حقيقية',
    caption: 'المسافات حقيقية. الكواكب الداخلية بتبين قريبة كتير من الشمس.',
    rMax: 31, compressed: false, rings: [5, 10, 20, 30],
  },
  inner: {
    label: 'الكواكب الداخلية، مسافات حقيقية',
    caption: 'المسافات حقيقية، لحد مدار المريخ.',
    rMax: 1.75, compressed: false, rings: [0.5, 1, 1.5],
  },
};

export interface BodyFrame {
  id: PlanetId;
  name: string;
  pos: Vec3;
  orbit: Vec3[];
}

const COLORS: Record<PlanetId, string> = {
  mercury: '#b5b5b5',
  venus: '#e8c77a',
  earth: '#4f9dff',
  mars: '#e0603a',
  jupiter: '#d9a46c',
  saturn: '#e3cf8f',
  uranus: '#8fd8e0',
  neptune: '#6b85ff',
};

const DOT: Partial<Record<PlanetId, number>> = { jupiter: 6, saturn: 5.5, uranus: 4.5, neptune: 4.5 };

interface Box { x0: number; y0: number; x1: number; y1: number; }

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 40;

// How close a tap must be to a planet to select it [px]
const HIT_RADIUS = 18;

export class Orrery {
  mode: ViewMode = 'compressed';
  zoom = 1;
  selected: PlanetId | null = null;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private lastScreen: { id: PlanetId; x: number; y: number }[] = [];

  /** The planet nearest to a point on the canvas (CSS pixels), or null if none is close. */
  hitTest(x: number, y: number): PlanetId | null {
    let best: PlanetId | null = null;
    let bestD = HIT_RADIUS;
    for (const p of this.lastScreen) {
      const d = Math.hypot(p.x - x, p.y - y);
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

  draw(bodies: BodyFrame[]) {
    const { ctx, w, h } = this;
    const view = VIEWS[this.mode];
    const cx = w / 2;
    const cy = h / 2;
    const R = (Math.min(w, h) / 2 - 28) * this.zoom;

    // Distance from the Sun [au] -> distance on screen [px]
    const scale = (r: number) => (view.compressed ? Math.sqrt(r / view.rMax) : r / view.rMax) * R;
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
    ctx.direction = 'rtl';
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

    // Planets
    const screen = bodies.map((b) => project(b.pos));
    this.lastScreen = bodies.map((b, i) => ({ id: b.id, x: screen[i][0], y: screen[i][1] }));
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
      taken.push({ x0: x - r - 5, y0: y - r - 5, x1: x + r + 5, y1: y + r + 5 });
    });
    taken.push({ x0: cx - 6, y0: cy - 6, x1: cx + 6, y1: cy + 6 }); // the Sun

    // Arabic names: try a few spots around each planet, skip the label if all are taken.
    // (Crowded labels show up again in the inner view or when zooming in.)
    ctx.font = '13px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e8f0';
    bodies.forEach((b, i) => {
      const [x, y] = screen[i];
      const tw = ctx.measureText(b.name).width;
      const spots: [number, number][] = [
        [8, -7], [8, 16], [-8 - tw, -7], [-8 - tw, 16], [-tw / 2, -11], [-tw / 2, 21],
      ];
      for (const [dx, dy] of spots) {
        const box = { x0: x + dx - 2, y0: y + dy - 12, x1: x + dx + tw + 2, y1: y + dy + 4 };
        const inside = box.x0 >= 0 && box.y0 >= 0 && box.x1 <= w && box.y1 <= h;
        if (inside && !taken.some((t) => overlaps(t, box))) {
          ctx.fillText(b.name, x + dx, y + dy);
          taken.push(box);
          break;
        }
      }
    });

    // Name of the equinox direction, above or below the arrow, wherever there is room
    ctx.font = '11px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.fillStyle = 'rgba(150, 160, 195, 0.75)';
    const ew = ctx.measureText('الاعتدال').width;
    for (const dy of [-9, 18]) {
      const box = { x0: w - 8 - ew, y0: cy + dy - 11, x1: w, y1: cy + dy + 3 };
      if (!taken.some((t) => overlaps(t, box))) {
        ctx.fillText('الاعتدال', w - 6 - ew, cy + dy);
        break;
      }
    }
    ctx.direction = 'ltr';
  }
}
