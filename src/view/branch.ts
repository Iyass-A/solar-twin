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
import { utcMsToTdbJd } from '../physics/protocol';
import { orbitOf, propagate } from '../physics/orbit';
import { AU_KM } from '../physics/bodies';
import {
  makeEdit, scenario, scenarioFromHash, scenarioHash, STAR_YEARS, type Action, type ScenarioId,
} from '../physics/scenarios';
import { PLANETS, type PlanetId } from '../astro/elements';
import type { Vec3 } from '../astro/kepler';
import { COLORS } from './views';
import { t, num, numGrouped, dayMonth, type Strings } from '../i18n';

/** What the views draw for the branch: each body's position (from the Sun) and its recent path. */
export interface Ghost { id: string; pos: Vec3; color: string; trail: Vec3[] }

const STAR_COLOR = '#fff2c8';
const TRAIL_POINTS = 1200;
// The path behind each body is drawn only while time runs on smoothly: a bigger jump starts it afresh
// (a straight line across a jump would look like a path the body never took)
const TRAIL_GAP_DAYS = 30;
// The engine's answer is a few frames old when it arrives (at a year per second, ten days or more): each
// body is drawn at the time on screen from it, on its orbit round the Sun, with a few points to join its path
const CATCH_UP_MAX_DAYS = 400;
const CATCH_UP_POINTS = 8;
const DAY_MS = 86_400_000;

const DEFAULTS: Record<Action, number> = { remove: 0, mass: 2, push: 5, star: 1 };
// The ready-made scenarios with a button of their own (the nearer star is a button in the star's text)
const PRESETS: ScenarioId[] = ['jupiter', 'sun', 'star'];

/** A sim's state as the table needs it: positions, velocities and masses, by id. */
interface Snapshot { jd: number; ids: string[]; gm: number[]; r: Float64Array; v: Float64Array }

export class BranchCard {
  /** Called when the branch starts or ends (the page redraws its legend and caption). */
  onChange: (() => void) | null = null;
  /** Called to move the time on screen (the button that goes back to where the branch began). */
  onJump: ((ms: number) => void) | null = null;
  /** Called to run time at one of the page's speeds (a scenario starts it). */
  onPlay: ((speed: number) => void) | null = null;

  private physics: Physics | null = null;
  private realAt: number | null = null; // where the engine's "real" sim is (JD)
  private realGm: { ids: string[]; gm: number[] } | null = null;
  private branchGm: number[] = [];
  private control: Snapshot | null = null; // the engine's reality at the same time as the branch
  private snap: Snapshot | null = null;    // the branch, as the table needs it
  private active: { forkMs: number; ids: string[]; action: Action; target: string; value: number; star?: number; scenario?: ScenarioId } | null = null;
  private state: { jd: number; r: Float64Array; v: Float64Array; ids: string[] } | null = null;
  private asked: number | null = null;   // the time last asked of the worker [JD]
  private inFlight = false;
  private busy = false;                  // forking
  private progressYear: string | null = null;
  private trails = new Map<string, Vec3[]>();
  private lastTrailJd = -Infinity;
  private error: string | null = null;

  private readonly root: HTMLElement;
  private readonly el: {
    presets: HTMLElement; presetsTitle: HTMLElement; own: HTMLElement; scenario: HTMLElement; how: HTMLElement;
    result: HTMLElement; other: HTMLButtonElement;
    intro: HTMLElement; action: HTMLSelectElement; target: HTMLSelectElement; value: HTMLInputElement;
    targetLabel: HTMLElement; valueLabel: HTMLElement; valueText: HTMLElement; extra: HTMLElement; extraText: HTMLElement;
    extraValue: HTMLInputElement; hint: HTMLElement; go: HTMLButtonElement; status: HTMLElement; what: HTMLElement;
    progress: HTMLElement; legend: HTMLElement; reset: HTMLButtonElement; jump: HTMLButtonElement;
    compare: HTMLElement; compareTitle: HTMLElement; table: HTMLTableElement; note: HTMLElement;
  };

