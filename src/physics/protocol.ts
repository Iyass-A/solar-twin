// Messages between the page and the physics worker (src/physics/worker.ts).
// The page names each simulation ("sim"); a branch is a copy of another sim that then runs on its own.
// Times are Julian dates in TDB; positions are au from the solar-system barycentre, J2000 ecliptic,
// in the order of `ids` from the "ready" message.

/** "systems": the Sun and nine planetary systems as points (fast, for long runs).
 *  "bodies": the Sun, planets and seven large moons, with the giant planets' bulges (slower). */
export type Mode = 'systems' | 'bodies';

export type ToWorker =
  | { type: 'start'; sim: string; mode: Mode }   // a new sim from the starting state (src/physics/state.ts)
  | { type: 'branch'; sim: string; from: string } // a copy of `from`, at its current time
  | { type: 'goto'; sim: string; jd: number }     // run to this time; a newer goto replaces an older one
  | { type: 'drop'; sim: string };

export type FromWorker =
  | { type: 'ready'; sim: string; mode: Mode; ids: string[]; jd: number; step: number }
  | { type: 'progress'; sim: string; jd: number; target: number }
  | { type: 'state'; sim: string; jd: number; r: Float64Array; energyError: number; ms: number }
  | { type: 'error'; sim?: string; message: string };

const TDB_MINUS_UTC_S = 69.184; // TT − UTC since 2017 (37 leap seconds + 32.184 s); TDB stays within 2 ms of TT

/** Site time (UTC milliseconds) → Julian date in TDB, as the physics engine counts. */
export const utcMsToTdbJd = (ms: number) => (ms + TDB_MINUS_UTC_S * 1000) / 86_400_000 + 2440587.5;
/** Julian date in TDB → site time (UTC milliseconds). */
export const tdbJdToUtcMs = (jd: number) => (jd - 2440587.5) * 86_400_000 - TDB_MINUS_UTC_S * 1000;
