// N-body integrator of the physics engine (phase 5): Newtonian gravity between point masses, plus
// the equatorial bulge (J2) of oblate planets, which matters for their moons, and (if asked)
// general relativity near the Sun, which matters for Mercury.
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
  /** Index of the Sun for general relativity, or -1 without it */
  relSun: number;
}

/** Speed of light [au/day] */
export const C_AU_DAY = 299792.458 * 86400 / 149597870.7;
const C2 = C_AU_DAY * C_AU_DAY;

interface BodyIn {
  gmAu: number; r: ArrayLike<number>; v: ArrayLike<number>;
  bulge?: { j2: number; radiusAu: number; pole: ArrayLike<number> };
}

export type Order = 2 | 4;

/**
 * A new system from bodies with gmAu, r, v and maybe a bulge (all copied), at Julian date jd.
 * With `relativity`, the heaviest body (the Sun) bends the others' paths as general relativity says.
 */
export function createNBody(bodies: BodyIn[], jd: number, options: { relativity?: boolean } = {}): NBody {
  const n = bodies.length;
  const heaviest = bodies.reduce((best, b, i) => (b.gmAu > bodies[best].gmAu ? i : best), 0);
  const s: NBody = {
    n, gm: new Float64Array(n), r: new Float64Array(3 * n), v: new Float64Array(3 * n), a: new Float64Array(3 * n), jd, bulges: [],
    relSun: options.relativity ? heaviest : -1,
  };
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
  return {
    n: s.n, gm: s.gm.slice(), r: s.r.slice(), v: s.v.slice(), a: s.a.slice(), jd: s.jd, relSun: s.relSun,
    bulges: s.bulges.map((b) => ({ ...b, k: [...b.k] as [number, number, number] })),
  };
}

/** Fills s.a with every pull for the current positions and velocities. */
export function accelerations(s: NBody) {
  positionalAccelerations(s);
  addRelativity(s, s.v, s.a);
}

/** Fills s.a with the pull of every body on every other, each pair once (so momentum is kept exactly),
 *  and the bulges: everything that depends on positions alone. */
