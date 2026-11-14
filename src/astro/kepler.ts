// Heliocentric planet positions from Keplerian elements.
// Method: JPL "Approximate Positions of the Planets", steps 1-6.

import type { PlanetElements } from './elements';

const DEG = Math.PI / 180;

export interface Vec3 { x: number; y: number; z: number; }

/** Orbit shape and orientation at one moment (angles in degrees). */
export interface OrbitAt {
  a: number;      // semi-major axis [au]
  e: number;      // eccentricity
  I: number;      // inclination
  O: number;      // longitude of ascending node
  omega: number;  // argument of perihelion
  M: number;      // mean anomaly, -180..180
}

/** Wrap an angle to the range -180..180 degrees. */
export function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Solve Kepler's equation M = E - e* sin E (all in degrees) with Newton's method. */
export function solveKepler(M: number, e: number): number {
  const eStar = e / DEG; // e in degrees
  let E = M + eStar * Math.sin(M * DEG);
  for (let i = 0; i < 50; i++) {
    const dM = M - (E - eStar * Math.sin(E * DEG));
    const dE = dM / (1 - e * Math.cos(E * DEG));
    E += dE;
    if (Math.abs(dE) < 1e-6) break;
  }
  return E;
}

/** Steps 1-2: the elements at time T (Julian centuries since J2000). */
export function orbitAt(p: PlanetElements, T: number): OrbitAt {
  const a = p.base.a + p.rate.a * T;
  const e = p.base.e + p.rate.e * T;
  const I = p.base.I + p.rate.I * T;
  const L = p.base.L + p.rate.L * T;
  const w = p.base.w + p.rate.w * T; // longitude of perihelion
  const O = p.base.O + p.rate.O * T; // longitude of ascending node
  return { a, e, I, O, omega: w - O, M: wrap180(L - w) };
}

/** Steps 4-5: position for a given eccentric anomaly E [deg], J2000 ecliptic frame. */
export function positionAtAnomaly(o: OrbitAt, E: number): Vec3 {
  // Position in the orbital plane
  const xp = o.a * (Math.cos(E * DEG) - o.e);
  const yp = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E * DEG);

  // Rotate into the J2000 ecliptic frame
  const cw = Math.cos(o.omega * DEG), sw = Math.sin(o.omega * DEG);
  const cO = Math.cos(o.O * DEG), sO = Math.sin(o.O * DEG);
  const cI = Math.cos(o.I * DEG), sI = Math.sin(o.I * DEG);

  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: (sw * sI) * xp + (cw * sI) * yp,
  };
}

/**
 * Position in au, in the J2000 ecliptic frame, with the Sun at the origin.
 * T = Julian centuries since J2000.
 */
export function heliocentricPosition(p: PlanetElements, T: number): Vec3 {
  const o = orbitAt(p, T);
  return positionAtAnomaly(o, solveKepler(o.M, o.e)); // step 3, then 4-5
}

/** The full orbit at time T, as `points` positions evenly spaced in eccentric anomaly. */
export function orbitPath(p: PlanetElements, T: number, points = 180): Vec3[] {
  const o = orbitAt(p, T);
  const path: Vec3[] = [];
  for (let i = 0; i < points; i++) path.push(positionAtAnomaly(o, (360 * i) / points));
  return path;
}

/** Ecliptic longitude in degrees, 0..360. */
export function longitude(v: Vec3): number {
  return ((Math.atan2(v.y, v.x) / DEG) % 360 + 360) % 360;
}

/** Distance from the Sun in au. */
export function distance(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}
