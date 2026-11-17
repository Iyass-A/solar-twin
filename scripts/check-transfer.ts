// Part of npm run check (called from scripts/check.ts): the trip planner (phase 6, src/transfer/).
// Step 1, the Hohmann transfer: against Curtis' worked example (Earth to Mars), against the universal-variable
// propagator of src/physics/orbit.ts (an independent way to fly the half ellipse), against NASA's synodic
// periods, and the launch-window search over the whole time bar.

import { hohmann, hyperbolicBurn, leadAngle, tripTo, windows, TARGETS, PARKING_ALT_KM, RADIUS_KM } from '../src/transfer/hohmann';
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
