// Close approaches of asteroids and comets to Earth, from CNEOS: JPL's SBDB Close-Approach Data API
// (https://ssd-api.jpl.nasa.gov/doc/cad.html). Shared by the fetch script (runs on GitHub before each
// deploy), npm run check and the page. No DOM here.

export const AU_KM = 149_597_870.7;
/** Lunar distance, the mean distance of the Moon as CNEOS uses it [km]. */
export const LD_KM = 384_400;
export const LD_AU = LD_KM / AU_KM;

/** The window we ask JPL for: the usual CNEOS table, plus the last week. */
export const DAYS_BACK = 7;
export const DAYS_AHEAD = 60;
export const DIST_MAX_AU = 0.05; // about 7.5 million km, 19.5 lunar distances

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
/** TT - UTC since 2017-01-01 (32.184 s + 37 leap seconds). TDB stays within 2 ms of TT. */
const TT_MINUS_UTC_MS = 69_184;

export interface CloseApproach {
  des: string;               // JPL primary designation, e.g. "99942", "2024 YR4"
  name: string;              // JPL's full name, e.g. "99942 Apophis (2004 MN4)"; "2024 XY1" when it has no number
  jd: number;                // time of the closest approach, Julian Date (TDB)
  dist: number;              // nominal distance from Earth's centre [au]
  distMin: number;           // 3σ smallest and largest distance [au]
  distMax: number;
  vRel: number;              // speed relative to Earth [km/s]
  tSigmaMin: number | null;  // 3σ uncertainty of the time [minutes]; 0 means under a minute, null unknown
  h: number | null;          // absolute magnitude (brightness, for the size estimate); comets have none
  diameter: number | null;   // measured diameter [km], when JPL has one
}

export interface CloseApproachFile {
  source: string;     // JPL's signature, e.g. "NASA/JPL SBDB Close Approach Data API"
  apiVersion: string; // e.g. "1.5"
  fetchedAt: string;  // ISO time of the fetch
  dateMin: string;    // the window asked for (YYYY-MM-DD, TDB)
  dateMax: string;
  distMaxAu: number;
  approaches: CloseApproach[];
}

/** JPL's Julian Date (TDB) as a JavaScript time (UTC). */
export const tdbToUtcMs = (jd: number) => (jd - UNIX_EPOCH_JD) * DAY_MS - TT_MINUS_UTC_MS;

/** "< 00:01" -> 0, "13:02" -> 782, "2_09:08" -> 3428 minutes; anything else -> null. */
export function parseSigma(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (/^<\s*00:01$/.test(t)) return 0;
  const m = /^(?:(\d+)_)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Diameter range from the brightness, for albedos 0.25 (bright, small) to 0.05 (dark, large),
 * as CNEOS does: D = 1329 km / sqrt(albedo) * 10^(-H/5). Returns [smallest, largest] in km.
 */
export function sizeRange(h: number): [number, number] {
  const d = (p: number) => (1329 / Math.sqrt(p)) * Math.pow(10, -h / 5);
  return [d(0.25), d(0.05)];
}

const num = (x: unknown): number => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN);
const numOrNull = (x: unknown): number | null => (x === null || x === undefined || x === '' ? null : num(x));

/** Why this approach is not plausible, or null if it is fine. */
export function rowProblem(a: CloseApproach, distMaxAu = DIST_MAX_AU): string | null {
  if (typeof a.des !== 'string' || !a.des.trim()) return 'no designation';
  if (typeof a.name !== 'string' || !a.name.trim()) return 'no name';
  if (!Number.isFinite(a.jd) || a.jd < 2451545 || a.jd > 2524594) return `time ${a.jd}`; // 2000 to 2200
  if (!(a.dist > 0 && a.dist <= distMaxAu * 1.001)) return `distance ${a.dist}`;
  if (!(a.distMin > 0 && a.distMin <= a.dist * 1.000001 && a.distMax >= a.dist * 0.999999)) return `3σ distances ${a.distMin} ${a.distMax}`;
  if (!(a.vRel > 0 && a.vRel < 100)) return `speed ${a.vRel}`;
  if (a.tSigmaMin !== null && !(a.tSigmaMin >= 0)) return `time uncertainty ${a.tSigmaMin}`;
  if (a.h !== null && !(a.h > -5 && a.h < 40)) return `H ${a.h}`;
  if (a.diameter !== null && !(a.diameter > 0 && a.diameter < 1000)) return `diameter ${a.diameter}`;
  return null;
}

/** Most rows that may fail before the whole answer is refused (as a sign that the format changed). */
const MAX_BAD_SHARE = 0.1;

/**
 * Turns JPL's answer into our file. Throws if the answer does not look like the format we know
 * (version 1.x, the fields we need), or if more than a tenth of the rows are implausible.
 * Single implausible rows are left out and listed in `dropped`.
 */
