import { format, parseISO } from 'date-fns';

import { normalizeSpeech, parseChoice, parseSpokenDate } from '@/lib/voice/parse';
import { parsePeriod } from '@/lib/voice/period';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { getVoiceBridge } from '@/lib/voice/screen-bridge';
import { useVoiceCommand } from '@/stores/voice-command-store';

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
    const hits = list.filter((a) => { const n = normalizeSpeech(a.patient).split(' '); return words.every((w) => n.some((x) => x.startsWith(w))); });
    // Un nombre es otro caso: si coincide con varios, no el que ya está elegido.
    const others = hits.filter((a) => a.id !== b.selectedId);
    return others.length ? others : hits;
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

/**
 * El paciente al que se quiere pasar, dicho de cualquier forma: «cambiá de Ana a Juan», «switch
 * from Ana to Juan», «pasá a Juan», «cambiá al paciente Juan», «seleccioná a Juan», «quiero ver a
 * Juan», «ahora Juan», «select Juan». null si la frase no tiene esa forma (el nombre se confirma
 * contra las citas que se ven).
 */
export function switchTarget(normalized: string): string | null {
  let t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/\s+/g, ' ').trim();
  // «cerrá este caso clínico y abrí el de Leonardo»: cerrar el de ahora es parte de cambiar.
  const closed = t.match(/^(?:cerra\w*|cierra\w*|termina\w*|deja\w*|close|leave)\s+(?:este |el |this |the )?(?:caso(?: clinico)?|paciente|case|patient)(?:\s+(?:de|del|of)\s+[a-z ]+?)?\s+(?:y|and)\s+(?:(?:ahora|despues|luego|then|now)\s+)?/);
  if (closed) {
    // Lo que sigue es a quién se pasa: «abrí el de Leonardo», «el de Leonardo», «open Carlos».
    const rest = t.slice(closed[0].length)
      .replace(/^(?:abri\w*|abre|open|selecciona\w*|elegi\w*|select|pasa\w* a|cambia\w* a|switch to|go to|anda\w* a|ve a)\s+/, '')
      .replace(/^(?:(?:el|la|the)\s+)?(?:(?:caso|paciente|cita|case|patient|one)\s+)?(?:(?:de|del|of|for)\s+)?/, '');
    t = rest ? `select ${rest}` : t;
  }
  // «quiero ver ahora el de Leonardo», «ahora el de Leonardo», «mostrame el caso de Leonardo».
  t = t.replace(/^(?:quiero ver|quiero|ver|veamos|mostra\w*|muestra\w*|i want to see|show(?: me)?|let me see)\s+(?:ahora\s+|now\s+)?(?:(?:el|la|the)\s+)?(?:(?:caso|paciente|cita|case|patient|appointment)\s+)?(?:de|del|of|for)\s+/, 'select ');
  t = t.replace(/^(?:ahora|now)\s+(?:(?:el|la|the)\s+)?(?:(?:caso|paciente|cita|case|patient|one)\s+)?(?:de|del|of|for)\s+/, 'select ');
  t = t.replace(/^(?:abri\w*|abre|open)\s+(?:(?:el|la|the)\s+)?(?:(?:caso|paciente|cita|case|patient|appointment)\s+)?(?:de|del|of|for)\s+/, 'select ');
  // «el paciente Leonardo», «paciente Martín», «the patient Carlos», «el de Leonardo»: un nombre es otro caso.
  t = t.replace(/^(?:(?:el|la|the)\s+)?(?:paciente|patient)\s+(?!(?:siguiente|anterior|proxim[oa]|ultim[oa]|primer[oa]?|next|previous|last|first)\b)/, 'select ');
  t = t.replace(/^(?:el|la)\s+de\s+(?!las?\b)/, 'select ');
  const from = t.match(/^(?:cambia\w*|pasa\w*|switch|change|move|go)\s+(?:de|del|from)\s+.+?\s+(?:a|al|to)\s+(.+)$/);
  const to = t.match(/^(?:cambia\w*|pasa\w*|selecciona\w*|elegi\w*|elige|escoge\w*|escogi\w*|quiero ver a|quiero atender a|ver a|ahora|ahora con|vamos con|segui\w* con|atende\w*|llama\w*|abri\w* (?:el caso|la cita|el turno) de|switch to|change to|move to|go to|select|pick|choose|now|open (?:the case|the appointment) (?:of|for)|call)\s+(?:a\s+|al\s+|to\s+)?(.+)$/);
  const raw = (from?.[1] ?? to?.[1] ?? '').trim();
  if (!raw) return null;
  const name = raw.replace(/^(?:(?:el|la|the)\s+)?(?:paciente|patient|caso de|case of|cita de|turno de)\s+/, '').replace(/^(?:el|la|the)\s+/, '').trim();
  // Lo que no es un nombre (fechas, pestañas, horas) lo entienden los otros comandos.
  if (!name || /\d/.test(name) || name.split(' ').length > 4) return null;
  return name;
}

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
  // «el siguiente» / «el anterior» es toda la frase («…próxima cita control en 6 meses» es un dictado).
  if ((ref.by === 'next' || ref.by === 'previous') && !/^(?:(?:el|la|the|al|a)\s+)?(?:que sigue|siguiente|proxim[oa]|next|anterior|previous|prior|last)(?:\s+(?:paciente|cita|turno|patient|appointment|one))?$/.test(rest || t)) return null;
  if (!hasVerb && !/^(?:el|la|the)\b/.test(t) && ref.by !== 'next') return null;
  if (ref.by === 'name' && !hasVerb) return null;
  return { op: 'select', ref };
}

