import type {
  OdontogramCondition,
  OdontogramMarcacion,
  OdontogramMarkMeta,
  OdontogramMarkSource,
  OdontogramMarkStatus,
  OdontogramState,
  OdontogramSurface,
  OdontogramToothState,
} from '@/lib/types';

import { conditionForStatus, defaultStatus, getProcedure, isRangeCondition, sameConcept, SURFACE_ABBR, SURFACE_ORDER, teethBetween } from './odontogram-catalog';

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

/** Drops empty fields (and the details of marks that are gone); returns `undefined` when nothing is left */
function normalizeTooth(tooth: OdontogramToothState): OdontogramToothState | undefined {
  const next: OdontogramToothState = {};
  for (const surface of SURFACE_ORDER) {
    if (tooth[surface]) next[surface] = tooth[surface];
  }
  if (tooth.whole) next.whole = tooth.whole;
  if (tooth.overlays?.length) next.overlays = tooth.overlays;
  if (tooth.notes?.trim()) next.notes = tooth.notes;

  if (tooth.meta) {
    const procedures = getToothProcedures(next);
    const meta: Record<string, OdontogramMarkMeta> = {};
    for (const [slot, value] of Object.entries(tooth.meta)) {
      const alive = slot.startsWith('t:')
        ? procedures.includes(slot.slice(2) as OdontogramCondition)
        : !!next[slot as OdontogramSurface];
      if (alive && value) meta[slot] = value;
    }
    if (Object.keys(meta).length) next.meta = meta;
  }
  if (tooth.voided?.length) next.voided = tooth.voided;

  // Details and voided marks alone are not something on the tooth
  const content = Object.keys(next).filter((k) => k !== 'meta' && k !== 'voided');
  return content.length > 0 || next.voided ? next : undefined;
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

// ── Marks with status ───────────────────────────────────────────────────────

/** `meta` key of a mark: its surface, or `t:<condition>` for tooth-level marks */
export type MarkSlot = string;

export const toothSlot = (condition: OdontogramCondition): MarkSlot => `t:${condition}`;

export interface OdontogramMark {
  toothId: string;
  slot: MarkSlot;
  condition: OdontogramCondition;
  /** Present for surface marks */
  surface?: OdontogramSurface;
  status: OdontogramMarkStatus;
  meta?: OdontogramMarkMeta;
}

/** A mark to record: the condition as picked (its twin for `status` is resolved on save) */
export interface MarkInput {
  toothId: string;
  condition: OdontogramCondition;
  surface?: OdontogramSurface;
  status: OdontogramMarkStatus;
  src?: OdontogramMarkSource;
  by?: string;
  range?: string;
}

export function markStatusOf(tooth: OdontogramToothState | undefined, slot: MarkSlot, condition: OdontogramCondition): OdontogramMarkStatus {
  return tooth?.meta?.[slot]?.st ?? defaultStatus(condition);
}

/** Every mark of a tooth: tooth-level first, then surfaces */
export function listToothMarks(toothId: string, tooth: OdontogramToothState | undefined): OdontogramMark[] {
  if (!tooth) return [];
  const marks: OdontogramMark[] = getToothProcedures(tooth).map((condition) => {
    const slot = toothSlot(condition);
    return { toothId, slot, condition, status: markStatusOf(tooth, slot, condition), meta: tooth.meta?.[slot] };
  });
  for (const surface of SURFACE_ORDER) {
    const condition = tooth[surface];
    if (condition) marks.push({ toothId, slot: surface, condition, surface, status: markStatusOf(tooth, surface, condition), meta: tooth.meta?.[surface] });
  }
  return marks;
}

/** Where a condition goes: a surface (surface-only ids, or "both" ids when a surface is given) or the tooth */
export function placementOf(condition: OdontogramCondition, surface?: OdontogramSurface): OdontogramSurface | null {
  const procedure = getProcedure(condition);
  if (!procedure) return null;
  if (procedure.appliesTo === 'surface') return surface ?? 'center';
  if (procedure.appliesTo === 'both' && surface) return surface;
  return null;
}

/** Slot the mark will end up in once its twin is resolved */
export function slotFor(input: Pick<MarkInput, 'condition' | 'surface' | 'status'>): MarkSlot {
  const id = conditionForStatus(input.condition, input.status);
  return placementOf(id, input.surface) ?? toothSlot(id);
}

function withMeta(tooth: OdontogramToothState, slot: MarkSlot, meta: OdontogramMarkMeta): OdontogramToothState {
  return { ...tooth, meta: { ...(tooth.meta ?? {}), [slot]: meta } };
}

/** Records a mark (never toggles it off). A different status of the same concept replaces the old one */
export function addMark(state: OdontogramState, input: MarkInput): OdontogramState {
  const id = conditionForStatus(input.condition, input.status);
  if (!getProcedure(id)) return state;
  const meta: OdontogramMarkMeta = { st: input.status, at: new Date().toISOString() };
  if (input.by) meta.by = input.by;
  if (input.src && input.src !== 'manual') meta.src = input.src;
  if (input.range) meta.range = input.range;

  const surface = placementOf(id, input.surface);
  if (surface) {
    const next = state[input.toothId]?.[surface] === id ? state : toggleSurface(state, input.toothId, surface, id).state;
    return withTooth(next, input.toothId, withMeta(cloneTooth(next[input.toothId]), surface, meta));
  }

  const current = getToothProcedures(state[input.toothId]);
  const others = current.filter((c) => c !== id && sameConcept(c, id));
  let next = state;
  if (others.length) {
    next = withTooth(next, input.toothId, setToothProcedures(cloneTooth(next[input.toothId]), current.filter((c) => !others.includes(c))));
  }
  next = addToothProcedure(next, input.toothId, id);
  return withTooth(next, input.toothId, withMeta(cloneTooth(next[input.toothId]), toothSlot(id), meta));
}

/** Records a bridge on every tooth from `from` to `to` of the same arch */
export function addRangeMark(state: OdontogramState, from: number, to: number, input: Omit<MarkInput, 'toothId' | 'range'>): OdontogramState {
  const range = `r${Date.now().toString(36)}`;
  return teethBetween(from, to).reduce((acc, tooth) => addMark(acc, { ...input, toothId: String(tooth), range }), state);
}

export function removeMark(state: OdontogramState, toothId: string, slot: MarkSlot): OdontogramState {
  const tooth = cloneTooth(state[toothId]);
  if (slot.startsWith('t:')) {
    const condition = slot.slice(2) as OdontogramCondition;
    return withTooth(state, toothId, setToothProcedures(tooth, getToothProcedures(tooth).filter((c) => c !== condition)));
  }
  tooth[slot as OdontogramSurface] = undefined;
  return withTooth(state, toothId, tooth);
}

/** Removes a mark inherited from an earlier session, keeping why and who in `voided` */
export function voidMark(state: OdontogramState, toothId: string, slot: MarkSlot, reason: string, by?: string): OdontogramState {
  const mark = listToothMarks(toothId, state[toothId]).find((m) => m.slot === slot);
  if (!mark) return state;
  const next = removeMark(state, toothId, slot);
  const tooth = cloneTooth(next[toothId]);
  tooth.voided = [...(tooth.voided ?? []), { slot, condition: mark.condition, reason, at: new Date().toISOString(), ...(by ? { by } : {}) }];
  return withTooth(next, toothId, tooth);
}

/** Moves a mark to another status (indicado ↔ existente ↔ hecho hoy), keeping when, who and the bridge */
export function changeMarkStatus(state: OdontogramState, toothId: string, slot: MarkSlot, status: OdontogramMarkStatus): OdontogramState {
  const mark = listToothMarks(toothId, state[toothId]).find((m) => m.slot === slot);
  if (!mark || mark.status === status) return state;
  const next = addMark(removeMark(state, toothId, slot), { toothId, condition: mark.condition, surface: mark.surface, status, src: mark.meta?.src, by: mark.meta?.by, range: mark.meta?.range });
  const newSlot = slotFor({ condition: mark.condition, surface: mark.surface, status });
  const tooth = cloneTooth(next[toothId]);
  if (tooth.meta?.[newSlot] && mark.meta?.at) tooth.meta[newSlot] = { ...tooth.meta[newSlot], at: mark.meta.at };
  return withTooth(next, toothId, tooth);
}

/** Same concept already marked in that place (to skip duplicated proposals) */
export function hasMark(state: OdontogramState, input: Pick<MarkInput, 'toothId' | 'condition' | 'surface' | 'status'>): boolean {
  const id = conditionForStatus(input.condition, input.status);
  const surface = placementOf(id, input.surface);
  const tooth = state[input.toothId];
  if (surface) return tooth?.[surface] === id;
  return getToothProcedures(tooth).includes(id);
}

/** The mark was already there in the previous session: it is voided, not deleted */
export function isInheritedMark(previous: OdontogramState | null | undefined, mark: OdontogramMark): boolean {
  const before = previous?.[mark.toothId];
  if (!before) return false;
  if (mark.surface) {
    const old = before[mark.surface];
    return !!old && sameConcept(old, mark.condition);
  }
  return getToothProcedures(before).some((c) => sameConcept(c, mark.condition));
}

/**
 * Starting point of the next session: what was done today becomes existing, and the per-session
 * details (source, voided marks) stay in the session where they happened.
 */
export function carryOverState(state: OdontogramState): OdontogramState {
  const next: OdontogramState = {};
  for (const [toothId, source] of Object.entries(cloneState(state))) {
    if (!source || typeof source !== 'object') continue;
    const tooth: OdontogramToothState = { ...source };
    delete tooth.voided;
    if (tooth.meta) {
      tooth.meta = Object.fromEntries(
        Object.entries(tooth.meta).map(([slot, meta]) => {
          const rest: OdontogramMarkMeta = { ...meta };
          delete rest.src;
          return [slot, rest.st === 'done' ? { ...rest, st: 'existing' as const } : rest];
        }),
      );
    }
    const normalized = normalizeTooth(tooth);
    if (normalized) next[toothId] = normalized;
  }
  return next;
}

/** A dictated or agent-suggested mark waiting for the professional to confirm it */
export interface ProposedMark extends MarkInput {
  key: string;
  /** Last tooth of a bridge */
  toothEndId?: string;
}

let proposalSeq = 0;
export const newProposalKey = () => `p${Date.now().toString(36)}_${++proposalSeq}`;

/** Applies proposals on a copy of the state, to preview them on the chart */
export function applyProposals(state: OdontogramState, proposals: ProposedMark[]): OdontogramState {
  return proposals.reduce((acc, p) => {
    if (p.toothEndId && isRangeCondition(p.condition)) return addRangeMark(acc, Number(p.toothId), Number(p.toothEndId), p);
    return addMark(acc, p);
  }, state);
}

/** `<tooth>|<slot>` of every place a proposal touches */
export function proposalKeys(proposals: ProposedMark[]): Set<string> {
  const keys = new Set<string>();
  for (const p of proposals) {
    const slot = slotFor(p);
    const teeth = p.toothEndId ? teethBetween(Number(p.toothId), Number(p.toothEndId)).map(String) : [p.toothId];
    teeth.forEach((t) => keys.add(`${t}|${slot}`));
  }
  return keys;
}

/**
 * The doctor agent's markings as proposals. The agent uses the catalog ids, which already carry the
 * status (crown vs. crown-indicated). Unknown ids and invalid teeth are skipped.
 */
export function marcacionesToProposals(marcaciones: OdontogramMarcacion[]): ProposedMark[] {
  const out: ProposedMark[] = [];
  for (const m of marcaciones) {
    const procedure = getProcedure(m?.condicion);
    const toothId = String(m?.diente ?? '').trim();
    if (!procedure || !/^[1-8][1-8]$/.test(toothId)) continue;
    const surface = m.superficie && SURFACES.has(m.superficie) ? (m.superficie as OdontogramSurface) : undefined;
    out.push({ key: newProposalKey(), toothId, condition: procedure.id, surface, status: defaultStatus(procedure.id), src: 'agent' });
  }
  return out;
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
