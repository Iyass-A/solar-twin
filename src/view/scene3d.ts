// 3D view of the solar system with Three.js.
// Same positions, orbits, views and distance scale as the 2D map, but the camera can turn:
// drag to rotate, mouse wheel or two fingers to zoom, double-click or the ↺ button to reset.
// Planets keep a fixed size on screen (like the dots in the 2D map), so they are not to scale.
// Thin vertical lines show how far each planet is above or below the ecliptic.
// "Follow" glides the camera to the selected planet and keeps it in the middle while time runs.
// Saturn has its rings, tilted like the real ones (IAU pole direction).
// Behind everything: the real stars down to magnitude 6 (loaded as a separate file, see stars.ts).
// Asteroids and comets are one layer of small dots; the selected one also gets a ball, its orbit,
// its height line and its name, like a planet, so it can be followed too, and its uncertainty cloud
// (enlarged when too small to see, with a label saying how much).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PlanetId } from '../astro/elements';
import type { Vec3 } from '../astro/kepler';
import { SATURN_POLE } from '../astro/poles';
import { numGrouped, t } from '../i18n';
import { makeStars, type StarData } from './stars';
import { SMALL_COLORS, cloudZoom, type SmallFrame, type SmallGroup } from './smallbodies';

const CLOUD_PX = 14; // the cloud's 1-sigma size on screen when it has to be enlarged (at least)
import { VIEWS, COLORS, radialScale, sceneAxes, toScene, type BodyFrame, type ViewInfo, type ViewMode } from './views';

const R = 100;           // scene units at the edge of the view (view.rMax)
const FOV = 40;          // vertical field of view [deg]
const TILT = 52;         // starting camera angle from straight above [deg]
const DEG = Math.PI / 180;

