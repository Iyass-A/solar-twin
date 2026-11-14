# Solar Twin

A live digital twin of the solar system, in the browser.

## Run locally

```
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

Accuracy check (compares with Astronomy Engine from 1800 to 2050):

```
npm run check
```

## Progress

- Step 1: time (Julian Date, centuries since J2000, self-check)
- Step 2: planet positions from JPL Keplerian elements (Table 1, 1800-2050), checked against Astronomy Engine
- Step 3: 2D map on a canvas (three views, mouse-wheel zoom) and a time bar: slider 1800-2050, play at different speeds, jump to a date, back to now
- Phase 2, step 1: 3D scene with Three.js (Sun, planets, orbits, ecliptic rings), next to the 2D map, sharing the same clock, time bar, views and selection
