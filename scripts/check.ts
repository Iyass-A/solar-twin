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
import { equatorialToEcliptic, eclipticLatitude } from '../src/astro/frames';
import starFile from '../src/data/stars.json' with { type: 'json' };
import smallFile from '../src/data/small-bodies.json' with { type: 'json' };
import smallRef from './reference/small-bodies-horizons.json' with { type: 'json' };
import { smallBodyPosition, type SmallBodyOrbit } from '../src/astro/smallbody';
import { readFileSync } from 'node:fs';
import { SMALL_BODY_NAMES } from '../src/data/small-body-names';
import { sampleOrbits, cloudOffsets, type Covariance } from '../src/astro/uncertainty';
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

// 7. Stars: the catalogue file looks right, and stars on the ecliptic land on it
let starsOk = true;
const sd = starFile.stars;
const starCount = sd.length / 4;
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
if (sd.length % 4 !== 0 || starCount < 5000 || starCount > 5200) { starsOk = false; console.log(`  ${starCount} stars, expected about 5080`); }
for (let i = 0; i < starCount; i++) {
  const [ra, dec, mag] = sd.slice(i * 4, i * 4 + 3);
  if (!(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 && mag <= starFile.magLimit)) {
    starsOk = false; console.log(`  star ${i} out of range: ${ra}, ${dec}, ${mag}`); break;
  }
}
// Brightest first: Sirius, RA 101.287°, Dec -16.716°, magnitude -1.46
if (!(near(sd[0], 101.287, 0.01) && near(sd[1], -16.716, 0.01) && sd[2] === -1.46)) { starsOk = false; console.log('  first star is not Sirius'); }
// Polaris (RA 37.95°, Dec 89.26°, mag 2.02) must be in the file
if (![...Array(starCount).keys()].some((i) => near(sd[i * 4], 37.95, 0.05) && near(sd[i * 4 + 1], 89.264, 0.01))) {
  starsOk = false; console.log('  Polaris is missing');
}
// Regulus and Spica sit near the ecliptic: latitude +0.46° and -2.05°
const betaRegulus = eclipticLatitude(equatorialToEcliptic(152.093, 11.967));
const betaSpica = eclipticLatitude(equatorialToEcliptic(201.298, -11.161));
if (!near(betaRegulus, 0.46, 0.02) || !near(betaSpica, -2.05, 0.02)) {
  starsOk = false; console.log(`  ecliptic latitudes: Regulus ${betaRegulus.toFixed(3)}°, Spica ${betaSpica.toFixed(3)}°`);
}
failed ||= !starsOk;
console.log(`Stars: ${starCount} up to magnitude ${starFile.magLimit}, Sirius first, Regulus at ${betaRegulus.toFixed(2)}° from the ecliptic: ${starsOk ? 'OK' : 'FAIL'}`);

