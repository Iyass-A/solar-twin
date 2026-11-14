// Makes src/data/stars.json from the Yale Bright Star Catalogue (5th ed., Hoffleit & Warren 1991),
// using the JSON copy by Bretton Wade (MIT licence, see public/THIRD-PARTY-LICENSES.txt):
//   https://raw.githubusercontent.com/brettonw/YaleBrightStarCatalog/master/bsc5-short.json
//   (commit abffb3b7223ae37e879b0a3ff5b49ad06aed5576)
//
// Run once, after downloading that file:
//   npx tsx scripts/make-stars.ts path/to/bsc5-short.json
//
// Keeps the stars visible to the naked eye (magnitude 6.0 or brighter), as one flat list:
//   [ra, dec, mag, kelvin, ra, dec, mag, kelvin, ...]
// ra/dec: J2000 equatorial, degrees. mag: visual magnitude (smaller = brighter).
// kelvin: approximate colour temperature from the spectral class (0 if unknown).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const MAG_LIMIT = 6.0;

interface Entry { RA?: string; Dec?: string; V?: string; K?: string; }

/** "06h 45m 08.9s" -> degrees */
function parseRa(s: string): number {
  const m = /^(\d+)h (\d+)m ([\d.]+)s$/.exec(s);
  if (!m) throw new Error(`Unreadable RA: ${s}`);
  return (Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * 15;
}

/** "-16° 42′ 58″" -> degrees */
function parseDec(s: string): number {
  const m = /^([+-])(\d+)° (\d+)′ (\d+)″$/.exec(s);
  if (!m) throw new Error(`Unreadable Dec: ${s}`);
  const v = Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  return m[1] === '-' ? -v : v;
}

const file = process.argv[2];
if (!file) throw new Error('Usage: npx tsx scripts/make-stars.ts path/to/bsc5-short.json');
const entries = JSON.parse(readFileSync(file, 'utf8')) as Entry[];

const rows: [number, number, number, number][] = [];
for (const e of entries) {
  if (!e.RA || !e.Dec || !e.V) continue; // a few catalogue numbers are not stars any more
  const mag = Number(e.V);
  if (!(mag <= MAG_LIMIT)) continue;
  rows.push([parseRa(e.RA), parseDec(e.Dec), mag, e.K ? Number(e.K) : 0]);
}
rows.sort((a, b) => a[2] - b[2]); // brightest first

const flat = rows.flatMap(([ra, dec, mag, k]) => [
  Number(ra.toFixed(3)), Number(dec.toFixed(3)), Number(mag.toFixed(2)), Math.round(k),
]);

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/stars.json', JSON.stringify({
  source: 'Yale Bright Star Catalogue, 5th ed. (Hoffleit & Warren 1991), via github.com/brettonw/YaleBrightStarCatalog (MIT)',
  magLimit: MAG_LIMIT,
  columns: ['ra', 'dec', 'mag', 'kelvin'],
  stars: flat,
}));
console.log(`${rows.length} stars up to magnitude ${MAG_LIMIT} -> src/data/stars.json`);
