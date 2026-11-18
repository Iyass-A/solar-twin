// All texts of the page in three languages: Arabic (Levantine), German and English.
// No DOM access when this file loads, so `npm run check` can test it in Node.

import type { PlanetId } from './astro/elements';
import type { ViewMode } from './view/views';
import type { SmallGroup } from './view/smallbodies';
import type { Where } from './data/spacecraft';
import type { ScenarioId } from './physics/scenarios';
import type { MoonPhase, Season } from './events/events';

export type Lang = 'ar' | 'de' | 'en';

export interface LangInfo {
  id: Lang;
  name: string;          // the language's name in itself, for the switch
  dir: 'rtl' | 'ltr';
  numberLocale: string;  // how numbers are written
  dateLocale: string;    // how dates and times are written (with Western digits)
}

export const LANGS: LangInfo[] = [
  // Western digits, as before; Syrian month names (تشرين الثاني)
  { id: 'ar', name: 'عربي', dir: 'rtl', numberLocale: 'en-US', dateLocale: 'ar-SY-u-nu-latn' },
  { id: 'de', name: 'Deutsch', dir: 'ltr', numberLocale: 'de-DE', dateLocale: 'de-DE' }, // decimal comma
  { id: 'en', name: 'English', dir: 'ltr', numberLocale: 'en-US', dateLocale: 'en-GB' },
];

export interface Strings {
  title: string;
  tagline: string;
  beta: string;
  feedback: string;
  language: string;
  tab3d: string;
  tab2d: string;
  loading: string;
  no3d: string;
  mapAria: string;
  sceneAria: string;
  views: Record<ViewMode, { label: string; caption: string }>;
  howto3d: string;
  howto2d: string;
  infoHint: string;
  fromSun: string;
  fromEarth: string;
  lightTime: string;
  weAreHere: string;
  play: string;
  pause: string;
  now: string;
  speed: string;
  view: string;
  goToDate: string;
  timeBar: string;
  speeds: [string, string, string, string]; // day, week, month, year per second
  simTime: string;
  live: string;
  check: string;
  passed: string;
  failed: string;
  worst: string;
  colPlanet: string;
  colDistanceHtml: string;
  colLongitude: string;
  colError: string;
  au: string;
  millionKm: string;
  equinox: string;
  resetView: string;
  follow: (name: string) => string;
  stopFollow: string;
  stars: string;
  sources: string;
  sourceCode: string;
  licences: string;
  planets: Record<PlanetId, string>;
  smallBodies: string;
  groups: Record<SmallGroup, string>;
  /** The same in the plural, for the legend with counts */
  groupsMany: Record<SmallGroup, string>;
  famousBodies: string;
  selectionNote: string;
  find: string;
  findPlaceholder: string;
  notFound: string;
  /** JPL orbit classes, by code */
  classes: Record<string, string>;
  type: string;
  diameter: string;
  km: string;
  smallNote: string;
  outsideWindow: (from: string, to: string) => string;
  uncertainty: string;
  metres: string;
  cloudNote: string;
  noCloud: string;
  cloudMismatch: string;
  cloudZoom: (factor: string) => string;
  trueSize: string;
  /** Light travel time, given in minutes. */
  light: (minutes: number) => string;
  // Close approaches to Earth (live data from CNEOS)
  caTitle: string;
  caBadge: string;
  caIntro: (millionKm: string, lunarDistances: string) => string;
  /** Count of approaches until a date, and how many of them come closer than the Moon. */
  caAhead: (count: number, closerThanMoon: number, until: string) => string;
  caPast: (count: number, closerThanMoon: number) => string;
  caClosest: (name: string, distance: string) => string;
  caColObject: string;
  caColWhen: string;
  caColDistance: string;
  caColSpeed: string;
  /** A distance in lunar distances (the number comes formatted). */
  lunar: (x: string) => string;
  caCloserThanMoon: string;
  caUncertain: (from: string, to: string) => string;
  caEstimate: string;
  kmPerS: string;
  caShowPast: (count: number) => string;
  caHidePast: string;
  caShowAll: (count: number) => string;
  caShowFewer: string;
  caNote: string;
  caOnMap: string;
  caUpdated: (date: string) => string;
  caStale: (date: string) => string;
  caNone: string;
  caLoading: string;
  /** Between two parts of a sentence: "، " in Arabic. */
  comma: string;
  /** "in 5 hours" for hours > 0, "5 hours ago" for hours < 0. */
  relTime: (hours: number) => string;
  /** A length of time, rounded to minutes, hours or days. */
  duration: (minutes: number) => string;
  // Space weather (live data from NOAA SWPC and NASA DONKI)
  swTitle: string;
  swIntro: string;
  /** NOAA scales: R radio blackouts, S solar radiation, G geomagnetic, as a tile title */
  swScale: { r: string; s: string; g: string };
  /** One active scale inside a sentence: "a strong geomagnetic storm (G3)" */
  swActiveItem: (scale: 'r' | 's' | 'g', level: number) => string;
  swScaleWhat: { r: string; s: string; g: string };
  /** Levels 0 to 5: quiet, minor, moderate, strong, severe, extreme */
  swLevels: [string, string, string, string, string, string];
  swCalm: string;
  swNowActive: (items: string) => string;
  swPast24: (x: string) => string;
  swForecast: string;
  swFcG: string;
  swFcRMinor: string;
  swFcRMajor: string;
  swFcS: string;
  swKpTitle: string;
  swKpWhat: string;
  swKpQuiet: string;
  swKpStorm: string;
  swKpStrong: string;
  swKpKind: { observed: string; estimated: string; predicted: string };
  swKpLatest: (value: string, level: string) => string;
  swKpMaxAhead: (value: string, when: string) => string;
  swKpTable: string;
  swTime: string;
  swFlaresTitle: string;
  swFlareCount: (total: number, m: number, x: number) => string;
  swFlareStrongest: string;
  swFlareWhat: string;
  swCmeTitle: string;
  swCmeNone: string;
  swCmeArrival: (when: string) => string;
  swCmeArrived: (when: string) => string;
  swCmeGlancing: string;
  swCmeMinor: string;
  swCmeKp: (from: string, to: string) => string;
  swCmeSpeed: (v: string) => string;
  swCmeNote: string;
  swParts: { scales: string; kp: string; flares: string; cmes: string };
  swMissing: (part: string) => string;
  swStale: (part: string, date: string) => string;
  swNone: string;
  // Deep Space Network now (live data from NASA's DSN Now, through our server on Cloudflare)
  dsnTitle: string;
  dsnIntro: string;
  /** The three sites, with their country */
  dsnStations: { gdscc: string; mdscc: string; cdscc: string };
  dsnLocalTime: (clock: string) => string;
  /** Spacecraft in contact now, and through how many antennas */
  dsnSummary: (craft: number, antennas: number) => string;
  dsnFarthest: (name: string, distance: string, light: string) => string;
  /** One-way light time, from seconds */
  dsnLight: (seconds: number) => string;
  dsnSignalTime: (light: string) => string;
  dsnSize: (metres: string) => string;
  /** Elevation, the number comes with its ° */
  dsnElevation: (degrees: string) => string;
  /** What an antenna is doing, by kind (NASA's words are used for kinds not listed) */
  dsnActivity: { link: string; maint: string; vlbi: string; radar: string; astro: string; calib: string; test: string };
  dsnDown: string;
  dsnUp: string;
  /** Under the names of spacecraft an antenna points at without a signal (n of them) */
  dsnNoSignal: (n: number) => string;
  dsnMspa: string;
  /** bit/s, kbit/s, Mbit/s */
  dsnRate: [string, string, string];
  billionKm: string;
  dsnWhere: Record<Where, string>;
  dsnNote: string;
  dsnUpdated: (clock: string, ago: string) => string;
  /** How long ago, from seconds (under a minute, minutes, hours) */
  dsnAgo: (seconds: number) => string;
  dsnOld: (ago: string) => string;
  dsnOff: string;
  /** On a page that is not our published site (the server only answers that one) */
  dsnLocal: string;
  dsnNone: string;
  // The "Now in space" screen: one tile per live source, each opening its card
  nowTitle: string;
  nowIntro: string;
  nowTabs: { dsn: string; weather: string; approaches: string; events: string };
  /** "Updated 2 hours ago": the time comes from relTime or dsnAgo */
  nowUpdated: (ago: string) => string;
  nowNoData: string;
  nowDsn: (craft: number) => string;
  nowFarthest: (name: string) => string;
  nowWeatherCalm: string;
  /** The highest storm level NOAA expects in the next days, and the day */
  nowWeatherAhead: (level: string, day: string) => string;
  nowWeatherAheadCalm: string;
  nowCme: (when: string) => string;
  nowApproaches: (count: number, until: string) => string;
  // Sky events (phase 8): what happens in the sky in the next 7 or 30 days. Texts with "HTML" get formatted
  // numbers (in spans) and names; the rest is plain text.
  events: {
    title: string;
    badge: string;
    intro: string;
    daysLabel: string;
    days7: string;
    days30: string;
    summary: (count: number, days: 7 | 30) => string;
    tileMain: (count: number) => string;
    next: (what: string, when: string) => string;
    jump: string;
    jumpTitle: string;
    jumpPick: (planet: string) => string;
    /** A time given only roughly (perihelion, aphelion) */
    about: (time: string) => string;
    /** Ends where the link to Astronomy Engine follows */
    note: (timeZone: string) => string;
    moonName: string;
    moon: Record<MoonPhase, string>;
    moonNotes: Record<MoonPhase, string>;
    conjunction: { superior: (p: string) => string; inferior: (p: string) => string; plain: (p: string) => string };
    conjunctionNotes: { superior: string; inferior: string; plain: string };
    opposition: (p: string) => string;
    oppositionNote: string;
    brightDistance: (mag: string, distance: string) => string;
    optics: string;
    elongation: (p: string, sky: 'evening' | 'morning') => string;
    elongationNote: (deg: string, sky: 'evening' | 'morning') => string;
    brightness: (mag: string) => string;
    solar: { total: string; annular: string; partial: string };
    solarWhere: (where: string) => string;
    solarPartial: string;
    solarSafety: string;
    lunar: { total: string; partial: string; penumbral: string };
    lunarNotes: { total: (d: string) => string; partial: (d: string) => string; penumbral: (d: string) => string };
    seasons: Record<Season, string>;
    seasonNotes: Record<Season, string>;
    perihelion: string;
    aphelion: string;
    perihelionNote: (distance: string) => string;
    aphelionNote: (distance: string) => string;
    pair: (a: string, b: string) => string;
    pairNote: (deg: string) => string;
    glare: string;
    neo: (name: string) => string;
    neoNote: (distance: string) => string;
    neoCloser: string;
    neoClosest: string;
    north: string;
    south: string;
    east: string;
    west: string;
  };
  // The weekly video (phase 8): its own texts, on top of the sky events'
  video: {
    weekTitle: string;
    /** For a stretch that is not a week */
    daysTitle: string;
    weekCount: (count: number) => string;
    /** "Event 2 of 6" */
    eventNo: (i: number, n: number) => string;
    outroLine: string;
    sources: string;
    /** A time and its time zone */
    when: (time: string, zone: string) => string;
    /** How fast the clock runs: one second of video is this long (from duration()) */
    speed: (d: string) => string;
    sunName: string;
    ecliptic: string;
    earthShadow: string;
    fromPlace: (where: string) => string;
    fromCentre: string;
    lunarDistance: string;
    scaleNote: string;
  };
  // "Branch reality" (phase 5): a copy of the solar system, changed, run by the physics engine
  branch: {
    title: string;
    badge: string;
    intro: string;
    action: string;
    actions: { remove: string; mass: string; push: string; star: string };
    body: string;
    sun: string;
    factor: string;
    speed: string;
    pushHint: string;
    starMass: string;
    starDistance: string;
    starNote: string;
    go: string;
    reset: string;
    /** What the branch is, e.g. "without Jupiter" (numbers come formatted) */
    what: { remove: (name: string) => string; mass: (name: string, factor: string) => string;
      push: (name: string, kmS: string, faster: boolean) => string; star: (mass: string, distance: string) => string };
    from: (date: string) => string;
    computing: (year: string) => string;
    before: (date: string) => string;
    legend: string;
    error: (message: string) => string;
    tooFar: string;
    starLate: (year: number) => string;
    jump: string;
    compare: { title: string; note: string; body: string; year: string; distance: string; offset: string; removed: string;
      escapes: string; star: string; real: (value: string) => string; days: (n: string) => string; years: (n: string) => string };
    /** Ready-made scenarios (src/physics/scenarios.ts); each result gets its facts as formatted numbers, by key. */
    scenarios: {
      title: string; own: string; preparing: string;
      buttons: { jupiter: string; sun: string; star: string };
      nearer: string; farther: string;
      list: Record<ScenarioId, { how: string; result: (f: Record<string, string>) => string }>;
    };
  };
  // Trip planner (phase 6): a trip from the Earth to another planet (src/transfer/, src/view/trip.ts)
  trip: {
    title: string;
    badge: string;
    intro: string;
    to: string;
    duration: string;
    leave: string;
    arrive: string;
    total: string;
    /** The trip's length in days, with about how many months under it; or in years, with the days (numbers come formatted) */
    tripDays: (days: string) => string;
    aboutMonths: (months: string) => string;
    tripYears: (years: string) => string;
    kmS: (v: string) => string;
    /** Launch energy, e.g. "C3 = 8.67 km²/s²" */
    c3: (v: string) => string;
    leaveNote: (km: string, c3: string) => string;
    arriveNote: (km: string, name: string, vInf: string) => string;
    whenTitle: string;
    /** Where the target must be at launch, and where it is at the time on screen (angles come formatted, with ° and without sign) */
    phase: (target: PlanetId, need: string, ahead: boolean, now: string, nowAhead: boolean) => string;
    window: (depart: string, rel: string, arrive: string) => string;
    prev: (date: string, rel: string) => string;
    every: (days: string, months: number) => string;
    /** "in 17 days", "23 days ago", "today"; in months from 60 days on */
    rel: (days: number) => string;
    jump: string;
    outside: string;
    note: string;
    giants: string;
    // Step 2: Lambert's problem, for two dates the visitor picks
    exactTitle: string;
    exactIntro: string;
    departDate: string;
    arriveDate: string;
    /** How far round the Sun the path goes (angle comes formatted, with °), and its type */
    /** After `revs` whole turns (0: none), the angle comes formatted, with ° */
    /** by: whether the whole turns were taken because they need less at launch (c3), or less for both burns together (dv) */
    way: (deg: string, type: 1 | 2, revs: number, by: 'c3' | 'dv') => string;
    badDates: string;
    noTrip: string;
    // Step 3: the porkchop map of launch dates
    mapTitle: string;
    mapIntro: string;
    /** For an asteroid or comet: instead of the dashed line, the whole turns */
    mapIntroSmall: string;
    colorBy: string;
    measures: { c3: string; dv: string };
    units: { c3: string; dv: string };
    axisDepart: string;
    axisDays: string;
    axisYears: string;
    computing: string;
    cheaper: string;
    dearer: string;
    marks: string;
    /** The cheapest trip of a type: dates, time on the way and the value come formatted */
    best: (type: 1 | 2, depart: string, arrive: string, duration: string, value: string) => string;
    pick: string;
    typeName: (type: 1 | 2) => string;
    /** Whole turns round the Sun before the last part of the path, in the map's tooltip (1 or more) */
    turns: (n: number) => string;
    nearHalf: string;
    /** After a cheapest trip that lies on the map's edge */
    edge: string;
    // Step 4: the trip in the views
    playTrip: string;
    showPath: string;
    craft: string;
    playNote: string;
    mapAria: string;
    // Step 5: the signal delay on the way
    sigTitle: string;
    sigIntro: string;
    /** A delay under a minute, in whole seconds */
    seconds: (n: number) => string;
    /** At arrival: one way, and a question and its answer (delays come formatted) */
    sigArrive: (oneWay: string, both: string) => string;
    /** The longest delay when it is not at arrival: the delay, its date and the day of the trip (formatted) */
    sigMax: (delay: string, date: string, day: string) => string;
    sigMaxAtEnd: string;
    /** At the time on screen, while it is within the trip (day and delay formatted) */
    sigNow: (day: string, delay: string) => string;
    /** How many times the craft comes within 2° of the Sun in the Earth's sky, and when (the stretches come formatted and joined) */
    sigConj: (n: number, list: string) => string;
    /** The same for many: how many, about how many months apart, the first and the last (formatted) */
    sigConjMany: (n: number, months: number, first: string, last: string) => string;
    sigNoConj: string;
    /** Between two such stretches */
    sigJoin: string;
    sigAxisDays: string;
    sigAxisYears: string;
    sigUnitMin: string;
    sigUnitHours: string;
    /** On the chart's bands and in its tooltip: the craft is near the Sun in the Earth's sky */
    sigSun: string;
    /** "day 120 of the trip" (the number comes formatted) */
    sigDay: (day: string) => string;
    sigTable: string;
    sigCols: { date: string; day: string; distance: string; delay: string; sun: string };
    sigAria: string;
    /** The craft's name with its delay, next to it in the views (delay comes formatted) */
    craftDelay: (name: string, delay: string) => string;
    // Step 7: asteroids and comets as targets
    targetGroups: { planets: string; main: string; neo: string; trojan: string; far: string; comet: string };
    /** No Hohmann estimate for an asteroid or comet: the map's launch days (years) and times on the way (days) come formatted */
    sbNoHohmann: (years: string, minDays: string, maxDays: string) => string;
    /** The years the site knows where the body is (formatted) */
    sbKnown: (name: string, from: string, to: string) => string;
    /** The body goes round the Sun the other way */
    sbRetro: (name: string) => string;
    /** Beyond Neptune: real missions take a push from Jupiter */
    sbFar: string;
    /** From the day on screen no trip can arrive in its years */
    sbNoRange: string;
    /** The button that goes to the first of its years */
    sbJump: (year: string) => string;
    /** The map has no trip at all */
    sbNoTrips: (name: string) => string;
    /** An arrival day on which the site does not know where the body is; the first and last day come formatted */
    sbOutsideDates: (name: string, from: string, to: string) => string;
    /** The arrival box for an asteroid or comet */
    arriveSmall: (name: string) => string;
    /** Under the map when it is coloured by C3 */
    sbFlyby: string;
    /** The map's markers without the Hohmann estimate, and its empty part */
    marksSmall: string;
  };
}

/** Keys whose value is plain text, for data-t / data-html / data-aria in the page. */
export type TextKey = { [K in keyof Strings]: Strings[K] extends string ? K : never }[keyof Strings];

// ---------- Numbers ----------

const formats = new Map<string, Intl.NumberFormat>();

