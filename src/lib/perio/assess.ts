import type {
  PerioDiagnosis,
  PerioImplantStatus,
  PerioPsrCode,
  PerioScreening,
  PerioSextant,
  PerioExamType,
  PerioExtent,
  PerioGrade,
  PerioPlanItem,
  PerioRisk,
  PerioStability,
  PerioStage,
  PerioStats,
  PerioTooth,
} from '@/lib/types';

import { computeStats } from './stats';
import { attachmentLevel, isProbeable, PERIO_LOWER, PERIO_UPPER, type PerioSiteIndex } from './teeth';

// Diagnosis suggested from the probing (AAP/EFP 2017 classification, Lang & Tonetti risk and the
// EFP treatment steps). Everything here is a suggestion: the professional reviews it, changes what
// is needed and confirms; the record keeps what was confirmed (perio_exams.diagnosis).

/** A reason shown next to a suggestion: a key of PerioRecord.diagnosis.why and its values */
export interface Why {
  key: string;
  values?: Record<string, string | number>;
}

export const STAGES: PerioStage[] = ['I', 'II', 'III', 'IV'];
export const GRADES: PerioGrade[] = ['A', 'B', 'C'];
/** Maintenance interval by risk (months), within the 3 to 6 the EFP guideline asks for */
export const MAINTENANCE_MONTHS: Record<PerioRisk, number> = { high: 3, moderate: 4, low: 6 };

// ── How it is today ──

/** Stable: bleeding under 10 %, no depth of 5 mm or more and no 4 mm that bleeds */
export function stabilityOf(stats: PerioStats): PerioStability {
  if (stats.n5 === 0 && stats.b4 === 0) return stats.bopPct < 10 ? 'stable' : 'gingivitis';
  return 'unstable';
}

/** Therapy endpoints: no pocket over 4 mm that bleeds and none of 6 mm or more */
export const endpointsMet = (stats: PerioStats) => stats.b5 === 0 && stats.n6 === 0;

// ── Classification ──

interface ToothCal {
  tooth: number;
  /** Highest attachment level at the interproximal sites (distal, mesial) */
  interproximal: number | null;
  /** Buccal or oral (center) attachment level with a pocket over 3 mm */
  midWithPocket: boolean;
  maxPd: number | null;
  furcation: number;
}

function toothCals(teeth: PerioTooth[]): ToothCal[] {
  return teeth.filter((t) => t.status === 'present').map((t) => {
    const sites = (['v', 'i'] as const).flatMap((side) => t.sites[side].map((s, index) => ({ s, index: index as PerioSiteIndex })));
    const inter = sites.filter((x) => x.index !== 1).map((x) => attachmentLevel(x.s)).filter((v): v is number => v != null);
    const pds = sites.map((x) => x.s.pd).filter((v): v is number => v != null);
    return {
      tooth: t.tooth,
      interproximal: inter.length ? Math.max(...inter) : null,
      midWithPocket: sites.some((x) => x.index === 1 && (attachmentLevel(x.s) ?? 0) >= 3 && (x.s.pd ?? 0) > 3),
      maxPd: pds.length ? Math.max(...pds) : null,
      furcation: Math.max(0, ...Object.values(t.furcation ?? {}).map(Number)),
    };
  });
}

const ARCH_POSITION = new Map<number, [number, number]>([
  ...PERIO_UPPER.map((n, i): [number, [number, number]] => [n, [0, i]]),
  ...PERIO_LOWER.map((n, i): [number, [number, number]] => [n, [1, i]]),
]);
const adjacent = (a: number, b: number) => {
  const pa = ARCH_POSITION.get(a)!;
  const pb = ARCH_POSITION.get(b)!;
  return pa[0] === pb[0] && Math.abs(pa[1] - pb[1]) === 1;
};
const hasNonAdjacentPair = (teeth: number[]) => teeth.some((a, i) => teeth.slice(i + 1).some((b) => !adjacent(a, b)));

export interface PerioInputs {
  teethLost: number | null;
  boneLossPct: number | null;
  age: number | null;
  cigarettes: number;
  diabetes: PerioDiagnosis['diabetes'];
}

export interface RiskParam {
  key: 'bop' | 'pockets' | 'lost' | 'boneAge' | 'systemic' | 'smoking';
  value: number | null;
  /** 0 low, 1 moderate, 2 high */
  zone: 0 | 1 | 2;
  /** Values at the six rings of the hexagon (null: yes/no) */
  scale: number[] | null;
}

export interface PerioAssessment {
  stats: PerioStats;
  stability: PerioStability;
  endpoints: boolean;
  isCase: boolean;
  caseWhy: Why[];
  stage: PerioStage | null;
  stageWhy: Why[];
  extent: PerioExtent | null;
  extentPct: number;
  grade: PerioGrade | null;
  gradeWhy: Why[];
  riskParams: RiskParam[];
  risk: PerioRisk;
  months: number;
}

