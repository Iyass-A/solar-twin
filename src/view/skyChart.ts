// The sky seen from the Earth, drawn for the video (phase 8, step 2): the stars of the Yale catalogue, the
// ecliptic, the Sun with its glow, the Moon with its lit part facing the Sun (and the Earth's shadow on it in a
// lunar eclipse), and the planets as dots by brightness, on a stereographic chart (src/video/sky.ts).
// Also the scale drawing for an asteroid passing the Earth. Everything is drawn from the time given, so the same
// time always gives the same picture.

import { equatorialToEcliptic } from '../astro/frames';
import { num, numGrouped, lang, t } from '../i18n';
import { COLORS } from './views';
import { kelvinToRgb } from './stars';
import { BRIGHT_PLANETS, EVENT_PLANETS, GLARE_DEG, moonPhaseAngle, type EventPlanet } from '../events/events';
import {
  angleBetween, discRadius, midpoint, moonLit, opposite, pixelsPerDegree, planetMag, project, projection, screenDirection,
  shadowRadii, skyVector, fromLonLat, lonLat, type Projection, type SkyBody,
} from '../video/sky';
import { planetsOfWeek, type DistanceShot, type PlanetsShot, type SkyShot } from '../video/scenes';
import type { Vec3 } from '../astro/kepler';
import { LD_AU, AU_KM } from '../live/closeApproaches';

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const SUN_COLOR = '#ffd65a';
const MOON_LIT = '#f2efe6';
const MOON_DARK = '#23252e';
const ECLIPTIC_COLOR = 'rgba(255, 214, 90, 0.35)';
const LABEL_COLOR = '#e8e8f0';
const DIM_COLOR = '#9aa0b4';

interface Star { v: Vec3; r: number; alpha: number; color: string; glow: boolean }

/**
 * A star's dot in the video [px at 1080 lines] and how opaque: larger than on the site's 3D view, so that even
 * faint stars survive a video's compression (Sirius about 4.8 px, stars of magnitude 5 and fainter 1.5 px).
 */
export function videoStarLook(mag: number): { r: number; alpha: number } {
  return { r: Math.min(4.8, Math.max(1.5, 3.6 - 0.42 * mag)), alpha: Math.min(1, Math.max(0.5, 1.15 - 0.12 * mag)) };
}

/** Where the chart's centre sits: a little above the middle, as the caption is at the bottom. [px from the top] */
export const chartCy = (w: number, h: number) => h * (h > w ? 0.38 : 0.42);

/**
 * How much of the Sun is not covered by the Moon (1 nothing covered, 0 a total eclipse): the overlap of two discs
 * of angular radius rs (Sun) and rm (Moon) whose centres are d apart.
 */
export function sunUncovered(d: number, rs: number, rm: number): number {
  if (d >= rs + rm) return 1;
  if (d <= Math.abs(rs - rm)) return rm >= rs ? 0 : 1 - (rm * rm) / (rs * rs);
  const a = rs * rs * Math.acos((d * d + rs * rs - rm * rm) / (2 * d * rs)) + rm * rm * Math.acos((d * d + rm * rm - rs * rs) / (2 * d * rm))
    - 0.5 * Math.sqrt((-d + rs + rm) * (d + rs - rm) * (d - rs + rm) * (d + rs + rm));
  return 1 - a / (Math.PI * rs * rs);
}

/**
 * The Moon's seas (maria), as seen from the Earth, for drawing only: centre in selenographic latitude and longitude
 * (east +) and angular radius on the Moon [deg], from the positions and diameters of the Gazetteer of Planetary
 * Nomenclature (IAU/USGS, as listed on Wikipedia's "List of maria on the Moon"), rounded; Oceanus Procellarum and
 * Mare Frigoris, which are long, as a few circles. Libration (a wobble of a few degrees) is left out.
 */
const MARIA: [number, number, number][] = [
  [32.8, -15.6, 18.5], [28.0, 17.5, 11.1], [8.5, 31.4, 14.4], [17.0, 59.1, 7.5], [-7.8, 51.3, 15.0], [-15.2, 35.5, 5.5],
  [-21.3, -16.6, 11.8], [-24.4, -38.6, 6.4], [-10.0, -23.1, 6.2], [7.5, -30.9, 8.5], [13.3, 3.6, 4.0], [2.4, 1.7, 3.0],
  // Oceanus Procellarum, Mare Frigoris
  [30, -56, 13], [12, -55, 12], [-3, -45, 9], [42, -45, 7], [57, -20, 4.5], [57, 0, 4.5], [56, 20, 4], [54, -38, 4],
];

