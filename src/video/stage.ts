// The video stage (phase 8, step 2): plays the scenes of src/video/scenes.ts at the video's size, so they can be
// watched (with play, pause and a time bar) and, in the next step, recorded frame by frame.
//
// Address: video.html?lang=ar|de|en&format=16x9|9x16&from=2026-11-23&days=7&tz=UTC&event=3&record
// - from and days: the stretch whose events are shown (default: from this hour, 7 days);
// - event: only that event's scene (its number in the stretch, from 0); without it, the whole week with opening and closing;
// - tz: the time zone for the times shown (default UTC);
// - record: no controls and no playing; a recorder calls window.stage.seek(t) and takes a picture after each.
// Each frame depends only on t: the camera, the clock and the captions come from the scene, nothing from the
// time it takes to draw.

import '../style.css';
// The video page brings its own fonts (served from our site, SIL Open Font License), so a video looks the same
// wherever it is recorded: Inter for Latin letters and digits, Noto Sans Arabic for Arabic
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/600.css';
import '@fontsource/noto-sans-arabic/700.css';
import './stage.css';
import { PLANETS } from '../astro/elements';
import { heliocentricPosition, orbitPath } from '../astro/kepler';
import { centuriesSinceJ2000, toJulianDate } from '../astro/julian';
import { findEvents, type SkyEvent } from '../events/events';
import { fileProblems, type CloseApproach } from '../live/closeApproaches';
import { LANGS, dateTime, dayMonthYearRange, lang, setLang, t, type Lang } from '../i18n';
import { Scene3D } from '../view/scene3d';
import { SkyChart } from '../view/skyChart';
import { approximate, eventNote, eventTitle, latLon } from '../view/skyEvents';
import type { BodyFrame } from '../view/views';
import {
  along, eventScene, framePlan, hoursPerSecond, sceneAt, shotAt, shotOpacity, simTime, totalDuration, weekScenes, type Scene, type Shot,
} from './scenes';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const SITE = 'iyass-a.github.io/solar-twin';

const params = new URLSearchParams(location.search);
const l = (LANGS.some((x) => x.id === params.get('lang')) ? params.get('lang') : 'ar') as Lang;
setLang(l);
document.documentElement.lang = l;
document.documentElement.dir = LANGS.find((x) => x.id === l)!.dir;
const format = params.get('format') === '9x16' ? '9x16' : '16x9';
const tz = params.get('tz') ?? 'UTC';
const record = params.has('record');
const fromParam = params.get('from');
const fromMs = fromParam ? Date.parse(/T/.test(fromParam) ? fromParam : `${fromParam}T00:00:00Z`) : Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
const days = Math.min(31, Math.max(1, Number(params.get('days') ?? 7) || 7));
const toMs = fromMs + days * DAY_MS;

/** "UTC", or the zone's offset ("GMT+3"). */
function zoneName(): string {
  if (tz === 'UTC') return 'UTC';
  const part = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(fromMs).find((x) => x.type === 'timeZoneName');
  return part?.value ?? tz;
}

// ---------- The stage ----------

const stage = document.getElementById('stage')!;
stage.className = `f${format}`;
stage.innerHTML = `
  <div class="layer space"><div id="space3d"></div></div>
  <canvas class="layer sky"></canvas>
  <div class="shade"></div>
  <div class="brand">Solar Twin<span>${SITE}</span></div>
  <div class="clock"><div class="clock-time"></div><div class="clock-speed"></div><div class="clock-from"></div></div>
  <div class="caption"><h1 class="cap-title"></h1><p class="cap-when"></p><p class="cap-note"></p></div>`;
const $ = <T extends HTMLElement>(sel: string) => stage.querySelector(sel) as T;
const spaceLayer = $<HTMLDivElement>('.space');
const skyCanvas = $<HTMLCanvasElement>('canvas.sky');
const caption = $<HTMLDivElement>('.caption');
const clock = $<HTMLDivElement>('.clock');

const cssW = format === '9x16' ? 540 : 960, cssH = format === '9x16' ? 960 : 540;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
skyCanvas.width = Math.round(cssW * dpr);
skyCanvas.height = Math.round(cssH * dpr);

const scene3d = new Scene3D($('#space3d'));
const sky = new SkyChart(skyCanvas);

// ---------- What to show ----------

let events: SkyEvent[] = [];
let scenes: Scene[] = [];

