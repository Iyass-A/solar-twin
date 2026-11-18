// npm run check: the video's sky and scenes (phase 8, step 2), see src/video/sky.ts and src/video/scenes.ts.
// (1) The chart: the centre in its place, east to the left and north up, the field of view across the picture,
//     shapes kept (a small circle stays a circle).
// (2) The Moon and the shadows against Astronomy Engine's own eclipses: every lunar eclipse of 2026-2027 reaches
//     the umbra, or only the penumbra, as its kind says; at every central solar eclipse's peak, seen from where the
//     shadow's centre is, the Moon sits on the Sun (larger for a total eclipse, smaller for an annular one).
//     The Moon's lit side faces the Sun (west at first quarter, east at last quarter).
// (3) Every scene of every event of 2026-2027: its shots fill it, each shot's clock has the event in its middle,
//     and the bodies the event is about are in the picture at that moment (wide and upright), the Moon all through
//     its close approaches; a week's video keeps the rarest events, in time order, between its opening and closing.

import { findEvents, type SkyEvent } from '../src/events/events';
import {
  angleBetween, discRadius, fromLonLat, moonLit, opposite, project, projection, screenDirection, shadowRadii, skyVector,
  type SkyBody,
} from '../src/video/sky';
import {
  FADE_S, MAX_EVENTS, eventScene, sceneAt, shotAt, shotOpacity, simTime, totalDuration, weekScenes, type SkyShot,
} from '../src/video/scenes';
import { chartCenter } from '../src/view/skyChart';
import { LANGS, STRINGS } from '../src/i18n';

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

