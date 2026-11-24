#!/usr/bin/env node
/**
 * Arma los videos de la promo de la mascota (es/en · 16:9 y 9:16) y sus miniaturas.
 *
 *   node scripts/videos/promo/make-promo.mjs [es|en] [landscape|reel]
 *
 * 1. Corta los tramos de video del guion (storyboard.mjs) con ffmpeg.
 * 2. Compila el escenario (stage/main.tsx) con esbuild.
 * 3. Lo graba con capturas de Chrome (CDP screencast, JPEG) y lo pasa a mp4 H.264 30 fps.
 * 4. Miniaturas: el escenario en modo póster (PNG + JPG).
 *
 * Entradas: videos/promo/clips (record-clips.mjs) y videos/raw (grabaciones de las guías).
 * Salida: videos/promo/out/invoke-asistente-<locale>-<16x9|9x16>.mp4 y .jpg/.png
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { FORMATS, SEGMENTS, SOURCES, resolveTime } from './storyboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const BUILD = join(ROOT, 'videos', 'promo', 'build');
const OUT = join(ROOT, 'videos', 'promo', 'out');
const LOCALES = process.argv[2] ? [process.argv[2]] : ['es', 'en'];
const ONLY_FORMAT = process.argv[3];
const FPS = 30;

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const duration = (file) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());
/** Marcas, cajas para resaltar y tamaño de la grabación (record-clips.mjs). */
const clipInfo = (src, locale) => {
  return JSON.parse(readFileSync(join(ROOT, 'videos', 'promo', 'clips', `${src}-${locale}.json`), 'utf8'));
};
const marksOf = (src, locale) => clipInfo(src, locale).marks;

mkdirSync(BUILD, { recursive: true });
mkdirSync(OUT, { recursive: true });

// --- 1. Escenario -----------------------------------------------------------------
console.log('[promo] compilando el escenario');
run('npx', ['-y', 'esbuild@0.24.0', join(HERE, 'stage', 'main.tsx'), '--bundle', '--minify', '--format=iife', '--target=es2020',
  '--define:process.env.NODE_ENV="production"', '--jsx=automatic', `--outfile=${join(BUILD, 'stage.js')}`, '--log-level=warning']);
const logo = join(BUILD, 'logo.png');
if (!existsSync(logo)) run('ffmpeg', ['-y', '-v', 'error', '-i', join(ROOT, 'src/assets/brand/invokeia-logo.webp'), '-vf', 'scale=600:-1', logo]);
// Fondos de fotos (Canva): videos/promo/assets/bg-<formato>.png.
for (const format of Object.keys(FORMATS)) copyFileSync(join(ROOT, 'videos', 'promo', 'assets', `bg-${format}.png`), join(BUILD, `bg-${format}.png`));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

