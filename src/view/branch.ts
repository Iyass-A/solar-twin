// "Branch reality" (phase 5): a card where the visitor takes a copy of the solar system at the time
// on screen, changes one thing, and sees the copy's planets (as empty circles, with their recent
// path and a line to the real planet) run on in the views. The physics runs in a Web Worker
// (src/physics/), started only when the card is first used.
//
// The real planets stay as the site draws them (Kepler); the branch starts from the engine's own
// reality at the same moment, which agrees with them within 0.02° (see scripts/check-physics.ts).
// For the numbers, the engine's reality runs on next to the branch ("control"): the same calculation
// without the change, so every difference in the table comes from the change alone.

import { Physics } from '../physics/client';
import { utcMsToTdbJd, type Edit } from '../physics/protocol';
import { orbitOf } from '../physics/orbit';
import { AU_KM, SUN_GM } from '../physics/bodies';
import { PLANETS, type PlanetId } from '../astro/elements';
import type { Vec3 } from '../astro/kepler';
import { COLORS } from './views';
import { t, num, numGrouped, dayMonth, type Strings } from '../i18n';

type Action = 'remove' | 'mass' | 'push' | 'star';

/** What the views draw for the branch: each body's position (from the Sun) and its recent path. */
export interface Ghost { id: string; pos: Vec3; color: string; trail: Vec3[] }

// The passing star: closest after this long, at this speed, in the ecliptic plane
const STAR_YEARS = 10; // so that the closest pass is still on the timeline (up to 2050)
const STAR_KMS = 20;
const STAR_COLOR = '#fff2c8';
const TRAIL_POINTS = 1200;
// The path behind each body is drawn only while time runs on smoothly: a bigger jump starts it afresh
// (a straight line across a jump would look like a path the body never took)
const TRAIL_GAP_DAYS = 30;
const DAY_MS = 86_400_000;

const DEFAULTS: Record<Action, number> = { remove: 0, mass: 2, push: 5, star: 1 };

/** A sim's state as the table needs it: positions, velocities and masses, by id. */
interface Snapshot { jd: number; ids: string[]; gm: number[]; r: Float64Array; v: Float64Array }

export class BranchCard {
  /** Called when the branch starts or ends (the page redraws its legend and caption). */
  onChange: (() => void) | null = null;
  /** Called to move the time on screen (the button that goes back to where the branch began). */
  onJump: ((ms: number) => void) | null = null;

  private physics: Physics | null = null;
  private realAt: number | null = null; // where the engine's "real" sim is (JD)
  private realGm: { ids: string[]; gm: number[] } | null = null;
  private branchGm: number[] = [];
  private control: Snapshot | null = null; // the engine's reality at the same time as the branch
  private snap: Snapshot | null = null;    // the branch, as the table needs it
  private active: { forkMs: number; ids: string[]; action: Action; target: string; value: number; star?: number } | null = null;
  private state: { jd: number; r: Float64Array; ids: string[] } | null = null;
  private asked: number | null = null;   // the time last asked of the worker [JD]
  private inFlight = false;
  private busy = false;                  // forking
  private progressYear: string | null = null;
  private trails = new Map<string, Vec3[]>();
  private lastTrailJd = -Infinity;
  private error: string | null = null;

  private readonly el: {
    intro: HTMLElement; action: HTMLSelectElement; target: HTMLSelectElement; value: HTMLInputElement;
    targetLabel: HTMLElement; valueLabel: HTMLElement; valueText: HTMLElement; extra: HTMLElement; extraText: HTMLElement;
    extraValue: HTMLInputElement; hint: HTMLElement; go: HTMLButtonElement; status: HTMLElement; what: HTMLElement;
    progress: HTMLElement; legend: HTMLElement; reset: HTMLButtonElement; jump: HTMLButtonElement;
    compare: HTMLElement; compareTitle: HTMLElement; table: HTMLTableElement; note: HTMLElement;
  };

  private readonly clockMs: () => { ms: number; min: number; max: number };
  private gen = 0; // counts forks and stops, so a late answer for an old branch is ignored

