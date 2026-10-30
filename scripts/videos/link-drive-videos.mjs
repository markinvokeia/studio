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
 *   HELP_VIDEO_SQL=<archivo>  en vez de registrar por la API, escribe un SQL
 *                             (INSERT ... ON CONFLICT, repetible) para cargar los
 *                             videos en cualquier entorno: pnpm videos:export-sql
 *
 * Los títulos y duraciones salen de videos/out/<caso>-<locale>.json (o de la
 * grabación en videos/raw). Volver a correrlo reemplaza el enlace de cada guía.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { helpApi, helpApiConfigured } from './help-api.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'videos', 'out');
const RAW = join(ROOT, 'videos', 'raw');
const FOLDER = process.env.HELP_VIDEOS_DRIVE_FOLDER ?? process.argv[2] ?? '';
const DRY_RUN = process.env.HELP_VIDEO_DRY_RUN === '1';
const SQL_OUT = process.env.HELP_VIDEO_SQL ?? '';
const VIDEO_NAME = /^(.+)-(es-ES|es|en)\.mp4$/;

if (!FOLDER) { console.error('[videos] falta HELP_VIDEOS_DRIVE_FOLDER (id de la carpeta de Drive)'); process.exit(1); }
if (!DRY_RUN && !SQL_OUT && !helpApiConfigured()) { console.error('[videos] faltan HELP_API_URL y HELP_API_TOKEN (o HELP_VIDEO_DRY_RUN=1)'); process.exit(1); }

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

/**
 * Literal SQL sólo con caracteres ASCII: lo que no lo es va como escape Unicode
 * (U&'…'), así pgAdmin no avisa de caracteres raros al pegarlo.
 */
function sqlText(value) {
  if (value === null || value === undefined) return 'NULL';
  const text = String(value).replace(/'/g, "''");
  if (/^[\x20-\x7e]*$/.test(text)) return `'${text}'`;
  const escaped = [...text.replace(/\\/g, '\\\\')]
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (code >= 0x20 && code <= 0x7e) return ch;
      return code > 0xffff ? `\\+${code.toString(16).padStart(6, '0')}` : `\\${code.toString(16).padStart(4, '0')}`;
    })
    .join('');
  return `U&'${escaped}'`;
}

const rows = [];
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
  if (SQL_OUT) { rows.push(body); continue; }
  if (DRY_RUN) { console.log(`[videos] (prueba) ${useCaseId} [${locale}] → ${body.url}`); continue; }
  try {
    await helpApi('help/videos/register', body);
    console.log(`[videos] enlazado ${useCaseId} [${locale}] → ${body.url}`);
  } catch (error) {
    failed += 1;
    console.error(`[videos] ${useCaseId}: ${error.message}`);
  }
}
if (SQL_OUT) {
  rows.sort((a, b) => a.use_case_id.localeCompare(b.use_case_id) || a.locale.localeCompare(b.locale));
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.locale]: (acc[r.locale] ?? 0) + 1 }), {});
  const values = rows.map((r) => `    (${[
    sqlText(`${r.use_case_id}-${r.locale}`), sqlText(r.use_case_id), sqlText(r.title), sqlText(r.url),
    sqlText(r.locale), r.duration_seconds === null ? 'NULL' : Math.round(r.duration_seconds), sqlText(r.catalog_version || null),
  ].join(', ')})`);
  const sql = `-- =====================================================================
-- Videos del asistente: carga en help_videos los videos publicados en Drive.
-- GENERADO por scripts/videos/link-drive-videos.mjs (pnpm videos:export-sql)
-- el ${new Date().toISOString().slice(0, 10)} - no editar a mano: regenerarlo después de grabar.
-- ${rows.length} videos (${Object.entries(counts).map(([l, n]) => `${n} ${l}`).join(', ')}) - carpeta de Drive ${FOLDER}
--
-- Repetible: inserta los que faltan y actualiza los que ya están (mismo id
-- <caso>-<locale> que POST help/videos/register). No borra videos.
-- Depende de: 140_20261023_help-assistant-and-onboarding.sql
-- Correrlo en la base de cada entorno (pgAdmin, DBeaver o psql).
-- =====================================================================

BEGIN;

INSERT INTO public.help_videos (id, use_case_id, title, url, locale, duration_seconds, catalog_version)
VALUES
${values.join(',\n')}
ON CONFLICT (id) DO UPDATE
    SET use_case_id = EXCLUDED.use_case_id, title = EXCLUDED.title, url = EXCLUDED.url,
        locale = EXCLUDED.locale, duration_seconds = EXCLUDED.duration_seconds,
        catalog_version = EXCLUDED.catalog_version, status = 'ready', recorded_at = now();

COMMIT;

SELECT locale, count(*) AS videos FROM public.help_videos WHERE status = 'ready' GROUP BY locale ORDER BY locale;
`;
  writeFileSync(resolve(ROOT, SQL_OUT), sql);
  console.log(`[videos] ${rows.length} videos → ${SQL_OUT}`);
  process.exit(0);
}
process.exit(failed ? 1 : 0);
