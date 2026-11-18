// Records the video stage (video.html) into an MP4 file (phase 8, step 3).
//
//   npm run build            (or GITHUB_ACTIONS=1 npx vite build, as on GitHub)
//   node scripts/record-video.mjs --lang ar --format 16x9 --from 2026-11-23 --days 7 --out sky-week.mp4
//
// Options: --lang ar|de|en, --format 16x9|9x16, --from YYYY-MM-DD (default: today, UTC), --days 7, --tz UTC,
// --event n (one event's scene only), --out file.mp4, --dist dist (the built site), --chrome path (or CHROME_PATH),
// --only 2,5 (record these scenes again and keep the others' files), --fps 30.
// Next to the video: a .txt file with a title and a description for publishing it (the events, the planets, the site).
//
// How: a small web server serves the built site; Chrome (without a window) opens video.html?...&record at half the
// video's size with device pixel ratio 2; for each frame the page draws exactly that moment (window.stage.seek)
// and we take a JPEG picture (quality 92). Each scene goes through ffmpeg into its own file (H.264, the same
// settings for all), first under a temporary name and renamed only when ffmpeg ends without error; then the files
// are joined without encoding them again (concat demuxer, -c copy). Needs Chrome and ffmpeg.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = /^--(\w+)$/.exec(process.argv[i]);
  if (m) args[m[1]] = process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? 'true' : process.argv[++i];
}
const lang = args.lang ?? 'ar';
const format = args.format === '9x16' ? '9x16' : '16x9';
const from = args.from ?? new Date().toISOString().slice(0, 10);
const days = Number(args.days ?? 7);
const tz = args.tz ?? 'UTC';
const fps = Number(args.fps ?? 30);
const out = path.resolve(args.out ?? `sky-${from}-${lang}-${format}.mp4`);
const dist = path.resolve(args.dist ?? 'dist');
const chrome = args.chrome ?? process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const only = args.only ? new Set(args.only.split(',').map(Number)) : null;
const work = `${out.replace(/\.mp4$/, '')}.scenes`;
const [cssW, cssH] = format === '9x16' ? [540, 960] : [960, 540];

if (!fs.existsSync(path.join(dist, 'video.html'))) {
  console.error(`No built site in ${dist} (video.html is missing): run "npm run build" first.`);
  process.exit(1);
}
fs.mkdirSync(work, { recursive: true });

// ---------- A web server for the built site, at / and at /solar-twin/ (as on GitHub Pages) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/solar-twin\//, '/');
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(dist, path.normalize(p));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------- Chrome ----------
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  // Only our own page on this machine is opened. WebGL without a graphics card: SwiftShader.
  args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--font-render-hinting=none'],
});
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
await page.setViewport({ width: cssW, height: cssH, deviceScaleFactor: 2 });
const query = new URLSearchParams({ lang, format, from, days: String(days), tz });
if (args.event !== undefined) query.set('event', args.event);
const url = `${origin}/solar-twin/video.html?${query}&record`;
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => window.stage.ready);
const plan = await page.evaluate((f) => window.stage.plan(f), fps);
// A text to go with the video when publishing it (title, events, planets, site), next to it as .txt
const description = await page.evaluate(() => window.stage.description());
const total = plan.reduce((n, s) => n + s.frames, 0);
console.log(`${url}\n${plan.length} scenes, ${total} frames (${(total / fps).toFixed(1)} s at ${fps} fps), ${cssW * 2}×${cssH * 2}`);

// ---------- One file per scene ----------
const ENCODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart'];
const files = [];
const t0 = Date.now();
for (let i = 0; i < plan.length; i++) {
  const s = plan[i];
  const file = path.join(work, `scene-${String(i).padStart(2, '0')}-${s.name}.mp4`);
  files.push(file);
  if (fs.existsSync(file) && only && !only.has(i)) { console.log(`  scene ${i} (${s.name}): kept`); continue; }
  const part = file.replace(/\.mp4$/, '.part.mp4'); // still ends in .mp4, renamed when ffmpeg is done
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...ENCODE, part],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  const ts = Date.now();
  for (let k = 0; k < s.frames; k++) {
    await page.evaluate((t) => window.stage.seek(t), s.start + k / fps);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92, optimizeForSpeed: true });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  const code = await done;
  if (code !== 0) { console.error(`ffmpeg failed on scene ${i} (exit ${code})`); process.exitCode = 1; break; }
  fs.renameSync(part, file);
  console.log(`  scene ${i} (${s.name}): ${s.frames} frames in ${((Date.now() - ts) / 1000).toFixed(1)} s`);
}
await browser.close();
server.close();

// ---------- Join them, without encoding again ----------
if (!process.exitCode) {
  const list = path.join(work, 'scenes.txt');
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const part = out.replace(/\.mp4$/, '.part.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', part], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg could not join the scenes'); process.exitCode = 1; }
  else {
    fs.renameSync(part, out);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,nb_frames', '-of', 'csv=p=0', out], { encoding: 'utf8' });
    console.log(`VIDEO: ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${probe.stdout.trim().replace(/\n/g, ', ')}) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), description);
    console.log(`TEXT: ${out.replace(/\.mp4$/, '.txt')}\n${description}`);
  }
}
if (problems.length) console.log(`Page problems: ${problems.slice(0, 5).join(' | ')}`);
