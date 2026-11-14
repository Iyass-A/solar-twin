// Counts the bodies in each group of data/small-body-groups.json and shows the shape of JPL's answer,
// before a long fetch. Runs in GitHub Actions ("Fetch small-body data" with mode "count").
//
//   npx tsx scripts/count-small-bodies.ts data/small-body-groups.json

import { readFileSync } from 'node:fs';

const QUERY = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(params: Record<string, string>) {
  await sleep(500);
  const url = `${QUERY}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'solar-twin (https://github.com/Iyass-A/solar-twin)' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 600)}`);
  return JSON.parse(text);
}

const { groups } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let total = 0;
for (const g of groups) {
  const all = await get(g.params);                       // no fields: the number of matches only
  const sample = await get({ ...g.params, fields: 'spkid,full_name,pdes,name,kind,class,neo,pha,H,diameter,epoch,e,q,tp,om,w,i,condition_code', sort: g.sort, limit: '2', 'full-prec': '1' });
  const n = Math.min(Number(all.count ?? NaN), g.limit);
  total += n;
  console.log(`${g.id}: ${all.count} match, ${n} kept (limit ${g.limit})  -  ${g.title}`);
  console.log(`  count answer keys: ${Object.keys(all).join(', ')}`);
  console.log(`  sample answer keys: ${Object.keys(sample).join(', ')}`);
  console.log(`  sample fields: ${JSON.stringify(sample.fields)}`);
  console.log(`  sample data: ${JSON.stringify(sample.data)}`);
}
console.log(`\nAbout ${total} bodies before removing duplicates.`);
