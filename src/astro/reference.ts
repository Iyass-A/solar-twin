// Independent reference positions from Astronomy Engine (accurate to about 1 arcminute).
// Used only to check our own Kepler calculation.

import * as Astronomy from 'astronomy-engine';
import type { PlanetId } from './elements';
import type { Vec3 } from './kepler';

const BODY: Record<PlanetId, Astronomy.Body> = {
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  earth: Astronomy.Body.Earth,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
};

const EQJ_TO_ECL = Astronomy.Rotation_EQJ_ECL();

/** Heliocentric position in au, J2000 ecliptic frame. */
export function referencePosition(id: PlanetId, date: Date): Vec3 {
  const eqj = Astronomy.HelioVector(BODY[id], date);
  const ecl = Astronomy.RotateVector(EQJ_TO_ECL, eqj);
  return { x: ecl.x, y: ecl.y, z: ecl.z };
}
