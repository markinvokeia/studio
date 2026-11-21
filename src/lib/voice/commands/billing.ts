import { stemUi } from '@/lib/voice/dom-ui';
import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';
import { looksLikeCommand } from '@/lib/voice/wake';
import { searchPatientsForVoice } from '@/services/voice';

import type {
  BillingItemsVoiceBridge,
  BillingPatientVoiceBridge,
  BillingPaymentVoiceBridge,
  BillingVoiceBridge,
  BillingVoiceLine,
  BillingVoiceService,
  DiscountMode,
  VoiceCommandContext,
} from '@/lib/types';

/**
 * El cobro rápido por voz, paso por paso (src/components/billing-wizard). Mientras está abierto
 * registra el módulo 'billing' y cada paso publica lo suyo:
 *
 * - Paciente: «para Juan Pérez», «el paciente es Ana», o el nombre solo.
 * - Servicios: «agregá limpieza», «agregá 2 consultas a 1500», «agregá un servicio» (pregunta cuál),
 *   «el precio de la limpieza a 1200», «cantidad 3», «10% de descuento a la limpieza», «descuento de
 *   500», «sacá el descuento», «quitá la consulta», «en dólares», «sede Pocitos», «¿cuánto da?».
 * - Pago: «en efectivo», «con tarjeta», «500 en efectivo y el resto con tarjeta», «todo», «otro medio
 *   de pago», «en dólares», «nota: pagó con cambio», «¿cuánto falta?».
 * - El pie: «facturá y cobrá», «solo facturar», «siguiente», «cobrá», «cerrar».
 *
 * Los botones y campos que no tienen comando propio se manejan con la voz genérica (core.screen).
 */

export const BILLING_VOICE_DOMAIN = 'billing';
registerVoiceDomain({ id: BILLING_VOICE_DOMAIN });

const wizard = () => getVoiceBridge<BillingVoiceBridge>('billing');
const itemsBridge = () => (wizard()?.step === 'items' ? getVoiceBridge<BillingItemsVoiceBridge>('billing.items') : null);
const patientBridge = () => (wizard()?.step === 'patient' ? getVoiceBridge<BillingPatientVoiceBridge>('billing.patient') : null);
const paymentBridge = () => (wizard()?.step === 'payment' ? getVoiceBridge<BillingPaymentVoiceBridge>('billing.payment') : null);

