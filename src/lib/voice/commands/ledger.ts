import { format, parseISO } from 'date-fns';

import { parseScreen, runScreen, type ScreenParsed } from '@/lib/voice/commands/screen';
import { normalizeSpeech, parseChoice, parseSpokenDate } from '@/lib/voice/parse';
import { parsePeriod } from '@/lib/voice/period';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';

import type { LedgerVoiceBridge, LedgerVoiceRow, VoiceCommandContext } from '@/lib/types';

/**
 * El estado de cuenta del paciente por voz (PatientLedger: en la ficha y en el panel «Estado de
 * cuenta»). La moneda («en dólares», «en pesos»: la principal y la secundaria), el orden («más
 * recientes arriba», «ascendente»), el período («el mes pasado», «todo el tiempo»), las altas
 * («nuevo presupuesto», «nuevo tratamiento», «registrá un pago»; las líneas se completan con la
 * voz genérica), el saldo («¿cuánto debe?») y lo que se hace con una fila — por su número de
 * documento, su fecha, su posición o lo que dice — : facturar, editar, nota de crédito, imprimir,
 * enviar por email, eliminar y su estado (en curso, finalizado, volver). Lo que cambia algo se
 * confirma antes.
 */

export const LEDGER_VOICE_DOMAIN = 'ledger';
registerVoiceDomain({ id: LEDGER_VOICE_DOMAIN });

const ledger = () => getVoiceBridge<LedgerVoiceBridge>('ledger');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.ledger.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}

const CURRENCY_WORDS: Array<[RegExp, string[]]> = [
  [/\b(?:dolar(?:es)?|dollars?|usd|u\s?s\s?d|verdes?)\b/, ['USD']],
  [/\b(?:pesos?|uyu|peso uruguayo)\b/, ['UYU', 'ARS', 'CLP', 'MXN', 'COP']],
  [/\b(?:euros?|eur)\b/, ['EUR']],
  [/\b(?:reales?|brl)\b/, ['BRL']],
];

type Action = 'invoice' | 'edit' | 'creditNote' | 'print' | 'email' | 'remove' | 'enCurso' | 'finalizado' | 'toEnCurso' | 'toPresupuesto';
type Target = { by: 'doc'; no: string } | { by: 'date'; date: string } | { by: 'position'; text: string } | { by: 'words'; words: string[] } | { by: 'selected' };

type Parsed =
  | { op: 'currency'; codes: string[] | 'primary' | 'secondary' }
  | { op: 'sort'; order: 'newest-first' | 'newest-last' }
  | { op: 'period'; from: Date; to: Date }
  | { op: 'allTime' }
  | { op: 'create'; kind: 'quote' | 'treatment' | 'payment' }
  | { op: 'balance' }
  | { op: 'movements' }
  | { op: 'search'; text: string }
  | { op: 'refresh' }
  | { op: 'row'; action: Action | 'select'; target: Target }
  | { op: 'screen'; parsed: ScreenParsed };

