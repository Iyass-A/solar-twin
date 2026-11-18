// Part of npm run check (called from scripts/check.ts): the trip planner (phase 6, src/transfer/).
// Step 1, the Hohmann transfer: against Curtis' worked example (Earth to Mars), against the universal-variable
// propagator of src/physics/orbit.ts (an independent way to fly the half ellipse), against NASA's synodic
// periods, and the launch-window search over the whole time bar.
// Step 2, Lambert's problem: against worked examples in Curtis and Vallado, against the propagator (orbits
// flown first, then found again from their two ends), and against NASA's Mars mission design handbook for 2026.
// Step 3, the porkchop map: the cheapest launch energy of every Mars opportunity from 2026 to 2045 against the
// same handbook's table 1, and the map's own bookkeeping.
// Step 4, the trip in the views: its path, flown from its start, ends at the target; the speed it is run at.
// Step 5, the signal delay: the Earth–Mars light time and the Sun's angle against JPL Horizons (DE441) for a year,
// the 2° limit against NASA's Mars commanding pauses (2019, 2021, 2023), the instant-distance shortcut against
// the true light time, and the profile's longest delay and stretches near the Sun against a plain scan.
// Step 6, against JPL's Small-Body Mission Design tool: for eight asteroids and a comet, JPL's picked missions and
// a map of launch dates and times of flight, worked out again here on JPL Horizons' states (so it tests the trip
// calculation, revolutions included), and the site's own asteroid states against Horizons.
// Step 7, trips to the well-known asteroids and comets: their destinations and years, the choice among whole turns
// by each measure, the map's range for all 36, its cells, and its cheapest trips against JPL's 10-day map.

import { hohmann, hyperbolicBurn, leadAngle, tripTo, windows, TARGETS, PARKING_ALT_KM, RADIUS_KM, planetGm } from '../src/transfer/hohmann';
import {
  lambert, lambertRevs, lambertAll, flightBetween, planetState, realTrip, MAX_REVS, planetDestination, smallDestination, tripsFromStates, type Vec,
} from '../src/transfer/lambert';
import { smallBodyState } from '../src/astro/smallbody';
import {
  porkchopRange, porkchop, porkchopStepper, cheapest, bandEdges, mapMin, onEdge, nearHalfTurn, RIDGE_DEG, smallPorkchopRange, kindsOf,
  SMALL_SPAN_DAYS, SMALL_TOF_MIN, SMALL_TOF_MAX,
} from '../src/transfer/porkchop';
import { loadSmallBodies } from '../src/view/smallbodies';
import { targetGroup, TARGET_GROUPS } from '../src/view/trip';
import { heliocentricPosition } from '../src/astro/kepler';
import { PLANETS } from '../src/astro/elements';
import { centuriesSinceJ2000 } from '../src/astro/julian';
import { AU_KM } from '../src/physics/bodies';
import { propagate } from '../src/physics/orbit';
import { SUN_GM } from '../src/physics/bodies';
import { toJulianDate } from '../src/astro/julian';
import { VALID_FROM_MS, VALID_TO_MS } from '../src/astro/elements';
import { wrap180 } from '../src/astro/kepler';
import { STRINGS, LANGS, num, numGrouped } from '../src/i18n';
import { playSpeed } from '../src/view/views';
import { signalAt, signalProfile, sunAngle, craftAt, CONJUNCTION_DEG } from '../src/transfer/signal';
import { readFileSync } from 'node:fs';

const DAY_S = 86400;
const DEG = Math.PI / 180;
const jdOf = (y: number, m: number, d: number) => toJulianDate(new Date(Date.UTC(y, m - 1, d)));

