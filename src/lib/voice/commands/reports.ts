import { format } from 'date-fns';

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