/** Where the chart is centred: a body, the point opposite the Sun, or half way between two bodies, at a moment. */
export function chartCenter(shot: SkyShot, ms = shot.at): Vec3 {
  const at = shot.track ? ms : shot.at, place = shot.place;
  const dir = (x: SkyBody | 'antisun') => (x === 'antisun' ? opposite(skyVector('sun', at, place).dir) : skyVector(x, at, place).dir);
  const c = shot.center;
  return Array.isArray(c) ? midpoint(dir(c[0]), dir(c[1])) : dir(c);
}

const bodyName = (b: SkyBody) => (b === 'sun' ? t().video.sunName : b === 'moon' ? t().events.moonName : t().planets[b]);

/** A planet's dot radius [px at 1080 lines] from its brightness: Venus about 9, Saturn 5, Neptune 2.5. */
export const planetRadius = (mag: number) => Math.min(9, Math.max(2.5, 4.6 - 1.05 * mag));

export class SkyChart {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private stars: Star[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /** The star catalogue (src/data/stars.json: ra, dec, mag, kelvin, …). */
  setStars(flat: number[]) {
    this.stars = [];
    for (let i = 0; i < flat.length; i += 4) {
      const [ra, dec, mag, kelvin] = flat.slice(i, i + 4);
      const look = videoStarLook(mag);
      const [r, g, b] = kelvinToRgb(kelvin).map((x) => Math.round(x * 255));
      this.stars.push({ v: equatorialToEcliptic(ra, dec), r: look.r, alpha: look.alpha, color: `rgb(${r},${g},${b})`, glow: mag < 1.5 });
    }
  }

  /** Scale for text and dots: 1 at 1080 pixels on the short side. */
  private get k() { return Math.min(this.canvas.width, this.canvas.height) / 1080; }

  draw(shot: SkyShot, ms: number, fov: number) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, k = this.k;
    const p = projection(chartCenter(shot, ms), fov, W, H, chartCy(W, H));
    const place = shot.place;
    const sun = skyVector('sun', ms, place), moon = skyVector('moon', ms, place);
    // In a solar eclipse the sky darkens as the Moon covers the Sun, and the corona shows when it is all covered
    const rs = discRadius('sun', sun.au), rm = discRadius('moon', moon.au);
    const lit = sunUncovered(angleBetween(sun.dir, moon.dir), rs, rm);
    const dark = Math.pow(Math.min(1, Math.max(0, 1 - lit / 0.25)), 1.5);
    ctx.save();
    ctx.direction = lang() === 'ar' ? 'rtl' : 'ltr';
    this.background(dark);

    // Stars
    for (const s of this.stars) {
      const q = project(p, s.v);
      if (!q || q.x < -10 || q.y < -10 || q.x > W + 10 || q.y > H + 10) continue;
      const r = s.r * k;
      if (s.glow) {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3.2);
        g.addColorStop(0, s.color.replace('rgb', 'rgba').replace(')', ', 0.35)'));
        g.addColorStop(1, s.color.replace('rgb', 'rgba').replace(')', ', 0)'));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 3.2, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.drawEcliptic(p);

    if (shot.shadow) this.drawShadow(p, opposite(skyVector('sun', ms).dir), shadowRadii(skyVector('moon', ms).au, sun.au));
    if (shot.arc) this.drawArc(p, skyVector(shot.arc[0], ms, place).dir, skyVector(shot.arc[1], ms, place).dir);

    // The Sun, the planets, then the Moon (in front of them all)
    this.drawSun(p, sun.dir, rs, lit);
    for (const pl of EVENT_PLANETS) {
      const v = skyVector(pl, ms, place).dir;
      const q = project(p, v);
      if (!q || q.x < -20 || q.y < -20 || q.x > W + 20 || q.y > H + 20) continue;
      this.drawPlanet(q, pl, planetMag(pl, ms), shot.focus.includes(pl) || BRIGHT_PLANETS.includes(pl));
    }
    this.drawMoon(p, moon.dir, rm, sun.dir, ms, shot.shadow ? { center: opposite(skyVector('sun', ms).dir), ...shadowRadii(skyVector('moon', ms).au, sun.au) } : null, shot.place !== undefined);
    // Just before and after a total eclipse: the last bit of the Sun shines like a diamond on a ring
    if (lit > 0 && lit < 0.012 && rm > rs) this.drawBead(p, sun.dir, moon.dir, rs, 1 - lit / 0.012);

    // Names: the bodies in focus, and (dimmer) the other bright planets in the picture
    const named: SkyBody[] = [...shot.focus, ...BRIGHT_PLANETS.filter((x) => !shot.focus.includes(x))];
    for (const b of named) {
      const v = b === 'sun' ? sun.dir : b === 'moon' ? moon.dir : skyVector(b, ms, place).dir;
      const q = project(p, v);
      if (!q) continue;
      const r = b === 'sun' ? Math.max(12 * k, discRadius('sun', sun.au) * pixelsPerDegree(p)) : b === 'moon' ? Math.max(9 * k, discRadius('moon', moon.au) * pixelsPerDegree(p)) : planetRadius(planetMag(b, ms)) * k;
      if (q.x < 0 || q.y < 0 || q.x > W || q.y > H) continue;
      const focus = shot.focus.includes(b);
      this.label(q, r, bodyName(b), (focus ? 30 : 24) * k, focus ? LABEL_COLOR : DIM_COLOR);
    }
    this.drawScale(p);
    ctx.restore();
  }

  /** The night sky's gradient, darker towards black in a solar eclipse (dark 0 to 1). */
  private background(dark = 0) {
    const { ctx, canvas } = this;
    const mix = (a: number[], b: number[]) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * dark)).join(',')})`;
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, mix([5, 7, 15], [1, 2, 5]));
    sky.addColorStop(1, mix([11, 16, 36], [2, 3, 8]));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private label(q: { x: number; y: number }, r: number, text: string, size: number, color: string, centred = false) {
    const { ctx } = this;
    ctx.font = `600 ${Math.round(size)}px "Inter", "Noto Sans Arabic", system-ui, sans-serif`;
    // Latin names (JPL's, "2026 WJ") read left to right even on an Arabic page
    ctx.direction = /[\u0600-\u06ff]/.test(text) ? 'rtl' : 'ltr';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const w = ctx.measureText(text).width;
    // To the right and a little up; to the left if it would leave the picture; above a large disc
    let x = q.x + r + 10 * this.k;
    if (x + w > this.canvas.width - 8) x = q.x - r - 10 * this.k - w;
    let y = q.y - r * 0.6 - 6 * this.k;
    if (r > 50 * this.k) { x = q.x - w / 2; y = q.y - r - size * 0.9; }
    if (centred) { x = q.x - w / 2; y = q.y; }
    y = Math.max(size, Math.min(this.canvas.height - size, y));
    ctx.lineWidth = 5 * this.k;
    ctx.strokeStyle = 'rgba(5, 7, 15, 0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private drawEcliptic(p: Projection) {
    const { ctx, canvas } = this;
    const c = lonLat(p.center);
    ctx.strokeStyle = ECLIPTIC_COLOR;
    ctx.lineWidth = 2 * this.k;
    ctx.setLineDash([10 * this.k, 8 * this.k]);
    ctx.beginPath();
    let started = false;
    for (let d = -100; d <= 100; d += 0.25) {
      const q = project(p, fromLonLat(c.lon + d, 0));
      if (!q) { started = false; continue; }
      if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Its name near the left edge, on the line, or near the right edge if that is clear of the clock and the
    // caption (the clock is at the top corner, the caption at the bottom)
    const H = canvas.height;
    for (const side of [1, -1]) {
      const q = project(p, fromLonLat(c.lon + side * this.halfWidthDeg(p) * 0.88, 0));
      if (!q || q.y < 0.2 * H || q.y > 0.58 * H) continue;
      ctx.font = `${Math.round(22 * this.k)}px "Inter", "Noto Sans Arabic", system-ui, sans-serif`;
      ctx.fillStyle = ECLIPTIC_COLOR.replace('0.35', '0.7');
      ctx.textAlign = side > 0 ? 'left' : 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t().video.ecliptic, q.x, q.y - 6 * this.k);
      break;
    }
  }

  /** Half the chart's width in degrees of longitude along the ecliptic (from the projection's scale). */
  private halfWidthDeg(p: Projection): number {
    return (4 * Math.atan((p.w / 2) / (2 * p.scale))) / (Math.PI / 180) / 2;
  }

  private radiusPx(p: Projection, centre: Vec3, deg: number): number {
    const a = project(p, centre);
    const n = { x: p.north.x, y: p.north.y, z: p.north.z };
    const off = { x: centre.x + Math.tan(deg * Math.PI / 180) * n.x, y: centre.y + Math.tan(deg * Math.PI / 180) * n.y, z: centre.z + Math.tan(deg * Math.PI / 180) * n.z };
    const len = Math.hypot(off.x, off.y, off.z);
    const b = project(p, { x: off.x / len, y: off.y / len, z: off.z / len });
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : deg * pixelsPerDegree(p);
  }

  /** The Sun with its glow; lit is how much of it the Moon leaves uncovered (the glow fades, the corona shows). */
  private drawSun(p: Projection, v: Vec3, radiusDeg: number, lit = 1) {
    const q = project(p, v);
    if (!q) return;
    const { ctx } = this;
    const r = Math.max(12 * this.k, this.radiusPx(p, v, radiusDeg));
    const corona = Math.min(1, Math.max(0, (0.03 - lit) / 0.03));
    if (corona > 0) {
      // Pearly white, fading out to a few radii, with a few faint streamers
      ctx.save();
      ctx.globalAlpha = corona;
      const g = ctx.createRadialGradient(q.x, q.y, r * 0.95, q.x, q.y, r * 4.2);
      g.addColorStop(0, 'rgba(240, 244, 255, 0.95)');
      g.addColorStop(0.12, 'rgba(214, 226, 255, 0.5)');
      g.addColorStop(0.4, 'rgba(170, 190, 240, 0.14)');
      g.addColorStop(1, 'rgba(150, 170, 230, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 4.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.translate(q.x, q.y);
      for (const [a, len, w] of [[0.25, 2.9, 0.75], [1.2, 2.1, 0.55], [2.05, 2.5, 0.7], [2.95, 1.9, 0.5], [3.55, 3.0, 0.8], [4.5, 2.2, 0.55], [5.35, 2.6, 0.65]]) {
        ctx.save();
        ctx.rotate(a);
        const s = ctx.createLinearGradient(r, 0, r * len, 0);
        s.addColorStop(0, 'rgba(225, 235, 255, 0.2)');
        s.addColorStop(1, 'rgba(225, 235, 255, 0)');
        ctx.fillStyle = s;
        ctx.beginPath();
        ctx.moveTo(r * 0.9, -r * w);
        ctx.quadraticCurveTo(r * len * 0.6, -r * w * 0.35, r * len, 0);
        ctx.quadraticCurveTo(r * len * 0.6, r * w * 0.35, r * 0.9, r * w);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    const glowA = Math.pow(lit, 0.7);
    if (glowA > 0.003) {
      const glow = ctx.createRadialGradient(q.x, q.y, r * 0.8, q.x, q.y, r * 6);
      glow.addColorStop(0, `rgba(255, 214, 90, ${(0.55 * glowA).toFixed(3)})`);
      glow.addColorStop(0.35, `rgba(255, 190, 70, ${(0.16 * glowA).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255, 190, 70, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 6, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = SUN_COLOR;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  /** The "diamond ring": a bright bead on the Sun's edge, on the side away from the Moon's centre. */
  private drawBead(p: Projection, sunDir: Vec3, moonDir: Vec3, radiusDeg: number, strength: number) {
    const qs = project(p, sunDir), qm = project(p, moonDir);
    if (!qs || !qm) return;
    const { ctx } = this;
    const r = this.radiusPx(p, sunDir, radiusDeg);
    const dx = qs.x - qm.x, dy = qs.y - qm.y, n = Math.hypot(dx, dy) || 1;
    const x = qs.x + (dx / n) * r, y = qs.y + (dy / n) * r;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.9);
    g.addColorStop(0, `rgba(255, 255, 255, ${strength.toFixed(3)})`);
    g.addColorStop(0.15, `rgba(255, 250, 230, ${(0.7 * strength).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, 2 * Math.PI);
    ctx.fill();
  }

  private drawPlanet(q: { x: number; y: number }, id: EventPlanet, mag: number, bright: boolean) {
    const { ctx } = this;
    const r = planetRadius(mag) * this.k;
    if (bright) {
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
      g.addColorStop(0, `${COLORS[id]}aa`);
      g.addColorStop(1, `${COLORS[id]}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = COLORS[id];
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  /**
   * The Moon: its dark disc, then the lit part (a half disc towards the Sun, widened or narrowed by the terminator's
   * ellipse). In a lunar eclipse the penumbra and the umbra darken and redden it where they cover it. In a solar
   * eclipse seen from the centre line, it is the dark disc in front of the Sun.
   */
  private drawMoon(p: Projection, v: Vec3, radiusDeg: number, sun: Vec3, ms: number,
    shadow: { center: Vec3; umbra: number; penumbra: number } | null, againstSun: boolean) {
    const q = project(p, v);
    if (!q) return;
    const { ctx } = this;
    const r = Math.max(9 * this.k, this.radiusPx(p, v, radiusDeg));
    const lit = moonLit(ms);
    ctx.save();
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
    ctx.clip();
    if (againstSun || lit < 0.002) {
      ctx.fillStyle = againstSun ? '#05060a' : MOON_DARK;
      ctx.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
      ctx.restore();
      if (!againstSun) this.moonRim(q, r);
      return;
    }
    ctx.fillStyle = MOON_DARK;
    ctx.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
    const dir = screenDirection(p, v, sun) ?? { x: 1, y: 0 };
    ctx.translate(q.x, q.y);
    ctx.rotate(Math.atan2(dir.y, dir.x));
    // A little darker towards the edge, as the real Moon (and a touch of grey "seas")
    const shade = ctx.createRadialGradient(-r * 0.15, -r * 0.1, r * 0.1, 0, 0, r);
    shade.addColorStop(0, MOON_LIT);
    shade.addColorStop(0.75, '#e4e0d4');
    shade.addColorStop(1, '#bdb8aa');
    ctx.fillStyle = shade;
    ctx.beginPath();
    // Lit half towards +x (the Sun), from the top round the right to the bottom, back along the terminator
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    const b = r * Math.abs(2 * lit - 1);
    ctx.ellipse(0, 0, Math.max(b, 0.01), r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5);
    ctx.fill();
    // The seas, on the lit part only (the path above is kept in screen coordinates, so it clips after the reset)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.clip();
    this.drawMaria(q, r);
    ctx.restore();
    if (shadow) {
      const c = project(p, shadow.center);
      if (c) {
        // The penumbra darkens the Moon little by little towards the umbra; the umbra is dark red (sunlight bent
        // through the Earth's air), with a soft edge
        const rp = this.radiusPx(p, shadow.center, shadow.penumbra), ru = this.radiusPx(p, shadow.center, shadow.umbra);
        const ku = ru / rp;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rp);
        g.addColorStop(0, 'rgba(92, 22, 10, 0.93)');
        g.addColorStop(Math.max(0, ku - 0.04), 'rgba(122, 34, 15, 0.88)');
        g.addColorStop(Math.min(1, ku + 0.02), 'rgba(14, 12, 22, 0.66)');
        g.addColorStop(Math.min(1, ku + (1 - ku) * 0.5), 'rgba(14, 12, 22, 0.3)');
        g.addColorStop(1, 'rgba(14, 12, 22, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rp, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();
    this.moonRim(q, r);
  }

  /**
   * The Moon's seas on its disc (centre q, radius r), north up and the Moon's east to the right (to the west in
   * the sky): each a circle on the sphere, seen from far away, with soft edges.
   */
  private drawMaria(q: { x: number; y: number }, r: number) {
    const { ctx } = this;
    const D = Math.PI / 180;
    ctx.save();
    ctx.filter = `blur(${Math.max(0.6, r * 0.03).toFixed(1)}px)`;
    ctx.fillStyle = 'rgba(88, 88, 98, 0.36)';
    for (const [lat, lon, rad] of MARIA) {
      const c = { x: Math.cos(lat * D) * Math.sin(lon * D), y: Math.sin(lat * D), z: Math.cos(lat * D) * Math.cos(lon * D) };
      // Two directions square to the centre, for the circle round it
      const e1n = Math.hypot(c.z, c.x) || 1;
      const e1 = { x: c.z / e1n, y: 0, z: -c.x / e1n };
      const e2 = { x: c.y * e1.z - c.z * e1.y, y: c.z * e1.x - c.x * e1.z, z: c.x * e1.y - c.y * e1.x };
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * 2 * Math.PI, cr = Math.cos(rad * D), sr = Math.sin(rad * D);
        let x = cr * c.x + sr * (Math.cos(a) * e1.x + Math.sin(a) * e2.x);
        let y = cr * c.y + sr * (Math.cos(a) * e1.y + Math.sin(a) * e2.y);
        const z = cr * c.z + sr * (Math.cos(a) * e1.z + Math.sin(a) * e2.z);
        if (z < 0) { const n = Math.hypot(x, y) || 1; x /= n; y /= n; } // beyond the edge: onto the edge
        if (i === 0) ctx.moveTo(q.x + x * r, q.y - y * r); else ctx.lineTo(q.x + x * r, q.y - y * r);
      }
      ctx.fill();
    }
    // Tycho, the bright young crater in the south
    ctx.fillStyle = 'rgba(255, 255, 250, 0.4)';
    const ty = { lat: -43.3 * D, lon: -11.2 * D };
    ctx.beginPath();
    ctx.arc(q.x + Math.cos(ty.lat) * Math.sin(ty.lon) * r, q.y - Math.sin(ty.lat) * r, Math.max(1, r * 0.035), 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  /** A faint edge round the Moon, so its dark part shows against the sky (near new Moon, all of it). */
  private moonRim(q: { x: number; y: number }, r: number) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(200, 205, 220, 0.28)';
    ctx.lineWidth = 1.5 * this.k;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
    ctx.stroke();
  }

  private drawShadow(p: Projection, center: Vec3, radii: { umbra: number; penumbra: number }) {
    const c = project(p, center);
    if (!c) return;
    const { ctx } = this;
    const rp = this.radiusPx(p, center, radii.penumbra), ru = this.radiusPx(p, center, radii.umbra);
    ctx.lineWidth = 2 * this.k;
    ctx.setLineDash([8 * this.k, 8 * this.k]);
    ctx.strokeStyle = 'rgba(154, 160, 180, 0.45)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rp, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(224, 96, 58, 0.6)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, ru, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(10, 10, 20, 0.25)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, ru, 0, 2 * Math.PI);
    ctx.fill();
    this.label({ x: c.x, y: c.y - ru - 18 * this.k }, 0, t().video.earthShadow, 26 * this.k, DIM_COLOR);
  }

  /** The angle between two bodies, along the great circle, with its size half way. */
  private drawArc(p: Projection, a: Vec3, b: Vec3) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2 * this.k;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const v = { x: a.x * (1 - u) + b.x * u, y: a.y * (1 - u) + b.y * u, z: a.z * (1 - u) + b.z * u };
      const len = Math.hypot(v.x, v.y, v.z);
      const q = project(p, { x: v.x / len, y: v.y / len, z: v.z / len });
      if (!q) continue;
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    const m = project(p, midpoint(a, b));
    if (m) this.label({ x: m.x, y: m.y + 34 * this.k }, 0, `${num(angleBetween(a, b), 1)}°`, 32 * this.k, '#ffffff');
  }

  /** A bar of a round number of degrees, bottom left, so the chart's size can be read. */
  private drawScale(p: Projection) {
    const { ctx, canvas } = this;
    const ppd = pixelsPerDegree(p);
    const want = canvas.width * 0.12 / ppd;
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
    const deg = steps.reduce((best, s) => (Math.abs(Math.log(s / want)) < Math.abs(Math.log(best / want)) ? s : best), steps[0]);
    const len = deg * ppd, x0 = 40 * this.k, y0 = canvas.height - 40 * this.k;
    ctx.strokeStyle = DIM_COLOR;
    ctx.lineWidth = 2 * this.k;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 8 * this.k); ctx.lineTo(x0, y0); ctx.lineTo(x0 + len, y0); ctx.lineTo(x0 + len, y0 - 8 * this.k);
    ctx.stroke();
    ctx.font = `${Math.round(22 * this.k)}px "Inter", "Noto Sans Arabic", system-ui, sans-serif`;
    ctx.fillStyle = DIM_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.direction = 'ltr';
    ctx.fillText(`${num(deg, deg < 1 ? 1 : 0)}°`, x0 + len / 2, y0 - 10 * this.k);
  }

  /**
   * An asteroid passing the Earth, to scale: the Earth, the Moon's distance, and the asteroid crossing at its
   * closest distance, moving along its path during the shot (u from 0 to 1). Sizes are enlarged. The Earth is on
   * the side where the language starts, the caption's side, so the asteroid's path stays clear of the caption.
   */
  drawDistance(shot: DistanceShot, u: number, name: string) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, k = this.k;
    const rtl = lang() === 'ar';
    ctx.save();
    ctx.fillStyle = '#070912';
    ctx.fillRect(0, 0, W, H);
    const ld = shot.distAu / LD_AU;
    const tall = H > W;
    // The Earth on one side, the farthest of the Moon's distance and the asteroid's at 80% of the way
    const y0 = H * (tall ? 0.42 : 0.5);
    const span = W * (tall ? 0.72 : 0.76);
    const px = span / Math.max(ld, 1);
    const X = (d: number) => (rtl ? W * (tall ? 0.86 : 0.9) - d * px : W * (tall ? 0.14 : 0.1) + d * px);
    const x0 = X(0), xMoon = X(1), xAst = X(ld), dir = rtl ? -1 : 1;
    ctx.strokeStyle = 'rgba(154, 160, 180, 0.5)';
    ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(X(Math.max(ld, 1) * 1.04), y0); ctx.stroke();
    // Ticks every lunar distance (or every 0.1 of one below one), numbered
    const tick = ld > 12 ? 5 : ld > 1 ? 1 : 0.1;
    ctx.font = `${Math.round(20 * k)}px "Inter", "Noto Sans Arabic", system-ui, sans-serif`;
    ctx.fillStyle = DIM_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.direction = 'ltr';
    for (let d = tick; d <= Math.max(ld, 1) + 1e-9; d += tick) {
      ctx.beginPath(); ctx.moveTo(X(d), y0 - 6 * k); ctx.lineTo(X(d), y0 + 6 * k); ctx.stroke();
      const nearAst = Math.abs(X(d) - xAst) < 40 * k, nearMoon = Math.abs(d - 1) < 1e-9;
      if (!nearAst && !nearMoon && tick >= 1) ctx.fillText(num(d, 0), X(d), y0 + 14 * k);
    }
    // The Moon's orbit as an arc round the Earth, the Moon on it
    ctx.setLineDash([6 * k, 8 * k]);
    ctx.beginPath();
    if (rtl) ctx.arc(x0, y0, px, Math.PI - 0.6, Math.PI + 0.6); else ctx.arc(x0, y0, px, -0.6, 0.6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#c9c6bd'; ctx.beginPath(); ctx.arc(xMoon, y0, 10 * k, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = COLORS.earth; ctx.beginPath(); ctx.arc(x0, y0, 22 * k, 0, 2 * Math.PI); ctx.fill();
    // The asteroid's path, square to the line, and the asteroid moving along it
    const reach = H * 0.32;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.setLineDash([10 * k, 8 * k]);
    ctx.beginPath(); ctx.moveTo(xAst, y0 - reach); ctx.lineTo(xAst, y0 + reach); ctx.stroke();
    ctx.setLineDash([]);
    const ya = y0 - reach + 2 * reach * u;
    ctx.fillStyle = '#e891b0'; ctx.beginPath(); ctx.arc(xAst, ya, 9 * k, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
    // Names (the caption gives the numbers), and that it is to scale
    const s = t();
    this.label({ x: x0, y: y0 + 50 * k }, 0, s.planets.earth, 28 * k, LABEL_COLOR, true);
    this.label({ x: xMoon + dir * 8 * k, y: y0 - 42 * k }, 0, `${s.events.moonName} · ${numGrouped(LD_AU * AU_KM)} ${s.km}`, 24 * k, DIM_COLOR, true);
    this.label({ x: xAst, y: y0 - reach - 26 * k }, 0, name, 28 * k, '#e891b0', true);
    this.label({ x: (x0 + xAst) / 2, y: y0 + 64 * k }, 0, s.video.scaleNote, 20 * k, DIM_COLOR, true);
  }

  /**
   * Where the bright planets are this week, on a dial round the Earth: the Sun at the top, each planet (and the
   * Moon) at its angle from the Sun along the ecliptic, the evening sky (east of the Sun) on the left as on the
   * charts, the morning sky on the right, all night at the bottom. Wide: the dial sits on the side away from the
   * caption. The planets and the Moon move as the week's clock runs (ms).
   */
  drawPlanets(_shot: PlanetsShot, ms: number) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, k = this.k;
    const tall = H > W, rtl = lang() === 'ar';
    const cx = tall ? W / 2 : W * (rtl ? 0.3 : 0.7), cy = tall ? H * 0.39 : H * 0.47, R = tall ? W * 0.32 : H * 0.27;
    // East of the Sun (lon > 0) to the left, the Sun at the top
    const at = (lon: number, r = R) => ({ x: cx - r * Math.sin(lon * Math.PI / 180), y: cy - r * Math.cos(lon * Math.PI / 180) });
    ctx.save();
    this.background();
    // The Sun's glare: a soft wedge at the top
    const g = ctx.createRadialGradient(cx, cy - R, 0, cx, cy - R, R * 0.75);
    g.addColorStop(0, 'rgba(255, 214, 90, 0.22)');
    g.addColorStop(1, 'rgba(255, 214, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R * 1.25, -Math.PI / 2 - GLARE_DEG * Math.PI / 180, -Math.PI / 2 + GLARE_DEG * Math.PI / 180);
    ctx.closePath();
    ctx.fill();
    // The circle, ticks every 45°
    ctx.strokeStyle = 'rgba(154, 160, 180, 0.5)';
    ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    for (let a = 0; a < 360; a += 45) {
      const p0 = at(a, R - 8 * k), p1 = at(a, R + 8 * k);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // Which part is which, inside the circle
    const s = t().video;
    ctx.font = `600 ${Math.round(26 * k)}px "Inter", "Noto Sans Arabic", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(159, 195, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [text, lon] of [[s.planetsAxis.evening, 90], [s.planetsAxis.morning, -90], [s.planetsAxis.night, 180]] as [string, number][]) {
      ctx.direction = /[\u0600-\u06ff]/.test(text) ? 'rtl' : 'ltr';
      const q = at(lon, R * 0.62);
      ctx.fillText(text, q.x, q.y);
    }
    // The Earth in the middle, lit on the Sun's side
    const re = 15 * k;
    ctx.fillStyle = '#1b2a4a';
    ctx.beginPath(); ctx.arc(cx, cy, re, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = COLORS.earth;
    ctx.beginPath(); ctx.arc(cx, cy, re, Math.PI, 2 * Math.PI); ctx.fill();
    // The Sun at the top
    const sun = at(0), rs = 18 * k;
    const glow = ctx.createRadialGradient(sun.x, sun.y, rs * 0.8, sun.x, sun.y, rs * 4.5);
    glow.addColorStop(0, 'rgba(255, 214, 90, 0.5)');
    glow.addColorStop(1, 'rgba(255, 190, 70, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, rs * 4.5, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = SUN_COLOR;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, rs, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();

    // The Moon and the planets on the circle, their names outside it, pushed further out where they would overlap
    const moonLon = wrap180(moonPhaseAngle(ms));
    const items: { lon: number; r: number; name: string; dim: boolean }[] = [];
    const mr = 13 * k;
    const mq = at(moonLon);
    this.phaseDisc(mq, mr, moonLit(ms), Math.atan2(sun.y - mq.y, sun.x - mq.x));
    items.push({ lon: moonLon, r: mr, name: t().events.moonName, dim: false });
    for (const p of planetsOfWeek(ms, ms)) {
      const inGlare = Math.abs(p.lon) < GLARE_DEG;
      ctx.save();
      if (inGlare) ctx.globalAlpha = 0.55;
      this.drawPlanet(at(p.lon), p.body, p.mag, true);
      ctx.restore();
      items.push({ lon: p.lon, r: planetRadius(p.mag) * k, name: t().planets[p.body], dim: inGlare });
    }
    items.push({ lon: 0, r: rs, name: s.sunName, dim: false });
    const size = 28 * k;
    ctx.font = `600 ${Math.round(size)}px "Inter", "Noto Sans Arabic", system-ui, sans-serif`;
    // Kept clear of: the clock and the name at the top, the caption at the bottom (wide: on the language's start side)
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const caption: Box = tall ? { x0: 0, y0: 0.66 * H, x1: W, y1: H } : rtl ? { x0: 0.52 * W, y0: 0.6 * H, x1: W, y1: H } : { x0: 0, y0: 0.6 * H, x1: 0.48 * W, y1: H };
    const fits = (b: Box) => b.y0 > 0.14 * H && b.x0 > 8 * k && b.x1 < W - 8 * k && !hits(b, caption);
    const boxes: Box[] = [];
    for (const it of [...items].sort((a, b) => Math.abs(a.lon) - Math.abs(b.lon))) {
      const w = ctx.measureText(it.name).width;
      const dot = at(it.lon), sx = Math.sin(it.lon * Math.PI / 180);
      const box = (x0: number, yc: number): Box => ({ x0: x0 - 4 * k, y0: yc - size * 0.6, x1: x0 + w + 4 * k, y1: yc + size * 0.6 });
      const tries: Box[] = [];
      // Beside the dot, away from the middle (near the top, where names would otherwise climb into the clock) ...
      const side = it.lon === 0 ? 0 : sx > 0 ? -1 : 1, gap = Math.max(it.r, 9 * k) + 12 * k;
      if (side !== 0 && Math.abs(it.lon) < 40) for (const j of [0, 1, -1, 2, 3]) tries.push(box(side < 0 ? dot.x - gap - w : dot.x + gap, dot.y + j * (size + 4 * k)));
      // ... or outward from the circle, further out where needed
      for (let step = 0; step < 5; step++) {
        const q = at(it.lon, R + gap + 6 * k + step * (size + 6 * k));
        tries.push(box(sx > 0.25 ? q.x - w : sx < -0.25 ? q.x : q.x - w / 2, q.y));
      }
      const b = tries.find((x) => fits(x) && !boxes.some((o) => hits(o, x)));
      if (!b) continue;
      boxes.push(b);
      this.label({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, 0, it.name, size, it.dim ? DIM_COLOR : LABEL_COLOR, true);
    }
  }

  /** A small Moon with its phase: lit part lit (0 to 1), facing the Sun at the screen angle sunAngle [rad]. */
  private phaseDisc(q: { x: number; y: number }, r: number, lit: number, sunAngle: number) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = MOON_DARK;
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 2 * Math.PI); ctx.fill();
    ctx.translate(q.x, q.y);
    ctx.rotate(sunAngle);
    ctx.fillStyle = MOON_LIT;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(0, 0, Math.max(r * Math.abs(2 * lit - 1), 0.01), r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5);
    ctx.fill();
    ctx.restore();
    this.moonRim(q, r);
  }
}
