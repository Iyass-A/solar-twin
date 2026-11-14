// npm run check
// Compares our Kepler positions with Astronomy Engine over the whole time slider
// (1800-2050) and checks that every drawn orbit passes through its planet.
// Exits with code 1 if anything fails.

import { PLANETS, VALID_FROM_MS, VALID_TO_MS } from '../src/astro/elements';
import { heliocentricPosition, orbitPath, longitude, distance, wrap180 } from '../src/astro/kepler';
import { referencePosition } from '../src/astro/reference';
import { J2000, toJulianDate, centuriesSinceJ2000 } from '../src/astro/julian';
import { VIEWS, toScene } from '../src/view/views';
import { SATURN_POLE } from '../src/astro/poles';
import { STRINGS, LANGS } from '../src/i18n';

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

// 5. The 3D scene keeps every direction, turns the same way (counter-clockwise seen from
//    the north, which is up in Three.js) and fits all planets inside the view
const SCENE_R = 100;
let sceneOk = true;
for (const mode of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
  const view = VIEWS[mode];
  for (const p of PLANETS) {
    const v = heliocentricPosition(p, Tnow);
    const [X, Y, Z] = toScene(v, view, SCENE_R);
    const back = { x: X, y: -Z, z: Y }; // undo the axis swap
    const cos = (back.x * v.x + back.y * v.y + back.z * v.z) / (distance(back) * distance(v));
    const fits = distance(v) > view.rMax || distance(back) <= SCENE_R;
    if (cos < 1 - 1e-12 || !fits) { sceneOk = false; console.log(`  3D ${mode}: ${p.id} is off`); }
  }
}
const [ax, , az] = toScene({ x: 1, y: 0, z: 0 }, VIEWS.true, SCENE_R);
const [bx, , bz] = toScene({ x: 0, y: 1, z: 0 }, VIEWS.true, SCENE_R);
const upward = az * bx - ax * bz; // y part of (x axis) × (y axis), must point up
if (upward <= 0) { sceneOk = false; console.log('  3D: the scene is mirrored'); }
failed ||= !sceneOk;
console.log(`3D scene keeps directions and turning: ${sceneOk ? 'OK' : 'FAIL'}`);

// 6. Saturn's rings: the angle between its pole and its orbit's pole is its axial tilt, 26.73°
const sat = PLANETS.find((p) => p.id === 'saturn')!;
const I = sat.base.I * Math.PI / 180, O = sat.base.O * Math.PI / 180;
const orbitNormal = { x: Math.sin(I) * Math.sin(O), y: -Math.sin(I) * Math.cos(O), z: Math.cos(I) };
const tilt = Math.acos(SATURN_POLE.x * orbitNormal.x + SATURN_POLE.y * orbitNormal.y + SATURN_POLE.z * orbitNormal.z) * 180 / Math.PI;
const tiltOk = Math.abs(tilt - 26.73) < 0.1;
failed ||= !tiltOk;
console.log(`Saturn's tilt from its pole: ${tilt.toFixed(2)}° (known 26.73°) ${tiltOk ? 'OK' : 'FAIL'}`);

// 7. Languages: every text exists in all three, and the light time reads right in each
let langOk = true;
function sameShape(a: unknown, b: unknown, path: string, l: string) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    langOk = false; console.log(`  ${l}: ${path} is missing or of the wrong kind`); return;
  }
  if (typeof a === 'string' && !(b as string).trim()) { langOk = false; console.log(`  ${l}: ${path} is empty`); }
  if (a && typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b as object);
    if (ka.join() !== kb.join()) { langOk = false; console.log(`  ${l}: ${path} has keys ${kb.join()} instead of ${ka.join()}`); }
    for (const k of ka) sameShape((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, l);
  }
}
for (const l of LANGS) sameShape(STRINGS.ar, STRINGS[l.id], 'texts', l.id);
for (const p of PLANETS) for (const l of LANGS) if (!STRINGS[l.id].planets[p.id]) langOk = false;

// [minutes, Arabic, German, English]. 243 min is Neptune's ~4 h 3 min; 119.7 min must round up to 2 hours.
const LIGHT_CASES: [number, string, string, string][] = [
  [8.32, '8.3 دقيقة', '8,3 Minuten', '8.3 minutes'],
  [60, 'ساعة', '1 Stunde', '1 hour'],
  [119.7, 'ساعتين', '2 Stunden', '2 hours'],
  [243, '4 ساعات و3 دقائق', '4 Stunden und 3 Minuten', '4 hours 3 minutes'],
  [662, '11 ساعة ودقيقتين', '11 Stunden und 2 Minuten', '11 hours 2 minutes'],
  [61, 'ساعة ودقيقة', '1 Stunde und 1 Minute', '1 hour 1 minute'],
];
for (const [min, ar, de, en] of LIGHT_CASES) {
  const got = [STRINGS.ar.light(min), STRINGS.de.light(min), STRINGS.en.light(min)];
  [ar, de, en].forEach((want, i) => {
    if (got[i] !== want) { langOk = false; console.log(`  light time ${min} min: got "${got[i]}", want "${want}"`); }
  });
}
failed ||= !langOk;
console.log(`Texts in ${LANGS.map((l) => l.id).join(', ')}: ${langOk ? 'OK' : 'FAIL'}`);

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: OK');
if (failed) process.exitCode = 1;
