#!/usr/bin/env node
/**
 * generate-service-catalog.mjs
 * ---------------------------------------------------------------------------
 * Genera las CATEGORÍAS MISCELÁNEAS y el CATÁLOGO DE SERVICIOS de Clínica
 * Imagen a partir de la Orden Digital que los doctores derivadores completan:
 *
 *   https://clinicaimagen.uy/ordenes/orden.html
 *
 * REGLA DE ORO: los nombres de servicio NO se inventan.
 * El nombre sale del `value` del checkbox del formulario, tal cual, normalizado
 * sólo en espacios y punto final. RULES únicamente decide QUÉ ES cada campo
 * (servicio / modificador / región) y cuántos minutos ocupa.
 * La única excepción es `label`, que reemplaza el nombre por la redacción más
 * completa de la orden imprimible cuando el value del web es una abreviatura
 * (p.ej. "ATM" -> "ATM (Boca abierta y cerrada) (LAMINOGRAFÍA)"). Cada override
 * declara su `src` y queda registrado en orden-mapping.json.
 *
 * Modelo de datos (verificado en el código):
 *   misc_categories.name  ←── catalogoservicios.category  (string, NO un id)
 *   El selector de categoría en config/services lista /misc_categories y guarda
 *   el NOMBRE (page.tsx: value={cat.name}). Por eso las categorías van primero:
 *   sin ellas, el servicio queda con una categoría que el desplegable no ofrece.
 *
 * Qué hace
 *   1. Descarga (o lee de disco) el HTML del formulario.
 *   2. Extrae TODOS los checkboxes con su grupo, `id` y `value`.
 *   3. Los clasifica contra RULES:
 *        service   -> fila del catálogo, colgada de su categoría miscelánea
 *        modifier  -> sub-opción anidada en la orden impresa (técnica, espesor,
 *                     arcada, indicación clínica): no se factura aparte
 *        region    -> pieza dentaria ISO 3950
 *        delivery  -> medio de entrega del estudio
 *   4. Falla si aparece un campo que RULES no conoce, o si dos servicios
 *      terminan con el mismo nombre. Nada entra ni se pisa en silencio.
 *   5. Emite en --out (por defecto scripts/sql/).
 *
 * Uso
 *   node scripts/generate-service-catalog.mjs
 *   node scripts/generate-service-catalog.mjs --html ./orden.html --out ./tmp
 *   node scripts/generate-service-catalog.mjs --price-file precios.csv
 *
 * PRECIOS: el formulario no los contiene. Todas las filas salen con price = 0.
 * Cargalos en un CSV `name,price[,currency]` y pasalo con --price-file.
 * ---------------------------------------------------------------------------
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORM_URL = 'https://clinicaimagen.uy/ordenes/orden.html';
const DEFAULT_CURRENCY = 'UYU';
const CATEGORY_TYPE = 'income';   // son servicios facturables

// ─── Tablas destino (DDL real) ───────────────────────────────────────────────
//   miscellaneous_categories(id serial, code, name, description, category_type,
//                            is_active, account_code, parent_id, external_id)
//   service_catalog(id serial, name UNIQUE, description, category [legacy],
//                   category_id FK -> miscellaneous_categories(id),
//                   duration_minutes, price, currency, is_sales, color color_hex,
//                   service_type, specialty, estimated_total_days, external_id)
//
// El vínculo real es category_id. `category` (texto) está marcado legacy en un
// COMMENT de la tabla, pero se completa igual porque getServices() del front lee
// `category_name || category`.
//
// external_id es la clave de idempotencia: único en las dos tablas y estable
// contra el formulario, así que re-correr el SQL nunca duplica ni pisa nada.
const TBL_CAT = 'public.miscellaneous_categories';
const TBL_SRV = 'public.service_catalog';
const EXT_PREFIX = 'ci-orden';                       // origen: Orden Digital
const extCat = (code) => `${EXT_PREFIX}:cat:${code}`;   // varchar(50)
const extSrv = (field) => `${EXT_PREFIX}:svc:${field}`; // text

// ─── Categorías misceláneas (misc_categories) ────────────────────────────────
// Los nombres replican las secciones de la orden. `code` es obligatorio y único.
// El orden de declaración es el orden de salida en todos los artefactos.
const CATEGORIES = {
  INTRA:      { code: 'RX-INTRA',  name: 'Radiografías intrabucales',     color: '#3B82F6',
                desc: 'Sección "Radiografías intrabucales" de la orden de estudio.' },
  EXTRA_OTR:  { code: 'EST-EXTRA', name: 'Otros estudios extraorales',    color: '#6366F1',
                desc: 'Sección "Otros estudios extraorales" de la orden de estudio.' },
  EXTRA_RX:   { code: 'RX-EXTRA',  name: 'Radiografías extraorales',      color: '#0EA5E9',
                desc: 'Sección "Radiografías extraorales" (documentación para ortodoncia).' },
  CEFALO:     { code: 'CEFALO',    name: 'Estudios cefalométricos computarizados', color: '#8B5CF6',
                desc: 'Sección "Estudios cefalométricos computarizados" de la orden.' },
  FOTO:       { code: 'FOTO',      name: 'Fotografías',                   color: '#EC4899',
                desc: 'Sección "Fotografías" de la orden de estudio.' },
  MODELOS:    { code: 'MOD-DIG',   name: 'Modelos digitales',             color: '#14B8A6',
                desc: 'Sección "Modelos digitales (con visualizador 3D)" e impresión de modelos.' },
  ALINEADOR:  { code: 'ALINEA',    name: 'Ortodoncia invisible (alineadores)', color: '#10B981',
                desc: 'Sección "Ortodoncia invisible (alineadores)" de la orden.' },
  CONEBEAM:   { code: 'CONEBEAM',  name: 'Tomografía computarizada volumétrica Cone Beam', color: '#F59E0B',
                desc: 'Sección "Tomografía computarizada volumétrica Cone Beam" de la orden.' },
  GUIA:       { code: 'CIR-GUIA',  name: 'Cirugía guiada para implantes', color: '#EF4444',
                desc: 'Sección "Cirugía guiada para implantes" de la orden.' },
  M3DMIX:     { code: 'M3DMIX',    name: 'Realidad virtual M3DMIX',       color: '#A855F7',
                desc: 'Sección "Realidad virtual M3DMIX" de la orden.' },
  ECO:        { code: 'ECO',       name: 'Ecografías',                    color: '#06B6D4',
                desc: 'Sección "Ecografías" del formulario web.' },
  OTROS:      { code: 'OTROS-SRV', name: 'Otros servicios',               color: '#64748B',
                desc: 'Sección "Otros servicios" de la orden de estudio.' },
};
const CATEGORY_ORDER = Object.values(CATEGORIES).map((c) => c.name);

// ─── Helpers de declaración ──────────────────────────────────────────────────
// svc(categoría, minutos, extras?)  -> el NOMBRE lo aporta el formulario.
//   extras.label : sólo para reemplazar por la redacción de la orden imprimible
//   extras.src   : de dónde sale ese label (obligatorio si hay label)
//   extras.desc  : aclaración entre paréntesis que ya trae el documento
const svc = (cat, minutes, extras = {}) => ({ kind: 'service', cat, minutes, ...extras });
const mod = (of, note = '') => ({ kind: 'modifier', of, note });
const region   = () => ({ kind: 'region' });
const delivery = () => ({ kind: 'delivery' });

/**
 * RULES — un registro por checkbox, indexado por `id` (el `id` es único; el
 * `value` NO lo es: SUPERIOR/INFERIOR se repiten entre placas de contención y
 * de blanqueamiento, y ATM aparece en tres secciones distintas).
 *
 * >>> ÚNICO BLOQUE A TOCAR <<<
 * Para que un ítem deje de facturarse, cambiá svc(...) por mod(...).
 * Los minutos son ocupación estimada de sillón/equipo: ajustalos.
 */