for (const locale of LOCALES) {
  // Capturas para la miniatura: la respuesta del chat y el checklist de onboarding
  // (escritorio para 16:9, celular para 9:16).
  const stillsFor = {};
  // El reproductor de videos, el asistente guiando y el menú de "Guías de esta pantalla".
  const SHOTS = {
    landscape: [['chat', 'video', 2.5, 'crop=900:760:40:320'], ['screen', 'group', 1.5, 'crop=630:760:1222:60'], ['guide', 'save', -3.0, 'crop=1500:900:0:120']],
    reel: [['m-chat', 'video', 2.0, 'null'], ['m-guide', 'guide', 3.0, 'null'], ['m-screen', 'group', 1.5, 'null']],
  };
  for (const [format, shots] of Object.entries(SHOTS)) {
    stillsFor[format] = [];
    for (const [src, mark, offset, crop] of shots) {
      const name = `still-${format}-${src}-${locale}.png`;
      const at = marksOf(src, locale)[mark] / 1000 + offset;
      run('ffmpeg', ['-y', '-v', 'error', '-ss', String(at), '-i', join(ROOT, SOURCES[src](locale)), '-frames:v', '1', '-vf', `${crop},scale=840:-1:flags=lanczos`, join(BUILD, name)]);
      stillsFor[format].push(name);
    }
  }

  for (const format of Object.keys(FORMATS)) {
    if (ONLY_FORMAT && ONLY_FORMAT !== format) continue;
    const { width, height } = FORMATS[format];
    const tag = `${locale}-${format}`;
    const dir = join(BUILD, tag);
    mkdirSync(dir, { recursive: true });

    // --- 2. Tramos ------------------------------------------------------------------
    const segments = {};
    for (const [id, seg] of Object.entries(SEGMENTS[format])) {
      const info = clipInfo(seg.src, locale);
      const marks = info.marks;
      const shift = seg.shift?.[locale] ?? 0;
      const from = resolveTime(seg.from, marks) + shift;
      const to = resolveTime(seg.to, marks) + shift;
      const file = join(dir, `seg-${id}.webm`);
      run('ffmpeg', ['-y', '-v', 'error', '-ss', String(from), '-to', String(to), '-i', join(ROOT, SOURCES[seg.src](locale)),
        '-vf', `setpts=PTS/${seg.speed},fps=${FPS}`, '-an', '-c:v', 'libvpx-vp9', '-crf', '20', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-g', String(FPS), file]);
      segments[id] = { src: `${tag}/seg-${id}.webm`, dur: duration(file), w: info.size[0], h: info.size[1] };
      // Dictado: el texto se "transcribe" mientras se escribe la pregunta en el clip.
      if (id === 'ask' && 'typed' in marks) {
        segments[id].reveal = { start: (marks.typing / 1000 - from) / seg.speed, end: (marks.typed / 1000 - from) / seg.speed };
      }
      // Resaltado: la caja que guardó la grabación, en el segundo del tramo en que toca.
      if (seg.hl && info.boxes?.[seg.hl[0]]) {
        segments[id].hl = { t: (resolveTime([seg.hl[1], seg.hl[2]], marks) - from) / seg.speed, box: info.boxes[seg.hl[0]] };
      }
    }

    for (const poster of [false, true]) {
      const promo = { format, locale, poster, segments, logo: 'logo.png', bg: `bg-${format}.png`, stills: stillsFor[format] };
      const html = join(BUILD, `${tag}${poster ? '-poster' : ''}.html`);
      writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head><body><div id="root"></div><script>window.__PROMO=${JSON.stringify(promo)}</script><script src="stage.js"></script></body></html>`);

      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(pathToFileURL(html).href);
      const name = `invoke-asistente-${locale}-${format === 'reel' ? '9x16' : '16x9'}`;

      if (poster) {
        // --- 4. Miniatura --------------------------------------------------------
        await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.images].every((i) => i.complete), null, { timeout: 30_000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(OUT, `${name}.png`) });
        run('ffmpeg', ['-y', '-v', 'error', '-i', join(OUT, `${name}.png`), '-q:v', '2', join(OUT, `${name}.jpg`)]);
        await page.close();
        console.log(`[promo] miniatura ${name}`);
        continue;
      }

      // --- 3. Grabación ----------------------------------------------------------------
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
      await page.waitForTimeout(500);
      const framesDir = join(dir, 'frames');
      rmSync(framesDir, { recursive: true, force: true });
      mkdirSync(framesDir, { recursive: true });
      const cdp = await page.context().newCDPSession(page);
      const frames = [];
      let writing = Promise.resolve();
      cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
        const file = join(framesDir, `${String(frames.length).padStart(6, '0')}.jpg`);
        frames.push({ file, ts: metadata.timestamp });
        writing = writing.then(() => writeFileSync(file, Buffer.from(data, 'base64')));
        void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
      await page.waitForTimeout(300);
      const startTs = Date.now() / 1000;
      await page.evaluate(() => window.__start());
      await page.waitForFunction(() => window.__done === true, null, { timeout: 300_000, polling: 200 });
      const endTs = Date.now() / 1000;
      await cdp.send('Page.stopScreencast');
      await writing;
      await page.close();

      // Cada cuadro dura hasta el siguiente (el screencast sólo manda cuadros cuando algo cambia).
      const usable = frames.filter((f, i) => f.ts >= startTs - 0.05 || frames[i + 1]?.ts > startTs);
      const lines = [];
      usable.forEach((f, i) => {
        const next = usable[i + 1]?.ts ?? endTs;
        lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - Math.max(f.ts, startTs)).toFixed(4)}`);
      });
      lines.push(`file '${usable[usable.length - 1].file}'`);
      const list = join(dir, 'frames.txt');
      writeFileSync(list, lines.join('\n'));
      const out = join(OUT, `${name}.mp4`);
      run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${FPS},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-movflags', '+faststart', out]);
      const fps = (usable.length / (endTs - startTs)).toFixed(1);
      console.log(`[promo] ${name}.mp4 · ${duration(out).toFixed(1)} s · ${usable.length} cuadros capturados (~${fps} fps)`);
    }
  }
}
await browser.close();
