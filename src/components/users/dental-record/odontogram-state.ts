import type {
  OdontogramCondition,
  OdontogramMarcacion,
  OdontogramState,
  OdontogramSurface,
  OdontogramToothState,
} from '@/lib/types';

import { getProcedure, SURFACE_ABBR, SURFACE_ORDER } from './odontogram-catalog';

// Pure helpers over the persisted `estado_odontograma` shape. The odontogram UI reads and
// writes this shape directly, so whatever it produces stays compatible with existing sessions.

/** Procedures that replace everything else on the tooth (and clear its surfaces) */
const EXCLUSIVE_PROCEDURES: OdontogramCondition[] = ['missing', 'extraction-indicated'];

export function cloneState(state: OdontogramState): OdontogramState {
  return JSON.parse(JSON.stringify(state));
}

function cloneTooth(tooth: OdontogramToothState | undefined): OdontogramToothState {
  return tooth ? JSON.parse(JSON.stringify(tooth)) : {};
}

/** Drops empty fields; returns `undefined` when nothing is left on the tooth */
function normalizeTooth(tooth: OdontogramToothState): OdontogramToothState | undefined {
  const next: OdontogramToothState = {};
  for (const surface of SURFACE_ORDER) {
    if (tooth[surface]) next[surface] = tooth[surface];
  }
  if (tooth.whole) next.whole = tooth.whole;
  if (tooth.overlays?.length) next.overlays = tooth.overlays;
  if (tooth.notes?.trim()) next.notes = tooth.notes;
  return Object.keys(next).length > 0 ? next : undefined;
}

function withTooth(state: OdontogramState, toothId: string, tooth: OdontogramToothState): OdontogramState {
  const next = { ...state };
  const normalized = normalizeTooth(tooth);
  if (normalized) next[toothId] = normalized;
  else delete next[toothId];
  return next;
}

/** All tooth-level procedures (whole + overlays), without duplicates */
export function getToothProcedures(tooth: OdontogramToothState | undefined): OdontogramCondition[] {
  if (!tooth) return [];
  const list: OdontogramCondition[] = [];
  if (tooth.whole) list.push(tooth.whole);
  for (const overlay of tooth.overlays ?? []) {
    if (!list.includes(overlay)) list.push(overlay);
  }
  return list;
}

/** Stores the first `whole`-slot procedure in `whole` and everything else in `overlays` */
function setToothProcedures(tooth: OdontogramToothState, procedures: OdontogramCondition[]): OdontogramToothState {
  const whole = procedures.find((id) => getProcedure(id)?.slot === 'whole');
  return {
    ...tooth,
    whole,
    overlays: procedures.filter((id) => id !== whole),
  };
}

export function isToothMissing(tooth: OdontogramToothState | undefined): boolean {
  return getToothProcedures(tooth).some((id) => EXCLUSIVE_PROCEDURES.includes(id));
}

export interface ToggleResult {
  state: OdontogramState;
  /** True when the click removed the procedure instead of applying it */
  removed: boolean;
}

export function toggleSurface(
  state: OdontogramState,
  toothId: string,
  surface: OdontogramSurface,
  procedure: OdontogramCondition,
): ToggleResult {
  const tooth = cloneTooth(state[toothId]);
  const removed = tooth[surface] === procedure;
  tooth[surface] = removed ? undefined : procedure;

  // Painting a surface means the tooth is present again
  const remaining = getToothProcedures(tooth).filter((id) => !EXCLUSIVE_PROCEDURES.includes(id));
  return { state: withTooth(state, toothId, setToothProcedures(tooth, remaining)), removed };
}

export function toggleToothProcedure(
  state: OdontogramState,
  toothId: string,
  procedure: OdontogramCondition,
): ToggleResult {
  const current = getToothProcedures(state[toothId]);
  if (current.includes(procedure)) {
    const tooth = setToothProcedures(cloneTooth(state[toothId]), current.filter((id) => id !== procedure));
    return { state: withTooth(state, toothId, tooth), removed: true };
  }
  return { state: addToothProcedure(state, toothId, procedure), removed: false };
}

