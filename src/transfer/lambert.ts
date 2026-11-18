// Trip planner (phase 6), step 2: Lambert's problem. Given where the craft starts (r1), where it must be (r2)
// and how long it may take, find the orbit round the Sun that joins them: the velocity it needs at the start
// and the one it has at the end. With the planets' real positions on two real dates, that is a real trip,
// on their stretched and tilted orbits, not the circles of the Hohmann estimate.
//
// Method: universal variables (Vallado, Fundamentals of Astrodynamics and Applications, algorithm "Lambert,
// universal variables"; the same equations as Curtis, algorithm 5.2). For less than one revolution the time
// of flight grows steadily with psi, so the answer is bracketed and found with the Illinois method (regula falsi
// that halves a stale end), falling back to bisection: a few iterations instead of some sixty.
//
// Step 6: a trip may also go round the Sun once or more before it arrives (multi-revolution). For N whole
// turns the time of flight, as psi runs from (2πN)² to (2π(N+1))², falls from endless to a least time and
// rises to endless again, so a long enough time has two answers (Vallado, "Lambert, universal variables",
// multiple revolutions). A trip takes the one of all of them (none to MAX_REVS turns) with the lowest launch
// speed, as JPL's Small-Body Mission Design tool does: npm run check finds its trips, to the rounding of its numbers.

import * as Astronomy from 'astronomy-engine';
import { stumpff } from '../physics/orbit';
import { AU_KM, SUN_GM } from '../physics/bodies';
import { PARKING_ALT_KM, RADIUS_KM, hyperbolicBurn, planetGm } from './hohmann';
import { BODY, EQJ_TO_ECL } from '../astro/reference';
import type { PlanetId } from '../astro/elements';

export type Vec = [number, number, number];

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec) => Math.sqrt(dot(a, a));
const TWO_PI = 2 * Math.PI;

export interface Lambert {
  /** Velocity at the start and at the end [same units as mu and r: km/s with km³/s² and km]. */
  v1: Vec; v2: Vec;
  /** The angle swept round the central body after the whole turns [deg]: below 180 the short way, above it the long way. */
  angleDeg: number;
  /** Whole turns round the central body before that (0: less than one turn in all). */
  revs: number;
}

/** At most this many whole turns round the Sun, as JPL's mission design tool (npm run check: four, not three or five). */
export const MAX_REVS = 4;

/**
 * The orbit from r1 to r2 in tof seconds round a body of GM mu (km, km³/s², s), going round the same way
 * as the planets (prograde: anticlockwise seen from the north of the ecliptic). Null when there is no
 * single answer: start and end exactly opposite (or at the same place), or a time that is not positive.
 */
export function lambert(mu: number, r1: Vec, r2: Vec, tof: number): Lambert | null {
  const R1 = norm(r1), R2 = norm(r2);
  if (!(tof > 0) || !(R1 > 0) || !(R2 > 0)) return null;
  const cosDnu = Math.min(1, Math.max(-1, dot(r1, r2) / (R1 * R2)));
  let dnu = Math.acos(cosDnu);
  if (r1[0] * r2[1] - r1[1] * r2[0] < 0) dnu = TWO_PI - dnu; // the long way round
  const A = (dnu < Math.PI ? 1 : -1) * Math.sqrt(R1 * R2 * (1 + cosDnu));
  if (Math.abs(A) < 1e-9 * Math.max(R1, R2)) return null;
  const sq = Math.sqrt(mu);

  // Time of flight for a given psi; NaN where the orbit cannot exist (y < 0: psi too small)
  const flight = (psi: number) => {
    const [c2, c3] = stumpff(psi);
    const y = R1 + R2 + (A * (psi * c3 - 1)) / Math.sqrt(c2);
    if (y < 0) return { t: -Infinity, y, c2 };
    const chi = Math.sqrt(y / c2);
    return { t: (chi ** 3 * c3 + A * Math.sqrt(y)) / sq, y, c2 };
  };

  // A bracket: below lo the trip is too short (or impossible), at hi too long. 4π² is a whole revolution,
  // where the time is endless, so hi starts just short of it.
  let lo = -4 * Math.PI, hi = 4 * Math.PI * Math.PI * (1 - 1e-9);
  for (let k = 0; k < 60 && flight(lo).t > tof; k++) lo *= 2; // a very fast (hyperbolic) trip
  let flo = flight(lo).t - tof, fhi = flight(hi).t - tof;
  let y = NaN, side = 0;
  for (let it = 0; it < 300; it++) {
    // Regula falsi while both ends have a time; bisection otherwise, or when it would not move inside
    let psi = Number.isFinite(flo) && Number.isFinite(fhi) ? (lo * fhi - hi * flo) / (fhi - flo) : (lo + hi) / 2;
    if (!(psi > lo && psi < hi)) psi = (lo + hi) / 2;
    const f = flight(psi);
    y = f.y;
    const d = f.t - tof;
    if (Math.abs(d) <= 1e-11 * tof || hi - lo < 1e-14) break;
    if (d < 0) {
      lo = psi; flo = d;
      if (side === -1) fhi /= 2; // the high end stayed twice: halve it (Illinois)
      side = -1;
    } else {
      hi = psi; fhi = d;
      if (side === 1) flo /= 2;
      side = 1;
    }
  }
  if (!(y > 0)) return null;
  const f = 1 - y / R1, g = A * Math.sqrt(y / mu), gdot = 1 - y / R2;
  const v1: Vec = [0, 1, 2].map((k) => (r2[k] - f * r1[k]) / g) as Vec;
  const v2: Vec = [0, 1, 2].map((k) => (gdot * r2[k] - r1[k]) / g) as Vec;
  return v1.every(Number.isFinite) && v2.every(Number.isFinite) ? { v1, v2, angleDeg: (dnu * 180) / Math.PI, revs: 0 } : null;
}

