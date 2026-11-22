#!/usr/bin/env node
/**
 * Arma la promo de la voz con la toma de record.mjs y las voces de gen-audio.mjs.
 *
 *   node scripts/videos/promo-voice/make.mjs [es|en]
 *
 * Como si fuera real: todo a velocidad normal (la voz nunca se acelera). Cada pedido se ve
 * completo —el subtítulo mientras habla, la espera mientras la app trabaja y la respuesta unos
 * segundos—. Solo lo que sobra se saca, con un fundido suave: una espera muy larga (se ve el
 * comienzo y el final) y el tiempo quieto entre una respuesta y el pedido siguiente.
 * Si hay intro (videos/promo-voice/intro/intro-<locale>.mp4) va antes, con un zoom que entra a la app.
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
const INTRO_CLIP = join(ROOT, 'videos', 'promo-voice', 'intro', `intro-${LOCALE}.mp4`);
mkdirSync(BUILD, { recursive: true });
mkdirSync(OUT, { recursive: true });
/** Con intro (la persona) no va la portada de título: el gancho ya la hace. */
const HAS_INTRO = existsSync(INTRO_CLIP);
/** Dónde está el celular al final de la intro (fracción del cuadro): ahí entra el zoom. */
const PHONE = { es: [0.353, 0.48], en: [0.313, 0.66] }[LOCALE] ?? [0.5, 0.5];

const W = 1920;
const H = 1080;
const FPS = 30;
const TITLE = 2.2;
const OUTRO = 3.0;
/** El fundido entre tramos (s). */
const XF = 0.45;
/** Una espera más larga que esto se acorta (se ve su comienzo y su final). */
const LONG_WAIT = 3.2;
const WAIT_HEAD = 1.4;
const WAIT_TAIL = 1.2;
/** Después de la respuesta, cuánto se deja ver (s) antes del pedido siguiente. */
const SHOW = { gaps: 2.6, create: 3.0, change: 2.2, save: 1.6, yes: 2.2, go: 2.6, paula: 2.2, summary: 6.0, odo: 2.2, dictate: 3.4, confirm: 1.8, session: 2.6, sessionSave: 2.2, inbox: 2.4, bill: 4.2 };
const TEXT = {
  es: { title: 'Ahora le hablás', sub: 'Agenda, Mi consultorio y cobro, solo con la voz', end: 'Hablá. Invoke IA lo hace.' },
  en: { title: 'Now you just talk', sub: 'Schedule, workspace and billing, by voice', end: 'Speak. Invoke IA does it.' },
};

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

// ── Qué partes de la toma quedan ──────────────────────────────────────────────
const clip = join(CLIPS, `voice-${LOCALE}.webm`);
const meta = JSON.parse(readFileSync(join(CLIPS, `voice-${LOCALE}.json`), 'utf8'));
const total = duration(clip);
const at = (key) => { const m = meta.marks.find((x) => x.key === key); return m ? m.at / 1000 : null; };
const phrases = meta.marks.filter((m) => !m.key.includes('.') && m.key !== 'mic').map((m) => m.key);

/** Intervalos [s, e] de la toma que se ven, en orden; entre dos que no se tocan va un fundido. */
const keep = [];
const push = (s, e) => {
  if (e - s < 0.05) return;
  const last = keep[keep.length - 1];
  if (last && s - last.e < 0.05) last.e = Math.max(last.e, e);
  else keep.push({ s, e });
};
// El comienzo: la pantalla quieta, el cursor al botón Voz, «Te escucho».
push(0, at(phrases[0]) ?? 0);
const voiceAt = [];
for (let i = 0; i < phrases.length; i++) {
  const key = phrases[i];
  const start = at(key);
  const said = at(`${key}.said`) ?? start;
  const ready = at(`${key}.ready`) ?? said;
  const next = i + 1 < phrases.length ? at(phrases[i + 1]) : total;
  const end = Math.min(next, ready + (SHOW[key] ?? 2));
  // Lo dicho: entero.
  push(start, said);
  voiceAt.push({ key, src: start });
  // La espera: entera si es corta; si no, su comienzo y su final.
  if (ready - said <= LONG_WAIT) push(said, ready);
  else { push(said, said + WAIT_HEAD); push(ready - WAIT_TAIL, ready); }
  // La respuesta a la vista.
  push(ready, end);
}

// Dónde cae cada momento de la toma en el video (los fundidos se solapan XF).
const offsets = [];
let t = HAS_INTRO ? 0 : TITLE - XF;
for (let i = 0; i < keep.length; i++) {
  offsets.push(t);
  t += keep[i].e - keep[i].s - XF;
}
const outAt = (src) => {
  const i = keep.findIndex((k) => src >= k.s - 0.01 && src <= k.e + 0.01);
  return i < 0 ? null : offsets[i] + (src - keep[i].s);
};