function positionalAccelerations(s: NBody) {
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

/**
 * Adds general relativity near the Sun to `a`, for velocities `v` (first post-Newtonian order, the
 * Sun's field only; as REBOUNDx "gr"): a_i = GM / (c^2 r^3) · [(4 GM / r - v^2) r + 4 (r·v) v], with r
 * and v from the Sun; the Sun feels -(GM_i/GM) a_i. It turns Mercury's perihelion by 43" a century.
 */
function addRelativity(s: NBody, v: Float64Array, a: Float64Array) {
  const sun = s.relSun;
  if (sun < 0) return;
  const { n, gm, r } = s, mu = gm[sun];
  const sx = r[3 * sun], sy = r[3 * sun + 1], sz = r[3 * sun + 2];
  const svx = v[3 * sun], svy = v[3 * sun + 1], svz = v[3 * sun + 2];
  for (let i = 0; i < n; i++) {
    if (i === sun) continue;
    const x = r[3 * i] - sx, y = r[3 * i + 1] - sy, z = r[3 * i + 2] - sz;
    const vx = v[3 * i] - svx, vy = v[3 * i + 1] - svy, vz = v[3 * i + 2] - svz;
    const r2 = x * x + y * y + z * z, d = Math.sqrt(r2);
    const f = mu / (C2 * r2 * d), radial = 4 * mu / d - (vx * vx + vy * vy + vz * vz), along = 4 * (x * vx + y * vy + z * vz);
    const ax = f * (radial * x + along * vx), ay = f * (radial * y + along * vy), az = f * (radial * z + along * vz);
    a[3 * i] += ax; a[3 * i + 1] += ay; a[3 * i + 2] += az;
    const back = gm[i] / mu;
    a[3 * sun] -= back * ax; a[3 * sun + 1] -= back * ay; a[3 * sun + 2] -= back * az;
  }
}

const scratch = new WeakMap<NBody, { vHalf: Float64Array; aPos: Float64Array }>();

/**
 * One leapfrog step of h days. s.a must belong to the current positions and velocities; it does
 * again afterwards. Relativity depends on the velocity, so with it the last half kick is solved for
 * the new velocity (two rounds; it is a 10^-8 effect): an older velocity there would make the step
 * lopsided in time, and the orbits would slowly lose energy (Mercury: 2° off after a century).
 */
export function leapfrogStep(s: NBody, h: number) {
  const { r, v, a } = s, m = 3 * s.n, half = h / 2;
  for (let k = 0; k < m; k++) v[k] += half * a[k];
  for (let k = 0; k < m; k++) r[k] += h * v[k];
  positionalAccelerations(s);
  if (s.relSun < 0) {
    for (let k = 0; k < m; k++) v[k] += half * a[k];
  } else {
    let buf = scratch.get(s);
    if (!buf || buf.vHalf.length !== m) { buf = { vHalf: new Float64Array(m), aPos: new Float64Array(m) }; scratch.set(s, buf); }
    const { vHalf, aPos } = buf;
    // Two rounds: a guess from the half-step velocity, then from that guess. Relativity is 10^-8 of
    // the pull, so the second round leaves the velocity and s.a consistent to some 10^-20.
    vHalf.set(v); aPos.set(a);
    for (let round = 0; round < 2; round++) {
      a.set(aPos);
      addRelativity(s, v, a);
      for (let k = 0; k < m; k++) v[k] = vHalf[k] + half * a[k];
    }
  }
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
 * Steps per orbit, at the speed of its closest point: the default step is the shortest such time in
 * the system over STEPS_PER_ORBIT. Measured against Horizons (November 2026, 4th order, relativity on):
 * planets as systems (step ≈ 0.16 day) within 0.02° of Astronomy Engine from 1800 to 2050 (Mercury);
 * with moons (≈ 0.0044 day) the moons within a few tenths of a degree of their orbit after a year
 * (Titan, Io). Half as many steps leave Mercury 0.24° off in 1800. See scripts/check-physics.ts.
 */
export const STEPS_PER_ORBIT = 400;

/** The default step [days]: the shortest orbit, as fast as at its closest point, in STEPS_PER_ORBIT steps. */
export const defaultStep = (s: NBody) => shortestTimescale(s) / STEPS_PER_ORBIT;

/**
 * The shortest time that matters in the system [days]: for each body, its tightest orbit around a
 * heavier one (from where they are and how they move now: semi-major axis and eccentricity), taken
 * at its closest point: period × (1 − e)^1.5. So it does not depend on where the bodies are on their
 * orbits at the start. Bodies bound to nothing heavier (the Sun, a passing star) add nothing.
 */
export function shortestTimescale(s: NBody): number {
  const { n, gm, r, v } = s;
  let shortest = Infinity;
  for (let i = 0; i < n; i++) {
    let tightest = Infinity, time = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i || gm[j] < gm[i]) continue;
      const mu = gm[i] + gm[j];
      const x = r[3 * i] - r[3 * j], y = r[3 * i + 1] - r[3 * j + 1], z = r[3 * i + 2] - r[3 * j + 2];
      const vx = v[3 * i] - v[3 * j], vy = v[3 * i + 1] - v[3 * j + 1], vz = v[3 * i + 2] - v[3 * j + 2];
      const d = Math.hypot(x, y, z), v2 = vx * vx + vy * vy + vz * vz;
      const invA = 2 / d - v2 / mu;
      if (!(invA > 0)) continue; // not bound to this one
      const a = 1 / invA;
      if (a >= tightest) continue;
      const rv = x * vx + y * vy + z * vz, c = v2 - mu / d;
      const e = Math.hypot(c * x - rv * vx, c * y - rv * vy, c * z - rv * vz) / mu;
      tightest = a;
      time = 2 * Math.PI * Math.sqrt(a ** 3 / mu) * Math.max(0, 1 - e) ** 1.5;
    }
    shortest = Math.min(shortest, time);
  }
  return shortest;
}
