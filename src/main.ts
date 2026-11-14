import './style.css';
import { J2000, toJulianDate, centuriesSinceJ2000 } from './astro/julian';
import { PLANETS, VALID_FROM_MS, VALID_TO_MS } from './astro/elements';
import { heliocentricPosition, orbitPath, longitude, distance, wrap180 } from './astro/kepler';
import { referencePosition } from './astro/reference';
import { Orrery } from './view/orrery';
import { VIEWS, type BodyFrame, type ViewMode } from './view/views';
import type { Scene3D } from './view/scene3d';
import {
  SMALL_COLORS, SMALL_GROUPS, loadSmallBodies, smallLabel, smallFullName, isValidAt, smallPosition, smallOrbitPath,
  type SmallBody, type SmallFrame,
} from './view/smallbodies';
import pkg from '../package.json';
import { LANGS, detectLang, lang, langInfo, num, setLang, t, type Lang, type TextKey } from './i18n';

const DAY_MS = 86_400_000;

// Our simple formulas should stay within 1 degree of the reference.
const MAX_ERROR_DEG = 1;

// Self-check: 2000-01-01 12:00 UTC must give exactly 2451545.0
const jdOk = Math.abs(toJulianDate(new Date(Date.UTC(2000, 0, 1, 12))) - J2000) < 1e-9;

// Simulated days per real second (the names are in src/i18n.ts)
const SPEED_DAYS = [1, 7, 30.44, 365.25];
const VIEW_MODES = Object.keys(VIEWS) as ViewMode[];

const clamp = (ms: number) => Math.min(VALID_TO_MS, Math.max(VALID_FROM_MS, ms));

// ---------- Page ----------
// Texts come from src/i18n.ts: data-t sets the text, data-html the HTML, data-aria the screen-reader label.

