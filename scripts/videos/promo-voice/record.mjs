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
    clearInterval(window.__captionTimer);
    el.style.opacity = text ? '1' : '0';
    if (!text) { el.lastChild.textContent = ''; return; }
    // Se va escribiendo al ritmo de la voz (como el reconocimiento en vivo).
    const words = text.split(' ');
    const step = Math.max(40, (window.__captionMs || 0) / words.length);
    let n = window.__captionMs ? 1 : words.length;
    el.lastChild.textContent = `«${words.slice(0, n).join(' ')}${n < words.length ? '…' : '»'}`;
    window.__captionTimer = setInterval(() => {
      n++;
      el.lastChild.textContent = `«${words.slice(0, n).join(' ')}${n < words.length ? '…' : '»'}`;
      if (n >= words.length) clearInterval(window.__captionTimer);
    }, step);
  };
  // Un cursor a la vista (la grabación no muestra el del sistema): se mueve suave hasta lo que se toca.
  window.__cursor = (x, y, ms = 900) => {
    let c = document.getElementById('__promo-cursor');
    if (!c) {
      c = document.createElement('div');
      c.id = '__promo-cursor';
      c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#1f1235" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35));transition:transform 0ms cubic-bezier(.22,.8,.3,1)';
      c.style.transform = `translate(${window.innerWidth * 0.55}px, ${window.innerHeight * 0.6}px)`;
      document.body.appendChild(c);
    }
    c.style.transitionDuration = `${ms}ms`;
    requestAnimationFrame(() => { c.style.transform = `translate(${x}px, ${y}px)`; });
  };
  window.__click = () => {
    const c = document.getElementById('__promo-cursor');
    if (!c) return;
    const r = document.createElement('div');
    const m = c.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    r.style.cssText = `position:fixed;left:${Number(m?.[1] ?? 0) - 18}px;top:${Number(m?.[2] ?? 0) - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #a78bfa;z-index:2147483646;pointer-events:none;animation:__ripple .6s ease-out forwards`;
    if (!document.getElementById('__ripple-style')) { const st = document.createElement('style'); st.id = '__ripple-style'; st.textContent = '@keyframes __ripple{from{transform:scale(.4);opacity:1}to{transform:scale(1.8);opacity:0}}'; document.head.appendChild(st); }
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  };
  try {
    localStorage.setItem('voice-always-on', 'false');
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
/** Cuánto dura la voz de cada frase (la acción pasa cuando termina de hablar). */
const voiceMs = (key) => {
  const file = join(ROOT, 'videos', 'promo-voice', 'audio', LOCALE, `${key}.mp3`);
  try { return Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()) * 1000); } catch { return 0; }
};
const clip = `voice-${LOCALE}${process.env.CLIP ? `-${process.env.CLIP}` : ''}`;

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
  /** Lo dice: subtítulo al ritmo de la voz, la frase al reconocedor al terminar, espera la respuesta y la deja ver. */
  say: async (key, text, { waitFor, hold = 2500, timeout } = {}) => {
    const ms = voiceMs(key);
    await page.evaluate(([t, d]) => { window.__captionMs = d; window.__caption(t); }, [text, ms]);
    ctx.mark(key);
    await page.waitForTimeout(Math.max(600, ms + 250));
    const ok = await page.evaluate((t) => window.__voiceSay(t), text);
    if (!ok) throw new Error(`El micrófono no estaba escuchando para «${text}»`);
    ctx.mark(`${key}.said`);
    await settled(text, timeout);
    if (waitFor) await waitFor().catch((e) => console.warn(`[promo-voice] ${key}: ${String(e.message).split('\n')[0]}`));
    ctx.mark(`${key}.ready`);
    // El subtítulo se va cuando ya se ve la respuesta; la respuesta queda a la vista.
    await page.waitForTimeout(700);
    await page.evaluate(() => window.__caption(''));
    await page.waitForTimeout(Math.max(0, hold - 700));
  },
  /** Prende la voz como una persona: el cursor va al botón Voz y lo toca. */
  micOn: async () => {
    const btn = page.locator('[data-help-id="rail.btn.voice"]').first();
    const box = await btn.boundingBox();
    if (!box) throw new Error('No encuentro el botón Voz');
    await page.evaluate(([x, y]) => window.__cursor(x, y, 1100), [box.x + box.width / 2 + 4, box.y + box.height / 2 + 4]);
    await page.waitForTimeout(1300);
    ctx.mark('mic');
    await page.evaluate(() => window.__click());
    await btn.click();
    await listening();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__cursor(window.innerWidth * 0.62, window.innerHeight * 0.72, 900));
  },
  micToggle: async () => { await page.locator('[data-help-id="rail.btn.voice"]').first().click(); },
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