  constructor(root: HTMLElement, clockMs: () => { ms: number; min: number; max: number }) {
    this.clockMs = clockMs;
    root.innerHTML = `
      <h2 class="card-title"><span class="br-title"></span> <span class="badge br-badge"></span></h2>
      <p class="sub br-intro"></p>
      <div class="row br-form">
        <label><span class="br-action-label"></span> <select class="br-action">
          ${(['remove', 'mass', 'push', 'star'] as Action[]).map((a) => `<option value="${a}"></option>`).join('')}
        </select></label>
        <label class="br-target-label"><span class="br-body-label"></span> <select class="br-target"></select></label>
        <label class="br-value-label"><span class="br-value-text"></span> <input class="br-value" type="number" step="any" dir="ltr"></label>
        <label class="br-extra" hidden><span class="br-extra-text"></span> <input class="br-extra-value" type="number" step="any" min="0.1" dir="ltr"></label>
        <button type="button" class="br-go"></button>
      </div>
      <p class="sub br-hint"></p>
      <div class="br-status" hidden>
        <p class="br-what"></p>
        <p class="sub br-progress"></p>
        <p class="sub br-legend"></p>
        <div class="br-compare" hidden>
          <h3 class="br-compare-title"></h3>
          <div class="br-table-wrap"><table class="br-table"></table></div>
          <p class="sub br-note"></p>
        </div>
        <div class="row br-buttons"><button type="button" class="br-jump"></button> <button type="button" class="br-reset"></button></div>
      </div>`;
    const q = <T extends HTMLElement>(c: string) => root.querySelector<T>(c)!;
    this.el = {
      intro: q('.br-intro'), action: q('.br-action'), target: q('.br-target'), value: q('.br-value'),
      targetLabel: q('.br-target-label'), valueLabel: q('.br-value-label'), valueText: q('.br-value-text'),
      extra: q('.br-extra'), extraText: q('.br-extra-text'), extraValue: q('.br-extra-value'), hint: q('.br-hint'),
      go: q('.br-go'), status: q('.br-status'), what: q('.br-what'), progress: q('.br-progress'), legend: q('.br-legend'),
      reset: q('.br-reset'), jump: q('.br-jump'), compare: q('.br-compare'), compareTitle: q('.br-compare-title'),
      table: q('.br-table'), note: q('.br-note'),
    };
    this.el.action.addEventListener('change', () => { this.el.value.value = String(DEFAULTS[this.action()]); this.render(); });
    this.el.value.value = String(DEFAULTS.remove);
    this.el.extraValue.value = '50';
    this.el.go.addEventListener('click', () => void this.fork());
    this.el.reset.addEventListener('click', () => this.stop());
    this.el.jump.addEventListener('click', () => { if (this.active) this.onJump?.(this.active.forkMs); });
    this.render();
  }

  get isActive() { return this.active !== null; }

  private action = () => this.el.action.value as Action;

  /** Texts in the current language, and which fields the chosen change needs. */
  render() {
    const s = t(), b = s.branch, root = this.el.intro.parentElement!;
    root.querySelector('.br-title')!.textContent = b.title;
    root.querySelector('.br-badge')!.textContent = b.badge;
    root.querySelector('.br-action-label')!.textContent = b.action;
    root.querySelector('.br-body-label')!.textContent = b.body;
    this.el.intro.textContent = b.intro;
    this.el.action.querySelectorAll('option').forEach((o) => { o.textContent = b.actions[o.value as Action]; });
    const a = this.action();
    // Who can be changed: the planets; for a mass also the Sun
    const keep = this.el.target.value;
    const targets: [string, string][] = [...(a === 'mass' ? [['sun', b.sun] as [string, string]] : []), ...PLANETS.map((p) => [p.id, s.planets[p.id]] as [string, string])];
    this.el.target.replaceChildren(...targets.map(([id, name]) => { const o = document.createElement('option'); o.value = id; o.textContent = name; return o; }));
    this.el.target.value = targets.some(([id]) => id === keep) ? keep : a === 'mass' ? 'sun' : 'jupiter';
    this.el.targetLabel.hidden = a === 'star';
    this.el.valueLabel.hidden = a === 'remove';
    this.el.extra.hidden = a !== 'star';
    this.el.valueText.textContent = a === 'mass' ? b.factor : a === 'push' ? b.speed : b.starMass;
    this.el.extraText.textContent = b.starDistance;
    this.el.value.min = a === 'push' ? '' : '0';
    this.el.hint.textContent = a === 'push' ? b.pushHint : a === 'star' ? b.starNote : '';
    this.el.hint.hidden = !this.el.hint.textContent;
    this.el.go.textContent = b.go;
    this.el.go.disabled = this.busy;
    this.el.reset.textContent = b.reset;
    this.el.jump.textContent = b.jump;
    this.el.legend.textContent = b.legend;
    this.el.compareTitle.textContent = b.compare.title;
    this.el.note.textContent = b.compare.note;
    this.renderStatus();
  }