const RULES = {
  // ── Medio de envío ─────────────────────────────────────────────────────────
  'impreso': delivery(), 'imagencloud': delivery(), 'email-medio': delivery(), 'medcloud': delivery(),

  // ── Radiografías intrabucales ──────────────────────────────────────────────
  'conductimetria':      svc('INTRA', 15),
  'periapical':          svc('INTRA', 10),
  'bitewing':            svc('INTRA', 10),
  'periapical-completo': svc('INTRA', 30),
  'oclusal':             svc('INTRA', 10),

  // ── Otros estudios extraorales ─────────────────────────────────────────────
  'ATM':          svc('EXTRA_OTR', 20, { label: 'ATM (Boca abierta y cerrada) (LAMINOGRAFÍA)',
                                         src: 'orden imprimible — el value del web dice sólo "ATM"' }),
  'sub-m-vertex': svc('EXTRA_OTR', 15),
  'mano-puno':    svc('EXTRA_OTR', 15, { label: 'Mano y puño (Carpal)',
                                         src: 'orden imprimible — el value del web dice "Mano y puño"' }),

  // ── Radiografías extraorales ───────────────────────────────────────────────
  'opt':                svc('EXTRA_RX', 10),
  'telerradio-perfil':  svc('EXTRA_RX', 10),
  'telerradio-frontal': svc('EXTRA_RX', 10),
  // sub-opciones indentadas bajo cada telerradiografía en la orden impresa
  'frankfort':                   mod('Telerradiografía Perfil', 'técnica de toma'),
  'horizontal-verdadero':        mod('Telerradiografía Perfil', 'técnica de toma'),
  'labios-reposo':               mod('Telerradiografía Perfil', 'técnica de toma'),
  'labios-contacto':             mod('Telerradiografía Perfil', 'técnica de toma'),
  'telerradio-frontal-analisis': mod('Telerradiografía Frontal', 'el trazado se cobra por la cefalometría elegida'),

  // ── Estudios cefalométricos computarizados ─────────────────────────────────
  'ricketts':          svc('CEFALO', 15),
  'ricketts-resumido': svc('CEFALO', 15),
  'mcnamara':          svc('CEFALO', 15),
  'funcacion-gnathos': svc('CEFALO', 15),
  'roth-jarabak':      svc('CEFALO', 15),
  'bjork':             svc('CEFALO', 15),
  'trevis':            svc('CEFALO', 15),
  'steiner':           svc('CEFALO', 15),
  'vto':               svc('CEFALO', 20),

  // ── Fotografías ────────────────────────────────────────────────────────────
  // Todas son checkboxes de primer nivel en la orden impresa: van como servicio.
  'fotografias-todas':  svc('FOTO', 30),
  'ft-rostro-frente':   svc('FOTO', 10),
  'ft-perfil':          svc('FOTO', 10),
  'ft-rostro-sonrisa':  svc('FOTO', 10),
  'ft-tres-cuartos':    svc('FOTO', 10),
  'ft-oclusal-2':       svc('FOTO', 10),
  'ft-llave-oclusion':  svc('FOTO', 10),
  'ft-overjet':         svc('FOTO', 10),
  'ft-oclusion':        svc('FOTO', 10),
  'ft-oclusion-frente': svc('FOTO', 10),
  'contacto-oclusal':   svc('FOTO', 10),
  'ft-dinamica':        svc('FOTO', 15),

  // ── Modelos digitales ──────────────────────────────────────────────────────
  'Ortodoncia':           svc('MODELOS', 30),
  'Ortopedia':            svc('MODELOS', 30),
  'diagnosticobolton':    svc('MODELOS', 15),
  'diagnosticomoyers':    svc('MODELOS', 15),
  'diagnosticodentarias': svc('MODELOS', 15),
  'modelo-zocalados':     svc('MODELOS', 30),
  'modelos-trabajo':      svc('MODELOS', 30),
  'mordida-constructiva': mod('Impresión de modelos de trabajo', 'va entre paréntesis dentro del ítem en la orden impresa'),
  'duplicado-yeso':       svc('MODELOS', 30),
  'modelo-articulado':    svc('MODELOS', 40),

  // ── Ortodoncia invisible (alineadores) ─────────────────────────────────────
  // La arcada es la única elección de la sección: es lo que se pide y se cobra.
  'ortodoncia-bimaxilar': svc('ALINEADOR', 45),
  'ortodoncia-maxilar':   svc('ALINEADOR', 40),
  'ortodoncia-mandibula': svc('ALINEADOR', 40),

  // ── Tomografía computarizada volumétrica Cone Beam ─────────────────────────
  'maxilar-completo':   svc('CONEBEAM', 20),
  'mandibula-completa': svc('CONEBEAM', 20),
  'hemiarco':           svc('CONEBEAM', 20),
  'tomo-piezas':        svc('CONEBEAM', 15),
  'tomo-sin-separacion': mod('Tomografía Cone Beam', 'indentado bajo "Elementos sueltos" en la orden impresa'),
  // "INDIQUE ESTUDIO PARA": orienta el informe, no cambia el arancel
  'est-tipo-implante':   mod('Tomografía Cone Beam', 'indicación clínica'),
  'est-tipo-endodoncia': mod('Tomografía Cone Beam', 'indicación clínica'),
  'est-tipo-cirugia':    mod('Tomografía Cone Beam', 'indicación clínica'),
  'est-tipo-ortodoncia': mod('Tomografía Cone Beam', 'indicación clínica'),
  'est-tipo-periodoncia':mod('Tomografía Cone Beam', 'indicación clínica'),
  'est-tipo-atm':        mod('Tomografía Cone Beam', 'indicación clínica'),

  // ── Cirugía guiada para implantes ──────────────────────────────────────────
  'servicio-tomografia':   svc('GUIA', 20),
  'servicio-escaneo':      svc('GUIA', 30),
  'servicio-planeamiento': svc('GUIA', 60, { desc: 'Trabajo de laboratorio: no ocupa sillón.' }),
  'guia-precision':        svc('GUIA', 60),
  'guia-fresa':            svc('GUIA', 45),

  // ── Realidad virtual M3DMIX ────────────────────────────────────────────────
  'm3dmix-tercer-molar':        svc('M3DMIX', 30),
  'm3dmix-patologia':           svc('M3DMIX', 30),
  'm3dmix-mandibular':          svc('M3DMIX', 30),
  'm3dmix-maxilares-implantes': svc('M3DMIX', 30),

  // ── Ecografías ─────────────────────────────────────────────────────────────
  'eco-atm':            svc('ECO', 20),
  'eco-partes-blandas': svc('ECO', 20, { label: 'Partes blandas',
                                         src: 'label del formulario — el value dice "ATM" por un bug del sitio' }),

  // ── Otros servicios ────────────────────────────────────────────────────────
  'solo-escaneo':   svc('OTROS', 30),
  'DOE':            svc('OTROS', 45, { desc: 'Escaneado bucal + Planeamiento + Placa impresa' }),
  'DAM':            svc('OTROS', 45, { label: 'Dispositivo avance mandibular (DAM)',
                                       src: 'orden imprimible — el value del web dice sólo "DAM"' }),
  'diseno-sonrisa': svc('OTROS', 60, { desc: 'Fotografías + Escaneo bucal + Diseño + Impresión modelo' }),
  'escaneo-ortodoncia-placas': svc('OTROS', 45),
  'escaneo-superior':   mod('Escaneo final de ortodoncia + placas de contención', 'arcada'),
  'escaneo-inferior':   mod('Escaneo final de ortodoncia + placas de contención', 'arcada'),
  'escaneo-placa-75':   mod('Escaneo final de ortodoncia + placas de contención', 'espesor'),
  'escaneo-placa-1':    mod('Escaneo final de ortodoncia + placas de contención', 'espesor'),
  'escaneo-placa-15':   mod('Escaneo final de ortodoncia + placas de contención', 'espesor'),
  'escaneo-recto':      mod('Escaneo final de ortodoncia + placas de contención', 'borde'),
  'escaneo-festoneado': mod('Escaneo final de ortodoncia + placas de contención', 'borde'),
  'placas-blanqueamiento': svc('OTROS', 40, { desc: 'Escaneo bucal + Impresión de modelo + placas' }),
  'placas-superior':    mod('Placas de blanqueamiento', 'arcada'),
  'placas-inferior':    mod('Placas de blanqueamiento', 'arcada'),
  'perioguide':          svc('OTROS', 60, { desc: 'Escaneo bucal + Impresión de modelo + guías' }),
  'cirugia-ortognatica': svc('OTROS', 90, { desc: 'Escaneo bucal + tomografía + planeamiento + Splits' }),
  'endoguide':           svc('OTROS', 60, { desc: 'Tomografía + escaneo + planeamiento + guía impresa' }),
  'protector-bucal':     svc('OTROS', 40, { desc: 'Escaneo + modelo + protector bucal' }),
};

