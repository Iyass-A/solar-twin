// Space weather: NOAA's space weather scales and Kp index, solar flares seen by the GOES satellites
// (NOAA SWPC, https://services.swpc.noaa.gov/), and arrivals at Earth of clouds thrown out by the Sun
// (coronal mass ejections, CMEs) as NASA's WSA-Enlil model predicts them (DONKI, CCMC).
// Shared by the fetch script (runs on GitHub before each deploy), npm run check and the page. No DOM here.
//
// Every part is read defensively: SWPC changed some of its JSON in 2026 (a header row followed by rows
// of strings became a list of objects with numbers), so both shapes are accepted, keys in any case.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type Level = 0 | 1 | 2 | 3 | 4 | 5;

/** NOAA space weather scales: R radio blackouts (flares), S solar radiation storms, G geomagnetic storms. */
export interface Scales {
  at: string;                         // ISO time of the "current" values
  now: { r: Level; s: Level; g: Level };
  past24h: { r: Level; s: Level; g: Level } | null;   // largest in the last 24 hours
  days: { date: string; rMinor: number | null; rMajor: number | null; s: number | null; g: Level | null }[]; // next days: probabilities [%] and expected G
}

export interface KpPoint { t: string; kp: number; kind: 'observed' | 'estimated' | 'predicted'; }

export interface Flare {
  peak: string;     // ISO time of the maximum
  begin: string | null;
  end: string | null;
  cls: string;      // GOES class, e.g. "M1.5"
}

export interface CmeArrival {
  cme: string;            // DONKI's id of the CME, e.g. "2026-11-14T08:12:00-CME-001"
  arrival: string;        // predicted arrival of the shock at Earth (ISO); the model says ± about 7 hours
  glancing: boolean;      // only the edge passes Earth
  minor: boolean;         // the model expects only a minor impact
  speed: number | null;   // km/s near the Sun
  kp: [number, number] | null; // smallest and largest possible Kp the model gives (it depends on the cloud's field)
  modelRun: string;       // when the model run was finished (ISO)
  link: string | null;    // DONKI page of the run
}

interface Part<T> { fetchedAt: string; data: T; }

export interface SpaceWeatherFile {
  fetchedAt: string;
  scales: Part<Scales> | null;
  kp: Part<KpPoint[]> | null;
  flares: Part<Flare[]> | null;
  cmes: Part<CmeArrival[]> | null;
}

export const PART_NAMES = ['scales', 'kp', 'flares', 'cmes'] as const;
export type PartName = typeof PART_NAMES[number];

// ---------- Small helpers ----------

/** SWPC writes "2026-11-15 03:00:00.000" in UTC without a zone; DONKI "2026-11-15T03:00Z". Returns ISO or null. */
export function isoTime(x: unknown): string | null {
  if (typeof x !== 'string' || !x.trim()) return null;
  let s = x.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

const num = (x: unknown): number => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN);
const numOrNull = (x: unknown): number | null => {
  const n = num(x);
  return Number.isFinite(n) ? n : null;
};
const level = (x: unknown): Level | null => {
  const n = num(x);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? (n as Level) : null;
};

/** Rows from either SWPC shape: [[header...], [values...], ...] or [{key: value}, ...]. Keys come lowercased. */
export function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) throw new Error('not a list');
  if (raw.length && Array.isArray(raw[0])) {
    const head = (raw[0] as unknown[]).map((h) => String(h).toLowerCase());
    return raw.slice(1).map((r) => Object.fromEntries(head.map((h, k) => [h, (r as unknown[])[k]])));
  }
  return raw.map((r) => {
    if (!r || typeof r !== 'object') throw new Error('row is not an object');
    return Object.fromEntries(Object.entries(r as object).map(([k, v]) => [k.toLowerCase(), v]));
  });
}

/** NOAA G scale from Kp: G1 at 5, G2 at 6, G3 at 7, G4 at 8 (and 9-), G5 at 9. */
export function gFromKp(kp: number): Level {
  if (kp >= 8.84) return 5; // 9o (9- is 8.67)
  if (kp >= 7.67) return 4; // 8- and up
  if (kp >= 6.67) return 3;
  if (kp >= 5.67) return 2;
  if (kp >= 4.67) return 1;
  return 0;
}

