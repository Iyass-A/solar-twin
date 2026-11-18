import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// On GitHub Pages the site lives under /solar-twin/.
// Locally (npm run dev) it stays at the root, so nothing changes on your machine.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/solar-twin/' : '/',
  build: {
    // Three.js alone is about 570 kB (140 kB zipped). It is already its own file,
    // loaded after the page, so the default 500 kB warning is just noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // The site, and the stage for the weekly video (phase 8)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        video: fileURLToPath(new URL('./video.html', import.meta.url)),
      },
    },
  },
});
