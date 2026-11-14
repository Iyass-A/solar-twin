// 3D view of the solar system with Three.js.
// Same positions, orbits, views and distance scale as the 2D map, but the camera can turn:
// drag to rotate, mouse wheel or two fingers to zoom, double-click or the ↺ button to reset.
// Planets keep a fixed size on screen (like the dots in the 2D map), so they are not to scale.
// Thin vertical lines show how far each planet is above or below the ecliptic.
// "Follow" glides the camera to the selected planet and keeps it in the middle while time runs.
// Saturn has its rings, tilted like the real ones (IAU pole direction).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PlanetId } from '../astro/elements';
import { SATURN_POLE } from '../astro/poles';
import { VIEWS, COLORS, radialScale, sceneAxes, toScene, type BodyFrame, type ViewInfo, type ViewMode } from './views';

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

const FLY_SECONDS = 0.9; // how long the camera takes to glide to a planet or back to the Sun
const FOCUS_GROW = 4;    // the followed planet is drawn this many times bigger (sizes are not real anyway)

// Saturn's rings in Saturn radii (60,268 km): C ring inner edge to A ring outer edge
const RING_INNER = 1.239;
const RING_OUTER = 2.269;

/** A camera glide: from where the target was, to the goal, changing the distance on the way. */
interface Fly { t: number; fromTarget: THREE.Vector3; fromDist: number; toDist: number; }

// A taken area on screen. `id` marks a planet's own dot, which must not hide its own name.
interface Box { x0: number; y0: number; x1: number; y1: number; id?: PlanetId; }
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

interface Planet {
  mesh: THREE.Mesh;
  orbit: THREE.LineLoop;
  drop: THREE.Line;
  label: Label;
  px: number;      // radius of the ball on screen [px]
  extent: number;  // radius with rings, for labels and the selection circle [px]
  grow: number;    // 1, or up to FOCUS_GROW while followed
}

interface Label { el: HTMLSpanElement; w: number; h: number; }

export class Scene3D {
  mode: ViewMode = 'compressed';
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
  private lastScreen: { id: PlanetId; x: number; y: number; r: number }[] = [];
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private followText = '';
  private readonly followBtn: HTMLButtonElement;
  private readonly names = new Map<PlanetId, string>();
  private sel: PlanetId | null = null;
  private following: PlanetId | null = null;
  private fly: Fly | null = null;
  private focusId: PlanetId | null = null; // the planet drawn bigger
  private focusK = 0;                      // 0 = normal size, 1 = FOCUS_GROW
  private homeDist = 0;
  private lastDraw = 0;
  private w = 0;
  private h = 0;

  get selected(): PlanetId | null { return this.sel; }

  /** Selecting another planet while following moves the camera to it; selecting none stops. */
  set selected(id: PlanetId | null) {
    this.sel = id;
    if (this.following && id !== this.following) {
      if (id) this.startFollow(id); else this.stopFollow();
    }
  }

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

    this.followBtn = document.createElement('button');
    this.followBtn.type = 'button';
    this.followBtn.className = 'follow3d';
    this.followBtn.hidden = true;
    this.followBtn.addEventListener('click', () => {
      if (this.following) this.stopFollow();
      else if (this.sel) this.startFollow(this.sel);
    });

    host.replaceChildren(this.renderer.domElement, this.overlay, reset, this.followBtn);
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
      const px = SIZE_PX[id] ?? DEFAULT_PX;
      let extent = px;
      if (id === 'saturn') {
        mesh.add(saturnRings()); // a child, so it grows and shrinks with the ball
        extent = px * RING_OUTER;
      }
      this.planets.set(id, { mesh, orbit, drop, label: this.label(''), px, extent, grow: 1 });
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

