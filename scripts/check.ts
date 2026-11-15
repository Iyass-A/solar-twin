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
import { smallBodyPosition } from '../src/astro/smallbody';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { cadQuery, fileProblems, fromCad, LD_AU, parseSigma, sizeRange, tdbToUtcMs } from '../src/live/closeApproaches';
import * as sw from '../src/live/spaceWeather';
import { SMALL_BODY_NAMES } from '../src/data/small-body-names';
import { sampleOrbits, cloudOffsets, cholesky6 } from '../src/astro/uncertainty';
import { loadSmallBodies, covarianceFrom, type CovEntry } from '../src/view/smallbodies';
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
const smallFail = (msg: string) => { smallOk = false; console.log(`  ${msg}`); };
const listed = readFileSync('data/small-bodies.txt', 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
const sbodies = loadSmallBodies(smallFile as Parameters<typeof loadSmallBodies>[0]);
const STD = smallFile.standardEpoch;
const famousBodies = sbodies.filter((b) => b.famous);
for (const q of listed) if (!sbodies.some((b) => b.key === q)) smallFail(`"${q}" from data/small-bodies.txt is not in the data file: run the fetch workflow`);
if (famousBodies.length !== listed.length) smallFail(`${famousBodies.length} well-known bodies in the data file, ${listed.length} in data/small-bodies.txt`);
if (new Set(sbodies.map((b) => b.id)).size !== sbodies.length) smallFail('two bodies share an id');

interface SmallRef {
  pdes: string; target: string | null; longJd: number[]; longPos: number[][]; nearJd?: number[]; nearPos?: number[][];
  covJd?: number; covPos?: number[]; sigmaJd?: number; sigma?: { A_s: number; C_s: number; N_s: number };
}
const smallRef = JSON.parse(readFileSync('scripts/reference/small-bodies-horizons.json', 'utf8')) as
  { standardEpoch: number; detailed: string[]; reference: SmallRef[] };
const refOf = new Map(smallRef.reference.map((r) => [r.pdes, r]));
const detailed = new Set(smallRef.detailed);

// Covariances: one file per shard, only for orbits fitted with gravity alone
const covFiles = readdirSync('public/data/cov').filter((f) => /^\d+\.json$/.test(f));
const covs = new Map<string, { shard: number; entry: CovEntry }>();
for (const f of covFiles) {
  const shard = Number(f.replace('.json', ''));
  for (const [pdes, entry] of Object.entries(JSON.parse(readFileSync(`public/data/cov/${f}`, 'utf8')) as Record<string, CovEntry>)) {
    covs.set(pdes, { shard, entry });
  }
}

const separation = (a: { x: number; y: number; z: number }, b: number[]) => {
  const c = (a.x * b[0] + a.y * b[1] + a.z * b[2]) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b[0], b[1], b[2]));
  return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
};
const worstAt = { now: { v: 0, who: '' }, yearFamous: { v: 0, who: '' }, yearSample: { v: 0, who: '' }, cov: { v: 0, who: '' }, fast: { v: 0, who: '' } };
const note = (k: keyof typeof worstAt, v: number, who: string) => { if (v > worstAt[k].v) worstAt[k] = { v, who }; };
let fullWindow = 0, covBad = 0;
const windowYears: number[] = [];
for (const b of sbodies) {
  const who = b.jplFull;
  if (!(b.orbit.e < 1) || Math.abs(b.orbit.epoch - STD) > 1) smallFail(`${who}: e ${b.orbit.e}, epoch ${b.orbit.epoch}`);
  if (!LANGS.every((l) => STRINGS[l.id].classes[b.classCode])) smallFail(`${who}: orbit class ${b.classCode} has no name in every language`);
  // The faster position function of the site must give the same positions
  for (const jd of [STD - 9000, STD, STD + 4321.5]) {
    const a = b.at(jd), c = smallBodyPosition(b.orbit, jd);
    note('fast', Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z), who);
  }
  const r = refOf.get(b.pdes);
  if (!r) { smallFail(`${who}: no Horizons reference`); continue; }
  // At the standard epoch both use the same elements, so only rounding may differ
  const k0 = r.longJd.findIndex((jd) => Math.abs(jd - STD) < 1e-6);
  if (k0 < 0) smallFail(`${who}: no Horizons position at the standard epoch`);
  else note('now', separation(b.at(STD), r.longPos[k0]), who);
  // A year before and after: the planets' pull shows, which our Sun-only orbits leave out
  r.nearJd?.forEach((jd, k) => {
    if (Math.abs(jd - STD) > 1) note(b.famous ? 'yearFamous' : 'yearSample', separation(b.at(jd), r.nearPos![k]), who);
  });
  // The site shows a body only between validFrom and validTo: every sample there must be within 1°
  if (!(b.validFrom <= STD && STD <= b.validTo)) smallFail(`${who}: its valid years do not include the standard epoch`);
  const samples = [...r.longJd.map((jd, k) => [jd, r.longPos[k]] as const), ...(r.nearJd ?? []).map((jd, k) => [jd, r.nearPos![k]] as const)];
  for (const [jd, pos] of samples) {
    if (jd < b.validFrom || jd > b.validTo) continue;
    const err = separation(b.at(jd), pos);
    if (err > 1) smallFail(`${who}: ${err.toFixed(2)}° at JD ${jd}, inside its valid years`);
  }
  if (b.validFrom <= r.longJd[0] && b.validTo >= r.longJd[r.longJd.length - 1]) fullWindow++;
  windowYears.push((b.validTo - b.validFrom) / 365.25);

  // Covariance: in the shard the index names, and only for orbits fitted with gravity alone
  const c = covs.get(b.pdes);
  if (!!c !== (b.covShard !== null) || (c && (c.shard !== b.covShard || b.covParams !== 6))) { smallFail(`${who}: covariance file entry does not match the index`); continue; }
  if (!c) continue;
  if (c.entry.upper.length !== 21) { smallFail(`${who}: covariance has ${c.entry.upper.length} values`); continue; }
  const cov = covarianceFrom(c.entry);
  if (r.covJd && r.covPos) note('cov', separation(smallBodyPosition({ ...cov.elements, epoch: cov.epoch }, r.covJd), r.covPos), who);
  if (!cholesky6(cov.matrix)) { covBad++; smallFail(`${who}: covariance not positive definite`); }
}
if (covs.size !== sbodies.filter((b) => b.covShard !== null).length) smallFail(`${covs.size} covariances in the files, but the index expects ${sbodies.filter((b) => b.covShard !== null).length}`);
if (worstAt.now.v > 0.001 || worstAt.cov.v > 0.001 || worstAt.yearFamous.v > 0.5 || worstAt.fast.v > 1e-12) smallOk = false;
failed ||= !smallOk;
windowYears.sort((a, b) => a - b);
const nearOthers = sbodies.filter((b) => !b.famous && refOf.get(b.pdes)?.nearJd).length;
const kinds = (k: string) => sbodies.filter((b) => b.group === k).length;
console.log(`\nAsteroids and comets: ${sbodies.length} bodies (${famousBodies.length} well-known; ${kinds('neo')} near-Earth, ${kinds('asteroid')} other asteroids, ${kinds('dwarf')} dwarf planets, ${kinds('comet')} comets)`);
console.log(`  site's fast positions against the reference formula  ${worstAt.fast.v.toExponential(1)} au  limit 1e-12`);
console.log(`  against JPL Horizons, at the standard epoch (JD ${STD})  ${worstAt.now.v.toExponential(1)}°  (${worstAt.now.who})  limit 0.001°`);
console.log(`  a year before or after, well-known bodies           ${worstAt.yearFamous.v.toFixed(3)}°  (${worstAt.yearFamous.who})  limit 0.5°`);
console.log(`  a year before or after, ${String(nearOthers).padStart(3)} other bodies           ${worstAt.yearSample.v.toFixed(3)}°  (${worstAt.yearSample.who})  for information`);
console.log(`  covariance elements at their epoch                  ${worstAt.cov.v.toExponential(1)}°  (${worstAt.cov.who})  limit 0.001°`);
console.log(`  shown only where within 1° (sampled every 5 years): ${fullWindow} of ${sbodies.length} for all 50 years, median ${windowYears[windowYears.length >> 1].toFixed(0)} years, shortest ${windowYears[0].toFixed(1)}`);
console.log(`  covariances for the clouds, in ${covFiles.length} files: ${covs.size}, ${covBad ? `${covBad} NOT positive definite` : 'all positive definite'}`);
console.log(`  ${smallOk ? 'OK' : 'FAIL'}`);

