import { addDays, format, nextDay, setHours, setMinutes, startOfToday } from 'date-fns';

import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';
import { spokenTime } from '@/lib/voice/commands/workspace';

import type { AlertsVoiceBridge, VoiceCommandContext } from '@/lib/types';

/**
 * El Centro de alertas por voz (src/app/[locale]/alerts/page.tsx): leer («¿qué alertas críticas
 * hay?», «leé las alertas»), filtrar (pendientes, completadas, ignoradas, por prioridad),
 * seleccionar, y actuar sobre una, varias o todas: completar, ignorar (con motivo), posponer
 * («hasta mañana», «una semana», «el lunes»), registrar una llamada, agregar una nota, mandar mail
 * o WhatsApp, abrir el paciente. Lo que cambia o manda algo se confirma antes.
 */

export const ALERTS_VOICE_DOMAIN = 'alerts';
registerVoiceDomain({ id: ALERTS_VOICE_DOMAIN, notUnderstoodKey: 'VoiceCommands.alerts.notUnderstood' });

const page = () => getVoiceBridge<AlertsVoiceBridge>('alerts');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.alerts.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}

type Alert = AlertsVoiceBridge['alerts'][number];
type Priority = Alert['priority'];
const PRIORITY: Array<[RegExp, Priority]> = [
  [/\b(?:criticas?|critical|urgentes?|urgent)\b/, 'CRITICAL'], [/\b(?:altas?|high)\b/, 'HIGH'], [/\b(?:medias?|medium)\b/, 'MEDIUM'], [/\b(?:bajas?|low)\b/, 'LOW'],
];
const priorityIn = (t: string) => PRIORITY.find(([re]) => re.test(t))?.[1] ?? null;

// ── A qué alertas se refiere ──────────────────────────────────────────────────

type Target =
  | { by: 'all' }
  | { by: 'selected' }
  | { by: 'position'; text: string }
  | { by: 'priority'; priority: Priority }
  | { by: 'text'; text: string; plural: boolean }
  | { by: 'implicit' };

export function parseTarget(text: string): Target {
  const t = text.trim();
  if (!t) return { by: 'implicit' };
  if (/^(?:(?:a )?todas(?: las alertas)?(?: pendientes)?|all(?: of them| the alerts)?|everything)$/.test(t)) return { by: 'all' };
  if (/^(?:(?:las |a las )?seleccionadas|(?:las |a las )?marcadas|(?:the )?selected(?: ones)?|(?:lo|las) que (?:marque|seleccione))$/.test(t)) return { by: 'selected' };
  const named = t.replace(/^(?:(?:a )?(?:la|las|el|los|the)\s+)?(?:alertas?\s+|alerts?\s+)?(?:de|del|sobre|para|of|for|about)\s+(?:la |el |the )?/, '');
  const pos = named.match(/^(?:(?:a )?(?:la|el|the)\s+)?(primer[ao]?|segund[ao]|tercer[ao]?|cuart[ao]|quint[ao]|ultim[ao]|penultim[ao]|first|second|third|fourth|fifth|last)(?:\s+(?:alerta|alert|one))?$/);
  if (pos) return { by: 'position', text: pos[1] };
  const prio = priorityIn(t);
  if (prio && /^(?:(?:a )?(?:las|the)\s+)?(?:alertas?\s+)?(?:criticas?|altas?|medias?|bajas?|critical|high|medium|low|urgentes?|urgent)(?:\s+(?:alerts|ones|priority|prioridad))?$/.test(t)) return { by: 'priority', priority: prio };
  // «las de cumpleaños», «the birthday ones»: varias a la vez.
  const plural = /^(?:a )?(?:las|los)\b/.test(t) || /\bones$/.test(t);
  return { by: 'text', text: named.replace(/\s+ones$/, ''), plural };
}

/** Las alertas que nombra el blanco. «la de Juan», «las de cumpleaños», «la del laboratorio 45». */
function resolveTarget(target: Target, p: AlertsVoiceBridge): Alert[] {
  const list = p.alerts;
  switch (target.by) {
    case 'all': return list;
    case 'selected': return list.filter((a) => p.selected.includes(a.id));
    case 'implicit': return p.selected.length ? list.filter((a) => p.selected.includes(a.id)) : list.length === 1 ? list : [];
    case 'position': { const i = parseChoice(target.text, list.length); return i === null ? [] : [list[i]]; }
    case 'priority': return list.filter((a) => a.priority === target.priority);
    case 'text': {
      const words = normalizeSpeech(target.text).split(' ').filter((w) => w.length > 2).map((w) => w.replace(/(?:es|s)$/, ''));
      if (!words.length) return [];
      const hay = (a: Alert) => normalizeSpeech(`${a.patient} ${a.title} ${a.category} ${a.summary}`);
      return list.filter((a) => words.every((w) => hay(a).includes(w)));
    }
  }
}

