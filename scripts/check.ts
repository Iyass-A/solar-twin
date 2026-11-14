import { PLANETS } from '../src/astro/elements';
import { heliocentricPosition, longitude, distance, wrap180 } from '../src/astro/kepler';
import { referencePosition } from '../src/astro/reference';
import { toJulianDate, centuriesSinceJ2000 } from '../src/astro/julian';

const dates = [new Date(), new Date(Date.UTC(1900,0,1)), new Date(Date.UTC(2000,0,1,12)), new Date(Date.UTC(2049,5,1))];
let worst = 0;
for (const d of dates) {
  const T = centuriesSinceJ2000(toJulianDate(d));
  console.log(d.toISOString().slice(0,10));
  for (const p of PLANETS) {
    const v = heliocentricPosition(p, T), r = referencePosition(p.id, d);
    const dl = Math.abs(wrap180(longitude(v) - longitude(r)));
    const dr = Math.abs(distance(v) - distance(r));
    worst = Math.max(worst, dl);
    console.log(`  ${p.id.padEnd(8)} lon ${longitude(v).toFixed(3).padStart(8)}  ref ${longitude(r).toFixed(3).padStart(8)}  dLon ${dl.toFixed(4)}°  r ${distance(v).toFixed(4)} au  dR ${dr.toFixed(5)}`);
  }
}
console.log('worst dLon', worst.toFixed(4));
