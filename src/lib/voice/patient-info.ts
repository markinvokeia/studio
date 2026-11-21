import { format, isValid, parseISO } from 'date-fns';
import { enUS, es } from 'date-fns/locale';

import type { PatientFacts, PatientFactsNeed } from '@/services/patient-facts';

/**
 * Preguntas por voz sobre un paciente que se contestan con sus registros (no con una cita): cuántas
 * veces vino, canceló o faltó, cuándo fue la última falta o visita, si debe, el último pago, en
 * qué están los presupuestos y facturas, los tratamientos en curso, o un resumen de todo. Sirve en
 * cualquier pantalla: el que llama consigue el paciente y los datos (loadPatientFacts).
 */

export type PatientInfoTopic =
  | 'summary' | 'visits' | 'cancellations' | 'no_shows' | 'last_no_show' | 'last_visit'
  | 'debt' | 'last_payment' | 'payments' | 'quotes' | 'invoices' | 'treatments';

export const PATIENT_INFO_TOPICS: PatientInfoTopic[] = ['summary', 'visits', 'cancellations', 'no_shows', 'last_no_show', 'last_visit', 'debt', 'last_payment', 'payments', 'quotes', 'invoices', 'treatments'];

const TOPIC_NEEDS: Record<PatientInfoTopic, PatientFactsNeed[]> = {
  summary: ['appointments', 'financial', 'ledger', 'treatments'],
  visits: ['appointments'],
  cancellations: ['appointments'],
  no_shows: ['appointments'],
  last_no_show: ['appointments'],
  last_visit: ['appointments'],
  debt: ['financial'],
  last_payment: ['ledger'],
  payments: ['ledger', 'financial'],
  quotes: ['ledger'],
  invoices: ['ledger'],
  treatments: ['treatments'],
};

export function needsFor(topics: PatientInfoTopic[]): PatientFactsNeed[] {
  return [...new Set(topics.flatMap((t) => TOPIC_NEEDS[t]))];
}

// ── Entender la pregunta ──────────────────────────────────────────────────────

/** El orden importa: lo más específico antes («última vez que faltó» antes que «faltó»). */
const TOPIC_PATTERNS: Array<[RegExp, PatientInfoTopic]> = [
  [/\b(?:ultima vez que (?:falto|no vino|no asistio|no se presento)|cuando (?:fue que )?(?:falto|no vino) por ultima vez|ultima falta|ultima inasistencia|last (?:no show|time (?:he|she|they|the patient)? ?(?:missed|didn t show|did not show)))\b/, 'last_no_show'],
  [/\b(?:cuantas (?:veces|citas) (?:falto|no vino|no ha venido|no asistio|falt)|cuantas faltas|cuantas inasistencias|cuantas veces (?:no )?(?:se presento|falto)|(?:faltas|inasistencias|ausencias)|how many (?:no shows|times\b(?=.*\b(?:missed|not shown|didn t|did not|no show|show up)\b))|no shows)\b/, 'no_shows'],
  [/\b(?:cuantas (?:veces|citas) (?:cancelo|ha cancelado|cancelaron|se cancel)|cuantas (?:citas )?cancelad|cancelaciones|(?:citas )?canceladas|how many (?:times\b(?=.*\bcancel)|cancellations|cancelled appointments)|cancellations)\b/, 'cancellations'],
  [/\b(?:cuantas veces (?:vino|ha venido|asistio|se atendio|estuvo|lo atendimos|la atendimos)|cuantas (?:visitas|consultas|citas (?:tuvo|tiene|ha tenido))|how many (?:times\b(?=.*\b(?:come|came|visit|visited|been|attended)\b)|visits|appointments (?:has|did|does))|how often\b(?=.*\b(?:come|came|visit|visited|been)\b))\b/, 'visits'],
  [/\b(?:ultima (?:visita|consulta|cita)|ultima vez que (?:vino|estuvo|lo vimos|la vimos)|cuando (?:vino|estuvo) por ultima vez|last (?:visit|appointment)|when (?:was|did) (?:he|she|they|the patient)? ?(?:last|come last))\b/, 'last_visit'],
  [/\b(?:ultimo pago|ultima vez que pago|cuando (?:pago|fue (?:el|su) ultimo pago)|last payment|when did\b(?=.*\bpay\b))\b/, 'last_payment'],
  [/\b(?:cuanto (?:ha )?pagado|cuanto pago|pagos|total pagado|how much\b(?=.*\bpaid\b)|payments)\b/, 'payments'],
  [/\b(?:cuanto debe|debe algo|tiene deudas?|deuda|deudas|saldo|adeuda|esta al dia|pendiente de pag\w*|algo (?:pendiente|para pagar)|owes?|debt|balance|outstanding)\b/, 'debt'],
  [/\b(?:presupuestos?|quotes?|estimates?)\b/, 'quotes'],
  [/\b(?:facturas?|invoices?)\b/, 'invoices'],
  [/\b(?:tratamientos?(?: en curso| activos?| pendientes?)?|como (?:va|viene) (?:el|su) tratamiento|plan de tratamiento|treatments?(?: in progress)?|treatment plans?)\b/, 'treatments'],
  [/\b(?:resumen|resumi\w*|resume\w*|summary|summarize|estadisticas?|statistics|stats|que sabemos de|informacion (?:del|de la|de) (?:paciente|el|la)|info (?:about|on)|what do (?:we|you) know about|tell me about|everything about)\b/, 'summary'],
];

