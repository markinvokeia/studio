#!/usr/bin/env node
/**
 * Arma las promos de la historia clínica: odontograma, estética y periodontograma, en 16:9 y 9:16,
 * en español e inglés, con su miniatura.
 *
 *   node scripts/videos/promo-clinical/make-promo.mjs [odo|aes|perio|all] [es|en|all] [landscape|reel|all]
 *
 * 1. Corta los tramos del guion (storyboard.mjs) de los clips de record-clips.mjs con ffmpeg.
 * 2. Compila el escenario (stage/main.tsx) con esbuild.
 * 3. Lo graba con capturas de Chrome (CDP screencast) y lo pasa a mp4 H.264 30 fps, sin audio.
 * 4. Miniatura: un cuadro del escenario en su momento más vistoso.
 *
 * Salida: videos/promo-clinical/out/invoke-<feature>-<locale>-<16x9|9x16>.mp4 y .jpg
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { FEATURES, FORMATS, SEGMENTS, TEXT, THEMES, THUMB, resolveTime, scenes } from './storyboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const CLIPS = join(ROOT, 'videos', 'promo-clinical', 'clips');
const BUILD = join(ROOT, 'videos', 'promo-clinical', 'build');
const OUT = join(ROOT, 'videos', 'promo-clinical', 'out');
const pick = (arg, all) => (arg && arg !== 'all' ? [arg] : all);
const ONLY_FEATURES = pick(process.argv[2], FEATURES);
const LOCALES = pick(process.argv[3], ['es', 'en']);
const ONLY_FORMATS = pick(process.argv[4], Object.keys(FORMATS));
const FPS = 30;

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const duration = (file) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());
const clipName = (src, format, locale) => `${format === 'reel' ? 'm-' : ''}${src}-${locale}`;
const clipInfo = (name) => JSON.parse(readFileSync(join(CLIPS, `${name}.json`), 'utf8'));

mkdirSync(BUILD, { recursive: true });
mkdirSync(OUT, { recursive: true });

console.log('[promo] compilando el escenario');
run('npx', ['-y', 'esbuild@0.24.0', join(HERE, 'stage', 'main.tsx'), '--bundle', '--minify', '--format=iife', '--target=es2020',
  '--define:process.env.NODE_ENV="production"', '--jsx=automatic', `--outfile=${join(BUILD, 'stage.js')}`, '--log-level=warning']);
const logo = join(BUILD, 'logo.png');
if (!existsSync(logo)) run('ffmpeg', ['-y', '-v', 'error', '-i', join(ROOT, 'src/assets/brand/invokeia-logo.webp'), '-vf', 'scale=420:-1', logo]);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

for (const feature of ONLY_FEATURES) for (const locale of LOCALES) for (const format of ONLY_FORMATS) {
  const { width, height } = FORMATS[format];
  const tag = `${feature}-${locale}-${format}`;
  const dir = join(BUILD, tag);
  mkdirSync(dir, { recursive: true });

  // --- 1. Tramos ------------------------------------------------------------------------
  const segments = {};
  for (const [id, seg] of Object.entries(SEGMENTS[feature][format])) {
    const name = clipName(seg.src, format, locale);
    const info = clipInfo(name);
    if (!info.ok) throw new Error(`el clip ${name} no terminó bien: volvé a grabarlo`);
    let from;
    let to;
    // Un paso opcional que no se grabó (otra pantalla en mobile): la escena se saltea
    try { from = Math.max(0, resolveTime(seg.from, info.marks)); to = resolveTime(seg.to, info.marks); } catch (e) { console.warn(`[promo] ${tag}: sin ${id} (${e.message})`); continue; }
    if (to - from < 0.8) { console.warn(`[promo] ${tag}: sin ${id} (tramo de ${(to - from).toFixed(1)} s)`); continue; }
    const file = join(dir, `seg-${id}.webm`);
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(from), '-to', String(to), '-i', join(CLIPS, `${name}.webm`),
      '-vf', `setpts=PTS/${seg.speed ?? 1},fps=${FPS}`, '-an', '-c:v', 'libvpx-vp9', '-crf', '20', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-g', String(FPS), file]);
    segments[id] = { src: `${tag}/seg-${id}.webm`, dur: duration(file), w: info.size[0], h: info.size[1], boxes: info.boxes, marks: info.marks };
  }
  const available = Object.keys(segments);
  copyFileSync(join(ROOT, 'videos', 'promo-clinical', 'assets', THEMES[feature].photo), join(BUILD, THEMES[feature].photo));

  {
    const promo = { format, locale, feature, segments, available, logo: 'logo.png', photo: THEMES[feature].photo };
    const html = join(BUILD, `${tag}.html`);
    writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head><body><div id="root"></div><script>window.__PROMO=${JSON.stringify(promo)}</script><script src="stage.js"></script></body></html>`);
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(pathToFileURL(html).href);
    const name = `invoke-${feature}-${locale}-${format === 'reel' ? '9x16' : '16x9'}`;
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });

    // --- 3. Grabación ----------------------------------------------------------------------
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
    // Lo que dura el guion: el último cuadro quieto (el cierre) se estira hasta que la página avisa que terminó
    const total = scenes(feature, format, TEXT[locale], available).reduce((n, sc) => n + (sc.seg ? segments[sc.seg].dur : sc.dur), 0) + 0.3;
    run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-t', total.toFixed(2), '-vf', `fps=${FPS},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-movflags', '+faststart', out]);
    const fps = (usable.length / (endTs - startTs)).toFixed(1);
    // --- 4. Miniatura: un cuadro del video ya armado, en la escena elegida -------------------
    let at = 0;
    for (const sc of scenes(feature, format, TEXT[locale], available)) {
      if (sc.id === THUMB[feature][format][0]) { at += THUMB[feature][format][1]; break; }
      at += sc.seg ? segments[sc.seg].dur : sc.dur;
    }
    run('ffmpeg', ['-y', '-v', 'error', '-ss', at.toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '2', join(OUT, `${name}.jpg`)]);
    console.log(`[promo] ${name}.mp4 · ${duration(out).toFixed(1)} s · ~${fps} fps`);
  }
}
await browser.close();
