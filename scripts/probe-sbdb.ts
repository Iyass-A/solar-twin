// Temporary diagnosis: how does JPL's SBDB API answer many requests in a row?
// Logs the status and headers of the first failure, then checks every minute when it works again.
//   npx tsx scripts/probe-sbdb.ts

const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
const USER_AGENT = 'solar-twin (https://github.com/Iyass-A/solar-twin)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;

async function get(n: number) {
  const res = await fetch(`${SBDB}?sstr=${n}&full-prec=1&cov=vec`, { headers: { 'User-Agent': USER_AGENT } });
  const text = await res.text();
  return { res, text };
}

function show(n: number, res: Response, text: string) {
  console.log(`  #${n}: HTTP ${res.status} ${res.statusText} after ${since()}`);
  res.headers.forEach((v, k) => console.log(`    ${k}: ${v}`));
  console.log(`    body: ${text.slice(0, 400).replace(/\s+/g, ' ')}`);
}

let ok = 0, n = 0;
for (n = 1; n <= 400; n++) {
  await sleep(300);
  const { res, text } = await get(n);
  if (n === 1) show(n, res, text);
  if (res.status !== 200) { show(n, res, text); break; }
  ok++;
}
console.log(`${ok} answers with HTTP 200 in a row (${since()})`);
if (ok < 400) {
  for (let k = 1; k <= 12; k++) {
    await sleep(60_000);
    const { res, text } = await get(1000 + k);
    console.log(`after ${k} min: HTTP ${res.status}`);
    if (res.status === 200) break;
    if (k === 1) show(1000 + k, res, text);
  }
}