export function fromCad(raw: any, info: { fetchedAt: string; dateMin: string; dateMax: string; distMaxAu: number }):
  { file: CloseApproachFile; dropped: string[] } {
  const sig = raw?.signature;
  if (typeof sig?.version !== 'string' || !/^1\.\d+$/.test(sig.version)) throw new Error(`unknown API version ${JSON.stringify(sig?.version)}`);
  if (typeof sig.source !== 'string' || !/close.approach/i.test(sig.source)) throw new Error(`unknown source ${JSON.stringify(sig.source)}`);
  const count = num(raw.count);
  if (!Number.isInteger(count) || count < 0) throw new Error(`bad count ${JSON.stringify(raw.count)}`);

  const approaches: CloseApproach[] = [];
  const dropped: string[] = [];
  if (count > 0) {
    const fields = raw.fields;
    const data = raw.data;
    if (!Array.isArray(fields) || !Array.isArray(data)) throw new Error('no fields or data');
    if (data.length !== count) throw new Error(`count ${count} but ${data.length} rows`);
    const at = (name: string) => fields.indexOf(name);
    for (const f of ['des', 'jd', 'dist', 'dist_min', 'dist_max', 'v_rel', 't_sigma_f', 'h']) {
      if (at(f) < 0) throw new Error(`field ${f} missing`);
    }
    const iName = at('fullname'), iDiam = at('diameter');
    for (const r of data) {
      if (!Array.isArray(r) || r.length !== fields.length) { dropped.push(`row of the wrong length: ${JSON.stringify(r)}`); continue; }
      const des = String(r[at('des')] ?? '').trim();
      let name = iName >= 0 ? String(r[iName] ?? '').trim() : '';
      if (!name) name = des;
      if (/^\([^()]*\)$/.test(name)) name = name.slice(1, -1); // "(2024 XY1)" -> "2024 XY1"
      const a: CloseApproach = {
        des,
        name,
        jd: num(r[at('jd')]),
        dist: num(r[at('dist')]),
        distMin: num(r[at('dist_min')]),
        distMax: num(r[at('dist_max')]),
        vRel: num(r[at('v_rel')]),
        tSigmaMin: parseSigma(r[at('t_sigma_f')]),
        h: numOrNull(r[at('h')]),
        diameter: iDiam >= 0 ? numOrNull(r[iDiam]) : null,
      };
      const problem = rowProblem(a, info.distMaxAu);
      if (problem) { dropped.push(`${des || '?'}: ${problem}`); continue; }
      approaches.push(a);
    }
    if (dropped.length > Math.max(1, count * MAX_BAD_SHARE)) {
      throw new Error(`${dropped.length} of ${count} rows are implausible, e.g. ${dropped.slice(0, 3).join('; ')}`);
    }
  }
  approaches.sort((x, y) => x.jd - y.jd);
  return {
    file: { source: sig.source, apiVersion: sig.version, ...info, approaches },
    dropped,
  };
}

/** Problems with one of our files (as fetched by the page, or kept from the site), or [] if it is fine. */
export function fileProblems(f: any): string[] {
  const out: string[] = [];
  if (!f || typeof f !== 'object') return ['not an object'];
  if (typeof f.source !== 'string' || typeof f.apiVersion !== 'string') out.push('no source or version');
  if (typeof f.fetchedAt !== 'string' || Number.isNaN(Date.parse(f.fetchedAt))) out.push('no fetch time');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateMin) || !/^\d{4}-\d{2}-\d{2}$/.test(f.dateMax)) out.push('no window');
  if (!(f.distMaxAu > 0)) out.push('no distance limit');
  if (!Array.isArray(f.approaches)) return [...out, 'no approaches'];
  f.approaches.forEach((a: CloseApproach, k: number) => {
    const p = rowProblem(a, f.distMaxAu);
    if (p) out.push(`approach ${k} (${a?.des}): ${p}`);
    if (k > 0 && a.jd < f.approaches[k - 1].jd) out.push(`approach ${k} is out of order`);
  });
  return out;
}

/** YYYY-MM-DD of a time, in UTC. */
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The CAD API address for the window around `nowMs`. */
export function cadQuery(nowMs: number): { url: string; dateMin: string; dateMax: string; distMaxAu: number } {
  const dateMin = isoDay(nowMs - DAYS_BACK * DAY_MS);
  const dateMax = isoDay(nowMs + DAYS_AHEAD * DAY_MS);
  const q = new URLSearchParams({
    'date-min': dateMin, 'date-max': dateMax, 'dist-max': String(DIST_MAX_AU),
    body: 'Earth', fullname: 'true', diameter: 'true',
  });
  return { url: `https://ssd-api.jpl.nasa.gov/cad.api?${q}`, dateMin, dateMax, distMaxAu: DIST_MAX_AU };
}