/** Que suene a pregunta o pedido de información (no a una orden sobre la cita). */
const ASKING = /^(?:(?:y |che |dime |decime |contame |sabes |me (?:decis|dices) )?(?:en que|cuant[oa]s?|cual|cuales|cuando|que|como|tiene|debe|esta|hay|dame|decime|dime|contame|mostrame|muestrame|quiero saber|necesito saber|resumi\w*|resume\w*|resumen|estadisticas?|how|what|when|which|does|is|has|did|give me|tell me|show me|summarize|summary|stats|statistics))\b/;

const FILLER = new Set([
  'cuantas', 'cuantos', 'cuanto', 'cuanta', 'veces', 'vez', 'que', 'el', 'la', 'los', 'las', 'ha', 'han', 'tiene', 'tuvo', 'de', 'del', 'paciente',
  'su', 'sus', 'y', 'o', 'a', 'al', 'en', 'es', 'esta', 'este', 'esa', 'ese', 'me', 'decime', 'dime', 'dame', 'contame', 'mostrame', 'muestrame', 'un', 'una',
  'por', 'para', 'con', 'sobre', 'cual', 'cuales', 'cuando', 'fue', 'hay', 'algo', 'quiero', 'saber', 'necesito', 'si', 'no', 'lo', 'le', 'se', 'como',
  'how', 'many', 'much', 'times', 'has', 'have', 'did', 'does', 'the', 'patient', 'is', 'was', 'he', 'she', 'they', 'his', 'her', 'their', 'what', 'when',
  'which', 'about', 'on', 'of', 'for', 'give', 'me', 'tell', 'show', 'any', 'and', 'or', 'a', 'an', 'this', 'that', 'there', 'are', 'in', 'to', 'so', 'far',
  'info', 'informacion', 'datos', 'ultima', 'ultimo', 'last', 'en', 'curso', 'pendientes', 'activos', 'pendiente', 'hizo', 'hace', 'please', 'favor',
  'ahora', 'hoy', 'total', 'estado', 'status', 'state', 'pagar', 'pago', 'pagado', 'plata', 'dinero', 'anything', 'something', 'progress', 'estan', 'esta',
  'come', 'came', 'visited', 'been', 'owe', 'owes', 'money', 'todo', 'everything', 'right', 'now', 'sus', 'mis', 'do', 'does', 'have', 'had', 'stats', 'statistics',
  'las', 'los', 'pay', 'paid', 'know', 'we', 'you', 'everything', 'often', 'visit', 'missed', 'cancel', 'cancelled', 'canceled', 'show', 'shown', 'didn', 'not', 'attended', 'estadisticas', 'estadistica', 'resumen', 'summary', 'up', 'with', 'veces', 'times', 'him', 'them', 'it', 'yet', 'ya', 'cuantas', 'many',
]);

export interface PatientInfoParsed {
  topics: PatientInfoTopic[];
  /** Nombre dicho del paciente (normalizado); null = el de la cita en foco. */
  patient: string | null;
}