  private readonly clockMs: () => { ms: number; min: number; max: number };
  private gen = 0; // counts forks and stops, so a late answer for an old branch is ignored
  // The branch's sim in the worker has a new name each time, so that progress still on its way from
  // an old one (dropped while it ran) is not taken for the new one's
  private branchSim = 'branch-0';

  constructor(root: HTMLElement, clockMs: () => { ms: number; min: number; max: number }) {
    this.clockMs = clockMs;
    this.root = root;
    root.innerHTML = `
      <h2 class="card-title"><span class="br-title"></span> <span class="badge br-badge"></span></h2>
      <p class="sub br-intro"></p>
      <h3 class="br-presets-title"></h3>
      <div class="row br-presets">
        ${PRESETS.map((id) => `<button type="button" class="br-preset" data-scenario="${id}" aria-pressed="false"></button>`).join('')}
      </div>
      <p class="sub br-own"></p>
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
        <div class="br-scenario" hidden>
          <p class="br-how"></p>
          <p class="br-result"></p>
          <button type="button" class="br-other"></button>
        </div>
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
      presets: q('.br-presets'), presetsTitle: q('.br-presets-title'), own: q('.br-own'), scenario: q('.br-scenario'),
      how: q('.br-how'), result: q('.br-result'), other: q('.br-other'),
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
    this.el.presets.querySelectorAll<HTMLButtonElement>('.br-preset').forEach((btn) => {
      btn.addEventListener('click', () => void this.runScenario(btn.dataset.scenario as ScenarioId));
    });
    this.el.other.addEventListener('click', () => {
      const other = this.active?.scenario && scenario(this.active.scenario).other;
      if (other) void this.runScenario(other);
    });
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
    this.el.presetsTitle.textContent = b.scenarios.title;
    this.el.own.textContent = b.scenarios.own;
    this.el.presets.querySelectorAll<HTMLButtonElement>('.br-preset').forEach((btn) => {
      btn.textContent = b.scenarios.buttons[btn.dataset.scenario as 'jupiter' | 'sun' | 'star'];
      btn.disabled = this.busy;
    });
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

  /** A scenario's explanation and result, with the numbers that npm run check makes sure of. */
  private renderScenario() {
    const id = this.active?.scenario, b = t().branch.scenarios;
    this.el.presets.querySelectorAll<HTMLButtonElement>('.br-preset').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(!!id && btn.dataset.scenario === (id === 'star50' ? 'star' : id)));
    });
    this.el.scenario.hidden = !id;
    if (!id) return;
    const sc = scenario(id);
    const facts = Object.fromEntries(sc.facts.map((f) => [f.key, f.digits === 0 ? numGrouped(f.value) : num(f.value, f.digits)]));
    this.el.how.textContent = b.list[id].how;
    this.el.result.textContent = b.list[id].result(facts);
    this.el.other.hidden = !sc.other;
    if (sc.other) this.el.other.textContent = sc.other === 'star50' ? b.nearer : b.farther;
  }

  /**
   * A ready-made scenario: fills in the form (so it can be changed from there), moves time to the
   * scenario's start, branches, and runs time. The address gets the scenario's link (#branch-…).
   */
  async runScenario(id: ScenarioId) {
    if (this.busy) return;
    const sc = scenario(id);
    this.el.action.value = sc.action;
    this.render(); // the bodies this change can take
    if (sc.action !== 'star') this.el.target.value = sc.target;
    this.el.value.value = String(sc.value);
    this.el.extraValue.value = String(sc.starAu);
    this.onJump?.(sc.fromMs);
    if (await this.fork(id)) this.onPlay?.(sc.speed);
  }

  /** Runs the scenario in the address (#branch-jupiter and so on), if there is one. */
  openFromHash() {
    const id = scenarioFromHash(location.hash);
    if (!id || this.active?.scenario === id) return;
    this.root.scrollIntoView({ block: 'start' });
    void this.runScenario(id);
  }

  /** The address names the scenario on show, and no scenario when there is none (other links stay). */
  private setHash(id: ScenarioId | undefined) {
    const want = id ? scenarioHash(id) : '';
    if (location.hash === want || (!id && !scenarioFromHash(location.hash))) return;
    history.replaceState(null, '', `${location.pathname}${location.search}${want}`);
  }

  private name(id: string, s: Strings = t()) {
    return id === 'sun' ? s.branch.sun : s.planets[id as PlanetId] ?? id;
  }

  private renderStatus() {
    const s = t(), b = s.branch, act = this.active;
    this.el.status.hidden = !act && !this.error && !this.busy;
    this.el.jump.hidden = !act;
    this.renderScenario();
    if (this.error || !act) {
      // An error, or a branch on its way (going to its start can take a second or two)
      this.el.what.textContent = this.error ? b.error(this.error) : this.busy ? b.scenarios.preparing : '';
      this.el.progress.textContent = !this.error && this.busy && this.progressYear ? b.computing(this.progressYear) : '';
      this.el.legend.hidden = true; this.el.compare.hidden = true; return;
    }
    this.el.legend.hidden = false;
    const fmt = (v: number) => num(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 1 : 0);
    const what = act.action === 'remove' ? b.what.remove(this.name(act.target))
      : act.action === 'mass' ? b.what.mass(this.name(act.target), fmt(act.value))
      : act.action === 'push' ? b.what.push(this.name(act.target), fmt(Math.abs(act.value)), act.value > 0)
      : b.what.star(fmt(act.value), `${act.star! >= 1000 ? numGrouped(act.star!) : fmt(act.star!)} ${s.au}`);
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
    const dist = (au: number) => `${au < 100 ? num(au, au < 10 ? 2 : 1) : numGrouped(au)} ${s.au}`;
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

  /**
   * Copies the engine's reality at the time on screen, applies the change, and starts showing it.
   * Returns whether the branch is there.
   */
  private async fork(scenarioId?: ScenarioId): Promise<boolean> {
    if (this.busy) return false;
    const { ms, min, max } = this.clockMs();
    if (ms < min || ms > max) { this.error = t().branch.tooFar; this.renderStatus(); return false; }
    if (this.action() === 'star' && ms + STAR_YEARS * 365.25 * 86400e3 > max) {
      this.error = t().branch.starLate(new Date(max).getUTCFullYear() - STAR_YEARS); this.renderStatus(); return false;
    }
    const a = this.action(), target = this.el.target.value, value = Number(this.el.value.value), star = Number(this.el.extraValue.value);
    this.busy = true; this.error = null; this.render();
    try {
      if (!this.physics) {
        this.physics = new Physics();
        this.physics.onProgress = (p) => {
          // the branch on a long run, or reality on its way to where a branch starts
          if (!(p.sim === this.branchSim && this.active && !this.busy) && !(p.sim === 'real' && this.busy)) return;
          this.progressYear = String(new Date((p.jd - 2440587.5) * DAY_MS).getUTCFullYear());
          this.renderStatus();
        };
        const ready = await this.physics.start('real', 'systems');
        this.realGm = { ids: ready.ids, gm: ready.gm };
        this.realAt = null;
      }
      const jd = utcMsToTdbJd(ms);
      if (this.realAt !== jd) { await this.physics.goto('real', jd); this.realAt = jd; }
      if (this.active) this.physics.drop(this.branchSim);
      this.active = null; this.state = null; this.snap = null; this.control = null; this.trails.clear(); this.gen++; this.inFlight = false;
      this.branchSim = `branch-${this.gen}`;
      await this.physics.branch(this.branchSim, 'real');
      const ready = await this.physics.edit(this.branchSim, makeEdit(a, target, value, star));
      this.branchGm = ready.gm;
      this.active = { forkMs: ms, ids: ready.ids, action: a, target, value, star: a === 'star' ? star : undefined, scenario: scenarioId };
      this.asked = null; this.lastTrailJd = -Infinity;
      this.setHash(scenarioId);
      this.onChange?.();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.active = null;
      this.setHash(undefined);
    } finally {
      this.busy = false;
      this.progressYear = null;
      this.render();
    }
    return this.active !== null;
  }

  private stop() {
    if (this.active) this.physics?.drop(this.branchSim);
    this.active = null; this.state = null; this.snap = null; this.control = null; this.error = null; this.trails.clear(); this.gen++; this.inFlight = false;
    this.setHash(undefined);
    this.render();
    this.onChange?.();
  }

  /**
   * Called every frame with the time on screen: asks the worker for that time (one request at a time,
   * so the worker never falls behind a moving time bar) and returns what to draw, or null.
   */
  frame(ms: number): Ghost[] | null {
    const act = this.active;
    // (while a new branch is on its way, the old one is neither drawn nor run on)
    if (!act || !this.physics || this.busy) return null;
    if (ms < act.forkMs) { this.renderStatusSoon(); return null; }
    const jd = utcMsToTdbJd(ms);
    if (!this.inFlight && this.asked !== jd) {
      this.inFlight = true; this.asked = jd;
      const gen = this.gen;
      // The branch and reality (without the change) to the same time, side by side
      Promise.all([this.physics.goto(this.branchSim, jd), this.physics.goto('real', jd)]).then(([st, real]) => {
        if (gen !== this.gen) return; // an answer for a branch that is gone
        this.inFlight = false;
        this.realAt = real.jd;
        if (!this.active) return;
        const wasComputing = this.progressYear !== null;
        this.progressYear = null;
        this.state = { jd: st.jd, r: st.r, v: st.v, ids: act.ids };
        this.snap = { jd: st.jd, ids: act.ids, gm: this.branchGm, r: st.r, v: st.v };
        this.control = this.realGm && { jd: real.jd, ids: this.realGm.ids, gm: this.realGm.gm, r: real.r, v: real.v };
        this.addTrail(st.jd, st.path);
        if (wasComputing) this.renderStatus(); else this.renderStatusSoon();
      }, () => { if (gen === this.gen) { this.inFlight = false; this.realAt = null; } });
    }
    return this.ghosts(jd);
  }

  private lastStatus = 0;
  private renderStatusSoon() {
    const now = performance.now();
    if (now - this.lastStatus > 250) { this.lastStatus = now; this.renderStatus(); }
  }

  /** Body i relative to the Sun: position [au] and velocity [au/day]. */
  private helio(i: number): { r: number[]; v: number[] } {
    const { r, v, ids } = this.state!, sun = ids.indexOf('sun');
    const d = (a: Float64Array, k: number) => a[3 * i + k] - (sun >= 0 ? a[3 * sun + k] : 0);
    return { r: [d(r, 0), d(r, 1), d(r, 2)], v: [d(v, 0), d(v, 1), d(v, 2)] };
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

  private ghosts(jd: number): Ghost[] | null {
    if (!this.state) return null;
    const { ids } = this.state, sun = ids.indexOf('sun');
    const dt = jd - this.state.jd;
    const catchUp = dt !== 0 && Math.abs(dt) <= CATCH_UP_MAX_DAYS;
    const vec = (r: number[]): Vec3 => ({ x: r[0], y: r[1], z: r[2] });
    return ids.flatMap((id, i) => {
      if (id === 'sun' || id === 'pluto') return [];
      const color = id === 'star' ? STAR_COLOR : COLORS[id as PlanetId] ?? '#ffffff';
      const trail = this.trails.get(id) ?? [];
      const at = this.helio(i);
      if (!catchUp) return [{ id, pos: vec(at.r), color, trail }];
      // From the engine's answer to the time on screen, round the Sun alone (the others pull too little in a few days)
      const mu = (sun >= 0 ? this.branchGm[sun] : 0) + this.branchGm[i];
      const steps = Array.from({ length: CATCH_UP_POINTS }, (_, k) => vec(propagate(mu, at.r, at.v, dt * (k + 1) / CATCH_UP_POINTS).r));
      return [{ id, pos: steps[steps.length - 1], color, trail: dt > 0 ? [...trail, ...steps] : trail }];
    });
  }
}