  private name(id: string, s: Strings = t()) {
    return id === 'sun' ? s.branch.sun : s.planets[id as PlanetId] ?? id;
  }

  private renderStatus() {
    const s = t(), b = s.branch, act = this.active;
    this.el.status.hidden = !act && !this.error;
    this.el.jump.hidden = !act;
    if (this.error) {
      this.el.what.textContent = b.error(this.error); this.el.progress.textContent = '';
      this.el.legend.hidden = true; this.el.compare.hidden = true; return;
    }
    if (!act) return;
    this.el.legend.hidden = false;
    const fmt = (v: number) => num(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 1 : 0);
    const what = act.action === 'remove' ? b.what.remove(this.name(act.target))
      : act.action === 'mass' ? b.what.mass(this.name(act.target), fmt(act.value))
      : act.action === 'push' ? b.what.push(this.name(act.target), fmt(Math.abs(act.value)), act.value > 0)
      : b.what.star(fmt(act.value), `${num(act.star!, 0)} ${s.au}`);
    const date = `${dayMonth(act.forkMs)} ${new Date(act.forkMs).getUTCFullYear()}`;
    this.el.what.textContent = `${what} · ${b.from(date)}`;
    const now = this.clockMs().ms;
    this.el.progress.textContent = now < act.forkMs ? b.before(date) : this.progressYear ? b.computing(this.progressYear) : '';
    this.renderTable(now >= act.forkMs);
  }

