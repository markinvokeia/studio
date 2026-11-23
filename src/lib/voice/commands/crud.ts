import { topOverlayElement } from '@/lib/voice/dom-dialog';
import { controlsOf, createButtons, fillField, readSurface } from '@/lib/voice/dom-ui';
import { currentRoute, isOnRoute, listNavTargets } from '@/lib/voice/nav-targets';
import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { listVoiceBridges } from '@/lib/voice/screen-bridge';

import type { CrudVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Cualquier lista con la tabla común (DataTable): el Catálogo de la clínica, la Configuración del
 * negocio, Sistema y el resto. «Nuevo medicamento Ibuprofeno» abre el alta y escribe el nombre;
 * «abrí la sede Centro» / «editá el segundo» abre el registro; «¿cuántos hay?»; «actualizá la
 * lista». Lo demás del formulario (campos, listas, interruptores, guardar) va con la voz genérica.
 * Prioridad baja: lo propio de cada pantalla (pacientes, documentos…) gana.
 */

export const CRUD_VOICE_DOMAIN = 'crud';
registerVoiceDomain({ id: CRUD_VOICE_DOMAIN });

const tablesWith = (cap: 'create' | 'open' | 'refresh' | null) => listVoiceBridges<CrudVoiceBridge>('crud').filter((b) => b && Array.isArray(b.rows) && (!cap || !!b[cap]));
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.crud.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success') {
  await ctx.finish({ title: T(ctx, 'title'), message, tone }, message);
}

const VERB_WORDS = /\b(?:nuev[oa]s?|agregar|agrega|crear|crea|añadir|anadir|add|new|create|alta)\b/g;
/** Las palabras de la cosa que crea la tabla («Nuevo medicamento» → «medicamento»). */
const nounOf = (label: string) => normalizeSpeech(label).replace(VERB_WORDS, ' ').replace(/\s+/g, ' ').trim();

/** Singular y plural valen igual («medicamento» = «medicamentos», «sede» = «sedes»). */
const sameWord = (a: string, b: string) => a === b || `${a}s` === b || `${b}s` === a || `${a}es` === b || `${b}es` === a;

/** Cuántas palabras del principio de lo dicho son la cosa («unidad de medida kilo» → 3). */
function nounPrefix(words: string[], noun: string): number {
  const nw = noun.split(' ').filter(Boolean);
  if (!nw.length || words.length < nw.length) return 0;
  return nw.every((w, i) => sameWord(words[i], w)) ? nw.length : 0;
}

/**
 * Lo que es la cosa en la pantalla actual, según el menú (en español e inglés): «Medicamentos»,
 * «Sedes», «Unidades de medida»… Casi ninguna tabla dice en el botón qué crea («Nuevo»).
 */
export function routeNouns(route = currentRoute()): string[] {
  const here = listNavTargets({ t: null, hasPermission: () => true })
    .filter((n) => n.href !== '/' && isOnRoute(n.href, route))
    .sort((a, b) => b.href.length - a.href.length);
  if (!here.length) return [];
  const best = here[0].href;
  return here.filter((n) => n.href === best).flatMap((n) => n.names);
}

/** «sede», «paciente»…: lo que se crea en otra pantalla del menú. */
function isOtherThing(word: string, pageNouns: string[]): boolean {
  if (!word || pageNouns.some((n) => n.split(' ').some((w) => sameWord(word, w)))) return false;
  return listNavTargets({ t: null, hasPermission: () => true }).some((n) => n.names.some((name) => !name.includes(' ') && sameWord(word, name)));
}

type Parsed =
  | { op: 'create'; name: string | null; rawName: string | null }
  | { op: 'open'; text: string }
  | { op: 'count' }
  | { op: 'refresh' };

const CREATE_RE = /^(?:(?:nuev[oa]|agrega\w*|crea\w*|da\w* de alta|carga\w*|anad\w*|add|new|create)\s+)(?:(?:un|una|otro|otra|a|an|another)\s+)?(.*)$/;
const NAMED_RE = /\s+(?:llamad[oa]|que se llame|con (?:el )?nombre|de nombre|named|called)\s+(.+)$/;

