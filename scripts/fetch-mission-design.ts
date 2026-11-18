// Fetches reference trips from JPL's Small-Body Mission Design tool (phase 6, step 6), to check our trip
// planner against: for a few well-known asteroids and a comet, the ballistic trips from Earth that JPL has
// worked out (mode Q: its picked missions) and a grid of launch dates and times of flight (mode M: a
// porkchop map). Our Lambert solver, flown to the same body on the same dates, must give the same speeds.
// So that the check tests the trip calculation and not where our site puts the bodies (it moves asteroids
// with the Sun alone), it also fetches from JPL Horizons the Earth's and each body's position and velocity
// round the Sun on every date that the kept trips leave or arrive (MJD, TDB).
//
//   npx tsx scripts/fetch-mission-design.ts [bodies] [outDir]
//
// bodies: designations separated by commas (default: BODIES below). Writes, under outDir (default: the
// repository itself), scripts/reference/mission-design-jpl.json (only for npm run check, not shipped), and
// prints it in the log between BEGIN and END, so the run needs no write access. The map is kept every
// KEEP-th launch date and time of flight, plus the cheapest point of the full map for each measure.
//
// Runs in GitHub Actions (.github/workflows/fetch-mission-design.yml), because JPL's API is not reachable
// from every machine. A handful of requests, one at a time.
// API: https://ssd-api.jpl.nasa.gov/doc/mdesign.html

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getJson, sleep } from './live-common';

const API = 'https://ssd-api.jpl.nasa.gov/mdesign.api';
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
/** Dates per Horizons request (it takes up to 10,000; this keeps the address short). */
const TLIST_CHUNK = 50;
/** Eros, Vesta, Psyche, Didymos, Bennu, Ceres, Ryugu and comet 67P: orbits our site follows within 1° for years. */
const BODIES = ['433', '4', '16', '65803', '101955', '1', '162173', '67P'];
/** The map: launches from 1 November 2026 for ten years, 30 to 1,500 days on the way, every 10 days. */
const GRID = { mjd0: 61345, span: 3650, tofMin: 30, tofMax: 1500, step: 10 };
/** Every KEEP-th launch date and time of flight is kept (every 100 days). */
const KEEP = 10;
const MAP_FIELDS = ['vinf_dep', 'vinf_arr', 'decl_dep', 'earth_dist', 'elong_arr'] as const;
const GAP_MS = 1500;

const [bodiesArg, outDir = '.'] = process.argv.slice(2);
const bodies = bodiesArg ? bodiesArg.split(',').map((s) => s.trim()).filter(Boolean) : BODIES;
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const enc = (des: string) => encodeURIComponent(des);

const out: Record<string, unknown> = {
  source: 'NASA/JPL Small-Body Mission Design API (https://ssd-api.jpl.nasa.gov/doc/mdesign.html)',
  fetched: new Date().toISOString(),
  grid: { ...GRID, keep: KEEP },
  note: 'Per body: object (JPL\'s orbit), q (mode Q: fields and its picked missions), map (mode M, every keep-th launch date and time of flight: '
    + 'dep (MJD), tof (days), and for each field a [tof][dep] array; null where JPL has no trip) and min (the cheapest point of the full map for vinf_dep, vinf_arr and their sum).',
  bodies: {} as Record<string, unknown>,
};

