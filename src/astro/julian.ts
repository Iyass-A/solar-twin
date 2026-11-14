// Julian Date helpers.
// Note: we treat UTC as TT here. The ~69 s difference is far below
// what matters for drawing planet positions.

export const J2000 = 2451545.0; // 2000-01-01 12:00 (Julian Date)
const UNIX_EPOCH_JD = 2440587.5; // 1970-01-01 00:00 UTC
const MS_PER_DAY = 86_400_000;

/** Julian Date for a JavaScript Date. */
export function toJulianDate(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Julian centuries since J2000 (the "T" used in JPL's formulas). */
export function centuriesSinceJ2000(jd: number): number {
  return (jd - J2000) / 36525;
}
