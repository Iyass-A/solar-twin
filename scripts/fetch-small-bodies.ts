// Fetches asteroids and comets from JPL: their current orbits, the covariance of each orbit
// (how uncertain it is), and reference positions from JPL Horizons for the checks.
//
//   npx tsx scripts/fetch-small-bodies.ts data/small-bodies.txt data/small-body-groups.json
//
// Which bodies: the well-known ones listed in data/small-bodies.txt, plus the groups in
// data/small-body-groups.json (SBDB filters, such as all near-Earth asteroids of about 1 km and up).
//
// Writes:
//   src/data/small-bodies.json      a light index for the site: names, groups, current elements,
//                                   the years where our position is accurate, where to find the covariance
//   public/data/cov/N.json          covariance shards (only for orbits fitted with gravity alone, the
//                                   ones the site draws an uncertainty cloud for), loaded when a body is picked
//   scripts/reference/small-bodies-horizons.json   Horizons positions and uncertainties, only for npm run check
//
// Current elements: JPL's standard epoch, shared by most asteroids. SBDB gives comets (and a few
// special solutions) only at their solution epoch, sometimes decades ago (Halley: 1968); for those,
// the current elements are Horizons' osculating elements at the standard epoch, which include the
// planets' pull since then. The covariance keeps the elements it belongs to, at its own epoch.
//
// Each body gets a window around the standard epoch where our Sun-only position stays within 1° of
// Horizons (sampled every ~5 years over ~25 years each way); the site shows it only there.
//
// Runs in GitHub Actions (.github/workflows/fetch-small-bodies.yml), because JPL is not reachable from
// every machine. One request at a time with a short pause, to be fair to JPL.
// APIs: https://ssd-api.jpl.nasa.gov/doc/sbdb.html, sbdb_query.html, horizons.html

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { smallBodyPosition, type SmallBodyOrbit } from '../src/astro/smallbody';

const VALID_DEG = 1;
const LONG_STEP_DAYS = 1826;  // about 5 years
const LONG_STEPS = 5;         // 5 steps each way: about 25 years
const DETAILED_SAMPLE = 60;   // besides the well-known bodies, this many random ones get the detailed checks
const COV_SHARDS = 16;

const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
const QUERY = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const PAUSE_MS = 300;
const USER_AGENT = 'solar-twin (https://github.com/Iyass-A/solar-twin)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

/** GET a JSON API, retrying a few times when the server is busy (HTTP 5xx) or the connection drops. */
async function getJson(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    await sleep(PAUSE_MS);
    requests++;
    let res: Response, text: string;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      text = await res.text();
    } catch (err) {
      if (attempt < 5) { console.log(`  network error, trying again (${attempt})`); await sleep(5000 * attempt); continue; }
      throw err;
    }
    if (res.ok) return JSON.parse(text);
    if (res.status >= 500 && attempt < 5) {
      console.log(`  HTTP ${res.status}, trying again (${attempt})`);
      await sleep(5000 * attempt);
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

/** Angle [deg] between two directions seen from the Sun. */
function separationDeg(a: { x: number; y: number; z: number }, b: number[]): number {
  const c = (a.x * b[0] + a.y * b[1] + a.z * b[2]) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b[0], b[1], b[2]));
  return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
}

function horizonsCommand(kind: string, des: string): string {
  if (kind === 'an') return `${des};`;            // numbered asteroid: "433;"
  if (kind === 'au') return `DES=${des};`;        // unnumbered asteroid
  return `DES=${des};CAP;NOFRAG;`;                 // comet: closest apparition, no fragments
}

