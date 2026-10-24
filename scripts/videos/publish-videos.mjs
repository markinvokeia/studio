#!/usr/bin/env node
/**
 * Fase 3 — publica los videos armados por build-videos y los registra en
 * help_videos (POST help/videos/register); desde ahí el chat los ofrece.
 *
 *   HELP_VIDEOS_BUCKET  bucket de Google Cloud Storage (gcloud autenticado). Sin
 *                       bucket se copian a public/help-videos/ (sólo desarrollo).
 *   HELP_API_URL / HELP_API_TOKEN  ver help-api.mjs
 *   HELP_VIDEO_USE_CASES  lista separada por comas
 *   HELP_VIDEO_REQUEST_ID pedido a cerrar (lo pasa el worker)
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { helpApi, helpApiConfigured } from './help-api.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'videos', 'out');
const PUBLIC_DIR = join(ROOT, 'public', 'help-videos');
const BUCKET = process.env.HELP_VIDEOS_BUCKET ?? '';
const SELECTED = (process.env.HELP_VIDEO_USE_CASES ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function upload(file, name) {
  if (BUCKET) {
    const contentType = name.endsWith('.vtt') ? 'text/vtt' : 'video/mp4';
    execFileSync('gcloud', ['storage', 'cp', file, `gs://${BUCKET}/help-videos/${name}`, `--content-type=${contentType}`, '--cache-control=public, max-age=3600'], { stdio: 'inherit' });
    return `https://storage.googleapis.com/${BUCKET}/help-videos/${name}`;
  }
  mkdirSync(PUBLIC_DIR, { recursive: true });
  copyFileSync(file, join(PUBLIC_DIR, name));
  return `/help-videos/${name}`;
}

const metas = (existsSync(OUT) ? readdirSync(OUT) : [])
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(OUT, f), 'utf8')))
  .filter((m) => !SELECTED.length || SELECTED.includes(m.useCaseId));

if (!metas.length) { console.error('[videos] nada para publicar en videos/out'); process.exit(1); }
if (!BUCKET) console.warn('[videos] sin HELP_VIDEOS_BUCKET: se copian a public/help-videos (sólo desarrollo)');
if (!helpApiConfigured()) console.warn('[videos] sin HELP_API_URL/HELP_API_TOKEN: se suben pero no se registran');

for (const meta of metas) {
  const url = upload(join(OUT, meta.file), meta.file);
  upload(join(OUT, meta.subtitles), meta.subtitles);
  if (helpApiConfigured()) {
    await helpApi('help/videos/register', {
      use_case_id: meta.useCaseId,
      locale: meta.locale,
      title: meta.title,
      url,
      duration_seconds: meta.durationSeconds,
      catalog_version: meta.catalogVersion,
      request_id: process.env.HELP_VIDEO_REQUEST_ID || undefined,
    });
  }
  console.log(`[videos] publicado ${meta.useCaseId} → ${url}`);
}
