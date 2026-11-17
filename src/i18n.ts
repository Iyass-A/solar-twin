// All texts of the page in three languages: Arabic (Levantine), German and English.
// No DOM access when this file loads, so `npm run check` can test it in Node.

import type { PlanetId } from './astro/elements';
import type { ViewMode } from './view/views';
import type { SmallGroup } from './view/smallbodies';
import type { Where } from './data/spacecraft';
import type { ScenarioId } from './physics/scenarios';

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
  nowTabs: { dsn: string; weather: string; approaches: string };
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
    way: (deg: string, type: 1 | 2) => string;
    badDates: string;
    noTrip: string;
    // Step 3: the porkchop map of launch dates
    mapTitle: string;
    mapIntro: string;
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
    nearHalf: string;
    /** After a cheapest trip that lies on the map's edge */
    edge: string;
    mapAria: string;
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
  tagline: 'المواقع الحقيقية للكواكب وأكتر من 2,000 كويكب ومذنب، شو عم يصير بالفضاء هلأ، وشو كان صار لو تغيّر شي',
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
  nowIntro: 'شو عم يصير بالفضاء بهاللحظة، من ناسا وNOAA. اكبس على وحدة لتشوف التفاصيل.',
  nowTabs: { dsn: 'شبكة الفضاء العميق', weather: 'طقس الفضاء', approaches: 'مرورات قريبة من الأرض' },
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
    intro: 'لو انطلقنا من الأرض لكوكب تاني، قديش بتطوّل الرحلة، قديش لازم تغيّر المركبة سرعتها (Δv، وهاد اللي بيحدد الوقود)، وإيمتى أحسن وقت؟ '
      + 'أول جواب هو انتقال هوهمان: أوفر طريق بين مدارين، نص قطع ناقص حوالين الشمس بيلمس مدار الأرض ومدار الكوكب، مع دفشتين: وحدة للانطلاق ووحدة للوصول. '
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
    exactIntro: 'هون الحساب بالمدارات الحقيقية (ممطوطة ومايلة): بتختار يوم الانطلاق ويوم الوصول، ومنلاقي المسار حوالين الشمس اللي بيوصل من مكان الأرض بأول يوم لمكان الكوكب بتاني يوم (مسألة لامبرت).',
    departDate: 'يوم الانطلاق',
    arriveDate: 'يوم الوصول',
    way: (deg, type) => `المسار بيلف ${deg} حوالين الشمس: ${type === 1 ? 'النوع الأول (أقل من نص لفّة)' : 'النوع التاني (أكتر من نص لفّة)'}.`,
    badDates: 'لازم يكون يوم الوصول بعد يوم الانطلاق.',
    noTrip: 'ما في مسار واحد لهالتاريخين (الأرض والكوكب بجهتين متعاكستين بالظبط). جرّب يوم تاني.',
    mapTitle: 'خريطة مواعيد الانطلاق',
    mapIntro: 'كل نقطة بالخريطة رحلة محسوبة بالظبط: يوم الانطلاق عالمحور الأفقي، ومدة الرحلة عالعمودي، واللون قديش بتكلّف. كل ما كان اللون أفتح، كل ما كانت أرخص. اكبس على أي نقطة لتشوف حسابها تحت. الخط المتقطّع بيفصل بين النوع الأول (تحت) والنوع التاني (فوق).',
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
    nearHalf: 'هالرحلة بتلف تقريباً نص لفّة بالظبط: مستوى المسار بالكاد محدد، والأرقام بتتغيّر كتير من يوم ليوم. المهمات الحقيقية بتتجنّب هالخط.',
    edge: '(على طرف الخريطة، فممكن تكون في رحلة أرخص برّاها)',
    mapAria: 'خريطة مواعيد الانطلاق: يوم الانطلاق ومدة الرحلة، ملوّنة حسب الكلفة',
  },
};

