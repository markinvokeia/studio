import type {
  OdontogramCondition,
  OdontogramMarkStatus,
  OdontogramProcedure,
  OdontogramProcedureCategory,
  OdontogramSurface,
} from '@/lib/types';

// Ids of conditions that already existed before the catalog was expanded are kept as-is,
// so sessions stored in `estado_odontograma` render without any data migration.
export const ODONTOGRAM_PROCEDURES: OdontogramProcedure[] = [
  // ── Restorations ──
  { id: 'caries', category: 'restorations', code: 'CA', color: '#ef4444', appliesTo: 'surface', slot: 'overlay' },
  { id: 'caries-incipient', category: 'restorations', code: 'CAI', color: '#f43f5e', appliesTo: 'surface', slot: 'overlay' },
  { id: 'amalgam', category: 'restorations', code: 'AM_EX', color: '#1e40af', appliesTo: 'surface', slot: 'overlay' },
  { id: 'resin', category: 'restorations', code: 'RC_EX', color: '#3b82f6', appliesTo: 'surface', slot: 'overlay' },
  { id: 'restoration-required', category: 'restorations', code: 'R_REQ', color: '#ef4444', appliesTo: 'surface', slot: 'overlay' },
  { id: 'filling', category: 'restorations', code: 'OBT', color: '#2563eb', appliesTo: 'surface', slot: 'overlay' },
  { id: 'sealant', category: 'restorations', code: 'SEL', color: '#10b981', appliesTo: 'surface', slot: 'overlay' },
  { id: 'healthy', category: 'restorations', code: 'Sa', color: '#22c55e', appliesTo: 'surface', slot: 'overlay', legacy: true },
  { id: 'pulp', category: 'restorations', code: 'Pu', color: '#f97316', appliesTo: 'surface', slot: 'overlay', legacy: true },
  { id: 'dyschromic', category: 'restorations', code: 'Dc', color: '#eab308', appliesTo: 'surface', slot: 'overlay', legacy: true },
  { id: 'worn', category: 'restorations', code: 'Dg', color: '#9ca3af', appliesTo: 'surface', slot: 'overlay', legacy: true },

  // ── Fixed prosthesis ──
  { id: 'crown', category: 'fixed-prosthesis', code: 'COR_EX', color: '#2563eb', appliesTo: 'tooth', slot: 'whole' },
  { id: 'crown-indicated', category: 'fixed-prosthesis', code: 'COR_IND', color: '#ef4444', appliesTo: 'tooth', slot: 'whole' },
  { id: 'crown-tmp', category: 'fixed-prosthesis', code: 'COR_PROV', color: '#d97706', appliesTo: 'tooth', slot: 'whole' },
  { id: 'bridge-in-progress', category: 'fixed-prosthesis', code: 'PF', color: '#ef4444', appliesTo: 'tooth', slot: 'whole' },
  { id: 'fixed-prosth', category: 'fixed-prosthesis', code: 'PF', color: '#2563eb', appliesTo: 'tooth', slot: 'whole' },
  { id: 'bridge-defective', category: 'fixed-prosthesis', code: 'PF_DEF', color: '#2563eb', appliesTo: 'tooth', slot: 'whole' },
  { id: 'rem-prost', category: 'fixed-prosthesis', code: 'PPR', color: '#4f46e5', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'post', category: 'fixed-prosthesis', code: 'PM', color: '#64748b', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'post-fiber', category: 'fixed-prosthesis', code: 'PF_FIB', color: '#ca8a04', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'prosthesis', category: 'fixed-prosthesis', code: 'Pr', color: '#7c3aed', appliesTo: 'tooth', slot: 'whole', legacy: true },

  // ── Endodontics ──
  { id: 'endo-done', category: 'endodontics', code: 'END_EX', color: '#2563eb', appliesTo: 'tooth', slot: 'whole' },
  { id: 'endo-indicated', category: 'endodontics', code: 'END_IND', color: '#ef4444', appliesTo: 'tooth', slot: 'whole' },
  { id: 'root-post', category: 'endodontics', code: 'POSTE', color: '#334155', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'endodontics', category: 'endodontics', code: 'END', color: '#fb923c', appliesTo: 'both', slot: 'whole' },

  // ── Implants ──
  { id: 'implant-osseo', category: 'implants', code: 'IMP_EX', color: '#475569', appliesTo: 'tooth', slot: 'whole' },
  { id: 'implant-planned', category: 'implants', code: 'IMP_IND', color: '#ef4444', appliesTo: 'tooth', slot: 'whole' },
  { id: 'implant', category: 'implants', code: 'IMP', color: '#d97706', appliesTo: 'tooth', slot: 'whole' },

  // ── Periodontics ──
  { id: 'perio-pocket', category: 'periodontics', code: 'BOL_P', color: '#dc2626', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'gingival-recession', category: 'periodontics', code: 'REC_AP', color: '#d97706', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'gingival-enlargement', category: 'periodontics', code: 'AGR_CO', color: '#059669', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'mobility-1', category: 'periodontics', code: 'MOV_I', color: '#4338ca', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'mobility-2', category: 'periodontics', code: 'MOV_II', color: '#b45309', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'mobility-3', category: 'periodontics', code: 'MOV_III', color: '#b91c1c', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'furcation', category: 'periodontics', code: 'FUR', color: '#4f46e5', appliesTo: 'tooth', slot: 'overlay' },

  // ── Oral surgery ──
  { id: 'missing', category: 'oral-surgery', code: 'EXO_EX', color: '#2563eb', appliesTo: 'tooth', slot: 'whole' },
  { id: 'extraction-indicated', category: 'oral-surgery', code: 'EXO_IND', color: '#ef4444', appliesTo: 'tooth', slot: 'whole' },
  { id: 'retained', category: 'oral-surgery', code: 'RET', color: '#4f46e5', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'semi-erupted', category: 'oral-surgery', code: 'SEMI', color: '#6b7280', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'root-remnant', category: 'oral-surgery', code: 'RR', color: '#dc2626', appliesTo: 'tooth', slot: 'whole', legacy: true },
  { id: 'edentulism', category: 'oral-surgery', code: 'Ed', color: '#94a3b8', appliesTo: 'tooth', slot: 'whole', legacy: true },

  // ── Orthodontics ──
  { id: 'bracket', category: 'orthodontics', code: 'BRA', color: '#475569', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'fixed-retainer', category: 'orthodontics', code: 'CON', color: '#6366f1', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'ortho-movement', category: 'orthodontics', code: 'MOV_O', color: '#0284c7', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'fixed-ortho', category: 'orthodontics', code: 'OF', color: '#10b981', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'rem-orthodo', category: 'orthodontics', code: 'RO', color: '#16a34a', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'bolt', category: 'orthodontics', code: 'BI', color: '#64748b', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'diastema', category: 'orthodontics', code: 'Di', color: '#0ea5e9', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'malposition', category: 'orthodontics', code: 'MAL', color: '#4338ca', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'ectopic', category: 'orthodontics', code: 'Ec', color: '#06b6d4', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'eruption', category: 'orthodontics', code: 'Er', color: '#84cc16', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'extrusion', category: 'orthodontics', code: 'Ex', color: '#9333ea', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'ortho-fracture', category: 'orthodontics', code: 'Fx', color: '#ef4444', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'fusion', category: 'orthodontics', code: 'Fu', color: '#14b8a6', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'intrusion', category: 'orthodontics', code: 'In', color: '#6366f1', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'macrodontia', category: 'orthodontics', code: 'Mc', color: '#f43f5e', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'microdontia', category: 'orthodontics', code: 'Mi', color: '#e11d48', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'drifting', category: 'orthodontics', code: 'Dt', color: '#f59e0b', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'impacted', category: 'orthodontics', code: 'Ip', color: '#78350f', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'rotation', category: 'orthodontics', code: 'Ro', color: '#ec4899', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'impacted-semi', category: 'orthodontics', code: 'SI', color: '#d97706', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'supernumerary', category: 'orthodontics', code: 'Sn', color: '#a855f7', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'transposition', category: 'orthodontics', code: 'Tp', color: '#f97316', appliesTo: 'tooth', slot: 'overlay' },

  // ── Pathologies ──
  { id: 'crown-fracture', category: 'pathologies', code: 'FC', color: '#eab308', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'root-fracture', category: 'pathologies', code: 'FR', color: '#fb923c', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'periapical-lesion', category: 'pathologies', code: 'LPE', color: '#dc2626', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'root-resorption', category: 'pathologies', code: 'REAB', color: '#ef4444', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'abrasion', category: 'pathologies', code: 'ABR', color: '#4b5563', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'abfraction', category: 'pathologies', code: 'ABF', color: '#e11d48', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'erosion', category: 'pathologies', code: 'ERO', color: '#059669', appliesTo: 'tooth', slot: 'overlay' },
  { id: 'fracture', category: 'pathologies', code: 'FRA', color: '#eab308', appliesTo: 'both', slot: 'overlay' },
];