  /** Back to the starting angle, with the whole view in the picture. Stops following. */
  resetCamera() {
    this.following = null;
    this.fly = null;
    this.focusK = 0;
    const aspect = this.w > 0 && this.h > 0 ? this.w / this.h : 1;
    const half = Math.min(FOV / 2, Math.atan(Math.tan((FOV / 2) * DEG) * aspect) / DEG);
    const dist = (R * 1.1) / Math.tan(half * DEG);
    this.homeDist = dist;
    this.camera.position.set(0, dist * Math.cos(TILT * DEG), dist * Math.sin(TILT * DEG));
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Glide to a planet and keep it in the middle. Turning and zooming still work around it. */
  private startFollow(id: PlanetId) {
    const goal = this.planets.get(id)!.mesh.position;
    if (this.focusId !== id) this.focusK = 0; // another planet: it starts small and grows
    this.focusId = id;
    this.following = id;
    this.fly = {
      t: 0,
      fromTarget: this.controls.target.clone(),
      fromDist: this.camera.position.distanceTo(this.controls.target),
      toDist: Math.max(6, 0.35 * goal.length()), // close enough to see the neighbourhood
    };
  }

  /** Glide back to the Sun, at the starting distance, keeping the current angle. */
  private stopFollow() {
    this.following = null;
    this.fly = {
      t: 0,
      fromTarget: this.controls.target.clone(),
      fromDist: this.camera.position.distanceTo(this.controls.target),
      toDist: this.homeDist,
    };
  }

  /** Move the camera with its target: during a glide, or every frame while following. */
  private updateFollow(dt: number) {
    const goal = this.following ? this.planets.get(this.following)!.mesh.position : ORIGIN;
    let target: THREE.Vector3;
    let dist: number | null = null;
    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt / FLY_SECONDS);
      const e = f.t * f.t * (3 - 2 * f.t); // smooth start and stop
      target = this.tmp.copy(f.fromTarget).lerp(goal, e);
      dist = f.fromDist + (f.toDist - f.fromDist) * e;
      this.focusK = this.following ? Math.max(this.focusK, e) : Math.min(this.focusK, 1 - e);
      if (f.t >= 1) this.fly = null;
    } else if (this.following) {
      target = goal;
      this.focusK = 1;
    } else {
      this.focusK = 0;
      return;
    }
    // Keep the camera's direction from the target, so the user's turning is kept
    const offset = this.tmp2.copy(this.camera.position).sub(this.controls.target);
    if (dist !== null) offset.setLength(dist);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
  }

  /** The button shows only with a selected planet: "follow <name>", or "stop" while following. */
  private updateFollowButton() {
    const text = this.following ? 'وقّف الملاحقة' : this.sel ? `لاحق ${this.names.get(this.sel) ?? ''}` : '';
    if (text === this.followText) return;
    this.followText = text;
    this.followBtn.hidden = !text;
    this.followBtn.textContent = text;
    this.followBtn.classList.toggle('on', !!this.following);
  }

  /** The planet nearest to a point on the canvas (CSS pixels), or null if none is close. */
  hitTest(x: number, y: number): PlanetId | null {
    let best: PlanetId | null = null;
    let bestD = Infinity;
    for (const p of this.lastScreen) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < Math.max(HIT_RADIUS, p.r) && d < bestD) { bestD = d; best = p.id; }
    }
    return best;
  }

  draw(bodies: BodyFrame[]) {
    const now = performance.now();
    const dt = Math.min((now - this.lastDraw) / 1000, 0.1);
    this.lastDraw = now;
    if (this.w === 0 || this.h === 0) return; // hidden
    const view = VIEWS[this.mode];
    if (this.gridFor !== this.mode) this.buildGrid(view);

    for (const b of bodies) {
      const p = this.planets.get(b.id)!;
      if (!p.label.el.textContent) { this.setText(p.label, b.name); this.names.set(b.id, b.name); }

      const [x, y, z] = toScene(b.pos, view, R);
      p.mesh.position.set(x, y, z);

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

    // Camera after the planets have moved, then the sizes on screen from the new camera
    this.updateFollow(dt);
    this.controls.update();
    for (const [id, p] of this.planets) {
      p.grow = id === this.focusId ? 1 + (FOCUS_GROW - 1) * this.focusK : 1;
      p.mesh.scale.setScalar(p.px * p.grow * this.worldPerPixel(p.mesh.position));
    }
    const wpp = this.worldPerPixel(this.sun.position);
    this.sun.scale.setScalar(SUN_PX * wpp);
    this.glow.scale.setScalar(GLOW_PX * 2 * wpp);

    this.renderer.render(this.scene, this.camera);
    this.placeLabels(bodies);
    this.updateFollowButton();
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
      this.lastScreen.push({ id: b.id, ...s, r: p.px * p.grow + 4 });
      const e = p.extent * p.grow + 5;
      taken.push({ x0: s.x - e, y0: s.y - e, x1: s.x + e, y1: s.y + e, id: b.id });
    }
    const sun = this.toScreen(this.sun.position);
    if (sun) taken.push({ x0: sun.x - SUN_PX - 2, y0: sun.y - SUN_PX - 2, x1: sun.x + SUN_PX + 2, y1: sun.y + SUN_PX + 2 });

    // Ring around the selected planet
    const sel = onScreen.find((o) => o.b.id === this.selected);
    this.ring.hidden = !sel;
    if (sel) {
      const d = (sel.p.extent * sel.p.grow + 5) * 2;
      this.ring.style.width = this.ring.style.height = `${d}px`;
      this.ring.style.transform = `translate(${(sel.x - d / 2).toFixed(1)}px, ${(sel.y - d / 2).toFixed(1)}px)`;
    }

    // The selected planet gets its name first, then the others in order from the Sun
    const order = sel ? [sel, ...onScreen.filter((o) => o !== sel)] : onScreen;
    for (const { b, p, x, y } of order) {
      const { w, h } = measure(p.label);
      const g = p.extent * p.grow + 3;
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

const ORIGIN = new THREE.Vector3(0, 0, 0);

/**
 * Saturn's rings around a ball of radius 1, facing along Saturn's real pole.
 * Brightness by ring: C faint, B bright, Cassini Division nearly empty, A medium.
 */
function saturnRings(): THREE.Mesh {
  const geo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 128, 1);
  // Texture coordinate u runs from the inner to the outer edge, so the bands are circles
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - RING_INNER) / (RING_OUTER - RING_INNER), 0.5);
  }

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext('2d')!;
  const bands: [number, number, number][] = [ // [from, to] in Saturn radii, opacity
    [1.239, 1.527, 0.28],  // C ring
    [1.527, 1.951, 0.9],   // B ring
    [1.951, 2.027, 0.08],  // Cassini Division
    [2.027, 2.269, 0.65],  // A ring
  ];
  const toPx = (r: number) => ((r - RING_INNER) / (RING_OUTER - RING_INNER)) * c.width;
  for (const [from, to, alpha] of bands) {
    ctx.fillStyle = `rgba(222, 205, 160, ${alpha})`;
    ctx.fillRect(toPx(from), 0, toPx(to) - toPx(from), 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }));
  // RingGeometry faces +z; turn it to face Saturn's pole
  const [px, py, pz] = sceneAxes(SATURN_POLE);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(px, py, pz).normalize());
  return mesh;
}
