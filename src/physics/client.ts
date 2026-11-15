// The page's side of the physics worker. Starts the worker on first use; each sim has a name.
//
//   const physics = new Physics();
//   const { ids } = await physics.start('real', 'systems');
//   const state = await physics.goto('real', utcMsToTdbJd(Date.UTC(2030, 0, 1)));
//
// goto() settles with the state for the latest time asked of that sim: when the time bar moves on
// before a run ends, the earlier promises settle with the newer state. A state for an earlier time that
// was already on its way when the newer goto went out is passed over (the worker sends the newer one):
// otherwise a branch made right after a goto could start from where the sim was, not where it was sent.

import type { Edit, FromWorker, Mode, ToWorker } from './protocol';

type Ready = Extract<FromWorker, { type: 'ready' }>;
type State = Extract<FromWorker, { type: 'state' }>;
type Progress = Extract<FromWorker, { type: 'progress' }>;

interface Waiting<T> { resolve: (v: T) => void; reject: (e: Error) => void }

export class Physics {
  private worker: Worker | null = null;
  private ready = new Map<string, Waiting<Ready>>();
  private states = new Map<string, Waiting<State>[]>();
  private wanted = new Map<string, number>(); // the latest time asked of each sim
  /** Called during long runs (at most every 50 ms). */
  onProgress: ((p: Progress) => void) | null = null;

  private send(msg: ToWorker) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.receive(e.data);
      this.worker.onerror = (e) => this.failAll(new Error(e.message || 'physics worker failed'));
    }
    this.worker.postMessage(msg);
  }

  private receive(msg: FromWorker) {
    if (msg.type === 'ready') { this.ready.get(msg.sim)?.resolve(msg); this.ready.delete(msg.sim); }
    else if (msg.type === 'state') {
      if (this.wanted.get(msg.sim) !== msg.jd) return; // for an earlier goto: the newer state follows
      for (const w of this.states.get(msg.sim) ?? []) w.resolve(msg);
      this.states.delete(msg.sim);
    }
    else if (msg.type === 'progress') this.onProgress?.(msg);
    else if (msg.type === 'error') {
      const err = new Error(msg.message);
      if (msg.sim === undefined) { this.failAll(err); return; }
      this.ready.get(msg.sim)?.reject(err); this.ready.delete(msg.sim);
      for (const w of this.states.get(msg.sim) ?? []) w.reject(err);
      this.states.delete(msg.sim);
    }
  }

  private failAll(err: Error) {
    for (const w of this.ready.values()) w.reject(err);
    for (const list of this.states.values()) for (const w of list) w.reject(err);
    this.ready.clear(); this.states.clear();
  }

  /** A new sim from the starting state (15 November 2026), with relativity near the Sun unless told not to. */
  start(sim: string, mode: Mode, relativity = true): Promise<Ready> {
    return new Promise((resolve, reject) => { this.ready.set(sim, { resolve, reject }); this.send({ type: 'start', sim, mode, relativity }); });
  }

  /** A copy of another sim at its current time, to change and run on its own. */
  branch(sim: string, from: string): Promise<Ready> {
    return new Promise((resolve, reject) => { this.ready.set(sim, { resolve, reject }); this.send({ type: 'branch', sim, from }); });
  }

  /** Runs the sim to Julian date `jd` (TDB), forwards or backwards. */
  goto(sim: string, jd: number): Promise<State> {
    return new Promise((resolve, reject) => {
      const list = this.states.get(sim) ?? [];
      list.push({ resolve, reject });
      this.states.set(sim, list);
      this.wanted.set(sim, jd);
      this.send({ type: 'goto', sim, jd });
    });
  }

  /** Changes a sim that has arrived (not running), at its current time; settles with its new bodies. */
  edit(sim: string, edit: Edit): Promise<Ready> {
    return new Promise((resolve, reject) => { this.ready.set(sim, { resolve, reject }); this.send({ type: 'edit', sim, edit }); });
  }

  drop(sim: string) { this.wanted.delete(sim); this.send({ type: 'drop', sim }); }

  /** Stops the worker; the next call starts a fresh one. */
  close() {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new Error('physics worker closed'));
  }
}
