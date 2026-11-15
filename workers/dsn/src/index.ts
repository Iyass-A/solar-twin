// The small server for live DSN data, on Cloudflare Workers (free plan).
//
// It fetches NASA's DSN Now (dsn.xml, new every few seconds) at most once a minute, turns it into a small
// JSON for our "Deep Space Network" card (src/live/dsn.ts), and hands that to every visitor in between.
// So NASA gets at most one request a minute from us, however many people look.
//
// Privacy: no cookies, nothing about visitors is stored or logged (this code logs nothing, and Cloudflare's
// Workers Logs are off in wrangler.toml). Only pages on our own site may read the answer (CORS).
//
// Published by .github/workflows/deploy-worker.yml. npm run check tests handle() with a fake NASA.

import { ALLOWED_ORIGIN, DSN_CONFIG_URL, DSN_XML_URL, dsnProblems, parseConfig, parseDsn, type DsnConfig } from '../../../src/live/dsn';

const FRESH_MS = 60_000;            // NASA at most once a minute
const CONFIG_MS = 6 * 3_600_000;    // names and antenna sizes: every 6 hours
const STALE_OK_MS = 10 * 60_000;    // if NASA does not answer, a copy up to 10 minutes old is still given
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'solar-twin (https://github.com/Iyass-A/solar-twin)';

/** What handle() needs from outside, so npm run check can give it a fake NASA and a fake clock. */
export interface Deps {
  fetch: typeof fetch;
  now: () => number;
  /** Cloudflare's cache in this data centre, if there is one (shared by the copies of this server there). */
  cache?: Cache | null;
  waitUntil?: (p: Promise<unknown>) => void;
}

interface Copy { ms: number; body: string; }

/** Kept between requests while this copy of the server runs (Cloudflare keeps it for a while). */
export interface State {
  data: Copy | null;
  config: { ms: number; value: DsnConfig } | null;
  pending: Promise<Copy> | null;
}
export const newState = (): State => ({ data: null, config: null, pending: null });
const state = newState();

const CACHE_KEY = 'https://solar-twin-dsn.cache/dsn-v1.json';

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Vary': 'Origin',
    'Cache-Control': 'public, max-age=30',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  });
}

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: headers(extra) });

async function getText(deps: Deps, url: string): Promise<string> {
  const res = await deps.fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`NASA answered HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > 1_000_000) throw new Error('NASA answered with too much');
  return text;
}

async function config(deps: Deps, st: State): Promise<DsnConfig | null> {
  const now = deps.now();
  if (st.config && now - st.config.ms < CONFIG_MS) return st.config.value;
  try {
    st.config = { ms: now, value: parseConfig(await getText(deps, DSN_CONFIG_URL)) };
  } catch {
    // Without names the data still works (the page has its own for the well-known spacecraft); try again in a minute
    if (st.config) st.config.ms = now - CONFIG_MS + FRESH_MS;
  }
  return st.config?.value ?? null;
}

/** A fresh copy from NASA (one at a time: requests that come meanwhile wait for the same one). */
function refresh(deps: Deps, st: State): Promise<Copy> {
  st.pending ??= (async () => {
    try {
      const now = deps.now();
      const [xml, cfg] = await Promise.all([getText(deps, `${DSN_XML_URL}?r=${Math.floor(now / 5000)}`), config(deps, st)]);
      const file = parseDsn(xml, cfg, now);
      const problems = dsnProblems(file);
      if (problems.length) throw new Error(`NASA's data looks different: ${problems.slice(0, 2).join('; ')}`);
      const copy = { ms: now, body: JSON.stringify(file) };
      st.data = copy;
      if (deps.cache) {
        const put = deps.cache.put(CACHE_KEY, new Response(copy.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${FRESH_MS / 1000}`, 'X-Fetched': String(now) } }));
        deps.waitUntil ? deps.waitUntil(put.catch(() => {})) : await put.catch(() => {});
      }
      return copy;
    } finally {
      st.pending = null;
    }
  })();
  return st.pending;
}

/** Our copy from Cloudflare's cache, if another copy of this server put a fresh one there. */
async function fromCache(deps: Deps): Promise<Copy | null> {
  if (!deps.cache) return null;
  try {
    const hit = await deps.cache.match(CACHE_KEY);
    const ms = Number(hit?.headers.get('X-Fetched'));
    if (!hit || !Number.isFinite(ms) || deps.now() - ms >= FRESH_MS) return null;
    return { ms, body: await hit.text() };
  } catch {
    return null;
  }
}

export async function handle(request: Request, deps: Deps, st: State = state): Promise<Response> {
  const origin = request.headers.get('Origin');
  // Browsers send Origin from other sites' pages: those get nothing, and cost NASA nothing
  if (origin !== null && origin !== ALLOWED_ORIGIN) return json(403, { error: 'This data is only for pages on iyass-a.github.io.' });
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers({ 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Max-Age': '86400' }) });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, { error: 'Only GET.' }, { Allow: 'GET, HEAD, OPTIONS' });
  const path = new URL(request.url).pathname;
  if (path !== '/' && path !== '/dsn.json') return json(404, { error: 'Not here. Try /' });

  const now = deps.now();
  let copy = st.data && now - st.data.ms < FRESH_MS ? st.data : null;
  copy ??= await fromCache(deps);
  if (copy && (!st.data || copy.ms > st.data.ms)) st.data = copy;
  if (!copy) {
    try {
      copy = await refresh(deps, st);
    } catch (err) {
      const old = st.data && now - st.data.ms < STALE_OK_MS ? st.data : null;
      if (!old) return json(502, { error: `No data from NASA right now (${err instanceof Error ? err.message : String(err)}).` }, { 'Cache-Control': 'no-store' });
      copy = old;
    }
  }
  const age = Math.max(0, Math.round((now - copy.ms) / 1000));
  return new Response(request.method === 'HEAD' ? null : copy.body, { status: 200, headers: headers({ Age: String(age) }) });
}

export default {
  async fetch(request: Request, _env: unknown, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default ?? null : null;
    return handle(request, { fetch: (input, init) => fetch(input, init), now: Date.now, cache, waitUntil: (p) => ctx.waitUntil(p) });
  },
};
