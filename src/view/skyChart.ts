// The sky seen from the Earth, drawn for the video (phase 8, step 2): the stars of the Yale catalogue, the
// ecliptic, the Sun with its glow, the Moon with its lit part facing the Sun (and the Earth's shadow on it in a
// lunar eclipse), and the planets as dots by brightness, on a stereographic chart (src/video/sky.ts).
// Also the scale drawing for an asteroid passing the Earth. Everything is drawn from the time given, so the same
// time always gives the same picture.

import { equatorialToEcliptic } from '../astro/frames';
import { num, numGrouped, lang, t } from '../i18n';
import { COLORS } from './views';
import { kelvinToRgb, starLook } from './stars';
import { BRIGHT_PLANETS, EVENT_PLANETS, type EventPlanet } from '../events/events';
import {
  angleBetween, discRadius, midpoint, moonLit, opposite, pixelsPerDegree, planetMag, project, projection, screenDirection,
  shadowRadii, skyVector, fromLonLat, lonLat, type Projection, type SkyBody,
} from '../video/sky';
import type { DistanceShot, SkyShot } from '../video/scenes';
import type { Vec3 } from '../astro/kepler';
import { LD_AU, AU_KM } from '../live/closeApproaches';

const SUN_COLOR = '#ffd65a';
const MOON_LIT = '#f2efe6';
const MOON_DARK = '#23252e';
const ECLIPTIC_COLOR = 'rgba(255, 214, 90, 0.35)';
const LABEL_COLOR = '#e8e8f0';
const DIM_COLOR = '#9aa0b4';

