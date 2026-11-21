import { requestInterpretation } from '@/lib/voice/ai';
import { registerVoiceDomain } from '@/lib/voice/registry';
import { isValidTooth, type VoiceCommand as PerioVoiceCommand, type VoiceFlag, type VoiceLine } from '@/lib/perio/voice';

import type { PerioFurcationEntry, PerioSide, PerioToothStatus, VoiceInterpretation } from '@/lib/types';
import type { PerioSiteIndex } from '@/lib/perio/teeth';

/**
 * Periodontograma por voz: el dictado continuo (PerioVoiceBar) le pregunta a la IA solo cuando el
 * intérprete local (src/lib/perio/voice.ts) no entendió la frase. La IA devuelve los mismos
 * comandos que arma el intérprete, con la posición de la sonda como contexto, y acá se revalidan:
 * lo que no cierra se descarta. Confirmar, descartar y parar el dictado nunca vienen de la IA; el
 * estado de una pieza y copiar del examen anterior sí, pero la pantalla pregunta antes.
 */
export const PERIO_VOICE_DOMAIN = 'perio';

/** Lo que se le cuenta a la IA: dónde está la sonda y qué piezas hay. Sin datos del paciente. */
export interface PerioAiContext {
  pass: 'ps' | 'mg' | 'fm';
  /** Línea activa: valores (profundidad o margen) o una fila de marcas. */
  line: 'value' | 'bop' | 'sup' | 'plaque';
  cursor: { tooth: number; side: PerioSide; site: 'distal' | 'center' | 'mesial' } | null;
  /** Pieza activa en la pasada de furcas y movilidad. */
  fm_tooth: number | null;
  focus: 'auto' | 'U' | 'L' | 'both';
  teeth: { present: number[]; implants: number[]; missing: number[]; pontics: number[] };
  implants_only: boolean;
  /** La clínica dice la recesión en negativo ("menos 2"). */
  margin_negative: boolean;
}

export interface PerioAiResult {
  commands: PerioVoiceCommand[];
}

/** Comandos por frase y valores por comando: más es una respuesta rara. */
const MAX_COMMANDS = 20;
const MAX_VALUES = 48;

const SIDES: PerioSide[] = ['v', 'i'];
const LINES: VoiceLine[] = ['ps', 'mg', 'bop', 'sup', 'plaque'];
const FLAGS: VoiceFlag[] = ['bop', 'sup', 'plaque'];
const PASSES = ['ps', 'mg', 'fm'] as const;
const FOCUS = ['auto', 'U', 'L', 'both'] as const;
const ENTRIES: PerioFurcationEntry[] = ['v', 'mp', 'dp', 'l'];
const STATUSES: PerioToothStatus[] = ['present', 'missing', 'implant', 'pontic'];
const COPIES = ['ps', 'mg', 'fm', 'all'] as const;
const QUERIES = ['previous', 'current', 'missing'] as const;

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined => (list.includes(value as T) ? (value as T) : undefined);
const int = (value: unknown, min: number, max: number): number | undefined => {
  const n = Number(value);
  return value != null && value !== '' && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};
const tooth = (value: unknown) => {
  const n = int(value, 11, 48);
  return n != null && isValidTooth(n) ? n : undefined;
};
const sites = (value: unknown): PerioSiteIndex[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list = [...new Set(value.map((v) => int(v, 0, 2)).filter((v): v is PerioSiteIndex => v != null))];
  return list.length ? list : undefined;
};
/** Sin las claves vacías: el motor distingue "no se dijo" de un valor. */
const compact = <T extends object>(command: T): T => Object.fromEntries(Object.entries(command).filter(([, v]) => v !== undefined)) as T;

function sanitizeCommand(raw: unknown): PerioVoiceCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  switch (c.kind) {
    case 'values': {
      const values = (Array.isArray(c.values) ? c.values : []).slice(0, MAX_VALUES).map((v) => int(v, -10, 15)).filter((v): v is number => v != null);
      return values.length ? { kind: 'values', values } : null;
    }
    case 'answer':
      return typeof c.on === 'boolean' ? { kind: 'answer', on: c.on } : null;
    case 'same':
    case 'undo':
    case 'redo':
    case 'delete':
      return { kind: c.kind };
    case 'goto': {
      const command = compact({ kind: 'goto' as const, tooth: tooth(c.tooth), side: oneOf(SIDES, c.side), sites: sites(c.sites), line: oneOf(LINES, c.line) });
      return command.tooth != null || command.side || command.line ? command : null;
    }
    case 'neighbour':
      return c.delta === 1 || c.delta === -1 ? { kind: 'neighbour', delta: c.delta } : null;
    case 'flag': {
      const flag = oneOf(FLAGS, c.flag);
      if (!flag) return null;
      return compact({ kind: 'flag' as const, flag, on: c.on !== false, tooth: tooth(c.tooth), side: oneOf(SIDES, c.side), sites: sites(c.sites) });
    }
    case 'pass': {
      const pass = oneOf(PASSES, c.pass);
      return pass ? { kind: 'pass', pass } : null;
    }
    case 'focus': {
      const focus = oneOf(FOCUS, c.focus);
      return focus ? { kind: 'focus', focus } : null;
    }
    case 'mobility': {
      const value = int(c.value, 0, 3);
      return value != null ? compact({ kind: 'mobility' as const, tooth: tooth(c.tooth), value }) : null;
    }
    case 'furcation': {
      const grade = int(c.grade, 0, 3);
      return grade != null ? compact({ kind: 'furcation' as const, tooth: tooth(c.tooth), entry: oneOf(ENTRIES, c.entry), grade }) : null;
    }
    // Estado de una pieza y copiar del examen anterior: la pantalla siempre pregunta antes.
    case 'status': {
      const t = tooth(c.tooth);
      const status = oneOf(STATUSES, c.status);
      return t != null && status ? { kind: 'status', tooth: t, status } : null;
    }
    case 'copy': {
      const what = oneOf(COPIES, c.what);
      return what ? { kind: 'copy', what } : null;
    }
    // Preguntas: no escriben nada.
    case 'query': {
      const what = oneOf(QUERIES, c.what);
      return what ? compact({ kind: 'query' as const, what, tooth: tooth(c.tooth) }) : null;
    }
    // confirm, discard y stop solo se dicen: la IA no los puede pedir.
    default:
      return null;
  }
}

/** Revalida lo que devolvió voice/interpret: solo comandos que el motor sabe correr, en rango. */
export function sanitizePerioAiResult(raw: unknown): PerioAiResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.commands) ? r.commands.slice(0, MAX_COMMANDS) : [];
  return { commands: list.map(sanitizeCommand).filter((c): c is PerioVoiceCommand => c != null) };
}

registerVoiceDomain<PerioAiResult>({
  id: PERIO_VOICE_DOMAIN,
  // La IA del periodontograma la llama su dictado con la posición de la sonda, nunca la sesión general.
  ai: { sanitize: (raw) => sanitizePerioAiResult(raw), accepts: () => false },
});

/** La frase que el intérprete local no entendió, a la IA con la posición de la sonda. */
export function interpretPerioPhrase(text: string, options: { locale: string; signal?: AbortSignal; context: PerioAiContext }): Promise<VoiceInterpretation<PerioAiResult>> {
  return requestInterpretation<PerioAiResult>(PERIO_VOICE_DOMAIN, text, { ...options, context: { ...options.context } });
}
