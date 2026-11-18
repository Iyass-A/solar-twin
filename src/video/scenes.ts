// Scene templates for the weekly video (phase 8, step 2): for each kind of sky event, what the video shows, for how
// long, from where, and which stretch of time runs by meanwhile. A scene is one or two shots:
// - "space": the solar system from outside (the site's 3D view), the camera turning slowly round the Sun;
// - "sky": the sky seen from the Earth (src/video/sky.ts), the bodies moving among the stars, time running faster;
// - "distance": a scale drawing of how far an asteroid passes, against the Moon's distance.
// The event's moment is always in the middle of each shot. A week's video is an opening scene, the week's events
// (at most MAX_EVENTS, the rarest first if there are more) and a closing scene. Its texts come from the sky events
// card, so the video and the site say the same. No DOM here, so `npm run check` tests every template.

import { PLANETS, type PlanetId } from '../astro/elements';
import { heliocentricPosition, longitude } from '../astro/kepler';
import { centuriesSinceJ2000, toJulianDate } from '../astro/julian';
import { BRIGHT_PLANETS, GLARE_DEG, longitudeFromSun, type SkyEvent, type EventPlanet } from '../events/events';
import type { ViewMode } from '../view/views';
import { angleBetween, discRadius, lonLat, opposite, planetMag, shadowRadii, skyVector, type Place, type SkyBody } from './sky';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Fade in and out at the ends of each shot (through black). [seconds] */
export const FADE_S = 0.35;
/** At most this many events in a week's video. */
export const MAX_EVENTS = 8;

interface ShotBase {
  from: number;    // seconds from the scene's start
  to: number;
  simFrom: number; // the simulation's clock during the shot [UTC ms], running evenly
  simTo: number;
  /** The clock slows down round the middle (eclipses): its speed there, as a part of the shot's mean speed */
  slow?: number;
}
export interface SpaceShot extends ShotBase {
  kind: 'space';
  mode: ViewMode;
  select: PlanetId | null;
  /** Camera direction from the Sun: ecliptic longitude and height above the ecliptic [deg], distance (1 = the view's whole width) */
  az: [number, number];
  el: [number, number];
  zoom: [number, number];
}
export type SkyPoint = SkyBody | 'antisun';
export type SkyCenter = SkyPoint | [SkyPoint, SkyPoint];
export interface SkyShot extends ShotBase {
  kind: 'sky';
  /** Centre of the chart: a body, the point opposite the Sun, or half way between two bodies, at the event's moment */
  center: SkyCenter;
  at: number;
  /** Field of view across the chart [deg] */
  fov: [number, number];
  /** Seen from this place (a solar eclipse at its centre line), not from the Earth's centre */
  place?: Place;
  /** Bodies to name on the chart */
  focus: SkyBody[];
  /** Draw the Earth's shadow (lunar eclipses) */
  shadow?: boolean;
  /** Draw the angle between two bodies, with its size (greatest elongation) */
  arc?: [SkyBody, SkyBody];
  /** Keep the centre on its body as time runs (the Moon's phases), so the stars drift past instead */
  track?: boolean;
}
export interface DistanceShot extends ShotBase {
  kind: 'distance';
  distAu: number;
  name: string;
}
/** The bright planets' angle from the Sun through the week, on a line (evening on one side, morning on the other). */
export interface PlanetsShot extends ShotBase {
  kind: 'planets';
}
export type Shot = SpaceShot | SkyShot | DistanceShot | PlanetsShot;

export interface Scene {
  kind: 'intro' | 'event' | 'planets' | 'outro';
  event: SkyEvent | null;
  duration: number; // seconds
  shots: Shot[];
  /** For the opening, planets and closing scenes: the week [UTC ms] */
  week?: { from: number; to: number };
}

/** Where the Earth is seen from the Sun at a moment, on the site's own planets. [deg] */
function earthLongitude(ms: number): number {
  const T = centuriesSinceJ2000(toJulianDate(new Date(ms)));
  return longitude(heliocentricPosition(PLANETS.find((p) => p.id === 'earth')!, T));
}

