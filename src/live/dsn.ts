// Deep Space Network now: which spacecraft NASA's big antennas at Goldstone (California), Madrid and
// Canberra are talking to. From NASA's DSN Now (https://eyes.nasa.gov/dsn/): dsn.xml, new every few
// seconds, and config.xml (the antennas' sizes and the spacecraft's names), which rarely changes.
//
// Shared by the small server on Cloudflare (workers/dsn/, it turns the XML into our JSON), npm run check
// and the page. No DOM here: the server has none, so the XML is read by the small reader below.

/** NASA's live file (a query string with the time keeps caches from serving an old one). */
export const DSN_XML_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
export const DSN_CONFIG_URL = 'https://eyes.nasa.gov/dsn/config.xml';
/** The only site whose pages may read the server's answer. */
export const ALLOWED_ORIGIN = 'https://iyass-a.github.io';
/**
 * Our server on Cloudflare (workers/dsn/), where the page gets the data. Empty until the server is
 * deployed: then the card says the live link is not set up yet.
 */
export const DSN_WORKER_URL = '';

/** Speed of light [km/s]. */
export const C_KM_S = 299_792.458;

// ---------- A small XML reader ----------
// Enough for NASA's two files: elements with attributes, nesting, text. No DTDs, no CDATA, no namespaces.

export interface XmlEl {
  name: string;
  attrs: Record<string, string>;
  children: XmlEl[];
  text: string;
}

const MAX_XML = 1_000_000;

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k[0] === '#') {
      const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k]!;
  });
}

/** Reads an XML document into a tree. Throws if it is not well formed (as far as this reader checks). */
export function parseXml(xml: string): XmlEl {
  if (typeof xml !== 'string') throw new Error('not text');
  if (xml.length > MAX_XML) throw new Error(`too long (${xml.length} characters)`);
  const src = xml.replace(/^﻿/, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const root: XmlEl = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlEl[] = [root];
  const tag = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)|(<)/g;
  const attr = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[6]) throw new Error(`broken tag near "${src.slice(m.index, m.index + 40)}"`);
    if (m[5] !== undefined) { top.text += decode(m[5]); continue; }
    const [, close, name, attrText, selfClose] = m;
    if (close) {
      if (top.name !== name) throw new Error(`</${name}> closes <${top.name}>`);
      stack.pop();
      continue;
    }
    const el: XmlEl = { name, attrs: {}, children: [], text: '' };
    let a: RegExpExecArray | null;
    attr.lastIndex = 0;
    while ((a = attr.exec(attrText))) el.attrs[a[1]] = decode(a[2] ?? a[3] ?? '');
    top.children.push(el);
    if (!selfClose) stack.push(el);
  }
  if (stack.length !== 1) throw new Error(`<${stack[stack.length - 1].name}> is never closed`);
  const elements = root.children;
  if (elements.length !== 1) throw new Error(`${elements.length} root elements`);
  if (root.text.trim()) throw new Error('text outside the root element');
  return elements[0];
}

// ---------- Our format ----------

/** A spacecraft one antenna is pointed at. */
export interface DsnLink {
  sc: string;              // DSN's code, e.g. "VGR1"
  naif: number | null;     // its NAIF id (as in JPL Horizons), e.g. -31
  name: string | null;     // NASA's name (config.xml), e.g. "Voyager 1"
  km: number | null;       // distance from the antenna [km]
  rtlt: number | null;     // round-trip light time [s]
  /** We send to it (only when the signal is on): band, transmitter power [kW]. */
  up: { band: string; kw: number | null } | null;
  /** We receive from it (signals that are on): band, data rate [bit/s]. */
  down: { band: string; bps: number | null }[];
}

export interface DsnDish {
  id: string;              // "DSS43"
  size: string | null;     // "70M", "34M", "34MHEF" (config.xml)
  az: number | null;       // where it points: azimuth and elevation [°]
  el: number | null;
  wind: number | null;     // wind at the antenna [km/h]
  activity: string;        // NASA's words, e.g. "Spacecraft Telemetry, Tracking, and Command"
  /** Several spacecraft through one antenna (MSPA), antennas used together (array), or ΔDOR navigation. */
  mspa: boolean; array: boolean; ddor: boolean;
  links: DsnLink[];        // spacecraft only (not tests, radar or radio astronomy, see NOT_SPACECRAFT)
}

export interface DsnStation {
  id: string;              // "gdscc", "mdscc", "cdscc"
  name: string;            // "Goldstone"
  utcOffsetMin: number | null; // as NASA gives it (the page uses the real time zone for the three it knows)
  dishes: DsnDish[];
}

export interface DsnFile {
  v: 1;
  at: string;              // NASA's time of the data (ISO)
  fetchedAt: string;       // when our server got it (ISO)
  stations: DsnStation[];
}

