// npm run check
// Compares our Kepler positions with Astronomy Engine over the whole time slider
// (1800-2050) and checks that every drawn orbit passes through its planet.
// Exits with code 1 if anything fails.

import { PLANETS, VALID_FROM_MS, VALID_TO_MS } from '../src/astro/elements';
import { heliocentricPosition, orbitPath, longitude, distance, wrap180 } from '../src/astro/kepler';
import { referencePosition } from '../src/astro/reference';
import { J2000, toJulianDate, centuriesSinceJ2000 } from '../src/astro/julian';

const MAX_ERROR_DEG = 1;
const DAY_MS = 86_400_000;
let failed = false;

// 1. Julian Date self-check
const jd = toJulianDate(new Date(Date.UTC(2000, 0, 1, 12)));
const jdOk = Math.abs(jd - J2000) < 1e-9;
failed ||= !jdOk;
console.log(`Julian Date of J2000: ${jd} ${jdOk ? 'OK' : 'FAIL'}`);

// 2. Today, in detail
const today = new Date();
const Tnow = centuriesSinceJ2000(toJulianDate(today));
console.log(`\nToday ${today.toISOString().slice(0, 10)}`);
for (const p of PLANETS) {
  const v = heliocentricPosition(p, Tnow), r = referencePosition(p.id, today);
  const dl = Math.abs(wrap180(longitude(v) - longitude(r)));
  console.log(`  ${p.id.padEnd(8)} lon ${longitude(v).toFixed(3).padStart(8)}  ref ${longitude(r).toFixed(3).padStart(8)}  dLon ${dl.toFixed(4)}°  r ${distance(v).toFixed(4)} au`);
}

// 3. Whole slider range, every 10 days
const worst = new Map(PLANETS.map((p) => [p.id, { err: 0, at: '' }]));
let samples = 0;
for (let ms = VALID_FROM_MS; ms <= VALID_TO_MS; ms += 10 * DAY_MS) {
  const d = new Date(ms);
  const T = centuriesSinceJ2000(toJulianDate(d));
  for (const p of PLANETS) {
    const dl = Math.abs(wrap180(longitude(heliocentricPosition(p, T)) - longitude(referencePosition(p.id, d))));
    const w = worst.get(p.id)!;
    if (dl > w.err) { w.err = dl; w.at = d.toISOString().slice(0, 10); }
  }
  samples++;
}
console.log(`\n1800-2050, ${samples} dates: largest longitude difference per planet`);
let overall = 0;
for (const p of PLANETS) {
  const w = worst.get(p.id)!;
  overall = Math.max(overall, w.err);
  console.log(`  ${p.id.padEnd(8)} ${w.err.toFixed(4)}°  (${w.at})`);
}
const rangeOk = overall < MAX_ERROR_DEG;
failed ||= !rangeOk;
console.log(`  worst ${overall.toFixed(4)}° ${rangeOk ? 'OK' : 'FAIL'} (limit ${MAX_ERROR_DEG}°)`);

// 4. The drawn orbit must pass through the planet (180 points per orbit)
let orbitOk = true;
for (const p of PLANETS) {
  const v = heliocentricPosition(p, Tnow);
  const path = orbitPath(p, Tnow);
  const gap = Math.min(...path.map((q) => Math.hypot(q.x - v.x, q.y - v.y, q.z - v.z)));
  const limit = (Math.PI * p.base.a) / path.length; // half the spacing between points
  if (gap > limit) { orbitOk = false; console.log(`  orbit of ${p.id} misses the planet by ${gap.toFixed(4)} au`); }
}
failed ||= !orbitOk;
console.log(`\nOrbits pass through planets: ${orbitOk ? 'OK' : 'FAIL'}`);

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: OK');
if (failed) process.exitCode = 1;