const span = (at: number, ms: number): [number, number] => [at - ms / 2, at + ms / 2];

/** How far a time zone is ahead of UTC at a moment [ms] (0 for "UTC"). */
export function zoneOffsetMs(ms: number, tz: string): number {
  if (tz === 'UTC') return 0;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(ms).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** Midnight at the start of a day (YYYY-MM-DD, plus some days) in a time zone, as UTC ms: a week runs from local midnight. */
export function zoneMidnight(date: string, tz: string, addDays = 0): number {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d + addDays);
  // Twice: the offset at the guess, then at the answer (they differ only on the night the clocks change)
  const guess = wall - zoneOffsetMs(wall, tz);
  return wall - zoneOffsetMs(guess, tz);
}

/**
 * The camera high above the ecliptic, turning a little, the Sun in the middle. With azOffset 0 it looks from the
 * Earth's side (the Earth near the bottom); with 90 from the side, so a line Sun–Earth–planet runs across the picture;
 * with 180 from beyond the Sun (the Earth near the top, clear of the caption).
 */
function spaceShot(from: number, to: number, at: number, simMs: number, mode: ViewMode, select: PlanetId | null, el = 62, azOffset = 0): SpaceShot {
  const [simFrom, simTo] = span(at, simMs);
  const az = earthLongitude(at) + azOffset;
  return { kind: 'space', from, to, simFrom, simTo, mode, select, az: [az - 12, az + 12], el: [el - 6, el + 4], zoom: [1.05, 0.9] };
}

function skyShot(from: number, to: number, at: number, simMs: number, center: SkyCenter, fov: [number, number], focus: SkyBody[], extra: Partial<SkyShot> = {}): SkyShot {
  const [simFrom, simTo] = span(at, simMs);
  return { kind: 'sky', from, to, simFrom, simTo, center, at, fov, focus, ...extra };
}

/** How slow the clock runs at an eclipse's peak, as a part of the shot's mean speed (at most, for the Sun). */
export const SLOW_SOLAR = 0.12;
/** How long the total or annular phase of a solar eclipse lasts in the video, about. [s] */
export const CENTRAL_S = 2.5;

/** How long the Moon is all inside the Sun's disc, or covers it all, seen from a place round a moment. [minutes] */
export function centralMinutes(at: number, place: Place): number {
  const central = (ms: number) => {
    const sun = skyVector('sun', ms, place), moon = skyVector('moon', ms, place);
    return angleBetween(sun.dir, moon.dir) <= Math.abs(discRadius('sun', sun.au) - discRadius('moon', moon.au));
  };
  if (!central(at)) return 0;
  const STEP = 5000;
  let a = at, b = at;
  while (central(a - STEP) && at - a < 20 * 60_000) a -= STEP;
  while (central(b + STEP) && b - at < 20 * 60_000) b += STEP;
  return (b - a + STEP) / 60_000;
}
export const SLOW_LUNAR = 0.35;

const innerView = (p: EventPlanet) => (p === 'mercury' || p === 'venus' || p === 'mars' ? 'inner' : 'compressed');
// How wide the sky is around a planet at opposition: enough for its loop backwards among the stars
const OPPOSITION_FOV: Record<EventPlanet, number> = { mercury: 30, venus: 30, mars: 32, jupiter: 16, saturn: 12, uranus: 8, neptune: 6 };