async function pickAlerts(ctx: VoiceCommandContext, target: Target, p: AlertsVoiceBridge, allowMany: boolean): Promise<Alert[] | null> {
  const found = resolveTarget(target, p);
  if (!found.length) {
    await say(ctx, target.by === 'implicit' ? T(ctx, 'whichFirst') : T(ctx, 'notFound'), 'info');
    return null;
  }
  // Una sola acción por persona («la de Juan»): si hay varias iguales, pregunta; «todas», «las críticas» van todas.
  if (found.length > 1 && ((target.by === 'text' && !(target.plural && allowMany)) || target.by === 'implicit') && !(target.by === 'implicit' && allowMany)) {
    const question = T(ctx, 'which');
    const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: found.slice(0, 8).map((a) => ({ label: a.title, detail: a.patient || a.category })) }, `${question} ${found.slice(0, 5).map((a, i) => `${i + 1}: ${a.title}${a.patient ? `, ${a.patient}` : ''}`).join('. ')}.`);
    return [found[index]];
  }
  return found;
}

// ── Leer y filtrar ────────────────────────────────────────────────────────────

type ReadParsed = { op: 'read'; priority: Priority | null } | { op: 'status'; status: Parameters<AlertsVoiceBridge['setStatusFilter']>[0] } | { op: 'priority'; priority: Priority | '' } | { op: 'refresh' };

export function parseAlertsRead(normalized: string): ReadParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload)(?: las alertas| the alerts)?$/.test(t)) return { op: 'refresh' };
  if (/^(?:(?:decime|deci\w*|dime|tell me)\s+)?(?:(?:cuantas|que|cuales)\s+(?:alertas\s+)?(?:hay|tengo|tenemos|quedan)|(?:lee\w*|decime|deci\w*|leeme)\s+(?:las\s+)?alertas|(?:how many|what|which)\s+alerts?\s+(?:are there|do i have|do we have)|read (?:me )?(?:the )?alerts)(?:\s+(?:criticas?|altas?|medias?|bajas?|urgentes?|critical|high|medium|low|pendientes|pending))?$|^(?:que|cuantas)\s+alertas\s+(?:criticas?|altas?|medias?|bajas?|urgentes?)\s+(?:hay|tengo|quedan)$|^(?:what|how many)\s+(?:critical|high|medium|low)\s+alerts?(?: are there| do i have)?$/.test(t)) {
    return { op: 'read', priority: priorityIn(t) };
  }
  const show = t.match(/^(?:(?:mostra\w*|muestra\w*|ver|ve|filtra\w*|dejame ver|show(?: me)?|filter(?: by)?|view)\s+)?(?:(?:solo|solamente|only)\s+)?(?:las\s+|the\s+)?(?:alertas\s+)?(pendientes|completadas|resueltas|hechas|ignoradas|descartadas|con accion|en curso|suprimidas|todas|pending|completed|done|ignored|dismissed|in progress|suppressed|all)(?:\s+(?:alerts|las alertas))?$/);
  if (show && (t !== show[1] || /^(?:pendientes|completadas|ignoradas|todas|pending|completed|ignored|all)$/.test(t))) {
    const w = show[1];
    const status = /^(?:pendientes|pending)$/.test(w) ? 'PENDING' : /^(?:completadas|resueltas|hechas|completed|done)$/.test(w) ? 'COMPLETED' : /^(?:ignoradas|descartadas|ignored|dismissed)$/.test(w) ? 'IGNORED' : /^(?:con accion|en curso|in progress)$/.test(w) ? 'ACTION_TAKEN' : /^(?:suprimidas|suppressed)$/.test(w) ? 'SUPPRESSED' : '';
    return { op: 'status', status };
  }
  const prio = t.match(/^(?:(?:mostra\w*|muestra\w*|ver|filtra\w*|show(?: me)?|filter(?: by)?)\s+)?(?:(?:solo|solamente|only)\s+)?(?:las\s+|the\s+)?(?:alertas\s+)?(?:de prioridad\s+|(?:with )?priority\s+)?(criticas?|altas?|medias?|bajas?|urgentes?|critical|high|medium|low|todas las prioridades|all priorities)(?:\s+(?:priority|prioridad|alerts|ones))?$/);
  if (prio && t !== prio[1]) return { op: 'priority', priority: /todas|all/.test(prio[1]) ? '' : priorityIn(prio[1]) ?? '' };
  return null;
}