export const PROCEDURE_MAP = Object.fromEntries(
  ODONTOGRAM_PROCEDURES.map((p) => [p.id, p]),
) as Record<OdontogramCondition, OdontogramProcedure>;

/** Procedures offered in the palette (legacy ids are render-only) */
export const SELECTABLE_PROCEDURES = ODONTOGRAM_PROCEDURES.filter((p) => !p.legacy);

const FALLBACK_COLOR = '#6b7280';

export function getProcedure(id: string | undefined): OdontogramProcedure | undefined {
  return id ? PROCEDURE_MAP[id as OdontogramCondition] : undefined;
}

export function getProcedureColor(id: string | undefined): string {
  return getProcedure(id)?.color ?? FALLBACK_COLOR;
}

/** Red-flagged procedures (pending treatment / pathology), used for code chips */
export function isAttentionProcedure(p: OdontogramProcedure): boolean {
  return p.category === 'pathologies' || p.id.endsWith('-indicated') || p.id.endsWith('-planned');
}

export interface ProcedureCategoryMeta {
  id: OdontogramProcedureCategory;
  icon: string;
}

/** Category chips of the inspector */
export const CATEGORY_ORDER: ProcedureCategoryMeta[] = [
  { id: 'restorations', icon: '🦷' },
  { id: 'implants', icon: '🔩' },
  { id: 'fixed-prosthesis', icon: '👑' },
  { id: 'periodontics', icon: '🩺' },
  { id: 'endodontics', icon: '↕️' },
  { id: 'oral-surgery', icon: '🪚' },
  { id: 'orthodontics', icon: '⛓️' },
  { id: 'pathologies', icon: '⚡' },
];

