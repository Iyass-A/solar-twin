// Directions of planet north poles, from the IAU report on cartographic coordinates
// and rotational elements (Archinal et al. 2018), at J2000.

import { equatorialToEcliptic } from './frames';
import type { Vec3 } from './kepler';

/** Saturn's north pole: right ascension 40.589°, declination 83.537°. */
export const SATURN_POLE_RA_DEC = { ra: 40.589, dec: 83.537 };

/** Saturn's north pole as a unit vector in the J2000 ecliptic frame. */
export const SATURN_POLE: Vec3 = equatorialToEcliptic(SATURN_POLE_RA_DEC.ra, SATURN_POLE_RA_DEC.dec);
