import type { PerioSide, PerioSite, PerioTooth } from '@/lib/types';

import { isProbeable, sameSite, type SiteRef, siteOf } from './teeth';

// Moving the probe along the sequence. Shared by the keypad, the keyboard and the voice commands,
// so all of them advance the same way.

/** Row being filled: the pass's value (depth or margin) or one of the marks, site by site */
export type ProbeLine = 'value' | 'bop' | 'sup' | 'plaque';
export type ProbeField = 'pd' | 'gm';

export const siteKey = (ref: SiteRef) => `${ref.tooth}${ref.side}${ref.index}`;

/** Next site after `from` in the sequence (wrapping); with `field`, only an empty one */
export function nextSiteIn(sequence: SiteRef[], teeth: PerioTooth[], from: SiteRef | null, field?: ProbeField): SiteRef | null {
  const k = from ? sequence.findIndex((c) => sameSite(c, from)) : -1;
  for (let j = 1; j <= sequence.length; j++) {
    const c = sequence[(k + j + sequence.length) % sequence.length];
    if (!field || siteOf(teeth, c)?.[field] == null) return c;
  }
  return null;
}

export const firstEmpty = (sequence: SiteRef[], teeth: PerioTooth[], field: ProbeField) =>
  sequence.find((c) => siteOf(teeth, c)?.[field] == null) ?? null;

/** First site of a tooth's face in the order it is probed */
export const firstSiteOf = (sequence: SiteRef[], tooth: number, side: PerioSide) =>
  sequence.find((c) => c.tooth === tooth && c.side === side) ?? null;

/** First site of the previous / next tooth of the sequence */
export function neighbourTooth(sequence: SiteRef[], from: SiteRef, delta: 1 | -1): SiteRef | null {
  const k = sequence.findIndex((c) => sameSite(c, from));
  if (k < 0) return null;
  for (let j = 1; j < sequence.length; j++) {
    const c = sequence[(k + delta * j + sequence.length) % sequence.length];
    if (c.tooth !== from.tooth || c.side !== from.side) return firstSiteOf(sequence, c.tooth, c.side);
  }
  return null;
}

export function patchSites(teeth: PerioTooth[], refs: SiteRef[], patch: (s: PerioSite) => PerioSite): PerioTooth[] {
  if (!refs.length) return teeth;
  return teeth.map((x) => {
    const mine = refs.filter((r) => r.tooth === x.tooth);
    if (!mine.length) return x;
    const side = (s: PerioSide) => x.sites[s].map((site, i) => (mine.some((r) => r.side === s && r.index === i) ? patch(site) : site));
    return { ...x, sites: { v: side('v'), i: side('i') } };
  });
}

export function patchToothIn(teeth: PerioTooth[], tooth: number, patch: (x: PerioTooth) => PerioTooth): PerioTooth[] {
  return teeth.map((x) => (x.tooth === tooth ? patch(x) : x));
}

/** Present teeth in screen order (mobility and furcations) */
export const presentTeethOf = (teeth: PerioTooth[]) => teeth.filter((x) => x.status === 'present').map((x) => x.tooth);

export function nextPresentTooth(teeth: PerioTooth[], tooth: number, delta = 1): number {
  const present = presentTeethOf(teeth);
  if (!present.length) return tooth;
  const i = present.indexOf(tooth);
  return present[(i + delta + present.length) % present.length];
}

export const isProbeableTooth = (teeth: PerioTooth[], tooth: number) => isProbeable(teeth.find((x) => x.tooth === tooth)?.status ?? 'missing');
