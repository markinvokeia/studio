import { format } from 'date-fns';

import { voiceEscape } from '@/lib/voice/dom-dialog';
import { openOptions, waitForOptions, type UiControl } from '@/lib/voice/dom-ui';
import { normalizeSpeech } from '@/lib/voice/parse';
import { parsePeriod } from '@/lib/voice/period';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge, listVoiceBridges } from '@/lib/voice/screen-bridge';

import type { ReportKpiVoiceBridge, ReportPeriodVoiceBridge, ReportShellVoiceBridge, ReportTableVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * Los reportes por voz, con las piezas comunes (ReportShell, ReportKPICard, DateRangePresets,
 * ReportDataTable), así sirven los 23 reportes: «generá el reporte», «el mes pasado» (pone el
 * período y lo genera), «del 1 al 15 de marzo», «desde siempre», «¿cuánto da?» (lee las
 * tarjetas), «¿cuántas filas hay?», «exportá a Excel / PDF / CSV», «imprimilo». Los filtros propios
 * de cada reporte (moneda, doctor, sede) se eligen con la voz genérica.
 */

export const REPORTS_VOICE_DOMAIN = 'reports';
registerVoiceDomain({ id: REPORTS_VOICE_DOMAIN, notUnderstoodKey: 'VoiceCommands.reports.notUnderstood' });

const shell = () => getVoiceBridge<ReportShellVoiceBridge>('reports.shell');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.reports.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: shell()?.title || T(ctx, 'title'), message, tone, rows }, message);
}

type Parsed =
  | { op: 'generate' }
  | { op: 'period'; from: Date; to: Date }
  | { op: 'allTime' }
  | { op: 'read' }
  | { op: 'rows' }
  | { op: 'export'; format: 'pdf' | 'excel' | 'csv' }
  | { op: 'print' };

export function parseReports(normalized: string): Parsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:genera\w*|generar|corre\w*|ejecuta\w*|consulta\w*|calcula\w*|actualiza\w*|ver|mostra\w*|dale|generate|run|refresh|show)(?: (?:el|un|the|a) )?(?:reporte|informe|report)?(?: de nuevo| otra vez| again)?$/.test(t) && /\b(?:reporte|informe|report|genera\w*|generar|generate|run|corre\w*|ejecuta\w*|consulta\w*|calcula\w*)\b/.test(t)) return { op: 'generate' };
  const exp = t.match(/^(?:exporta\w*|descarga\w*|baja\w*|bajalo|guarda\w*|export|download|save)(?:lo|la)?\s+(?:(?:el |the )?(?:reporte|informe|report)\s+)?(?:(?:a|en|como|to|as|in)\s+)?(?:un |una |an? )?(pdf|excel|xls|xlsx|csv|planilla|spreadsheet)$/);
  if (exp) return { op: 'export', format: /pdf/.test(exp[1]) ? 'pdf' : /csv/.test(exp[1]) ? 'csv' : 'excel' };
  if (/^(?:imprimi\w*|imprime|imprimir|print)(?:lo|la)?(?: (?:el |the )?(?:reporte|informe|report))?$/.test(t)) return { op: 'print' };
  if (/^(?:cuanto (?:da|dio|es|suma|sale)|(?:cual es )?el (?:total|resultado)|(?:lee\w*|decime|deci\w*|leeme) (?:los )?(?:resultados|totales|numeros|indicadores)|(?:dame )?(?:un |el )?resumen|que (?:dice|da) el reporte|what (?:does it|is the) (?:say|total|result)|read (?:me )?(?:the )?(?:results|totals|numbers)|(?:give me )?(?:a |the )?summary)$/.test(t)) return { op: 'read' };
  if (/^(?:cuant[oa]s (?:filas|registros|renglones|resultados|lineas) (?:hay|son|tiene|salieron)|how many (?:rows|records|results)(?: are there)?)$/.test(t)) return { op: 'rows' };
  if (/^(?:(?:mostra\w*|ver|pone\w*|filtra\w*|show(?: me)?|set)\s+)?(?:desde siempre|todo el periodo|sin fecha|todo|all time|everything|no date filter)$/.test(t)) return { op: 'allTime' };
  const body = t.replace(/^(?:(?:mostra\w*|muestra\w*|ver|genera\w*|pone\w*|filtra\w*|cambia\w* (?:a|el periodo a)|el periodo (?:es|a)|del periodo|show(?: me)?|set (?:the )?period to|run(?: it)? for|for)\s+)/, '');
  const period = parsePeriod(body);
  // El período dicho solo («el mes pasado», «marzo») o con verbo («generá el de marzo»).
  if (period && (t !== body || /^(?:el |la |los |las |the |this |last |en |in |este |esta |del |from |hoy|ayer|today|yesterday|(?:ultim|past))/.test(body) || /^(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(body))) {
    return { op: 'period', from: period.from, to: period.to };
  }
  return null;
}

