// Trip planner (phase 6), step 2: Lambert's problem. Given where the craft starts (r1), where it must be (r2)
// and how long it may take, find the orbit round the Sun that joins them: the velocity it needs at the start
// and the one it has at the end. With the planets' real positions on two real dates, that is a real trip,
// on their stretched and tilted orbits, not the circles of the Hohmann estimate.
//
// Method: universal variables (Vallado, Fundamentals of Astrodynamics and Applications, algorithm "Lambert,
// universal variables"; the same equations as Curtis, algorithm 5.2). For less than one revolution the time
// of flight grows steadily with psi, so the answer is bracketed and found with the Illinois method (regula falsi
// that halves a stale end), falling back to bisection: a few iterations instead of some sixty.

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
  /** The angle swept round the central body [deg]: below 180 the short way, above it the long way. */
  angleDeg: number;
}

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
  return v1.every(Number.isFinite) && v2.every(Number.isFinite) ? { v1, v2, angleDeg: (dnu * 180) / Math.PI } : null;
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

export interface RealTrip {
  target: PlanetId;
  departJd: number; arriveJd: number; tofDays: number;
  /** The angle swept round the Sun [deg], and the type of trip: I below 180°, II above. */
  angleDeg: number; type: 1 | 2;
  /** Launch energy: v∞² leaving the Earth [km²/s²]. */
  c3: number;
  /** Speed relative to the Earth when leaving and to the target when arriving, far from each (v∞) [km/s]. */
  vInfDepart: number; vInfArrive: number;
  /** Burns from a 300 km orbit round the Earth and into one round the target, and both [km/s]. */
  leave: number; arrive: number; total: number;
  /** Declination of the launch direction (v∞ when leaving), J2000 equator [deg]: where a rocket must aim. */
  dla: number;
  /** The craft's state round the Sun when it leaves (km, km/s): its whole path follows from it. */
  r1: Vec; v1: Vec;
}

/** A ballistic trip from the Earth to a planet, leaving at departJd and arriving at arriveJd (Julian Dates). */
export function realTrip(target: PlanetId, departJd: number, arriveJd: number): RealTrip | null {
  if (!(arriveJd > departJd)) return null;
  return tripFromStates(target, departJd, arriveJd, planetState('earth', departJd), planetState(target, arriveJd));
}

/** The same, from the Earth's state at departure and the target's at arrival (a porkchop grid reuses them). */
export function tripFromStates(target: PlanetId, departJd: number, arriveJd: number, e: { r: Vec; v: Vec }, p: { r: Vec; v: Vec }): RealTrip | null {
  const l = lambert(SUN_GM, e.r, p.r, (arriveJd - departJd) * DAY_S);
  if (!l) return null;
  const inf1: Vec = [0, 1, 2].map((k) => l.v1[k] - e.v[k]) as Vec;
  const inf2: Vec = [0, 1, 2].map((k) => l.v2[k] - p.v[k]) as Vec;
  const vInfDepart = norm(inf1), vInfArrive = norm(inf2);
  const leave = hyperbolicBurn(vInfDepart, planetGm('earth'), RADIUS_KM.earth + PARKING_ALT_KM);
  const arrive = hyperbolicBurn(vInfArrive, planetGm(target), RADIUS_KM[target] + PARKING_ALT_KM);
  const eq = Astronomy.RotateVector(ECL_TO_EQJ, new Astronomy.Vector(inf1[0], inf1[1], inf1[2], new Astronomy.AstroTime(0)));
  return {
    target, departJd, arriveJd, tofDays: arriveJd - departJd, angleDeg: l.angleDeg, type: l.angleDeg < 180 ? 1 : 2,
    c3: vInfDepart ** 2, vInfDepart, vInfArrive, leave, arrive, total: leave + arrive,
    dla: (Math.asin(eq.z / vInfDepart) * 180) / Math.PI,
    r1: e.r, v1: l.v1,
  };
}