// 9. Uncertainty clouds. Every cloud the site can draw: its size against Horizons' own position uncertainty
// (full dynamics, same orbit solution). The bodies with detailed checks: the sampled orbits must reproduce
// JPL's covariance, judged against the statistical noise of 4,000 samples (a z-score of each value).
let cloudOk = true;
const cloudFail = (msg: string) => { cloudOk = false; console.log(`  ${msg}`); };
const N_CHECK = 4000;
const KEYS6 = ['e', 'q', 'tp', 'node', 'peri', 'i'] as const;
let worstSpread = { z: 0, v: 0, who: '' }, worstCorr = { z: 0, v: 0, who: '' };
let compared = 0, statChecked = 0;
let worstRatio = { v: 1, who: '' };
const ratios: number[] = [];
for (const b of sbodies) {
  const c = covs.get(b.pdes);
  if (!c) continue;
  const who = b.jplFull;
  const cov = covarianceFrom(c.entry);
  const r = refOf.get(b.pdes);
  const sg = r?.sigma;
  if (!sg || !r?.sigmaJd || [sg.A_s, sg.C_s, sg.N_s].some((v) => !Number.isFinite(v))) { cloudFail(`${who}: no Horizons uncertainty to compare`); continue; }
  const samples2k = sampleOrbits(cov, 2000, 777); // the same samples as in the fetch
  const off = cloudOffsets(cov, samples2k, r.sigmaJd);
  const ours = Math.sqrt(off.reduce((sum, o) => sum + o.x * o.x + o.y * o.y + o.z * o.z, 0) / off.length) * 149597870.7;
  const ratio = ours / Math.hypot(sg.A_s, sg.C_s, sg.N_s);
  compared++;
  ratios.push(ratio);
  if (Math.abs(Math.log(ratio)) > Math.abs(Math.log(worstRatio.v))) worstRatio = { v: ratio, who };
  if (!(ratio >= 0.8 && ratio <= 1.25)) cloudFail(`${who}: our cloud is ${ratio.toFixed(2)} times Horizons' uncertainty`);

  if (!detailed.has(b.pdes)) continue;
  statChecked++;
  const samples = sampleOrbits(cov, N_CHECK, 12345);
  if (samples.length !== N_CHECK) { cloudFail(`${who}: only ${samples.length} samples`); continue; }
  // tp: use the sampled change (dtp), which the sampler keeps apart from the Julian date
  const X = samples.map((o) => KEYS6.map((k) => (k === 'tp' ? o.dtp ?? 0 : o[k])));
  const mean = KEYS6.map((_, i) => X.reduce((sum, x) => sum + x[i], 0) / N_CHECK);
  const sd = KEYS6.map((_, i) => Math.sqrt(X.reduce((sum, x) => sum + (x[i] - mean[i]) ** 2, 0) / (N_CHECK - 1)));
  const C = cov.matrix;
  for (let i = 0; i < 6; i++) {
    // Spread: the noise of a sample standard deviation is about 1 / sqrt(2 N) of it
    const off1 = sd[i] / Math.sqrt(C[i][i]) - 1;
    const z1 = Math.abs(off1) * Math.sqrt(2 * N_CHECK);
    if (z1 > worstSpread.z) worstSpread = { z: z1, v: Math.abs(off1), who: `${who} ${KEYS6[i]}` };
    for (let j = 0; j < i; j++) {
      // Correlation: the noise of a sample correlation is about (1 - rho^2) / sqrt(N)
      const rho = C[i][j] / Math.sqrt(C[i][i] * C[j][j]);
      const rs = X.reduce((sum, x) => sum + (x[i] - mean[i]) * (x[j] - mean[j]), 0) / (N_CHECK - 1) / (sd[i] * sd[j]);
      const z2 = Math.abs(rs - rho) / Math.max((1 - rho * rho) / Math.sqrt(N_CHECK), 1e-6);
      if (z2 > worstCorr.z) worstCorr = { z: z2, v: Math.abs(rs - rho), who: `${who} ${KEYS6[i]}-${KEYS6[j]}` };
    }
  }
}
const noCloud = sbodies.filter((b) => b.covParams === 6 && !covs.has(b.pdes)).length;
if (worstSpread.z > 5 || worstCorr.z > 5 || compared === 0) cloudOk = false;
failed ||= !cloudOk;
ratios.sort((a, b) => a - b);
console.log(`\nUncertainty clouds: ${compared} bodies get one (gravity-only orbits whose cloud matches Horizons; ${noCloud} more gravity-only orbits do not)`);
console.log(`  size against Horizons' own uncertainty: median ${ratios[ratios.length >> 1]?.toFixed(2)}, worst ${worstRatio.v.toFixed(2)} times (${worstRatio.who}), limit 0.8 to 1.25`);
console.log(`  ${N_CHECK} sampled orbits for each of ${statChecked} bodies against JPL's covariance (z: difference / statistical noise, limit 5):`);
console.log(`    spreads within ${(worstSpread.v * 100).toFixed(1)}%, z ${worstSpread.z.toFixed(1)} (${worstSpread.who})`);
console.log(`    correlations within ${worstCorr.v.toFixed(3)}, z ${worstCorr.z.toFixed(1)} (${worstCorr.who})`);
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
for (const q of listed) {
  for (const l of LANGS) {
    const n = SMALL_BODY_NAMES[q]?.[l.id];
    if (!n || !n[0].trim() || !n[1].trim()) { langOk = false; console.log(`  ${l.id}: no name for ${q}`); }
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
console.log(`Texts in ${LANGS.map((l) => l.id).join(', ')}, with names for all ${listed.length} well-known asteroids and comets: ${langOk ? 'OK' : 'FAIL'}`);

// 11. Live data: close approaches to Earth (CNEOS). The parser, sizes and times always; the file itself
//     only where it exists, which is on GitHub before a deploy (it is fetched there, never committed).
let liveOk = true;
const liveFail = (msg: string) => { liveOk = false; console.log(`  ${msg}`); };
const SIGMA_CASES: [unknown, number | null][] = [['< 00:01', 0], ['00:12', 12], ['13:02', 782], ['2_09:08', 3428], ['', null], [null, null], ['soon', null]];
for (const [s, want] of SIGMA_CASES) if (parseSigma(s) !== want) liveFail(`time uncertainty "${s}": got ${parseSigma(s)}, want ${want}`);
// CNEOS: H 22 is about 110 to 240 m
const [dSmall, dLarge] = sizeRange(22);
if (Math.abs(dSmall - 0.106) > 0.003 || Math.abs(dLarge - 0.237) > 0.003) liveFail(`size for H 22: ${dSmall} to ${dLarge} km`);
// 2026-01-01 00:00 TDB is 69.184 s earlier in UTC (TT - UTC since 2017; J2000 itself is 2451545)
const tdb2026 = J2000 + 9496.5;
if (new Date(tdbToUtcMs(tdb2026)).toISOString() !== '2025-12-31T23:58:50.816Z') liveFail(`2026-01-01 00:00 TDB in UTC: ${new Date(tdbToUtcMs(tdb2026)).toISOString()}`);
const q = cadQuery(Date.UTC(2026, 10, 15, 4, 17));
if (q.dateMin !== '2026-11-08' || q.dateMax !== '2027-01-14' || !q.url.includes('dist-max=0.05') || !q.url.includes('fullname=true')) liveFail(`query ${q.url}`);
// An answer in JPL's format (rows as in its documentation; values come as strings)
const cadSample = () => ({
  signature: { source: 'NASA/JPL SBDB Close Approach Data API', version: '1.5' },
  count: 3,
  fields: ['des', 'orbit_id', 'jd', 'cd', 'dist', 'dist_min', 'dist_max', 'v_rel', 'v_inf', 't_sigma_f', 'h', 'diameter', 'diameter_sigma', 'fullname'],
  data: [
    ['153814', '84', '2461948.724', '2028-Jun-26 05:23', '0.00165833', '0.00165821', '0.00165845', '10.2409', '10.2339', '< 00:01', '18.33', '0.932', '0.011', '153814 (2001 WN5)'],
    ['99942', '219', '2462240.407', '2029-Apr-13 21:46', '0.000254128', '0.000254120', '0.000254136', '7.42291', '5.84105', '< 00:01', '19.7', '0.34', '0.04', '99942 Apophis (2004 MN4)'],
    ['2001 AV43', '12', '2462452.142', '2029-Nov-11 15:25', '0.00209', '0.00203', '0.00215', '4.0', '3.9', '00:03', '24.6', null, null, '       (2001 AV43)'],
  ],
});
const info = { fetchedAt: '2026-11-15T04:17:00.000Z', dateMin: '2028-01-01', dateMax: '2030-01-01', distMaxAu: 0.05 };
try {
  const { file, dropped } = fromCad(cadSample(), info);
  const [wn5, apophis, av43] = file.approaches;
  if (dropped.length || file.approaches.length !== 3) liveFail(`sample: ${file.approaches.length} rows, dropped ${dropped.join('; ')}`);
  if (apophis.name !== '99942 Apophis (2004 MN4)' || av43.name !== '2001 AV43' || wn5.diameter !== 0.932 || av43.diameter !== null) liveFail('sample: names or diameters');
  if (Math.abs(apophis.dist / LD_AU - 0.0989) > 0.001 || av43.tSigmaMin !== 3 || apophis.h !== 19.7) liveFail(`sample: Apophis at ${apophis.dist / LD_AU} LD`);
  if (fileProblems(file).length) liveFail(`sample file: ${fileProblems(file).join('; ')}`);
} catch (err) { liveFail(`sample: ${err}`); }
// What must be refused: another version, a missing field, mostly broken rows. One broken row is only left out.
const refused = (label: string, change: (r: any) => void, mustThrow = true) => {
  const r = cadSample(); change(r);
  let threw = false, dropped = 0;
  try { dropped = fromCad(r, info).dropped.length; } catch { threw = true; }
  if (mustThrow ? !threw : threw || dropped !== 1) liveFail(`${label}: ${threw ? 'refused' : `accepted, ${dropped} rows left out`}`);
};
refused('version 2.0', (r) => { r.signature.version = '2.0'; });
refused('no v_rel field', (r) => { r.fields[7] = 'speed'; });
refused('count does not match', (r) => { r.count = 4; });
refused('two of three rows broken', (r) => { r.data[0][4] = '-1'; r.data[1][7] = 'fast'; });
refused('one row too far', (r) => { r.data[2][4] = '0.2'; r.data[2][6] = '0.2'; }, false);
if (fromCad({ signature: { source: 'NASA/JPL SBDB Close Approach Data API', version: '1.5' }, count: 0 }, info).file.approaches.length !== 0) liveFail('empty answer');
// The card's texts: [value, Arabic, German, English]
const REL_CASES: [number, string, string, string][] = [
  [0.5, 'بعد أقل من ساعة', 'in weniger als 1 Stunde', 'in under an hour'],
  [-0.5, 'من أقل من ساعة', 'vor weniger als 1 Stunde', 'under an hour ago'],
  [1, 'بعد ساعة', 'in 1 Stunde', 'in 1 hour'],
  [10, 'بعد 10 ساعات', 'in 10 Stunden', 'in 10 hours'],
  [-27, 'من 27 ساعة', 'vor 27 Stunden', '27 hours ago'],
  [48, 'بعد يومين', 'in 2 Tagen', 'in 2 days'],
  [-7 * 24, 'من 7 أيام', 'vor 7 Tagen', '7 days ago'],
  [19 * 24, 'بعد 19 يوم', 'in 19 Tagen', 'in 19 days'],
];
const DURATION_CASES: [number, string, string, string][] = [
  [2, 'دقيقتين', '2 Minuten', '2 minutes'],
  [45, '45 دقيقة', '45 Minuten', '45 minutes'],
  [120, 'ساعتين', '2 Stunden', '2 hours'],
  [7408, '5 أيام', '5 Tage', '5 days'],
];
const textCase = (label: string, got: string[], want: string[]) => want.forEach((w, i) => {
  if (got[i] !== w) liveFail(`${label}: got "${got[i]}", want "${w}"`);
});
for (const [h, ...want] of REL_CASES) textCase(`${h} h`, [STRINGS.ar.relTime(h), STRINGS.de.relTime(h), STRINGS.en.relTime(h)], want);
for (const [m, ...want] of DURATION_CASES) textCase(`${m} min`, [STRINGS.ar.duration(m), STRINGS.de.duration(m), STRINGS.en.duration(m)], want);
textCase('33 ahead, none closer than the Moon', [STRINGS.ar.caAhead(33, 0, 'X'), STRINGS.de.caAhead(33, 0, 'X'), STRINGS.en.caAhead(33, 0, 'X')],
  ['لحد X: 33 مرور، ولا واحد منهم أقرب من القمر.', 'Bis X: 33 Vorbeiflüge, keiner davon näher als der Mond.', 'Until X: 33 close approaches, none of them closer than the Moon.']);
textCase('1 ahead, closer than the Moon', [STRINGS.ar.caAhead(1, 1, 'X'), STRINGS.de.caAhead(1, 1, 'X'), STRINGS.en.caAhead(1, 1, 'X')],
  ['لحد X: مرور واحد، واحد منهم أقرب من القمر.', 'Bis X: 1 Vorbeiflug, 1 davon näher als der Mond.', 'Until X: 1 close approach, 1 of them closer than the Moon.']);
textCase('none ahead', [STRINGS.ar.caAhead(0, 0, 'X'), STRINGS.de.caAhead(0, 0, 'X'), STRINGS.en.caAhead(0, 0, 'X')],
  ['لحد X: ولا مرور.', 'Bis X: kein Vorbeiflug.', 'Until X: no close approaches.']);
const livePath = 'public/data/live/close-approaches.json';
let liveNote = 'no file here (it is fetched on GitHub before each deploy)';
if (existsSync(livePath)) {
  const live = JSON.parse(readFileSync(livePath, 'utf8'));
  const problems = fileProblems(live);
  for (const p of problems.slice(0, 5)) liveFail(`${livePath}: ${p}`);
  const ahead = (live.approaches ?? []).filter((a: { jd: number }) => tdbToUtcMs(a.jd) >= Date.now()).length;
  liveNote = `${live.approaches?.length} approaches in ${livePath} (${ahead} ahead), fetched ${live.fetchedAt}`;
}
failed ||= !liveOk;
console.log(`\nClose approaches (CNEOS): parser, sizes and times ${liveOk ? 'OK' : 'FAIL'}; ${liveNote}`);

// 12. Live data: space weather (NOAA SWPC, NASA DONKI). The file only where it exists (on GitHub).
let swOk = true;
const swFail = (msg: string) => { swOk = false; console.log(`  ${msg}`); };
const swPath = 'public/data/live/space-weather.json';
let swNote = 'no file here (it is fetched on GitHub before each deploy)';
if (existsSync(swPath)) {
  const f = JSON.parse(readFileSync(swPath, 'utf8'));
  for (const p of sw.fileProblems(f).slice(0, 5)) swFail(`${swPath}: ${p}`);
  swNote = `${swPath}: ${sw.PART_NAMES.map((n) => `${n} ${f[n] ? `from ${f[n].fetchedAt}` : 'missing'}`).join(', ')}`;
}
failed ||= !swOk;
console.log(`\nSpace weather: ${swOk ? 'OK' : 'FAIL'}; ${swNote}`);

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: OK');
if (failed) process.exitCode = 1;
