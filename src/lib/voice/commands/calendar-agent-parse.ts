import { addDays, addMonths, addWeeks, format, startOfToday } from 'date-fns';

import { extractAppointmentRef, extractSpokenDate, type CalendarAppointmentRef } from '@/lib/voice/commands/calendar-parse';

import type { CalendarVoiceSettingKey } from '@/lib/types';

/**
 * Intérprete local de la barra, el panel, el engranaje, exportar, seleccionar citas y pacientes
 * (ver docs/voz-agenda.md §2 y §3). Todo en español e inglés, sobre texto normalizado
 * (normalizeSpeech: minúsculas, sin tildes ni puntuación, números en dígitos).
 */

const has = (text: string, re: RegExp) => re.test(` ${text} `);
const OFF_WORDS = /\s(?:desactiva\w*|apaga\w*|saca\w*|quita\w*|sin|no|deshabilita\w*|elimina\w*|permiti\w*|permite|deja\w* de|turn off|disable|off|without|stop|dont|do not)\s/;

// ── Zoom ──────────────────────────────────────────────────────────────────────

export interface CalendarZoomParsed {
  op: 'in' | 'out' | 'max' | 'min' | 'reset' | 'set';
  /** set: porcentaje (30–250). */
  level?: number;
  /** in / out: pasos de 10 %. */
  amount: number;
}

const ZOOM_OBJECT = '(?:\\s(?:el|la|un|una|mas|mucho|bastante|poco|todo|al|a|the|it|a bit|a lot|zoom|agenda|calendario|vista|pantalla|grilla|calendar|view|screen|\\d+ veces|\\d+ times|veces|times))*';
const ZOOM_IN = new RegExp(`^(?:(?:make (?:it|everything|the calendar) )?(?:bigger|larger)|(?:sube\\w*|subi\\w*) (?:el |un |mas )?zoom|(?:haz|hace|hacer|hacele|dale|pone\\w*|pon|mas|aumenta\\w*|agranda\\w*|amplia\\w*|acerca\\w*|zoom in|zoom|enlarge|bigger|closer|increase)(?: (?:el |un |mas |de )?zoom)?|mas grande|mas cerca|zoom mas)${ZOOM_OBJECT}$`);
const ZOOM_OUT = new RegExp(`^(?:(?:make (?:it|everything|the calendar) )?smaller|(?:baja\\w*) (?:el |un )?zoom|(?:menos|reduc\\w*|disminu\\w*|achica\\w*|aleja\\w*|zoom out|smaller|decrease|shrink)(?: (?:el |un |de )?zoom)?|mas chico|mas pequeno|mas lejos|menos zoom|zoom menos)${ZOOM_OBJECT}$`);
const ZOOM_MAX = /\b(?:maximo|maxima|max|todo lo posible|al tope|lo mas grande(?: posible)?|del todo|all the way(?! out)|maximum|biggest|as big as possible|as large as possible)\b/;
const ZOOM_MIN = /\b(?:minimo|minima|min|lo mas chico(?: posible)?|lo mas pequeno(?: posible)?|all the way out|minimum|smallest|as small as possible)\b/;

export function parseCalendarZoom(normalized: string): CalendarZoomParsed | null {
  const text = normalized;
  const mentionsZoom = /\bzoom\b/.test(text);
  if (mentionsZoom && /\b(?:normal|original|por defecto|reinicia\w*|resetea\w*|reset|restablece\w*|default)\b|\bzoom (?:al |a |en )?100\b/.test(text)) return { op: 'reset', amount: 0 };
  if (mentionsZoom) {
    const level = text.match(/\b(\d{2,3})(?: por ciento| porciento| percent| %)?\b/);
    if (level) {
      const n = Number(level[1]);
      if (n >= 30 && n <= 250) return { op: 'set', level: n, amount: 0 };
    }
  }
  const zoomish = mentionsZoom || /^(?:acerca|aleja|agranda|achica|amplia|aumenta|reduc|disminu|lo mas grande|lo mas chico|lo mas pequeno|mas grande|mas chico|bigger|smaller|enlarge|shrink|as big|as small|as large|make it)/.test(text);
  if (zoomish && ZOOM_MAX.test(text) && !/\bout\b/.test(text)) return { op: 'max', amount: 0 };
  if (zoomish && ZOOM_MIN.test(text)) return { op: 'min', amount: 0 };
  const amount = /\b(?:mucho|bastante|a lot|much)\b/.test(text) ? 3 : Number(text.match(/\b(\d) (?:veces|times)\b/)?.[1] ?? 1);
  if (ZOOM_OUT.test(text)) return { op: 'out', amount: Math.min(10, Math.max(1, amount)) };
  if (ZOOM_IN.test(text)) return { op: 'in', amount: Math.min(10, Math.max(1, amount)) };
  return null;
}

