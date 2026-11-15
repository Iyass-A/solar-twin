// Fetches space weather for the "Space weather" card:
//
//   npx tsx scripts/fetch-space-weather.ts OUT_FILE [FALLBACK_URL]
//
// Four parts, each from its own source (see sources() in src/live/spaceWeather.ts):
//   scales  NOAA space weather scales: now, the last 24 hours, the next 3 days (NOAA SWPC)
//   kp      3-hour planetary Kp index: observed, estimated and forecast (NOAA SWPC)
//   flares  solar flares of the last 7 days, from the GOES X-ray sensors (NOAA SWPC)
//   cmes    predicted arrivals at Earth of coronal mass ejections, NASA's WSA-Enlil model (DONKI, CCMC)
//
// Runs on GitHub before each deploy and every 3 hours (.github/workflows/deploy.yml); the file goes
// straight into that build, nothing is committed. A part that fails (no answer, or an answer that
// fails its checks) is taken from the copy on the site now (FALLBACK_URL), with its old fetch time,
// so the card can say how old it is. A part that is in neither is left out, and the card says so.
// It never fails the deploy: problems show as warnings in the log.

import { fileProblems, gFromKp, flareFlux, partProblems, PARSERS, PART_NAMES, sources, type PartName, type SpaceWeatherFile } from '../src/live/spaceWeather';
import { errText, getJson, warn as warnTitled, writeJson } from './live-common';

const [out, fallbackUrl] = process.argv.slice(2);
if (!out) {
  console.error('Usage: npx tsx scripts/fetch-space-weather.ts OUT_FILE [FALLBACK_URL]');
  process.exit(2);
}
const warn = (msg: string) => warnTitled('Space weather', msg);

async function main() {
  const now = Date.now();
  const urls = sources(now);
  const file: SpaceWeatherFile = { fetchedAt: new Date(now).toISOString(), scales: null, kp: null, flares: null, cmes: null };
  const missing: PartName[] = [];

  for (const name of PART_NAMES) {
    for (const url of urls[name]) {
      console.log(`${name}: ${url.replace(/api_key=[^&]+/, 'api_key=…')}`);
      try {
        const raw = await getJson(url);
        // For review: how the source answered (the start of it)
        // (the model runs in full: they are few, and the grouping by CME is worth checking)
        console.log(`  answer${name === 'cmes' ? '' : ' starts'}: ${JSON.stringify(raw).slice(0, name === 'cmes' ? 200_000 : 700)}`);
        const part = { fetchedAt: new Date().toISOString(), data: PARSERS[name](raw) } as never;
        const problems = partProblems(name, part);
        if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
        file[name] = part;
        console.log('  OK');
        break;
      } catch (err) {
        warn(`${name}: ${errText(err)}`);
      }
    }
    if (!file[name]) missing.push(name);
  }

  if (missing.length && fallbackUrl) {
    try {
      const old = await getJson(fallbackUrl);
      for (const name of missing) {
        if (old?.[name] && !partProblems(name, old[name]).length) {
          file[name] = old[name];
          warn(`${name}: kept the copy from the site, fetched ${old[name].fetchedAt}`);
        }
      }
    } catch (err) {
      warn(`no copy from the site: ${errText(err)}`);
    }
  }

  const problems = fileProblems(file);
  if (problems.length) { warn(`file fails its own check, not written: ${problems.slice(0, 3).join('; ')}`); return; }
  writeJson(out, file);
  const parts = PART_NAMES.map((n) => `${n} ${!file[n] ? 'none' : missing.includes(n) ? 'old copy' : 'fresh'}`).join(', ');
  console.log(`LIVE DATA: ${parts} -> ${out}`);

  // Summary for the log
  const s = file.scales?.data;
  if (s) console.log(`  scales now R${s.now.r} S${s.now.s} G${s.now.g} (${s.at}); next days: ${s.days.map((d) => `${d.date} G${d.g ?? '?'} R1-2 ${d.rMinor ?? '?'}% R3+ ${d.rMajor ?? '?'}% S1+ ${d.s ?? '?'}%`).join(' | ')}`);
  const kp = file.kp?.data;
  if (kp) {
    // SWPC calls the rest of today "estimated" too: what is past is decided by the time
    const past = kp.filter((k) => Date.parse(k.t) + 3 * 3_600_000 <= now);
    const last = past[past.length - 1];
    const maxAhead = Math.max(...kp.filter((k) => Date.parse(k.t) >= now).map((k) => k.kp));
    console.log(`  Kp: ${kp.length} values ${kp[0].t} to ${kp[kp.length - 1].t}; latest ${last?.kp} (${last?.kind}, ${last?.t}); highest forecast ${maxAhead} (G${gFromKp(maxAhead)})`);
  }
  const fl = file.flares?.data;
  if (fl) {
    const top = [...fl].sort((a, b) => flareFlux(b.cls) - flareFlux(a.cls)).slice(0, 5);
    console.log(`  flares: ${fl.length} in 7 days; strongest ${top.map((f) => `${f.cls} ${f.peak}`).join(', ')}`);
  }
  const cm = file.cmes?.data;
  if (cm) console.log(`  CME arrivals at Earth: ${cm.length ? cm.map((c) => `${c.arrival}${c.glancing ? ' (glancing)' : ''} Kp ${c.kp?.join('-') ?? '?'} ${c.speed ?? '?'} km/s`).join(', ') : 'none predicted'}`);
  console.log('----- BEGIN space-weather.json -----');
  console.log(JSON.stringify(file));
  console.log('----- END space-weather.json -----');
}

await main();
