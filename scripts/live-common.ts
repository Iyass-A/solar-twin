// Shared by the live-data fetch scripts (scripts/fetch-*.ts that run before each deploy):
// polite GET with a few retries, writing a file in one go, and warnings for the GitHub log.

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const USER_AGENT = 'solar-twin (https://github.com/Iyass-A/solar-twin)';
const ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;
// JPL's API answers "403 Forbidden" for about a minute when it gets too many requests (see
// scripts/fetch-small-bodies.ts); then we wait longer than that.
const BLOCKED_WAIT_MS = 75_000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A warning that GitHub shows on the run's summary page. */
export const warn = (title: string, msg: string) => console.log(`::warning title=${title}::${msg}`);

export const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** GET JSON. Tries again when the server is busy or the connection drops; not after 400 or 404. */
export async function getJson(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    let wait = 20_000 * attempt;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      if (res.status === 403 || res.status === 429) wait = BLOCKED_WAIT_MS;
      const msg = `HTTP ${res.status}: ${text.slice(0, 200).replace(/\s+/g, ' ')}`;
      if (res.status === 400 || res.status === 404 || attempt >= ATTEMPTS) throw new Error(msg);
      console.log(`  ${msg}, trying again in ${wait / 1000} s`);
    } catch (err) {
      if (attempt >= ATTEMPTS || /^HTTP (400|404)/.test(errText(err))) throw err;
      console.log(`  ${errText(err)}, trying again in ${wait / 1000} s`);
    }
    await sleep(wait);
  }
}

/** Writes the whole file at once, so the site never gets a half-written one. */
export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, path);
}
