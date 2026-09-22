/**
 * Acceso tipado al registro de preguntas.
 *
 * `questions.json` lo genera `scripts/parse-manual.mjs` desde el manual; acá
 * solo se lee. Ningún spec debe inventar un id: `requireQuestion()` explota al
 * cargar el módulo si el id no existe, así que un error de tipeo se descubre
 * cuando Playwright colecta los tests, no cuando ya se grabaron 40 videos.
 */
import registry from '../questions.json';

export type Filmability =
  | 'ui'
  | 'ui-mutating'
  | 'setup-heavy'
  | 'out-of-band'
  | 'conceptual'
  | 'diagnostic';

export interface Question {
  id: string;
  slug: string;
  title: string;
  part: { n: number | null; title: string };
  section: string;
  sourceLine: number;
  permissions: string[];
  routes: string[];
  seeAlso: string[];
  hasImagePlaceholder: boolean;
  filmability: Filmability;
  filmabilityReason: string;
  filmabilitySource: 'heuristic' | 'override';
  status: string;
  video: string;
}

export const QUESTIONS = registry.questions as Question[];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

/** Categorías que sí se graban. */
export const FILMABLE: readonly Filmability[] = ['ui', 'ui-mutating', 'setup-heavy'];

export function isFilmable(q: Question): boolean {
  return FILMABLE.includes(q.filmability);
}

/** Devuelve la pregunta o falla ruidosamente. */
export function requireQuestion(id: string): Question {
  const q = BY_ID.get(id);
  if (!q) {
    throw new Error(
      `[help_invokeia] El id "${id}" no existe en questions.json. ` +
        `Corré "pnpm help:parse" si acabás de editar el manual.`,
    );
  }
  return q;
}

/** Rótulo que encabeza el cartel de título del video. */
export function kickerFor(q: Question): string {
  return q.part.n === null ? q.part.title : `Parte ${q.part.n} · ${q.part.title}`;
}

/**
 * Nombre del archivo de video para un grupo de preguntas.
 *
 * Un video puede responder hasta dos preguntas de la misma subsección. La regla
 * es puramente mecánica —ids en orden + slug de la primera— para que el fixture
 * que graba y la auditoría que arma el mapa la calculen igual sin necesidad de
 * un archivo de configuración aparte que se pueda desincronizar.
 *
 *   ['q014']          → q014-como-cambio-el-idioma.webm
 *   ['q037', 'q038']  → q037-q038-cuales-son-los-estados.webm
 */
export function videoNameFor(ids: string[]): string {
  // Sin recortes: para una sola pregunta tiene que dar exactamente el mismo
  // nombre que `question.video` del registro, o se invalidan las grabaciones
  // que ya existen.
  return `${ids.join('-')}-${requireQuestion(ids[0]).slug}.webm`;
}

/** Valida que un grupo sea legítimo: hasta dos preguntas, de la misma subsección. */
export function requireGroup(ids: string[]): Question[] {
  if (ids.length === 0) throw new Error('[help_invokeia] Un demoTest necesita al menos un id');
  if (ids.length > 2) {
    throw new Error(
      `[help_invokeia] Un video cubre como mucho 2 preguntas; llegaron ${ids.length}: ${ids.join(', ')}`,
    );
  }
  const questions = ids.map(requireQuestion);
  const sections = new Set(questions.map((q) => `${q.part.n}/${q.section}`));
  if (sections.size > 1) {
    throw new Error(
      `[help_invokeia] ${ids.join(' + ')} no son de la misma subsección: ` +
        questions.map((q) => `${q.id}="${q.section}"`).join(', '),
    );
  }
  return questions;
}