// ── Panel de agendas ──────────────────────────────────────────────────────────

export type CalendarPanelOp = 'open' | 'close' | 'pin' | 'unpin';

const PANEL_WORD = /\b(?:panel(?: de (?:las )?agendas)?|barra lateral|barra de agendas|lateral|costado|sidebar|side panel|agendas al costado|lista de agendas)\b/;

/** «dejá fijo el panel», «que se esconda solo», «abrí el panel de agendas», «pin the sidebar». */
export function parseCalendarPanelOp(normalized: string): CalendarPanelOp | null {
  if (!PANEL_WORD.test(normalized)) return null;
  const t = ` ${normalized} `;
  if (/\s(?:suelta\w*|solta\w*|desfija\w*|desancla\w*|unpin|auto ?hide)\s|\s(?:que )?(?:el panel |la barra |el lateral )?se (?:cierre|esconda|oculte) sol[oa]\s|\sno (?:lo |la )?(?:dejes|deje|quede) fij[oa]\s|\sque no (?:quede|este) fij[oa]\s|\sno (?:mas )?fij[oa]\s/.test(t)) return 'unpin';
  if (/\s(?:fija\w*|ancla\w*|pin|pinea\w*)\s|\sdeja\w* (?:el |la )?(?:panel |barra )?fij[oa]\s|\sque (?:quede|este|se quede) (?:fij[oa]|abiert[oa])\s|\sque (?:el panel |la barra )?no se (?:cierre|esconda|oculte)\s|\skeep (?:it |the panel |the sidebar )?open\s/.test(t)) return 'pin';
  if (/\s(?:cerra\w*|cierra\w*|oculta\w*|esconde\w*|saca\w*|quita\w*|close|hide|collapse)\s/.test(t)) return 'close';
  if (/\s(?:abri\w*|abre\w*|mostra\w*|muestra\w*|despliega\w*|open|show|expand)\s/.test(t)) return 'open';
  return null;
}

// ── Opciones («¿qué vistas hay?») ─────────────────────────────────────────────

export type CalendarOptionsOf = 'views' | 'calendars' | 'doctors' | 'sedes';

export function parseCalendarOptions(normalized: string): CalendarOptionsOf | null {
  const t = normalized;
  // «poné vista de día»: ya dice cuál (es el comando de vista).
  if (/\b(?:dia|diaria|semana|semanal|mes|mensual|lista|agenda|ano|day|week|month|list|year|[2-6] dias|[2-6] days?)\b/.test(t.replace(/^.*?\bvista\b/, ''))) {
    if (/\b(?:vista|view)\b/.test(t) && !/\b(?:que|cuales|which|what)\b/.test(t)) return null;
  }
  if (/^(?:(?:que|cuales|cual|cuantas) (?:son las )?(?:vistas|opciones de vista|formas de ver)|como (?:puedo|se puede|lo puedo) ver|de que (?:forma|manera) (?:puedo ver|se puede ver)|(?:cambia\w*|pone\w*|elegi\w*) (?:la |de )?vista|otra vista|ver de otra (?:forma|manera)|(?:what|which) views|change (?:the )?view|other view)(?:\s|$)/.test(t)) return 'views';
  if (/^(?:(?:que|cuales|cuantas) (?:agendas|consultorios|sillones|calendarios|boxes)|(?:cambia\w*|pasa\w*|elegi\w*) (?:de |la |otra )?agenda|otra agenda|(?:what|which) calendars|switch (?:the )?calendar|change (?:the )?calendar|other calendar)(?:\s(?:hay|tengo|tenemos|are there|do we have))?$/.test(t)) return 'calendars';
  if (/^(?:que|cuales|cuantos) (?:doctores|doctoras|profesionales|odontologos)(?: hay| tengo| tenemos| atienden)?$|^(?:which|what) doctors/.test(t)) return 'doctors';
  if (/^(?:que|cuales|cuantas) (?:sedes|sucursales|clinicas)(?: hay| tengo| tenemos)?$|^(?:which|what) (?:sites|branches)/.test(t)) return 'sedes';
  return null;
}

// ── Engranaje: preferencias ───────────────────────────────────────────────────

export interface CalendarSettingParsed {
  setting: CalendarVoiceSettingKey;
  /** El valor según la clave; hour_height acepta 'up' | 'down' | 'max' | 'min'. default_sede: nombre dicho o 'all'. */
  value: string | number | boolean | null;
  weekdays?: number[];
  weekdayOp?: 'hide' | 'show' | 'set';
  /** visible_hours custom. */
  start?: string;
  end?: string;
}

