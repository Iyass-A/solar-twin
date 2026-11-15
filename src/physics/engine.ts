// The physics worker's work, without the worker itself, so npm run check can run it as it is.
// Each sim runs towards the latest time asked for, in slices of a few milliseconds, so a newer
// request (the time bar moved again) is seen at once, and the page gets progress on long runs.

import { startBodies, startSystems, EPOCH_JD } from './state';
import { createNBody, cloneNBody, step, energy, defaultStep, type NBody } from './nbody';
import type { FromWorker, Mode, ToWorker } from './protocol';

const SLICE_MS = 8;          // work this long, then let messages in
const STEPS_PER_CHUNK = 64;  // steps between two looks at the clock
const PROGRESS_MS = 50;      // at most this often

interface Sim {
  s: NBody;
  mode: Mode;
  ids: string[];
  h: number;            // step [days]
  e0: number;           // energy at the start
  target: number | null;
  // The run towards the target: n equal steps of hRun from `from`, k done (as advance() in nbody.ts
  // plans them, so the result is the same as one advance() call)
  run: { from: number; hRun: number; n: number; k: number } | null;
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
        const s = createNBody(list, EPOCH_JD);
        this.add(msg.sim, { s, mode: msg.mode, ids: list.map((b) => b.id), h: defaultStep(s), e0: energy(s) });
      } else if (msg.type === 'branch') {
        const from = this.get(msg.from);
        this.add(msg.sim, { s: cloneNBody(from.s), mode: from.mode, ids: [...from.ids], h: from.h, e0: from.e0 });
      } else if (msg.type === 'goto') {
        if (!Number.isFinite(msg.jd)) throw new Error(`not a time: ${msg.jd}`);
        const sim = this.get(msg.sim);
        if (sim.target === null) { sim.since = this.now(); sim.lastProgress = -Infinity; }
        sim.target = msg.jd;
        const span = msg.jd - sim.s.jd;
        const n = Math.max(1, Math.ceil(Math.abs(span) / sim.h - 1e-9));
        sim.run = span === 0 ? null : { from: sim.s.jd, hRun: span / n, n, k: 0 };
        this.schedule();
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

  private get(id: string): Sim {
    const sim = this.sims.get(id);
    if (!sim) throw new Error(`no sim "${id}"`);
    return sim;
  }

  private add(id: string, base: Omit<Sim, 'target' | 'run' | 'since' | 'lastProgress'>) {
    if (this.sims.has(id)) throw new Error(`sim "${id}" exists already`);
    this.sims.set(id, { ...base, target: null, run: null, since: 0, lastProgress: -Infinity });
    this.post({ type: 'ready', sim: id, mode: base.mode, ids: base.ids, jd: base.s.jd, step: base.h });
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
        for (; run.k < stop; ) { step(s, run.hRun, 4); run.k++; s.jd = run.from + run.k * run.hRun; }
        if (run.k === run.n) { s.jd = sim.target!; sim.run = null; }
      }
      if (s.jd === sim.target) {
        const r = s.r.slice();
        this.post({ type: 'state', sim: id, jd: s.jd, r, energyError: energy(s) / sim.e0 - 1, ms: this.now() - sim.since }, [r.buffer]);
        sim.target = null;
        sim.run = null;
      } else if (sim.target !== null && this.now() - sim.lastProgress >= PROGRESS_MS) {
        sim.lastProgress = this.now();
        this.post({ type: 'progress', sim: id, jd: s.jd, target: sim.target });
      }
    }
    if ([...this.sims.values()].some((sim) => sim.target !== null)) this.schedule();
  }
}
