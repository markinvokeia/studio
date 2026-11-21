import { format } from 'date-fns';

import { normalizeSpeech } from '@/lib/voice/parse';
import { parsePeriod, type SpokenPeriod } from '@/lib/voice/period';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge, waitVoiceBridge } from '@/lib/voice/screen-bridge';

import type { DashboardVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * El panel de control por voz (src/app/[locale]/page.tsx): leer los números («¿cuánto producimos
 * hoy?», «¿cuánto cobramos este mes?», «¿cuántos pacientes atendimos?», «resumen del día», «¿qué
 * sede produjo más?», «¿qué servicio se vendió más?», «¿cómo venimos contra el mes pasado?») y
 * cambiar sus filtros (período, sede, moneda) o actualizarlo. Todo local, con lo que ya cargó.
 */

export const DASHBOARD_VOICE_DOMAIN = 'dashboard';
registerVoiceDomain({ id: DASHBOARD_VOICE_DOMAIN, notUnderstoodKey: 'VoiceCommands.dashboard.notUnderstood' });

const board = () => getVoiceBridge<DashboardVoiceBridge>('dashboard');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.dashboard.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'info', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}
const money = (amount: number | null | undefined, currency: string, locale: string) => {
  if (amount == null) return '—';
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); } catch { return `${currency} ${amount}`; }
};
const pct = (value: number | null | undefined) => (value == null ? null : `${value > 0 ? '+' : ''}${Math.round(value)}%`);

/** Espera a que el panel termine de cargar (después de cambiar un filtro). */
async function ready(ctx: VoiceCommandContext): Promise<DashboardVoiceBridge | null> {
  const start = Date.now();
  let b = await waitVoiceBridge<DashboardVoiceBridge>('dashboard', ctx.signal);
  while (b?.loading && Date.now() - start < 8000 && !ctx.signal.aborted) {
    await new Promise((r) => setTimeout(r, 80));
    b = board();
  }
  return b;
}

// ── Leer los números ──────────────────────────────────────────────────────────

type Metric = 'produccion' | 'cobranza' | 'gastos' | 'resultado' | 'atenciones' | 'pacientes' | 'agendados' | 'nuevos';
type Window = 'hoy' | 'mes' | 'ambos';
type QueryParsed =
  | { op: 'metric'; metric: Metric; window: Window }
  | { op: 'summary' }
  | { op: 'branches' }
  | { op: 'services' }
  | { op: 'compare' };

const METRICS: Array<[RegExp, Metric]> = [
  [/\b(?:pacientes nuevos|nuevos pacientes|new patients|altas)\b/, 'nuevos'],
  [/\b(?:agendad[oa]s|turnos (?:de|para) hoy|citas (?:de|para) hoy|scheduled|booked)\b/, 'agendados'],
  [/\b(?:atenciones|consultas|citas atendidas|visitas|visits|appointments seen|appointments attended)\b/, 'atenciones'],
  [/\b(?:pacientes|personas|patients|people)\b.*\b(?:atend\w*|vimos|vinieron|seen|see|came|come)\b|\b(?:atendimos|vimos|cuantos vinieron|how many came|patients seen)\b/, 'pacientes'],
  [/\b(?:cobranza|cobramos|cobrado|cobros|cobro|ingresos|ingreso|recaudamos|recaudado|collections|collected|collect|income|revenue collected)\b/, 'cobranza'],
  [/\b(?:gastos|gastamos|gasto|egresos|expenses|spent|spend|spending)\b/, 'gastos'],
  [/\b(?:resultado|ganancia|ganamos|utilidad|beneficio|rentabilidad|profit|result|net)\b/, 'resultado'],
  [/\b(?:produccion|producimos|producido|facturamos|facturado|facturacion|vendimos|ventas|production|produced|produce|sales|sold|billed|bill|revenue|make|made)\b/, 'produccion'],
];
const QUESTION = /^(?:cuant[oa]s?|que|cual|como|decime|dame|deci\w*|leeme|lee\w*|mostra\w*|how much|how many|what|whats|tell me|give me|show me|read)\b|\b(?:hoy|este mes|del mes|del dia|today|this month)$/;

