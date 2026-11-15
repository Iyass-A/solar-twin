# Solar Twin

**A live digital twin of the solar system, in your browser.**
التوأم الرقمي للمجموعة الشمسية · Digitaler Zwilling des Sonnensystems

**Open it:** https://iyass-a.github.io/solar-twin/ (Arabic, German, English)

![The planets, asteroids and comets around the Sun in 3D, with the real stars behind them](public/og.jpg)

Version 0.3, public beta.

## What you can do

- **See where the planets are right now**, or on any date from 1800 to 2050. Drag the time bar, play time at a day up to a year per second, or jump to a date.
- **3D view.** Turn and zoom the scene, and follow a planet with the camera while time runs. Saturn's rings sit at their real tilt, and the 5,080 stars visible to the naked eye are in their true places behind.
- **Map from above (2D)**, with all planets at compressed distances, all at true distances, or just the inner planets.
- **Asteroids, dwarf planets and comets**: about 2,100 from JPL, as coloured dots: every near-Earth asteroid of about 1 km and larger, the 400 brightest numbered asteroids of the main belt and Jupiter trojans, the 300 brightest bodies beyond Neptune, all numbered periodic comets, and 36 well-known ones such as Ceres, Apophis, Bennu, Pluto, Halley and Hale-Bopp, with their names in three languages. Find any of them by name or number, see its orbit, follow it, and read its type and size.
- **Uncertainty clouds.** Around a picked asteroid or comet (1,690 of them have one), 300 possible orbits that all fit JPL's observations show where it could really be: ±80 m for Ceres, ±110 km for 2024 YR4, nearly a million km for Arrokoth. Too small to see at this scale, the cloud is drawn enlarged and says by how much; its shape and its size in km are real.
- **Close approaches to Earth, live.** Every asteroid and comet passing closer than 7.5 million km (19.5 times the Moon's distance), from a week ago to two months ahead, from NASA/JPL's CNEOS, refreshed every 3 hours: when, how close (in lunar distances and km, with the range where the orbit is still uncertain), how fast, and about how big. Those on the map can be picked from the list.
- **Space weather, live.** NOAA's storm levels now, over the last 24 hours and for the next days (radio blackouts, solar radiation storms, geomagnetic storms), the 3-hour Kp index of the last 3 days with its forecast as a chart, the solar flares of the last week, and the clouds from the Sun (CMEs) that NASA's WSA-Enlil model expects to reach Earth.
- **Deep Space Network, live.** Which spacecraft NASA's antennas at Goldstone, Madrid and Canberra are talking to right now (NASA's DSN Now), refreshed every minute: how many are in contact and the farthest, and for each antenna the spacecraft, its data rate, its distance, how long its signal takes, and roughly where it is.
- **Pick a planet** to see its distance from the Sun and from Earth, and how long its light takes to reach us.
- **Three languages.** Arabic (right to left), German and English. Add `?lang=ar`, `?lang=de` or `?lang=en` to the address to share a link in one language.

## How accurate is it?

