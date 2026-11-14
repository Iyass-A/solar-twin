import { defineConfig } from 'vite';

// On GitHub Pages the site lives under /solar-twin/.
// Locally (npm run dev) it stays at the root, so nothing changes on your machine.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/solar-twin/' : '/',
  build: {
    // Three.js alone is about 570 kB (140 kB zipped). It is already its own file,
    // loaded after the page, so the default 500 kB warning is just noise.
    chunkSizeWarningLimit: 700,
  },
});