/** Peak X-ray flux of a GOES class [W/m²]: A1 = 1e-8, B1 = 1e-7, C1 = 1e-6, M1 = 1e-5, X1 = 1e-4. */
export function flareFlux(cls: string): number {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)$/.exec(cls.trim());
  if (!m) return NaN;
  return { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[m[1] as 'A']! * Number(m[2]);
}

// ---------- Parsers: each turns one source's answer into our part, or throws ----------

/** noaa-scales.json: {"-1": yesterday's largest, "0": now, "1".."3": the next days}. */
export function parseScales(raw: any): Scales {
  if (!raw || typeof raw !== 'object' || !raw['0']) throw new Error('no current scales ("0")');
  const trio = (e: any, label: string) => {
    const r = level(e?.R?.Scale), s = level(e?.S?.Scale), g = level(e?.G?.Scale);
    if (r === null || s === null || g === null) throw new Error(`${label}: R ${e?.R?.Scale}, S ${e?.S?.Scale}, G ${e?.G?.Scale}`);
    return { r, s, g };
  };
  const now = trio(raw['0'], 'now');
  const at = isoTime(`${raw['0'].DateStamp ?? ''} ${raw['0'].TimeStamp ?? ''}`.trim());
  if (!at) throw new Error(`no time for the current scales: ${raw['0'].DateStamp} ${raw['0'].TimeStamp}`);
  let past24h = null;
  try { if (raw['-1']) past24h = trio(raw['-1'], 'past 24 h'); } catch { /* not given */ }
  const days: Scales['days'] = [];
  for (const k of ['1', '2', '3']) {
    const e = raw[k];
    if (!e) continue;
    const date = isoTime(e.DateStamp)?.slice(0, 10);
    if (!date) throw new Error(`day ${k}: no date`);
    days.push({ date, rMinor: numOrNull(e.R?.MinorProb), rMajor: numOrNull(e.R?.MajorProb), s: numOrNull(e.S?.Prob), g: level(e.G?.Scale) });
  }
  return { at, now, past24h, days };
}

/** noaa-planetary-k-index-forecast.json: 3-hour Kp, observed, estimated and predicted. */
export function parseKp(raw: unknown): KpPoint[] {
  const out: KpPoint[] = [];
  for (const r of rowsOf(raw)) {
    const t = isoTime(r.time_tag);
    const kp = num(r.kp);
    const how = String(r.observed ?? r.kind ?? '').toLowerCase();
    const kind = how.startsWith('obs') ? 'observed' : how.startsWith('est') ? 'estimated' : how.startsWith('pre') ? 'predicted' : null;
    if (!t || !Number.isFinite(kp) || !kind) throw new Error(`bad Kp row ${JSON.stringify(r)}`);
    out.push({ t, kp, kind });
  }
  return out;
}

/** xray-flares-7-day.json (GOES): one object per flare. */
export function parseFlares(raw: unknown): Flare[] {
  const out: Flare[] = [];
  for (const r of rowsOf(raw)) {
    const cls = String(r.max_class ?? '').trim();
    const peak = isoTime(r.max_time);
    if (!peak || !Number.isFinite(flareFlux(cls))) throw new Error(`bad flare ${JSON.stringify(r)}`);
    out.push({ peak, begin: isoTime(r.begin_time), end: isoTime(r.end_time), cls });
  }
  // The same flare can be listed by more than one satellite: keep one per peak time
  const seen = new Set<string>();
  return out.filter((f) => !seen.has(f.peak) && seen.add(f.peak)).sort((a, b) => a.peak.localeCompare(b.peak));
}

/**
 * DONKI WSAEnlilSimulations: model runs, often several for one CME (newer versions, or one for the
 * shock and one for the bulk of the cloud). Per CME, the runs finished within 3 hours of its newest
 * one count; if any of them predicts an arrival at Earth, the earliest one is kept.
 * Fresh runs can come without their CME (empty cmeInputs, seen in November 2026): those finished
 * within 3 hours of each other are taken as one CME, so one cloud is not listed twice.
 */
