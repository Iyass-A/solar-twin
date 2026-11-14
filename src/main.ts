import './style.css';
import { J2000, toJulianDate, centuriesSinceJ2000 } from './astro/julian';
import { PLANETS } from './astro/elements';
import { heliocentricPosition, longitude, distance, wrap180 } from './astro/kepler';
import { referencePosition } from './astro/reference';

const app = document.querySelector<HTMLDivElement>('#app')!;

// Self-check: 2000-01-01 12:00 UTC must give exactly 2451545.0
const jdCheck = toJulianDate(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
const jdOk = Math.abs(jdCheck - J2000) < 1e-9;

// Our simple formulas should stay within 1 degree of the reference.
const MAX_ERROR_DEG = 1;

function render() {
  const now = new Date();
  const jd = toJulianDate(now);
  const T = centuriesSinceJ2000(jd);

  let worst = 0;
  const rows = PLANETS.map((p) => {
    const ours = heliocentricPosition(p, T);
    const ref = referencePosition(p.id, now);
    const err = Math.abs(wrap180(longitude(ours) - longitude(ref)));
    worst = Math.max(worst, err);
    return `
      <tr>
        <td>${p.nameAr}</td>
        <td dir="ltr">${distance(ours).toFixed(3)}</td>
        <td dir="ltr">${longitude(ours).toFixed(2)}°</td>
        <td dir="ltr">${err.toFixed(3)}°</td>
      </tr>`;
  }).join('');

  const posOk = worst < MAX_ERROR_DEG;

  app.innerHTML = `
    <h1>التوأم الرقمي للمجموعة الشمسية</h1>
    <p class="step">الخطوة 2: مواقع الكواكب هلأ</p>

    <div class="card">
      <div class="label">الوقت الحالي</div>
      <div class="value" dir="ltr">${now.toISOString().replace('T', ' ').slice(0, 19)} UTC</div>
      <div class="sub" dir="ltr">JD ${jd.toFixed(5)}</div>
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
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="card ${jdOk && posOk ? 'ok' : 'bad'}">
      <div class="label">فحص الدقة</div>
      <div class="value">${jdOk && posOk ? 'ناجح ✓' : 'فاشل ✗'}</div>
      <div class="sub">أكبر فرق: <span dir="ltr">${worst.toFixed(3)}°</span></div>
    </div>
  `;
}

render();
setInterval(render, 1000);
