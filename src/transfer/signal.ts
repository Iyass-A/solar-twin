// Trip planner (phase 6), step 5: the signal delay on the way. A radio signal travels at the speed of light, so
// a message between the Earth and the craft takes the distance between them divided by c: seconds just after
// launch, minutes at Mars, hours at Neptune. And when the craft is close to the Sun in the Earth's sky, the
// Sun's hot corona garbles the signal: NASA's Mars missions send no commands while Mars is within 2° of the
// Sun (the "solar conjunction" every 26 months, e.g. 2 to 16 October 2021).
//
// The delay here is the distance at one instant divided by c. Strictly a signal arriving now left a little
// earlier, while both ends moved on; that changes the delay by at most their speed towards each other over c,
// about a part in 10,000 (under a second at Mars, about two at Neptune). npm run check measures it.
// No DOM here.

import { propagate } from '../physics/orbit';
import { SUN_GM } from '../physics/bodies';
import { planetState, type RealTrip, type Vec } from './lambert';

/** The speed of light [km/s] (exact, by the definition of the metre). */
export const LIGHT_KM_S = 299_792.458;
/** Within this angle of the Sun in the Earth's sky, NASA's Mars missions send no commands [deg]. */
export const CONJUNCTION_DEG = 2;
/** Samples along a trip: about one a day, at least this many and at most that many (a long trip, every few days). */
const MIN_SAMPLES = 100, MAX_SAMPLES = 720;
const DAY_S = 86400;
const DEG = 180 / Math.PI;

/** The signal at one instant of a trip. */
export interface Signal {
  jd: number;
  /** Days since launch. */
  day: number;
  /** Distance from the Earth's centre to the craft [km], and the time light takes for it, one way [s]. */
  km: number;
  seconds: number;
  /** The Sun–Earth–craft angle [deg]: how far from the Sun the craft is in the Earth's sky. NaN at launch (no direction). */
  sepDeg: number;
}

/** A stretch of the trip with the craft within CONJUNCTION_DEG of the Sun (Julian Dates), and its closest angle [deg]. */
export interface Conjunction { from: number; to: number; minDeg: number }

export interface SignalProfile {
  /** Evenly spaced from launch to arrival, both included. */
  samples: Signal[];
  /** The longest delay on the way, found between the samples. */
  max: Signal;
  arrival: Signal;
  conjunctions: Conjunction[];
}

/** The angle between a and b [deg], NaN if either has no length. */
function angle(a: Vec, b: Vec): number {
  const la = Math.hypot(a[0], a[1], a[2]), lb = Math.hypot(b[0], b[1], b[2]);
  if (!(la > 0 && lb > 0)) return NaN;
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, c))) * DEG;
}

/** How far from the Sun something at r looks from the Earth at earth (both round the Sun) [deg]. */
export function sunAngle(earth: Vec, r: Vec): number {
  return angle([-earth[0], -earth[1], -earth[2]], [r[0] - earth[0], r[1] - earth[1], r[2] - earth[2]]);
}

/** Where the craft is round the Sun at jd [km], on its path from launch (Lambert's orbit, so it ends at the target). */
export function craftAt(trip: RealTrip, jd: number): Vec {
  return propagate(SUN_GM, trip.r1, trip.v1, (jd - trip.departJd) * DAY_S).r as Vec;
}

/** The signal at jd (any time; meant for launch to arrival). */
export function signalAt(trip: RealTrip, jd: number): Signal {
  const e = planetState('earth', jd).r, c = craftAt(trip, jd);
  const km = Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]);
  return { jd, day: jd - trip.departJd, km, seconds: km / LIGHT_KM_S, sepDeg: km > 1e-6 ? sunAngle(e, c) : NaN };
}

/** Golden-section search for the smallest f on [a, b] (f about unimodal there). */
function minimise(f: (x: number) => number, a: number, b: number, tol: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
  while (b - a > tol) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}

/** Bisection for where g changes sign between a (g < 0) and b (g >= 0). */
function edge(g: (x: number) => number, a: number, b: number, tol: number): number {
  while (Math.abs(b - a) > tol) {
    const m = (a + b) / 2;
    if (g(m) < 0) a = m; else b = m;
  }
  return (a + b) / 2;
}

/** The delay and the Sun's angle along a whole trip, with its longest delay and the stretches near the Sun. */
export function signalProfile(trip: RealTrip): SignalProfile {
  const n = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.ceil(trip.tofDays)));
  const t0 = trip.departJd, t1 = trip.arriveJd, dt = trip.tofDays / n;
  const samples: Signal[] = [];
  for (let i = 0; i <= n; i++) samples.push(signalAt(trip, i === n ? t1 : t0 + i * dt));
  const tol = 1e-4; // days: about 9 seconds

  // The longest delay: the largest sample, then the peak between its neighbours
  let k = 0;
  for (let i = 1; i <= n; i++) if (samples[i].km > samples[k].km) k = i;
  let max = samples[k];
  if (k > 0 && k < n) {
    const peak = signalAt(trip, minimise((jd) => -signalAt(trip, jd).km, samples[k - 1].jd, samples[k + 1].jd, tol));
    if (peak.km > max.km) max = peak;
  }

  // Near the Sun: each dip in the angle, found between the samples round it, and if it goes below the limit,
  // its edges, walked out a sample at a time and then halved down (a long trip's samples are days apart)
  const sep = (jd: number) => signalAt(trip, jd).sepDeg;
  const below = (jd: number) => sep(jd) - CONJUNCTION_DEG; // < 0 near the Sun
  const conjunctions: Conjunction[] = [];
  const ok = (i: number) => i >= 0 && i <= n && Number.isFinite(samples[i].sepDeg);
  for (let i = 0; i <= n; i++) {
    if (!ok(i)) continue;
    const s = samples[i].sepDeg;
    if ((ok(i - 1) && samples[i - 1].sepDeg < s) || (ok(i + 1) && samples[i + 1].sepDeg <= s)) continue; // not a dip
    const a = ok(i - 1) ? samples[i - 1].jd : samples[i].jd, b = ok(i + 1) ? samples[i + 1].jd : samples[i].jd;
    const at = b > a ? minimise(sep, a, b, tol) : samples[i].jd;
    const minDeg = Math.min(sep(at), s);
    if (!(minDeg < CONJUNCTION_DEG)) continue;
    let lo = at, hi = at;
    while (lo > t0 && below(lo) < 0) lo = Math.max(t0, lo - dt);
    while (hi < t1 && below(hi) < 0) hi = Math.min(t1, hi + dt);
    const from = below(lo) < 0 ? t0 : edge(below, at, lo, tol);
    const to = below(hi) < 0 ? t1 : edge(below, at, hi, tol);
    const last = conjunctions[conjunctions.length - 1];
    if (last && from <= last.to + tol) { last.to = Math.max(last.to, to); last.minDeg = Math.min(last.minDeg, minDeg); }
    else conjunctions.push({ from, to, minDeg });
  }
  return { samples, max, arrival: samples[n], conjunctions };
}