export function parseEnlil(raw: unknown): CmeArrival[] {
  if (!Array.isArray(raw)) throw new Error('not a list');
  const byCme = new Map<string, any[]>();
  const orphans: { done: number; sim: any }[] = [];
  for (const sim of raw) {
    const done = isoTime(sim?.modelCompletionTime);
    if (!done) throw new Error(`run without completion time: ${JSON.stringify(sim).slice(0, 200)}`);
    const ids: string[] = (sim.cmeInputs ?? []).map((c: any) => c?.CMEID ?? c?.cmeid ?? c?.cmeID).filter(Boolean);
    if (ids[0]) byCme.set(ids[0], [...(byCme.get(ids[0]) ?? []), sim]);
    else orphans.push({ done: Date.parse(done), sim });
  }
  orphans.sort((a, b) => a.done - b.done);
  let group: any[] = [], last = -Infinity;
  for (const o of orphans) {
    if (o.done - last > 3 * HOUR_MS && group.length) { byCme.set(String(group[0].simulationID), group); group = []; }
    group.push(o.sim);
    last = o.done;
  }
  if (group.length) byCme.set(String(group[0].simulationID), group);
  const out: CmeArrival[] = [];
  for (const [cme, sims] of byCme) {
    const newest = Math.max(...sims.map((s) => Date.parse(isoTime(s.modelCompletionTime)!)));
    const recent = sims.filter((s) => newest - Date.parse(isoTime(s.modelCompletionTime)!) <= 3 * HOUR_MS);
    const hits = recent.filter((s) => isoTime(s.estimatedShockArrivalTime))
      .sort((a, b) => Date.parse(isoTime(a.estimatedShockArrivalTime)!) - Date.parse(isoTime(b.estimatedShockArrivalTime)!));
    const s = hits[0];
    if (!s) continue;
    const kps = [s.kp_90, s.kp_135, s.kp_180, s.kp_18].map(numOrNull).filter((k): k is number => k !== null);
    const input = (s.cmeInputs ?? [])[0];
    out.push({
      cme,
      arrival: isoTime(s.estimatedShockArrivalTime)!,
      glancing: s.isEarthGB === true,
      minor: s.isEarthMinorImpact === true,
      speed: numOrNull(input?.speed),
      kp: kps.length ? [Math.min(...kps), Math.max(...kps)] : null,
      modelRun: isoTime(s.modelCompletionTime)!,
      link: typeof s.link === 'string' && /^https:\/\//.test(s.link) ? s.link : null,
    });
  }
  return out.sort((a, b) => a.arrival.localeCompare(b.arrival));
}

// ---------- Checks: is a part plausible? (the fetch, npm run check and the page use them) ----------

const okTime = (t: unknown) => typeof t === 'string' && !Number.isNaN(Date.parse(t));
const okLevel = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 5;
const okProb = (x: unknown) => x === null || (typeof x === 'number' && x >= 0 && x <= 100);

export function scalesProblems(s: any): string[] {
  const p: string[] = [];
  if (!okTime(s?.at)) p.push('scales: no time');
  for (const k of ['r', 's', 'g']) if (!okLevel(s?.now?.[k])) p.push(`scales: now.${k} ${s?.now?.[k]}`);
  if (s?.past24h !== null) for (const k of ['r', 's', 'g']) if (!okLevel(s?.past24h?.[k])) p.push(`scales: past24h.${k}`);
  if (!Array.isArray(s?.days)) p.push('scales: no days');
  else for (const d of s.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date)) p.push(`scales: day ${d?.date}`);
    if (!okProb(d?.rMinor) || !okProb(d?.rMajor) || !okProb(d?.s)) p.push(`scales: probabilities on ${d?.date}`);
    if (d?.g !== null && !okLevel(d?.g)) p.push(`scales: G on ${d?.date}`);
  }
  return p;
}

