// Asteroids, dwarf planets and comets from src/data/small-bodies.json, ready for the 2D map and the 3D scene.
// No DOM or Three.js here.

import type { Vec3 } from '../astro/kepler';
import { smallBodyPosition, smallBodyOrbitPath, type SmallBodyOrbit } from '../astro/smallbody';
import { SMALL_BODY_NAMES, DWARF_PLANETS } from '../data/small-body-names';
import type { Lang } from '../i18n';

export type SmallGroup = 'dwarf' | 'neo' | 'asteroid' | 'comet';

export const SMALL_GROUPS: SmallGroup[] = ['dwarf', 'asteroid', 'neo', 'comet'];

// Chosen to stay apart from the planet colours (Mars is red-orange, Uranus pale cyan)
export const SMALL_COLORS: Record<SmallGroup, string> = {
  dwarf: '#c9a7ff',    // lavender
  asteroid: '#b8ab95', // grey-tan
  neo: '#ff7eb6',      // pink
  comet: '#6ff0b4',    // green, as comets often look in photos
};

export interface SmallBody {
  id: string;          // "sb-" + JPL SPK-ID, so it never clashes with a planet id
  query: string;       // its line in data/small-bodies.txt
  jplName: string;
  group: SmallGroup;
  classCode: string;   // JPL orbit class, e.g. APO, MBA, JFc
  className: string;
  diameter: number | null; // km
  orbit: SmallBodyOrbit;
  validFrom: number;   // Julian days: our position is within 1° of JPL in this window
  validTo: number;
}

/** What the views need each frame for one body. */
export interface SmallFrame {
  id: string;
  label: string;
  group: SmallGroup;
  pos: Vec3;
}

interface RawBody extends SmallBodyOrbit {
  spkid: string; query: string; short: string; kind: string; neo: boolean;
  class: string | null; className: string | null; diameter: number | null;
  validFrom?: number; validTo?: number;
}

export function loadSmallBodies(data: { bodies: unknown[] }): SmallBody[] {
  return (data.bodies as RawBody[]).map((b) => ({
    id: `sb-${b.spkid}`,
    query: b.query,
    jplName: b.short,
    group: b.kind.startsWith('c') ? 'comet' : DWARF_PLANETS.has(b.query) ? 'dwarf' : b.neo ? 'neo' : 'asteroid',
    classCode: b.class ?? '',
    className: b.className ?? '',
    diameter: b.diameter,
    orbit: { epoch: b.epoch, e: b.e, q: b.q, tp: b.tp, node: b.node, peri: b.peri, i: b.i },
    validFrom: b.validFrom ?? b.epoch,
    validTo: b.validTo ?? b.epoch,
  }));
}

export const smallLabel = (b: SmallBody, l: Lang) => SMALL_BODY_NAMES[b.query]?.[l][0] ?? b.jplName;
export const smallFullName = (b: SmallBody, l: Lang) => SMALL_BODY_NAMES[b.query]?.[l][1] ?? b.jplName;
export const isValidAt = (b: SmallBody, jd: number) => jd >= b.validFrom && jd <= b.validTo;
export const smallPosition = (b: SmallBody, jd: number): Vec3 => smallBodyPosition(b.orbit, jd);

const paths = new Map<string, Vec3[]>();
/** The orbit as a closed line (cached: the elements do not change). */
export function smallOrbitPath(b: SmallBody): Vec3[] {
  let p = paths.get(b.id);
  if (!p) { p = smallBodyOrbitPath(b.orbit, 360); paths.set(b.id, p); }
  return p;
}
