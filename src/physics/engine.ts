// The physics worker's work, without the worker itself, so npm run check can run it as it is.
// Each sim runs towards the latest time asked for, in slices of a few milliseconds, so a newer
// request (the time bar moved again) is seen at once, and the page gets progress on long runs.

import { startBodies, startSystems, EPOCH_JD } from './state';
import { createNBody, cloneNBody, step, energy, defaultStep, removeBody, addBody, setGm, kick, type NBody } from './nbody';
import { toAuDay, AU_KM } from './bodies';
import { PATH_SAMPLES, type Edit, type FromWorker, type Mode, type ToWorker } from './protocol';

const KMS_TO_AU_DAY = 86400 / AU_KM;

const SLICE_MS = 8;          // work this long, then let messages in
const STEPS_PER_CHUNK = 64;  // steps between two looks at the clock
const PROGRESS_MS = 50;      // at most this often

interface Sim {
  s: NBody;
  mode: Mode;
  ids: string[];
  groups: string[];     // per body: the planetary system it moves with (its own id for the Sun, systems, new bodies)
  h: number;            // step [days]
  e0: number;           // energy at the start
  target: number | null;
  // The run towards the target: n equal steps of hRun from `from`, k done (as advance() in nbody.ts
  // plans them, so the result is the same as one advance() call)
  run: { from: number; hRun: number; n: number; k: number } | null;
  path: number[];       // positions along the current run, for the state message
  since: number;        // when the current run began [ms]
  lastProgress: number;
}

export type Post = (msg: FromWorker, transfer?: Transferable[]) => void;

export class Engine {
  private sims = new Map<string, Sim>();
  private scheduled = false;
  private post: Post;
  private later: (fn: () => void) => void;
  private now: () => number;

  /** `post` sends to the page; `later` runs a function soon, after waiting messages. */
  constructor(post: Post, later: (fn: () => void) => void, now: () => number = () => performance.now()) {
    this.post = post; this.later = later; this.now = now;
  }

  handle(msg: ToWorker) {
    try {
      if (msg.type === 'start') {
        const list = msg.mode === 'systems' ? [startBodies()[0], ...startSystems()] : startBodies();
        if (list[0].id !== 'sun') throw new Error('the Sun must come first');
        const s = createNBody(list, EPOCH_JD, { relativity: msg.relativity !== false });
        const groups = list.map((b) => ('system' in b && b.system && msg.mode === 'bodies' ? b.system : b.id));
        this.add(msg.sim, { s, mode: msg.mode, ids: list.map((b) => b.id), groups, h: defaultStep(s), e0: energy(s) });
      } else if (msg.type === 'branch') {
        const from = this.get(msg.from);
        this.add(msg.sim, { s: cloneNBody(from.s), mode: from.mode, ids: [...from.ids], groups: [...from.groups], h: from.h, e0: from.e0 });
      } else if (msg.type === 'goto') {
        if (!Number.isFinite(msg.jd)) throw new Error(`not a time: ${msg.jd}`);
        const sim = this.get(msg.sim);
        if (sim.target === null) { sim.since = this.now(); sim.lastProgress = -Infinity; }
        sim.target = msg.jd;
        const span = msg.jd - sim.s.jd;
        const n = Math.max(1, Math.ceil(Math.abs(span) / sim.h - 1e-9));
        sim.run = span === 0 ? null : { from: sim.s.jd, hRun: span / n, n, k: 0 };
        sim.path = [];
        this.schedule();
      } else if (msg.type === 'edit') {
        const sim = this.get(msg.sim);
        if (sim.target !== null) throw new Error(`sim "${msg.sim}" is running; change it once it has arrived`);
        this.applyEdit(sim, msg.edit);
        sim.h = Number.isFinite(defaultStep(sim.s)) ? defaultStep(sim.s) : sim.h; // nothing bound any more: keep the step
        sim.e0 = energy(sim.s);
        this.post({ type: 'ready', sim: msg.sim, mode: sim.mode, relativity: sim.s.relSun >= 0, ids: sim.ids, gm: Array.from(sim.s.gm), jd: sim.s.jd, step: sim.h });
      } else if (msg.type === 'drop') {
        this.get(msg.sim);
        this.sims.delete(msg.sim);
      } else {
        throw new Error(`unknown message ${(msg as { type: string }).type}`);
      }
    } catch (err) {
      this.post({ type: 'error', sim: 'sim' in msg ? msg.sim : undefined, message: err instanceof Error ? err.message : String(err) });
    }
  }

