import { controlsOf, readSurface, typeInto } from '@/lib/voice/dom-ui';
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

type Parsed =
  | { op: 'create'; name: string | null; rawName: string | null }
  | { op: 'open'; text: string }
  | { op: 'count' }
  | { op: 'refresh' };

const CREATE_RE = /^(?:(?:nuev[oa]|agrega\w*|crea\w*|da\w* de alta|carga\w*|anad\w*|add|new|create)\s+)(?:(?:un|una|otro|otra|a|an|another)\s+)?(.*)$/;
const NAMED_RE = /\s+(?:llamad[oa]|que se llame|con (?:el )?nombre|de nombre|named|called)\s+(.+)$/;

export function parseCrud(normalized: string, raw: string, createLabels: string[]): Parsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:cuant[oa]s (?:hay|son|tenemos|tengo|registros hay)|cuant[oa]s \w+ (?:hay|tenemos)|how many (?:are there|do we have|\w+ are there))$/.test(t)) return { op: 'count' };
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload)(?: (?:la )?(?:lista|tabla|the list|the table))?$/.test(t)) return { op: 'refresh' };
  const create = t.match(CREATE_RE);
  if (create) {
    let rest = create[1].trim();
    let name: string | null = null;
    const named = rest.match(NAMED_RE);
    if (named) { name = named[1]; rest = rest.slice(0, named.index).trim(); }
    // «nuevo medicamento Ibuprofeno»: lo que sigue a la cosa (según el botón de la tabla) es el nombre.
    const noun = createLabels.map(nounOf).filter(Boolean).find((n) => rest === n || rest.startsWith(`${n} `) || n.split(' ').some((w) => w.length > 3 && rest.split(' ')[0].startsWith(w.slice(0, -1))));
    if (!name && noun) {
      const words = noun.split(' ').length;
      const after = rest.split(' ').slice(words).join(' ').trim();
      name = after || null;
    } else if (!name && !noun && rest && createLabels.length && !createLabels.some((l) => nounOf(l) === '')) {
      return null; // «nuevo X» que no es lo que crea esta tabla
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
  const noun = new Set(nounOf(table.createLabel).split(' ').filter(Boolean).flatMap((w) => [w, `${w}s`, w.replace(/s$/, '')]));
  return normalizeSpeech(text).split(' ').filter((w) => w.length > 1 && !noun.has(w));
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
    const parsed = parseCrud(normalized, raw, all.filter((b) => b.create).map((b) => b.createLabel));
    if (!parsed) return null;
    if (parsed.op === 'create' && !tablesWith('create').length) return null;
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
      tablesWith('create')[0].create!();
      if (!parsed.rawName) { await say(ctx, T(ctx, 'createOpened')); return; }
      const opened = await waitForForm(ctx);
      const surface = opened ? readSurface() : null;
      const fields = surface ? controlsOf(surface, 'field') : [];
      const field = fields.find((f) => /\b(?:nombre|name|descripcion|description|titulo|title)\b/.test(normalizeSpeech(f.label))) ?? fields[0];
      if (!field) { await say(ctx, T(ctx, 'createOpened')); return; }
      typeInto(field.element, parsed.rawName);
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
