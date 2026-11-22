#!/usr/bin/env node
/**
 * Arma la promo de la voz (≤ 40 s) con las tomas de record.mjs y las voces de gen-audio.mjs.
 *
 *   node scripts/videos/promo-voice/make.mjs [es|en]
 *
 * 1. De cada toma toma los tramos de sus frases (por las marcas del .json), en el orden de TAKES.
 * 2. Cada tramo se acelera lo justo para entrar en el tiempo, sin cortar su voz (cada frase dura por
 *    lo menos lo que dura su audio) y dejando leer lo importante (el resumen, el cobro).
 * 3. Portada y cierre (HTML capturado con Chrome) con el logo.
 * 4. Las voces en su lugar, mp4 H.264 1920×1080 30 fps + AAC.
 *
 * Salida: videos/promo-voice/out/invoke-voz-<locale>-16x9.mp4 y .jpg (miniatura).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const LOCALE = process.argv[2] ?? 'es';
const CLIPS = join(ROOT, 'videos', 'promo-voice', 'clips');
const AUDIO = join(ROOT, 'videos', 'promo-voice', 'audio', LOCALE);
const BUILD = join(ROOT, 'videos', 'promo-voice', 'build');
const OUT = join(ROOT, 'videos', 'promo-voice', 'out');
mkdirSync(BUILD, { recursive: true });
mkdirSync(OUT, { recursive: true });

const W = 1920;
const H = 1080;
const FPS = 30;
const INTRO = 1.1;
const OUTRO = 1.6;
/** Lo que pueden durar las frases (sin portada ni cierre). */
const BUDGET = 39.7 - INTRO - OUTRO;

/** De qué toma sale cada tramo: desde la marca `from` hasta la marca `to` (null: hasta el final). */
const TAKES = {
  // Una sola toma por idioma (los avisos de la bandeja llegan en vivo: el cobro va en la misma toma).
  es: [{ clip: 'voice-es', from: 'gaps', to: null }],
  en: [{ clip: 'voice-en', from: 'gaps', to: null }],
};
/** Lo que hay que dejar ver un rato después de la voz (segundos mínimos del tramo). */
/** Después de la voz: lo que hay que dejar ver del resultado (segundos). */
const MIN_SHOW = { create: 0.9, summary: 2.0, dictate: 1.2, bill: 1.6, gaps: 0.8, go: 0.8, session: 0.7, sessionSave: 0.5, inbox: 0.6, change: 0.6, paula: 0.5 };
const TEXT = {
  es: { title: 'Ahora le hablás', sub: 'Agenda, Mi consultorio y cobro, solo con la voz', end: 'Hablá. Invoke IA lo hace.' },
  en: { title: 'Now you just talk', sub: 'Schedule, workspace and billing, by voice', end: 'Speak. Invoke IA does it.' },
};

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

// ── Los tramos ────────────────────────────────────────────────────────────────
const LEAD = 0.15;
/** La voz de ElevenLabs un poco más rápida en el montaje (la de es no respeta su parámetro de velocidad). */
const TEMPO = { es: 1.12, en: 1.0 }[LOCALE] ?? 1;
const segments = [];
for (const take of TAKES[LOCALE]) {
  const file = join(CLIPS, `${take.clip}.webm`);
  const meta = JSON.parse(readFileSync(join(CLIPS, `${take.clip}.json`), 'utf8'));
  const total = duration(file);
  const marks = meta.marks;
  const start = marks.findIndex((m) => m.key === take.from);
  const stop = take.to ? marks.findIndex((m) => m.key === take.to) : marks.length;
  if (start < 0) throw new Error(`${take.clip}: no está la marca ${take.from}`);
  for (let i = start; i < (stop < 0 ? marks.length : stop); i++) {
    const s = Math.max(0, marks[i].at / 1000 - LEAD);
    const e = i + 1 < marks.length ? marks[i + 1].at / 1000 - LEAD : total;
    const audio = join(AUDIO, `${marks[i].key}.mp3`);
    segments.push({ key: marks[i].key, file, s, e, raw: e - s, voice: existsSync(audio) ? audio : null, voiceLen: existsSync(audio) ? duration(audio) / TEMPO : 0 });
  }
}

// Cada tramo en tres partes: mientras habla (velocidad normal: el subtítulo va con la voz), la
// espera mientras la app procesa (muy acelerada) y el resultado (los últimos instantes, normal).
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const SPEAK_PAD = 0.15;
const WAIT_SPEED = 10;
for (const g of segments) {
  g.speak = Math.min(g.raw, g.voiceLen + SPEAK_PAD);
  const rest = g.raw - g.speak;
  g.show = Math.min(rest, MIN_SHOW[g.key] ?? 0.35);
  g.wait = rest - g.show;
}
let waitOut = (g) => Math.max(Math.min(g.wait, 0.2), g.wait / WAIT_SPEED);
let total = sum(segments.map((g) => g.speak + waitOut(g) + g.show));
// Si no entra, se achica lo que se deja ver del resultado (nunca la voz).
if (total > BUDGET) {
  const shows = sum(segments.map((g) => g.show));
  const k = Math.max(0.35, 1 - (total - BUDGET) / shows);
  for (const g of segments) { const cut = g.show * (1 - k); g.show -= cut; g.wait += cut; }
  total = sum(segments.map((g) => g.speak + waitOut(g) + g.show));
}
for (const g of segments) {
  g.parts = [
    { s: g.s, e: g.s + g.speak, speed: 1 },
    ...(g.wait > 0.01 ? [{ s: g.s + g.speak, e: g.s + g.speak + g.wait, speed: g.wait / waitOut(g) }] : []),
    ...(g.show > 0.01 ? [{ s: g.e - g.show, e: g.e, speed: 1 }] : []),
  ];
  g.out = sum(g.parts.map((p) => (p.e - p.s) / p.speed));
}
const target = segments.map((g) => g.out);
console.log(segments.map((g) => `${g.key}: ${g.raw.toFixed(1)}s → ${g.out.toFixed(1)}s (voz ${g.speak.toFixed(1)} · espera ${g.wait.toFixed(1)}→${waitOut(g).toFixed(1)} · resultado ${g.show.toFixed(1)})`).join('\n'));
console.log(`[promo-voice] frases ${sum(target).toFixed(1)}s + portada y cierre = ${(sum(target) + INTRO + OUTRO).toFixed(1)}s`);