export interface CalendarSettingsParsed {
  /** Abrir / cerrar el engranaje (sin cambiar nada). */
  open?: boolean;
  changes: CalendarSettingParsed[];
}

const SETTINGS_WORD = /\b(?:configuracion|ajustes|engranaje|preferencias|opciones de (?:la )?(?:agenda|calendario)|settings|preferences|gear)\b/;

const DEFAULT_VIEW_WORDS: Array<[RegExp, string]> = [
  [/\b(?:2 dias|dos dias|2 days|two days)\b/, '2_days'],
  [/\b(?:3 dias|tres dias|3 days|three days)\b/, '3_days'],
  [/\b(?:semana|semanal|week|weekly)\b/, 'week'],
  [/\b(?:mes|mensual|month|monthly)\b/, 'month'],
  [/\b(?:agenda|lista|list|schedule)\b/, 'agenda'],
  [/\b(?:dia|diaria|day|daily)\b/, 'day'],
];

const WEEKDAY_WORDS: Array<[RegExp, number[]]> = [
  [/\b(?:fin(?:es)? de semana|weekends?)\b/, [6, 0]],
  [/\b(?:domingos?|sundays?)\b/, [0]],
  [/\b(?:lunes|mondays?)\b/, [1]],
  [/\b(?:martes|tuesdays?)\b/, [2]],
  [/\b(?:miercoles|wednesdays?)\b/, [3]],
  [/\b(?:jueves|thursdays?)\b/, [4]],
  [/\b(?:viernes|fridays?)\b/, [5]],
  [/\b(?:sabados?|saturdays?)\b/, [6]],
];

const LABEL_PARTS: Array<[RegExp, 'time' | 'patient' | 'notes' | 'treatment']> = [
  [/\b(?:hora|horario|time)\b/, 'time'],
  [/\b(?:paciente|nombre|patient|name)\b/, 'patient'],
  [/\b(?:notas?|notes?)\b/, 'notes'],
  [/\b(?:tratamientos?|servicios?|treatments?|services?)\b/, 'treatment'],
];
const LABEL_FORMATS: Array<[string, string[]]> = [
  ['time_patient_notes', ['time', 'patient', 'notes']],
  ['patient_treatment_time', ['patient', 'treatment', 'time']],
  ['time_patient_notes_treatment', ['time', 'patient', 'notes', 'treatment']],
  ['time_treatment_patient_notes', ['time', 'treatment', 'patient', 'notes']],
];

