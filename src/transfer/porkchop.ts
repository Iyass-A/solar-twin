// Trip planner (phase 6), step 3: the "porkchop" map. Every trip from the Earth to a planet for a range of
// launch dates and times on the way, each worked out exactly (Lambert's problem, src/transfer/lambert.ts),
// so the cheapest launch dates show as the bottom of a valley. The range sits round the Hohmann window
// (src/transfer/hohmann.ts), the best trips of each type are found on the grid and then refined.
// No DOM: the card (src/view/trip.ts) draws it; npm run check compares it with NASA's handbook.

import { tripTo, windows } from './hohmann';
import { planetState, realTrip, tripFromStates, type RealTrip, type Vec } from './lambert';
import type { PlanetId } from '../astro/elements';

/** What the map shows: launch energy C3 [km²/s²], or both burns together [km/s]. */
export type Measure = 'c3' | 'dv';

export interface PorkchopRange {
  target: PlanetId;
  /** First launch date [JD], step between launch dates [days], how many. */
  depart0: number; departStep: number; nx: number;
  /** Shortest time on the way [days], step [days, a whole number of launch steps], how many. */
  tof0: number; tofStep: number; ny: number;
  /** The Hohmann estimate's launch date and time on the way, which the range is centred on. */
  hohmannJd: number; hohmannDays: number;
}

export interface Porkchop extends PorkchopRange {
  /** Row by row (time on the way), column by column (launch date); NaN where there is no single path. */
  c3: Float64Array; dv: Float64Array;
  /** 1 or 2 (the path goes less or more than half way round the Sun), 0 where there is none. */
  type: Uint8Array;
  /** How far round the Sun the path goes [deg]. */
  angle: Float32Array;
}

/**
 * Within this of half a turn (180°) the plane of the path is barely defined: a tiny change in where the planets
 * are turns it a lot, and the numbers change a lot from one day to the next (the ridge between the two types
 * on a porkchop). The best trips are searched outside it. In late 2026 Mars arrives almost exactly on the
 * ecliptic (0.01°), so the ridge is very thin and a search inside it lands on a numerical spike.
 */
export const RIDGE_DEG = 1;
export const nearHalfTurn = (angleDeg: number) => Math.abs(angleDeg - 180) < RIDGE_DEG;

const NX = 120;     // launch dates
const NY_MAX = 110; // times on the way, at most

/** The map's range for the launch window next to JD: launch dates either side of the Hohmann date, times on the way about it. */
export function porkchopRange(target: PlanetId, jd: number): PorkchopRange {
  const h = tripTo(target, jd);
  const w = windows(h, jd);
  const centre = jd - w.prev < 1 ? w.prev : w.next;
  const half = Math.min(0.25 * h.synodicDays, 120);
  const departStep = (2 * half) / NX;
  const days = h.h.tofDays;
  const tof0 = 0.5 * days, span = 1.1 * days;
  const k = Math.max(1, Math.round(span / NY_MAX / departStep));
  const tofStep = k * departStep;
  return { target, depart0: centre - half, departStep, nx: NX + 1, tof0, tofStep, ny: Math.floor(span / tofStep) + 1, hohmannJd: centre, hohmannDays: days };
}

/**
 * Works out the map, a few rows at a time: each call of the returned step() does rows for at most budgetMs and
 * returns true when the map is done. The Earth's states are worked out once per launch date, the target's once
 * per arrival date (arrivals fall on the launch dates' step, because the time step is a whole number of them).
 */
export function porkchopStepper(range: PorkchopRange): { map: Porkchop; step: (budgetMs: number) => boolean } {
  const { target, depart0, departStep, nx, tof0, tofStep, ny } = range;
  const n = nx * ny;
  const map: Porkchop = { ...range, c3: new Float64Array(n).fill(NaN), dv: new Float64Array(n).fill(NaN), type: new Uint8Array(n), angle: new Float32Array(n).fill(NaN) };
  const earth: { r: Vec; v: Vec }[] = [];
  for (let i = 0; i < nx; i++) earth.push(planetState('earth', depart0 + i * departStep));
  const k = Math.round(tofStep / departStep);
  const arrivals = new Map<number, { r: Vec; v: Vec }>();
  const arrivalState = (i: number, j: number) => {
    const key = i + j * k; // arrival = depart0 + tof0 + key × departStep
    let s = arrivals.get(key);
    if (!s) { s = planetState(target, depart0 + tof0 + key * departStep); arrivals.set(key, s); }
    return s;
  };
  let row = 0;
  const step = (budgetMs: number) => {
    const until = performance.now() + budgetMs;
    while (row < ny) {
      for (let i = 0; i < nx; i++) {
        const dep = depart0 + i * departStep, tof = tof0 + row * tofStep;
        const tr = tripFromStates(target, dep, dep + tof, earth[i], arrivalState(i, row));
        if (!tr) continue;
        const at = row * nx + i;
        map.c3[at] = tr.c3; map.dv[at] = tr.total; map.type[at] = tr.type; map.angle[at] = tr.angleDeg;
      }
      row++;
      if (performance.now() > until) break;
    }
    return row >= ny;
  };
  return { map, step };
}

