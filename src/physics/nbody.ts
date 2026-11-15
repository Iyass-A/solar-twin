// N-body integrator of the physics engine (phase 5): Newtonian gravity between point masses, plus
// the equatorial bulge (J2) of oblate planets, which matters for their moons.
// Steps: the leapfrog (kick-drift-kick, the same as velocity Verlet), or Yoshida's 4th-order
// composition of three leapfrog steps. Both are symplectic and time-reversible: the energy error
// stays bounded instead of drifting, and running backwards retraces the path.
// Units: au, days, GM in au^3/day^2 (src/physics/state.ts gives the starting state).

export interface NBody {
  n: number;
  gm: Float64Array; // [n] GM [au^3/day^2]
  r: Float64Array;  // [3n] positions [au]
  v: Float64Array;  // [3n] velocities [au/day]
  a: Float64Array;  // [3n] accelerations at the current positions [au/day^2]
  jd: number;       // time, Julian date (TDB)
  /** Oblate bodies: index, J2 × reference radius^2 [au^2], north pole (unit vector) */
  bulges: { i: number; j2r2: number; k: [number, number, number] }[];
}

interface BodyIn {
  gmAu: number; r: ArrayLike<number>; v: ArrayLike<number>;
  bulge?: { j2: number; radiusAu: number; pole: ArrayLike<number> };
}

export type Order = 2 | 4;

/** A new system from bodies with gmAu, r, v and maybe a bulge (all copied), at Julian date jd. */
export function createNBody(bodies: BodyIn[], jd: number): NBody {
  const n = bodies.length;
  const s: NBody = { n, gm: new Float64Array(n), r: new Float64Array(3 * n), v: new Float64Array(3 * n), a: new Float64Array(3 * n), jd, bulges: [] };
  bodies.forEach((b, i) => {
    s.gm[i] = b.gmAu;
    for (let k = 0; k < 3; k++) { s.r[3 * i + k] = b.r[k]; s.v[3 * i + k] = b.v[k]; }
    if (b.bulge) s.bulges.push({ i, j2r2: b.bulge.j2 * b.bulge.radiusAu ** 2, k: [b.bulge.pole[0], b.bulge.pole[1], b.bulge.pole[2]] });
  });
  accelerations(s);
  return s;
}

/** A copy that can run on its own (for "branch reality"). */
export function cloneNBody(s: NBody): NBody {
  return { n: s.n, gm: s.gm.slice(), r: s.r.slice(), v: s.v.slice(), a: s.a.slice(), jd: s.jd, bulges: s.bulges.map((b) => ({ ...b, k: [...b.k] as [number, number, number] })) };
}

/** Fills s.a with the pull of every body on every other, each pair once (so momentum is kept exactly). */
export function accelerations(s: NBody) {
  const { n, gm, r, a } = s;
  a.fill(0);
  for (let i = 0; i < n; i++) {
    const xi = r[3 * i], yi = r[3 * i + 1], zi = r[3 * i + 2];
    for (let j = i + 1; j < n; j++) {
      const dx = r[3 * j] - xi, dy = r[3 * j + 1] - yi, dz = r[3 * j + 2] - zi;
      const d2 = dx * dx + dy * dy + dz * dz;
      const inv3 = 1 / (d2 * Math.sqrt(d2));
      const fi = gm[j] * inv3, fj = gm[i] * inv3;
      a[3 * i] += fi * dx; a[3 * i + 1] += fi * dy; a[3 * i + 2] += fi * dz;
      a[3 * j] -= fj * dx; a[3 * j + 1] -= fj * dy; a[3 * j + 2] -= fj * dz;
    }
  }
  // Bulges: on body i at d from the oblate planet p (pole k, z = d·k),
  //   a_i = -(3/2) J2 R^2 GM_p / r^5 · [(1 - 5 z^2/r^2) d + 2 z k],  and the planet feels -(GM_i/GM_p) a_i
  for (const { i: p, j2r2, k } of s.bulges) {
    const px = r[3 * p], py = r[3 * p + 1], pz = r[3 * p + 2];
    for (let i = 0; i < n; i++) {
      if (i === p) continue;
      const dx = r[3 * i] - px, dy = r[3 * i + 1] - py, dz = r[3 * i + 2] - pz;
      const r2 = dx * dx + dy * dy + dz * dz;
      const z = dx * k[0] + dy * k[1] + dz * k[2];
      const f = -1.5 * j2r2 * gm[p] / (r2 * r2 * Math.sqrt(r2));
      const c = 1 - 5 * z * z / r2, ax = f * (c * dx + 2 * z * k[0]), ay = f * (c * dy + 2 * z * k[1]), az = f * (c * dz + 2 * z * k[2]);
      a[3 * i] += ax; a[3 * i + 1] += ay; a[3 * i + 2] += az;
      const back = gm[i] / gm[p];
      a[3 * p] -= back * ax; a[3 * p + 1] -= back * ay; a[3 * p + 2] -= back * az;
    }
  }
}

