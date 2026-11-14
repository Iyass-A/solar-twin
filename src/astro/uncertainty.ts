// Uncertainty clouds: possible orbits of an asteroid or comet, drawn from JPL's covariance.
//
// JPL fits each orbit to its observations and reports how uncertain the fitted elements are, as a
// covariance matrix at the orbit-solution epoch. Every sample drawn from it is an orbit that fits the
// observations about as well as the nominal one. Moving them all forward in time shows where the
// body could really be: the cloud usually stretches along the orbit as small differences in the
// orbital period add up.
//
// The samples move with the Sun alone, like the nominal orbit, and the cloud is placed around the
// body's current position (its offsets from the nominal orbit, at the same date).

import { smallBodyPosition, type SmallBodyOrbit } from './smallbody';
import type { Vec3 } from './kepler';

export interface Covariance {
  epoch: number;
  elements: Omit<SmallBodyOrbit, 'epoch'>;
  labels: string[];   // the first six are e, q, tp, node, peri, i
  matrix: number[][]; // au, days and degrees, like the elements
}

const KEYS = ['e', 'q', 'tp', 'node', 'peri', 'i'] as const;

/** Seeded random numbers in [0, 1) (mulberry32): the same body always gets the same cloud. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from a text, such as a body's id. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Standard normal random numbers (Box-Muller). */
function normals(rand: () => number, n: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const u = 1 - rand(), v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    out.push(r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v));
  }
  return out.slice(0, n);
}

/**
 * Cholesky factor L (L·Lᵀ = C) of the first 6x6 block, or null if it is not positive definite.
 * Done on the correlation matrix and scaled back, because the entries differ by many powers of ten.
 */
export function cholesky6(C: number[][]): number[][] | null {
  const n = 6;
  const s = Array.from({ length: n }, (_, i) => Math.sqrt(C[i][i]));
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = C[i][j] / (s[i] * s[j]);
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(sum > 0)) return null;
        L[i][i] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return L.map((row, i) => row.map((v) => v * s[i]));
}

/**
 * `n` possible orbits at the covariance epoch (only elliptic ones are kept).
 * The change to the perihelion time goes into `dtp`, not into `tp`: for very well known orbits such as
 * Bennu's it is about a billionth of a day, below what a Julian date (about 2.5 million) can resolve.
 */
export function sampleOrbits(cov: Covariance, n: number, seed: number): SmallBodyOrbit[] {
  const L = cholesky6(cov.matrix);
  if (!L) return [];
  const mean = KEYS.map((k) => cov.elements[k]);
  const rand = seededRandom(seed);
  const out: SmallBodyOrbit[] = [];
  for (let tries = 0; out.length < n && tries < n * 10; tries++) {
    const z = normals(rand, 6);
    const dx = L.map((row) => row.reduce((sum, l, k) => sum + l * z[k], 0));
    const x = mean.map((m, i) => m + dx[i]);
    if (!(x[0] >= 0 && x[0] < 1 && x[1] > 0)) continue;
    out.push({ epoch: cov.epoch, e: x[0], q: x[1], tp: mean[2], dtp: dx[2], node: x[3], peri: x[4], i: x[5] });
  }
  return out;
}

/** Offsets [au] of the sampled orbits from the nominal orbit at Julian date `jd`. */
export function cloudOffsets(cov: Covariance, samples: SmallBodyOrbit[], jd: number): Vec3[] {
  const nominal = smallBodyPosition({ ...cov.elements, epoch: cov.epoch }, jd);
  return samples.map((s) => {
    const p = smallBodyPosition(s, jd);
    return { x: p.x - nominal.x, y: p.y - nominal.y, z: p.z - nominal.z };
  });
}

/** The cloud's 1-sigma size [au] along its longest direction, and that direction. */
export function cloudSpread(offsets: Vec3[]): { sigma: number; axis: Vec3 } {
  const n = offsets.length;
  if (n < 2) return { sigma: 0, axis: { x: 1, y: 0, z: 0 } };
  const m = offsets.reduce((a, o) => ({ x: a.x + o.x / n, y: a.y + o.y / n, z: a.z + o.z / n }), { x: 0, y: 0, z: 0 });
  // 3x3 covariance of the offsets
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const o of offsets) {
    const d = [o.x - m.x, o.y - m.y, o.z - m.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i][j] += (d[i] * d[j]) / (n - 1);
  }
  // Largest eigenvalue by power iteration
  let v = [1, 1, 1];
  let lambda = 0;
  for (let it = 0; it < 50; it++) {
    const w = [0, 1, 2].map((i) => c[i][0] * v[0] + c[i][1] * v[1] + c[i][2] * v[2]);
    lambda = Math.hypot(...w);
    if (lambda === 0) break;
    v = w.map((x) => x / lambda);
  }
  return { sigma: Math.sqrt(lambda), axis: { x: v[0], y: v[1], z: v[2] } };
}
