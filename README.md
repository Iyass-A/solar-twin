# Solar Twin

**A live digital twin of the solar system, in your browser.**
التوأم الرقمي للمجموعة الشمسية · Digitaler Zwilling des Sonnensystems

**Open it:** https://iyass-a.github.io/solar-twin/ (Arabic, German, English)

![The inner planets around the Sun in 3D, with a spacecraft half way along its path from Earth to Mars](public/og.jpg)

Version 0.6, public beta.

## What you can do

- **See where the planets are right now**, or on any date from 1800 to 2050. Drag the time bar, play time at a day up to a year per second, or jump to a date.
- **3D view.** Turn and zoom the scene, and follow a planet with the camera while time runs. Saturn's rings sit at their real tilt, and the 5,080 stars visible to the naked eye are in their true places behind.
- **Map from above (2D)**, with all planets at compressed distances, all at true distances, or just the inner planets.
- **Asteroids, dwarf planets and comets**: about 2,100 from JPL, as coloured dots: every near-Earth asteroid of about 1 km and larger, the 400 brightest numbered asteroids of the main belt and Jupiter trojans, the 300 brightest bodies beyond Neptune, all numbered periodic comets, and 36 well-known ones such as Ceres, Apophis, Bennu, Pluto, Halley and Hale-Bopp, with their names in three languages. Find any of them by name or number, see its orbit, follow it, and read its type and size.
- **Uncertainty clouds.** Around a picked asteroid or comet (1,690 of them have one), 300 possible orbits that all fit JPL's observations show where it could really be: ±80 m for Ceres, ±110 km for 2024 YR4, nearly a million km for Arrokoth. Too small to see at this scale, the cloud is drawn enlarged and says by how much; its shape and its size in km are real.
- **Now in space.** One screen for the live data: a tile each for the Deep Space Network, space weather and close approaches, with the headline and when it was last updated, and one for the sky events of the next days. Pick a tile to open its card. Links can open it directly: add `#now-dsn`, `#now-weather`, `#now-approaches` or `#now-events` to the address.
- **Sky events.** What happens in the sky in the next 7 or 30 days, worked out in your browser: the Moon's phases, solar and lunar eclipses (with where a total or annular one is best seen), planets at conjunction with the Sun or at opposition, Mercury and Venus at greatest elongation, the Moon passing a bright planet and two planets close together in the sky (with a note when they are too near the Sun to see), equinoxes and solstices, Earth's perihelion and aphelion, and asteroids passing closer than the Moon. Each says how to see it, and a button takes the views to its moment.
- **The week's sky as a video (in progress).** [`video.html`](https://iyass-a.github.io/solar-twin/video.html) plays the coming week's events as scenes at video size, wide (16:9) or upright (9:16), in three languages: an opening card beside the solar system listing the week's events, numbered, each event from outside the solar system (the 3D view, the camera turning slowly) and in the sky seen from the Earth (the stars, the Sun, the Moon with its real phase, the planets, the Earth's shadow in a lunar eclipse, a solar eclipse seen from the centre of its path), with the clock running faster, the card's texts and its number ("Event 2 of 3"), a thin line showing how far the video is, and a closing card. Add `?event=3` for one event, `&format=9x16`, `&lang=de`, `&from=2027-07-15`, `&tz=Asia/Damascus`. The page brings its own fonts (Inter and Noto Sans Arabic, from this site), so a video looks the same wherever it is made. `npm run video` records it into an MP4 file (1920 × 1080 or 1080 × 1920, 30 frames a second), and so does the "Render sky video" workflow on GitHub (by hand; the video is kept with the run for 14 days).
- **Close approaches to Earth, live.** Every asteroid and comet passing closer than 7.5 million km (19.5 times the Moon's distance), from a week ago to two months ahead, from NASA/JPL's CNEOS, refreshed every 3 hours: when, how close (in lunar distances and km, with the range where the orbit is still uncertain), how fast, and about how big. Those on the map can be picked from the list.
- **Space weather, live.** NOAA's storm levels now, over the last 24 hours and for the next days (radio blackouts, solar radiation storms, geomagnetic storms), the 3-hour Kp index of the last 3 days with its forecast as a chart, the solar flares of the last week, and the clouds from the Sun (CMEs) that NASA's WSA-Enlil model expects to reach Earth.
- **Deep Space Network, live.** Which spacecraft NASA's antennas at Goldstone, Madrid and Canberra are talking to right now (NASA's DSN Now), refreshed every minute: how many are in contact and the farthest, and for each antenna the spacecraft, its data rate, its distance, how long its signal takes, and roughly where it is.
- **Branch reality (experimental).** Take a copy of the solar system at the date on screen, change one thing (take a planet out, change the Sun's or a planet's mass, push a planet faster or slower, or let a star pass), and watch both run on: the copy's planets are empty circles with their recent path, and a dotted line to where the real planet is. A table compares each planet with reality at the same moment: its year on its orbit now, its distance from the Sun, and how far it is from where it would be. Three ready-made scenarios start with one click, each with what it shows: what if Jupiter vanished in 1900, what if the Sun were twice as heavy, and a star like the Sun passing 1,000 au away (or 50). Each has a link of its own: `#branch-jupiter`, `#branch-sun`, `#branch-star`, `#branch-star50`. Our own physics engine computes it in the background (gravity between the Sun and the planets, with general relativity).
- **Trip planner (experimental).** How long a trip from Earth to another planet takes, the two burns it needs (to leave a 300 km orbit round Earth and to stop in one round the target, with the launch energy C3), and the launch window next to the date on screen, with a button that goes there: for Mars, 259 days, 3.59 + 2.09 km/s, and Mars must be 44° ahead of Earth at launch, which next happens on 4 December 2026 and then about every 26 months. That is the textbook Hohmann transfer between circular orbits, an estimate. Below it, the exact trip for any two dates you choose, on the real orbits (Lambert's problem): leaving Earth on 31 October 2026 and reaching Mars on 19 August 2027 takes 292 days and a launch energy C3 of 9.18 km²/s², as in NASA's mission design handbook, while the Hohmann estimate's own dates would need more than twice that. Between the two, a porkchop map of launch dates: every launch day and time on the way round the window, worked out exactly and coloured by launch energy or by both burns, with the cheapest trip of each type marked; tap a point to see its numbers. The trip worked out can be shown in the 3D view and on the map, and played: time runs from launch to arrival (in the inner view for trips out to Mars), and a small diamond, the spacecraft, follows its path round the Sun until it meets the planet, with the time its radio signal takes next to it. A chart shows that signal delay for each day of the trip (seconds after launch, 15.7 minutes one way when the craft reaches Mars in 2027, over 4 hours at Neptune), the longest, and the days when the craft is within 2° of the Sun in Earth's sky, when NASA's Mars missions send no commands. The 36 well-known asteroids and comets are targets too: no Hohmann estimate there, but a map over three years of launch days with every trip worked out exactly, arrivals only in the years the site knows where the body is, and the burn to match its speed on arrival (to Bennu: about 4.9 km/s in all, leaving in September 2029).
- **Pick a planet** to see its distance from the Sun and from Earth, and how long its light takes to reach us.
- **Three languages.** Arabic (right to left), German and English. Add `?lang=ar`, `?lang=de` or `?lang=en` to the address to share a link in one language.

## How accurate is it?

Planet positions are computed from JPL's Keplerian elements (Table 1, valid 1800 to 2050).
Every build compares them with [Astronomy Engine](https://github.com/cosinekitty/astronomy) on every 10th day of that range, 9,168 dates in all.
The largest difference is **0.20°** (Saturn, 1911); the build fails above 1°.
The page also runs this check for the date on screen.

Asteroids and comets use the same kind of Sun-only orbit, from JPL's current elements. Each build compares every one of them with JPL Horizons every 5 years over 25 years each way, and the site shows a body only in the years where it stays within 1°. That is the whole 50 years for 603 of the 2,092, and at least 30 years for half of them; close encounters cut the others short (Apophis, for example, passes Earth in 2029).

The uncertainty clouds are drawn from each orbit's covariance in JPL's Small-Body Database. For every body with a cloud, each build compares the cloud's size with Horizons' own position uncertainty, computed with full dynamics: all 1,690 are within 0.8 to 1.25 times of it (median 1.00). For 79 of them it also checks that the samples reproduce the covariance, within the statistical noise of 4,000 samples. A cloud that does not match Horizons is not drawn (61 bodies), and neither is one for a body whose orbit fit includes forces other than gravity (a comet's outgassing, the Yarkovsky push of sunlight; Apophis, most comets), because there our Sun-only samples are off by up to ten times.

The physics engine behind "branch reality" starts from JPL Horizons on 15 November 2026 and computes gravity between the Sun, the planets and the large moons itself, with general relativity near the Sun and the giant planets' bulges. Each build runs it back to 1800 and on to 2050 and compares it with Astronomy Engine every 30 days: every planet stays within **0.02°** (Mercury), a tenth of the Kepler positions above; the build fails above 0.05°. After a year it is within 50 km of Horizons for every planet, and the large moons within 0.22° of their orbit.

The trip planner's Hohmann transfer reproduces the worked example in Curtis' *Orbital Mechanics for Engineering Students* (Earth to Mars: v∞ 2.943 and 2.648 km/s, 258.8 days, Mars 44.3° ahead, 3.590 km/s from a 300 km orbit), and each build flies every trip with an independent Kepler propagator and finds every launch window from 1800 to 2050 (2,036 of them, one per synodic period; the synodic periods agree with NASA's fact sheets within 0.05 day). Its Lambert solver reproduces the worked examples in Curtis (5.2) and Vallado (7-5), finds again 397 orbits flown first with the propagator (velocities within 10⁻¹⁰ of the speed), and for NASA's three best 2026 Mars trajectories (Burke et al. 2010, NASA/TM-2010-216764) gives the launch energy within 0.7%, the arrival speed within 0.001 km/s and the launch declination within 0.15°. Its porkchop map finds the cheapest launch energy of every Mars opportunity from 2026 to 2045 within 0.9% of the handbook's table, of the same type each time. Its signal delay, at Mars every 5 days for a year, is within 0.01 s of JPL Horizons, and its 2° limit puts Mars near the Sun on the days NASA paused commanding its Mars missions in 2019, 2021 and 2023. Against JPL's own [Small-Body Mission Design tool](https://ssd-api.jpl.nasa.gov/doc/mdesign.html), the same calculation on JPL Horizons' states gives the same trips to Eros, Vesta, Psyche, Didymos, Bennu, Ceres, Ryugu and comet 67P: 3,856 of them up to 30 km/s, to the rounding of JPL's numbers (both v∞ within 0.002 km/s, the angles within 0.01°), with the same choice among paths that go round the Sun up to four whole times first. With the site's own asteroid states, 404 of JPL's picked missions in the years the site shows those bodies match at launch and at arrival within 0.005 km/s (median), and the planner's maps find launch speeds at least as low as JPL's 10-day grid.

The sky events come from Astronomy Engine, seen from the Earth's centre with light time and aberration. Each build compares two years of them with the almanacs: the 2027 conjunctions and oppositions are within 5 minutes of the National Astronomical Observatory of Japan (NAOJ), and its greatest elongations within the hour it gives; all nine eclipses of 2026 and 2027 are of NASA's kind, with their peaks within 6 seconds; all 49 Moon phases of 2027 and the equinoxes and solstices are within about a minute of the US Naval Observatory; and close approaches in the sky match published ones (the 2020 great conjunction, 0.10°). Earth's perihelion and aphelion are given to the hour only: near them the distance hardly changes, and the time can be off by half an hour. The video's sky agrees with Astronomy Engine's own eclipses: drawn with its Earth's shadow, every lunar eclipse of 2026 and 2027 reaches the umbra or only the penumbra as its kind says, and at each central solar eclipse's peak, seen from the centre of its path, the Moon sits on the Sun, larger than it for a total eclipse and smaller for an annular one.

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
| The "Now in space" screen: a tile for each live source, one card at a time | `src/view/now.ts` |
| Sky events of the next days (conjunctions, oppositions, elongations, Moon phases, eclipses, seasons, close approaches in the sky), and their card | `src/events/events.ts`, `src/view/skyEvents.ts` |
| The weekly video: the sky seen from the Earth (directions, chart, Moon phase, shadows), a scene for each kind of event, the chart's drawing, and the stage that plays them | `src/video/sky.ts`, `src/video/scenes.ts`, `src/view/skyChart.ts`, `video.html`, `src/video/stage.ts` |
| Recording the stage into an MP4 (Chrome without a window, a picture per frame, ffmpeg per scene, joined without encoding again), locally or on GitHub | `scripts/record-video.mjs`, `.github/workflows/render-video.yml` |
| Live data: Deep Space Network, through a small server on Cloudflare Workers (see below) | `workers/dsn/`, `src/live/dsn.ts`, `src/view/dsn.ts`, `src/data/spacecraft.ts`, `.github/workflows/deploy-worker.yml` |
| Physics engine (in progress): bodies and masses, and their starting state from JPL Horizons (runs on GitHub) | `src/physics/bodies.ts`, `src/physics/state.ts`, `src/data/state-vectors.json`, `scripts/fetch-state-vectors.ts`, `.github/workflows/fetch-state-vectors.yml` |
| Physics engine (in progress): the N-body integrator (leapfrog and Yoshida 4th order, with the giant planets' equatorial bulges and relativity near the Sun) | `src/physics/nbody.ts` |
| Physics engine (in progress): runs in a Web Worker, towards the latest time asked, in slices of a few ms; the page's side, the messages, and a browser test page | `src/physics/worker.ts`, `src/physics/engine.ts`, `src/physics/client.ts`, `src/physics/protocol.ts`, `scripts/browser/physics-worker.html` |
| "Branch reality": the card with its comparison, and the copy's planets on the map and in 3D; a planet's year from its position and velocity, and where it is a few days on | `src/view/branch.ts`, `src/view/orrery.ts`, `src/view/scene3d.ts`, `src/physics/orbit.ts` |
| The ready-made scenarios, with the numbers their texts give (checked by `npm run check`) | `src/physics/scenarios.ts` |
| 2D map (canvas) | `src/view/orrery.ts` |
| 3D scene (Three.js) and the stars | `src/view/scene3d.ts`, `src/view/stars.ts` |
| Texts in three languages | `src/i18n.ts` |
| Trip planner: the Hohmann transfer, burns from and into a low orbit, launch windows; the card | `src/transfer/hohmann.ts`, `src/view/trip.ts` |
| Trip planner: Lambert's problem, the planets' exact states, a trip for two dates | `src/transfer/lambert.ts` |
| Trip planner: the porkchop map of launch dates, the cheapest trips, and its drawing | `src/transfer/porkchop.ts`, `src/view/porkchopMap.ts` |
| Trip planner: asteroids and comets as targets (destinations, their years, the map from the day on screen) | `src/transfer/lambert.ts` (`Destination`), `src/transfer/porkchop.ts` (`smallPorkchopRange`), `src/view/trip.ts` |
| Trip planner: the trip's path and spacecraft in the views | `src/view/trip.ts` (`frame`), `src/view/orrery.ts`, `src/view/scene3d.ts` |
| Trip planner: the signal delay along a trip, the days near the Sun, and its chart | `src/transfer/signal.ts`, `src/view/signalChart.ts` |
| Trip planner: reference trips from JPL's Small-Body Mission Design tool and Horizons (runs on GitHub, for the check) | `scripts/fetch-mission-design.ts`, `.github/workflows/fetch-mission-design.yml`, `scripts/reference/mission-design-jpl.json` |
| All self-checks | `scripts/check.ts`, `scripts/check-physics.ts`, `scripts/check-transfer.ts`, `scripts/check-events.ts`, `scripts/check-video.ts` |

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

Record the week's sky as a video (needs Google Chrome and [ffmpeg](https://ffmpeg.org/); takes a few minutes):

```
npm run build
npm run video -- --lang ar --format 16x9 --from 2026-11-23 --out sky.mp4
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
- Physics engine: positions and velocities of the Sun, planets, system barycentres and the seven largest moons from [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (DE441 and JPL's satellite ephemerides); masses (GM) from DE440 ([Park et al. 2021](https://doi.org/10.3847/1538-3881/abd414), as listed in JPL's [Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html)) and JPL's [satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par). The "Fetch state vectors" workflow prints them in its log for review. Oblateness (J2) of Jupiter (Folkner et al. 2017), Saturn ([Iess et al. 2019](https://doi.org/10.1126/science.aat2965)) and Neptune (Jacobson 2009), with the planets' poles from the IAU report above.
- Sky events: [Astronomy Engine](https://github.com/cosinekitty/astronomy) (positions, Moon phases, eclipses, seasons). Checked against the [NAOJ](https://eco.mtk.nao.ac.jp/koyomi/) phenomena of 2027, NASA's eclipse lists ([NASA Eclipse Web Site](https://eclipse.gsfc.nasa.gov/)), and the [US Naval Observatory](https://aa.usno.navy.mil/data/) (Moon phases, seasons).
- Trip planner: formulas from H. D. Curtis, *Orbital Mechanics for Engineering Students* (Hohmann transfer, interplanetary transfers, departure and capture, Lambert's problem) and D. A. Vallado, *Fundamentals of Astrodynamics and Applications* (Lambert with universal variables); planet radii from JPL's [Planetary Physical Parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html); the planets' exact states from Astronomy Engine. Checked against NASA's [Mission Design Handbook for Earth to Mars, 2026-2045](https://ntrs.nasa.gov/citations/20100037210) (Burke, Falck and McGuire 2010), and JPL's [Small-Body Mission Design API](https://ssd-api.jpl.nasa.gov/doc/mdesign.html) with [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) states (multiple revolutions as in Vallado). The 2° limit near the Sun comes from the pauses in commanding NASA's Mars missions at solar conjunction ([MAVEN, 2015](https://lasp.colorado.edu/maven/2015/06/03/mars-missions-to-pause-commanding-in-june-due-to-sun/); [NASA, 2021](https://www.nasa.gov/solar-system/nasas-mars-fleet-lies-low-with-sun-between-earth-and-red-planet)).
- 3D: [Three.js](https://threejs.org/) (MIT)
- Fonts of the video page: [Inter](https://github.com/rsms/inter) and [Noto Sans Arabic](https://github.com/notofonts/arabic) (SIL Open Font License), through Fontsource, served from this site. Videos are recorded with [Puppeteer](https://pptr.dev/) (Apache 2.0) and [ffmpeg](https://ffmpeg.org/).

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

A weekly video of the sky's events, made from the site itself, and a guide you can ask questions in three languages.

Found something wrong, or have an idea? [Open an issue](https://github.com/Iyass-A/solar-twin/issues/new).

See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.