export function parseCrud(normalized: string, raw: string, createLabels: string[], pageNouns: string[] = []): Parsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:cuant[oa]s (?:hay|son|tenemos|tengo|registros hay)|cuant[oa]s \w+ (?:hay|tenemos)|how many (?:are there|do we have|\w+ are there))$/.test(t)) return { op: 'count' };
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload)(?: (?:la )?(?:lista|tabla|the list|the table))?$/.test(t)) return { op: 'refresh' };
  // «nuevo», «crear», «agregar uno», «new», «add one»: abre el alta.
  if (/^(?:nuev[oa]|crea\w*|crear|agrega\w*|agregar|anad\w*|da\w* de alta|alta|new|create|add)(?:\s+(?:uno|una|otro|otra|registro|one|another|a new one|record))?$/.test(t)) return { op: 'create', name: null, rawName: null };
  const create = t.match(CREATE_RE);
  if (create) {
    let rest = create[1].trim();
    let name: string | null = null;
    const named = rest.match(NAMED_RE);
    if (named) { name = named[1]; rest = rest.slice(0, named.index).trim(); }
    // «nuevo medicamento Ibuprofeno»: lo que sigue a la cosa (según el botón o el menú) es el nombre.
    const labelNouns = createLabels.map(nounOf).filter(Boolean);
    const words = rest.split(' ').filter(Boolean);
    const consumed = Math.max(0, ...[...labelNouns, ...pageNouns].map((n) => nounPrefix(words, n)));
    const fuzzy = !consumed && labelNouns.some((n) => n.split(' ').some((w) => w.length > 3 && (words[0] ?? '').startsWith(w.slice(0, -1))));
    if (!name && (consumed || fuzzy)) {
      name = words.slice(consumed || 1).join(' ').trim() || null;
    } else if (!name && words.length) {
      // «nueva sede Carrasco» en Medicamentos: es lo que crea otra pantalla, no esta.
      if (labelNouns.length || isOtherThing(words[0], pageNouns)) return null;
      name = rest; // «nuevo Ibuprofeno»
    }
    // El nombre como se dijo (mayúsculas y tildes).
    let rawName: string | null = null;
    if (name) {
      const tokens = raw.trim().split(/\s+/);
      const n = name.split(' ').length;
      const tail = tokens.slice(-n).join(' ').replace(/[.,;:!?]+$/, '');
      rawName = normalizeSpeech(tail) === name ? tail : name;
    }
    return { op: 'create', name, rawName };
  }
  const open = t.match(/^(?:abri\w*|abre|edita\w*|modifica\w*|mostra\w*|muestra\w*|ver|selecciona\w*|elegi\w*|entra\w* (?:a|en)|open|edit|show(?: me)?|select)\s+(?:(?:el|la|los|las|the)\s+)?(.+)$/);
  if (open) return { op: 'open', text: open[1].trim() };
  return null;
}

/** Lo dicho para buscar en la lista, sin la palabra de la cosa («la sede Pocitos» → «pocitos»). */
function searchWords(text: string, table: CrudVoiceBridge): string[] {
  const nouns = [nounOf(table.createLabel), ...routeNouns()].flatMap((n) => n.split(' ')).filter((w) => w.length > 2);
  return normalizeSpeech(text).split(' ').filter((w) => w.length > 1 && !nouns.some((n) => sameWord(w, n)));
}

