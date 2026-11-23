import { parseSpokenDate } from '@/lib/voice/parse';

/**
 * Qué se pidió sobre una orden de laboratorio, a partir de lo dicho (ya normalizado). Separado del
 * comando para poder probarlo sin la API.
 */

export type LabIntent = 'send' | 'received' | 'complete' | 'cancel' | 'next' | 'move' | 'open';

export interface LabVoiceParsed {
  orderId: number;
  intent: LabIntent | null;
  /** Texto normalizado sin "orden 45": de ahí salen la etapa, las fechas y el laboratorio. */
  rest: string;
  /** Lo que habla de la fecha de entrega ("entrega el viernes"), aparte de cuándo pasó. */
  duePart: string | null;
  /** Ya resuelto por la IA (frases que el intérprete local no entendió). */
  targetStageId?: number | null;
  effectiveDate?: string | null;
  dueDate?: string | null;
  laboratoryId?: string | null;
}

export const ORDER_RE = /\b(?:orden|ordenes|order|pedido)\s+(?:de laboratorio\s+)?(?:numero\s+|number\s+|nro\s+|n\s+)?#?\s*(\d{1,7})\b/;
const DUE_RE = /\b(?:entrega|entregar|entregan|entregaria|vence|para el|para la|due|deliver(?:y|ed by)?|promised)\b/;

const INTENTS: [LabIntent, RegExp][] = [
  ['cancel', /\b(cancel|anul)\w*/],
  ['open', /^(?:abri|abre|abrir|abrime|mostra|mostrame|mostrar|ver|open|show)\b/],
  ['received', /\b(lleg|recib|volvi|vino|devolvi|arriv|receiv|came back|got back)\w*/],
  ['complete', /\b(complet|termin|finaliz|entregad|instalad|colocad|cementad|finish|deliver(?:ed)? to)\w*/],
  ['send', /\b(envi|mand|despach|sent|send|ship)\w*/],
  ['next', /\b(siguiente|avanz|next|advance)\w*/],
  ['move', /\b(pasa|pasala|pasar|pasamos|mueve|movela|mover|move|pone|ponela|poner|cambia|cambiala|a la etapa|to stage)\b/],
];

export function parseLabOrderVoice(normalized: string): LabVoiceParsed | null {
  const order = normalized.match(ORDER_RE);
  if (!order) return null;
  const orderId = Number(order[1]);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const rest = normalized.replace(order[0], ' ').replace(/\s+/g, ' ').trim();
  const due = rest.match(DUE_RE);
  const duePart = due && due.index !== undefined ? rest.slice(due.index) : null;
  const main = due && due.index !== undefined ? rest.slice(0, due.index) : rest;
  const intent = INTENTS.find(([, re]) => re.test(main))?.[0] ?? null;
  return { orderId, intent, rest: main, duePart };
}

// ── Consultar, editar y filtrar ──────────────────────────────────────────────

const STATUS_RE = /\b(donde esta|en que (etapa|anda|esta|va)|como (va|viene|esta|anda)|que paso con|estado de|status|where is|what stage|how is)\b/;

/** "¿Dónde está la orden 45?" → el número. */
export function parseLabOrderStatus(normalized: string): { orderId: number } | null {
  const order = normalized.match(ORDER_RE);
  if (!order || !STATUS_RE.test(normalized)) return null;
  const orderId = Number(order[1]);
  return Number.isInteger(orderId) && orderId > 0 ? { orderId } : null;
}

export interface LabEditParsed {
  orderId: number;
  /** Nueva entrega: la fecha, o 'ask' si se pidió cambiarla sin una fecha que se entienda. */
  due?: string | 'ask';
  urgent?: boolean;
  /** Nota a agregar, o 'ask' si se pidió anotar sin decir qué. */
  note?: string | 'ask';
}

const NOTE_RE = /\b(nota|notas|anota|anotale|anotar|anotame|observacion|note|add a note)\b/;
const URGENT_OFF_RE = /\b(no es|ya no|no mas|saca|sacale|quita|quitale|desmarca|desmarcala|sin|not|no longer|remove|unmark)\b.*\burgent/;
const DUE_CHANGE_RE = /\b(cambi|mov|pas|pon|corr|posterg|adelant|atras)\w*\s+(?:la\s+)?(?:fecha\s+de\s+)?(entrega|vencimiento)\b|\b(change|move)\s+(?:the\s+)?(due date|delivery)\b/;

