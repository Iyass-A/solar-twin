// Directions of planet north poles, from the IAU report on cartographic coordinates
// and rotational elements (Archinal et al. 2018), at J2000.
// The IAU gives them in equatorial coordinates (right ascension, declination);
// we turn them into the J2000 ecliptic frame used everywhere else.

import type { Vec3 } from './kepler';

const DEG = Math.PI / 180;

// Mean obliquity of the ecliptic at J2000
export const OBLIQUITY_J2000 = 23.4392911;

/** Saturn's north pole: right ascension 40.589°, declination 83.537°. */
export const SATURN_POLE_RA_DEC = { ra: 40.589, dec: 83.537 };

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

export const SATURN_POLE: Vec3 = equatorialToEcliptic(SATURN_POLE_RA_DEC.ra, SATURN_POLE_RA_DEC.dec);
