// The sky seen from the Earth, for the video scenes (phase 8, step 2): where the Sun, the Moon and the planets
// appear among the stars, how much of the Moon is lit and from which side, how big the Sun and the Moon look,
// and the Earth's shadow at the Moon's distance. All directions in the J2000 ecliptic frame, apparent (light time
// and aberration), from the Earth's centre or from a place on the Earth. No DOM, so `npm run check` tests it.
//
// The chart is a stereographic projection (it keeps shapes and angles, so the Moon stays round at any field of
// view) around a centre direction, with ecliptic north up and east to the left, as sky charts are drawn.

import * as A from 'astronomy-engine';
import type { Vec3 } from '../astro/kepler';
import { BODY, type EventPlanet } from '../events/events';

export type SkyBody = 'sun' | 'moon' | EventPlanet;
export interface Place { lat: number; lon: number }

const DEG = Math.PI / 180;
const EQJ_TO_ECL = A.Rotation_EQJ_ECL();
const SUN_RADIUS_KM = 695_700;   // IAU 2015 nominal
const MOON_RADIUS_KM = 1_737.4;
const EARTH_RADIUS_KM = 6_378.1;
/** The Earth's shadow looks about 2% larger than geometry says (its atmosphere); Chauvenet's factor, used by almanacs. */
export const SHADOW_ENLARGE = 1.02;

const bodyOf = (b: SkyBody) => (b === 'sun' ? A.Body.Sun : b === 'moon' ? A.Body.Moon : BODY[b]);
const time = (ms: number) => A.MakeTime(new Date(ms));
const norm = (v: Vec3): Vec3 => { const r = Math.hypot(v.x, v.y, v.z); return { x: v.x / r, y: v.y / r, z: v.z / r }; };
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** A body's apparent direction and distance [au] from the Earth's centre, or from a place on the Earth. */
export function skyVector(b: SkyBody, ms: number, place?: Place): { dir: Vec3; au: number } {
  const t = time(ms);
  const eqj = place
    ? A.Equator(bodyOf(b), t, new A.Observer(place.lat, place.lon, 0), false, true).vec
    : A.GeoVector(bodyOf(b), t, true);
  const v = A.RotateVector(EQJ_TO_ECL, eqj);
  const au = Math.hypot(v.x, v.y, v.z);
  return { dir: { x: v.x / au, y: v.y / au, z: v.z / au }, au };
}

/** The angle between two directions. [degrees] */
export const angleBetween = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / DEG;

/** Half way between two directions (on the great circle between them). */
export const midpoint = (a: Vec3, b: Vec3): Vec3 => norm({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** The opposite direction (the point of the sky opposite the Sun: the centre of the Earth's shadow). */
export const opposite = (a: Vec3): Vec3 => ({ x: -a.x, y: -a.y, z: -a.z });

/** Apparent radius of the Sun or the Moon at a distance [au]. [degrees] */
export function discRadius(b: 'sun' | 'moon', au: number): number {
  return Math.asin((b === 'sun' ? SUN_RADIUS_KM : MOON_RADIUS_KM) / (au * A.KM_PER_AU)) / DEG;
}

/**
 * The Earth's shadow at the Moon's distance, seen from the Earth's centre: radii of the umbra (no direct sunlight)
 * and the penumbra (part of the Sun hidden). [degrees] From the Moon's and the Sun's parallax and the Sun's radius.
 */
export function shadowRadii(moonAu: number, sunAu: number): { umbra: number; penumbra: number } {
  const piMoon = Math.asin(EARTH_RADIUS_KM / (moonAu * A.KM_PER_AU)) / DEG;
  const piSun = Math.asin(EARTH_RADIUS_KM / (sunAu * A.KM_PER_AU)) / DEG;
  const sun = discRadius('sun', sunAu);
  return { umbra: SHADOW_ENLARGE * (piMoon + piSun - sun), penumbra: SHADOW_ENLARGE * (piMoon + piSun + sun) };
}

/** How much of the Moon's disc is lit (0 new, 1 full). */
export const moonLit = (ms: number) => A.Illumination(A.Body.Moon, time(ms)).phase_fraction;

/** A planet's brightness [magnitude] as seen from the Earth. */
export const planetMag = (p: EventPlanet, ms: number) => A.Illumination(BODY[p], time(ms)).mag;

/** The chart: a stereographic projection around `center`, `fovDeg` wide across a canvas of w × h pixels. */
export interface Projection {
  center: Vec3;
  east: Vec3;
  north: Vec3;
  scale: number; // pixels per unit of the projection plane
  w: number;
  h: number;
  cy: number;    // the centre's height on the canvas [px] (above the middle leaves room for a caption)
}

export function projection(center: Vec3, fovDeg: number, w: number, h: number, cy = h / 2): Projection {
  const c = norm(center);
  // Towards larger ecliptic longitude, and towards the ecliptic's north pole (any direction, at a pole)
  let east = cross({ x: 0, y: 0, z: 1 }, c);
  if (Math.hypot(east.x, east.y, east.z) < 1e-9) east = { x: 0, y: 1, z: 0 };
  east = norm(east);
  const north = cross(c, east);
  return { center: c, east, north, scale: (w / 2) / (2 * Math.tan((fovDeg / 4) * DEG)), w, h, cy };
}

/** Screen position [px] of a direction, or null for one too far behind the centre to draw. East is to the left. */
export function project(p: Projection, v: Vec3): { x: number; y: number } | null {
  const z = dot(v, p.center);
  if (z < -0.5) return null;
  const k = (2 / (1 + z)) * p.scale;
  return { x: p.w / 2 - k * dot(v, p.east), y: p.cy - k * dot(v, p.north) };
}

/** Pixels per degree at the centre of the chart (larger towards the edges, as with any stereographic chart). */
export const pixelsPerDegree = (p: Projection) => p.scale * DEG;

/**
 * The screen direction (unit vector) from a point of the sky towards another, along the great circle between them:
 * where the Moon's lit limb faces (towards the Sun), whatever the field of view.
 */
export function screenDirection(p: Projection, from: Vec3, to: Vec3): { x: number; y: number } | null {
  const d = { x: to.x - dot(to, from) * from.x, y: to.y - dot(to, from) * from.y, z: to.z - dot(to, from) * from.z };
  const len = Math.hypot(d.x, d.y, d.z);
  if (len < 1e-12) return null;
  const eps = 1e-4;
  const a = project(p, from), b = project(p, norm({ x: from.x + (eps * d.x) / len, y: from.y + (eps * d.y) / len, z: from.z + (eps * d.z) / len }));
  if (!a || !b) return null;
  const sx = b.x - a.x, sy = b.y - a.y, sl = Math.hypot(sx, sy);
  return sl > 0 ? { x: sx / sl, y: sy / sl } : null;
}

/** Ecliptic longitude and latitude of a direction. [degrees] */
export function lonLat(v: Vec3): { lon: number; lat: number } {
  return { lon: ((Math.atan2(v.y, v.x) / DEG) + 360) % 360, lat: Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG };
}

/** The direction of an ecliptic longitude and latitude. [degrees] */
export function fromLonLat(lon: number, lat: number): Vec3 {
  return { x: Math.cos(lat * DEG) * Math.cos(lon * DEG), y: Math.cos(lat * DEG) * Math.sin(lon * DEG), z: Math.sin(lat * DEG) };
}