const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.billing.${key}`, values);
const title = (ctx: VoiceCommandContext) => T(ctx, 'title');
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success') {
  await ctx.finish({ title: title(ctx), message, tone }, message);
}
/** Deja que la pantalla se redibuje (el puente se publica en cada render). */
const settle = () => new Promise((r) => setTimeout(r, 60));

const money = (amount: number, currency: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

/** «1 500» (de «1.500») → «1500». */
const joinThousands = (text: string) => {
  let out = text;
  for (let i = 0; i < 3; i++) out = out.replace(/\b(\d{1,3}) (\d{3})\b/g, '$1$2');
  return out;
};
const prep = (normalized: string) => joinThousands(normalized).replace(/\b(?:por favor|please|che|dale)\b/g, ' ').replace(/\s+/g, ' ').trim();
// «por ciento» puede llegar como «por 100» (los números dichos se pasan a cifras).
const isPercent = (raw: string, normalized: string) => /%/.test(raw) || /\b(?:por ciento|porciento|por 100|percent|pct)\b/.test(normalized) || /por ciento|percent/i.test(raw);

/** La línea nombrada («la limpieza», «la última», «the first»), o null. */
function findLine(said: string | null, lines: BillingVoiceLine[]): BillingVoiceLine | 'ambiguous' | null {
  if (!lines.length) return null;
  if (!said) return lines.length === 1 ? lines[0] : 'ambiguous';
  const s = said.replace(/^(?:(?:el|la|los|las|lo|un|una|the|a|an|del|de)\s+)+/, '').trim();
  if (/^(?:ultim[oa]|last(?: one)?|ese|esa|that one|it)$/.test(s)) return lines[lines.length - 1];
  const position = parseChoice(s, lines.length);
  if (position !== null && /^(?:primer|segund|tercer|cuart|quint|first|second|third|fourth|fifth|\d)/.test(s)) return lines[position];
  const words = normalizeSpeech(s).split(' ').filter((w) => w.length > 2).map(stemUi);
  if (!words.length) return null;
  const hits = lines.filter((l) => {
    const name = normalizeSpeech(l.name).split(' ').map(stemUi);
    return words.every((w) => name.some((n) => n.startsWith(w) || w.startsWith(n)));
  });
  return hits.length === 1 ? hits[0] : hits.length > 1 ? 'ambiguous' : null;
}

async function chooseLine(ctx: VoiceCommandContext, lines: BillingVoiceLine[], question = T(ctx, 'whichLine')): Promise<BillingVoiceLine> {
  const index = await ctx.choose(
    { title: title(ctx), message: question, tone: 'info', choices: lines.map((l) => ({ label: l.name, detail: `x${l.quantity}` })) },
    `${question} ${lines.map((l, i) => `${i + 1}: ${l.name}`).join('. ')}.`,
  );
  return lines[index];
}

async function resolveLine(ctx: VoiceCommandContext, said: string | null, items: BillingItemsVoiceBridge): Promise<BillingVoiceLine | null> {
  const found = findLine(said, items.lines);
  if (found === 'ambiguous') return chooseLine(ctx, said ? items.lines.filter((l) => findLine(said, [l]) !== null) : items.lines);
  if (!found) {
    await say(ctx, said ? T(ctx, 'lineNotFound', { name: said }) : T(ctx, 'noLines'), 'info');
    return null;
  }
  return found;
}

// ── Paciente ──────────────────────────────────────────────────────────────────

interface PatientParsed { query: string }
const PATIENT_RE = /^(?:(?:el |la )?paciente es|es para|para|a nombre de|cobrale a|cobra a|facturale a|the patient is|patient is|it is for|its for|for|bill to|charge)\s+(.+)$/;

registerVoiceCommand<PatientParsed>({
  id: 'billing.patient',
  domain: BILLING_VOICE_DOMAIN,
  priority: 92,
  keepsOverlay: true,
  match: (normalized, raw) => {
    if (!patientBridge()) return null;
    const m = normalized.match(PATIENT_RE);
    const query = m ? m[1] : (!looksLikeCommand(normalized) && normalized.split(' ').length <= 4 && !/\b(?:siguiente|cancelar|cerrar|next|cancel|close|si|no)\b/.test(normalized) ? normalized : null);
    if (!query) return null;
    // El nombre como se dijo (mayúsculas, tildes).
    const tokens = raw.trim().split(/\s+/);
    const tail = tokens.slice(-query.split(' ').length).join(' ').replace(/[.,;:!?]+$/, '');
    return { query: normalizeSpeech(tail) === query ? tail : query };
  },
  run: async (parsed, ctx) => {
    const bridge = patientBridge();
    if (!bridge) return;
    ctx.show({ title: title(ctx), message: T(ctx, 'searchingPatient', { name: parsed.query }), tone: 'info' });
    const found = await searchPatientsForVoice(parsed.query, { signal: ctx.signal }).catch((error) => { if (ctx.signal.aborted) throw error; return null; });
    if (!found) { await say(ctx, ctx.t('VoiceCommands.genericError'), 'error'); return; }
    if (!found.length) { await say(ctx, T(ctx, 'patientNotFound', { name: parsed.query }), 'info'); return; }
    let patient = found[0];
    if (found.length > 1) {
      const question = T(ctx, 'whichPatient');
      const index = await ctx.choose(
        { title: title(ctx), message: question, tone: 'info', choices: found.map((p) => ({ label: p.name, detail: p.document || p.phone || undefined })) },
        `${question} ${found.slice(0, 5).map((p, i) => `${i + 1}: ${p.name}`).join('. ')}.`,
      );
      patient = found[index];
    }
    bridge.select({ id: patient.id, name: patient.name, email: patient.email, phone: patient.phone });
    await settle();
    // Elegido el paciente se sigue a los servicios.
    wizard()?.next?.();
    await say(ctx, T(ctx, 'patientSet', { name: patient.name }));
  },
});

// ── Servicios: agregar ────────────────────────────────────────────────────────

interface AddParsed { query: string | null; quantity: number | null; price: number | null }
const ADD_RE = /^(?:agrega\w*|agregar|suma\w*|sumar|pone\w*|carga\w*|anota\w*|mete\w*|anad\w*|incorpora\w*|inclui\w*|add|include|put)\s+(?:(?:un|una|otro|otra|el|la|los|las|a|an|another|the|some)\s+)?(?:(\d+)\s+)?(?:(?:servicios?|prestacion(?:es)?|services?|items?)(?:\s+(?:de|of|for)\s+|\s+|$))?(.*?)(?:\s+(?:a|por|en|at|for|de)\s+(\d+(?:\s\d{2})?)(?:\s+(?:pesos|dolares|dollars|bucks))?(?:\s+(?:cada una?|c u|each))?)?$/;

export function parseBillingAdd(normalized: string): AddParsed | null {
  const text = prep(normalized);
  const m = text.match(ADD_RE);
  if (!m) return null;
  let query = m[2].trim();
  // «agregá un descuento» o «agregá otro medio de pago» no son servicios.
  if (/\b(?:descuento|rebaja|discount|medio de pago|forma de pago|metodo de pago|payment method|nota|note)\b/.test(query)) return null;
  const quantity = m[1] ? Number(m[1]) : null;
  const price = m[3] ? Number(m[3].replace(' ', '.')) : null;
  query = query.replace(/^(?:de|del|of)\s+/, '').trim();
  return { query: query || null, quantity, price };
}

async function findService(ctx: VoiceCommandContext, items: BillingItemsVoiceBridge, query: string): Promise<BillingVoiceService | null> {
  ctx.show({ title: title(ctx), message: T(ctx, 'searchingService', { name: query }), tone: 'info' });
  const tries = [query, query.split(' ').map((w) => (w.length > 4 ? w.replace(/(?:es|s)$/, '') : w)).join(' ')];
  let found: BillingVoiceService[] = [];
  for (const q of [...new Set(tries)]) {
    found = await items.searchServices(q).catch(() => []);
    if (ctx.signal.aborted) return null;
    if (found.length) break;
  }
  if (!found.length) { await say(ctx, T(ctx, 'serviceNotFound', { name: query }), 'info'); return null; }
  const key = normalizeSpeech(tries[1]);
  const exact = found.filter((s) => normalizeSpeech(s.name) === normalizeSpeech(query) || normalizeSpeech(s.name) === key);
  if (exact.length === 1 || found.length === 1) return exact[0] ?? found[0];
  const options = found.slice(0, 6);
  const question = T(ctx, 'whichService');
  const index = await ctx.choose(
    { title: title(ctx), message: question, tone: 'info', choices: options.map((s) => ({ label: s.name, detail: money(s.price, items.currency, ctx.locale) })) },
    `${question} ${options.map((s, i) => `${i + 1}: ${s.name}`).join('. ')}.`,
  );
  return options[index];
}

registerVoiceCommand<AddParsed>({
  id: 'billing.add',
  domain: BILLING_VOICE_DOMAIN,
  priority: 91,
  keepsOverlay: true,
  match: (normalized) => {
    const items = itemsBridge();
    const parsed = items ? parseBillingAdd(normalized) : null;
    // «poné la limpieza en 1300» con la limpieza ya cargada es cambiarle el precio, no agregar otra.
    if (parsed?.query && /^(?:pone|pon|deja|put|set)\b/.test(normalized) && findLine(parsed.query, items!.lines)) return null;
    return parsed;
  },
  run: async (parsed, ctx) => {
    let items = itemsBridge();
    if (!items) return;
    let query = parsed.query;
    if (!query) {
      const question = T(ctx, 'whatService');
      query = (await ctx.ask({ title: title(ctx), message: question, tone: 'info' }, question)).trim();
      if (!query) return;
    }
    const service = await findService(ctx, items, query);
    if (!service) return;
    items = itemsBridge();
    if (!items) return;
    items.add(service, { quantity: parsed.quantity ?? undefined, price: parsed.price ?? undefined });
    await settle();
    const now = itemsBridge();
    const price = parsed.price ?? service.price;
    const qty = parsed.quantity && parsed.quantity > 1 ? `${parsed.quantity} × ` : '';
    await say(ctx, T(ctx, 'added', { name: `${qty}${service.name}`, price: money(price, items.currency, ctx.locale), total: money(now?.total ?? 0, items.currency, ctx.locale) }));
  },
});

// ── Servicios: precio, cantidad, descuento, quitar ────────────────────────────

type LineParsed =
  | { op: 'price'; line: string | null; value: number }
  | { op: 'quantity'; line: string | null; value: number }
  | { op: 'discount'; line: string | null; mode: DiscountMode; value: number; total: boolean }
  | { op: 'undiscount'; line: string | null; total: boolean }
  | { op: 'remove'; line: string };

const NUM = '(\\d+(?:\\s\\d{1,2})?)';
const asNumber = (s: string) => Number(s.replace(' ', '.'));

export function parseBillingLine(normalized: string, raw: string): LineParsed | null {
  const text = prep(normalized);
  const lineOf = (s: string | undefined) => (s ? s.replace(/^(?:(?:el|la|los|las|the|del|de|al|a)\s+)+/, '').trim() || null : null);
  // Precio: «el precio de la limpieza a 1200», «la limpieza a 1200», «poné el precio en 900», «set the price of cleaning to 1200».
  let m = text.match(new RegExp(`^(?:(?:cambia\\w*|pone\\w*|deja\\w*|set|change|make)\\s+)?(?:el |the )?(?:precio|valor|importe|price)(?:\\s+(?:unitario|unit))?(?:\\s+(?:de|del|of|for)\\s+(.+?))?\\s+(?:a|en|es|to|is|at|de)\\s+${NUM}(?:\\s+(?:pesos|dolares|dollars))?$`));
  if (m) return { op: 'price', line: lineOf(m[1]), value: asNumber(m[2]) };
  m = text.match(new RegExp(`^(?:(?:cobra\\w*|deja\\w*|pone\\w*|charge)\\s+)?(?:el |la |the )?(.+?)\\s+(?:a|sale|cuesta|vale|en|at|for|costs)\\s+${NUM}(?:\\s+(?:pesos|dolares|dollars))?$`));
  if (m && !/\b(?:descuento|discount|cantidad|quantity|precio|price|moneda|sede|efectivo|tarjeta|cash|card)\b/.test(m[1]) && m[1].split(' ').length <= 4) return { op: 'price', line: lineOf(m[1]), value: asNumber(m[2]) };
  // Cantidad: «cantidad 3», «la cantidad de la limpieza en 2», «que sean 2 limpiezas», «poné 3 de consulta», «make it 2».
  m = text.match(/^(?:(?:cambia\w*|pone\w*|set|change)\s+)?(?:la |the )?(?:cantidad|quantity|qty)(?:\s+(?:de|del|of|for)\s+(.+?))?\s+(?:a|en|es|to|is|de)?\s*(\d+)$/);
  if (m) return { op: 'quantity', line: lineOf(m[1]), value: Number(m[2]) };
  m = text.match(/^(?:que sean|pone\w*|deja\w*|make (?:it|that)|que son)\s+(\d+)(?:\s+(?:de\s+)?(.+))?$/);
  if (m && !/\b(?:descuento|discount|por ciento|percent|pesos|dolares)\b/.test(m[2] ?? '')) return { op: 'quantity', line: lineOf(m[2]), value: Number(m[1]) };
  // Descuento: «10% de descuento a la limpieza», «descuento del 10 por ciento», «aplicá un descuento de 500», «give 10 percent off».
  const discountWord = /\b(?:descuento|descontale|descontá|desconta|rebaja|bonificacion|discount|off)\b/;
  if (discountWord.test(text)) {
    if (/^(?:saca\w*|quita\w*|borra\w*|elimina\w*|remove|delete|clear|take off|sin)\s+(?:el |la |the |any )?(?:descuento|rebaja|discount)/.test(text)) {
      const of = text.replace(/^.*?\b(?:descuento|rebaja|discount)\b/, '').match(/^\s+(?:de|del|a|al|on|from)\s+(?:la |el |the )?(.+)$/);
      const target = of && !/^(?:total|todo)$/.test(of[1]) ? lineOf(of[1]) : null;
      return { op: 'undiscount', line: target, total: !!of && /^(?:total|todo)$/.test(of[1]) };
    }
    const num = text.match(/(\d+(?:\s\d{1,2})?)/);
    if (!num) return null;
    const value = asNumber(num[1]);
    const on = text.match(/(?:\s(?:a|al|en|para|on|to|for)\s+(?:la |el |the )?)([a-z][a-z ]*?)$/);
    const target = on && !/^(?:descuento|discount|off|por ciento|percent|pesos|dolares)$/.test(on[1]) ? on[1].trim() : null;
    const total = !!target && /^(?:total|todo|toda la factura|the total|everything|all)$/.test(target);
    return { op: 'discount', line: total ? null : lineOf(target ?? undefined), mode: isPercent(raw, text) ? 'percent' : 'amount', value, total };
  }
  // Quitar: «quitá la consulta», «sacá la última», «remove the cleaning».
  m = text.match(/^(?:saca\w*|quita\w*|borra\w*|elimina\w*|remove|delete|take (?:off|out))\s+(.+)$/);
  if (m && !/\b(?:medio de pago|forma de pago|payment method|nota|note)\b/.test(m[1])) return { op: 'remove', line: lineOf(m[1]) ?? m[1] };
  return null;
}

registerVoiceCommand<LineParsed>({
  id: 'billing.line',
  domain: BILLING_VOICE_DOMAIN,
  priority: 90,
  keepsOverlay: true,
  match: (normalized, raw) => (itemsBridge() ? parseBillingLine(normalized, raw) : null),
  run: async (parsed, ctx) => {
    const items = itemsBridge();
    if (!items) return;
    const cur = (n: number) => money(n, items.currency, ctx.locale);
    if (parsed.op === 'discount' || parsed.op === 'undiscount') {
      const { scope, canApply, maxPct } = items.discounts;
      if (!scope) { await say(ctx, T(ctx, 'discountsOff'), 'info'); return; }
      if (!canApply) { await say(ctx, T(ctx, 'discountNoPermission'), 'error'); return; }
      if (parsed.op === 'discount' && parsed.mode === 'percent' && maxPct != null && parsed.value > maxPct) {
        await say(ctx, T(ctx, 'discountMax', { max: maxPct }), 'info');
        return;
      }
      const discount = parsed.op === 'discount' ? { mode: parsed.mode, value: parsed.value } : null;
      if (scope === 'total' || parsed.total) {
        if (scope !== 'total') { await say(ctx, T(ctx, 'discountByLine'), 'info'); return; }
        items.setDocumentDiscount(discount);
      } else {
        const line = await resolveLine(ctx, parsed.line, items);
        if (!line) return;
        items.setLineDiscount(line.id, discount);
      }
      await settle();
      const now = itemsBridge() ?? items;
      const what = discount ? (discount.mode === 'percent' ? `${discount.value}%` : cur(discount.value)) : '';
      await say(ctx, discount ? T(ctx, 'discountApplied', { discount: what, total: cur(now.total) }) : T(ctx, 'discountRemoved', { total: cur(now.total) }));
      return;
    }
    const line = await resolveLine(ctx, parsed.line, items);
    if (!line) return;
    if (parsed.op === 'remove') items.remove(line.id);
    else if (parsed.op === 'price') items.setPrice(line.id, parsed.value);
    else items.setQuantity(line.id, Math.max(1, parsed.value));
    await settle();
    const now = itemsBridge() ?? items;
    const key = parsed.op === 'remove' ? 'removed' : parsed.op === 'price' ? 'priceSet' : 'quantitySet';
    await say(ctx, T(ctx, key, { name: line.name, value: parsed.op === 'price' ? cur(parsed.value) : parsed.op === 'quantity' ? parsed.value : '', total: cur(now.total) }));
  },
});

// ── Lo cargado, moneda, sede ──────────────────────────────────────────────────

type InfoParsed = { op: 'read' } | { op: 'currency'; code: string } | { op: 'sede'; name: string } | { op: 'pending' };

const CURRENCY_WORDS: Array<[RegExp, string[]]> = [
  [/\b(?:dolar(?:es)?|dollars?|usd|verdes)\b/, ['USD']],
  [/\b(?:euros?|eur)\b/, ['EUR']],
  [/\b(?:reales?|brl)\b/, ['BRL']],
  [/\b(?:pesos?|uyu|ars|mxn|clp|cop|moneda local|local currency)\b/, ['UYU', 'ARS', 'MXN', 'CLP', 'COP']],
];
function currencyFrom(text: string, options: string[]): string | null {
  const code = options.find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(text));
  if (code) return code;
  for (const [re, codes] of CURRENCY_WORDS) if (re.test(text)) return options.find((o) => codes.includes(o)) ?? null;
  return null;
}

export function parseBillingInfo(normalized: string, currencies: string[]): InfoParsed | null {
  const text = prep(normalized);
  if (/^(?:cuanto (?:da|es|sale|queda|suma|seria|va)(?: en total| todo| el total)?|(?:cual es |decime |dame )?el total|total|lee\w* (?:lo cargado|los servicios|lo que hay)|que (?:hay|cargue|tengo|llevamos)(?: cargado)?|what is the total|whats the total|how much is it|how much (?:is|does it come to)(?: the total)?|read (?:the )?(?:items|services|lines)|total please)$/.test(text)) return { op: 'read' };
  if (/^(?:cuanto (?:falta|debe|queda por cobrar|me falta)|que falta|how much (?:is left|is pending|remains|do they owe))$/.test(text)) return { op: 'pending' };
  const cur = text.match(/^(?:(?:cambia\w*|pone\w*|cobra\w*|factura\w*|hacelo|set|change|charge|bill|make it)\s+)?(?:(?:la )?moneda\s+(?:a|en)?\s*|(?:the )?currency\s+(?:to\s+)?|en\s+|in\s+)(.+)$/);
  if (cur) {
    const code = currencyFrom(cur[1], currencies);
    if (code) return { op: 'currency', code };
  }
  const sede = text.match(/^(?:(?:cambia\w*|pone\w*|elegi\w*|set|change)\s+)?(?:(?:a |en |the )?(?:la )?(?:sede|sucursal|location|branch))\s+(?:a\s+|en\s+|to\s+)?(.+)$/);
  if (sede) return { op: 'sede', name: sede[1].trim() };
  return null;
}

registerVoiceCommand<InfoParsed>({
  id: 'billing.info',
  domain: BILLING_VOICE_DOMAIN,
  priority: 89,
  keepsOverlay: true,
  match: (normalized) => {
    const items = itemsBridge();
    const payment = paymentBridge();
    if (!items && !payment) return null;
    const parsed = parseBillingInfo(normalized, items?.currencies ?? payment?.currencies ?? []);
    if (!parsed) return null;
    if (parsed.op === 'sede' && !items) return null;
    return parsed;
  },
  run: async (parsed, ctx) => {
    const items = itemsBridge();
    const payment = paymentBridge();
    if (parsed.op === 'currency') {
      if (items) items.setCurrency(parsed.code);
      else payment?.setEntry(Math.max(0, (payment.entries.length || 1) - 1), { currency: parsed.code });
      await settle();
      await say(ctx, T(ctx, 'currencySet', { code: parsed.code }));
      return;
    }
    if (parsed.op === 'sede' && items) {
      const key = normalizeSpeech(parsed.name);
      let sede = items.sedes.find((s) => normalizeSpeech(s.name) === key) ?? items.sedes.find((s) => normalizeSpeech(s.name).includes(key));
      if (!sede) {
        const question = `${T(ctx, 'sedeNotFound', { name: parsed.name })} ${T(ctx, 'whichSede')}`;
        const index = await ctx.choose({ title: title(ctx), message: question, tone: 'info', choices: items.sedes.map((s) => ({ label: s.name })) }, question);
        sede = items.sedes[index];
      }
      items.setSede(sede.id);
      await say(ctx, T(ctx, 'sedeSet', { name: sede.name }));
      return;
    }
    if (parsed.op === 'pending' || (parsed.op === 'read' && payment && !items)) {
      if (!payment) { await say(ctx, T(ctx, 'notInPayment'), 'info'); return; }
      await say(ctx, T(ctx, 'pending', { pending: money(payment.pending, payment.currency, ctx.locale), remaining: money(payment.remaining, payment.currency, ctx.locale) }), 'info');
      return;
    }
    if (!items) return;
    if (!items.lines.length) { await say(ctx, T(ctx, 'noLines'), 'info'); return; }
    const cur = (n: number) => money(n, items.currency, ctx.locale);
    const list = items.lines.map((l) => `${l.quantity > 1 ? `${l.quantity} × ` : ''}${l.name} ${cur(l.total)}`).join(', ');
    const discount = items.discountAmount > 0 ? ` ${T(ctx, 'withDiscount', { discount: cur(items.discountAmount) })}` : '';
    await ctx.finish(
      { title: title(ctx), message: T(ctx, 'summary', { list, total: cur(items.total) }) + discount, tone: 'info', rows: items.lines.map((l) => ({ label: `${l.quantity} × ${l.name}`, value: cur(l.total) })) },
      T(ctx, 'summary', { list, total: cur(items.total) }) + discount,
    );
  },
});

// ── Pago ──────────────────────────────────────────────────────────────────────

const METHOD_WORDS: Array<[RegExp, RegExp]> = [
  [/\b(?:efectivo|cash|contado|billete)\b/, /efectivo|cash|contado/],
  [/\b(?:tarjeta|card|pos|posnet)\b/, /tarjeta|card|pos/],
  [/\b(?:debito|debit)\b/, /debito|debit/],
  [/\b(?:credito|credit)\b/, /credito|credit/],
  [/\b(?:transferencia|transfer|bank transfer|giro)\b/, /transfer/],
  [/\b(?:cheque|check|cheque)\b/, /cheque|check/],
  [/\b(?:mercado ?pago|mp)\b/, /mercado ?pago/],
];

/** El medio de pago nombrado entre los de la clínica. */
function methodFrom(text: string, methods: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  const exact = methods.find((m) => text.includes(normalizeSpeech(m.name)));
  if (exact) return exact;
  // «tarjeta de débito» le gana a «tarjeta» si se dijo «débito».
  const scored = methods.map((m) => {
    const name = normalizeSpeech(m.name);
    const hits = METHOD_WORDS.filter(([said, inName]) => said.test(text) && inName.test(name)).length;
    return { m, hits };
  }).filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits);
  return scored[0]?.m ?? null;
}

type PayParsed =
  | { op: 'split'; parts: Array<{ amount: number | 'rest' | 'all' | null; method: string | null; currency: string | null }> }
  | { op: 'add_method' }
  | { op: 'remove_method'; index: number }
  | { op: 'notes'; text: string };

export function parseBillingPayment(normalized: string, raw: string, payment: Pick<BillingPaymentVoiceBridge, 'methods' | 'currencies'>): PayParsed | null {
  const text = prep(normalized);
  if (/^(?:agrega\w*|suma\w*|add|otro|otra|another)\s*(?:(?:otro|otra|un|una|another|a)\s+)?(?:medio|forma|metodo|payment method|method)(?: de pago)?$/.test(text)) return { op: 'add_method' };
  const rm = text.match(/^(?:saca\w*|quita\w*|borra\w*|remove|delete)\s+(?:el |la |the )?(primer|segund|tercer|ultim|first|second|third|last)\w*\s+(?:medio|forma|metodo|payment method|method)(?: de pago)?$/);
  if (rm) return { op: 'remove_method', index: /^(?:primer|first)/.test(rm[1]) ? 0 : /^(?:segund|second)/.test(rm[1]) ? 1 : /^(?:tercer|third)/.test(rm[1]) ? 2 : -1 };
  const notes = raw.match(/^\s*(?:notas?|observaci[oó]n(?:es)?|notes?|comment)\s*[:,]?\s*(.+)$/i);
  if (notes && /^(?:notas?|observacion(?:es)?|notes?|comment)\b/.test(text)) return { op: 'notes', text: notes[1].trim() };
  // Partes: «500 en efectivo y el resto con tarjeta», «todo en efectivo», «con tarjeta», «cobrá 800», «el monto es 300».
  const pieces = text.split(/\s+(?:y|e|and|mas|plus)\s+(?=(?:el resto|lo que (?:falta|queda)|the rest|\d|con|en|in|with|by)\b)/);
  const parts: Array<{ amount: number | 'rest' | 'all' | null; method: string | null; currency: string | null }> = [];
  for (const piece of pieces) {
    const p = piece.replace(/^(?:paga\w*|pago|cobra\w*|cobrar|pay|charge|el monto es|monto|the amount is|amount)\s+/, '').trim();
    const method = methodFrom(p, payment.methods);
    const currency = currencyFrom(p, payment.currencies);
    const num = p.match(/\b(\d+(?:\s\d{1,2})?)\b/);
    const amount: number | 'rest' | 'all' | null = /\b(?:el resto|lo que (?:falta|queda)|the rest|remaining|lo demas)\b/.test(p) ? 'rest'
      : /^(?:todo|el total|la totalidad|everything|all(?: of it)?|the (?:full|whole|total) amount|full amount|total)\b/.test(p) ? 'all'
        : num ? asNumber(num[1]) : null;
    const leftover = p
      .replace(/\b\d+(?:\s\d{1,2})?\b/g, ' ')
      .replace(/\b(?:en|con|de|el|la|los|las|por|in|with|by|on|the|a|of|resto|lo que falta|lo que queda|rest|remaining|todo|total|everything|all|full|whole|amount|pesos?|dolares?|dollars?|usd|uyu|euros?|efectivo|cash|tarjeta|card|debito|debit|credito|credit|transferencia|transfer|cheque|check|contado|pago|it|of it)\b/g, ' ')
      .replace(method ? new RegExp(normalizeSpeech(method.name).split(' ').join('|'), 'g') : /$^/, ' ')
      .trim();
    if (leftover) return null;
    if (amount === null && !method && !currency) return null;
    // Sin monto («en efectivo»): queda el que tenía; después del primero, lo que falta.
    parts.push({ amount: amount ?? (parts.length ? 'rest' : null), method: method?.id ?? null, currency });
  }
  if (!parts.length) return null;
  // Un número solo («500») sin medio ni moneda es poco: tiene que haber dicho «cobrá» o «el monto».
  if (parts.length === 1 && typeof parts[0].amount === 'number' && !parts[0].method && !parts[0].currency && !/^(?:paga\w*|pago|cobra\w*|cobrar|pay|charge|el monto|monto|the amount|amount)\b/.test(text)) return null;
  return { op: 'split', parts };
}

registerVoiceCommand<PayParsed>({
  id: 'billing.payment',
  domain: BILLING_VOICE_DOMAIN,
  priority: 90,
  keepsOverlay: true,
  match: (normalized, raw) => { const p = paymentBridge(); return p && p.substep === 'payment' ? parseBillingPayment(normalized, raw, p) : null; },
  run: async (parsed, ctx) => {
    let payment = paymentBridge();
    if (!payment) return;
    const cur = (n: number, c = payment!.currency) => money(n, c, ctx.locale);
    if (parsed.op === 'add_method') { payment.addEntry(); await settle(); await say(ctx, T(ctx, 'methodAdded')); return; }
    if (parsed.op === 'remove_method') {
      const index = parsed.index < 0 ? payment.entries.length - 1 : parsed.index;
      if (index <= 0 || index >= payment.entries.length) { await say(ctx, T(ctx, 'methodCantRemove'), 'info'); return; }
      payment.removeEntry(index);
      await say(ctx, T(ctx, 'methodRemoved'));
      return;
    }
    if (parsed.op === 'notes') { payment.setNotes(parsed.text); await say(ctx, T(ctx, 'notesSet')); return; }
    const total = payment.pending;
    let used = 0;
    for (let i = 0; i < parsed.parts.length; i++) {
      payment = paymentBridge();
      if (!payment) return;
      const part = parsed.parts[i];
      if (i >= payment.entries.length) { payment.addEntry(); await settle(); payment = paymentBridge(); if (!payment) return; }
      const amount = part.amount === null ? null
        : part.amount === 'rest' || (part.amount === 'all' && i > 0) ? Math.max(0, total - used)
          : part.amount === 'all' ? total : part.amount;
      payment.setEntry(i, { ...(part.method ? { method: part.method } : {}), ...(part.currency ? { currency: part.currency } : {}), ...(amount !== null ? { amount } : {}) });
      used += amount ?? payment.entries[i]?.amount ?? 0;
      await settle();
    }
    payment = paymentBridge();
    if (!payment) return;
    const lines = payment.entries.map((e) => `${payment!.methods.find((m) => m.id === e.method)?.name ?? T(ctx, 'noMethod')} ${cur(e.amount, e.currency)}`).join(', ');
    const missing = payment.entries.some((e) => !e.method);
    await say(ctx, `${T(ctx, 'paymentSet', { lines })}${missing ? ` ${T(ctx, 'methodMissing')}` : payment.remaining > 0 ? ` ${T(ctx, 'stillPending', { amount: cur(payment.remaining) })}` : ''}`);
  },
});

// ── El pie: seguir, facturar, cobrar, cerrar ──────────────────────────────────

type GoParsed = { op: 'next' } | { op: 'invoice_only' } | { op: 'close' };

export function parseBillingGo(normalized: string): GoParsed | null {
  const text = prep(normalized);
  if (/^(?:solo facturar|solo factura\w*|factura\w* (?:solamente|nomas|nada mas|sin cobrar)|solamente factura\w*|invoice only|just (?:invoice|bill)(?: it)?|only invoice|bill only|bill without (?:collecting|charging))$/.test(text)) return { op: 'invoice_only' };
  if (/^(?:factura\w* y cobra\w*|cobra\w*|cobrar|cobralo|cobrale|segui\w*|sigue|siguiente|continua\w*|continuar|avanza\w*|listo(?: cobra\w*)?|confirma\w*(?: el cobro| el pago)?|pasa\w* al pago|vamos al pago|ir al pago|next|continue|go on|proceed|bill and (?:collect|charge)|invoice and (?:collect|charge|pay)|charge(?: it)?|collect(?: it)?|confirm(?: the payment)?|go to payment|take (?:the )?payment)$/.test(text)) return { op: 'next' };
  if (/^(?:cerra\w*|cierra|cerrar|terminamos|termina\w*|listo gracias|close|done|finish|were done)$/.test(text)) return { op: 'close' };
  return null;
}

registerVoiceCommand<GoParsed>({
  id: 'billing.go',
  domain: BILLING_VOICE_DOMAIN,
  priority: 88,
  keepsOverlay: true,
  match: (normalized) => (wizard() ? parseBillingGo(normalized) : null),
  run: async (parsed, ctx) => {
    const w = wizard();
    if (!w) return;
    if (parsed.op === 'close') {
      if (w.step !== 'confirmation') { await say(ctx, T(ctx, 'closeHint'), 'info'); return; }
      w.close();
      await say(ctx, T(ctx, 'closed'));
      return;
    }
    if (w.step === 'payment') {
      const payment = paymentBridge();
      if (parsed.op === 'invoice_only') {
        if (!w.invoiceOnly) { await say(ctx, T(ctx, 'cantInvoiceOnly'), 'info'); return; }
        w.invoiceOnly();
        await say(ctx, T(ctx, 'invoicedOnly'));
        return;
      }
      if (!payment || payment.substep !== 'payment') { await say(ctx, T(ctx, 'creditsFirst'), 'info'); return; }
      if (payment.entries.some((e) => !e.method)) { await say(ctx, T(ctx, 'methodMissing'), 'info'); return; }
      payment.submit();
      await say(ctx, T(ctx, 'collecting'));
      return;
    }
    if (w.step === 'patient') {
      if (!w.next) { await say(ctx, T(ctx, 'patientMissing'), 'info'); return; }
      w.next();
      await say(ctx, T(ctx, 'toServices'));
      return;
    }
    if (w.step === 'items' || w.step === 'quote') {
      const action = parsed.op === 'invoice_only' ? w.invoiceOnly : (w.invoiceAndPay ?? w.payOnly);
      if (!action) {
        const items = itemsBridge();
        const why = items && !items.lines.length ? 'servicesMissing' : items && !items.sedeId ? 'sedeMissing' : 'cantContinue';
        await say(ctx, T(ctx, why), 'info');
        return;
      }
      action();
      await say(ctx, T(ctx, parsed.op === 'invoice_only' ? 'invoicedOnly' : 'toPayment'));
      return;
    }
    await say(ctx, T(ctx, 'cantContinue'), 'info');
  },
});