const DE: Strings = {
  title: 'Digitaler Zwilling des Sonnensystems',
  tagline: 'Die echten Positionen der Planeten und von über 2.000 Asteroiden und Kometen, was gerade im All passiert, und was wäre, wenn sich etwas ändert',
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
  nowIntro: 'Was gerade im All passiert, von NASA und NOAA. Wähle eine Kachel für die Details.',
  nowTabs: { dsn: 'Deep Space Network', weather: 'Weltraumwetter', approaches: 'Nahe Vorbeiflüge' },
  nowUpdated: (ago) => `Aktualisiert ${ago}`,
  nowNoData: 'Gerade keine Daten',
  nowDsn: (n) => (n === 0 ? 'Kein Raumfahrzeug in Kontakt' : `${plural(n, 'Raumfahrzeug', 'Raumfahrzeuge')} in Kontakt`),
  nowFarthest: (name) => `Am weitesten: ${name}`,
  nowWeatherCalm: 'Gerade ruhig',
  nowWeatherAhead: (level, day) => `Nächste Tage: bis ${level}, ${day}`,
  nowWeatherAheadCalm: 'Auch die nächsten Tage ruhig',
  nowCme: (when) => `Wolke von der Sonne erwartet: ${when}`,
  nowApproaches: (n, until) => (n === 0 ? `Kein Vorbeiflug bis ${until}` : `${plural(n, 'Vorbeiflug', 'Vorbeiflüge')} bis ${until}`),
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
    intro: 'Wie lange dauert ein Flug von der Erde zu einem anderen Planeten, um wie viel muss die Sonde ihre Geschwindigkeit ändern (Δv, davon hängt der Treibstoff ab), und wann startet man am besten? '
      + 'Die erste Antwort ist der Hohmann-Transfer: der sparsamste Weg zwischen zwei Bahnen, eine halbe Ellipse um die Sonne, die die Erdbahn und die Bahn des Planeten gerade berührt, mit zwei Schüben, einem zum Start und einem zur Ankunft. '
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
    exactIntro: 'Hier wird mit den echten Bahnen gerechnet (gestreckt und geneigt): Du wählst den Start- und den Ankunftstag, und wir suchen die Bahn um die Sonne, die die Erde am ersten Tag mit dem Planeten am zweiten verbindet (das Lambert-Problem).',
    departDate: 'Start',
    arriveDate: 'Ankunft',
    way: (deg, type) => `Die Bahn führt ${deg} um die Sonne: ${type === 1 ? 'Typ I (weniger als eine halbe Runde)' : 'Typ II (mehr als eine halbe Runde)'}.`,
    badDates: 'Die Ankunft muss nach dem Start liegen.',
    noTrip: 'Für diese beiden Tage gibt es keine eindeutige Bahn (Erde und Planet stehen sich genau gegenüber). Versuch einen anderen Tag.',
    mapTitle: 'Karte der Starttermine',
    mapIntro: 'Jeder Punkt der Karte ist ein genau gerechneter Flug: der Starttag auf der waagrechten Achse, die Flugdauer auf der senkrechten, und die Farbe zeigt, was er kostet. Je heller, desto billiger. Tippe auf einen Punkt, um seine Rechnung unten zu sehen. Die gestrichelte Linie trennt Typ I (unten) von Typ II (oben).',
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
    nearHalf: 'Dieser Flug geht fast genau eine halbe Runde: Die Ebene der Bahn ist kaum bestimmt, und die Zahlen ändern sich von Tag zu Tag stark. Echte Missionen meiden diese Linie.',
    edge: '(am Rand der Karte, außerhalb gibt es vielleicht einen billigeren Flug)',
    mapAria: 'Karte der Starttermine: Starttag und Flugdauer, gefärbt nach den Kosten',
  },
};

const EN: Strings = {
  title: 'Digital Twin of the Solar System',
  tagline: 'The real positions of the planets and over 2,000 asteroids and comets, what is happening in space right now, and what would happen if something changed',
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
  nowIntro: 'What is happening in space right now, from NASA and NOAA. Pick one for the details.',
  nowTabs: { dsn: 'Deep Space Network', weather: 'Space weather', approaches: 'Close approaches' },
  nowUpdated: (ago) => `Updated ${ago}`,
  nowNoData: 'No data right now',
  nowDsn: (n) => (n === 0 ? 'No spacecraft in contact' : `${n} spacecraft in contact`),
  nowFarthest: (name) => `Farthest: ${name}`,
  nowWeatherCalm: 'Quiet right now',
  nowWeatherAhead: (level, day) => `Next days: up to ${level}, ${day}`,
  nowWeatherAheadCalm: 'The next days look quiet too',
  nowCme: (when) => `Cloud from the Sun expected ${when}`,
  nowApproaches: (n, until) => (n === 0 ? `No close approaches until ${until}` : `${plural(n, 'close approach', 'close approaches')} until ${until}`),
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
    intro: 'How long does a trip from Earth to another planet take, how much must the craft change its speed (Δv, which sets the fuel), and when is the best time to leave? '
      + 'The first answer is the Hohmann transfer: the cheapest way between two orbits, half an ellipse round the Sun that just touches Earth’s orbit and the planet’s, with two burns, one to leave and one to arrive. '
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
    exactIntro: 'Here the real orbits are used (stretched and tilted): choose the day to leave and the day to arrive, and we find the path round the Sun that joins Earth on the first day to the planet on the second (Lambert’s problem).',
    departDate: 'Leave',
    arriveDate: 'Arrive',
    way: (deg, type) => `The path goes ${deg} round the Sun: ${type === 1 ? 'type I (less than half a turn)' : 'type II (more than half a turn)'}.`,
    badDates: 'The arrival must come after the departure.',
    noTrip: 'There is no single path for these two days (Earth and the planet are exactly opposite each other). Try another day.',
    mapTitle: 'Map of launch dates',
    mapIntro: 'Each point on the map is a trip worked out exactly: the launch day across, the time on the way up, and the colour shows what it costs. The lighter, the cheaper. Tap any point to see its numbers below. The dashed line separates type I (below) from type II (above).',
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
    nearHalf: 'This trip goes almost exactly half way round: the plane of its path is barely defined, and the numbers change a lot from day to day. Real missions avoid this line.',
    edge: '(on the edge of the map, so there may be a cheaper trip beyond it)',
    mapAria: 'Map of launch dates: launch day and time on the way, coloured by cost',
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
