import type {
  OdontogramCondition,
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

/** Mobile grid order: 4 columns x 2 rows */
export const MOBILE_CATEGORY_ORDER: ProcedureCategoryMeta[] = [
  { id: 'restorations', icon: '🦷' },
  { id: 'fixed-prosthesis', icon: '👑' },
  { id: 'endodontics', icon: '↕️' },
  { id: 'implants', icon: '🔩' },
  { id: 'periodontics', icon: '🩺' },
  { id: 'oral-surgery', icon: '🪚' },
  { id: 'orthodontics', icon: '⛓️' },
  { id: 'pathologies', icon: '⚡' },
];

/** Desktop sidebar order: 2 columns */
export const DESKTOP_CATEGORY_ORDER: ProcedureCategoryMeta[] = [
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

/** Positions (in %) of each tooth inside its anatomical arch box */
export const ANATOMICAL_COORDS: Record<number, { left: number; top: number }> = {
  // Upper arch permanent
  18: { left: 11.7, top: 96.0 }, 17: { left: 12.2, top: 82.8 }, 16: { left: 13.5, top: 69.7 },
  15: { left: 15.9, top: 56.7 }, 14: { left: 19.7, top: 44.1 }, 13: { left: 25.5, top: 32.3 },
  12: { left: 33.5, top: 21.8 }, 11: { left: 43.4, top: 13.0 }, 21: { left: 56.6, top: 13.0 },
  22: { left: 66.5, top: 21.8 }, 23: { left: 74.5, top: 32.3 }, 24: { left: 80.3, top: 44.1 },
  25: { left: 84.1, top: 56.7 }, 26: { left: 86.5, top: 69.7 }, 27: { left: 87.8, top: 82.8 },
  28: { left: 88.3, top: 96.0 },
  // Upper arch temporal
  55: { left: 20.0, top: 80.0 }, 54: { left: 22.0, top: 67.0 }, 53: { left: 25.5, top: 53.0 },
  52: { left: 33.0, top: 40.0 }, 51: { left: 44.0, top: 32.0 }, 61: { left: 56.0, top: 32.0 },
  62: { left: 67.0, top: 40.0 }, 63: { left: 74.5, top: 53.0 }, 64: { left: 78.0, top: 67.0 },
  65: { left: 80.0, top: 80.0 },
  // Lower arch permanent
  48: { left: 11.7, top: 4.0 }, 47: { left: 12.2, top: 17.2 }, 46: { left: 13.5, top: 30.3 },
  45: { left: 15.9, top: 43.3 }, 44: { left: 19.7, top: 55.9 }, 43: { left: 25.5, top: 67.7 },
  42: { left: 33.5, top: 78.2 }, 41: { left: 43.4, top: 87.0 }, 31: { left: 56.6, top: 87.0 },
  32: { left: 66.5, top: 78.2 }, 33: { left: 74.5, top: 67.7 }, 34: { left: 80.3, top: 55.9 },
  35: { left: 84.1, top: 43.3 }, 36: { left: 86.5, top: 30.3 }, 37: { left: 87.8, top: 17.2 },
  38: { left: 88.3, top: 4.0 },
  // Lower arch temporal
  85: { left: 20.0, top: 20.0 }, 84: { left: 22.0, top: 33.0 }, 83: { left: 25.5, top: 47.0 },
  82: { left: 33.0, top: 60.0 }, 81: { left: 44.0, top: 68.0 }, 71: { left: 56.0, top: 68.0 },
  72: { left: 67.0, top: 60.0 }, 73: { left: 74.5, top: 47.0 }, 74: { left: 78.0, top: 33.0 },
  75: { left: 80.0, top: 20.0 },
};
