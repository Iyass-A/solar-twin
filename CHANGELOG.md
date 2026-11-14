# Changelog

## Unreleased

- Licensed under the GNU AGPL v3.0 or later (`LICENSE`). Copyright (C) 2026 Iyass-A.
- Data for 36 asteroids, dwarf planets and comets from JPL: current orbits, plus each orbit's covariance (its uncertainty) for the coming uncertainty clouds. A GitHub workflow fetches them; `npm run check` compares our positions with JPL Horizons (largest difference a year from the epoch: 0.15°). Not shown on the site yet.
- The page links to its source code, and the licence notices of three.js, Astronomy Engine and the star data are published with it (`THIRD-PARTY-LICENSES.txt`).

## v0.2.0 (14 November 2026), public beta

- 3D view with Three.js, next to the 2D map and sharing its clock, time bar, views and selection: drag to turn, wheel or two fingers to zoom, double-click or ↺ to reset. Short lines show how far each planet is above or below the ecliptic.
- Follow a planet: the camera glides to it and keeps it in the middle while time runs. The followed planet is drawn bigger, so its lit and dark sides show.
- Saturn's rings (C, B, Cassini Division, A) at the real tilt from the IAU pole. The check confirms Saturn's known 26.73° axial tilt.
- The 5,080 stars visible to the naked eye (Yale Bright Star Catalogue, up to magnitude 6) in their true places, with their brightness and colour. ✦ hides them.
- Arabic, German and English, with a switch next to the title. The page turns right-to-left for Arabic; German uses decimal commas. The choice is remembered, and `?lang=` picks a language from a link.
- Version badge, link preview image and description, a feedback link and a sources line.
- Fixes: a planet's own dot no longer hides its name; the 2D map no longer stops after switching back from 3D; a light time just under a full hour no longer shows "60 minutes".

## v0.1.0 (14 November 2026)

- Planet positions from JPL Keplerian elements, 1800 to 2050, checked against Astronomy Engine (largest difference 0.20°).
- 2D map from above with three views, mouse-wheel zoom, and a time bar: slider, play at four speeds, jump to a date, back to now.
- Pick a planet to see its distance from the Sun and from Earth, and its light travel time.
- Automatic checks, build and publishing to GitHub Pages on every push.
