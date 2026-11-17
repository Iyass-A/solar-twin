// Part of npm run check (called from scripts/check.ts): the trip planner (phase 6, src/transfer/).
// Step 1, the Hohmann transfer: against Curtis' worked example (Earth to Mars), against the universal-variable
// propagator of src/physics/orbit.ts (an independent way to fly the half ellipse), against NASA's synodic
// periods, and the launch-window search over the whole time bar.
// Step 2, Lambert's problem: against worked examples in Curtis and Vallado, against the propagator (orbits
// flown first, then found again from their two ends), and against NASA's Mars mission design handbook for 2026.
// Step 3, the porkchop map: the cheapest launch energy of every Mars opportunity from 2026 to 2045 against the
// same handbook's table 1, and the map's own bookkeeping.

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
