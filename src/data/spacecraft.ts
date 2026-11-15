// Spacecraft the Deep Space Network talks to, by DSN code (as in NASA's DSN Now): our names in the
// site's languages, and roughly where each one is. A spacecraft without an entry, or without a name in a
// language, gets NASA's name (config.xml), or else its code.
// "where" is left out for missions whose place changes soon (arrivals, ends of missions).

import type { Lang } from '../i18n';

export type Where =
  | 'interstellar' | 'kuiper' | 'jupiter' | 'toJupiter' | 'toTrojans' | 'toPsyche' | 'toApophis' | 'toAsteroid'
  | 'mars' | 'marsSurface' | 'toMars' | 'moon' | 'l1' | 'l2' | 'sun' | 'earth';

export const WHERE_KEYS: Where[] = ['interstellar', 'kuiper', 'jupiter', 'toJupiter', 'toTrojans', 'toPsyche', 'toApophis', 'toAsteroid',
  'mars', 'marsSurface', 'toMars', 'moon', 'l1', 'l2', 'sun', 'earth'];

type Entry = Partial<Record<Lang, string>> & { where?: Where };

export const SPACECRAFT: Record<string, Entry> = {
  VGR1: { ar: 'فوياجر 1', where: 'interstellar' },
  VGR2: { ar: 'فوياجر 2', where: 'interstellar' },
  NHPC: { ar: 'نيو هورايزنز', where: 'kuiper' },
  JNO: { ar: 'جونو', where: 'jupiter' },
  EURC: { ar: 'يوروبا كليبر', where: 'toJupiter' },
  LUCY: { ar: 'لوسي', where: 'toTrojans' },
  PSYC: { ar: 'سايكي', where: 'toPsyche' },
  // NASA's list still says OSIRIS-REx; since its sample came back (2023) the mission is OSIRIS-APEX
  ORX: { ar: 'أوزيريس-أبيكس', de: 'OSIRIS-APEX', en: 'OSIRIS-APEX', where: 'toApophis' },
  HYB2: { ar: 'هايابوسا 2', where: 'toAsteroid' },
  BEPI: { ar: 'بيبي كولومبو' },
  MRO: { ar: 'مركبة استطلاع المريخ', where: 'mars' },
  MROS: { ar: 'مركبة استطلاع المريخ', where: 'mars' },
  MVN: { ar: 'مافن', where: 'mars' },
  M01O: { ar: 'مارس أوديسي', where: 'mars' },
  M01S: { ar: 'مارس أوديسي', where: 'mars' },
  MEX: { ar: 'مارس إكسبريس', where: 'mars' },
  TGO: { ar: 'مركبة تتبّع غازات المريخ', where: 'mars' },
  EMM: { ar: 'مسبار الأمل', de: 'Hope (Emirates Mars Mission)', en: 'Hope (Emirates Mars Mission)', where: 'mars' },
  MSL: { ar: 'كيوريوسيتي', de: 'Curiosity (Mars Science Laboratory)', en: 'Curiosity (Mars Science Laboratory)', where: 'marsSurface' },
  M20: { ar: 'برسيفيرانس', de: 'Perseverance (Mars 2020)', en: 'Perseverance (Mars 2020)', where: 'marsSurface' },
  ESCB: { ar: 'إسكابيد الأزرق', where: 'toMars' },
  ESCG: { ar: 'إسكابيد الذهبي', where: 'toMars' },
  JWST: { ar: 'تلسكوب جيمس ويب الفضائي', de: 'James-Webb-Weltraumteleskop', where: 'l2' },
  RST: { ar: 'تلسكوب رومان الفضائي', de: 'Roman-Weltraumteleskop', where: 'l2' },
  GAIA: { ar: 'غايا', where: 'l2' },
  SOHO: { ar: 'سوهو', where: 'l1' },
  ACE: { where: 'l1' },
  WIND: { where: 'l1' },
  DSCO: { where: 'l1' },
  IMAP: { where: 'l1' },
  SWFO: { where: 'l1' },
  CGO: { where: 'l1' },
  SPP: { ar: 'مسبار باركر الشمسي', where: 'sun' },
  STA: { ar: 'ستيريو A', where: 'sun' },
  LRO: { ar: 'مركبة الاستطلاع القمري', where: 'moon' },
  KPLO: { ar: 'دانوري', de: 'Danuri (KPLO)', en: 'Danuri (KPLO)', where: 'moon' },
  CAPS: { ar: 'كابستون', where: 'moon' },
  THB: { ar: 'ثيميس B', where: 'moon' },
  THC: { ar: 'ثيميس C', where: 'moon' },
  CH2O: { ar: 'مدارية تشاندرايان 2', where: 'moon' },
  CHDR: { ar: 'مرصد تشاندرا للأشعة السينية', de: 'Röntgenobservatorium Chandra', en: 'Chandra X-ray Observatory', where: 'earth' },
  HST: { ar: 'تلسكوب هابل الفضائي', de: 'Hubble-Weltraumteleskop', where: 'earth' },
  XMM: { where: 'earth' },
  TESS: { where: 'earth' },
  MMS1: { where: 'earth' },
  MMS2: { where: 'earth' },
  MMS3: { where: 'earth' },
  MMS4: { where: 'earth' },
};

/** The name to show: ours in this language, else ours in English, else NASA's, else the code. */
export function spacecraftName(code: string, nasaName: string | null, l: Lang): string {
  const e = SPACECRAFT[code];
  return e?.[l] ?? e?.en ?? nasaName ?? code;
}