interface Star { v: Vec3; r: number; alpha: number; color: string }

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
      const look = starLook(mag);
      const [r, g, b] = kelvinToRgb(kelvin).map((x) => Math.round(x * 255));
      this.stars.push({ v: equatorialToEcliptic(ra, dec), r: look.size / 2, alpha: look.alpha, color: `rgb(${r},${g},${b})` });
    }
  }

  /** Scale for text and dots: 1 at 1080 pixels on the short side. */
  private get k() { return Math.min(this.canvas.width, this.canvas.height) / 1080; }

  draw(shot: SkyShot, ms: number, fov: number) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, k = this.k;
    // The centre a little above the middle: the caption sits at the bottom
    const p = projection(chartCenter(shot, ms), fov, W, H, H * (H > W ? 0.38 : 0.42));
    ctx.save();
    ctx.direction = lang() === 'ar' ? 'rtl' : 'ltr';
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05070f');
    sky.addColorStop(1, '#0b1024');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of this.stars) {
      const q = project(p, s.v);
      if (!q || q.x < -10 || q.y < -10 || q.x > W + 10 || q.y > H + 10) continue;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, s.r * 1.25 * k, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.drawEcliptic(p);

    const place = shot.place;
    const sun = skyVector('sun', ms, place), moon = skyVector('moon', ms, place);
    if (shot.shadow) this.drawShadow(p, opposite(skyVector('sun', ms).dir), shadowRadii(skyVector('moon', ms).au, sun.au));
    if (shot.arc) this.drawArc(p, skyVector(shot.arc[0], ms, place).dir, skyVector(shot.arc[1], ms, place).dir);

    // The Sun, the planets, then the Moon (in front of them all)
    this.drawSun(p, sun.dir, discRadius('sun', sun.au));
    for (const pl of EVENT_PLANETS) {
      const v = skyVector(pl, ms, place).dir;
      const q = project(p, v);
      if (!q || q.x < -20 || q.y < -20 || q.x > W + 20 || q.y > H + 20) continue;
      this.drawPlanet(q, pl, planetMag(pl, ms), shot.focus.includes(pl) || BRIGHT_PLANETS.includes(pl));
    }
    this.drawMoon(p, moon.dir, discRadius('moon', moon.au), sun.dir, ms, shot.shadow ? { center: opposite(skyVector('sun', ms).dir), ...shadowRadii(skyVector('moon', ms).au, sun.au) } : null, shot.place !== undefined);

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

  private label(q: { x: number; y: number }, r: number, text: string, size: number, color: string) {
    const { ctx } = this;
    ctx.font = `600 ${Math.round(size)}px "Noto Sans Arabic", "Segoe UI", system-ui, sans-serif`;
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
    // Its name near the left edge, on the line
    const q = project(p, fromLonLat(c.lon + this.halfWidthDeg(p) * 0.88, 0));
    if (q && q.y > 40 && q.y < canvas.height - 40) {
      ctx.font = `${Math.round(22 * this.k)}px "Noto Sans Arabic", "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = ECLIPTIC_COLOR.replace('0.35', '0.7');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t().video.ecliptic, q.x, q.y - 6 * this.k);
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

  private drawSun(p: Projection, v: Vec3, radiusDeg: number) {
    const q = project(p, v);
    if (!q) return;
    const { ctx } = this;
    const r = Math.max(12 * this.k, this.radiusPx(p, v, radiusDeg));
    const glow = ctx.createRadialGradient(q.x, q.y, r * 0.8, q.x, q.y, r * 6);
    glow.addColorStop(0, 'rgba(255, 214, 90, 0.55)');
    glow.addColorStop(0.35, 'rgba(255, 190, 70, 0.16)');
    glow.addColorStop(1, 'rgba(255, 190, 70, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r * 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = SUN_COLOR;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, 2 * Math.PI);
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
    ctx.fillStyle = MOON_LIT;
    ctx.beginPath();
    // Lit half towards +x (the Sun), from the top round the right to the bottom, back along the terminator
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    const b = r * Math.abs(2 * lit - 1);
    ctx.ellipse(0, 0, Math.max(b, 0.01), r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shadow) {
      const c = project(p, shadow.center);
      if (c) {
        const rp = this.radiusPx(p, shadow.center, shadow.penumbra), ru = this.radiusPx(p, shadow.center, shadow.umbra);
        ctx.fillStyle = 'rgba(10, 10, 20, 0.35)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, rp, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(120, 32, 14, 0.88)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, ru, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();
    this.moonRim(q, r);
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
    ctx.font = `${Math.round(22 * this.k)}px "Noto Sans Arabic", "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = DIM_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.direction = 'ltr';
    ctx.fillText(`${num(deg, deg < 1 ? 1 : 0)}°`, x0 + len / 2, y0 - 10 * this.k);
  }

  /**
   * An asteroid passing the Earth, to scale: the Earth, the Moon's distance, and the asteroid crossing at its
   * closest distance, moving along its path during the shot (u from 0 to 1). Sizes are enlarged.
   */
  drawDistance(shot: DistanceShot, u: number, name: string) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height, k = this.k;
    ctx.save();
    ctx.fillStyle = '#070912';
    ctx.fillRect(0, 0, W, H);
    const ld = shot.distAu / LD_AU;
    const tall = H > W;
    // The Earth on one side, the farthest of the Moon's distance and the asteroid's at 80% of the way
    const x0 = W * (tall ? 0.14 : 0.1), y0 = H * (tall ? 0.42 : 0.5);
    const span = W * (tall ? 0.72 : 0.78);
    const px = span / Math.max(ld, 1);
    const xMoon = x0 + px, xAst = x0 + ld * px;
    ctx.strokeStyle = 'rgba(154, 160, 180, 0.5)';
    ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + span * 1.04, y0); ctx.stroke();
    // Ticks every lunar distance (or every 0.1 of one below one)
    const tick = ld > 12 ? 5 : ld > 1 ? 1 : 0.1;
    for (let d = tick; d <= Math.max(ld, 1) + 1e-9; d += tick) {
      ctx.beginPath(); ctx.moveTo(x0 + d * px, y0 - 6 * k); ctx.lineTo(x0 + d * px, y0 + 6 * k); ctx.stroke();
    }
    // The Moon's orbit as an arc round the Earth, the Moon on it
    ctx.setLineDash([6 * k, 8 * k]);
    ctx.beginPath(); ctx.arc(x0, y0, px, -0.6, 0.6); ctx.stroke();
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
    // Names (the overlay gives the numbers)
    const s = t();
    this.label({ x: x0, y: y0 + 46 * k }, 0, s.planets.earth, 28 * k, LABEL_COLOR);
    this.label({ x: xMoon - 20 * k, y: y0 - 40 * k }, 0, `${s.events.moonName} · ${numGrouped(LD_AU * AU_KM)} ${s.km}`, 24 * k, DIM_COLOR);
    this.label({ x: xAst, y: y0 - reach - 26 * k }, 0, name, 28 * k, '#e891b0');
  }
}