/** The scene for one event. */
export function eventScene(e: SkyEvent): Scene {
  const at = e.ms;
  const scene = (duration: number, shots: Shot[]): Scene => ({ kind: 'event', event: e, duration, shots });
  switch (e.kind) {
    case 'moon': {
      if (e.phase === 'new') {
        // The Moon cannot be seen: show it passing the Sun in a day (about 12°), both in the picture
        const sep = angleBetween(skyVector('sun', at).dir, skyVector('moon', at).dir);
        const fov = Math.max(18, 3.4 * sep + 8);
        return scene(7, [skyShot(0, 7, at, DAY_MS, ['sun', 'moon'], [fov * 1.08, fov], ['moon', 'sun'])]);
      }
      // Two days around the moment, close up and following the Moon: its lit part grows or shrinks, the stars drift by
      return scene(7, [skyShot(0, 7, at, 2 * DAY_MS, 'moon', [5, 4.4], ['moon'], { track: true })]);
    }
    case 'conjunction': {
      const inner = e.body === 'mercury' || e.body === 'venus';
      // Centred between the Sun and the planet, which can pass up to 8° above or below it (Venus), and wide enough
      // that both stay clear of the caption
      const sep = angleBetween(skyVector('sun', at).dir, skyVector(e.body, at).dir);
      const fov = Math.max(16, 3.4 * sep + 6);
      return scene(9, [
        spaceShot(0, 4.5, at, (inner ? 40 : 80) * DAY_MS, innerView(e.body), e.body, 62, 90),
        skyShot(4.5, 9, at, 8 * DAY_MS, ['sun', e.body], [fov * 1.15, fov], ['sun', e.body]),
      ]);
    }
    case 'opposition':
      return scene(9.5, [
        spaceShot(0, 4.5, at, 60 * DAY_MS, innerView(e.body), e.body, 62, 90),
        skyShot(4.5, 9.5, at, 80 * DAY_MS, e.body, [OPPOSITION_FOV[e.body], OPPOSITION_FOV[e.body] * 0.9], [e.body]),
      ]);
    case 'elongation': {
      const fov = 2 * e.deg + 18;
      return scene(9, [
        spaceShot(0, 4.5, at, 40 * DAY_MS, 'inner', e.body, 75, 180),
        skyShot(4.5, 9, at, 10 * DAY_MS, ['sun', e.body], [fov, fov * 0.95], ['sun', e.body], { arc: ['sun', e.body] }),
      ]);
    }
    case 'solarEclipse': {
      // Four hours: the Moon crosses the Sun, the clock slowing down round the peak so that the total (or annular)
      // phase lasts about 2.5 s. From the centre line where there is one, else from the Earth's centre
      const place = e.lat !== null && e.lon !== null ? { lat: e.lat, lon: e.lon } : undefined;
      const minutes = place ? centralMinutes(at, place) : 0;
      // The clock's part 0.5 + 0.5 (a x + (1 − a) x³) at x = ±CENTRAL_S / 9 s must reach ± half the phase
      const xc = CENTRAL_S / 9, part = minutes / (4 * 60);
      const slow = minutes > 0 ? Math.min(SLOW_SOLAR, Math.max(0.02, (part - xc ** 3) / (xc - xc ** 3))) : SLOW_SOLAR;
      return scene(9, [skyShot(0, 9, at, 4 * HOUR_MS, 'sun', [2.6, 2.2], ['sun'], { slow, ...(place ? { place } : {}) })]);
    }
    case 'lunarEclipse': {
      // Half way between the shadow's centre and the Moon, wide enough for both and the penumbra round them
      const sun = skyVector('sun', at), moon = skyVector('moon', at);
      const sep = angleBetween(opposite(sun.dir), moon.dir);
      const fov = Math.max(4.4, 2.6 * (sep + discRadius('moon', moon.au) + shadowRadii(moon.au, sun.au).penumbra));
      return scene(9, [skyShot(0, 9, at, 5 * HOUR_MS, ['antisun', 'moon'], [fov, fov * 0.9], ['moon'], { shadow: true, slow: SLOW_LUNAR })]);
    }
    case 'season':
      return scene(7, [spaceShot(0, 7, at, 60 * DAY_MS, 'inner', 'earth', 72, 180)]);
    case 'perihelion':
    case 'aphelion':
      return scene(7, [spaceShot(0, 7, at, 60 * DAY_MS, 'inner', 'earth', 84, 180)]);
    case 'pair': {
      // A day for the Moon: it moves about 13° among the stars, and stays in the picture. Wider when one is well
      // below the other, so that the lower one stays clear of the caption
      const moon = e.a === 'moon';
      const dLat = Math.abs(lonLat(skyVector(e.a, at).dir).lat - lonLat(skyVector(e.b, at).dir).lat);
      const fov = Math.max(moon ? 21 : 5, 5 * e.sepDeg, 6.5 * dLat);
      return scene(8, [skyShot(0, 8, at, (moon ? 1 : 8) * DAY_MS, [e.a, e.b], [fov, fov * 0.92], [e.a, e.b])]);
    }
    case 'neo':
      return scene(7, [{ kind: 'distance', from: 0, to: 7, simFrom: at, simTo: at, distAu: e.distAu, name: e.name }]);
  }
}

