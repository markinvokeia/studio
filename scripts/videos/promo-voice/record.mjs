#!/usr/bin/env node
/**
 * Graba la promo de la voz (≤ 40 s): agenda → Mi consultorio → odontograma → cobro rápido, todo
 * por voz, en una sola toma por idioma. Las frases se «dicen» con el reconocedor falso de las
 * pruebas en vivo (window.__voiceSay) y se muestran como subtítulo grande arriba; cada una queda
 * marcada en el .json (para poner el audio de ElevenLabs en su lugar).
 *
 *   node scripts/videos/promo-voice/record.mjs [es|en] [desktop]
 *
 * Requiere la app en modo producción (pnpm build && pnpm start -p 3000) y la sesión del e2e
 * (e2e/.auth/user.json: Raidel Martínez). GUARDA en DEV: crea la cita de Paula Acosta y su
 * odontograma (autorizado para la promo; se borran después con cleanup.mjs).
 *
 * Salida: videos/promo-voice/clips/voice-<locale>.webm + .json (marcas en ms desde el comienzo).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCRIPT } from './script.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'videos', 'promo-voice', 'clips');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const LOCALE = process.argv[2] ?? 'es';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const FPS = 30;
const VIEWPORT = { width: 1440, height: 810 };
const SCALE = 1.5;

mkdirSync(OUT, { recursive: true });

/** Reconocedor falso (como e2e/tests/voice-live) y el subtítulo de lo dicho. */
function initScript() {
  const instances = [];
  class R {
    continuous = false; interimResults = false; lang = ''; onresult = null; onerror = null; onend = null; onspeechstart = null; started = false; ended = false;
    start() { this.started = true; instances.push(this); }
    stop() { this.end(); } abort() { this.end(); }
    end() { if (this.ended) return; this.ended = true; setTimeout(() => this.onend?.({}), 0); }
  }
  window.webkitSpeechRecognition = R; window.SpeechRecognition = R;
  window.__voiceListening = () => instances.some((r) => r.continuous && r.started && !r.ended);
  window.__voiceSay = (t) => {
    for (let i = instances.length - 1; i >= 0; i--) {
      const r = instances[i];
      if (r.continuous && r.started && !r.ended) {
        r.onspeechstart?.({});
        r.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: t } } } });
        return true;
      }
    }
    return false;
  };
  window.__caption = (text) => {
    let el = document.getElementById('__promo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = '__promo-caption';
      el.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;max-width:78vw;padding:12px 22px 12px 52px;border-radius:999px;background:rgba(24,12,48,.88);color:#fff;font:600 22px/1.3 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(60,20,90,.35);pointer-events:none;transition:opacity .25s;text-align:left';
      const dot = document.createElement('span');
      dot.style.cssText = 'position:absolute;left:20px;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;background:#a78bfa;box-shadow:0 0 0 6px rgba(167,139,250,.35)';
      el.appendChild(dot);
      el.appendChild(document.createElement('span'));
      document.body.appendChild(el);
    }
    el.lastChild.textContent = text ? `«${text}»` : '';
    el.style.opacity = text ? '1' : '0';
  };
  try {
    localStorage.setItem('voice-always-on', 'true');
    localStorage.setItem('invoke-help-voice-muted', '1');
    localStorage.setItem('invoke-help:automation', '1');
  } catch { /* */ }
}

async function startCapture(page, size, name) {
  const cdp = await page.context().newCDPSession(page);
  const dir = join(OUT, `_frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  let stopped = false;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    if (stopped) return;
    const file = join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, ts: metadata.timestamp });
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  return {
    t0,
    async stop(file) {
      const end = Date.now() / 1000;
      stopped = true;
      await cdp.send('Page.stopScreencast').catch(() => {});
      if (!frames.length) return;
      const lines = [];
      frames.forEach((f, i) => {
        const next = frames[i + 1]?.ts ?? end;
        lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - Math.max(f.ts, t0)).toFixed(4)}`);
      });
      lines.push(`file '${frames[frames.length - 1].file}'`);
      writeFileSync(join(dir, 'list.txt'), lines.join('\n'));
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
        '-vf', `fps=${FPS},scale=${size.width}:${size.height}:flags=lanczos`, '-c:v', 'libvpx-vp9', '-crf', '20', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-g', String(FPS), file]);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  storageState: join(ROOT, 'e2e/.auth/user.json'),
  locale: LOCALE === 'en' ? 'en-US' : 'es-UY',
});
await context.addInitScript(initScript);
const page = await context.newPage();
const size = { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE };
const marks = [];
let capture = null;
const clip = `voice-${LOCALE}`;

const listening = () => page.waitForFunction(() => window.__voiceListening?.(), null, { timeout: 30_000 });
/** La sesión de voz terminó lo pedido: la tarjeta muestra lo dicho y ya no está pensando. */
const settled = (said, timeout = 20_000) => page.waitForFunction((t) => {
  const card = document.querySelector('[data-voice-card]');
  const text = (card?.innerText ?? '').replace(/\s+/g, ' ');
  const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return norm(text).includes(norm(t)) && !/Un momento|One moment|Pensando|Thinking/i.test(text);
}, said, { timeout, polling: 150 }).catch(() => undefined);

const ctx = {
  page,
  locale: LOCALE,
  wait: (ms) => page.waitForTimeout(ms),
  start: async () => { capture = await startCapture(page, size, clip); },
  mark: (key) => { const at = Math.round((Date.now() / 1000 - capture.t0) * 1000); marks.push({ key, at }); console.log(`[promo-voice] ${key} @${at}ms`); },
  /** Lo dice: subtítulo, la frase al reconocedor y espera a que termine (o `waitFor`). */
  say: async (key, text, { waitFor, hold = 900, timeout } = {}) => {
    await page.evaluate((t) => window.__caption(t), text);
    ctx.mark(key);
    await page.waitForTimeout(450);
    const ok = await page.evaluate((t) => window.__voiceSay(t), text);
    if (!ok) throw new Error(`El micrófono no estaba escuchando para «${text}»`);
    await page.waitForTimeout(500);
    await settled(text, timeout);
    if (waitFor) await waitFor().catch((e) => console.warn(`[promo-voice] ${key}: ${String(e.message).split('\n')[0]}`));
    await page.waitForTimeout(hold);
    await page.evaluate(() => window.__caption(''));
  },
  listening,
};

let ok = false;
try {
  await SCRIPT[LOCALE](ctx, { base: BASE, only: ONLY });
  ok = true;
} catch (error) {
  await page.screenshot({ path: join(OUT, `${clip}-error.png`) }).catch(() => {});
  console.error(`[promo-voice] ${clip} falló: ${String(error.message).split('\n')[0]}`);
}
if (capture) await capture.stop(join(OUT, `${clip}.webm`));
writeFileSync(join(OUT, `${clip}.json`), JSON.stringify({ clip, locale: LOCALE, size: [size.width, size.height], marks, ok }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