/** From config.xml: antenna sizes by antenna, spacecraft names by code (lowercase). */
export interface DsnConfig { sizes: Record<string, string>; names: Record<string, string>; }

/** Targets that are not spacecraft: tests, radio astronomy, radar and the like (DSN codes, lowercase). */
export const NOT_SPACECRAFT = new Set(['dsn', 'test', 'vlbi', 'rfc', 'gbra', 'hcra', 'gssr', 'gvrt', 'egs', 'sgp', 'atot', 'rsts', 'cass']);

const numOrNull = (x: string | undefined): number | null => {
  if (x === undefined || x.trim() === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
/** DSN writes -1 for "not known". */
const positiveOrNull = (x: string | undefined) => {
  const n = numOrNull(x);
  return n !== null && n > 0 ? n : null;
};
const yes = (x: string | undefined) => x?.trim().toLowerCase() === 'true';
const clean = (s: string | undefined, max: number) => (s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function parseConfig(xml: string): DsnConfig {
  const root = parseXml(xml);
  if (root.name !== 'config') throw new Error(`config.xml: root is <${root.name}>`);
  const sizes: Record<string, string> = {};
  const names: Record<string, string> = {};
  for (const sites of root.children.filter((e) => e.name === 'sites'))
    for (const site of sites.children) for (const d of site.children)
      if (d.name === 'dish' && d.attrs.name && d.attrs.type) sizes[d.attrs.name.toUpperCase()] = clean(d.attrs.type, 12).toUpperCase();
  for (const map of root.children.filter((e) => e.name === 'spacecraftMap'))
    for (const s of map.children)
      if (s.name === 'spacecraft' && s.attrs.name && s.attrs.friendlyName) names[s.attrs.name.toLowerCase()] = clean(s.attrs.friendlyName, 80);
  if (!Object.keys(sizes).length || !Object.keys(names).length) throw new Error('config.xml: no antennas or no spacecraft');
  return { sizes, names };
}

/**
 * dsn.xml into our format. In the file, each <station> is followed by its <dish> elements; each dish
 * lists its <target>s (what it points at) and its <upSignal>/<downSignal>s (on or off).
 */
export function parseDsn(xml: string, config: DsnConfig | null, fetchedAtMs: number): DsnFile {
  const root = parseXml(xml);
  if (root.name !== 'dsn') throw new Error(`root is <${root.name}>, not <dsn>`);
  const stamp = root.children.find((e) => e.name === 'timestamp');
  const atMs = Number(stamp?.text.trim());
  if (!stamp || !Number.isFinite(atMs) || atMs < Date.UTC(2020, 0, 1)) throw new Error(`no time (<timestamp>${stamp?.text ?? ''})`);
  const stations: DsnStation[] = [];
  for (const el of root.children) {
    if (el.name === 'station') {
      const id = clean(el.attrs.name, 12).toLowerCase();
      if (!id) throw new Error('station without a name');
      const off = numOrNull(el.attrs.timeZoneOffset);
      stations.push({ id, name: clean(el.attrs.friendlyName, 40) || id, utcOffsetMin: off === null ? null : Math.round(off / 60_000), dishes: [] });
    } else if (el.name === 'dish') {
      const station = stations[stations.length - 1];
      if (!station) throw new Error('antenna before any station');
      const id = clean(el.attrs.name, 12).toUpperCase();
      if (!/^DSS\d{1,3}$/.test(id)) throw new Error(`antenna "${el.attrs.name}"`);
      const links: DsnLink[] = [];
      const link = (code: string) => {
        let l = links.find((x) => x.sc === code);
        if (!l) {
          l = { sc: code, naif: null, name: config?.names[code.toLowerCase()] ?? null, km: null, rtlt: null, up: null, down: [] };
          links.push(l);
        }
        return l;
      };
      for (const c of el.children) {
        const code = clean(c.name === 'target' ? c.attrs.name : c.attrs.spacecraft, 16).toUpperCase();
        if (!code || NOT_SPACECRAFT.has(code.toLowerCase()) || !/^[A-Z0-9-]+$/.test(code)) continue;
        if (c.name === 'target') {
          const l = link(code);
          const n = numOrNull(c.attrs.id);
          if (n !== null && n > 0 && l.naif === null) l.naif = -n;
          l.km = positiveOrNull(c.attrs.downlegRange) ?? positiveOrNull(c.attrs.uplegRange);
          l.rtlt = positiveOrNull(c.attrs.rtlt);
        } else if (c.name === 'upSignal' || c.name === 'downSignal') {
          const l = link(code);
          const naif = numOrNull(c.attrs.spacecraftID);
          if (naif !== null && naif < 0) l.naif = naif;
          if (!yes(c.attrs.active)) continue;
          const band = clean(c.attrs.band, 4).toUpperCase();
          if (!/^[A-Z]{1,3}$/.test(band)) continue;
          if (c.name === 'upSignal') l.up = { band, kw: positiveOrNull(c.attrs.power) };
          else {
            const bps = positiveOrNull(c.attrs.dataRate);
            // The same signal is often listed twice
            if (!l.down.some((d) => d.band === band && d.bps === bps)) l.down.push({ band, bps });
          }
        }
      }
      station.dishes.push({
        id,
        size: config?.sizes[id] ?? null,
        az: numOrNull(el.attrs.azimuthAngle),
        el: numOrNull(el.attrs.elevationAngle),
        wind: numOrNull(el.attrs.windSpeed),
        activity: clean(el.attrs.activity, 120),
        mspa: yes(el.attrs.isMSPA), array: yes(el.attrs.isArray), ddor: yes(el.attrs.isDDOR),
        links,
      });
    }
  }
  if (!stations.length) throw new Error('no stations');
  return { v: 1, at: new Date(atMs).toISOString(), fetchedAt: new Date(fetchedAtMs).toISOString(), stations };
}

// ---------- Summaries (the page and the log) ----------

/** A spacecraft is in contact when at least one signal to or from it is on. */
export const inContact = (l: DsnLink) => l.up !== null || l.down.length > 0;

/** Spacecraft in contact right now (each once, the antenna with the highest data rate first), and the antennas busy with them. */
export function contacts(f: DsnFile): { links: { link: DsnLink; dish: DsnDish; station: DsnStation }[]; dishes: number } {
  const best = new Map<string, { link: DsnLink; dish: DsnDish; station: DsnStation }>();
  let dishes = 0;
  const rate = (l: DsnLink) => Math.max(0, ...l.down.map((d) => d.bps ?? 0));
  for (const station of f.stations) for (const dish of station.dishes) {
    const on = dish.links.filter(inContact);
    if (on.length) dishes++;
    for (const link of on) {
      const had = best.get(link.sc);
      if (!had || rate(link) > rate(had.link)) best.set(link.sc, { link, dish, station });
    }
  }
  return { links: [...best.values()], dishes };
}

// ---------- Checks (the server, npm run check and the page) ----------

const okTime = (t: unknown) => typeof t === 'string' && !Number.isNaN(Date.parse(t));
const okNum = (x: unknown, lo: number, hi: number) => x === null || (typeof x === 'number' && x >= lo && x <= hi);
const okText = (x: unknown, max: number) => typeof x === 'string' && x.length <= max && !/[<>]/.test(x);

/** What is wrong with a DSN file ([] if nothing). */
export function dsnProblems(f: any): string[] {
  if (!f || typeof f !== 'object' || f.v !== 1) return [`not a DSN file (version ${f?.v})`];
  const p: string[] = [];
  if (!okTime(f.at)) p.push('no time');
  if (!okTime(f.fetchedAt)) p.push('no fetch time');
  if (!Array.isArray(f.stations) || f.stations.length < 1 || f.stations.length > 6) return [...p, `${f.stations?.length} stations`];
  let dishes = 0;
  for (const s of f.stations) {
    if (!okText(s?.id, 12) || !s.id || !okText(s.name, 40) || !okNum(s.utcOffsetMin, -14 * 60, 14 * 60) || !Array.isArray(s.dishes)) { p.push(`station ${JSON.stringify(s).slice(0, 80)}`); continue; }
    for (const d of s.dishes) {
      dishes++;
      const where = `${s.id} ${d?.id}`;
      if (!/^DSS\d{1,3}$/.test(d?.id)) { p.push(`antenna ${where}`); continue; }
      if (!(d.size === null || okText(d.size, 12)) || !okNum(d.az, -360, 360) || !okNum(d.el, -90, 90) || !okNum(d.wind, 0, 500) || !okText(d.activity, 120)
        || typeof d.mspa !== 'boolean' || typeof d.array !== 'boolean' || typeof d.ddor !== 'boolean' || !Array.isArray(d.links) || d.links.length > 20) {
        p.push(`antenna ${where}: ${JSON.stringify(d).slice(0, 120)}`); continue;
      }
      for (const l of d.links) {
        const bad = !/^[A-Z0-9-]{1,16}$/.test(l?.sc) || !okNum(l.naif, -1e6, -1) || !(l.name === null || okText(l.name, 80))
          || !okNum(l.km, 1, 1e12) || !okNum(l.rtlt, 1e-3, 1e6)
          || !(l.up === null || (/^[A-Z]{1,3}$/.test(l.up?.band) && okNum(l.up.kw, 0, 1000)))
          || !Array.isArray(l.down) || l.down.length > 8 || l.down.some((x: any) => !/^[A-Z]{1,3}$/.test(x?.band) || !okNum(x.bps, 0, 1e10));
        if (bad) p.push(`link ${where}: ${JSON.stringify(l).slice(0, 120)}`);
      }
    }
  }
  if (dishes < 1 || dishes > 60) p.push(`${dishes} antennas`);
  return p;
}