/** The whole map at once (for the checks). */
export function porkchop(range: PorkchopRange): Porkchop {
  const { map, step } = porkchopStepper(range);
  while (!step(1e9));
  return map;
}

const valueOf = (t: RealTrip, m: Measure) => (m === 'c3' ? t.c3 : t.total);

/**
 * The cheapest trip of one type on the map, refined between the grid points: a pattern search on the launch
 * date and the time on the way, its steps halving down to about a minute, staying within the type and the map,
 * and off the ridge at half a turn (RIDGE_DEG).
 */
export function cheapest(map: Porkchop, measure: Measure, type: 1 | 2): RealTrip | null {
  const values = measure === 'c3' ? map.c3 : map.dv;
  let best = -1;
  for (let at = 0; at < values.length; at++) {
    if (map.type[at] === type && !nearHalfTurn(map.angle[at]) && Number.isFinite(values[at]) && (best < 0 || values[at] < values[best])) best = at;
  }
  if (best < 0) return null;
  const i = best % map.nx, j = Math.floor(best / map.nx);
  // A minimum on the edge of the map is not a valley bottom: refine it, but only within the map
  const lo = { d: map.depart0, t: map.tof0 }, hi = { d: map.depart0 + (map.nx - 1) * map.departStep, t: map.tof0 + (map.ny - 1) * map.tofStep };
  let d = map.depart0 + i * map.departStep, t = map.tof0 + j * map.tofStep;
  const at = (dd: number, tt: number) => {
    if (dd < lo.d || dd > hi.d || tt < lo.t || tt > hi.t) return null;
    const tr = realTrip(map.target, dd, dd + tt);
    return tr && tr.type === type && !nearHalfTurn(tr.angleDeg) ? tr : null;
  };
  let cur = at(d, t);
  if (!cur) return null;
  let sd = map.departStep, st = map.tofStep;
  while (sd > 1e-3 || st > 1e-3) {
    let moved = false;
    for (const [dd, tt] of [[sd, 0], [-sd, 0], [0, st], [0, -st]]) {
      const tr = at(d + dd, t + tt);
      if (tr && valueOf(tr, measure) < valueOf(cur, measure)) { cur = tr; d += dd; t += tt; moved = true; break; }
    }
    if (!moved) { sd /= 2; st /= 2; }
  }
  return cur;
}

/**
 * Where the map's colour bands change: 1.1, 1.25, 1.5, 2 and 3 times the cheapest value on it, rounded to two
 * significant figures (so the legend reads 10, 11, 14, 18, 28 rather than 10.1, 11.5, ...).
 */
export function bandEdges(min: number): number[] {
  const nice = (v: number) => { const p = 10 ** (Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
  const edges: number[] = [];
  for (const f of [1.1, 1.25, 1.5, 2, 3]) {
    const e = nice(min * f);
    if (e > min && (!edges.length || e > edges[edges.length - 1])) edges.push(e);
  }
  return edges;
}

/** The lowest value on the map (off the ridge), or NaN. */
export function mapMin(map: Porkchop, measure: Measure): number {
  const values = measure === 'c3' ? map.c3 : map.dv;
  let m = Infinity;
  for (let at = 0; at < values.length; at++) if (!nearHalfTurn(map.angle[at]) && values[at] < m) m = values[at];
  return Number.isFinite(m) ? m : NaN;
}

/** Whether a trip lies on the edge of the map (within one grid step): then the valley may go on beyond it. */
export function onEdge(map: PorkchopRange, trip: RealTrip): boolean {
  const lastDep = map.depart0 + (map.nx - 1) * map.departStep, lastTof = map.tof0 + (map.ny - 1) * map.tofStep;
  return trip.departJd < map.depart0 + map.departStep || trip.departJd > lastDep - map.departStep
    || trip.tofDays < map.tof0 + map.tofStep || trip.tofDays > lastTof - map.tofStep;
}