  /** One change at the sim's current time (see Edit in protocol.ts). */
  private applyEdit(sim: Sim, edit: Edit) {
    const { s, ids, groups } = sim;
    const index = (id: string) => { const i = ids.indexOf(id); if (i < 0) throw new Error(`no body "${id}"`); return i; };
    const moving = (i: number) => (groups[i] === ids[i] && sim.mode === 'bodies'
      ? ids.flatMap((_, j) => (groups[j] === ids[i] ? [j] : []))  // a planet and its moons
      : [i]);
    const sun = ids.indexOf('sun');
    if (edit.kind === 'remove') {
      for (const i of moving(index(edit.id)).sort((a, b) => b - a)) { removeBody(s, i); ids.splice(i, 1); groups.splice(i, 1); }
    } else if (edit.kind === 'mass') {
      if (!(edit.factor >= 0) || !Number.isFinite(edit.factor)) throw new Error(`not a factor: ${edit.factor}`);
      const i = index(edit.id);
      setGm(s, i, s.gm[i] * edit.factor);
    } else if (edit.kind === 'push') {
      if (!Number.isFinite(edit.dvKmS)) throw new Error(`not a speed: ${edit.dvKmS}`);
      const i = index(edit.id);
      if (i === sun) throw new Error('push the planets, not the Sun');
      const rel = [0, 1, 2].map((k) => s.v[3 * i + k] - (sun >= 0 ? s.v[3 * sun + k] : 0));
      const speed = Math.hypot(rel[0], rel[1], rel[2]);
      if (!(speed > 0)) throw new Error(`"${edit.id}" does not move round the Sun`);
      kick(s, moving(i), rel.map((c) => c / speed * edit.dvKmS * KMS_TO_AU_DAY));
    } else if (edit.kind === 'add') {
      if (ids.includes(edit.id)) throw new Error(`body "${edit.id}" exists already`);
      if (![edit.gm, ...edit.r, ...edit.vKmS].every(Number.isFinite) || !(edit.gm >= 0)) throw new Error('a new body needs a mass, a position and a velocity');
      const base = (k: number, a: Float64Array) => (sun >= 0 ? a[3 * sun + k] : 0);
      addBody(s, {
        gmAu: toAuDay(edit.gm),
        r: edit.r.map((x, k) => base(k, s.r) + x),
        v: edit.vKmS.map((x, k) => base(k, s.v) + x * KMS_TO_AU_DAY),
      });
      ids.push(edit.id); groups.push(edit.id);
    } else {
      throw new Error(`unknown change ${(edit as { kind: string }).kind}`);
    }
  }

  private get(id: string): Sim {
    const sim = this.sims.get(id);
    if (!sim) throw new Error(`no sim "${id}"`);
    return sim;
  }

  private add(id: string, base: Omit<Sim, 'target' | 'run' | 'path' | 'since' | 'lastProgress'>) {
    if (this.sims.has(id)) throw new Error(`sim "${id}" exists already`);
    this.sims.set(id, { ...base, target: null, run: null, path: [], since: 0, lastProgress: -Infinity });
    this.post({ type: 'ready', sim: id, mode: base.mode, relativity: base.s.relSun >= 0, ids: base.ids, gm: Array.from(base.s.gm), jd: base.s.jd, step: base.h });
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    this.later(() => { this.scheduled = false; this.run(); });
  }

  /** One slice: every sim with a target moves towards it; done ones report their state. */
  private run() {
    const end = this.now() + SLICE_MS;
    const busy = [...this.sims.entries()].filter(([, sim]) => sim.target !== null);
    for (const [id, sim] of busy) {
      const { s } = sim, run = sim.run;
      while (run && run.k < run.n && this.now() < end) {
        const stop = Math.min(run.n, run.k + STEPS_PER_CHUNK);
        const every = Math.ceil(run.n / PATH_SAMPLES);
        for (; run.k < stop; ) {
          step(s, run.hRun, 4); run.k++; s.jd = run.from + run.k * run.hRun;
          if (run.k % every === 0 || run.k === run.n) for (let c = 0; c < s.r.length; c++) sim.path.push(s.r[c]);
        }
        if (run.k === run.n) { s.jd = sim.target!; sim.run = null; }
      }
      if (s.jd === sim.target) {
        const r = s.r.slice(), v = s.v.slice(), path = new Float64Array(sim.path.length ? sim.path : r);
        this.post({ type: 'state', sim: id, jd: s.jd, r, v, path, energyError: energy(s) / sim.e0 - 1, ms: this.now() - sim.since }, [r.buffer, v.buffer, path.buffer]);
        sim.target = null;
        sim.run = null;
        sim.path = [];
      } else if (sim.target !== null && this.now() - sim.lastProgress >= PROGRESS_MS) {
        sim.lastProgress = this.now();
        this.post({ type: 'progress', sim: id, jd: s.jd, target: sim.target });
      }
    }
    if ([...this.sims.values()].some((sim) => sim.target !== null)) this.schedule();
  }
}
