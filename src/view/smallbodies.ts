// Asteroids, dwarf planets and comets from src/data/small-bodies.json, ready for the 2D map and the 3D scene.
// No DOM or Three.js here. The covariances (for the uncertainty clouds) are in small files of their own
// (public/data/cov/N.json), loaded when a body is picked.

import type { Vec3 } from '../astro/kepler';
import { smallBodyOrbitPath, semiMajorAxis, GAUSS_K, type SmallBodyOrbit } from '../astro/smallbody';
import { SMALL_BODY_NAMES, DWARF_PLANETS } from '../data/small-body-names';
import type { Lang } from '../i18n';
import { sampleOrbits, seedFrom, type Covariance } from '../astro/uncertainty';

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
  id: string;          // "sb-" + JPL designation (letters and digits only), never clashes with a planet id
  pdes: string;        // JPL primary designation, e.g. "433", "2024 YR4", "1P"
  key: string | null;  // its line in data/small-bodies.txt, for the well-known bodies (our own names)
  famous: boolean;
  jplName: string;     // JPL's short name, e.g. "Eros", "137108 (1999 AN10)", "2P/Encke"
  jplFull: string;     // JPL's full name, e.g. "433 Eros (A898 PA)"
  group: SmallGroup;
  classCode: string;   // JPL orbit class, e.g. APO, MBA, JFc
  diameter: number | null; // km
  orbit: SmallBodyOrbit;
  validFrom: number;   // Julian days: our position is within 1° of JPL in this window
  validTo: number;
  covParams: number;   // parameters in JPL's orbit fit: 6 = gravity only, more = also comet jets, sunlight push ...
  covShard: number | null; // which public/data/cov file holds the covariance
  cov: Covariance | null;  // loaded with loadCovariance()
  at: (jd: number) => Vec3; // position [au], same as smallBodyPosition(orbit, jd), faster
}

/** What the views need each frame for one body. */
export interface SmallFrame {
  id: string;
  label: string;
  group: SmallGroup;
  famous: boolean;
  pos: Vec3;
}

interface IndexFile { fields: string[]; rows: unknown[][]; standardEpoch: number; }

/**
 * Position function with the orbit's orientation worked out once (P and Q: directions of perihelion
 * and of 90° ahead of it). Same formulas as smallBodyPosition; npm run check compares the two.
 */
export function positioner(o: SmallBodyOrbit): (jd: number) => Vec3 {
  if (!(o.e < 1)) throw new Error('Only elliptic orbits (e < 1) are supported');
  const D = Math.PI / 180;
  const a = semiMajorAxis(o), e = o.e, b = a * Math.sqrt(1 - e * e), n = GAUSS_K / Math.pow(a, 1.5);
  const cw = Math.cos(o.peri * D), sw = Math.sin(o.peri * D);
  const cO = Math.cos(o.node * D), sO = Math.sin(o.node * D);
  const cI = Math.cos(o.i * D), sI = Math.sin(o.i * D);
  const P = [cw * cO - sw * sO * cI, cw * sO + sw * cO * cI, sw * sI];
  const Q = [-sw * cO - cw * sO * cI, -sw * sO + cw * cO * cI, cw * sI];
  const tp = o.tp, dtp = o.dtp ?? 0;
  return (jd) => {
    const M = n * ((jd - tp) - dtp);
    const m = Math.atan2(Math.sin(M), Math.cos(M));
    let E = m + 0.85 * e * Math.sign(Math.sin(m) || 1); // Danby's start, as in solveKeplerAnyE
    for (let k = 0; k < 60; k++) {
      const dE = -(E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-13) break;
    }
    const xp = a * (Math.cos(E) - e), yp = b * Math.sin(E);
    return { x: P[0] * xp + Q[0] * yp, y: P[1] * xp + Q[1] * yp, z: P[2] * xp + Q[2] * yp };
  };
}