/** One Horizons table: the text before it, its lines, and the text after it. */
async function horizonsRaw(command: string, extra: Record<string, string>, from: number, to: number, step: string) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    CENTER: "'500@10'",          // centre of the Sun
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    CSV_FORMAT: "'YES'",
    TIME_TYPE: "'TDB'",
    START_TIME: `'JD ${from.toFixed(5)}'`,
    STOP_TIME: `'JD ${to.toFixed(5)}'`,
    STEP_SIZE: `'${step}'`,
    ...extra,
  });
  const data = await getJson(`${HORIZONS}?${params}`);
  const text: string = data.result ?? '';
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error(`No table in Horizons answer: ${text.slice(0, 300).replace(/\s+/g, ' ')}`);
  return { before: text.slice(0, start), lines: text.slice(start + 5, end).trim().split('\n'), after: text.slice(end + 5) };
}

/** One Horizons table as rows of named columns (CSV), plus the text after the table. */
async function horizonsTable(command: string, extra: Record<string, string>, from: number, to: number, step: string) {
  const { before, lines, after } = await horizonsRaw(command, extra, from, to, step);
  const header = before.split('\n').reverse().find((l) => l.includes('JDTDB'));
  if (!header) throw new Error('No CSV header in Horizons answer');
  // The header may lack a comma between its first two names ("JDTDB   Calendar Date (TDB)")
  const cols = header.replace(/JDTDB\s+Calendar/, 'JDTDB, Calendar').split(',').map((c) => c.trim()).filter(Boolean);
  const rows = lines.map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    if (cells.filter(Boolean).length !== cols.length) throw new Error(`Horizons columns do not line up: ${cols.join('|')} / ${line}`);
    const row: Record<string, number> = {};
    cols.forEach((c, k) => { if (k !== 1) row[c] = Number(cells[k]); });
    return row;
  });
  return { rows, after };
}

/** Heliocentric ecliptic J2000 positions [au] from Horizons, every `stepDays` from `from` to `to`. */
async function horizonsVectors(command: string, from: number, to: number, stepDays: number) {
  const { before, lines } = await horizonsRaw(command, { EPHEM_TYPE: "'VECTORS'", VEC_TABLE: "'1'", OUT_UNITS: "'AU-D'" }, from, to, `${stepDays} d`);
  const target = /Target body name:\s*(.+?)\s{2,}/.exec(before)?.[1] ?? null;
  const rows = lines.map((line) => line.split(',').map((c) => Number(c.trim())));
  if (rows.some((r) => r.length < 5 || [r[0], r[2], r[3], r[4]].some(Number.isNaN))) throw new Error(`Unexpected Horizons vectors: ${lines[0]}`);
  return { target, jd: rows.map((r) => r[0]), pos: rows.map((r) => [r[2], r[3], r[4]]) };
}

/** Osculating heliocentric ecliptic J2000 elements from Horizons at one Julian date (TDB). */
async function horizonsElements(command: string, jd: number): Promise<SmallBodyOrbit> {
  const { rows } = await horizonsTable(command, { EPHEM_TYPE: "'ELEMENTS'", OUT_UNITS: "'AU-D'", TP_TYPE: "'ABSOLUTE'" }, jd, jd + 1, '1 d');
  const r = rows[0];
  return { epoch: r.JDTDB, e: r.EC, q: r.QR, tp: r.Tp, node: r.OM, peri: r.W, i: r.IN };
}

/** Horizons' own formal 1-sigma position uncertainty [km] (along-track A_s, cross-track C_s, normal N_s). */
async function horizonsUncertainty(command: string, jd: number) {
  const { rows, after } = await horizonsTable(command, { EPHEM_TYPE: "'VECTORS'", VEC_TABLE: "'1xa'", OUT_UNITS: "'KM-S'" }, jd, jd + 1, '1 d');
  const explanation = after.split('\n').filter((l) => /_s\s/.test(l)).join('\n').trim();
  return { values: rows[0], explanation };
}

// ---------- Body model during the fetch ----------