/** How rare an event is, for keeping the most interesting ones when a week has too many. Smaller is rarer. */
const RARITY: Record<SkyEvent['kind'], number> = {
  solarEclipse: 0, lunarEclipse: 1, opposition: 2, neo: 3, elongation: 4, conjunction: 5, season: 6, pair: 7,
  perihelion: 8, aphelion: 8, moon: 9,
};

/** A new or full Moon within hours of an eclipse is the same event: the eclipse's scene shows it. */
export function sameAsEclipse(e: SkyEvent, events: SkyEvent[]): boolean {
  if (e.kind !== 'moon' || (e.phase !== 'new' && e.phase !== 'full')) return false;
  const kind = e.phase === 'new' ? 'solarEclipse' : 'lunarEclipse';
  return events.some((x) => x.kind === kind && Math.abs(x.ms - e.ms) < 12 * HOUR_MS);
}

/** Where a bright planet can be seen in a week: in the evening, the morning, all night, or not (lost in the Sun's glare). */
export type PlanetSky = 'evening' | 'night' | 'morning' | 'glare';
/** Opposite the Sun within this: up all night. [deg] */
export const ALL_NIGHT_DEG = 150;
export function planetSky(lonFromSun: number): PlanetSky {
  const a = Math.abs(lonFromSun);
  return a < GLARE_DEG ? 'glare' : a >= ALL_NIGHT_DEG ? 'night' : lonFromSun > 0 ? 'evening' : 'morning';
}
/** The bright planets in the middle of a stretch: angle from the Sun along the ecliptic (east +), brightness, where. */
export function planetsOfWeek(fromMs: number, toMs: number): { body: EventPlanet; lon: number; mag: number; sky: PlanetSky }[] {
  const mid = (fromMs + toMs) / 2;
  return BRIGHT_PLANETS.map((body) => {
    const lon = longitudeFromSun(body, mid);
    return { body, lon, mag: planetMag(body, mid), sky: planetSky(lon) };
  }).sort((a, b) => a.mag - b.mag);
}

/** The planets scene: the week's time running, 8 s. */
export const PLANETS_S = 8;

/**
 * A week's video: an opening scene, the week's events in time order, where the bright planets are, and a closing
 * scene. A new or full Moon at an eclipse is left out (the eclipse shows it).
 */
export function weekScenes(events: SkyEvent[], fromMs: number, toMs: number): Scene[] {
  const inside = events.filter((e) => e.ms >= fromMs && e.ms < toMs);
  const kept = inside
    .filter((e) => !sameAsEclipse(e, inside))
    .sort((a, b) => RARITY[a.kind] - RARITY[b.kind] || a.ms - b.ms)
    .slice(0, MAX_EVENTS)
    .sort((a, b) => a.ms - b.ms);
  const week = { from: fromMs, to: toMs };
  const mid = (fromMs + toMs) / 2;
  // Long enough to read the list of the week's events on it: 5 s, and half a second more for each event past two
  const introS = Math.min(8, Math.max(5, Math.round((4 + 0.5 * kept.length) * 2) / 2));
  const intro: Scene = { kind: 'intro', event: null, duration: introS, week, shots: [{ ...spaceShot(0, introS, mid, toMs - fromMs, 'compressed', null, 48), zoom: [1.15, 1] }] };
  const planets: Scene = { kind: 'planets', event: null, duration: PLANETS_S, week, shots: [{ kind: 'planets', from: 0, to: PLANETS_S, simFrom: fromMs, simTo: toMs }] };
  const outro: Scene = { kind: 'outro', event: null, duration: 5, week, shots: [{ ...spaceShot(0, 5, toMs, 10 * DAY_MS, 'compressed', null, 48), zoom: [1, 1.1] }] };
  return [intro, ...kept.map(eventScene), planets, outro];
}