// 8. Asteroids and comets: our Kepler positions against JPL Horizons, and the covariance matrices
let smallOk = true;
const listed = readFileSync('data/small-bodies.txt', 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
const sbodies = smallFile.bodies as (SmallBodyOrbit & {
  short: string; spkid: string; query: string; elementsFrom: string; validFrom: number; validTo: number;
  cov: { epoch: number; elements: Omit<SmallBodyOrbit, 'epoch'>; labels: string[]; matrix: number[][] } | null;
})[];
if (sbodies.length !== listed.length || listed.some((q) => !sbodies.some((b) => b.query === q))) {
  smallOk = false; console.log(`  data/small-bodies.txt lists ${listed.length} bodies, the data file has ${sbodies.length}: run the fetch workflow`);
}
const separation = (a: { x: number; y: number; z: number }, b: number[]) => {
  const c = (a.x * b[0] + a.y * b[1] + a.z * b[2]) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b[0], b[1], b[2]));
  return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
};
const worstAt = { now: { v: 0, who: '' }, year: { v: 0, who: '' }, cov: { v: 0, who: '' } };
const note = (k: keyof typeof worstAt, v: number, who: string) => { if (v > worstAt[k].v) worstAt[k] = { v, who }; };
let withCov = 0;
let fullWindow = 0;
let shortest = { years: Infinity, who: '' };
let covBad = 0;
for (const b of sbodies) {
  if (!(b.e < 1) || b.epoch !== smallFile.standardEpoch) { smallOk = false; console.log(`  ${b.short}: e ${b.e}, epoch ${b.epoch}`); }
  const r = smallRef.reference.find((x) => x.spkid === b.spkid);
  if (!r) { smallOk = false; console.log(`  ${b.short}: no Horizons reference`); continue; }
  r.jd.forEach((jd, k) => note(k === 1 ? 'now' : 'year', separation(smallBodyPosition(b, jd), r.pos[k]), b.short));
  // The site shows a body only between validFrom and validTo: every sample there must be within 1°
  if (!(b.validFrom <= smallFile.standardEpoch && smallFile.standardEpoch <= b.validTo)) {
    smallOk = false; console.log(`  ${b.short}: its valid years do not include the standard epoch`);
  }
  r.longJd.forEach((jd, k) => {
    if (jd < b.validFrom || jd > b.validTo) return;
    const err = separation(smallBodyPosition(b, jd), r.longPos[k]);
    if (err > 1) { smallOk = false; console.log(`  ${b.short}: ${err.toFixed(2)}° at JD ${jd}, inside its valid years`); }
  });
  if (b.validFrom <= r.longJd[0] && b.validTo >= r.longJd[r.longJd.length - 1]) fullWindow++;
  const years = (b.validTo - b.validFrom) / 365.25;
  if (years < shortest.years) shortest = { years, who: b.short };
  if (!b.cov) continue;
  withCov++;
  if (r.covJd && r.covPos) note('cov', separation(smallBodyPosition({ ...b.cov.elements, epoch: b.cov.epoch }, r.covJd), r.covPos), b.short);
  // The covariance must be usable for uncertainty clouds: right labels, symmetric, positive definite
  const C = b.cov.matrix, n = C.length;
  if (b.cov.labels.slice(0, 6).join() !== 'e,q,tp,node,peri,i' || C.some((row) => row.length !== n)) {
    smallOk = false; console.log(`  ${b.short}: covariance labels ${b.cov.labels.join()}`);
  }
  const R = C.map((row, i) => row.map((v, j) => v / Math.sqrt(C[i][i] * C[j][j]))); // correlations
  const L: number[][] = R.map(() => new Array(n).fill(0));
  let definite = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (C[i][j] !== C[j][i]) { smallOk = false; console.log(`  ${b.short}: covariance not symmetric`); }
      let sum = R[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(sum > 0)) definite = false;
        L[i][i] = Math.sqrt(Math.max(sum, 0));
      } else {
        L[i][j] = sum / (L[j][j] || 1);
      }
    }
  }
  if (!definite) { smallOk = false; covBad++; console.log(`  ${b.short}: covariance not positive definite`); }
}
// At the standard epoch both use the same elements, so only rounding may differ.
// A year away the planets' pull shows, which our Sun-only orbits leave out.
if (worstAt.now.v > 0.001 || worstAt.cov.v > 0.001 || worstAt.year.v > 0.5) smallOk = false;
failed ||= !smallOk;
console.log(`\nAsteroids and comets: ${sbodies.length} bodies, ${withCov} with covariance (${covBad ? `${covBad} NOT positive definite` : 'all positive definite'}), against JPL Horizons:`);
console.log(`  at the standard epoch (JD ${smallFile.standardEpoch})  ${worstAt.now.v.toExponential(1)}°  (${worstAt.now.who})  limit 0.001°`);
console.log(`  a year before or after            ${worstAt.year.v.toFixed(3)}°  (${worstAt.year.who})  limit 0.5°`);
console.log(`  covariance elements at their epoch ${worstAt.cov.v.toExponential(1)}°  (${worstAt.cov.who})  limit 0.001°`);
console.log(`  shown only where within 1° (sampled every 5 years): ${fullWindow} of ${sbodies.length} for all 50 years, shortest ${shortest.years.toFixed(0)} years (${shortest.who})`);
console.log(`  ${smallOk ? 'OK' : 'FAIL'}`);