// ── Portada y cierre ──────────────────────────────────────────────────────────
const logo = join(BUILD, 'logo.png');
if (!existsSync(logo)) run('ffmpeg', ['-y', '-v', 'error', '-i', join(ROOT, 'src/assets/brand/invokeia-logo.webp'), '-vf', 'scale=420:-1', logo]);
const logoData = `data:image/png;base64,${readFileSync(logo).toString('base64')}`;
const card = (big, small) => `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:radial-gradient(circle at 30% 20%,#7c3aed 0%,#3b1a6e 45%,#160b2e 100%);font-family:Inter,system-ui,sans-serif;color:#fff">
<img src="${logoData}" style="width:300px">
<div style="font-size:84px;font-weight:800;letter-spacing:-1.5px">${big}</div>
${small ? `<div style="font-size:38px;font-weight:500;opacity:.85">${small}</div>` : ''}
<div style="display:flex;gap:10px;margin-top:6px">${[0, 1, 2, 3, 4].map((i) => `<span style="width:10px;height:${[22, 44, 64, 44, 22][i]}px;border-radius:6px;background:#c4b5fd"></span>`).join('')}</div>
</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const T = TEXT[LOCALE];
await page.setContent(card(T.title, T.sub));
await page.screenshot({ path: join(BUILD, `intro-${LOCALE}.png`) });
await page.setContent(card(T.end, ''));
await page.screenshot({ path: join(BUILD, `outro-${LOCALE}.png`) });
await browser.close();

// ── ffmpeg: video ─────────────────────────────────────────────────────────────
const files = [...new Set(segments.map((g) => g.file))];
const inputs = [];
for (const f of files) inputs.push('-i', f);
const introIdx = files.length;
inputs.push('-loop', '1', '-t', String(INTRO), '-i', join(BUILD, `intro-${LOCALE}.png`));
inputs.push('-loop', '1', '-t', String(OUTRO), '-i', join(BUILD, `outro-${LOCALE}.png`));
const voiceInputs = segments.filter((g) => g.voice);
for (const g of voiceInputs) inputs.push('-i', g.voice);

const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#160b2e,fps=${FPS},format=yuv420p,setsar=1`;
const filters = [];
filters.push(`[${introIdx}:v]${fit},fade=t=out:st=${INTRO - 0.35}:d=0.35[intro]`);
const parts = [];
segments.forEach((g) => g.parts.forEach((p) => {
  const i = parts.length;
  parts.push(i);
  filters.push(`[${files.indexOf(g.file)}:v]trim=start=${p.s.toFixed(3)}:end=${p.e.toFixed(3)},setpts=(PTS-STARTPTS)/${p.speed.toFixed(4)},${fit}[s${i}]`);
}));
filters.push(`[${introIdx + 1}:v]${fit},fade=t=in:st=0:d=0.35[outro]`);
filters.push(`[intro]${parts.map((i) => `[s${i}]`).join('')}[outro]concat=n=${parts.length + 2}:v=1:a=0[v]`);

// Voces: cada una al comienzo de su tramo (un pelín después del subtítulo).
let t = INTRO;
const delays = [];
segments.forEach((g) => { if (g.voice) delays.push(Math.round((t + 0.12) * 1000)); t += g.out; });
const firstVoice = introIdx + 2;
voiceInputs.forEach((_, i) => filters.push(`[${firstVoice + i}:a]${TEMPO !== 1 ? `atempo=${TEMPO},` : ''}adelay=${delays[i]}|${delays[i]},volume=1.0[a${i}]`));
filters.push(`${voiceInputs.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voiceInputs.length}:normalize=0,apad[a]`);

const out = join(OUT, `invoke-voz-${LOCALE}-16x9.mp4`);
const totalLen = INTRO + sum(target) + OUTRO;
run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]', '-t', totalLen.toFixed(3),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
run('ffmpeg', ['-y', '-v', 'error', '-ss', String(INTRO + sum(target.slice(0, segments.findIndex((g) => g.key === 'summary') + 1)) - 0.5), '-i', out, '-frames:v', '1', '-q:v', '3', out.replace(/\.mp4$/, '.jpg')]);
console.log(`[promo-voice] ${out} (${duration(out).toFixed(1)} s)`);