async function loadNeos(): Promise<CloseApproach[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/live/close-approaches.json`, { cache: 'no-cache' });
    if (!r.ok) return [];
    const f = await r.json();
    return fileProblems(f).length ? [] : f.approaches;
  } catch {
    return [];
  }
}

function bodiesAt(ms: number): BodyFrame[] {
  const T = centuriesSinceJ2000(toJulianDate(new Date(ms)));
  const names = t().planets;
  return PLANETS.map((p) => ({ id: p.id, name: names[p.id], pos: heliocentricPosition(p, T), orbit: orbitPath(p, T) }));
}

// ---------- One frame ----------

let lastCaption = '';

function captionFor(scene: Scene): { html: string; cls: string } {
  const s = t();
  const card = (title: string, when: string, note: string) =>
    `<h1 class="cap-title">${title}</h1><p class="cap-when">${when}</p><p class="cap-note">${note}</p>`;
  if (scene.kind === 'intro') {
    return { cls: 'caption card', html: card(s.video.weekTitle, dayMonthYearRange(scene.week!.from, scene.week!.to - 1, l, tz), s.video.weekCount(scenes.length - 2)) };
  }
  if (scene.kind === 'outro') {
    return { cls: 'caption card', html: card('Solar Twin', s.video.outroLine, `<span class="url">${SITE}</span>${s.video.sources}`) };
  }
  const e = scene.event!;
  const ms = approximate(e) ? Math.round(e.ms / HOUR_MS) * HOUR_MS : e.ms;
  const when = s.video.when(approximate(e) ? s.events.about(dateTime(ms, l, tz)) : dateTime(ms, l, tz), zoneName());
  const eclipse = e.kind === 'solarEclipse' || e.kind === 'lunarEclipse';
  return { cls: `caption${eclipse ? ' eclipse' : ''}`, html: card(eventTitle(e), when, eventNote(e)) };
}

function drawShot(shot: Shot, local: number) {
  const ms = simTime(shot, local);
  const op = shotOpacity(shot, local);
  spaceLayer.style.opacity = shot.kind === 'space' ? String(op) : '0';
  skyCanvas.style.opacity = shot.kind === 'space' ? '0' : String(op);
  if (shot.kind === 'space') {
    scene3d.mode = shot.mode;
    scene3d.selected = shot.select;
    scene3d.direct({ az: along(shot.az, shot, local), el: along(shot.el, shot, local), zoom: along(shot.zoom, shot, local) * (format === '9x16' ? 1.12 : 1), focus: null, lift: format === '9x16' ? 0.22 : 0.16 });
    scene3d.draw(bodiesAt(ms));
  } else if (shot.kind === 'sky') {
    sky.draw(shot, ms, along(shot.fov, shot, local));
  } else {
    sky.drawDistance(shot, (local - shot.from) / (shot.to - shot.from), shot.name);
  }
  return ms;
}

/** Draws second t of the video. */
function render(time: number) {
  const { scene, local } = sceneAt(scenes, time);
  const shot = shotAt(scene, local);
  const ms = drawShot(shot, local);
  const s = t();

  // Caption: in after 0.4 s, out before the scene ends
  const c = captionFor(scene);
  if (c.html + c.cls !== lastCaption) { caption.className = c.cls; caption.innerHTML = c.html; lastCaption = c.html + c.cls; }
  caption.style.opacity = String(Math.max(0, Math.min(1, (local - 0.4) / 0.4, (scene.duration - 0.25 - local) / 0.3)));

  // The clock, when time runs during an event's shot
  const running = scene.kind === 'event' && shot.kind !== 'distance';
  clock.style.opacity = running ? String(shotOpacity(shot, local)) : '0';
  if (running) {
    clock.children[0].textContent = s.video.when(dateTime(ms, l, tz), zoneName());
    clock.children[1].textContent = s.video.speed(s.duration(hoursPerSecond(shot) * 60));
    clock.children[2].innerHTML = shot.kind === 'sky'
      ? (shot.place ? s.video.fromPlace(latLon(shot.place.lat, shot.place.lon)) : s.video.fromCentre)
      : '';
  }
}

// ---------- Preview controls ----------

let playing = false;
let now = 0;
let duration = 0;

function controls() {
  const box = document.getElementById('controls')!;
  box.hidden = false;
  const pick = params.get('event');
  const link = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(changes)) { if (v === null) p.delete(k); else p.set(k, v); }
    return `?${p}`;
  };
  const options = [`<option value="">${t().video.weekTitle}</option>`,
    ...events.map((e, i) => `<option value="${i}"${pick === String(i) ? ' selected' : ''}>${dateTime(e.ms, l, tz)} · ${eventTitle(e).replace(/<[^>]+>/g, '')}</option>`)];
  box.innerHTML = `
    <button type="button" id="playBtn">▶</button>
    <input type="range" id="seek" min="0" max="${duration}" step="0.01" value="0" aria-label="time">
    <span class="t" id="tText"></span>
    <select id="pick">${options.join('')}</select>
    <span>${LANGS.map((x) => `<a href="${link({ lang: x.id })}">${x.name}</a>`).join(' · ')}</span>
    <a href="${link({ format: format === '16x9' ? '9x16' : '16x9' })}">${format === '16x9' ? '9:16' : '16:9'}</a>`;
  const playBtn = document.getElementById('playBtn') as HTMLButtonElement;
  const seek = document.getElementById('seek') as HTMLInputElement;
  const tText = document.getElementById('tText')!;
  const setPlaying = (on: boolean) => { playing = on; playBtn.textContent = on ? '❚❚' : '▶'; };
  playBtn.addEventListener('click', () => { if (now >= duration) now = 0; setPlaying(!playing); });
  seek.addEventListener('input', () => { setPlaying(false); now = seek.valueAsNumber; render(now); });
  (document.getElementById('pick') as HTMLSelectElement).addEventListener('change', (ev) => {
    location.search = link({ event: (ev.target as HTMLSelectElement).value || null });
  });
  let last = performance.now();
  const frame = (tNow: number) => {
    const dt = Math.min(0.1, (tNow - last) / 1000);
    last = tNow;
    if (playing) {
      now = Math.min(duration, now + dt);
      if (now >= duration) setPlaying(false);
      render(now);
    }
    seek.value = String(now);
    tText.textContent = `${now.toFixed(1)} / ${duration.toFixed(1)} s`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  setPlaying(true);
}

/** Fit the stage into the window in preview (the recorder sets the window to the stage's size). */
function fit() {
  const k = record ? 1 : Math.min(1, (window.innerWidth) / cssW, (window.innerHeight - 60) / cssH);
  stage.style.transform = k === 1 ? '' : `scale(${k})`;
  const vp = document.getElementById('viewport')!;
  vp.style.height = `${cssH * k}px`;
}

// ---------- Start ----------

async function start() {
  const [neos, starFile] = await Promise.all([loadNeos(), import('../data/stars.json')]);
  sky.setStars((starFile.default as { stars: number[] }).stars);
  events = findEvents(fromMs, toMs, neos);
  const pick = params.get('event');
  const i = pick === null ? NaN : Number(pick);
  scenes = Number.isInteger(i) && events[i] ? [eventScene(events[i])] : weekScenes(events, fromMs, toMs);
  duration = totalDuration(scenes);
  // The chart's canvas text does not ask for the fonts by itself: load each weight before the first frame
  await Promise.all(['400', '600', '700'].flatMap((w) => [
    document.fonts.load(`${w} 20px "Inter"`, 'Aa1°'), document.fonts.load(`${w} 20px "Noto Sans Arabic"`, 'السما'),
  ]));
  await document.fonts.ready;
  // The 3D view's stars come in their own file: wait for them, so the first frame has them too
  for (let k = 0; k < 200 && !scene3d.starsReady; k++) await new Promise((r) => setTimeout(r, 25));
  fit();
  window.addEventListener('resize', fit);
  render(0);
  if (!record) controls();
}

const ready = start();

declare global {
  interface Window {
    stage: {
      ready: Promise<void>;
      duration: () => number;
      seek: (t: number) => void;
      scenes: () => number;
      /** The frames to record, scene by scene (scripts/record-video.mjs) */
      plan: (fps: number) => { start: number; frames: number; name: string }[];
      lang: () => Lang;
    };
  }
}
window.stage = {
  ready,
  duration: () => duration,
  seek: (time) => render(time),
  scenes: () => scenes.length,
  plan: (fps) => framePlan(scenes, fps).map((p, i) => ({ ...p, name: scenes[i].event?.kind ?? scenes[i].kind })),
  lang,
};
