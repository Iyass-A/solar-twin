// npm run check: sky events (phase 8, step 1), see src/events/events.ts.
// (1) Against almanacs: NAOJ (conjunctions, oppositions, greatest elongations 2027), NASA (eclipses 2026-2027),
//     USNO (Moon phases 2027, seasons 2026-2027), Espenak/USNO (perihelion and aphelion), and close approaches in
//     the sky (Star Walk, Sky Tonight, the 2020 great conjunction).
// (2) Consistency: what each event means must hold at its time (elongation 0° or 180°, a true maximum or minimum,
//     an eclipse at full or new Moon, and so on), the stretches fit together, and nothing is found twice.
// The reference times are in the sources' own time scale: NAOJ in JST (UT + 9 h), NASA's eclipses in TD (= TT),
// the others in UT.

import {
  findEvents, neoEvents, separation, sunAngle, longitudeFromSun, moonPhaseAngle, ttMs,
  MOON_PAIR_MAX_DEG, PLANET_PAIR_MAX_DEG, type SkyEvent, type EventPlanet,
} from '../src/events/events';
import { LD_AU, type CloseApproach } from '../src/live/closeApproaches';
import { eventNote, eventTitle } from '../src/view/skyEvents';
import { LANGS, STRINGS, num, numGrouped, setLang, lang, type Lang } from '../src/i18n';

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const utc = (s: string) => Date.parse(`${s}Z`);
const jst = (s: string) => utc(s) - 9 * HOUR_MS;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const minutes = (ms: number) => ms / MIN_MS;