// ── FDI numbering ──

export const PERMANENT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const PERMANENT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const PERMANENT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
export const PERMANENT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

export const TEMPORAL_UPPER_RIGHT = [55, 54, 53, 52, 51];
export const TEMPORAL_UPPER_LEFT = [61, 62, 63, 64, 65];
export const TEMPORAL_LOWER_LEFT = [71, 72, 73, 74, 75];
export const TEMPORAL_LOWER_RIGHT = [85, 84, 83, 82, 81];

const quadrantOf = (tooth: number) => Math.floor(tooth / 10);

export const isUpperTooth = (tooth: number) => [1, 2, 5, 6].includes(quadrantOf(tooth));
export const isTemporalTooth = (tooth: number) => [5, 6, 7, 8].includes(quadrantOf(tooth));
/** Quadrants drawn on the viewer's left side, where the distal face points outwards */
export const isRightQuadrant = (tooth: number) => [1, 4, 5, 8].includes(quadrantOf(tooth));

/** Tooth type within its quadrant, used for the `toothNames.*` translation keys */
export type ToothKind = 'central' | 'lateral' | 'canine' | 'premolar1' | 'premolar2' | 'molar1' | 'molar2' | 'molar3';

const PERMANENT_KINDS: ToothKind[] = ['central', 'lateral', 'canine', 'premolar1', 'premolar2', 'molar1', 'molar2', 'molar3'];
const TEMPORAL_KINDS: ToothKind[] = ['central', 'lateral', 'canine', 'molar1', 'molar2'];

export function getToothKind(tooth: number): ToothKind | undefined {
  const position = tooth % 10;
  return (isTemporalTooth(tooth) ? TEMPORAL_KINDS : PERMANENT_KINDS)[position - 1];
}

export const SURFACE_ABBR: Record<OdontogramSurface, string> = {
  top: 'V', center: 'O', bottom: 'L', left: 'M', right: 'D',
};

export const SURFACE_ORDER: OdontogramSurface[] = ['top', 'left', 'center', 'right', 'bottom'];

// ── Mark status (indicado · existente · hecho hoy) ──
//
// Many ids already carry their status (crown / crown-indicated…). A mark is stored with the id
// that matches its status, so readers that only know the ids keep understanding it; the status
// itself and who recorded it go in `meta`. Marks without `meta` take the default of their id.