export function parseDashboardQuery(normalized: string): QueryParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:(?:dame |hace\w* |haceme |deci\w* )?(?:un |el )?resumen(?: del dia| de hoy| del mes| general)?|como (?:va|viene|vamos|venimos|anda|esta)(?: el dia| hoy| la clinica| todo)?|como estamos(?: hoy)?|que tal (?:el dia|hoy)|(?:give me )?(?:a |the )?(?:summary|rundown|overview)(?: of (?:the day|today))?|how (?:are we doing|is (?:the day|today|it going)))$/.test(t)) return { op: 'summary' };
  if (/\b(?:sede|sedes|sucursal|sucursales|branch|branches|location|locations)\b/.test(t) && /\b(?:mas|mejor|menos|peor|ranking|por sede|por sucursal|cada sede|cada sucursal|most|best|worst|least|by branch|by location|each)\b/.test(t)) return { op: 'branches' };
  if (/\b(?:servicio|servicios|tratamiento|tratamientos|prestacion|prestaciones|service|services|treatments?)\b/.test(t) && /\b(?:mas|mejor|top|ranking|vendid\w*|most|best|top|selling|sold)\b/.test(t)) return { op: 'services' };
  if (/\b(?:comparad\w*|contra|versus|vs|respecto|frente)\b.*\b(?:mes pasado|mes anterior)\b|\b(?:compared to|vs|versus|against)\b.*\blast month\b|^como venimos(?: de un mes a otro| mes a mes)?$/.test(t)) return { op: 'compare' };
  const metric = METRICS.find(([re]) => re.test(t))?.[1];
  if (!metric || !QUESTION.test(t)) return null;
  const today = /\b(?:hoy|today|del dia|en el dia)\b/.test(t);
  const month = /\b(?:mes|month|mensual)\b/.test(t);
  return { op: 'metric', metric, window: metric === 'agendados' ? 'hoy' : metric === 'nuevos' ? 'mes' : today && !month ? 'hoy' : month && !today ? 'mes' : 'ambos' };
}

function metricValues(b: DashboardVoiceBridge, metric: Metric): { hoy: number | null; mes: number | null; varDia?: number | null; varMes?: number | null; money: boolean } | null {
  const s = b.summary;
  if (!s) return null;
  const att = s.atenciones ?? s.pacientes_atendidos;
  switch (metric) {
    case 'produccion': return { hoy: s.produccion.hoy, mes: s.produccion.mes, varDia: s.produccion.var_dia_pct, varMes: s.produccion.var_mes_pct, money: true };
    case 'cobranza': return { hoy: s.cobranza.hoy, mes: s.cobranza.mes, varDia: s.cobranza.var_dia_pct, varMes: s.cobranza.var_mes_pct, money: true };
    case 'gastos': return { hoy: s.gastos.hoy, mes: s.gastos.mes, varMes: s.gastos.var_mes_pct, money: true };
    case 'resultado': return { hoy: s.resultado.hoy, mes: s.resultado.mes, varMes: s.resultado.var_mes_pct, money: true };
    case 'atenciones': return { hoy: att.hoy, mes: att.mes, varMes: att.var_mes_pct, money: false };
    case 'pacientes': return { hoy: s.pacientes_atendidos.hoy, mes: s.pacientes_atendidos.mes, varMes: s.pacientes_atendidos.var_mes_pct, money: false };
    case 'agendados': return { hoy: att.agendados_hoy, mes: null, money: false };
    case 'nuevos': return { hoy: null, mes: s.pacientes_nuevos.mes, varMes: s.pacientes_nuevos.var_pct, money: false };
  }
}