/** El texto de la nota tal como se dictó (con mayúsculas y acentos), sin "a la orden 45". */
function noteText(raw: string): string {
  // Sin \b al final: después de una vocal con tilde ("anotá") no hay límite de palabra en JS.
  const keyword = raw.match(/(?:notas?|anot[aá](?:le|me|r)?|observaci[oó]n|note)(?![\wáéíóúñ])/i);
  if (!keyword || keyword.index === undefined) return '';
  return raw.slice(keyword.index + keyword[0].length)
    .replace(/^\s*(?:a|en|to|on)?\s*(?:la\s+|the\s+)?(?:orden|order|pedido)\s*(?:n[uú]mero\s*|number\s*|nro\.?\s*)?#?\s*[\wáéíóú]+(?:\s+y\s+\w+)?\s*/i, '')
    .replace(/^\s*(?:que\s+(?:diga|dice)|diciendo|saying|que|:|,|-)\s*/i, '')
    .trim()
    .replace(/^["«“]|["»”]$/g, '')
    .trim();
}

/**
 * "la 45 la entregan el lunes", "cambiá la entrega de la orden 45 al viernes", "la orden 45 es
 * urgente", "la orden 45 ya no es urgente", "anotale a la orden 45 que el color es A2".
 */
export function parseLabOrderEdit(normalized: string, raw: string, today = new Date()): LabEditParsed | null {
  const order = normalized.match(ORDER_RE);
  if (!order) return null;
  const orderId = Number(order[1]);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const move = parseLabOrderVoice(normalized);
  const generic = !move?.intent || move.intent === 'move';
  const result: LabEditParsed = { orderId };

  if (NOTE_RE.test(normalized)) {
    result.note = noteText(raw) || 'ask';
    return result;
  }
  if (generic && /\burgent/.test(normalized)) result.urgent = !URGENT_OFF_RE.test(normalized);
  const dueChange = DUE_CHANGE_RE.test(normalized);
  if ((move?.duePart && !move.intent) || dueChange) {
    const part = move?.duePart ?? normalized;
    result.due = parseSpokenDate(part, 'future', today) ?? 'ask';
  }
  return result.due !== undefined || result.urgent !== undefined ? result : null;
}

export interface LabListParsed {
  overdue: boolean;
  urgent: boolean;
  dueToday: boolean;
  view: 'list' | 'board' | null;
  clear: boolean;
  count: boolean;
  /** Paciente o laboratorio nombrado ("las de Ana Pérez"), sin resolver. */
  who: string | null;
  /** Se dijo "laboratorio": `who` es un laboratorio. */
  whoIsLab: boolean;
  /** Ya resueltos (por la IA). */
  laboratoryId?: string | null;
}

const LIST_VERB_RE = /\b(mostra|mostrame|mostrar|ver|veo|filtra|filtrame|filtrar|busca|buscame|lista|listame|cuales|cuantas|cuantos|que ordenes|abri|abrime|show|list|filter|how many|which|open)\b/;
const LIST_NOUN_RE = /\b(orden|ordenes|order|orders|pedido|pedidos|trabajos|laboratorio|tablero|board)\b/;
const CLEAR_RE = /\b(saca|sacame|quita|quitame|limpia|borra|clear|remove|reset)\w*\s+(?:los\s+|the\s+)?(filtros|filters)\b|\bsin filtros\b|\btodas las ordenes\b|\ball (the )?orders\b/;
const LIST_CREATE_RE = /\b(crea|crear|creame|nueva|nuevo|carga|cargar|cargame|registra|haceme|create|new)\b/;

export function parseLabOrdersList(normalized: string): LabListParsed | null {
  if (ORDER_RE.test(normalized) || LIST_CREATE_RE.test(normalized)) return null;
  // «mostrá la columna Laboratorio», «show the Lab column»: es de la tabla, no de la lista de órdenes.
  if (/\b(?:columna|column)\b/.test(normalized)) return null;
  const clear = CLEAR_RE.test(normalized);
  if (!clear && !(LIST_VERB_RE.test(normalized) && LIST_NOUN_RE.test(normalized))) return null;
  const overdue = /\b(atrasad|vencid|retrasad|demorad|overdue|late)\w*/.test(normalized);
  const urgent = /\burgent\w*/.test(normalized);
  const dueToday = /\b(entreg|vence|vencen|llegan|due)\w*\s+(?:para\s+)?(?:hoy|today)\b|\bpara hoy\b/.test(normalized);
  const view = /\b(tablero|board|kanban|columnas)\b/.test(normalized) ? 'board' : /\b(en (?:la |una )?lista|como lista|list view|as a list)\b/.test(normalized) ? 'list' : null;
  const count = /\b(cuantas|cuantos|how many)\b/.test(normalized);
  const whoMatch = normalized.match(/\b(?:de|del|para|for|from|of)\s+(?:la\s+|el\s+|los\s+)?(?:paciente\s+|patient\s+)?((?:laboratorio|lab)\s+)?(.+)$/);
  let who: string | null = null;
  let whoIsLab = false;
  if (whoMatch) {
    const cleaned = whoMatch[2]
      .replace(/\b(en (?:el |la |una )?(?:tablero|lista|board|list)|que (?:estan|son|hay)|atrasad\w*|vencid\w*|urgent\w*|hoy|today|pendientes?|por favor|please)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const bare = /^(laboratorio|laboratorios|lab|labs|ordenes|orden|orders|entrega|hoy|today)$/.test(cleaned);
    if (cleaned && !bare && cleaned.length > 1) {
      who = cleaned;
      whoIsLab = Boolean(whoMatch[1]);
    }
  }
  return { overdue, urgent, dueToday, view, clear, count, who, whoIsLab };
}

// ── Editar una orden existente en el asistente ───────────────────────────────

export interface LabEditOrderParsed {
  orderId: number;
  /**
   * Lo que se pidió cambiar además de "editá la orden 45" (la frase entera, como se dijo), o null
   * si solo se pidió abrirla para editar. Se toma como la primera corrección.
   */
  change: string | null;
}

const EDIT_VERB_RE = /\b(edita|editar|editame|editala|editamela|editemos|modifica|modificar|modificame|modificala|corregi|corregir|corrige|corregila|corregime|edit|modify)\b/;
/** Cambios que solo se hacen en el asistente: trabajos, piezas, paciente, laboratorio o descripción. */
const EDIT_CHANGE_RE = new RegExp([
  /\b(agreg\w*|anad\w*|sumale)\b/.source,
  /\b(saca\w*|quita\w*|borra\w*|cambi\w*)\s+(?:el|la|los|las|the)\s+(?!etapa\b|fecha\b|entrega\b|urgen|nota|orden|order|pedido)\w+/.source,
  /\b(piezas?|dientes?|muelas?|descripcion|cantidad|tooth|teeth)\b/.source,
  // Otro paciente, no "se la entregamos al paciente".
  /\b(?:otro|otra|nuevo|cambi\w*(?:\s+(?:de|el))?)\s+(?:paciente|patient)\b|\b(?:paciente|patient)\s+(?:es|correcto|equivocado|is)\b/.source,
  // "la orden 45 es para María López" / "es de Dental Sur" (no "es para el viernes").
  /\bes (?:para|de) (?!el\b|la\b|los\b|las\b|hoy\b|manana\b|pasado\b|lunes|martes|miercoles|jueves|viernes|sabado|domingo|\d)/.source,
].join('|'));
/** Lo que no dice nada además del verbo y el número ("editá la orden 45, por favor"). */
const EDIT_FILLER_RE = /\b(la|el|los|las|lo|de|del|a|al|y|que|por|favor|porfa|quiero|necesito|vamos|podes|puedes|me|the|please|i|want|to|nro|numero|number)\b/g;

/**
 * "editá la orden 45", "modificá la 45: agregale un perno en la 21", "a la orden 45 sacale la
 * corona", "la orden 45 es para María López". Lo simple (entrega, urgente, nota) va por el camino
 * corto de parseLabOrderEdit, sin abrir el asistente.
 */
export function parseLabOrderEditOpen(normalized: string, raw: string): LabEditOrderParsed | null {
  const order = normalized.match(ORDER_RE);
  if (!order) return null;
  const orderId = Number(order[1]);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const verb = EDIT_VERB_RE.test(normalized);
  // "agregale una nota a la orden 45" es una nota, no una edición del trabajo.
  const withoutNote = normalized.replace(/\b(agreg\w*|anad\w*|sumale)\s+(?:una\s+|la\s+)?nota\b/g, ' ');
  const change = EDIT_CHANGE_RE.test(withoutNote);
  if (!verb && !change) return null;
  // "la 45 ya se la entregamos al paciente", "llegó la 45 con las piezas": es un movimiento de etapa.
  const moveIntent = parseLabOrderVoice(normalized)?.intent;
  if (!verb && moveIntent && moveIntent !== 'move') return null;
  if (change) return { orderId, change: raw };
  const rest = normalized.replace(order[0], ' ').replace(EDIT_VERB_RE, ' ').replace(EDIT_FILLER_RE, ' ').trim();
  return { orderId, change: rest ? raw : null };
}

// ── Correcciones a la orden abierta (alta o edición) ─────────────────────────

/**
 * Lo que se dijo en vez de "sí" mientras se pregunta "¿La creo?" / "¿Guardo los cambios?" ("que sea urgente", "no la
 * envíes", "al laboratorio Dental Sur", "entrega el viernes", "anotá color A2"). Solo lo simple:
 * trabajos, piezas y paciente los interpreta la IA.
 */
export interface DraftEditParsed {
  urgent?: boolean;
  send?: boolean;
  /** Entrega: la fecha, o 'ask' si se habló de la entrega sin una fecha que se entienda. */
  due?: string | 'ask';
  clearLab?: boolean;
  /** Laboratorio nombrado, sin resolver. */
  labName?: string;
  note?: string;
}

/** Habla de trabajos, piezas o el paciente: eso lo resuelve la IA (también lo simple de la misma frase). */
const DRAFT_COMPLEX_RE = /\b(agreg\w*|sum\w*|anad\w*|borr\w*|elimin\w*|piezas?|dientes?|muelas?|paciente|cantidad|trabajos?|add|tooth|teeth|patient|quantity)\b|\b(saca|sacale|quita|quitale|remove)\s+(?:el|la|los|las|the)\s+(?!laboratorio|lab\b|urgen)|\ben (?:la|el) \d{2}\b/;
const DRAFT_URGENT_RE = /\burgen\w*/;
const DRAFT_URGENT_OFF_RE = /\b(no sea|no es|no lo es|no la marques|ya no|no mas|saca\w*|quita\w*|desmarca\w*|sin|not|no longer|remove|unmark)\b.*\burgen|\bno urgen/;
const DRAFT_SEND_OFF_RE = /\b(no la envi\w*|no la mand\w*|no enviar\w*|no mandar\w*|sin enviar\w*|que no se envie|no se envia|solo crea\w*|dont send|don t send|do not send|without sending)\b/;
const DRAFT_SEND_ON_RE = /\b(enviala|enviarla|envia la|mandala|mandarla|despachala|que se envie|send it|and send)\b/;
const DRAFT_DUE_RE = /\b(entrega|entregan|entregar|entregaria|vence|due|delivery|deliver)\b|\bpara (?:el |la )?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|pasado manana|\d{1,2})\b/;
const DRAFT_CLEAR_LAB_RE = /\b(sin laboratorio|(?:saca|sacale|quita|quitale|borra)\s+(?:el\s+)?laboratorio|no (?:tiene|lleva) laboratorio|without (?:a )?lab|remove the lab)\b/;
const DRAFT_LAB_RE = /\b(?:laboratorio|lab)\s+(?!de\b|que\b)(.+)$/;

export function parseDraftEdit(normalized: string, raw: string, today = new Date()): DraftEditParsed | null {
  if (NOTE_RE.test(normalized)) {
    const note = noteText(raw);
    return note ? { note } : null;
  }
  if (DRAFT_COMPLEX_RE.test(normalized)) return null;
  const result: DraftEditParsed = {};
  if (DRAFT_URGENT_RE.test(normalized)) result.urgent = !DRAFT_URGENT_OFF_RE.test(normalized);
  if (DRAFT_SEND_OFF_RE.test(normalized)) result.send = false;
  else if (DRAFT_SEND_ON_RE.test(normalized)) result.send = true;
  if (DRAFT_CLEAR_LAB_RE.test(normalized)) {
    result.clearLab = true;
  } else {
    const lab = normalized.match(DRAFT_LAB_RE);
    const name = lab?.[1].split(/\s+(?:y|con|entrega|para|que|and|with)\s+/)[0].trim();
    if (name && name.length > 1) result.labName = name;
  }
  const due = normalized.match(DRAFT_DUE_RE);
  if (due && due.index !== undefined && result.send !== false) {
    result.due = parseSpokenDate(normalized.slice(due.index), 'future', today) ?? 'ask';
  }
  return Object.keys(result).length > 0 ? result : null;
}
