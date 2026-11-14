// Heliocentric planet positions from Keplerian elements.
// Method: JPL "Approximate Positions of the Planets", steps 1-6.

import type { PlanetElements } from './elements';

const DEG = Math.PI / 180;

export interface Vec3 { x: number; y: number; z: number; }

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

/**
 * Position in au, in the J2000 ecliptic frame, with the Sun at the origin.
 * T = Julian centuries since J2000.
 */
export function heliocentricPosition(p: PlanetElements, T: number): Vec3 {
  // 1. Elements at time T
  const a = p.base.a + p.rate.a * T;
  const e = p.base.e + p.rate.e * T;
  const I = p.base.I + p.rate.I * T;
  const L = p.base.L + p.rate.L * T;
  const w = p.base.w + p.rate.w * T; // longitude of perihelion
  const O = p.base.O + p.rate.O * T; // longitude of ascending node

  // 2. Argument of perihelion and mean anomaly
  const omega = w - O;
  const M = wrap180(L - w);

  // 3. Eccentric anomaly
  const E = solveKepler(M, e);

  // 4. Position in the orbital plane
  const xp = a * (Math.cos(E * DEG) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);

  // 5. Rotate into the J2000 ecliptic frame
  const cw = Math.cos(omega * DEG), sw = Math.sin(omega * DEG);
  const cO = Math.cos(O * DEG), sO = Math.sin(O * DEG);
  const cI = Math.cos(I * DEG), sI = Math.sin(I * DEG);

  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: (sw * sI) * xp + (cw * sI) * yp,
  };
}

/** Ecliptic longitude in degrees, 0..360. */
export function longitude(v: Vec3): number {
  return ((Math.atan2(v.y, v.x) / DEG) % 360 + 360) % 360;
}

/** Distance from the Sun in au. */
export function distance(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}