/** The scene playing at second t of a sequence, and the time within it (the last scene holds its end). */
export function sceneAt(scenes: Scene[], t: number): { scene: Scene; index: number; local: number } {
  let start = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (t < start + scenes[i].duration || i === scenes.length - 1) return { scene: scenes[i], index: i, local: Math.min(Math.max(0, t - start), scenes[i].duration) };
    start += scenes[i].duration;
  }
  throw new Error('no scenes');
}

export const totalDuration = (scenes: Scene[]) => scenes.reduce((s, x) => s + x.duration, 0);

/** Frames per second of the recorded video. */
export const FPS = 30;

/**
 * The frames to record, scene by scene (one video file each): where each scene starts [s] and how many frames it has.
 * Frame k of a scene is drawn at start + k / fps, so the scenes join without a frame twice or one missing.
 */
export function framePlan(scenes: Scene[], fps = FPS): { start: number; frames: number }[] {
  let start = 0;
  return scenes.map((sc) => {
    const plan = { start, frames: Math.round(sc.duration * fps) };
    start += sc.duration;
    return plan;
  });
}

/** The shot playing at a time in the scene (the last one at its very end). */
export function shotAt(scene: Scene, local: number): Shot {
  return scene.shots.find((s) => local >= s.from && local < s.to) ?? scene.shots[scene.shots.length - 1];
}

/** How far through the shot's clock (0 to 1) at a part u of the shot: evenly, or slower round the middle. */
function clockPart(shot: Shot, u: number): number {
  if (!shot.slow) return u;
  const a = shot.slow, x = 2 * u - 1;
  return 0.5 + 0.5 * (a * x + (1 - a) * x * x * x);
}

/** The shot's clock at a time in the scene: from simFrom to simTo, evenly or slowing down round the middle. */
export function simTime(shot: Shot, local: number): number {
  const u = Math.min(1, Math.max(0, (local - shot.from) / (shot.to - shot.from)));
  return shot.simFrom + clockPart(shot, u) * (shot.simTo - shot.simFrom);
}

/** 0 to 1 and back: the shot fading in from black and out to black at its ends. */
export function shotOpacity(shot: Shot, local: number): number {
  return Math.max(0, Math.min(1, (local - shot.from) / FADE_S, (shot.to - local) / FADE_S));
}

/** A value from a [start, end] pair at a time in the shot, with a smooth start and stop. */
export function along(pair: [number, number], shot: Shot, local: number): number {
  const u = Math.min(1, Math.max(0, (local - shot.from) / (shot.to - shot.from)));
  const e = u * u * (3 - 2 * u);
  return pair[0] + (pair[1] - pair[0]) * e;
}

/** How much faster than real time the shot's clock runs: simulated hours per second of video (at a time in the scene, if it slows down). */
export function hoursPerSecond(shot: Shot, local = (shot.from + shot.to) / 2): number {
  const mean = (shot.simTo - shot.simFrom) / HOUR_MS / (shot.to - shot.from);
  if (!shot.slow) return mean;
  const u = Math.min(1, Math.max(0, (local - shot.from) / (shot.to - shot.from))), x = 2 * u - 1;
  return mean * (shot.slow + 3 * (1 - shot.slow) * x * x);
}
