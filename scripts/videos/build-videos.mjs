#!/usr/bin/env node
/**
 * Fase 3 — arma el video demo de cada guía grabada por `pnpm videos:record`.
 *
 *   videos/raw/<caso>.webm + <caso>.json (línea de tiempo de los pasos; en inglés <caso>.en.*)
 *     → narración (ElevenLabs) + subtítulos (.vtt y pista mov_text)
 *     → videos/out/<caso>-<locale>.mp4, .jpg (miniatura), .vtt y .json (metadatos para publicar)
 *
 *   ELEVENLABS_API_KEY   sin clave se arma sin narración (sólo subtítulos)
 *   ELEVENLABS_VOICE_ID  voz rioplatense de los videos actuales de Invoke
 *   ELEVENLABS_MODEL     por defecto eleven_multilingual_v2
 *   HELP_VIDEO_USE_CASES lista separada por comas (por defecto, todo lo grabado)
 *   HELP_VIDEO_LOCALE    sólo las grabaciones de ese idioma (es | en)
 *
 * Requiere ffmpeg/ffprobe. Si el ffmpeg tiene libass, además quema los
 * subtítulos en la imagen; si no, quedan como pista y como .vtt (los muestra
 * el reproductor del asistente).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = join(ROOT, 'videos', 'raw');
const OUT = join(ROOT, 'videos', 'out');
const CACHE = join(ROOT, 'videos', 'cache');

const API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '';
const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
const ONLY_LOCALE = process.env.HELP_VIDEO_LOCALE ?? '';
const SELECTED = (process.env.HELP_VIDEO_USE_CASES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const NARRATION_GAP_S = 0.25;
/** Segundo de la intro que se usa como miniatura. */
const POSTER_AT_S = '1.2';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function ffmpegHas(filter) {
  try { return run('ffmpeg', ['-hide_banner', '-filters']).split('\n').some((l) => l.trim().split(/\s+/)[1] === filter); } catch { return false; }
}

function mediaDuration(file) {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).trim());
}

function narrationText(seg) {
  return [seg.title, seg.description, seg.details].filter(Boolean).join('. ').replace(/\.\./g, '.');
}

