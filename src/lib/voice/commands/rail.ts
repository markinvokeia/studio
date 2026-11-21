import { CORE_VOICE_DOMAIN } from '@/lib/voice/commands/core';
import { normalizeSpeech } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';
import { activeVoiceDomains } from '@/lib/voice/session';
import { searchPatientsForVoice, type VoicePatientResult } from '@/services/voice';
import { usePatientView } from '@/stores/patient-view-store';

import { PATIENTS_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import type { RailVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * El riel derecho por voz, desde cualquier página (src/components/voice/rail-voice-bridge.tsx):
 * abrir la ficha, la historia o la cuenta de un paciente; el cobro rápido (con o sin paciente);
 * la sede de trabajo; la caja; la pantalla de la sala (TV); alertas y bandeja; notas; el tipo de
 * cambio; el asistente; mostrar u ocultar el panel. Lo propio de la pantalla (la agenda con su
 * cita en foco) gana: estos comandos tienen prioridad media.
 */

const rail = () => getVoiceBridge<RailVoiceBridge>('rail');
/** La agenda tiene sus propios pacientes, cobros y notas (con la cita en foco): ahí gana ella. */
const onCalendar = () => activeVoiceDomains().includes('calendar');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.rail.${key}`, values);

async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success') {
  await ctx.finish({ title: T(ctx, 'title'), message, tone }, message);
}

const money = (amount: number, currency: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

// ── Paciente: ficha, historia, cuenta ─────────────────────────────────────────

type PatientTab = 'info' | 'clinical' | 'financial';
interface PatientParsed { query: string; tab: PatientTab | undefined }

const TAB_WORDS: Array<[RegExp, PatientTab]> = [
  [/^(?:historia(?: clinica)?|history|clinical history|chart)$/, 'clinical'],
  [/^(?:cuenta|estado de cuenta|cuenta corriente|saldo|account|statement|balance)$/, 'financial'],
  [/^(?:ficha|datos|informacion|info|record|file|details|profile)$/, 'info'],
];
const tabOf = (word: string | undefined): PatientTab | undefined => (word ? TAB_WORDS.find(([re]) => re.test(word))?.[1] : undefined);
const OPEN = '(?:abri\\w*|abre|abrir|mostra\\w*|muestra\\w*|busca\\w*|buscar|trae\\w*|traeme|ver|quiero ver|open|show(?: me)?|find|look up|pull up|bring up|search for|get)';
const WHAT = '(historia(?: clinica)?|estado de cuenta|cuenta corriente|cuenta|saldo|ficha|datos|informacion|info|history|clinical history|chart|account|statement|balance|record|file|details|profile)';
const PATIENT_RE = [
  new RegExp(`^${OPEN}\\s+(?:(?:la|el|los|las|the)\\s+)?${WHAT}\\s+(?:(?:de|del|of|for)\\s+)(?:(?:la|el)\\s+)?(?:paciente\\s+|patient\\s+)?(.+)$`),
  new RegExp(`^${OPEN}\\s+(?:(?:a|al|el|la|the)\\s+)?(?:paciente|patient)\\s+(.+)$`),
  // «open John Smith's account» (el posesivo ya quedó como «john smith account»).
  new RegExp(`^${OPEN}\\s+(.+?)\\s+${WHAT}$`),
];

export function parseRailPatient(normalized: string): PatientParsed | null {
  if (/\b(?:cita|turno|appointment|presupuesto|factura|quote|invoice)\b/.test(normalized)) return null;
  for (const [i, re] of PATIENT_RE.entries()) {
    const m = normalized.match(re);
    if (!m) continue;
    const [what, query] = i === 0 ? [m[1], m[2]] : i === 1 ? [undefined, m[1]] : [m[2], m[1]];
    const q = query.replace(/^(?:(?:a|al|el|la|the)\s+)/, '').trim();
    if (!q || q.split(' ').length > 5 || /^(?:paciente|patient|el|la)$/.test(q)) continue;
    return { query: q, tab: tabOf(what) };
  }
  return null;
}

/** El nombre como se dijo (con mayúsculas y tildes), si está al final de la frase. */
function asSaid(raw: string, query: string): string {
  const tokens = raw.trim().split(/\s+/);
  const n = query.split(' ').length;
  const tail = tokens.slice(-n).join(' ').replace(/[.,;:!?¿¡]+$/g, '');
  return normalizeSpeech(tail) === query ? tail : query;
}

/** Busca al paciente; si hay varios pregunta cuál (con teléfono o documento para distinguir). */
async function pickPatient(ctx: VoiceCommandContext, query: string): Promise<VoicePatientResult | null> {
  ctx.show({ title: T(ctx, 'title'), message: T(ctx, 'searching', { name: query }), tone: 'info' });
  let found: VoicePatientResult[] = [];
  try {
    found = await searchPatientsForVoice(query, { signal: ctx.signal });
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    await say(ctx, ctx.t('VoiceCommands.genericError'), 'error');
    return null;
  }
  if (!found.length) {
    await say(ctx, T(ctx, 'patientNotFound', { name: query }), 'info');
    return null;
  }
  if (found.length === 1) return found[0];
  const question = T(ctx, 'whichPatient');
  const index = await ctx.choose(
    { title: T(ctx, 'title'), message: question, tone: 'info', choices: found.map((p) => ({ label: p.name, detail: p.document || p.phone || p.email || undefined })) },
    `${question} ${found.slice(0, 5).map((p, i) => `${i + 1}: ${p.name}`).join('. ')}.`,
  );
  return found[index];
}

registerVoiceCommand<PatientParsed>({
  id: 'core.rail_patient',
  domain: CORE_VOICE_DOMAIN,
  priority: 30,
  match: (normalized, raw) => { const p = onCalendar() ? null : parseRailPatient(normalized); return p ? { ...p, query: asSaid(raw, p.query) } : null; },
  run: async (parsed, ctx) => {
    if (!ctx.hasPermission(PATIENTS_PERMISSIONS.VIEW_LIST)) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
    const patient = await pickPatient(ctx, parsed.query);
    if (!patient) return;
    usePatientView.getState().open({ userId: patient.id, userName: patient.name, userEmail: patient.email || undefined, userPhone: patient.phone || undefined, initialTab: parsed.tab });
    await say(ctx, T(ctx, parsed.tab === 'financial' ? 'openedAccount' : parsed.tab === 'clinical' ? 'openedHistory' : 'openedPatient', { name: patient.name }));
  },
});

// ── Cobro rápido ──────────────────────────────────────────────────────────────

interface BillParsed { patient: string | null }
const BILL_RE = /^(?:(?:abri\w*|abre|abrir|hace\w*|haz|quiero(?: hacer)?|necesito(?: hacer)?|inicia\w*|empeza\w*|open|start|do|make|i want to|i need to)\s+)?(?:(?:el|un|una|the|a)\s+)?(?:cobro rapido|cobro|cobrar|quick bill|quick billing|quick charge|charge|bill)(?:\s+(?:a|al|para|de|to|for)\s+(.+))?$/;
const CHARGE_RE = /^(?:cobra(?:le|r)?|facturale|charge|bill)\s+(?:a\s+|al\s+)?(.+)$/;

export function parseRailBill(normalized: string): BillParsed | null {
  if (/\b(?:cita|turno|appointment|presupuesto|quote)\b/.test(normalized)) return null;
  const m = normalized.match(BILL_RE);
  if (m) return { patient: m[1]?.replace(/^(?:paciente|patient)\s+/, '').trim() || null };
  const c = normalized.match(CHARGE_RE);
  if (c && c[1].split(' ').length <= 5 && !/^(?:la|el|esta|this|the)\b/.test(c[1])) return { patient: c[1].replace(/^(?:paciente|patient)\s+/, '').trim() };
  return null;
}

registerVoiceCommand<BillParsed>({
  id: 'core.rail_bill',
  domain: CORE_VOICE_DOMAIN,
  priority: 32,
  match: (normalized, raw) => { const p = rail() && !onCalendar() ? parseRailBill(normalized) : null; return p ? { patient: p.patient && asSaid(raw, p.patient) } : null; },
  run: async (parsed, ctx) => {
    const r = rail();
    if (!r) return;
    if (!ctx.hasPermission(SALES_PERMISSIONS.INVOICES_CREATE)) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
    if (!parsed.patient) {
      r.openBilling({});
      await say(ctx, T(ctx, 'billOpened'));
      return;
    }
    const patient = await pickPatient(ctx, parsed.patient);
    if (!patient) return;
    r.openBilling({ patientId: patient.id, patientName: patient.name });
    await say(ctx, T(ctx, 'billOpenedFor', { name: patient.name }));
  },
});

// ── Sede de trabajo ───────────────────────────────────────────────────────────

type SedeParsed = { op: 'which' } | { op: 'list' } | { op: 'set'; name: string | null };
const SEDE = '(?:sede|sucursal|location|branch|site|clinic)';

export function parseRailSede(normalized: string): SedeParsed | null {
  if (new RegExp(`^(?:en )?(?:que|cual(?: es)?) ${SEDE}(?: estoy| es| de trabajo| estoy trabajando)?$|^(?:which|what) ${SEDE} am i (?:in|at|working (?:in|at))$|^(?:what is )?my (?:current )?${SEDE}$`).test(normalized)) return { op: 'which' };
  if (new RegExp(`^que ${SEDE}s? hay$|^(?:what|which) ${SEDE}s? are there$`).test(normalized)) return { op: 'list' };
  const m = normalized.match(new RegExp(`^(?:cambia\\w*|pasa\\w*|move\\w*|trabaja\\w*|quiero trabajar|switch|change|move|work)\\s+(?:(?:a|en|de|al|to|in|at|my)\\s+)?(?:(?:la|el|the)\\s+)?(?:${SEDE}(?: de trabajo)?)(?:\\s+(?:a|al|por|to)\\s+(?:(?:la|el|the)\\s+)?|\\s+)?(.*)$`));
  if (m) return { op: 'set', name: m[1].replace(/^(?:sede|sucursal)\s+/, '').trim() || null };
  return null;
}

registerVoiceCommand<SedeParsed>({
  id: 'core.rail_sede',
  domain: CORE_VOICE_DOMAIN,
  priority: 33,
  match: (normalized) => { const r = rail(); return r && r.sedes.length > 1 ? parseRailSede(normalized) : null; },
  run: async (parsed, ctx) => {
    const r = rail();
    if (!r) return;
    const current = r.sedes.find((s) => s.id === r.activeSedeId);
    if (parsed.op === 'which') { await say(ctx, current ? T(ctx, 'sedeCurrent', { name: current.name }) : T(ctx, 'sedeNone'), 'info'); return; }
    let target = parsed.op === 'set' && parsed.name
      ? r.sedes.find((s) => normalizeSpeech(s.name) === normalizeSpeech(parsed.name!)) ?? r.sedes.find((s) => normalizeSpeech(s.name).includes(normalizeSpeech(parsed.name!)))
      : undefined;
    if (!target) {
      const question = parsed.op === 'set' && parsed.name ? `${T(ctx, 'sedeNotFound', { name: parsed.name })} ${T(ctx, 'whichSede')}` : T(ctx, 'whichSede');
      const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: r.sedes.map((s) => ({ label: s.name })) }, `${question} ${r.sedes.map((s, i) => `${i + 1}: ${s.name}`).join('. ')}.`);
      target = r.sedes[index];
    }
    if (target.id === r.activeSedeId) { await say(ctx, T(ctx, 'sedeCurrent', { name: target.name }), 'info'); return; }
    await r.setSede(target.id);
    await say(ctx, T(ctx, 'sedeChanged', { name: target.name }));
  },
});

// ── Caja ──────────────────────────────────────────────────────────────────────

type CashParsed = { op: 'status' } | { op: 'open' } | { op: 'close' };
const CASH = '(?:la caja|caja|la sesion de caja|sesion de caja|el turno de caja|the cash register|cash register|the register|the till|till|the cash drawer|cash session|the cash session)';

export function parseRailCash(normalized: string): CashParsed | null {
  if (new RegExp(`^(?:esta abierta|esta cerrada|como esta|como va|cuanto hay en|cuanta plata hay en|que saldo tiene|saldo de|estado de)\\s+${CASH}$|^${CASH}\\s+(?:esta abierta|esta cerrada)$|^(?:is|how is|how much (?:money )?is in|what is in|balance of|status of)\\s+${CASH}(?:\\s+open)?$|^how much cash (?:do we have|is there)$|^cuanto hay en caja$`).test(normalized)) return { op: 'status' };
  if (new RegExp(`^(?:abri\\w*|abre|abrir|quiero abrir|open)\\s+${CASH}$`).test(normalized)) return { op: 'open' };
  if (new RegExp(`^(?:cerra\\w*|cierra|cerrar|quiero cerrar|hace\\w* el cierre de|close)\\s+${CASH}$|^(?:hace\\w*|haz) el cierre(?: de caja)?$`).test(normalized)) return { op: 'close' };
  return null;
}

registerVoiceCommand<CashParsed>({
  id: 'core.rail_cash',
  domain: CORE_VOICE_DOMAIN,
  priority: 34,
  match: (normalized) => (rail()?.cash ? parseRailCash(normalized) : null),
  run: async (parsed, ctx) => {
    const cash = rail()?.cash;
    if (!cash) return;
    const balances = cash.balances.map((b) => money(b.amount, b.currency, ctx.locale)).join(', ');
    if (parsed.op === 'status') {
      await say(ctx, cash.open ? T(ctx, 'cashOpen', { balances: balances || '0' }) : T(ctx, 'cashClosed'), 'info');
      return;
    }
    if (parsed.op === 'open' && cash.open) { await say(ctx, T(ctx, 'cashAlreadyOpen', { balances: balances || '0' }), 'info'); return; }
    if (parsed.op === 'close' && !cash.open) { await say(ctx, T(ctx, 'cashAlreadyClosed'), 'info'); return; }
    // Abrir y cerrar se hace en la pantalla de Caja (se cuenta el efectivo): se lleva ahí.
    ctx.navigate(parsed.op === 'close' ? '/cashier?view=active' : '/cashier');
    await say(ctx, T(ctx, parsed.op === 'close' ? 'cashGoClose' : 'cashGoOpen'));
  },
});

// ── Pantalla de la sala (TV) ──────────────────────────────────────────────────

type TvParsed = { op: 'status' } | { op: 'set'; status: 'on' | 'paused' | 'promo' | 'off' } | { op: 'screen' } | { op: 'next'; room: string | null };
const TV = '(?:la tele|la tv|la television|tv|tele|la pantalla(?: de la sala| de espera| de la sala de espera| tv)?|el televisor|the tv|tv|the television|the screen|the waiting room screen|the tv screen|tv display)';

export function parseRailTv(normalized: string): TvParsed | null {
  if (new RegExp(`^(?:prende\\w*|encende\\w*|enciende|activa\\w*|turn on|switch on|start)\\s+${TV}$|^${TV}\\s+on$|^turn ${TV} on$|^(?:reanuda\\w*|segui\\w*|continua\\w*|resume)\\s+(?:con\\s+)?${TV}$`).test(normalized)) return { op: 'set', status: 'on' };
  if (new RegExp(`^(?:pausa\\w*|pone\\w* en pausa|pause)\\s+${TV}$|^pone\\w* ${TV} en pausa$`).test(normalized)) return { op: 'set', status: 'paused' };
  if (new RegExp(`^(?:apaga\\w*|turn off|switch off|stop)\\s+${TV}$|^turn ${TV} off$`).test(normalized)) return { op: 'set', status: 'off' };
  if (new RegExp(`^(?:pone\\w*|mostra\\w*|pasa\\w*|show|play|put on)\\s+(?:la |las |el |the )?(?:promo|promos|promocion|promociones|publicidad|publicidades|anuncios|ads|promotions)(?:\\s+(?:en|on)\\s+${TV})?$`).test(normalized)) return { op: 'set', status: 'promo' };
  if (new RegExp(`^(?:abri\\w*|abre|mostra\\w*|open|show)\\s+${TV}$`).test(normalized)) return { op: 'screen' };
  if (new RegExp(`^(?:como esta|en que esta|que muestra)\\s+${TV}$|^(?:is|what is on|how is)\\s+${TV}(?:\\s+on)?$`).test(normalized)) return { op: 'status' };
  const next = normalized.match(/^(?:llama\w*|pasa\w*|anuncia\w*|call|announce)?\s*(?:a |al |the )?(?:siguiente|proximo|next)(?: paciente| patient| turno| one)?(?:\s+(?:en|del|de la|de|in|for|at)\s+(?:(?:el|la|the)\s+)?(.+))?$/);
  if (next && /\b(?:paciente|patient|llama|call|anuncia|announce)\b/.test(normalized)) return { op: 'next', room: next[1]?.trim() || null };
  return null;
}

registerVoiceCommand<TvParsed>({
  id: 'core.rail_tv',
  domain: CORE_VOICE_DOMAIN,
  priority: 35,
  match: (normalized) => (rail()?.tv ? parseRailTv(normalized) : null),
  run: async (parsed, ctx) => {
    const tv = rail()?.tv;
    if (!tv) return;
    if (parsed.op === 'status') { await say(ctx, T(ctx, `tvStatus_${tv.status}`), 'info'); return; }
    if (parsed.op === 'set') {
      if (tv.status === parsed.status) { await say(ctx, T(ctx, `tvStatus_${tv.status}`), 'info'); return; }
      tv.setStatus(parsed.status);
      await say(ctx, T(ctx, `tvSet_${parsed.status}`));
      return;
    }
    if (parsed.op === 'screen') { tv.openScreen(); await say(ctx, T(ctx, 'tvScreen')); return; }
    if (tv.status === 'off') { await say(ctx, T(ctx, 'tvOff'), 'info'); return; }
    const rooms = tv.rooms.filter((r) => r.hasNext);
    if (!rooms.length) { await say(ctx, T(ctx, 'tvNoNext'), 'info'); return; }
    let room = parsed.room ? rooms.find((r) => normalizeSpeech(r.name).includes(normalizeSpeech(parsed.room!))) : rooms.length === 1 ? rooms[0] : undefined;
    if (!room) {
      const question = T(ctx, 'tvWhichRoom');
      const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: rooms.map((r) => ({ label: r.name })) }, `${question} ${rooms.map((r, i) => `${i + 1}: ${r.name}`).join('. ')}.`);
      room = rooms[index];
    }
    tv.next(room.id);
    await say(ctx, T(ctx, 'tvNext', { room: room.name }));
  },
});

// ── Alertas, bandeja, tipo de cambio ──────────────────────────────────────────

type InfoParsed = { op: 'alerts' } | { op: 'inbox' } | { op: 'inbox_open' } | { op: 'exchange' };

export function parseRailInfo(normalized: string): InfoParsed | null {
  if (/^(?:(?:tengo|hay|tenemos)\s+(?:alguna\s+)?alertas?(?:\s+(?:nuevas|pendientes))?|cuantas alertas (?:hay|tengo|tenemos)(?: pendientes)?|(?:do i|do we) have (?:any )?alerts|any (?:new )?alerts|how many alerts(?: are there| do i have)?)$/.test(normalized)) return { op: 'alerts' };
  if (/^(?:(?:tengo|hay)\s+(?:alguna\s+)?(?:notificacion(?:es)?|mensajes?)(?:\s+(?:nuevas?|nuevos))?|cuantas notificaciones (?:hay|tengo)|cuantos mensajes (?:hay|tengo)|(?:do i|do we) have (?:any )?(?:notifications|messages)|any (?:new )?(?:notifications|messages)|how many notifications(?: do i have)?)$/.test(normalized)) return { op: 'inbox' };
  if (/^(?:abri\w*|abre|mostra\w*|muestra\w*|ver|open|show(?: me)?|check)\s+(?:(?:la|las|los|el|my|the)\s+)?(?:notificaciones|bandeja(?: de entrada)?|mensajes|notifications|inbox|messages)$/.test(normalized)) return { op: 'inbox_open' };
  if (/^(?:(?:a )?cuanto esta el (?:dolar|euro|real)|(?:cual es el |que )?tipo de cambio(?: hay| tenemos| de hoy)?|(?:la )?cotizacion(?: del (?:dolar|dia))?(?: de hoy)?|(?:what is the |whats the )?exchange rate(?: today)?|what is the dollar at|how much is the dollar)$/.test(normalized)) return { op: 'exchange' };
  return null;
}

registerVoiceCommand<InfoParsed>({
  id: 'core.rail_info',
  domain: CORE_VOICE_DOMAIN,
  priority: 36,
  match: (normalized) => (rail() ? parseRailInfo(normalized) : null),
  run: async (parsed, ctx) => {
    const r = rail();
    if (!r) return;
    if (parsed.op === 'alerts') {
      await say(ctx, r.alerts.count ? T(ctx, 'alertsCount', { count: r.alerts.count, priority: T(ctx, `priority_${r.alerts.highest}`) }) : T(ctx, 'alertsNone'), 'info');
      return;
    }
    if (parsed.op === 'inbox') { await say(ctx, r.inbox.count ? T(ctx, 'inboxCount', { count: r.inbox.count }) : T(ctx, 'inboxNone'), 'info'); return; }
    if (parsed.op === 'inbox_open') { r.inbox.open(); await say(ctx, T(ctx, 'inboxOpened')); return; }
    await say(ctx, r.exchange ? T(ctx, 'exchange', { code: r.exchange.code, rate: r.exchange.rate.toFixed(2) }) : T(ctx, 'exchangeNone'), 'info');
  },
});

// ── Notas ─────────────────────────────────────────────────────────────────────

type NotesParsed = { op: 'open' } | { op: 'create'; text: string | null };

export function parseRailNotes(normalized: string, raw: string): NotesParsed | null {
  if (/\b(?:cita|turno|appointment|paciente|patient)\b/.test(normalized)) return null;
  if (/^(?:abri\w*|abre|mostra\w*|muestra\w*|ver|open|show(?: me)?)\s+(?:(?:las|mis|the|my)\s+)?(?:notas|notitas|post its?|notes|sticky notes)$/.test(normalized)) return { op: 'open' };
  const m = normalized.match(/^(?:(?:nueva|una|otra)\s+nota|(?:agrega\w*|crea\w*|hace\w*|anota\w*|deja\w*|escribi\w*|add|create|make|take|write|leave)\s+(?:(?:una|un|otra|a|another)\s+)?(?:nota|notita|note|sticky note)|anota\w*|take a note|note)(?:\s+(?:que diga|diciendo|que|saying|that says|that))?(?:\s*:?\s*(.*))?$/);
  if (!m) return null;
  // El texto como se dijo (mayúsculas, números): lo que sigue a «nota», «:» o «que diga».
  const cut = raw.match(/(?:nota|notita|note|anot[aá]\w*)\s*(?:que diga|diciendo|que|saying|that says|that)?\s*:?\s*(.*)$/i);
  const text = (cut?.[1] ?? m[1] ?? '').trim();
  return { op: 'create', text: text || null };
}

registerVoiceCommand<NotesParsed>({
  id: 'core.rail_notes',
  domain: CORE_VOICE_DOMAIN,
  priority: 38,
  match: (normalized, raw) => (rail()?.notes && !onCalendar() ? parseRailNotes(normalized, raw) : null),
  run: async (parsed, ctx) => {
    const notes = rail()?.notes;
    if (!notes) return;
    if (parsed.op === 'open') { notes.open(); await say(ctx, T(ctx, 'notesOpened')); return; }
    let text = parsed.text;
    if (!text) {
      const question = T(ctx, 'noteWhat');
      text = (await ctx.ask({ title: T(ctx, 'title'), message: question, tone: 'info' }, question)).trim();
    }
    if (!text) return;
    const ok = await notes.create(text);
    await say(ctx, ok ? T(ctx, 'noteCreated', { text }) : ctx.t('VoiceCommands.genericError'), ok ? 'success' : 'error');
  },
});

// ── Asistente y el panel ──────────────────────────────────────────────────────

type PanelParsed = { op: 'assistant' } | { op: 'panel'; open: boolean };

export function parseRailPanel(normalized: string): PanelParsed | null {
  if (/^(?:desperta\w*|abri\w*|abre|llama\w*|mostra\w*|necesito|quiero|wake(?: up)?|open|call|show(?: me)?|i need)\s+(?:(?:al|el|a la|la|the|my)\s+)?(?:asistente|ayudante|mascota|assistant|helper|mascot)(?:\s+up)?$/.test(normalized)) return { op: 'assistant' };
  const RIGHT = '(?:(?:el |la )?(?:panel|barra|riel)(?: lateral)? (?:derech[oa]|de la derecha|de herramientas)|(?:the )?right (?:panel|sidebar|rail|bar)|(?:the )?(?:widgets?|tool) (?:panel|bar))';
  if (new RegExp(`^(?:escond\\w*|oculta\\w*|cerra\\w*|cierra|saca\\w*|plega\\w*|achica\\w*|hide|close|collapse)\\s+${RIGHT}$`).test(normalized)) return { op: 'panel', open: false };
  if (new RegExp(`^(?:mostra\\w*|muestra\\w*|abri\\w*|abre|despliega\\w*|expandi\\w*|show|open|expand)\\s+${RIGHT}$`).test(normalized)) return { op: 'panel', open: true };
  return null;
}

registerVoiceCommand<PanelParsed>({
  id: 'core.rail_panel',
  domain: CORE_VOICE_DOMAIN,
  priority: 37,
  match: (normalized) => (rail() ? parseRailPanel(normalized) : null),
  run: async (parsed, ctx) => {
    const r = rail();
    if (!r) return;
    if (parsed.op === 'panel') {
      r.setExpanded(parsed.open);
      await say(ctx, T(ctx, parsed.open ? 'panelShown' : 'panelHidden'));
      return;
    }
    // El botón está en el riel: si estaba escondido se muestra primero.
    if (!r.expanded) { r.setExpanded(true); await new Promise((res) => setTimeout(res, 200)); }
    const launcher = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-help-id="rail.section.assistant"]') : null;
    if (!launcher) { await say(ctx, T(ctx, 'assistantUnavailable'), 'info'); return; }
    launcher.click();
    await say(ctx, T(ctx, 'assistantOpened'));
  },
});