async function waitForForm(ctx: VoiceCommandContext): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < 2000 && !ctx.signal.aborted) {
    if (readSurface()?.isOverlay) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

registerVoiceCommand<Parsed>({
  id: 'crud.act',
  domain: CRUD_VOICE_DOMAIN,
  priority: 5,
  match: (normalized, raw) => {
    const all = tablesWith(null);
    if (!all.length) return null;
    const parsed = parseCrud(normalized, raw, all.filter((b) => b.create).map((b) => b.createLabel), routeNouns());
    if (!parsed) return null;
    // Con una ventana abierta, lo dicho es para ella: la tabla de atrás solo si se nombra un registro suyo.
    const overlay = topOverlayElement();
    // Salvo «nuevo» frente a una ventana que no crea nada (un aviso de notificaciones): es cambiar de
    // contexto; la sesión cierra la ventana y se abre el alta.
    const overlayCreates = (): boolean => { const s = readSurface(); return !!s?.isOverlay && createButtons(s).length > 0; };
    if (overlay && parsed.op !== 'open' && !all.some((b) => { const r = b.root?.(); return !!r && overlay.contains(r); })
      && !(parsed.op === 'create' && !overlayCreates())) return null;
    // «nuevo» suelto en una lista de solo consulta (historiales, auditoría): se dice que acá no se crea.
    if (parsed.op === 'create' && !tablesWith('create').length) return parsed.name === null && !parsed.rawName ? parsed : null;
    if (parsed.op === 'refresh' && !tablesWith('refresh').length) return null;
    if (parsed.op === 'open') {
      const positional = /^(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last)$/.test(parsed.text);
      const any = tablesWith('open').some((b) => {
        const words = searchWords(parsed.text, b);
        return positional || b.rows.some((r) => { const n = normalizeSpeech(r.label); return words.length > 0 && words.every((w) => n.includes(w)); });
      });
      if (!any) return null;
    }
    return parsed;
  },
  run: async (parsed, ctx) => {
    if (parsed.op === 'count') {
      const t = tablesWith(null)[0];
      await say(ctx, T(ctx, 'count', { count: t.total }), 'info');
      return;
    }
    if (parsed.op === 'refresh') { tablesWith('refresh')[0].refresh!(); await say(ctx, T(ctx, 'refreshed')); return; }
    if (parsed.op === 'create') {
      if (!tablesWith('create').length) {
        // El alta de la pantalla puede ser un botón propio («Crear», «Nuevo feriado»), fuera de la tabla.
        const buttons = createButtons();
        if (buttons.length) { buttons[0].element.click(); await say(ctx, T(ctx, 'createOpened')); return; }
        await say(ctx, T(ctx, 'noCreate'), 'info');
        return;
      }
      tablesWith('create')[0].create!();
      if (!parsed.rawName) { await say(ctx, T(ctx, 'createOpened')); return; }
      const opened = await waitForForm(ctx);
      const surface = opened ? readSurface() : null;
      const fields = surface ? controlsOf(surface, 'field') : [];
      const field = fields.find((f) => /\b(?:nombre|name|descripcion|description|titulo|title)\b/.test(normalizeSpeech(f.label))) ?? fields[0];
      if (!field) { await say(ctx, T(ctx, 'createOpened')); return; }
      await fillField(field.element, parsed.rawName, ctx.signal);
      await say(ctx, T(ctx, 'createFilled', { name: parsed.rawName, field: field.label }));
      return;
    }
    const tables = tablesWith('open');
    for (const table of tables) {
      const words = searchWords(parsed.text, table);
      const position = parseChoice(normalizeSpeech(parsed.text), table.rows.length);
      const positional = /^(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last)$/.test(parsed.text);
      const hits = positional && position !== null ? [table.rows[position]] : table.rows.filter((r) => { const n = normalizeSpeech(r.label); return words.every((w) => n.includes(w)); });
      if (!hits.length) continue;
      let row = hits[0];
      if (hits.length > 1) {
        const question = T(ctx, 'which');
        const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: hits.slice(0, 8).map((r) => ({ label: r.label })) }, `${question} ${hits.slice(0, 5).map((r, i) => `${i + 1}: ${r.label}`).join('. ')}.`);
        row = hits[index];
      }
      table.open!(row.id);
      await say(ctx, T(ctx, 'opened', { label: row.label }));
      return;
    }
    await say(ctx, T(ctx, 'notFound'), 'info');
  },
});