/** A number with a fixed count of decimals, written the way the language does (no thousands separators). */
export function num(n: number, digits: number, l: Lang = current): string {
  const locale = LANGS.find((x) => x.id === l)!.numberLocale;
  const key = `${locale}/${digits}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
    formats.set(key, f);
  }
  return f.format(n);
}

/** A whole number with the language's thousands separators (20,000 / 20.000). */
export function numGrouped(n: number, l: Lang = current): string {
  return new Intl.NumberFormat(LANGS.find((x) => x.id === l)!.numberLocale, { maximumFractionDigits: 0 }).format(n);
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
type DateKind = 'dateTime' | 'dayMonth' | 'dayMonthYear' | 'dayMonthTime' | 'weekdayDay' | 'clock';
const DATE_KINDS: Record<DateKind, Intl.DateTimeFormatOptions> = {
  dateTime: { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  dayMonth: { day: 'numeric', month: 'long' },
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  dayMonthTime: { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  weekdayDay: { weekday: 'short', day: 'numeric' },
  clock: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
};
function dateFormat(l: Lang, kind: DateKind, timeZone?: string): Intl.DateTimeFormat {
  const key = `${l}/${kind}/${timeZone ?? ''}`;
  let f = dateFormats.get(key);
  if (!f) {
    const locale = LANGS.find((x) => x.id === l)!.dateLocale;
    f = new Intl.DateTimeFormat(locale, { ...DATE_KINDS[kind], timeZone });
    dateFormats.set(key, f);
  }
  return f;
}

/** Weekday, date and time in the visitor's time zone, e.g. "Fr., 20. Nov., 14:32". */
export const dateTime = (ms: number, l: Lang = current, timeZone?: string) => dateFormat(l, 'dateTime', timeZone).format(ms);
/** Day and month, e.g. "20 تشرين الثاني", "20. November". */
export const dayMonth = (ms: number, l: Lang = current, timeZone?: string) => dateFormat(l, 'dayMonth', timeZone).format(ms);
/** Day, month and year, e.g. "4 كانون الأول 2026", "4. Dezember 2026". */
export const dayMonthYear = (ms: number, l: Lang = current, timeZone?: string) => dateFormat(l, 'dayMonthYear', timeZone).format(ms);
/** Two days as one stretch, e.g. "23–28 تشرين الأول 2028", "27. Juni – 1. Juli 2045". */
export const dayMonthYearRange = (from: number, to: number, l: Lang = current, timeZone?: string) =>
  dateFormat(l, 'dayMonthYear', timeZone).formatRange(from, to);
/** Time of day, e.g. "14:32". */
export const clock = (ms: number, l: Lang = current, timeZone?: string) => dateFormat(l, 'clock', timeZone).format(ms);
/** Short weekday and day, e.g. "So. 15", "Sun 15". */
export const weekdayDay = (ms: number, l: Lang = current, timeZone?: string) => dateFormat(l, 'weekdayDay', timeZone).format(ms);
/** Day, month and time, e.g. "20 تشرين الثاني في 14:32", "20. November um 14:32". */
export const dayMonthTime = (ms: number, l: Lang = current, timeZone?: string) => dateFormat(l, 'dayMonthTime', timeZone).format(ms);

/** Hours and whole minutes, or null below one hour (then shown as minutes with one decimal). */
function hoursMinutes(minutes: number): { h: number; m: number } | null {
  if (minutes < 59.95) return null;
  const total = Math.round(minutes);
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Arabic counting: 1 ساعة, 2 ساعتين, 3-10 ساعات, 11+ ساعة. */
export function arabicCount(n: number, one: string, two: string, few: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : one}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Rounds a length of time to the unit we say it in: minutes below an hour, hours below 1.5 days. */
export function timeUnit(minutes: number): { n: number; unit: 'min' | 'h' | 'd' } {
  const m = Math.abs(minutes);
  if (m < 59.5) return { n: Math.max(1, Math.round(m)), unit: 'min' };
  if (m < 36 * 60) return { n: Math.round(m / 60), unit: 'h' };
  return { n: Math.round(m / 1440), unit: 'd' };
}

// Arabic counts for the close approaches: "مرور واحد", "مرورين", "5 مرورات", "33 مرور"
// "حدث واحد", "حدثين", "5 أحداث", "11 حدث"
const eventsAr = (n: number) => (n === 0 ? 'ولا حدث كبير' : n === 1 ? 'حدث واحد' : arabicCount(n, 'حدث', 'حدثين', 'أحداث'));
const flybysAr = (n: number) => (n === 0 ? 'ولا مرور' : n === 1 ? 'مرور واحد' : arabicCount(n, 'مرور', 'مرورين', 'مرورات'));
const moonAr = (m: number) => `${m === 0 ? 'ولا واحد' : m === 1 ? 'واحد' : m === 2 ? 'تنين' : m} منهم أقرب من القمر`;

function arDuration(minutes: number): string {
  const { n, unit } = timeUnit(minutes);
  if (unit === 'min') return arabicCount(n, 'دقيقة', 'دقيقتين', 'دقائق');
  if (unit === 'h') return arabicCount(n, 'ساعة', 'ساعتين', 'ساعات');
  return arabicCount(n, 'يوم', 'يومين', 'أيام');
}

/** German: "3 Tage" (nominative), or "3 Tagen" after "in" and "vor" (dative). */
function deDuration(minutes: number, dative: boolean): string {
  const { n, unit } = timeUnit(minutes);
  if (unit === 'min') return plural(n, 'Minute', 'Minuten');
  if (unit === 'h') return plural(n, 'Stunde', 'Stunden');
  return plural(n, 'Tag', dative ? 'Tagen' : 'Tage');
}

function enDuration(minutes: number): string {
  const { n, unit } = timeUnit(minutes);
  if (unit === 'min') return plural(n, 'minute', 'minutes');
  if (unit === 'h') return plural(n, 'hour', 'hours');
  return plural(n, 'day', 'days');
}

// ---------- Texts ----------

const AR: Strings = {
  title: 'التوأم الرقمي للمجموعة الشمسية',
  tagline: 'المواقع الحقيقية للكواكب وأكتر من 2,000 كويكب ومذنب، شو عم يصير بالفضاء هلأ، شو كان صار لو تغيّر شي، وكيف منسافر لهونيك',
  beta: 'تجريبية',
  feedback: 'عندك ملاحظة؟',
  language: 'اللغة',
  tab3d: 'ثلاثي الأبعاد',
  tab2d: 'خريطة من فوق',
  loading: 'عم يحمّل المشهد…',
  no3d: 'المتصفح هون ما بيدعم العرض ثلاثي الأبعاد',
  mapAria: 'خريطة الكواكب حول الشمس',
  sceneAria: 'مشهد ثلاثي الأبعاد للكواكب حول الشمس',
  views: {
    compressed: {
      label: 'كل الكواكب، مسافات مضغوطة',
      caption: 'المسافات مضغوطة لحتى يبينوا كل الكواكب، بس الاتجاهات صحيحة.',
    },
    true: {
      label: 'كل الكواكب، مسافات حقيقية',
      caption: 'المسافات حقيقية. الكواكب الداخلية بتبين قريبة كتير من الشمس.',
    },
    inner: {
      label: 'الكواكب الداخلية، مسافات حقيقية',
      caption: 'المسافات حقيقية، لحد مدار المريخ.',
    },
  },
  howto3d: 'اسحب لتلفّ المشهد، ودولاب الماوس أو إصبعين بيكبّروا، ودبل كليك أو ↺ بيرجّع. '
    + 'اختار كوكب واكبس «لاحق» لتلحقه الكاميرا حتى والزمن ماشي. '
    + 'الخطوط النازلة من الكواكب بتورجي قديش الكوكب فوق أو تحت مستوى مدار الأرض. '
    + 'الدواير هي البعد بالوحدة الفلكية. أحجام الكواكب مو حقيقية. '
    + 'النجوم بالخلفية حقيقية، كل اللي بينشاف بالعين بليلة صافية، وزر ✦ بيخفيها.',
  howto2d: 'منظر من فوق، والكواكب بتدور عكس عقارب الساعة. أحجام الكواكب مو حقيقية. '
    + 'الأرقام على الدواير هي البعد بالوحدة الفلكية. دولاب الماوس بيكبّر، ودبل كليك بيرجّع.',
  infoHint: 'اكبس على أي كوكب بالخريطة أو بالجدول لتشوف معلوماته.',
  fromSun: 'البعد عن الشمس',
  fromEarth: 'البعد عن الأرض',
  lightTime: 'ضوءه بيوصلنا بعد',
  weAreHere: 'نحنا هون 🙂',
  play: '▶ تشغيل',
  pause: '⏸ إيقاف',
  now: 'هلأ',
  speed: 'السرعة',
  view: 'العرض',
  goToDate: 'روح لتاريخ',
  timeBar: 'شريط الزمن',
  speeds: ['يوم بالثانية', 'أسبوع بالثانية', 'شهر بالثانية', 'سنة بالثانية'],
  simTime: 'الوقت بالمحاكاة',
  live: 'مباشر',
  check: 'فحص الدقة بهالتاريخ',
  passed: 'ناجح ✓',
  failed: 'فاشل ✗',
  worst: 'أكبر فرق:',
  colPlanet: 'الكوكب',
  colDistanceHtml: 'البعد عن الشمس<br><span dir="ltr">(AU)</span>',
  colLongitude: 'الطول البروجي',
  colError: 'الفرق مع المرجع',
  au: 'AU',
  millionKm: 'مليون كم',
  equinox: 'الاعتدال',
  resetView: 'رجّع المنظر',
  follow: (name) => `لاحق ${name}`,
  stopFollow: 'وقّف الملاحقة',
  stars: 'النجوم',
  sources: 'المصادر:',
  sourceCode: 'الكود المصدري',
  licences: 'رخص المكتبات والبيانات',
  planets: {
    mercury: 'عطارد', venus: 'الزهرة', earth: 'الأرض', mars: 'المريخ',
    jupiter: 'المشتري', saturn: 'زحل', uranus: 'أورانوس', neptune: 'نبتون',
  },
  smallBodies: 'الكويكبات والمذنبات',
  groups: { dwarf: 'كوكب قزم', asteroid: 'كويكب', neo: 'كويكب قريب من الأرض', comet: 'مذنب' },
  groupsMany: { dwarf: 'كواكب قزمة', asteroid: 'كويكبات', neo: 'كويكبات قريبة من الأرض', comet: 'مذنبات' },
  famousBodies: 'أشهر الكويكبات والمذنبات',
  selectionNote: 'عالخريطة: كل الكويكبات القريبة من الأرض اللي قطرها تقريباً كيلومتر أو أكتر، و400 من ألمع الكويكبات المرقّمة بالحزام الرئيسي وطرواديات المشتري، و300 من ألمع الأجسام ورا نبتون والقناطير، وكل المذنبات الدورية المرقّمة. أسماؤها متل ما بيكتبها JPL، بالحرف اللاتيني.',
  find: 'دوّر:',
  findPlaceholder: 'اسم أو رقم كويكب أو مذنب',
  notFound: 'ما لقينا شي بهالاسم.',
  classes: {
    MBA: 'الحزام الرئيسي', IMB: 'الحزام الرئيسي الداخلي', OMB: 'الحزام الرئيسي الخارجي',
    MCA: 'بيقطع مدار المريخ', AMO: 'مجموعة آمور', APO: 'مجموعة أبولو', ATE: 'مجموعة آتن', IEO: 'مجموعة أتيرا',
    TJN: 'طرواديات المشتري', CEN: 'قنطور (بين المشتري ونبتون)', TNO: 'ما بعد نبتون', AST: 'كويكب من نوع تاني',
    JFc: 'عائلة المشتري', JFC: 'عائلة المشتري', HTC: 'نوع هالي', ETc: 'نوع إنكه', CTc: 'نوع خيرون', COM: 'طويل الدورة',
  },
  type: 'النوع',
  diameter: 'القطر',
  km: 'كم',
  smallNote: 'كل جسم بيبيّن بس بالسنين اللي حسابنا فيها دقيق، يعني أقل من درجة فرق عن حساب JPL.',
  outsideWindow: (from, to) => `حسابنا لهالجسم دقيق بس من ${from} لـ ${to}، فما منعرضه بهالتاريخ.`,
  uncertainty: 'عدم اليقين بالموقع',
  metres: 'م',
  cloudNote: 'الغيمة حوالين الجسم فيها 300 مدار ممكن، كلهم بيناسبوا أرصاد JPL، فبتورجي وين ممكن يكون فعلاً. '
    + 'شكلها بيورجي الاتجاه الأقل معرفة: غالباً على طول المدار، وللأجسام البعيدة غالباً بعدها عن الشمس. '
    + 'الرقم هو انحراف معياري واحد (1σ) باتجاهها الأطول.',
  noCloud: 'ما منرسم غيمة لهالجسم: عليه قوى غير الجاذبية، متل غازات المذنب أو دفشة حرارة الشمس، '
    + 'وحسابنا ما بيشملها، فالغيمة كانت رح تطلع غلط.',
  cloudMismatch: 'ما منرسم غيمة لهالجسم: الغيمة اللي منحسبها (بالشمس بس) ما بتطابق عدم اليقين اللي بيعطيه JPL Horizons، غالباً لأنو شدّ كوكب بيأثّر عليه كتير.',
  cloudZoom: (f) => `مكبّرة ×${f}`,
  trueSize: 'بحجمها الحقيقي',
  light: (minutes) => {
    const hm = hoursMinutes(minutes);
    if (!hm) return `${num(minutes, 1, 'ar')} دقيقة`;
    const hours = arabicCount(hm.h, 'ساعة', 'ساعتين', 'ساعات');
    return hm.m === 0 ? hours : `${hours} و${arabicCount(hm.m, 'دقيقة', 'دقيقتين', 'دقائق')}`;
  },
  caTitle: 'مرورات قريبة من الأرض',
  caBadge: 'بيانات حيّة',
  caIntro: (mkm, ld) => `الكويكبات والمذنبات اللي بتمرق أقرب من ${mkm} مليون كم من الأرض (${ld} مسافة قمرية)، من أسبوع لورا لشهرين لقدام. `
    + 'القائمة بالوقت الحقيقي، مو بوقت المحاكاة.',
  caAhead: (n, m, until) => `لحد ${until}: ${flybysAr(n)}${n ? `، ${moonAr(m)}` : ''}.`,
  caPast: (n, m) => `بالأسبوع الماضي: ${flybysAr(n)}${n ? `، ${moonAr(m)}` : ''}.`,
  caClosest: (name, dist) => `الأقرب: ${name}، على ${dist}.`,
  caColObject: 'الجسم',
  caColWhen: 'الموعد',
  caColDistance: 'البعد عن الأرض',
  caColSpeed: 'السرعة',
  lunar: (x) => `${x} مسافة قمرية`,
  caCloserThanMoon: 'أقرب من القمر',
  caUncertain: (a, b) => `مو أكيد: بين ${a} و${b}`,
  caEstimate: 'تقدير من سطوع الجسم',
  kmPerS: 'كم/ث',
  caShowPast: (n) => `ورجيني اللي مرقوا بالأسبوع الماضي (${n})`,
  caHidePast: 'خبّي اللي مرقوا',
  caShowAll: (n) => `ورجيني الكل (${n})`,
  caShowFewer: 'ورجيني أقل',
  caNote: 'البعد من مركز الأرض. المسافة القمرية هي بعد القمر عن الأرض، 384,400 كم. '
    + 'الأحجام اللي معها ≈ تقدير من سطوع الجسم، لأنو أغلب هالكويكبات صغار وما حدا قاس حجمها. '
    + '± هو قديش الموعد مو أكيد (3σ). المواعيد بتوقيتك المحلي. '
    + 'كتير من الكويكبات الصغار ما بينكشفوا إلا قبل مرورهم بأيام قليلة أو بعده، فالقائمة بتكبر كل يوم، '
    + 'وغالباً اللي مرقوا بالأسبوع الماضي أكتر من اللي منعرفهم للشهرين الجايين.',
  caOnMap: 'موجود عالخريطة: اكبس لتشوفه',
  caUpdated: (d) => `آخر تحديث: ${d}`,
  caStale: (d) => `انتبه: هالبيانات من ${d}، وما قدرنا نجيب أجدد منها.`,
  caNone: 'ما في بيانات حيّة هون. عالموقع المنشور بتتحدّث كل 3 ساعات من JPL.',
  caLoading: 'عم يحمّل…',
  comma: '، ',
  relTime: (h) => {
    const minutes = h * 60;
    const x = Math.abs(minutes) < 60 ? 'أقل من ساعة' : arDuration(minutes);
    return h >= 0 ? `بعد ${x}` : `من ${x}`;
  },
  duration: (minutes) => arDuration(minutes),
  swTitle: 'طقس الفضاء',
  swIntro: 'شو عم يصير بين الشمس والأرض: عواصف مغناطيسية، توهجات شمسية، وموجات من الشمس جاية علينا. '
    + 'بالوقت الحقيقي، مو بوقت المحاكاة.',
  swScale: { r: 'انقطاع الراديو', s: 'الإشعاع الشمسي', g: 'الاضطراب المغناطيسي' },
  swActiveItem: (k, n) => `${{ r: 'انقطاع راديو', s: 'إشعاع شمسي', g: 'اضطراب مغناطيسي' }[k]} ${AR.swLevels[n]} (${k.toUpperCase()}${n})`,
  swScaleWhat: {
    r: 'من التوهجات الشمسية: بيقطع الراديو عالجهة المضوية من الأرض.',
    s: 'جزيئات سريعة من الشمس: بتأثر عالأقمار الصناعية ورواد الفضاء.',
    g: 'من رياح الشمس وموجاتها: بيعمل شفق قطبي، وإذا قوي بيأثر عالكهربا والملاحة بالأقمار.',
  },
  swLevels: ['هادي', 'خفيف', 'متوسط', 'قوي', 'شديد', 'أقصى'],
  swCalm: 'هلأ الوضع هادي: ما في عواصف.',
  swNowActive: (items) => `هلأ في: ${items}.`,
  swPast24: (x) => `أعلى شي بآخر 24 ساعة: ${x}`,
  swForecast: 'توقعات الأيام الجاية',
  swFcG: 'الاضطراب المغناطيسي المتوقع',
  swFcRMinor: 'احتمال انقطاع راديو خفيف أو متوسط (R1–R2)',
  swFcRMajor: 'احتمال انقطاع راديو قوي أو أكتر (R3+)',
  swFcS: 'احتمال إشعاع شمسي (S1+)',
  swKpTitle: 'مؤشر Kp كل 3 ساعات',
  swKpWhat: 'بيقيس قديش المجال المغناطيسي للأرض مضطرب، من 0 (هادي) لـ 9. من 5 وطالع يعني عاصفة مغناطيسية، '
    + 'وكل ما زاد بيبين الشفق القطبي أبعد عن القطب.',
  swKpQuiet: 'أقل من 5: ما في عاصفة',
  swKpStorm: 'عاصفة خفيفة أو متوسطة (G1–G2)',
  swKpStrong: 'عاصفة قوية أو أكتر (G3+)',
  swKpKind: { observed: 'مقاس', estimated: 'تقدير أولي', predicted: 'توقع' },
  swKpLatest: (v, level) => `آخر قيمة: ${v} (${level})`,
  swKpMaxAhead: (v, when) => `أعلى توقع: ${v}، ${when}`,
  swKpTable: 'الأرقام كجدول',
  swTime: 'الوقت',
  swFlaresTitle: 'التوهجات الشمسية بآخر 7 أيام',
  swFlareCount: (n, m, x) => `${n === 0 ? 'ولا توهج' : n === 1 ? 'توهج واحد' : arabicCount(n, 'توهج', 'توهجين', 'توهجات')}`
    + `${n ? `، منهم ${m} من الصنف M و${x} من الصنف X` : ''}.`,
  swFlareStrongest: 'الأقوى:',
  swFlareWhat: 'الصنف (A وB وC وM وX) بيقيس قوة الأشعة السينية، وكل صنف أقوى بـ 10 مرات من اللي قبله. '
    + 'توهجات M وX ممكن تقطع الراديو عالجهة المضوية من الأرض.',
  swCmeTitle: 'موجات من الشمس جاية عالأرض',
  swCmeNone: 'حسب آخر حسابات ناسا، ما في ولا موجة متوقع توصل عالأرض.',
  swCmeArrival: (when) => `متوقع توصل ${when} (± 7 ساعات)`,
  swCmeArrived: (when) => `كان متوقع توصل ${when}`,
  swCmeGlancing: 'ضربة جانبية بس',
  swCmeMinor: 'تأثير خفيف بس',
  swCmeKp: (a, b) => `Kp ممكن بين ${a} و${b}`,
  swCmeSpeed: (v) => `سرعتها قرب الشمس ${v} كم/ث`,
  swCmeNote: 'الموجة (بالإنكليزي CME) هي غيمة غاز مكهرب بتقذفها الشمس، وبتوصل الأرض بعد يوم لـ 5 أيام. '
    + 'هالتوقعات تجريبية، من نموذج WSA-Enlil البحثي تبع ناسا؛ التوقعات الرسمية هي تبع NOAA اللي فوق.',
  swParts: { scales: 'مستويات العواصف', kp: 'مؤشر Kp', flares: 'التوهجات', cmes: 'توقعات الموجات' },
  swMissing: (part) => `ما في بيانات هلأ عن ${part}.`,
  swStale: (part, d) => `انتبه: ${part} من ${d}، وما قدرنا نجيب أجدد.`,
  swNone: 'ما في بيانات طقس فضاء هون. عالموقع المنشور بتتحدّث كل 3 ساعات.',
  dsnTitle: 'شبكة الفضاء العميق هلأ',
  dsnIntro: 'مين من المركبات الفضائية عم يحكي هلأ مع الهوائيات الكبيرة تبع ناسا بتلات محطات حوالين الأرض. '
    + 'كل محطة بعيدة عن التانية تقريباً تلت دورة، فدايماً في وحدة منهم شايفة أي مركبة بعيدة.',
  dsnStations: { gdscc: 'غولدستون، كاليفورنيا', mdscc: 'مدريد، إسبانيا', cdscc: 'كانبيرا، أستراليا' },
  dsnLocalTime: (c) => `الساعة هونيك ${c}`,
  dsnSummary: (n, d) => (n === 0 ? 'هلأ ولا مركبة على اتصال.'
    : `هلأ في ${n === 1 ? 'مركبة وحدة' : arabicCount(n, 'مركبة', 'مركبتين', 'مركبات')} على اتصال، `
      + `عبر ${d === 1 ? 'هوائي واحد' : arabicCount(d, 'هوائي', 'هوائيين', 'هوائيات')}.`),
  dsnFarthest: (name, dist, light) => `الأبعد: ${name}، على ${dist}، وإشارتها بتوصلنا بعد ${light}.`,
  dsnLight: (sec) => {
    if (sec >= 59.95) return AR.light(sec / 60);
    if (sec < 9.95) return `${num(sec, 1, 'ar')} ثانية`;
    return arabicCount(Math.round(sec), 'ثانية', 'ثانيتين', 'ثواني');
  },
  dsnSignalTime: (x) => `الإشارة بتاخد ${x}`,
  dsnSize: (m) => `${m} متر`,
  dsnElevation: (d) => `${d} فوق الأفق`,
  dsnActivity: {
    link: 'اتصال مع مركبات',
    maint: 'شغل صيانة وتحديث',
    vlbi: 'قياس راديوي مع محطات بعيدة (VLBI)',
    radar: 'رادار للكواكب والكويكبات',
    astro: 'رصد فلكي راديوي',
    calib: 'معايرة',
    test: 'تجربة',
  },
  dsnDown: 'عم يستقبل من المركبة',
  dsnUp: 'عم يبعت للمركبة',
  dsnNoSignal: (n) => `الهوائي موجّه ${n === 1 ? 'عليها' : 'عليهم'}، بس ما في إشارة هلأ`,
  dsnMspa: 'كذا مركبة عبر نفس الهوائي',
  dsnRate: ['بت/ث', 'كيلوبت/ث', 'ميغابت/ث'],
  billionKm: 'مليار كم',
  dsnWhere: {
    interstellar: 'بالفضاء بين النجوم',
    kuiper: 'بحزام كايبر، ورا نبتون',
    jupiter: 'حول المشتري',
    toJupiter: 'بالطريق للمشتري',
    toTrojans: 'بالطريق لطرواديات المشتري',
    toPsyche: 'بالطريق للكويكب سايكي',
    toApophis: 'بالطريق للكويكب أبوفيس',
    toAsteroid: 'بالطريق لكويكب صغير',
    mars: 'حول المريخ',
    marsSurface: 'على سطح المريخ',
    toMars: 'بالطريق للمريخ',
    moon: 'حول القمر',
    l1: 'بين الأرض والشمس، على 1.5 مليون كم من الأرض',
    l2: 'ورا الأرض من الجهة المعتمة، على 1.5 مليون كم منها',
    sun: 'حول الشمس',
    earth: 'حول الأرض',
  },
  dsnNote: '↓ يعني الهوائي عم يستقبل بيانات من المركبة (والرقم سرعتها)، و↑ يعني عم يبعتلها أوامر. '
    + 'الصحون الكبيرة قطرها 70 متر، والباقي 34 متر. البعد وزمن الإشارة من ناسا. '
    + 'أحياناً هوائي واحد بيسمع لكذا مركبة سوا، متل المركبات اللي حول المريخ.',
  dsnUpdated: (c, ago) => `بيانات ناسا تبع الساعة ${c} (${ago})، وبتتحدّث كل دقيقة`,
  dsnAgo: (sec) => (sec < 60 ? 'من أقل من دقيقة' : `من ${arDuration(sec / 60)}`),
  dsnOld: (ago) => `انتبه: آخر بيانات بعتتها ناسا كانت ${ago}. يمكن في مشكلة عندهم.`,
  dsnOff: 'الربط المباشر مع شبكة الفضاء العميق لسا ما انعمل. قريباً بيشتغل هون.',
  dsnNone: 'ما قدرنا نجيب بيانات من ناسا هلأ. منرجع منجرّب بعد دقيقة.',
  dsnLocal: 'ما في بيانات حيّة هون. عالموقع المنشور بتتحدّث كل دقيقة من ناسا.',
  nowTitle: 'هلأ بالفضاء',
  nowIntro: 'شو عم يصير بالفضاء بهاللحظة، من ناسا وNOAA، وشو رح يصير بالسما. اكبس على وحدة لتشوف التفاصيل.',
  nowTabs: { dsn: 'شبكة الفضاء العميق', weather: 'طقس الفضاء', approaches: 'مرورات قريبة من الأرض', events: 'أحداث السما' },
  nowUpdated: (ago) => `آخر تحديث ${ago}`,
  nowNoData: 'ما في بيانات هلأ',
  nowDsn: (n) => (n === 0 ? 'ولا مركبة على اتصال'
    : `${n === 1 ? 'مركبة وحدة' : arabicCount(n, 'مركبة', 'مركبتين', 'مركبات')} على اتصال`),
  nowFarthest: (name) => `الأبعد: ${name}`,
  nowWeatherCalm: 'هادي هلأ',
  nowWeatherAhead: (level, day) => `الأيام الجاية: لحد ${level}، ${day}`,
  nowWeatherAheadCalm: 'والأيام الجاية هادية كمان',
  nowCme: (when) => `موجة من الشمس متوقعة ${when}`,
  nowApproaches: (n, until) => `${flybysAr(n)} لحد ${until}`,
  events: {
    title: 'أحداث السما',
    badge: 'محسوبة بمتصفحك',
    intro: 'شو رح يصير بالسما بالأيام الجاية: أوجه القمر، الكسوف والخسوف، الكواكب قدّام الشمس أو وراها، '
      + 'ولما القمر أو كوكبين بيقرّبوا من بعض بالسما. كلها محسوبة هون بمتصفحك، بالوقت الحقيقي، مو بوقت المحاكاة.',
    daysLabel: 'قديش لقدّام',
    days7: 'الأسبوع الجاي',
    days30: 'الشهر الجاي',
    summary: (n, d) => `${d === 7 ? 'بالأسبوع الجاي' : 'بالشهر الجاي'}: ${eventsAr(n)}.`,
    tileMain: (n) => `${eventsAr(n)} بالشهر الجاي`,
    next: (what, when) => `الجاي: ${what}، ${when}`,
    jump: 'روح لهالوقت',
    jumpTitle: 'بيوقّف الوقت وبيروح لهاللحظة بالمشهد',
    jumpPick: (p) => `بيوقّف الوقت، بيروح لهاللحظة بالمشهد، وبيختار ${p}`,
    about: (x) => `حوالي ${x}`,
    note: (tz) => `الأوقات بتوقيتك (${tz}). كلها من مركز الأرض: القمر ممكن يبيّن لحد درجة تقريباً بغير مطرح، حسب وين انت. `
      + 'السطوع بالقدر الظاهري: كل ما الرقم أصغر، كل ما أسطع (الزهرة حوالي −4). '
      + 'الأوقات ضمن كم دقيقة من جداول NAOJ وUSNO وناسا. الكويكبات من CNEOS (بطاقة المرورات). الحساب:',
    moonName: 'القمر',
    moon: { new: 'محاق', firstQuarter: 'تربيع أول', full: 'بدر', lastQuarter: 'تربيع أخير' },
    moonNotes: {
      new: 'القمر بين الأرض والشمس، فما بيبيّن. بعد يومين بيطلع هلال رفيع بالمسا.',
      firstQuarter: 'نص القمر مضوي. بيبيّن العصر وأول الليل.',
      full: 'القمر كله مضوي: بيطلع وقت غياب الشمس وبيضل طول الليل.',
      lastQuarter: 'نص القمر مضوي. بيبيّن آخر الليل والصبح.',
    },
    conjunction: {
      superior: (p) => `${p} ورا الشمس`,
      inferior: (p) => `${p} بيننا وبين الشمس`,
      plain: (p) => `${p} ورا الشمس`,
    },
    conjunctionNotes: {
      superior: 'اقتران علوي: ضايع بضو الشمس هالأيام، وبعدها بيرجع يبيّن بالمسا.',
      inferior: 'اقتران سفلي: ضايع بضو الشمس هالأيام، وبعدها بيبلّش يبيّن بالصبح.',
      plain: 'اقتران: ضايع بضو الشمس هالأيام، وبعدها بيرجع يبيّن بالصبح.',
    },
    opposition: (p) => `${p} مقابل الشمس`,
    oppositionNote: 'تقابل: الأرض بين الشمس والكوكب. أحسن وقت لتشوفه: بيطلع وقت غياب الشمس وبيضل طول الليل، وهو بأقرب وأسطع شي.',
    brightDistance: (m, d) => `سطوعه\u00a0${m}، وبعده ${d}.`,
    optics: 'بدك منظار لتشوفه.',
    elongation: (p, sky) => `${p} بأبعد نقطة عن الشمس بسما ${sky === 'evening' ? 'المسا' : 'الصبح'}`,
    elongationNote: (d, sky) => `أكبر استطالة: ${d} عن الشمس. أحسن وقت لتشوفه: ${sky === 'evening' ? 'بعد غياب الشمس، واطي بالغرب' : 'قبل شروق الشمس، واطي بالشرق'}.`,
    brightness: (m) => `سطوعه\u00a0${m}.`,
    solar: { total: 'كسوف كلي للشمس', annular: 'كسوف حلقي للشمس', partial: 'كسوف جزئي للشمس' },
    solarWhere: (where) => `بيبيّن بس من شريط ضيّق عالأرض، ووقت الذروة نص الضل على ${where}. حواليه كسوف جزئي.`,
    solarPartial: 'بيبيّن كسوف جزئي من جزء من الأرض بس.',
    solarSafety: 'ما تتطلّع عالشمس أبداً بلا نضارات كسوف.',
    lunar: { total: 'خسوف كلي للقمر', partial: 'خسوف جزئي للقمر', penumbral: 'خسوف شبه الظل للقمر' },
    lunarNotes: {
      total: (d) => `القمر كله بضل الأرض لمدة ${d}، وبيصير لونه أحمر. بيبيّن من كل مطرح فيه ليل وقتها.`,
      partial: (d) => `جزء من القمر بضل الأرض لمدة ${d}. بيبيّن من كل مطرح فيه ليل وقتها.`,
      penumbral: (d) => `القمر بيمرق بشبه ضل الأرض لمدة ${d}: بيعتم شوي بس، وصعب تلاحظه.`,
    },
    seasons: { marchEquinox: 'اعتدال آذار', juneSolstice: 'انقلاب حزيران', septemberEquinox: 'اعتدال أيلول', decemberSolstice: 'انقلاب كانون الأول' },
    seasonNotes: {
      marchEquinox: 'الليل والنهار تقريباً متساويين بكل العالم: بداية الربيع بالنص الشمالي من الأرض، والخريف بالجنوبي.',
      juneSolstice: 'أطول نهار بالنص الشمالي من الأرض وأقصر نهار بالجنوبي: بداية الصيف بالشمال.',
      septemberEquinox: 'الليل والنهار تقريباً متساويين بكل العالم: بداية الخريف بالنص الشمالي من الأرض، والربيع بالجنوبي.',
      decemberSolstice: 'أقصر نهار بالنص الشمالي من الأرض وأطول نهار بالجنوبي: بداية الشتا بالشمال.',
    },
    perihelion: 'الأرض بأقرب نقطة من الشمس',
    aphelion: 'الأرض بأبعد نقطة من الشمس',
    perihelionNote: (d) => `على بعد ${d}. وهاد ما إلو علاقة بالفصول: وقتها شتا بالشمال. الفصول من ميلان الأرض.`,
    aphelionNote: (d) => `على بعد ${d}، ومع هيك صيف بالشمال: الفصول من ميلان الأرض، مو من بعدها.`,
    pair: (a, b) => `${a} جنب ${b}`,
    pairNote: (d) => `بيناتهم ${d} بالسما (عرض القمر نص درجة).`,
    glare: 'بس قريبين من الشمس بالسما، فصعب تشوفهن.',
    neo: (name) => `${name} بيمرق جنب الأرض`,
    neoNote: (d) => `على بعد ${d}.`,
    neoCloser: 'أقرب من القمر!',
    neoClosest: 'الأقرب بالشهر الجاي.',
    north: 'شمال', south: 'جنوب', east: 'شرق', west: 'غرب',
  },
  video: {
    weekTitle: 'السما هالأسبوع',
    daysTitle: 'السما بهالأيام',
    weekCount: (n) => eventsAr(n),
    eventNo: (i, n) => `الحدث ${i} من ${n}`,
    outroLine: 'شوف السما بأي يوم، والكواكب بثلاثي الأبعاد، ببلاش وبمتصفحك:',
    sources: 'الحساب: Astronomy Engine · الكويكبات: CNEOS (ناسا/JPL)',
    when: (x, zone) => `${x} (${zone})`,
    speed: (d) => `كل ثانية بالفيديو = ${d}`,
    sunName: 'الشمس',
    ecliptic: 'مسار الشمس',
    earthShadow: 'ضل الأرض',
    fromPlace: (where) => `متل ما بيبيّن من ${where}`,
    fromCentre: 'من مركز الأرض',
    lunarDistance: 'بعد القمر',
    scaleNote: 'المسافات على السلّم، والأحجام مكبّرة.',
  },
  branch: {
    title: 'فرّع الواقع',
    badge: 'تجريبي',
    intro: 'خود نسخة من المجموعة الشمسية من اللحظة اللي عالشاشة، غيّر فيها شي، وشوف كيف بتمشي الكواكب بعدها. محرك الفيزياء بيحسب الجاذبية بين الشمس والكواكب لحاله، مع النسبية العامة.',
    action: 'شو بدك تغيّر',
    actions: { remove: 'شيل كوكب', mass: 'غيّر الكتلة', push: 'زقّ كوكب', star: 'مرّق نجم' },
    body: 'مين',
    sun: 'الشمس',
    factor: 'الكتلة ×',
    speed: 'التغيير بالسرعة (كم/ث)',
    pushHint: 'موجب: أسرع، سالب: أبطأ',
    starMass: 'كتلة النجم (من كتلة الشمس)',
    starDistance: 'أقرب مسافة (AU)',
    starNote: 'بيمرّ بعد 10 سنين بسرعة 20 كم/ث، بنفس مستوى مدار الأرض',
    go: 'فرّع',
    reset: 'رجوع للواقع',
    what: {
      remove: (n) => `الفرع: بلا ${n}`,
      mass: (n, f) => `الفرع: كتلة ${n} ×${f}`,
      push: (n, v, faster) => `الفرع: ${n} ${faster ? 'أسرع' : 'أبطأ'} بـ ${v} كم/ث`,
      star: (m, d) => `الفرع: نجم كتلته ×${m} من كتلة الشمس بيمرّ على بعد ${d}`,
    },
    from: (d) => `من ${d}`,
    computing: (y) => `عم يحسب… وصل لـ ${y}`,
    before: (d) => `هالوقت قبل التفريع (${d})، فالفرع ما بيبيّن هون`,
    legend: 'النقطة المليانة: الواقع · الدايرة الفاضية: الفرع، مع خط لمكانها الحقيقي',
    error: (m) => `ما زبط: ${m}`,
    tooFar: 'التفريع بيشتغل بس بين 1800 و2050',
    starLate: (y) => `النجم لازم يمرّ قبل 2050: فرّع من ${y} أو قبل`,
    jump: 'روح لبداية الفرع',
    compare: {
      title: 'مقارنة مع الواقع، بنفس اللحظة',
      note: 'الواقع هون هو نفس الحساب بلا التغيير، فكل فرق جاي من التغيير. السنة: قديش بياخد الكوكب ليلف لفّة حوالين الشمس عمداره هلأ.',
      body: 'الجسم', year: 'سنته', distance: 'بعده عن الشمس', offset: 'بعده عن مكانه بالواقع',
      removed: 'انشال', escapes: 'هارب، ما عاد يلف', star: 'النجم',
      real: (v) => `بالواقع: ${v}`, days: (n) => `${n} يوم`, years: (n) => `${n} سنة`,
    },
    scenarios: {
      title: 'سيناريوهات جاهزة',
      own: 'أو غيّر شي لحالك:',
      preparing: 'عم يحضّر الفرع…',
      buttons: { jupiter: 'شو لو اختفى المشتري؟', sun: 'شو لو صارت كتلة الشمس الضعف؟', star: 'نجم بيمرّ على بعد 1,000 AU' },
      nearer: 'قرّب النجم لـ 50 AU',
      farther: 'رجّع النجم لـ 1,000 AU',
      list: {
        jupiter: {
          how: 'منشيل المشتري أول يوم بسنة 1900، ومنمشّي الوقت سنة بالثانية لحد 2050.',
          result: (f) => `النتيجة: ولا كوكب بيطير ولا بيوقع عالشمس، لأنو الشمس هي اللي ماسكة الكواكب، مو المشتري. بس المدارات بتتزحزح شوي شوي: لحد سنة 2000 زحل بيبعد حوالي ${f.saturn} مليون كم عن مكانه بالواقع، والأرض حوالي ${f.earth} كم.`,
        },
        sun: {
          how: 'منضاعف كتلة الشمس فجأة يوم 15 تشرين الثاني 2026، والكواكب بتضل بنفس سرعتها. الوقت بيمشي شهر بالثانية.',
          result: (f) => `النتيجة: فوراً كل الكواكب بتلفّ أسرع، على مدارات أصغر وممطوطة: سنة الأرض بتصير ${f.earthYear} يوم بدل 365، وبتقرّب لحد ${f.earthClosest} AU من الشمس، وسنة المشتري ${f.jupiterYear} سنة بدل 11.9.`,
        },
        star: {
          how: 'نجم بكتلة الشمس بيمرّ سنة 2036 على بعد 1,000 AU (أبعد من نبتون بـ 33 مرة)، بسرعة 20 كم/ث. الوقت بيمشي سنة بالثانية لحد 2050.',
          result: (f) => `النتيجة: بالعين ما بيبيّن شي، والنجم بيضل سهم عالحافة. والجدول بيورجي ليش: بآخر 2050 نبتون بيكون بعيد بس حوالي ${f.neptune} كم عن مكانه، والأرض أقل من ${f.earth} كم. يعني حتى نجم متل الشمس، على هالبعد، بالكاد بيلمس الكواكب.`,
        },
        star50: {
          how: 'نفس النجم، بس على بعد 50 AU، يعني مش بعيد كتير عن نبتون (30 AU).',
          result: (f) => `النتيجة: هلأ الفرق كبير: بآخر 2050 سنة نبتون بتصير حوالي ${f.neptuneYear} سنة بدل 165، وسنة أورانوس حوالي ${f.uranusYear} بدل 84، ونبتون بيكون بعيد حوالي ${f.neptune} مليون كم عن مكانه، وهاد بيبيّن عالخريطة. الأرض بتتأثر شوي بس: حوالي ${f.earth} كم.`,
        },
      },
    },
  },
  trip: {
    title: 'مخطط الرحلات',
    badge: 'تجريبي',
    intro: 'لو انطلقنا من الأرض لكوكب تاني، أو لكويكب أو مذنب، قديش بتطوّل الرحلة، قديش لازم تغيّر المركبة سرعتها (Δv، وهاد اللي بيحدد الوقود)، وإيمتى أحسن وقت؟ '
      + 'للكواكب، أول جواب هو انتقال هوهمان: أوفر طريق بين مدارين، نص قطع ناقص حوالين الشمس بيلمس مدار الأرض ومدار الكوكب، مع دفشتين: وحدة للانطلاق ووحدة للوصول. '
      + 'الموعد بينحسب من وقت الشاشة.',
    to: 'لوين',
    duration: 'مدة الرحلة',
    leave: 'دفشة الانطلاق',
    arrive: 'دفشة الوصول',
    total: 'المجموع (Δv)',
    tripDays: (d) => `${d} يوم`,
    aboutMonths: (m) => `حوالي ${m} شهر`,
    tripYears: (y) => `${y} سنة`,
    kmS: (v) => `${v} كم/ث`,
    c3: (v) => `\u2066C3 = ${v}\u2069 كم²/ث²`, // the formula kept left-to-right
    leaveNote: (km, c3) => `من مدار على ${km} كم فوق الأرض · طاقة الإطلاق ${c3}`,
    arriveNote: (km, name, v) => `لمدار على ${km} كم فوق ${name} · سرعة المركبة بالنسبة للكوكب لما توصل: ${v}`,
    whenTitle: 'إيمتى منطلق؟',
    phase: (id, need, ahead, now, nowAhead) => `لحظة الانطلاق، لازم ${id === 'venus' ? 'تكون' : 'يكون'} ${AR.planets[id]} ${ahead ? 'قدّام' : 'ورا'} الأرض بـ\u00a0${need} (من الشمس). `
      + `بوقت الشاشة: ${nowAhead ? 'قدّامها' : 'وراها'} بـ\u00a0${now}.`,
    window: (d, rel, a) => `أقرب موعد: الانطلاق ${d} (${rel})، والوصول ${a}.`,
    prev: (d, rel) => `اللي قبله كان ${d} (${rel}).`,
    every: (days, m) => `وبعدها مرة كل ${days} يوم تقريباً (حوالي ${arabicCount(m, 'شهر', 'شهرين', 'أشهر')}): هي الدورة الاقترانية، لحتى يرجع الكوكب والأرض لنفس الوضع.`,
    rel: (d) => {
      if (Math.abs(d) < 1) return 'اليوم';
      const x = Math.abs(d) < 60 ? arabicCount(Math.round(Math.abs(d)), 'يوم', 'يومين', 'أيام')
        : arabicCount(Math.round(Math.abs(d) / 30.44), 'شهر', 'شهرين', 'أشهر');
      return d > 0 ? `بعد ${x}` : `من ${x}`;
    },
    jump: 'روح لموعد الانطلاق',
    outside: 'هالموعد بعد 2050، وشريط الزمن ما بيوصل لهونيك.',
    note: 'تقريب: هوهمان بيعتبر المدارين دواير بنفس المستوى. المدارات الحقيقية ممطوطة ومايلة شوي، فالموعد الحقيقي والأرقام بتختلف شوي. للأرقام الحقيقية: الحساب الدقيق تحت.',
    giants: 'للكواكب البعيدة، المركبات الحقيقية بتمرق جنب كواكب تانية لتاخد منها دفشة جاذبية، متل فوياجر 2 اللي وصلت لنبتون بـ 12 سنة، وبتدخل بمدار ممطوط بدل مدار قريب. هيك بتوصل أسرع وبوقود أقل بكتير.',
    exactTitle: 'حساب دقيق لتواريخ بتختارها',
    exactIntro: 'هون الحساب بالمدارات الحقيقية (ممطوطة ومايلة): بتختار يوم الانطلاق ويوم الوصول، ومنلاقي المسار حوالين الشمس اللي بيوصل من مكان الأرض بأول يوم لمكان الهدف بتاني يوم (مسألة لامبرت).',
    departDate: 'يوم الانطلاق',
    arriveDate: 'يوم الوصول',
    way: (deg, type, revs, by) => (revs
      ? `المسار بيلف حوالين الشمس ${revs === 1 ? 'لفّة كاملة' : revs === 2 ? 'لفّتين كاملين' : `${revs} لفّات كاملة`} وبعدين ${deg} كمان، `
        + `لأنو هيك ${by === 'c3' ? 'أوفر للإطلاق' : 'أوفر بالدفشتين سوا'} من الطريق المباشر. `
      : `المسار بيلف ${deg} حوالين الشمس: `)
      + `${type === 1 ? 'النوع الأول (أقل من نص لفّة)' : 'النوع التاني (أكتر من نص لفّة)'}${revs ? ' بآخر لفّة' : ''}.`,
    badDates: 'لازم يكون يوم الوصول بعد يوم الانطلاق.',
    noTrip: 'ما في مسار واحد لهالتاريخين (الأرض والهدف بجهتين متعاكستين بالظبط). جرّب يوم تاني.',
    mapTitle: 'خريطة مواعيد الانطلاق',
    mapIntro: 'كل نقطة بالخريطة رحلة محسوبة بالظبط: يوم الانطلاق عالمحور الأفقي، ومدة الرحلة عالعمودي، واللون قديش بتكلّف. كل ما كان اللون أفتح، كل ما كانت أرخص. اكبس على أي نقطة لتشوف حسابها تحت. الخط المتقطّع بيفصل بين النوع الأول (تحت) والنوع التاني (فوق).',
    mapIntroSmall: 'كل نقطة بالخريطة رحلة محسوبة بالظبط: يوم الانطلاق عالمحور الأفقي، ومدة الرحلة عالعمودي، واللون قديش بتكلّف. كل ما كان اللون أفتح، كل ما كانت أرخص. اكبس على أي نقطة لتشوف حسابها تحت. '
      + 'بالرحلات الطويلة المسار ممكن يلف حوالين الشمس مرة أو أكتر قبل ما يوصل، فالخريطة بتصير متل الفسيفساء: كل قطعة عدد لفّات تاني.',
    colorBy: 'اللون حسب',
    measures: { c3: 'طاقة الإطلاق (C3)', dv: 'المجموع (Δv)' },
    units: { c3: 'كم²/ث²', dv: 'كم/ث' },
    axisDepart: 'يوم الانطلاق',
    axisDays: 'مدة الرحلة (يوم)',
    axisYears: 'مدة الرحلة (سنة)',
    computing: 'عم يحسب الخريطة…',
    cheaper: 'أرخص',
    dearer: 'أغلى',
    marks: 'I وII: أرخص رحلة من كل نوع · H: تقدير هوهمان · الدايرة البيضا: الرحلة المحسوبة تحت. بالكيبورد، الأسهم بتحرّك الدايرة.',
    best: (type, d, a, dur, v) => `أرخص رحلة من النوع ${type === 1 ? 'الأول' : 'التاني'}: انطلاق ${d}، وصول ${a} (${dur})، ${v}.`,
    pick: 'اختارها',
    typeName: (type) => (type === 1 ? 'النوع الأول' : 'النوع التاني'),
    turns: (n) => (n === 1 ? 'بعد لفّة كاملة' : n === 2 ? 'بعد لفّتين كاملين' : `بعد ${n} لفّات كاملة`),
    nearHalf: 'هالرحلة بتلف تقريباً نص لفّة بالظبط: مستوى المسار بالكاد محدد، والأرقام بتتغيّر كتير من يوم ليوم. المهمات الحقيقية بتتجنّب هالخط.',
    edge: '(على طرف الخريطة، فممكن تكون في رحلة أرخص برّاها)',
    playTrip: 'شغّل الرحلة بالمشهد',
    showPath: 'ورجيني المسار بالمشهد',
    craft: 'المركبة',
    playNote: 'الزر بيرجّع الوقت ليوم الانطلاق وبيشغّله، فبتشوف المركبة ماشية عالمسار لحد ما توصل. الخط المليان: اللي قطعته، والمتقطّع: اللي باقي.',
    mapAria: 'خريطة مواعيد الانطلاق: يوم الانطلاق ومدة الرحلة، ملوّنة حسب الكلفة',
    sigTitle: 'تأخير الإشارة',
    sigIntro: 'الأرض والمركبة بيحكوا مع بعض بالراديو، والإشارة بتمشي بسرعة الضوء: 299,792 كم بالثانية. فكل ما بعدت المركبة، كل ما طوّلت الرسالة لتوصل، '
      + 'وما حدا بيقدر يسوقها مباشرة: لازم تتصرّف لحالها بالأوامر اللي وصلتها من قبل. الرسمة بتورجي قديش بتاخد الإشارة باتجاه واحد بكل يوم من الرحلة (سؤال وجواب: الضعف). '
      + 'المناطق الفاتحة: المركبة قريبة من الشمس بسما الأرض (أقل من 2°)، وغاز الشمس الحامي بيخربط الإشارة، فمهمات ناسا للمريخ ما بتبعت أوامر بهالأيام.',
    seconds: (n) => arabicCount(n, 'ثانية', 'ثانيتين', 'ثواني'),
    sigArrive: (one, both) => `لما توصل المركبة، الإشارة بتاخد ${one}، يعني سؤال وجواب ${both}.`,
    sigMax: (d, date, day) => `أطول تأخير: ${d}، يوم ${date} (اليوم ${day} من الرحلة).`,
    sigMaxAtEnd: 'وهاد أطول تأخير بالرحلة كلها.',
    sigNow: (day, d) => `بوقت الشاشة (اليوم ${day} من الرحلة): ${d}.`,
    sigConj: (n, list) => `${n === 1 ? 'مرة وحدة' : n === 2 ? 'مرتين' : n <= 10 ? `${n} مرات` : `${n} مرة`} بالرحلة، المركبة بتقرّب من الشمس بسما الأرض لأقل من 2°: ${list}. `
      + 'بهالأيام المهمات الحقيقية ما بتبعت أوامر.',
    sigConjMany: (n, m, first, last) => `${n <= 10 ? `${n} مرات` : `${n} مرة`} بالرحلة، المركبة بتقرّب من الشمس بسما الأرض لأقل من 2°، تقريباً مرة كل ${arabicCount(m, 'شهر', 'شهرين', 'أشهر')}: `
      + `أول مرة ${first}، وآخر مرة ${last}. بهالأيام المهمات الحقيقية ما بتبعت أوامر.`,
    sigNoConj: 'المركبة ما بتقرّب من الشمس بسما الأرض لأقل من 2° بكل الرحلة، فالإشارة بتضل نضيفة.',
    sigJoin: '، ',
    sigAxisDays: 'أيام من الانطلاق',
    sigAxisYears: 'سنين من الانطلاق',
    sigUnitMin: 'الإشارة (دقيقة)',
    sigUnitHours: 'الإشارة (ساعة)',
    sigSun: 'قريبة من الشمس',
    sigDay: (d) => `اليوم ${d} من الرحلة`,
    sigTable: 'الأرقام كجدول',
    sigCols: { date: 'التاريخ', day: 'يوم الرحلة', distance: 'البعد عن الأرض', delay: 'الإشارة (باتجاه واحد)', sun: 'بعدها عن الشمس بالسما' },
    sigAria: 'تأخير الإشارة بين الأرض والمركبة على طول الرحلة',
    craftDelay: (name, d) => `${name} · ${d}`,
    targetGroups: { planets: 'الكواكب', main: 'حزام الكويكبات', neo: 'كويكبات قريبة من الأرض', trojan: 'طرواديات المشتري', far: 'ورا نبتون', comet: 'مذنبات' },
    sbNoHohmann: (y, a, b) => 'للكويكبات والمذنبات ما في تقدير هوهمان: مداراتها ممطوطة ومايلة كتير لنعتبرها دواير. '
      + `بدالها، الخريطة تحت بتحسب كل رحلة بالظبط، لمواعيد انطلاق على ${y} سنين من وقت الشاشة، ومدة رحلة من ${a} لـ ${b} يوم (متل أداة ناسا لتصميم رحلات الأجسام الصغيرة)، وأطول للأجسام البعيدة.`,
    sbKnown: (name, from, to) => `الموقع بيعرف وين ${name} (ضمن درجة من حساب ناسا) بس من ${from} لـ ${to}، فالرحلة لازم توصل بهالسنين.`,
    sbRetro: (name) => `${name} بيلف حوالين الشمس بالعكس. قريب من الشمس، وين بيمشي بسرعة، أي مركبة بتلاقيه وجهاً لوجه وبسرعة هايلة: مركبة جوتو الأوروبية مرقت جنب مذنب هالي بـ\u00a068\u00a0كم/ث سنة 1986. بعيد عن الشمس بيمشي على مهله، فالفرق أقل بكتير.`,
    sbFar: 'المركبات الحقيقية للأجسام البعيدة بتمرق جنب المشتري لتاخد منه دفشة جاذبية: نيو هورايزنز انطلقت 2006 ووصلت لبلوتو 2015، بأقل من 10 سنين. هالمخطط ما بيحسب هالدفشات، فأرقامه للطريق المباشر بس.',
    sbNoRange: 'من وقت الشاشة، ما في رحلة بتوصل بهالسنين.',
    sbJump: (year) => `روح لـ ${year}`,
    sbNoTrips: (name) => `ما في ولا رحلة لـ ${name} بهالخريطة.`,
    sbOutsideDates: (name, from, to) => `الموقع بيعرف وين ${name} بس من ${from} لـ ${to}: اختار يوم وصول بيناتهن.`,
    arriveSmall: (name) => `لتوقف جنب ${name} بدل ما تمرق جنبه، المركبة بتلغي كل سرعتها بالنسبة إلو (جاذبيته ضعيفة كتير، فما بتساعد).`,
    sbFlyby: 'للكويكبات والمذنبات، أرخص طاقة إطلاق (C3) غالباً معناها مرور سريع جنبه بس: شوف دفشة الوصول. لتوقف عنده، لوّن الخريطة حسب المجموع (Δv).',
    marksSmall: 'I وII: أرخص رحلة من كل نوع · الدايرة البيضا: الرحلة المحسوبة تحت. بالكيبورد، الأسهم بتحرّك الدايرة. المحل الفاضي: الموقع ما بيعرف وين الجسم بيوم الوصول.',
  },
};

const DE: Strings = {
  title: 'Digitaler Zwilling des Sonnensystems',
  tagline: 'Die echten Positionen der Planeten und von über 2.000 Asteroiden und Kometen, was gerade im All passiert, was wäre, wenn sich etwas ändert, und wie man dorthin reist',
  beta: 'Beta',
  feedback: 'Feedback geben',
  language: 'Sprache',
  tab3d: '3D-Ansicht',
  tab2d: 'Karte von oben',
  loading: 'Szene wird geladen …',
  no3d: 'Dieser Browser unterstützt die 3D-Ansicht nicht',
  mapAria: 'Karte der Planeten um die Sonne',
  sceneAria: '3D-Szene der Planeten um die Sonne',
  views: {
    compressed: {
      label: 'Alle Planeten, Abstände gestaucht',
      caption: 'Die Abstände sind gestaucht, damit alle Planeten sichtbar sind. Die Richtungen stimmen.',
    },
    true: {
      label: 'Alle Planeten, echte Abstände',
      caption: 'Echte Abstände. Die inneren Planeten liegen sehr nah an der Sonne.',
    },
    inner: {
      label: 'Innere Planeten, echte Abstände',
      caption: 'Echte Abstände, bis zur Marsbahn.',
    },
  },
  howto3d: 'Ziehen dreht die Szene, Mausrad oder zwei Finger zoomen, Doppelklick oder ↺ setzt zurück. '
    + 'Wähle einen Planeten und klicke auf „folgen“: Die Kamera bleibt bei ihm, auch wenn die Zeit läuft. '
    + 'Die Linien von den Planeten zur Ebene zeigen, wie weit sie über oder unter der Ebene der Erdbahn liegen. '
    + 'Die Kreise zeigen den Abstand in AE. Die Planetengrößen sind nicht maßstabsgetreu. '
    + 'Die Sterne im Hintergrund sind echt: alle, die man in einer klaren Nacht mit bloßem Auge sieht. ✦ blendet sie aus.',
  howto2d: 'Blick von oben, die Planeten laufen gegen den Uhrzeigersinn. Die Planetengrößen sind nicht maßstabsgetreu. '
    + 'Die Zahlen an den Kreisen sind Abstände in AE. Mausrad zoomt, Doppelklick setzt zurück.',
  infoHint: 'Wähle einen Planeten in der Karte oder in der Tabelle, um seine Daten zu sehen.',
  fromSun: 'Abstand zur Sonne',
  fromEarth: 'Abstand zur Erde',
  lightTime: 'Lichtlaufzeit zur Erde',
  weAreHere: 'Wir sind hier 🙂',
  play: '▶ Abspielen',
  pause: '⏸ Pause',
  now: 'Jetzt',
  speed: 'Tempo',
  view: 'Ansicht',
  goToDate: 'Gehe zu Datum',
  timeBar: 'Zeitleiste',
  speeds: ['1 Tag pro Sekunde', '1 Woche pro Sekunde', '1 Monat pro Sekunde', '1 Jahr pro Sekunde'],
  simTime: 'Zeit in der Simulation',
  live: 'live',
  check: 'Genauigkeitsprüfung zu diesem Datum',
  passed: 'Bestanden ✓',
  failed: 'Nicht bestanden ✗',
  worst: 'Größte Abweichung:',
  colPlanet: 'Planet',
  colDistanceHtml: 'Abstand zur Sonne<br>(AE)',
  colLongitude: 'Ekliptikale Länge',
  colError: 'Abweichung zur Referenz',
  au: 'AE',
  millionKm: 'Mio. km',
  equinox: 'Frühlingspunkt',
  resetView: 'Ansicht zurücksetzen',
  follow: (name) => `${name} folgen`,
  stopFollow: 'Nicht mehr folgen',
  stars: 'Sterne',
  sources: 'Quellen:',
  sourceCode: 'Quellcode',
  licences: 'Lizenzen der Bibliotheken und Daten',
  planets: {
    mercury: 'Merkur', venus: 'Venus', earth: 'Erde', mars: 'Mars',
    jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptun',
  },
  smallBodies: 'Asteroiden und Kometen',
  groups: { dwarf: 'Zwergplanet', asteroid: 'Asteroid', neo: 'erdnaher Asteroid', comet: 'Komet' },
  groupsMany: { dwarf: 'Zwergplaneten', asteroid: 'Asteroiden', neo: 'erdnahe Asteroiden', comet: 'Kometen' },
  famousBodies: 'Bekannte Asteroiden und Kometen',
  selectionNote: 'Auf der Karte: alle erdnahen Asteroiden ab etwa 1 km Durchmesser, die 400 hellsten nummerierten Asteroiden des Hauptgürtels und der Jupiter-Trojaner, die 300 hellsten Körper jenseits des Neptun und Zentauren, und alle nummerierten periodischen Kometen. Namen wie beim JPL.',
  find: 'Suchen:',
  findPlaceholder: 'Name oder Nummer eines Asteroiden oder Kometen',
  notFound: 'Nichts mit diesem Namen gefunden.',
  classes: {
    MBA: 'Hauptgürtel', IMB: 'innerer Hauptgürtel', OMB: 'äußerer Hauptgürtel',
    MCA: 'Mars-Bahnkreuzer', AMO: 'Amor-Gruppe', APO: 'Apollo-Gruppe', ATE: 'Aten-Gruppe', IEO: 'Atira-Gruppe',
    TJN: 'Jupiter-Trojaner', CEN: 'Zentaur (zwischen Jupiter und Neptun)', TNO: 'transneptunisch', AST: 'sonstiger Asteroid',
    JFc: 'Jupiter-Familie', JFC: 'Jupiter-Familie', HTC: 'Halley-Typ', ETc: 'Encke-Typ', CTc: 'Chiron-Typ', COM: 'langperiodisch',
  },
  type: 'Art',
  diameter: 'Durchmesser',
  km: 'km',
  smallNote: 'Jeder Körper erscheint nur in den Jahren, in denen unsere Rechnung genau ist: weniger als 1° Abweichung zur Rechnung des JPL.',
  outsideWindow: (from, to) => `Unsere Rechnung ist für diesen Körper nur von ${from} bis ${to} genau, deshalb wird er zu diesem Datum nicht gezeigt.`,
  uncertainty: 'Positionsunsicherheit',
  metres: 'm',
  cloudNote: 'Die Wolke um den Körper zeigt 300 mögliche Bahnen, die alle zu den Beobachtungen des JPL passen, also wo er wirklich sein könnte. '
    + 'Ihre Form zeigt die am wenigsten bekannte Richtung: oft entlang der Bahn, bei fernen Körpern oft ihr Abstand zur Sonne. '
    + 'Die Zahl ist eine Standardabweichung (1σ) in ihrer längsten Richtung.',
  noCloud: 'Für diesen Körper zeichnen wir keine Wolke: Auf ihn wirken neben der Schwerkraft weitere Kräfte, '
    + 'etwa das Ausgasen eines Kometen oder der Schub der Sonnenwärme. Unsere Rechnung enthält sie nicht, die Wolke wäre falsch.',
  cloudMismatch: 'Für diesen Körper zeichnen wir keine Wolke: Unsere Wolke (nur mit der Sonne gerechnet) passt nicht zur Unsicherheit, die JPL Horizons angibt, wahrscheinlich weil die Anziehung eines Planeten für ihn viel ausmacht.',
  cloudZoom: (f) => `${f}-fach vergrößert`,
  trueSize: 'in echter Größe',
  light: (minutes) => {
    const hm = hoursMinutes(minutes);
    if (!hm) return `${num(minutes, 1, 'de')} Minuten`;
    const hours = plural(hm.h, 'Stunde', 'Stunden');
    return hm.m === 0 ? hours : `${hours} und ${plural(hm.m, 'Minute', 'Minuten')}`;
  },
  caTitle: 'Nahe Vorbeiflüge an der Erde',
  caBadge: 'Live-Daten',
  caIntro: (mkm, ld) => `Asteroiden und Kometen, die näher als ${mkm} Mio. km an der Erde vorbeifliegen (${ld} Monddistanzen), `
    + 'von einer Woche zurück bis zwei Monate voraus. Die Liste läuft in Echtzeit, nicht in der Zeit der Simulation.',
  caAhead: (n, m, until) => `Bis ${until}: ${n === 0 ? 'kein Vorbeiflug' : plural(n, 'Vorbeiflug', 'Vorbeiflüge')}`
    + `${n ? `, ${m === 0 ? 'keiner' : m} davon näher als der Mond` : ''}.`,
  caPast: (n, m) => `In der letzten Woche: ${n === 0 ? 'kein Vorbeiflug' : plural(n, 'Vorbeiflug', 'Vorbeiflüge')}`
    + `${n ? `, ${m === 0 ? 'keiner' : m} davon näher als der Mond` : ''}.`,
  caClosest: (name, dist) => `Am nächsten: ${name}, ${dist}.`,
  caColObject: 'Objekt',
  caColWhen: 'Zeitpunkt',
  caColDistance: 'Abstand zur Erde',
  caColSpeed: 'Geschwindigkeit',
  lunar: (x) => `${x} Monddistanzen`,
  caCloserThanMoon: 'näher als der Mond',
  caUncertain: (a, b) => `unsicher: zwischen ${a} und ${b}`,
  caEstimate: 'geschätzt aus der Helligkeit',
  kmPerS: 'km/s',
  caShowPast: (n) => `Letzte Woche zeigen (${n})`,
  caHidePast: 'Letzte Woche ausblenden',
  caShowAll: (n) => `Alle zeigen (${n})`,
  caShowFewer: 'Weniger zeigen',
  caNote: 'Abstand vom Erdmittelpunkt. Eine Monddistanz ist der Abstand des Mondes, 384.400 km. '
    + 'Größen mit ≈ sind aus der Helligkeit geschätzt: Die meisten dieser Asteroiden sind klein, und niemand hat sie vermessen. '
    + '± ist die Unsicherheit des Zeitpunkts (3σ). Zeiten in deiner Ortszeit. '
    + 'Viele kleine Asteroiden werden erst wenige Tage vor oder nach ihrem Vorbeiflug entdeckt. Deshalb wächst die Liste jeden Tag, '
    + 'und oft sind in der letzten Woche mehr vorbeigeflogen, als für die nächsten zwei Monate bekannt sind.',
  caOnMap: 'Auf der Karte: anklicken zum Anzeigen',
  caUpdated: (d) => `Zuletzt aktualisiert: ${d}`,
  caStale: (d) => `Achtung: Diese Daten sind vom ${d}, neuere konnten wir nicht holen.`,
  caNone: 'Hier gibt es keine Live-Daten. Auf der veröffentlichten Seite kommen sie alle 3 Stunden neu vom JPL.',
  caLoading: 'Wird geladen …',
  comma: ', ',
  relTime: (h) => {
    const minutes = h * 60;
    const x = Math.abs(minutes) < 60 ? 'weniger als 1 Stunde' : deDuration(minutes, true);
    return h >= 0 ? `in ${x}` : `vor ${x}`;
  },
  duration: (minutes) => deDuration(minutes, false),
  swTitle: 'Weltraumwetter',
  swIntro: 'Was zwischen Sonne und Erde passiert: geomagnetische Stürme, Sonneneruptionen und Wolken von der Sonne, die auf uns zukommen. '
    + 'In Echtzeit, nicht in der Zeit der Simulation.',
  swScale: { r: 'Funkausfälle', s: 'Strahlungssturm', g: 'Geomagnetischer Sturm' },
  swActiveItem: (k, n) => `${{ r: 'Funkausfälle', s: 'Strahlungssturm', g: 'geomagnetischer Sturm' }[k]} der Stufe ${k.toUpperCase()}${n} (${DE.swLevels[n]})`,
  swScaleWhat: {
    r: 'Durch Sonneneruptionen: stört den Funk auf der Tagseite der Erde.',
    s: 'Schnelle Teilchen von der Sonne: betreffen Satelliten und Raumfahrer.',
    g: 'Durch Sonnenwind und Sonnenwolken: macht Polarlichter, und wenn er stark ist, stört er Stromnetze und Satellitennavigation.',
  },
  swLevels: ['ruhig', 'schwach', 'mäßig', 'stark', 'schwer', 'extrem'],
  swCalm: 'Gerade ist es ruhig: keine Stürme.',
  swNowActive: (items) => `Gerade: ${items}.`,
  swPast24: (x) => `Höchstwert der letzten 24 Stunden: ${x}`,
  swForecast: 'Vorhersage der nächsten Tage',
  swFcG: 'Erwarteter geomagnetischer Sturm',
  swFcRMinor: 'Wahrscheinlichkeit schwacher oder mäßiger Funkausfälle (R1–R2)',
  swFcRMajor: 'Wahrscheinlichkeit starker Funkausfälle (R3+)',
  swFcS: 'Wahrscheinlichkeit eines Strahlungssturms (S1+)',
  swKpTitle: 'Kp-Index alle 3 Stunden',
  swKpWhat: 'Misst, wie stark das Erdmagnetfeld gestört ist, von 0 (ruhig) bis 9. Ab 5 ist es ein geomagnetischer Sturm, '
    + 'und je höher, desto weiter vom Pol entfernt sind Polarlichter zu sehen.',
  swKpQuiet: 'unter 5: kein Sturm',
  swKpStorm: 'schwacher oder mäßiger Sturm (G1–G2)',
  swKpStrong: 'starker Sturm oder mehr (G3+)',
  swKpKind: { observed: 'gemessen', estimated: 'vorläufig', predicted: 'Vorhersage' },
  swKpLatest: (v, level) => `Letzter Wert: ${v} (${level})`,
  swKpMaxAhead: (v, when) => `Höchste Vorhersage: ${v}, ${when}`,
  swKpTable: 'Die Werte als Tabelle',
  swTime: 'Zeit',
  swFlaresTitle: 'Sonneneruptionen der letzten 7 Tage',
  swFlareCount: (n, m, x) => `${n === 0 ? 'Keine Eruption' : plural(n, 'Eruption', 'Eruptionen')}${n ? `, davon ${m} der Klasse M und ${x} der Klasse X` : ''}.`,
  swFlareStrongest: 'Die stärksten:',
  swFlareWhat: 'Die Klasse (A, B, C, M, X) misst die Röntgenstrahlung, jede Klasse ist 10-mal stärker als die vorige. '
    + 'Eruptionen der Klassen M und X können den Funk auf der Tagseite der Erde stören.',
  swCmeTitle: 'Wolken von der Sonne auf dem Weg zur Erde',
  swCmeNone: 'Nach den letzten Rechnungen der NASA trifft keine Wolke die Erde.',
  swCmeArrival: (when) => `Ankunft erwartet ${when} (± 7 Stunden)`,
  swCmeArrived: (when) => `Ankunft war erwartet ${when}`,
  swCmeGlancing: 'streift die Erde nur',
  swCmeMinor: 'nur schwache Wirkung',
  swCmeKp: (a, b) => `Kp möglich zwischen ${a} und ${b}`,
  swCmeSpeed: (v) => `Geschwindigkeit nahe der Sonne ${v} km/s`,
  swCmeNote: 'Eine solche Wolke (koronaler Massenauswurf, CME) ist Gas aus geladenen Teilchen, das die Sonne ausstößt; sie erreicht die Erde nach 1 bis 5 Tagen. '
    + 'Diese Vorhersagen sind experimentell, aus dem Forschungsmodell WSA-Enlil der NASA; die offizielle Vorhersage ist die der NOAA oben.',
  swParts: { scales: 'Sturmstufen', kp: 'Kp-Index', flares: 'Eruptionen', cmes: 'Wolken-Vorhersage' },
  swMissing: (part) => `Gerade keine Daten: ${part}.`,
  swStale: (part, d) => `Achtung: ${part} vom ${d}, neuere konnten wir nicht holen.`,
  swNone: 'Hier gibt es keine Weltraumwetter-Daten. Auf der veröffentlichten Seite kommen sie alle 3 Stunden neu.',
  dsnTitle: 'Deep Space Network jetzt',
  dsnIntro: 'Welche Raumfahrzeuge gerade mit den großen NASA-Antennen an drei Standorten rund um die Erde sprechen. '
    + 'Die Standorte liegen etwa ein Drittel Erdumdrehung auseinander, so sieht immer einer jede ferne Sonde.',
  dsnStations: { gdscc: 'Goldstone, Kalifornien', mdscc: 'Madrid, Spanien', cdscc: 'Canberra, Australien' },
  dsnLocalTime: (c) => `Ortszeit ${c}`,
  dsnSummary: (n, d) => (n === 0 ? 'Gerade steht kein Raumfahrzeug in Kontakt.'
    : `Gerade ${n === 1 ? 'steht 1 Raumfahrzeug' : `stehen ${n} Raumfahrzeuge`} über ${plural(d, 'Antenne', 'Antennen')} in Kontakt.`),
  dsnFarthest: (name, dist, light) => `Am weitesten entfernt: ${name}, ${dist}. Das Signal braucht ${light} bis zu uns.`,
  dsnLight: (sec) => {
    if (sec >= 59.95) return DE.light(sec / 60);
    if (sec < 9.95) return `${num(sec, 1, 'de')} Sekunden`;
    return plural(Math.round(sec), 'Sekunde', 'Sekunden');
  },
  dsnSignalTime: (x) => `Signal braucht ${x}`,
  dsnSize: (m) => `${m} m`,
  dsnElevation: (d) => `${d} über dem Horizont`,
  dsnActivity: {
    link: 'Verbindung zu Raumfahrzeugen',
    maint: 'Wartung und Umbau',
    vlbi: 'Radiomessung mit fernen Stationen (VLBI)',
    radar: 'Radar für Planeten und Asteroiden',
    astro: 'Radioastronomie',
    calib: 'Kalibrierung',
    test: 'Test',
  },
  dsnDown: 'Empfang von der Sonde',
  dsnUp: 'Senden zur Sonde',
  dsnNoSignal: () => 'Antenne ausgerichtet, gerade ohne Signal',
  dsnMspa: 'mehrere Sonden über eine Antenne',
  dsnRate: ['bit/s', 'kbit/s', 'Mbit/s'],
  billionKm: 'Mrd. km',
  dsnWhere: {
    interstellar: 'im interstellaren Raum',
    kuiper: 'im Kuipergürtel, jenseits von Neptun',
    jupiter: 'umkreist Jupiter',
    toJupiter: 'unterwegs zum Jupiter',
    toTrojans: 'unterwegs zu den Jupiter-Trojanern',
    toPsyche: 'unterwegs zum Asteroiden Psyche',
    toApophis: 'unterwegs zum Asteroiden Apophis',
    toAsteroid: 'unterwegs zu einem kleinen Asteroiden',
    mars: 'umkreist den Mars',
    marsSurface: 'auf dem Mars',
    toMars: 'unterwegs zum Mars',
    moon: 'umkreist den Mond',
    l1: 'zwischen Erde und Sonne, 1,5 Mio. km von der Erde',
    l2: 'hinter der Erde, auf der Nachtseite, 1,5 Mio. km entfernt',
    sun: 'umkreist die Sonne',
    earth: 'umkreist die Erde',
  },
  dsnNote: '↓ heißt: Die Antenne empfängt Daten von der Sonde (mit Datenrate), ↑: Sie sendet ihr Befehle. '
    + 'Die großen Schüsseln haben 70 m Durchmesser, die anderen 34 m. Entfernung und Signallaufzeit kommen von der NASA. '
    + 'Manchmal hört eine Antenne mehrere Sonden gleichzeitig, etwa die am Mars.',
  dsnUpdated: (c, ago) => `NASA-Daten von ${c} Uhr (${ago}), jede Minute neu`,
  dsnAgo: (sec) => (sec < 60 ? 'vor weniger als 1 Minute' : `vor ${deDuration(sec / 60, true)}`),
  dsnOld: (ago) => `Hinweis: Die neuesten Daten der NASA kamen ${ago}. Vielleicht gibt es dort ein Problem.`,
  dsnOff: 'Die Live-Verbindung zum Deep Space Network ist noch nicht eingerichtet. Bald gibt es sie hier.',
  dsnNone: 'Gerade kommen keine Daten von der NASA. Wir versuchen es in einer Minute wieder.',
  dsnLocal: 'Hier gibt es keine Live-Daten. Auf der veröffentlichten Seite kommen sie jede Minute neu von der NASA.',
  nowTitle: 'Jetzt im All',
  nowIntro: 'Was gerade im All passiert, von NASA und NOAA, und was bald am Himmel geschieht. Wähle eine Kachel für die Details.',
  nowTabs: { dsn: 'Deep Space Network', weather: 'Weltraumwetter', approaches: 'Nahe Vorbeiflüge', events: 'Himmelsereignisse' },
  nowUpdated: (ago) => `Aktualisiert ${ago}`,
  nowNoData: 'Gerade keine Daten',
  nowDsn: (n) => (n === 0 ? 'Kein Raumfahrzeug in Kontakt' : `${plural(n, 'Raumfahrzeug', 'Raumfahrzeuge')} in Kontakt`),
  nowFarthest: (name) => `Am weitesten: ${name}`,
  nowWeatherCalm: 'Gerade ruhig',
  nowWeatherAhead: (level, day) => `Nächste Tage: bis ${level}, ${day}`,
  nowWeatherAheadCalm: 'Auch die nächsten Tage ruhig',
  nowCme: (when) => `Wolke von der Sonne erwartet: ${when}`,
  nowApproaches: (n, until) => (n === 0 ? `Kein Vorbeiflug bis ${until}` : `${plural(n, 'Vorbeiflug', 'Vorbeiflüge')} bis ${until}`),
  events: {
    title: 'Ereignisse am Himmel',
    badge: 'im Browser berechnet',
    intro: 'Was in den nächsten Tagen am Himmel passiert: Mondphasen, Finsternisse, Planeten vor oder hinter der Sonne, '
      + 'und wenn sich der Mond oder zwei Planeten am Himmel nahe kommen. Alles hier in deinem Browser berechnet, in Echtzeit, nicht in der Zeit der Simulation.',
    daysLabel: 'Wie weit voraus',
    days7: 'Nächste 7 Tage',
    days30: 'Nächste 30 Tage',
    summary: (n, d) => `In den nächsten ${d} Tagen: ${n === 0 ? 'keine großen Ereignisse' : plural(n, 'Ereignis', 'Ereignisse')}.`,
    tileMain: (n) => (n === 0 ? 'Keine großen Ereignisse in 30 Tagen' : `${plural(n, 'Ereignis', 'Ereignisse')} in 30 Tagen`),
    next: (what, when) => `Als Nächstes: ${what}, ${when}`,
    jump: 'Zu diesem Zeitpunkt',
    jumpTitle: 'Hält die Zeit an und springt in der Ansicht zu diesem Moment',
    jumpPick: (p) => `Hält die Zeit an, springt in der Ansicht zu diesem Moment und wählt ${p}`,
    about: (x) => `etwa ${x}`,
    note: (tz) => `Zeiten in deiner Zeitzone (${tz}). Alles vom Erdmittelpunkt aus: Je nach Ort kann der Mond bis zu etwa 1° woanders stehen. `
      + 'Helligkeit in Größenklassen: je kleiner die Zahl, desto heller (Venus etwa −4). '
      + 'Die Zeiten liegen wenige Minuten neben den Tabellen von NAOJ, USNO und NASA. Asteroiden von CNEOS (Karte der Vorbeiflüge). Berechnet mit',
    moonName: 'Mond',
    moon: { new: 'Neumond', firstQuarter: 'Erstes Viertel', full: 'Vollmond', lastQuarter: 'Letztes Viertel' },
    moonNotes: {
      new: 'Der Mond steht zwischen Erde und Sonne und ist nicht zu sehen. Zwei Tage später zeigt sich abends eine schmale Sichel.',
      firstQuarter: 'Zunehmender Halbmond: am Nachmittag und am Abend zu sehen.',
      full: 'Der ganze Mond ist beleuchtet: Er geht bei Sonnenuntergang auf und ist die ganze Nacht zu sehen.',
      lastQuarter: 'Abnehmender Halbmond: in der zweiten Nachthälfte und am Morgen zu sehen.',
    },
    conjunction: {
      superior: (p) => `${p} hinter der Sonne`,
      inferior: (p) => `${p} zwischen Erde und Sonne`,
      plain: (p) => `${p} hinter der Sonne`,
    },
    conjunctionNotes: {
      superior: 'Obere Konjunktion: in diesen Tagen im Sonnenlicht verloren, danach wieder am Abendhimmel.',
      inferior: 'Untere Konjunktion: in diesen Tagen im Sonnenlicht verloren, danach am Morgenhimmel.',
      plain: 'Konjunktion: in diesen Tagen im Sonnenlicht verloren, danach wieder am Morgenhimmel.',
    },
    opposition: (p) => `${p} in Opposition`,
    oppositionNote: 'Die Erde steht zwischen Sonne und Planet. Beste Zeit zum Beobachten: Er geht bei Sonnenuntergang auf, ist die ganze Nacht zu sehen und so nah und hell wie sonst kaum.',
    brightDistance: (m, d) => `Helligkeit\u00a0${m}, Entfernung ${d}.`,
    optics: 'Dafür braucht man ein Fernglas.',
    elongation: (p, sky) => `${p} am weitesten von der Sonne (${sky === 'evening' ? 'Abendhimmel' : 'Morgenhimmel'})`,
    elongationNote: (d, sky) => `Größte Elongation: ${d} von der Sonne. Am besten ${sky === 'evening' ? 'nach Sonnenuntergang tief im Westen' : 'vor Sonnenaufgang tief im Osten'}.`,
    brightness: (m) => `Helligkeit\u00a0${m}.`,
    solar: { total: 'Totale Sonnenfinsternis', annular: 'Ringförmige Sonnenfinsternis', partial: 'Partielle Sonnenfinsternis' },
    solarWhere: (where) => `Nur in einem schmalen Streifen auf der Erde zu sehen; zum Höhepunkt liegt die Schattenmitte bei ${where}. Ringsum partiell.`,
    solarPartial: 'Nur von einem Teil der Erde aus als partielle Finsternis zu sehen.',
    solarSafety: 'Nie ohne Finsternisbrille in die Sonne schauen.',
    lunar: { total: 'Totale Mondfinsternis', partial: 'Partielle Mondfinsternis', penumbral: 'Halbschatten-Mondfinsternis' },
    lunarNotes: {
      total: (d) => `Der ganze Mond ist ${d} lang im Erdschatten und färbt sich rot. Überall zu sehen, wo dann Nacht ist.`,
      partial: (d) => `Ein Teil des Mondes ist ${d} lang im Erdschatten. Überall zu sehen, wo dann Nacht ist.`,
      penumbral: (d) => `Der Mond zieht ${d} lang durch den Halbschatten der Erde: Er wird nur etwas dunkler, kaum zu bemerken.`,
    },
    seasons: { marchEquinox: 'Tagundnachtgleiche im März', juneSolstice: 'Sonnenwende im Juni', septemberEquinox: 'Tagundnachtgleiche im September', decemberSolstice: 'Sonnenwende im Dezember' },
    seasonNotes: {
      marchEquinox: 'Tag und Nacht sind überall fast gleich lang: Frühlingsanfang auf der Nordhalbkugel, Herbstanfang auf der Südhalbkugel.',
      juneSolstice: 'Längster Tag auf der Nordhalbkugel, kürzester auf der Südhalbkugel: Sommeranfang im Norden.',
      septemberEquinox: 'Tag und Nacht sind überall fast gleich lang: Herbstanfang auf der Nordhalbkugel, Frühlingsanfang auf der Südhalbkugel.',
      decemberSolstice: 'Kürzester Tag auf der Nordhalbkugel, längster auf der Südhalbkugel: Winteranfang im Norden.',
    },
    perihelion: 'Erde am sonnennächsten Punkt (Perihel)',
    aphelion: 'Erde am sonnenfernsten Punkt (Aphel)',
    perihelionNote: (d) => `Entfernung ${d}. Mit den Jahreszeiten hat das nichts zu tun: Im Norden ist dann Winter. Sie kommen von der Neigung der Erdachse.`,
    aphelionNote: (d) => `Entfernung ${d}, und trotzdem ist im Norden Sommer: Die Jahreszeiten kommen von der Neigung der Erdachse, nicht vom Abstand.`,
    pair: (a, b) => `${a} bei ${b}`,
    pairNote: (d) => `${d} Abstand am Himmel (der Mond ist ein halbes Grad breit).`,
    glare: 'Aber nah an der Sonne, also schwer zu sehen.',
    neo: (name) => `${name} fliegt an der Erde vorbei`,
    neoNote: (d) => `Abstand ${d}.`,
    neoCloser: 'Näher als der Mond!',
    neoClosest: 'Der nächste in den kommenden 30 Tagen.',
    north: 'N', south: 'S', east: 'O', west: 'W',
  },
  video: {
    weekTitle: 'Der Himmel diese Woche',
    daysTitle: 'Der Himmel in diesen Tagen',
    weekCount: (n) => (n === 0 ? 'keine großen Ereignisse' : plural(n, 'Ereignis', 'Ereignisse')),
    eventNo: (i, n) => `Ereignis ${i} von ${n}`,
    outroLine: 'Den Himmel an jedem Tag und die Planeten in 3D, kostenlos in deinem Browser:',
    sources: 'Berechnet mit Astronomy Engine · Asteroiden: CNEOS (NASA/JPL)',
    when: (x, zone) => `${x} (${zone})`,
    speed: (d) => `1 Sekunde im Video = ${d}`,
    sunName: 'Sonne',
    ecliptic: 'Ekliptik',
    earthShadow: 'Erdschatten',
    fromPlace: (where) => `so wie von ${where} aus gesehen`,
    fromCentre: 'vom Erdmittelpunkt aus',
    lunarDistance: 'Mondabstand',
    scaleNote: 'Abstände maßstabsgetreu, Größen vergrößert.',
  },
  branch: {
    title: 'Wirklichkeit verzweigen',
    badge: 'Experimentell',
    intro: 'Nimm eine Kopie des Sonnensystems ab dem Moment auf dem Bildschirm, ändere etwas und sieh, wie die Planeten danach laufen. Die Physik-Engine rechnet die Schwerkraft zwischen Sonne und Planeten selbst, mit allgemeiner Relativitätstheorie.',
    action: 'Was ändern',
    actions: { remove: 'Planet entfernen', mass: 'Masse ändern', push: 'Planet anschubsen', star: 'Stern vorbeiziehen lassen' },
    body: 'Wer',
    sun: 'Sonne',
    factor: 'Masse ×',
    speed: 'Geschwindigkeit ändern (km/s)',
    pushHint: 'positiv: schneller, negativ: langsamer',
    starMass: 'Masse des Sterns (Sonnenmassen)',
    starDistance: 'Kleinster Abstand (AE)',
    starNote: 'zieht in 10 Jahren mit 20 km/s vorbei, in der Ebene der Erdbahn',
    go: 'Verzweigen',
    reset: 'Zurück zur Wirklichkeit',
    what: {
      remove: (n) => `Zweig: ohne ${n}`,
      mass: (n, f) => `Zweig: Masse ${n === 'Sonne' ? 'der Sonne' : `von ${n}`} ×${f}`,
      push: (n, v, faster) => `Zweig: ${n} ${v} km/s ${faster ? 'schneller' : 'langsamer'}`,
      star: (m, d) => `Zweig: ein Stern mit ${m}-facher Sonnenmasse zieht in ${d} Abstand vorbei`,
    },
    from: (d) => `ab ${d}`,
    computing: (y) => `rechnet… bei ${y}`,
    before: (d) => `Diese Zeit liegt vor der Verzweigung (${d}), hier gibt es den Zweig nicht`,
    legend: 'Voller Punkt: Wirklichkeit · leerer Kreis: Zweig, mit einer Linie zur echten Position',
    error: (m) => `Hat nicht geklappt: ${m}`,
    tooFar: 'Verzweigen geht nur zwischen 1800 und 2050',
    starLate: (y) => `Der Stern muss vor 2050 vorbeiziehen: bis ${y} verzweigen`,
    jump: 'Zum Beginn des Zweigs',
    compare: {
      title: 'Vergleich mit der Wirklichkeit, im selben Moment',
      note: 'Die Wirklichkeit ist hier dieselbe Rechnung ohne die Änderung, jeder Unterschied kommt also von ihr. Jahr: wie lange der Planet auf seiner jetzigen Bahn für einen Umlauf um die Sonne braucht.',
      body: 'Körper', year: 'Jahr', distance: 'Abstand zur Sonne', offset: 'Abstand zur wirklichen Position',
      removed: 'entfernt', escapes: 'entkommt, kein Umlauf mehr', star: 'Stern',
      real: (v) => `wirklich: ${v}`, days: (n) => `${n} Tage`, years: (n) => `${n} Jahre`,
    },
    scenarios: {
      title: 'Fertige Szenarien',
      own: 'Oder selbst etwas ändern:',
      preparing: 'Bereite den Zweig vor…',
      buttons: { jupiter: 'Was, wenn Jupiter verschwindet?', sun: 'Was, wenn die Sonne doppelt so schwer wäre?', star: 'Ein Stern zieht in 1.000 AE vorbei' },
      nearer: 'Stern auf 50 AE heranholen',
      farther: 'Stern zurück auf 1.000 AE',
      list: {
        jupiter: {
          how: 'Wir entfernen Jupiter am 1. Januar 1900 und lassen die Zeit mit einem Jahr pro Sekunde bis 2050 laufen.',
          result: (f) => `Ergebnis: Kein Planet fliegt davon oder stürzt in die Sonne, denn die Sonne hält die Planeten, nicht Jupiter. Aber die Bahnen verschieben sich langsam: Bis zum Jahr 2000 ist Saturn etwa ${f.saturn} Mio. km von seiner wirklichen Position entfernt, die Erde etwa ${f.earth} km.`,
        },
        sun: {
          how: 'Wir verdoppeln die Masse der Sonne plötzlich am 15. November 2026; die Planeten behalten ihre Geschwindigkeit. Die Zeit läuft mit einem Monat pro Sekunde.',
          result: (f) => `Ergebnis: Sofort laufen alle Planeten schneller, auf kleineren, gestreckten Bahnen: Ein Erdjahr dauert ${f.earthYear} Tage statt 365, die Erde kommt der Sonne bis auf ${f.earthClosest} AE nahe, und ein Jupiterjahr dauert ${f.jupiterYear} Jahre statt 11,9.`,
        },
        star: {
          how: 'Ein Stern mit der Masse der Sonne zieht 2036 in 1.000 AE Abstand vorbei (33-mal so weit wie Neptun), mit 20 km/s. Die Zeit läuft mit einem Jahr pro Sekunde bis 2050.',
          result: (f) => `Ergebnis: Mit bloßem Auge sieht man nichts, der Stern bleibt ein Pfeil am Rand. Die Tabelle zeigt, warum: Ende 2050 ist Neptun nur etwa ${f.neptune} km von seiner wirklichen Position entfernt, die Erde weniger als ${f.earth} km. Selbst ein Stern wie die Sonne berührt die Planeten aus dieser Entfernung kaum.`,
        },
        star50: {
          how: 'Derselbe Stern, aber in 50 AE Abstand, nicht weit hinter Neptun (30 AE).',
          result: (f) => `Ergebnis: Jetzt ist der Unterschied groß: Ende 2050 dauert ein Neptunjahr etwa ${f.neptuneYear} Jahre statt 165, ein Uranusjahr etwa ${f.uranusYear} statt 84, und Neptun ist etwa ${f.neptune} Mio. km von seiner wirklichen Position entfernt; das sieht man auf der Karte. Die Erde merkt nur wenig davon: etwa ${f.earth} km.`,
        },
      },
    },
  },
  trip: {
    title: 'Reiseplaner',
    badge: 'Experimentell',
    intro: 'Wie lange dauert ein Flug von der Erde zu einem anderen Planeten, einem Asteroiden oder Kometen, um wie viel muss die Sonde ihre Geschwindigkeit ändern (Δv, davon hängt der Treibstoff ab), und wann startet man am besten? '
      + 'Für die Planeten ist die erste Antwort der Hohmann-Transfer: der sparsamste Weg zwischen zwei Bahnen, eine halbe Ellipse um die Sonne, die die Erdbahn und die Bahn des Planeten gerade berührt, mit zwei Schüben, einem zum Start und einem zur Ankunft. '
      + 'Der Termin wird ab der Zeit auf dem Bildschirm gesucht.',
    to: 'Ziel',
    duration: 'Flugdauer',
    leave: 'Schub beim Start',
    arrive: 'Schub bei der Ankunft',
    total: 'Zusammen (Δv)',
    tripDays: (d) => `${d} Tage`,
    aboutMonths: (m) => `etwa ${m} Monate`,
    tripYears: (y) => `${y} Jahre`,
    kmS: (v) => `${v} km/s`,
    c3: (v) => `C3 = ${v} km²/s²`,
    leaveNote: (km, c3) => `aus einer Umlaufbahn ${km} km über der Erde · Startenergie ${c3}`,
    arriveNote: (km, _name, v) => `in eine Umlaufbahn ${km} km über dem Planeten · Geschwindigkeit relativ zum Planeten bei der Ankunft: ${v}`,
    whenTitle: 'Wann starten?',
    phase: (id, need, ahead, now, nowAhead) => `Beim Start muss ${DE.planets[id]} ${need} ${ahead ? 'vor' : 'hinter'} der Erde stehen (von der Sonne aus gesehen). `
      + `Zur Zeit auf dem Bildschirm: ${now} ${nowAhead ? 'davor' : 'dahinter'}.`,
    window: (d, rel, a) => `Startfenster: Start am ${d} (${rel}), Ankunft am ${a}.`,
    prev: (d, rel) => `Das vorige war am ${d} (${rel}).`,
    every: (days, m) => `Danach etwa alle ${days} Tage (rund ${plural(m, 'Monat', 'Monate')}): die synodische Periode, nach der Planet und Erde wieder gleich stehen.`,
    rel: (d) => {
      if (Math.abs(d) < 1) return 'heute';
      const x = Math.abs(d) < 60 ? plural(Math.round(Math.abs(d)), 'Tag', 'Tagen') : plural(Math.round(Math.abs(d) / 30.44), 'Monat', 'Monaten');
      return d > 0 ? `in ${x}` : `vor ${x}`;
    },
    jump: 'Zum Starttermin',
    outside: 'Dieser Termin liegt nach 2050, so weit reicht die Zeitleiste nicht.',
    note: 'Eine Näherung: Hohmann nimmt beide Bahnen als Kreise in einer Ebene. Die echten Bahnen sind etwas gestreckt und geneigt, darum weichen der echte Termin und die Zahlen etwas ab. Die echten Zahlen gibt die genaue Rechnung unten.',
    giants: 'Zu den äußeren Planeten fliegen echte Sonden an anderen Planeten vorbei und holen sich dort Schwung, wie Voyager 2, die in 12 Jahren bei Neptun war, und sie schwenken in eine gestreckte statt in eine niedrige Umlaufbahn ein. So sind sie schneller und brauchen viel weniger Treibstoff.',
    exactTitle: 'Genau gerechnet, für Tage deiner Wahl',
    exactIntro: 'Hier wird mit den echten Bahnen gerechnet (gestreckt und geneigt): Du wählst den Start- und den Ankunftstag, und wir suchen die Bahn um die Sonne, die die Erde am ersten Tag mit dem Ziel am zweiten verbindet (das Lambert-Problem).',
    departDate: 'Start',
    arriveDate: 'Ankunft',
    way: (deg, type, revs, by) => (revs
      ? `Die Bahn läuft ${revs === 1 ? 'einmal' : `${revs}-mal`} ganz um die Sonne und dann noch ${deg}, weil das ${by === 'c3' ? 'beim Start' : 'für beide Schübe zusammen'} sparsamer ist als der direkte Weg. `
      : `Die Bahn führt ${deg} um die Sonne: `)
      + `${type === 1 ? 'Typ I (weniger als eine halbe Runde)' : 'Typ II (mehr als eine halbe Runde)'}${revs ? ' in der letzten Runde' : ''}.`,
    badDates: 'Die Ankunft muss nach dem Start liegen.',
    noTrip: 'Für diese beiden Tage gibt es keine eindeutige Bahn (Erde und Ziel stehen sich genau gegenüber). Versuch einen anderen Tag.',
    mapTitle: 'Karte der Starttermine',
    mapIntro: 'Jeder Punkt der Karte ist ein genau gerechneter Flug: der Starttag auf der waagrechten Achse, die Flugdauer auf der senkrechten, und die Farbe zeigt, was er kostet. Je heller, desto billiger. Tippe auf einen Punkt, um seine Rechnung unten zu sehen. Die gestrichelte Linie trennt Typ I (unten) von Typ II (oben).',
    mapIntroSmall: 'Jeder Punkt der Karte ist ein genau gerechneter Flug: der Starttag auf der waagrechten Achse, die Flugdauer auf der senkrechten, und die Farbe zeigt, was er kostet. Je heller, desto billiger. Tippe auf einen Punkt, um seine Rechnung unten zu sehen. '
      + 'Bei langen Flügen kann die Bahn ein- oder mehrmals um die Sonne laufen, bevor sie ankommt, deshalb sieht die Karte wie ein Mosaik aus: Jedes Stück hat eine andere Zahl von Runden.',
    colorBy: 'Farbe nach',
    measures: { c3: 'Startenergie (C3)', dv: 'Zusammen (Δv)' },
    units: { c3: 'km²/s²', dv: 'km/s' },
    axisDepart: 'Starttag',
    axisDays: 'Flugdauer (Tage)',
    axisYears: 'Flugdauer (Jahre)',
    computing: 'Die Karte wird berechnet …',
    cheaper: 'billiger',
    dearer: 'teurer',
    marks: 'I und II: der billigste Flug jedes Typs · H: Hohmann-Schätzung · weißer Kreis: der Flug, der unten gerechnet ist. Mit der Tastatur bewegen die Pfeiltasten den Kreis.',
    best: (type, d, a, dur, v) => `Billigster Flug vom Typ ${type === 1 ? 'I' : 'II'}: Start am ${d}, Ankunft am ${a} (${dur}), ${v}.`,
    pick: 'Auswählen',
    typeName: (type) => (type === 1 ? 'Typ I' : 'Typ II'),
    turns: (n) => (n === 1 ? 'nach einer ganzen Runde' : `nach ${n} ganzen Runden`),
    nearHalf: 'Dieser Flug geht fast genau eine halbe Runde: Die Ebene der Bahn ist kaum bestimmt, und die Zahlen ändern sich von Tag zu Tag stark. Echte Missionen meiden diese Linie.',
    edge: '(am Rand der Karte, außerhalb gibt es vielleicht einen billigeren Flug)',
    playTrip: 'Flug in der Ansicht abspielen',
    showPath: 'Bahn in der Ansicht zeigen',
    craft: 'Sonde',
    playNote: 'Der Knopf stellt die Zeit auf den Starttag und lässt sie laufen: Du siehst die Sonde auf ihrer Bahn, bis sie ihr Ziel erreicht. Durchgezogen: der zurückgelegte Weg, gestrichelt: der Rest.',
    mapAria: 'Karte der Starttermine: Starttag und Flugdauer, gefärbt nach den Kosten',
    sigTitle: 'Signallaufzeit',
    sigIntro: 'Erde und Sonde sprechen per Funk, und das Signal ist mit Lichtgeschwindigkeit unterwegs: 299.792 km pro Sekunde. Je weiter die Sonde weg ist, desto länger braucht eine Nachricht, '
      + 'und niemand kann sie direkt steuern: Sie muss mit den Befehlen auskommen, die sie vorher bekommen hat. Die Grafik zeigt für jeden Tag der Reise, wie lange das Signal in eine Richtung braucht (Frage und Antwort: doppelt so lange). '
      + 'Helle Bereiche: Die Sonde steht am Himmel der Erde nah an der Sonne (weniger als 2°), deren heißes Gas das Signal stört; NASAs Mars-Missionen senden an diesen Tagen keine Befehle.',
    seconds: (n) => plural(n, 'Sekunde', 'Sekunden'),
    sigArrive: (one, both) => `Bei der Ankunft braucht das Signal ${one}, Frage und Antwort also ${both}.`,
    sigMax: (d, date, day) => `Längste Laufzeit: ${d}, am ${date} (Tag ${day} der Reise).`,
    sigMaxAtEnd: 'Das ist auch die längste der ganzen Reise.',
    sigNow: (day, d) => `Zur Zeit auf dem Bildschirm (Tag ${day} der Reise): ${d}.`,
    sigConj: (n, list) => `Die Sonde kommt der Sonne am Himmel der Erde ${n === 1 ? 'einmal' : `${n}-mal`} näher als 2°: ${list}. `
      + 'An diesen Tagen senden echte Missionen keine Befehle.',
    sigConjMany: (n, m, first, last) => `Die Sonde kommt der Sonne am Himmel der Erde ${n}-mal näher als 2°, etwa alle ${plural(m, 'Monat', 'Monate')}: `
      + `zuerst ${first}, zuletzt ${last}. An diesen Tagen senden echte Missionen keine Befehle.`,
    sigNoConj: 'Die Sonde kommt der Sonne am Himmel der Erde auf der ganzen Reise nie näher als 2°, das Signal bleibt sauber.',
    sigJoin: '; ',
    sigAxisDays: 'Tage seit dem Start',
    sigAxisYears: 'Jahre seit dem Start',
    sigUnitMin: 'Signal (Minuten)',
    sigUnitHours: 'Signal (Stunden)',
    sigSun: 'nah an der Sonne',
    sigDay: (d) => `Tag ${d} der Reise`,
    sigTable: 'Die Zahlen als Tabelle',
    sigCols: { date: 'Datum', day: 'Reisetag', distance: 'Abstand zur Erde', delay: 'Signal (eine Richtung)', sun: 'Abstand zur Sonne am Himmel' },
    sigAria: 'Signallaufzeit zwischen Erde und Sonde entlang der Reise',
    craftDelay: (name, d) => `${name} · ${d}`,
    targetGroups: { planets: 'Planeten', main: 'Asteroidengürtel', neo: 'Erdnahe Asteroiden', trojan: 'Jupiter-Trojaner', far: 'Jenseits von Neptun', comet: 'Kometen' },
    sbNoHohmann: (y, a, b) => 'Für Asteroiden und Kometen gibt es keine Hohmann-Schätzung: Ihre Bahnen sind zu gestreckt und geneigt, um sie als Kreise zu nehmen. '
      + `Stattdessen rechnet die Karte unten jeden Flug genau, für Starttage über ${y} Jahre ab der Zeit auf dem Bildschirm und Flugdauern von ${a} bis ${b} Tagen (wie das Werkzeug der NASA zur Missionsplanung für kleine Körper), für ferne Körper länger.`,
    sbKnown: (name, from, to) => `Wo ${name} ist, weiß die Seite (auf ein Grad genau wie die Rechnung der NASA) nur von ${from} bis ${to}, also muss der Flug in diesen Jahren ankommen.`,
    sbRetro: (name) => `${name} läuft andersherum um die Sonne. Nahe der Sonne, wo er schnell ist, trifft ihn jede Sonde frontal und sehr schnell: Die europäische Sonde Giotto flog 1986 mit 68\u00a0km/s am Halleyschen Kometen vorbei. Weit draußen ist er langsam, dort macht das viel weniger aus.`,
    sbFar: 'Echte Sonden zu fernen Körpern holen sich unterwegs Schwung bei Jupiter: New Horizons startete 2006 und erreichte Pluto 2015, in weniger als 10 Jahren. Dieser Planer rechnet solche Vorbeiflüge nicht, seine Zahlen gelten nur für den direkten Weg.',
    sbNoRange: 'Ab der Zeit auf dem Bildschirm kann kein Flug in diesen Jahren ankommen.',
    sbJump: (year) => `Zu ${year} springen`,
    sbNoTrips: (name) => `Auf dieser Karte gibt es keinen Flug zu ${name}.`,
    sbOutsideDates: (name, from, to) => `Wo ${name} ist, weiß die Seite nur vom ${from} bis zum ${to}: Wähl einen Ankunftstag dazwischen.`,
    arriveSmall: (name) => `Um bei ${name} zu bleiben statt vorbeizufliegen, baut die Sonde ihre ganze Geschwindigkeit relativ zum Ziel ab (dessen Schwerkraft ist viel zu schwach, um zu helfen).`,
    sbFlyby: 'Bei Asteroiden und Kometen bedeutet die kleinste Startenergie (C3) meist nur einen schnellen Vorbeiflug: siehe den Schub bei der Ankunft. Um dort zu bleiben, färbe die Karte nach „Zusammen (Δv)“.',
    marksSmall: 'I und II: der billigste Flug jedes Typs · weißer Kreis: der Flug, der unten gerechnet ist. Mit der Tastatur bewegen die Pfeiltasten den Kreis. Leer: Am Ankunftstag weiß die Seite nicht, wo der Körper ist.',
  },
};

const EN: Strings = {
  title: 'Digital Twin of the Solar System',
  tagline: 'The real positions of the planets and over 2,000 asteroids and comets, what is happening in space right now, what would happen if something changed, and how to travel there',
  beta: 'beta',
  feedback: 'Send feedback',
  language: 'Language',
  tab3d: '3D view',
  tab2d: 'Map from above',
  loading: 'Loading the scene…',
  no3d: 'This browser does not support the 3D view',
  mapAria: 'Map of the planets around the Sun',
  sceneAria: '3D scene of the planets around the Sun',
  views: {
    compressed: {
      label: 'All planets, compressed distances',
      caption: 'Distances are compressed so that all planets fit, but directions are correct.',
    },
    true: {
      label: 'All planets, true distances',
      caption: 'True distances. The inner planets sit very close to the Sun.',
    },
    inner: {
      label: 'Inner planets, true distances',
      caption: 'True distances, out to the orbit of Mars.',
    },
  },
  howto3d: 'Drag to turn the scene, use the mouse wheel or two fingers to zoom, double-click or ↺ to reset. '
    + 'Pick a planet and press “Follow” to keep the camera on it, even while time runs. '
    + 'The lines from the planets to the plane show how far above or below the plane of Earth’s orbit they are. '
    + 'The circles show the distance in AU. Planet sizes are not to scale. '
    + 'The background stars are real: all that the naked eye sees on a clear night. ✦ hides them.',
  howto2d: 'View from above, the planets move counter-clockwise. Planet sizes are not to scale. '
    + 'The numbers on the circles are distances in AU. The mouse wheel zooms, double-click resets.',
  infoHint: 'Pick a planet in the map or in the table to see its details.',
  fromSun: 'Distance from the Sun',
  fromEarth: 'Distance from Earth',
  lightTime: 'Light travel time to Earth',
  weAreHere: 'We are here 🙂',
  play: '▶ Play',
  pause: '⏸ Pause',
  now: 'Now',
  speed: 'Speed',
  view: 'View',
  goToDate: 'Go to date',
  timeBar: 'Time bar',
  speeds: ['1 day per second', '1 week per second', '1 month per second', '1 year per second'],
  simTime: 'Simulation time',
  live: 'live',
  check: 'Accuracy check at this date',
  passed: 'Passed ✓',
  failed: 'Failed ✗',
  worst: 'Largest difference:',
  colPlanet: 'Planet',
  colDistanceHtml: 'Distance from the Sun<br>(AU)',
  colLongitude: 'Ecliptic longitude',
  colError: 'Difference from reference',
  au: 'AU',
  millionKm: 'million km',
  equinox: 'Equinox',
  resetView: 'Reset view',
  follow: (name) => `Follow ${name}`,
  stopFollow: 'Stop following',
  stars: 'Stars',
  sources: 'Sources:',
  sourceCode: 'Source code',
  licences: 'Licences of libraries and data',
  planets: {
    mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars',
    jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  },
  smallBodies: 'Asteroids and comets',
  groups: { dwarf: 'dwarf planet', asteroid: 'asteroid', neo: 'near-Earth asteroid', comet: 'comet' },
  groupsMany: { dwarf: 'dwarf planets', asteroid: 'asteroids', neo: 'near-Earth asteroids', comet: 'comets' },
  famousBodies: 'Well-known asteroids and comets',
  selectionNote: 'On the map: all near-Earth asteroids of about 1 km and larger, the 400 brightest numbered asteroids of the main belt and Jupiter trojans, the 300 brightest bodies beyond Neptune and centaurs, and all numbered periodic comets. Names as JPL writes them.',
  find: 'Find:',
  findPlaceholder: 'Name or number of an asteroid or comet',
  notFound: 'Nothing found with this name.',
  classes: {
    MBA: 'main belt', IMB: 'inner main belt', OMB: 'outer main belt',
    MCA: 'Mars-crosser', AMO: 'Amor group', APO: 'Apollo group', ATE: 'Aten group', IEO: 'Atira group',
    TJN: 'Jupiter trojan', CEN: 'centaur (between Jupiter and Neptune)', TNO: 'trans-Neptunian', AST: 'other asteroid',
    JFc: 'Jupiter family', JFC: 'Jupiter family', HTC: 'Halley type', ETc: 'Encke type', CTc: 'Chiron type', COM: 'long-period',
  },
  type: 'Type',
  diameter: 'Diameter',
  km: 'km',
  smallNote: 'Each body shows only in the years where our calculation is accurate: within 1° of JPL’s.',
  outsideWindow: (from, to) => `Our calculation for this body is accurate only from ${from} to ${to}, so it is not shown at this date.`,
  uncertainty: 'Position uncertainty',
  metres: 'm',
  cloudNote: 'The cloud around the body shows 300 possible orbits, all fitting JPL’s observations: where it could really be. '
    + 'Its shape shows the least known direction: often along the orbit, and for distant bodies often their distance from the Sun. '
    + 'The number is one standard deviation (1σ) along its longest direction.',
  noCloud: 'No cloud for this body: forces other than gravity act on it, such as a comet’s outgassing or the push of sunlight’s heat. '
    + 'Our calculation leaves them out, so its cloud would be wrong.',
  cloudMismatch: 'No cloud for this body: our cloud (computed with the Sun alone) does not match the uncertainty JPL Horizons gives, probably because a planet’s pull matters a lot for it.',
  cloudZoom: (f) => `enlarged ×${f}`,
  trueSize: 'true size',
  light: (minutes) => {
    const hm = hoursMinutes(minutes);
    if (!hm) return `${num(minutes, 1, 'en')} minutes`;
    const hours = plural(hm.h, 'hour', 'hours');
    return hm.m === 0 ? hours : `${hours} ${plural(hm.m, 'minute', 'minutes')}`;
  },
  caTitle: 'Close approaches to Earth',
  caBadge: 'live data',
  caIntro: (mkm, ld) => `Asteroids and comets passing closer than ${mkm} million km to Earth (${ld} lunar distances), `
    + 'from a week ago to two months ahead. The list runs in real time, not in the simulation’s time.',
  caAhead: (n, m, until) => `Until ${until}: ${n === 0 ? 'no close approaches' : plural(n, 'close approach', 'close approaches')}`
    + `${n ? `, ${m === 0 ? 'none' : m} of them closer than the Moon` : ''}.`,
  caPast: (n, m) => `In the last week: ${n === 0 ? 'no close approaches' : plural(n, 'close approach', 'close approaches')}`
    + `${n ? `, ${m === 0 ? 'none' : m} of them closer than the Moon` : ''}.`,
  caClosest: (name, dist) => `Closest: ${name}, at ${dist}.`,
  caColObject: 'Object',
  caColWhen: 'When',
  caColDistance: 'Distance from Earth',
  caColSpeed: 'Speed',
  lunar: (x) => `${x} lunar distances`,
  caCloserThanMoon: 'closer than the Moon',
  caUncertain: (a, b) => `uncertain: between ${a} and ${b}`,
  caEstimate: 'estimated from its brightness',
  kmPerS: 'km/s',
  caShowPast: (n) => `Show the last week (${n})`,
  caHidePast: 'Hide the last week',
  caShowAll: (n) => `Show all (${n})`,
  caShowFewer: 'Show fewer',
  caNote: 'Distance from Earth’s centre. A lunar distance is the Moon’s distance, 384,400 km. '
    + 'Sizes with ≈ are estimated from the brightness: most of these asteroids are small, and nobody has measured them. '
    + '± is the uncertainty of the time (3σ). Times are in your local time. '
    + 'Many small asteroids are found only a few days before or after they pass, so the list grows every day, '
    + 'and often more passed in the last week than are known for the next two months.',
  caOnMap: 'On the map: click to show it',
  caUpdated: (d) => `Last updated: ${d}`,
  caStale: (d) => `Note: this data is from ${d}; we could not fetch newer data.`,
  caNone: 'No live data here. On the published site it comes fresh from JPL every 3 hours.',
  caLoading: 'Loading…',
  comma: ', ',
  relTime: (h) => {
    const minutes = h * 60;
    if (Math.abs(minutes) < 60) return h >= 0 ? 'in under an hour' : 'under an hour ago';
    return h >= 0 ? `in ${enDuration(minutes)}` : `${enDuration(minutes)} ago`;
  },
  duration: (minutes) => enDuration(minutes),
  swTitle: 'Space weather',
  swIntro: 'What is going on between the Sun and Earth: geomagnetic storms, solar flares, and clouds from the Sun on their way to us. '
    + 'In real time, not in the simulation’s time.',
  swScale: { r: 'Radio blackouts', s: 'Solar radiation storm', g: 'Geomagnetic storm' },
  swActiveItem: (k, n) => {
    const word = EN.swLevels[n];
    const what = k === 'r' ? `${word} radio blackouts` : `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word} ${k === 's' ? 'solar radiation storm' : 'geomagnetic storm'}`;
    return `${what} (${k.toUpperCase()}${n})`;
  },
  swScaleWhat: {
    r: 'From solar flares: radio fades on the sunlit side of Earth.',
    s: 'Fast particles from the Sun: they affect satellites and astronauts.',
    g: 'From the solar wind and clouds from the Sun: it makes auroras, and when strong it disturbs power grids and satellite navigation.',
  },
  swLevels: ['quiet', 'minor', 'moderate', 'strong', 'severe', 'extreme'],
  swCalm: 'All quiet right now: no storms.',
  swNowActive: (items) => `Right now: ${items}.`,
  swPast24: (x) => `Highest in the last 24 hours: ${x}`,
  swForecast: 'Forecast for the next days',
  swFcG: 'Expected geomagnetic storm',
  swFcRMinor: 'Chance of minor or moderate radio blackouts (R1–R2)',
  swFcRMajor: 'Chance of strong radio blackouts (R3+)',
  swFcS: 'Chance of a solar radiation storm (S1+)',
  swKpTitle: 'Kp index every 3 hours',
  swKpWhat: 'How disturbed Earth’s magnetic field is, from 0 (quiet) to 9. From 5 up it is a geomagnetic storm, '
    + 'and the higher it goes, the farther from the poles auroras can be seen.',
  swKpQuiet: 'below 5: no storm',
  swKpStorm: 'minor or moderate storm (G1–G2)',
  swKpStrong: 'strong storm or more (G3+)',
  swKpKind: { observed: 'measured', estimated: 'preliminary', predicted: 'forecast' },
  swKpLatest: (v, level) => `Latest: ${v} (${level})`,
  swKpMaxAhead: (v, when) => `Highest forecast: ${v}, ${when}`,
  swKpTable: 'The values as a table',
  swTime: 'Time',
  swFlaresTitle: 'Solar flares in the last 7 days',
  swFlareCount: (n, m, x) => `${n === 0 ? 'No flares' : plural(n, 'flare', 'flares')}${n ? `, ${m} of class M and ${x} of class X` : ''}.`,
  swFlareStrongest: 'Strongest:',
  swFlareWhat: 'The class (A, B, C, M, X) measures the X-rays, each class 10 times stronger than the one before. '
    + 'M and X flares can cause radio blackouts on the sunlit side of Earth.',
  swCmeTitle: 'Clouds from the Sun heading for Earth',
  swCmeNone: 'By NASA’s latest runs, no cloud is expected to reach Earth.',
  swCmeArrival: (when) => `Expected to arrive ${when} (± 7 hours)`,
  swCmeArrived: (when) => `Was expected to arrive ${when}`,
  swCmeGlancing: 'a glancing blow only',
  swCmeMinor: 'a minor impact only',
  swCmeKp: (a, b) => `Kp possibly ${a} to ${b}`,
  swCmeSpeed: (v) => `speed near the Sun ${v} km/s`,
  swCmeNote: 'Such a cloud (a coronal mass ejection, CME) is charged gas thrown out by the Sun; it reaches Earth after 1 to 5 days. '
    + 'These forecasts are experimental, from NASA’s WSA-Enlil research model; the official forecast is NOAA’s, above.',
  swParts: { scales: 'storm levels', kp: 'Kp index', flares: 'flares', cmes: 'cloud forecast' },
  swMissing: (part) => `No data right now: ${part}.`,
  swStale: (part, d) => `Note: ${part} from ${d}; we could not fetch newer data.`,
  swNone: 'No space weather data here. On the published site it comes fresh every 3 hours.',
  dsnTitle: 'Deep Space Network now',
  dsnIntro: 'Which spacecraft are talking right now with NASA’s big antennas at three sites around the Earth. '
    + 'The sites are about a third of a turn apart, so one of them always sees any distant spacecraft.',
  dsnStations: { gdscc: 'Goldstone, California', mdscc: 'Madrid, Spain', cdscc: 'Canberra, Australia' },
  dsnLocalTime: (c) => `local time ${c}`,
  dsnSummary: (n, d) => (n === 0 ? 'Right now no spacecraft is in contact.'
    : `Right now ${n} spacecraft ${n === 1 ? 'is' : 'are'} in contact, through ${plural(d, 'antenna', 'antennas')}.`),
  dsnFarthest: (name, dist, light) => `Farthest: ${name}, ${dist} away; its signal takes ${light} to reach us.`,
  dsnLight: (sec) => {
    if (sec >= 59.95) return EN.light(sec / 60);
    if (sec < 9.95) return `${num(sec, 1, 'en')} seconds`;
    return plural(Math.round(sec), 'second', 'seconds');
  },
  dsnSignalTime: (x) => `signal takes ${x}`,
  dsnSize: (m) => `${m} m`,
  dsnElevation: (d) => `${d} above the horizon`,
  dsnActivity: {
    link: 'talking to spacecraft',
    maint: 'maintenance and upgrades',
    vlbi: 'radio measurements with distant sites (VLBI)',
    radar: 'radar for planets and asteroids',
    astro: 'radio astronomy',
    calib: 'calibration',
    test: 'test',
  },
  dsnDown: 'receiving from the spacecraft',
  dsnUp: 'sending to the spacecraft',
  dsnNoSignal: (n) => `antenna pointed at ${n === 1 ? 'it' : 'them'}, no signal right now`,
  dsnMspa: 'several spacecraft through one antenna',
  dsnRate: ['bit/s', 'kbit/s', 'Mbit/s'],
  billionKm: 'billion km',
  dsnWhere: {
    interstellar: 'in interstellar space',
    kuiper: 'in the Kuiper belt, beyond Neptune',
    jupiter: 'orbiting Jupiter',
    toJupiter: 'on its way to Jupiter',
    toTrojans: 'on its way to Jupiter’s Trojan asteroids',
    toPsyche: 'on its way to the asteroid Psyche',
    toApophis: 'on its way to the asteroid Apophis',
    toAsteroid: 'on its way to a small asteroid',
    mars: 'orbiting Mars',
    marsSurface: 'on Mars',
    toMars: 'on its way to Mars',
    moon: 'orbiting the Moon',
    l1: 'between Earth and the Sun, 1.5 million km from Earth',
    l2: 'beyond Earth on its night side, 1.5 million km out',
    sun: 'orbiting the Sun',
    earth: 'orbiting Earth',
  },
  dsnNote: '↓ means the antenna is receiving data from the spacecraft (with its data rate), ↑ that it is sending commands. '
    + 'The big dishes are 70 m across, the others 34 m. Distance and signal time come from NASA. '
    + 'Sometimes one antenna listens to several spacecraft at once, such as those at Mars.',
  dsnUpdated: (c, ago) => `NASA’s data from ${c} (${ago}), new every minute`,
  dsnAgo: (sec) => (sec < 60 ? 'under a minute ago' : `${enDuration(sec / 60)} ago`),
  dsnOld: (ago) => `Note: NASA’s latest data came ${ago}. There may be a problem on their side.`,
  dsnOff: 'The live link to the Deep Space Network is not set up yet. It will show here soon.',
  dsnNone: 'No data from NASA right now. We will try again in a minute.',
  dsnLocal: 'No live data here. On the published site it comes fresh from NASA every minute.',
  nowTitle: 'Now in space',
  nowIntro: 'What is happening in space right now, from NASA and NOAA, and what is coming up in the sky. Pick one for the details.',
  nowTabs: { dsn: 'Deep Space Network', weather: 'Space weather', approaches: 'Close approaches', events: 'Sky events' },
  nowUpdated: (ago) => `Updated ${ago}`,
  nowNoData: 'No data right now',
  nowDsn: (n) => (n === 0 ? 'No spacecraft in contact' : `${n} spacecraft in contact`),
  nowFarthest: (name) => `Farthest: ${name}`,
  nowWeatherCalm: 'Quiet right now',
  nowWeatherAhead: (level, day) => `Next days: up to ${level}, ${day}`,
  nowWeatherAheadCalm: 'The next days look quiet too',
  nowCme: (when) => `Cloud from the Sun expected ${when}`,
  nowApproaches: (n, until) => (n === 0 ? `No close approaches until ${until}` : `${plural(n, 'close approach', 'close approaches')} until ${until}`),
  events: {
    title: 'Sky events',
    badge: 'worked out in your browser',
    intro: 'What happens in the sky in the next days: phases of the Moon, eclipses, planets in front of or behind the Sun, '
      + 'and when the Moon or two planets come close together in the sky. All worked out here in your browser, in real time, not in the simulation’s time.',
    daysLabel: 'How far ahead',
    days7: 'Next 7 days',
    days30: 'Next 30 days',
    summary: (n, d) => `In the next ${d} days: ${n === 0 ? 'no major events' : plural(n, 'event', 'events')}.`,
    tileMain: (n) => (n === 0 ? 'No major events in 30 days' : `${plural(n, 'event', 'events')} in 30 days`),
    next: (what, when) => `Next: ${what}, ${when}`,
    jump: 'Go to this time',
    jumpTitle: 'Stops the clock and takes the views to this moment',
    jumpPick: (p) => `Stops the clock, takes the views to this moment and picks ${p}`,
    about: (x) => `about ${x}`,
    note: (tz) => `Times in your time zone (${tz}). All seen from the Earth’s centre: from where you are, the Moon can sit up to about 1° elsewhere. `
      + 'Brightness in magnitudes: the smaller the number, the brighter (Venus about −4). '
      + 'The times are within a few minutes of the tables of NAOJ, USNO and NASA. Asteroids from CNEOS (the close-approaches card). Worked out with',
    moonName: 'Moon',
    moon: { new: 'New Moon', firstQuarter: 'First quarter', full: 'Full Moon', lastQuarter: 'Last quarter' },
    moonNotes: {
      new: 'The Moon is between the Earth and the Sun, so it cannot be seen. Two days later a thin crescent shows in the evening.',
      firstQuarter: 'Half of the Moon is lit. Seen in the afternoon and the evening.',
      full: 'All of the Moon is lit: it rises at sunset and is up all night.',
      lastQuarter: 'Half of the Moon is lit. Seen late at night and in the morning.',
    },
    conjunction: {
      superior: (p) => `${p} behind the Sun`,
      inferior: (p) => `${p} between us and the Sun`,
      plain: (p) => `${p} behind the Sun`,
    },
    conjunctionNotes: {
      superior: 'Superior conjunction: lost in the Sun’s glare these days, then back in the evening sky.',
      inferior: 'Inferior conjunction: lost in the Sun’s glare these days, then in the morning sky.',
      plain: 'Conjunction: lost in the Sun’s glare these days, then back in the morning sky.',
    },
    opposition: (p) => `${p} at opposition`,
    oppositionNote: 'The Earth is between the Sun and the planet. The best time to see it: it rises at sunset, is up all night, and is at its closest and brightest.',
    brightDistance: (m, d) => `Brightness\u00a0${m}, distance ${d}.`,
    optics: 'You need binoculars to see it.',
    elongation: (p, sky) => `${p} farthest from the Sun (${sky === 'evening' ? 'evening sky' : 'morning sky'})`,
    elongationNote: (d, sky) => `Greatest elongation: ${d} from the Sun. Best seen ${sky === 'evening' ? 'after sunset, low in the west' : 'before sunrise, low in the east'}.`,
    brightness: (m) => `Brightness\u00a0${m}.`,
    solar: { total: 'Total solar eclipse', annular: 'Annular solar eclipse', partial: 'Partial solar eclipse' },
    solarWhere: (where) => `Seen only from a narrow strip of the Earth; at the peak the shadow’s centre is at ${where}. Partial around it.`,
    solarPartial: 'Seen as a partial eclipse from part of the Earth only.',
    solarSafety: 'Never look at the Sun without eclipse glasses.',
    lunar: { total: 'Total lunar eclipse', partial: 'Partial lunar eclipse', penumbral: 'Penumbral lunar eclipse' },
    lunarNotes: {
      total: (d) => `All of the Moon is in the Earth’s shadow for ${d} and turns red. Seen from everywhere it is night then.`,
      partial: (d) => `Part of the Moon is in the Earth’s shadow for ${d}. Seen from everywhere it is night then.`,
      penumbral: (d) => `The Moon passes through the Earth’s faint outer shadow for ${d}: it only dims a little, hard to notice.`,
    },
    seasons: { marchEquinox: 'March equinox', juneSolstice: 'June solstice', septemberEquinox: 'September equinox', decemberSolstice: 'December solstice' },
    seasonNotes: {
      marchEquinox: 'Day and night are about equally long everywhere: spring begins in the northern half of the Earth, autumn in the southern.',
      juneSolstice: 'The longest day in the northern half of the Earth and the shortest in the southern: summer begins in the north.',
      septemberEquinox: 'Day and night are about equally long everywhere: autumn begins in the northern half of the Earth, spring in the southern.',
      decemberSolstice: 'The shortest day in the northern half of the Earth and the longest in the southern: winter begins in the north.',
    },
    perihelion: 'Earth closest to the Sun (perihelion)',
    aphelion: 'Earth farthest from the Sun (aphelion)',
    perihelionNote: (d) => `Distance ${d}. This has nothing to do with the seasons: it is winter in the north then. They come from the Earth’s tilt.`,
    aphelionNote: (d) => `Distance ${d}, and yet it is summer in the north: the seasons come from the Earth’s tilt, not its distance.`,
    pair: (a, b) => `${a} near ${b}`,
    pairNote: (d) => `${d} apart in the sky (the Moon is half a degree wide).`,
    glare: 'But close to the Sun, so hard to see.',
    neo: (name) => `${name} passes the Earth`,
    neoNote: (d) => `At ${d}.`,
    neoCloser: 'Closer than the Moon!',
    neoClosest: 'The closest in the next 30 days.',
    north: 'N', south: 'S', east: 'E', west: 'W',
  },
  video: {
    weekTitle: 'The sky this week',
    daysTitle: 'The sky in these days',
    weekCount: (n) => (n === 0 ? 'no major events' : plural(n, 'event', 'events')),
    eventNo: (i, n) => `Event ${i} of ${n}`,
    outroLine: 'The sky on any day, and the planets in 3D, free in your browser:',
    sources: 'Worked out with Astronomy Engine · Asteroids: CNEOS (NASA/JPL)',
    when: (x, zone) => `${x} (${zone})`,
    speed: (d) => `1 second of video = ${d}`,
    sunName: 'Sun',
    ecliptic: 'ecliptic',
    earthShadow: 'Earth’s shadow',
    fromPlace: (where) => `as seen from ${where}`,
    fromCentre: 'from the Earth’s centre',
    lunarDistance: 'the Moon’s distance',
    scaleNote: 'Distances to scale, sizes enlarged.',
  },
  branch: {
    title: 'Branch reality',
    badge: 'Experimental',
    intro: 'Take a copy of the solar system from the moment on screen, change something, and see how the planets move from then on. The physics engine computes the gravity between the Sun and the planets itself, with general relativity.',
    action: 'What to change',
    actions: { remove: 'Remove a planet', mass: 'Change a mass', push: 'Push a planet', star: 'Let a star pass' },
    body: 'Which',
    sun: 'Sun',
    factor: 'Mass ×',
    speed: 'Change in speed (km/s)',
    pushHint: 'positive: faster, negative: slower',
    starMass: 'Mass of the star (Suns)',
    starDistance: 'Closest distance (au)',
    starNote: 'passes in 10 years at 20 km/s, in the plane of Earth\'s orbit',
    go: 'Branch',
    reset: 'Back to reality',
    what: {
      remove: (n) => `Branch: without ${n}`,
      mass: (n, f) => `Branch: ${n === 'Sun' ? 'the Sun' : n} at ×${f} the mass`,
      push: (n, v, faster) => `Branch: ${n} ${v} km/s ${faster ? 'faster' : 'slower'}`,
      star: (m, d) => `Branch: a star with ${m}× the Sun\'s mass passes ${d} away`,
    },
    from: (d) => `from ${d}`,
    computing: (y) => `computing… at ${y}`,
    before: (d) => `This is before the branch (${d}), so it does not show here`,
    legend: 'Full dot: reality · empty circle: the branch, with a line to the real position',
    error: (m) => `That did not work: ${m}`,
    tooFar: 'Branching works only between 1800 and 2050',
    starLate: (y) => `The star must pass before 2050: branch in ${y} or earlier`,
    jump: 'Go to the start of the branch',
    compare: {
      title: 'Compared with reality, at the same moment',
      note: 'Reality here is the same calculation without the change, so every difference comes from the change. Year: how long the planet takes to go once round the Sun on its orbit now.',
      body: 'Body', year: 'Year', distance: 'From the Sun', offset: 'From its real place',
      removed: 'removed', escapes: 'escaping, no longer in orbit', star: 'Star',
      real: (v) => `real: ${v}`, days: (n) => `${n} days`, years: (n) => `${n} years`,
    },
    scenarios: {
      title: 'Ready-made scenarios',
      own: 'Or change something yourself:',
      preparing: 'Getting the branch ready…',
      buttons: { jupiter: 'What if Jupiter vanished?', sun: 'What if the Sun were twice as heavy?', star: 'A star passes 1,000 AU away' },
      nearer: 'Bring the star in to 50 AU',
      farther: 'Move the star back to 1,000 AU',
      list: {
        jupiter: {
          how: 'We remove Jupiter on 1 January 1900 and run time at a year per second until 2050.',
          result: (f) => `Result: no planet flies off or falls into the Sun, because it is the Sun that holds the planets, not Jupiter. But the orbits slowly shift: by the year 2000 Saturn is about ${f.saturn} million km from its real place, and Earth about ${f.earth} km.`,
        },
        sun: {
          how: 'We suddenly double the Sun\'s mass on 15 November 2026; the planets keep their speed. Time runs at a month per second.',
          result: (f) => `Result: at once every planet moves faster, on smaller, stretched orbits: Earth's year becomes ${f.earthYear} days instead of 365, Earth comes within ${f.earthClosest} AU of the Sun, and Jupiter's year lasts ${f.jupiterYear} years instead of 11.9.`,
        },
        star: {
          how: 'A star with the Sun\'s mass passes in 2036, 1,000 AU away (33 times as far as Neptune), at 20 km/s. Time runs at a year per second until 2050.',
          result: (f) => `Result: by eye nothing shows, and the star stays an arrow at the edge. The table shows why: at the end of 2050 Neptune is only about ${f.neptune} km from its real place, and Earth less than ${f.earth} km. Even a star like the Sun barely touches the planets from that far.`,
        },
        star50: {
          how: 'The same star, but 50 AU away, not far beyond Neptune (30 AU).',
          result: (f) => `Result: now the difference is large: at the end of 2050 Neptune's year is about ${f.neptuneYear} years instead of 165, Uranus's about ${f.uranusYear} instead of 84, and Neptune is about ${f.neptune} million km from its real place, which shows on the map. Earth feels it only a little: about ${f.earth} km.`,
        },
      },
    },
  },
  trip: {
    title: 'Trip planner',
    badge: 'Experimental',
    intro: 'How long does a trip from Earth to another planet, an asteroid or a comet take, how much must the craft change its speed (Δv, which sets the fuel), and when is the best time to leave? '
      + 'For the planets, the first answer is the Hohmann transfer: the cheapest way between two orbits, half an ellipse round the Sun that just touches Earth’s orbit and the planet’s, with two burns, one to leave and one to arrive. '
      + 'The date is searched from the time on screen.',
    to: 'To',
    duration: 'Time on the way',
    leave: 'Burn to leave',
    arrive: 'Burn to arrive',
    total: 'Both (Δv)',
    tripDays: (d) => `${d} days`,
    aboutMonths: (m) => `about ${m} months`,
    tripYears: (y) => `${y} years`,
    kmS: (v) => `${v} km/s`,
    c3: (v) => `C3 = ${v} km²/s²`,
    leaveNote: (km, c3) => `from an orbit ${km} km above Earth · launch energy ${c3}`,
    arriveNote: (km, name, v) => `into an orbit ${km} km above ${name} · speed relative to the planet on arrival: ${v}`,
    whenTitle: 'When to leave?',
    phase: (id, need, ahead, now, nowAhead) => `At launch, ${EN.planets[id]} must be ${need} ${ahead ? 'ahead of' : 'behind'} Earth (seen from the Sun). `
      + `At the time on screen: ${now} ${nowAhead ? 'ahead' : 'behind'}.`,
    window: (d, rel, a) => `Launch window: leave on ${d} (${rel}), arrive on ${a}.`,
    prev: (d, rel) => `The one before was on ${d} (${rel}).`,
    every: (days, m) => `After that about every ${days} days (some ${plural(m, 'month', 'months')}): the synodic period, after which the planet and Earth line up the same way again.`,
    rel: (d) => {
      if (Math.abs(d) < 1) return 'today';
      const x = Math.abs(d) < 60 ? plural(Math.round(Math.abs(d)), 'day', 'days') : plural(Math.round(Math.abs(d) / 30.44), 'month', 'months');
      return d > 0 ? `in ${x}` : `${x} ago`;
    },
    jump: 'Go to the launch date',
    outside: 'This date is after 2050, beyond the time bar.',
    note: 'An estimate: Hohmann takes both orbits as circles in one plane. The real orbits are a little stretched and tilted, so the real date and numbers differ a little. For the real numbers, see the exact calculation below.',
    giants: 'To the outer planets, real spacecraft fly past other planets to pick up speed from their gravity, like Voyager 2, which reached Neptune in 12 years, and they go into a stretched orbit rather than a low one. That way they are faster and need far less fuel.',
    exactTitle: 'Worked out exactly, for dates you choose',
    exactIntro: 'Here the real orbits are used (stretched and tilted): choose the day to leave and the day to arrive, and we find the path round the Sun that joins Earth on the first day to the target on the second (Lambert’s problem).',
    departDate: 'Leave',
    arriveDate: 'Arrive',
    way: (deg, type, revs, by) => (revs
      ? `The path goes ${revs === 1 ? 'once' : revs === 2 ? 'twice' : `${revs} times`} all the way round the Sun and then ${deg} more, as that needs less ${by === 'c3' ? 'at launch' : 'for both burns together'} than the direct way. `
      : `The path goes ${deg} round the Sun: `)
      + `${type === 1 ? 'type I (less than half a turn)' : 'type II (more than half a turn)'}${revs ? ' in the last turn' : ''}.`,
    badDates: 'The arrival must come after the departure.',
    noTrip: 'There is no single path for these two days (Earth and the target are exactly opposite each other). Try another day.',
    mapTitle: 'Map of launch dates',
    mapIntro: 'Each point on the map is a trip worked out exactly: the launch day across, the time on the way up, and the colour shows what it costs. The lighter, the cheaper. Tap any point to see its numbers below. The dashed line separates type I (below) from type II (above).',
    mapIntroSmall: 'Each point on the map is a trip worked out exactly: the launch day across, the time on the way up, and the colour shows what it costs. The lighter, the cheaper. Tap any point to see its numbers below. '
      + 'On long trips the path can go round the Sun once or more before it arrives, so the map looks like a mosaic: each piece has a different number of turns.',
    colorBy: 'Colour by',
    measures: { c3: 'Launch energy (C3)', dv: 'Both burns (Δv)' },
    units: { c3: 'km²/s²', dv: 'km/s' },
    axisDepart: 'Launch day',
    axisDays: 'Time on the way (days)',
    axisYears: 'Time on the way (years)',
    computing: 'Working out the map…',
    cheaper: 'cheaper',
    dearer: 'dearer',
    marks: 'I and II: the cheapest trip of each type · H: the Hohmann estimate · white circle: the trip worked out below. With a keyboard, the arrow keys move the circle.',
    best: (type, d, a, dur, v) => `Cheapest trip of type ${type === 1 ? 'I' : 'II'}: leave on ${d}, arrive on ${a} (${dur}), ${v}.`,
    pick: 'Pick it',
    typeName: (type) => (type === 1 ? 'type I' : 'type II'),
    turns: (n) => (n === 1 ? 'after one whole turn' : `after ${n} whole turns`),
    nearHalf: 'This trip goes almost exactly half way round: the plane of its path is barely defined, and the numbers change a lot from day to day. Real missions avoid this line.',
    edge: '(on the edge of the map, so there may be a cheaper trip beyond it)',
    playTrip: 'Play the trip in the view',
    showPath: 'Show the path in the view',
    craft: 'Spacecraft',
    playNote: 'The button sets the time to the launch day and runs it, so you see the spacecraft move along its path until it arrives. Solid: the way behind it, dashed: the way ahead.',
    mapAria: 'Map of launch dates: launch day and time on the way, coloured by cost',
    sigTitle: 'Signal delay',
    sigIntro: 'The Earth and the craft talk by radio, and the signal travels at the speed of light: 299,792 km a second. The farther the craft, the longer a message takes, '
      + 'and nobody can steer it live: it has to manage with the commands it got before. The chart shows how long the signal takes one way on each day of the trip (a question and its answer: twice that). '
      + 'Light bands: the craft is close to the Sun in the Earth’s sky (under 2°), whose hot gas garbles the signal; NASA’s Mars missions send no commands on those days.',
    seconds: (n) => plural(n, 'second', 'seconds'),
    sigArrive: (one, both) => `On arrival the signal takes ${one}, so a question and its answer ${both}.`,
    sigMax: (d, date, day) => `Longest delay: ${d}, on ${date} (day ${day} of the trip).`,
    sigMaxAtEnd: 'That is the longest of the whole trip.',
    sigNow: (day, d) => `At the time on screen (day ${day} of the trip): ${d}.`,
    sigConj: (n, list) => `The craft comes within 2° of the Sun in the Earth’s sky ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}: ${list}. `
      + 'Real missions send no commands on those days.',
    sigConjMany: (n, m, first, last) => `The craft comes within 2° of the Sun in the Earth’s sky ${n} times, about every ${plural(m, 'month', 'months')}: `
      + `first ${first}, last ${last}. Real missions send no commands on those days.`,
    sigNoConj: 'The craft never comes within 2° of the Sun in the Earth’s sky on this trip, so the signal stays clean.',
    sigJoin: '; ',
    sigAxisDays: 'days since launch',
    sigAxisYears: 'years since launch',
    sigUnitMin: 'signal (minutes)',
    sigUnitHours: 'signal (hours)',
    sigSun: 'near the Sun',
    sigDay: (d) => `day ${d} of the trip`,
    sigTable: 'The numbers as a table',
    sigCols: { date: 'Date', day: 'Day of trip', distance: 'Distance from Earth', delay: 'Signal (one way)', sun: 'From the Sun in the sky' },
    sigAria: 'Signal delay between the Earth and the craft along the trip',
    craftDelay: (name, d) => `${name} · ${d}`,
    targetGroups: { planets: 'Planets', main: 'Asteroid belt', neo: 'Near-Earth asteroids', trojan: 'Jupiter trojans', far: 'Beyond Neptune', comet: 'Comets' },
    sbNoHohmann: (y, a, b) => 'There is no Hohmann estimate for asteroids and comets: their orbits are too stretched and tilted to be taken as circles. '
      + `Instead the map below works out every trip exactly, for launch days over ${y} years from the time on screen and ${a} to ${b} days on the way (as NASA’s mission design tool for small bodies does), longer for distant ones.`,
    sbKnown: (name, from, to) => `The site knows where ${name} is (to within a degree of NASA’s calculation) only from ${from} to ${to}, so a trip has to arrive in those years.`,
    sbRetro: (name) => `${name} goes round the Sun the other way. Near the Sun, where it moves fast, any spacecraft meets it head-on and very fast: Europe’s Giotto flew past Halley’s comet at 68\u00a0km/s in 1986. Far out it moves slowly, and that matters much less.`,
    sbFar: 'Real spacecraft to distant bodies take a push from Jupiter’s gravity on the way: New Horizons left in 2006 and reached Pluto in 2015, in under 10 years. This planner leaves such flybys out, so its numbers are for the direct way only.',
    sbNoRange: 'From the time on screen, no trip can arrive in those years.',
    sbJump: (year) => `Go to ${year}`,
    sbNoTrips: (name) => `There is no trip to ${name} on this map.`,
    sbOutsideDates: (name, from, to) => `The site knows where ${name} is only from ${from} to ${to}: pick an arrival day in between.`,
    arriveSmall: (name) => `To stay with ${name} rather than fly past, the craft must lose all its speed relative to it (its gravity is far too weak to help).`,
    sbFlyby: 'For asteroids and comets, the lowest launch energy (C3) mostly means just a fast flyby: see the arrival burn. To stay there, colour the map by “Both burns (Δv)”.',
    marksSmall: 'I and II: the cheapest trip of each type · white circle: the trip worked out below. With a keyboard, the arrow keys move the circle. Empty: on that arrival day the site does not know where the body is.',
  },
};

export const STRINGS: Record<Lang, Strings> = { ar: AR, de: DE, en: EN };

// ---------- Current language ----------

let current: Lang = 'ar';
const STORAGE_KEY = 'solar-twin-lang';

export const lang = (): Lang => current;
export const t = (): Strings => STRINGS[current];
export const langInfo = (): LangInfo => LANGS.find((x) => x.id === current)!;

const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.id === x);

/** Switch language and remember the choice in this browser. */
export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* private mode etc.: just don't remember */ }
}

/** First visit: ?lang= in the address, else the saved choice, else the browser's language, else English. */
export function detectLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch { /* no storage */ }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return 'en';
}
