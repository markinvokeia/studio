import { format, parseISO } from 'date-fns';

import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';
import { parsePeriod } from '@/lib/voice/period';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';

import type { VoiceCommandContext, WorkspaceVoiceBridge } from '@/lib/types';

/**
 * Mi consultorio por voz (src/components/dashboard/doctor-workspace.tsx): elegir el paciente
 * («el de las 10», «el siguiente», «el de Juan»), preguntar la agenda («¿quién sigue?», «¿qué
 * pacientes tengo mañana?»), las acciones sobre la cita elegida («nueva sesión», «recetá», «orden
 * de laboratorio», «sesión estética», «periodontograma», «abrí la ficha», «la anamnesis»,
 * «odontograma»), y los filtros (día, semana, mes, mis citas, la agenda de un consultorio).
 */

export const WORKSPACE_VOICE_DOMAIN = 'workspace';
registerVoiceDomain({ id: WORKSPACE_VOICE_DOMAIN, notUnderstoodKey: 'VoiceCommands.workspace.notUnderstood' });

const ws = () => getVoiceBridge<WorkspaceVoiceBridge>('workspace');
const T = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.workspace.${key}`, values);
async function say(ctx: VoiceCommandContext, message: string, tone: 'success' | 'info' | 'error' = 'success', rows?: Array<{ label: string; value: string }>) {
  await ctx.finish({ title: T(ctx, 'title'), message, tone, rows }, message);
}
const settle = () => new Promise((r) => setTimeout(r, 80));
async function loaded(ctx: VoiceCommandContext): Promise<WorkspaceVoiceBridge | null> {
  const start = Date.now();
  await settle();
  let b = ws();
  while (b?.loading && Date.now() - start < 6000 && !ctx.signal.aborted) { await settle(); b = ws(); }
  return b;
}

type Appt = WorkspaceVoiceBridge['appointments'][number];
const sorted = (list: Appt[]) => [...list].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
const label = (a: Appt, locale: string) => {
  const day = a.date ? format(parseISO(`${a.date}T00:00:00`), locale.startsWith('en') ? 'EEE d' : 'EEE d') : '';
  return `${a.time} ${a.patient}${day ? ` · ${day}` : ''}`;
};

// ── Qué cita: hora, nombre, siguiente, posición ───────────────────────────────

export type ApptRef = { by: 'time'; time: string } | { by: 'name'; name: string } | { by: 'next' } | { by: 'previous' } | { by: 'position'; text: string };

/** «a las 10», «de las 15 30», «10 y media», «at 3 pm». */
export function spokenTime(text: string): string | null {
  const oclock = text.match(/\b(\d{1,2})\s+o\s*clock\b/);
  if (oclock) return spokenTime(`at ${oclock[1]}`);
  const m = text.match(/\b(?:a las|de las|las|a la|de la|at|for)\s+(\d{1,2})(?:\s(\d{2})|\sy\s(media|cuarto)|\s(?:y\s)?(\d{1,2}))?(?:\s(am|pm|de la manana|de la tarde|de la noche))?\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : m[4] ? Number(m[4]) : 0;
  const suffix = m[5];
  if (suffix && /pm|tarde|noche/.test(suffix) && h < 12) h += 12;
  else if (!suffix && h >= 1 && h <= 6) h += 12;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseApptRef(text: string): ApptRef | null {
  const time = spokenTime(text);
  if (time) return { by: 'time', time };
  if (/\b(?:siguiente|proxim[oa]|next)\b/.test(text)) return { by: 'next' };
  if (/\b(?:anterior|previous|prior)\b/.test(text)) return { by: 'previous' };
  const pos = text.match(/\b(?:(?:el|la) )?(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|ultim[oa]|penultim[oa]|first|second|third|fourth|fifth|last)\b/);
  if (pos) return { by: 'position', text: pos[1] };
  const name = text.match(/\b(?:de|del|para|a|con|of|for|with)\s+(?!las?\b|hoy\b|manana\b)(?:(?:la|el)\s+)?(?:paciente\s+|patient\s+)?([a-z][a-z ]{1,40})$/);
  if (name) return { by: 'name', name: name[1].trim() };
  return null;
}

function resolveRef(ref: ApptRef, b: WorkspaceVoiceBridge): Appt[] {
  const list = sorted(b.appointments);
  if (!list.length) return [];
  if (ref.by === 'time') return list.filter((a) => a.time.slice(0, 5) === ref.time);
  if (ref.by === 'name') {
    const words = normalizeSpeech(ref.name).split(' ').filter((w) => w.length > 1);
    return list.filter((a) => { const n = normalizeSpeech(a.patient).split(' '); return words.every((w) => n.some((x) => x.startsWith(w))); });
  }
  if (ref.by === 'position') {
    const index = parseChoice(ref.text, list.length);
    return index === null ? [] : [list[index]];
  }
  const current = list.findIndex((a) => a.id === b.selectedId);
  if (ref.by === 'previous') return current > 0 ? [list[current - 1]] : [];
  // El siguiente: después de la elegida; sin elegida (o mirando hoy), el primero que todavía no pasó.
  const now = format(new Date(), 'yyyy-MM-dd HH:mm');
  const upcoming = list.find((a) => `${a.date} ${a.time}` >= now && a.id !== b.selectedId && (current < 0 || list.indexOf(a) > current));
  return upcoming ? [upcoming] : current >= 0 && current < list.length - 1 ? [list[current + 1]] : [];
}

async function pick(ctx: VoiceCommandContext, ref: ApptRef | null, b: WorkspaceVoiceBridge): Promise<Appt | null> {
  if (!ref) return b.appointments.find((a) => a.id === b.selectedId) ?? null;
  const found = resolveRef(ref, b);
  if (!found.length) { await say(ctx, T(ctx, 'notFound'), 'info'); return null; }
  if (found.length === 1) return found[0];
  const question = T(ctx, 'which');
  const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: found.map((a) => ({ label: label(a, ctx.locale) })) }, `${question} ${found.map((a, i) => `${i + 1}: ${a.time} ${a.patient}`).join('. ')}.`);
  return found[index];
}

// ── Elegir y preguntar ────────────────────────────────────────────────────────

type SelectParsed = { op: 'select'; ref: ApptRef } | { op: 'whoNext' } | { op: 'list'; preset: Parameters<WorkspaceVoiceBridge['setPreset']>[0] | null };

export function parseWorkspaceSelect(normalized: string): SelectParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:quien sigue|quien es el (?:siguiente|proximo)|(?:cual|quien) es (?:el|mi) (?:siguiente|proximo)(?: paciente)?|who(?: is|s) next|whos next|who is my next patient)$/.test(t)) return { op: 'whoNext' };
  const list = t.match(/^(?:que (?:pacientes|citas|turnos) tengo|(?:cuantos|cuantas) (?:pacientes|citas|turnos) tengo|como (?:tengo|esta) (?:la|mi) agenda|(?:leeme |decime )?(?:mi|la) agenda|(?:what is on |whats on )?my schedule|(?:what|which) (?:patients|appointments) do i have|how many (?:patients|appointments) do i have)(?:\s+(hoy|manana|esta semana|este mes|today|tomorrow|this week|this month))?$/);
  if (list) {
    const w = list[1];
    const preset = !w ? null : /^(?:hoy|today)$/.test(w) ? 'today' : /^(?:manana|tomorrow)$/.test(w) ? 'tomorrow' : /^(?:esta semana|this week)$/.test(w) ? 'week' : 'month';
    return { op: 'list', preset };
  }
  const m = t.match(/^(?:(?:abri\w*|abre|selecciona\w*|elegi\w*|mostra\w*|muestra\w*|pasa\w* al?|anda\w* al?|ve al?|ir al?|volve\w* al?|atende\w*|vamos con|segui\w* con|open|select|show(?: me)?|go to|move to|lets see|call)\s+)?(?:(?:a |al )?(?:la cita|el turno|el paciente|la paciente|the appointment|the patient|el|la|the)\s*)?(.*)$/);
  if (!m) return null;
  const rest = m[1].trim();
  const hasVerb = t !== m[1].trim() || /^(?:el|la)\b/.test(t);
  if (!rest && /\b(?:siguiente|proximo|next)\b/.test(t)) return { op: 'select', ref: { by: 'next' } };
  const ref = parseApptRef(rest ? ` ${rest}`.replace(/^ /, '') : t);
  // Sin verbo solo lo inequívoco: «el siguiente», «el de las 10», «el próximo paciente».
  if (!ref) return null;
  if (!hasVerb && !/^(?:el|la|the)\b/.test(t) && ref.by !== 'next') return null;
  if (ref.by === 'name' && !hasVerb) return null;
  return { op: 'select', ref };
}

registerVoiceCommand<SelectParsed>({
  id: 'workspace.select',
  domain: WORKSPACE_VOICE_DOMAIN,
  priority: 42,
  match: (normalized) => {
    const b = ws();
    const p = b ? parseWorkspaceSelect(normalized) : null;
    // Un nombre que no está en la agenda («abrí la ficha de alguien más») va al buscador del panel derecho.
    if (p?.op === 'select' && p.ref.by === 'name' && !resolveRef(p.ref, b!).length) return null;
    return p;
  },
  run: async (parsed, ctx) => {
    let b = ws();
    if (!b) return;
    if (parsed.op === 'list') {
      if (parsed.preset && parsed.preset !== b.preset) { b.setPreset(parsed.preset); b = await loaded(ctx); if (!b) return; }
      const list = sorted(b.appointments);
      if (!list.length) { await say(ctx, T(ctx, 'empty'), 'info'); return; }
      await say(ctx, T(ctx, 'list', { count: list.length, first: `${list[0].time} ${list[0].patient}` }), 'info', list.slice(0, 12).map((a) => ({ label: a.time, value: `${a.patient}${a.service ? ` · ${a.service}` : ''}` })));
      return;
    }
    if (parsed.op === 'whoNext') {
      const next = resolveRef({ by: 'next' }, { ...b, selectedId: null });
      if (!next.length) { await say(ctx, T(ctx, 'noNext'), 'info'); return; }
      await say(ctx, T(ctx, 'next', { time: next[0].time, patient: next[0].patient, service: next[0].service || '—' }), 'info');
      return;
    }
    const appt = await pick(ctx, parsed.ref, b);
    if (!appt) return;
    b.select(appt.id);
    await say(ctx, T(ctx, 'selected', { time: appt.time, patient: appt.patient }));
  },
});

// ── Acciones sobre la cita elegida ────────────────────────────────────────────

type ActionKey = keyof WorkspaceVoiceBridge['actions'] | 'odontogram' | 'sessions' | 'anamnesis' | 'timeline';
interface ActionParsed { action: ActionKey; ref: ApptRef | null }

const ACTIONS: Array<[RegExp, ActionKey]> = [
  [/\b(?:periodontograma|perio|sondaje|periodontal(?: chart| exam)?|perio chart)\b/, 'perio'],
  [/\b(?:sesion estetica|estetica|aesthetic(?: session)?|cosmetic session)\b/, 'aesthetic'],
  [/\b(?:orden de laboratorio|laboratorio|pedido de laboratorio|lab order|laboratory order|lab)\b/, 'labOrder'],
  [/\b(?:receta|recetale|receta\w*|prescrib\w*|prescripcion|indicaciones|prescription)\b/, 'prescribe'],
  [/\b(?:anamnesis|antecedentes|medical history questionnaire)\b/, 'anamnesis'],
  [/\b(?:linea de tiempo|historial clinico|timeline)\b/, 'timeline'],
  [/\b(?:ficha|historia clinica|historia|patient file|patient record|record|chart)\b/, 'patientFile'],
  [/\b(?:odontograma|odontogram|dental chart)\b/, 'odontogram'],
  [/\b(?:sesiones|sessions)\b/, 'sessions'],
  [/\b(?:(?:nueva |una |la )?sesion(?: clinica)?|evolucion|registra\w* (?:la )?(?:atencion|consulta)|new session|clinical session|start (?:the |a )?session|session)\b/, 'session'],
];
const ACTION_VERB = /^(?:(?:abri\w*|abre|volve\w* a|hace\w*|haz|crea\w*|empeza\w*|inicia\w*|arranca\w*|nueva|nuevo|registra\w*|carga\w*|mostra\w*|muestra\w*|ver|pasa\w* a|anda\w* a|ve a|ir a|quiero|necesito|open|make|create|start|new|show(?: me)?|go to|write|record|do)\s+)/;

export function parseWorkspaceAction(normalized: string): ActionParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const found = ACTIONS.map(([re, key]) => ({ key, m: t.match(re) })).find((x) => x.m);
  if (!found?.m) return null;
  const action = found.key;
  const start = found.m.index ?? 0;
  // Con verbo («abrí…», «hacé…») o el nombre de la acción de entrada («orden de laboratorio», «la ficha»).
  if (!ACTION_VERB.test(t) && !/^(?:(?:la|el|las|los|una|un|the|a)\s+)?$/.test(t.slice(0, start)) && !/^(?:recetale|receta\w*|prescribe)\b/.test(t)) return null;
  // «… de Juan», «… para el de las 10»: lo que sigue a la acción.
  const after = t.slice(start + found.m[0].length).trim();
  const ref = after ? parseApptRef(after) : null;
  return { action, ref: ref && ref.by !== 'position' ? ref : null };
}

registerVoiceCommand<ActionParsed>({
  id: 'workspace.action',
  domain: WORKSPACE_VOICE_DOMAIN,
  // Por encima de navegar: «volvé a las sesiones» es la pestaña, no «Sesiones de caja».
  priority: 55,
  // Una frase con nombre que no está en la agenda («abrí la ficha de alguien más») va al buscador del panel derecho.
  match: (normalized) => {
    const b = ws();
    const p = b ? parseWorkspaceAction(normalized) : null;
    if (p?.ref?.by === 'name' && !resolveRef(p.ref, b!).length) return null;
    return p;
  },
  run: async (parsed, ctx) => {
    let b = ws();
    if (!b) return;
    if (parsed.action === 'odontogram' || parsed.action === 'sessions') {
      b.setPanel(parsed.action === 'odontogram' ? 'odontogram' : 'sessions');
      await say(ctx, T(ctx, parsed.action === 'odontogram' ? 'odontogramShown' : 'sessionsShown'));
      return;
    }
    if (parsed.ref) {
      const appt = await pick(ctx, parsed.ref, b);
      if (!appt) return;
      if (appt.id !== b.selectedId) { b.select(appt.id); await settle(); b = ws(); if (!b) return; }
    }
    if (!b.selectedId) { await say(ctx, T(ctx, 'pickFirst'), 'info'); return; }
    const appt = b.appointments.find((a) => a.id === b!.selectedId);
    const key = parsed.action === 'anamnesis' || parsed.action === 'timeline' ? 'patientFile' : parsed.action;
    const run = b.actions[key];
    if (!run) {
      const why = b.blocked ?? 'noAppointment';
      await say(ctx, T(ctx, `blocked_${why}`), 'info');
      return;
    }
    if (key === 'patientFile') (run as (view?: 'anamnesis' | 'timeline') => void)(parsed.action === 'anamnesis' ? 'anamnesis' : parsed.action === 'timeline' ? 'timeline' : undefined);
    else (run as () => void)();
    await say(ctx, T(ctx, `did_${parsed.action}`, { patient: appt?.patient ?? '' }));
  },
});

// ── Filtros: día, semana, mes, mis citas, agenda de un consultorio ────────────

type FilterParsed =
  | { op: 'preset'; preset: Parameters<WorkspaceVoiceBridge['setPreset']>[0] }
  | { op: 'range'; from: Date; to: Date }
  | { op: 'mine' }
  | { op: 'calendar'; name: string | null }
  | { op: 'refresh' };

export function parseWorkspaceFilter(normalized: string): FilterParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload|update)(?: la agenda| mi agenda| the (?:list|schedule))?$/.test(t)) return { op: 'refresh' };
  if (/^(?:(?:mostra\w*|ver|ve|volve\w* a|anda\w* a|show(?: me)?|go back to|back to)\s+)?(?:solo )?(?:mis (?:citas|pacientes|turnos)|mi agenda|las mias|my (?:appointments|patients|schedule)|mine)$/.test(t)) return { op: 'mine' };
  const cal = t.match(/^(?:(?:mostra\w*|ver|ve|cambia\w* a|pasa\w* a|anda\w* a|show(?: me)?|switch to|go to)\s+)?(?:la |the )?(?:agenda|calendario|calendar|consultorio)\s+(?:de\s+|del\s+)?(.+)$/);
  if (cal && !/^(?:hoy|manana|today|tomorrow)$/.test(cal[1])) return { op: 'calendar', name: cal[1] };
  if (/^(?:(?:mostra\w*|ver|ve|show(?: me)?)\s+)?(?:las |los |the )?(?:agendas|calendarios|calendars|por agenda)$/.test(t)) return { op: 'calendar', name: null };
  const body = t.replace(/^(?:(?:mostra\w*|muestra\w*|ver|ve|anda\w* a|pasa\w* a|cambia\w* a|filtra\w*|show(?: me)?|go to|switch to|view)\s+)/, '');
  const presets: Array<[RegExp, Parameters<WorkspaceVoiceBridge['setPreset']>[0]]> = [
    [/^(?:hoy|today)$/, 'today'], [/^(?:manana|tomorrow)$/, 'tomorrow'], [/^(?:esta semana|la semana|this week)$/, 'week'],
    [/^(?:(?:los )?proximos 7 dias|(?:la )?proxima semana|next 7 days|next week)$/, 'next7'], [/^(?:este mes|el mes|this month)$/, 'month'],
    [/^(?:el mes que viene|el proximo mes|next month)$/, 'nextMonth'], [/^(?:el mes pasado|el mes anterior|last month)$/, 'prevMonth'],
  ];
  const preset = presets.find(([re]) => re.test(body))?.[1];
  if (preset && (t !== body || preset !== 'today')) return { op: 'preset', preset };
  if (t !== body) {
    const period = parsePeriod(body);
    if (period) return { op: 'range', from: period.from, to: period.to };
  }
  return null;
}

registerVoiceCommand<FilterParsed>({
  id: 'workspace.filter',
  domain: WORKSPACE_VOICE_DOMAIN,
  priority: 43,
  aux: true,
  match: (normalized) => (ws() ? parseWorkspaceFilter(normalized) : null),
  run: async (parsed, ctx) => {
    const b = ws();
    if (!b) return;
    if (parsed.op === 'refresh') { b.refresh(); await say(ctx, T(ctx, 'refreshed')); return; }
    if (parsed.op === 'mine') { b.setViewMode('mine'); await say(ctx, T(ctx, 'mine')); return; }
    if (parsed.op === 'calendar') {
      if (!b.calendars.length) { await say(ctx, T(ctx, 'noCalendars'), 'info'); return; }
      const key = parsed.name ? normalizeSpeech(parsed.name) : '';
      let cal = key ? b.calendars.find((c) => normalizeSpeech(c.name) === key) ?? b.calendars.find((c) => normalizeSpeech(c.name).includes(key)) : undefined;
      if (!cal) {
        const question = T(ctx, 'whichCalendar');
        const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: b.calendars.map((c) => ({ label: c.name })) }, `${question} ${b.calendars.map((c, i) => `${i + 1}: ${c.name}`).join('. ')}.`);
        cal = b.calendars[index];
      }
      b.setCalendar(cal.id);
      await say(ctx, T(ctx, 'calendarSet', { name: cal.name }));
      return;
    }
    if (parsed.op === 'preset') { b.setPreset(parsed.preset); await say(ctx, T(ctx, `preset_${parsed.preset}`)); return; }
    b.setRange(parsed.from, parsed.to);
    await say(ctx, T(ctx, 'rangeSet', { from: format(parsed.from, 'dd/MM'), to: format(parsed.to, 'dd/MM') }));
  },
});