registerVoiceCommand<ReadParsed>({
  id: 'alerts.read',
  domain: ALERTS_VOICE_DOMAIN,
  priority: 48,
  aux: true,
  match: (normalized) => (page() ? parseAlertsRead(normalized) : null),
  run: async (parsed, ctx) => {
    const p = page();
    if (!p) return;
    if (parsed.op === 'refresh') { p.refresh(); await say(ctx, T(ctx, 'refreshed')); return; }
    if (parsed.op === 'status') { p.setStatusFilter(parsed.status); await say(ctx, T(ctx, `status_${parsed.status || 'all'}`)); return; }
    if (parsed.op === 'priority') { p.setPriorityFilter(parsed.priority); await say(ctx, T(ctx, `priority_${parsed.priority || 'all'}`)); return; }
    const list = parsed.priority ? p.alerts.filter((a) => a.priority === parsed.priority) : p.alerts;
    if (!list.length) { await say(ctx, T(ctx, 'none'), 'info'); return; }
    const byCategory = Object.entries(list.reduce<Record<string, number>>((acc, a) => { acc[a.category] = (acc[a.category] ?? 0) + 1; return acc; }, {}))
      .sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${c}`).join(', ');
    await say(ctx, T(ctx, 'read', { count: list.length, detail: byCategory }), 'info', list.slice(0, 10).map((a) => ({ label: a.title, value: a.patient || a.category })));
  },
});

// ── Actuar ────────────────────────────────────────────────────────────────────

type Action = 'complete' | 'ignore' | 'snooze' | 'call' | 'note' | 'email' | 'whatsapp' | 'patient' | 'select' | 'unselect';
interface ActParsed { action: Action; target: Target; reason: string | null; until: Date | null; text: string | null }

const VERBS: Array<[RegExp, Action]> = [
  [/^(?:completa\w*|resolve\w*|resolvi\w*|marca\w* (?:como )?(?:completada|hecha|resuelta|lista)|da\w* por (?:hecha|resuelta|completada)|complete|resolve|mark (?:as )?(?:done|completed|resolved))\b/, 'complete'],
  [/^(?:ignora\w*|descarta\w*|ignore|dismiss|skip)\b/, 'ignore'],
  [/^(?:pospone\w*|pospon\w*|posterga\w*|aplaza\w*|deja\w* para|recorda\w*me|snooze|postpone|remind me)\b/, 'snooze'],
  [/^(?:registra\w* (?:una )?llamada|anota\w* (?:una )?llamada|llama\w*|agenda\w* (?:una )?llamada|log (?:a )?call|register (?:a )?call|schedule (?:a )?call|call)\b/, 'call'],
  [/^(?:agrega\w* (?:una )?nota|pone\w* (?:una )?nota|escribi\w* (?:una )?nota|add (?:a )?note|write (?:a )?note)\b/, 'note'],
  [/^(?:manda\w* (?:un )?(?:mail|email|correo)|envia\w* (?:un )?(?:mail|email|correo)|escribi\w* (?:un )?(?:mail|email|correo)|send (?:an? )?(?:email|mail)|email)\b/, 'email'],
  [/^(?:manda\w* (?:un )?(?:whatsapp|wasap|mensaje)|envia\w* (?:un )?(?:whatsapp|wasap|mensaje)|escribi\w* por whatsapp|send (?:a )?(?:whatsapp|message)|whatsapp)\b/, 'whatsapp'],
  [/^(?:abri\w* (?:el )?paciente|abri\w* (?:la )?ficha|ver (?:el )?paciente|mostra\w* (?:el )?paciente|open (?:the )?patient|show (?:the )?patient)\b/, 'patient'],
  [/^(?:selecciona\w*|marca\w*|tilda\w*|select|check|tick)\b/, 'select'],
  [/^(?:desmarca\w*|deselecciona\w*|destilda\w*|saca\w* la seleccion|unselect|deselect|uncheck|clear (?:the )?selection)\b/, 'unselect'],
];

/** «hasta mañana», «por una semana», «3 días», «hasta el lunes», «for a week», «until tomorrow». */
export function parseUntil(text: string, today: Date = startOfToday()): Date | null {
  const at9 = (d: Date) => setMinutes(setHours(d, 9), 0);
  if (/\b(?:manana|tomorrow)\b/.test(text)) return at9(addDays(today, 1));
  if (/\b(?:pasado manana|day after tomorrow)\b/.test(text)) return at9(addDays(today, 2));
  const n = text.match(/\b(\d+)\s+(dias?|days?|semanas?|weeks?)\b/);
  if (n) return at9(addDays(today, Number(n[1]) * (/^(?:semana|week)/.test(n[2]) ? 7 : 1)));
  if (/\b(?:una semana|a week|one week|la semana que viene|next week)\b/.test(text)) return at9(addDays(today, 7));
  if (/\b(?:un dia|a day|one day)\b/.test(text)) return at9(addDays(today, 1));
  const days: Array<[RegExp, 0 | 1 | 2 | 3 | 4 | 5 | 6]> = [[/\b(?:domingo|sunday)\b/, 0], [/\b(?:lunes|monday)\b/, 1], [/\b(?:martes|tuesday)\b/, 2], [/\b(?:miercoles|wednesday)\b/, 3], [/\b(?:jueves|thursday)\b/, 4], [/\b(?:viernes|friday)\b/, 5], [/\b(?:sabado|saturday)\b/, 6]];
  const d = days.find(([re]) => re.test(text));
  if (d) return at9(nextDay(today, d[1]));
  return null;
}

export function parseAlertsAction(normalized: string, raw: string): ActParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const verb = VERBS.map(([re, a]) => ({ a, m: t.match(re) })).find((x) => x.m);
  if (!verb?.m) return null;
  let rest = t.slice(verb.m[0].length).trim();
  // Lo que viene después del blanco: el motivo, hasta cuándo, el texto de la nota.
  let reason: string | null = null;
  let text: string | null = null;
  const rawCut = (marker: RegExp) => { const m = raw.match(marker); return m ? m[1].trim() : null; };
  if (verb.a === 'ignore') {
    const m = rest.match(/^(.*?)\s*(?:porque|por que|ya que|motivo|because|reason)\s+(.+)$/);
    if (m) { rest = m[1]; reason = rawCut(/(?:porque|por que|ya que|motivo:?|because|reason:?)\s+(.+)$/i) ?? m[2]; }
  }
  if (verb.a === 'note' && raw.includes(':')) {
    // «agregá una nota a la de Carlos: pagará el viernes»: antes de «:» a cuál, después el texto.
    const [before, ...after] = raw.split(':');
    text = after.join(':').trim() || null;
    rest = normalizeSpeech(before).slice(verb.m[0].length).trim();
  } else if (verb.a === 'note') {
    const m = rest.match(/^(.*?)\s*(?::|que diga|diciendo|saying|que)\s*(.+)$/) ?? (raw.includes(':') ? [rest, '', rest] : null);
    if (m) { rest = m[1] ?? ''; text = rawCut(/(?::|que diga|diciendo|saying)\s*(.+)$/i) ?? m[2]; }
  }
  let until: Date | null = null;
  if (verb.a === 'snooze' || verb.a === 'call') {
    const m = rest.match(/^(.*?)\s*(?:hasta|para|por|al|el|until|for|to|on)?\s*\b(manana|pasado manana|tomorrow|\d+\s+(?:dias?|days?|semanas?|weeks?)|una semana|un dia|a week|a day|one week|one day|la semana que viene|next week|lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(.*)$/);
    if (m) {
      until = parseUntil(m[2]);
      const time = spokenTime(` ${m[3]}`.replace(/^\s/, ''));
      if (until && time) { const [h, min] = time.split(':').map(Number); until = setMinutes(setHours(until, h), min); }
      rest = m[1];
    }
  }
  // «la de Juan», «todas», «las críticas», «la primera»; también «a Juan» (WhatsApp, mail).
  rest = rest.replace(/^(?:(?:la|las|el|los|the)\s+)?(?:alertas?|alerts?)\b/, '').replace(/^(?:a|al|para|to)\s+/, '').trim();
  return { action: verb.a, target: parseTarget(rest), reason, until, text };
}

registerVoiceCommand<ActParsed>({
  id: 'alerts.action',
  domain: ALERTS_VOICE_DOMAIN,
  priority: 49,
  match: (normalized, raw) => (page() ? parseAlertsAction(normalized, raw) : null),
  run: async (parsed, ctx) => {
    const p = page();
    if (!p) return;
    const perm: Record<Action, boolean> = { complete: p.permissions.complete, ignore: p.permissions.ignore, snooze: p.permissions.snooze, call: p.permissions.call, note: p.permissions.note, email: p.permissions.email, whatsapp: p.permissions.whatsapp, patient: true, select: true, unselect: true };
    if (!perm[parsed.action]) { await say(ctx, ctx.t('VoiceCommands.noPermission'), 'error'); return; }
    if (parsed.action === 'unselect') { p.setSelected([]); await say(ctx, T(ctx, 'unselected')); return; }
    const single = parsed.action === 'email' || parsed.action === 'patient';
    const alerts = await pickAlerts(ctx, parsed.target, p, !single);
    if (!alerts) return;
    const ids = alerts.map((a) => a.id);
    const what = alerts.length === 1 ? (alerts[0].patient ? `${alerts[0].title} (${alerts[0].patient})` : alerts[0].title) : T(ctx, 'nAlerts', { count: alerts.length });
    if (parsed.action === 'select') { p.setSelected([...new Set([...p.selected, ...ids])]); await say(ctx, T(ctx, 'selected', { what })); return; }
    if (parsed.action === 'patient') {
      if (!alerts[0].hasPatient) { await say(ctx, T(ctx, 'noPatient'), 'info'); return; }
      p.openPatient(ids[0]);
      await say(ctx, T(ctx, 'patientOpened', { name: alerts[0].patient }));
      return;
    }
    if (parsed.action === 'email') {
      if (!alerts[0].canEmail) { await say(ctx, T(ctx, 'noEmail'), 'info'); return; }
      p.email(ids[0]);
      await say(ctx, T(ctx, 'emailOpened'));
      return;
    }
    if (parsed.action === 'whatsapp') {
      const ok = alerts.filter((a) => a.canWhatsApp);
      if (!ok.length) { await say(ctx, T(ctx, 'noWhatsApp'), 'info'); return; }
      const question = T(ctx, 'confirmWhatsApp', { what: ok.length === 1 ? (ok[0].patient || ok[0].title) : T(ctx, 'nAlerts', { count: ok.length }) });
      if (!(await ctx.confirm({ title: T(ctx, 'title'), message: question, tone: 'confirm' }, question))) { await say(ctx, ctx.t('VoiceCommands.nothingChanged'), 'info'); return; }
      await p.whatsapp(ok.map((a) => a.id));
      await say(ctx, T(ctx, 'whatsappSent', { count: ok.length }));
      return;
    }
    if (parsed.action === 'note') {
      let text = parsed.text;
      if (!text) { const q = T(ctx, 'noteWhat'); text = (await ctx.ask({ title: T(ctx, 'title'), message: q, tone: 'info' }, q)).trim(); }
      if (!text) return;
      await p.addNote(ids, text);
      await say(ctx, T(ctx, 'noteAdded', { what }));
      return;
    }
    if (parsed.action === 'snooze') {
      let until = parsed.until;
      if (!until) {
        const q = T(ctx, 'snoozeUntil');
        until = parseUntil(normalizeSpeech(await ctx.ask({ title: T(ctx, 'title'), message: q, tone: 'info' }, q)));
        if (!until) { await say(ctx, T(ctx, 'snoozeNoDate'), 'info'); return; }
      }
      await p.snooze(ids, format(until, "yyyy-MM-dd'T'HH:mm"), '');
      await say(ctx, T(ctx, 'snoozed', { what, until: format(until, 'dd/MM HH:mm') }));
      return;
    }
    if (parsed.action === 'call') {
      const at = parsed.until ?? new Date();
      await p.registerCall(ids, format(at, "yyyy-MM-dd'T'HH:mm"), '');
      await say(ctx, T(ctx, parsed.until ? 'callScheduled' : 'callRegistered', { what, at: format(at, 'dd/MM HH:mm') }));
      return;
    }
    // Completar e ignorar cambian el estado: se confirma antes.
    let reason = parsed.reason;
    if (parsed.action === 'ignore' && !reason) {
      const q = T(ctx, 'ignoreWhy');
      reason = (await ctx.ask({ title: T(ctx, 'title'), message: q, tone: 'info' }, q)).trim();
      if (!reason) return;
    }
    const question = T(ctx, parsed.action === 'complete' ? 'confirmComplete' : 'confirmIgnore', { what });
    if (!(await ctx.confirm({ title: T(ctx, 'title'), message: question, tone: 'confirm' }, question))) { await say(ctx, ctx.t('VoiceCommands.nothingChanged'), 'info'); return; }
    if (parsed.action === 'complete') await p.complete(ids); else await p.ignore(ids, reason!);
    await say(ctx, T(ctx, parsed.action === 'complete' ? 'completed' : 'ignored', { what }));
  },
});