// Campos de texto/fecha que acompañan a un servicio (no generan fila).
const TEXT_OPTIONS = {
  'indiacion-opt': 'Indicación de la OPT',
  'estudio-cefalo-compu-otros': 'Otro estudio cefalométrico (texto libre)',
  'fotografia-interes': 'Interés de la foto en dinámica',
  'ortodoncia-marca': 'Marca o sistema de alineadores',
  'ortodoncia-info-clinica': 'Información clínica de alineadores',
  'tomo-elementos-sueltos': 'Cone Beam · elementos sueltos',
  'interes-estudio-tomo': 'Interés del estudio Cone Beam',
  'implante-marca': 'Marca del implante',
  'implante-ubicacion': 'Ubicación del implante',
  'implante-fecha-cirugia': 'Fecha probable de cirugía',
  'eco-interes': 'Interés del estudio ecográfico',
  'solo-escaneo-interes': 'Interés del escaneo',
  'color-protector': 'Color del protector bucal',
  'aclaracion': 'Aclaración del profesional',
};

const REGION_RE = /^(intra|tomo)-\d{2}$/;

/**
 * Campos de texto cuya sección la posición en el DOM no resuelve bien.
 *
 * La heurística "último servicio que lo precede" acierta en 13 de 14 casos. Falla
 * cuando el campo ABRE la sección en vez de colgar de un ítem: `ortodoncia-marca`
 * está entre el título "ORTODONCIA INVISIBLE (ALINEADORES)" y sus checkboxes, así
 * que el servicio anterior pertenece a la sección de arriba. El dato está en el
 * título, no en el orden, y parsear títulos sería más frágil que declararlo acá.
 */
