// Sky events (phase 8, step 1): what happens in the sky in a stretch of time, worked out with Astronomy Engine.
// Positions are geocentric and apparent (light time and aberration), the way almanacs give them.
// No DOM here, so `npm run check` tests exactly what the page and the video generator use.
//
// Definitions (as in the almanacs we check against, see scripts/check-events.ts):
// - conjunction with the Sun and opposition: equal (or opposite) apparent geocentric ecliptic longitude, of date,
//   like NAOJ. SearchRelativeLongitude works from the Sun (heliocentric) and is off by up to 39 minutes, so it
//   only gives the starting point; the time is then found on the apparent longitudes seen from the Earth.
// - greatest elongation of Mercury and Venus: SearchMaxElongation (the angle in space, not on the ecliptic).
// - Moon phases: SearchMoonQuarter (the Moon's longitude minus the Sun's, seen from the Earth).
// - eclipses: their peak; for the Sun "greatest eclipse" (the shadow's axis closest to the Earth's centre).
// - two bodies close in the sky ("close approach"): the smallest angle between them, from the Earth's centre.
//   Seen from a given place the Moon is shifted by up to about one degree (parallax); planets are not.
// All times are UTC milliseconds (Astronomy Engine's UT).

import * as A from 'astronomy-engine';
import { LD_AU, tdbToUtcMs, type CloseApproach } from '../live/closeApproaches';