  /**
   * The comparison: for each planet (and a passing star) its year on its orbit now, its distance from
   * the Sun, and how far it is from where it would be without the change; the real value under each.
   */
  private renderTable(show: boolean) {
    const br = this.snap, ctl = this.control;
    this.el.compare.hidden = !show || !br || !ctl;
    if (!show || !br || !ctl) return;
    const s = t(), c = s.branch.compare;
    // Position and velocity relative to the Sun, and the orbit around it
    const rel = (x: Snapshot, id: string) => {
      const i = x.ids.indexOf(id), sun = x.ids.indexOf('sun');
      if (i < 0) return null;
      const d = (a: Float64Array, k: number) => a[3 * i + k] - (sun >= 0 ? a[3 * sun + k] : 0);
      const dr = [d(x.r, 0), d(x.r, 1), d(x.r, 2)], dv = [d(x.v, 0), d(x.v, 1), d(x.v, 2)];
      return { dr, orbit: orbitOf((sun >= 0 ? x.gm[sun] : 0) + x.gm[i], dr, dv) };
    };
    const year = (days: number | null) => {
      if (days === null) return c.escapes;
      if (days < 730) return c.days(num(days, 0));
      const y = days / 365.25;
      return c.years(num(y, y < 100 ? 1 : 0));
    };
    const dist = (au: number) => `${num(au, au < 10 ? 2 : au < 100 ? 1 : 0)} ${s.au}`;
    const apart = (au: number) => {
      const km = au * AU_KM;
      if (km < 1e6) return `${numGrouped(km)} ${s.km}`;
      if (km < 1e9) return `${num(km / 1e6, km < 1e7 ? 1 : 0)} ${s.millionKm}`;
      return dist(au);
    };
    const cell = (main: string, real?: string) => `<td><span class="br-v">${main}</span>${real ? `<span class="br-real">${c.real(real)}</span>` : ''}</td>`;
    const rows = [...PLANETS.map((p) => p.id as string), ...(br.ids.includes('star') ? ['star'] : [])].map((id) => {
      const b = rel(br, id), r = rel(ctl, id);
      const name = id === 'star' ? c.star : s.planets[id as PlanetId];
      const color = id === 'star' ? STAR_COLOR : COLORS[id as PlanetId];
      const head = `<th scope="row"><span class="br-dot" style="background:${color}"></span>${name}</th>`;
      if (!b) return `<tr class="br-gone">${head}<td colspan="3">${c.removed}</td></tr>`;
      if (!r) return `<tr>${head}<td>—</td>${cell(dist(b.orbit.r))}<td>—</td></tr>`; // the star: no real one
      const off = Math.hypot(b.dr[0] - r.dr[0], b.dr[1] - r.dr[1], b.dr[2] - r.dr[2]);
      return `<tr>${head}${cell(year(b.orbit.period), year(r.orbit.period))}${cell(dist(b.orbit.r), dist(r.orbit.r))}${cell(apart(off))}</tr>`;
    });
    this.el.table.innerHTML = `<thead><tr><th scope="col">${c.body}</th><th scope="col">${c.year}</th><th scope="col">${c.distance}</th><th scope="col">${c.offset}</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  }

  /** Copies the engine's reality at the time on screen, applies the change, and starts showing it. */
  private async fork() {
    const { ms, min, max } = this.clockMs();
    if (ms < min || ms > max) { this.error = t().branch.tooFar; this.renderStatus(); return; }
    if (this.action() === 'star' && ms + STAR_YEARS * 365.25 * 86400e3 > max) {
      this.error = t().branch.starLate(new Date(max).getUTCFullYear() - STAR_YEARS); this.renderStatus(); return;
    }
    const a = this.action(), target = this.el.target.value, value = Number(this.el.value.value), star = Number(this.el.extraValue.value);
    this.busy = true; this.error = null; this.render();
    try {
      if (!this.physics) {
        this.physics = new Physics();
        this.physics.onProgress = (p) => {
          if (p.sim !== 'branch') return;
          this.progressYear = String(new Date((p.jd - 2440587.5) * DAY_MS).getUTCFullYear());
          this.renderStatus();
        };
        const ready = await this.physics.start('real', 'systems');
        this.realGm = { ids: ready.ids, gm: ready.gm };
        this.realAt = null;
      }
      const jd = utcMsToTdbJd(ms);
      if (this.realAt !== jd) { await this.physics.goto('real', jd); this.realAt = jd; }
      if (this.active) this.physics.drop('branch');
      this.active = null; this.state = null; this.snap = null; this.control = null; this.trails.clear(); this.gen++; this.inFlight = false;
      await this.physics.branch('branch', 'real');
      let edit: Edit;
      if (a === 'remove') edit = { kind: 'remove', id: target };
      else if (a === 'mass') edit = { kind: 'mass', id: target, factor: value };
      else if (a === 'push') edit = { kind: 'push', id: target, dvKmS: value };
      else {
        // Closest at `star` au on the +x side (towards the vernal equinox) in STAR_YEARS, moving along +y
        const along = STAR_KMS * STAR_YEARS * 365.25 * 86400 / AU_KM;
        edit = { kind: 'add', id: 'star', gm: SUN_GM * value, r: [star, -along, 0], vKmS: [0, STAR_KMS, 0] };
      }
      const ready = await this.physics.edit('branch', edit);
      this.branchGm = ready.gm;
      this.active = { forkMs: ms, ids: ready.ids, action: a, target, value, star: a === 'star' ? star : undefined };
      this.asked = null; this.lastTrailJd = -Infinity;
      this.onChange?.();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.active = null;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private stop() {
    if (this.active) this.physics?.drop('branch');
    this.active = null; this.state = null; this.snap = null; this.control = null; this.error = null; this.trails.clear(); this.gen++; this.inFlight = false;
    this.render();
    this.onChange?.();
  }

  /**
   * Called every frame with the time on screen: asks the worker for that time (one request at a time,
   * so the worker never falls behind a moving time bar) and returns what to draw, or null.
   */
  frame(ms: number): Ghost[] | null {
    const act = this.active;
    if (!act || !this.physics) return null;
    if (ms < act.forkMs) { this.renderStatusSoon(); return null; }
    const jd = utcMsToTdbJd(ms);
    if (!this.inFlight && this.asked !== jd) {
      this.inFlight = true; this.asked = jd;
      const gen = this.gen;
      // The branch and reality (without the change) to the same time, side by side
      Promise.all([this.physics.goto('branch', jd), this.physics.goto('real', jd)]).then(([st, real]) => {
        if (gen !== this.gen) return; // an answer for a branch that is gone
        this.inFlight = false;
        this.realAt = real.jd;
        if (!this.active) return;
        const wasComputing = this.progressYear !== null;
        this.progressYear = null;
        this.state = { jd: st.jd, r: st.r, ids: act.ids };
        this.snap = { jd: st.jd, ids: act.ids, gm: this.branchGm, r: st.r, v: st.v };
        this.control = this.realGm && { jd: real.jd, ids: this.realGm.ids, gm: this.realGm.gm, r: real.r, v: real.v };
        this.addTrail(st.jd, st.path);
        if (wasComputing) this.renderStatus(); else this.renderStatusSoon();
      }, () => { if (gen === this.gen) { this.inFlight = false; this.realAt = null; } });
    }
    return this.ghosts();
  }

  private lastStatus = 0;
  private renderStatusSoon() {
    const now = performance.now();
    if (now - this.lastStatus > 250) { this.lastStatus = now; this.renderStatus(); }
  }

  private helio(i: number): Vec3 {
    const { r, ids } = this.state!, sun = ids.indexOf('sun');
    const sx = sun >= 0 ? r[3 * sun] : 0, sy = sun >= 0 ? r[3 * sun + 1] : 0, sz = sun >= 0 ? r[3 * sun + 2] : 0;
    return { x: r[3 * i] - sx, y: r[3 * i + 1] - sy, z: r[3 * i + 2] - sz };
  }

  /**
   * The path drawn behind each body, from the positions along the run (so it follows the curve even
   * when time runs fast). Reset when time goes back or jumps ahead.
   */
  private addTrail(jd: number, path: Float64Array) {
    const step = jd - this.lastTrailJd;
    const fresh = step < 0 || step > TRAIL_GAP_DAYS;
    if (fresh) this.trails.clear();
    if (step !== 0) this.lastTrailJd = jd;
    const { ids } = this.state!, n3 = ids.length * 3;
    const samples = fresh ? [path.length / n3 - 1] : Array.from({ length: path.length / n3 }, (_, k) => k);
    const sun = ids.indexOf('sun');
    ids.forEach((id, i) => {
      if (id === 'sun') return;
      const list = this.trails.get(id) ?? [];
      for (const k of samples) {
        const o = k * n3, so = sun >= 0 ? o + 3 * sun : -1;
        list.push({
          x: path[o + 3 * i] - (so >= 0 ? path[so] : 0),
          y: path[o + 3 * i + 1] - (so >= 0 ? path[so + 1] : 0),
          z: path[o + 3 * i + 2] - (so >= 0 ? path[so + 2] : 0),
        });
      }
      if (list.length > TRAIL_POINTS) list.splice(0, list.length - TRAIL_POINTS);
      this.trails.set(id, list);
    });
  }

  private ghosts(): Ghost[] | null {
    if (!this.state) return null;
    return this.state.ids.flatMap((id, i) => {
      if (id === 'sun' || id === 'pluto') return [];
      const color = id === 'star' ? STAR_COLOR : COLORS[id as PlanetId] ?? '#ffffff';
      return [{ id, pos: this.helio(i), color, trail: this.trails.get(id) ?? [] }];
    });
  }
}