/** «¿cuántas veces faltó Ana Gómez?», «¿tiene deudas?», «resumen de Juan Pérez», «how many visits». */
export function parsePatientInfo(normalized: string): PatientInfoParsed | null {
  // Preferencias de la agenda («título: hora, paciente y tratamiento»), no una pregunta del paciente.
  if (/\b(?:titulo|formato|etiqueta|label|title|slots?|vista|view|zoom|configuracion|settings)\b/.test(normalized)) return null;
  const text = ` ${normalized} `;
  const topics: PatientInfoTopic[] = [];
  let rest = text;
  for (const [re, topic] of TOPIC_PATTERNS) {
    const global = new RegExp(re.source, 'g');
    if (!global.test(rest)) continue;
    if (topic === 'payments' && topics.includes('last_payment')) continue;
    if (topic === 'cancellations' && /\bcancela(?:la|le|lo|r)?\b/.test(normalized) && !/\bcuant|\bhow many|\bcancelaciones|\bcanceladas/.test(normalized)) continue;
    if (!topics.includes(topic)) topics.push(topic);
    rest = rest.replace(new RegExp(re.source, 'g'), ' ');
  }
  if (!topics.length) return null;
  // Una orden sobre la cita o el formulario («poné la factura…», «agregá el tratamiento…») no es una pregunta.
  if (/^(?:pone\w*|pon|agrega\w*|saca\w*|quita\w*|cambia\w*|edita\w*|borra\w*|elimina\w*|crea\w*|hace\w*|haz|nuev[oa]|factura\w*|cobra\w*|registra\w*|abri\w*|abre\w*|add|remove|change|edit|delete|create|make|new|open)\b/.test(normalized) && !ASKING.test(normalized)) return null;
  const words = rest.split(' ').filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
  const patient = words.length && words.join(' ').length >= 3 ? words.slice(0, 4).join(' ') : null;
  return { topics: topics.includes('summary') && topics.length > 1 ? topics.filter((t) => t !== 'summary') : topics, patient };
}

// ── Acciones del paciente ─────────────────────────────────────────────────────

export type PatientActionKind = 'quote' | 'invoice' | 'treatment' | 'session' | 'bill';

const ACTION_VERB = '(?:put together|prepare|draft|draw up|prepara\\w*|crea\\w*|crear|hace\\w*|hacer|haz|arma\\w*|genera\\w*|abri\\w*|abre\\w*|registra\\w*|carga\\w*|anota\\w*|empeza\\w*|inicia\\w*|vamos a (?:crear|hacer|registrar|cargar)|quiero (?:crear|hacer|registrar)|create|make|new|add|open|start|record|log|register|issue)';
const NEW_THING = (things: string) => new RegExp(`^(?:(?:un |una |a |an )?(?:nuevo|nueva|new|otro|otra|another)\\s(?:${things}))\\b`);
const ACTIONS: Array<[RegExp, PatientActionKind]> = [
  [NEW_THING('presupuesto|quote|estimate'), 'quote'],
  [NEW_THING('factura|invoice'), 'invoice'],
  [NEW_THING('tratamiento|treatment'), 'treatment'],
  [NEW_THING('sesion(?: clinica)?|evolucion|clinical session|session'), 'session'],
  [new RegExp(`^(?:${ACTION_VERB}\\s(?:un |una |el |la |a |an |the )?(?:nuevo |nueva |new )?(?:presupuesto|quote|estimate)|(?:nuevo )?presupuesto (?:para|de)|presupuestale|new quote)\\b`), 'quote'],
  [new RegExp(`^(?:${ACTION_VERB}\\s(?:un |una |el |la |a |an |the )?(?:nuevo |nueva |new )?(?:factura|invoice)|factura(?:le|la|r)? (?:a|para)|nueva factura|invoice(?: for| to)?)\\b`), 'invoice'],
  [new RegExp(`^(?:${ACTION_VERB}\\s(?:un |una |el |la |a |an |the )?(?:nuevo |nueva |new )?(?:tratamiento|treatment)|nuevo tratamiento|new treatment)\\b`), 'treatment'],
  [new RegExp(`^(?:${ACTION_VERB}\\s(?:un |una |la |el |a |an |the )?(?:nueva |new )?(?:sesion(?: clinica)?|evolucion|clinical session|session|clinical note)|nueva sesion|new (?:clinical )?session)\\b`), 'session'],
  [/^(?:(?:hace\w*|hacer|haz|abri\w*|open|start|do)\s(?:un |el |a |the )?cobro(?: rapido)?|cobro rapido|cobra(?:le|r)?|quick (?:bill|charge|payment)|charge)\b/, 'bill'],
];