async function tts(text) {
  const hash = createHash('sha256').update(`${VOICE_ID}|${MODEL}|${text}`).digest('hex').slice(0, 20);
  const file = join(CACHE, 'tts', `${hash}.mp3`);
  if (existsSync(file)) return file;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const vttTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const sec = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}`;
};

/** Corta en líneas de ~56 caracteres, máximo 3 por cartel. */
function wrap(text, width = 56) {
  const words = text.split(/\s+/);
  const lines = [''];
  for (const w of words) {
    if ((lines[lines.length - 1] + ' ' + w).trim().length > width) lines.push(w);
    else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
  }
  return lines.slice(0, 3).join('\n');
}

/** `key`: nombre de la grabación (`<caso>` en español, `<caso>.en` en inglés). */
async function buildOne(key) {
  const timeline = JSON.parse(readFileSync(join(RAW, `${key}.json`), 'utf8'));
  const id = timeline.useCaseId ?? key;
  const video = join(RAW, `${key}.webm`);
  const videoDuration = mediaDuration(video);
  const locale = timeline.locale ?? 'es';
  const base = join(OUT, `${id}-${locale}`);
  const narrate = Boolean(API_KEY && VOICE_ID);

  // Cada cartel empieza cuando el paso aparece en pantalla; si la narración
  // anterior todavía no terminó, se corre un poco para no pisarla.
  const cues = [];
  let cursor = 0;
  for (const seg of timeline.segments) {
    const text = narrationText(seg);
    const audio = narrate ? await tts(text) : null;
    const start = audio ? Math.max(seg.t / 1000, cursor) : seg.t / 1000;
    const end = audio ? start + mediaDuration(audio) : null;
    cues.push({ text, audio, start, end });
    if (end !== null) cursor = end + NARRATION_GAP_S;
  }
  // Sin narración, cada cartel dura hasta el paso siguiente (o el final del video).
  cues.forEach((c, i) => {
    const next = cues[i + 1]?.start ?? Math.max(videoDuration, c.start + 3);
    c.end = Math.max(c.start + 0.8, c.end ?? next - 0.05);
  });
  // Si la narración se pasa del final, se congela el último cuadro hasta que termine.
  const totalDuration = Math.max(videoDuration, ...cues.map((c) => c.end + 0.5));
  const freeze = totalDuration - videoDuration;

  const vtt = 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${wrap(c.text)}\n`).join('\n');
  writeFileSync(`${base}.vtt`, vtt);
  const srt = cues.map((c, i) => `${i + 1}\n${vttTime(c.start).replace('.', ',')} --> ${vttTime(c.end).replace('.', ',')}\n${wrap(c.text)}\n`).join('\n');
  writeFileSync(`${base}.srt`, srt);

  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', `${base}.srt`];
  const audioCues = cues.filter((c) => c.audio);
  for (const c of audioCues) args.push('-i', c.audio);

  const burn = ffmpegHas('subtitles');
  const filters = [
    `[0:v]${freeze > 0.05 ? `tpad=stop_mode=clone:stop_duration=${freeze.toFixed(2)},` : ''}null[v0]`,
    // La intro de la grabación ya trae el título y el logo de Invoke: no se superpone otro.
    `[v0]null[v1]`,
  ];
  filters.push(burn
    ? `[v1]subtitles='${base}.srt':force_style='FontName=Plus Jakarta Sans,FontSize=18,PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=4,MarginV=28'[vout]`
    : `[v1]null[vout]`);
  if (audioCues.length) {
    audioCues.forEach((c, i) => {
      const ms = Math.round(c.start * 1000);
      filters.push(`[${2 + i}:a]adelay=${ms}|${ms}[a${i}]`);
    });
    filters.push(`${audioCues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audioCues.length}:normalize=0:duration=longest[aout]`);
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  if (audioCues.length) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '128k');
  args.push('-map', '1:s', '-c:s', 'mov_text', '-metadata:s:s:0', `language=${locale === 'en' ? 'eng' : 'spa'}`);
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', totalDuration.toFixed(2), `${base}.mp4`);
  run('ffmpeg', args);
  // Miniatura del chat: un cuadro de la intro (título de la guía y logo).
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', POSTER_AT_S, '-i', `${base}.mp4`, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', `${base}.jpg`]);

  const meta = {
    useCaseId: id,
    locale,
    title: timeline.title,
    catalogVersion: timeline.catalogVersion,
    durationSeconds: Math.round(mediaDuration(`${base}.mp4`)),
    narrated: audioCues.length > 0,
    burnedSubtitles: burn,
    file: `${id}-${locale}.mp4`,
    subtitles: `${id}-${locale}.vtt`,
    poster: `${id}-${locale}.jpg`,
  };
  writeFileSync(`${base}.json`, JSON.stringify(meta, null, 2));
  return meta;
}

const ids = (existsSync(RAW) ? readdirSync(RAW) : [])
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((key) => !ONLY_LOCALE || (ONLY_LOCALE === 'es' ? !/\.(en|es-ES)$/.test(key) : key.endsWith(`.${ONLY_LOCALE}`)))
  .filter((key) => existsSync(join(RAW, `${key}.webm`)) && (!SELECTED.length || SELECTED.includes(key) || SELECTED.includes(key.replace(/\.(en|es-ES)$/, ''))));

if (!ids.length) {
  console.error('[videos] no hay grabaciones en videos/raw (corré pnpm videos:record)');
  process.exit(1);
}
if (!API_KEY || !VOICE_ID) console.warn('[videos] sin ELEVENLABS_API_KEY/ELEVENLABS_VOICE_ID: se arman sin narración');
mkdirSync(OUT, { recursive: true });

let failed = 0;
for (const id of ids) {
  try {
    const meta = await buildOne(id);
    console.log(`[videos] ${meta.file} · ${meta.durationSeconds}s · ${meta.narrated ? 'narrado' : 'sin narración'} · subtítulos ${meta.burnedSubtitles ? 'quemados + pista' : 'en pista y .vtt'}`);
  } catch (error) {
    failed += 1;
    console.error(`[videos] ${id}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