export type EventPlanet = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export const EVENT_PLANETS: EventPlanet[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
/** The planets you can see without a telescope: the Moon's close approaches are listed with these only. */
export const BRIGHT_PLANETS: EventPlanet[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
const INNER = new Set<EventPlanet>(['mercury', 'venus']);

export const BODY: Record<EventPlanet, A.Body> = {
  mercury: A.Body.Mercury, venus: A.Body.Venus, mars: A.Body.Mars, jupiter: A.Body.Jupiter,
  saturn: A.Body.Saturn, uranus: A.Body.Uranus, neptune: A.Body.Neptune,
};

export type MoonPhase = 'new' | 'firstQuarter' | 'full' | 'lastQuarter';
export const MOON_PHASES: MoonPhase[] = ['new', 'firstQuarter', 'full', 'lastQuarter'];
export type Season = 'marchEquinox' | 'juneSolstice' | 'septemberEquinox' | 'decemberSolstice';

/** Closest approaches in the sky worth a line: the Moon and a bright planet, two planets. [degrees] */
export const MOON_PAIR_MAX_DEG = 5;
export const PLANET_PAIR_MAX_DEG = 2;
/** Closer to the Sun than this in the sky, a planet is lost in its glare. [degrees] */
export const GLARE_DEG = 15;

export type SkyEvent =
  | { kind: 'moon'; ms: number; phase: MoonPhase }
  /** With the Sun. For Mercury and Venus: superior (behind the Sun) or inferior (between us and the Sun). */
  | { kind: 'conjunction'; ms: number; body: EventPlanet; side: 'superior' | 'inferior' | null }
  | { kind: 'opposition'; ms: number; body: EventPlanet; distAu: number; mag: number }
  /** Mercury or Venus farthest from the Sun in the sky: in the evening (east of the Sun) or the morning. */
  | { kind: 'elongation'; ms: number; body: 'mercury' | 'venus'; sky: 'evening' | 'morning'; deg: number; mag: number }
  /** lat/lon: where the centre of the shadow falls at the peak (total and annular eclipses only). */
  | { kind: 'solarEclipse'; ms: number; type: 'partial' | 'annular' | 'total'; lat: number | null; lon: number | null }
  /** minutes: how long the deepest phase lasts (totality, the partial phase, or the penumbral phase). */
  | { kind: 'lunarEclipse'; ms: number; type: 'penumbral' | 'partial' | 'total'; minutes: number }
  | { kind: 'season'; ms: number; season: Season }
  | { kind: 'perihelion' | 'aphelion'; ms: number; distAu: number }
  /** Two bodies closest in the sky: a = the Moon or the faster planet. sunDeg: b's angle from the Sun. */
  | { kind: 'pair'; ms: number; a: 'moon' | EventPlanet; b: EventPlanet; sepDeg: number; sunDeg: number }
  /** An asteroid or comet passing the Earth (live data from CNEOS): closer than the Moon, or the closest of the stretch. */
  | { kind: 'neo'; ms: number; des: string; name: string; distAu: number; closerThanMoon: boolean };

export type EventKind = SkyEvent['kind'];

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const time = (ms: number) => A.MakeTime(new Date(ms));
const msOf = (t: A.AstroTime) => t.date.getTime();
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Apparent geocentric ecliptic longitude of date. [degrees] */
function apparentLon(body: A.Body, t: A.AstroTime): number {
  return A.Ecliptic(A.GeoVector(body, t, true)).elon;
}

/** A zero of f between a and b (f(a) and f(b) of opposite signs), by bisection to well under a second. */
function root(f: (ms: number) => number, a: number, b: number): number | null {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) return null;
  for (let i = 0; i < 48 && b - a > 1; i++) {
    const m = (a + b) / 2, fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/** The time of the smallest f in [a, b] (one minimum inside), by golden-section search. */
function minimum(f: (ms: number) => number, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
  for (let i = 0; i < 60 && b - a > 500; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}

/**
 * Conjunctions with the Sun and oppositions: the apparent longitude difference seen from the Earth
 * (body minus Sun) reaches 0° or 180°.
 */
function sunLineEvents(p: EventPlanet, fromMs: number, toMs: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  const body = BODY[p];
  // Heliocentric 0° is the inferior conjunction of Mercury and Venus, and the opposition of the others
  for (const helio of [0, 180]) {
    let t = A.SearchRelativeLongitude(body, helio, time(fromMs - 3 * DAY_MS));
    while (msOf(t) < toMs + 3 * DAY_MS) {
      const near = msOf(t);
      const geoTarget = !INNER.has(p) && helio === 0 ? 180 : 0;
      const f = (ms: number) => { const tt = time(ms); return wrap180(apparentLon(body, tt) - apparentLon(A.Body.Sun, tt) - geoTarget); };
      const ms = root(f, near - 2 * DAY_MS, near + 2 * DAY_MS);
      if (ms !== null && ms >= fromMs && ms < toMs) {
        if (geoTarget === 180) {
          const ill = A.Illumination(body, time(ms));
          out.push({ kind: 'opposition', ms, body: p, distAu: ill.geo_dist, mag: ill.mag });
        } else {
          out.push({ kind: 'conjunction', ms, body: p, side: INNER.has(p) ? (helio === 0 ? 'inferior' : 'superior') : null });
        }
      }
      t = A.SearchRelativeLongitude(body, helio, time(near + 10 * DAY_MS));
    }
  }
  return out;
}

function elongationEvents(p: 'mercury' | 'venus', fromMs: number, toMs: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  let e = A.SearchMaxElongation(BODY[p], time(fromMs));
  while (msOf(e.time) < toMs) {
    const ms = msOf(e.time);
    if (ms >= fromMs) {
      out.push({ kind: 'elongation', ms, body: p, sky: e.visibility === 'evening' ? 'evening' : 'morning', deg: e.elongation, mag: A.Illumination(BODY[p], e.time).mag });
    }
    e = A.SearchMaxElongation(BODY[p], time(ms + DAY_MS));
  }
  return out;
}

function moonEvents(fromMs: number, toMs: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (let q = A.SearchMoonQuarter(time(fromMs)); msOf(q.time) < toMs; q = A.NextMoonQuarter(q)) {
    out.push({ kind: 'moon', ms: msOf(q.time), phase: MOON_PHASES[q.quarter] });
  }
  return out;
}

function eclipseEvents(fromMs: number, toMs: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (let e = A.SearchLunarEclipse(time(fromMs)); msOf(e.peak) < toMs; e = A.NextLunarEclipse(e.peak)) {
    const type = e.kind === A.EclipseKind.Total ? 'total' : e.kind === A.EclipseKind.Partial ? 'partial' : 'penumbral';
    const sd = type === 'total' ? e.sd_total : type === 'partial' ? e.sd_partial : e.sd_penum;
    out.push({ kind: 'lunarEclipse', ms: msOf(e.peak), type, minutes: 2 * sd });
  }
  for (let e = A.SearchGlobalSolarEclipse(time(fromMs)); msOf(e.peak) < toMs; e = A.NextGlobalSolarEclipse(e.peak)) {
    const type = e.kind === A.EclipseKind.Total ? 'total' : e.kind === A.EclipseKind.Annular ? 'annular' : 'partial';
    const central = type !== 'partial' && e.latitude !== undefined && e.longitude !== undefined;
    out.push({ kind: 'solarEclipse', ms: msOf(e.peak), type, lat: central ? e.latitude! : null, lon: central ? e.longitude! : null });
  }
  return out;
}

function earthEvents(fromMs: number, toMs: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  const y0 = new Date(fromMs).getUTCFullYear(), y1 = new Date(toMs).getUTCFullYear();
  for (let y = y0; y <= y1; y++) {
    const s = A.Seasons(y);
    const all: [Season, A.AstroTime][] = [['marchEquinox', s.mar_equinox], ['juneSolstice', s.jun_solstice], ['septemberEquinox', s.sep_equinox], ['decemberSolstice', s.dec_solstice]];
    for (const [season, t] of all) if (msOf(t) >= fromMs && msOf(t) < toMs) out.push({ kind: 'season', ms: msOf(t), season });
  }
  for (let a = A.SearchPlanetApsis(A.Body.Earth, time(fromMs)); msOf(a.time) < toMs; a = A.NextPlanetApsis(A.Body.Earth, a)) {
    out.push({ kind: a.kind === A.ApsisKind.Pericenter ? 'perihelion' : 'aphelion', ms: msOf(a.time), distAu: a.dist_au });
  }
  return out;
}

const SAMPLE_MS = 6 * HOUR_MS;

/**
 * Close approaches in the sky: the Moon and each bright planet (closer than MOON_PAIR_MAX_DEG), and any two
 * planets (closer than PLANET_PAIR_MAX_DEG). Every 6 hours, then the smallest angle between neighbours.
 */
function pairEvents(fromMs: number, toMs: number): SkyEvent[] {
  type Key = 'moon' | EventPlanet;
  const keys: Key[] = ['moon', ...EVENT_PLANETS];
  const bodyOf = (k: Key) => (k === 'moon' ? A.Body.Moon : BODY[k]);
  const pairs: [Key, EventPlanet, number][] = [];
  for (const b of BRIGHT_PLANETS) pairs.push(['moon', b, MOON_PAIR_MAX_DEG]);
  for (let i = 0; i < EVENT_PLANETS.length; i++) {
    for (let j = i + 1; j < EVENT_PLANETS.length; j++) pairs.push([EVENT_PLANETS[i], EVENT_PLANETS[j], PLANET_PAIR_MAX_DEG]);
  }
  // Samples a little beyond both ends, so a closest approach right at an end is found too
  const start = fromMs - SAMPLE_MS, n = Math.ceil((toMs - fromMs) / SAMPLE_MS) + 2;
  const vec: Record<Key, A.Vector[]> = Object.fromEntries(keys.map((k) => [k, [] as A.Vector[]])) as Record<Key, A.Vector[]>;
  for (let i = 0; i <= n; i++) {
    const t = time(start + i * SAMPLE_MS);
    for (const k of keys) vec[k].push(A.GeoVector(bodyOf(k), t, true));
  }
  const out: SkyEvent[] = [];
  for (const [a, b, max] of pairs) {
    const sep = vec[a].map((v, i) => A.AngleBetween(v, vec[b][i]));
    for (let i = 1; i < n; i++) {
      if (!(sep[i] <= sep[i - 1] && sep[i] < sep[i + 1]) || sep[i] > max + 1) continue;
      const f = (ms: number) => { const t = time(ms); return A.AngleBetween(A.GeoVector(bodyOf(a), t, true), A.GeoVector(bodyOf(b), t, true)); };
      const ms = minimum(f, start + (i - 1) * SAMPLE_MS, start + (i + 1) * SAMPLE_MS);
      const sepDeg = f(ms);
      if (ms < fromMs || ms >= toMs || sepDeg > max) continue;
      // The faster one first: the Moon, or the planet that moves more in the sky that day
      const t = time(ms);
      const moves = (k: EventPlanet) => A.AngleBetween(A.GeoVector(BODY[k], t, true), A.GeoVector(BODY[k], time(ms + DAY_MS), true));
      const [first, second] = a === 'moon' || moves(a) >= moves(b) ? [a, b] : [b, a as EventPlanet];
      const sunDeg = A.AngleFromSun(bodyOf(second), t);
      out.push({ kind: 'pair', ms, a: first, b: second as EventPlanet, sepDeg, sunDeg });
    }
  }
  return out;
}

/**
 * Asteroids and comets passing the Earth in the stretch (from the live CNEOS file): those closer than the Moon,
 * and the closest one if it is not among them.
 */
export function neoEvents(list: CloseApproach[], fromMs: number, toMs: number): SkyEvent[] {
  const inside = list.filter((a) => { const ms = tdbToUtcMs(a.jd); return ms >= fromMs && ms < toMs; });
  const closest = inside.reduce<CloseApproach | null>((c, a) => (!c || a.dist < c.dist ? a : c), null);
  return inside
    .filter((a) => a.dist < LD_AU || a === closest)
    .map((a) => ({ kind: 'neo', ms: tdbToUtcMs(a.jd), des: a.des, name: a.name, distAu: a.dist, closerThanMoon: a.dist < LD_AU }));
}

/** Events at the same minute: the rarer first. */
const ORDER: Record<EventKind, number> = {
  solarEclipse: 0, lunarEclipse: 1, season: 2, perihelion: 3, aphelion: 3, opposition: 4, conjunction: 5,
  elongation: 6, pair: 7, moon: 8, neo: 9,
};

/** Every event from fromMs (inclusive) to toMs (exclusive), in time order. */
export function findEvents(fromMs: number, toMs: number, neos: CloseApproach[] = []): SkyEvent[] {
  if (!(toMs > fromMs)) return [];
  const all: SkyEvent[] = [
    ...moonEvents(fromMs, toMs),
    ...eclipseEvents(fromMs, toMs),
    ...earthEvents(fromMs, toMs),
    ...EVENT_PLANETS.flatMap((p) => sunLineEvents(p, fromMs, toMs)),
    ...elongationEvents('mercury', fromMs, toMs),
    ...elongationEvents('venus', fromMs, toMs),
    ...pairEvents(fromMs, toMs),
    ...neoEvents(neos, fromMs, toMs),
  ];
  return all.sort((x, y) => x.ms - y.ms || ORDER[x.kind] - ORDER[y.kind]);
}

/** The planet an event is about (to pick it on the map), if any. */
export function eventPlanet(e: SkyEvent): EventPlanet | null {
  if (e.kind === 'conjunction' || e.kind === 'opposition' || e.kind === 'elongation') return e.body;
  if (e.kind === 'pair') return e.a === 'moon' ? e.b : e.a;
  return null;
}

/** A planet's apparent angle from the Sun (elongation), seen from the Earth's centre. [degrees] */
export const sunAngle = (p: EventPlanet, ms: number) => A.AngleFromSun(BODY[p], time(ms));
/** The apparent geocentric longitude difference body − Sun, in (−180°, 180°]. */
export const longitudeFromSun = (p: EventPlanet, ms: number) => { const t = time(ms); return wrap180(apparentLon(BODY[p], t) - apparentLon(A.Body.Sun, t)); };
/** The angle between two bodies in the sky, from the Earth's centre. [degrees] */
export function separation(a: 'moon' | EventPlanet, b: EventPlanet, ms: number): number {
  const t = time(ms);
  return A.AngleBetween(A.GeoVector(a === 'moon' ? A.Body.Moon : BODY[a], t, true), A.GeoVector(BODY[b], t, true));
}
/** The Moon's apparent longitude minus the Sun's (0 new, 90 first quarter, 180 full, 270 last quarter). */
export const moonPhaseAngle = (ms: number) => A.MoonPhase(time(ms));
/** Terrestrial Time (TT, which NASA's eclipse tables call TD) as milliseconds, for an event's UTC milliseconds. */
export const ttMs = (ms: number) => Date.UTC(2000, 0, 1, 12) + time(ms).tt * DAY_MS;
