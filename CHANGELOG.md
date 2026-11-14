# Changelog

## Unreleased

- Licensed under the GNU AGPL v3.0 or later (`LICENSE`). Copyright (C) 2026 Iyass-A.
- 36 asteroids, dwarf planets and comets from JPL, in the 3D view and on the map: coloured dots by group (dwarf planet, asteroid, near-Earth asteroid, comet), with names in all three languages. Pick one (by tapping, or in the new table) to see its orbit, its type, size and distances, and to follow it with the camera. A switch hides them.
- Each of them shows only in the years where our Sun-only orbit stays within 1° of JPL Horizons (sampled every 5 years over 25 years each way); outside, the info panel says why.
- The data (current orbits, plus each orbit's covariance) comes from a GitHub workflow; `npm run check` compares it with JPL Horizons.
- Uncertainty clouds: around a picked asteroid or comet, 300 possible orbits drawn from JPL's covariance show where it could be, enlarged with a label when too small to see; the info panel gives the real size (1σ, in m or km). `npm run check` confirms the samples reproduce the covariance and that the clouds match Horizons' own uncertainty (0.93 to 1.25 times) for the 21 bodies that get one. Bodies with non-gravitational forces in their orbit fit get an explanation instead of a cloud.
- Fixes: "2024 YR4" and comet designations keep their order inside Arabic text; very precise orbits (Bennu) no longer lose their perihelion-time uncertainty to rounding.
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
