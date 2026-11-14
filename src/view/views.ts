// Shared by the 2D map and the 3D scene: view modes, colours and the distance scale.
// No DOM or Three.js here, so `npm run check` can test it in Node.

import type { PlanetId } from '../astro/elements';
import type { Vec3 } from '../astro/kepler';

export type ViewMode = 'compressed' | 'true' | 'inner';

export interface ViewInfo {
  label: string;
  caption: string;
  rMax: number;        // au shown at the edge (zoom 1)
  compressed: boolean; // square-root distances: true directions, squeezed distances
  rings: number[];     // distance rings to draw [au]
}

export const VIEWS: Record<ViewMode, ViewInfo> = {
  compressed: {
    label: 'كل الكواكب، مسافات مضغوطة',
    caption: 'المسافات مضغوطة لحتى يبينوا كل الكواكب، بس الاتجاهات صحيحة.',
    rMax: 31, compressed: true, rings: [1, 5, 10, 20, 30],
  },
  true: {
    label: 'كل الكواكب، مسافات حقيقية',
    caption: 'المسافات حقيقية. الكواكب الداخلية بتبين قريبة كتير من الشمس.',
    rMax: 31, compressed: false, rings: [5, 10, 20, 30],
  },
  inner: {
    label: 'الكواكب الداخلية، مسافات حقيقية',
    caption: 'المسافات حقيقية، لحد مدار المريخ.',
    rMax: 1.75, compressed: false, rings: [0.5, 1, 1.5],
  },
};

export interface BodyFrame {
  id: PlanetId;
  name: string;
  pos: Vec3;
  orbit: Vec3[];
}

export const COLORS: Record<PlanetId, string> = {
  mercury: '#b5b5b5',
  venus: '#e8c77a',
  earth: '#4f9dff',
  mars: '#e0603a',
  jupiter: '#d9a46c',
  saturn: '#e3cf8f',
  uranus: '#8fd8e0',
  neptune: '#6b85ff',
};

/** Distance from the Sun [au] -> fraction of the view radius (1 at view.rMax). */
export function radialScale(view: ViewInfo, r: number): number {
  return view.compressed ? Math.sqrt(r / view.rMax) : r / view.rMax;
}

/**
 * Position [au, J2000 ecliptic] -> 3D scene coordinates, with the view radius = R.
 * Distances are scaled like the 2D map, directions stay exact.
 * Three.js has y up, so: ecliptic x -> x, ecliptic z (north) -> y, ecliptic y -> -z.
 */
export function toScene(v: Vec3, view: ViewInfo, R: number): [number, number, number] {
  const r = Math.hypot(v.x, v.y, v.z);
  if (r === 0) return [0, 0, 0];
  const s = (radialScale(view, r) * R) / r;
  return [v.x * s, v.z * s, -v.y * s];
}
