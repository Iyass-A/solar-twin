// Fetches the close approaches of asteroids and comets to Earth from CNEOS (JPL's Close-Approach Data
// API) for the "Close approaches to Earth" card:
//
//   npx tsx scripts/fetch-close-approaches.ts OUT_FILE [FALLBACK_URL]
//
// Window: from 7 days ago to 60 days ahead, closer than 0.05 au (about 19.5 times the Moon's distance),
// which is the usual CNEOS table plus the last week. One request (a few more only if JPL is busy).
//
// Runs on GitHub before each deploy, and once a day on a schedule (.github/workflows/deploy.yml),
// because JPL is not reachable from every machine. The file goes straight into that build of the site;
// nothing is committed. If JPL does not answer, or its answer fails the checks in
// src/live/closeApproaches.ts, the copy that is on the site now (FALLBACK_URL) is kept, so an outage
// never empties the card. Without either, nothing is written and the card says so.
// It never fails the deploy: problems show as warnings in the log.
//
// API: https://ssd-api.jpl.nasa.gov/doc/cad.html

import { cadQuery, fileProblems, fromCad, LD_AU, tdbToUtcMs, type CloseApproachFile } from '../src/live/closeApproaches';
import { errText, getJson, warn as warnTitled, writeJson } from './live-common';

const [out, fallbackUrl] = process.argv.slice(2);
if (!out) {
  console.error('Usage: npx tsx scripts/fetch-close-approaches.ts OUT_FILE [FALLBACK_URL]');
  process.exit(2);
}

const warn = (msg: string) => warnTitled('Close approaches', msg);
const write = (file: CloseApproachFile) => writeJson(out, file);

function summary(file: CloseApproachFile) {
  const now = Date.now();
  const list = file.approaches;
  const ahead = list.filter((a) => tdbToUtcMs(a.jd) >= now);
  const closest = [...ahead].sort((a, b) => a.dist - b.dist)[0];
  const when = (jd: number) => new Date(tdbToUtcMs(jd)).toISOString().slice(0, 16).replace('T', ' ');
  console.log(`  fetched ${file.fetchedAt}, window ${file.dateMin} to ${file.dateMax}, closer than ${file.distMaxAu} au`);
  console.log(`  ${list.length} approaches: ${list.length - ahead.length} already passed, ${ahead.length} ahead, `
    + `${ahead.filter((a) => a.dist < LD_AU).length} of them closer than the Moon`);
  if (closest) console.log(`  closest ahead: ${closest.name}, ${(closest.dist / LD_AU).toFixed(2)} LD on ${when(closest.jd)} UTC`);
  console.log('  first ones ahead:');
  for (const a of ahead.slice(0, 8)) {
    console.log(`    ${when(a.jd)} UTC  ${a.name.padEnd(28)} ${(a.dist / LD_AU).toFixed(2).padStart(6)} LD  ${a.vRel.toFixed(2).padStart(6)} km/s  H ${a.h ?? '-'}  D ${a.diameter ?? '-'}`);
  }
}

async function main() {
  const q = cadQuery(Date.now());
  console.log(`Close approaches from JPL: ${q.url}`);
  try {
    const raw = await getJson(q.url);
    const { file, dropped } = fromCad(raw, { fetchedAt: new Date().toISOString(), dateMin: q.dateMin, dateMax: q.dateMax, distMaxAu: q.distMaxAu });
    for (const d of dropped) warn(`left out an implausible row: ${d}`);
    const problems = fileProblems(file);
    if (problems.length) throw new Error(`our file would fail its own check: ${problems.slice(0, 3).join('; ')}`);
    write(file);
    console.log(`LIVE DATA: fresh from JPL -> ${out}`);
    summary(file);
    // For review: JPL's answer as it came (the first rows), and our whole file
    console.log('----- JPL answer, first 5 rows -----');
    console.log(JSON.stringify({ ...raw, data: raw.data?.slice(0, 5) }));
    console.log('----- BEGIN close-approaches.json -----');
    console.log(JSON.stringify(file));
    console.log('----- END close-approaches.json -----');
    return;
  } catch (err) {
    warn(`JPL: ${errText(err)}`);
  }

  if (fallbackUrl) {
    try {
      const old = await getJson(fallbackUrl);
      const problems = fileProblems(old);
      if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
      write(old);
      warn(`kept the copy from the site, fetched ${old.fetchedAt}`);
      console.log(`LIVE DATA: old copy from ${old.fetchedAt} -> ${out}`);
      summary(old);
      return;
    } catch (err) {
      warn(`no copy from the site either: ${errText(err)}`);
    }
  }
  console.log('LIVE DATA: none (the card will say so)');
}

await main();
