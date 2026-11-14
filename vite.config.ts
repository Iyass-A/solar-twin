import { defineConfig } from 'vite';

// On GitHub Pages the site lives under /solar-twin/.
// Locally (npm run dev) it stays at the root, so nothing changes on your machine.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/solar-twin/' : '/',
});