export function checkVideo(): boolean {
  let ok = true;
  const fail = (msg: string) => { ok = false; console.log(`  FAIL ${msg}`); };
  const lines: string[] = [];

  // ---------- (1) The chart ----------
  {
    const W = 1920, H = 1080, cy = 0.42 * H;
    const c = fromLonLat(100, 0);
    const p = projection(c, 40, W, H, cy);
    const at = (lon: number, lat: number) => project(p, fromLonLat(lon, lat))!;
    const mid = at(100, 0);
    if (Math.abs(mid.x - W / 2) > 1e-9 || Math.abs(mid.y - cy) > 1e-9) fail(`chart: the centre at ${mid.x}, ${mid.y}`);
    const east = at(110, 0), north = at(100, 10);
    if (!(east.x < W / 2) || Math.abs(east.y - cy) > 1e-6) fail('chart: east (larger longitude) is not to the left');
    if (!(north.y < cy) || Math.abs(north.x - W / 2) > 1e-6) fail('chart: north is not up');
    const edgeL = at(120, 0), edgeR = at(80, 0);
    if (Math.abs(edgeL.x) > 1e-6 || Math.abs(edgeR.x - W) > 1e-6) fail(`chart: the field of view runs from ${edgeL.x} to ${edgeR.x}, not 0 to ${W}`);
    // A circle of 1° round a point 15° off the centre: stereographic keeps it round
    const centre = fromLonLat(112, 6);
    const q0 = project(p, centre)!;
    const radii: number[] = [];
    for (let a = 0; a < 360; a += 15) {
      const d = { x: Math.cos(a * Math.PI / 180), y: Math.sin(a * Math.PI / 180) };
      // a point 1° away in direction a, on the sky
      const e = projection(centre, 10, 100, 100);
      const v = { x: centre.x + Math.tan(Math.PI / 180) * (d.x * e.east.x + d.y * e.north.x), y: centre.y + Math.tan(Math.PI / 180) * (d.x * e.east.y + d.y * e.north.y), z: centre.z + Math.tan(Math.PI / 180) * (d.x * e.east.z + d.y * e.north.z) };
      const n = Math.hypot(v.x, v.y, v.z);
      const q = project(p, { x: v.x / n, y: v.y / n, z: v.z / n })!;
      radii.push(Math.hypot(q.x - q0.x, q.y - q0.y));
    }
    const spread = (Math.max(...radii) - Math.min(...radii)) / Math.min(...radii);
    if (spread > 0.01) fail(`chart: a 1° circle 15° off the centre is ${(spread * 100).toFixed(1)}% out of round`);
    lines.push(`chart: centre, east left, north up, field of view edge to edge; a 1° circle stays round within ${(spread * 100).toFixed(2)}%`);
  }

  // ---------- (2) The Moon, the shadows, and the eclipses ----------
  const y2026 = Date.UTC(2026, 0, 1), y2028 = Date.UTC(2028, 0, 1);
  const all = findEvents(y2026, y2028);
  {
    let lunar = 0, solar = 0, worstSolar = 0;
    for (const e of all) {
      if (e.kind === 'lunarEclipse') {
        lunar++;
        const sun = skyVector('sun', e.ms), moon = skyVector('moon', e.ms);
        const sep = angleBetween(opposite(sun.dir), moon.dir), r = discRadius('moon', moon.au);
        const { umbra, penumbra } = shadowRadii(moon.au, sun.au);
        const kind = sep + r < umbra ? 'total' : sep - r < umbra ? 'partial' : sep - r < penumbra ? 'penumbral' : 'none';
        if (kind !== e.type) fail(`lunar eclipse ${iso(e.ms)}: our shadow makes it ${kind}, Astronomy Engine ${e.type} (${sep.toFixed(3)}°, umbra ${umbra.toFixed(3)}°)`);
      }
      if (e.kind === 'solarEclipse' && e.lat !== null && e.lon !== null) {
        solar++;
        const place = { lat: e.lat, lon: e.lon };
        const sun = skyVector('sun', e.ms, place), moon = skyVector('moon', e.ms, place);
        const sep = angleBetween(sun.dir, moon.dir);
        worstSolar = Math.max(worstSolar, sep);
        const bigger = discRadius('moon', moon.au) > discRadius('sun', sun.au);
        if (sep > 0.02) fail(`solar eclipse ${iso(e.ms)}: seen from ${e.lat.toFixed(1)}, ${e.lon.toFixed(1)} the Moon is ${sep.toFixed(3)}° off the Sun`);
        if (bigger !== (e.type === 'total')) fail(`solar eclipse ${iso(e.ms)}: ${e.type}, but the Moon looks ${bigger ? 'larger' : 'smaller'} than the Sun`);
      }
    }
    // The lit side: towards the Sun, so to the right (west) at first quarter and to the left at last quarter
    let quarters = 0;
    for (const e of all) {
      if (e.kind !== 'moon') continue;
      const moon = skyVector('moon', e.ms).dir, sun = skyVector('sun', e.ms).dir;
      const lit = moonLit(e.ms);
      const want = e.phase === 'new' ? [0, 0.01] : e.phase === 'full' ? [0.99, 1] : [0.45, 0.55];
      if (lit < want[0] || lit > want[1]) fail(`${e.phase} ${iso(e.ms)}: ${(lit * 100).toFixed(1)}% lit`);
      if (e.phase === 'firstQuarter' || e.phase === 'lastQuarter') {
        quarters++;
        const d = screenDirection(projection(moon, 5, 1920, 1080), moon, sun)!;
        if (e.phase === 'firstQuarter' ? d.x < 0.9 : d.x > -0.9) fail(`${e.phase} ${iso(e.ms)}: the lit side faces ${d.x.toFixed(2)}, ${d.y.toFixed(2)} on the screen`);
      }
    }
    lines.push(`Moon and shadows: ${lunar} lunar eclipses of the kind Astronomy Engine says, ${solar} central solar eclipses with the Moon within ${worstSolar.toFixed(4)}° of the Sun from the centre line, ${quarters} quarters lit on the side of the Sun`);
  }

  // ---------- (3) The scenes ----------
  {
    let scenes = 0, shotsChecked = 0, moonRuns = 0;
    const formats = [{ W: 1920, H: 1080 }, { W: 1080, H: 1920 }];
    const inside = (shot: SkyShot, b: SkyBody | 'antisun', ms: number, W: number, H: number, fov: number, margin: number) => {
      const p = projection(chartCenter(shot, ms), fov, W, H, H * (H > W ? 0.38 : 0.42));
      const v = b === 'antisun' ? opposite(skyVector('sun', ms, shot.place).dir) : skyVector(b, ms, shot.place).dir;
      const q = project(p, v);
      return !!q && q.x > margin * W && q.x < (1 - margin) * W && q.y > margin * H && q.y < (1 - margin) * H;
    };
    for (const e of all) {
      const sc = eventScene(e);
      scenes++;
      const where = `${e.kind} ${iso(e.ms)}`;
      if (!(sc.duration >= 5 && sc.duration <= 12)) fail(`${where}: lasts ${sc.duration} s`);
      // The shots follow each other from 0 to the end, each with its clock round the event
      let t = 0;
      for (const s of sc.shots) {
        if (Math.abs(s.from - t) > 1e-9 || !(s.to > s.from)) fail(`${where}: shot from ${s.from} to ${s.to} after ${t}`);
        t = s.to;
        if (Math.abs((s.simFrom + s.simTo) / 2 - e.ms) > 1000 || s.simTo < s.simFrom) fail(`${where}: the clock runs ${iso(s.simFrom)} to ${iso(s.simTo)}, not round the event`);
        if (Math.abs(simTime(s, (s.from + s.to) / 2) - e.ms) > 1000) fail(`${where}: the event is not in the middle of its shot`);
        if (shotOpacity(s, s.from) !== 0 || shotOpacity(s, (s.from + s.to) / 2) !== 1 || Math.abs(shotOpacity(s, s.from + FADE_S / 2) - 0.5) > 1e-9) fail(`${where}: the fades`);
        if (s.kind === 'space' && !(s.zoom.every((z) => z > 0.5 && z < 2) && s.el.every((x) => x > 30 && x < 90))) fail(`${where}: camera ${JSON.stringify(s)}`);
        if (s.kind !== 'sky') continue;
        shotsChecked++;
        // At the event's moment, what it is about is in the picture, clear of the edges, in both formats
        const about: (SkyBody | 'antisun')[] = [...s.focus];
        if (s.shadow) about.push('antisun');
        for (const { W, H } of formats) {
          const fov = s.fov[0] + (s.fov[1] - s.fov[0]) / 2;
          for (const b of about) if (!inside(s, b, e.ms, W, H, fov, 0.04)) fail(`${where}: ${b} is outside the ${W}×${H} picture at the event`);
          // and above the caption, in the wide picture
          if (W > H) for (const b of s.focus) {
            const p = projection(chartCenter(s, e.ms), fov, W, H, H * 0.42);
            const q = project(p, b === 'sun' || b === 'moon' ? skyVector(b, e.ms, s.place).dir : skyVector(b, e.ms).dir);
            if (q && q.y > 0.7 * H) fail(`${where}: ${b} is behind the caption (y ${(q.y / H).toFixed(2)})`);
          }
        }
        // The Moon stays in the picture all through its close approaches and phases
        if (s.focus.includes('moon') && (e.kind === 'pair' || e.kind === 'moon')) {
          moonRuns++;
          for (let u = 0; u <= 1.0001; u += 0.125) {
            const local = s.from + u * (s.to - s.from), ms = simTime(s, local);
            const fov = s.fov[0] + (s.fov[1] - s.fov[0]) * u * u * (3 - 2 * u);
            if (!inside(s, 'moon', ms, 1920, 1080, fov, 0.01)) { fail(`${where}: the Moon leaves the picture at ${iso(ms)}`); break; }
          }
        }
      }
      if (Math.abs(t - sc.duration) > 1e-9) fail(`${where}: the shots end at ${t}, the scene at ${sc.duration}`);
    }
    lines.push(`scenes: ${scenes} (every event of 2026-2027), ${shotsChecked} sky shots with what they show in the picture, wide and upright, ${moonRuns} with the Moon in it all through`);

    // A week's video
    const from = Date.UTC(2027, 6, 15), to = from + 30 * DAY_MS; // with the total eclipse of 2.8.2027 and more than 8 events
    const week = all.filter((e) => e.ms >= from && e.ms < to);
    const seq = weekScenes(all, from, to);
    const kept = seq.slice(1, -1).map((x) => x.event!) as SkyEvent[];
    if (seq[0].kind !== 'intro' || seq[seq.length - 1].kind !== 'outro') fail('week: no opening or closing scene');
    if (kept.length !== Math.min(MAX_EVENTS, week.length)) fail(`week: ${kept.length} events of ${week.length}`);
    if (kept.some((e, i) => i > 0 && e.ms < kept[i - 1].ms)) fail('week: not in time order');
    if (week.length > MAX_EVENTS && kept.some((e) => e.kind === 'moon') && week.filter((e) => e.kind !== 'moon').length >= MAX_EVENTS) fail('week: a phase of the Moon kept over a rarer event');
    if (!kept.some((e) => e.kind === 'solarEclipse')) fail('week: the eclipse was left out');
    const total = totalDuration(seq);
    const ends = sceneAt(seq, total + 5);
    if (ends.index !== seq.length - 1 || ends.local !== seq[seq.length - 1].duration) fail('week: past the end');
    const second = sceneAt(seq, seq[0].duration + 0.001);
    if (second.index !== 1 || Math.abs(second.local - 0.001) > 1e-9) fail('week: the second scene does not start after the first');
    const s1 = seq[1];
    if (shotAt(s1, s1.duration).to !== s1.duration) fail('week: the last shot at the end of a scene');
    lines.push(`30 days from 15.7.2027: ${week.length} events, ${kept.length} kept (the total eclipse among them), ${total.toFixed(1)} s with opening and closing`);
  }

  // ---------- (4) Texts ----------
  for (const l of LANGS) {
    const v = STRINGS[l.id].video;
    for (const [k, x] of Object.entries(v)) {
      const text = typeof x === 'function' ? (x as (...a: unknown[]) => string)('X', 'Y') : x;
      if (!String(text).trim() || /undefined|NaN/.test(String(text))) fail(`${l.id} video.${k}: "${text}"`);
    }
    if (!v.speed(STRINGS[l.id].duration(360)).includes('6')) fail(`${l.id}: the clock's speed`);
    if (!v.weekCount(5).includes('5')) fail(`${l.id}: the week's count`);
  }

  for (const x of lines) console.log(`  ${x}`);
  console.log(`Video scenes: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}