/**
 * The orbits from r1 to r2 in tof seconds that first go `revs` whole turns round the body (revs ≥ 1), prograde:
 * none if the time is too short for that many turns, else two (the faster turns of a smaller orbit, and a larger
 * one), and none for ends exactly opposite or at the same place.
 */
export function lambertRevs(mu: number, r1: Vec, r2: Vec, tof: number, revs: number): Lambert[] {
  const R1 = norm(r1), R2 = norm(r2);
  if (!(tof > 0) || !(R1 > 0) || !(R2 > 0) || !(revs >= 1)) return [];
  const cosDnu = Math.min(1, Math.max(-1, dot(r1, r2) / (R1 * R2)));
  let dnu = Math.acos(cosDnu);
  if (r1[0] * r2[1] - r1[1] * r2[0] < 0) dnu = TWO_PI - dnu;
  const A = (dnu < Math.PI ? 1 : -1) * Math.sqrt(R1 * R2 * (1 + cosDnu));
  if (Math.abs(A) < 1e-9 * Math.max(R1, R2)) return [];
  // No orbit through both ends is smaller than the minimum-energy ellipse (a = s/2): too little time for its turns, no answer
  const s = (R1 + R2 + norm([r2[0] - r1[0], r2[1] - r1[1], r2[2] - r1[2]])) / 2;
  if (tof <= revs * TWO_PI * Math.sqrt((s / 2) ** 3 / mu)) return [];
  const sq = Math.sqrt(mu);
  // Here y stays positive (between R1 + R2 ∓ √2·|A|), so every psi has a time
  const yOf = (psi: number) => { const [c2, c3] = stumpff(psi); return { y: R1 + R2 + (A * (psi * c3 - 1)) / Math.sqrt(c2), c2, c3 }; };
  const flight = (psi: number) => { const { y, c2, c3 } = yOf(psi); return ((y / c2) ** 1.5 * c3 + A * Math.sqrt(y)) / sq; };
  const lo0 = (TWO_PI * revs) ** 2, hi0 = (TWO_PI * (revs + 1)) ** 2, edge = 1e-12 * hi0;
  // The least time: golden-section search
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo0 + edge, b = hi0 - edge, c = b - g * (b - a), d = a + g * (b - a), fc = flight(c), fd = flight(d);
  while (b - a > 1e-12 * hi0) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = flight(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = flight(d); }
  }
  const psiMin = (a + b) / 2;
  if (!(tof > flight(psiMin))) return [];
  // Each side of it the time runs one way only: bisection to the time asked
  const solve = (lo: number, hi: number, falling: boolean) => {
    for (let it = 0; it < 200 && hi - lo > 1e-15 * hi0; it++) {
      const m = (lo + hi) / 2;
      if ((flight(m) > tof) === falling) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };
  const out: Lambert[] = [];
  for (const psi of [solve(lo0 + edge, psiMin, true), solve(psiMin, hi0 - edge, false)]) {
    const { y } = yOf(psi);
    const f = 1 - y / R1, gg = A * Math.sqrt(y / mu), gdot = 1 - y / R2;
    const v1: Vec = [0, 1, 2].map((k) => (r2[k] - f * r1[k]) / gg) as Vec;
    const v2: Vec = [0, 1, 2].map((k) => (gdot * r2[k] - r1[k]) / gg) as Vec;
    if (v1.every(Number.isFinite) && v2.every(Number.isFinite)) out.push({ v1, v2, angleDeg: (dnu * 180) / Math.PI, revs });
  }
  return out;
}

/** Every prograde orbit from r1 to r2 in tof seconds with none to maxRevs whole turns first. */
export function lambertAll(mu: number, r1: Vec, r2: Vec, tof: number, maxRevs = MAX_REVS): Lambert[] {
  const zero = lambert(mu, r1, r2, tof);
  const all = zero ? [zero] : [];
  for (let n = 1; n <= maxRevs; n++) {
    const more = lambertRevs(mu, r1, r2, tof, n);
    if (!more.length) break; // more turns need even more time
    all.push(...more);
  }
  return all;
}

