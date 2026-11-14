// Fetches orbits of asteroids and comets, with their covariance (how uncertain each orbit is),
// from JPL's Small-Body Database, and independent reference positions from JPL Horizons.
//
//   npx tsx scripts/fetch-small-bodies.ts data/small-bodies.txt
//
// Writes:
//   src/data/small-bodies.json                    orbits + covariance, used by the site
//
// Two sets of elements per body: the current ones for positions, and the ones at the
// orbit-solution epoch, where the covariance applies (often years back).
// "Current" means JPL's standard epoch, shared by most asteroids. SBDB gives comets (and a few
// special solutions) only at their solution epoch, sometimes decades ago (Halley: 1968); for those,
// the current elements are Horizons' osculating elements at the standard epoch, which include
// the planets' pull since then.
//   scripts/reference/small-bodies-horizons.json  Horizons positions, used only by npm run check
//
// Runs in GitHub Actions (.github/workflows/fetch-small-bodies.yml), because JPL is not
// reachable from every machine. One request at a time with a short pause, to be fair to JPL.
//
// APIs: https://ssd-api.jpl.nasa.gov/doc/sbdb.html and https://ssd-api.jpl.nasa.gov/doc/horizons.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { smallBodyPosition } from '../src/astro/smallbody';

// Our Sun-only orbits drift from the real ones over the years. Each body gets a window around the
// standard epoch where our position stays within VALID_DEG of Horizons; the site shows it only there.
const VALID_DEG = 1;
const LONG_STEP_DAYS = 1826;  // about 5 years
const LONG_STEPS = 5;         // 5 steps each way: about 25 years

