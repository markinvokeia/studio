import { extractSpokenTime, rawPhrase, type SpokenTime } from '@/lib/voice/commands/calendar-parse';

/**
 * Correcciones dichas con el formulario de la cita abierto (dar, editar, reprogramar), además de
 * doctor, tratamientos, día y hora (que lee readFormEdit): hora de fin, notas, consultorio,
 * paciente, y «guardar» / «cancelar». Texto normalizado (normalizeSpeech).
 */

const SAVE_RE = /^(?:(?:si|dale|ok|bueno)\s)?(?:guarda\w*|actualiza\w*|graba\w*|listo|lista|confirma\w*|termina\w*|asi esta bien|esta bien asi|save|update|done|confirm|finish|that s it|thats it|looks good)(?:\s(?:la|el|los|las|cambios|cita|turno|formulario|it|changes|the appointment))*$/;
const CANCEL_RE = /^(?:(?:no\s)?(?:cancela\w*|cerra\w*|cierra\w*|descarta\w*|no guardes|no la guardes|sali\w*|sal|cancel|discard|close|exit)(?:\s(?:la|el|sin guardar|todo|formulario|edicion|cita|cambios|it|without saving|the form|changes))*)$/;

/** «guardar», «actualizá», «listo», «save»: el botón Guardar del formulario. */
export function isFormSave(normalized: string): boolean {
  return SAVE_RE.test(normalized);
}

/** «cancelar», «cerrá sin guardar», «descartá», «cancel»: cerrar el formulario sin guardar. */
export function isFormCancel(normalized: string): boolean {
  return CANCEL_RE.test(normalized);
}

// ── Hora de fin ───────────────────────────────────────────────────────────────

const END_LEAD = /\s(?:que (?:termine|termina|finalice|acabe)|termina|termine|terminando|hasta|hora de fin(?: a)?|fin(?: a)?|ends?(?: at)?|ending(?: at)?|until|till)\s(?=(?:a las |a la |las |la |at )?\d|(?:a las |a la |las |la )?(?:una|mediodia|noon))/;

/** «que termine a las 12», «hasta las 11:30», «ends at noon». */
export function extractFormEndTime(normalized: string): { time: SpokenTime; rest: string } | null {
  const text = ` ${normalized} `;
  const lead = text.match(END_LEAD);
  if (!lead || lead.index === undefined) return null;
  const after = text.slice(lead.index + lead[0].length);
  const time = extractSpokenTime(` a las ${after.replace(/^(?:a las |a la |las |la |at )/, '')}`) ?? extractSpokenTime(` ${after}`);
  if (!time) return null;
  return { time: time.time, rest: `${text.slice(0, lead.index)} ${time.rest}`.replace(/\s+/g, ' ').trim() };
}

// ── Notas ─────────────────────────────────────────────────────────────────────

export interface FormNotesParsed {
  op: 'append' | 'replace' | 'clear';
  /** El texto a anotar, con tildes y mayúsculas como se dijo. */
  text: string;
}

const NOTES_CLEAR = /^(?:borra\w*|quita\w*|saca\w*|elimina\w*|limpia\w*|clear|remove|delete)(?:\s(?:las|la|todas las|the|all))?\s(?:notas?|notes?)$|^(?:sin notas?|no notes?)$/;
const NOTES_REPLACE = /^(?:(?:cambia\w*|reemplaza\w*|pone\w*|pon|change|replace|set)\s(?:las |la |the )?(?:notas?|notes?)\s(?:a|por|con|que digan?|to|with)?\s?|(?:las )?notas? (?:son|es|dice|que diga)\s|notes? (?:are|is|say)\s)/;
const NOTES_APPEND = /^(?:(?:(?:agrega\w*|anade\w*|anota\w*|pone\w*|pon|escribi\w*|escribe\w*|add|write|put)\s(?:(?:en|a)\s(?:las |la )?(?:notas?)|(?:una |la )?(?:notas?)|(?:a |in |to )?(?:the )?notes?|(?:a )?note)\s?(?:que dice|que diga|diciendo|que|de que|saying|that)?\s?)|(?:en (?:las )?notas?|in (?:the )?notes?)\s(?:pone\w*|pon|agrega\w*|anota\w*|escribi\w*|put|add|write)?\s?(?:que)?\s?|notas?\s|notes?\s|note\s)/;

/** «nota: viene con la madre», «agregá en notas que trae estudios», «borrá las notas». */
export function parseFormNotes(normalized: string, raw: string): FormNotesParsed | null {
  if (NOTES_CLEAR.test(normalized)) return { op: 'clear', text: '' };
  for (const [re, op] of [[NOTES_REPLACE, 'replace'], [NOTES_APPEND, 'append']] as const) {
    const found = normalized.match(re);
    if (!found) continue;
    const said = normalized.slice(found[0].length).trim();
    if (!said) return null;
    const text = rawPhrase(raw, said);
    return { op, text: text.charAt(0).toUpperCase() + text.slice(1) };
  }
  return null;
}

// ── Consultorio / agenda ──────────────────────────────────────────────────────

const CALENDAR_MENTION = /\s(?:en (?:el |la )?|al |a la |con (?:el |la )?|in (?:the )?|at (?:the )?)?(consultorio|sillon|box|gabinete|sala|agenda|calendario|chair|room|office|calendar)\s((?:[a-z0-9]+)(?: [a-z0-9]+)?)(?=\s|$)/;

/** «en el sillón 2», «consultorio 3», «agenda ortodoncia»: lo dicho y el resto de la frase. */
export function extractFormCalendar(normalized: string): { said: string; rest: string } | null {
  const text = ` ${normalized} `;
  const found = text.match(CALENDAR_MENTION);
  if (!found || found.index === undefined) return null;
  const said = `${found[1]} ${found[2]}`.trim();
  const rest = `${text.slice(0, found.index)} ${text.slice(found.index + found[0].length)}`.replace(/\s+/g, ' ').trim();
  return { said, rest };
}

// ── Paciente ──────────────────────────────────────────────────────────────────

const PATIENT_CHANGE = /^(?:(?:cambia\w*|pone\w*|pon|change|set)\s(?:el |la |the )?(?:paciente|patient)\s(?:a|por|to)?\s?|(?:el |la |the )?(?:paciente|patient)\s(?:es|sera|is)\s|(?:es |para )?(?:el |la )?paciente\s|(?:patient)\s)/;

/** «el paciente es Juan Pérez», «cambiá el paciente a Ana»: el nombre dicho. */
export function parseFormPatient(normalized: string): string | null {
  const found = normalized.match(PATIENT_CHANGE);
  if (!found) return null;
  const name = normalized.slice(found[0].length).trim();
  return name && name.split(' ').length <= 5 ? name : null;
}
