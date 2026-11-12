import type { PerioSide, PerioTooth } from '@/lib/types';

import { attachmentLevel, isProbeable, PERIO_TEETH, type PerioSiteIndex } from './teeth';

// Comparing two periodontograms (Evolución step). Only changes of 2 mm or more are listed: with a
// manual probe, 1 mm is within the measurement error.

export const CHANGE_MM = 2;

export interface SiteChange {
  tooth: number;
  side: PerioSide;
  index: PerioSiteIndex;
  /** Depth before and today */
  from: number;
  to: number;
  /** Difference in depth and in attachment level (null while a margin is missing) */
  dPd: number;
  dCal: number | null;
}

/** Sites probed in both exams, with their differences */
export function siteChanges(today: PerioTooth[], base: PerioTooth[]): SiteChange[] {
  const baseBy = new Map(base.map((x) => [x.tooth, x]));
  const out: SiteChange[] = [];
  for (const t of today) {
    const b = baseBy.get(t.tooth);
    if (!b || !isProbeable(t.status) || !isProbeable(b.status)) continue;
    (['v', 'i'] as const).forEach((side) => t.sites[side].forEach((s, i) => {
      const p = b.sites[side][i];
      if (s.pd == null || p.pd == null) return;
      const now = attachmentLevel(s);
      const before = attachmentLevel(p);
      out.push({ tooth: t.tooth, side, index: i as PerioSiteIndex, from: p.pd, to: s.pd, dPd: s.pd - p.pd, dCal: now != null && before != null ? now - before : null });
    }));
  }
  return out;
}

/** Sites that lost (or gained) 2 mm or more of depth or attachment, largest first */
export function significantChanges(changes: SiteChange[]) {
  const worse = changes.filter((c) => c.dPd >= CHANGE_MM || (c.dCal ?? 0) >= CHANGE_MM)
    .sort((a, b) => Math.max(b.dPd, b.dCal ?? 0) - Math.max(a.dPd, a.dCal ?? 0));
  const better = changes.filter((c) => c.dPd <= -CHANGE_MM || (c.dCal ?? 0) <= -CHANGE_MM)
    .sort((a, b) => Math.min(a.dPd, a.dCal ?? 0) - Math.min(b.dPd, b.dCal ?? 0));
  return { worse, better };
}

/** Exam between `a` (f = 0) and `b` (f = 1), for the animation: depths and margins move, marks switch halfway */
export function interpolateTeeth(a: PerioTooth[], b: PerioTooth[], f: number): PerioTooth[] {
  const aBy = new Map(a.map((x) => [x.tooth, x]));
  const bBy = new Map(b.map((x) => [x.tooth, x]));
  return PERIO_TEETH.map((n) => {
    const x = aBy.get(n);
    const y = bBy.get(n);
    if (!x || !y) return (f < 0.5 ? x : y) ?? (x ?? y)!;
    const near = f < 0.5 ? x : y;
    if (!isProbeable(x.status) || !isProbeable(y.status)) return near;
    const side = (s: PerioSide) => x.sites[s].map((p, i) => {
      const q = y.sites[s][i];
      const mark = f < 0.5 ? p : q;
      if (p.pd == null || q.pd == null) return mark;
      return { ...mark, pd: p.pd + (q.pd - p.pd) * f, gm: (p.gm ?? 0) + ((q.gm ?? 0) - (p.gm ?? 0)) * f };
    });
    return { ...near, sites: { v: side('v'), i: side('i') } };
  });
}

/** Colour class of a change in mm: strong from 2 mm, soft at 1 */
export function changeTone(delta: number | null): 'worse2' | 'worse1' | 'better1' | 'better2' | null {
  if (delta == null || delta === 0) return null;
  if (delta >= CHANGE_MM) return 'worse2';
  if (delta > 0) return 'worse1';
  if (delta <= -CHANGE_MM) return 'better2';
  return 'better1';
}
