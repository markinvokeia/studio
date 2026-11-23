import { normalizeSpeech } from '@/lib/voice/parse';

/**
 * Palabra de activación del modo «siempre escuchando» («Invoke …») y las frases de control de la
 * conversación (seguir lo que se estaba haciendo, cancelarlo). Todo sobre texto normalizado.
 *
 * El reconocedor (sobre todo en español) transcribe «Invoke» de muchas formas: «invok», «invoque»,
 * «inbok», «imbok», «embok», «in voke», «invocar»… y a veces con «hey», «oye» u «ok» delante.
 */

const LEAD = new Set(['hey', 'ey', 'hei', 'oye', 'oi', 'ok', 'okay', 'okey', 'hola', 'hello', 'hi', 'che', 'a', 'eh']);
/**
 * Cómo suena «Invoke» para el reconocedor: in/im/en + bo/vo/po + (k, ke, que, x, c, ca, car…).
 * Cubre invoke, invok, invoque, invoca, invocar, inbox, imbox, inbook, envoke. Se prueba
 * con la primera palabra o con las dos primeras juntas («in voke», «in box»).
 */
// Sin «invoice»: choca con el pedido de facturar («invoice Juan Pérez»).
const WAKE_TOKEN = /^[ie][nm][bvp]o{1,2}(?:[kcxq][a-z]{0,3}|s)?$/;
/** «Invoke IA»: la sigla que a veces sigue a la palabra. */
const IA_TAIL = /^(?:ia|i a|y a|e a|ai)(?=\s|$)\s?/;

export interface WakeMatch {
  /** La frase nombró al asistente. */
  woke: boolean;
  /** Lo que sigue a la palabra de activación (normalizado); la frase entera si no la hubo. */
  rest: string;
  /** Lo mismo sin normalizar (conserva tildes y mayúsculas para títulos y notas). */
  restRaw: string;
}

/** Cuántas palabras del principio son la palabra de activación (0 si no la hay). */
function wakeLength(words: string[]): number {
  let i = 0;
  if (LEAD.has(words[0]) && words.length > 1) i = 1;
  if (words[i] && WAKE_TOKEN.test(words[i])) return i + 1;
  if (words[i] && words[i + 1] && WAKE_TOKEN.test(words[i] + words[i + 1])) return i + 2;
  return 0;
}

/** «Invoke, andá al jueves» (o «Inbox IA andá al jueves») → { woke: true, rest: 'anda al jueves' }. */
export function extractWake(raw: string): WakeMatch {
  const normalized = normalizeSpeech(raw);
  const words = normalized.split(' ').filter(Boolean);
  let skip = wakeLength(words);
  // «Invoke mode», «vista Invoke»: es el nombre del modo, no la palabra de activación.
  if (skip && /^(?:mode|modo|view|vista)$|^(?:mode|modo)\b/.test(words.slice(skip).join(' '))) skip = 0;
  if (!skip) return { woke: false, rest: normalized, restRaw: raw.trim() };
  let rest = words.slice(skip).join(' ');
  const ia = rest.match(IA_TAIL);
  if (ia) {
    rest = rest.slice(ia[0].length).trim();
    skip += ia[0].trim().split(' ').length;
  }
  // En el texto original se saltean tantas palabras como ocupó la activación.
  const rawWords = raw.trim().split(/\s+/).filter((w) => normalizeSpeech(w));
  const restRaw = rawWords.slice(skip).join(' ').replace(/^[\s,.;:!¡?¿-]+/, '');
  return { woke: true, rest, restRaw };
}

const RESUME_RE = /^(?:(?:bueno|dale|ok|y)\s)?(?:sigamos|seguimos|segui|sigue|continua|continuemos|continuamos|continuar|retoma|retomemos|retomamos|volvamos a lo (?:de antes|anterior|que estabamos(?: haciendo)?)|(?:en )?que estabamos(?: haciendo)?|donde estabamos|lo de antes|lo que estabamos(?: haciendo)?|vamos a continuar|continue|go on|keep going|carry on|resume|where were we|lets continue|let s continue)(?:\s(?:con (?:eso|lo anterior|lo de antes|lo que estabamos(?: haciendo)?)|por favor|please|then))?$/;

/** «sigamos», «¿en qué estábamos?», «continue»: retomar la tarea guardada. */
export function isResumePhrase(normalized: string): boolean {
  return RESUME_RE.test(normalized);
}

const CANCEL_RE = /^(?:(?:no\s)?(?:cancela|cancelar|cancelalo|cancelala|cancela eso|cancela todo|para|pare|pará|basta|olvidalo|olvidate|olvida eso|deja(?:lo)? (?:asi|ahi|eso)|no importa|nada|dejalo|stop|cancel(?: that| it)?|never ?mind|forget it|abort|quit))$/;

