#!/usr/bin/env node
/**
 * Enlaza los videos subidos a una carpeta pública de Google Drive con sus guías:
 * lee la carpeta, toma cada `<caso>-<locale>.mp4` (el nombre que arma
 * build-videos) y lo registra en help_videos (POST help/videos/register) con su
 * enlace de Drive. Desde ahí el chat los ofrece debajo de cada guía.
 *
 *   HELP_VIDEOS_DRIVE_FOLDER  id de la carpeta (compartida "cualquiera con el enlace")
 *   HELP_API_URL / HELP_API_TOKEN  ver help-api.mjs
 *   HELP_VIDEO_DRY_RUN=1      sólo lista lo que registraría
 *
 * Los títulos y duraciones salen de videos/out/<caso>-<locale>.json (o de la
 * grabación en videos/raw). Volver a correrlo reemplaza el enlace de cada guía.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { helpApi, helpApiConfigured } from './help-api.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'videos', 'out');
const RAW = join(ROOT, 'videos', 'raw');
const FOLDER = process.env.HELP_VIDEOS_DRIVE_FOLDER ?? process.argv[2] ?? '';
const DRY_RUN = process.env.HELP_VIDEO_DRY_RUN === '1';
const VIDEO_NAME = /^(.+)-(es-ES|es|en)\.mp4$/;

if (!FOLDER) { console.error('[videos] falta HELP_VIDEOS_DRIVE_FOLDER (id de la carpeta de Drive)'); process.exit(1); }
if (!DRY_RUN && !helpApiConfigured()) { console.error('[videos] faltan HELP_API_URL y HELP_API_TOKEN (o HELP_VIDEO_DRY_RUN=1)'); process.exit(1); }

/** Archivos de la carpeta pública (la vista embebida de Drive no pide sesión). */
async function listFolder(folderId) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`);
  if (!res.ok) throw new Error(`Drive ${res.status}: ¿la carpeta está compartida como "cualquiera con el enlace"?`);
  const html = await res.text();
  const files = [];
  for (const m of html.matchAll(/id="entry-([\w-]{10,})"[\s\S]*?class="flip-entry-title">([^<]+)</g)) {
    files.push({ id: m[1], name: m[2].trim().replace(/&amp;/g, '&') });
  }
  return files;
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

const files = await listFolder(FOLDER);
const videos = files.filter((f) => VIDEO_NAME.test(f.name));
console.log(`[videos] ${files.length} archivos en Drive, ${videos.length} videos con nombre <caso>-<locale>.mp4`);
for (const f of files.filter((x) => !VIDEO_NAME.test(x.name) && x.name.endsWith('.mp4'))) {
  console.warn(`[videos] se ignora ${f.name}: el nombre tiene que ser <caso>-<locale>.mp4`);
}

let failed = 0;
for (const file of videos) {
  const [, useCaseId, locale] = file.name.match(VIDEO_NAME);
  const meta = readJson(join(OUT, `${useCaseId}-${locale}.json`)) ?? readJson(join(RAW, `${useCaseId}.json`)) ?? {};
  const body = {
    use_case_id: useCaseId,
    locale,
    title: meta.title ?? useCaseId,
    url: `https://drive.google.com/file/d/${file.id}/view`,
    duration_seconds: meta.durationSeconds ?? null,
    catalog_version: meta.catalogVersion ?? '',
  };
  if (DRY_RUN) { console.log(`[videos] (prueba) ${useCaseId} [${locale}] → ${body.url}`); continue; }
  try {
    await helpApi('help/videos/register', body);
    console.log(`[videos] enlazado ${useCaseId} [${locale}] → ${body.url}`);
  } catch (error) {
    failed += 1;
    console.error(`[videos] ${useCaseId}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
