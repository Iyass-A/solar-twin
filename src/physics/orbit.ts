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
