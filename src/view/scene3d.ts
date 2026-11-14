// 3D view of the solar system with Three.js.
// Same positions, orbits, views and distance scale as the 2D map, but the camera can turn:
// drag to rotate, mouse wheel or two fingers to zoom, double-click or the ↺ button to reset.
// Planets keep a fixed size on screen (like the dots in the 2D map), so they are not to scale.
// Thin vertical lines show how far each planet is above or below the ecliptic.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PlanetId } from '../astro/elements';
import { VIEWS, COLORS, radialScale, toScene, type BodyFrame, type ViewInfo, type ViewMode } from './views';

const R = 100;           // scene units at the edge of the view (view.rMax)
const FOV = 40;          // vertical field of view [deg]
const TILT = 52;         // starting camera angle from straight above [deg]
const DEG = Math.PI / 180;

// Radius of each planet on screen [px]
const SIZE_PX: Partial<Record<PlanetId, number>> = { jupiter: 7.5, saturn: 7, uranus: 6, neptune: 6 };
const DEFAULT_PX = 5;
const SUN_PX = 6;
const GLOW_PX = 22;

const HIT_RADIUS = 18;   // how close a tap must be to a planet to select it [px]
const DRAG_PX = 6;       // a pointer that moved more than this was a drag, not a tap

const GRID_COLOR = '#7882aa';

// A taken area on screen. `id` marks a planet's own dot, which must not hide its own name.
interface Box { x0: number; y0: number; x1: number; y1: number; id?: PlanetId; }
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

interface Planet {
  mesh: THREE.Mesh;
  orbit: THREE.LineLoop;
  drop: THREE.Line;
  label: Label;
  px: number;
}

interface Label { el: HTMLSpanElement; w: number; h: number; }