// ── Portada y cierre ──────────────────────────────────────────────────────────
const logo = join(BUILD, 'logo.png');
if (!existsSync(logo)) run('ffmpeg', ['-y', '-v', 'error', '-i', join(ROOT, 'src/assets/brand/invokeia-logo.webp'), '-vf', 'scale=420:-1', logo]);
const logoData = `data:image/png;base64,${readFileSync(logo).toString('base64')}`;
const card = (big, small) => `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:radial-gradient(circle at 30% 20%,#7c3aed 0%,#3b1a6e 45%,#160b2e 100%);font-family:Inter,system-ui,sans-serif;color:#fff">
<img src="${logoData}" style="width:300px">
<div style="font-size:84px;font-weight:800;letter-spacing:-1.5px">${big}</div>
${small ? `<div style="font-size:38px;font-weight:500;opacity:.85">${small}</div>` : ''}
<div style="display:flex;gap:10px;margin-top:6px">${[22, 44, 64, 44, 22].map((h) => `<span style="width:10px;height:${h}px;border-radius:6px;background:#c4b5fd"></span>`).join('')}</div>
</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const T = TEXT[LOCALE];
await page.setContent(card(T.title, T.sub));
await page.screenshot({ path: join(BUILD, `title-${LOCALE}.png`) });
await page.setContent(card(T.end, ''));
await page.screenshot({ path: join(BUILD, `outro-${LOCALE}.png`) });
await browser.close();

// ── ffmpeg ────────────────────────────────────────────────────────────────────
const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#160b2e,fps=${FPS},format=yuv420p,setsar=1,settb=AVTB`;
const inputs = ['-i', clip, '-loop', '1', '-t', String(TITLE), '-i', join(BUILD, `title-${LOCALE}.png`), '-loop', '1', '-t', String(OUTRO), '-i', join(BUILD, `outro-${LOCALE}.png`)];
const filters = [`[1:v]${fit}[title]`, `[2:v]${fit}[outro]`];
keep.forEach((k, i) => filters.push(`[0:v]trim=start=${k.s.toFixed(3)}:end=${k.e.toFixed(3)},setpts=PTS-STARTPTS,${fit}[k${i}]`));
// Fundidos en cadena: portada → tramos → cierre.
let prev = HAS_INTRO ? 'k0' : 'title';
let length = HAS_INTRO ? keep[0].e - keep[0].s : TITLE;
const chain = [...keep.map((_, i) => `k${i}`).slice(HAS_INTRO ? 1 : 0), 'outro'];
const lens = [...keep.map((k) => k.e - k.s).slice(HAS_INTRO ? 1 : 0), OUTRO];
if (HAS_INTRO) filters.push('[title]nullsink');
chain.forEach((name, i) => {
  const out = i === chain.length - 1 ? 'v' : `x${i}`;
  filters.push(`[${prev}][${name}]xfade=transition=fade:duration=${XF}:offset=${(length - XF).toFixed(3)}[${out}]`);
  length += lens[i] - XF;
  prev = out;
});
console.log(`[promo-voice] ${keep.length} tramos · ${length.toFixed(1)} s (sin intro)`);
// Voces: cada una cuando empieza su subtítulo, a velocidad normal.
const voices = voiceAt.map((v) => ({ ...v, file: join(AUDIO, `${v.key}.mp3`), out: outAt(v.src) })).filter((v) => existsSync(v.file) && v.out !== null);
voices.forEach((v) => inputs.push('-i', v.file));
voices.forEach((v, i) => { const ms = Math.round((v.out + 0.12) * 1000); filters.push(`[${3 + i}:a]aresample=44100,adelay=${ms}|${ms}[a${i}]`); });
filters.push(`${voices.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voices.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,apad[a]`);

const body = join(BUILD, `body-${LOCALE}.mp4`);
run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]', '-t', length.toFixed(3),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', body]);

const out = join(OUT, `invoke-voz-${LOCALE}-16x9.mp4`);
if (HAS_INTRO) {
  // La intro (la persona en la clínica): en su último segundo la cámara entra a la pantalla del
  // celular (curva suave) y un fundido pasa a la app.
  const introLen = duration(INTRO_CLIP);
  const ZOOM_S = 1.15;
  const ZMAX = 3.4;
  const zs = Math.round((introLen - ZOOM_S) * FPS);
  const nz = Math.round(ZOOM_S * FPS);
  // p: 0 → 1 con aceleración suave (smoothstep); el centro va del medio al celular a medida que acerca.
  const p = `(if(lt(on,${zs}),0,min(1,(on-${zs})/${nz})))`;
  const ease = `(${p}*${p}*(3-2*${p}))`;
  const z = `(1+${ease}*${ZMAX - 1})`;
  const cx = `(iw/2+(${PHONE[0]}*iw-iw/2)*${ease})`;
  const cy = `(ih/2+(${PHONE[1]}*ih-ih/2)*${ease})`;
  const fz = `scale=${W * 2}:${H * 2}:flags=lanczos,setsar=1,fps=${FPS},zoompan=z='${z}':x='max(0,min(iw-iw/zoom,${cx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${cy}-ih/zoom/2))':d=1:s=${W}x${H}:fps=${FPS},format=yuv420p,setsar=1,settb=AVTB`;
  const XI = 0.5;
  run('ffmpeg', ['-y', '-v', 'error', '-i', INTRO_CLIP, '-i', body, '-filter_complex',
    `[0:v]${fz}[iv];[1:v]settb=AVTB[bv];[iv][bv]xfade=transition=fade:duration=${XI}:offset=${(introLen - XI).toFixed(3)}[v];[0:a]aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[ia];[1:a]aresample=44100[ba];[ia][ba]acrossfade=d=${XI}[a]`,
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
} else {
  run('ffmpeg', ['-y', '-v', 'error', '-i', body, '-c', 'copy', '-movflags', '+faststart', out]);
}
const sumAt = outAt(at('summary.ready') ?? 0);
const introShift = HAS_INTRO ? duration(INTRO_CLIP) - 0.5 : 0;
run('ffmpeg', ['-y', '-v', 'error', '-ss', String((sumAt ?? 10) + 1.5 + introShift), '-i', out, '-frames:v', '1', '-q:v', '3', out.replace(/\.mp4$/, '.jpg')]);
console.log(`[promo-voice] ${out} (${duration(out).toFixed(1)} s)`);