export const isAnteriorTooth = (tooth: number) => tooth % 10 <= 3;

/** Same concept in each status, when the catalog has a dedicated id for it */
/** Concepts with an id per status; named once in the inspector (`inspector.concepts.<key>`) */
export type OdontogramConcept = 'crown' | 'endo' | 'implant' | 'extraction' | 'bridge';

interface TwinGroup {
  key: OdontogramConcept;
  indicated: OdontogramCondition;
  existing: OdontogramCondition;
  /** Older or broader ids of the same concept, read as `existing` */
  also?: OdontogramCondition[];
}

const TWIN_GROUPS: TwinGroup[] = [
  { key: 'crown', indicated: 'crown-indicated', existing: 'crown' },
  { key: 'endo', indicated: 'endo-indicated', existing: 'endo-done', also: ['endodontics'] },
  { key: 'implant', indicated: 'implant-planned', existing: 'implant-osseo', also: ['implant'] },
  { key: 'extraction', indicated: 'extraction-indicated', existing: 'missing' },
  { key: 'bridge', indicated: 'bridge-in-progress', existing: 'fixed-prosth' },
];

/** Ids that mean something still to treat (red) when the mark has no explicit status */
const INDICATED_BY_DEFAULT = new Set<OdontogramCondition>([
  'caries', 'caries-incipient', 'restoration-required', 'bridge-defective', 'root-remnant',
  'periapical-lesion', 'root-resorption', 'crown-fracture', 'root-fracture', 'fracture', 'ortho-fracture',
  'perio-pocket',
  ...TWIN_GROUPS.map((g) => g.indicated),
]);

function twinGroupOf(id: OdontogramCondition): TwinGroup | undefined {
  return TWIN_GROUPS.find((g) => g.indicated === id || g.existing === id || g.also?.includes(id));
}

export function conceptOf(id: OdontogramCondition): OdontogramConcept | null {
  return twinGroupOf(id)?.key ?? null;
}

/** The catalog to pick from: one entry per twin concept (its indicated id), legacy ids left out */
export const PICKABLE_PROCEDURES = SELECTABLE_PROCEDURES.filter((p) => {
  const group = twinGroupOf(p.id);
  return !group || group.indicated === p.id;
});

export function defaultStatus(id: OdontogramCondition): OdontogramMarkStatus {
  return INDICATED_BY_DEFAULT.has(id) ? 'indicated' : 'existing';
}

/** The id to store for a condition recorded with `status` (its twin when there is one) */
export function conditionForStatus(id: OdontogramCondition, status: OdontogramMarkStatus): OdontogramCondition {
  const group = twinGroupOf(id);
  if (!group) return id;
  if (status === 'indicated') return group.indicated;
  return id === group.indicated ? group.existing : id;
}

/** Two ids are the same concept (a status change, not a different condition) */
export function sameConcept(a: OdontogramCondition, b: OdontogramCondition): boolean {
  if (a === b) return true;
  const group = twinGroupOf(a);
  return !!group && group === twinGroupOf(b);
}

/** How a condition is drawn on the tooth silhouette and its 5-surface diagram */
export type ToothRender =
  | 'surface' | 'incipient' | 'sealant'
  | 'crown' | 'crown-tmp' | 'canals' | 'post' | 'implant' | 'cross' | 'bridge' | 'removable'
  | 'fracture' | 'root-fracture' | 'apex' | 'resorption' | 'root-remnant'
  | 'recession' | 'enlargement' | 'pocket' | 'furcation' | 'mobility' | 'bracket' | 'wire'
  | 'badge';

const RENDERS: Partial<Record<OdontogramCondition, ToothRender>> = {
  'caries-incipient': 'incipient',
  sealant: 'sealant',
  crown: 'crown', 'crown-indicated': 'crown', prosthesis: 'crown',
  'crown-tmp': 'crown-tmp',
  'endo-done': 'canals', 'endo-indicated': 'canals', endodontics: 'canals',
  post: 'post', 'post-fiber': 'post', 'root-post': 'post',
  'implant-osseo': 'implant', 'implant-planned': 'implant', implant: 'implant',
  missing: 'cross', 'extraction-indicated': 'cross', edentulism: 'cross',
  'fixed-prosth': 'bridge', 'bridge-in-progress': 'bridge', 'bridge-defective': 'bridge',
  'rem-prost': 'removable',
  fracture: 'fracture', 'crown-fracture': 'fracture', 'ortho-fracture': 'fracture',
  'root-fracture': 'root-fracture',
  'periapical-lesion': 'apex',
  'root-resorption': 'resorption',
  'root-remnant': 'root-remnant',
  'gingival-recession': 'recession',
  'gingival-enlargement': 'enlargement',
  'perio-pocket': 'pocket',
  furcation: 'furcation',
  'mobility-1': 'mobility', 'mobility-2': 'mobility', 'mobility-3': 'mobility',
  bracket: 'bracket', 'fixed-ortho': 'bracket',
  'fixed-retainer': 'wire',
};