/** One leapfrog step of h days. s.a must belong to the current positions; it does again afterwards. */
export function leapfrogStep(s: NBody, h: number) {
  const { r, v, a } = s, m = 3 * s.n, half = h / 2;
  for (let k = 0; k < m; k++) v[k] += half * a[k];
  for (let k = 0; k < m; k++) r[k] += h * v[k];
  accelerations(s);
  for (let k = 0; k < m; k++) v[k] += half * a[k];
  s.jd += h;
}

// Yoshida (1990): three leapfrog steps of w1·h, w0·h, w1·h make one step of 4th order
const CBRT2 = Math.cbrt(2);
const W1 = 1 / (2 - CBRT2), W0 = -CBRT2 / (2 - CBRT2);

export function step(s: NBody, h: number, order: Order) {
  if (order === 2) { leapfrogStep(s, h); return; }
  const jd = s.jd;
  leapfrogStep(s, W1 * h); leapfrogStep(s, W0 * h); leapfrogStep(s, W1 * h);
  s.jd = jd + h;
}

/** Runs to Julian date `jd` (forwards or backwards) in equal steps of at most `maxStep` days. */
export function advance(s: NBody, jd: number, maxStep: number, order: Order) {
  const span = jd - s.jd;
  if (span === 0) return;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / maxStep - 1e-9));
  const h = span / steps, start = s.jd;
  for (let k = 1; k <= steps; k++) { step(s, h, order); s.jd = start + k * h; }
  s.jd = jd;
}

/** Total energy (kinetic + potential), divided by G: in GM · (au/day)^2. */
export function energy(s: NBody): number {
  const { n, gm, r, v } = s;
  let e = 0;
  for (let i = 0; i < n; i++) {
    e += gm[i] * (v[3 * i] ** 2 + v[3 * i + 1] ** 2 + v[3 * i + 2] ** 2) / 2;
    for (let j = i + 1; j < n; j++) {
      e -= gm[i] * gm[j] / Math.hypot(r[3 * j] - r[3 * i], r[3 * j + 1] - r[3 * i + 1], r[3 * j + 2] - r[3 * i + 2]);
    }
  }
  // Bulges: + GM_p GM_i J2 R^2 / r^3 · P2(z/r), with P2(x) = (3x^2 - 1)/2
  for (const { i: p, j2r2, k } of s.bulges) {
    for (let i = 0; i < n; i++) {
      if (i === p) continue;
      const d = [r[3 * i] - r[3 * p], r[3 * i + 1] - r[3 * p + 1], r[3 * i + 2] - r[3 * p + 2]];
      const dist = Math.hypot(d[0], d[1], d[2]), x = (d[0] * k[0] + d[1] * k[1] + d[2] * k[2]) / dist;
      e += gm[p] * gm[i] * j2r2 / dist ** 3 * (3 * x * x - 1) / 2;
    }
  }
  return e;
}

/** Total momentum and angular momentum (divided by G), as [x, y, z] each. With bulges, the angular
 *  momentum of the orbits is not kept: the bulges trade it with the planets' spin, which is not modelled. */
export function momenta(s: NBody): { p: number[]; L: number[] } {
  const p = [0, 0, 0], L = [0, 0, 0];
  for (let i = 0; i < s.n; i++) {
    const m = s.gm[i], [x, y, z] = s.r.subarray(3 * i, 3 * i + 3), [vx, vy, vz] = s.v.subarray(3 * i, 3 * i + 3);
    p[0] += m * vx; p[1] += m * vy; p[2] += m * vz;
    L[0] += m * (y * vz - z * vy); L[1] += m * (z * vx - x * vz); L[2] += m * (x * vy - y * vx);
  }
  return { p, L };
}

/**
 * Steps per shortest orbit for the default step. Measured against Horizons over a year (November 2026,
 * 4th order): planets as systems (step ≈ 0.32 day) within 0.003° (Mercury), with moons (≈ 0.009 day)
 * the moons within 0.25° of their orbit (Titan, Io). See scripts/check-physics.ts.
 */
export const STEPS_PER_ORBIT = 200;

/** The default step [days]: the shortest orbit split into STEPS_PER_ORBIT steps. */
export const defaultStep = (s: NBody) => shortestPeriod(s) / STEPS_PER_ORBIT;

/**
 * The shortest orbital period in the system [days]: each body around whatever pulls on it most,
 * from their distance now. Steps are chosen as a fraction of it.
 */
export function shortestPeriod(s: NBody): number {
  const { n, gm, r } = s;
  let shortest = Infinity;
  for (let i = 0; i < n; i++) {
    let best = -1, bestPull = 0, bestD = 0;
    for (let j = 0; j < n; j++) {
      if (j === i || gm[j] < gm[i]) continue; // a body orbits something heavier
      const d = Math.hypot(r[3 * j] - r[3 * i], r[3 * j + 1] - r[3 * i + 1], r[3 * j + 2] - r[3 * i + 2]);
      const pull = gm[j] / (d * d);
      if (pull > bestPull) { bestPull = pull; best = j; bestD = d; }
    }
    if (best >= 0) shortest = Math.min(shortest, 2 * Math.PI * Math.sqrt(bestD ** 3 / (gm[i] + gm[best])));
  }
  return shortest;
}