// NAOJ, Ephemeris Computation Office, phenomena of 2027 (JST)
const NAOJ_SUN: { body: EventPlanet; kind: 'conjunction' | 'opposition'; side?: 'superior' | 'inferior'; jst: string }[] = [
  { body: 'mercury', kind: 'conjunction', side: 'superior', jst: '2027-01-02T02:08' },
  { body: 'jupiter', kind: 'opposition', jst: '2027-02-11T09:29' },
  { body: 'mercury', kind: 'conjunction', side: 'inferior', jst: '2027-02-19T01:39' },
  { body: 'mars', kind: 'opposition', jst: '2027-02-20T00:51' },
  { body: 'neptune', kind: 'conjunction', jst: '2027-03-25T08:13' },
  { body: 'saturn', kind: 'conjunction', jst: '2027-04-08T02:18' },
  { body: 'uranus', kind: 'conjunction', jst: '2027-05-27T15:12' },
  { body: 'mercury', kind: 'conjunction', side: 'inferior', jst: '2027-06-23T17:00' },
  { body: 'venus', kind: 'conjunction', side: 'superior', jst: '2027-08-12T09:21' },
  { body: 'jupiter', kind: 'conjunction', jst: '2027-08-31T16:30' },
  { body: 'neptune', kind: 'opposition', jst: '2027-09-28T23:19' },
  { body: 'saturn', kind: 'opposition', jst: '2027-10-18T09:36' },
  { body: 'mercury', kind: 'conjunction', side: 'inferior', jst: '2027-10-20T00:31' },
  { body: 'uranus', kind: 'opposition', jst: '2027-11-30T18:22' },
];
// Given to the hour, with the angle in degrees and arcminutes
const NAOJ_ELONGATION: { body: 'mercury' | 'venus'; sky: 'evening' | 'morning'; jst: string; deg: number; min: number }[] = [
  { body: 'venus', sky: 'morning', jst: '2027-01-04T03:00', deg: 46, min: 57 },
  { body: 'mercury', sky: 'evening', jst: '2027-02-03T15:00', deg: 18, min: 19 },
  { body: 'mercury', sky: 'morning', jst: '2027-03-17T16:00', deg: 27, min: 38 },
  { body: 'mercury', sky: 'evening', jst: '2027-05-28T19:00', deg: 22, min: 55 },
  { body: 'mercury', sky: 'morning', jst: '2027-07-16T04:00', deg: 20, min: 42 },
  { body: 'mercury', sky: 'evening', jst: '2027-09-25T07:00', deg: 26, min: 16 },
  { body: 'mercury', sky: 'morning', jst: '2027-11-04T18:00', deg: 18, min: 46 },
];
// NASA eclipse lists (greatest eclipse, TD); all nine eclipses of 2026 and 2027
const NASA_ECLIPSES: { kind: 'solarEclipse' | 'lunarEclipse'; type: string; day: string; td?: string }[] = [
  { kind: 'solarEclipse', type: 'annular', day: '2026-02-17', td: '2026-02-17T12:13:06' },
  { kind: 'lunarEclipse', type: 'total', day: '2026-03-03', td: '2026-03-03T11:34:52' },
  { kind: 'solarEclipse', type: 'total', day: '2026-08-12' },
  { kind: 'lunarEclipse', type: 'partial', day: '2026-08-28' },
  { kind: 'solarEclipse', type: 'annular', day: '2027-02-06', td: '2027-02-06T16:00:48' },
  { kind: 'lunarEclipse', type: 'penumbral', day: '2027-02-20', td: '2027-02-20T23:14:06' },
  { kind: 'lunarEclipse', type: 'penumbral', day: '2027-07-18', td: '2027-07-18T16:04:09' },
  { kind: 'solarEclipse', type: 'total', day: '2027-08-02', td: '2027-08-02T10:07:50' },
  { kind: 'lunarEclipse', type: 'penumbral', day: '2027-08-17' },
];
// USNO, Dates of Primary Phases of the Moon, 2027 (UT, to the minute): new, first quarter, full, last quarter
const USNO_PHASES_2027 = `
Jan 7 20:24|Jan 15 20:34|Jan 22 12:17|Jan 29 10:55
Feb 6 15:56|Feb 14 07:58|Feb 20 23:23|Feb 28 05:16
Mar 8 09:29|Mar 15 16:25|Mar 22 10:44|Mar 30 00:54
Apr 6 23:51|Apr 13 22:56|Apr 20 22:27|Apr 28 20:18
May 6 10:58|May 13 04:44|May 20 10:59|May 28 13:58
Jun 4 19:40|Jun 11 10:56|Jun 19 00:44|Jun 27 04:54
Jul 4 03:02|Jul 10 18:39|Jul 18 15:45|Jul 26 16:55
Aug 2 10:05|Aug 9 04:54|Aug 17 07:29|Aug 25 02:27
Aug 31 17:41|Sep 7 18:31|Sep 15 23:03|Sep 23 10:20
Sep 30 02:36|Oct 7 11:47|Oct 15 13:47|Oct 22 17:29
Oct 29 13:36|Nov 6 08:00|Nov 14 03:26|Nov 21 00:48
Nov 28 03:24|Dec 6 05:22|Dec 13 16:09|Dec 20 09:11
Dec 27 20:12|||`;
// USNO, Earth's seasons (UT). The source's 2026 June line says "JUN 20 … 0824 UTC": the solstice is on the 21st.
const USNO_SEASONS: { season: string; utc: string }[] = [
  { season: 'marchEquinox', utc: '2026-03-20T14:46' }, { season: 'juneSolstice', utc: '2026-06-21T08:24' },
  { season: 'septemberEquinox', utc: '2026-09-23T00:05' }, { season: 'decemberSolstice', utc: '2026-12-21T20:50' },
  { season: 'marchEquinox', utc: '2027-03-20T20:25' }, { season: 'juneSolstice', utc: '2027-06-21T14:11' },
  { season: 'septemberEquinox', utc: '2027-09-23T06:02' }, { season: 'decemberSolstice', utc: '2027-12-22T02:42' },
];
// Perihelion and aphelion (UT; from Eastern time). The distance hardly changes near these points, and the Moon
// makes the Earth wobble around them, so the time is touchy: the sources differ among themselves by up to
// 6 minutes, and Astronomy Engine by up to about half an hour (a radial speed off by some 0.2 m/s does that).
// The page gives these to the hour only.
const APSIDES: { kind: 'perihelion' | 'aphelion'; utc: string }[] = [
  { kind: 'perihelion', utc: '2026-01-03T17:15' }, { kind: 'aphelion', utc: '2026-07-06T17:30' },
  { kind: 'perihelion', utc: '2027-01-03T02:32' }, { kind: 'aphelion', utc: '2027-07-05T05:05' },
];
// Close approaches in the sky (UT, separation from the Earth's centre). The sources round to the arcminute and
// may leave out light time; Sky Tonight shows UT on its pages set to longitude 0 (others at "GMT −9").
const PAIRS: { a: 'moon' | EventPlanet; b: EventPlanet; utc: string; deg: number; source: string }[] = [
  { a: 'jupiter', b: 'saturn', utc: '2020-12-21T18:25', deg: 0.102, source: 'great conjunction 2020 (6.1′)' },
  { a: 'mars', b: 'jupiter', utc: '2026-11-16T02:04', deg: 1 + 11 / 60, source: 'Star Walk' },
  { a: 'mercury', b: 'saturn', utc: '2027-04-19T12:35', deg: 33 / 60, source: 'Star Walk' },
  { a: 'venus', b: 'saturn', utc: '2027-05-07T18:46', deg: 0.605, source: 'Sky Tonight' },
  { a: 'venus', b: 'neptune', utc: '2027-04-24T10:56', deg: 0.235, source: 'Sky Tonight' },
  { a: 'moon', b: 'jupiter', utc: '2026-12-27T16:26', deg: 1.381, source: 'Sky Tonight' },
];