const TEXT_FIELD_SECTION_OVERRIDES = {
  'ortodoncia-marca': 'ALINEA',
};

// Normaliza el value del formulario: espacios repetidos y punto final sobrante.
const cleanName = (v) => v.replace(/\s+/g, ' ').trim().replace(/\.$/, '');

// ─── Parseo del formulario ───────────────────────────────────────────────────
function parseCheckboxes(html) {
  const out = [];
  let order = 0;
  for (const [tag] of html.matchAll(/<input\b[^>]*>/gi)) {
    const attr = (n) => (tag.match(new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1];
    if ((attr('type') || '').toLowerCase() !== 'checkbox') continue;
    out.push({
      id: attr('id') || '',
      group: (attr('name') || '').replace(/\[\]$/, ''),
      value: attr('value') || '',
      order: order++,
    });
  }
  return out;
}

/**
 * Posición de cada campo de texto/fecha/textarea dentro del documento, contada
 * en "checkboxes que lo preceden".
 *
 * Sirve para saber a qué sección pertenece cada campo libre sin escribirlo a
 * mano: en la orden impresa, "Indicación" está debajo de la OPT y "Marca del
 * implante" dentro de cirugía guiada, y esa pertenencia está codificada en el
 * orden del DOM. Derivarla es fiel al formulario y sobrevive a que lo reordenen.
 */
function parseTextFieldPositions(html) {
  const positions = new Map();
  let checkboxCount = 0;
  const re = /<(input|textarea)\b[^>]*>/gi;
  for (const [tag, kind] of html.matchAll(re)) {
    const attr = (n) => (tag.match(new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1];
    const type = (attr('type') || '').toLowerCase();
    if (kind.toLowerCase() === 'input' && type === 'checkbox') {
      checkboxCount++;
      continue;
    }
    // Algunos campos del formulario no llevan `id`, sólo `name`
    // (p.ej. solo-escaneo-interes). Se indexa por lo que haya.
    const key = attr('id') || (attr('name') || '').replace(/\[\]$/, '');
    if (key) positions.set(key, checkboxCount);
  }
  return positions;
}

async function loadHtml(localPath) {
  if (localPath) return readFileSync(localPath, 'utf8');
  const res = await fetch(FORM_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvokeIA-catalog-generator)' } });
  if (!res.ok) throw new Error(`No se pudo descargar ${FORM_URL} (HTTP ${res.status})`);
  return res.text();
}

// ─── Precios opcionales ──────────────────────────────────────────────────────
function splitCsvLine(line) {
  const cells = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
}

function loadPrices(path) {
  const map = new Map();
  if (!path) return map;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || /^name\s*,/i.test(line)) continue;
    const [name, price, currency] = splitCsvLine(line);
    if (name) map.set(cleanName(name).toLowerCase(), { price: Number(price) || 0, currency: (currency || DEFAULT_CURRENCY).trim() });
  }
  return map;
}