const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const PAUSE_MS = 500;
const USER_AGENT = 'solar-twin (https://github.com/Iyass-A/solar-twin)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a JSON API, retrying a few times when the server is busy (HTTP 5xx). */
async function getJson(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    await sleep(PAUSE_MS);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    if (res.status >= 500 && attempt < 5) {
      console.log(`  HTTP ${res.status}, trying again (${attempt})`);
      await sleep(3000 * attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 800)}`);
  }
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** SBDB element lists come as [{ name, label, value, ... }]; find one by name or label. */
function element(list: any, ...keys: string[]): number | null {
  if (Array.isArray(list)) {
    const hit = list.find((x: any) => keys.includes(x.name) || keys.includes(x.label));
    return hit ? num(hit.value) : null;
  }
  if (list && typeof list === 'object') {
    for (const k of keys) if (k in list) return num(list[k]);
  }
  return null;
}

/** Upper-triangular vector -> full symmetric matrix, in row order or column order. */
function unpack(vec: number[], n: number, order: 'row' | 'col'): number[][] {
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let k = 0;
  if (order === 'row') {
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { m[i][j] = m[j][i] = vec[k++]; }
  } else {
    for (let j = 0; j < n; j++) for (let i = 0; i <= j; i++) { m[i][j] = m[j][i] = vec[k++]; }
  }
  if (k !== vec.length) throw new Error(`Covariance vector has ${vec.length} values, expected ${k} for ${n}x${n}`);
  return m;
}

/** Largest difference between two matrices, relative to each entry's scale sqrt(Cii * Cjj). */
function relDiff(a: number[][], b: number[][]): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length; j++) {
      const scale = Math.sqrt(Math.abs(a[i][i] * a[j][j])) || 1;
      worst = Math.max(worst, Math.abs(a[i][j] - b[i][j]) / scale);
    }
  }
  return worst;
}

function horizonsCommand(kind: string, des: string): string {
  if (kind === 'an') return `${des};`;            // numbered asteroid: "433;"
  if (kind === 'au') return `DES=${des};`;        // unnumbered asteroid
  return `DES=${des};CAP;NOFRAG;`;                 // comet: closest apparition, no fragments
}

/** Heliocentric ecliptic J2000 positions [au] from Horizons, every `stepDays` from `from` to `to` (Julian days). */
async function horizonsVectors(command: string, from: number, to: number, stepDays: number) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",          // centre of the Sun
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    VEC_TABLE: "'1'",            // positions only
    OUT_UNITS: "'AU-D'",
    CSV_FORMAT: "'YES'",
    TIME_TYPE: "'TDB'",
    START_TIME: `'JD ${from.toFixed(5)}'`,
    STOP_TIME: `'JD ${to.toFixed(5)}'`,
    STEP_SIZE: `'${stepDays} d'`,
  });
  const data = await getJson(`${HORIZONS}?${params}`);
  const text: string = data.result ?? '';
  const target = /Target body name:\s*(.+?)\s{2,}/.exec(text)?.[1] ?? null;
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error(`No ephemeris in Horizons answer:\n${text.slice(0, 600)}`);
  const rows = text.slice(start + 5, end).trim().split('\n').map((line) => line.split(',').map((s) => s.trim()));
  return {
    target,
    jd: rows.map((r) => Number(r[0])),
    pos: rows.map((r) => [Number(r[2]), Number(r[3]), Number(r[4])]),
  };
}

/** Angle [deg] between two directions seen from the Sun. */
function separationDeg(a: { x: number; y: number; z: number }, b: number[]): number {
  const c = (a.x * b[0] + a.y * b[1] + a.z * b[2]) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b[0], b[1], b[2]));
  return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
}

/** Osculating heliocentric ecliptic J2000 elements from Horizons at one Julian date (TDB). */
async function horizonsElements(command: string, jd: number) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'ELEMENTS'",
    CENTER: "'500@10'",
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    OUT_UNITS: "'AU-D'",
    TP_TYPE: "'ABSOLUTE'",
    CSV_FORMAT: "'YES'",
    TIME_TYPE: "'TDB'",
    START_TIME: `'JD ${jd.toFixed(5)}'`,
    STOP_TIME: `'JD ${(jd + 1).toFixed(5)}'`,
    STEP_SIZE: "'1 d'",
  });
  const data = await getJson(`${HORIZONS}?${params}`);
  const text: string = data.result ?? '';
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error(`No elements in Horizons answer:\n${text.slice(0, 600)}`);
  // Column names from the CSV header line just above $$SOE
  const header = text.slice(0, start).split('\n').reverse().find((l) => l.includes('JDTDB'));
  if (!header) throw new Error('No CSV header in Horizons elements');
  const cols = header.split(',').map((c) => c.trim());
  const row = text.slice(start + 5, end).trim().split('\n')[0].split(',').map((c) => c.trim());
  const get = (name: string) => {
    const k = cols.indexOf(name);
    if (k < 0) throw new Error(`Horizons elements have no column ${name}: ${cols.join(' ')}`);
    return Number(row[k]);
  };
  return { epoch: get('JDTDB'), e: get('EC'), q: get('QR'), tp: get('Tp'), node: get('OM'), peri: get('W'), i: get('IN') };
}

// ---------- Main ----------

const listFile = process.argv[2];
if (!listFile) throw new Error('Usage: npx tsx scripts/fetch-small-bodies.ts data/small-bodies.txt');
const queries = readFileSync(listFile, 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*/, '').trim())
  .filter(Boolean);

const bodies: any[] = [];
const reference: any[] = [];
const problems: string[] = [];
let sbdbVersion: string | null = null;

for (const q of queries) {
  console.log(`${q}`);
  const base = `${SBDB}?sstr=${encodeURIComponent(q)}&phys-par=1&full-prec=1`;
  // 1. Current elements, at JPL's standard epoch (asking for the covariance would move them to the solution epoch)
  const d = await getJson(base);
  if (!d.object) throw new Error(`"${q}" did not match exactly one object: ${JSON.stringify(d).slice(0, 400)}`);
  sbdbVersion ??= d.signature?.version ?? null;
  const o = d.object, orb = d.orbit;
  // 2. Covariance with the elements it belongs to, at the orbit-solution epoch
  const dc = await getJson(`${base}&cov=vec`);
  if (dc.object?.spkid !== o.spkid) throw new Error(`${q}: covariance answer is for another object`);
  const orbC = dc.orbit, cov = orbC?.covariance ?? null;

  // Covariance: full-precision upper-triangular vector, checked against the (rounded) full matrix
  let covOut: any = null;
  if (cov?.data) {
    const n = cov.labels.length;
    const vec = (cov.data as unknown[]).map(Number);
    const m = await getJson(`${base}&cov=mat`);
    const mat = (m.orbit.covariance.data as unknown[][]).map((row) => row.map(Number));
    const byRow = unpack(vec, n, 'row'), byCol = unpack(vec, n, 'col');
    const dRow = relDiff(byRow, mat), dCol = relDiff(byCol, mat);
    const best = dRow <= dCol ? { order: 'row', matrix: byRow, diff: dRow } : { order: 'col', matrix: byCol, diff: dCol };
    if (best.diff > 1e-3) throw new Error(`${q}: covariance vector matches neither order (row ${dRow}, col ${dCol})`);
    console.log(`  covariance ${n}x${n} (${cov.labels.join(', ')}), stored by ${best.order}, max difference to cov=mat ${best.diff.toExponential(1)}`);
    const ce = cov.elements ?? orbC.elements; // given separately only if the epochs differ
    covOut = {
      epoch: num(cov.epoch),
      elements: {
        e: element(ce, 'e'), q: element(ce, 'q'), tp: element(ce, 'tp'),
        node: element(ce, 'om', 'node'), peri: element(ce, 'w', 'peri'), i: element(ce, 'i'),
      },
      labels: cov.labels,
      matrix: best.matrix,
    };
    for (const [k, v] of Object.entries(covOut.elements)) {
      if (v === null || Number.isNaN(v)) throw new Error(`${q}: covariance element ${k} is missing`);
    }
  } else {
    problems.push(`${q}: no covariance`);
  }

  const src = orb.elements;
  const epoch = num(orb.epoch);
  const phys = d.phys_par ?? [];
  const body = {
    query: q,
    spkid: o.spkid,
    des: o.des,
    name: o.fullname,
    short: o.shortname ?? o.fullname,
    kind: o.kind,                       // an, au: asteroid; cn, cu: comet
    class: o.orbit_class?.code ?? null,
    className: o.orbit_class?.name ?? null,
    neo: !!o.neo,
    pha: !!o.pha,
    orbitId: o.orbit_id ?? orb.orbit_id ?? null,
    solutionDate: orb.soln_date ?? null,
    dataArc: num(orb.data_arc),
    observations: num(orb.n_obs_used),
    conditionCode: num(orb.condition_code), // 0 = very well known orbit ... 9 = very uncertain
    epoch,
    e: element(src, 'e'),
    q: element(src, 'q'),
    tp: element(src, 'tp'),
    node: element(src, 'om', 'node'),
    peri: element(src, 'w', 'peri'),
    i: element(src, 'i'),
    H: element(phys, 'H'),
    M1: element(phys, 'M1'),
    diameter: element(phys, 'diameter'),
    cov: covOut,
  };
  for (const k of ['epoch', 'e', 'q', 'tp', 'node', 'peri', 'i'] as const) {
    if (body[k] === null || Number.isNaN(body[k])) throw new Error(`${q}: element ${k} is missing`);
  }
  bodies.push(body);
  console.log(`  ${body.name}: e ${body.e}, q ${body.q} au, i ${body.i}°, epoch JD ${body.epoch}` +
    (covOut ? `, covariance epoch JD ${covOut.epoch}` : ''));

}

// The standard epoch: the one most bodies share (JPL moves it forward about twice a year)
const counts = new Map<number, number>();
for (const b of bodies) counts.set(b.epoch, (counts.get(b.epoch) ?? 0) + 1);
const standardEpoch = [...counts].sort((a, b) => b[1] - a[1])[0][0];
console.log(`\nStandard epoch: JD ${standardEpoch}\n`);

for (const b of bodies) {
  const command = horizonsCommand(b.kind, b.des);
  console.log(`${b.short} (Horizons: ${command})`);
  try {
    // Current elements from Horizons when SBDB's are not at the standard epoch
    if (Math.abs(b.epoch - standardEpoch) > 1) {
      const h = await horizonsElements(command, standardEpoch);
      console.log(`  elements from Horizons at JD ${h.epoch} (SBDB had JD ${b.epoch}): e ${h.e}, q ${h.q} au`);
      b.sbdbEpoch = b.epoch;
      Object.assign(b, h);
      b.elementsFrom = 'Horizons';
    } else {
      b.elementsFrom = 'SBDB';
    }
    // Independent positions, for npm run check: a year before, at, and a year after the standard epoch,
    // and at the covariance epoch
    const ref = await horizonsVectors(command, standardEpoch - 365, standardEpoch + 365, 365);
    const atCov = b.cov ? await horizonsVectors(command, b.cov.epoch, b.cov.epoch + 1, 1) : null;
    const span = LONG_STEPS * LONG_STEP_DAYS;
    const long = await horizonsVectors(command, standardEpoch - span, standardEpoch + span, LONG_STEP_DAYS);
    reference.push({
      spkid: b.spkid, query: b.query, ...ref,
      covJd: atCov ? atCov.jd[0] : null,
      covPos: atCov ? atCov.pos[0] : null,
      longJd: long.jd,
      longPos: long.pos,
    });

    // Validity window: from the epoch outwards, as long as every sample stays within VALID_DEG
    const samples = [...ref.jd.map((jd, k) => ({ jd, pos: ref.pos[k] })), ...long.jd.map((jd, k) => ({ jd, pos: long.pos[k] }))]
      .map((sm) => ({ jd: sm.jd, err: separationDeg(smallBodyPosition(b, sm.jd), sm.pos) }))
      .sort((x, y) => x.jd - y.jd);
    let validFrom = standardEpoch, validTo = standardEpoch;
    for (const sm of samples.filter((x) => x.jd >= standardEpoch)) { if (sm.err > VALID_DEG) break; validTo = sm.jd; }
    for (const sm of samples.filter((x) => x.jd <= standardEpoch).reverse()) { if (sm.err > VALID_DEG) break; validFrom = sm.jd; }
    b.validFrom = validFrom;
    b.validTo = validTo;
    const yr = (jd: number) => (2000 + (jd - 2451545) / 365.25).toFixed(1);
    console.log(`  ${ref.target}: ${ref.jd.length + long.jd.length} positions` + (atCov ? ' + 1 at the covariance epoch' : '') +
      `; within ${VALID_DEG}° from ${yr(validFrom)} to ${yr(validTo)}; errors ${samples.map((x) => x.err.toFixed(2)).join(' ')}`);
  } catch (err) {
    problems.push(`${b.query}: Horizons failed: ${(err as Error).message.split('\n')[0]}`);
    console.log(`  Horizons failed: ${(err as Error).message}`);
  }
}

const fetched = new Date().toISOString();
mkdirSync('src/data', { recursive: true });
mkdirSync('scripts/reference', { recursive: true });
writeFileSync('src/data/small-bodies.json', JSON.stringify({
  source: 'NASA/JPL Small-Body Database (SBDB) API, https://ssd-api.jpl.nasa.gov/doc/sbdb.html',
  sbdbVersion,
  fetched,
  standardEpoch,
  note: 'Angles in degrees, q in au, tp and epoch as Julian days (TDB). Covariance in au, deg, days; labels name the rows. '
    + 'elementsFrom tells where the current elements come from: SBDB at its standard epoch, or Horizons there. '
    + `validFrom/validTo: Julian days between which our Sun-only position stays within ${VALID_DEG}° of Horizons (sampled every ~5 years).`,
  bodies,
}, null, 1));
writeFileSync('scripts/reference/small-bodies-horizons.json', JSON.stringify({
  source: 'NASA/JPL Horizons API: heliocentric ecliptic J2000 (ICRF) positions in au, TDB',
  fetched,
  reference,
}, null, 1));

console.log(`\n${bodies.length} bodies, ${reference.length} with Horizons positions.`);
if (problems.length) console.log(`Notes:\n- ${problems.join('\n- ')}`);