registerVoiceCommand<Parsed>({
  id: 'reports.act',
  domain: REPORTS_VOICE_DOMAIN,
  priority: 45,
  match: (normalized) => (shell() ? parseReports(normalized) : null),
  run: async (parsed, ctx) => {
    const s = shell();
    if (!s) return;
    if (parsed.op === 'generate') { s.generate(); await say(ctx, T(ctx, 'generating')); return; }
    if (parsed.op === 'print') { if (!s.print || !s.hasData) { await say(ctx, T(ctx, 'generateFirst'), 'info'); return; } s.print(); await say(ctx, T(ctx, 'printing')); return; }
    if (parsed.op === 'export') {
      const fn = parsed.format === 'pdf' ? s.exportPDF : parsed.format === 'csv' ? s.exportCSV : s.exportExcel;
      if (!s.hasData) { await say(ctx, T(ctx, 'generateFirst'), 'info'); return; }
      if (!fn) { await say(ctx, T(ctx, 'noExport', { format: parsed.format.toUpperCase() }), 'info'); return; }
      fn();
      await say(ctx, T(ctx, 'exporting', { format: parsed.format === 'excel' ? 'Excel' : parsed.format.toUpperCase() }));
      return;
    }
    if (parsed.op === 'read') {
      const kpis = listVoiceBridges<ReportKpiVoiceBridge | null>('reports.kpi').filter((k): k is ReportKpiVoiceBridge => !!k && typeof k.title === 'string');
      if (!s.hasData || !kpis.length) { await say(ctx, s.hasData ? T(ctx, 'noKpis') : T(ctx, 'generateFirst'), 'info'); return; }
      const text = kpis.map((k) => `${k.title}: ${k.value}`).join('. ');
      await say(ctx, `${text}.`, 'info', kpis.map((k) => ({ label: k.title, value: k.value })));
      return;
    }
    if (parsed.op === 'rows') {
      const table = getVoiceBridge<ReportTableVoiceBridge>('reports.table');
      if (!s.hasData || !table) { await say(ctx, T(ctx, 'generateFirst'), 'info'); return; }
      await say(ctx, T(ctx, 'rows', { count: table.rowCount }), 'info');
      return;
    }
    const period = getVoiceBridge<ReportPeriodVoiceBridge>('reports.period');
    // Sin período (Deudores, por ejemplo): se dice y se genera igual (es lo que se quiere ver).
    if (!period) { s.generate(); await say(ctx, T(ctx, 'noPeriodGenerating'), 'info'); return; }
    if (parsed.op === 'allTime') {
      if (!period.allTime) { await say(ctx, T(ctx, 'noAllTime'), 'info'); return; }
      period.allTime();
    } else {
      period.setRange(parsed.from, parsed.to);
    }
    // Con el período puesto se genera (es lo que se quiere ver).
    await new Promise((r) => setTimeout(r, 60));
    shell()?.generate();
    await say(ctx, parsed.op === 'allTime' ? T(ctx, 'allTimeSet') : T(ctx, 'periodSet', { from: format(parsed.from, 'dd/MM/yyyy'), to: format(parsed.to, 'dd/MM/yyyy') }));
  },
});

// ── Los filtros de la barra (caja, método de pago, moneda, sede, doctor…) ───────