interface Body {
  pdes: string;          // JPL primary designation: the key everywhere
  key: string | null;    // its line in data/small-bodies.txt, for the well-known ones (names, table)
  name: string;          // short name for labels (JPL's), e.g. "Eros", "1999 AN10", "Halley"
  full: string;          // JPL's full name, e.g. "433 Eros (A898 PA)"
  kind: string;          // an, au: asteroid; cn, cu: comet
  class: string;
  neo: boolean;
  H: number | null;
  diameter: number | null;
  orbit: SmallBodyOrbit; // current elements
  elementsFrom: 'SBDB' | 'Horizons';
  cov: { epoch: number; elements: Omit<SmallBodyOrbit, 'epoch'>; labels: string[]; matrix: number[][] } | null;
  validFrom: number;
  validTo: number;
  detailed: boolean;
}

/** Short label as JPL writes it: "Eros", "137108 (1999 AN10)", "2024 YR4", "1P/Halley". */
function label(kind: string, pdes: string, name: string | null | undefined, full: string): string {
  if (kind === 'an') return name || full;
  if (kind.startsWith('c')) return name ? `${pdes}/${name}` : pdes;
  return pdes;
}

const yearOf = (jd: number) => (2000 + (jd - 2451545) / 365.25).toFixed(1);

// ---------- Main ----------