const UNIX_EPOCH_JD = 2440587.5;
const DAY_S = 86400;

/**
 * A planet's position [km] and velocity [km/s] round the Sun (its centre, not its system's barycentre),
 * J2000 ecliptic frame, from Astronomy Engine (VSOP87, about an arcminute): more exact than the Kepler
 * elements the site draws with, and this is what a trip is planned from.
 */
export function planetState(id: PlanetId, jd: number): { r: Vec; v: Vec } {
  const s = Astronomy.RotateState(EQJ_TO_ECL, Astronomy.HelioState(BODY[id], new Date((jd - UNIX_EPOCH_JD) * DAY_S * 1000)));
  return {
    r: [s.x * AU_KM, s.y * AU_KM, s.z * AU_KM],
    v: [(s.vx * AU_KM) / DAY_S, (s.vy * AU_KM) / DAY_S, (s.vz * AU_KM) / DAY_S],
  };
}

const ECL_TO_EQJ = Astronomy.Rotation_ECL_EQJ();

/** A ballistic flight round the Sun between two states: what any trip needs, whatever its target. */
export interface Flight {
  departJd: number; arriveJd: number; tofDays: number;
  /** The angle swept round the Sun after the whole turns [deg], the turns, and the type: I below 180°, II above. */
  angleDeg: number; revs: number; type: 1 | 2;
  /** Speed relative to the Earth when leaving and to the target when arriving, far from each (v∞) [km/s], and their vectors. */
  vInfDepart: number; vInfArrive: number; inf1: Vec; inf2: Vec;
  /** Declination of the launch direction (v∞ when leaving), J2000 equator [deg]: where a rocket must aim. */
  dla: number;
  /** The craft's state round the Sun when it leaves (km, km/s): its whole path follows from it. */
  r1: Vec; v1: Vec;
}

/**
 * The flight from the Earth's state at departure to the target's at arrival (km, km/s), or null if there is none:
 * of all the orbits with none to MAX_REVS whole turns, the one with the lowest launch speed.
 */
export function flightBetween(departJd: number, arriveJd: number, e: { r: Vec; v: Vec }, p: { r: Vec; v: Vec }): Flight | null {
  let best: { l: Lambert; inf1: Vec; vInf: number } | null = null;
  for (const l of lambertAll(SUN_GM, e.r, p.r, (arriveJd - departJd) * DAY_S)) {
    const inf1: Vec = [0, 1, 2].map((k) => l.v1[k] - e.v[k]) as Vec;
    const vInf = norm(inf1);
    if (!best || vInf < best.vInf) best = { l, inf1, vInf };
  }
  if (!best) return null;
  const { l, inf1 } = best;
  const inf2: Vec = [0, 1, 2].map((k) => l.v2[k] - p.v[k]) as Vec;
  const eq = Astronomy.RotateVector(ECL_TO_EQJ, new Astronomy.Vector(inf1[0], inf1[1], inf1[2], new Astronomy.AstroTime(0)));
  return {
    departJd, arriveJd, tofDays: arriveJd - departJd, angleDeg: l.angleDeg, revs: l.revs, type: l.angleDeg < 180 ? 1 : 2,
    vInfDepart: best.vInf, vInfArrive: norm(inf2), inf1, inf2,
    dla: (Math.asin(eq.z / best.vInf) * 180) / Math.PI,
    r1: e.r, v1: l.v1,
  };
}

export interface RealTrip extends Flight {
  target: PlanetId;
  /** Launch energy: v∞² leaving the Earth [km²/s²]. */
  c3: number;
  /** Burns from a 300 km orbit round the Earth and into one round the target, and both [km/s]. */
  leave: number; arrive: number; total: number;
}

/** A ballistic trip from the Earth to a planet, leaving at departJd and arriving at arriveJd (Julian Dates). */
export function realTrip(target: PlanetId, departJd: number, arriveJd: number): RealTrip | null {
  if (!(arriveJd > departJd)) return null;
  return tripFromStates(target, departJd, arriveJd, planetState('earth', departJd), planetState(target, arriveJd));
}

/** The same, from the Earth's state at departure and the target's at arrival (a porkchop grid reuses them). */
export function tripFromStates(target: PlanetId, departJd: number, arriveJd: number, e: { r: Vec; v: Vec }, p: { r: Vec; v: Vec }): RealTrip | null {
  const f = flightBetween(departJd, arriveJd, e, p);
  if (!f) return null;
  const leave = hyperbolicBurn(f.vInfDepart, planetGm('earth'), RADIUS_KM.earth + PARKING_ALT_KM);
  const arrive = hyperbolicBurn(f.vInfArrive, planetGm(target), RADIUS_KM[target] + PARKING_ALT_KM);
  return { ...f, target, c3: f.vInfDepart ** 2, leave, arrive, total: leave + arrive };
}
