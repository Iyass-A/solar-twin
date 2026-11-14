// Keplerian elements and their rates, from JPL "Approximate Positions of the Planets",
// Table 1: mean ecliptic and equinox of J2000, valid 1800 AD - 2050 AD.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
//
// a: semi-major axis [au]        e: eccentricity
// I: inclination [deg]           L: mean longitude [deg]
// w: longitude of perihelion [deg]   O: longitude of ascending node [deg]
// Each value has a rate per Julian century.

export type PlanetId =
  | 'mercury' | 'venus' | 'earth' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface Elements {
  a: number; e: number; I: number; L: number; w: number; O: number;
}

export interface PlanetElements {
  id: PlanetId;
  nameAr: string;
  base: Elements;
  rate: Elements;
}

export const PLANETS: PlanetElements[] = [
  {
    id: 'mercury', nameAr: 'عطارد',
    base: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, w: 77.45779628, O: 48.33076593 },
    rate: { a: 0.00000037, e: 0.00001906, I: -0.00594749, L: 149472.67411175, w: 0.16047689, O: -0.12534081 },
  },
  {
    id: 'venus', nameAr: 'الزهرة',
    base: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, w: 131.60246718, O: 76.67984255 },
    rate: { a: 0.00000390, e: -0.00004107, I: -0.00078890, L: 58517.81538729, w: 0.00268329, O: -0.27769418 },
  },
  {
    // JPL gives the Earth-Moon barycenter. It is at most ~4,700 km from Earth's centre.
    id: 'earth', nameAr: 'الأرض',
    base: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, w: 102.93768193, O: 0.0 },
    rate: { a: 0.00000562, e: -0.00004392, I: -0.01294668, L: 35999.37244981, w: 0.32327364, O: 0.0 },
  },
  {
    id: 'mars', nameAr: 'المريخ',
    base: { a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, w: -23.94362959, O: 49.55953891 },
    rate: { a: 0.00001847, e: 0.00007882, I: -0.00813131, L: 19140.30268499, w: 0.44441088, O: -0.29257343 },
  },
  {
    id: 'jupiter', nameAr: 'المشتري',
    base: { a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, w: 14.72847983, O: 100.47390909 },
    rate: { a: -0.00011607, e: -0.00013253, I: -0.00183714, L: 3034.74612775, w: 0.21252668, O: 0.20469106 },
  },
  {
    id: 'saturn', nameAr: 'زحل',
    base: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, w: 92.59887831, O: 113.66242448 },
    rate: { a: -0.00125060, e: -0.00050991, I: 0.00193609, L: 1222.49362201, w: -0.41897216, O: -0.28867794 },
  },
  {
    id: 'uranus', nameAr: 'أورانوس',
    base: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, w: 170.95427630, O: 74.01692503 },
    rate: { a: -0.00196176, e: -0.00004397, I: -0.00242939, L: 428.48202785, w: 0.40805281, O: 0.04240589 },
  },
  {
    id: 'neptune', nameAr: 'نبتون',
    base: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, w: 44.96476227, O: 131.78422574 },
    rate: { a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, w: -0.32241464, O: -0.00508664 },
  },
];
