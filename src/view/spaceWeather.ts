// The "Space weather" card: NOAA's storm levels now and for the next days, the Kp index (chart),
// the week's solar flares, and NASA's predicted CME arrivals. Data from data/live/space-weather.json
// on our own site, fetched before each deploy (see scripts/fetch-space-weather.ts).
// Our texts (src/i18n.ts) contain no markup; values from the file are numbers, dates and classes
// that the checks in src/live/spaceWeather.ts have already restricted, and they are escaped anyway.

import { fileProblems, flareFlux, gFromKp, type KpPoint, type Level, type PartName, type SpaceWeatherFile } from '../live/spaceWeather';
import { dateTime, dayMonthTime, lang, num, t, weekdayDay } from '../i18n';
import { KP_COLORS, KpChart } from './kpChart';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const STALE_MS = 12 * HOUR_MS;   // fetched every 3 hours: older than this means several runs failed
const KP_DAYS_BACK = 3;
const CME_SHOW_PAST_MS = 24 * HOUR_MS; // an arrival stays listed for a day after its time

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ltr = (s: string) => `<span dir="ltr">${esc(s)}</span>`;
const STATUS = ['', '#fab219', '#fab219', '#d03b3b', '#d03b3b', '#d03b3b']; // levels 1-2 warning, 3+ critical

export class SpaceWeatherCard {
  private file: SpaceWeatherFile | null = null;
  private state: 'loading' | 'none' | 'ok' = 'loading';
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  // One chart box for the card's whole life: put back into place after each render
  private readonly chartBox: HTMLElement;
  private readonly chart: KpChart;

  constructor(root: HTMLElement) {
    this.root = root;
    this.body = root.querySelector<HTMLElement>('.sw-body')!;
    this.chartBox = document.createElement('div');
    this.chartBox.className = 'kp-chart';
    this.chart = new KpChart(this.chartBox);
    setInterval(() => this.render(), 5 * 60_000); // the "now" line moves on
  }

