// Names of the asteroids and comets in data/small-bodies.txt, in the site's three languages.
// Key: the line in data/small-bodies.txt. Each language: [short label for the scene, full name for the info panel].
// A body without an entry here uses JPL's name in every language.

import type { Lang } from '../i18n';

type Names = Record<Lang, [string, string]>;

/** Keep a Latin designation such as "2024 YR4" or "1P" in its own left-to-right order inside Arabic text. */
const ltr = (s: string) => `\u2066${s}\u2069`;

/** Numbered asteroid: "Eros (433)" in Arabic, "(433) Eros" in German, "433 Eros" in English. */
function asteroid(n: string, ar: string, de: string, en = de): Names {
  return { ar: [ar, `${ar} (${n})`], de: [de, `(${n}) ${de}`], en: [en, `${n} ${en}`] };
}

/** Comet: "مذنب هالي (1P)", "Komet 1P/Halley", "Comet 1P/Halley" (long-period: "Komet Hale-Bopp (C/1995 O1)"). */
function comet(des: string, ar: string, de: string, en = de, labelAll?: string): Names {
  const periodic = /^\d+P$/.test(des);
  const full = (word: string, name: string) => (periodic ? `${word} ${des}/${name}` : `${word} ${name} (${des})`);
  return {
    ar: [labelAll ?? ar, `مذنب ${ar} (${ltr(des)})`],
    de: [labelAll ?? de, full('Komet', de)],
    en: [labelAll ?? en, full('Comet', en)],
  };
}

export const SMALL_BODY_NAMES: Record<string, Names> = {
  '1': asteroid('1', 'سيريس', 'Ceres'),
  '2': asteroid('2', 'بالاس', 'Pallas'),
  '3': asteroid('3', 'جونو', 'Juno'),
  '4': asteroid('4', 'فيستا', 'Vesta'),
  '10': asteroid('10', 'هايجيا', 'Hygiea'),
  '16': asteroid('16', 'سايكي', 'Psyche'),
  '21': asteroid('21', 'لوتيتيا', 'Lutetia'),
  '243': asteroid('243', 'إيدا', 'Ida'),
  '433': asteroid('433', 'إيروس', 'Eros'),
  '1566': asteroid('1566', 'إيكاروس', 'Ikarus', 'Icarus'),
  '3200': asteroid('3200', 'فايثون', 'Phaethon'),
  '4179': asteroid('4179', 'توتاتيس', 'Toutatis'),
  '25143': asteroid('25143', 'إيتوكاوا', 'Itokawa'),
  '65803': asteroid('65803', 'ديديموس', 'Didymos'),
  '99942': asteroid('99942', 'أبوفيس', 'Apophis'),
  '101955': asteroid('101955', 'بينو', 'Bennu'),
  '162173': asteroid('162173', 'ريوغو', 'Ryugu'),
  '2024 YR4': {
    ar: ['2024 YR4', `الكويكب ${ltr('2024 YR4')}`],
    de: ['2024 YR4', 'Asteroid 2024 YR4'],
    en: ['2024 YR4', 'Asteroid 2024 YR4'],
  },
  '624': asteroid('624', 'هكتور', 'Hektor'),
  '3548': asteroid('3548', 'يوريباتيس', 'Eurybates'),
  '134340': asteroid('134340', 'بلوتو', 'Pluto'),
  '136199': asteroid('136199', 'إيريس', 'Eris'),
  '136108': asteroid('136108', 'هاوميا', 'Haumea'),
  '136472': asteroid('136472', 'ماكيماكي', 'Makemake'),
  '90377': asteroid('90377', 'سِدنا', 'Sedna'),
  '486958': asteroid('486958', 'أروكوث', 'Arrokoth'),
  '1P': comet('1P', 'هالي', 'Halley'),
  '2P': comet('2P', 'إنكه', 'Encke'),
  '9P': comet('9P', 'تمبل 1', 'Tempel 1'),
  '55P': comet('55P', 'تمبل-تتل', 'Tempel-Tuttle'),
  '67P': comet('67P', 'تشوريوموف-غيراسيمنكو', 'Tschurjumow-Gerassimenko', 'Churyumov-Gerasimenko', '67P'),
  '81P': comet('81P', 'وايلد 2', 'Wild 2'),
  '103P': comet('103P', 'هارتلي 2', 'Hartley 2'),
  '109P': comet('109P', 'سويفت-تتل', 'Swift-Tuttle'),
  'C/1995 O1': comet('C/1995 O1', 'هيل-بوب', 'Hale-Bopp'),
  'C/2020 F3': comet('C/2020 F3', 'نيووايز', 'NEOWISE'),
};

// Dwarf planets recognised by the IAU, by their line in data/small-bodies.txt
export const DWARF_PLANETS = new Set(['1', '134340', '136199', '136108', '136472']);