export class Scene3D {
  mode: ViewMode = 'compressed';
  selected: PlanetId | null = null;
  /** Called on a tap or click that was not a drag: the planet under it, or null. */
  onPick: ((id: PlanetId | null) => void) | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 5000);
  private readonly controls: OrbitControls;
  private readonly planets = new Map<PlanetId, Planet>();
  private readonly sun: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly grid = new THREE.Group();
  private readonly overlay: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private gridLabels: { pos: THREE.Vector3; label: Label }[] = [];
  private gridFor: ViewMode | null = null;
  private lastScreen: { id: PlanetId; x: number; y: number }[] = [];
  private readonly tmp = new THREE.Vector3();
  private w = 0;
  private h = 0;

  /** Throws if the browser has no WebGL. */
  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor('#070912');

    this.overlay = document.createElement('div');
    this.overlay.className = 'labels';
    this.ring = document.createElement('div');
    this.ring.className = 'pick';
    this.overlay.append(this.ring);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset3d';
    reset.textContent = '↺';
    reset.title = reset.ariaLabel = 'رجّع المنظر';
    reset.addEventListener('click', () => this.resetCamera());

    host.replaceChildren(this.renderer.domElement, this.overlay, reset);
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', 'مشهد ثلاثي الأبعاد للكواكب حول الشمس');

    // Light from the Sun (no fall-off with distance) and a little fill light for the night sides
    const light = new THREE.PointLight('#ffffff', 3.2, 0, 0);
    this.scene.add(light, new THREE.AmbientLight('#ffffff', 0.7));

    // Sun with a soft glow
    const ball = new THREE.SphereGeometry(1, 32, 16);
    this.sun = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: '#ffd65a' }));
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.scene.add(this.sun, this.glow, this.grid);

    // Planets, their orbits and the drop lines to the ecliptic
    for (const id of Object.keys(COLORS) as PlanetId[]) {
      const color = COLORS[id];
      const mesh = new THREE.Mesh(ball, new THREE.MeshLambertMaterial({ color }));
      const orbit = new THREE.LineLoop(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }),
      );
      const drop = new THREE.Line(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      // Their vertices move every frame, so skip the (stale) bounding-sphere culling
      orbit.frustumCulled = drop.frustumCulled = false;
      this.scene.add(mesh, orbit, drop);
      this.planets.set(id, { mesh, orbit, drop, label: this.label(''), px: SIZE_PX[id] ?? DEFAULT_PX });
    }

    // Camera: drag to turn around the Sun, zoom with wheel or pinch. No panning: the Sun stays in the middle.
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1500;
    canvas.addEventListener('dblclick', () => this.resetCamera());

    // Tap / click to select, but not at the end of a drag
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
    canvas.addEventListener('click', (ev) => {
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > DRAG_PX) return;
      const box = canvas.getBoundingClientRect();
      this.onPick?.(this.hitTest(ev.clientX - box.left, ev.clientY - box.top));
    });

    new ResizeObserver(() => this.resize(host)).observe(host);
    this.resize(host);
    this.resetCamera();
  }

  /** Back to the starting angle, with the whole view in the picture. */
  resetCamera() {
    const aspect = this.w > 0 && this.h > 0 ? this.w / this.h : 1;
    const half = Math.min(FOV / 2, Math.atan(Math.tan((FOV / 2) * DEG) * aspect) / DEG);
    const dist = (R * 1.1) / Math.tan(half * DEG);
    this.camera.position.set(0, dist * Math.cos(TILT * DEG), dist * Math.sin(TILT * DEG));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** The planet nearest to a point on the canvas (CSS pixels), or null if none is close. */
  hitTest(x: number, y: number): PlanetId | null {
    let best: PlanetId | null = null;
    let bestD = HIT_RADIUS;
    for (const p of this.lastScreen) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = p.id; }
    }
    return best;
  }

  draw(bodies: BodyFrame[]) {
    if (this.w === 0 || this.h === 0) return; // hidden
    const view = VIEWS[this.mode];
    if (this.gridFor !== this.mode) this.buildGrid(view);
    this.controls.update();

    for (const b of bodies) {
      const p = this.planets.get(b.id)!;
      if (!p.label.el.textContent) this.setText(p.label, b.name);

      const [x, y, z] = toScene(b.pos, view, R);
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(p.px * this.worldPerPixel(p.mesh.position));

      // Orbit line, resized if the number of points changes
      let pos = p.orbit.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos || pos.count !== b.orbit.length) {
        pos = new THREE.BufferAttribute(new Float32Array(b.orbit.length * 3), 3);
        p.orbit.geometry.setAttribute('position', pos);
      }
      b.orbit.forEach((v, i) => {
        const [ox, oy, oz] = toScene(v, view, R);
        pos.setXYZ(i, ox, oy, oz);
      });
      pos.needsUpdate = true;

      // Drop line from the planet straight down (or up) to the ecliptic plane
      const drop = p.drop.geometry.getAttribute('position') as THREE.BufferAttribute;
      drop.setXYZ(0, x, y, z);
      drop.setXYZ(1, x, 0, z);
      drop.needsUpdate = true;
    }

    const wpp = this.worldPerPixel(this.sun.position);
    this.sun.scale.setScalar(SUN_PX * wpp);
    this.glow.scale.setScalar(GLOW_PX * 2 * wpp);

    this.renderer.render(this.scene, this.camera);
    this.placeLabels(bodies);
  }

  // ---------- Helpers ----------

  private resize(host: HTMLElement) {
    const box = host.getBoundingClientRect();
    this.w = box.width;
    this.h = box.height;
    if (this.w === 0 || this.h === 0) return;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  /** Scene units per screen pixel at a point, so things can keep a fixed size on screen. */
  private worldPerPixel(at: THREE.Vector3): number {
    const d = this.camera.position.distanceTo(at);
    return (2 * d * Math.tan((FOV / 2) * DEG)) / this.h;
  }

  /** Screen position (CSS pixels) of a scene point, or null if it is behind the camera. */
  private toScreen(at: THREE.Vector3): { x: number; y: number } | null {
    const v = this.tmp.copy(at).project(this.camera);
    if (v.z < -1 || v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  /** Distance rings on the ecliptic plane, the equinox direction, and their labels. */
  private buildGrid(view: ViewInfo) {
    this.gridFor = this.mode;
    for (const obj of [...this.grid.children]) {
      (obj as THREE.Line).geometry.dispose();
      this.grid.remove(obj);
    }
    for (const g of this.gridLabels) g.label.el.remove();
    this.gridLabels = [];

    const ringMat = new THREE.LineBasicMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.3, depthWrite: false });
    for (const r of view.rings) {
      const s = radialScale(view, r) * R;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 128; i++) {
        const a = (2 * Math.PI * i) / 128;
        pts.push(new THREE.Vector3(s * Math.cos(a), 0, s * Math.sin(a)));
      }
      this.grid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
      // Value in au, on the near side of the ring (same spot as in the 2D map)
      const label = this.label(String(r), 'dim');
      this.gridLabels.push({ pos: new THREE.Vector3(s * Math.cos(0.9), 0, s * Math.sin(0.9)), label });
    }

    // Direction of the vernal equinox (ecliptic x axis)
    const end = R * 1.06;
    const axis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(end, 0, 0)]),
      new THREE.LineDashedMaterial({ color: GRID_COLOR, dashSize: 1.5, gapSize: 2.5, transparent: true, opacity: 0.55 }),
    );
    axis.computeLineDistances();
    this.grid.add(axis);
    this.gridLabels.push({ pos: new THREE.Vector3(end, 0, 0), label: this.label('الاعتدال', 'dim') });
  }

  private label(text: string, cls = ''): Label {
    const el = document.createElement('span');
    el.className = cls;
    this.overlay.append(el);
    const label = { el, w: 0, h: 0 };
    this.setText(label, text);
    return label;
  }

  private setText(label: Label, text: string) {
    label.el.textContent = text;
    label.w = 0; // measured again when next shown
  }

  /** Names next to the planets, skipped where they would overlap (like the 2D map). */
  private placeLabels(bodies: BodyFrame[]) {
    const taken: Box[] = [];
    const inside = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= this.w && b.y1 <= this.h;
    const measure = (label: Label) => {
      if (label.w === 0) { label.w = label.el.offsetWidth; label.h = label.el.offsetHeight; }
      return label;
    };
    const place = (label: Label, x: number, y: number, spots: [number, number][], owner?: PlanetId) => {
      for (const [dx, dy] of spots) {
        const box = { x0: x + dx - 2, y0: y + dy, x1: x + dx + label.w + 2, y1: y + dy + label.h };
        if (inside(box) && !taken.some((t) => (!owner || t.id !== owner) && overlaps(t, box))) {
          label.el.style.transform = `translate(${(x + dx).toFixed(1)}px, ${(y + dy).toFixed(1)}px)`;
          label.el.style.visibility = 'visible';
          taken.push(box);
          return;
        }
      }
      label.el.style.visibility = 'hidden';
    };

    // Planets on screen
    const onScreen: { b: BodyFrame; p: Planet; x: number; y: number }[] = [];
    this.lastScreen = [];
    for (const b of bodies) {
      const p = this.planets.get(b.id)!;
      const s = this.toScreen(p.mesh.position);
      if (!s) { p.label.el.style.visibility = 'hidden'; continue; }
      onScreen.push({ b, p, ...s });
      this.lastScreen.push({ id: b.id, ...s });
      taken.push({ x0: s.x - p.px - 5, y0: s.y - p.px - 5, x1: s.x + p.px + 5, y1: s.y + p.px + 5, id: b.id });
    }
    const sun = this.toScreen(this.sun.position);
    if (sun) taken.push({ x0: sun.x - SUN_PX - 2, y0: sun.y - SUN_PX - 2, x1: sun.x + SUN_PX + 2, y1: sun.y + SUN_PX + 2 });

    // Ring around the selected planet
    const sel = onScreen.find((o) => o.b.id === this.selected);
    this.ring.hidden = !sel;
    if (sel) {
      const d = (sel.p.px + 5) * 2;
      this.ring.style.width = this.ring.style.height = `${d}px`;
      this.ring.style.transform = `translate(${(sel.x - d / 2).toFixed(1)}px, ${(sel.y - d / 2).toFixed(1)}px)`;
    }

    // The selected planet gets its name first, then the others in order from the Sun
    const order = sel ? [sel, ...onScreen.filter((o) => o !== sel)] : onScreen;
    for (const { b, p, x, y } of order) {
      const { w, h } = measure(p.label);
      const g = p.px + 3;
      place(p.label, x, y, [
        [g, -h - 1], [g, 1], [-g - w, -h - 1], [-g - w, 1], [-w / 2, -h - g], [-w / 2, g],
      ], b.id);
    }

    // Ring values and the equinox, wherever there is room
    for (const { pos, label } of this.gridLabels) {
      const s = this.toScreen(pos);
      if (!s) { label.el.style.visibility = 'hidden'; continue; }
      const { w, h } = measure(label);
      place(label, s.x, s.y, [[3, -h / 2], [-w - 3, -h / 2], [-w / 2, 4]]);
    }
  }
}

/** A soft round glow for the Sun, drawn once on a small canvas. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 214, 90, 0.9)');
  g.addColorStop(0.35, 'rgba(255, 214, 90, 0.35)');
  g.addColorStop(1, 'rgba(255, 214, 90, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