  async load(url: string) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const f = await r.json();
      const problems = fileProblems(f);
      if (problems.length) throw new Error(problems.slice(0, 3).join('; '));
      this.file = f;
      this.state = 'ok';
    } catch (err) {
      console.info('No space weather data:', err);
      this.state = 'none';
    }
    this.render();
  }

  render() {
    const s = t();
    this.root.querySelector('.sw-intro')!.textContent = s.swIntro;
    const f = this.file;
    if (this.state !== 'ok' || !f) {
      this.body.innerHTML = `<p class="sub">${this.state === 'loading' ? s.caLoading : s.swNone}</p>`;
      return;
    }
    const now = Date.now();
    const level = (code: 'R' | 'S' | 'G', x: Level) => (x ? `${code}${x} · ${s.swLevels[x]}` : s.swLevels[0]);
    const dot = (x: Level) => (x ? `<i class="sw-dot" style="background:${STATUS[x]}"></i>` : '');
    let html = '';

    // 1. Storm levels now, the last 24 hours, and the next days (NOAA scales)
    const sc = f.scales?.data;
    if (sc) {
      const active = (['g', 'r', 's'] as const).filter((k) => sc.now[k] > 0).map((k) => s.swActiveItem(k, sc.now[k]));
      html += `<p class="sw-headline">${active.length ? s.swNowActive(active.join(lang() === 'ar' ? ' و' : ', ')) : s.swCalm}</p>`;
      html += '<div class="sw-tiles">';
      for (const k of ['g', 'r', 's'] as const) {
        const code = k.toUpperCase() as 'R' | 'S' | 'G';
        html += `<div class="sw-tile">
          <div class="label">${s.swScale[k]}</div>
          <div class="sw-level">${dot(sc.now[k])}${esc(level(code, sc.now[k]))}</div>
          ${sc.past24h ? `<div class="sw-small">${s.swPast24(esc(level(code, sc.past24h[k])))}</div>` : ''}
          <div class="sw-small sw-what">${s.swScaleWhat[k]}</div>
        </div>`;
      }
      html += '</div>';
      if (sc.days.length) {
        const day = (d: string) => esc(weekdayDay(Date.parse(`${d}T12:00:00Z`), lang(), 'UTC'));
        const pct = (x: number | null) => (x === null ? '—' : ltr(`${num(x, 0)}%`));
        html += `<div class="sw-forecast"><table>
          <thead><tr><th>${s.swForecast}</th>${sc.days.map((d) => `<th class="num">${day(d.date)}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><td>${s.swFcG}</td>${sc.days.map((d) => `<td class="num">${d.g === null ? '—' : `${dot(d.g)}${esc(level('G', d.g))}`}</td>`).join('')}</tr>
            <tr><td>${s.swFcRMinor}</td>${sc.days.map((d) => `<td class="num">${pct(d.rMinor)}</td>`).join('')}</tr>
            <tr><td>${s.swFcRMajor}</td>${sc.days.map((d) => `<td class="num">${pct(d.rMajor)}</td>`).join('')}</tr>
            <tr><td>${s.swFcS}</td>${sc.days.map((d) => `<td class="num">${pct(d.s)}</td>`).join('')}</tr>
          </tbody></table></div>`;
      }
    }

    // 2. Kp: the last 3 days and the forecast
    const kpAll = f.kp?.data ?? [];
    const kp = kpAll.filter((p) => Date.parse(p.t) + 3 * HOUR_MS > now - KP_DAYS_BACK * DAY_MS);
    if (kp.length) {
      const past = kp.filter((p) => Date.parse(p.t) + 3 * HOUR_MS <= now);
      const latest = past[past.length - 1];
      const ahead = kp.filter((p) => Date.parse(p.t) >= now);
      const top = ahead.reduce<KpPoint | null>((a, p) => (!a || p.kp > a.kp ? p : a), null);
      const meaning = (v: number) => (gFromKp(v) ? `G${gFromKp(v)} · ${s.swLevels[gFromKp(v)]}` : s.swLevels[0]);
      const key = (c: keyof typeof KP_COLORS, text: string) => `<span class="key"><i style="background:${KP_COLORS[c]}"></i>${text}</span>`;
      html += `<h3 class="sw-h">${s.swKpTitle}</h3>
        <p class="sw-small">${s.swKpWhat}</p>
        <p class="sw-kp-facts">${latest ? s.swKpLatest(ltr(num(latest.kp, 2)), esc(meaning(latest.kp))) : ''}
          ${top ? ` · ${s.swKpMaxAhead(`${ltr(num(top.kp, 2))} (${esc(meaning(top.kp))})`, esc(dateTime(Date.parse(top.t))))}` : ''}</p>
        <div class="kp-chart-slot"></div>
        <p class="legend sw-legend">${key('quiet', s.swKpQuiet)}${key('storm', s.swKpStorm)}${key('strong', s.swKpStrong)}</p>
        <details class="sw-table"><summary>${s.swKpTable}</summary><table>
          <thead><tr><th>${s.swTime}</th><th class="num">Kp</th><th></th></tr></thead>
          <tbody>${kp.map((p) => `<tr><td>${esc(dateTime(Date.parse(p.t)))}</td><td class="num">${ltr(num(p.kp, 2))}</td>
            <td>${Date.parse(p.t) >= now ? s.swKpKind.predicted : s.swKpKind[p.kind === 'observed' ? 'observed' : 'estimated']}</td></tr>`).join('')}</tbody>
        </table></details>`;
    }

    // 3. Flares of the last 7 days
    const fl = f.flares?.data;
    if (fl) {
      const cnt = (c: string) => fl.filter((x) => x.cls.startsWith(c)).length;
      const top = [...fl].sort((a, b) => flareFlux(b.cls) - flareFlux(a.cls)).slice(0, 3);
      html += `<h3 class="sw-h">${s.swFlaresTitle}</h3>
        <p>${s.swFlareCount(fl.length, cnt('M'), cnt('X'))}
          ${top.length ? `${s.swFlareStrongest} ${top.map((x) => `<span class="nowrap">${ltr(x.cls)} · ${esc(dateTime(Date.parse(x.peak)))}</span>`).join(lang() === 'ar' ? '، ' : ', ')}` : ''}</p>
        <p class="sw-small">${s.swFlareWhat}</p>`;
    }

    // 4. CMEs: predicted arrivals at Earth (NASA, experimental)
    if (f.cmes) {
      const list = f.cmes.data.filter((c) => Date.parse(c.arrival) > now - CME_SHOW_PAST_MS);
      html += `<h3 class="sw-h">${s.swCmeTitle}</h3>`;
      html += list.length ? `<ul class="sw-cmes">${list.map((c) => {
        const at = esc(dateTime(Date.parse(c.arrival)));
        const bits = [Date.parse(c.arrival) > now ? s.swCmeArrival(at) : s.swCmeArrived(at)];
        if (c.glancing) bits.push(s.swCmeGlancing);
        else if (c.minor) bits.push(s.swCmeMinor);
        if (c.kp) bits.push(s.swCmeKp(ltr(num(c.kp[0], 0)), ltr(num(c.kp[1], 0))));
        if (c.speed) bits.push(s.swCmeSpeed(ltr(num(c.speed, 0))));
        return `<li>${bits.join(s.comma)}${c.link ? ` · <a href="${esc(c.link)}" target="_blank" rel="noopener">DONKI</a>` : ''}</li>`;
      }).join('')}</ul>` : `<p>${s.swCmeNone}</p>`;
      html += `<p class="sw-small">${s.swCmeNote}</p>`;
    }

    // Footer: what is missing or old, when it was fetched, the sources
    const notes: string[] = [];
    for (const n of ['scales', 'kp', 'flares', 'cmes'] as PartName[]) {
      const part = f[n];
      if (!part) notes.push(`<p class="ca-stale">${s.swMissing(s.swParts[n])}</p>`);
      else if (now - Date.parse(part.fetchedAt) > STALE_MS) notes.push(`<p class="ca-stale">${s.swStale(s.swParts[n], esc(dayMonthTime(Date.parse(part.fetchedAt))))}</p>`);
    }
    html += notes.join('');
    html += `<p class="sub ca-note">${s.caUpdated(esc(dayMonthTime(Date.parse(f.fetchedAt))))} ·
      <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener">NOAA SWPC</a> ·
      <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a></p>`;

    this.body.innerHTML = html;
    const slot = this.body.querySelector('.kp-chart-slot');
    if (slot) {
      slot.replaceWith(this.chartBox);
      this.chart.set(kp, now);
    }
  }
}