export interface PatientActionParsed {
  action: PatientActionKind;
  patient: string | null;
}

/** «creá un presupuesto para Ana Gómez», «nueva factura», «registrá la sesión clínica», «cobrale». */
export function parsePatientAction(normalized: string): PatientActionParsed | null {
  // Orden inglés con el paciente en el medio: «record Juan Pérez clinical session».
  const named = normalized.match(/^(?:record|start|open|log|register|begin)\s(.+?)\s(?:clinical session|session|clinical note)$/);
  if (named) {
    const who = named[1].replace(/^(?:the|a|an|my|this|his|her)(?:\s|$)/, '').trim();
    return { action: 'session', patient: who.length >= 3 ? who : null };
  }
  for (const [re, action] of ACTIONS) {
    const found = normalized.match(re);
    if (!found) continue;
    const rest = normalized.slice(found[0].length).replace(/^\s*(?:para|a|al|de|del|for|to|of)\s/, ' ');
    const words = rest.split(' ').filter((w) => w && !FILLER.has(w));
    return { action, patient: words.length && words.join(' ').length >= 3 ? words.slice(0, 4).join(' ') : null };
  }
  return null;
}

// ── Contestar ─────────────────────────────────────────────────────────────────

type T = (key: string, values?: Record<string, string | number>) => string;

const ATTENDED = new Set(['completed', 'attended_late', 'arrived', 'arrived_late', 'in_progress']);