export function loadSmallBodies(data: IndexFile): SmallBody[] {
  const f = Object.fromEntries(data.fields.map((name, k) => [name, k]));
  return data.rows.map((r) => {
    const pdes = String(r[f.pdes]);
    const key = (r[f.key] as string | null) ?? null;
    const kind = String(r[f.kind]);
    const orbit: SmallBodyOrbit = {
      epoch: r[f.epoch] as number, e: r[f.e] as number, q: r[f.q] as number, tp: r[f.tp] as number,
      node: r[f.node] as number, peri: r[f.peri] as number, i: r[f.i] as number,
    };
    return {
      id: `sb-${pdes.replace(/[^A-Za-z0-9]/g, '_')}`,
      pdes,
      key,
      famous: key !== null,
      jplName: String(r[f.name]),
      jplFull: String(r[f.full]),
      group: kind.startsWith('c') ? 'comet' : key && DWARF_PLANETS.has(key) ? 'dwarf' : r[f.neo] ? 'neo' : 'asteroid',
      classCode: String(r[f.class] ?? ''),
      diameter: (r[f.diameter] as number | null) ?? null,
      orbit,
      validFrom: r[f.validFrom] as number,
      validTo: r[f.validTo] as number,
      covParams: (r[f.covParams] as number) ?? 0,
      covShard: (r[f.covShard] as number | null) ?? null,
      cov: null,
      at: positioner(orbit),
    } satisfies SmallBody;
  });
}

export const smallLabel = (b: SmallBody, l: Lang) => (b.key && SMALL_BODY_NAMES[b.key]?.[l][0]) || b.jplName;
export const smallFullName = (b: SmallBody, l: Lang) => (b.key && SMALL_BODY_NAMES[b.key]?.[l][1]) || b.jplFull;
export const isValidAt = (b: SmallBody, jd: number) => jd >= b.validFrom && jd <= b.validTo;
export const smallPosition = (b: SmallBody, jd: number): Vec3 => b.at(jd);

// ---------- Covariance and uncertainty clouds ----------

const SIX = ['e', 'q', 'tp', 'node', 'peri', 'i'];

/** One body's entry in a covariance file: the upper triangle of the 6x6 matrix, row by row. */
export interface CovEntry { epoch: number; elements: Omit<SmallBodyOrbit, 'epoch'>; upper: number[]; }

export function covarianceFrom(c: CovEntry): Covariance {
  const m = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  let k = 0;
  for (let i = 0; i < 6; i++) for (let j = i; j < 6; j++) { m[i][j] = m[j][i] = c.upper[k++]; }
  return { epoch: c.epoch, elements: c.elements, labels: SIX, matrix: m };
}

const shards = new Map<number, Promise<Record<string, CovEntry>>>();

/** Load a body's covariance from its file (each file is fetched once). Resolves false if it has none. */
export async function loadCovariance(b: SmallBody, baseUrl: string): Promise<boolean> {
  if (b.cov) return true;
  if (b.covShard === null) return false;
  const k = b.covShard;
  let p = shards.get(k);
  if (!p) {
    p = fetch(`${baseUrl}data/cov/${k}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for covariance file ${k}`);
      return r.json();
    });
    shards.set(k, p);
    p.catch(() => shards.delete(k)); // try again next time
  }
  const entry = (await p)[b.pdes];
  if (entry) b.cov = covarianceFrom(entry);
  return !!entry;
}

export const CLOUD_SAMPLES = 300;

/**
 * Whether we draw an uncertainty cloud: only when its covariance is in the files. The fetch puts it there
 * only for orbits fitted with gravity alone (6 parameters) whose cloud is within 0.8 to 1.25 times
 * Horizons' own position uncertainty (npm run check repeats this for every one). When JPL also fits
 * forces such as a comet's outgassing or the Yarkovsky push of sunlight (A1, A2, A3, DT, ...), our
 * Sun-only samples were 7 times too small to 10 times too large (Wild 2, Apophis).
 */
export const cloudPossible = (b: SmallBody) => b.covShard !== null;
export const hasCloud = (b: SmallBody) => cloudPossible(b) && !!b.cov;

const clouds = new Map<string, ReturnType<typeof sampleOrbits>>();
/** The possible orbits for a body's uncertainty cloud (cached, and the same every time). */
export function cloudSamples(b: SmallBody) {
  if (!hasCloud(b)) return [];
  let s = clouds.get(b.id);
  if (!s) { s = sampleOrbits(b.cov!, CLOUD_SAMPLES, seedFrom(b.id)); clouds.set(b.id, s); }
  return s;
}

/** Enlargement that makes a cloud `px` pixels across look about `target` pixels: 1, 2, 5, 10, 20, 50 ... */
export function cloudZoom(px: number, target: number): number {
  if (!(px > 0) || px >= target) return 1;
  const raw = target / px;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

const paths = new Map<string, Vec3[]>();
/** The orbit as a closed line (cached: the elements do not change). */
export function smallOrbitPath(b: SmallBody): Vec3[] {
  let p = paths.get(b.id);
  if (!p) { p = smallBodyOrbitPath(b.orbit, 360); paths.set(b.id, p); }
  return p;
}
