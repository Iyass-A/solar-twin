// Fetches reference trips from JPL's Small-Body Mission Design tool (phase 6, step 6), to check our trip
// planner against: for a few well-known asteroids and a comet, the ballistic trips from Earth that JPL has
// worked out (mode Q: its picked missions) and a grid of launch dates and times of flight (mode M: a
// porkchop map). Our Lambert solver, flown to the same body on the same dates, must give the same speeds.
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

const text = JSON.stringify(out);
const path = `${outDir}/scripts/reference/mission-design-jpl.json`;
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, text + '\n');
console.log(`\nWrote ${path} (${(text.length / 1024).toFixed(0)} kB)`);
console.log('----- BEGIN mission-design-jpl.json -----');
console.log(text);
console.log('----- END mission-design-jpl.json -----');