/** «cancelá», «olvidalo», «stop»: cortar lo que se está haciendo (la frase entera es eso). */
export function isCancelPhrase(normalized: string): boolean {
  return CANCEL_RE.test(normalized);
}

const STOP_LISTENING_RE = /^(?:(?:ya |bueno |listo |ok |okay )?(?:deja|deje|dejar|para|pare|parar|pausa|pausar|pauza|detene|detener|frena|frenar|corta|cortar|termina|terminar|apaga|apagar|cerra|cerrar|desactiva|desactivar)(?:\s(?:de|el|la|los|ya))*\s(?:escuchar|escucharme|escuchando|dictar|dictado|el dictado|grabar|microfono|el microfono|la voz|voz|oir|oirme)|(?:no )?(?:me )?escuches mas|no escuches mas|silencio microfono|microfono (?:apagado|off)|stop (?:listening|dictation|dictating|recording)|pause (?:listening|dictation|the mic|the microphone)|turn off (?:the )?(?:mic|microphone|voice|listening)|mic off|mute (?:the )?(?:mic|microphone)|stop the (?:mic|microphone)|that s all|thats all|that all|you can stop listening|dejame tranquilo|eso es todo|nada mas por ahora)(?:\s(?:por favor|please|por ahora|for now|gracias|thanks))*$/;

/** «dejá de escuchar», «pausá el dictado», «apagá el micrófono», «stop listening»: apagar la escucha. */
export function isStopListeningPhrase(normalized: string): boolean {
  return STOP_LISTENING_RE.test(normalized);
}

const FORGET_FOCUS_RE = /^(?:olvida(?:te)?(?: de)? (?:esa|la|esta) cita|otra cita|suelta la cita|deja la cita|forget (?:that|the|this) appointment|another appointment)$/;

/** «olvidá esa cita», «otra cita»: limpiar el foco. */
export function isForgetFocusPhrase(normalized: string): boolean {
  return FORGET_FOCUS_RE.test(normalized);
}

/**
 * Verbos con los que empieza un pedido nuevo (no una respuesta). Con una pregunta abierta, una
 * frase corta que no empieza así se toma como respuesta («Ana Gómez», «el jueves», «a las 10»).
 */
const COMMAND_START_RE = /^(?:anda|andate|ve|vete|vamos|volve|vuelve|mostra\w*|muestra\w*|abri\w*|abre\w*|cerra\w*|cierra\w*|busca\w*|pone\w*|pon|ponle|cambia\w*|pasa\w*|saca\w*|agrega\w*|oculta\w*|esconde\w*|escondé|zoom|acerca\w*|aleja\w*|agranda\w*|achica\w*|exporta\w*|descarga\w*|imprimi\w*|actualiza\w*|refresca\w*|recarga\w*|edita\w*|borra\w*|elimina\w*|cancela\w*|marca\w*|bloquea\w*|habilita\w*|fija\w*|suelta\w*|agrupa\w*|filtra\w*|ordena\w*|limpia\w*|selecciona\w*|reprograma\w*|mueve\w*|dame|decime|dime|resumi\w*|resume\w*|activa\w*|desactiva\w*|configura\w*|nueva|nuevo|crea\w*|agenda\w*|recorda\w*|recuerda\w*|go|show|open|close|find|search|set|change|move|add|remove|hide|export|download|print|refresh|reload|edit|delete|mark|block|enable|pin|unpin|group|filter|sort|unhide|clear|select|reschedule|give|tell|summarize|turn|create|book|schedule|remind)(?=\s|$)/;

export function looksLikeCommand(normalized: string): boolean {
  return COMMAND_START_RE.test(normalized);
}

export const wordCount = (normalized: string) => (normalized ? normalized.split(' ').length : 0);

/**
 * Varios pedidos en una frase («la cita de Juan, marcala como llegó y abrí su cuenta», «andá a
 * mañana, poneme día y mostrame los huecos»): se arma el plan con la IA en vez de tomar solo una
 * parte con el intérprete local. `raw` conserva las comas.
 */
export function isCompoundRequest(raw: string): boolean {
  const parts = raw
    .split(/[,;]/)
    .flatMap((p) => normalizeSpeech(p).split(/\s(?:y despues|y luego|despues|luego|y tambien|y|e|and then|then|and)\s/))
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) return true;
  return parts.length >= 2 && parts.slice(1).some((p) => looksLikeCommand(p.replace(/^(?:que |tambien |ademas |also )/, '')));
}