/** Adds a whole-tooth procedure (no-op if already present), applying the exclusivity rules */
function addToothProcedure(state: OdontogramState, toothId: string, procedure: OdontogramCondition): OdontogramState {
  let tooth = cloneTooth(state[toothId]);
  const current = getToothProcedures(tooth);
  if (current.includes(procedure)) return state;

  let next: OdontogramCondition[];
  if (EXCLUSIVE_PROCEDURES.includes(procedure)) {
    next = [procedure];
    tooth = { notes: tooth.notes };
  } else {
    next = [...current.filter((id) => !EXCLUSIVE_PROCEDURES.includes(id)), procedure];
  }
  return withTooth(state, toothId, setToothProcedures(tooth, next));
}

export function clearTooth(state: OdontogramState, toothId: string): OdontogramState {
  const next = { ...state };
  delete next[toothId];
  return next;
}

export function setToothNotes(state: OdontogramState, toothId: string, notes: string): OdontogramState {
  return withTooth(state, toothId, { ...cloneTooth(state[toothId]), notes });
}

const SURFACES = new Set<string>(SURFACE_ORDER);

/**
 * Applies the doctor agent's pre-filled markings on top of a base state. Markings are added
 * (never toggled off) and placed according to the catalog: surface procedures go on a face
 * (occlusal when none is given) and tooth procedures go to whole/overlays. Unknown ids are skipped.
 */
export function applyMarcaciones(base: OdontogramState, marcaciones: OdontogramMarcacion[]): OdontogramState {
  let state = cloneState(base);
  for (const m of marcaciones) {
    const procedure = getProcedure(m?.condicion);
    const toothId = String(m?.diente ?? '').trim();
    if (!procedure || !/^[1-8][1-8]$/.test(toothId)) continue;

    const surface = m.superficie && SURFACES.has(m.superficie) ? (m.superficie as OdontogramSurface) : undefined;
    const onSurface = procedure.appliesTo === 'surface' || (procedure.appliesTo === 'both' && !!surface);

    if (onSurface) {
      const target = surface ?? 'center';
      if (state[toothId]?.[target] !== procedure.id) {
        state = toggleSurface(state, toothId, target, procedure.id).state;
      }
    } else {
      state = addToothProcedure(state, toothId, procedure.id);
    }
  }
  return state;
}

export interface OdontogramEntry {
  toothId: string;
  condition: OdontogramCondition;
  /** Present for surface conditions; absent for whole-tooth ones */
  surface?: OdontogramSurface;
}

/** Flat, tooth-ordered list of every marked condition */
export function listOdontogramEntries(state: OdontogramState | null | undefined): OdontogramEntry[] {
  if (!state || typeof state !== 'object') return [];
  const entries: OdontogramEntry[] = [];
  const toothIds = Object.keys(state).sort((a, b) => Number(a) - Number(b));

  for (const toothId of toothIds) {
    const tooth = state[toothId];
    if (!tooth || typeof tooth !== 'object') continue;
    for (const condition of getToothProcedures(tooth)) {
      entries.push({ toothId, condition });
    }
    for (const surface of SURFACE_ORDER) {
      const condition = tooth[surface];
      if (condition) entries.push({ toothId, condition, surface });
    }
  }

  return entries;
}

/** Translated label for a stored condition id; unknown ids are shown as-is */
export function getConditionLabel(
  condition: string,
  t: (key: string) => string,
): string {
  return getProcedure(condition) ? t(`procedures.${condition}.label`) : condition;
}

/** Teeth grouped by condition, e.g. `{ caries: ['16', '26'] }` */
export function groupTeethByCondition(state: OdontogramState | null | undefined): [OdontogramCondition, string[]][] {
  const groups = new Map<OdontogramCondition, string[]>();
  for (const { toothId, condition } of listOdontogramEntries(state)) {
    const teeth = groups.get(condition) ?? [];
    if (!teeth.includes(toothId)) teeth.push(toothId);
    groups.set(condition, teeth);
  }
  return Array.from(groups.entries());
}

/** One readable line per marked condition, e.g. `16: Caries (O)` */
export function formatOdontogramEntries(
  state: OdontogramState | null | undefined,
  getLabel: (condition: OdontogramCondition) => string,
): string[] {
  return listOdontogramEntries(state).map(({ toothId, condition, surface }) =>
    surface ? `${toothId}: ${getLabel(condition)} (${SURFACE_ABBR[surface]})` : `${toothId}: ${getLabel(condition)}`,
  );
}