for (const des of bodies) {
  console.log(`\n=== ${des}`);
  const entry: Record<string, unknown> = {};
  try {
    const q = await getJson(`${API}?des=${enc(des)}`);
    console.log(`  Q: signature ${JSON.stringify(q.signature)}, ${q.selectedMissions?.length ?? 0} missions; object ${JSON.stringify(q.object)}`);
    if (q.warning || q.message) console.log(`  Q says: ${q.warning ?? ''} ${q.message ?? ''}`);
    entry.signature = q.signature;
    entry.object = q.object;
    entry.q = { fields: q.fields, missions: (q.selectedMissions ?? []).map((row: unknown[]) => row.map(num)), warning: q.warning ?? q.message ?? null };
    await sleep(GAP_MS);

    const m = await getJson(`${API}?des=${enc(des)}&mjd0=${GRID.mjd0}&span=${GRID.span}&tof-min=${GRID.tofMin}&tof-max=${GRID.tofMax}&step=${GRID.step}`);
    if (!Array.isArray(m.dep_date) || !Array.isArray(m.tof)) {
      console.log(`  M: no map. Keys: ${Object.keys(m).join(', ')}; ${JSON.stringify(m).slice(0, 400)}`);
    } else {
      const dep = m.dep_date.map(Number), tof = m.tof.map(Number);
      console.log(`  M: ${dep.length} launch dates (${dep[0]} to ${dep[dep.length - 1]}) × ${tof.length} times of flight (${tof[0]} to ${tof[tof.length - 1]}); fields ${MAP_FIELDS.filter((f) => Array.isArray(m[f])).join(', ')}`);
      if (m.warning || m.message) console.log(`  M says: ${m.warning ?? ''} ${m.message ?? ''}`);
      const di = dep.map((_: number, i: number) => i).filter((i: number) => i % KEEP === 0);
      const ti = tof.map((_: number, j: number) => j).filter((j: number) => j % KEEP === 0);
      const map: Record<string, unknown> = { dep: di.map((i: number) => dep[i]), tof: ti.map((j: number) => tof[j]) };
      for (const f of MAP_FIELDS) {
        if (!Array.isArray(m[f])) continue;
        map[f] = ti.map((j: number) => di.map((i: number) => num(m[f][j]?.[i])));
      }
      entry.map = map;
      // The cheapest point of the full map, for each measure
      const min: Record<string, unknown> = {};
      for (const f of ['vinf_dep', 'vinf_arr', 'sum'] as const) {
        let best: { dep: number; tof: number; value: number } | null = null;
        for (let j = 0; j < tof.length; j++) {
          for (let i = 0; i < dep.length; i++) {
            const a = num(m.vinf_dep?.[j]?.[i]), b = num(m.vinf_arr?.[j]?.[i]);
            const v = f === 'sum' ? (a !== null && b !== null ? a + b : null) : f === 'vinf_dep' ? a : b;
            if (v !== null && Number.isFinite(v) && (!best || v < best.value)) best = { dep: dep[i], tof: tof[j], value: v };
          }
        }
        min[f] = best;
      }
      entry.min = min;
      console.log(`  M cheapest: ${JSON.stringify(min)}`);
      console.log(`  M first row: ${JSON.stringify(MAP_FIELDS.map((f) => [f, m[f]?.[0]?.slice(0, 4)]))}`);
    }
  } catch (err) {
    console.log(`::warning title=Mission design::${des}: ${String(err)}`);
    entry.error = String(err);
  }
  (out.bodies as Record<string, unknown>)[des] = entry;
  await sleep(GAP_MS);
}

// ---------- Horizons: the Earth and each body round the Sun on the trips' dates ----------