Planet positions are computed from JPL's Keplerian elements (Table 1, valid 1800 to 2050).
Every build compares them with [Astronomy Engine](https://github.com/cosinekitty/astronomy) on every 10th day of that range, 9,168 dates in all.
The largest difference is **0.20°** (Saturn, 1911); the build fails above 1°.
The page also runs this check for the date on screen.

Asteroids and comets use the same kind of Sun-only orbit, from JPL's current elements. Each build compares every one of them with JPL Horizons every 5 years over 25 years each way, and the site shows a body only in the years where it stays within 1°. That is the whole 50 years for 603 of the 2,092, and at least 30 years for half of them; close encounters cut the others short (Apophis, for example, passes Earth in 2029).

The uncertainty clouds are drawn from each orbit's covariance in JPL's Small-Body Database. For every body with a cloud, each build compares the cloud's size with Horizons' own position uncertainty, computed with full dynamics: all 1,690 are within 0.8 to 1.25 times of it (median 1.00). For 79 of them it also checks that the samples reproduce the covariance, within the statistical noise of 4,000 samples. A cloud that does not match Horizons is not drawn (61 bodies), and neither is one for a body whose orbit fit includes forces other than gravity (a comet's outgassing, the Yarkovsky push of sunlight; Apophis, most comets), because there our Sun-only samples are off by up to ten times.

That is plenty for seeing where things are, but it is not meant for pointing a telescope or planning a spacecraft.

## How it works

| Part | File |
| --- | --- |
| Julian Date and time since J2000 | `src/astro/julian.ts` |
| Keplerian elements from JPL | `src/astro/elements.ts` |
| Kepler's equation, positions and orbits | `src/astro/kepler.ts` |
| Equatorial to ecliptic coordinates | `src/astro/frames.ts` |
| Saturn's pole (IAU) | `src/astro/poles.ts` |
| Asteroid and comet orbits (Sun only, any eccentricity below 1) | `src/astro/smallbody.ts` |
| Uncertainty clouds: possible orbits from JPL's covariance | `src/astro/uncertainty.ts` |
| Fetching asteroid and comet data from JPL (runs on GitHub) | `scripts/fetch-small-bodies.ts`, `.github/workflows/fetch-small-bodies.yml` |
| Asteroids and comets for the views; covariances loaded when one is picked | `src/view/smallbodies.ts`, `public/data/cov/` |
| Live data: close approaches to Earth (fetched on GitHub before each deploy, checked, never committed) | `scripts/fetch-close-approaches.ts`, `src/live/closeApproaches.ts`, `src/view/approaches.ts` |
| Live data: space weather, and the Kp chart | `scripts/fetch-space-weather.ts`, `src/live/spaceWeather.ts`, `src/view/spaceWeather.ts`, `src/view/kpChart.ts` |
| Live data: Deep Space Network, through a small server on Cloudflare Workers (see below) | `workers/dsn/`, `src/live/dsn.ts`, `src/view/dsn.ts`, `src/data/spacecraft.ts`, `.github/workflows/deploy-worker.yml` |
| 2D map (canvas) | `src/view/orrery.ts` |
| 3D scene (Three.js) and the stars | `src/view/scene3d.ts`, `src/view/stars.ts` |
| Texts in three languages | `src/i18n.ts` |
| All self-checks | `scripts/check.ts` |

Everything runs in the browser, with no cookies; only the chosen language is saved in your browser. Nothing is loaded from other sites except the Deep Space Network data: it changes every few seconds, so the page asks our own small server for it once a minute while the tab is visible (`solar-twin-dsn.solar-twin.workers.dev`, on Cloudflare Workers). That server asks NASA at most once a minute however many people look, answers only pages on this site, sets no cookies and keeps no logs. The other live data is fetched from JPL, NOAA and NASA on GitHub, every 3 hours and before each deploy, and published as files with the site. If a source does not answer, the previous data stays, and the page says how old it is.

## Run it locally

You need [Node.js](https://nodejs.org/) 22 or newer.

```
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

Run all checks (accuracy, 3D mapping, Saturn's tilt, star data, texts in three languages). The last line must say `RESULT: OK`:

```
npm run check
```

Every push to `main`, and a run every 3 hours, fetches the live data, runs the checks, builds the site and publishes it to GitHub Pages.
Locally there is no live data, and the live cards say so. The Deep Space Network server is published by its own workflow, only when the repository has the secrets `CLOUDFLARE_API_TOKEN` (a token that may only edit Workers on one account) and `CLOUDFLARE_ACCOUNT_ID`; without them it does nothing.

## Data and libraries

- Planet elements: E. M. Standish, JPL, [Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Accuracy check: [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross (MIT)
- Saturn's pole: Archinal et al. 2018, [Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015](https://doi.org/10.1007/s10569-017-9805-5)
- Stars: Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991), in the [JSON conversion by Bretton Wade](https://github.com/brettonw/YaleBrightStarCatalog) (MIT). `scripts/make-stars.ts` turns it into `src/data/stars.json`.
- Asteroids and comets: orbits and their covariance from the [JPL Small-Body Database](https://ssd-api.jpl.nasa.gov/doc/sbdb.html), checked against [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/). The well-known bodies are listed in `data/small-bodies.txt`, the groups in `data/small-body-groups.json`; the "Fetch small-body data" workflow refreshes them into the branch `data-update` for review.
- Close approaches: [CNEOS](https://cneos.jpl.nasa.gov/ca/), NASA/JPL, through the [SBDB Close-Approach Data API](https://ssd-api.jpl.nasa.gov/doc/cad.html). Sizes without a measured diameter are estimated from the brightness (albedo 0.05 to 0.25), as CNEOS does.
- Space weather: [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/) (storm scales, Kp index and forecast, GOES flares), and CME arrival forecasts from NASA's [DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) (CCMC, WSA-Enlil model, experimental) through api.nasa.gov.
- Deep Space Network: [DSN Now](https://eyes.nasa.gov/dsn/), NASA/JPL (`dsn.xml` and `config.xml`), read by our server on Cloudflare Workers.
- 3D: [Three.js](https://threejs.org/) (MIT)

Their licence notices are collected in `public/THIRD-PARTY-LICENSES.txt`, which is published with the site.

## Licence

Solar Twin is free software, licensed under the [GNU Affero General Public License v3.0 or later](LICENSE).
You may use, study, change and share it. If you share a changed version, or run one as a website for others,
you must make its complete source code available under the same licence.

```
Solar Twin: a live digital twin of the solar system
Copyright (C) 2026 Iyass-A

This program is free software: you can redistribute it and/or modify it under the terms of
the GNU Affero General Public License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU Affero General Public License for more details.
```

## What's next

A "now" screen that brings the live data together, a physics sandbox to "branch reality", a trip planner, and a guide you can ask questions in three languages.

Found something wrong, or have an idea? [Open an issue](https://github.com/Iyass-A/solar-twin/issues/new).

See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.