const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const FILLER = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'por', 'en', 'a', 'al', 'con', 'para', 'que', 'sea', 'the', 'of', 'in', 'by', 'for', 'to', 'with', 'only', 'solo', 'solamente']);
const SYNONYMS: Array<[RegExp, string]> = [[/\bdolar(?:es)?\b|\bdollars?\b|\bus\$/, 'usd'], [/\bpesos?\b/, 'uyu'], [/\beuros?\b/, 'eur'], [/\breales?\b/, 'brl']];
const FILTER_VERB = /^(?:filtra\w*(?:\s+(?:por|by))?|mostra\w*|muestra\w*|ensena\w*|ver|pone\w*|pon|cambia\w*(?:\s+(?:a|al|to))?|elegi\w*|elige|escoge\w*|selecciona\w*|solo|solamente|unicamente|show(?: me)?|only|filter(?:\s+by)?|set|choose|select|pick)\s+/;

function filterTriggers(): HTMLElement[] {
  const root = shell()?.filtersRoot?.();
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="combobox"]')).filter((el) => !(el as HTMLButtonElement).disabled);
}
const triggerLabel = (el: HTMLElement) => normalizeSpeech(`${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('placeholder') ?? ''} ${el.textContent ?? ''}`);
const words = (text: string) => normalizeSpeech(text).split(' ').filter((w) => w && !FILLER.has(w));
const singular = (w: string) => w.replace(/(?:es|s)$/, '');

/** Cuánto se parece una opción a lo dicho (0: nada). */
function optionScore(said: string, option: string): number {
  let x = normalizeSpeech(said);
  for (const [re, code] of SYNONYMS) if (re.test(x)) x = `${x} ${code}`;
  const o = normalizeSpeech(option);
  if (!o) return 0;
  if (o === x.trim()) return 4;
  const xs = words(x).map(singular);
  const os = words(o).map(singular);
  if (!xs.length || !os.length) return 0;
  if (os.every((w) => xs.includes(w))) return 3 + os.length / 10;
  const hit = xs.filter((w) => os.includes(w)).length;
  if (hit && hit === xs.filter((w) => !/^\d+$/.test(w) || os.includes(w)).length) return 2 + hit / 10;
  return 0;
}

/**
 * Cierra la lista abierta como Escape, pero sin que el Escape suba a la ventana (ahí Escape corta
 * la voz): Radix lo escucha en la fase de captura del documento, así que alcanza con mandarlo a la lista.
 */
function closeOpenList() {
  if (typeof document === 'undefined') return;
  const list = document.querySelector<HTMLElement>('[role="listbox"]');
  voiceEscape(list ?? document.activeElement);
}

type FilterParsed = { op: 'clear' } | { op: 'list'; name: string } | { op: 'set'; text: string };

export function parseReportFilter(normalized: string): FilterParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:(?:saca\w*|quita\w*|borra\w*|limpia\w*|resetea\w*|clear|remove|reset)\s+(?:todos\s+)?(?:los\s+|the\s+|all\s+)?filtros?|sin filtros|(?:clear|reset|remove)\s+(?:the\s+|all\s+)?(?:the\s+)?filters?)$/.test(t)) return { op: 'clear' };
  const list = t.match(/^(?:que|cuales)\s+(.+?)\s+(?:hay|tengo|tiene|puedo elegir|se pueden elegir)$|^(?:which|what)\s+(.+?)\s+(?:are there|can i (?:choose|pick))$/);
  if (list) return { op: 'list', name: (list[1] ?? list[2]).trim() };
  let text = t;
  for (let i = 0; i < 3; i++) text = text.replace(FILTER_VERB, '');
  text = text.trim();
  if (!text) return null;
  return { op: 'set', text: text !== t ? text : `=${text}` };
}

