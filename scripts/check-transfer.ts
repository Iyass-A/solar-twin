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

import { hohmann, hyperbolicBurn, leadAngle, tripTo, windows, TARGETS, PARKING_ALT_KM, RADIUS_KM } from '../src/transfer/hohmann';
import { lambert, planetState, realTrip, type Vec } from '../src/transfer/lambert';
import { porkchopRange, porkchop, porkchopStepper, cheapest, bandEdges, mapMin, onEdge, nearHalfTurn, RIDGE_DEG } from '../src/transfer/porkchop';
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
    const all = [s.way(deg, 1), s.way(deg, 2), s.badDates, s.noTrip, s.exactTitle, s.exactIntro, s.departDate, s.arriveDate].join(' ');
    if (/undefined|NaN/.test(all) || !s.way(deg, 2).includes(deg) || s.way(deg, 1) === s.way(deg, 2)) fail(`${l.id}: "${all}"`);
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
  ];
  for (const [id, d, a] of cases) {
    const tr = realTrip(id as never, jdOf(d[0], d[1], d[2]), jdOf(a[0], a[1], a[2]));
    if (!tr) { fail(`${id}: no trip`); continue; }
    const e = planetState('earth', tr.departJd), p = planetState(tr.target, tr.arriveJd);
    const end = propagate(SUN_GM, tr.r1, tr.v1, tr.tofDays * DAY_S);
    const startOff = Math.hypot(tr.r1[0] - e.r[0], tr.r1[1] - e.r[1], tr.r1[2] - e.r[2]);
    const endOff = Math.hypot(end.r[0] - p.r[0], end.r[1] - p.r[1], end.r[2] - p.r[2]);
    worst = Math.max(worst, startOff, endOff);
  }
  if (!(worst < 10)) fail(`a trip's path misses the Earth or its target by ${worst} km`);
  console.log(`  6 trips (Mercury to Neptune): each path starts at the Earth and ends at its target within ${worst.toFixed(3)} km`);
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
