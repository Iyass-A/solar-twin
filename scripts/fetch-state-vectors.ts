// Fetches the starting state of the physics engine (phase 5) from JPL Horizons: position and
// velocity of every body and system barycentre in src/physics/bodies.ts, at 00:00 TDB on one day.
// Also their positions every 5 days for a year after, to check the engine against (step 4).
//
//   npx tsx scripts/fetch-state-vectors.ts [YYYY-MM-DD] [outDir]
//
// Without a date: today (UTC). Writes, under outDir (default: the repository itself):
//   src/data/state-vectors.json                  the starting state, for the site
//   scripts/reference/state-vectors-horizons.json  positions for a year, Horizons' names and GM; only for npm run check
// and prints both in the log, between BEGIN and END, so the run needs no write access.
//
// Frame: ICRF, J2000 ecliptic plane, origin at the solar-system barycentre; au and au/day; TDB.
// Runs in GitHub Actions (.github/workflows/fetch-state-vectors.yml), because Horizons is not
// reachable from every machine. One request per body, one at a time.
// API: https://ssd-api.jpl.nasa.gov/doc/horizons.html

import { BODIES, SYSTEMS } from '../src/physics/bodies';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getJson, sleep } from './live-common';

const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const GAP_MS = Number(process.env.GAP_MS ?? 300);
const REF_DAYS = 365;
const REF_STEP_DAYS = 5;
const UNIX_EPOCH_JD = 2440587.5;

function writeText(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text + '\n');
}

const [dateArg, outDir = '.'] = process.argv.slice(2);
const date = dateArg || new Date().toISOString().slice(0, 10);
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
if (!m) throw new Error(`Expected a date like 2026-11-15, got "${date}"`);
const epochJd = Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000 + UNIX_EPOCH_JD;

interface Fetched {
  naif: number;
  name: string;         // "Jupiter (599)"
  ephemeris: string;    // Horizons' source for it, such as "jup365_merged"
  gm: number | null;    // Horizons' GM [km^3/s^2], if it lists one
  gmLine: string | null;
  rows: number[][];     // [jd, x, y, z, vx, vy, vz]
}

/** Positions and velocities of one body from Horizons, every REF_STEP_DAYS for REF_DAYS. */
async function fetchBody(naif: number): Promise<Fetched> {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${naif}'`,            // a plain number is a major body or barycentre
    OBJ_DATA: "'YES'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@0'",               // solar-system barycentre
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    VEC_TABLE: "'2'",                // position and velocity
    VEC_CORR: "'NONE'",              // geometric: where it is, not where it is seen
    OUT_UNITS: "'AU-D'",
    CSV_FORMAT: "'YES'",
    TIME_TYPE: "'TDB'",
    START_TIME: `'JD ${epochJd.toFixed(1)}'`,
    STOP_TIME: `'JD ${(epochJd + REF_DAYS).toFixed(1)}'`,
    STEP_SIZE: `'${REF_STEP_DAYS} d'`,
  });
  const data = await getJson(`${HORIZONS}?${params}`);
  const text: string = data.result ?? '';
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error(`No table in Horizons answer for ${naif}: ${text.slice(0, 600).replace(/\s+/g, ' ')}`);
  const head = text.slice(0, start);

  const target = /Target body name:\s*(.+?)\s*\{source:\s*([^}]+)\}/.exec(head);
  // A barycentre may carry its planet's number when the planet has no moons ("Mercury Barycenter (199)")
  const named = naif < 10 ? /Barycenter/.test(target?.[1] ?? '') : target?.[1].includes(`(${naif})`);
  if (!target || !named) throw new Error(`Horizons answered for "${target?.[1]}", not ${naif}`);
  const center = /Center body name:\s*(.+?)\s{2,}/.exec(head)?.[1] ?? '';
  if (!center.includes('(0)')) throw new Error(`Centre is "${center}", not the solar-system barycentre`);

  // "GM, km^3/s^2 = 22031.86855" or "GM (km^3/s^2) = 5959.9155" (never the "GM 1-sigma" next to it)
  const gmMatch = /^.*?\bGM\b(?! 1-sigma)[^=\n]*=\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/m.exec(head);
  const gm = gmMatch ? Number(gmMatch[1]) : null;

  const rows = text.slice(start + 5, end).trim().split('\n').map((line) => {
    const c = line.split(',').map((s) => s.trim());
    const row = [c[0], ...c.slice(2, 8)].map(Number);
    if (row.length !== 7 || row.some((v) => !Number.isFinite(v))) throw new Error(`Unexpected Horizons row for ${naif}: ${line}`);
    return row;
  });
  const expected = Math.floor(REF_DAYS / REF_STEP_DAYS) + 1;
  if (rows.length !== expected) throw new Error(`${naif}: ${rows.length} rows, expected ${expected}`);
  if (Math.abs(rows[0][0] - epochJd) > 1e-6) throw new Error(`${naif}: first row at JD ${rows[0][0]}, expected ${epochJd}`);
  return { naif, name: target[1].trim(), ephemeris: target[2].trim(), gm, gmLine: gmMatch ? gmMatch[0].trim().replace(/\s+/g, ' ') : null, rows };
}