// Radius of each planet on screen [px]
const SIZE_PX: Partial<Record<string, number>> = { jupiter: 7.5, saturn: 7, uranus: 6, neptune: 6 };
const SMALL_PX: Record<SmallGroup, number> = { dwarf: 4, asteroid: 3, neo: 3, comet: 3 };
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
interface Box { x0: number; y0: number; x1: number; y1: number; id?: string; }
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
  onPick: ((id: string | null) => void) | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 5000);
  private readonly controls: OrbitControls;
  // The planets, plus the selected asteroid or comet while there is one (id "sb-...")
  private readonly planets = new Map<string, Planet>();
  private smallId: string | null = null;
  private readonly dots: THREE.Points;
  private readonly cloud: THREE.Points;
  private cloudLabel!: Label;
  private cloudOnScreen: { r: number } | null = null;
  private readonly sun: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly grid = new THREE.Group();
  private readonly overlay: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private gridLabels: { pos: THREE.Vector3; label: Label }[] = [];
  private gridFor: ViewMode | null = null;
  private lastScreen: { id: string; x: number; y: number; r: number }[] = [];
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private followText = '';
  private readonly followBtn: HTMLButtonElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly starsBtn: HTMLButtonElement;
  private stars: THREE.Points | null = null;
  private starsOn = true;
  private readonly names = new Map<string, string>();
  private sel: string | null = null;
  private following: string | null = null;
  private fly: Fly | null = null;
  private focusId: string | null = null; // the body drawn bigger
  private focusK = 0;                      // 0 = normal size, 1 = FOCUS_GROW
  private homeDist = 0;
  private lastDraw = 0;
  private w = 0;
  private h = 0;

  get selected(): string | null { return this.sel; }

  /** Selecting another planet while following moves the camera to it; selecting none stops. */
  set selected(id: string | null) {
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
    reset.addEventListener('click', () => this.resetCamera());
    this.resetBtn = reset;

    this.followBtn = document.createElement('button');
    this.followBtn.type = 'button';
    this.followBtn.className = 'follow3d';
    this.followBtn.hidden = true;
    this.followBtn.addEventListener('click', () => {
      if (this.following) this.stopFollow();
      else if (this.sel) this.startFollow(this.sel);
    });

    this.starsBtn = document.createElement('button');
    this.starsBtn.type = 'button';
    this.starsBtn.className = 'stars3d';
    this.starsBtn.textContent = '✦';
    this.starsBtn.setAttribute('aria-pressed', 'true');
    this.starsBtn.addEventListener('click', () => {
      this.starsOn = !this.starsOn;
      this.starsBtn.setAttribute('aria-pressed', String(this.starsOn));
      if (this.stars) this.stars.visible = this.starsOn;
    });

    host.replaceChildren(this.renderer.domElement, this.overlay, reset, this.followBtn, this.starsBtn);
    const canvas = this.renderer.domElement;

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

    // Asteroids and comets: one layer of round dots, sized in screen pixels
    this.dots = makeDots();
    this.cloud = makeDots();
    // The cloud is where the body could be: draw it over the ball, not hidden behind it
    (this.cloud.material as THREE.ShaderMaterial).depthTest = false;
    this.cloud.renderOrder = 10;
    this.scene.add(this.dots, this.cloud);

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
    this.refreshTexts();
    this.cloudLabel = this.label('', 'dim');

    // The star catalogue is its own file, so the scene shows first and the stars fade in after
    import('../data/stars.json')
      .then((m) => {
        this.stars = makeStars(m.default as StarData, this.renderer.getPixelRatio());
        this.stars.visible = this.starsOn;
        this.scene.add(this.stars);
      })
      .catch((err) => console.error('Stars not loaded', err));
  }

  /** After a language change: button texts, screen-reader labels and the grid labels. */
  refreshTexts() {
    const s = t();
    this.renderer.domElement.setAttribute('aria-label', s.sceneAria);
    this.resetBtn.title = this.resetBtn.ariaLabel = s.resetView;
    this.starsBtn.title = this.starsBtn.ariaLabel = s.stars;
    this.gridFor = null;   // rebuilt with the new "equinox" next frame
    this.followText = '';  // follow button rewritten next frame
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
  private startFollow(id: string) {
    if (this.focusId !== id) this.focusK = 0; // another body: it starts small and grows
    this.focusId = id;
    this.following = id;
    this.fly = {
      t: 0,
      fromTarget: this.controls.target.clone(),
      fromDist: this.camera.position.distanceTo(this.controls.target),
      toDist: NaN, // set once the body's position is known (a new asteroid appears on the next frame)
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
    const goal = (this.following && this.planets.get(this.following)?.mesh.position) || ORIGIN;
    let target: THREE.Vector3;
    let dist: number | null = null;
    if (this.fly) {
      const f = this.fly;
      if (Number.isNaN(f.toDist)) {
        if (goal === ORIGIN) return;                    // wait for the body to appear
        f.toDist = Math.max(6, 0.35 * goal.length());   // close enough to see the neighbourhood
      }
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
    const text = this.following ? t().stopFollow : this.sel ? t().follow(this.names.get(this.sel) ?? '') : '';
    if (text === this.followText) return;
    this.followText = text;
    this.followBtn.hidden = !text;
    this.followBtn.textContent = text;
    this.followBtn.classList.toggle('on', !!this.following);
  }

  /** The planet nearest to a point on the canvas (CSS pixels), or null if none is close. */
  hitTest(x: number, y: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const p of this.lastScreen) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < Math.max(HIT_RADIUS, p.r) && d < bestD) { bestD = d; best = p.id; }
    }
    return best;
  }

  draw(bodies: BodyFrame[], smalls: SmallFrame[] = [], selectedOrbit: { path: Vec3[]; color: string } | null = null,
    cloud: { offsets: Vec3[]; color: string } | null = null) {
    const now = performance.now();
    const dt = Math.min((now - this.lastDraw) / 1000, 0.1);
    this.lastDraw = now;
    if (this.w === 0 || this.h === 0) return; // hidden
    const view = VIEWS[this.mode];
    if (this.gridFor !== this.mode) this.buildGrid(view);

    for (const b of bodies) {
      const p = this.planets.get(b.id)!;
      if (p.label.el.textContent !== b.name) { this.setText(p.label, b.name); this.names.set(b.id, b.name); }

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

    // Asteroids and comets: the dot layer, and the selected one as a full body
    const view3 = (v: Vec3) => toScene(v, view, R);
    updateDots(this.dots, smalls.map((b) => ({ xyz: view3(b.pos), color: SMALL_COLORS[b.group], px: SMALL_PX[b.group] })),
      this.renderer.getPixelRatio());
    this.syncSmall(smalls, selectedOrbit, view3);

    // Camera after the bodies have moved, then the sizes on screen from the new camera
    this.updateFollow(dt);
    this.controls.update();
    if (this.stars) {
      this.stars.position.copy(this.camera.position); // always the same distance away: "at infinity"
      const fade = (this.stars.material as THREE.ShaderMaterial).uniforms.opacity;
      fade.value = Math.min(1, fade.value + dt / 0.8);
    }
    for (const [id, p] of this.planets) {
      p.grow = id === this.focusId ? 1 + (FOCUS_GROW - 1) * this.focusK : 1;
      p.mesh.scale.setScalar(p.px * p.grow * this.worldPerPixel(p.mesh.position));
    }
    this.updateCloud(cloud, smalls, view3);
    const wpp = this.worldPerPixel(this.sun.position);
    this.sun.scale.setScalar(SUN_PX * wpp);
    this.glow.scale.setScalar(GLOW_PX * 2 * wpp);

    this.renderer.render(this.scene, this.camera);
    this.placeLabels(smalls, view3);
    this.updateFollowButton();
  }

  // ---------- Helpers ----------

  /** The uncertainty cloud around the selected asteroid or comet, enlarged if it would be too small to see. */
  private updateCloud(cloud: { offsets: Vec3[]; color: string } | null, smalls: SmallFrame[],
    view3: (v: Vec3) => [number, number, number]) {
    const body = this.smallId ? this.planets.get(this.smallId) : undefined;
    const frame = smalls.find((b) => b.id === this.smallId);
    this.cloudOnScreen = null;
    if (!cloud || !cloud.offsets.length || !body?.mesh.visible || !frame) {
      this.cloud.visible = false;
      this.cloudLabel.el.style.visibility = 'hidden';
      return;
    }
    // Offsets in scene units, from exact (double precision) positions, then enlarged around the body
    const p = frame.pos;
    const c = view3(p);
    const d = cloud.offsets.map((o) => {
      const q = view3({ x: p.x + o.x, y: p.y + o.y, z: p.z + o.z });
      return [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    });
    const rms = Math.sqrt(d.reduce((sum, v) => sum + v[0] * v[0] + v[1] * v[1] + v[2] * v[2], 0) / d.length);
    const px = rms / this.worldPerPixel(body.mesh.position);
    const target = Math.max(CLOUD_PX, 2.5 * body.px * body.grow); // stay visible around a grown ball
    const zoom = cloudZoom(px, target);
    updateDots(this.cloud, d.map((v) => ({
      xyz: [c[0] + v[0] * zoom, c[1] + v[1] * zoom, c[2] + v[2] * zoom] as [number, number, number],
      color: cloud.color,
      px: 1.2,
    })), this.renderer.getPixelRatio());
    this.cloud.visible = true;
    const text = zoom === 1 ? t().trueSize : t().cloudZoom(numGrouped(zoom));
    if (this.cloudLabel.el.textContent !== text) this.setText(this.cloudLabel, text);
    this.cloudLabel.el.style.color = cloud.color;
    this.cloudOnScreen = { r: Math.max(px * zoom * 2, body.px * body.grow + 4) };
  }

  /** Keep the selected asteroid or comet as a full body (ball, orbit, height line, name). */
  private syncSmall(smalls: SmallFrame[], orbit: { path: Vec3[]; color: string } | null,
    view3: (v: Vec3) => [number, number, number]) {
    const wanted = this.sel?.startsWith('sb-') ? this.sel : null;
    if (this.smallId !== wanted) {
      if (this.smallId) {
        const old = this.planets.get(this.smallId)!;
        this.scene.remove(old.mesh, old.orbit, old.drop);
        old.orbit.geometry.dispose(); old.drop.geometry.dispose();
        (old.mesh.material as THREE.Material).dispose();
        old.label.el.remove();
        this.planets.delete(this.smallId);
      }
      this.smallId = wanted;
      if (wanted) {
        const color = orbit?.color ?? '#ffffff';
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshLambertMaterial({ color }));
        const line = new THREE.LineLoop(new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
        const drop = new THREE.Line(
          new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
        line.frustumCulled = drop.frustumCulled = false;
        this.scene.add(mesh, line, drop);
        const label = this.label('');
        label.el.style.color = color;
        const group = smalls.find((b) => b.id === wanted)?.group ?? 'asteroid';
        this.planets.set(wanted, { mesh, orbit: line, drop, label, px: SMALL_PX[group] + 1, extent: SMALL_PX[group] + 1, grow: 1 });
      }
    }
    if (!this.smallId) return;

    const p = this.planets.get(this.smallId)!;
    const frame = smalls.find((b) => b.id === this.smallId);
    const shown = !!frame && !!orbit;
    p.mesh.visible = p.orbit.visible = p.drop.visible = shown;
    if (!shown) {
      if (this.following === this.smallId) this.stopFollow(); // it left its valid years
      return;
    }
    if (p.label.el.textContent !== frame.label) { this.setText(p.label, frame.label); this.names.set(frame.id, frame.label); }
    const [x, y, z] = view3(frame.pos);
    p.mesh.position.set(x, y, z);

    let pos = p.orbit.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || pos.count !== orbit.path.length) {
      pos = new THREE.BufferAttribute(new Float32Array(orbit.path.length * 3), 3);
      p.orbit.geometry.setAttribute('position', pos);
    }
    orbit.path.forEach((v, i) => { const [ox, oy, oz] = view3(v); pos.setXYZ(i, ox, oy, oz); });
    pos.needsUpdate = true;
    const drop = p.drop.geometry.getAttribute('position') as THREE.BufferAttribute;
    drop.setXYZ(0, x, y, z);
    drop.setXYZ(1, x, 0, z);
    drop.needsUpdate = true;
  }

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
    this.gridLabels.push({ pos: new THREE.Vector3(end, 0, 0), label: this.label(t().equinox, 'dim') });
  }

  private label(text: string, cls = ''): Label {
    const el = document.createElement('span');
    el.className = cls;
    el.dir = 'auto'; // "2024 YR4" keeps its order on an Arabic page
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
  private placeLabels(smalls: SmallFrame[], view3: (v: Vec3) => [number, number, number]) {
    const taken: Box[] = [];
    const inside = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= this.w && b.y1 <= this.h;
    const measure = (label: Label) => {
      if (label.w === 0) { label.w = label.el.offsetWidth; label.h = label.el.offsetHeight; }
      return label;
    };
    const place = (label: Label, x: number, y: number, spots: [number, number][], owner?: string) => {
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

    // Bodies on screen: the planets, and the selected asteroid or comet
    const onScreen: { id: string; p: Planet; x: number; y: number }[] = [];
    this.lastScreen = [];
    for (const [id, p] of this.planets) {
      const s = p.mesh.visible ? this.toScreen(p.mesh.position) : null;
      if (!s) { p.label.el.style.visibility = 'hidden'; continue; }
      onScreen.push({ id, p, ...s });
      this.lastScreen.push({ id, ...s, r: p.px * p.grow + 4 });
      const e = p.extent * p.grow + 5;
      taken.push({ x0: s.x - e, y0: s.y - e, x1: s.x + e, y1: s.y + e, id });
    }
    // Every asteroid and comet dot can be tapped
    for (const b of smalls) {
      const [x, y, z] = view3(b.pos);
      const s = this.toScreen(this.tmp2.set(x, y, z));
      if (s) this.lastScreen.push({ id: b.id, ...s, r: 0 });
    }
    const sun = this.toScreen(this.sun.position);
    if (sun) taken.push({ x0: sun.x - SUN_PX - 2, y0: sun.y - SUN_PX - 2, x1: sun.x + SUN_PX + 2, y1: sun.y + SUN_PX + 2 });

    // Ring around the selected body
    const sel = onScreen.find((o) => o.id === this.selected);
    this.ring.hidden = !sel;
    if (sel) {
      const d = (sel.p.extent * sel.p.grow + 5) * 2;
      this.ring.style.width = this.ring.style.height = `${d}px`;
      this.ring.style.transform = `translate(${(sel.x - d / 2).toFixed(1)}px, ${(sel.y - d / 2).toFixed(1)}px)`;
    }

    // The selected body gets its name first, then the planets in order from the Sun
    const order = sel ? [sel, ...onScreen.filter((o) => o !== sel)] : onScreen;
    for (const { id, p, x, y } of order) {
      const { w, h } = measure(p.label);
      const g = p.extent * p.grow + (id === this.selected ? 8 : 3); // clear of the selection circle
      place(p.label, x, y, [
        [g, -h - 1], [g, 1], [-g - w, -h - 1], [-g - w, 1], [-w / 2, -h - g], [-w / 2, g],
      ], id);
    }

    // How much the uncertainty cloud is enlarged, under or above it
    const cloudAt = this.cloudOnScreen && onScreen.find((o) => o.id === this.smallId);
    if (cloudAt && this.cloudOnScreen) {
      const { w, h } = measure(this.cloudLabel);
      const r = this.cloudOnScreen.r;
      place(this.cloudLabel, cloudAt.x, cloudAt.y, [[-w / 2, r + 4], [-w / 2, -r - 4 - h]]);
    } else {
      this.cloudLabel.el.style.visibility = 'hidden';
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

// ---------- Dots for asteroids and comets ----------

const DOT_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 dotColor;
  uniform float pixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = dotColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * 2.0 * pixelRatio;
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.7, 1.0, d);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function makeDots(): THREE.Points {
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    vertexShader: DOT_VERTEX,
    fragmentShader: DOT_FRAGMENT,
    uniforms: { pixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
  }));
  points.frustumCulled = false;
  return points;
}

/** Put the dots where the bodies are now; buffers grow when needed. Colours are sRGB, like the CSS ones. */
function updateDots(points: THREE.Points, dots: { xyz: [number, number, number]; color: string; px: number }[], pixelRatio: number) {
  const g = points.geometry;
  let pos = g.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count < dots.length) {
    const n = Math.max(dots.length, 64);
    g.setAttribute('position', pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('dotColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
  }
  const col = g.getAttribute('dotColor') as THREE.BufferAttribute;
  const size = g.getAttribute('size') as THREE.BufferAttribute;
  const c = new THREE.Color();
  dots.forEach((d, i) => {
    pos!.setXYZ(i, d.xyz[0], d.xyz[1], d.xyz[2]);
    c.setStyle(d.color, THREE.SRGBColorSpace);
    col.setXYZ(i, c.r, c.g, c.b);
    size.setX(i, d.px);
  });
  pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
  g.setDrawRange(0, dots.length);
  (points.material as THREE.ShaderMaterial).uniforms.pixelRatio.value = pixelRatio;
}
