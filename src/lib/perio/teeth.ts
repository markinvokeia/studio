import type { PerioFurcationEntry, PerioSide, PerioSite, PerioTooth, PerioToothStatus } from '@/lib/types';

// Teeth, sites and the probing sequence of the periodontogram. Sites are stored per side in
// anatomical order (0 distal, 1 center, 2 mesial); on screen distal points away from the midline.

/** Screen order (patient's right → left) */
export const PERIO_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const PERIO_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const PERIO_TEETH = [...PERIO_UPPER, ...PERIO_LOWER];

export const SITE_KEYS = ['D', 'C', 'M'] as const;
export type PerioSiteIndex = 0 | 1 | 2;

export const quadrantOf = (tooth: number) => Math.floor(tooth / 10);
export const isUpperPerio = (tooth: number) => quadrantOf(tooth) <= 2;
export const isMolarPerio = (tooth: number) => tooth % 10 >= 6;

/** Screen position (0 left · 1 center · 2 right) of a site index of this tooth */
export const displayPosition = (tooth: number, index: PerioSiteIndex) =>
  ([1, 4].includes(quadrantOf(tooth)) ? index : 2 - index) as PerioSiteIndex;

/** Site index drawn at a screen position */
export const indexAt = (tooth: number, position: PerioSiteIndex) =>
  ([0, 1, 2] as PerioSiteIndex[]).find((i) => displayPosition(tooth, i) === position)!;

/** Furcation entries of a tooth: upper molars V, MP, DP; lower molars V, L; none on third molars */
export function furcationEntries(tooth: number): PerioFurcationEntry[] {
  if (!isMolarPerio(tooth) || tooth % 10 === 8) return [];
  return isUpperPerio(tooth) ? ['v', 'mp', 'dp'] : ['v', 'l'];
}

/** Teeth that are probed: present and implants (missing teeth and pontics are skipped) */
export const isProbeable = (status: PerioToothStatus) => status === 'present' || status === 'implant';

export const emptySite = (): PerioSite => ({ pd: null, gm: null, bop: false, sup: false, plaque: false, source: 'manual' });

export function emptyTooth(tooth: number, status: PerioToothStatus = 'present'): PerioTooth {
  return {
    tooth,
    status,
    mobility: null,
    furcation: {},
    note: '',
    sites: { v: [emptySite(), emptySite(), emptySite()], i: [emptySite(), emptySite(), emptySite()] },
  };
}

/** The 32 adult teeth in screen order, filling what the server did not send */
export function normalizeTeeth(teeth: PerioTooth[]): PerioTooth[] {
  const byTooth = new Map(teeth.map((t) => [t.tooth, t]));
  return PERIO_TEETH.map((n) => {
    const t = byTooth.get(n);
    if (!t) return emptyTooth(n, 'missing');
    const side = (s: PerioSide) => [0, 1, 2].map((i) => ({ ...emptySite(), ...(t.sites?.[s]?.[i] ?? {}) }));
    return { ...emptyTooth(n, t.status), ...t, note: t.note ?? '', furcation: t.furcation ?? {}, sites: { v: side('v'), i: side('i') } };
  });
}

export interface SiteRef {
  tooth: number;
  side: PerioSide;
  index: PerioSiteIndex;
}

export const sameSite = (a: SiteRef | null | undefined, b: SiteRef | null | undefined) =>
  !!a && !!b && a.tooth === b.tooth && a.side === b.side && a.index === b.index;

/** How the probe moves (clinic setting) and what is probed (implants-only exams) */
export interface ProbeMode {
  /** arch: upper buccal → upper palatal → lower buccal → lower lingual; buccalFirst: both buccal faces first */
  order?: 'arch' | 'buccalFirst';
  implantsOnly?: boolean;
}

/** Teeth probed in this mode: present and implants, or only implants */
export const isProbedIn = (status: PerioToothStatus, mode?: ProbeMode) => (mode?.implantsOnly ? status === 'implant' : isProbeable(status));

/**
 * Probing sequence: upper vestibular 18→28, upper palatal 28→18, lower vestibular 48→38, lower
 * lingual 38→48 (or both buccal faces first), skipping missing teeth and pontics.
 */
export function probeSequence(teeth: PerioTooth[], mode?: ProbeMode): SiteRef[] {
  const status = new Map(teeth.map((t) => [t.tooth, t.status]));
  const out: SiteRef[] = [];
  const add = (arch: number[], side: PerioSide, reverse: boolean) => {
    for (const tooth of reverse ? [...arch].reverse() : arch) {
      if (!isProbedIn(status.get(tooth) ?? 'missing', mode)) continue;
      for (const position of (reverse ? [2, 1, 0] : [0, 1, 2]) as PerioSiteIndex[]) {
        out.push({ tooth, side, index: indexAt(tooth, position) });
      }
    }
  };
  if (mode?.order === 'buccalFirst') {
    add(PERIO_UPPER, 'v', false);
    add(PERIO_LOWER, 'v', true);
    add(PERIO_LOWER, 'i', false);
    add(PERIO_UPPER, 'i', true);
  } else {
    add(PERIO_UPPER, 'v', false);
    add(PERIO_UPPER, 'i', true);
    add(PERIO_LOWER, 'v', false);
    add(PERIO_LOWER, 'i', true);
  }
  return out;
}

export function siteOf(teeth: PerioTooth[], ref: SiteRef): PerioSite | undefined {
  return teeth.find((t) => t.tooth === ref.tooth)?.sites[ref.side][ref.index];
}

/** Clinical attachment level = probing depth + gingival margin; null while either is missing */
export const attachmentLevel = (site: PerioSite | undefined | null) =>
  site && site.pd != null && site.gm != null ? site.pd + site.gm : null;
