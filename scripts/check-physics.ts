// Part of npm run check (called from scripts/check.ts): the physics engine's starting state.
// src/data/state-vectors.json comes from JPL Horizons; src/physics/bodies.ts has the masses.
// Checks the masses against known ratios and against Horizons' own, the states against each other
// (a planet and its moons must add up to the system's barycentre), against Astronomy Engine and
// against the Kepler positions the site draws, and that the moons orbit their planets.

import * as Astronomy from 'astronomy-engine';
import { existsSync, readFileSync } from 'node:fs';
import { BODIES, SYSTEMS, AU_KM, SUN_GM, toAuDay } from '../src/physics/bodies';
import { createNBody, advance, energy, momenta, defaultStep, type NBody, type Order } from '../src/physics/nbody';
import { Engine } from '../src/physics/engine';
import { utcMsToTdbJd, tdbJdToUtcMs, type FromWorker, type Mode } from '../src/physics/protocol';
import { startBodies, startSystems, EPOCH_JD, type Vec } from '../src/physics/state';
import stateFile from '../src/data/state-vectors.json' with { type: 'json' };
import { PLANETS } from '../src/astro/elements';
import { heliocentricPosition } from '../src/astro/kepler';
import { centuriesSinceJ2000 } from '../src/astro/julian';

const REFERENCE = 'scripts/reference/state-vectors-horizons.json';
const DAY_S = 86400;
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angleDeg = (a: Vec, b: Vec) => Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (len(a) * len(b))))) * 180 / Math.PI;
/** GM-weighted mean of states. */
function centre(list: { gm: number; r: Vec; v: Vec }[]) {
  const m = list.reduce((s, b) => s + b.gm, 0);
  const avg = (k: 'r' | 'v') => [0, 1, 2].map((i) => list.reduce((s, b) => s + b.gm * b[k][i], 0) / m) as Vec;
  return { gm: m, r: avg('r'), v: avg('v') };
}