const ACTIONS: Array<[RegExp, Action | 'select']> = [
  [/^(?:factura\w*|facturar|invoice)\b/, 'invoice'],
  [/^(?:(?:hace\w*|haz|crea\w*|genera\w*|emiti\w*)\s+(?:una\s+)?nota de credito(?:\s+(?:a|de|para|sobre))?|nota de credito(?:\s+(?:a|de|para|sobre))?|(?:create|issue)\s+(?:a\s+)?credit note(?:\s+(?:for|on))?)\b/, 'creditNote'],
  [/^(?:edita\w*|modifica\w*|cambia\w*|corregi\w*|edit|change|modify)\b/, 'edit'],
  [/^(?:imprimi\w*|imprime|imprimir|print)\b/, 'print'],
  [/^(?:manda\w*|envia\w*|send|email)(?:lo|la)?\b(?:.*\b(?:mail|email|correo)\b)?/, 'email'],
  [/^(?:elimina\w*|borra\w*|anula\w*|delete|remove)\b/, 'remove'],
  [/^(?:finaliza\w*|marca\w* como finalizad[oa]|pasa\w* a finalizad[oa]|ponelo en finalizado|cobra\w* (?:todo|completo)|mark (?:it )?(?:as )?(?:finished|done|completed)|finish)\b/, 'finalizado'],
  [/^(?:pasa\w* a en curso|ponelo en curso|marca\w* (?:como )?en curso|confirma\w*|acepta\w*|mark (?:it )?(?:as )?in progress|confirm)\b/, 'enCurso'],
  [/^(?:volve\w* a en curso|devolve\w* a en curso|saca\w* (?:el )?finalizado|revert to in progress)\b/, 'toEnCurso'],
  [/^(?:volve\w* a presupuesto|devolve\w* a presupuesto|pasa\w* a presupuesto|revert to (?:the )?quote)\b/, 'toPresupuesto'],
  [/^(?:selecciona\w*|elegi\w*|abri\w*|abre|mostra\w*|select|open|show)\b/, 'select'],
];

function parseTarget(text: string): Target | null {
  const t = text.replace(/^(?:(?:el|la|lo|los|las|the|this|that|ese|esa|este|esta)\s+)?/, '').trim();
  if (!t || /^(?:lo|la|eso|esto|it|this one|that one|seleccionad[oa])$/.test(t)) return { by: 'selected' };
  const doc = t.match(/^(?:(?:presupuesto|factura|pago|recibo|tratamiento|documento|nota de credito|quote|invoice|payment|receipt|document)\s+)?(?:numero\s+|number\s+|n\s+)?(\d[\d-]*)$/) ?? t.match(/\b(?:presupuesto|factura|pago|recibo|quote|invoice|payment)\s+(?:numero\s+|number\s+)?(\d[\d-]*)\b/);
  if (doc) return { by: 'doc', no: doc[1] };
  const pos = t.match(/^(?:(?:presupuesto|factura|pago|tratamiento|movimiento|fila|quote|invoice|payment|row)\s+)?(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last)$/) ?? t.match(/^(primer[oa]?|segund[oa]|tercer[oa]?|ultim[oa]|first|second|third|last)\s+(?:presupuesto|factura|pago|tratamiento|movimiento|quote|invoice|payment)?$/);
  if (pos) return { by: 'position', text: pos[1] };
  const dated = t.match(/^(?:(?:presupuesto|factura|pago|tratamiento|movimiento|quote|invoice|payment)\s+)?(?:del?|of|from)\s+(.+)$/);
  if (dated) {
    const iso = parseSpokenDate(` ${dated[1]} `, 'past');
    if (iso) return { by: 'date', date: iso };
  }
  const words = normalizeSpeech(t).split(' ').filter((w) => w.length > 2 && !['del', 'que', 'por', 'para', 'the', 'for'].includes(w));
  return words.length ? { by: 'words', words } : null;
}

