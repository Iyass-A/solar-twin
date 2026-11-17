// The orbit a body would follow around a central body if nothing else pulled on it ("osculating"),
// from their relative position and velocity. "Branch reality" uses it to show how long a planet's
// year has become after a change, and whether it is still bound to the Sun at all.

export interface Orbit {
  /** Distance from the central body [au]. */
  r: number;
  /** Semi-major axis [au]; negative when the body is not bound. */
  a: number;
  /** Eccentricity. */
  e: number;
  /** Time for one orbit [days], or null when the body is not bound (it escapes). */
  period: number | null;
}

/**
 * mu: GM of the central body plus the body's own [au³/day²];
 * dr, dv: the body's position [au] and velocity [au/day] relative to the central body.
 */
export function orbitOf(mu: number, dr: readonly number[], dv: readonly number[]): Orbit {
  const r = Math.hypot(dr[0], dr[1], dr[2]);
  const v2 = dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2;
  const energy = v2 / 2 - mu / r; // per unit mass
  const a = -mu / (2 * energy);
  // Eccentricity from the angular momentum: e² = 1 + 2 E h² / mu²
  const hx = dr[1] * dv[2] - dr[2] * dv[1], hy = dr[2] * dv[0] - dr[0] * dv[2], hz = dr[0] * dv[1] - dr[1] * dv[0];
  const h2 = hx * hx + hy * hy + hz * hz;
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h2) / (mu * mu)));
  const period = energy < 0 ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : null;
  return { r, a, e, period };
}

/** Stumpff functions C(z) and S(z) for the universal variable, with series near z = 0. */
export function stumpff(z: number): [number, number] {
  if (Math.abs(z) < 1e-3) return [1 / 2 - z / 24 + z * z / 720, 1 / 6 - z / 120 + z * z / 5040];
  if (z > 0) { const s = Math.sqrt(z); return [(1 - Math.cos(s)) / z, (s - Math.sin(s)) / (s * s * s)]; }
  const s = Math.sqrt(-z);
  return [(Math.cosh(s) - 1) / -z, (Math.sinh(s) - s) / (s * s * s)];
}

/**
 * Where a body is after dt [days] (also backwards) on its orbit around a central body, with nothing else
 * pulling: Kepler's problem with the universal variable (Curtis, Orbital Mechanics, algorithms 3.3 and 3.4),
 * for closed and open orbits alike. "Branch reality" uses it to draw each body at the time on screen, from
 * the engine's last answer a few frames old. Falls back to a straight line if it does not converge.
 */
export function propagate(mu: number, r0: readonly number[], v0: readonly number[], dt: number): { r: number[]; v: number[] } {
  const line = () => ({ r: [0, 1, 2].map((k) => r0[k] + v0[k] * dt), v: [...v0] });
  if (dt === 0) return { r: [...r0], v: [...v0] };
  if (!(mu > 0)) return line();
  const sq = Math.sqrt(mu);
  const rn = Math.hypot(r0[0], r0[1], r0[2]);
  const vr = (r0[0] * v0[0] + r0[1] * v0[1] + r0[2] * v0[2]) / rn;
  const alpha = 2 / rn - (v0[0] ** 2 + v0[1] ** 2 + v0[2] ** 2) / mu; // 1/a
  // Newton on the universal Kepler equation; its slope is the distance, always positive
  let chi = sq * Math.abs(alpha) * dt || sq * dt / rn;
  let C = 0.5, S = 1 / 6, converged = false;
  for (let k = 0; k < 60; k++) {
    [C, S] = stumpff(alpha * chi * chi);
    const F = rn * vr / sq * chi * chi * C + (1 - alpha * rn) * chi ** 3 * S + rn * chi - sq * dt;
    const dF = rn * vr / sq * chi * (1 - alpha * chi * chi * S) + (1 - alpha * rn) * chi * chi * C + rn;
    const d = F / dF;
    chi -= d;
    if (!Number.isFinite(chi)) break;
    if (Math.abs(d) <= 1e-13 * Math.max(1, Math.abs(chi))) { converged = true; [C, S] = stumpff(alpha * chi * chi); break; }
  }
  if (!converged) return line();
  const f = 1 - chi * chi / rn * C, g = dt - chi ** 3 / sq * S;
  const r = [0, 1, 2].map((k) => f * r0[k] + g * v0[k]);
  const r1 = Math.hypot(r[0], r[1], r[2]);
  const fd = sq / (r1 * rn) * (alpha * chi ** 3 * S - chi), gd = 1 - chi * chi / r1 * C;
  const v = [0, 1, 2].map((k) => fd * r0[k] + gd * v0[k]);
  return r.every(Number.isFinite) && v.every(Number.isFinite) ? { r, v } : line();
}