/** Heliocentric ecliptic J2000 position [km] and velocity [km/s] from Horizons on each MJD (TDB). */
async function horizonsStates(command: string, mjds: number[]) {
  const states: Record<string, number[]> = {};
  let target = '';
  for (let k = 0; k < mjds.length; k += TLIST_CHUNK) {
    const chunk = mjds.slice(k, k + TLIST_CHUNK);
    const params = new URLSearchParams({
      format: 'json', COMMAND: `'${command}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'",
      CENTER: "'500@10'", REF_PLANE: "'ECLIPTIC'", REF_SYSTEM: "'ICRF'", VEC_TABLE: "'2'", VEC_CORR: "'NONE'",
      OUT_UNITS: "'KM-S'", CSV_FORMAT: "'YES'", TIME_TYPE: "'TDB'", TLIST_TYPE: "'MJD'", TLIST: `'${chunk.join(' ')}'`,
    });
    const data = await getJson(`${HORIZONS}?${params}`);
    const text: string = data.result ?? '';
    const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
    if (start < 0 || end < 0) throw new Error(`No table in Horizons answer for ${command}: ${text.slice(0, 400).replace(/\s+/g, ' ')}`);
    target = /Target body name:\s*(.+?)\s{2,}/.exec(text.slice(0, start))?.[1] ?? target;
    const lines = text.slice(start + 5, end).trim().split('\n');
    if (lines.length !== chunk.length) console.log(`  Horizons ${command}: asked ${chunk.length} dates (${chunk[0]}…${chunk[chunk.length - 1]}), got ${lines.length}: ${lines[0]?.slice(0, 40)} … ${lines[lines.length - 1]?.slice(0, 40)}`);
    for (const line of lines) {
      const c = line.split(',').map((x) => x.trim());
      const jd = Number(c[0]), v = c.slice(2, 8).map(Number);
      if (!Number.isFinite(jd) || v.length !== 6 || v.some((x) => !Number.isFinite(x))) throw new Error(`Unexpected Horizons row for ${command}: ${line}`);
      states[String(Math.round(jd - 2400000.5))] = [...v.slice(0, 3).map((x) => Number(x.toFixed(2))), ...v.slice(3).map((x) => Number(x.toFixed(8)))];
    }
    await sleep(GAP_MS);
  }
  const missing = mjds.filter((m) => !states[String(m)]);
  if (missing.length) throw new Error(`Horizons gave no state for ${command} on MJD ${missing.slice(0, 5).join(', ')}…`);
  return { target, states };
}

/** The dates a body's kept trips leave on (the Earth's) and arrive on (the Earth's and the body's). */
function tripDates(entry: any) {
  const dep = new Set<number>(), arr = new Set<number>();
  const f: string[] = entry.q?.fields ?? [];
  for (const r of entry.q?.missions ?? []) { dep.add(r[f.indexOf('MJD0')]); arr.add(r[f.indexOf('MJDf')]); }
  for (const d of entry.map?.dep ?? []) for (const t of entry.map?.tof ?? []) { dep.add(d); arr.add(d + t); }
  for (const m of Object.values<any>(entry.min ?? {})) if (m) { dep.add(m.dep); arr.add(m.dep + m.tof); }
  return { dep: [...dep].filter(Number.isFinite), arr: [...arr].filter(Number.isFinite) };
}

const earthDates = new Set<number>();
const horizons: Record<string, unknown> = {};
for (const [des, entry] of Object.entries<any>(out.bodies as Record<string, unknown>)) {
  if (entry.error) continue;
  const { dep, arr } = tripDates(entry);
  [...dep, ...arr].forEach((d) => earthDates.add(d));
  const command = /^\d+$/.test(des) ? `${des};` : `DES=${des};CAP;NOFRAG;`; // numbered asteroid, or comet: closest apparition
  try {
    const h = await horizonsStates(command, [...arr].sort((a, b) => a - b));
    console.log(`  Horizons ${des}: "${h.target}", ${Object.keys(h.states).length} dates`);
    horizons[des] = h;
  } catch (err) {
    console.log(`::warning title=Horizons::${des}: ${String(err)}`);
  }
}
const earth = await horizonsStates('399', [...earthDates].sort((a, b) => a - b));
console.log(`  Horizons Earth: "${earth.target}", ${Object.keys(earth.states).length} dates`);
out.horizons = { note: 'Heliocentric, ICRF, J2000 ecliptic; km and km/s; keyed by MJD (TDB). From JPL Horizons (https://ssd.jpl.nasa.gov/horizons/).', earth, bodies: horizons };

const text = JSON.stringify(out);
const path = `${outDir}/scripts/reference/mission-design-jpl.json`;
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, text + '\n');
console.log(`\nWrote ${path} (${(text.length / 1024).toFixed(0)} kB)`);
console.log('----- BEGIN mission-design-jpl.json -----');
console.log(text);
console.log('----- END mission-design-jpl.json -----');