export function parseLedger(normalized: string): Parsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload)(?: (?:el )?estado de cuenta| la cuenta| the statement)?$/.test(t)) return { op: 'refresh' };
  // Moneda.
  const cur = t.match(/^(?:(?:mostra\w*|muestra\w*|ensena\w*|ver|pasa\w*|cambia\w*(?: la moneda)?|pone\w*|show(?: me)?|switch(?: to)?|change(?: the currency)?(?: to)?|view)\s+)?(?:(?:el estado de cuenta|la cuenta|todo|it|the statement)\s+)?(?:(?:a|en|in|to)\s+)?(?:la\s+)?(?:moneda\s+)?(.+)$/);
  if (cur) {
    const body = cur[1];
    if (/^(?:(?:la )?(?:moneda )?(?:principal|primaria)|(?:the )?(?:primary|main) currency|primary|main)$/.test(body)) return { op: 'currency', codes: 'primary' };
    if (/^(?:(?:la )?(?:moneda )?secundaria|(?:the )?secondary currency|secondary)$/.test(body)) return { op: 'currency', codes: 'secondary' };
    const hit = CURRENCY_WORDS.find(([re]) => re.test(body));
    if (hit && body.split(' ').length <= 3 && (t !== body || /^(?:en|in)\s/.test(t) || body.split(' ').length <= 2)) return { op: 'currency', codes: hit[1] };
  }
  // Orden.
  if (/^(?:(?:ordena\w*|ordenar|pone\w*|mostra\w*|sort|show)\s+)?(?:(?:lo|la lista|los movimientos|it)\s+)?(?:(?:en )?(?:forma |orden )?descendente|de (?:mas )?nuevo a (?:mas )?viejo|(?:los )?mas recientes (?:arriba|primero)|(?:the )?newest (?:first|on top)|descending)$/.test(t)) return { op: 'sort', order: 'newest-first' };
  if (/^(?:(?:ordena\w*|ordenar|pone\w*|mostra\w*|sort|show)\s+)?(?:(?:lo|la lista|los movimientos|it)\s+)?(?:(?:en )?(?:forma |orden )?ascendente|de (?:mas )?viejo a (?:mas )?nuevo|(?:los )?mas recientes (?:abajo|al final)|(?:los )?mas viejos (?:arriba|primero)|(?:the )?oldest (?:first|on top)|newest last|ascending)$/.test(t)) return { op: 'sort', order: 'newest-last' };
  // Período.
  if (/^(?:(?:mostra\w*|ver|pone\w*|show(?: me)?)\s+)?(?:todo el tiempo|todo|desde siempre|sin fecha|all time|everything|the whole history)$/.test(t)) return { op: 'allTime' };
  const periodBody = t.replace(/^(?:(?:mostra\w*|muestra\w*|ver|filtra\w*|pone\w*|show(?: me)?|filter)\s+)?(?:(?:los movimientos|el estado de cuenta|lo)\s+)?/, '');
  if (periodBody !== t || /^(?:el mes|la semana|este|esta|del|desde|last|this)\b/.test(t)) {
    const period = parsePeriod(periodBody);
    if (period) return { op: 'period', from: period.from, to: period.to };
  }
  // Altas.
  if (/^(?:(?:nuevo|nueva|agrega\w*|anad\w*|crea\w*|hace\w*|haz|arma\w*|carga\w*|new|add|create|make)\s+)(?:un |una |a |an )?(?:nuevo |nueva |new )?(?:presupuesto|cotizacion|quote|estimate)$/.test(t) || /^(?:presupuesta\w*)$/.test(t)) return { op: 'create', kind: 'quote' };
  if (/^(?:(?:nuevo|nueva|agrega\w*|crea\w*|hace\w*|haz|carga\w*|registra\w*|new|add|create|record)\s+)(?:un |una |a |an )?(?:nuevo |nueva |new )?(?:tratamiento|factura|treatment|invoice)$/.test(t)) return { op: 'create', kind: 'treatment' };
  if (/^(?:(?:nuevo|nueva|agrega\w*|crea\w*|carga\w*|registra\w*|ingresa\w*|anota\w*|new|add|create|record|register)\s+)(?:un |una |a |an )?(?:nuevo |new )?(?:pago|cobro|payment)$|^(?:cobra\w*|cobrar|cobrale|charge(?: (?:him|her|them))?)$/.test(t)) return { op: 'create', kind: 'payment' };
  // Saldo y movimientos.
  if (/^(?:cuanto (?:debe|nos debe|adeuda|tiene de saldo|le falta pagar)|cual es (?:el|su) saldo|(?:el |su )?saldo|(?:la |su )?deuda|que debe|how much (?:does (?:he|she|it) owe|is owed)|what(?:'s| is) the balance|(?:the )?balance)$/.test(t)) return { op: 'balance' };
  if (/^(?:(?:lee\w*|leeme|decime|deci\w*|mostra\w*|ver|read(?: me)?|show(?: me)?)\s+)?(?:los |the )?(?:movimientos|ultimos movimientos|el estado de cuenta|movements|transactions|the statement)$/.test(t)) return { op: 'movements' };
  const search = t.match(/^(?:busca\w*|buscar|search(?: for)?|find)\s+(.+)$/);
  if (search) return { op: 'search', text: search[1] };
  // Una fila: la acción y a cuál.
  for (const [re, action] of ACTIONS) {
    const m = t.match(re);
    if (!m) continue;
    const rest = t.slice(m[0].length).replace(/^(?:lo|la)\b/, '').trim();
    const target = parseTarget(rest);
    if (!target) return null;
    if (action === 'select' && target.by === 'selected') return null;
    return { op: 'row', action, target };
  }
  return null;
}

function resolve(target: Target, rows: LedgerVoiceRow[], selectedId: string | null): LedgerVoiceRow[] {
  if (target.by === 'selected') return selectedId ? rows.filter((r) => r.id === selectedId) : [];
  if (target.by === 'doc') return rows.filter((r) => (r.docNo ?? '').replace(/\D/g, '').endsWith(target.no.replace(/\D/g, '')) || (r.quoteDocNo ?? '').replace(/\D/g, '').endsWith(target.no.replace(/\D/g, '')));
  if (target.by === 'date') return rows.filter((r) => r.date.slice(0, 10) === target.date);
  if (target.by === 'position') {
    const i = parseChoice(target.text, rows.length);
    return i === null ? [] : [rows[i]];
  }
  return rows.filter((r) => { const l = normalizeSpeech(`${r.label} ${r.docNo ?? ''}`); return target.words.every((w) => l.includes(w)); });
}

const money = (n: number, currency: string | null) => `${currency ?? ''} ${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
const rowName = (r: LedgerVoiceRow) => `${r.label}${r.docNo ? ` (${r.docNo})` : ''} · ${format(parseISO(r.date.slice(0, 10)), 'dd/MM/yyyy')}`;
let lastSelected: string | null = null;

registerVoiceCommand<Parsed>({
  id: 'ledger.act',
  domain: LEDGER_VOICE_DOMAIN,
  // Por encima de lo de la ficha del paciente: con el estado de cuenta a la vista, es de él.
  priority: 59,
  match: (normalized, raw) => {
    const l = ledger();
    if (!l) return null;
    // Con un editor abierto (presupuesto, tratamiento, pago), lo que nombra uno de sus campos es
    // para él («tratamiento limpieza», «la cantidad es 2»), antes que cualquier otro comando.
    if (l.editing) {
      const root = l.root();
      const screen = (() => { try { return parseScreen(normalized, raw); } catch { return null; } })();
      const inLedger = (el: HTMLElement | undefined) => !!el && !!root && root.contains(el);
      if (screen && ['fill', 'select', 'toggle', 'press', 'date'].includes(screen.op) && (screen.op === 'date' || inLedger((screen as { control?: { element: HTMLElement } }).control?.element))) return { op: 'screen', parsed: screen };
    }
    return parseLedger(normalized);
  },
  run: async (parsed, ctx) => {
    const l = ledger();
    if (!l) return;
    if (parsed.op === 'screen') { await runScreen(parsed.parsed, ctx); return; }
    switch (parsed.op) {
      case 'refresh': l.refresh(); await say(ctx, T(ctx, 'refreshed')); return;
      case 'currency': {
        const primary = l.currencies[0];
        const target = parsed.codes === 'primary' ? primary : parsed.codes === 'secondary' ? l.currencies[1] : l.currencies.find((c) => (parsed.codes as string[]).includes(c));
        if (!target) { await say(ctx, l.currencies.length > 1 ? T(ctx, 'noCurrency', { list: l.currencies.join(', ') }) : T(ctx, 'onlyCurrency', { currency: primary ?? '' }), 'info'); return; }
        l.setCurrency(target);
        await say(ctx, T(ctx, 'currencySet', { currency: target }));
        return;
      }
      case 'sort': l.setSortOrder(parsed.order); await say(ctx, T(ctx, parsed.order === 'newest-first' ? 'newestFirst' : 'newestLast')); return;
      case 'allTime':
        if (!l.clearDateRange) { await say(ctx, T(ctx, 'noPeriod'), 'info'); return; }
        l.clearDateRange(); await say(ctx, T(ctx, 'allTime')); return;
      case 'period':
        if (!l.setDateRange) { await say(ctx, T(ctx, 'noPeriod'), 'info'); return; }
        l.setDateRange(parsed.from, parsed.to);
        await say(ctx, T(ctx, 'periodSet', { from: format(parsed.from, 'dd/MM/yyyy'), to: format(parsed.to, 'dd/MM/yyyy') }));
        return;
      case 'create': {
        const fn = l.create[parsed.kind];
        if (!fn) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
        fn();
        await say(ctx, T(ctx, `created_${parsed.kind}`));
        return;
      }
      case 'balance': {
        const b = l.totals.balance;
        const message = b > 0.005 ? T(ctx, 'owes', { amount: money(b, l.currency) }) : b < -0.005 ? T(ctx, 'inFavor', { amount: money(-b, l.currency) }) : T(ctx, 'settled');
        await say(ctx, message, 'info');
        return;
      }
      case 'movements': {
        const last = l.sortOrder === 'newest-first' ? l.rows.slice(0, 6) : l.rows.slice(-6).reverse();
        if (!last.length) { await say(ctx, T(ctx, 'empty'), 'info'); return; }
        await say(ctx, T(ctx, 'movements', { count: l.rows.length, balance: money(l.totals.balance, l.currency) }), 'info', last.map((r) => ({ label: rowName(r), value: money(r.debe || -r.haber, l.currency) })));
        return;
      }
      case 'search':
        if (!l.search) { await say(ctx, T(ctx, 'noSearch'), 'info'); return; }
        l.search(parsed.text); await say(ctx, T(ctx, 'searched', { text: parsed.text })); return;
      case 'row': {
        let hits = resolve(parsed.target, l.rows, lastSelected);
        if (!hits.length) { await say(ctx, T(ctx, 'rowNotFound'), 'info'); return; }
        if (hits.length > 1) {
          const question = T(ctx, 'which');
          const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: hits.slice(0, 8).map((r) => ({ label: rowName(r) })) }, `${question} ${hits.slice(0, 5).map((r, i) => `${i + 1}: ${rowName(r)}`).join('. ')}.`);
          hits = [hits[index]];
        }
        const row = hits[0];
        lastSelected = row.id;
        if (parsed.action === 'select') { l.select(row.id); await say(ctx, T(ctx, 'selected', { row: rowName(row) })); return; }
        if (!row.can[parsed.action]) { await say(ctx, T(ctx, 'cant', { action: T(ctx, `action_${parsed.action}`), row: rowName(row) }), 'info'); return; }
        // Lo que cambia algo (no imprimir ni abrir la edición) se confirma.
        if (!['print', 'edit', 'email'].includes(parsed.action)) {
          const question = T(ctx, 'confirm', { action: T(ctx, `action_${parsed.action}`), row: rowName(row) });
          if (!(await ctx.confirm({ title: T(ctx, 'title'), message: question, tone: parsed.action === 'remove' ? 'danger' : 'confirm' }, question))) { await say(ctx, T(ctx, 'cancelled'), 'info'); return; }
        }
        l.act(row.id, parsed.action);
        await say(ctx, T(ctx, `did_${parsed.action}`, { row: rowName(row) }));
      }
    }
  },
});
