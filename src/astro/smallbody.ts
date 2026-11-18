// Positions of asteroids and comets from their osculating orbital elements (JPL SBDB),
// as a pure two-body (Sun only) Kepler orbit. Close to the orbit epoch this matches JPL's
// full calculation well; far from it, planets (mostly Jupiter) slowly pull the real body away.
// npm run check measures how well, against JPL Horizons.

import { positionAtAnomaly, type Vec3 } from './kepler';
import { AU_KM } from '../physics/bodies';

const DEG = Math.PI / 180;

// Gaussian gravitational constant: the Sun's pull, in au^1.5 per day
export const GAUSS_K = 0.01720209895;

/** Osculating elements as SBDB gives them (angles in degrees, times as Julian days TDB). */
export interface SmallBodyOrbit {
  epoch: number; // osculation epoch
  e: number;     // eccentricity (must be below 1 here)
  q: number;     // perihelion distance [au]
  tp: number;    // time of perihelion passage
  dtp?: number;  // a small change to tp [days], kept apart: a Julian date near 2.5 million cannot hold it
  node: number;  // longitude of the ascending node
  peri: number;  // argument of perihelion
  i: number;     // inclination
}

/** Semi-major axis [au]. */
export const semiMajorAxis = (o: SmallBodyOrbit) => o.q / (1 - o.e);

/** Orbital period [days]. */
export const periodDays = (o: SmallBodyOrbit) => (2 * Math.PI) / (GAUSS_K / Math.pow(semiMajorAxis(o), 1.5));

/**
 * Kepler's equation M = E - e sin E (radians), for any eccentricity below 1.
 * Starts from Danby's guess, which keeps Newton's method safe even for comets with e near 1.
 */
export function solveKeplerAnyE(M: number, e: number): number {
  const m = Math.atan2(Math.sin(M), Math.cos(M)); // -pi..pi
  let E = m + 0.85 * e * Math.sign(Math.sin(m) || 1);
  for (let k = 0; k < 60; k++) {
    const f = E - e * Math.sin(E) - m;
    const dE = -f / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

/** Heliocentric position [au], J2000 ecliptic frame, at Julian date `jd`. */
export function smallBodyPosition(o: SmallBodyOrbit, jd: number): Vec3 {
  if (!(o.e < 1)) throw new Error('Only elliptic orbits (e < 1) are supported');
  const a = semiMajorAxis(o);
  const n = GAUSS_K / Math.pow(a, 1.5);           // mean motion [rad/day]
  const E = solveKeplerAnyE(n * ((jd - o.tp) - (o.dtp ?? 0)), o.e); // radians
  return positionAtAnomaly({ a, e: o.e, I: o.i, O: o.node, omega: o.peri, M: 0 }, E / DEG);
}

/**
 * Position [km] and velocity [km/s] round the Sun, J2000 ecliptic frame, at Julian date `jd`: what a trip
 * planned to the body needs. The velocity is the position's change over ±H_DAYS (a part in 10⁸ or better).
 */
export function smallBodyState(o: SmallBodyOrbit, jd: number): { r: [number, number, number]; v: [number, number, number] } {
  const p = smallBodyPosition(o, jd), a = smallBodyPosition(o, jd - H_DAYS), b = smallBodyPosition(o, jd + H_DAYS);
  const k = AU_KM / (2 * H_DAYS * 86400);
  return {
    r: [p.x * AU_KM, p.y * AU_KM, p.z * AU_KM],
    v: [(b.x - a.x) * k, (b.y - a.y) * k, (b.z - a.z) * k],
  };
}
const H_DAYS = 0.01;

/** The whole orbit as `points` positions, evenly spaced in eccentric anomaly. */
export function smallBodyOrbitPath(o: SmallBodyOrbit, points = 256): Vec3[] {
  const a = semiMajorAxis(o);
  const path: Vec3[] = [];
  for (let k = 0; k < points; k++) {
    path.push(positionAtAnomaly({ a, e: o.e, I: o.i, O: o.node, omega: o.peri, M: 0 }, (360 * k) / points));
  }
  return path;
}