setLang(detectLang());

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="top">
    <h1 data-t="title"></h1>
    <div class="langs" role="group" data-aria="language">
      ${LANGS.map((l) => `<button type="button" data-lang="${l.id}" lang="${l.id}">${l.name}</button>`).join('')}
    </div>
  </div>
  <p class="step"><span data-t="tagline"></span>
    <span class="version"><bdi>v${pkg.version}</bdi> <span data-t="beta"></span></span></p>

  <div class="tabs" role="tablist">
    <button type="button" role="tab" id="tab3d" data-t="tab3d"></button>
    <button type="button" role="tab" id="tab2d" data-t="tab2d"></button>
  </div>
  <div class="card sky">
    <div id="sky3d" class="view" hidden><div class="loading" data-t="loading"></div></div>
    <canvas id="sky" class="view" data-aria="mapAria" hidden></canvas>
  </div>
  <p class="caption"><span id="caption"></span><br><span id="howto"></span></p>
  <p class="legend" id="legend">
    ${SMALL_GROUPS.map((g) => `<span class="key"><i style="background:${SMALL_COLORS[g]}"></i><span id="legend-${g}"></span></span>`).join('')}
    <span class="note" data-t="smallNote"></span>
  </p>

  <div class="card" id="info">
    <div class="sub" id="infoHint" data-t="infoHint"></div>
    <div id="infoBody" hidden>
      <div class="value" id="infoName"></div>
      <div class="facts">
        <div id="rowType" hidden><span class="label" data-t="type"></span><span id="infoType"></span></div>
        <div class="sub" id="infoOutside" hidden></div>
        <div class="dist"><span class="label" data-t="fromSun"></span><span id="infoSun"></span></div>
        <div class="dist"><span class="label" data-t="fromEarth"></span><span id="infoEarth"></span></div>
        <div class="dist"><span class="label" data-t="lightTime"></span><span id="infoLight"></span></div>
        <div id="rowDiameter" hidden><span class="label" data-t="diameter"></span><span id="infoDiameter"></span></div>
      </div>
    </div>
  </div>

  <div class="card controls">
    <div class="row">
      <button id="play" type="button"></button>
      <button id="now" type="button" data-t="now"></button>
      <label><span data-t="speed"></span> <select id="speed">
        ${SPEED_DAYS.map((_, i) => `<option value="${i}"></option>`).join('')}
      </select></label>
      <label><span data-t="view"></span> <select id="view">
        ${VIEW_MODES.map((m) => `<option value="${m}"></option>`).join('')}
      </select></label>
      <label class="check"><input type="checkbox" id="smallToggle" checked> <span data-t="smallBodies"></span></label>
    </div>
    <div class="timeline" dir="ltr">
      <span>1800</span>
      <input id="slider" type="range" min="0" max="${(VALID_TO_MS - VALID_FROM_MS) / DAY_MS}" step="any"
             data-aria="timeBar">
      <span>2050</span>
    </div>
    <div class="row">
      <label><span data-t="goToDate"></span> <input id="date" type="date" dir="ltr" min="1800-01-01" max="2050-12-31"></label>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="label"><span data-t="simTime"></span> <span id="live" class="badge" data-t="live"></span></div>
      <div class="value" dir="ltr" id="time"></div>
      <div class="sub" dir="ltr" id="jd"></div>
    </div>
    <div class="card" id="check">
      <div class="label" data-t="check"></div>
      <div class="value" id="checkValue"></div>
      <div class="sub"><span data-t="worst"></span> <span dir="ltr" id="worst"></span></div>
    </div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th data-t="colPlanet"></th>
          <th class="num" data-html="colDistanceHtml"></th>
          <th class="num" data-t="colLongitude"></th>
          <th class="num" data-t="colError"></th>
        </tr>
      </thead>
      <tbody>
        ${PLANETS.map((p) => `
          <tr data-id="${p.id}">
            <td id="n-${p.id}"></td>
            <td dir="ltr" id="d-${p.id}"></td>
            <td dir="ltr" id="l-${p.id}"></td>
            <td dir="ltr" id="e-${p.id}"></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <details class="card" id="smallCard" hidden>
    <summary id="smallSummary"></summary>
    <table>
      <thead>
        <tr>
          <th data-t="colPlanet"></th>
          <th data-t="type"></th>
          <th class="num" data-html="colDistanceHtml"></th>
        </tr>
      </thead>
      <tbody id="smallRows"></tbody>
    </table>
  </details>

  <footer class="sources">
    <p>
      <a href="https://github.com/Iyass-A/solar-twin/issues/new" target="_blank" rel="noopener" data-t="feedback"></a> ·
      <a href="https://github.com/Iyass-A/solar-twin" target="_blank" rel="noopener"><span data-t="sourceCode"></span> <bdi>(AGPL-3.0)</bdi></a> ·
      <a href="${import.meta.env.BASE_URL}THIRD-PARTY-LICENSES.txt" target="_blank" rel="noopener" data-t="licences"></a>
    </p>
    <p><span data-t="sources"></span>
    <span dir="ltr">
      <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL: Approximate Positions of the Planets</a> ·
      <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">Astronomy Engine</a> ·
      <a href="https://doi.org/10.1007/s10569-017-9805-5" target="_blank" rel="noopener">IAU WGCCRE 2015 (Saturn's pole)</a> ·
      <a href="https://ssd-api.jpl.nasa.gov/doc/sbdb.html" target="_blank" rel="noopener">JPL Small-Body Database</a> ·
      <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> ·
      <a href="https://github.com/brettonw/YaleBrightStarCatalog" target="_blank" rel="noopener">Yale Bright Star Catalogue, 5th ed. (Hoffleit &amp; Warren 1991), JSON by Bretton Wade (MIT)</a> ·
      <a href="https://threejs.org/" target="_blank" rel="noopener">Three.js</a>
    </span></p>
  </footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const playBtn = $<HTMLButtonElement>('play');
const nowBtn = $<HTMLButtonElement>('now');
const speedSel = $<HTMLSelectElement>('speed');
const viewSel = $<HTMLSelectElement>('view');
const slider = $<HTMLInputElement>('slider');
const dateInput = $<HTMLInputElement>('date');

const orrery = new Orrery($<HTMLCanvasElement>('sky'));
let scene3d: Scene3D | null = null; // loaded on first use (Three.js is a separate file)

// Asteroids, dwarf planets and comets: their own file, loaded after the page
let smallBodies: SmallBody[] = [];
let showSmall = true;
const smallToggle = $<HTMLInputElement>('smallToggle');
import('./data/small-bodies.json')
  .then((m) => {
    smallBodies = loadSmallBodies(m.default);
    $('smallRows').innerHTML = smallBodies.map((b) => `
      <tr data-id="${b.id}">
        <td id="n-${b.id}"></td>
        <td id="g-${b.id}"></td>
        <td dir="ltr" id="d-${b.id}"></td>
      </tr>`).join('');
    $('smallRows').querySelectorAll<HTMLTableRowElement>('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => select(tr.dataset.id!));
    });
    $('smallCard').hidden = false;
    applyLanguage(lang());
  })
  .catch((err) => console.error('Asteroids and comets not loaded', err));

smallToggle.addEventListener('change', () => {
  showSmall = smallToggle.checked;
  $('legend').hidden = !showSmall;
  if (!showSmall && orrery.selected?.startsWith('sb-')) select(null);
});

// ---------- Clock ----------

const clock = {
  ms: Date.now(),
  live: true,      // follow real time
  playing: false,  // run the simulation at clock.speed
  speed: SPEED_DAYS[1],
};
speedSel.value = '1';

function setPlaying(on: boolean) {
  clock.playing = on;
  if (on) clock.live = false;
  playBtn.textContent = on ? t().pause : t().play;
}

function jumpTo(ms: number) {
  clock.ms = clamp(ms);
  clock.live = false;
}

playBtn.addEventListener('click', () => setPlaying(!clock.playing));
nowBtn.addEventListener('click', () => { setPlaying(false); clock.live = true; });
speedSel.addEventListener('change', () => { clock.speed = SPEED_DAYS[Number(speedSel.value)]; });

let dragging = false;
slider.addEventListener('pointerdown', () => { dragging = true; });
window.addEventListener('pointerup', () => { dragging = false; });
slider.addEventListener('input', () => jumpTo(VALID_FROM_MS + slider.valueAsNumber * DAY_MS));

dateInput.addEventListener('change', () => {
  if (!Number.isNaN(dateInput.valueAsNumber)) jumpTo(dateInput.valueAsNumber);
});

function setView(mode: ViewMode) {
  orrery.mode = mode;
  orrery.zoom = 1;
  if (scene3d) { scene3d.mode = mode; scene3d.resetCamera(); }
  $('caption').textContent = t().views[mode].caption;
}
viewSel.addEventListener('change', () => setView(viewSel.value as ViewMode));

// ---------- 3D scene or 2D map ----------

type Kind = '3d' | '2d';
let kind: Kind = '3d';

function show(k: Kind) {
  kind = k;
  $('sky3d').hidden = k !== '3d';
  $('sky').hidden = k !== '2d';
  $('tab3d').setAttribute('aria-selected', String(k === '3d'));
  $('tab2d').setAttribute('aria-selected', String(k === '2d'));
  $('howto').textContent = k === '3d' ? t().howto3d : t().howto2d;
  if (k === '3d' && !scene3d) void load3d();
}

let loading3d = false;
async function load3d() {
  if (loading3d) return;
  loading3d = true;
  try {
    const { Scene3D } = await import('./view/scene3d');
    scene3d = new Scene3D($('sky3d'));
    scene3d.mode = orrery.mode;
    scene3d.selected = orrery.selected;
    scene3d.onPick = select;
  } catch (err) {
    // No WebGL (or the file did not load): stay with the 2D map
    console.error(err);
    loading3d = false;
    $<HTMLButtonElement>('tab3d').disabled = true;
    $('tab3d').title = t().no3d;
    show('2d');
  }
}

$('tab3d').addEventListener('click', () => show('3d'));
$('tab2d').addEventListener('click', () => show('2d'));

// ---------- Selecting a planet, asteroid or comet ----------

const AU_KM = 149_597_870.7;
const LIGHT_SECONDS_PER_AU = 499.004784;

function select(id: string | null) {
  orrery.selected = id;
  if (scene3d) scene3d.selected = id;
  document.querySelectorAll<HTMLTableRowElement>('tr[data-id]').forEach((tr) => {
    tr.classList.toggle('selected', tr.dataset.id === id);
  });
  lastPanels = -Infinity; // refresh the panels right away
}

$<HTMLCanvasElement>('sky').addEventListener('click', (ev) => {
  const box = (ev.target as HTMLCanvasElement).getBoundingClientRect();
  select(orrery.hitTest(ev.clientX - box.left, ev.clientY - box.top));
});

document.querySelectorAll<HTMLTableRowElement>('tr[data-id]').forEach((tr) => {
  tr.addEventListener('click', () => select(tr.dataset.id!));
});

const fmtDistance = (au: number) =>
  `<span dir="ltr">${num(au, 3)} ${t().au}</span> · <span dir="ltr">${num(au * AU_KM / 1e6, 1)}</span> ${t().millionKm}`;

const yearOf = (jd: number) => String(Math.floor(2000 + (jd - J2000) / 365.25));

function updateInfo(bodies: BodyFrame[], jd: number) {
  const planet = bodies.find((b) => b.id === orrery.selected);
  const small = planet ? undefined : smallBodies.find((b) => b.id === orrery.selected);
  const valid = !small || isValidAt(small, jd);
  $('infoHint').hidden = !!(planet || small);
  $('infoBody').hidden = !(planet || small);
  if (!planet && !small) return;

  const s = t();
  const l = lang();
  $('infoName').textContent = planet ? planet.name : smallFullName(small!, l);
  $('rowType').hidden = !small;
  $('rowDiameter').hidden = !small?.diameter || !valid;
  $('infoOutside').hidden = valid;
  document.querySelectorAll<HTMLElement>('#infoBody .dist').forEach((el) => { el.hidden = !valid; });
  if (small) {
    const cls = s.classes[small.classCode] ?? small.className;
    $('infoType').textContent = cls ? `${s.groups[small.group]} · ${cls}` : s.groups[small.group];
    if (small.diameter) $('infoDiameter').innerHTML = `<span dir="ltr">${num(small.diameter, small.diameter < 10 ? 2 : 0)}</span> ${s.km}`;
    if (!valid) { $('infoOutside').textContent = s.outsideWindow(yearOf(small.validFrom), yearOf(small.validTo)); return; }
  }

  const pos = planet ? planet.pos : smallPosition(small!, jd);
  const earth = bodies.find((b) => b.id === 'earth')!.pos;
  const toEarth = Math.hypot(pos.x - earth.x, pos.y - earth.y, pos.z - earth.z);

  $('infoSun').innerHTML = fmtDistance(distance(pos));
  if (planet?.id === 'earth') {
    $('infoEarth').textContent = '—';
    $('infoLight').textContent = t().weAreHere;
  } else {
    $('infoEarth').innerHTML = fmtDistance(toEarth);
    $('infoLight').textContent = t().light(toEarth * LIGHT_SECONDS_PER_AU / 60);
  }
}

// ---------- Language ----------

function applyLanguage(l: Lang) {
  setLang(l);
  const s = t();
  document.documentElement.lang = l;
  document.documentElement.dir = langInfo().dir;
  document.title = `Solar Twin · ${s.title}`;

  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => { el.textContent = s[el.dataset.t as TextKey]; });
  document.querySelectorAll<HTMLElement>('[data-html]').forEach((el) => { el.innerHTML = s[el.dataset.html as TextKey]; });
  document.querySelectorAll<HTMLElement>('[data-aria]').forEach((el) => {
    el.setAttribute('aria-label', s[el.dataset.aria as TextKey]);
  });
  speedSel.querySelectorAll('option').forEach((o, i) => { o.textContent = s.speeds[i]; });
  viewSel.querySelectorAll('option').forEach((o) => { o.textContent = s.views[o.value as ViewMode].label; });
  for (const p of PLANETS) $(`n-${p.id}`).textContent = s.planets[p.id];
  for (const b of smallBodies) {
    $(`n-${b.id}`).textContent = smallLabel(b, l);
    $(`g-${b.id}`).textContent = s.groups[b.group];
  }
  for (const g of SMALL_GROUPS) $(`legend-${g}`).textContent = s.groups[g];
  $('smallSummary').textContent = `${s.smallBodies} (${smallBodies.length})`;
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === l));
  });
  if ($<HTMLButtonElement>('tab3d').disabled) $('tab3d').title = s.no3d;

  setPlaying(clock.playing);
  $('caption').textContent = s.views[orrery.mode].caption;
  $('howto').textContent = kind === '3d' ? s.howto3d : s.howto2d;
  scene3d?.refreshTexts();
  lastPanels = -Infinity;
}

document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
  b.addEventListener('click', () => applyLanguage(b.dataset.lang as Lang));
});

// ---------- Panels (updated a few times per second) ----------

let lastPanels = -Infinity;

function updatePanels(date: Date, bodies: BodyFrame[]) {
  const jd = toJulianDate(date);
  updateInfo(bodies, jd);
  $('time').textContent = date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  $('jd').textContent = `JD ${num(jd, 5)}`;
  $('live').hidden = !clock.live;
  if (document.activeElement !== dateInput) dateInput.value = date.toISOString().slice(0, 10);

  let worst = 0;
  for (const b of bodies) {
    const ref = referencePosition(b.id, date);
    const err = Math.abs(wrap180(longitude(b.pos) - longitude(ref)));
    worst = Math.max(worst, err);
    $(`d-${b.id}`).textContent = num(distance(b.pos), 3);
    $(`l-${b.id}`).textContent = `${num(longitude(b.pos), 2)}°`;
    $(`e-${b.id}`).textContent = `${num(err, 3)}°`;
  }

  for (const b of smallBodies) {
    $(`d-${b.id}`).textContent = isValidAt(b, jd) ? num(distance(smallPosition(b, jd)), 3) : '—';
  }

  const ok = jdOk && worst < MAX_ERROR_DEG;
  $('check').className = `card ${ok ? 'ok' : 'bad'}`;
  $('checkValue').textContent = ok ? t().passed : t().failed;
  $('worst').textContent = `${num(worst, 3)}°`;
}

// ---------- Start ----------

applyLanguage(lang());
setView('compressed');
show('3d');

// ---------- Animation loop ----------

let last = performance.now();

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.25); // seconds; capped after a hidden tab
  last = now;

  if (clock.live) {
    clock.ms = clamp(Date.now());
  } else if (clock.playing) {
    clock.ms = clamp(clock.ms + dt * clock.speed * DAY_MS);
    if (clock.ms >= VALID_TO_MS) setPlaying(false);
  }

  const date = new Date(clock.ms);
  const T = centuriesSinceJ2000(toJulianDate(date));
  const names = t().planets;
  const bodies: BodyFrame[] = PLANETS.map((p) => ({
    id: p.id,
    name: names[p.id],
    pos: heliocentricPosition(p, T),
    orbit: orbitPath(p, T),
  }));

  // Asteroids and comets, each only in the years where our position is accurate
  const jd = toJulianDate(date);
  const l = lang();
  const smalls: SmallFrame[] = [];
  let selectedOrbit: { path: ReturnType<typeof smallOrbitPath>; color: string } | null = null;
  if (showSmall) {
    for (const b of smallBodies) {
      if (!isValidAt(b, jd)) continue;
      smalls.push({ id: b.id, label: smallLabel(b, l), group: b.group, pos: smallPosition(b, jd) });
      if (b.id === orrery.selected) selectedOrbit = { path: smallOrbitPath(b), color: SMALL_COLORS[b.group] };
    }
  }

  if (kind === '2d') orrery.draw(bodies, smalls, selectedOrbit);
  else scene3d?.draw(bodies, smalls, selectedOrbit);
  if (!dragging) slider.valueAsNumber = (clock.ms - VALID_FROM_MS) / DAY_MS;
  if (now - lastPanels > 250) {
    lastPanels = now;
    updatePanels(date, bodies);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
