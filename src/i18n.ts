// All texts of the page in three languages: Arabic (Levantine), German and English.
// No DOM access when this file loads, so `npm run check` can test it in Node.

import type { PlanetId } from './astro/elements';
import type { ViewMode } from './view/views';
import type { SmallGroup } from './view/smallbodies';

export type Lang = 'ar' | 'de' | 'en';

export interface LangInfo {
  id: Lang;
  name: string;          // the language's name in itself, for the switch
  dir: 'rtl' | 'ltr';
  numberLocale: string;  // how numbers are written
}

export const LANGS: LangInfo[] = [
  { id: 'ar', name: 'عربي', dir: 'rtl', numberLocale: 'en-US' }, // Western digits, as before
  { id: 'de', name: 'Deutsch', dir: 'ltr', numberLocale: 'de-DE' }, // decimal comma
  { id: 'en', name: 'English', dir: 'ltr', numberLocale: 'en-US' },
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

// ---------- Texts ----------

const AR: Strings = {
  title: 'التوأم الرقمي للمجموعة الشمسية',
  tagline: 'المواقع الحقيقية للكواكب وأكتر من 2,000 كويكب ومذنب',
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
};

const DE: Strings = {
  title: 'Digitaler Zwilling des Sonnensystems',
  tagline: 'Die echten Positionen der Planeten und von über 2.000 Asteroiden und Kometen',
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
};

const EN: Strings = {
  title: 'Digital Twin of the Solar System',
  tagline: 'The real positions of the planets and over 2,000 asteroids and comets',
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