/** Teeth missing from the 28 (third molars aside), for the risk */
export const teethMissingOf28 = (teeth: PerioTooth[]) => teeth.filter((t) => t.tooth % 10 !== 8 && (t.status === 'missing' || t.status === 'pontic')).length;

/**
 * @param today   the exam being diagnosed
 * @param initial the patient's initial exam (the stage is read there: it does not go down with treatment)
 * @param previousStages stages confirmed in earlier exams
 */
export function assessPerio(today: PerioTooth[], initial: PerioTooth[], previousStages: PerioStage[], input: PerioInputs, intervals: Record<PerioRisk, number> = MAINTENANCE_MONTHS): PerioAssessment {
  const stats = computeStats(today);
  const nowCal = toothCals(today);
  const startCal = toothCals(initial);

  // Case: interdental attachment loss at 2 or more non-adjacent teeth, or buccal/oral ≥ 3 mm with pockets at 2 teeth
  const interTeeth = nowCal.filter((c) => (c.interproximal ?? 0) >= 1).map((c) => c.tooth);
  const midTeeth = nowCal.filter((c) => c.midWithPocket).map((c) => c.tooth);
  const isCase = hasNonAdjacentPair(interTeeth) || midTeeth.length >= 2;
  const caseWhy: Why[] = isCase
    ? [hasNonAdjacentPair(interTeeth) ? { key: 'caseInter', values: { count: interTeeth.length } } : { key: 'caseMid', values: { count: midTeeth.length } }]
    : [{ key: 'noCase' }];

  // Stage, from the initial exam
  const maxStart = startCal.reduce<{ cal: number; tooth: number } | null>((best, c) => (c.interproximal != null && (!best || c.interproximal > best.cal) ? { cal: c.interproximal, tooth: c.tooth } : best), null);
  let stage: PerioStage | null = null;
  const stageWhy: Why[] = [];
  if (isCase && maxStart) {
    stage = maxStart.cal >= 5 ? 'III' : maxStart.cal >= 3 ? 'II' : 'I';
    stageWhy.push({ key: 'stageCal', values: { mm: maxStart.cal, tooth: maxStart.tooth } });
    const maxPd = Math.max(0, ...startCal.map((c) => c.maxPd ?? 0));
    const furcations = startCal.filter((c) => c.furcation >= 2).map((c) => c.tooth);
    if (STAGES.indexOf(stage) < 2 && (maxPd >= 6 || furcations.length)) {
      stage = 'III';
      stageWhy.push(maxPd >= 6 ? { key: 'stageDepth', values: { mm: maxPd } } : { key: 'stageFurcation', values: { teeth: furcations.join(', ') } });
    }
    if ((input.teethLost ?? 0) >= 5) {
      stage = 'IV';
      stageWhy.push({ key: 'stageLost', values: { count: input.teethLost ?? 0 } });
    }
    const highest = previousStages.reduce<PerioStage | null>((a, b) => (!a || STAGES.indexOf(b) > STAGES.indexOf(a) ? b : a), null);
    if (highest && STAGES.indexOf(highest) > STAGES.indexOf(stage)) {
      stage = highest;
      stageWhy.push({ key: 'stageKept', values: { stage: highest } });
    }
  }

  // Extent: teeth with interdental attachment of 3 mm or more
  const affected = nowCal.filter((c) => (c.interproximal ?? 0) >= 3).length;
  const extentPct = nowCal.length ? Math.round((100 * affected) / nowCal.length) : 0;
  const extent: PerioExtent | null = isCase ? (extentPct >= 30 ? 'generalized' : 'localized') : null;

  // Grade: bone loss / age, then smoking and diabetes
  let grade: PerioGrade | null = null;
  const gradeWhy: Why[] = [];
  const ratio = input.boneLossPct != null && input.age ? input.boneLossPct / input.age : null;
  if (isCase) {
    if (ratio != null) {
      grade = ratio < 0.25 ? 'A' : ratio <= 1 ? 'B' : 'C';
      gradeWhy.push({ key: 'gradeRatio', values: { bone: input.boneLossPct ?? 0, age: input.age ?? 0, ratio: ratio.toFixed(2) } });
    } else {
      // Without evidence of the rate of progression the guideline assumes grade B
      grade = 'B';
      gradeWhy.push({ key: 'gradeDefault' });
    }
    const atLeastB = () => { if (grade === 'A') grade = 'B'; };
    if (input.cigarettes >= 10) { grade = 'C'; gradeWhy.push({ key: 'smokes10' }); } else if (input.cigarettes > 0) { atLeastB(); gradeWhy.push({ key: 'smokesLess' }); }
    if (input.diabetes === 'uncontrolled') { grade = 'C'; gradeWhy.push({ key: 'diabetesBad' }); } else if (input.diabetes === 'controlled') { atLeastB(); gradeWhy.push({ key: 'diabetesOk' }); }
  }

  // Risk (Lang & Tonetti): six parameters in three zones
  const lost = teethMissingOf28(today);
  const riskParams: RiskParam[] = [
    { key: 'bop', value: stats.bopPct, zone: stats.bopPct < 10 ? 0 : stats.bopPct <= 25 ? 1 : 2, scale: [4, 9, 16, 25, 36, 49] },
    { key: 'pockets', value: stats.n5, zone: stats.n5 <= 4 ? 0 : stats.n5 <= 8 ? 1 : 2, scale: [2, 4, 6, 8, 10, 12] },
    { key: 'lost', value: lost, zone: lost <= 4 ? 0 : lost <= 8 ? 1 : 2, scale: [2, 4, 6, 8, 10, 12] },
    { key: 'boneAge', value: ratio == null ? null : Math.round(ratio * 100) / 100, zone: ratio == null || ratio <= 0.5 ? 0 : ratio <= 1 ? 1 : 2, scale: [0.25, 0.5, 0.75, 1, 1.25, 1.5] },
    { key: 'systemic', value: input.diabetes === 'no' ? 0 : 1, zone: input.diabetes === 'no' ? 0 : 2, scale: null },
    { key: 'smoking', value: input.cigarettes, zone: input.cigarettes >= 20 ? 2 : input.cigarettes > 0 ? 1 : 0, scale: [1, 5, 10, 15, 20, 25] },
  ];
  const high = riskParams.filter((p) => p.zone === 2).length;
  const moderate = riskParams.filter((p) => p.zone === 1).length;
  const risk: PerioRisk = high >= 2 ? 'high' : moderate >= 2 || high === 1 ? 'moderate' : 'low';

  return {
    stats,
    stability: stabilityOf(stats),
    endpoints: endpointsMet(stats),
    isCase,
    caseWhy,
    stage,
    stageWhy,
    extent,
    extentPct,
    grade,
    gradeWhy,
    riskParams,
    risk,
    months: intervals[risk],
  };
}