registerVoiceCommand<QueryParsed>({
  id: 'dashboard.query',
  domain: DASHBOARD_VOICE_DOMAIN,
  priority: 45,
  match: (normalized) => (board() ? parseDashboardQuery(normalized) : null),
  run: async (parsed, ctx) => {
    const b = await ready(ctx);
    if (!b) return;
    const cur = (n: number | null | undefined) => money(n, b.currency, ctx.locale);
    if (parsed.op === 'branches') {
      if (!b.branches.length) { await say(ctx, T(ctx, 'noData')); return; }
      const rows = [...b.branches].sort((a, c) => c.produccion - a.produccion);
      await say(ctx, T(ctx, 'branchesTop', { name: rows[0].name, amount: cur(rows[0].produccion), pct: Math.round(rows[0].pct) }), 'info', rows.map((r) => ({ label: r.name, value: cur(r.produccion) })));
      return;
    }
    if (parsed.op === 'services') {
      if (!b.services.length) { await say(ctx, T(ctx, 'noData')); return; }
      const rows = [...b.services].sort((a, c) => c.sales - a.sales);
      await say(ctx, T(ctx, 'servicesTop', { name: rows[0].name, amount: cur(rows[0].sales), pct: Math.round(rows[0].percentage) }), 'info', rows.slice(0, 5).map((r) => ({ label: r.name, value: cur(r.sales) })));
      return;
    }
    if (!b.summary) { await say(ctx, T(ctx, 'noData')); return; }
    const s = b.summary;
    if (parsed.op === 'summary') {
      const att = s.atenciones ?? s.pacientes_atendidos;
      await say(ctx, T(ctx, 'summary', {
        production: cur(s.produccion.hoy), collected: cur(s.cobranza.hoy), seen: att.hoy, scheduled: att.agendados_hoy,
        monthProduction: cur(s.produccion.mes), monthCollected: cur(s.cobranza.mes),
      }));
      return;
    }
    if (parsed.op === 'compare') {
      const change = pct(s.produccion.var_mes_pct);
      await say(ctx, change ? T(ctx, 'compare', { change, now: cur(s.produccion.mes), before: cur(s.produccion.mes_anterior) }) : T(ctx, 'compareNone'));
      return;
    }
    const v = metricValues(b, parsed.metric);
    if (!v) { await say(ctx, T(ctx, 'noData')); return; }
    const fmt = (n: number | null | undefined) => (v.money ? cur(n) : String(n ?? '—'));
    const name = T(ctx, `metric_${parsed.metric}`);
    if (parsed.metric === 'gastos' && s.gastos.sin_datos) { await say(ctx, T(ctx, 'noExpenses')); return; }
    const parts: string[] = [];
    if (parsed.window !== 'mes' && v.hoy !== null) parts.push(T(ctx, 'today', { value: fmt(v.hoy) }));
    if (parsed.window !== 'hoy' && v.mes !== null) parts.push(T(ctx, 'month', { value: fmt(v.mes) }) + (pct(v.varMes) ? ` (${pct(v.varMes)})` : ''));
    if (!parts.length) parts.push(T(ctx, parsed.window === 'hoy' ? 'today' : 'month', { value: fmt(parsed.window === 'hoy' ? v.hoy : v.mes) }));
    await say(ctx, `${name}: ${parts.join(', ')}.`);
  },
});

// ── Filtros: período, sede, moneda, actualizar ────────────────────────────────

type FilterParsed =
  | { op: 'period'; period: SpokenPeriod }
  | { op: 'sede'; name: string | null }
  | { op: 'currency'; code: string }
  | { op: 'reload' };

const FILTER_VERB = /^(?:(?:mostra\w*|muestra\w*|filtra\w*|ver|ve|pone\w*|cambia\w*|pasa\w*|anda\w* a|quiero ver|show(?: me)?|filter(?: by)?|set|change(?: to)?|switch to|go to|view)\s+)?/;