function dateText(locale: string, iso: string): string {
  const d = parseISO(iso);
  if (!isValid(d)) return iso;
  return locale.startsWith('en') ? format(d, 'MMMM d, yyyy', { locale: enUS }) : format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function moneyText(locale: string, amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale.startsWith('en') ? 'en-US' : 'es-UY', { style: 'currency', currency: currency || 'UYU', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`.trim();
  }
}

export interface PatientInfoAnswer {
  /** Una línea por tema (para la tarjeta). */
  rows: Array<{ label: string; value: string }>;
  /** Lo que se dice. */
  speech: string;
}

/** La respuesta a los temas pedidos con lo que se sabe del paciente. */
export function answerPatientInfo(topics: PatientInfoTopic[], facts: PatientFacts, t: T, locale: string, now = new Date()): PatientInfoAnswer {
  const k = (key: string, values?: Record<string, string | number>) => t(`VoiceCommands.patientInfo.${key}`, values);
  const list = topics.includes('summary') ? (['visits', 'no_shows', 'cancellations', 'debt', 'last_payment', 'quotes', 'treatments'] as PatientInfoTopic[]) : topics;
  const rows: PatientInfoAnswer['rows'] = [];
  const said: string[] = [];
  const add = (label: string, value: string, speech: string) => { rows.push({ label, value }); said.push(speech); };
  const appts = facts.appointments;
  const nowKey = format(now, "yyyy-MM-dd'T'HH:mm");
  const past = (appts ?? []).filter((a) => a.start <= nowKey);
  const sortDesc = <X extends { start: string }>(xs: X[]) => [...xs].sort((a, b) => b.start.localeCompare(a.start));

  for (const topic of list) {
    switch (topic) {
      case 'visits': {
        if (!appts) { add(k('visitsLabel'), '—', k('unavailable')); break; }
        const n = past.filter((a) => ATTENDED.has(a.status)).length;
        add(k('visitsLabel'), String(n), k('visits', { count: n }));
        break;
      }
      case 'cancellations': {
        if (!appts) { add(k('cancellationsLabel'), '—', k('unavailable')); break; }
        const cancelled = appts.filter((a) => a.status === 'cancelled');
        const late = cancelled.filter((a) => a.cancellationReason === 'late' || a.cancellationReason === 'no_notice').length;
        add(k('cancellationsLabel'), String(cancelled.length), cancelled.length ? k('cancellations', { count: cancelled.length, late }) : k('noCancellations'));
        break;
      }
      case 'no_shows':
      case 'last_no_show': {
        if (!appts) { add(k('noShowsLabel'), '—', k('unavailable')); break; }
        const missed = sortDesc(appts.filter((a) => a.status === 'no_show'));
        if (!missed.length) { add(k('noShowsLabel'), '0', k('noNoShows')); break; }
        const last = dateText(locale, missed[0].start.slice(0, 10));
        add(k('noShowsLabel'), `${missed.length} · ${last}`, topic === 'last_no_show' ? k('lastNoShow', { date: last }) : k('noShows', { count: missed.length, date: last }));
        break;
      }
      case 'last_visit': {
        if (!appts) { add(k('lastVisitLabel'), '—', k('unavailable')); break; }
        const last = sortDesc(past.filter((a) => ATTENDED.has(a.status)))[0];
        add(k('lastVisitLabel'), last ? dateText(locale, last.start.slice(0, 10)) : '—', last ? k('lastVisit', { date: dateText(locale, last.start.slice(0, 10)) }) : k('noVisits'));
        break;
      }
      case 'debt': {
        if (!facts.financial) { add(k('debtLabel'), '—', k('unavailable')); break; }
        const debts = facts.financial.filter((f) => f.debt > 0.005);
        const text = debts.map((f) => moneyText(locale, f.debt, f.currency)).join(' + ');
        add(k('debtLabel'), debts.length ? text : '0', debts.length ? k('debt', { amount: text }) : k('noDebt'));
        break;
      }
      case 'last_payment':
      case 'payments': {
        if (!facts.payments) { add(k('lastPaymentLabel'), '—', k('unavailable')); break; }
        const sorted = [...facts.payments].sort((a, b) => b.date.localeCompare(a.date));
        if (!sorted.length) { add(k('lastPaymentLabel'), '—', k('noPayments')); break; }
        const last = sorted[0];
        const value = `${moneyText(locale, last.amount, last.currency)} · ${dateText(locale, last.date.slice(0, 10))}`;
        add(k('lastPaymentLabel'), value, k('lastPayment', { amount: moneyText(locale, last.amount, last.currency), date: dateText(locale, last.date.slice(0, 10)), method: last.method || '—' }));
        if (topic === 'payments' && facts.financial?.length) {
          const paid = facts.financial.filter((f) => f.paid > 0).map((f) => moneyText(locale, f.paid, f.currency)).join(' + ');
          if (paid) add(k('paidLabel'), paid, k('paid', { amount: paid }));
        }
        break;
      }
      case 'quotes': {
        if (!facts.quotes) { add(k('quotesLabel'), '—', k('unavailable')); break; }
        const quotes = facts.quotes;
        if (!quotes.length) { add(k('quotesLabel'), '0', k('noQuotes')); break; }
        const pendingBilling = quotes.filter((q) => q.billingStatus !== 'fully_invoiced' && q.billingStatus !== 'invoiced' && q.status !== 'rejected').length;
        const accepted = quotes.filter((q) => q.status === 'accepted' || q.status === 'confirmed').length;
        add(k('quotesLabel'), `${quotes.length} · ${k('quotesPendingShort', { count: pendingBilling })}`, k('quotes', { count: quotes.length, accepted, pending: pendingBilling }));
        break;
      }
      case 'invoices': {
        if (!facts.invoices) { add(k('invoicesLabel'), '—', k('unavailable')); break; }
        const unpaid = facts.invoices.filter((i) => i.paymentStatus !== 'paid');
        add(k('invoicesLabel'), `${facts.invoices.length} · ${k('unpaidShort', { count: unpaid.length })}`, facts.invoices.length ? k('invoices', { count: facts.invoices.length, unpaid: unpaid.length }) : k('noInvoices'));
        break;
      }
      case 'treatments': {
        if (!facts.treatments) { add(k('treatmentsLabel'), '—', k('unavailable')); break; }
        const active = facts.treatments.filter((tr) => tr.status === 'active' || tr.status === 'paused');
        if (!active.length) { add(k('treatmentsLabel'), '0', k('noTreatments')); break; }
        const parts = active.slice(0, 3).map((tr) => k('treatmentItem', { name: tr.name, done: tr.done, total: tr.total }));
        add(k('treatmentsLabel'), parts.join('; '), k('treatments', { count: active.length, list: parts.join('; ') }));
        break;
      }
      default:
        break;
    }
  }
  return { rows, speech: `${facts.patientName}: ${said.join(' ')}` };
}
