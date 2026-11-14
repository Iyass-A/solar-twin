import './style.css';
import { J2000, toJulianDate, centuriesSinceJ2000 } from './astro/julian';
import { PLANETS, VALID_FROM_MS, VALID_TO_MS } from './astro/elements';
import { heliocentricPosition, orbitPath, longitude, distance, wrap180 } from './astro/kepler';
import { referencePosition } from './astro/reference';
import { Orrery, VIEWS, type BodyFrame, type ViewMode } from './view/orrery';

const DAY_MS = 86_400_000;

// Our simple formulas should stay within 1 degree of the reference.
const MAX_ERROR_DEG = 1;

// Self-check: 2000-01-01 12:00 UTC must give exactly 2451545.0
const jdOk = Math.abs(toJulianDate(new Date(Date.UTC(2000, 0, 1, 12))) - J2000) < 1e-9;

const SPEEDS = [
  { days: 1, label: 'يوم بالثانية' },
  { days: 7, label: 'أسبوع بالثانية' },
  { days: 30.44, label: 'شهر بالثانية' },
  { days: 365.25, label: 'سنة بالثانية' },
];

const clamp = (ms: number) => Math.min(VALID_TO_MS, Math.max(VALID_FROM_MS, ms));

// ---------- Page ----------

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>التوأم الرقمي للمجموعة الشمسية</h1>
  <p class="step">الخطوة 3: رسم الكواكب وشريط الزمن</p>

  <div class="card sky">
    <canvas id="sky" aria-label="خريطة الكواكب حول الشمس"></canvas>
  </div>
  <p class="caption"><span id="caption"></span><br>
    منظر من فوق، والكواكب بتدور عكس عقارب الساعة. أحجام الكواكب مو حقيقية.
    الأرقام على الدواير هي البعد بالوحدة الفلكية. دولاب الماوس بيكبّر، ودبل كليك بيرجّع.</p>

  <div class="card controls">
    <div class="row">
      <button id="play" type="button"></button>
      <button id="now" type="button">هلأ</button>
      <label>السرعة <select id="speed">
        ${SPEEDS.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}
      </select></label>
      <label>العرض <select id="view">
        ${(Object.keys(VIEWS) as ViewMode[]).map((m) => `<option value="${m}">${VIEWS[m].label}</option>`).join('')}
      </select></label>
    </div>
    <div class="timeline" dir="ltr">
      <span>1800</span>
      <input id="slider" type="range" min="0" max="${(VALID_TO_MS - VALID_FROM_MS) / DAY_MS}" step="any"
             aria-label="شريط الزمن">
      <span>2050</span>
    </div>
    <div class="row">
      <label>روح لتاريخ <input id="date" type="date" dir="ltr" min="1800-01-01" max="2050-12-31"></label>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="label">الوقت بالمحاكاة <span id="live" class="badge">مباشر</span></div>
      <div class="value" dir="ltr" id="time"></div>
      <div class="sub" dir="ltr" id="jd"></div>
    </div>
    <div class="card" id="check">
      <div class="label">فحص الدقة بهالتاريخ</div>
      <div class="value" id="checkValue"></div>
      <div class="sub">أكبر فرق: <span dir="ltr" id="worst"></span></div>
    </div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th>الكوكب</th>
          <th>البعد عن الشمس<br><span dir="ltr">(AU)</span></th>
          <th>الطول البروجي</th>
          <th>الفرق مع المرجع</th>
        </tr>
      </thead>
      <tbody>
        ${PLANETS.map((p) => `
          <tr>
            <td>${p.nameAr}</td>
            <td dir="ltr" id="d-${p.id}"></td>
            <td dir="ltr" id="l-${p.id}"></td>
            <td dir="ltr" id="e-${p.id}"></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const playBtn = $<HTMLButtonElement>('play');
const nowBtn = $<HTMLButtonElement>('now');
const speedSel = $<HTMLSelectElement>('speed');
const viewSel = $<HTMLSelectElement>('view');
const slider = $<HTMLInputElement>('slider');
const dateInput = $<HTMLInputElement>('date');

const orrery = new Orrery($<HTMLCanvasElement>('sky'));

// ---------- Clock ----------

const clock = {
  ms: Date.now(),
  live: true,      // follow real time
  playing: false,  // run the simulation at clock.speed
  speed: SPEEDS[1].days,
};
speedSel.value = '1';

function setPlaying(on: boolean) {
  clock.playing = on;
  if (on) clock.live = false;
  playBtn.textContent = on ? '⏸ إيقاف' : '▶ تشغيل';
}
setPlaying(false);

function jumpTo(ms: number) {
  clock.ms = clamp(ms);
  clock.live = false;
}

playBtn.addEventListener('click', () => setPlaying(!clock.playing));
nowBtn.addEventListener('click', () => { setPlaying(false); clock.live = true; });
speedSel.addEventListener('change', () => { clock.speed = SPEEDS[Number(speedSel.value)].days; });

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
  $('caption').textContent = VIEWS[mode].caption;
}
viewSel.addEventListener('change', () => setView(viewSel.value as ViewMode));
setView('compressed');

// ---------- Panels (updated a few times per second) ----------

function updatePanels(date: Date, bodies: BodyFrame[]) {
  const jd = toJulianDate(date);
  $('time').textContent = date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  $('jd').textContent = `JD ${jd.toFixed(5)}`;
  $('live').hidden = !clock.live;
  if (document.activeElement !== dateInput) dateInput.value = date.toISOString().slice(0, 10);

  let worst = 0;
  for (const b of bodies) {
    const ref = referencePosition(b.id, date);
    const err = Math.abs(wrap180(longitude(b.pos) - longitude(ref)));
    worst = Math.max(worst, err);
    $(`d-${b.id}`).textContent = distance(b.pos).toFixed(3);
    $(`l-${b.id}`).textContent = `${longitude(b.pos).toFixed(2)}°`;
    $(`e-${b.id}`).textContent = `${err.toFixed(3)}°`;
  }

  const ok = jdOk && worst < MAX_ERROR_DEG;
  $('check').className = `card ${ok ? 'ok' : 'bad'}`;
  $('checkValue').textContent = ok ? 'ناجح ✓' : 'فاشل ✗';
  $('worst').textContent = `${worst.toFixed(3)}°`;
}

// ---------- Animation loop ----------

let last = performance.now();
let lastPanels = -Infinity;

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
  const bodies: BodyFrame[] = PLANETS.map((p) => ({
    id: p.id,
    name: p.nameAr,
    pos: heliocentricPosition(p, T),
    orbit: orbitPath(p, T),
  }));

  orrery.draw(bodies);
  if (!dragging) slider.valueAsNumber = (clock.ms - VALID_FROM_MS) / DAY_MS;
  if (now - lastPanels > 250) {
    lastPanels = now;
    updatePanels(date, bodies);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