const [listFile, groupsFile] = process.argv.slice(2);
if (!listFile || !groupsFile) throw new Error('Usage: npx tsx scripts/fetch-small-bodies.ts data/small-bodies.txt data/small-body-groups.json');
const queries = readFileSync(listFile, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
const { groups } = JSON.parse(readFileSync(groupsFile, 'utf8'));

const bodies = new Map<string, Body>();
const problems: string[] = [];
let sbdbVersion: string | null = null;

// 1. The well-known bodies, one by one
console.log(`1. ${queries.length} well-known bodies`);
for (const q of queries) {
  const d = await getJson(`${SBDB}?sstr=${encodeURIComponent(q)}&phys-par=1&full-prec=1`);
  if (!d.object) throw new Error(`"${q}" did not match exactly one object: ${JSON.stringify(d).slice(0, 400)}`);
  sbdbVersion ??= d.signature?.version ?? null;
  const o = d.object, el = d.orbit.elements, phys = d.phys_par ?? [];
  const orbit: SmallBodyOrbit = {
    epoch: num(d.orbit.epoch)!, e: element(el, 'e')!, q: element(el, 'q')!, tp: element(el, 'tp')!,
    node: element(el, 'om', 'node')!, peri: element(el, 'w', 'peri')!, i: element(el, 'i')!,
  };
  bodies.set(o.des, {
    pdes: o.des, key: q, name: o.kind === 'an' ? o.shortname.replace(/^\d+\s+/, '') : o.shortname || o.des, full: o.fullname.trim(), kind: o.kind,
    class: o.orbit_class?.code ?? '', neo: !!o.neo, H: element(phys, 'H'), diameter: element(phys, 'diameter'),
    orbit, elementsFrom: 'SBDB', cov: null, validFrom: orbit.epoch, validTo: orbit.epoch, detailed: true,
  });
}

// 2. The groups, from the SBDB Query API: current elements for many bodies in one request each
const FIELDS = ['pdes', 'name', 'full_name', 'kind', 'class', 'neo', 'H', 'diameter', 'epoch', 'e', 'q', 'tp', 'om', 'w', 'i'];
for (const g of groups) {
  const d = await getJson(`${QUERY}?${new URLSearchParams({ ...g.params, fields: FIELDS.join(','), sort: g.sort, limit: String(g.limit), 'full-prec': '1' })}`);
  const col = (name: string) => (d.fields as string[]).indexOf(name);
  let added = 0;
  for (const r of d.data as unknown[][]) {
    const pdes = String(r[col('pdes')]);
    if (bodies.has(pdes)) continue;
    const orbit: SmallBodyOrbit = {
      epoch: num(r[col('epoch')])!, e: num(r[col('e')])!, q: num(r[col('q')])!, tp: num(r[col('tp')])!,
      node: num(r[col('om')])!, peri: num(r[col('w')])!, i: num(r[col('i')])!,
    };
    if (Object.values(orbit).some((v) => v === null || Number.isNaN(v)) || !(orbit.e < 1)) {
      problems.push(`${pdes}: incomplete or non-elliptic elements, left out`);
      continue;
    }
    const kind = String(r[col('kind')]), full = String(r[col('full_name')]).trim();
    bodies.set(pdes, {
      pdes, key: null, name: label(kind, pdes, (r[col('name')] as string | null)?.trim(), full), full, kind,
      class: String(r[col('class')] ?? ''), neo: r[col('neo')] === 'Y', H: num(r[col('H')]), diameter: num(r[col('diameter')]),
      orbit, elementsFrom: 'SBDB', cov: null, validFrom: orbit.epoch, validTo: orbit.epoch, detailed: false,
    });
    added++;
  }
  console.log(`2. ${g.id}: ${d.count} match, ${added} new`);
}
console.log(`   ${bodies.size} bodies in all`);

// 3. Covariance for every body: full-precision vector; its order is checked against the full matrix once
let covOrder: 'row' | 'col' | null = null;
let n3 = 0;
for (const b of bodies.values()) {
  if (++n3 % 100 === 0) console.log(`3. covariance ${n3} / ${bodies.size}`);
  const base = `${SBDB}?sstr=${encodeURIComponent(b.pdes)}&full-prec=1`;
  let d: any;
  try { d = await getJson(`${base}&cov=vec`); } catch (err) { problems.push(`${b.pdes}: no SBDB answer for covariance`); continue; }
  if (d.object?.des !== b.pdes) { problems.push(`${b.pdes}: covariance answer is for ${d.object?.des ?? 'no single object'}, left without`); continue; }
  const cov = d.orbit?.covariance;
  if (!cov?.data) continue;
  const n = cov.labels.length;
  const vec = (cov.data as unknown[]).map(Number);
  if (!covOrder) {
    const m = await getJson(`${base}&cov=mat`);
    const mat = (m.orbit.covariance.data as unknown[][]).map((row) => row.map(Number));
    const dRow = relDiff(unpack(vec, n, 'row'), mat), dCol = relDiff(unpack(vec, n, 'col'), mat);
    covOrder = dRow <= dCol ? 'row' : 'col';
    if (Math.min(dRow, dCol) > 1e-3) throw new Error(`Covariance vector matches neither order (row ${dRow}, col ${dCol})`);
    console.log(`3. covariance vectors are stored by ${covOrder} (checked on ${b.pdes})`);
  }
  const ce = cov.elements ?? d.orbit.elements;
  const elements = {
    e: element(ce, 'e')!, q: element(ce, 'q')!, tp: element(ce, 'tp')!,
    node: element(ce, 'om', 'node')!, peri: element(ce, 'w', 'peri')!, i: element(ce, 'i')!,
  };
  if (Object.values(elements).some((v) => v === null || Number.isNaN(v))) { problems.push(`${b.pdes}: covariance elements missing`); continue; }
  b.cov = { epoch: num(cov.epoch)!, elements, labels: cov.labels, matrix: unpack(vec, n, covOrder) };
}

// The standard epoch: the one most bodies share (JPL moves it forward about twice a year)
const counts = new Map<number, number>();
for (const b of bodies.values()) counts.set(b.orbit.epoch, (counts.get(b.orbit.epoch) ?? 0) + 1);
const standardEpoch = [...counts].sort((a, b) => b[1] - a[1])[0][0];
console.log(`\nStandard epoch: JD ${standardEpoch} (${yearOf(standardEpoch)})\n`);

// A fixed random sample of gravity-only bodies for the detailed checks (same choice for the same data)
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
[...bodies.values()]
  .filter((b) => !b.detailed && b.cov?.labels.length === 6)
  .sort((a, b) => hash(a.pdes) - hash(b.pdes))
  .slice(0, DETAILED_SAMPLE)
  .forEach((b) => { b.detailed = true; });

// 4. Horizons: current elements where SBDB's are old, the years where we are accurate, detailed checks
const reference: any[] = [];
let sigmaExplanation = '';
let n4 = 0, failed = 0;
for (const b of [...bodies.values()]) {
  if (failed >= 10 && failed > n4 / 5) throw new Error(`Horizons failed for ${failed} of ${n4} bodies, stopping:\n- ${problems.slice(-5).join('\n- ')}`);
  if (++n4 % 100 === 0) console.log(`4. Horizons ${n4} / ${bodies.size} (${requests} requests so far)`);
  const command = horizonsCommand(b.kind, b.pdes);
  try {
    if (Math.abs(b.orbit.epoch - standardEpoch) > 1) {
      b.orbit = await horizonsElements(command, standardEpoch);
      b.elementsFrom = 'Horizons';
      if (!(b.orbit.e < 1)) throw new Error(`not elliptic now (e ${b.orbit.e})`);
    }
    const span = LONG_STEPS * LONG_STEP_DAYS;
    const long = await horizonsVectors(command, standardEpoch - span, standardEpoch + span, LONG_STEP_DAYS);
    const ref: any = { pdes: b.pdes, target: long.target, longJd: long.jd, longPos: long.pos };
    const samples = long.jd.map((jd, k) => ({ jd, pos: long.pos[k] }));

    // A year each way: for the detailed checks, and for bodies that drift too far within 5 years
    const errAt = (jd: number, pos: number[]) => separationDeg(smallBodyPosition(b.orbit, jd), pos);
    const fiveYears = samples.filter((s) => Math.abs(s.jd - standardEpoch - LONG_STEP_DAYS) < 1 || Math.abs(s.jd - standardEpoch + LONG_STEP_DAYS) < 1);
    if (b.detailed || fiveYears.some((s) => errAt(s.jd, s.pos) > VALID_DEG)) {
      const near = await horizonsVectors(command, standardEpoch - 365, standardEpoch + 365, 365);
      ref.nearJd = near.jd;
      ref.nearPos = near.pos;
      near.jd.forEach((jd, k) => samples.push({ jd, pos: near.pos[k] }));
    }

    // Window: from the standard epoch outwards, as long as every sample stays within VALID_DEG
    const errs = samples.map((s) => ({ jd: s.jd, err: errAt(s.jd, s.pos) })).sort((x, y) => x.jd - y.jd);
    b.validFrom = b.validTo = standardEpoch;
    for (const s of errs.filter((x) => x.jd >= standardEpoch)) { if (s.err > VALID_DEG) break; b.validTo = s.jd; }
    for (const s of errs.filter((x) => x.jd <= standardEpoch).reverse()) { if (s.err > VALID_DEG) break; b.validFrom = s.jd; }

    if (b.detailed && b.cov) {
      const atCov = await horizonsVectors(command, b.cov.epoch, b.cov.epoch + 1, 1);
      ref.covJd = atCov.jd[0];
      ref.covPos = atCov.pos[0];
      if (b.cov.labels.length === 6) {
        const u = await horizonsUncertainty(command, standardEpoch);
        ref.sigmaJd = standardEpoch;
        ref.sigma = { A_s: u.values.A_s, C_s: u.values.C_s, N_s: u.values.N_s };
        sigmaExplanation ||= u.explanation;
      }
    }
    reference.push(ref);
    if (b.detailed) {
      console.log(`  ${b.full}: within ${VALID_DEG}° from ${yearOf(b.validFrom)} to ${yearOf(b.validTo)}` +
        (ref.sigma ? `, Horizons 1σ ${ref.sigma.A_s} / ${ref.sigma.C_s} / ${ref.sigma.N_s} km` : ''));
    }
  } catch (err) {
    failed++;
    problems.push(`${b.pdes} (${b.full}): Horizons failed, left out: ${(err as Error).message.split('\n')[0]}`);
    bodies.delete(b.pdes);
  }
}

// ---------- Output ----------

const fetched = new Date().toISOString();
const round = (x: number | null, digits: number) => (x === null ? null : Number(x.toPrecision(digits)));
const list = [...bodies.values()].sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1)); // well-known first, in list order

