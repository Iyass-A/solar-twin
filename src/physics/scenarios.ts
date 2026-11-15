// Ready-made scenarios for "branch reality" (phase 5, step 7): one button fills in the change, goes to
// the start date, branches and runs time at a fitting speed. No DOM here, so npm run check can use it.
//
// Every number in a scenario's result text is a "fact" below, and npm run check (checkScenarios in
// scripts/check-physics.ts) runs each scenario through the engine as the page does and checks each fact,
// so the texts stay true when the physics changes.

import { VALID_TO_MS } from '../astro/elements';
import { AU_KM, SUN_GM } from './bodies';
import { orbitOf } from './orbit';
import type { Edit } from './protocol';

export type Action = 'remove' | 'mass' | 'push' | 'star';
export type ScenarioId = 'jupiter' | 'sun' | 'star' | 'star50';

// The passing star: closest after this long, at this speed, in the ecliptic plane
export const STAR_YEARS = 10; // so that the closest pass is still on the timeline (up to 2050)
export const STAR_KMS = 20;
// Where it passes closest: this ecliptic longitude, so that its arrow at the edge of the views keeps clear
// of the equinox label (at 0°). The planets feel it differently in each direction (at 50 au from +30°,
// Neptune is nearly torn away; from −30° its orbit is stretched): the facts below are for this one.
export const STAR_LONGITUDE_DEG = -30;

/** The change a branch makes, from what the form (or a scenario) says. */
export function makeEdit(action: Action, target: string, value: number, starAu: number): Edit {
  if (action === 'remove') return { kind: 'remove', id: target };
  if (action === 'mass') return { kind: 'mass', id: target, factor: value };
  if (action === 'push') return { kind: 'push', id: target, dvKmS: value };
  // Closest at starAu towards STAR_LONGITUDE_DEG in STAR_YEARS, moving at right angles to that (anticlockwise
  // seen from the north, as the planets go)
  const along = STAR_KMS * STAR_YEARS * 365.25 * 86400 / AU_KM;
  const l = STAR_LONGITUDE_DEG * Math.PI / 180, u = [Math.cos(l), Math.sin(l)], w = [-Math.sin(l), Math.cos(l)];
  return {
    kind: 'add', id: 'star', gm: SUN_GM * value,
    r: [starAu * u[0] - along * w[0], starAu * u[1] - along * w[1], 0], vKmS: [STAR_KMS * w[0], STAR_KMS * w[1], 0],
  };
}

export interface Fact {
  /** Its name in the result text. */
  key: string;
  body: string;
  /** offset: from where the body is in reality; year: its year on its orbit then (as the table shows it);
   *  closest: the nearest it comes to the Sun on that orbit. */
  kind: 'offset' | 'year' | 'closest';
  /** When (site time, UTC ms). */
  atMs: number;
  unit: 'km' | 'Mkm' | 'Gkm' | 'days' | 'years' | 'au';
  /** As the text says it, in `unit`, with `digits` decimals (0: with thousands separators). */
  value: number;
  digits: number;
  /** "About": the computed value is within this fraction of `value`. */
  tol?: number;
  /** "Less than": the computed value is below `value`. */
  below?: boolean;
}

export interface Scenario {
  id: ScenarioId;
  /** The branch starts here (site time, UTC ms). */
  fromMs: number;
  action: Action;
  target: string;
  value: number;
  starAu: number;
  /** Time runs at this speed: the page's speeds, 2 = a month and 3 = a year per second. */
  speed: 2 | 3;
  facts: Fact[];
  /** The same scenario with a change of one number (the star nearer or farther). */
  other?: ScenarioId;
}

const NOV_15_2026 = Date.UTC(2026, 10, 15);
const YEAR_2000 = Date.UTC(2000, 0, 1);

