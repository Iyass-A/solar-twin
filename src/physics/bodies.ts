// The bodies of the physics engine (phase 5): the Sun, the eight planets, the seven moons larger
// than Pluto, and the barycentres of the planetary systems (Pluto's too), with their masses (GM).
// Their starting positions and velocities come from JPL Horizons: src/data/state-vectors.json,
// made by scripts/fetch-state-vectors.ts.
//
// GM [km^3/s^2]:
//   Sun and the planetary systems: JPL planetary ephemeris DE440 (Park et al. 2021, AJ 161:105),
//     as listed on https://ssd.jpl.nasa.gov/astro_par.html (Earth and Moon separately there).
//   Moons: https://ssd.jpl.nasa.gov/sats/phys_par (Galilean moons: JUP365; Titan: SAT441; Triton: NEP097).
// A planet here stands for the planet with its smaller moons: its GM is its system's minus the moons
// listed here, so a system weighs the same whether it is one point or a planet with its moons.
//
// Oblateness (J2): the planets with moons listed here bulge at the equator, and that bulge pulls the
// moons round faster and turns their orbits; without it Io would be tens of degrees off after a year.
//   Jupiter: J2 = 14696.514e-6, reference radius 71,492 km (Folkner et al. 2017, Juno)
//   Saturn:  J2 = 16290.573e-6, reference radius 60,330 km (Iess et al. 2019, Science 364, Cassini)
//   Neptune: J2 = 3408.43e-6, reference radius 25,225 km (Jacobson 2009, AJ 137:4322)
//   Poles: IAU (Archinal et al. 2018), as right ascension and declination at T Julian centuries from J2000.
// The Earth's bulge moves the Moon by only some km a year, so it is left out.

export type SystemId =
  | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export interface SystemDef {
  id: SystemId;
  naif: number;   // Horizons / NAIF id of the system barycentre
  gm: number;     // the whole system [km^3/s^2]
}

export interface Oblateness {
  j2: number;
  radiusKm: number;
  /** North pole [deg], ICRF, at T Julian centuries from J2000 */
  pole: (T: number) => { ra: number; dec: number };
}

export interface BodyDef {
  id: string;
  naif: number;
  kind: 'star' | 'planet' | 'moon';
  system?: SystemId; // the planetary system it belongs to (not for the Sun)
  gm: number;        // [km^3/s^2]
  oblateness?: Oblateness;
}

const DEG = Math.PI / 180;
export const OBLATENESS: Partial<Record<SystemId, Oblateness>> = {
  jupiter: { j2: 14696.514e-6, radiusKm: 71492, pole: (T) => ({ ra: 268.056595 - 0.006499 * T, dec: 64.495303 + 0.002413 * T }) },
  saturn: { j2: 16290.573e-6, radiusKm: 60330, pole: (T) => ({ ra: 40.589 - 0.036 * T, dec: 83.537 - 0.004 * T }) },
  neptune: {
    j2: 3408.43e-6, radiusKm: 25225,
    pole: (T) => { const N = (357.85 + 52.316 * T) * DEG; return { ra: 299.36 + 0.7 * Math.sin(N), dec: 43.46 - 0.51 * Math.cos(N) }; },
  },
};

export const AU_KM = 149597870.7;
const DAY_S = 86400;
/** km^3/s^2 -> au^3/day^2, the units of the engine. */
export const toAuDay = (gmKm: number) => gmKm * DAY_S * DAY_S / (AU_KM * AU_KM * AU_KM);

export const SUN_GM = 132712440041.279419;

export const SYSTEMS: SystemDef[] = [
  { id: 'mercury', naif: 1, gm: 22031.868551 },
  { id: 'venus', naif: 2, gm: 324858.592 },
  { id: 'earth', naif: 3, gm: 398600.435507 + 4902.800118 }, // Earth + Moon
  { id: 'mars', naif: 4, gm: 42828.375816 },
  { id: 'jupiter', naif: 5, gm: 126712764.1 },
  { id: 'saturn', naif: 6, gm: 37940584.8418 },
  { id: 'uranus', naif: 7, gm: 5794556.4 },
  { id: 'neptune', naif: 8, gm: 6836527.10058 },
  { id: 'pluto', naif: 9, gm: 975.5 },
];

const MOONS: BodyDef[] = [
  { id: 'moon', naif: 301, kind: 'moon', system: 'earth', gm: 4902.800118 },
  { id: 'io', naif: 501, kind: 'moon', system: 'jupiter', gm: 5959.91547 },
  { id: 'europa', naif: 502, kind: 'moon', system: 'jupiter', gm: 3202.7121 },
  { id: 'ganymede', naif: 503, kind: 'moon', system: 'jupiter', gm: 9887.83275 },
  { id: 'callisto', naif: 504, kind: 'moon', system: 'jupiter', gm: 7179.2834 },
  { id: 'titan', naif: 606, kind: 'moon', system: 'saturn', gm: 8978.1371 },
  { id: 'triton', naif: 801, kind: 'moon', system: 'neptune', gm: 1428.49546 },
];

const PLANET_NAIF: Partial<Record<SystemId, number>> = {
  mercury: 199, venus: 299, earth: 399, mars: 499, jupiter: 599, saturn: 699, uranus: 799, neptune: 899,
};

const planets: BodyDef[] = SYSTEMS.filter((s) => PLANET_NAIF[s.id]).map((s) => ({
  id: s.id,
  naif: PLANET_NAIF[s.id]!,
  kind: 'planet',
  system: s.id,
  gm: s.gm - MOONS.filter((m) => m.system === s.id).reduce((sum, m) => sum + m.gm, 0),
  ...(OBLATENESS[s.id] ? { oblateness: OBLATENESS[s.id] } : {}),
}));

/** Sun, planets, moons: each planet followed by its moons. */
export const BODIES: BodyDef[] = [
  { id: 'sun', naif: 10, kind: 'star', gm: SUN_GM },
  ...planets.flatMap((p) => [p, ...MOONS.filter((m) => m.system === p.system)]),
];
