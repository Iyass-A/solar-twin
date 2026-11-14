// Turning sky directions between reference frames.
// Catalogues give stars and poles in J2000 equatorial coordinates (right ascension, declination);
// everything in this project uses the J2000 ecliptic frame.

import type { Vec3 } from './kepler';

const DEG = Math.PI / 180;

// Mean obliquity of the ecliptic at J2000
export const OBLIQUITY_J2000 = 23.4392911;

/** Unit vector in the J2000 ecliptic frame for a direction given as RA/Dec [deg]. */
export function equatorialToEcliptic(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg * DEG, d = decDeg * DEG, eps = OBLIQUITY_J2000 * DEG;
  const x = Math.cos(d) * Math.cos(a);
  const y = Math.cos(d) * Math.sin(a);
  const z = Math.sin(d);
  return {
    x,
    y: y * Math.cos(eps) + z * Math.sin(eps),
    z: -y * Math.sin(eps) + z * Math.cos(eps),
  };
}

/** Ecliptic latitude [deg] of a unit vector: how far above (+) or below (-) the ecliptic. */
export function eclipticLatitude(v: Vec3): number {
  return Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG;
}