registerVoiceCommand<FilterParsed>({
  id: 'reports.filter',
  domain: REPORTS_VOICE_DOMAIN,
  // Por debajo de lo del reporte (período, generar, exportar): lo que queda puede ser un filtro.
  priority: 44,
  match: (normalized) => {
    if (!shell()) return null;
    const triggers = filterTriggers();
    if (!triggers.length) return null;
    const parsed = parseReportFilter(normalized);
    if (!parsed) return null;
    if (parsed.op !== 'set') return parsed;
    // Sin verbo, solo si nombra un filtro o lo que tiene puesto («caja principal», «en dólares»).
    if (parsed.text.startsWith('=')) {
      const said = words(parsed.text.slice(1)).map(singular);
      const named = triggers.some((el) => words(triggerLabel(el)).map(singular).some((w) => w.length > 2 && said.includes(w)));
      const money = SYNONYMS.some(([re]) => re.test(parsed.text));
      return named || money ? { op: 'set', text: parsed.text.slice(1) } : null;
    }
    return parsed;
  },
  run: async (parsed, ctx) => {
    const s = shell();
    const triggers = filterTriggers();
    if (!s || !triggers.length) { await say(ctx, T(ctx, 'noFilters'), 'info'); return; }
    // Los que nombra lo dicho primero («caja», «método de pago», «moneda»).
    const said = parsed.op === 'set' ? parsed.text : parsed.op === 'list' ? parsed.name : '';
    const saidWords = words(said).map(singular);
    const ordered = [...triggers].sort((a, b) => {
      const hits = (el: HTMLElement) => words(triggerLabel(el)).map(singular).filter((w) => saidWords.includes(w)).length;
      return hits(b) - hits(a);
    });
    // Abre el selector y lee sus opciones (un momento más: la lista se dibuja de a poco).
    const open = async (el: HTMLElement): Promise<UiControl[]> => {
      el.click();
      const first = await waitForOptions(ctx.signal, 1200);
      if (!first.length) return first;
      await settle(150);
      return openOptions();
    };

    if (parsed.op === 'clear') {
      for (const el of triggers) {
        const options = await open(el);
        // La primera opción es la de «todos» («Todas las cajas», «Todos los métodos», «Todas»).
        const all = options.find((o) => /^(?:tod[oa]s?|all|ingresos y egresos)\b/i.test(normalizeSpeech(o.label))) ?? options[0];
        if (all) all.element.click(); else closeOpenList();
        await settle(60);
      }
      s.generate();
      await say(ctx, T(ctx, 'filtersCleared'));
      return;
    }

    if (parsed.op === 'list') {
      const el = ordered[0];
      const options = await open(el);
      closeOpenList();
      const name = (el.getAttribute('aria-label') || '').trim() || parsed.name.charAt(0).toUpperCase() + parsed.name.slice(1);
      if (!options.length) { await say(ctx, T(ctx, 'noFilters'), 'info'); return; }
      await say(ctx, T(ctx, 'filterOptions', { name, options: options.map((o) => o.label).join(', ') }), 'info');
      return;
    }

    // Se prueban los selectores hasta encontrar la opción nombrada (sin el nombre del filtro: «la caja Principal» → «principal»).
    let best: { el: HTMLElement; label: string; score: number } | null = null;
    for (const el of ordered) {
      const labelWords = new Set(words(triggerLabel(el)).map(singular));
      const target = words(parsed.text).filter((w) => !labelWords.has(singular(w)) || words(parsed.text).length === 1).join(' ') || parsed.text;
      const options = await open(el);
      let pick: { label: string; score: number } | null = null;
      for (const o of options) {
        const score = Math.max(optionScore(target, o.label), optionScore(parsed.text, o.label));
        if (score > (pick?.score ?? 0)) pick = { label: o.label, score };
      }
      if (pick && pick.score >= 4) {
        options.find((o) => o.label === pick!.label)?.element.click();
        best = { el, ...pick };
        break;
      }
      closeOpenList();
      await settle(40);
      if (pick && pick.score > (best?.score ?? 0)) best = { el, ...pick };
    }
    if (!best || best.score < 2) { await say(ctx, T(ctx, 'filterNotFound', { text: parsed.text }), 'info'); return; }
    if (best.score < 4) {
      const options = await open(best.el);
      const option = options.find((o) => o.label === best!.label);
      if (!option) { closeOpenList(); await say(ctx, T(ctx, 'filterNotFound', { text: parsed.text }), 'info'); return; }
      option.element.click();
    }
    await settle(100);
    shell()?.generate();
    await say(ctx, T(ctx, 'filterSet', { label: best.label }));
  },
});
