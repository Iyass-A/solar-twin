// The starting state of the physics engine: positions and velocities from JPL Horizons
// (src/data/state-vectors.json, made by scripts/fetch-state-vectors.ts), joined with the bodies
// and masses in src/physics/bodies.ts.
// Frame: ICRF, J2000 ecliptic plane, origin at the solar-system barycentre. Units: au, au/day, TDB.

import file from '../data/state-vectors.json';
import { BODIES, SYSTEMS, AU_KM, toAuDay, type BodyDef, type SystemDef } from './bodies';
import { equatorialToEcliptic } from '../astro/frames';

export type Vec = [number, number, number];

export interface StartState {
  gmAu: number; // GM [au^3/day^2]
  r: Vec;       // position [au]
  v: Vec;       // velocity [au/day]
  /** For an oblate planet: J2, its reference radius [au], and its north pole (unit vector, J2000 ecliptic) */
  bulge?: { j2: number; radiusAu: number; pole: Vec };
}

/** Julian date (TDB) of the starting state. */
export const EPOCH_JD: number = file.epochJd;

function join<T extends { naif: number; gm: number }>(defs: T[], states: { naif: number; r: number[]; v: number[] }[]) {
  return defs.map((d) => {
    const s = states.find((x) => x.naif === d.naif);
    if (!s) throw new Error(`No starting state for NAIF ${d.naif}`);
    const ob = (d as Partial<BodyDef>).oblateness;
    const p = ob && ob.pole((EPOCH_JD - 2451545) / 36525);
    const pole = p && equatorialToEcliptic(p.ra, p.dec);
    return {
      ...d, gmAu: toAuDay(d.gm), r: [...s.r] as Vec, v: [...s.v] as Vec,
      ...(ob && pole ? { bulge: { j2: ob.j2, radiusAu: ob.radiusKm / AU_KM, pole: [pole.x, pole.y, pole.z] as Vec } } : {}),
    };
  });
}

/** The planetary systems as single points (barycentres), each a fresh copy. */
export const startSystems = (): (SystemDef & StartState)[] => join(SYSTEMS, file.systems);

/**
 * Sun, planets and large moons, each a fresh copy. Each planet and its moons are moved together,
 * keeping the moons' orbits as Horizons has them, so that their centre of mass is exactly the
 * system's barycentre from the planetary ephemeris (DE441). The two models then start the same.
 * The move is small: Horizons' Uranus and Neptune come from their moons' ephemerides and sit about
 * 1,200 and 350 km from DE441's barycentres (seen in November 2026; npm run check prints it).
 */
export function startBodies(): (BodyDef & StartState)[] {
  const bodies = join(BODIES, file.bodies);
  for (const s of startSystems()) {
    const members = bodies.filter((b) => b.system === s.id);
    const gm = members.reduce((t, b) => t + b.gm, 0);
    for (const k of ['r', 'v'] as const) {
      for (let i = 0; i < 3; i++) {
        const shift = s[k][i] - members.reduce((t, b) => t + b.gm * b[k][i], 0) / gm;
        for (const b of members) b[k][i] += shift;
      }
    }
  }
  return bodies;
}