export function checkStartingState(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nPhysics engine: starting state from JPL Horizons');

  let bodies: ReturnType<typeof startBodies>, systems: ReturnType<typeof startSystems>;
  try { bodies = startBodies(); systems = startSystems(); } catch (err) { fail(String(err)); return false; }
  const body = (id: string) => bodies.find((b) => b.id === id)!;
  const system = (id: string) => systems.find((s) => s.id === id)!;
  if (!Number.isInteger(EPOCH_JD - 0.5)) fail(`epoch JD ${EPOCH_JD} is not at 00:00`);
  for (const b of [...bodies, ...systems]) {
    if (![...b.r, ...b.v].every(Number.isFinite)) fail(`${b.id}: missing numbers`);
  }
  const date = new Date((EPOCH_JD - 2440587.5) * DAY_S * 1000).toISOString().slice(0, 10);
  console.log(`  epoch JD ${EPOCH_JD} (${date} 00:00 TDB), ${bodies.length} bodies, ${systems.length} system barycentres`);

  // 1. Masses: a system weighs as much as its members, and known mass ratios come out
  for (const s of SYSTEMS) {
    const members = BODIES.filter((b) => b.system === s.id);
    const sum = members.reduce((t, b) => t + b.gm, 0);
    if (members.length && Math.abs(sum - s.gm) > 1e-12 * s.gm) fail(`${s.id}: members weigh ${sum}, system ${s.gm}`);
  }
  // Known ratios (IAU 2009): Sun/Jupiter system 1047.348644 ± 0.000017, Earth/Moon 81.30056
  const sunJupiter = SUN_GM / system('jupiter').gm, earthMoon = body('earth').gm / body('moon').gm;
  if (Math.abs(sunJupiter - 1047.348644) > 2 * 0.000017 || Math.abs(earthMoon - 81.30056) > 1e-5) fail(`mass ratios ${sunJupiter}, ${earthMoon}`);
  console.log(`  masses: Sun/Jupiter system ${sunJupiter.toFixed(6)}, Earth/Moon ${earthMoon.toFixed(8)}; each system = its planet + moons`);

  // 2. Horizons' own GM for each body (in the reference file). A planet here also carries its
  //    smaller moons, so it may weigh a little more than Horizons' planet alone (Uranus: 1e-4).
  if (!existsSync(REFERENCE)) fail(`${REFERENCE} is missing`);
  const ref = existsSync(REFERENCE) ? JSON.parse(readFileSync(REFERENCE, 'utf8')) : { targets: {} };
  let gmWorst = { rel: 0, id: '' }, gmCompared = 0;
  for (const b of BODIES) {
    const t = ref.targets[b.naif];
    if (!t || t.gm === null || !/km\^3\/s\^2/.test(t.gmLine ?? '') || /10\^/.test(t.gmLine)) continue;
    gmCompared++;
    const rel = (b.gm - t.gm) / b.gm;
    const allowed = b.kind === 'planet' ? [-1e-6, 2e-4] : [-1e-6, 1e-6];
    if (rel < allowed[0] || rel > allowed[1]) fail(`${b.id}: GM ${b.gm} here, ${t.gm} in Horizons`);
    if (Math.abs(rel) > Math.abs(gmWorst.rel)) gmWorst = { rel, id: b.id };
  }
  if (gmCompared < 10) fail(`only ${gmCompared} GM values from Horizons to compare`);
  console.log(`  GM against Horizons for ${gmCompared} bodies: largest difference ${gmWorst.rel.toExponential(1)} (${gmWorst.id})`);

  // 3. As Horizons has them (before src/physics/state.ts moves each planet with its moons onto
  //    its system's barycentre). Mercury and Venus have no moons: body and barycentre are one point.
  const raw = (naif: number) => [...stateFile.bodies, ...stateFile.systems].find((x) => x.naif === naif)! as { r: Vec; v: Vec };
  for (const id of ['mercury', 'venus']) {
    const b = raw(BODIES.find((x) => x.id === id)!.naif), s = raw(SYSTEMS.find((x) => x.id === id)!.naif);
    if (len(sub(b.r, s.r)) * AU_KM > 0.001 || len(sub(b.v, s.v)) > 1e-12) fail(`${id}: body and barycentre differ`);
  }
  // 4. A planet and its moons (with these masses) must add up to the system's barycentre. In
  //    Horizons they miss it by up to some thousand km: Uranus and Neptune (their positions come
  //    from their moons' ephemerides), and the smaller moons not listed. That must stay well inside
  //    the planet (Uranus' radius: 25,559 km). After the move, they must meet exactly.
  const moved: string[] = [];
  for (const s of SYSTEMS) {
    const members = BODIES.filter((b) => b.system === s.id);
    if (!members.length) continue;
    const before = centre(members.map((b) => ({ gm: b.gm, ...raw(b.naif) })));
    const km = len(sub(before.r, raw(s.naif).r)) * AU_KM, ms = len(sub(before.v, raw(s.naif).v)) * AU_KM / DAY_S * 1000;
    if (km > 2000 || ms > 1) fail(`${s.id}: planet and moons are ${km.toFixed(1)} km, ${ms.toFixed(3)} m/s off its barycentre in Horizons`);
    const after = centre(bodies.filter((b) => b.system === s.id));
    if (len(sub(after.r, system(s.id).r)) * AU_KM > 0.001 || len(sub(after.v, system(s.id).v)) * AU_KM > 1e-9) fail(`${s.id}: not on its barycentre after the move`);
    const moons = members.filter((b) => b.kind === 'moon');
    for (const m of moons) {
      const p = members.find((b) => b.kind === 'planet')!;
      const rel = (x: { r: Vec }, y: { r: Vec }) => sub(x.r, y.r);
      if (len(sub(rel(body(m.id), body(p.id)), rel(raw(m.naif), raw(p.naif)))) * AU_KM > 1e-6) fail(`${m.id}: its orbit changed in the move`);
    }
    moved.push(`${s.id} ${km.toFixed(km < 10 ? 1 : 0)}`);
  }
  console.log(`  Horizons' planet + moons off DE441's barycentres [km]: ${moved.join(', ')}; moved onto them, moons' orbits kept`);

  // 5. Everything together sits at the solar-system barycentre and does not move. JPL: the
  //    Kuiper-belt masses added in DE440/441 move its barycentre by about 100 km (they move slowly,
  //    so it barely changes in a year); and a fixed origin changes nothing in the motion.
  const all = centre([body('sun'), ...systems]);
  const ssbKm = len(all.r) * AU_KM, ssbMs = len(all.v) * AU_KM / DAY_S * 1000;
  if (ssbKm > 1000 || ssbMs > 0.01) fail(`centre of mass ${ssbKm.toFixed(1)} km, ${ssbMs.toFixed(4)} m/s from the barycentre`);
  console.log(`  centre of mass of Sun + systems: ${ssbKm.toFixed(1)} km and ${ssbMs.toFixed(4)} m/s from the solar-system barycentre`);

  // 6. Astronomy Engine (about 1 arcminute): the same bodies in the same place
  const time = Astronomy.AstroTime.FromTerrestrialTime(EPOCH_JD - 2451545.0);
  const toEcl = Astronomy.Rotation_EQJ_ECL();
  const ae = (s: Astronomy.StateVector) => {
    const e = Astronomy.RotateState(toEcl, s);
    return { r: [e.x, e.y, e.z] as Vec, v: [e.vx, e.vy, e.vz] as Vec };
  };
  const AE_BODY: Record<string, Astronomy.Body> = {
    mercury: Astronomy.Body.Mercury, venus: Astronomy.Body.Venus, earth: Astronomy.Body.Earth, mars: Astronomy.Body.Mars,
    jupiter: Astronomy.Body.Jupiter, saturn: Astronomy.Body.Saturn, uranus: Astronomy.Body.Uranus, neptune: Astronomy.Body.Neptune,
  };
  const sunAe = ae(Astronomy.BaryState(Astronomy.Body.Sun, time));
  const sunKm = len(sub(sunAe.r, body('sun').r)) * AU_KM;
  if (sunKm > 1000) fail(`Sun ${sunKm.toFixed(0)} km from Astronomy Engine's`);
  let aeWorst = { deg: 0, dv: 0, id: '' };
  const aeCheck = (id: string, ours: { r: Vec; v: Vec }, theirs: { r: Vec; v: Vec }) => {
    const h = sub(ours.r, body('sun').r), hv = sub(ours.v, body('sun').v);
    const th = sub(theirs.r, sunAe.r), tv = sub(theirs.v, sunAe.v);
    const deg = angleDeg(h, th), dr = Math.abs(len(h) - len(th)) / len(th), dv = len(sub(hv, tv)) / len(tv);
    if (deg > 0.02 || dr > 2e-4 || dv > 2e-3) fail(`${id}: ${deg.toFixed(4)}°, distance ${dr.toExponential(1)}, velocity ${dv.toExponential(1)} off Astronomy Engine`);
    if (deg > aeWorst.deg) aeWorst = { deg, dv, id };
  };
  for (const [id, b] of Object.entries(AE_BODY)) aeCheck(id, body(id), ae(Astronomy.BaryState(b, time)));
  aeCheck('pluto system', system('pluto'), ae(Astronomy.BaryState(Astronomy.Body.Pluto, time)));
  console.log(`  Sun and planets against Astronomy Engine: largest ${aeWorst.deg.toFixed(4)}° (${aeWorst.id}), Sun ${sunKm.toFixed(0)} km`);

  // Moons around their planets: the Moon, and Jupiter's four (Astronomy Engine has these)
  const moonCheck = (id: string, planet: string, theirs: { r: Vec }, limitKm: number) => {
    const km = len(sub(sub(body(id).r, body(planet).r), theirs.r)) * AU_KM;
    if (km > limitKm) fail(`${id}: ${km.toFixed(0)} km off Astronomy Engine`);
    return km;
  };
  const moonKm = moonCheck('moon', 'earth', ae(Astronomy.GeoMoonState(time)), 50);
  const jm = Astronomy.JupiterMoons(time);
  const galKm = Math.max(...(['io', 'europa', 'ganymede', 'callisto'] as const).map((id) => moonCheck(id, 'jupiter', ae(jm[id]), 1000)));
  console.log(`  Moon ${moonKm.toFixed(1)} km and Jupiter's moons ${galKm.toFixed(0)} km at most from Astronomy Engine`);

  // 7. Every moon is bound to its planet, at its known distance, going the known way round:
  //    all along with their planet's orbit, except Triton, which goes the other way.
  const KNOWN_KM: Record<string, [number, number]> = { // semi-major axis × (1 ∓ e), with some room
    moon: [356_000, 407_000], io: [419_000, 425_000], europa: [662_000, 680_000], ganymede: [1_066_000, 1_075_000],
    callisto: [1_865_000, 1_901_000], titan: [1_186_000, 1_258_000], triton: [354_000, 356_000],
  };
  for (const m of bodies.filter((b) => b.kind === 'moon')) {
    const p = body(m.system!), sys = system(m.system!);
    const r = sub(m.r, p.r), v = sub(m.v, p.v);
    const km = len(r) * AU_KM;
    const energy = dot(v, v) / 2 - (p.gmAu + m.gmAu) / len(r);
    const sense = dot(cross(r, v), cross(sub(sys.r, body('sun').r), sub(sys.v, body('sun').v)));
    const [lo, hi] = KNOWN_KM[m.id];
    if (km < lo || km > hi) fail(`${m.id}: ${km.toFixed(0)} km from its planet, expected ${lo} to ${hi}`);
    if (energy >= 0) fail(`${m.id} is not bound to its planet`);
    if ((sense < 0) !== (m.id === 'triton')) fail(`${m.id} goes round the wrong way`);
  }
  console.log('  moons at their known distances, bound, the known way round (Triton backwards)');

  // 8. The site's Kepler planets start where the engine's systems are (for comparing them side by side)
  const T = centuriesSinceJ2000(EPOCH_JD);
  let kepWorst = { deg: 0, id: '' };
  for (const p of PLANETS) {
    const k = heliocentricPosition(p, T);
    const deg = angleDeg([k.x, k.y, k.z], sub(system(p.id).r, body('sun').r));
    if (deg > 0.25) fail(`${p.id}: Kepler position ${deg.toFixed(3)}° from Horizons`);
    if (deg > kepWorst.deg) kepWorst = { deg, id: p.id };
  }
  console.log(`  site's Kepler planets within ${kepWorst.deg.toFixed(3)}° of Horizons (${kepWorst.id})`);

  // 9. Reference positions for a year after (for step 4): every body, every 5 days, starting at
  //    Horizons' starting state
  const rows = Math.floor(365 / ref.stepDays) + 1;
  for (const b of [...bodies, ...systems]) {
    const t = ref.targets[b.naif];
    const named = b.naif < 10 ? /Barycenter/.test(t?.name) : String(t?.name).includes(`(${b.naif})`);
    if (!t || !named || t.pos?.length !== rows) { fail(`reference for ${b.id} (${b.naif})`); continue; }
    if (len(sub(t.pos[0], raw(b.naif).r)) > 1e-11) fail(`reference for ${b.id} does not start at the starting state`);
  }
  if (ref.epochJd !== EPOCH_JD || ref.stepDays !== 5) fail('reference epoch or step');
  console.log(`  reference: ${Object.keys(ref.targets).length} positions every ${ref.stepDays} days for a year`);

  console.log(`Physics engine starting state: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

// ---------------------------------------------------------------------------------------------
// The integrator (src/physics/nbody.ts): its order, that it runs backwards to where it started,
// what it keeps (momentum, angular momentum, energy), the bulges, and a year against Horizons.
export function checkIntegrator(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nPhysics engine: integrator');
  const gmSun = toAuDay(SUN_GM);
  // Angle between two directions, precise also when they are very close
  const sep = (a: Vec, b: Vec) => Math.atan2(len(cross(a, b)), dot(a, b)) * 180 / Math.PI;
  const at = (s: NBody, i: number): Vec => [s.r[3 * i], s.r[3 * i + 1], s.r[3 * i + 2]];

  // 1. Order: a test body on an orbit of eccentricity 0.5 around a fixed Sun, 10 orbits. Halving the
  //    step must cut the error by 4 (leapfrog, 2nd order) or by 16 (Yoshida, 4th order).
  const a = 1, e = 0.5, P = 2 * Math.PI * Math.sqrt(a ** 3 / gmSun);
  const kepler = (stepsPerOrbit: number, order: Order) => {
    const rp = a * (1 - e), vp = Math.sqrt(gmSun * (1 + e) / rp);
    const s = createNBody([{ gmAu: gmSun, r: [0, 0, 0], v: [0, 0, 0] }, { gmAu: 0, r: [rp, 0, 0], v: [0, vp, 0] }], 0);
    advance(s, 10 * P, P / stepsPerOrbit, order);
    return len(sub(at(s, 1), [rp, 0, 0]));
  };
  const orders: string[] = [];
  for (const [order, steps, lo, hi] of [[2, 400, 3.5, 4.5], [4, 200, 13, 19]] as [Order, number, number, number][]) {
    const e1 = kepler(steps, order), e2 = kepler(2 * steps, order);
    const ratio = e1 / e2;
    if (!(ratio > lo && ratio < hi)) fail(`order ${order}: halving the step cuts the error by ${ratio.toFixed(2)}`);
    orders.push(`order ${order}: ×${ratio.toFixed(1)}`);
  }
  console.log(`  Kepler orbit (e = 0.5), halving the step cuts the error: ${orders.join(', ')}`);

  // 2. Backwards: 30 days forwards and back again returns to the start (rounding only; with relativity,
  //    whose last half kick is solved for the new velocity so the step stays the same both ways)
  // As the site runs them: with relativity near the Sun
  const sys = (relativity = true) => createNBody([body('sun'), ...startSystems()], EPOCH_JD, { relativity });
  const bodiesNow = () => createNBody(startBodies(), EPOCH_JD, { relativity: true });
  const body = (id: string) => startBodies().find((b) => b.id === id)!;
  {
    const s = bodiesNow(), r0 = s.r.slice(), h = defaultStep(s);
    advance(s, EPOCH_JD + 30, h, 4); advance(s, EPOCH_JD, h, 4);
    let worst = 0;
    for (let k = 0; k < r0.length; k++) worst = Math.max(worst, Math.abs(s.r[k] - r0[k]));
    if (worst * AU_KM > 0.01) fail(`30 days forwards and back: ${(worst * AU_KM * 1000).toFixed(1)} m off the start`);
    console.log(`  30 days forwards and back (with moons): back to the start within ${(worst * AU_KM * 1000).toFixed(2)} m`);
  }

  // 3. A year as systems, and as bodies with moons and bulges, against Horizons every 5 days.
  //    Kept: momentum (exactly), angular momentum (without bulges; relativity makes it wobble by
  //    some 10^-11), energy (within its small wobble).
  const ref = JSON.parse(readFileSync(REFERENCE, 'utf8'));
  const refAt = (naif: number, k: number) => ref.targets[naif].pos[k] as Vec;
  type Row = { id: string; deg: number; km: number };
  const run = (label: string, s: NBody, list: { id: string; naif: number; kind?: string; system?: string; gmAu: number }[], years: number) => {
    const h = defaultStep(s), e0 = energy(s), m0 = momenta(s);
    const worst = new Map<string, Row>();
    let eWorst = 0;
    const t0 = performance.now();
    for (let k = 1; k < ref.targets[10].pos.length; k++) {
      advance(s, EPOCH_JD + k * ref.stepDays, h, 4);
      eWorst = Math.max(eWorst, Math.abs(energy(s) / e0 - 1));
      const sun = at(s, 0), sunRef = refAt(10, k);
      list.forEach((b, i) => {
        if (b.id === 'sun') return;
        let ours: Vec, theirs: Vec;
        if (b.kind === 'moon') {
          const p = list.findIndex((x) => x.kind === 'planet' && x.system === b.system);
          ours = sub(at(s, i), at(s, p)); theirs = sub(refAt(b.naif, k), refAt(list[p].naif, k));
        } else {
          // a planet with moons is compared as its system: the centre of mass of planet and moons
          const members = list.map((x, j) => [x, j] as const).filter(([x]) => (b.system ? x.system === b.system : x === b));
          const c = centre(members.map(([x, j]) => ({ gm: x.gmAu, r: at(s, j), v: [0, 0, 0] as Vec })));
          const naif = b.system ? SYSTEMS.find((x) => x.id === b.system)!.naif : b.naif;
          ours = sub(c.r, sun); theirs = sub(refAt(naif, k), sunRef);
        }
        const row = { id: b.id, deg: sep(ours, theirs), km: len(sub(ours, theirs)) * AU_KM };
        if (row.deg > (worst.get(b.id)?.deg ?? -1)) worst.set(b.id, row);
      });
    }
    const ms = performance.now() - t0;
    const m1 = momenta(s);
    const pRel = len(sub(m1.p as Vec, m0.p as Vec)) / Math.max(...list.map((b, i) => b.gmAu * Math.hypot(s.v[3 * i], s.v[3 * i + 1], s.v[3 * i + 2])));
    const lRel = len(sub(m1.L as Vec, m0.L as Vec)) / len(m0.L as Vec);
    console.log(`  ${label}: step ${h.toFixed(4)} day, a year in ${ms.toFixed(0)} ms, energy within ${eWorst.toExponential(1)}, momentum ${pRel.toExponential(1)}, angular momentum ${lRel.toExponential(1)}`);
    return { worst: [...worst.values()], eWorst, pRel, lRel, h, years };
  };

  const s1 = sys(), list1 = [body('sun'), ...startSystems()];
  const r1 = run('planets as systems', s1, list1, 1);
  if (r1.eWorst > 1e-9 || r1.pRel > 1e-12 || r1.lRel > 1e-9) fail(`systems: energy ${r1.eWorst}, momentum ${r1.pRel} or angular momentum ${r1.lRel} not kept`);
  for (const w of r1.worst) if (w.deg > 0.01) fail(`systems: ${w.id} ${w.deg.toFixed(4)}° from Horizons after a year`);
  const top = (rows: Row[], n: number) => [...rows].sort((x, y) => y.deg - x.deg).slice(0, n)
    .map((w) => `${w.id} ${w.deg < 0.001 ? w.deg.toExponential(0) : w.deg.toFixed(3)}° (${w.km < 10 ? w.km.toFixed(1) : w.km.toFixed(0)} km)`).join(', ');
  console.log(`    largest after a year: ${top(r1.worst, 3)}`);

  const s2 = bodiesNow(), list2 = startBodies();
  const r2 = run('with moons and bulges', s2, list2, 1);
  if (r2.eWorst > 1e-9 || r2.pRel > 1e-12) fail(`bodies: energy ${r2.eWorst} or momentum ${r2.pRel} not kept`);
  const planets2 = r2.worst.filter((w) => list2.find((b) => b.id === w.id)!.kind !== 'moon');
  const moons2 = r2.worst.filter((w) => list2.find((b) => b.id === w.id)!.kind === 'moon');
  for (const w of planets2) if (w.deg > 0.01) fail(`bodies: ${w.id} ${w.deg.toFixed(4)}° from Horizons after a year`);
  // Moons: the angle is around their planet. What is left: the bulges' finer terms (J4) and the
  // smaller moons not listed (counted inside the planet).
  for (const w of moons2) if (w.deg > 0.5) fail(`bodies: ${w.id} ${w.deg.toFixed(3)}° round its planet from Horizons after a year`);
  console.log(`    planets: ${top(planets2, 2)}; moons round their planet: ${top(moons2, 7)}`);

  // 4. The bulges are needed, and point the right way: without them Io is tens of degrees off,
  //    and each moon orbits near its planet's equator (Triton backwards, 157° from it)
  {
    const s = createNBody(startBodies().map(({ bulge: _drop, ...b }) => b), EPOCH_JD);
    const io = list2.findIndex((b) => b.id === 'io'), jup = list2.findIndex((b) => b.id === 'jupiter');
    advance(s, EPOCH_JD + 365, defaultStep(s), 4);
    const k = 73, deg = sep(sub(at(s, io), at(s, jup)), sub(refAt(501, k), refAt(599, k)));
    if (deg < 5) fail(`without bulges Io is only ${deg.toFixed(2)}° off: the bulge test says nothing`);
    const planes: string[] = [];
    for (const m of list2.filter((b) => b.kind === 'moon')) {
      const p = list2.find((b) => b.kind === 'planet' && b.system === m.system)!;
      if (!p.bulge) continue;
      const tilt = sep(cross(sub(m.r, p.r), sub(m.v, p.v)), p.bulge.pole);
      const okTilt = m.id === 'triton' ? tilt > 155 && tilt < 160 : tilt < 1;
      if (!okTilt) fail(`${m.id}: orbit ${tilt.toFixed(2)}° from its planet's equator`);
      planes.push(`${m.id} ${tilt.toFixed(2)}°`);
    }
    console.log(`  bulges: without them Io is ${deg.toFixed(0)}° off after a year; orbits to the planet's equator: ${planes.join(', ')}`);
  }

  // 5. A century as systems, Newton only: the energy error stays bounded instead of drifting
  {
    const s = sys(false), e0 = energy(s), h = defaultStep(s);
    let worst = 0;
    const t0 = performance.now();
    for (let y = 1; y <= 100; y++) { advance(s, EPOCH_JD + 365.25 * y, h, 4); worst = Math.max(worst, Math.abs(energy(s) / e0 - 1)); }
    if (worst > 1e-9) fail(`a century: energy off by ${worst.toExponential(1)}`);
    console.log(`  a century as systems (Newton only) in ${((performance.now() - t0) / 1000).toFixed(1)} s: energy within ${worst.toExponential(1)}`);
  }

  // 6. Relativity: Mercury's perihelion turns 42.98" a century more than with Newton alone
  //    (the known value; here on a Sun-and-Mercury orbit, same steps both ways)
  {
    const aM = 0.387098, eM = 0.20563, rp = aM * (1 - eM), vp = Math.sqrt(gmSun * (1 + eM) / rp);
    const turn = (relativity: boolean) => {
      const s = createNBody([{ gmAu: gmSun, r: [0, 0, 0], v: [0, 0, 0] }, { gmAu: 0, r: [rp, 0, 0], v: [0, vp, 0] }], 0, { relativity });
      advance(s, 36525, 0.08, 4);
      const r = at(s, 1), v: Vec = [s.v[3], s.v[4], s.v[5]], d = len(r), c = dot(v, v) - gmSun / d, rv = dot(r, v);
      return Math.atan2(c * r[1] - rv * v[1], c * r[0] - rv * v[0]) * 180 / Math.PI * 3600;
    };
    const extra = turn(true) - turn(false);
    if (Math.abs(extra - 42.98) > 0.5) fail(`relativity turns Mercury's perihelion by ${extra.toFixed(2)}" a century, not 42.98"`);
    console.log(`  relativity turns Mercury's perihelion by ${extra.toFixed(2)}" a century (known: 42.98")`);
  }

  console.log(`Physics engine integrator: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

// ---------------------------------------------------------------------------------------------
// The worker's engine (src/physics/engine.ts), run here as the worker runs it: the same numbers as
// stepping directly, a newer time replacing an older one mid-run, branches, and refusals.
export async function checkEngine(): Promise<boolean> {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nPhysics engine: worker');
  const inbox: FromWorker[] = [];
  let wake: (() => void) | null = null;
  const engine = new Engine((m) => { inbox.push(m); wake?.(); }, (fn) => setImmediate(fn));
  /** Waits for the next message that matches, up to 20 s. */
  const next = <T extends FromWorker['type']>(type: T, sim?: string): Promise<Extract<FromWorker, { type: T }>> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => { wake = null; reject(new Error(`no "${type}" within 20 s`)); }, 20_000);
      const look = () => {
        const i = inbox.findIndex((m) => m.type === type && (sim === undefined || ('sim' in m && m.sim === sim)));
        if (i >= 0) { clearTimeout(timer); wake = null; resolve(inbox.splice(i, 1)[0] as Extract<FromWorker, { type: T }>); }
      };
      wake = look; look();
    });
  const direct = (mode: Mode, jd: number) => {
    const list = mode === 'systems' ? [startBodies()[0], ...startSystems()] : startBodies();
    const s = createNBody(list, EPOCH_JD, { relativity: true });
    advance(s, jd, defaultStep(s), 4);
    return s.r;
  };
  const maxDiffKm = (a: Float64Array, b: Float64Array) => { let m = 0; for (let k = 0; k < a.length; k++) m = Math.max(m, Math.abs(a[k] - b[k])); return m * AU_KM; };

  try {
    // 1. A year as systems, and 30 days with moons: the same as stepping directly
    engine.handle({ type: 'start', sim: 'real', mode: 'systems' });
    const ready = await next('ready', 'real');
    if (ready.ids.length !== 10 || ready.ids[0] !== 'sun' || ready.jd !== EPOCH_JD || !ready.relativity) fail(`ready: ${ready.ids.join(',')} at ${ready.jd}`);
    engine.handle({ type: 'goto', sim: 'real', jd: EPOCH_JD + 365 });
    const year = await next('state', 'real');
    const dYear = maxDiffKm(year.r, direct('systems', EPOCH_JD + 365));
    if (year.jd !== EPOCH_JD + 365 || dYear !== 0 || Math.abs(year.energyError) > 1e-9) fail(`a year: ${dYear} km from stepping directly, energy ${year.energyError}`);
    engine.handle({ type: 'start', sim: 'moons', mode: 'bodies' });
    const readyM = await next('ready', 'moons');
    engine.handle({ type: 'goto', sim: 'moons', jd: EPOCH_JD + 30 });
    const month = await next('state', 'moons');
    const dMonth = maxDiffKm(month.r, direct('bodies', EPOCH_JD + 30));
    if (readyM.ids.length !== 16 || dMonth !== 0) fail(`with moons: ${readyM.ids.length} bodies, ${dMonth} km from stepping directly`);
    console.log(`  a year as systems in ${year.ms.toFixed(0)} ms and 30 days with moons in ${month.ms.toFixed(0)} ms, exactly as stepping directly`);

    // 2. A newer time replaces an older one: 300 years asked, then 2 years once it is running.
    //    Only the 2 years are reported. It ran forwards and then back in other steps, so it differs a
    //    little from stepping directly: far less than the steps' own error (Mercury: some 1,000 km a year).
    engine.handle({ type: 'goto', sim: 'real', jd: EPOCH_JD + 300 * 365.25 });
    const prog = await next('progress', 'real');
    engine.handle({ type: 'goto', sim: 'real', jd: EPOCH_JD + 730 });
    const two = await next('state', 'real');
    const dTwo = maxDiffKm(two.r, direct('systems', EPOCH_JD + 730));
    if (two.jd !== EPOCH_JD + 730 || dTwo > 100) fail(`replaced run: at JD ${two.jd}, ${dTwo} km from stepping directly`);
    if (inbox.some((m) => m.type === 'state')) fail('the replaced run reported a state');
    console.log(`  300 years asked, replaced by 2 years after ${((prog.jd - EPOCH_JD) / 365.25).toFixed(1)} years: reports only the 2 years, ${(dTwo * 1000).toFixed(1)} m from stepping directly`);

    // 3. A branch is a copy at the same time, then runs on its own: moving it leaves its sim as it was
    engine.handle({ type: 'branch', sim: 'what-if', from: 'real' });
    const readyB = await next('ready', 'what-if');
    engine.handle({ type: 'goto', sim: 'what-if', jd: EPOCH_JD + 1000 });
    const b = await next('state', 'what-if');
    engine.handle({ type: 'goto', sim: 'real', jd: EPOCH_JD + 730 });
    const still = await next('state', 'real');
    engine.handle({ type: 'goto', sim: 'real', jd: EPOCH_JD + 1000 });
    const r = await next('state', 'real');
    if (readyB.jd !== EPOCH_JD + 730 || maxDiffKm(still.r, two.r) !== 0 || maxDiffKm(b.r, r.r) !== 0) fail('a branch is not a separate copy');
    console.log('  a branch starts as a copy and runs on its own: OK');

    // 4. Refusals: unknown sim, a name twice, not a time, a dropped sim
    engine.handle({ type: 'goto', sim: 'nobody', jd: EPOCH_JD });
    engine.handle({ type: 'start', sim: 'real', mode: 'systems' });
    engine.handle({ type: 'goto', sim: 'real', jd: Number.NaN });
    engine.handle({ type: 'drop', sim: 'what-if' });
    engine.handle({ type: 'goto', sim: 'what-if', jd: EPOCH_JD });
    const errors = [];
    for (let k = 0; k < 4; k++) errors.push((await next('error')).message);
    if (!/no sim "nobody"/.test(errors[0]) || !/exists already/.test(errors[1]) || !/not a time/.test(errors[2]) || !/no sim "what-if"/.test(errors[3])) fail(`refusals: ${errors.join(' | ')}`);
    console.log('  refuses an unknown sim, a name twice, a time that is not a number, and a dropped sim');
  } catch (err) {
    fail(String(err));
  }
  // Conversions between the site's UTC time and the engine's TDB
  const ms = Date.UTC(2026, 10, 15);
  if (Math.abs(tdbJdToUtcMs(utcMsToTdbJd(ms)) - ms) > 0.1 || Math.abs((utcMsToTdbJd(ms) - 2461359.5) * 86400 - 69.184) > 1e-3) fail('UTC/TDB conversion');
  console.log(`Physics engine worker: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

// ---------------------------------------------------------------------------------------------
// The whole time bar (step 4): from the starting state back to 1800 and on to 2050, as systems
// with relativity, the default step, against Astronomy Engine (about 1 arcminute) every 30 days.
// "Good enough to show": every planet within 0.05°, a quarter of what the site's Kepler planets
// may be off (0.20°) and under a pixel in every view at normal zoom.
export const DISPLAY_LIMIT_DEG = 0.05;
export function checkLongRange(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  console.log('\nPhysics engine: the whole time bar (1800-2050)');
  const toEcl = Astronomy.Rotation_EQJ_ECL();
  const AE: Record<string, Astronomy.Body> = {
    mercury: Astronomy.Body.Mercury, venus: Astronomy.Body.Venus, earth: Astronomy.Body.EMB, mars: Astronomy.Body.Mars,
    jupiter: Astronomy.Body.Jupiter, saturn: Astronomy.Body.Saturn, uranus: Astronomy.Body.Uranus, neptune: Astronomy.Body.Neptune,
    pluto: Astronomy.Body.Pluto,
  };
  const sep = (a: Vec, b: Vec) => Math.atan2(len(cross(a, b)), dot(a, b)) * 180 / Math.PI;
  const list = [startBodies()[0], ...startSystems()];
  const ends: [string, number][] = [['back to 1800', 2378496.5], ['on to 2050', 2470171.5]]; // 1800-01-01, 2051-01-01
  for (const [label, end] of ends) {
    const s = createNBody(list, EPOCH_JD, { relativity: true });
    const h = defaultStep(s), e0 = energy(s), dir = Math.sign(end - EPOCH_JD);
    const worst = new Map<string, { deg: number; year: number; kepler: number }>();
    let eWorst = 0;
    const t0 = performance.now();
    for (let jd = EPOCH_JD + 30 * dir; dir > 0 ? jd <= end : jd >= end; jd += 30 * dir) {
      advance(s, jd, h, 4);
      eWorst = Math.max(eWorst, Math.abs(energy(s) / e0 - 1));
      const time = Astronomy.AstroTime.FromTerrestrialTime(jd - 2451545);
      list.forEach((b, i) => {
        if (b.id === 'sun') return;
        const ours: Vec = [s.r[3 * i] - s.r[0], s.r[3 * i + 1] - s.r[1], s.r[3 * i + 2] - s.r[2]];
        const v = Astronomy.RotateVector(toEcl, Astronomy.HelioVector(AE[b.id], time));
        const deg = sep(ours, [v.x, v.y, v.z]);
        const p = PLANETS.find((x) => x.id === b.id);
        const k = p && heliocentricPosition(p, centuriesSinceJ2000(jd));
        const w = worst.get(b.id) ?? { deg: 0, year: 0, kepler: 0 };
        if (deg > w.deg) { w.deg = deg; w.year = Math.round((jd - 2451545) / 365.25 + 2000); }
        if (k) w.kepler = Math.max(w.kepler, sep(ours, [k.x, k.y, k.z]));
        worst.set(b.id, w);
      });
    }
    const ms = performance.now() - t0;
    for (const [id, w] of worst) if (w.deg > DISPLAY_LIMIT_DEG) fail(`${label}: ${id} ${w.deg.toFixed(3)}° from Astronomy Engine in ${w.year}`);
    if (eWorst > 1e-8) fail(`${label}: energy off by ${eWorst.toExponential(1)}`);
    const rows = [...worst.entries()].sort((a, b) => b[1].deg - a[1].deg);
    console.log(`  ${label} in ${(ms / 1000).toFixed(1)} s (step ${h.toFixed(3)} day), energy within ${eWorst.toExponential(1)}: ` +
      rows.slice(0, 3).map(([id, w]) => `${id} ${w.deg.toFixed(3)}° (${w.year})`).join(', ') + `, the rest less`);
    console.log(`    the site's Kepler planets are up to ${Math.max(...rows.map(([, w]) => w.kepler)).toFixed(2)}° from it (${rows.reduce((a, b) => (b[1].kepler > a[1].kepler ? b : a))[0]})`);
  }
  console.log(`Physics engine over the whole time bar: ${ok ? 'OK' : 'FAIL'} (limit ${DISPLAY_LIMIT_DEG}°)`);
  return ok;
}
