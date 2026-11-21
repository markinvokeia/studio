import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge, listVoiceBridges } from '@/lib/voice/screen-bridge';

import type { CashCountVoiceBridge, CashierSessionVoiceBridge, CashierVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * La Caja por voz (src/app/[locale]/cashier/page.tsx): ver las cajas y abrir una («abrí la Caja
 * 1»), lo de la sesión abierta («¿cuánto hay en efectivo?», «¿cuánto entró?», «el último
 * movimiento»), hacer el cierre, y contar el efectivo en la apertura o el cierre («5 billetes de
 * 1000, 3 de 500», «todo en cero», «lo mismo que el último cierre», «¿cuánto da?»). Los botones
 * del asistente («siguiente», «atrás», «confirmar») se tocan con la voz genérica.
 */

export const CASHIER_VOICE_DOMAIN = 'cashier';
registerVoiceDomain({ id: CASHIER_VOICE_DOMAIN, notUnderstoodKey: 'VoiceCommands.cashier.notUnderstood' });

const page = () => getVoiceBridge<CashierVoiceBridge>('cashier');
const session = () => getVoiceBridge<CashierSessionVoiceBridge>('cashier.session');
const counters = () => listVoiceBridges<CashCountVoiceBridge | null>('cashier.count').filter((c): c is CashCountVoiceBridge => !!c && typeof c === 'object' && 'currency' in c);
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.cashier.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}
const money = (amount: number, currency: string, locale: string) => {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount}`; }
};
const list = (items: Array<{ currency: string; amount: number }>, locale: string) => items.filter((i) => i.amount !== 0).map((i) => money(i.amount, i.currency, locale)).join(', ') || money(0, items[0]?.currency || 'UYU', locale);
const prep = (n: string) => {
  let t = n.replace(/\b(?:por favor|please|che|decime|deci\w*|dime|tell me)\b/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(/\b(\d{1,3}) (\d{3})\b/g, '$1$2');
  // «de mil» = 1000 (sin número antes, «mil» solo no se pasa a cifras).
  t = t.split(' ').map((w, i, all) => (w === 'mil' && !/^\d+$/.test(all[i - 1] ?? '') ? '1000' : w)).join(' ');
  return t;
};

// ── Cajas y sesión ────────────────────────────────────────────────────────────

type PointsParsed = { op: 'list' } | { op: 'open'; name: string | null } | { op: 'close' } | { op: 'all' };
const REGISTER = '(?:la caja|caja|el punto de caja|punto de caja|la sesion|sesion de caja|the register|register|the cash register|cash register|the till|till)';

export function parseCashierPoints(normalized: string): PointsParsed | null {
  const t = prep(normalized);
  if (/^(?:que cajas (?:hay|estan abiertas|tengo)|cuales cajas (?:hay|estan abiertas)|(?:what|which) (?:registers|cash registers|tills) (?:are there|are open))(?:\s+abiertas)?$/.test(t)) return { op: 'list' };
  if (/^(?:volve\w* a las cajas|ver todas las cajas|todas las cajas|mostra\w* (?:todas )?las cajas|see all (?:the )?(?:registers|tills)|all (?:registers|tills)|back to (?:the )?(?:registers|tills))$/.test(t)) return { op: 'all' };
  if (new RegExp(`^(?:cerra\\w*|cierra|cerrar|hace\\w* el cierre(?: de caja)?|haz el cierre|empeza\\w* el cierre|quiero cerrar|close|start (?:the )?closing)\\s*(?:${REGISTER})?$`).test(t) && /\b(?:caja|cierre|register|till|closing|sesion)\b/.test(t)) return { op: 'close' };
  const open = t.match(new RegExp(`^(?:abri\\w*|abre|abrir|entra\\w* (?:a|en)|ve\\w* a|quiero abrir|open|go to|start)\\s+${REGISTER}(?:\\s+(.+))?$`));
  if (open) return { op: 'open', name: open[1]?.trim() || null };
  return null;
}

registerVoiceCommand<PointsParsed>({
  id: 'cashier.points',
  domain: CASHIER_VOICE_DOMAIN,
  priority: 52,
  match: (normalized) => (page() ? parseCashierPoints(normalized) : null),
  run: async (parsed, ctx) => {
    const p = page();
    if (!p) return;
    if (parsed.op === 'list') {
      if (!p.cashPoints.length) { await say(ctx, T(ctx, 'noPoints'), 'info'); return; }
      const open = p.cashPoints.filter((c) => c.open);
      await say(ctx, T(ctx, 'points', { count: p.cashPoints.length, open: open.length ? open.map((c) => c.name).join(', ') : T(ctx, 'noneOpen') }), 'info', p.cashPoints.map((c) => ({ label: c.name, value: c.open ? `${T(ctx, 'open')}${c.user ? ` · ${c.user}` : ''}` : T(ctx, 'closed') })));
      return;
    }
    if (parsed.op === 'all') {
      if (!p.viewAll) { await say(ctx, T(ctx, 'alreadyPoints'), 'info'); return; }
      p.viewAll();
      await say(ctx, T(ctx, 'showingPoints'));
      return;
    }
    if (parsed.op === 'close') {
      if (!p.startClosing) { await say(ctx, p.view === 'closing' ? T(ctx, 'alreadyClosing') : T(ctx, 'noSession'), 'info'); return; }
      p.startClosing();
      await say(ctx, T(ctx, 'closingStarted'));
      return;
    }
    // Abrir: la que se nombró; si no, la propia abierta o la única; si hay varias, se pregunta.
    const mine = p.cashPoints.find((c) => c.mine);
    let point = parsed.name
      ? p.cashPoints.find((c) => normalizeSpeech(c.name) === normalizeSpeech(parsed.name!)) ?? p.cashPoints.find((c) => normalizeSpeech(c.name).includes(normalizeSpeech(parsed.name!))) ?? (() => { const i = parseChoice(normalizeSpeech(parsed.name!), p.cashPoints.length); return i === null ? undefined : p.cashPoints[i]; })()
      : mine ?? (p.cashPoints.length === 1 ? p.cashPoints[0] : undefined);
    if (!point) {
      if (!p.cashPoints.length) { await say(ctx, T(ctx, 'noPoints'), 'info'); return; }
      const question = parsed.name ? `${T(ctx, 'pointNotFound', { name: parsed.name })} ${T(ctx, 'whichPoint')}` : T(ctx, 'whichPoint');
      const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: p.cashPoints.map((c) => ({ label: c.name, detail: c.open ? T(ctx, 'open') : T(ctx, 'closed') })) }, `${question} ${p.cashPoints.map((c, i) => `${i + 1}: ${c.name}`).join('. ')}.`);
      point = p.cashPoints[index];
    }
    if (!point.open && mine) { await say(ctx, T(ctx, 'alreadyHasSession', { name: mine.name }), 'info'); return; }
    p.openPoint(point.id);
    await say(ctx, point.open ? T(ctx, 'sessionShown', { name: point.name }) : T(ctx, 'openingStarted', { name: point.name }));
  },
});

type SessionParsed = { op: 'cash' | 'income' | 'outcome' | 'card' | 'movements' | 'last' };

export function parseCashierSession(normalized: string): SessionParsed | null {
  const t = prep(normalized);
  if (/^(?:(?:cuanto|cuanta plata|cuanto efectivo) (?:hay|tengo|tenemos|queda)(?: en (?:la )?caja| en efectivo)?|(?:el )?(?:saldo|efectivo)(?: de (?:la )?caja| en caja)?|cuanto hay en efectivo|how much (?:cash|money) (?:is there|do (?:i|we) have)(?: in (?:the )?(?:register|till))?|(?:the )?cash on hand|(?:the )?balance)$/.test(t)) return { op: 'cash' };
  if (/^(?:cuanto (?:entro|ingreso|cobramos|se cobro)|(?:los )?ingresos|how much came in|(?:the )?income)(?: hoy| en la sesion| today)?$/.test(t)) return { op: 'income' };
  if (/^(?:cuanto (?:salio|egreso|se pago|pagamos)|(?:los )?egresos|(?:las )?salidas|how much went out|(?:the )?(?:outflows|expenses))(?: hoy| en la sesion| today)?$/.test(t)) return { op: 'outcome' };
  if (/^(?:cuanto (?:con|en|por) (?:tarjetas?|pos)|(?:las )?tarjetas|(?:el )?pos|how much (?:by|on|with) card|card (?:payments|total))$/.test(t)) return { op: 'card' };
  if (/^(?:(?:el )?ultimo movimiento|(?:what was )?the last (?:movement|transaction))$/.test(t)) return { op: 'last' };
  if (/^(?:(?:cuantos|que) movimientos (?:hay|hubo|tengo)|lee\w* (?:los )?movimientos|(?:los )?movimientos|(?:how many|what) (?:movements|transactions)(?: are there| were there)?|read (?:the )?(?:movements|transactions))$/.test(t)) return { op: 'movements' };
  return null;
}

registerVoiceCommand<SessionParsed>({
  id: 'cashier.session',
  domain: CASHIER_VOICE_DOMAIN,
  priority: 51,
  aux: true,
  match: (normalized) => (page() ? parseCashierSession(normalized) : null),
  run: async (parsed, ctx) => {
    const s = session();
    if (!s) { await say(ctx, T(ctx, 'noSession'), 'info'); return; }
    const L = ctx.locale;
    if (parsed.op === 'cash') { await say(ctx, T(ctx, 'cashOnHand', { name: s.name, amount: list(s.cashOnHand, L) }), 'info'); return; }
    if (parsed.op === 'income') { await say(ctx, T(ctx, 'income', { amount: list(s.income, L) }), 'info'); return; }
    if (parsed.op === 'outcome') { await say(ctx, T(ctx, 'outcome', { amount: list(s.outcome, L) }), 'info'); return; }
    if (parsed.op === 'card') { await say(ctx, T(ctx, 'card', { amount: list(s.card, L) }), 'info'); return; }
    if (!s.movements.length) { await say(ctx, T(ctx, 'noMovements'), 'info'); return; }
    const describe = (m: CashierSessionVoiceBridge['movements'][number]) => `${m.type === 'INGRESO' ? '+' : '−'}${money(m.amount, m.currency || 'UYU', L)} ${m.method}${m.client ? ` · ${m.client}` : ''}`;
    if (parsed.op === 'last') { await say(ctx, T(ctx, 'last', { movement: describe(s.movements[0]) }), 'info'); return; }
    await say(ctx, T(ctx, 'movements', { count: s.movements.length }), 'info', s.movements.slice(0, 10).map((m) => ({ label: m.document || m.method, value: describe(m) })));
  },
});

// ── Contar el efectivo ────────────────────────────────────────────────────────

type CountParsed =
  | { op: 'set'; items: Array<{ quantity: number; denomination: number }>; currency: string | null }
  | { op: 'total'; amount: number; currency: string | null }
  | { op: 'zero' }
  | { op: 'last' }
  | { op: 'read' };

const CURRENCY_WORDS: Array<[RegExp, string]> = [[/\b(?:dolar(?:es)?|dollars?|usd)\b/, 'USD'], [/\b(?:euros?|eur)\b/, 'EUR'], [/\b(?:reales?|brl)\b/, 'BRL']];

export function parseCashCount(normalized: string): CountParsed | null {
  const t = prep(normalized);
  if (/^(?:(?:pone\w* |pon |deja\w* )?todo (?:en|a) (?:cero|0)|(?:todo )?(?:a |en )?(?:cero|0)|vacia\w*(?: el conteo)?|(?:set )?(?:all|everything) (?:to )?(?:zero|0)|zero (?:it )?out|clear (?:the )?count)$/.test(t)) return { op: 'zero' };
  if (/^(?:(?:carga\w*|pone\w*|usa\w*|copia\w*) )?(?:lo mismo que |igual que )?(?:el )?ultimo cierre|(?:same as|use|load) (?:the )?last clos(?:ing|e)$/.test(t)) return { op: 'last' };
  if (/^(?:cuanto (?:da|es|suma|hay contado|conte)|(?:el )?total(?: contado)?|how much (?:is it|does it come to)|(?:the )?total)$/.test(t)) return { op: 'read' };
  const currency = CURRENCY_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
  const total = t.match(/^(?:(?:el )?(?:total|monto) (?:es|son|de)|son|hay|tengo|the total is|total)\s+(\d+(?:\s\d{1,2})?)(?:\s+\w+)?$/);
  if (total) return { op: 'total', amount: Number(total[1].replace(' ', '.')), currency };
  // «5 billetes de 1000, 3 de 500 y 2 monedas de 10», «de 200 pongo 4», «ten 100 dollar bills».
  // Se buscan los pares en toda la frase (las comas no llegan) y lo que sobra tiene que ser relleno.
  const items: Array<{ quantity: number; denomination: number }> = [];
  const PAIR = /(?:(\d+)\s+(?:(?:billetes?|monedas?|notes?|bills?|coins?)\s+)?(?:de|of)\s+(\d+)|(?:de|of)\s+(\d+)\s+(?:pongo|hay|tengo|son|are|put)\s+(\d+)|(\d+)\s+(\d+)\s+(?:dollar |peso )?(?:bills?|notes?|coins?))/g;
  let leftover = t;
  for (const m of t.matchAll(PAIR)) {
    if (m[1]) items.push({ quantity: Number(m[1]), denomination: Number(m[2]) });
    else if (m[3]) items.push({ quantity: Number(m[4]), denomination: Number(m[3]) });
    else items.push({ quantity: Number(m[5]), denomination: Number(m[6]) });
    leftover = leftover.replace(m[0], ' ');
  }
  if (!items.length) return null;
  if (leftover.replace(/\b(?:y|e|and|mas|plus|pone\w*|pon|hay|tengo|son|agrega\w*|carga\w*|put|there are|i have|pesos?|dolares?|dollars?|euros?|billetes?|monedas?)\b/g, ' ').trim()) return null;
  return { op: 'set', items, currency };
}

registerVoiceCommand<CountParsed>({
  id: 'cashier.count',
  domain: CASHIER_VOICE_DOMAIN,
  priority: 53,
  match: (normalized) => (counters().length ? parseCashCount(normalized) : null),
  run: async (parsed, ctx) => {
    const all = counters();
    if (!all.length) return;
    const want = 'currency' in parsed ? parsed.currency : null;
    const counter = (want && all.find((c) => c.currency === want)) || all[0];
    const cur = (n: number) => money(n, counter.currency, ctx.locale);
    const settle = () => new Promise((r) => setTimeout(r, 40));
    const fresh = () => counters().find((c) => c.currency === counter.currency) ?? counter;
    if (parsed.op === 'zero') { counter.setAll(0); await settle(); await say(ctx, T(ctx, 'zeroed', { currency: counter.currency })); return; }
    if (parsed.op === 'last') {
      if (!counter.loadLast) { await say(ctx, T(ctx, 'noLast'), 'info'); return; }
      counter.loadLast(); await settle();
      await say(ctx, T(ctx, 'lastLoaded', { total: cur(fresh().total) }));
      return;
    }
    if (parsed.op === 'read') {
      const c = fresh();
      const detail = [...c.denominations, ...c.coins].filter((d) => (c.quantities[d] ?? 0) > 0).map((d) => `${c.quantities[d]} × ${d}`).join(', ');
      await say(ctx, T(ctx, 'counted', { total: cur(c.total), detail: detail || '—' }), 'info');
      return;
    }
    if (parsed.op === 'total') {
      if (counter.denominations.length) { await say(ctx, T(ctx, 'countByNotes'), 'info'); return; }
      counter.setTotal(parsed.amount); await settle();
      await say(ctx, T(ctx, 'totalSet', { total: cur(parsed.amount) }));
      return;
    }
    const valid = new Set([...counter.denominations, ...counter.coins]);
    if (!valid.size) { await say(ctx, T(ctx, 'onlyTotal'), 'info'); return; }
    const bad = parsed.items.filter((i) => !valid.has(i.denomination));
    if (bad.length) { await say(ctx, T(ctx, 'noSuchNote', { value: bad[0].denomination, currency: counter.currency }), 'info'); return; }
    // Cada cambio parte del último estado (React publica de nuevo después de cada uno).
    for (const item of parsed.items) { fresh().setQuantity(item.denomination, item.quantity); await settle(); }
    await say(ctx, T(ctx, 'countSet', { items: parsed.items.map((i) => `${i.quantity} × ${i.denomination}`).join(', '), total: cur(fresh().total) }));
  },
});