// ─── Emisores ────────────────────────────────────────────────────────────────
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const sqlLit = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

function buildCategoriesCsv(cats) {
  const head = 'code,name,description,category_type,is_active,external_id';
  return [head, ...cats.map((c) =>
    [c.code, c.name, c.desc, CATEGORY_TYPE, 'true', extCat(c.code)].map(csvCell).join(','))].join('\n') + '\n';
}

function buildServicesCsv(services) {
  const head = 'name,category,category_code,price,duration_minutes,currency,description,indications,color,is_active,external_id';
  const rows = services.map((s) =>
    [s.name, s.category, s.category_code, s.price, s.duration_minutes, s.currency,
     s.description, '', s.color, 'true', extSrv(s.field)].map(csvCell).join(','));
  return [head, ...rows].join('\n') + '\n';
}

function buildCurlScript(cats) {
  const L = [];
  L.push('#!/usr/bin/env bash');
  L.push('# Crea las categorías vía API (/misc_categories/upsert) en lugar de SQL directo.');
  L.push('#   API_BASE=https://... API_TOKEN=<jwt> bash crear-categorias.sh');
  L.push('#');
  L.push('# OJO: el endpoint sólo acepta name/code/description/type/is_active. NO setea');
  L.push('# external_id, así que las categorías creadas por esta vía se resuelven después');
  L.push('# por nombre. El SQL contempla las dos formas (external_id o LOWER(name)).');
  L.push('set -euo pipefail');
  L.push(': "${API_BASE:?falta API_BASE}"');
  L.push(': "${API_TOKEN:?falta API_TOKEN}"');
  L.push('');
  for (const c of cats) {
    const payload = JSON.stringify({ name: c.name, code: c.code, description: c.desc, type: CATEGORY_TYPE, is_active: true });
    L.push(`echo "→ ${c.code}"`);
    L.push(`curl -sS -X POST "$API_BASE/misc_categories/upsert" \\`);
    L.push(`  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \\`);
    L.push(`  -d ${JSON.stringify(payload)}`);
    L.push('echo');
  }
  return L.join('\n') + '\n';
}