// ── PSR/BPE screening ──

/** Teeth of each sextant (FDI): 1 upper right, 2 upper anterior, 3 upper left, 4 lower left, 5 lower anterior, 6 lower right */
export const SEXTANTS: Record<PerioSextant, number[]> = {
  '1': [18, 17, 16, 15, 14],
  '2': [13, 12, 11, 21, 22, 23],
  '3': [24, 25, 26, 27, 28],
  '4': [34, 35, 36, 37, 38],
  '5': [33, 32, 31, 41, 42, 43],
  '6': [44, 45, 46, 47, 48],
};
export const SEXTANT_ORDER: PerioSextant[] = ['1', '2', '3', '6', '5', '4'];
export const PSR_CODES: PerioPsrCode[] = ['0', '1', '2', '3', '4', 'X'];

export interface ScreeningAssessment {
  coded: number;
  /** Highest code (X aside); null while nothing is coded */
  max: number | null;
  /** Sextants that need a full chart: code 3 or 4, or * */
  chartSextants: PerioSextant[];
  stability: PerioStability;
  risk: PerioRisk;
  months: number;
}

export function assessScreening(screening: PerioScreening | null, intervals: Record<PerioRisk, number> = MAINTENANCE_MONTHS): ScreeningAssessment {
  const codes = screening?.codes ?? {};
  const entries = (Object.entries(codes) as [PerioSextant, PerioPsrCode][]).filter(([, c]) => PSR_CODES.includes(c));
  const numbers = entries.filter(([, c]) => c !== 'X').map(([, c]) => Number(c));
  const max = numbers.length ? Math.max(...numbers) : null;
  const star = new Set(screening?.star ?? []);
  const chartSextants = SEXTANT_ORDER.filter((x) => star.has(x) || codes[x] === '3' || codes[x] === '4');
  const stability: PerioStability = (max ?? 0) >= 3 ? 'unstable' : (max ?? 0) >= 1 ? 'gingivitis' : 'stable';
  const risk: PerioRisk = max === 4 ? 'high' : max === 3 || star.size ? 'moderate' : 'low';
  return { coded: entries.length, max, chartSextants, stability, risk, months: intervals[risk] };
}