// 9. Uncertainty clouds: the sampled orbits must reproduce JPL's covariance (spreads and correlations)
let cloudOk = true;
const N_CHECK = 4000; // statistical noise on a spread: about 1 / sqrt(2 N) = 1.1%
let worstSpread = { v: 0, who: '' }, worstCorr = { v: 0, who: '' };
const KEYS6 = ['e', 'q', 'tp', 'node', 'peri', 'i'] as const;
for (const b of sbodies) {
  if (!b.cov) continue;
  const samples = sampleOrbits(b.cov as Covariance, N_CHECK, 12345);
  if (samples.length !== N_CHECK) { cloudOk = false; console.log(`  ${b.short}: only ${samples.length} samples`); continue; }
  // tp: use the sampled change (dtp), which the sampler keeps apart from the Julian date
  const X = samples.map((o) => KEYS6.map((k) => (k === 'tp' ? o.dtp ?? 0 : o[k])));
  const mean = KEYS6.map((_, i) => X.reduce((sum, x) => sum + x[i], 0) / N_CHECK);
  const C = b.cov.matrix;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j <= i; j++) {
      const c = X.reduce((sum, x) => sum + (x[i] - mean[i]) * (x[j] - mean[j]), 0) / (N_CHECK - 1);
      if (i === j) {
        const ratio = Math.sqrt(c / C[i][i]);
        const off = Math.abs(ratio - 1);
        if (off > worstSpread.v) worstSpread = { v: off, who: `${b.short} ${KEYS6[i]}` };
      } else {
        // correlation from the samples against JPL's
        const si = Math.sqrt(X.reduce((sum, x) => sum + (x[i] - mean[i]) ** 2, 0) / (N_CHECK - 1));
        const sj = Math.sqrt(X.reduce((sum, x) => sum + (x[j] - mean[j]) ** 2, 0) / (N_CHECK - 1));
        const off = Math.abs(c / (si * sj) - C[i][j] / Math.sqrt(C[i][i] * C[j][j]));
        if (off > worstCorr.v) worstCorr = { v: off, who: `${b.short} ${KEYS6[i]}-${KEYS6[j]}` };
      }
    }
  }
}
if (worstSpread.v > 0.05 || worstCorr.v > 0.05) cloudOk = false;

// The cloud's size against Horizons' own position uncertainty (full dynamics, same orbit solution),
// for the bodies the site draws a cloud for: those fitted with gravity alone (6 parameters)
const unitV = (v: { x: number; y: number; z: number }) => { const n = Math.hypot(v.x, v.y, v.z); return { x: v.x / n, y: v.y / n, z: v.z / n }; };
let drawn = 0, compared = 0;
let worstRatio = { v: 1, who: '' };
for (const b of sbodies) {
  if (!b.cov || b.cov.labels.length !== 6) continue;
  drawn++;
  const r = smallRef.reference.find((x) => x.spkid === b.spkid) as { sigma?: Record<string, number | null> | null; sigmaJd?: number | null } | undefined;
  const sg = r?.sigma;
  if (!sg || sg.A_s == null || sg.C_s == null || sg.N_s == null || !r?.sigmaJd) { cloudOk = false; console.log(`  ${b.short}: no Horizons uncertainty to compare`); continue; }
  const off = cloudOffsets(b.cov as Covariance, sampleOrbits(b.cov as Covariance, 2000, 777), r.sigmaJd);
  const ours = Math.sqrt(off.reduce((sum, o) => sum + o.x * o.x + o.y * o.y + o.z * o.z, 0) / off.length) * 149597870.7;
  const theirs = Math.hypot(sg.A_s, sg.C_s, sg.N_s);
  const ratio = ours / theirs;
  compared++;
  if (Math.abs(Math.log(ratio)) > Math.abs(Math.log(worstRatio.v))) worstRatio = { v: ratio, who: b.short };
  if (ratio < 0.8 || ratio > 1.25) { cloudOk = false; console.log(`  ${b.short}: our cloud is ${ratio.toFixed(2)} times Horizons' uncertainty`); }
}
failed ||= !cloudOk;
console.log(`\nUncertainty clouds: ${N_CHECK} sampled orbits per body against JPL's covariance:`);
console.log(`  spreads within ${(worstSpread.v * 100).toFixed(1)}% (${worstSpread.who}), limit 5%`);
console.log(`  correlations within ${worstCorr.v.toFixed(3)} (${worstCorr.who}), limit 0.05`);
console.log(`  size against Horizons' own uncertainty, for the ${drawn} bodies with a cloud: ${compared} compared, worst ${worstRatio.v.toFixed(2)} times (${worstRatio.who}), limit 0.8 to 1.25`);
console.log(`  ${cloudOk ? 'OK' : 'FAIL'}`);

// 10. Languages: every text exists in all three, and the light time reads right in each
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
for (const b of sbodies) {
  for (const l of LANGS) {
    const n = SMALL_BODY_NAMES[b.query]?.[l.id];
    if (!n || !n[0].trim() || !n[1].trim()) { langOk = false; console.log(`  ${l.id}: no name for ${b.short}`); }
  }
}

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
console.log(`Texts in ${LANGS.map((l) => l.id).join(', ')}, with names for all ${sbodies.length} asteroids and comets: ${langOk ? 'OK' : 'FAIL'}`);

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: OK');
if (failed) process.exitCode = 1;
