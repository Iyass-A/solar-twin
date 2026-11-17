// Trip planner (phase 6), step 1: the Hohmann transfer, the textbook first answer to "how long to Mars,
// and when do we leave?". The craft goes half way round an ellipse about the Sun that just touches the
// Earth's orbit and the target's, with two burns: one to leave the Earth, one to stop at the target.
// Both orbits are taken as circles in one plane (radius = semi-major axis), so this is an estimate:
// the real orbits are a little stretched and tilted, and the exact answer for real dates comes with
// Lambert's problem (the next step).
// Formulas: H. D. Curtis, Orbital Mechanics for Engineering Students, sections 6.2 (Hohmann transfer)
// and 8.2-8.6 (interplanetary Hohmann transfers, synodic period, phase angle, departure and capture).

import { PLANETS, type PlanetId } from '../astro/elements';
import { heliocentricPosition, longitude, wrap180 } from '../astro/kepler';
import { centuriesSinceJ2000 } from '../astro/julian';
import { AU_KM, BODIES, SUN_GM } from '../physics/bodies';

const DAY_S = 86400;
const DEG = Math.PI / 180;

/** The trip leaves a circular orbit this high above the Earth and arrives into one as high above the target [km]. */
export const PARKING_ALT_KM = 300;

/** Equatorial radius [km]: JPL Planetary Physical Parameters, https://ssd.jpl.nasa.gov/planets/phys_par.html */
export const RADIUS_KM: Record<PlanetId, number> = {
  mercury: 2440.53, venus: 6051.8, earth: 6378.1366, mars: 3396.19,
  jupiter: 71492, saturn: 60268, uranus: 25559, neptune: 24764,
};

/** The planets a trip from the Earth can go to, from the Sun outwards. */
export const TARGETS: PlanetId[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

export interface Hohmann {
  /** Radii of the two circular orbits and the transfer ellipse's semi-major axis [km]. */
  r1: number; r2: number; a: number;
  /** Time on the way: half the ellipse [days]. */
  tofDays: number;
  /** Speeds on the two circular orbits, and on the ellipse where it touches them [km/s]. */
  v1: number; v2: number; vDepart: number; vArrive: number;
  /** The two burns [km/s]. Between planets these are also the speeds relative to each planet (v∞). */
  dv1: number; dv2: number;
  /** How far the target must be ahead (+) or behind (−) round the central body at departure [deg]. */
  phaseDeg: number;
}

/** Hohmann transfer between circular orbits of radii r1 and r2 [km] in one plane, round a body of GM mu [km³/s²]. */
export function hohmann(mu: number, r1: number, r2: number): Hohmann {
  const a = (r1 + r2) / 2;
  const tof = Math.PI * Math.sqrt(a ** 3 / mu); // [s]
  const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
  const vDepart = Math.sqrt(mu * (2 / r1 - 1 / a)), vArrive = Math.sqrt(mu * (2 / r2 - 1 / a)); // vis-viva
  // The target moves on while the craft is on the way, and must be opposite the start when it arrives
  const n2 = Math.sqrt(mu / r2 ** 3); // [rad/s]
  return {
    r1, r2, a, tofDays: tof / DAY_S, v1, v2, vDepart, vArrive,
    dv1: Math.abs(vDepart - v1), dv2: Math.abs(v2 - vArrive),
    phaseDeg: wrap180(180 - (n2 * tof) / DEG),
  };
}

/**
 * The burn between a circular orbit of radius r [km] round a planet of GM mu and the speed vInf [km/s] far
 * from it, on a hyperbola: to leave (Curtis eq. 8.42) or, the same size, to be captured (eq. 8.59 with e = 0).
 */
export function hyperbolicBurn(vInf: number, mu: number, r: number): number {
  return Math.sqrt(vInf ** 2 + (2 * mu) / r) - Math.sqrt(mu / r);
}

export interface Trip {
  target: PlanetId;
  h: Hohmann;
  /** Launch energy: v∞² when leaving the Earth [km²/s²]. */
  c3: number;
  /** Burns from the parking orbit round the Earth, into the one round the target, and both [km/s]. */
  leave: number; arrive: number; total: number;
  /** Time between two launch windows [days]: the synodic period. */
  synodicDays: number;
}

const planet = (id: PlanetId) => PLANETS.find((p) => p.id === id)!;
/** GM of the planet with its smaller moons [km³/s²] (src/physics/bodies.ts). */
const planetGm = (id: PlanetId) => BODIES.find((b) => b.id === id)!.gm;
/** Semi-major axis [km] at JD, from JPL's elements. */
const semiMajorKm = (id: PlanetId, jd: number) => {
  const p = planet(id);
  return (p.base.a + p.rate.a * centuriesSinceJ2000(jd)) * AU_KM;
};
/** Mean motion [deg/day], from JPL's rate of the mean longitude. */
const meanMotion = (id: PlanetId) => planet(id).rate.L / 36525;

/** A Hohmann trip from the Earth to a planet, with the orbits as they are at JD. */
export function tripTo(target: PlanetId, jd: number): Trip {
  const h = hohmann(SUN_GM, semiMajorKm('earth', jd), semiMajorKm(target, jd));
  const leave = hyperbolicBurn(h.dv1, planetGm('earth'), RADIUS_KM.earth + PARKING_ALT_KM);
  const arrive = hyperbolicBurn(h.dv2, planetGm(target), RADIUS_KM[target] + PARKING_ALT_KM);
  return {
    target, h, c3: h.dv1 ** 2, leave, arrive, total: leave + arrive,
    synodicDays: 360 / Math.abs(meanMotion('earth') - meanMotion(target)),
  };
}

/** How far the target is ahead of the Earth round the Sun [deg, −180..180], from the positions the site draws. */
export function leadAngle(target: PlanetId, jd: number): number {
  const T = centuriesSinceJ2000(jd);
  return wrap180(longitude(heliocentricPosition(planet(target), T)) - longitude(heliocentricPosition(planet('earth'), T)));
}

/**
 * The launch windows next to JD [JD]: the last moment before (or at) it and the first after it when the
 * target is phaseDeg ahead of the Earth. The angle between them always turns the same way (the inner planet
 * is always the faster), so there is one such moment in each synodic period.
 */
export function windows(trip: Trip, jd: number): { prev: number; next: number } {
  const g = (t: number) => wrap180(leadAngle(trip.target, t) - trip.h.phaseDeg);
  const step = trip.synodicDays / 120;
  const find = (dir: 1 | -1) => {
    let a = jd, ga = g(a);
    if (ga === 0) return a;
    for (let k = 0; k < 130; k++) {
      const b = a + dir * step, gb = g(b);
      // A change of sign, but not the jump from −180° to +180°
      if (Math.sign(gb) !== Math.sign(ga) && Math.abs(gb - ga) < 90) {
        let lo = a, hi = b, glo = ga;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2, gm = g(mid);
          if (Math.sign(gm) === Math.sign(glo)) { lo = mid; glo = gm; } else hi = mid;
        }
        return (lo + hi) / 2;
      }
      a = b; ga = gb;
    }
    return NaN;
  };
  return { prev: find(-1), next: find(1) };
}