/** What the screening calls for: hygiene from code 1, scaling from 2, a full chart from 3 or * */
export function suggestScreeningPlan(a: ScreeningAssessment): Omit<PerioPlanItem, 'include'>[] {
  const items: Omit<PerioPlanItem, 'include'>[] = [];
  const max = a.max ?? 0;
  if (max >= 1) items.push({ id: 'hygiene', kind: 'hygiene', today: true });
  if (max >= 2) items.push({ id: 'scaling', kind: 'scaling', today: max === 2 });
  if (a.chartSextants.length) items.push({ id: 'full-chart', kind: 'fullChart', today: false, detail: a.chartSextants.join(', ') });
  items.push({ id: 'maintenance', kind: 'maintenance', today: false });
  return items;
}

// ── Implants ──

/**
 * Suggested status of an implant: bleeding or suppuration is mucositis; with a depth of 6 mm or
 * more, or 2 mm deeper than in the previous exam, it may be peri-implantitis (an X-ray confirms it).
 */
export function implantStatus(today: PerioTooth, before?: PerioTooth | null): PerioImplantStatus {
  const sites = [...today.sites.v, ...today.sites.i];
  if (!sites.some((s) => s.bop || s.sup)) return 'health';
  const maxNow = Math.max(0, ...sites.map((s) => s.pd ?? 0));
  const prev = before && before.status === 'implant' ? Math.max(0, ...[...before.sites.v, ...before.sites.i].map((s) => s.pd ?? 0)) : null;
  return maxNow >= 6 || (prev != null && prev > 0 && maxNow - prev >= 2) ? 'periimplantitis' : 'mucositis';
}

// ── Plan by EFP steps ──

export interface PlanSite {
  side: 'v' | 'i';
  index: PerioSiteIndex;
  pd: number;
  bop: boolean;
  sup: boolean;
}

/** Items the probing calls for; `describe` writes a site list for the record ("V distal 6 mm con sangrado") */
export function suggestPlan(teeth: PerioTooth[], examType: PerioExamType, stats: PerioStats, describe: (tooth: number, sites: PlanSite[]) => string): Omit<PerioPlanItem, 'include'>[] {
  const items: Omit<PerioPlanItem, 'include'>[] = [];
  if (stats.plaquePct > 20) items.push({ id: 'hygiene', kind: 'hygiene', today: true, detail: `${stats.plaquePct}%` });

  const deep: number[] = [];
  teeth.filter((t) => t.status === 'present').forEach((t) => {
    const sites: PlanSite[] = (['v', 'i'] as const).flatMap((side) => t.sites[side].flatMap((s, index) => (
      s.pd != null && (s.pd >= 6 || (s.pd >= 4 && s.bop)) ? [{ side, index: index as PerioSiteIndex, pd: s.pd, bop: s.bop, sup: s.sup }] : []
    )));
    if (!sites.length) return;
    items.push({ id: `reinstrumentation-${t.tooth}`, kind: 'reinstrumentation', tooth: t.tooth, today: false, detail: describe(t.tooth, sites) });
    if (sites.some((s) => s.pd >= 6)) deep.push(t.tooth);
  });
  if (deep.length) items.push({ id: 'surgery', kind: 'surgery', today: false, detail: deep.join(', ') });

  teeth.filter((t) => t.status === 'implant' && isProbeable(t.status)).forEach((t) => {
    const sites: PlanSite[] = (['v', 'i'] as const).flatMap((side) => t.sites[side].flatMap((s, index) => (
      s.bop || s.sup ? [{ side, index: index as PerioSiteIndex, pd: s.pd ?? 0, bop: s.bop, sup: s.sup }] : []
    )));
    if (!sites.length) return;
    items.push({ id: `implant-rx-${t.tooth}`, kind: 'implantRx', tooth: t.tooth, today: true, detail: describe(t.tooth, sites) });
    items.push({ id: `peri-implant-${t.tooth}`, kind: 'periImplant', tooth: t.tooth, today: false });
  });

  items.push({ id: 'maintenance', kind: 'maintenance', today: examType === 'maintenance' });
  return items;
}

/** Keeps what the professional already chose (include, today) for items that are still called for */
export function mergePlan(suggested: Omit<PerioPlanItem, 'include'>[], current: PerioPlanItem[]): PerioPlanItem[] {
  const byId = new Map(current.map((i) => [i.id, i]));
  return suggested.map((s) => {
    const prev = byId.get(s.id);
    return prev ? { ...s, include: prev.include, today: prev.today } : { ...s, include: true };
  });
}

export const EFP_STEP: Record<PerioPlanItem['kind'], string> = {
  hygiene: '1',
  scaling: '1',
  fullChart: '2',
  reinstrumentation: '2',
  surgery: '3',
  implantRx: 'implant',
  periImplant: 'implant',
  maintenance: '4',
};
