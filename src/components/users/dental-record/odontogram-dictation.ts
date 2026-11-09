import type { OdontogramCondition, OdontogramMarkStatus, OdontogramSurface } from '@/lib/types';

import { conditionForStatus, defaultStatus, getProcedure, isRangeCondition, isValidTooth, surfaceFromLetter, teethBetween } from './odontogram-catalog';
import { newProposalKey, type ProposedMark } from './odontogram-state';

// Turns a dictated or typed phrase ("caries OM en 16, corona indicada en 14, puente defectuoso del
// 24 al 26") into proposals. It runs in the browser: nothing is written until the professional confirms.

/** Words of each condition, without accents; the longest match wins */
const CONCEPTS: [RegExp, OdontogramCondition, OdontogramMarkStatus?][] = [
  [/caries incipiente/, 'caries-incipient'],
  [/caries/, 'caries'],
  [/restauracion (defectuosa|requerida)|filtrad/, 'restoration-required'],
  [/resina|composite/, 'resin'],
  [/amalgama/, 'amalgam'],
  [/obturacion/, 'filling'],
  [/sellante/, 'sealant'],
  [/endodoncia|tratamiento de conducto|conducto/, 'endo-indicated'],
  [/perno de fibra/, 'post-fiber'],
  [/perno/, 'post'],
  [/corona provisori/, 'crown-tmp'],
  [/corona/, 'crown-indicated'],
  [/puente (fijo )?(defectuoso|con recidiva)/, 'bridge-defective'],
  [/puente/, 'bridge-in-progress'],
  [/protesis removible|\bppr\b/, 'rem-prost'],
  [/resto radicular/, 'root-remnant'],
  [/exodoncia|extraccion|extraer/, 'extraction-indicated'],
  [/ausente|\bfalta\b|perdid/, 'missing', 'existing'],
  [/implante/, 'implant-planned'],
  [/fractura radicular|fractura de raiz/, 'root-fracture'],
  [/fractura/, 'fracture'],
  [/periapical/, 'periapical-lesion'],
  [/reabsorcion/, 'root-resorption'],
  [/movilidad/, 'mobility-1'],
  [/recesion/, 'gingival-recession'],
  [/agrandamiento/, 'gingival-enlargement'],
  [/bolsa/, 'perio-pocket'],
  [/furca/, 'furcation'],
  [/bracket/, 'bracket'],
  [/abfraccion/, 'abfraction'],
  [/abrasion/, 'abrasion'],
  [/erosion/, 'erosion'],
  [/diastema/, 'diastema'],
  [/rotacion|giroversion/, 'rotation'],
];

const SURFACE_WORDS: [RegExp, OdontogramSurface][] = [
  [/oclusal|incisal/, 'center'],
  [/mesial/, 'left'],
  [/distal/, 'right'],
  [/vestibular|bucal/, 'top'],
  [/palatin|lingual/, 'bottom'],
];

const INDICATED_WORDS = /indicad|planific|requier|necesit|a realizar|pendiente|defectuos/;
const DONE_WORDS = /\bhoy\b|realice|realizamos|hice|hicimos|terminamos/;
const EXISTING_WORDS = /existente|ya tiene|previa|antigua|realizad|hech[oa]\b/;