// «Cerrá este caso clínico y abrí el de Leonardo»: una sola cosa (cambiar de caso), no un plan de dos
// pasos para la IA. Se resuelve acá, con las citas que se ven.
registerVoiceCommand<SelectParsed>({
  id: 'workspace.switch',
  domain: WORKSPACE_VOICE_DOMAIN,
  priority: 42,
  handlesCompound: true,
  match: (normalized) => {
    const b = ws();
    if (!b || !/^(?:cerra\w*|cierra\w*|termina\w*|deja\w*|close|leave)\s/.test(normalized) || !/\s(?:y|and)\s/.test(normalized)) return null;
    const target = switchTarget(normalized);
    if (!target) return null;
    const ref: ApptRef = { by: 'name', name: target };
    return resolveRef(ref, b).length ? { op: 'select', ref } : null;
  },
  run: async (parsed, ctx) => {
    const b = ws();
    if (!b || parsed.op !== 'select') return;
    const appt = await pick(ctx, parsed.ref, b);
    if (!appt) return;
    b.select(appt.id);
    await say(ctx, T(ctx, 'selected', { time: appt.time, patient: appt.patient }));
  },
});

registerVoiceCommand<SelectParsed>({
  id: 'workspace.select',
  domain: WORKSPACE_VOICE_DOMAIN,
  priority: 42,
  match: (normalized) => {
    const b = ws();
    if (!b) return null;
    // Cambiar de caso: «cambiá de Carolina a Leonardo», «pasá a Leonardo», «seleccioná a Leonardo»,
    // «ahora Leonardo», «select Leonardo»: el nombre se busca en las citas que se ven.
    const target = switchTarget(normalized);
    if (target) {
      const ref: ApptRef = { by: 'name', name: target };
      if (resolveRef(ref, b).length) return { op: 'select', ref };
    }
    // «el siguiente paciente», «el paciente anterior», «el último paciente».
    const order = normalized.match(/^(?:(?:el|la|the)\s+)?(?:(siguiente|proxim[oa]|anterior|ultim[oa]|primer[oa]?|next|previous|last|first)\s+(?:paciente|patient|caso|case)|(?:paciente|patient|caso|case)\s+(siguiente|anterior|next|previous))$/);
    if (order) {
      const w = order[1] ?? order[2];
      const ref: ApptRef = /siguiente|proxim|next/.test(w) ? { by: 'next' } : /anterior|previous/.test(w) ? { by: 'previous' } : { by: 'position', text: w };
      return { op: 'select', ref };
    }
    const p = parseWorkspaceSelect(normalized);
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
interface ActionParsed {
  action: ActionKey;
  ref: ApptRef | null;
  /** Después de la acción se dijo más que a quién («…: hice una limpieza en el 16»): es un dictado. */
  dictation?: boolean;
}

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
const ACTION_VERB = /^(?:(?:abri\w*|abre|completa\w*|complete|volve\w* a|hace\w*|haz|crea\w*|empeza\w*|inicia\w*|arranca\w*|nueva|nuevo|registra\w*|carga\w*|mostra\w*|muestra\w*|ver|pasa\w* a|anda\w* a|ve a|ir a|quiero|necesito|open|make|create|start|new|show(?: me)?|go to|write|record|do)\s+)/;

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
  const usable = ref && ref.by !== 'position' ? ref : null;
  return { action, ref: usable, dictation: !!after && !usable && after.split(' ').length >= 3 };
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
    // «Completá la sesión: hice una limpieza…» con el caso clínico abierto: lo arma el agente
    // clínico (abre la sesión o el odontograma con lo dictado), no se abre vacío.
    if (p?.dictation && (p.action === 'session' || p.action === 'odontogram') && getVoiceBridge('workspace.agent') && useVoiceCommand.getState().clinicalCase?.open) return null;
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

type Preset = Parameters<WorkspaceVoiceBridge['setPreset']>[0];
type FilterParsed =
  | { op: 'refresh' }
  | {
    op: 'set';
    /** «asignadas a mí» / «mis calendarios» (las dos pestañas del panel de la agenda). */
    view: 'mine' | 'calendar' | null;
    /** Qué calendario (undefined: no se dijo; null: «mis calendarios» sin decir cuál → se pregunta si hace falta). */
    calendar?: string | null;
    preset?: Preset;
    range?: { from: Date; to: Date };
    /** «¿qué tengo el viernes?»: se pone el filtro y se lee la agenda. */
    read: boolean;
    /** «cambiá la fecha» sin decir cuál: se pregunta. */
    askDate?: boolean;
  };

const MINE_RE = /\b(?:(?:las |los )?asignad[oa]s(?: a mi)?|mis citas|mis turnos|mis pacientes|mi agenda|(?:las|los) mi[oa]s|assigned to me|my appointments|my patients|my schedule|mine)\b/;
const CALENDARS_RE = /\b(?:mis calendarios|mis agendas|mis consultorios|(?:los|las) (?:calendarios|agendas|consultorios)|por (?:calendario|agenda)|my calendars|the calendars|calendars)\b/;
const ONE_CALENDAR_RE = /\b(?:(?:el|la|del|de la|the)\s+)?(?:calendario|agenda|consultorio|calendar)\s+(?:de\s+|del\s+|de la\s+)?(.+)$/;
const WEEKDAY_WORDS = 'lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MONTH_WORDS = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december';
/** Lo que queda es solo una fecha («el martes», «del 1 al 10 de diciembre», «la semana pasada»). */
const DATE_ONLY_RE = new RegExp(`^(?:(?:el|la|los|las|lo|de|del|al|desde|hasta|a|y|en|para|the|on|for|from|to|until|of|in|this|next|last|past|previous|este|esta|dia|dias|day|days|semana|semanas|week|weeks|mes|meses|month|months|ano|year|pasad[oa]|anterior|que viene|proxim[oa]s?|siguiente|hoy|manana|ayer|pasado|today|tomorrow|yesterday|after|st|nd|rd|th|\\d{1,4}|\\d{1,2}/\\d{1,2}|${WEEKDAY_WORDS}|${MONTH_WORDS})\\s*)+$`);
const PRESETS: Array<[RegExp, Preset]> = [
  [/^(?:el dia de )?(?:hoy|today)$/, 'today'], [/^(?:manana|tomorrow)$/, 'tomorrow'], [/^(?:esta semana|la semana|(?:the )?week|this week)$/, 'week'],
  [/^(?:(?:los )?proximos 7 dias|(?:la )?proxima semana|la semana que viene|next 7 days|next week)$/, 'next7'], [/^(?:este mes|el mes|this month|the month)$/, 'month'],
  [/^(?:el mes que viene|el proximo mes|next month)$/, 'nextMonth'], [/^(?:el mes pasado|el mes anterior|last month|previous month)$/, 'prevMonth'],
];

/**
 * Los filtros del panel de la agenda del día: la pestaña («asignadas a mí» / «mis calendarios»),
 * qué calendario y la fecha (día, semana, mes, rango), juntos o por separado: «mis citas de
 * mañana», «mis calendarios, el sillón 2, el martes», «la semana pasada», «del 1 al 10 de
 * diciembre», «¿qué tengo el viernes?». «Mis calendarios» es la pestaña, no el menú Calendarios.
 */
export function parseWorkspaceFilter(normalized: string, calendars: Array<{ name: string }> = []): FilterParsed | null {
  const t = normalized.replace(/\b(?:por favor|please|che)\b/g, ' ').replace(/[¿?]/g, '').replace(/\s+/g, ' ').trim();
  if (/^(?:actualiza\w*|recarga\w*|refresca\w*|refresh|reload|update)(?: la agenda| mi agenda| the (?:list|schedule))?$/.test(t)) return { op: 'refresh' };
  let body = t;
  let read = false;
  const question = body.match(/^(?:que|cuant[oa]s|cuales) (?:(?:pacientes|citas|turnos) )?(?:tengo|hay|tenemos|tiene)\s+(.+)$|^(?:what do i have|what s on|whats on|what is on|who do i have|what appointments do i have|how many (?:patients|appointments) do i have)\s+(.+)$/);
  if (question) { read = true; body = (question[1] ?? question[2]).trim(); }
  // «cambiá la fecha al martes», «poné la fecha de mañana», «change the date to tomorrow», «cambialo de fecha».
  let askDate = false;
  const dateVerb = body.match(/^(?:cambia\w*|pone\w*|move|change|set)\s+(?:(?:la|el|the)\s+)?(?:de\s+)?(?:fecha|dia|date|day)(?:\s+(?:a|al|para|por|de|del|en|to|for))?(?:\s+|$)/);
  if (dateVerb) { body = body.slice(dateVerb[0].length).trim(); if (!body) askDate = true; }
  body = body.replace(/^(?:(?:mostra\w*|muestra\w*|ensena\w*|ver|ve|veamos|quiero ver|anda\w* a|pasa\w* a|cambia\w* a|volve\w* a|filtra\w*(?: por)?|pone\w*|abri\w*|elegi\w*|selecciona\w*|show(?: me)?|go to|switch to|view|back to|open|select|let me see|filter(?: by)?)\s+)+/, '').trim();
  const hadVerb = body !== t || read;
  let view: 'mine' | 'calendar' | null = null;
  let calendar: string | null | undefined;
  if (MINE_RE.test(body)) { view = 'mine'; body = body.replace(new RegExp(MINE_RE.source, 'g'), ' '); }
  if (CALENDARS_RE.test(body)) { view = 'calendar'; calendar = null; body = body.replace(CALENDARS_RE, ' '); }
  // Un calendario por su nombre («el sillón 2»), con o sin la palabra «calendario».
  const named = calendars.map((c) => ({ c, key: normalizeSpeech(c.name) })).filter((x) => x.key && body.includes(x.key)).sort((x, y) => y.key.length - x.key.length)[0];
  if (named) { view = 'calendar'; calendar = named.c.name; body = body.replace(named.key, ' '); }
  body = body.replace(/\s+/g, ' ').trim();
  const one = !named ? body.match(ONE_CALENDAR_RE) : null;
  if (one && !DATE_ONLY_RE.test(one[1].trim())) { view = 'calendar'; calendar = one[1].trim(); body = body.slice(0, one.index).trim(); }
  // Lo que queda: la fecha (sin «las citas de», «la agenda del»).
  let rest = body
    .replace(/\b(?:(?:el|la|the)\s+)?(?:calendario|consultorio|calendar)\b/g, ' ')
    .replace(/^(?:(?:y|,)\s+)?(?:(?:(?:las|los|la|el|the)\s+)?(?:citas|turnos|agenda|pacientes|appointments|schedule|patients)\b\s*(?:de la|del|de|para el|para la|para|for|on)?\s*)?/, '')
    // «de mañana» → «mañana» (pero «del 1 al 15» es el rango).
    .replace(/^(?:de la|del|de|para el|para la|para|for|on|en|in)\s+(?=\S)(?!\d{1,2}(?:st|nd|rd|th)?\s+(?:de\s+\w+\s+)?(?:al|hasta|to)\b)/, '')
    .replace(/^(?:el dia|the day)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Lo que quedó suelto después de sacar la pestaña o el calendario («el», «de»).
  if (/^(?:(?:el|la|los|las|de|del|a|al|en|the|of|on|for|y)\s*)*$/.test(rest)) rest = '';
  let preset: Preset | undefined;
  let range: { from: Date; to: Date } | undefined;
  if (rest) {
    if (!DATE_ONLY_RE.test(rest)) return null;
    const bare = rest.replace(/^(?:el|la|the)\s+(?=(?:manana|hoy|tomorrow|today)$)/, '');
    preset = PRESETS.find(([re]) => re.test(rest) || re.test(bare))?.[1];
    const direction = /\b(?:pasad[oa]|anterior|ayer|last|previous|yesterday)\b/.test(rest) ? 'past' : 'future';
    // Un día («el martes», «el 15 de diciembre», «el 15», «pasado mañana»): ese día.
    const isDay = new RegExp(`\\b(?:${WEEKDAY_WORDS})\\b|^(?:(?:el|the)\\s+)?\\d{1,2}(?:st|nd|rd|th)?(?:\\s+(?:de\\s+|of\\s+)?(?:${MONTH_WORDS}))?$|^(?:${MONTH_WORDS})\\s+\\d{1,2}(?:st|nd|rd|th)?$|\\d{1,2}/\\d{1,2}|pasado manana|day after tomorrow|ayer|yesterday`).test(rest);
    if (!preset && isDay) {
      const day = parseSpokenDate(rest, direction);
      if (day) { const d = parseISO(day); range = { from: d, to: d }; }
    }
    if (!preset && !range) {
      const period = parsePeriod(rest);
      if (period?.kind === 'month' && !/\b\d{4}\b|ano pasado|last year/.test(rest)) {
        // En la agenda, «diciembre» es el que viene (no el del año pasado).
        const from = new Date(new Date().getFullYear(), period.from.getMonth(), 1);
        range = { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 0) };
      } else if (period && period.kind !== 'today') range = { from: period.from, to: period.to };
    }
    if (!preset && !range) return null;
  }
  if (askDate) return { op: 'set', view: null, read, askDate: true };
  if (!view && !preset && !range) return null;
  // «hoy» suelto sin verbo también vale (en Mi consultorio es la agenda de hoy).
  if (!hadVerb && !view && preset === 'today' && t !== 'hoy' && t !== 'today') return null;
  return { op: 'set', view, calendar, preset, range, read };
}

registerVoiceCommand<FilterParsed>({
  id: 'workspace.filter',
  domain: WORKSPACE_VOICE_DOMAIN,
  // Por encima de navegar: «mis calendarios» es la pestaña del panel, no el menú Calendarios.
  priority: 51,
  aux: true,
  match: (normalized) => { const b = ws(); return b ? parseWorkspaceFilter(normalized, b.calendars) : null; },
  run: async (parsed, ctx) => {
    let b = ws();
    if (!b) return;
    if (parsed.op === 'refresh') { b.refresh(); await say(ctx, T(ctx, 'refreshed')); return; }
    if (parsed.askDate) {
      // «Cambiá la fecha»: ¿a cuál? La respuesta se entiende como cualquier fecha de la agenda.
      for (let tries = 0; tries < 2; tries++) {
        const question = T(ctx, tries ? 'whichDateAgain' : 'whichDate');
        const answer = await ctx.ask({ title: T(ctx, 'title'), message: question, tone: 'info' }, question);
        const again = parseWorkspaceFilter(normalizeSpeech(answer), b.calendars);
        if (again?.op === 'set' && (again.preset || again.range)) { parsed = again; break; }
      }
      if (parsed.op !== 'set' || parsed.askDate) return;
    }
    const done: string[] = [];
    if (parsed.view === 'mine') { b.setViewMode('mine'); done.push(T(ctx, 'mine')); }
    if (parsed.view === 'calendar') {
      if (!b.calendars.length) { await say(ctx, T(ctx, 'noCalendars'), 'info'); return; }
      const key = parsed.calendar ? normalizeSpeech(parsed.calendar) : '';
      let cal = key ? b.calendars.find((c) => normalizeSpeech(c.name) === key) ?? b.calendars.find((c) => normalizeSpeech(c.name).includes(key) || key.includes(normalizeSpeech(c.name))) : undefined;
      // «mis calendarios» sin decir cuál: si ya hay uno elegido (o hay uno solo) se queda; si no, se pregunta.
      if (!cal && !key) cal = b.calendars.find((c) => c.id === b!.calendarId) ?? (b.calendars.length === 1 ? b.calendars[0] : undefined);
      if (!cal) {
        const question = T(ctx, 'whichCalendar');
        const index = await ctx.choose({ title: T(ctx, 'title'), message: question, tone: 'info', choices: b.calendars.map((c) => ({ label: c.name })) }, `${question} ${b.calendars.map((c, i) => `${i + 1}: ${c.name}`).join('. ')}.`);
        cal = b.calendars[index];
      }
      b.setCalendar(cal.id);
      done.push(T(ctx, 'calendarSet', { name: cal.name }));
    }
    if (parsed.preset) { b.setPreset(parsed.preset); done.push(T(ctx, `preset_${parsed.preset}`)); }
    else if (parsed.range) {
      b.setRange(parsed.range.from, parsed.range.to);
      const same = format(parsed.range.from, 'yyyy-MM-dd') === format(parsed.range.to, 'yyyy-MM-dd');
      done.push(same ? T(ctx, 'daySet', { day: format(parsed.range.from, 'dd/MM') }) : T(ctx, 'rangeSet', { from: format(parsed.range.from, 'dd/MM'), to: format(parsed.range.to, 'dd/MM') }));
    }
    if (parsed.read) {
      b = await loaded(ctx);
      if (!b) return;
      const list = sorted(b.appointments);
      if (!list.length) { await say(ctx, T(ctx, 'empty'), 'info'); return; }
      await say(ctx, T(ctx, 'list', { count: list.length, first: `${list[0].time} ${list[0].patient}` }), 'info', list.slice(0, 12).map((a) => ({ label: a.time, value: `${a.patient}${a.service ? ` · ${a.service}` : ''}` })));
      return;
    }
    await say(ctx, done.join(' '));
  },
});
