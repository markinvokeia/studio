import type { PerioExamStatus, PerioStats, PerioTooth } from '@/lib/types';

import { attachmentLevel, isProbedIn, type ProbeMode } from './teeth';

// Live indices while probing. Same rules as perio_exam_recompute() (database/scripts/162): the
// screen shows these while the autosave is on its way and the server stores its own.

export function computeStats(teeth: PerioTooth[]): PerioStats {
  const sites = teeth.filter((t) => t.status === 'present').flatMap((t) =>
    (['v', 'i'] as const).flatMap((side) => t.sites[side].map((s, index) => ({ tooth: t.tooth, index, s }))),
  );
  const probed = sites.filter((x) => x.s.pd != null);
  const n = probed.length;
  const pct = (count: number) => (n ? Math.round((100 * count) / n) : 0);
  const cals = probed.map((x) => attachmentLevel(x.s)).filter((v): v is number => v != null);
  const interproximal = probed.filter((x) => x.index !== 1).map((x) => attachmentLevel(x.s)).filter((v): v is number => v != null);
  const mean = (values: number[]) => (values.length ? Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length) / 100 : null);
  const pd = (x: (typeof probed)[number]) => x.s.pd as number;
  return {
    sites: n,
    bopPct: pct(probed.filter((x) => x.s.bop).length),
    plaquePct: pct(probed.filter((x) => x.s.plaque).length),
    meanPd: mean(probed.map(pd)),
    meanCal: mean(cals),
    n4: probed.filter((x) => pd(x) >= 4).length,
    n5: probed.filter((x) => pd(x) >= 5).length,
    n6: probed.filter((x) => pd(x) >= 6).length,
    b4: probed.filter((x) => pd(x) === 4 && x.s.bop).length,
    b5: probed.filter((x) => pd(x) >= 5 && x.s.bop).length,
    teeth5: new Set(probed.filter((x) => pd(x) >= 5).map((x) => x.tooth)).size,
    maxInterproximalCal: interproximal.length ? Math.max(...interproximal) : null,
  };
}

export interface ProbeProgress {
  /** Sites of the probeable teeth (present and implants) */
  total: number;
  pd: number;
  gm: number;
}

export function probeProgress(teeth: PerioTooth[], mode?: ProbeMode): ProbeProgress {
  const sites = teeth.filter((t) => isProbedIn(t.status, mode)).flatMap((t) => [...t.sites.v, ...t.sites.i]);
  return { total: sites.length, pd: sites.filter((s) => s.pd != null).length, gm: sites.filter((s) => s.gm != null).length };
}

/** Weight of the probing in the completeness; the confirmed diagnosis is the rest */
const PROBING_WEIGHT = 90;

/** Status of an open exam: probed once every site has its depth and its margin; diagnosed once the diagnosis is confirmed */
export function computeStatus(progress: ProbeProgress, stored?: PerioExamStatus, diagnosisConfirmed = false): PerioExamStatus {
  if (stored === 'closed' || stored === 'void') return stored;
  const probed = progress.total > 0 && progress.pd === progress.total && progress.gm === progress.total;
  if (!probed) return 'probing';
  return diagnosisConfirmed ? 'diagnosed' : 'probed';
}

/** Depth and margin weigh the same (90 % between them); the confirmed diagnosis, the last 10 % */
export function computeCompleteness(progress: ProbeProgress, status: PerioExamStatus): number {
  if (status === 'closed') return 100;
  const probing = progress.total ? (PROBING_WEIGHT * (progress.pd + progress.gm)) / (2 * progress.total) : 0;
  return Math.round(probing + (status === 'diagnosed' ? 100 - PROBING_WEIGHT : 0));
}
