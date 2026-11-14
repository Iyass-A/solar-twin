// Fetches orbits of asteroids and comets, with their covariance (how uncertain each orbit is),
// from JPL's Small-Body Database, and independent reference positions from JPL Horizons.
//
//   npx tsx scripts/fetch-small-bodies.ts data/small-bodies.txt
//
// Writes:
//   src/data/small-bodies.json                    orbits + covariance, used by the site
//   scripts/reference/small-bodies-horizons.json  Horizons positions, used only by npm run check
//
// Runs in GitHub Actions (.github/workflows/fetch-small-bodies.yml), because JPL is not
// reachable from every machine. One request at a time with a short pause, to be fair to JPL.
//
// APIs: https://ssd-api.jpl.nasa.gov/doc/sbdb.html and https://ssd-api.jpl.nasa.gov/doc/horizons.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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

/** Heliocentric ecliptic J2000 positions [au] from Horizons, a year before, at, and a year after the epoch. */
async function horizonsVectors(command: string, epoch: number) {
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
    START_TIME: `'JD ${(epoch - 365).toFixed(5)}'`,
    STOP_TIME: `'JD ${(epoch + 365).toFixed(5)}'`,
    STEP_SIZE: "'365 d'",
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
  const d = await getJson(`${base}&cov=vec`);
  if (!d.object) throw new Error(`"${q}" did not match exactly one object: ${JSON.stringify(d).slice(0, 400)}`);
  sbdbVersion ??= d.signature?.version ?? null;
  const o = d.object, orb = d.orbit, cov = orb?.covariance ?? null;

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
    covOut = { epoch: num(cov.epoch), labels: cov.labels, matrix: best.matrix };
  } else {
    problems.push(`${q}: no covariance`);
  }

  // Elements at the covariance epoch when they are given separately, else the standard ones
  const src = cov?.elements ?? orb.elements;
  const epoch = cov?.elements ? num(cov.epoch) : num(orb.epoch);
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
  console.log(`  ${body.name}: e ${body.e}, q ${body.q} au, i ${body.i}°, epoch JD ${body.epoch}`);

  // Independent positions from Horizons, for npm run check
  try {
    const ref = await horizonsVectors(horizonsCommand(o.kind, o.des), epoch!);
    reference.push({ spkid: o.spkid, query: q, ...ref });
    console.log(`  Horizons: ${ref.target}, ${ref.jd.length} positions`);
  } catch (err) {
    problems.push(`${q}: Horizons failed: ${(err as Error).message.split('\n')[0]}`);
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
  note: 'Angles in degrees, q in au, tp and epoch as Julian days (TDB). Covariance in au, deg, days; labels name the rows.',
  bodies,
}, null, 1));
writeFileSync('scripts/reference/small-bodies-horizons.json', JSON.stringify({
  source: 'NASA/JPL Horizons API: heliocentric ecliptic J2000 (ICRF) positions in au, TDB',
  fetched,
  reference,
}, null, 1));

console.log(`\n${bodies.length} bodies, ${reference.length} with Horizons positions.`);
if (problems.length) console.log(`Notes:\n- ${problems.join('\n- ')}`);
