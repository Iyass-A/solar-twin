// Background stars for the 3D scene: every star of the Yale Bright Star Catalogue down to
// magnitude 6, which is about what the eye sees on a dark night (src/data/stars.json).
// Real directions (J2000), brightness and colour. The layer moves with the camera, so the
// stars stay "at infinity": they turn with the view but never come closer.

import * as THREE from 'three';
import { equatorialToEcliptic } from '../astro/frames';
import { sceneAxes } from './views';

// Distance of the star sphere from the camera [scene units]: behind every planet, inside camera.far.
export const STAR_RADIUS = 4000;

export interface StarData { stars: number[]; } // flat list: ra, dec, mag, kelvin, ...

const VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 starColor;
  uniform float pixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = starColor;
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelRatio;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 in the middle, 1 at the edge
    float a = smoothstep(1.0, 0.3, d);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor, a * vAlpha * opacity);
  }
`;

/** On-screen size [CSS px] and opacity for a magnitude. Each magnitude is 2.5 times fainter. */
export function starLook(mag: number): { size: number; alpha: number } {
  const size = Math.min(6.5, Math.max(1.6, 2.8 * Math.pow(10, -0.2 * (mag - 1))));
  const alpha = Math.min(1, Math.max(0.3, Math.pow(10, -0.4 * (mag - 2.8))));
  return { size, alpha };
}

/** Approximate colour of a star of a given temperature [K], as sRGB 0..1, softened towards white. */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  if (!kelvin) return [1, 1, 1];
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => 0.55 * Math.min(1, Math.max(0, v / 255)) + 0.45; // stars look mostly white to the eye
  return [c(r), c(g), c(b)];
}

export function makeStars(data: StarData, pixelRatio: number): THREE.Points {
  const n = data.stars.length / 4;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [ra, dec, mag, kelvin] = data.stars.slice(i * 4, i * 4 + 4);
    const [x, y, z] = sceneAxes(equatorialToEcliptic(ra, dec));
    pos.set([x * STAR_RADIUS, y * STAR_RADIUS, z * STAR_RADIUS], i * 3);
    col.set(kelvinToRgb(kelvin), i * 3);
    const look = starLook(mag);
    size[i] = look.size;
    alpha[i] = look.alpha;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('starColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { pixelRatio: { value: pixelRatio }, opacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.renderOrder = -1; // first, so orbits and labels draw over the stars
  return points;
}