export function getRender(id: OdontogramCondition): ToothRender {
  const render = RENDERS[id];
  if (render) return render;
  return getProcedure(id)?.appliesTo === 'surface' ? 'surface' : 'badge';
}

/** Bridges span several teeth of one arch */
export const isRangeCondition = (id: OdontogramCondition) => getRender(id) === 'bridge';

/** Condition with no physical tooth left (the silhouette is dimmed) */
export const isAbsenceCondition = (id: OdontogramCondition) => id === 'missing' || id === 'edentulism';

/** The eight tiles at hand in the inspector; the rest is in the search and the categories */
export interface FrequentTile {
  id: OdontogramCondition;
  /** Always recorded with this status, whatever "Registrar como" says */
  fixedStatus?: OdontogramMarkStatus;
}

export const FREQUENT_TILES: FrequentTile[] = [
  { id: 'caries' },
  { id: 'resin' },
  { id: 'endo-indicated' },
  { id: 'crown-indicated' },
  { id: 'extraction-indicated' },
  { id: 'missing', fixedStatus: 'existing' },
  { id: 'implant-planned' },
  { id: 'bridge-in-progress' },
];

/** Screen letter of a surface for this tooth (V, M, D, P/L, O/I) */
export function surfaceLetter(tooth: number, surface: OdontogramSurface): string {
  if (surface === 'center') return isAnteriorTooth(tooth) ? 'I' : 'O';
  if (surface === 'bottom') return isUpperTooth(tooth) ? 'P' : 'L';
  return SURFACE_ABBR[surface];
}

/** Surface for a letter typed or dictated for this tooth (`O`/`I` and `P`/`L` are the same face) */
export function surfaceFromLetter(letter: string): OdontogramSurface | null {
  switch (letter.toUpperCase()) {
    case 'V': case 'B': return 'top';
    case 'P': case 'L': return 'bottom';
    case 'M': return 'left';
    case 'D': return 'right';
    case 'O': case 'I': return 'center';
    default: return null;
  }
}

export function isValidTooth(tooth: number): boolean {
  const q = Math.floor(tooth / 10);
  const d = tooth % 10;
  return (q >= 1 && q <= 4 && d >= 1 && d <= 8) || (q >= 5 && q <= 8 && d >= 1 && d <= 5);
}

/** Teeth of an arch in screen order (patient's right → left) */
export const UPPER_PERMANENT = [...PERMANENT_UPPER_RIGHT, ...PERMANENT_UPPER_LEFT];
export const LOWER_PERMANENT = [...PERMANENT_LOWER_RIGHT, ...PERMANENT_LOWER_LEFT];
export const UPPER_TEMPORAL = [...TEMPORAL_UPPER_RIGHT, ...TEMPORAL_UPPER_LEFT];
export const LOWER_TEMPORAL = [...TEMPORAL_LOWER_RIGHT, ...TEMPORAL_LOWER_LEFT];

/** The arch (in screen order) a tooth belongs to */
export function archOf(tooth: number): number[] {
  if (isTemporalTooth(tooth)) return isUpperTooth(tooth) ? UPPER_TEMPORAL : LOWER_TEMPORAL;
  return isUpperTooth(tooth) ? UPPER_PERMANENT : LOWER_PERMANENT;
}

/** Teeth from `a` to `b` (inclusive) along their arch; empty when they are in different arches */
export function teethBetween(a: number, b: number): number[] {
  const arch = archOf(a);
  const i = arch.indexOf(a);
  const j = arch.indexOf(b);
  if (i < 0 || j < 0) return [];
  return arch.slice(Math.min(i, j), Math.max(i, j) + 1);
}