/** Formato del título según el orden en que se nombraron hora, paciente, notas y tratamiento. */
export function eventLabelFromWords(text: string): string | null {
  const found = LABEL_PARTS
    .map(([re, part]) => ({ part, index: text.search(re) }))
    .filter((x) => x.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((x) => x.part);
  if (found.length < 2) {
    if (/\b(?:tratamiento|servicio|treatment)\w* (?:primero|adelante|first)\b/.test(text)) return 'time_treatment_patient_notes';
    if (/\b(?:paciente|patient) (?:primero|adelante|first)\b/.test(text)) return 'patient_treatment_time';
    return null;
  }
  const exact = LABEL_FORMATS.find(([, seq]) => seq.join() === found.join());
  if (exact) return exact[0];
  // El que más partes comparte en el mismo orden.
  const score = (seq: string[]) => {
    let i = 0;
    for (const part of seq) if (found[i] === part) i++;
    return i - Math.abs(seq.length - found.length) * 0.1;
  };
  return [...LABEL_FORMATS].sort((a, b) => score(b[1]) - score(a[1]))[0][0];
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Hora para la franja visible (cada 30 min; 24:00 vale como fin). */
function visibleHour(hour: number, minute: number): string {
  const total = Math.round((hour * 60 + minute) / 30) * 30;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function parseVisibleRange(text: string): { start: string; end: string } | null {
  const m = text.match(/\b(?:de|desde|from|entre)\s(?:las |la )?(\d{1,2})(?: (\d{2}))?(?: (?:hs|horas))?\s(?:a|hasta|y|to|until)\s(?:las |la )?(\d{1,2})(?: (\d{2}))?\b/);
  if (!m) return null;
  let sh = Number(m[1]);
  let eh = Number(m[3]);
  const sm = Number(m[2] ?? 0);
  const em = Number(m[4] ?? 0);
  if (sh > 24 || eh > 24) return null;
  // «de 8 a 6» es hasta las 18.
  if (eh <= sh && eh + 12 <= 24) eh += 12;
  if (sh < 6 && eh > 12) sh += 0;
  if (eh * 60 + em <= sh * 60 + sm) return null;
  return { start: visibleHour(sh, sm), end: visibleHour(eh, em) };
}

function boolOf(text: string): boolean {
  return !OFF_WORDS.test(` ${text} `);
}

/** Lo que se pide del engranaje: abrir/cerrar y/o cambiar una o varias preferencias. */
export function parseCalendarSettings(normalized: string): CalendarSettingsParsed | null {
  const t = normalized;
  const changes: CalendarSettingParsed[] = [];
  let open: boolean | undefined;
  const mentionsSettings = SETTINGS_WORD.test(t);
  if (mentionsSettings) {
    if (/^(?:cerra\w*|cierra\w*|oculta\w*|close|hide)\b/.test(t)) open = false;
    else if (/^(?:abri\w*|abre\w*|mostra\w*|muestra\w*|anda a|ir a|ve a|open|show|go to)\b/.test(t)) open = true;
  }

  // Modo de la agenda.
  if (/\b(?:modo|vista|mode|view) (?:personalizad[oa]|custom)\b|\bcustom (?:mode|view)\b/.test(t)) changes.push({ setting: 'mode', value: 'custom' });
  else if (/\b(?:modo|vista|mode|view) (?:invoke|invok|invoque|clasic[oa]|normal)\b|\b(?:invoke|invoque) (?:mode|view)\b/.test(t)) changes.push({ setting: 'mode', value: 'invoke' });

  // Vista predeterminada.
  if (/\b(?:predeterminad[oa]|por defecto|default|inicial|al (?:entrar|abrir)|que (?:arranque|empiece|abra|inicie)|start(?:s)? (?:in|on|with))\b/.test(t)) {
    if (/\b(?:agrupa\w*|group\w*)\b/.test(t)) {
      const group = /\b(?:doctor|doctores|profesional)/.test(t) ? 'doctor' : /\b(?:agenda|agendas|consultorio|calendar)/.test(t) ? 'calendar' : /\b(?:sin|ninguno|nada|none|no)\b/.test(t) ? 'none' : null;
      if (group) changes.push({ setting: 'grouped_by', value: group });
    } else if (!/\bsede\b|\bsite\b|\bbranch\b/.test(t)) {
      const view = DEFAULT_VIEW_WORDS.find(([re]) => re.test(t));
      if (view) changes.push({ setting: 'default_view', value: view[1] });
    }
  }

  // Altura de la hora.
  if (/\b(?:altura|alto|tamano|height)(?: de)? (?:la |las |de la |de las )?(?:hora|horas|fila|filas|hour|hours|rows?)\b|\b(?:hora|horas|filas) mas (?:alta|altas|baja|bajas|grande|grandes|chica|chicas|pequena|pequenas)\b|\bhour height\b|\b(?:taller|shorter|bigger|smaller) hours?\b/.test(t)) {
    const px = t.match(/\b(\d{2,3})(?: px| pixeles| pixels)?\b/);
    const n = px ? Number(px[1]) : NaN;
    const value: string | number | null = /\b(?:la mas (?:grande|alta)|maxima|maximo|biggest|tallest|max)\b/.test(t) ? 'max'
      : /\b(?:la mas (?:chica|baja|pequena)|minima|minimo|smallest|shortest|min)\b/.test(t) ? 'min'
        : Number.isFinite(n) && n >= 60 && n <= 200 ? n
          : /\b(?:mas (?:alta|altas|grande|grandes)|aumenta\w*|agranda\w*|subi\w*|sube\w*|taller|bigger|increase)\b/.test(t) ? 'up'
            : /\b(?:mas (?:baja|bajas|chica|chicas|pequena|pequenas)|achica\w*|reduc\w*|baja\w*|shorter|smaller|decrease)\b/.test(t) ? 'down'
              : null;
    if (value !== null) changes.push({ setting: 'hour_height', value });
  }

  // Duración del slot.
  if (/\b(?:slots?|intervalos?|celdas?|bloques?|franjas? de (?:\d+ min\w*|media hora|una hora)|duracion del (?:slot|turno|intervalo)|slot duration)\b/.test(t)) {
    const minutes = /\b(?:una hora|1 hora|60|an hour|one hour|hourly)\b/.test(t) ? 60 : /\b(?:media hora|half (?:an )?hour)\b/.test(t) ? 30 : /\bcuarto de hora\b/.test(t) ? 15 : Number(t.match(/\b(5|10|15|20|30)\b/)?.[1]);
    if ([5, 10, 15, 20, 30, 60].includes(minutes)) changes.push({ setting: 'slot_duration', value: minutes });
  }

  // Sede por defecto.
  if (/\bsede (?:por defecto|predeterminada|inicial)\b|\bdefault (?:site|branch)\b|\b(?:por defecto|predeterminada) (?:la )?sede\b/.test(t)) {
    if (/\b(?:todas|toda la clinica|todas las sedes|all|every)\b/.test(t)) changes.push({ setting: 'default_sede', value: 'all' });
    else {
      const name = t.replace(/^.*?\b(?:sede (?:por defecto|predeterminada|inicial)|default (?:site|branch)|(?:por defecto|predeterminada) (?:la )?sede)\b\s*(?:es |sea |a |en |la |el |to |is )*/, '').trim();
      if (name) changes.push({ setting: 'default_sede', value: name });
    }
  }

  // Formato del título de la cita.
  if (/\b(?:titulo|formato|texto|etiqueta|label|title)(?: de (?:la |las )?citas?| del evento| de la cita)?\b/.test(t) && !/\bnota:/.test(t)) {
    const format = eventLabelFromWords(t);
    if (format) changes.push({ setting: 'event_label_format', value: format });
  }

  // Ocultar / mostrar días de la semana.
  const days = WEEKDAY_WORDS.filter(([re]) => re.test(t)).flatMap(([, d]) => d);
  // «los sábados», «los viernes», «domingos», «weekends»: los días de la semana (no un día puntual).
  const pluralDays = /\blos (?:lunes|martes|miercoles|jueves|viernes|sabados|domingos)\b|\b(?:sabados|domingos|fines de semana|weekends?|sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)\b/.test(t);
  if (/^(?:mostra\w*|muestra\w*|show) (?:todos los dias|toda la semana|all (?:the )?days)$/.test(t)) {
    changes.push({ setting: 'hidden_weekdays', value: null, weekdays: [], weekdayOp: 'set' });
  } else if (days.length && /\b(?:oculta\w*|esconde\w*|no (?:muestres|mostrar|quiero ver)|que no se vea\w*|hide|don t show|do not show|stop showing)\b/.test(t)) {
    changes.push({ setting: 'hidden_weekdays', value: null, weekdays: [...new Set(days)], weekdayOp: 'hide' });
  } else if (days.length && pluralDays && /\b(?:mostra\w*|muestra\w*|volve\w* a mostrar|que se vea\w*|agrega\w*|show|unhide)\b/.test(t)) {
    changes.push({ setting: 'hidden_weekdays', value: null, weekdays: [...new Set(days)], weekdayOp: 'show' });
  }

  // Franja horaria visible.
  const visibleContext = /\b(?:franja|horario|horas?|rango) (?:visible|visibles|que se ve\w*|a mostrar|de la agenda)\b|\bvisible hours\b|\b(?:franja|horario|rango) (?:completa|completo|personalizad[oa]|de la clinica)\b|\bhorario de (?:la )?clinica\b|\bclinic hours\b|\b(?:vista|dia|jornada) completa\b|\bfull day\b|\btodo el dia\b|\b24 horas\b|\brango personalizado\b|\bcustom range\b/.test(t);
  if (visibleContext && !/\b(?:bloquea|habilita|block|enable)\w*/.test(t)) {
    const range = parseVisibleRange(t);
    if (/\b(?:clinica|clinic)\b/.test(t)) changes.push({ setting: 'visible_hours', value: 'clinic' });
    else if (range) changes.push({ setting: 'visible_hours', value: 'custom', start: range.start, end: range.end });
    else if (/\b(?:personalizad[oa]|custom)\b/.test(t)) changes.push({ setting: 'visible_hours', value: 'custom' });
    else if (/\b(?:completa|completo|todo el dia|24 horas|full)\b/.test(t)) changes.push({ setting: 'visible_hours', value: 'full' });
  }

  // Interruptores.
  const flags: Array<[RegExp, CalendarVoiceSettingKey]> = [
    [/\bcolou?r(?:es)? (?:por |segun (?:el )?)(?:el )?estados?\b|\bcolou?r by status\b|\bcolores de estado\b/, 'color_by_status'],
    [/\b(?:verifica\w*|chequea\w*|controla\w*|revisa\w*|comproba\w*|check(?:ing)?) (?:la |the )?disponibilidad\b|\b(?:check|verify) availability\b|\bavailability check\b|\bverificar disponibilidad\b/, 'check_availability'],
    [/\b(?:bloquea\w*|block) (?:lo de )?(?:fuera de|out of|outside)(?: (?:los|el))? (?:horarios?|hours|office hours)\b|\bfuera de horario\b|\bout of (?:office )?hours\b/, 'block_unavailable'],
    [/\bfiltra\w* (?:los |a los )?(?:doctores|profesionales) por (?:servicio|tratamiento)\w*\b|\bfilter doctors by (?:service|treatment)\b|\bdoctores por servicio\b/, 'filter_doctors_by_service'],
    [/\b(?:crea\w*|crear|dar|da) (?:las |la )?citas? (?:en|desde) (?:el calendario|la agenda|la grilla|linea)\b|\bcreacion en linea\b|\binline (?:creation|appointments?)\b|\b(?:sin|con) (?:el )?modal\b|\b(?:que )?abra el modal\b/, 'inline_appointment_creation'],
    [/\bvista previa(?: en vivo)?\b|\blive preview\b|\bprevisualizacion\b/, 'inline_draft_live_preview'],
  ];
  for (const [re, key] of flags) {
    if (!re.test(t)) continue;
    let on = boolOf(t);
    if (key === 'block_unavailable' && /\b(?:permiti\w*|permite|deja\w* agendar|allow)\b/.test(t)) on = false;
    if (key === 'inline_appointment_creation' && /\b(?:con (?:el )?modal|abra el modal)\b/.test(t)) on = false;
    if (key === 'inline_appointment_creation' && /\bsin (?:el )?modal\b/.test(t)) on = true;
    changes.push({ setting: key, value: on });
  }

  if (!changes.length && open === undefined) return null;
  return { open, changes };
}

// ── Exportar agenda ───────────────────────────────────────────────────────────

export interface CalendarExportParsed {
  preset: 'day' | 'week' | 'month' | 'custom' | null;
  anchor: string | null;
  from: string | null;
  to: string | null;
  /** Agendas o sedes nombradas (se buscan en las listas). */
  names: string[];
  /** «todas las agendas». */
  all: boolean;
  /** La frase (normalizada): si no se dijo «sede» ni «agenda», se buscan sus nombres en ella. */
  text: string;
}

const EXPORT_VERB = /^(?:exporta\w*|descarga\w*|baja\w*|imprimi\w*|imprime\w*|genera\w*|saca\w*|pasa\w* a excel|export|download|print|generate)(?=\s|$)/;
const EXPORT_OBJECT = /\s(?:agenda|calendario|citas|turnos|planilla|excel|listado|lista|schedule|calendar|appointments|spreadsheet)\s/;
const MONTH_NAMES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december';

/** «exportá la agenda de la semana que viene de la sede Centro», «del 1 al 15 de diciembre». */
export function parseCalendarExport(normalized: string, today: Date = startOfToday()): CalendarExportParsed | null {
  if (!EXPORT_VERB.test(normalized) || !has(normalized, EXPORT_OBJECT)) return null;
  return readExportDetails(normalized, today);
}

/** Período, fechas y agendas dichos (también como corrección con el diálogo abierto). */
export function readExportDetails(normalized: string, today: Date = startOfToday()): CalendarExportParsed {
  const t = ` ${normalized} `;
  const key = (d: Date) => format(d, 'yyyy-MM-dd');
  const out: CalendarExportParsed = { preset: null, anchor: null, from: null, to: null, names: [], all: false, text: normalized };

  const range = t.match(new RegExp(String.raw`\s(?:del|desde el|de el|from(?: the)?)\s(\d{1,2})(?: de (${MONTH_NAMES}))?\s(?:al|hasta el|a el|to(?: the)?|until(?: the)?)\s(\d{1,2})(?: de (${MONTH_NAMES}))?(?=\s)`));
  if (range) {
    const toMonth = range[4] ?? range[2] ?? null;
    const fromMonth = range[2] ?? toMonth;
    const from = extractSpokenDate(` el ${range[1]}${fromMonth ? ` de ${fromMonth}` : ''} `, 'nearest', today);
    const to = extractSpokenDate(` el ${range[3]}${toMonth ? ` de ${toMonth}` : ''} `, 'nearest', today);
    if (from && to) {
      out.preset = 'custom';
      out.from = from.date;
      out.to = to.date;
    }
  }
  if (!out.preset) {
    if (/\s(?:semana que viene|proxima semana|semana proxima|semana siguiente|next week)\s/.test(t)) { out.preset = 'week'; out.anchor = key(addWeeks(today, 1)); }
    else if (/\s(?:semana pasada|semana anterior|last week)\s/.test(t)) { out.preset = 'week'; out.anchor = key(addWeeks(today, -1)); }
    else if (/\s(?:semana|semanal|week|weekly)\s/.test(t)) { out.preset = 'week'; out.anchor = key(today); }
    else if (/\s(?:mes que viene|proximo mes|mes proximo|mes siguiente|next month)\s/.test(t)) { out.preset = 'month'; out.anchor = key(addMonths(today, 1)); }
    else if (/\s(?:mes pasado|mes anterior|last month)\s/.test(t)) { out.preset = 'month'; out.anchor = key(addMonths(today, -1)); }
    else if (new RegExp(String.raw`\s(?:de |del mes de |for |el mes de )(?:${MONTH_NAMES})\s`).test(t) && !/\s(?:el|del) \d{1,2} de /.test(t)) {
      const month = t.match(new RegExp(`(${MONTH_NAMES})`))![1];
      const d = extractSpokenDate(` el 1 de ${month} `, 'nearest', today);
      if (d) { out.preset = 'month'; out.anchor = d.date; }
    } else if (/\s(?:mes|mensual|month|monthly)\s/.test(t)) { out.preset = 'month'; out.anchor = key(today); }
    else if (/\s(?:pasado manana|day after tomorrow)\s/.test(t)) { out.preset = 'day'; out.anchor = key(addDays(today, 2)); }
    else if (/\s(?:manana|tomorrow)\s/.test(t)) { out.preset = 'day'; out.anchor = key(addDays(today, 1)); }
    else if (/\s(?:hoy|today|del dia|de el dia)\s/.test(t)) { out.preset = 'day'; out.anchor = key(today); }
    else {
      const d = extractSpokenDate(t, 'nearest', today);
      if (d) { out.preset = d.unit ?? 'day'; out.anchor = d.date; }
    }
  }

  if (/\s(?:todas las (?:agendas|sedes)|todos los (?:consultorios|calendarios)|toda la clinica|all (?:the )?(?:calendars|sites))\s/.test(t)) out.all = true;
  const names = [...t.matchAll(/\s(?:sede|sucursal|agenda|agendas|consultorio|sillon|box|gabinete|calendario|site|branch|calendar|chair|room)\s([a-z0-9]+(?: [a-z0-9]+)?)(?=\s(?:y|e|and|,|de|del|para|$)|\s*$)/g)]
    .map((m) => m[0].trim())
    // «agenda del mes», «agenda de hoy», «agenda para mañana» no nombran una agenda.
    .filter((n) => !/\b(?:todas|todos|all)\b/.test(n) && !/^\S+ (?:de|del|la|el|los|las|para|a|al|y|en|for|of|the|this|next|to|hoy|manana|semana|mes)\b/.test(n));
  out.names = [...new Set(names)];
  return out;
}

// ── Seleccionar una cita ──────────────────────────────────────────────────────

const SELECT_LEAD = /^(?:(?:anda|ve|ir|vamos|lleva\w*|mostra\w*|muestra\w*|selecciona\w*|elegi\w*|elige|marca\w* como seleccionada|ubica\w*|encontra\w*|resalta\w*|enfoca\w*|go to|take me to|show me|show|select|pick|highlight|focus(?: on)?)\s(?:a\s|al\s|me\s)?)?(?:la |el |esa |ese |the )?(?:cita|turno|appointment)\s(?:de\s|del\s|de la\s|con\s|of\s|for\s|with\s)?/;

/** «la cita de Ana», «andá a la cita de las 10», «seleccioná la de Pérez del jueves». */
export function parseCalendarSelect(normalized: string, today: Date = startOfToday()): CalendarAppointmentRef | null {
  const lead = normalized.match(SELECT_LEAD) ?? normalized.match(/^(?:selecciona\w*|elegi\w*|elige|select)\s(?:la |el |a la |a el )?(?:de\s)?/);
  if (!lead) return null;
  const rest = ` ${normalized.slice(lead[0].length)} `;
  const ref = extractAppointmentRef(rest, 'nearest', today);
  return ref.patient || ref.time ? ref : null;
}

// ── Pacientes ─────────────────────────────────────────────────────────────────

export interface CalendarPatientFindParsed {
  name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
}

const FIND_PATIENT = /^(?:busca\w*|encontra\w*|ubica\w*|trae\w*|traeme|quiero ver|abri\w*|abre\w*|mostra\w*|muestra\w*|find|search(?: for)?|look up|look for|open|show)\s(?:me\s)?(?:al |a la |a |el |la |the )?(?:(?:paciente|patient)|(?:la )?(?:informacion|info|ficha|datos) (?:del|de la|de|of|on)(?: (?:paciente|patient))?)\s/;

/** Documento, email o teléfono dichos como respuesta o en el pedido. */
export function readPatientIdentifiers(normalized: string): Omit<CalendarPatientFindParsed, 'name'> {
  const t = ` ${normalized} `;
  const email = t.match(/\s([a-z0-9._-]+)\s(?:arroba|at)\s([a-z0-9-]+)\s(?:punto|dot)\s([a-z]{2,6})(?:\s(?:punto|dot)\s([a-z]{2,3}))?(?=\s)/);
  const digits = t.replace(/(\d)\s(?=\d)/g, '$1').match(/\b(\d{6,15})\b/);
  const isDoc = /\s(?:cedula|ci|documento|dni|rut|pasaporte|id|identity|document|passport)\s/.test(t);
  const isPhone = /\s(?:telefono|celular|movil|cel|tel|whatsapp|phone|mobile|cell)\s/.test(t);
  return {
    email: email ? `${email[1]}@${email[2]}.${email[3]}${email[4] ? `.${email[4]}` : ''}` : null,
    document: digits && (isDoc || (!isPhone && digits[1].length <= 9)) ? digits[1] : null,
    phone: digits && (isPhone || (!isDoc && digits[1].length > 9)) ? digits[1] : null,
  };
}

export function parseCalendarPatientFind(normalized: string): CalendarPatientFindParsed | null {
  const lead = normalized.match(FIND_PATIENT);
  if (!lead) return null;
  const rest = normalized.slice(lead[0].length).trim();
  if (!rest) return null;
  const ids = readPatientIdentifiers(rest);
  const name = ids.document || ids.email || ids.phone
    ? null
    : rest.replace(/\b(?:por favor|please)\b/g, '').trim() || null;
  return { name, ...ids };
}

export interface CalendarPatientAskParsed {
  question: string;
  /** Paciente nombrado (si no, la cita en foco). */
  ref: CalendarAppointmentRef | null;
}

const ASK_LEAD = /^(?:(?:dame|decime|dime|haceme|hazme|hace|haz|quiero|necesito|armame|arma|prepara\w*|give me|tell me|make me|i need|i want)\s(?:me\s)?(?:un |una |el |la |a |an )?(?:resumen|summary|sintesis|repaso|brief|overview|informe)\b|^(?:resumi\w*|resume\w*|resumen|summarize|summary)\b)/;
const ASK_QUESTION = /^(?:cuanto (?:debe|adeuda|tiene de saldo|le falta pagar)|que (?:debe|adeuda|saldo tiene|tratamientos tiene|tratamientos le faltan|le falta|le hicimos|le hicieron|alergias tiene|medicacion toma|medicamentos toma|antecedentes tiene|presupuestos tiene)|tiene (?:deuda|saldo|alergias|presupuestos?|pagos pendientes|tratamientos pendientes)|cuando (?:vino|fue|estuvo) por ultima vez|cual es (?:su|el) saldo|como (?:va|esta) (?:su|el) tratamiento|cuantas (?:citas|veces) (?:tiene|vino)|how much does (?:he|she|the patient|it) owe|what (?:does (?:he|she) owe|treatments|allergies)|does (?:he|she|the patient) (?:owe|have)|when was (?:he|she|the patient) (?:last|here))/;
const TOPIC_WORDS = /\b(?:parte|financier[oa]s?|finanzas|cuenta|cuentas|deuda|deudas|pagos?|saldo|tratamientos?|citas?|historia|historial|clinic[oa]|presupuestos?|plan|odontograma|alergias|medicacion|ultima|visita|financial|treatments?|appointments?|history|balance|payments?|debt)\b/;

/** «dame un resumen del paciente», «resumen de Ana Gómez», «¿cuánto debe?». */
/** La pregunta en el medio: «la de las 3 tiene algo pendiente de pagar», «Juan debe algo». */
const ASK_INSIDE = /\s(?:tiene (?:algo )?(?:pendiente|deuda|saldo|para pagar|que pagar|presupuestos?|tratamientos? pendientes?)|debe (?:algo|plata|dinero)|adeuda|owes?(?: anything| money)?|has (?:an? )?(?:outstanding )?balance)\b/;

export function parseCalendarPatientAsk(normalized: string, today: Date = startOfToday()): CalendarPatientAskParsed | null {
  const inside = ` ${normalized}`.match(ASK_INSIDE);
  if (inside && inside.index !== undefined && !ASK_LEAD.test(normalized) && !ASK_QUESTION.test(normalized)) {
    const before = ` ${normalized}`.slice(0, inside.index);
    const parsed = extractAppointmentRef(` ${before.replace(/^\s*(?:y |che |dime |decime )?/, '')} `, 'nearest', today);
    return { question: normalized, ref: parsed.patient || parsed.time ? parsed : null };
  }
  const question = normalized.match(ASK_QUESTION);
  if (!ASK_LEAD.test(normalized) && !question) return null;
  // «cuánto debe Juan Pérez»: lo que sigue a la pregunta es el paciente.
  const about = normalized.match(/\s(?:de|del|sobre|acerca de|of|on|about|for)\s(.+)$/)
    ?? (question ? [question[0], normalized.slice(question[0].length).trim()] as const : null);
  let ref: CalendarAppointmentRef | null = null;
  if (about && about[1]) {
    const said = about[1].replace(/^(?:el |la |este |esta |ese |esa |the |this )?(?:paciente|patient)\s?/, '').trim();
    if (said && !TOPIC_WORDS.test(said) && said.split(' ').length <= 4) {
      const parsed = extractAppointmentRef(` ${said} `, 'nearest', today);
      if (parsed.patient || parsed.time) ref = parsed;
    }
  }
  return { question: normalized, ref };
}