export function kpProblems(list: any): string[] {
  if (!Array.isArray(list) || list.length < 8) return [`Kp: ${Array.isArray(list) ? list.length : 'no'} values`];
  const p: string[] = [];
  list.forEach((k: KpPoint, i: number) => {
    if (!okTime(k?.t) || !(k.kp >= 0 && k.kp <= 9) || !['observed', 'estimated', 'predicted'].includes(k.kind)) p.push(`Kp ${i}: ${JSON.stringify(k)}`);
    else if (i > 0) {
      const gap = Date.parse(k.t) - Date.parse(list[i - 1].t);
      if (gap <= 0 || gap > 24 * HOUR_MS) p.push(`Kp ${i}: ${gap / HOUR_MS} h after the one before`);
    }
  });
  if (!list.some((k: KpPoint) => k.kind === 'predicted')) p.push('Kp: no forecast');
  return p;
}

export function flareProblems(list: any): string[] {
  if (!Array.isArray(list)) return ['flares: not a list'];
  return list.flatMap((f: Flare, i: number) =>
    !okTime(f?.peak) || !Number.isFinite(flareFlux(String(f?.cls))) || (f.begin !== null && !okTime(f.begin)) || (f.end !== null && !okTime(f.end))
      ? [`flare ${i}: ${JSON.stringify(f)}`] : []);
}

export function cmeProblems(list: any): string[] {
  if (!Array.isArray(list)) return ['CMEs: not a list'];
  return list.flatMap((c: CmeArrival, i: number) => {
    const bad = typeof c?.cme !== 'string' || !okTime(c.arrival) || !okTime(c.modelRun) || typeof c.glancing !== 'boolean' || typeof c.minor !== 'boolean'
      || (c.speed !== null && !(c.speed > 0 && c.speed < 5000))
      || (c.kp !== null && !(Array.isArray(c.kp) && c.kp[0] >= 0 && c.kp[1] <= 9 && c.kp[0] <= c.kp[1]))
      || (c.link !== null && !/^https:\/\//.test(c.link));
    return bad ? [`CME ${i}: ${JSON.stringify(c)}`] : [];
  });
}

const CHECKS: Record<PartName, (d: any) => string[]> = { scales: scalesProblems, kp: kpProblems, flares: flareProblems, cmes: cmeProblems };

/** Problems with one part ([] if it is fine, or if it is missing: every part may be missing). */
export function partProblems(name: PartName, part: any): string[] {
  if (part === null || part === undefined) return [];
  if (!okTime(part.fetchedAt)) return [`${name}: no fetch time`];
  return CHECKS[name](part.data);
}

export function fileProblems(f: any): string[] {
  if (!f || typeof f !== 'object' || !okTime(f.fetchedAt)) return ['not a space weather file'];
  return PART_NAMES.flatMap((n) => partProblems(n, f[n]));
}

// ---------- Where the data comes from ----------

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Where each part comes from; when a part has more than one address, they are tried in order. */
export function sources(nowMs: number): Record<PartName, string[]> {
  // Model runs of the last 7 days (a CME takes 1 to 5 days to reach Earth)
  const window = `startDate=${isoDay(nowMs - 7 * DAY_MS)}&endDate=${isoDay(nowMs)}`;
  return {
    scales: ['https://services.swpc.noaa.gov/products/noaa-scales.json'],
    kp: ['https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'],
    flares: ['https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json'],
    // DONKI through api.nasa.gov, with its shared demo key (a few requests an hour per address are
    // allowed, we need one every 3 hours). CCMC's own hosts did not answer GitHub's machines
    // (connection timed out, November 2026); one stays as a second try.
    cmes: [
      `https://api.nasa.gov/DONKI/WSAEnlilSimulations?${window}&api_key=DEMO_KEY`,
      `https://webtools.ccmc.gsfc.nasa.gov/DONKI/WS/get/WSAEnlilSimulations?${window}`,
    ],
  };
}

export const PARSERS: Record<PartName, (raw: any) => unknown> = { scales: parseScales, kp: parseKp, flares: parseFlares, cmes: parseEnlil };