function buildSql(cats, services, meta) {
  const L = [];
  const catExts = cats.map((c) => sqlLit(extCat(c.code)));
  L.push('-- ============================================================================');
  L.push('--  Clínica Imagen — Categorías + catálogo de servicios');
  L.push(`--  Generado por scripts/generate-service-catalog.mjs el ${meta.date}`);
  L.push(`--  Fuente: ${FORM_URL}`);
  L.push(`--  ${cats.length} categorías (${TBL_CAT}) · ${services.length} servicios (${TBL_SRV}).`);
  L.push('--');
  L.push('--  Los nombres de servicio son el `value` del checkbox del formulario, tal');
  L.push('--  cual. No hay nombres inventados.');
  L.push('--');
  L.push('--  IDEMPOTENTE por external_id (único en las dos tablas):');
  L.push(`--     categorías -> '${extCat('<CODE>')}'`);
  L.push(`--     servicios  -> '${extSrv('<id del checkbox>')}'`);
  L.push('--  Re-correrlo no duplica ni pisa filas. Para volver atrás, el bloque del');
  L.push('--  final borra exactamente lo que este script insertó.');
  L.push('--');
  L.push('--  El vínculo servicio->categoría es category_id (FK). Se completa además');
  L.push('--  el campo legacy `category` porque el front lee `category_name || category`.');
  L.push('--');
  L.push('--  >>> PRECIOS: todas las filas salen en 0. Cargalos antes de facturar.');
  L.push('--  NOTA: service_catalog tiene un trigger de auditoría; esta carga escribe');
  L.push(`--  ${services.length} filas en el log de cambios.`);
  L.push('-- ============================================================================');
  L.push('');
  L.push('BEGIN;');
  L.push('');
  L.push('-- ── PASO 1 · Categorías ────────────────────────────────────────────────────');
  L.push(`WITH cats (code, name, description, category_type, external_id) AS (`);
  L.push('  VALUES');
  cats.forEach((c, i) => {
    L.push(`    (${sqlLit(c.code)}, ${sqlLit(c.name)}, ${sqlLit(c.desc)}, ${sqlLit(CATEGORY_TYPE)}, ${sqlLit(extCat(c.code))})` +
           (i === cats.length - 1 ? '' : ','));
  });
  L.push(')');
  L.push(`INSERT INTO ${TBL_CAT} (code, name, description, category_type, is_active, external_id)`);
  L.push('SELECT c.code, c.name, c.description, c.category_type, true, c.external_id');
  L.push('  FROM cats c');
  L.push(' WHERE NOT EXISTS (');
  L.push(`   SELECT 1 FROM ${TBL_CAT} m`);
  L.push('    WHERE m.external_id = c.external_id OR LOWER(m.name) = LOWER(c.name)');
  L.push(' );');
  L.push('');
  L.push('-- ── PASO 2 · Cortafuegos ───────────────────────────────────────────────────');
  L.push('-- Ningún servicio puede insertarse sin su categoría: si falta alguna, la');
  L.push('-- transacción aborta acá y no se escribe nada.');
  L.push('DO $$');
  L.push('DECLARE faltan text;');
  L.push('BEGIN');
  L.push('  SELECT string_agg(c.name, \', \')');
  L.push('    INTO faltan');
  L.push('    FROM (VALUES');
  cats.forEach((c, i) => {
    L.push(`      (${sqlLit(c.name)}, ${sqlLit(extCat(c.code))})` + (i === cats.length - 1 ? '' : ','));
  });
  L.push('    ) AS c(name, external_id)');
  L.push('   WHERE NOT EXISTS (');
  L.push(`     SELECT 1 FROM ${TBL_CAT} m`);
  L.push('      WHERE m.external_id = c.external_id OR LOWER(m.name) = LOWER(c.name)');
  L.push('   );');
  L.push('  IF faltan IS NOT NULL THEN');
  L.push('    RAISE EXCEPTION \'Faltan categorías en ' + TBL_CAT + ': %\', faltan;');
  L.push('  END IF;');
  L.push('END $$;');
  L.push('');
  L.push('-- ── PASO 3 · Servicios, colgados de su categoría por category_id ───────────');
  L.push('WITH nuevos (external_id, name, cat_external_id, cat_name, price,');
  L.push('             duration_minutes, currency, description, color) AS (');
  L.push('  VALUES');
  services.forEach((s, i) => {
    L.push(`    (${sqlLit(extSrv(s.field))}, ${sqlLit(s.name)}, ${sqlLit(extCat(s.category_code))}, ${sqlLit(s.category)},`);
    L.push(`     ${s.price}::numeric(10,2), ${s.duration_minutes}::int, ${sqlLit(s.currency)}, ${sqlLit(s.description)}, ${sqlLit(s.color)}::color_hex)` +
           (i === services.length - 1 ? '' : ','));
  });
  L.push(')');
  L.push(`INSERT INTO ${TBL_SRV}`);
  L.push('       (name, description, category, category_id, duration_minutes, price,');
  L.push('        currency, is_active, is_sales, color, service_type, external_id)');
  L.push('SELECT n.name, n.description, n.cat_name, mc.id, n.duration_minutes, n.price,');
  L.push("       n.currency, true, true, n.color, 'single', n.external_id");
  L.push('  FROM nuevos n');
  L.push('  JOIN LATERAL (');
  L.push(`    SELECT m.id FROM ${TBL_CAT} m`);
  L.push('     WHERE m.external_id = n.cat_external_id OR LOWER(m.name) = LOWER(n.cat_name)');
  L.push('     ORDER BY (m.external_id = n.cat_external_id) DESC NULLS LAST, m.id');
  L.push('     LIMIT 1');
  L.push('  ) mc ON true');
  L.push(' WHERE NOT EXISTS (');
  L.push(`   SELECT 1 FROM ${TBL_SRV} s`);
  L.push('    WHERE LOWER(s.name) = LOWER(n.name) OR s.external_id = n.external_id');
  L.push(' );');
  L.push('');
  L.push('-- ── PASO 4 · Verificación ──────────────────────────────────────────────────');
  L.push('-- (a) Qué quedó cargado y cuánto falta tarifar.');
  L.push('SELECT m.code, m.name AS categoria,');
  L.push('       COUNT(s.id)                            AS servicios,');
  L.push('       COUNT(*) FILTER (WHERE s.price = 0)    AS sin_precio');
  L.push(`  FROM ${TBL_CAT} m`);
  L.push(`  LEFT JOIN ${TBL_SRV} s ON s.category_id = m.id`);
  L.push(` WHERE m.external_id IN (${catExts.join(', ')})`);
  L.push(' GROUP BY m.code, m.name');
  L.push(' ORDER BY m.code;');
  L.push('');
  L.push('-- (b) Servicios del formulario que NO se insertaron porque el nombre ya');
  L.push('--     existía en el catálogo (service_catalog.name es UNIQUE). Nombres como');
  L.push('--     "Perfil", "Ortodoncia", "Tomografía" o "Escaneo" son propensos a chocar.');
  L.push('--     Si aparecen filas, revisá si son el mismo servicio o hay que renombrar.');
  L.push('WITH esperados (external_id, name) AS (');
  L.push('  VALUES');
  services.forEach((s, i) => {
    L.push(`    (${sqlLit(extSrv(s.field))}, ${sqlLit(s.name)})` + (i === services.length - 1 ? '' : ','));
  });
  L.push(')');
  L.push('SELECT e.name AS no_insertado, s.id AS id_existente, s.category AS categoria_existente');
  L.push('  FROM esperados e');
  L.push(`  JOIN ${TBL_SRV} s ON LOWER(s.name) = LOWER(e.name)`);
  L.push(' WHERE s.external_id IS DISTINCT FROM e.external_id');
  L.push(' ORDER BY e.name;');
  L.push('');
  L.push('-- (c) Control de totales.');
  L.push(`SELECT COUNT(*) AS servicios_de_la_orden FROM ${TBL_SRV}`);
  L.push(` WHERE external_id LIKE '${EXT_PREFIX}:svc:%';`);
  L.push('');
  L.push('COMMIT;');
  L.push('-- ROLLBACK;  -- usar en lugar de COMMIT si (b) trae sorpresas o (c) no cuadra');
  L.push('');
  L.push('-- ── Deshacer ───────────────────────────────────────────────────────────────');
  L.push('-- Borra exactamente lo que insertó este script y nada más (se apoya en');
  L.push('-- external_id). Las categorías sólo caen si no quedó ningún servicio colgado.');
  L.push('/*');
  L.push('BEGIN;');
  L.push(`DELETE FROM ${TBL_SRV} WHERE external_id LIKE '${EXT_PREFIX}:svc:%';`);
  L.push(`DELETE FROM ${TBL_CAT} m`);
  L.push(` WHERE m.external_id LIKE '${EXT_PREFIX}:cat:%'`);
  L.push(`   AND NOT EXISTS (SELECT 1 FROM ${TBL_SRV} s WHERE s.category_id = m.id);`);
  L.push('COMMIT;');
  L.push('*/');
  L.push('');
  L.push('-- ── Opcional: re-sincronizar filas ya existentes ───────────────────────────');
  L.push('-- Refresca categoría, duración y color sin tocar price ni is_active.');
  L.push('/*');
  L.push('BEGIN;');
  L.push('WITH v (external_id, cat_external_id, duration_minutes, color) AS (');
  L.push('  VALUES');
  services.forEach((s, i) => {
    L.push(`    (${sqlLit(extSrv(s.field))}, ${sqlLit(extCat(s.category_code))}, ${s.duration_minutes}::int, ${sqlLit(s.color)}::color_hex)` +
           (i === services.length - 1 ? '' : ','));
  });
  L.push(')');
  L.push(`UPDATE ${TBL_SRV} s`);
  L.push('   SET category_id = m.id, category = m.name,');
  L.push('       duration_minutes = v.duration_minutes, color = v.color');
  L.push(`  FROM v JOIN ${TBL_CAT} m ON m.external_id = v.cat_external_id`);
  L.push(' WHERE s.external_id = v.external_id;');
  L.push('COMMIT;');
  L.push('*/');
  return L.join('\n') + '\n';
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const arg = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : dflt; };

  const outDir    = arg('--out', join(ROOT, 'scripts', 'sql'));
  const htmlPath  = arg('--html', null);
  const priceFile = arg('--price-file', null);

  const html = await loadHtml(htmlPath);
  const boxes = parseCheckboxes(html);
  if (!boxes.length) throw new Error('No se encontró ningún checkbox: ¿cambió la estructura del formulario?');

  const prices = loadPrices(priceFile);
  const cats = Object.values(CATEGORIES);
  const textPositions = parseTextFieldPositions(html);

  /**
   * Sección a la que pertenece un campo de texto: la del último SERVICIO que lo
   * precede en el DOM. Devuelve null si no hay ninguno antes (la aclaración del
   * profesional, que está en la cabecera del formulario).
   */
  const sectionOfTextField = (field) => {
    if (TEXT_FIELD_SECTION_OVERRIDES[field]) return TEXT_FIELD_SECTION_OVERRIDES[field];
    const position = textPositions.get(field);
    if (position === undefined) return null;
    let best = null;
    for (const box of boxes) {
      if (box.order >= position) break;
      const rule = RULES[box.id];
      if (rule?.kind === 'service') best = CATEGORIES[rule.cat].code;
    }
    return best;
  };

  const services = [];
  const modifiers = {};
  const deliveries = [];
  const overrides = [];
  const unknown = [];
  const byName = new Map();
  let nRegions = 0;

  for (const box of boxes) {
    if (REGION_RE.test(box.id)) { nRegions++; continue; }
    const rule = RULES[box.id];
    if (!rule) { unknown.push(box); continue; }

    if (rule.kind === 'delivery') { deliveries.push({ field: box.id, label: cleanName(box.value) }); continue; }
    if (rule.kind === 'modifier') { (modifiers[rule.of] ||= []).push({ field: box.id, label: cleanName(box.value), note: rule.note }); continue; }
    if (rule.kind !== 'service') continue;

    const formValue = cleanName(box.value);
    const name = rule.label ? rule.label : formValue;
    if (rule.label) overrides.push({ field: box.id, form_value: formValue, name, src: rule.src || '(sin declarar)' });

    const prev = byName.get(name.toLowerCase());
    if (prev) { prev.dupe = box; continue; }

    const cat = CATEGORIES[rule.cat];
    const p = prices.get(name.toLowerCase());
    const row = {
      field: box.id, group: box.group, form_value: formValue, name,
      category: cat.name, category_code: cat.code, color: cat.color,
      duration_minutes: rule.minutes, description: rule.desc || '',
      price: p ? p.price : 0, currency: p ? p.currency : DEFAULT_CURRENCY,
    };
    byName.set(name.toLowerCase(), row);
    services.push(row);
  }

  if (unknown.length) {
    console.error('\n✗ El formulario tiene campos que RULES no conoce.');
    console.error('  Agregalos a RULES en scripts/generate-service-catalog.mjs y volvé a correr:\n');
    for (const u of unknown) console.error(`    id="${u.id}"  grupo="${u.group}"  value="${u.value}"`);
    console.error('');
    process.exit(1);
  }
  const dupes = services.filter((s) => s.dupe);
  if (dupes.length) {
    console.error('\n✗ Dos checkboxes distintos producen el mismo nombre de servicio.');
    console.error('  catalogoservicios deduplica por LOWER(name): uno pisaría al otro.');
    console.error('  Resolvelo con un `label` en RULES tomado de la orden imprimible:\n');
    for (const d of dupes) console.error(`    "${d.name}"  <-  id="${d.field}"  y  id="${d.dupe.id}"`);
    console.error('');
    process.exit(1);
  }

  const catIndex = (n) => { const i = CATEGORY_ORDER.indexOf(n); return i < 0 ? 999 : i; };
  services.sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, 'es'));

  const meta = { date: new Date().toISOString().slice(0, 10), source: FORM_URL,
                 generator: 'scripts/generate-service-catalog.mjs' };
  const mapping = {
    _meta: { ...meta, naming_rule: 'service.name = value del checkbox del formulario, salvo los overrides listados en `name_overrides`.' },
    tables: { categories: TBL_CAT, services: TBL_SRV, idempotency_key: 'external_id' },
    categories: cats.map((c) => ({
      code: c.code, name: c.name, type: CATEGORY_TYPE, description: c.desc,
      color: c.color, external_id: extCat(c.code),
    })),
    name_overrides: overrides,
    delivery: deliveries,
    regions: { count: nRegions, note: 'Piezas dentarias ISO 3950 (intrabucales y Cone Beam): región del estudio, no servicio.' },
    text_options: Object.entries(TEXT_OPTIONS).map(([field, label]) => ({
      field,
      label,
      // Sección del último servicio que aparece antes del campo en el DOM.
      // `null` = campo de la orden, no de una sección (la aclaración del
      // profesional, que está en la cabecera).
      section_code: sectionOfTextField(field),
    })),
    services: services.map((s) => ({
      field: s.field, group: s.group, form_value: s.form_value, service: s.name,
      external_id: extSrv(s.field),
      category: s.category, category_code: s.category_code,
      category_external_id: extCat(s.category_code),
      duration_minutes: s.duration_minutes, modifiers: modifiers[s.name] || [],
    })),
    section_modifiers: Object.entries(modifiers)
      .filter(([of]) => !byName.has(of.toLowerCase()))
      .map(([of, mods]) => ({ applies_to_section: of, modifiers: mods })),
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'catalogo-clinica-imagen.sql'), buildSql(cats, services, meta), 'utf8');
  writeFileSync(join(outDir, 'categorias-miscelaneas.csv'), buildCategoriesCsv(cats), 'utf8');
  writeFileSync(join(outDir, 'categorias-miscelaneas.json'),
    JSON.stringify(cats.map((c) => ({ name: c.name, code: c.code, description: c.desc, type: CATEGORY_TYPE, is_active: true })), null, 2) + '\n', 'utf8');
  writeFileSync(join(outDir, 'crear-categorias.sh'), buildCurlScript(cats), { encoding: 'utf8', mode: 0o755 });
  writeFileSync(join(outDir, 'catalogo-servicios.csv'), buildServicesCsv(services), 'utf8');
  writeFileSync(join(outDir, 'orden-mapping.json'), JSON.stringify(mapping, null, 2) + '\n', 'utf8');

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log(`\nFuente: ${htmlPath || FORM_URL}`);
  console.log(`Checkboxes leídos: ${boxes.length}  (${nRegions} son piezas dentarias)\n`);
  console.log(`${cats.length} categorías misceláneas (type=${CATEGORY_TYPE}) y sus servicios`);
  for (const c of cats) {
    const rows = services.filter((s) => s.category === c.name);
    console.log(`\n  [${c.code}] ${c.name}  · ${rows.length}`);
    for (const r of rows) console.log(`      ${r.name}${r.name !== r.form_value ? `   (value del form: "${r.form_value}")` : ''}`);
  }
  const nMod = Object.values(modifiers).reduce((a, m) => a + m.length, 0);
  console.log(`\n  TOTAL ${services.length} servicios · ${nMod} modificadores · ${deliveries.length} medios de entrega`);
  console.log(`\nEscrito en ${outDir}:`);
  console.log(`  catalogo-clinica-imagen.sql   ${TBL_CAT} + ${TBL_SRV}, una transacción`);
  console.log('  categorias-miscelaneas.csv    referencia / carga manual');
  console.log('  categorias-miscelaneas.json   payloads para /misc_categories/upsert');
  console.log('  crear-categorias.sh           las crea vía API');
  console.log('  catalogo-servicios.csv        importador CSV de servicios');
  console.log('  orden-mapping.json            campo del form -> servicio / modificador');
  console.log('\nAVISOS');
  const sinPrecio = services.filter((s) => s.price === 0).length;
  if (sinPrecio) console.log(`  · ${sinPrecio} servicios con price = 0. Cargá el tarifario (--price-file) o editá el CSV.`);
  if (overrides.length) {
    console.log(`  · ${overrides.length} nombres tomados de la orden imprimible en vez del value del web:`);
    for (const o of overrides) console.log(`      "${o.form_value}" -> "${o.name}"  (${o.src})`);
  }
  console.log('  · Ecografías y VTO están en el formulario web pero NO en la orden imprimible');
  console.log('    2026: confirmá con la clínica que siguen vigentes.');
  console.log('  · service_catalog.name es UNIQUE: nombres genéricos del formulario');
  console.log('    ("Perfil", "Ortodoncia", "Tomografía", "Escaneo", "Planeamiento",');
  console.log('    "Patología", "Maxilar", "Mandíbula") pueden chocar con servicios ya');
  console.log('    cargados. La consulta (b) del PASO 4 lista los que no entren.');
  console.log('');
}

main().catch((err) => { console.error(`\n✗ ${err.message}\n`); process.exit(1); });