export function checkHohmann(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: Hohmann transfer');

  // 1. Curtis, Orbital Mechanics for Engineering Students, examples 8.1, 8.3 and 8.4 (Earth to Mars, circular
  //    orbits of 149.6 and 227.9 million km, mu Sun 1.327124e11): v∞ 2.943 and 2.648 km/s, 258.8 days, Mars 44.3°
  //    ahead at departure, and 3.590 km/s from a 300 km orbit (mu Earth 398,600, radius 6,378 km).
  const c = hohmann(1.327124e11, 149.6e6, 227.9e6);
  const leo = hyperbolicBurn(c.dv1, 398600, 6378 + 300);
  const book: [string, number, number, number][] = [
    ['v∞ at Earth [km/s]', c.dv1, 2.943, 0.001], ['v∞ at Mars [km/s]', c.dv2, 2.648, 0.001],
    ['time [days]', c.tofDays, 258.8, 0.1], ['phase [deg]', c.phaseDeg, 44.3, 0.05], ['burn from 300 km [km/s]', leo, 3.590, 0.001],
  ];
  for (const [what, got, want, tol] of book) if (!(Math.abs(got - want) <= tol)) fail(`Curtis: ${what} ${got} instead of ${want}`);
  console.log(`  Curtis' Earth to Mars: v∞ ${c.dv1.toFixed(3)} and ${c.dv2.toFixed(3)} km/s, ${c.tofDays.toFixed(1)} days, Mars ${c.phaseDeg.toFixed(1)}° ahead, ${leo.toFixed(3)} km/s from 300 km (book: 2.943, 2.648, 258.8, 44.3, 3.590)`);

  // 2. Fly it with the propagator: from r1 with the departure speed, after the transfer time the craft must be
  //    on the far side at r2 with the arrival speed; and the target, started phaseDeg ahead on its circle, must be there too.
  //    The way back (r2 to r1) has the same time and the burns swapped.
  const now = toJulianDate(new Date());
  let worstKm = 0, worstV = 0, worstMeet = 0, worstBack = 0;
  for (const id of TARGETS) {
    const { h } = tripTo(id, now);
    const t = h.tofDays * DAY_S;
    const craft = propagate(SUN_GM, [h.r1, 0, 0], [0, h.vDepart, 0], t);
    worstKm = Math.max(worstKm, Math.hypot(craft.r[0] + h.r2, craft.r[1], craft.r[2]));
    worstV = Math.max(worstV, Math.abs(Math.hypot(...craft.v) - h.vArrive));
    const p = h.phaseDeg * DEG;
    const target = propagate(SUN_GM, [h.r2 * Math.cos(p), h.r2 * Math.sin(p), 0], [-h.v2 * Math.sin(p), h.v2 * Math.cos(p), 0], t);
    worstMeet = Math.max(worstMeet, Math.hypot(target.r[0] - craft.r[0], target.r[1] - craft.r[1], target.r[2] - craft.r[2]));
    const back = hohmann(SUN_GM, h.r2, h.r1);
    worstBack = Math.max(worstBack, Math.abs(back.tofDays - h.tofDays) * DAY_S, Math.abs(back.dv1 - h.dv2) * 1e3, Math.abs(back.dv2 - h.dv1) * 1e3);
  }
  if (!(worstKm < 1)) fail(`the craft does not reach the target's orbit: ${worstKm} km off`);
  if (!(worstV < 1e-6)) fail(`the craft's speed on arrival is ${worstV} km/s off`);
  if (!(worstMeet < 1)) fail(`the target is ${worstMeet} km from the craft on arrival`);
  if (!(worstBack < 1e-6)) fail(`the way back does not match: ${worstBack}`);
  console.log(`  flown with the propagator, all 7 planets: arrives within ${worstKm.toFixed(4)} km, speed within ${(worstV * 1e6).toFixed(3)} mm/s, target within ${worstMeet.toFixed(4)} km; way back the same`);

  // 3. The burn from a circular orbit: with v∞ = 0 it is the escape burn, (√2 − 1) times the circular speed
  const r = RADIUS_KM.earth + PARKING_ALT_KM, v = Math.sqrt(398600.435507 / r);
  if (!(Math.abs(hyperbolicBurn(0, 398600.435507, r) - (Math.SQRT2 - 1) * v) < 1e-12)) fail('escape burn');

  // 4. Synodic periods: NASA planetary fact sheets (NSSDC), days
  const nasa: Record<string, number> = { mercury: 115.88, venus: 583.92, mars: 779.94, jupiter: 398.88, saturn: 378.09, uranus: 369.66, neptune: 367.49 };
  const syn = TARGETS.map((id) => [id, tripTo(id, now).synodicDays] as const);
  for (const [id, d] of syn) if (!(Math.abs(d - nasa[id]) < 0.05)) fail(`synodic period of ${id}: ${d} days, NASA ${nasa[id]}`);
  console.log(`  synodic periods [days]: ${syn.map(([id, d]) => `${id} ${d.toFixed(2)}`).join(', ')} (NASA within 0.05)`);

  // 5. Every launch window on the time bar (1800-2050): at each one the target is exactly phaseDeg ahead,
  //    there is one per synodic period, and from any moment the window before and after are found.
  //    The gap between windows changes with the stretched orbits: Mars' oppositions come 764 to 812 days apart
  //    (NASA), the Hohmann windows (Mars 44° ahead, a different place on the orbits) a little more widely. (The orbits change a very little with the date the
  //    trip is worked out for, which moves a window by about a second: hence 0.001 day and 0.0001°.)
  const from = toJulianDate(new Date(VALID_FROM_MS)), to = toJulianDate(new Date(VALID_TO_MS));
  let count = 0, worstAngle = 0;
  const gaps: string[] = [];
  for (const id of TARGETS) {
    const trip = tripTo(id, from);
    const limits = id === 'mercury' ? [0.85, 1.15] : id === 'mars' ? [0.97, 1.05] : [0.98, 1.02];
    let w = windows(trip, from).next, n = 0, lo = Infinity, hi = 0;
    while (w < to) {
      const tr = tripTo(id, w);
      worstAngle = Math.max(worstAngle, Math.abs(wrap180(leadAngle(id, w) - tr.h.phaseDeg)));
      const mid = w + tr.synodicDays / 2, around = windows(tr, mid);
      if (!(Math.abs(around.prev - w) < 1e-3)) fail(`${id}: the window before ${mid} is ${around.prev}, not ${w}`);
      const gap = (around.next - w) / tr.synodicDays;
      if (!(gap > limits[0] && gap < limits[1])) { fail(`${id}: ${around.next - w} days between windows at JD ${w}`); break; }
      lo = Math.min(lo, around.next - w); hi = Math.max(hi, around.next - w);
      w = around.next; n++;
    }
    const expected = (to - from) / trip.synodicDays;
    if (!(Math.abs(n - expected) < 2)) fail(`${id}: ${n} windows in 1800-2050, expected about ${expected.toFixed(1)}`);
    count += n;
    gaps.push(`${id} ${lo.toFixed(0)}-${hi.toFixed(0)}`);
  }
  if (!(worstAngle < 1e-4)) fail(`a window is ${worstAngle}° off the phase angle`);
  console.log(`  ${count} launch windows from 1800 to 2050 (7 planets): each one per synodic period, the target within ${worstAngle.toExponential(1)}° of its place`);
  console.log(`  days between windows: ${gaps.join(', ')}`);

  // 6. Mars, from today's date in this project's notes (17 Nov 2026): the Hohmann window is 4 December 2026
  const mars = tripTo('mars', jdOf(2026, 11, 17));
  const next = windows(mars, jdOf(2026, 11, 17)).next;
  const iso = new Date((next - 2440587.5) * 864e5).toISOString().slice(0, 10);
  if (iso !== '2026-12-04') fail(`the Mars window after 17 Nov 2026 is ${iso}`);
  console.log(`  Mars: the next window after 17 Nov 2026 is ${iso}, ${mars.leave.toFixed(2)} km/s from 300 km, C3 ${mars.c3.toFixed(2)} km²/s², total ${mars.total.toFixed(2)} km/s`);

  // 7. The texts: every number in all three languages, no gaps
  const want: Record<string, string[]> = {
    ar: ['اليوم', 'بعد 16 يوم', 'من يومين', 'بعد يوم', 'بعد 26 شهر', 'من 3 أشهر'],
    de: ['heute', 'in 16 Tagen', 'vor 2 Tagen', 'in 1 Tag', 'in 26 Monaten', 'vor 3 Monaten'],
    en: ['today', 'in 16 days', '2 days ago', 'in 1 day', 'in 26 months', '3 months ago'],
  };
  for (const l of LANGS) {
    const s = STRINGS[l.id].trip;
    const rel = [0.3, 16.2, -2.4, 1.2, 790, -95].map((d) => s.rel(d));
    if (rel.join('|') !== want[l.id].join('|')) fail(`${l.id}: relative times "${rel.join('|')}"`);
    const a = `${num(44.3, 1, l.id)}°`, b = `${num(53.2, 1, l.id)}°`, days = numGrouped(780, l.id);
    const texts = [
      s.phase('venus', a, false, b, true), s.window('X', 'Y', 'Z'), s.prev('X', 'Y'), s.every(days, 26), s.c3(num(8.67, 2, l.id)),
      s.leaveNote('300', 'C'), s.arriveNote('300', 'N', 'V'), s.tripDays(days), s.aboutMonths(num(8.5, 1, l.id)), s.tripYears(num(2.7, 1, l.id)),
    ];
    const all = texts.join(' ').replace(/[\u2066-\u2069]/g, '');
    if (/undefined|NaN/.test(all)) fail(`${l.id}: "${all}"`);
    for (const x of [a, b, days, '26', `C3 = ${num(8.67, 2, l.id)}`, num(8.5, 1, l.id), num(2.7, 1, l.id), 'X', 'Y', 'Z', 'C', 'V']) {
      if (!all.includes(x)) fail(`${l.id}: the texts do not give ${x}`);
    }
    for (const k of ['title', 'badge', 'intro', 'to', 'duration', 'leave', 'arrive', 'total', 'whenTitle', 'jump', 'outside', 'note', 'giants'] as const) {
      if (!s[k].trim()) fail(`${l.id}: no text for ${k}`);
    }
  }
  console.log('  texts in three languages: numbers, relative times');

  console.log(`Hohmann transfer: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

export function checkLambert(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: Lambert\'s problem');
  const off = (a: readonly number[], b: readonly number[]) => Math.max(...a.map((x, k) => Math.abs(x - b[k])));

  // 1. Worked examples. Curtis, Orbital Mechanics for Engineering Students, example 5.2 (Earth, one hour):
  //    v1 = (−5.9925, 1.9254, 3.2456), v2 = (−3.3125, −4.1966, −0.38529) km/s.
  //    Vallado, Fundamentals of Astrodynamics and Applications, example 7-5 (Earth, 76 minutes):
  //    v1 = (2.058913, 2.915965, 0), v2 = (−3.451565, 0.910315, 0) km/s.
  const c = lambert(398600, [5000, 10000, 2100], [-14600, 2500, 7000], 3600);
  if (!c || off(c.v1, [-5.9925, 1.9254, 3.2456]) > 6e-5 || off(c.v2, [-3.3125, -4.1966, -0.38529]) > 6e-5) fail(`Curtis 5.2: ${JSON.stringify(c)}`);
  const v = lambert(398600.4418, [15945.34, 0, 0], [12214.83899, 10249.46731, 0], 76 * 60);
  if (!v || off(v.v1, [2.058913, 2.915965, 0]) > 3e-6 || off(v.v2, [-3.451565, 0.910315, 0]) > 3e-6) fail(`Vallado 7-5: ${JSON.stringify(v)}`);
  console.log(`  Curtis 5.2: v1 ${c?.v1.map((x) => x.toFixed(4)).join(', ')} km/s; Vallado 7-5: v1 ${v?.v1.map((x) => x.toFixed(6)).join(', ')} km/s (as in the books)`);

  // 2. Orbits round the Sun flown with the propagator for less than one revolution, then found again from their
  //    two ends: ellipses short and long way round, near-circles, and hyperbolas. A fixed seed, so it is the same each time.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let worst = 0, cases = 0, longWay = 0, open = 0;
  for (let i = 0; i < 400; i++) {
    const r = (0.4 + 5 * rnd()) * AU_KM, th = 2 * Math.PI * rnd(), inc = (rnd() - 0.5) * 0.6;
    const r0: Vec = [r * Math.cos(th), r * Math.sin(th), r * Math.sin(inc) * 0.3];
    const vc = Math.sqrt(SUN_GM / r) * (0.6 + 0.9 * rnd()); // from well below circular to hyperbolic
    const ang = th + Math.PI / 2 + (rnd() - 0.5) * 0.8;
    const v0: Vec = [vc * Math.cos(ang), vc * Math.sin(ang), vc * (rnd() - 0.5) * 0.2];
    const energy = (v0[0] ** 2 + v0[1] ** 2 + v0[2] ** 2) / 2 - SUN_GM / Math.hypot(...r0);
    const period = energy < 0 ? 2 * Math.PI * Math.sqrt((-SUN_GM / (2 * energy)) ** 3 / SUN_GM) : 4e8;
    const tof = period * (0.05 + 0.9 * rnd());
    const end = propagate(SUN_GM, r0, v0, tof);
    const l = lambert(SUN_GM, r0, end.r as Vec, tof);
    if (!l) continue; // (start and end exactly opposite: no single plane)
    if (Math.abs(l.angleDeg - 180) < 1) continue; // near 180° the plane is barely defined, as the method says
    cases++;
    if (l.angleDeg > 180) longWay++;
    if (energy >= 0) open++;
    worst = Math.max(worst, off(l.v1, v0) / vc, off(l.v2, end.v) / vc);
  }
  if (!(worst < 1e-7)) fail(`orbits found again from their ends: velocity off by ${worst} of the speed`);
  if (cases < 300 || longWay < 50 || open < 20) fail(`too few cases: ${cases} (${longWay} the long way, ${open} open)`);
  console.log(`  ${cases} orbits flown and found again (${longWay} the long way, ${open} hyperbolas): velocities within ${worst.toExponential(1)} of the speed`);
  if (lambert(SUN_GM, [AU_KM, 0, 0], [0, AU_KM, 0], 0) || lambert(SUN_GM, [AU_KM, 0, 0], [-1.5 * AU_KM, 0, 0], 2e7)) fail('a trip with no time, or exactly opposite ends, must have no answer');

  // 2b. The same with one to four whole turns first (step 6): flown with the propagator for revs turns and a part
  //     of one, then found again as one of the two answers for that many turns, and among all of them
  let worstRev = 0, revCases = 0, missing = 0;
  const perRev = [0, 0, 0, 0, 0];
  for (let i = 0; i < 400; i++) {
    const r = (0.4 + 5 * rnd()) * AU_KM, th = 2 * Math.PI * rnd(), inc = (rnd() - 0.5) * 0.6;
    const r0: Vec = [r * Math.cos(th), r * Math.sin(th), r * Math.sin(inc) * 0.3];
    const vc = Math.sqrt(SUN_GM / r) * (0.7 + 0.6 * rnd()); // bound orbits only: a turn must end
    const ang = th + Math.PI / 2 + (rnd() - 0.5) * 0.8;
    const v0: Vec = [vc * Math.cos(ang), vc * Math.sin(ang), vc * (rnd() - 0.5) * 0.2];
    const energy = (v0[0] ** 2 + v0[1] ** 2 + v0[2] ** 2) / 2 - SUN_GM / Math.hypot(...r0);
    if (!(energy < 0)) continue;
    const period = 2 * Math.PI * Math.sqrt((-SUN_GM / (2 * energy)) ** 3 / SUN_GM);
    const revs = 1 + (i % MAX_REVS), tof = period * (revs + 0.05 + 0.9 * rnd());
    const end = propagate(SUN_GM, r0, v0, tof);
    const sols = lambertRevs(SUN_GM, r0, end.r as Vec, tof, revs);
    const zero = lambert(SUN_GM, r0, end.r as Vec, tof);
    if (!zero || Math.abs(zero.angleDeg - 180) < 1 || zero.angleDeg < 1 || zero.angleDeg > 359) continue; // a barely defined plane
    revCases++;
    const hit = sols.map((l) => off(l.v1, v0) / vc).sort((a, b) => a - b)[0];
    if (!(hit < 1e-6)) { missing++; continue; }
    const l = sols.find((x) => off(x.v1, v0) / vc === hit)!;
    worstRev = Math.max(worstRev, hit, off(l.v2, end.v) / vc);
    if (l.revs !== revs || !lambertAll(SUN_GM, r0, end.r as Vec, tof).some((x) => x.revs === revs && off(x.v1, v0) / vc < 1e-6)) missing++;
    perRev[revs]++;
  }
  if (missing || !(worstRev < 1e-7) || revCases < 300 || perRev.slice(1).some((n) => n < 60)) fail(`orbits with whole turns: ${missing} of ${revCases} not found again, velocities off by ${worstRev}, ${perRev.join('/')}`);
  console.log(`  ${revCases} orbits with 1 to ${MAX_REVS} whole turns (${perRev.slice(1).join(', ')}) flown and found again among the two answers: velocities within ${worstRev.toExponential(1)} of the speed`);
  // Too little time for the turns: no answer (no orbit through both ends is smaller than the minimum-energy ellipse)
  if (lambertRevs(SUN_GM, [AU_KM, 0, 0], [0, 1.5 * AU_KM, 0], 200 * DAY_S, 1).length) fail('one whole turn in 200 days from 1 to 1.5 au must have no answer');

  // 3. The planets' states (Astronomy Engine): positions agree with the site's Kepler planets, velocities with
  //    how the positions change (units km and km/s)
  const jd0 = jdOf(2026, 11, 17);
  let posDeg = 0, velRel = 0;
  for (const p of PLANETS) {
    const st = planetState(p.id, jd0), k = heliocentricPosition(p, centuriesSinceJ2000(jd0));
    const a: Vec = [k.x * AU_KM, k.y * AU_KM, k.z * AU_KM];
    posDeg = Math.max(posDeg, Math.acos(Math.min(1, (st.r[0] * a[0] + st.r[1] * a[1] + st.r[2] * a[2]) / (Math.hypot(...st.r) * Math.hypot(...a)))) / DEG);
    const before = planetState(p.id, jd0 - 0.01), after = planetState(p.id, jd0 + 0.01);
    const fd = [0, 1, 2].map((i) => (after.r[i] - before.r[i]) / (0.02 * DAY_S));
    velRel = Math.max(velRel, off(fd, st.v) / Math.hypot(...st.v));
  }
  if (!(posDeg < 0.25)) fail(`planet positions ${posDeg}° from the site's`);
  if (!(velRel < 1e-5)) fail(`planet velocities off their positions' change by ${velRel}`);
  console.log(`  planets' states: within ${posDeg.toFixed(3)}° of the site's Kepler planets, velocities match their motion (${velRel.toExponential(1)})`);

  // 4. NASA's Mars mission design handbook (Burke, Falck and McGuire 2010, NASA/TM-2010-216764, table 2), the 2026
  //    opportunity, ballistic, dates to the day: departure, arrival, C3 [km²/s²], v∞ at Mars [km/s], declination of
  //    the launch asymptote [deg], type. (Its ephemeris and times of day differ a little from ours: C3 within 1%.)
  const handbook: [number[], number[], number, number, number, 1 | 2][] = [
    [[2026, 11, 14], [2027, 8, 9], 11.11, 2.915, 28.28, 1],
    [[2026, 10, 31], [2027, 8, 19], 9.144, 2.729, 23.16, 2],
    [[2026, 11, 6], [2027, 9, 8], 9.646, 2.565, 32.8, 2],
  ];
  for (const [d, a, c3, vInf, dla, type] of handbook) {
    const tr = realTrip('mars', jdOf(d[0], d[1], d[2]), jdOf(a[0], a[1], a[2]));
    const what = `${d.join('-')} to ${a.join('-')}`;
    if (!tr) { fail(`${what}: no trip`); continue; }
    if (!(Math.abs(tr.c3 / c3 - 1) < 0.01)) fail(`${what}: C3 ${tr.c3}, handbook ${c3}`);
    if (!(Math.abs(tr.vInfArrive - vInf) < 0.005)) fail(`${what}: v∞ ${tr.vInfArrive}, handbook ${vInf}`);
    if (!(Math.abs(tr.dla - dla) < 0.2)) fail(`${what}: declination ${tr.dla}, handbook ${dla}`);
    if (tr.type !== type) fail(`${what}: type ${tr.type}, handbook ${type}`);
    console.log(`  Mars ${what}: C3 ${tr.c3.toFixed(3)} (handbook ${c3}), v∞ ${tr.vInfArrive.toFixed(3)} (${vInf}), declination ${tr.dla.toFixed(2)}° (${dla}°), type ${tr.type === 1 ? 'I' : 'II'}`);
  }
  // The real trip on the Hohmann estimate's own dates costs more: the estimate's date is off
  const h = realTrip('mars', jdOf(2026, 12, 4), jdOf(2027, 8, 20));
  if (!h || !(h.c3 > 11.11)) fail(`Mars on the Hohmann dates: C3 ${h?.c3}`);
  console.log(`  Mars on the Hohmann estimate's dates (4 Dec 2026 to 20 Aug 2027): C3 ${h?.c3.toFixed(2)}, more than at the handbook's best`);

  // 5. The texts
  for (const l of LANGS) {
    const s = STRINGS[l.id].trip;
    const deg = `${num(196, 0, l.id)}°`;
    const all = [s.way(deg, 1, 0), s.way(deg, 2, 0), s.way(deg, 1, 1), s.way(deg, 2, 3), s.badDates, s.noTrip, s.exactTitle, s.exactIntro, s.departDate, s.arriveDate].join(' ');
    if (/undefined|NaN/.test(all) || !s.way(deg, 2, 0).includes(deg) || s.way(deg, 1, 0) === s.way(deg, 2, 0)) fail(`${l.id}: "${all}"`);
    if (!s.way(deg, 2, 3).includes(deg) || !s.way(deg, 2, 3).includes('3') || s.way(deg, 1, 1) === s.way(deg, 1, 0) || s.way(deg, 1, 1) === s.way(deg, 1, 2)) fail(`${l.id}: the whole turns are not said: "${s.way(deg, 2, 3)}"`);
    for (const k of ['badDates', 'noTrip', 'exactTitle', 'exactIntro', 'departDate', 'arriveDate'] as const) if (!s[k].trim()) fail(`${l.id}: no text for ${k}`);
  }

  console.log(`Lambert's problem: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

export function checkPorkchop(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: porkchop map');
  const iso = (jd: number) => new Date((jd - 2440587.5) * 864e5).toISOString().slice(0, 10);

  // 1. NASA's Mars mission design handbook (NASA/TM-2010-216764), table 1: the lowest launch energy C3 [km²/s²] of
  //    each opportunity, ballistic, and its type. Ours: the cheapest on the map round each Hohmann window, refined.
  //    (The handbook steps its dates by two days and uses its own ephemeris: within 1.5%.)
  const table1: [number, number, 1 | 2][] = [
    [2026, 9.144, 2], [2028, 8.928, 2], [2031, 8.237, 2], [2033, 7.781, 2], [2035, 10.19, 1],
    [2037, 14.84, 2], [2039, 12.17, 2], [2041, 9.818, 2], [2043, 8.969, 2], [2045, 8.587, 2],
  ];
  let worst = 0;
  const rows: string[] = [];
  for (const [year, c3, type] of table1) {
    const range = porkchopRange('mars', jdOf(year, 1, 1));
    const map = porkchop(range);
    const b1 = cheapest(map, 'c3', 1), b2 = cheapest(map, 'c3', 2);
    const best = [b1, b2].filter((b) => !!b).sort((p, q) => p!.c3 - q!.c3)[0];
    if (!best) { fail(`${year}: no trip on the map`); continue; }
    worst = Math.max(worst, Math.abs(best.c3 / c3 - 1));
    if (!(Math.abs(best.c3 / c3 - 1) < 0.015)) fail(`${year}: cheapest C3 ${best.c3}, handbook ${c3}`);
    if (best.type !== type) fail(`${year}: cheapest of type ${best.type}, handbook type ${type}`);
    if (onEdge(map, best)) fail(`${year}: the cheapest lies on the edge of the map`);
    for (const b of [b1, b2]) if (b && nearHalfTurn(b.angleDeg)) fail(`${year}: a cheapest trip on the ridge (${b.angleDeg}°)`);
    // A valley bottom: a little step any way costs more
    for (const [dd, tt] of [[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) {
      const n = realTrip('mars', best.departJd + dd, best.departJd + dd + best.tofDays + tt);
      if (n && n.c3 < best.c3 - 1e-9) fail(`${year}: not a minimum (${n.c3} < ${best.c3})`);
    }
    rows.push(`${year} ${best.c3.toFixed(2)} (${c3}) ${best.type === 1 ? 'I' : 'II'} ${iso(best.departJd)}`);
  }
  console.log(`  Mars, cheapest C3 of each opportunity (handbook in brackets), within ${(worst * 100).toFixed(1)}%:`);
  console.log(`    ${rows.slice(0, 5).join(' · ')}`);
  console.log(`    ${rows.slice(5).join(' · ')}`);

  // 2. The map's bookkeeping, for Mars 2026: worked out in slices it is the same as at once; types follow the
  //    angle; the time step is a whole number of launch steps; the Hohmann date is inside; band edges rise
  const range = porkchopRange('mars', jdOf(2026, 11, 17));
  const whole = porkchop(range);
  const { map, step } = porkchopStepper(range);
  let calls = 0;
  while (!step(0)) calls++;
  const same = (a: ArrayLike<number>, b: ArrayLike<number>) => Array.from(a).every((x, k) => Object.is(x, b[k]));
  if (!same(map.c3, whole.c3) || !same(map.dv, whole.dv) || !same(map.type, whole.type) || calls < 10) fail(`a map in slices differs (${calls} slices)`);
  let typeOff = 0, finite = 0;
  for (let at = 0; at < whole.c3.length; at++) {
    if (!Number.isFinite(whole.c3[at])) continue;
    finite++;
    if (whole.type[at] !== (whole.angle[at] < 180 ? 1 : 2) || !(whole.c3[at] > 0) || !(whole.dv[at] > 0)) typeOff++;
  }
  if (typeOff || finite < 0.99 * whole.c3.length) fail(`map: ${typeOff} cells with a wrong type or value, ${finite} of ${whole.c3.length} worked out`);
  const k = range.tofStep / range.departStep;
  if (Math.abs(k - Math.round(k)) > 1e-9) fail(`time step ${range.tofStep} is not a whole number of launch steps ${range.departStep}`);
  if (!(range.hohmannJd > range.depart0 && range.hohmannJd < range.depart0 + (range.nx - 1) * range.departStep)) fail('the Hohmann date is off the map');
  // A cell of the map is the trip worked out on its own
  const probe = realTrip('mars', range.depart0 + 37 * range.departStep, range.depart0 + 37 * range.departStep + range.tof0 + 61 * range.tofStep);
  if (!probe || Math.abs(probe.c3 - whole.c3[61 * range.nx + 37]) > 1e-9 * probe.c3) fail(`a cell of the map: ${whole.c3[61 * range.nx + 37]} against ${probe?.c3}`);
  const min = mapMin(whole, 'c3'), edges = bandEdges(min);
  if (!(edges.length >= 4 && edges[0] > min && edges.every((e, i) => i === 0 || e > edges[i - 1]))) fail(`band edges ${edges} for ${min}`);
  console.log(`  map ${range.nx}×${range.ny}, worked out in ${calls + 1} slices the same as at once; bands from ${min.toFixed(2)}: ${edges.join(', ')}`);
  // The type I minimum of 2026: the handbook gives 11.11 (14 Nov 2026 to 9 Aug 2027); ours is lower, close to the ridge,
  // where the two calculations part (Mars arrives almost on the ecliptic). Shown, not checked.
  const t1 = cheapest(whole, 'c3', 1);
  console.log(`  (2026 type I: ours ${t1?.c3.toFixed(2)} on ${t1 && iso(t1.departJd)} at ${t1?.angleDeg.toFixed(1)}°, handbook 11.11 on 2026-11-14; within ${RIDGE_DEG}° of 180° is left out)`);

  // 3. The outer planets: Neptune's map has a cheapest trip of type II on its long edge, and says so
  const nep = porkchop(porkchopRange('neptune', jdOf(2026, 11, 17)));
  const n2 = cheapest(nep, 'c3', 2), n1 = cheapest(nep, 'c3', 1);
  if (!n2 || !onEdge(nep, n2) || !n1 || onEdge(nep, n1)) fail(`Neptune: edges ${n1 && onEdge(nep, n1)}, ${n2 && onEdge(nep, n2)}`);
  // Here the time step is many launch steps: cells must still be the trips worked out on their own
  const kn = Math.round(nep.tofStep / nep.departStep);
  let cellOff = 0;
  for (const [i, j] of [[3, 5], [90, 40], [120, nep.ny - 1]]) {
    const dep = nep.depart0 + i * nep.departStep, tr = realTrip('neptune', dep, dep + nep.tof0 + j * nep.tofStep);
    if (!tr || Math.abs(tr.c3 - nep.c3[j * nep.nx + i]) > 1e-9 * tr.c3) cellOff++;
  }
  if (cellOff || kn < 2) fail(`Neptune: ${cellOff} cells differ from the trips worked out on their own (time step ${kn} launch steps)`);
  console.log(`  Neptune: time step ${kn} launch steps, cells as worked out on their own; cheapest type II on the map's edge (${(n2!.tofDays / 365.25).toFixed(1)} years), and said so`);

  // 4. The texts
  for (const l of LANGS) {
    const s = STRINGS[l.id].trip;
    const all = [s.best(1, 'X', 'Y', 'Z', 'V'), s.best(2, 'X', 'Y', 'Z', 'V'), s.typeName(1), s.typeName(2), s.edge, s.nearHalf, s.mapTitle, s.mapIntro, s.marks, s.mapAria].join(' ');
    if (/undefined|NaN/.test(all) || s.best(1, 'X', 'Y', 'Z', 'V') === s.best(2, 'X', 'Y', 'Z', 'V') || s.typeName(1) === s.typeName(2)) fail(`${l.id}: "${all}"`);
    for (const x of ['X', 'Y', 'Z', 'V']) if (!s.best(2, 'X', 'Y', 'Z', 'V').includes(x)) fail(`${l.id}: the best trip's text does not give ${x}`);
  }

  console.log(`Porkchop map: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

export function checkTripPath(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: the trip in the views');
  // The path the views draw: the craft's orbit round the Sun flown from its start (as src/view/trip.ts does).
  // It must start at the Earth on launch day and end at the target on arrival day, for trips of every kind.
  let worst = 0;
  const cases: [string, number[], number[]][] = [
    ['mars', [2026, 10, 31], [2027, 8, 20]], ['mars', [2026, 11, 13], [2027, 8, 11]], ['venus', [2028, 3, 26], [2028, 9, 14]],
    ['mercury', [2026, 11, 20], [2027, 3, 1]], ['jupiter', [2027, 12, 6], [2031, 7, 21]], ['neptune', [2027, 5, 22], [2044, 1, 18]],
    ['venus', [2028, 3, 26], [2031, 2, 24]], // 1,065 days: three whole turns first (step 6), cheaper than the direct way
  ];
  let turns = 0;
  for (const [id, d, a] of cases) {
    const tr = realTrip(id as never, jdOf(d[0], d[1], d[2]), jdOf(a[0], a[1], a[2]));
    turns = Math.max(turns, tr?.revs ?? 0);
    if (!tr) { fail(`${id}: no trip`); continue; }
    const e = planetState('earth', tr.departJd), p = planetState(tr.target, tr.arriveJd);
    const end = propagate(SUN_GM, tr.r1, tr.v1, tr.tofDays * DAY_S);
    const startOff = Math.hypot(tr.r1[0] - e.r[0], tr.r1[1] - e.r[1], tr.r1[2] - e.r[2]);
    const endOff = Math.hypot(end.r[0] - p.r[0], end.r[1] - p.r[1], end.r[2] - p.r[2]);
    worst = Math.max(worst, startOff, endOff);
  }
  if (!(worst < 10)) fail(`a trip's path misses the Earth or its target by ${worst} km`);
  if (turns !== 3) fail(`the 1,065-day trip to Venus goes ${turns} whole turns, not 3`);
  console.log(`  7 trips (Mercury to Neptune, and Venus with 3 whole turns): each path starts at the Earth and ends at its target within ${worst.toFixed(3)} km`);
  // The speed a trip is run at: the one that takes closest to 15 seconds (days per second: day, week, month, year)
  const speeds = [1, 7, 30.44, 365.25];
  const want: [number, number][] = [[105.5, 1], [146, 1], [292, 2], [997, 2], [2208, 3], [11182, 3]];
  for (const [days, i] of want) if (playSpeed(days, speeds) !== i) fail(`a trip of ${days} days runs at speed ${playSpeed(days, speeds)}, not ${i}`);
  console.log('  run speeds: Mercury and Venus a week per second, Mars and Jupiter a month, Saturn and Neptune a year');
  for (const l of LANGS) {
    const s = STRINGS[l.id].trip;
    for (const k of ['playTrip', 'showPath', 'craft', 'playNote'] as const) if (!s[k].trim()) fail(`${l.id}: no text for ${k}`);
  }
  console.log(`The trip in the views: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

export function checkSignal(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: the signal delay');
  const iso = (jd: number) => (Number.isFinite(jd) ? new Date((jd - 2440587.5) * DAY_S * 1000).toISOString().slice(0, 16).replace('T', ' ') : 'never');
  const LIGHT_KM_S = 299_792.458; // the check's own: the metre is defined by it
  const sub = (a: number[], b: number[]): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);

  // (a) The Earth–Mars light time and the Sun's angle, against JPL Horizons (DE441 and mar099, geometric, every
  // 5 days for a year from 15.11.2026; TDB, so 69.184 s ahead of UTC). Mars is the end of a trip there.
  const ref = JSON.parse(readFileSync('scripts/reference/state-vectors-horizons.json', 'utf8'));
  const hz = (id: string, i: number) => (ref.targets[id].pos[i] as number[]).map((v) => v * AU_KM);
  let worstS = 0, worstDeg = 0;
  for (let i = 0; i < ref.targets['399'].pos.length; i++) {
    const jdTdb = ref.epochJd + i * ref.stepDays, jdUtc = jdTdb - 69.184 / DAY_S;
    const e = hz('399', i), mars = hz('499', i), sun = hz('10', i);
    // The angle at the Earth between the Sun and Mars, worked out here on its own
    const toSun = sub(sun, e), toMars = sub(mars, e);
    const wantDeg = Math.acos((toSun[0] * toMars[0] + toSun[1] * toMars[1] + toSun[2] * toMars[2]) / (len(toSun) * len(toMars))) / DEG;
    const want = len(toMars) / LIGHT_KM_S;
    // Mars as the end of a trip: what the card gives on the day a trip of 259 days arrives there
    const tr = realTrip('mars', jdUtc - 259, jdUtc);
    if (!tr) { fail(`no trip to Mars arriving ${iso(jdUtc)}`); continue; }
    const at = signalAt(tr, jdUtc);
    worstS = Math.max(worstS, Math.abs(at.seconds - want));
    worstDeg = Math.max(worstDeg, Math.abs(at.sepDeg - wantDeg));
  }
  if (!(worstS < 0.5)) fail(`the Earth–Mars light time is ${worstS.toFixed(3)} s off Horizons`);
  if (!(worstDeg < 0.01)) fail(`Mars' angle from the Sun is ${worstDeg.toFixed(4)}° off Horizons`);
  console.log(`  at Mars, every 5 days for a year, against Horizons: light time within ${worstS.toFixed(3)} s, angle from the Sun within ${worstDeg.toFixed(4)}°`);

  // (b) The 2° limit: Mars within 2° of the Sun in the Earth's sky when NASA's Mars missions sent no commands
  // (2019: 28 Aug to 7 Sep; 2021: 2 to 16 Oct; 2023: 11 to 25 Nov). The pauses are whole days, and NASA says some
  // missions add a day or two either side, so the stretch below 2° must start within a day of the pause's first
  // day and end between two and a half days before its last day and a day after it.
  const pauses: [number[], number[]][] = [[[2019, 8, 28], [2019, 9, 7]], [[2021, 10, 2], [2021, 10, 16]], [[2023, 11, 11], [2023, 11, 25]]];
  const found: string[] = [];
  for (const [a, b] of pauses) {
    const start = jdOf(a[0], a[1], a[2]), end = jdOf(b[0], b[1], b[2]);
    let from = NaN, to = NaN;
    for (let jd = start - 20; jd < end + 20; jd += 0.02) {
      const near = sunAngle(planetState('earth', jd).r, planetState('mars', jd).r) < CONJUNCTION_DEG;
      if (near && Number.isNaN(from)) from = jd;
      if (!near && !Number.isNaN(from) && Number.isNaN(to)) to = jd;
    }
    if (!(Math.abs(from - start) <= 1 && to >= end - 2.5 && to <= end + 1)) fail(`Mars near the Sun ${iso(from)} to ${iso(to)}, NASA's pause ${a.join('-')} to ${b.join('-')}`);
    found.push(`${iso(from).slice(0, 10)} to ${iso(to).slice(0, 10)}`);
  }
  console.log(`  Mars within ${CONJUNCTION_DEG}° of the Sun: ${found.join(', ')} (NASA's pauses in commanding: 28.8–7.9.2019, 2–16.10.2021, 11–25.11.2023)`);

  // (c) Six trips: no delay at launch (the craft starts at the Earth's centre), the Earth–target light time at
  // arrival; the instant distance against the true light time (a signal received now left the craft τ ago);
  // and the profile's longest delay and stretches near the Sun against a plain scan every 6 hours.
  const cases: [string, number[], number[]][] = [
    ['mars', [2026, 10, 31], [2027, 8, 20]], ['venus', [2028, 3, 26], [2028, 9, 14]], ['mercury', [2026, 11, 20], [2027, 3, 1]],
    ['jupiter', [2027, 12, 6], [2031, 7, 21]], ['saturn', [2030, 1, 1], [2036, 1, 1]], ['neptune', [2027, 5, 22], [2044, 1, 18]],
  ];
  let worstEnd = 0, worstLight = 0, worstEdge = 0, worstMax = 0, conj = 0;
  const lines: string[] = [];
  for (const [id, d, a] of cases) {
    const tr = realTrip(id as never, jdOf(d[0], d[1], d[2]), jdOf(a[0], a[1], a[2]));
    if (!tr) { fail(`${id}: no trip`); continue; }
    const p = signalProfile(tr);
    if (p.samples[0].km > 1e-6 || p.samples[0].seconds !== 0) fail(`${id}: a delay at launch (${p.samples[0].km} km)`);
    const e = planetState('earth', tr.arriveJd).r, q = planetState(tr.target, tr.arriveJd).r;
    worstEnd = Math.max(worstEnd, Math.abs(p.arrival.seconds - len(sub(q, e)) / LIGHT_KM_S));
    // The true light time, iterated: |Earth(t) − craft(t − τ)| = c τ
    for (const sm of p.samples.filter((_, i) => i % 10 === 5)) {
      let tau = sm.seconds;
      for (let k = 0; k < 4; k++) tau = len(sub(planetState('earth', sm.jd).r, craftAt(tr, sm.jd - tau / DAY_S))) / LIGHT_KM_S;
      worstLight = Math.max(worstLight, Math.abs(tau - sm.seconds) / sm.seconds);
    }
    // The plain scan
    const step = 0.25;
    let max = 0;
    const wins: [number, number][] = [];
    let inFrom = NaN;
    for (let jd = tr.departJd + step; jd <= tr.arriveJd; jd += step) {
      const sg = signalAt(tr, jd);
      max = Math.max(max, sg.km);
      const near = sg.sepDeg < CONJUNCTION_DEG;
      if (near && Number.isNaN(inFrom)) inFrom = jd;
      if (!near && !Number.isNaN(inFrom)) { wins.push([inFrom, jd]); inFrom = NaN; }
    }
    if (!Number.isNaN(inFrom)) wins.push([inFrom, tr.arriveJd]);
    max = Math.max(max, p.arrival.km);
    if (!(p.max.km >= max * (1 - 1e-9))) fail(`${id}: the longest delay ${p.max.km} km is below the scan's ${max} km`);
    for (const sm of p.samples) if (sm.km > p.max.km) fail(`${id}: a sample farther than the longest delay`);
    worstMax = Math.max(worstMax, Math.abs(p.max.km - max) / LIGHT_KM_S);
    if (wins.length !== p.conjunctions.length) fail(`${id}: ${p.conjunctions.length} stretches near the Sun, the scan finds ${wins.length}`);
    p.conjunctions.forEach((c, k) => {
      if (!wins[k]) return;
      worstEdge = Math.max(worstEdge, Math.abs(c.from - (wins[k][0] - step / 2)), Math.abs(c.to - (wins[k][1] - step / 2)));
      // Each edge is where the angle crosses 2°: below it just inside, above it just outside (unless at launch or arrival)
      const sep = (jd: number) => signalAt(tr, jd).sepDeg;
      if (c.from > tr.departJd && !(sep(c.from - 0.001) >= CONJUNCTION_DEG && sep(c.from + 0.001) < CONJUNCTION_DEG)) fail(`${id}: stretch ${k + 1} does not start where the angle crosses 2°`);
      if (c.to < tr.arriveJd && !(sep(c.to + 0.001) >= CONJUNCTION_DEG && sep(c.to - 0.001) < CONJUNCTION_DEG)) fail(`${id}: stretch ${k + 1} does not end where the angle crosses 2°`);
      if (!(c.minDeg < CONJUNCTION_DEG && c.minDeg <= Math.min(sep(c.from), sep(c.to)))) fail(`${id}: stretch ${k + 1}'s closest angle ${c.minDeg}`);
    });
    conj += p.conjunctions.length;
    lines.push(`${id} ${(p.arrival.seconds / 60).toFixed(1)} min at arrival, longest ${(p.max.seconds / 60).toFixed(1)} (day ${p.max.day.toFixed(0)}), ${p.conjunctions.length} near the Sun`);
  }
  if (!(worstEnd < 1e-5)) fail(`the delay at arrival is ${worstEnd} s off the Earth–target light time`);
  if (!(worstLight < 2e-4)) fail(`the instant distance is ${worstLight} off the true light time (relative)`);
  if (!(worstEdge <= 0.13)) fail(`a stretch near the Sun is ${worstEdge.toFixed(3)} days off the scan`);
  if (!(worstMax < 0.01)) fail(`the longest delay is ${worstMax} s off the scan`);
  console.log(`  ${lines.join('; ')}`);
  console.log(`  at launch 0 s, at arrival the Earth–target light time within ${worstEnd.toExponential(1)} s; the instant distance within ${(worstLight * 1e4).toFixed(2)}×10⁻⁴ of the true light time`);
  console.log(`  longest delay within ${worstMax.toFixed(4)} s of a scan every 6 hours; ${conj} stretches near the Sun, the same as the scan, edges within ${worstEdge.toFixed(3)} days and on the 2° line`);

  // (d) Texts in three languages
  for (const l of LANGS) {
    const s = STRINGS[l.id].trip;
    for (const k of ['sigTitle', 'sigIntro', 'sigMaxAtEnd', 'sigNoConj', 'sigAxisDays', 'sigAxisYears', 'sigUnitMin', 'sigUnitHours', 'sigSun', 'sigTable', 'sigAria'] as const) {
      if (!s[k].trim()) fail(`${l.id}: no text for ${k}`);
    }
    if (!s.sigIntro.includes(numGrouped(299792, l.id)) || !s.sigIntro.includes('2°')) fail(`${l.id}: the intro does not give c and the 2° limit`);
    const arrive = s.sigArrive('A1', 'B2'), max = s.sigMax('C3', 'D4', 'E5'), now = s.sigNow('F6', 'G7');
    if (![arrive.includes('A1') && arrive.includes('B2'), max.includes('C3') && max.includes('D4') && max.includes('E5'), now.includes('F6') && now.includes('G7')].every(Boolean)) fail(`${l.id}: a signal line drops a value`);
    for (const n of [1, 2, 3]) if (!s.sigConj(n, 'H8').includes('H8')) fail(`${l.id}: the stretches near the Sun drop their dates`);
    for (const n of [4, 12, 47]) {
      const many = s.sigConjMany(n, 13, 'J1', 'K2');
      if (!many.includes(String(n)) || !many.includes('13') || !many.includes('J1') || !many.includes('K2')) fail(`${l.id}: many stretches near the Sun drop a value`);
    }
    if (!s.craftDelay('Name', 'I9').includes('Name') || !s.craftDelay('Name', 'I9').includes('I9')) fail(`${l.id}: the craft's label drops its name or delay`);
    if (!s.seconds(25).includes('25')) fail(`${l.id}: seconds drop their number`);
  }
  console.log(`The signal delay: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

export function checkMissionDesign(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: against JPL\'s Small-Body Mission Design tool');
  const ref = JSON.parse(readFileSync('scripts/reference/mission-design-jpl.json', 'utf8'));
  const sb = JSON.parse(readFileSync('src/data/small-bodies.json', 'utf8'));
  const H = ref.horizons;
  const sub = (a: number[], b: number[]): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);
  const angle = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))))) / DEG;
  const state = (row: number[]) => ({ r: row.slice(0, 3) as Vec, v: row.slice(3, 6) as Vec });
  const MJD = 2400000.5;
  // JPL gives five significant digits (at least four decimals): within that rounding, plus a little for the
  // ephemeris and constants (its Sun, our 69 s from TDB to UTC for the Earth at arrival)
  const near = (ours: number, jpl: number, rel: number, abs: number) =>
    Math.abs(ours - jpl) <= Math.max(0.5 * 10 ** (Math.floor(Math.log10(Math.abs(jpl) || 1)) - 4), 5e-5) * 1.01 + rel * Math.abs(jpl) + abs;
  const LIMIT_KMS = 30; // above that (C3 over 900 km²/s², beyond any rocket) see below

  let trips = 0, picked = 0, worstV = 0, worstAng = 0;
  const byRevs = [0, 0, 0, 0, 0];
  let fast = 0, fastOff = 0, fastOddOff = 0;
  const lines: string[] = [];
  for (const [des, b] of Object.entries<any>(ref.bodies)) {
    const E = H.earth.states, B = H.bodies[des]?.states;
    if (!B || b.error) { fail(`${des}: no reference`); continue; }
    let n = 0, bad = 0;
    const one = (dep: number, tof: number, jpl: Record<string, number | null>, fromQ: boolean) => {
      if (!E[dep] || !B[dep + tof] || !E[dep + tof]) { fail(`${des}: no Horizons state for MJD ${dep} or ${dep + tof}`); return; }
      const e = state(E[dep]), p = state(B[dep + tof]);
      const f = flightBetween(dep + MJD, dep + tof + MJD, e, p);
      if (!f) { fail(`${des}: no flight ${dep} + ${tof} days`); return; }
      const jv = jpl.vinf_dep as number;
      if (jv > LIMIT_KMS) {
        fast++;
        if (!near(f.vInfDepart, jv, 2e-4, 5e-4)) {
          fastOff++;
          const a = f.angleDeg; // where JPL and we differ, both ends must lie nearly in line with the Sun
          if (!(Math.min(a, Math.abs(a - 180), 360 - a) < 15)) { fastOddOff++; console.log(`  ${des} ${dep}+${tof}: JPL ${jv}, ours ${f.vInfDepart.toFixed(3)} at ${a.toFixed(1)}°`); }
        }
        return;
      }
      n++; trips++; if (fromQ) picked++; byRevs[f.revs]++;
      // At arrival, as the signal card would give it: distance from the Earth and angle from the Sun
      const at = signalAt(f, f.arriveJd);
      const ours: Record<string, number> = {
        vinf_dep: f.vInfDepart, vinf_arr: f.vInfArrive, decl_dep: f.dla, earth_dist: at.km / AU_KM, elong_arr: at.sepDeg,
        phase_ang: angle(f.inf2, p.r), approach_ang: angle(f.inf2, p.v),
      };
      let off = false;
      for (const [k, v] of Object.entries(ours)) {
        const want = jpl[k];
        if (want === null || want === undefined) continue;
        const speed = k === 'vinf_dep' || k === 'vinf_arr';
        if (speed) worstV = Math.max(worstV, Math.abs(v - want));
        else if (k !== 'earth_dist') worstAng = Math.max(worstAng, Math.abs(v - want));
        const good = speed ? near(v, want, 2e-4, 5e-4) : k === 'earth_dist' ? near(v, want, 1e-5, 1e-5) : near(v, want, 0, 0.012);
        if (!good) { off = true; if (bad < 3) console.log(`  ${des} ${dep}+${tof} (${f.revs} turns): ${k} ours ${v.toFixed(5)}, JPL ${want}`); }
      }
      if (off) bad++;
    };
    const g = b.map;
    g.tof.forEach((tof: number, j: number) => g.dep.forEach((dep: number, i: number) => {
      if (g.vinf_dep[j][i] === null) return;
      one(dep, tof, { vinf_dep: g.vinf_dep[j][i], vinf_arr: g.vinf_arr[j][i], decl_dep: g.decl_dep[j][i], earth_dist: g.earth_dist[j][i], elong_arr: g.elong_arr[j][i] }, false);
    }));
    const fq: string[] = b.q.fields;
    for (const r of b.q.missions) {
      const row = Object.fromEntries(fq.map((k, i) => [k, r[i]]));
      one(row.MJD0, row.MJDf - row.MJD0, row, true);
    }
    for (const [k, m] of Object.entries<any>(b.min)) {
      if (!m) continue;
      const e = state(E[m.dep]), p = state(B[m.dep + m.tof]);
      const f = flightBetween(m.dep + MJD, m.dep + m.tof + MJD, e, p);
      const v = k === 'vinf_dep' ? f?.vInfDepart : k === 'vinf_arr' ? f?.vInfArrive : f ? f.vInfDepart + f.vInfArrive : NaN;
      if (!(v !== undefined && near(v, m.value, 2e-4, 1e-3))) fail(`${des}: the map's cheapest ${k} ${m.value}, ours ${v}`);
    }
    if (bad) fail(`${des}: ${bad} of ${n} trips differ from JPL`);
    lines.push(`${b.object?.fullname ?? des} ${n}`);
  }
  if (trips < 3500 || picked < 500 || byRevs.slice(1).some((x) => x < 20)) fail(`too few trips: ${trips} (${picked} picked by JPL), by whole turns ${byRevs.join('/')}`);
  if (fastOddOff || fastOff > 0.05 * fast) fail(`above ${LIMIT_KMS} km/s: ${fastOff} of ${fast} differ, ${fastOddOff} with the ends not in line`);
  console.log(`  ${trips} trips up to ${LIMIT_KMS} km/s (${picked} of them JPL's picked missions) on Horizons' states: ${lines.join(', ')}`);
  console.log(`  all match JPL to its rounding: both v∞ within ${worstV.toFixed(4)} km/s, launch declination, angle from the Sun, phase and approach angles within ${worstAng.toFixed(4)}°, distance from the Earth`);
  console.log(`  JPL's rule, which ours follows: the lowest launch speed of all prograde orbits with none to ${MAX_REVS} whole turns (by turns: ${byRevs.join(', ')})`);
  console.log(`  above ${LIMIT_KMS} km/s: ${fast - fastOff} of ${fast} match; the other ${fastOff} have their ends within 15° of in line with the Sun`);

  // The site's own states: the Earth from Astronomy Engine and each body moved with the Sun alone (smallBodyState),
  // against Horizons on the arrival dates that lie in the years the site shows the body
  const F: string[] = sb.fields;
  let posWorst = 0, velWorst = 0, tripWorst: number[] = [];
  for (const [des] of Object.entries<any>(ref.bodies)) {
    const row = sb.rows.find((x: unknown[]) => x[0] === des);
    if (!row) { fail(`${des}: not among the site's bodies`); continue; }
    const o = Object.fromEntries(F.map((k, i) => [k, row[i]]));
    for (const [mjd, hz] of Object.entries<number[]>(H.bodies[des]?.states ?? {})) {
      const jd = Number(mjd) + MJD;
      if (jd < o.validFrom || jd > o.validTo) continue;
      const st = smallBodyState(o as never, jd);
      posWorst = Math.max(posWorst, angle(st.r, hz.slice(0, 3)));
      velWorst = Math.max(velWorst, len(sub(st.v, hz.slice(3, 6))) / len(hz.slice(3, 6)));
    }
    // The map's trips with the site's states, where the body is shown: how far its speeds are from JPL's
    const g = ref.bodies[des].map;
    g.tof.forEach((tof: number, j: number) => g.dep.forEach((dep: number, i: number) => {
      const jv = g.vinf_dep[j][i], jd0 = dep + MJD, jd1 = dep + tof + MJD;
      if (jv === null || jv > 15 || jd1 < o.validFrom || jd1 > o.validTo) return;
      const f = flightBetween(jd0, jd1, planetState('earth', jd0), smallBodyState(o as never, jd1));
      if (f) tripWorst.push(Math.abs(f.vInfDepart - jv));
    }));
  }
  tripWorst = tripWorst.sort((a, b) => a - b);
  const median = tripWorst[tripWorst.length >> 1], p95 = tripWorst[Math.floor(tripWorst.length * 0.95)];
  // (The site shows a body in the years its Sun-only position stays within 1° of Horizons, checked every 5 years.)
  if (!(posWorst < 1.2) || !(velWorst < 0.05)) fail(`the site's asteroid states: ${posWorst}° and ${velWorst} of the speed from Horizons`);
  if (!(median < 0.01) || !(p95 < 0.1)) fail(`with the site's own states, launch v∞ is ${median} km/s (median) and ${p95} (95%) from JPL`);
  console.log(`  the site's asteroid states (Sun only) against Horizons where it shows them: within ${posWorst.toFixed(3)}°, velocities within ${(velWorst * 100).toFixed(2)}%;`
    + ` trips on them: launch v∞ ${median.toFixed(4)} km/s from JPL (median), ${p95.toFixed(3)} (95%), ${tripWorst.length} trips up to 15 km/s`);
  console.log(`Against JPL's mission design tool: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

/**
 * Step 7: trips to the well-known asteroids and comets. The destinations (a planet's burn on arrival into a 300 km
 * orbit, an asteroid's = v∞; arrivals only in its years), the two ways a cell picks among the whole turns (lowest
 * launch speed as JPL, or least of both burns), the map's range from the day on screen for all 36 bodies, its
 * cells against single trips, its cheapest trips against JPL's map, and the texts.
 */
export function checkSmallTrips(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nTrip planner: to asteroids and comets');
  const bodies = loadSmallBodies(JSON.parse(readFileSync('src/data/small-bodies.json', 'utf8'))).filter((b) => b.famous);
  const destOf = (b: (typeof bodies)[number]) => smallDestination(b.id, b.orbit, b.validFrom, b.validTo);
  const byDes = (des: string) => bodies.find((b) => b.pdes === des)!;
  if (bodies.length !== 36) fail(`${bodies.length} well-known bodies, not 36`);

  // Destinations: a planet as before; an asteroid's arrival burn is v∞ itself, and only in its years
  const d0 = jdOf(2026, 10, 31), a0 = jdOf(2027, 8, 20);
  const m1 = realTrip('mars', d0, a0), m2 = realTrip(planetDestination('mars'), d0, a0);
  if (!m1 || !m2 || m1.c3 !== m2.c3 || m1.total !== m2.total || m1.target !== 'mars') fail('a trip to Mars by name and as a destination differ');
  const bennu = destOf(byDes('101955'));
  const bt = realTrip(bennu, jdOf(2029, 9, 22), jdOf(2033, 4, 30), 'dv');
  if (!bt || bt.arrive !== bt.vInfArrive || Math.abs(bt.leave - hyperbolicBurn(bt.vInfDepart, planetGm('earth'), RADIUS_KM.earth + PARKING_ALT_KM)) > 1e-12 || bt.target !== bennu.id) fail(`the burns of a trip to Bennu: ${bt?.leave} + ${bt?.arrive} (v∞ ${bt?.vInfArrive})`);
  if (bt) { // its path, flown from its start as the views draw it, ends at Bennu
    const end = propagate(SUN_GM, bt.r1, bt.v1, bt.tofDays * DAY_S).r, p = bennu.state(bt.arriveJd).r;
    const off = Math.hypot(end[0] - p[0], end[1] - p[1], end[2] - p[2]);
    if (!(off < 10)) fail(`the path to Bennu misses it by ${off} km`);
  }
  const apophis = destOf(byDes('99942'));
  if (realTrip(apophis, jdOf(2027, 1, 1), apophis.to + 1) || !realTrip(apophis, jdOf(2027, 1, 1), apophis.to - 1)) fail('a trip to Apophis arriving after its last known day is not refused, or one before it is');

  // The two choices among the whole turns: by C3 it is JPL's (lowest launch speed), by Δv the least of both burns of all of them
  let cells = 0, cheaperDv = 0, worse = 0, notLeast = 0;
  for (const b of [byDes('101955'), byDes('433'), byDes('162173'), byDes('2P')]) {
    const d = destOf(b);
    for (let k = 0; k < 60; k++) {
      const dep = jdOf(2027, 1, 1) + 17 * k, arr = dep + 400 + 19 * k;
      if (arr > d.to) continue;
      const e = planetState('earth', dep), p = d.state(arr);
      const both = tripsFromStates(d, dep, arr, e, p), f = flightBetween(dep, arr, e, p);
      if (!both || !f) continue;
      cells++;
      if (both.c3.vInfDepart !== f.vInfDepart || both.c3.revs !== f.revs) fail(`${b.pdes} ${dep}: the trip by C3 is not JPL's lowest launch speed`);
      if (both.dv.total > both.c3.total + 1e-12) worse++;
      if (both.dv.total < both.c3.total - 1e-6) cheaperDv++;
      const least = Math.min(...lambertAll(SUN_GM, e.r, p.r, (arr - dep) * DAY_S).map((l) => {
        const v1 = Math.hypot(l.v1[0] - e.v[0], l.v1[1] - e.v[1], l.v1[2] - e.v[2]), v2 = Math.hypot(l.v2[0] - p.v[0], l.v2[1] - p.v[1], l.v2[2] - p.v[2]);
        return hyperbolicBurn(v1, planetGm('earth'), RADIUS_KM.earth + PARKING_ALT_KM) + v2;
      }));
      if (Math.abs(both.dv.total - least) > 1e-9) notLeast++;
    }
  }
  if (worse || notLeast || cells < 150 || cheaperDv < 10) fail(`choosing by Δv: ${worse} dearer than by C3, ${notLeast} not the least, ${cheaperDv} of ${cells} cheaper`);
  console.log(`  ${cells} trips to Bennu, Eros, Ryugu and Encke: by C3 the lowest launch speed (JPL's rule), by Δv the least of both burns of all the whole turns; ${cheaperDv} of them take other turns for it`);

  // The map's range from 18.11.2026 for all 36: launch days from that day for three years at most, 30 days and up on
  // the way, at most 110 rows; and for some of every kind the whole map: every trip on it arriving in the body's
  // years, and none missing there
  const jd = jdOf(2026, 11, 18);
  let ranges = 0, empty = 0, missing = 0, outside = 0, worstMs = 0, far = 0;
  const WHOLE = ['10', '99942', '101955', '2024 YR4', '3548', '134340', '1P', '67P'];
  const lines: string[] = [];
  for (const b of bodies) {
    const d = destOf(b);
    const r = smallPorkchopRange(d, jd);
    if (!r) { fail(`${b.pdes}: no map from 18.11.2026`); continue; }
    ranges++;
    const lastDep = r.depart0 + (r.nx - 1) * r.departStep, lastTof = r.tof0 + (r.ny - 1) * r.tofStep;
    if (r.depart0 !== jd || r.tof0 !== SMALL_TOF_MIN || r.ny > 110 || lastDep - r.depart0 > SMALL_SPAN_DAYS + 1e-9 || lastDep + r.tof0 > d.to + 1e-9
      || Math.abs(r.tofStep / r.departStep - Math.round(r.tofStep / r.departStep)) > 1e-9 || r.hohmannJd !== null) fail(`${b.pdes}: range ${JSON.stringify({ ...r, dest: undefined })}`);
    if (!(lastTof >= SMALL_TOF_MAX - r.tofStep || r.depart0 + lastTof > d.to - r.tofStep)) fail(`${b.pdes}: the map stops at ${lastTof} days on the way`);
    if (lastTof > SMALL_TOF_MAX + r.tofStep) far++;
    if (!WHOLE.includes(b.pdes)) continue;
    const t0 = performance.now();
    const map = porkchop(r);
    worstMs = Math.max(worstMs, performance.now() - t0);
    let n = 0;
    for (let j = 0; j < r.ny; j++) for (let i = 0; i < r.nx; i++) {
      const at = j * r.nx + i, arr = r.depart0 + i * r.departStep + r.tof0 + j * r.tofStep;
      const inYears = arr >= d.from && arr <= d.to;
      if (Number.isFinite(map.c3[at])) { n++; if (!inYears) outside++; } else if (inYears) missing++;
      if (Number.isFinite(map.c3[at]) !== Number.isFinite(map.dv[at])) missing++;
    }
    if (!n) empty++;
    if (['101955', '99942', '134340', '1P'].includes(b.pdes)) lines.push(`${b.jplName} ${r.nx}×${r.ny} to ${numGrouped(lastTof)} days`);
  }
  if (ranges !== 36 || empty || missing || outside || far < 10 || lines.length !== 4) fail(`maps: ${ranges} ranges, ${empty} empty, ${missing} trips missing in the years, ${outside} outside them, ${far} longer than 1,500 days`);
  console.log(`  all 36 maps from 18.11.2026: launch days for 3 years at most, at most 110 rows, ${far} of them longer than 1,500 days on the way;`
    + ` ${WHOLE.length} whole maps: every trip arriving in the body's years, none missing there (${lines.join(', ')}; the slowest ${worstMs.toFixed(0)} ms here)`);
  // Where no trip can arrive in the years: none; from the first of them on, one
  const hygiea = destOf(byDes('10'));
  if (smallPorkchopRange(hygiea, jdOf(1950, 6, 1)) || !smallPorkchopRange(hygiea, Math.round(hygiea.from - 0.5) + 0.5) || smallPorkchopRange(apophis, apophis.to - 10)) fail('a map where no trip can arrive in the body\'s years, or none where one can');

  // Cells against single trips, by both measures, and the cheapest trips: inside the map, of their type, on the
  // map's edge when they arrive on the body's last known day (Apophis)
  const rb = smallPorkchopRange(bennu, jd)!, mb = porkchop(rb);
  for (const [i, j] of [[5, 7], [37, 61], [100, 70], [120, 80]]) {
    const dep = rb.depart0 + i * rb.departStep, tof = rb.tof0 + j * rb.tofStep, at = j * rb.nx + i;
    for (const m of ['c3', 'dv'] as const) {
      const tr = realTrip(bennu, dep, dep + tof, m);
      const v = m === 'c3' ? mb.c3[at] : mb.dv[at], k = kindsOf(mb, m);
      if (!tr || Math.abs((m === 'c3' ? tr.c3 : tr.total) - v) > 1e-9 * v || tr.type !== k.type[at] || tr.revs !== k.revs[at]) fail(`Bennu cell ${i},${j} by ${m}: ${v} against ${m === 'c3' ? tr?.c3 : tr?.total}`);
    }
  }
  for (const m of ['c3', 'dv'] as const) for (const type of [1, 2] as const) {
    const c = cheapest(mb, m, type), values = m === 'c3' ? mb.c3 : mb.dv, k = kindsOf(mb, m);
    let grid = Infinity;
    for (let at = 0; at < values.length; at++) if (k.type[at] === type && !nearHalfTurn(k.angle[at]) && values[at] < grid) grid = values[at];
    const v = c && (m === 'c3' ? c.c3 : c.total);
    if (!c || c.type !== type || c.departJd < rb.depart0 || c.arriveJd > bennu.to || !(v! <= grid)) fail(`Bennu's cheapest by ${m} of type ${type}: ${v} against ${grid} on the grid`);
  }
  const bestDv = [cheapest(mb, 'dv', 1)!, cheapest(mb, 'dv', 2)!].sort((p, q) => p.total - q.total)[0];
  // (of type II: it leaves in March 2027, inside the map's launch days and times on the way, but arrives on the last known day)
  const ra = smallPorkchopRange(apophis, jd)!, ma = porkchop(ra), ca = cheapest(ma, 'dv', 2);
  if (!ca || !onEdge(ma, ca) || ca.arriveJd < apophis.to - ra.departStep) fail(`Apophis: the cheapest trip ${ca?.arriveJd} is not on its last known day, or not on the edge`);
  console.log(`  map cells = single trips by C3 and by Δv; to Bennu the cheapest by Δv ${num(bestDv.total, 2, 'en')} km/s (${bestDv.revs} whole turns, arriving at ${num(bestDv.vInfArrive, 2, 'en')} km/s);`
    + ` to Apophis it arrives on its last known day, on the edge`);

  // Against JPL's map (10 days apart, over ten years): where JPL's lowest launch speed arrives in the body's years,
  // ours on the same days (the site's own states) is within 0.03 km/s, our map round it finds one at least as low,
  // and JPL's grid days round ours give no lower one, as JPL's minimum says
  const ref = JSON.parse(readFileSync('scripts/reference/mission-design-jpl.json', 'utf8'));
  const MJD = 2400000.5, TOL = 0.03;
  const found: string[] = [];
  for (const [des, b] of Object.entries<any>(ref.bodies)) {
    const m = b.min.vinf_dep, d = destOf(byDes(des));
    const dep = m.dep + MJD, arr = dep + m.tof;
    if (arr < d.from || arr > d.to) continue;
    const same = realTrip(d, dep, arr, 'c3');
    if (!same || Math.abs(same.vInfDepart - m.value) > TOL) fail(`${des}: on JPL's cheapest days ours is ${same?.vInfDepart}, JPL's ${m.value}`);
    const map = porkchop(smallPorkchopRange(d, dep - 1.5 * 365)!);
    const c = [cheapest(map, 'c3', 1), cheapest(map, 'c3', 2)].filter((x): x is NonNullable<typeof x> => !!x).sort((p, q) => p.c3 - q.c3)[0];
    if (!c || !(c.vInfDepart <= m.value + TOL)) { fail(`${des}: our map's lowest launch speed ${c?.vInfDepart}, JPL's ${m.value}`); continue; }
    const g0 = Math.floor((c.departJd - MJD - ref.grid.mjd0) / ref.grid.step) * ref.grid.step + ref.grid.mjd0;
    const t0 = Math.floor((c.tofDays - ref.grid.tofMin) / ref.grid.step) * ref.grid.step + ref.grid.tofMin;
    for (const dd of [0, ref.grid.step]) for (const tt of [0, ref.grid.step]) {
      const g = realTrip(d, g0 + dd + MJD, g0 + dd + t0 + tt + MJD, 'c3');
      if (g && g.vInfDepart < m.value - TOL) fail(`${des}: on JPL's grid day ${g0 + dd}+${t0 + tt} ours is ${g.vInfDepart}, below JPL's minimum ${m.value}`);
    }
    found.push(`${b.object.fullname.replace(/ \(.*\)/, '')} ${num(c.vInfDepart, 3, 'en')} (JPL ${m.value})`);
  }
  if (found.length < 5) fail(`only ${found.length} of JPL's minima in the site's years`);
  console.log(`  lowest launch speed v∞ [km/s] on our maps against JPL's 10-day grid: ${found.join(', ')}; JPL's grid days round each give none lower`);
  // JPL's picked missions that arrive in the site's years, as the planner works them out (the site's states, by C3):
  // both speeds, at launch and at arrival (where the asteroid's own velocity counts)
  const dDep: number[] = [], dArr: number[] = [];
  for (const [des, b] of Object.entries<any>(ref.bodies)) {
    const d = destOf(byDes(des)), fq: string[] = b.q.fields;
    for (const r of b.q.missions) {
      const q = Object.fromEntries(fq.map((k, i) => [k, r[i]]));
      const t = realTrip(d, q.MJD0 + MJD, q.MJDf + MJD, 'c3');
      if (t) { dDep.push(Math.abs(t.vInfDepart - q.vinf_dep)); dArr.push(Math.abs(t.vInfArrive - q.vinf_arr)); }
    }
  }
  const quant = (a: number[], f: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * f)];
  if (dDep.length < 300 || !(quant(dDep, 0.5) < 0.01 && quant(dArr, 0.5) < 0.01 && quant(dDep, 0.95) < 0.1 && quant(dArr, 0.95) < 0.1)) fail(`JPL's picked missions: v∞ ${quant(dDep, 0.5)} / ${quant(dArr, 0.5)} km/s (median), ${quant(dDep, 0.95)} / ${quant(dArr, 0.95)} (95%)`);
  console.log(`  ${dDep.length} of JPL's picked missions in the site's years: v∞ at launch ${num(quant(dDep, 0.5), 4, 'en')} km/s from JPL (median), ${num(quant(dDep, 0.95), 3, 'en')} (95%); at arrival ${num(quant(dArr, 0.5), 4, 'en')} and ${num(quant(dArr, 0.95), 3, 'en')}`);

  // Groups, as in data/small-bodies.txt, and the texts
  const groups = Object.fromEntries(TARGET_GROUPS.map((g) => [g, bodies.filter((b) => targetGroup(b) === g).length]));
  if (groups.main !== 8 || groups.neo !== 10 || groups.trojan !== 2 || groups.far !== 6 || groups.comet !== 10) fail(`groups ${JSON.stringify(groups)}`);
  for (const l of LANGS) {
    const s = STRINGS[l.id].trip;
    const texts = [s.sbNoHohmann('3', numGrouped(30, l.id), numGrouped(1500, l.id)), s.sbKnown('X', '2006', '2036'), s.sbRetro('X'), s.sbFar, s.sbNoRange, s.sbJump('2025'),
      s.sbNoTrips('X'), s.sbOutsideDates('X', 'A', 'B'), s.arriveSmall('X'), s.sbFlyby, s.marksSmall, s.mapIntroSmall, s.turns(1), s.turns(3),
      s.way('52°', 1, 3, 'dv'), ...TARGET_GROUPS.map((g) => s.targetGroups[g]), s.targetGroups.planets];
    if (texts.some((x) => !x.trim() || /undefined|NaN/.test(x))) fail(`${l.id}: a text for asteroids is missing`);
    if (!texts[0].includes(numGrouped(1500, l.id)) || !texts[0].includes('3') || !texts[1].includes('2006') || !texts[1].includes('2036') || !texts[5].includes('2025')
      || !texts[7].includes('A') || !texts[7].includes('B') || !texts[2].includes('68') || !texts[2].includes('1986') || s.turns(3) === s.turns(1)) fail(`${l.id}: a text for asteroids lacks its numbers`);
    if (s.way('52°', 1, 3, 'dv') === s.way('52°', 1, 3, 'c3')) fail(`${l.id}: the path's whole turns read the same by C3 and by Δv`);
  }
  console.log(`  groups: ${Object.entries(groups).map(([g, n]) => `${g} ${n}`).join(', ')}; texts in three languages`);
  console.log(`To asteroids and comets: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}