export const SCENARIOS: Scenario[] = [
  {
    // Without Jupiter from 1900: nothing falls or flies off, but the orbits shift. How much depends on
    // where Jupiter and Saturn were at that moment (the Sun keeps the wobble Jupiter gave it); from 1900
    // Saturn is 219 million km off by 2000, from 2026 only 15 by 2050.
    id: 'jupiter', fromMs: Date.UTC(1900, 0, 1), action: 'remove', target: 'jupiter', value: 0, starAu: 50, speed: 3,
    facts: [
      { key: 'saturn', body: 'saturn', kind: 'offset', atMs: YEAR_2000, unit: 'Mkm', value: 220, digits: 0, tol: 0.1 },
      { key: 'earth', body: 'earth', kind: 'offset', atMs: YEAR_2000, unit: 'km', value: 700_000, digits: 0, tol: 0.1 },
    ],
  },
  {
    // The Sun twice as heavy: each planet, moving as before, falls onto a smaller, stretched orbit
    id: 'sun', fromMs: NOV_15_2026, action: 'mass', target: 'sun', value: 2, starAu: 50, speed: 2,
    facts: [
      { key: 'earthYear', body: 'earth', kind: 'year', atMs: NOV_15_2026, unit: 'days', value: 139, digits: 0, tol: 0.01 },
      { key: 'earthClosest', body: 'earth', kind: 'closest', atMs: NOV_15_2026, unit: 'au', value: 0.33, digits: 2, tol: 0.03 },
      { key: 'jupiterYear', body: 'jupiter', kind: 'year', atMs: NOV_15_2026, unit: 'years', value: 4.7, digits: 1, tol: 0.02 },
    ],
  },
  {
    // A star like the Sun 1,000 au away: by eye nothing happens; the table shows how little
    id: 'star', fromMs: NOV_15_2026, action: 'star', target: 'jupiter', value: 1, starAu: 1000, speed: 3, other: 'star50',
    facts: [
      { key: 'neptune', body: 'neptune', kind: 'offset', atMs: VALID_TO_MS, unit: 'km', value: 70_000, digits: 0, tol: 0.15 },
      { key: 'earth', body: 'earth', kind: 'offset', atMs: VALID_TO_MS, unit: 'km', value: 100, digits: 0, below: true },
    ],
  },
  {
    // The same star at 50 au, for comparison: the outer planets' orbits change completely
    id: 'star50', fromMs: NOV_15_2026, action: 'star', target: 'jupiter', value: 1, starAu: 50, speed: 3, other: 'star',
    facts: [
      { key: 'neptuneYear', body: 'neptune', kind: 'year', atMs: VALID_TO_MS, unit: 'years', value: 100, digits: 0, tol: 0.05 },
      { key: 'uranusYear', body: 'uranus', kind: 'year', atMs: VALID_TO_MS, unit: 'years', value: 110, digits: 0, tol: 0.05 },
      { key: 'neptune', body: 'neptune', kind: 'offset', atMs: VALID_TO_MS, unit: 'Mkm', value: 400, digits: 0, tol: 0.1 },
      { key: 'earth', body: 'earth', kind: 'offset', atMs: VALID_TO_MS, unit: 'km', value: 210_000, digits: 0, tol: 0.1 },
    ],
  },
];

export const scenario = (id: ScenarioId) => SCENARIOS.find((s) => s.id === id)!;

/** Deep links: #branch-jupiter, #branch-sun, #branch-star, #branch-star50. */
export const scenarioHash = (id: ScenarioId) => `#branch-${id}`;
export function scenarioFromHash(hash: string): ScenarioId | null {
  const m = /^#branch-([a-z0-9]+)$/.exec(hash);
  return m && SCENARIOS.some((s) => s.id === m[1]) ? (m[1] as ScenarioId) : null;
}

/** A sim's state: ids, GM [au³/day²], positions [au] and velocities [au/day], 3 numbers per body. */
export interface Snap { ids: string[]; gm: ArrayLike<number>; r: ArrayLike<number>; v: ArrayLike<number> }

/** A fact's value (in its unit) from the branch and reality at the same moment; null if the body is gone. */
export function factValue(f: Fact, branch: Snap, real: Snap): number | null {
  const rel = (x: Snap) => {
    const i = x.ids.indexOf(f.body), sun = x.ids.indexOf('sun');
    if (i < 0 || sun < 0) return null;
    const dr = [0, 1, 2].map((k) => x.r[3 * i + k] - x.r[3 * sun + k]), dv = [0, 1, 2].map((k) => x.v[3 * i + k] - x.v[3 * sun + k]);
    return { dr, orbit: orbitOf(x.gm[sun] + x.gm[i], dr, dv) };
  };
  const b = rel(branch), r = rel(real);
  if (!b || !r) return null;
  const toUnit = (au: number) => (f.unit === 'km' ? au * AU_KM : f.unit === 'Mkm' ? au * AU_KM / 1e6 : f.unit === 'Gkm' ? au * AU_KM / 1e9 : au);
  if (f.kind === 'offset') return toUnit(Math.hypot(b.dr[0] - r.dr[0], b.dr[1] - r.dr[1], b.dr[2] - r.dr[2]));
  if (f.kind === 'closest') return toUnit(b.orbit.a * (1 - b.orbit.e));
  if (b.orbit.period === null) return Infinity;
  return f.unit === 'years' ? b.orbit.period / 365.25 : b.orbit.period;
}