export function parseDashboardFilter(normalized: string, currencies: string[]): FilterParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|volve\w* a cargar|reintenta\w*|refresh|reload|update|retry)(?: el panel| los datos| todo| the (?:dashboard|data))?$/.test(t)) return { op: 'reload' };
  const body = t.replace(FILTER_VERB, '');
  if (/^(?:(?:todas las|todas)\s+(?:sedes|sucursales)|consolidado|el consolidado|sin (?:filtro de )?sede|all (?:branches|locations|sites)|consolidated|every branch)$/.test(body)) return { op: 'sede', name: null };
  const sede = body.match(/^(?:solo |solamente |only )?(?:(?:la|el|the)\s+)?(?:sede|sucursal|branch|location)\s+(.+)$|^(?:por|by)\s+(?:la\s+)?(?:sede|sucursal|branch|location)\s+(.+)$/);
  // «cambiá a la sede X», «switch to …» es la sede de trabajo (panel derecho), no el filtro del panel.
  const workingSede = /^(?:cambia\w*|pasa\w*|switch|change|move|trabaja\w*)\b/.test(t);
  if (sede && !workingSede && t !== body) return { op: 'sede', name: (sede[1] ?? sede[2]).trim() };
  if (sede && /^(?:solo|solamente|only)\b/.test(body)) return { op: 'sede', name: (sede[1] ?? sede[2]).trim() };
  const cur = body.match(/^(?:en|in)\s+(.+)$/);
  if (cur) {
    const said = cur[1];
    const code = currencies.find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(said))
      ?? (/\b(?:dolar(?:es)?|dollars?)\b/.test(said) ? currencies.find((c) => c === 'USD') : /\b(?:pesos?|moneda local)\b/.test(said) ? currencies.find((c) => c !== 'USD') : undefined);
    if (code) return { op: 'currency', code };
  }
  const period = parsePeriod(body);
  // El período dicho solo («el mes pasado», «marzo») o con verbo («mostrame esta semana»).
  if (period && (t !== body || /^(?:el |la |los |las |the |this |last |en |in |este |esta |estos |estas )?(?:mes|semana|ano|month|week|year|ultim|past|del |from |hoy|ayer|today|yesterday|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)/.test(body))) return { op: 'period', period };
  return null;
}

registerVoiceCommand<FilterParsed>({
  id: 'dashboard.filter',
  domain: DASHBOARD_VOICE_DOMAIN,
  priority: 44,
  aux: true,
  match: (normalized) => { const b = board(); return b ? parseDashboardFilter(normalized, b.currencies) : null; },
  run: async (parsed, ctx) => {
    const b = board();
    if (!b) return;
    if (parsed.op === 'reload') { b.reload(); await say(ctx, T(ctx, 'reloaded'), 'success'); return; }
    if (!b.canFilter) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
    if (parsed.op === 'currency') { b.setCurrency(parsed.code); await say(ctx, T(ctx, 'currencySet', { code: parsed.code }), 'success'); return; }
    if (parsed.op === 'sede') {
      if (!parsed.name) { b.setSede(null); await say(ctx, T(ctx, 'allSedes'), 'success'); return; }
      const key = normalizeSpeech(parsed.name);
      let sede = b.sedes.find((s) => normalizeSpeech(s.name) === key) ?? b.sedes.find((s) => normalizeSpeech(s.name).includes(key));
      if (!sede) {
        const question = `${T(ctx, 'sedeNotFound', { name: parsed.name })} ${T(ctx, 'whichSede')}`;
        const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: b.sedes.map((s) => ({ label: s.name })) }, question);
        sede = b.sedes[index];
      }
      b.setSede(sede.id);
      await say(ctx, T(ctx, 'sedeSet', { name: sede.name }), 'success');
      return;
    }
    b.setRange(parsed.period.from, parsed.period.to);
    await say(ctx, T(ctx, 'periodSet', { from: format(parsed.period.from, 'dd/MM/yyyy'), to: format(parsed.period.to, 'dd/MM/yyyy') }), 'success');
  },
});