const ids = [...BODIES.map((b) => b.naif), ...SYSTEMS.map((s) => s.naif)];
console.log(`State vectors at JD ${epochJd} (${date} 00:00 TDB) for ${ids.length} bodies and barycentres`);
const fetched = new Map<number, Fetched>();
for (const naif of ids) {
  const f = await fetchBody(naif);
  fetched.set(naif, f);
  const [, x, y, z, vx, vy, vz] = f.rows[0];
  console.log(`  ${String(naif).padStart(3)} ${f.name.padEnd(28)} ${f.ephemeris.padEnd(16)} r ${Math.hypot(x, y, z).toFixed(6)} au  v ${(Math.hypot(vx, vy, vz) * 1731.456837).toFixed(4)} km/s  GM ${f.gm ?? '-'}`);
  await sleep(GAP_MS);
}

const state = (naif: number) => {
  const [, x, y, z, vx, vy, vz] = fetched.get(naif)!.rows[0];
  return { naif, r: [x, y, z], v: [vx, vy, vz] };
};
const site = {
  source: 'JPL Horizons (https://ssd.jpl.nasa.gov/horizons/)',
  fetched: new Date().toISOString(),
  epochJd,
  frame: 'ICRF, J2000 ecliptic; origin: solar-system barycentre; au, au/day; TDB',
  bodies: BODIES.map((b) => state(b.naif)),
  systems: SYSTEMS.map((s) => state(s.naif)),
};
const round = (v: number) => Number(v.toFixed(12));
const reference = {
  source: site.source,
  fetched: site.fetched,
  epochJd,
  stepDays: REF_STEP_DAYS,
  frame: site.frame,
  targets: Object.fromEntries([...fetched.values()].map((f) => [f.naif, {
    name: f.name, ephemeris: f.ephemeris, gm: f.gm, gmLine: f.gmLine,
    pos: f.rows.map((r) => [round(r[1]), round(r[2]), round(r[3])]),
  }])),
};

/** JSON with one number list per line: readable, and short enough lines for the log. */
const pretty = (obj: unknown) =>
  JSON.stringify(obj, null, 1).replace(/\[\s*([-\d.eE+,\s]+?)\s*\]/g, (_, inner: string) => `[${inner.replace(/\s+/g, '')}]`);

writeText(`${outDir}/src/data/state-vectors.json`, pretty(site));
writeText(`${outDir}/scripts/reference/state-vectors-horizons.json`, pretty(reference));

// Both files in the log too, to be copied from there
console.log('----- BEGIN state-vectors.json -----');
console.log(pretty(site));
console.log('----- END state-vectors.json -----');
console.log('----- BEGIN state-vectors-horizons.json -----');
console.log(pretty(reference));
console.log('----- END state-vectors-horizons.json -----');