// Covariance shards: only gravity-only orbits (the site draws clouds for those), upper triangle of the 6x6 block
rmSync('public/data/cov', { recursive: true, force: true });
mkdirSync('public/data/cov', { recursive: true });
const shards: Record<string, unknown>[] = Array.from({ length: COV_SHARDS }, () => ({}));
const shardOf = new Map<string, number>();
for (const b of list) {
  if (b.cov?.labels.length !== 6) continue;
  const k = hash(b.pdes) % COV_SHARDS;
  shardOf.set(b.pdes, k);
  const m = b.cov.matrix;
  const upper: number[] = [];
  for (let i = 0; i < 6; i++) for (let j = i; j < 6; j++) upper.push(m[i][j]);
  shards[k][b.pdes] = { epoch: b.cov.epoch, elements: b.cov.elements, upper };
}
shards.forEach((s, k) => writeFileSync(`public/data/cov/${k}.json`, JSON.stringify(s)));

const FIELDS_OUT = ['pdes', 'key', 'name', 'full', 'kind', 'class', 'neo', 'H', 'diameter',
  'epoch', 'e', 'q', 'tp', 'node', 'peri', 'i', 'validFrom', 'validTo', 'covParams', 'covShard'];
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/small-bodies.json', JSON.stringify({
  source: 'NASA/JPL Small-Body Database (SBDB) and Horizons APIs',
  sbdbVersion,
  fetched,
  standardEpoch,
  note: 'One row per body, columns as in "fields". Angles in degrees, q in au, tp and epoch as Julian days (TDB). '
    + `validFrom/validTo: Julian days between which our Sun-only position stays within ${VALID_DEG}° of Horizons. `
    + 'covParams: number of fitted parameters (6 = gravity only); covShard: file in public/data/cov with its covariance.',
  fields: FIELDS_OUT,
  rows: list.map((b) => [
    b.pdes, b.key, b.name, b.full, b.kind, b.class, b.neo ? 1 : 0, b.H, round(b.diameter, 6),
    b.orbit.epoch, round(b.orbit.e, 13), round(b.orbit.q, 13), round(b.orbit.tp, 16), round(b.orbit.node, 13),
    round(b.orbit.peri, 13), round(b.orbit.i, 13), b.validFrom, b.validTo, b.cov?.labels.length ?? 0, shardOf.get(b.pdes) ?? null,
  ]),
}));

mkdirSync('scripts/reference', { recursive: true });
writeFileSync('scripts/reference/small-bodies-horizons.json', JSON.stringify({
  source: 'NASA/JPL Horizons API: heliocentric ecliptic J2000 (ICRF) positions in au, TDB; uncertainties in km',
  fetched,
  standardEpoch,
  sigmaNote: `sigma: Horizons' formal 1-sigma position uncertainty at sigmaJd (VEC_TABLE 1xa). Horizons explains:\n${sigmaExplanation}`,
  detailed: list.filter((b) => b.detailed).map((b) => b.pdes),
  reference,
}));

const kinds = (k: string) => list.filter((b) => b.kind.startsWith(k)).length;
console.log(`\n${list.length} bodies (${kinds('a')} asteroids, ${kinds('c')} comets), ${shardOf.size} with an uncertainty cloud, ${requests} requests.`);
if (problems.length) console.log(`Notes (${problems.length}):\n- ${problems.join('\n- ')}`);