export function checkEvents(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  const lines: string[] = [];

  // ---------- (1) Against the almanacs ----------
  const y2026 = utc('2026-01-01T00:00'), y2028 = utc('2028-01-01T00:00');
  const t0 = performance.now();
  // In stretches of 30 days, the way the page asks (and so the stretches are tested to fit together)
  const all: SkyEvent[] = [];
  for (let from = y2026; from < y2028; from += 30 * DAY_MS) all.push(...findEvents(from, Math.min(y2028, from + 30 * DAY_MS)));
  const ms2Years = performance.now() - t0;
  const whole = findEvents(y2026, y2028);
  const key = (e: SkyEvent) => `${e.kind} ${Math.round(e.ms / 1000)} ${JSON.stringify(e)}`;
  if (whole.length !== all.length || whole.some((e, i) => Math.abs(e.ms - all[i].ms) > 1000 || e.kind !== all[i].kind)) {
    fail(`2026-2027 in one go (${whole.length}) and in 30-day stretches (${all.length}) differ`);
  }
  if (new Set(whole.map(key)).size !== whole.length) fail('an event is listed twice');
  for (let i = 1; i < whole.length; i++) if (whole[i].ms < whole[i - 1].ms) fail(`not in time order at ${iso(whole[i].ms)}`);

  const ofKind = <K extends SkyEvent['kind']>(k: K) => whole.filter((e): e is Extract<SkyEvent, { kind: K }> => e.kind === k);

  // NAOJ: conjunctions and oppositions, to a few minutes (Astronomy Engine is good to about an arcminute)
  let worstSun = 0;
  const y2027 = utc('2027-01-01T00:00');
  const sunEvents = whole.filter((e) => (e.kind === 'conjunction' || e.kind === 'opposition') && e.ms >= y2027);
  // Our NAOJ list has only Mercury's first superior conjunction; it has four in 2027
  const mercurySuperior = (e: SkyEvent) => e.kind === 'conjunction' && e.body === 'mercury' && e.side === 'superior';
  const listed = sunEvents.filter((e) => !mercurySuperior(e) || e.ms < y2027 + 2 * DAY_MS);
  if (listed.length !== NAOJ_SUN.length || sunEvents.filter(mercurySuperior).length !== 4) {
    fail(`${sunEvents.length} conjunctions and oppositions in 2027 (${sunEvents.filter(mercurySuperior).length} superior of Mercury), NAOJ has ${NAOJ_SUN.length} and 3 more of Mercury`);
  }
  for (const r of NAOJ_SUN) {
    const ref = jst(r.jst);
    const e = sunEvents.find((x) => x.kind === r.kind && (x as any).body === r.body && Math.abs(x.ms - ref) < DAY_MS);
    if (!e) { fail(`no ${r.body} ${r.kind} near ${r.jst} JST`); continue; }
    if (e.kind === 'conjunction' && e.side !== (r.side ?? null)) fail(`${r.body} conjunction ${r.jst}: ${e.side}, NAOJ ${r.side ?? 'none'}`);
    const d = Math.abs(minutes(e.ms - ref));
    worstSun = Math.max(worstSun, d);
    if (d > 6) fail(`${r.body} ${r.kind}: ${iso(e.ms)} UT, NAOJ ${iso(ref)} UT (${d.toFixed(1)} min)`);
  }
  lines.push(`conjunctions and oppositions 2027: ${NAOJ_SUN.length} like NAOJ, within ${worstSun.toFixed(1)} min`);

  // NAOJ: greatest elongations, within the hour they give, and the angle to the arcminute
  let worstElong = 0, worstElongMin = 0;
  const elong = ofKind('elongation').filter((e) => e.ms >= y2027 - 2 * DAY_MS);
  if (elong.length !== NAOJ_ELONGATION.length) fail(`${elong.length} greatest elongations from 30.12.2026, NAOJ has ${NAOJ_ELONGATION.length}`);
  for (const r of NAOJ_ELONGATION) {
    const ref = jst(r.jst);
    const e = elong.find((x) => x.body === r.body && Math.abs(x.ms - ref) < DAY_MS);
    if (!e) { fail(`no ${r.body} greatest elongation near ${r.jst} JST`); continue; }
    if (e.sky !== r.sky) fail(`${r.body} ${r.jst}: ${e.sky}, NAOJ ${r.sky}`);
    const d = Math.abs(minutes(e.ms - ref)), dArc = Math.abs(e.deg * 60 - (r.deg * 60 + r.min));
    worstElong = Math.max(worstElong, d);
    worstElongMin = Math.max(worstElongMin, dArc);
    if (d > 60 || dArc > 1) fail(`${r.body} elongation: ${iso(e.ms)} UT ${e.deg.toFixed(3)}°, NAOJ ${iso(ref)} UT ${r.deg}°${r.min}′`);
  }
  lines.push(`greatest elongations 2027: ${NAOJ_ELONGATION.length} like NAOJ, within ${worstElong.toFixed(0)} min of their hour and ${worstElongMin.toFixed(2)}′`);

  // NASA: every eclipse of 2026 and 2027, of the right kind, and the peak (TD) to a minute where we have it
  let worstEcl = 0;
  const ecl = whole.filter((e) => e.kind === 'solarEclipse' || e.kind === 'lunarEclipse');
  if (ecl.length !== NASA_ECLIPSES.length) fail(`${ecl.length} eclipses in 2026-2027, NASA has ${NASA_ECLIPSES.length}`);
  for (const r of NASA_ECLIPSES) {
    const e = ecl.find((x) => x.kind === r.kind && iso(x.ms).slice(0, 10) === r.day) as Extract<SkyEvent, { kind: 'solarEclipse' | 'lunarEclipse' }> | undefined;
    if (!e) { fail(`no ${r.kind} on ${r.day}`); continue; }
    if (e.type !== r.type) fail(`${r.kind} ${r.day}: ${e.type}, NASA ${r.type}`);
    if (r.td) {
      const d = Math.abs(ttMs(e.ms) - utc(r.td)) / 1000;
      worstEcl = Math.max(worstEcl, d);
      if (d > 60) fail(`${r.kind} ${r.day}: peak ${new Date(ttMs(e.ms)).toISOString()} TD, NASA ${r.td} (${d.toFixed(0)} s)`);
    }
  }
  // How long the deepest phase lasts (NASA via Wikipedia): totality 3.3.2026 58 min 19 s, the partial phase
  // 28.8.2026 3 h 18 min 7 s, the penumbral phase 17.8.2027 3 h 38 min 35 s
  for (const [day, type, min] of [['2026-03-03', 'total', 58 + 19 / 60], ['2026-08-28', 'partial', 198 + 7 / 60], ['2027-08-17', 'penumbral', 218 + 35 / 60]] as const) {
    const e = ecl.find((x) => x.kind === 'lunarEclipse' && iso(x.ms).startsWith(day)) as Extract<SkyEvent, { kind: 'lunarEclipse' }> | undefined;
    if (!e || e.type !== type || Math.abs(e.minutes - min) > 2) fail(`lunar eclipse ${day}: ${e?.type} for ${e?.minutes.toFixed(1)} min, NASA ${type} for ${min.toFixed(1)}`);
  }
  const totalSun = ecl.find((e) => e.kind === 'solarEclipse' && e.type === 'total' && iso(e.ms).startsWith('2027-08-02')) as Extract<SkyEvent, { kind: 'solarEclipse' }> | undefined;
  // NASA: greatest eclipse of 2.8.2027 at 25.5° N, 33.2° E (Egypt, near Luxor)
  if (!totalSun || totalSun.lat === null || Math.abs(totalSun.lat - 25.5) > 0.5 || Math.abs(totalSun.lon! - 33.2) > 0.5) fail(`2.8.2027: centre at ${totalSun?.lat}, ${totalSun?.lon}, NASA 25.5° N 33.2° E`);
  lines.push(`eclipses 2026-2027: all ${NASA_ECLIPSES.length} like NASA, peaks within ${worstEcl.toFixed(0)} s`);

  // USNO: all 49 Moon phases of 2027, to the minute (USNO rounds)
  const phaseNames = ['new', 'firstQuarter', 'full', 'lastQuarter'] as const;
  const usno: { phase: string; ms: number }[] = [];
  for (const row of USNO_PHASES_2027.trim().split('\n')) {
    row.split('|').forEach((cell, q) => { if (cell.trim()) usno.push({ phase: phaseNames[q], ms: Date.parse(`${cell.trim()} 2027 UTC`) }); });
  }
  const moons = ofKind('moon').filter((e) => e.ms >= y2027);
  if (moons.length !== usno.length) fail(`${moons.length} Moon phases in 2027, USNO has ${usno.length}`);
  let worstMoon = 0;
  for (const r of usno) {
    const e = moons.find((x) => x.phase === r.phase && Math.abs(x.ms - r.ms) < DAY_MS);
    if (!e) { fail(`no ${r.phase} near ${iso(r.ms)}`); continue; }
    const d = Math.abs(minutes(e.ms - r.ms));
    worstMoon = Math.max(worstMoon, d);
    if (d > 1.5) fail(`${r.phase}: ${iso(e.ms)}, USNO ${iso(r.ms)} (${d.toFixed(1)} min)`);
  }
  lines.push(`Moon phases 2027: ${usno.length} like USNO, within ${worstMoon.toFixed(1)} min`);

  // USNO: seasons; perihelion and aphelion
  let worstSeason = 0, worstApsis = 0;
  for (const r of USNO_SEASONS) {
    const e = ofKind('season').find((x) => x.season === r.season && Math.abs(x.ms - utc(r.utc)) < DAY_MS);
    const d = e ? Math.abs(minutes(e.ms - utc(r.utc))) : Infinity;
    worstSeason = Math.max(worstSeason, d);
    if (d > 1.5) fail(`${r.season} ${r.utc}: ${e ? iso(e.ms) : 'none'}`);
  }
  if (ofKind('season').length !== USNO_SEASONS.length) fail(`${ofKind('season').length} equinoxes and solstices in 2026-2027`);
  for (const r of APSIDES) {
    const e = whole.find((x) => x.kind === r.kind && Math.abs(x.ms - utc(r.utc)) < 2 * DAY_MS) as Extract<SkyEvent, { kind: 'perihelion' | 'aphelion' }> | undefined;
    const d = e ? Math.abs(minutes(e.ms - utc(r.utc))) : Infinity;
    worstApsis = Math.max(worstApsis, d);
    if (d > 45) fail(`${r.kind} ${r.utc}: ${e ? iso(e.ms) : 'none'}`);
    if (e && (r.kind === 'perihelion' ? Math.abs(e.distAu - 0.98329) : Math.abs(e.distAu - 1.01671)) > 0.0001) fail(`${r.kind} ${r.utc}: ${e.distAu} au`);
  }
  if (whole.filter((e) => e.kind === 'perihelion' || e.kind === 'aphelion').length !== APSIDES.length) fail('perihelion and aphelion: not two a year');
  lines.push(`seasons: ${USNO_SEASONS.length} like USNO within ${worstSeason.toFixed(1)} min; perihelion and aphelion within ${worstApsis.toFixed(0)} min`);

  // Close approaches in the sky: time and smallest angle
  let worstPairMin = 0, worstPairDeg = 0;
  for (const r of PAIRS) {
    const ref = utc(r.utc);
    const found = findEvents(ref - 3 * DAY_MS, ref + 3 * DAY_MS).find((e): e is Extract<SkyEvent, { kind: 'pair' }> =>
      e.kind === 'pair' && ((e.a === r.a && e.b === r.b) || (e.a === r.b && e.b === r.a)));
    if (!found) { fail(`no close approach of ${r.a} and ${r.b} near ${r.utc}`); continue; }
    const d = Math.abs(minutes(found.ms - ref)), dDeg = Math.abs(found.sepDeg - r.deg);
    // The planets' minima are flat (their angle changes slowly), the Moon's sharp
    const tolMin = r.a === 'moon' ? 3 : 30;
    worstPairMin = Math.max(worstPairMin, d);
    worstPairDeg = Math.max(worstPairDeg, dDeg);
    if (d > tolMin || dDeg > 0.015) fail(`${r.a}–${r.b}: ${iso(found.ms)} ${found.sepDeg.toFixed(3)}°, ${r.source} ${r.utc} ${r.deg.toFixed(3)}° (${d.toFixed(0)} min)`);
  }
  lines.push(`close approaches in the sky: ${PAIRS.length} like the sources, within ${worstPairMin.toFixed(0)} min and ${worstPairDeg.toFixed(3)}°`);

  // ---------- (2) Consistency, over the whole two years ----------
  let worstLon = 0;
  for (const e of [...ofKind('conjunction'), ...ofKind('opposition')]) {
    const target = e.kind === 'opposition' ? 180 : 0;
    const d = Math.abs(((longitudeFromSun(e.body, e.ms) - target + 540) % 360) - 180);
    worstLon = Math.max(worstLon, d);
    // The planet's angle from the Sun: small at conjunction (its latitude only), large at opposition
    const el = sunAngle(e.body, e.ms);
    if (e.kind === 'opposition' ? el < 170 : el > 10) fail(`${e.body} ${e.kind} ${iso(e.ms)}: ${el.toFixed(2)}° from the Sun`);
    if (e.kind === 'opposition' && !(e.distAu > 0.3 && e.mag < 8)) fail(`${e.body} opposition ${iso(e.ms)}: ${e.distAu} au, mag ${e.mag}`);
  }
  if (worstLon > 1 / 3600) fail(`conjunctions and oppositions: longitude off by ${(worstLon * 3600).toFixed(2)}″`);
  for (const e of ofKind('elongation')) {
    const before = sunAngle(e.body, e.ms - 6 * HOUR_MS), at = sunAngle(e.body, e.ms), after = sunAngle(e.body, e.ms + 6 * HOUR_MS);
    if (!(at >= before && at >= after) || Math.abs(at - e.deg) > 1e-6) fail(`${e.body} elongation ${iso(e.ms)}: not a maximum (${before}, ${at}, ${after})`);
    // Evening: east of the Sun, so the planet's longitude is ahead of the Sun's
    if ((longitudeFromSun(e.body, e.ms) > 0) !== (e.sky === 'evening')) fail(`${e.body} elongation ${iso(e.ms)}: ${e.sky}, but on the other side of the Sun`);
  }
  const phaseAt = { new: 0, firstQuarter: 90, full: 180, lastQuarter: 270 };
  let worstPhase = 0;
  for (const e of ofKind('moon')) worstPhase = Math.max(worstPhase, Math.abs(((moonPhaseAngle(e.ms) - phaseAt[e.phase] + 540) % 360) - 180));
  if (worstPhase > 1e-3) fail(`Moon phases: off by ${worstPhase}°`);
  for (const e of ecl) {
    const full = e.kind === 'lunarEclipse';
    const near = whole.find((m) => m.kind === 'moon' && m.phase === (full ? 'full' : 'new') && Math.abs(m.ms - e.ms) < 6 * HOUR_MS);
    if (!near) fail(`${e.kind} ${iso(e.ms)}: no ${full ? 'full' : 'new'} Moon within 6 hours`);
  }
  // Close approaches: a true minimum, under the limit, the Moon's with bright planets only
  for (const e of ofKind('pair')) {
    const s = (ms: number) => separation(e.a, e.b, ms);
    if (!(s(e.ms) <= s(e.ms - 10 * MIN_MS) && s(e.ms) <= s(e.ms + 10 * MIN_MS)) || Math.abs(s(e.ms) - e.sepDeg) > 1e-9) fail(`${e.a}–${e.b} ${iso(e.ms)}: not a minimum`);
    if (e.sepDeg > (e.a === 'moon' ? MOON_PAIR_MAX_DEG : PLANET_PAIR_MAX_DEG)) fail(`${e.a}–${e.b} ${iso(e.ms)}: ${e.sepDeg}° is over the limit`);
    if (e.a === 'moon' && (e.b === 'uranus' || e.b === 'neptune')) fail(`Moon–${e.b}: not a bright planet`);
  }
  // A month has one close approach of the Moon to each bright planet, at most: count the Moon–Jupiter ones
  const moonJupiter = ofKind('pair').filter((e) => e.a === 'moon' && e.b === 'jupiter').length;
  // Missing one: scan every hour for minima under the limit, and compare
  let scanned = 0;
  for (const p of ['jupiter', 'venus'] as const) {
    const step = HOUR_MS;
    let prev2 = separation('moon', p, y2026 - step), prev = separation('moon', p, y2026);
    for (let ms = y2026 + step; ms < y2028; ms += step) {
      const s = separation('moon', p, ms);
      if (prev < prev2 && prev <= s && prev < MOON_PAIR_MAX_DEG - 0.01) {
        scanned++;
        if (!ofKind('pair').some((e) => e.a === 'moon' && e.b === p && Math.abs(e.ms - (ms - step)) < 2 * step)) fail(`Moon–${p}: missed the close approach near ${iso(ms - step)}`);
      }
      prev2 = prev; prev = s;
    }
  }
  lines.push(`consistency: conjunctions within ${(worstLon * 3600).toFixed(3)}″ of their longitude, Moon phases within ${(worstPhase * 3600).toFixed(2)}″, `
    + `every eclipse at a full or new Moon, ${ofKind('pair').length} close approaches are true minima (Moon–Jupiter ${moonJupiter}; an hourly scan of Moon–Jupiter and Moon–Venus finds the same ${scanned})`);

  // Asteroids and comets from the live file: those closer than the Moon, and the closest one
  const fake = (des: string, jdOffset: number, ld: number): CloseApproach => ({
    des, name: des, jd: 2461363.5 + jdOffset, dist: ld * LD_AU, distMin: ld * LD_AU, distMax: ld * LD_AU, vRel: 10, tSigmaMin: 0, h: 25, diameter: null,
  });
  const base = utc('2026-11-18T12:00'); // the fake approaches are around 19.11.2026 (JD 2461363.5)
  const neos = [fake('A', -1, 0.5), fake('B', 1, 3), fake('C', 2, 0.8), fake('D', 3, 2), fake('E', 40, 0.1)];
  const got = neoEvents(neos, base, base + 30 * DAY_MS).map((e) => (e.kind === 'neo' ? `${e.des}${e.closerThanMoon ? '<' : ''}` : '')).join(' ');
  if (got !== 'C<') fail(`asteroids closer than the Moon: "${got}", expected "C<"`);
  const none = neoEvents([fake('B', 1, 3), fake('D', 3, 2)], base, base + 30 * DAY_MS).map((e) => (e.kind === 'neo' ? e.des : '')).join(' ');
  if (none !== 'D') fail(`asteroids, none closer than the Moon: "${none}", expected the closest (D)`);
  if (!findEvents(base, base + 30 * DAY_MS, neos).some((e) => e.kind === 'neo')) fail('findEvents leaves out the asteroids it is given');

  // How long the page waits: 30 days
  const tPage = performance.now();
  findEvents(Date.now(), Date.now() + 30 * DAY_MS);
  const ms30 = performance.now() - tPage;
  lines.push(`two years in ${ms2Years.toFixed(0)} ms (${whole.length} events), 30 days from now in ${ms30.toFixed(0)} ms`);

  for (const l of lines) console.log(`  ${l}`);
  console.log(`Sky events: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

/**
 * The card's texts in three languages: every kind of event (with each of its variants) gets a title and a note,
 * without gaps, and the note gives the event's numbers as the language writes them. The counts read right.
 */
export function checkEventTexts(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  const ms = Date.UTC(2027, 1, 11);
  const samples: { e: SkyEvent; shows: (l: Lang) => string[] }[] = [
    ...(['new', 'firstQuarter', 'full', 'lastQuarter'] as const).map((phase) => ({ e: { kind: 'moon', ms, phase } as SkyEvent, shows: () => [] })),
    ...(['superior', 'inferior', null] as const).map((side) => ({ e: { kind: 'conjunction', ms, body: side ? 'venus' : 'saturn', side } as SkyEvent, shows: () => [] })),
    { e: { kind: 'opposition', ms, body: 'jupiter', distAu: 4.36, mag: -2.6 }, shows: (l) => [num(2.6, 1, l), numGrouped(4.36 * 149_597_870.7 / 1e6, l)] },
    { e: { kind: 'opposition', ms, body: 'neptune', distAu: 28.9, mag: 7.8 }, shows: (l) => [num(7.8, 1, l), STRINGS[l].events.optics] },
    ...(['evening', 'morning'] as const).map((sky) => ({ e: { kind: 'elongation', ms, body: 'mercury', sky, deg: 18.32, mag: -0.6 } as SkyEvent, shows: (l: Lang) => [`${num(18.3, 1, l)}°`, num(0.6, 1, l)] })),
    { e: { kind: 'solarEclipse', ms, type: 'total', lat: 25.5, lon: 33.2 }, shows: (l) => [`${num(25.5, 1, l)}°`, `${num(33.2, 1, l)}°`, STRINGS[l].events.north, STRINGS[l].events.east, STRINGS[l].events.solarSafety] },
    { e: { kind: 'solarEclipse', ms, type: 'annular', lat: -31.3, lon: -48.5 }, shows: (l) => [`${num(31.3, 1, l)}°`, STRINGS[l].events.south, STRINGS[l].events.west] },
    { e: { kind: 'solarEclipse', ms, type: 'partial', lat: null, lon: null }, shows: (l) => [STRINGS[l].events.solarPartial, STRINGS[l].events.solarSafety] },
    ...(['total', 'partial', 'penumbral'] as const).map((type) => ({ e: { kind: 'lunarEclipse', ms, type, minutes: 58 } as SkyEvent, shows: (l: Lang) => [STRINGS[l].duration(58)] })),
    ...(['marchEquinox', 'juneSolstice', 'septemberEquinox', 'decemberSolstice'] as const).map((season) => ({ e: { kind: 'season', ms, season } as SkyEvent, shows: () => [] })),
    { e: { kind: 'perihelion', ms, distAu: 0.98333 }, shows: (l) => [numGrouped(147.1, l)] },
    { e: { kind: 'aphelion', ms, distAu: 1.01671 }, shows: (l) => [numGrouped(152.1, l)] },
    { e: { kind: 'pair', ms, a: 'moon', b: 'jupiter', sepDeg: 1.05, sunDeg: 100 }, shows: (l) => [`${num(1.1, 1, l)}°`, STRINGS[l].events.moonName, STRINGS[l].planets.jupiter] },
    { e: { kind: 'pair', ms, a: 'mercury', b: 'venus', sepDeg: 0.52, sunDeg: 9 }, shows: (l) => [`${num(0.5, 1, l)}°`, STRINGS[l].events.glare] },
    { e: { kind: 'neo', ms, des: '2026 WJ', name: '(2026 WJ)', distAu: 0.8 * LD_AU, closerThanMoon: true }, shows: (l) => [num(0.8, 2, l), numGrouped(310_000, l), STRINGS[l].events.neoCloser] },
    { e: { kind: 'neo', ms, des: 'X', name: '<b>', distAu: 0.03, closerThanMoon: false }, shows: (l) => ['&#60;b&#62;', STRINGS[l].events.neoClosest] },
  ];
  const before = lang();
  for (const l of LANGS.map((x) => x.id)) {
    setLang(l);
    for (const { e, shows } of samples) {
      const title = eventTitle(e), note = eventNote(e);
      const what = `${l} ${e.kind} ${JSON.stringify(e).slice(0, 60)}`;
      if (!title.trim() || !note.trim() || /undefined|NaN|\[object/.test(title + note)) fail(`${what}: "${title}" / "${note}"`);
      for (const x of shows(l)) if (!(title + note).includes(x)) fail(`${what}: does not say "${x}" in "${note}"`);
    }
    const s = STRINGS[l].events;
    for (const n of [0, 1, 2, 5, 11]) {
      for (const text of [s.summary(n, 7), s.summary(n, 30), s.tileMain(n)]) if (/undefined|NaN/.test(text) || (n > 2 && !text.includes(String(n)))) fail(`${l}: count ${n}: "${text}"`);
    }
    if (!STRINGS[l].nowTabs.events) fail(`${l}: no tile name`);
  }
  setLang(before);
  // Arabic counting
  const ar = STRINGS.ar.events;
  const want = ['ولا حدث كبير', 'حدث واحد', 'حدثين', '5 أحداث', '11 حدث'];
  [0, 1, 2, 5, 11].forEach((n, i) => { if (!ar.tileMain(n).startsWith(want[i])) fail(`ar: ${n} events: "${ar.tileMain(n)}"`); });
  console.log(`Sky event texts in three languages: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}