export interface DictationResult {
  proposals: ProposedMark[];
  /** Pieces of text with a condition but no valid tooth, or with nothing recognizable */
  unparsed: string[];
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function parseDictation(text: string): DictationResult {
  const proposals: ProposedMark[] = [];
  const unparsed: string[] = [];
  // Punctuation separates findings; inside a piece, each condition takes the text up to the next one
  for (const piece of normalize(text).split(/[,;.\n]+/)) {
    if (!piece.trim()) continue;
    const result = parsePiece(piece);
    proposals.push(...result.proposals);
    unparsed.push(...result.unparsed);
  }
  return { proposals, unparsed };
}

function parsePiece(low: string): DictationResult {
  const hits: { i: number; j: number; id: OdontogramCondition; status?: OdontogramMarkStatus }[] = [];
  for (const [re, id, status] of CONCEPTS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(low))) hits.push({ i: m.index, j: m.index + m[0].length, id, status });
  }
  hits.sort((a, b) => a.i - b.i || b.j - b.i - (a.j - a.i));
  const kept: typeof hits = [];
  for (const h of hits) {
    const prev = kept[kept.length - 1];
    if (prev && h.i < prev.j) continue;
    kept.push(h);
  }

  const proposals: ProposedMark[] = [];
  const unparsed: string[] = [];
  if (!kept.length) return { proposals, unparsed: [low.trim()] };

  kept.forEach((hit, idx) => {
    // Each condition keeps the text up to the next one, which also works for dictation without punctuation
    const clause = low.slice(idx === 0 ? 0 : hit.i, idx + 1 < kept.length ? kept[idx + 1].i : low.length);
    const own = low.slice(hit.i, idx + 1 < kept.length ? kept[idx + 1].i : low.length);
    const status: OdontogramMarkStatus = DONE_WORDS.test(own) ? 'done'
      : INDICATED_WORDS.test(own) ? 'indicated'
      : EXISTING_WORDS.test(own) ? 'existing'
      : hit.status ?? defaultStatus(hit.id);

    let condition = hit.id;
    if (condition === 'mobility-1') {
      const grade = own.match(/movilidad\s*(?:grado\s*)?(1|2|3|iii|ii|i)\b/);
      const n = grade ? ({ '1': 1, i: 1, '2': 2, ii: 2, '3': 3, iii: 3 } as Record<string, number>)[grade[1]] : 1;
      condition = `mobility-${n}` as OdontogramCondition;
    }

    const numbers = [...new Set([...clause.matchAll(/\b(\d{2})\b/g)].map((m) => Number(m[1])).filter(isValidTooth))];
    if (!numbers.length) {
      unparsed.push(own.trim());
      return;
    }

    // Surface letters right after the tooth ("16 OM") or right after the condition ("caries OM en 16")
    const afterCondition = low.slice(hit.j).match(/^\s+([omdvlpi]{1,5})\b/);
    const letters = [
      ...[...clause.matchAll(/\b\d{2}\s*([omdvlpi]{1,5})\b/g)].flatMap((m) => m[1].split('')),
      ...(afterCondition ? afterCondition[1].split('') : []),
    ];
    const surfaces = new Set<OdontogramSurface>();
    letters.forEach((l) => { const s = surfaceFromLetter(l); if (s) surfaces.add(s); });
    SURFACE_WORDS.forEach(([re, s]) => { if (re.test(own)) surfaces.add(s); });

    const range = clause.match(/(\d{2})\s*(?:al|a|-|–|hasta(?:\s+el)?)\s*(?:el\s+)?(\d{2})/);
    const from = range ? Number(range[1]) : NaN;
    const to = range ? Number(range[2]) : NaN;
    const validRange = range && isValidTooth(from) && isValidTooth(to) && teethBetween(from, to).length > 1;

    if (isRangeCondition(condition) && validRange) {
      proposals.push({ key: newProposalKey(), toothId: String(from), toothEndId: String(to), condition, status, src: 'voice' });
      return;
    }

    const teeth = validRange ? teethBetween(from, to) : numbers;
    const appliesTo = getProcedure(conditionForStatus(condition, status))?.appliesTo;
    for (const tooth of teeth) {
      if (appliesTo === 'surface' || (appliesTo === 'both' && surfaces.size)) {
        for (const surface of surfaces.size ? surfaces : new Set<OdontogramSurface>(['center'])) {
          proposals.push({ key: newProposalKey(), toothId: String(tooth), condition, surface, status, src: 'voice' });
        }
      } else {
        proposals.push({ key: newProposalKey(), toothId: String(tooth), condition, status, src: 'voice' });
      }
    }
  });

  return { proposals, unparsed };
}
