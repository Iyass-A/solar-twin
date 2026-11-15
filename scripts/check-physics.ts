// Part of npm run check (called from scripts/check.ts): the physics engine's starting state.
// src/data/state-vectors.json comes from JPL Horizons; src/physics/bodies.ts has the masses.
// Checks the masses against known ratios and against Horizons' own, the states against each other
// (a planet and its moons must add up to the system's barycentre), against Astronomy Engine and
// against the Kepler positions the site draws, and that the moons orbit their planets.

import * as Astronomy from 'astronomy-engine';
import { existsSync, readFileSync } from 'node:fs';
import { BODIES, SYSTEMS, AU_KM, SUN_GM } from '../src/physics/bodies';
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
