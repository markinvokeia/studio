import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge, listVoiceBridges } from '@/lib/voice/screen-bridge';

import type { DocumentsVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Facturas, pagos y presupuestos por voz, en cualquier tabla que los muestre (Ventas, Compras, la
 * ficha del paciente): «¿cuántas facturas hay?», «¿cuánto suman las pendientes?», «abrí la factura
 * 120», «imprimí la de Juan», «mandá por mail el presupuesto P-10», «confirmá el primero», «cobrá la
 * factura 120», «asigná el pago 45», «nueva factura», «exportá», «solo las pagadas». Los avisos que
 * se abren (confirmar una factura) se contestan con la voz como cualquier aviso.
 */

export const DOCUMENTS_VOICE_DOMAIN = 'documents';
registerVoiceDomain({ id: DOCUMENTS_VOICE_DOMAIN });

type Kind = DocumentsVoiceBridge['kind'];
type Row = DocumentsVoiceBridge['rows'][number];
const tables = () => listVoiceBridges<DocumentsVoiceBridge>('documents').filter((b) => b && Array.isArray(b.rows));
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.documents.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}
const money = (amount: number, currency: string, locale: string) => {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'UYU', maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount}`; }
};

const KIND_WORDS: Array<[RegExp, Kind]> = [
  [/\b(?:facturas?|facturacion|invoices?|bills?)\b/, 'invoice'],
  [/\b(?:pagos?|cobros?|recibos?|payments?|receipts?)\b/, 'payment'],
  [/\b(?:presupuestos?|cotizacion(?:es)?|quotes?|estimates?)\b/, 'quote'],
];
const kindIn = (t: string): Kind | null => KIND_WORDS.find(([re]) => re.test(t))?.[1] ?? null;

/** La tabla de la que se habla: la del tipo nombrado, si no la principal (la que no es chica). */
function tableFor(kind: Kind | null): DocumentsVoiceBridge | null {
  const all = tables();
  const ofKind = kind ? all.filter((b) => b.kind === kind) : all;
  return ofKind.find((b) => !b.compact) ?? ofKind[0] ?? null;
}

type Target = { by: 'number'; value: string } | { by: 'name'; value: string } | { by: 'position'; value: string } | null;

export function parseTarget(t: string): Target {
  const num = t.match(/\b(?:factura|pago|cobro|recibo|presupuesto|cotizacion|invoice|payment|receipt|quote|estimate|numero|nro|number|#)\s+(?:numero\s+|nro\s+|number\s+)?([a-z]{0,3}\s?\d{1,9})\b/);
  if (num) return { by: 'number', value: num[1].replace(/\s/g, '') };
  const pos = t.match(/\b(?:la|el|the)\s+(primer[ao]?|segund[ao]|tercer[ao]?|cuart[ao]|quint[ao]|ultim[ao]|penultim[ao]|first|second|third|fourth|fifth|last)\b/);
  if (pos) return { by: 'position', value: pos[1] };
  const name = t.match(/\b(?:la|el|las|los|the)\s+(?:(?:factura|pago|cobro|recibo|presupuesto|invoice|payment|quote|one)s?\s+)?(?:de|del|para|a|of|for|to)\s+(?:la\s+|el\s+)?(?:paciente\s+|patient\s+|proveedor\s+|provider\s+|supplier\s+)?([a-z][a-z ]{1,40})$/);
  if (name) return { by: 'name', value: name[1].trim() };
  return null;
}

function resolve(target: Target, table: DocumentsVoiceBridge): Row[] {
  if (!target) return [];
  if (target.by === 'number') {
    const digits = target.value.replace(/\D/g, '');
    return table.rows.filter((r) => normalizeSpeech(r.docNo).replace(/\s/g, '') === target.value || r.docNo.replace(/\D/g, '') === digits || r.id === digits);
  }
  if (target.by === 'position') { const i = parseChoice(target.value, table.rows.length); return i === null ? [] : [table.rows[i]]; }
  const words = normalizeSpeech(target.value).split(' ').filter((w) => w.length > 1);
  return table.rows.filter((r) => { const n = normalizeSpeech(r.party); return words.every((w) => n.includes(w)); });
}

const isPending = (r: Row) => r.paymentStatus ? !/^paid$/i.test(r.paymentStatus) : false;

type Op = 'read' | 'open' | 'print' | 'email' | 'edit' | 'confirm' | 'reject' | 'pay' | 'allocate' | 'create' | 'refresh' | 'export' | 'filter';
interface DocParsed { op: Op; kind: Kind | null; target: Target; pendingOnly: boolean; filter: string | null }

const OPS: Array<[RegExp, Op]> = [
  [/^(?:imprimi\w*|imprime|imprimir|print)\b/, 'print'],
  [/^(?:manda\w*|envia\w*|envia|send|email|mail)\b.*\b(?:mail|email|correo|e mail)\b|^(?:email|mail)\b/, 'email'],
  [/^(?:edita\w*|modifica\w*|corregi\w*|edit|modify)\b/, 'edit'],
  [/^(?:confirma\w*|aproba\w*|acepta\w*|approve|confirm|accept)\b/, 'confirm'],
  [/^(?:rechaza\w*|reject|decline)\b/, 'reject'],
  [/^(?:cobra\w*|cobrar|registra\w* (?:el |un )?(?:pago|cobro)|paga\w*|agrega\w* (?:un )?pago|collect|charge|take (?:a )?payment|add (?:a )?payment|pay)\b/, 'pay'],
  [/^(?:asigna\w*|imputa\w*|aplica\w*|allocate|apply)\b/, 'allocate'],
  [/^(?:abri\w*|abre|mostra\w*|muestra\w*|ver|selecciona\w*|elegi\w*|open|show(?: me)?|select)\b/, 'open'],
  [/^(?:exporta\w*|descarga\w*|baja\w* (?:a )?excel|export|download)\b/, 'export'],
  [/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload)\b/, 'refresh'],
  [/^(?:(?:nueva|nuevo|crea\w*|carga\w*|agrega\w*|hace\w* (?:una|un))\s+(?:factura|presupuesto|pago|cobro|cotizacion)|(?:new|create|add) (?:an? )?(?:invoice|quote|payment|estimate))\b/, 'create'],
];

export function parseDocuments(normalized: string): DocParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const kind = kindIn(t);
  const pendingOnly = /\b(?:pendientes?|impagas?|sin pagar|sin cobrar|que (?:deben|faltan)|adeudad\w*|unpaid|pending|outstanding|overdue)\b/.test(t);
  if (/^(?:cuant[oa]s?|cuanto (?:suman?|da|es|hay)|(?:cual es |decime )?el total|que (?:facturas|pagos|presupuestos) hay|how (?:many|much)|what is the total|whats the total|total)\b/.test(t) && (kind || /\b(?:suman?|total)\b/.test(t))) {
    return { op: 'read', kind, target: null, pendingOnly, filter: null };
  }
  const filter = t.match(/^(?:(?:mostra\w*|ver|filtra\w*|show(?: me)?|filter(?: by)?)\s+)?(?:solo|solamente|only)\s+(?:las |los |the )?(.+)$/);
  if (filter) return { op: 'filter', kind, target: null, pendingOnly: false, filter: filter[1] };
  const op = OPS.find(([re]) => re.test(t))?.[1];
  if (!op) return null;
  const target = parseTarget(t);
  // Hacer algo con «una» fila necesita decir cuál (o el tipo, para crear, exportar, actualizar).
  if (['open', 'print', 'email', 'edit', 'confirm', 'reject', 'pay', 'allocate'].includes(op) && !target) return null;
  if (['create', 'export', 'refresh'].includes(op) && !kind) return null;
  return { op, kind, target, pendingOnly, filter: null };
}

registerVoiceCommand<DocParsed>({
  id: 'documents.act',
  domain: DOCUMENTS_VOICE_DOMAIN,
  // Antes que la ficha del paciente («imprimí la factura 120» no es crear una factura).
  priority: 59,
  match: (normalized) => {
    if (!tables().length) return null;
    const parsed = parseDocuments(normalized);
    if (!parsed) return null;
    // En la ficha del paciente «nueva factura» lo abre la ficha (con el paciente puesto).
    if (parsed.op === 'create' && getVoiceBridge('patients')) return null;
    if (!tableFor(parsed.kind)) return null;
    return parsed;
  },
  run: async (parsed, ctx) => {
    const table = tableFor(parsed.kind);
    if (!table) return;
    const L = ctx.locale;
    const name = T(ctx, `kind_${table.kind}`);
    if (parsed.op === 'read') {
      const rows = parsed.pendingOnly ? table.rows.filter(isPending) : table.rows;
      if (!rows.length) { await say(ctx, T(ctx, parsed.pendingOnly ? 'noPending' : 'none', { kind: name }), 'info'); return; }
      const byCurrency = rows.reduce<Record<string, number>>((acc, r) => {
        const amount = parsed.pendingOnly && r.paid != null ? Math.max(0, r.total - r.paid) : r.total;
        acc[r.currency || ''] = (acc[r.currency || ''] ?? 0) + amount;
        return acc;
      }, {});
      const sum = Object.entries(byCurrency).map(([c, n]) => money(n, c, L)).join(', ');
      await say(ctx, T(ctx, parsed.pendingOnly ? 'readPending' : 'read', { count: rows.length, kind: name, sum }), 'info', rows.slice(0, 10).map((r) => ({ label: `${r.docNo} · ${r.party}`, value: money(r.total, r.currency, L) })));
      return;
    }
    if (parsed.op === 'filter') {
      const key = normalizeSpeech(parsed.filter!);
      const option = table.filters.find((f) => normalizeSpeech(f.label) === key) ?? table.filters.find((f) => normalizeSpeech(f.label).includes(key) || key.includes(normalizeSpeech(f.label)));
      if (!table.setFilter || !option) { await say(ctx, T(ctx, 'noFilter', { filter: parsed.filter! }), 'info'); return; }
      table.setFilter(option.value);
      await say(ctx, T(ctx, 'filtered', { filter: option.label }));
      return;
    }
    if (parsed.op === 'create' || parsed.op === 'export' || parsed.op === 'refresh') {
      const fn = parsed.op === 'create' ? table.create : parsed.op === 'export' ? table.exportList : table.refresh;
      if (!fn) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
      fn();
      await say(ctx, T(ctx, `did_${parsed.op}`, { kind: name }));
      return;
    }
    // Una fila: la nombrada; si hay varias iguales, pregunta.
    const hits = resolve(parsed.target, table);
    if (!hits.length) { await say(ctx, T(ctx, 'notFound', { kind: name }), 'info'); return; }
    let row = hits[0];
    if (hits.length > 1) {
      const question = T(ctx, 'which');
      const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: hits.slice(0, 8).map((r) => ({ label: `${r.docNo} · ${r.party}`, detail: money(r.total, r.currency, L) })) }, `${question} ${hits.slice(0, 5).map((r, i) => `${i + 1}: ${r.docNo}, ${r.party}`).join('. ')}.`);
      row = hits[index];
    }
    const key = parsed.op === 'open' ? 'select' : parsed.op;
    const fn = table.actions[key as keyof DocumentsVoiceBridge['actions']];
    if (!fn) { await say(ctx, T(ctx, `cant_${parsed.op}`, { kind: name }), 'info'); return; }
    fn(row.id);
    await say(ctx, T(ctx, `did_${parsed.op}`, { kind: name, doc: row.docNo, party: row.party }));
  },
});
