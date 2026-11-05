'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { TOOTH_GEOMETRY, toothShape } from '@/components/users/dental-record/tooth-geometry';
import { changeTone } from '@/lib/perio/compare';
import { type ProbeLine, siteKey } from '@/lib/perio/probe';
import { marginSignOf, usePerioSettingsContext } from '@/lib/perio/settings';
import {
  displayPosition,
  furcationEntries,
  indexAt,
  isProbeable,
  PERIO_LOWER,
  PERIO_UPPER,
  type PerioSiteIndex,
  sameSite,
  type SiteRef,
  attachmentLevel,
} from '@/lib/perio/teeth';
import type { PerioFurcationEntry, PerioSide, PerioSite, PerioTooth } from '@/lib/types';

// One arch of the periodontogram: outer face on top, tooth numbers in the middle, inner face
// below. Crowns face each other in the middle and the value rows sit on the root side, next to
// the curve they describe (gingival margin in blue, bottom of the pocket in red).

const LEFT = 44;
const TOOTH_W = 64;
const MID_GAP = 14;
const WIDTH = LEFT + 16 * TOOTH_W + MID_GAP;
/** SVG units per millimetre */
const MM = 4.4;
const SITE_X = [15, 32, 49];
const ROOT = 64;
const CROWN = 44;
const BAR = 28;

export type PerioPass = 'ps' | 'mg' | 'fm';

const toothX = (k: number) => LEFT + k * TOOTH_W + (k >= 8 ? MID_GAP : 0);

function layout(rows: boolean) {
  const data = rows ? 66 : 8;
  const imgTop = data;
  const cejTop = imgTop + ROOT;
  const barY = imgTop + ROOT + CROWN;
  const imgBot = barY + BAR;
  const cejBot = imgBot + CROWN;
  const dataBot = imgBot + CROWN + ROOT;
  return { imgTop, cejTop, barY, imgBot, cejBot, dataBot, height: dataBot + data };
}

export const severityClass = (pd: number | null) => (pd == null ? '' : pd >= 6 ? 's6' : pd === 5 ? 's5' : pd === 4 ? 's4' : '');
const severityColor = (pd: number) => (pd >= 6 ? 'var(--perio-s6)' : pd === 5 ? 'var(--perio-s5)' : 'var(--perio-s4)');
const ROMAN = ['0', 'I', 'II', 'III'];

interface CurvePoint { x: number; gy: number; by: number; site: PerioSite }

/** Margin and pocket points of one face, split where a tooth is not probed or a site is empty */
function curveSegments(arch: number[], byTooth: Map<number, PerioTooth>, side: PerioSide, cej: number, dir: number, only?: (tooth: number, index: PerioSiteIndex) => boolean): CurvePoint[][] {
  const segments: CurvePoint[][] = [];
  let current: CurvePoint[] | null = null;
  const flush = () => { if (current?.length) segments.push(current); current = null; };
  arch.forEach((tooth, k) => {
    if (k === 8) flush();
    const t = byTooth.get(tooth);
    if (!t || !isProbeable(t.status)) { flush(); return; }
    ([0, 1, 2] as PerioSiteIndex[]).forEach((position) => {
      const index = indexAt(tooth, position);
      const site = t.sites[side][index];
      if (site.pd == null || (only && !only(tooth, index))) { flush(); return; }
      const gy = cej + dir * (site.gm ?? 0) * MM;
      const by = gy + dir * site.pd * MM;
      (current ??= []).push({ x: toothX(k) + SITE_X[position], gy, by, site });
    });
  });
  flush();
  return segments;
}

const polyline = (points: [number, number][]) => points.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

function Curves({ segments, dir, ghost }: { segments: CurvePoint[][]; dir: number; ghost?: boolean }) {
  return (
    <g className="pointer-events-none">
      {segments.map((segment, i) => {
        const margin: [number, number][] = segment.map((p) => [p.x, p.gy]);
        const pocket: [number, number][] = segment.map((p) => [p.x, p.by]);
        if (segment.length === 1) {
          margin.unshift([segment[0].x - 6, segment[0].gy]); margin.push([segment[0].x + 6, segment[0].gy]);
          pocket.unshift([segment[0].x - 6, segment[0].by]); pocket.push([segment[0].x + 6, segment[0].by]);
        }
        if (ghost) {
          return (
            <g key={i} style={{ fill: 'none', stroke: 'var(--perio-ghost)', strokeWidth: 1.6, strokeDasharray: '4 3' }}>
              <path d={polyline(pocket)} />
              <path d={polyline(margin)} style={{ opacity: 0.6 }} />
            </g>
          );
        }
        return (
          <g key={i}>
            <path d={`${polyline(margin)} ${polyline([...pocket].reverse()).replace('M', 'L')} Z`} style={{ fill: 'var(--perio-pocket)' }} />
            <path d={polyline(margin)} style={{ fill: 'none', stroke: 'var(--perio-gm)', strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
            <path d={polyline(pocket)} style={{ fill: 'none', stroke: 'var(--perio-pd)', strokeWidth: 2.2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
            {segment.map((p, j) => (
              <React.Fragment key={j}>
                {p.site.pd != null && p.site.pd >= 4 && <circle cx={p.x} cy={p.by} r="2.8" style={{ fill: severityColor(p.site.pd) }} />}
                {p.site.bop && <circle cx={p.x} cy={p.gy - dir * 5} r="3.1" style={{ fill: 'var(--perio-bop)' }} />}
                {p.site.sup && <circle cx={p.x + 6} cy={p.gy - dir * 5} r="3.1" style={{ fill: 'var(--perio-sup)' }} />}
              </React.Fragment>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Silhouette({ tooth, k, status, cej, up }: { tooth: number; k: number; status: PerioTooth['status']; cej: number; up: boolean }) {
  const geometry = TOOTH_GEOMETRY[toothShape(tooth)];
  const transform = `translate(${toothX(k) + 2} ${cej}) scale(1 ${up ? 1.08 : -1.08}) translate(0 -50)`;
  if (status === 'missing') {
    return <g transform={transform} opacity={0.35}><path d={geometry.crown} style={{ fill: 'none', stroke: 'var(--odo-tooth-line)', strokeDasharray: '3 3' }} /></g>;
  }
  const crown = <path d={geometry.crown} style={{ fill: 'var(--odo-tooth)', stroke: 'var(--odo-tooth-line)', strokeWidth: 1.1 }} />;
  if (status === 'pontic') return <g transform={transform} opacity={0.7}>{crown}</g>;
  if (status === 'implant') {
    return (
      <g transform={transform}>
        <rect x="22" y="12" width="16" height="38" rx="3" style={{ fill: 'hsl(var(--muted))', stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }} />
        {[18, 24, 30, 36, 42].map((y) => <path key={y} d={`M20 ${y} L40 ${y + 2}`} style={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.2 }} />)}
        {crown}
      </g>
    );
  }
  return (
    <g transform={transform}>
      {geometry.roots.map((d, i) => <path key={i} d={d} style={{ fill: 'var(--odo-root)', stroke: 'var(--odo-tooth-line)', strokeWidth: 1 }} />)}
      {crown}
    </g>
  );
}

const signed = (v: number | null) => (v == null ? '–' : v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
const changeOfCal = (today: PerioSite, before: PerioSite) => {
  const a = attachmentLevel(today);
  const b = attachmentLevel(before);
  return a != null && b != null ? Math.round(a - b) : null;
};

/** Evolution, overlay: a bar per site from the pocket bottom before to today's (attachment level); green gained, red lost */
function ChangeBars({ order, byTooth, baseSite, side, cej, dir, label }: {
  order: number[];
  byTooth: Map<number, PerioTooth>;
  baseSite: (tooth: number, side: PerioSide, index: PerioSiteIndex) => PerioSite | null;
  side: PerioSide;
  cej: number;
  dir: number;
  label: (tooth: number, side: PerioSide, index: PerioSiteIndex, delta: number) => string;
}) {
  return (
    <g>
      {order.map((tooth, k) => {
        const x = byTooth.get(tooth);
        if (!x || !isProbeable(x.status)) return null;
        return ([0, 1, 2] as PerioSiteIndex[]).map((position) => {
          const index = indexAt(tooth, position);
          const before = baseSite(tooth, side, index);
          const now = attachmentLevel(x.sites[side][index]);
          const then = attachmentLevel(before);
          if (now == null || then == null) return null;
          const d = Math.round(now - then);
          if (Math.abs(d) < 1) return null;
          const y1 = cej + dir * then * MM;
          const y2 = cej + dir * now * MM;
          return (
            <rect key={`${tooth}-${index}`} x={toothX(k) + SITE_X[position] - 3.5} y={Math.min(y1, y2)} width="7" height={Math.abs(y2 - y1)} rx="2" style={{ fill: d > 0 ? 'var(--perio-worse)' : 'var(--perio-better)', fillOpacity: Math.abs(d) >= 2 ? 0.85 : 0.35 }}>
              <title>{label(tooth, side, index, d)}</title>
            </rect>
          );
        });
      })}
    </g>
  );
}

export interface PerioArchProps {
  arch: 'U' | 'L';
  teeth: PerioTooth[];
  /** Guide exam (the previous one): its values in empty cells and its curve where today is empty */
  ghost?: PerioTooth[] | null;
  cursor?: SiteRef | null;
  pass?: PerioPass;
  selectedTooth?: number | null;
  /** Small chart without the value rows (timeline preview) */
  compact?: boolean;
  /** Row being filled: on a row of marks the probe sits on the dots */
  line?: ProbeLine;
  /** Site the marks (B, S, P) go to: ringed on the dot row */
  flagTarget?: SiteRef | null;
  /** Dictated and not confirmed yet: underlined in violet */
  pending?: ReadonlySet<string>;
  /** Empty cells of this row are outlined (what is missing to close) */
  highlight?: 'pd' | 'gm' | null;
  /** Sites just written or reached by voice: a short pulse over their column */
  flash?: ReadonlySet<string> | null;
  /** Evolution: the earlier exam drawn dashed with change bars, or cells coloured by the change */
  compare?: { base: PerioTooth[]; mode: 'overlay' | 'diff' } | null;
  onCellClick?: (ref: SiteRef, kind: 'pd' | 'gm') => void;
  onDotClick?: (ref: SiteRef) => void;
  onFurcationClick?: (tooth: number, entry: PerioFurcationEntry) => void;
  onMobilityClick?: (tooth: number) => void;
  onToothClick?: (tooth: number) => void;
}

function PerioArchBase({ arch, teeth, ghost, cursor, pass = 'ps', selectedTooth, compact = false, line = 'value', flagTarget, pending, highlight, flash, compare, onCellClick, onDotClick, onFurcationClick, onMobilityClick, onToothClick }: PerioArchProps) {
  const t = useTranslations('PerioRecord.chart');
  const patternId = `perio-half-${React.useId().replace(/:/g, '')}`;
  const order = arch === 'U' ? PERIO_UPPER : PERIO_LOWER;
  const L = layout(!compact);
  const topSide: PerioSide = arch === 'U' ? 'v' : 'i';
  const bottomSide: PerioSide = arch === 'U' ? 'i' : 'v';
  const byTooth = React.useMemo(() => new Map(teeth.map((x) => [x.tooth, x])), [teeth]);
  const ghostBy = React.useMemo(() => (ghost ? new Map(ghost.map((x) => [x.tooth, x])) : null), [ghost]);
  const interactive = !!onCellClick;
  const gmSign = marginSignOf(usePerioSettingsContext());
  const baseBy = React.useMemo(() => (compare ? new Map(compare.base.map((x) => [x.tooth, x])) : null), [compare]);
  const baseSite = (tooth: number, side: PerioSide, index: PerioSiteIndex) => {
    const b = baseBy?.get(tooth);
    return b && isProbeable(b.status) ? b.sites[side][index] : null;
  };

  const ghostSite = (tooth: number, side: PerioSide, index: PerioSiteIndex) => {
    const g = ghostBy?.get(tooth);
    return g && isProbeable(g.status) ? g.sites[side][index] : null;
  };

  // Guide curve only where today has no depth yet
  const ghostCurves = (side: PerioSide, cej: number, dir: number) => {
    if (compare?.mode === 'overlay' && baseBy) return <Curves segments={curveSegments(order, baseBy, side, cej, dir)} dir={dir} ghost />;
    if (!ghostBy || compare) return null;
    const ghostTeeth = new Map<number, PerioTooth>();
    order.forEach((n) => { const g = ghostBy.get(n); if (g) ghostTeeth.set(n, g); });
    const todayEmpty = (tooth: number, index: PerioSiteIndex) => byTooth.get(tooth)?.sites[side][index]?.pd == null;
    return <Curves segments={curveSegments(order, ghostTeeth, side, cej, dir, todayEmpty)} dir={dir} ghost />;
  };

  const rows = { top: { dot: 2, gm: 20, pd: 42 }, bottom: { pd: L.dataBot + 4, gm: L.dataBot + 28, dot: L.dataBot + 48 } };

  const cells = (side: PerioSide, kind: 'pd' | 'gm' | 'dot', y: number) => order.map((tooth, k) => {
    const x = byTooth.get(tooth);
    if (!x || !isProbeable(x.status)) {
      return kind === 'pd'
        ? <text key={tooth} x={toothX(k) + 32} y={y + 15} textAnchor="middle" style={{ fontSize: 10, fontStyle: 'italic', fill: 'hsl(var(--muted-foreground))' }}>{x?.status === 'pontic' ? t('pontic') : t('missing')}</text>
        : null;
    }
    return ([0, 1, 2] as PerioSiteIndex[]).map((position) => {
      const index = indexAt(tooth, position);
      const site = x.sites[side][index];
      const cx = toothX(k) + SITE_X[position];
      const ref: SiteRef = { tooth, side, index };
      const label = `${tooth} ${t(side === 'v' ? 'sides.v' : arch === 'U' ? 'sides.iUpper' : 'sides.iLower')} · ${t(`sites.${index}`)}`;
      if (kind === 'dot') {
        const onRow = line !== 'value' && pass === 'ps' && sameSite(cursor, ref);
        const target = !onRow && sameSite(flagTarget, ref);
        const dictated = pending?.has(siteKey(ref));
        return (
          <g key={`${tooth}-${index}`} onClick={onDotClick ? () => onDotClick(ref) : undefined} className={cn(onDotClick && 'cursor-pointer')}>
            <rect data-cursor={onRow ? '' : undefined} x={cx - 8} y={y} width="16" height="14" rx="4" style={{ fill: onRow ? 'hsl(var(--primary) / 0.12)' : 'transparent', stroke: onRow ? 'hsl(var(--primary))' : 'transparent', strokeWidth: 1.8 }} />
            {target && <circle cx={cx} cy={y + 7} r="7.2" className="pointer-events-none" style={{ fill: 'none', stroke: 'hsl(var(--primary))', strokeWidth: 1.6, strokeDasharray: '2.5 2' }} />}
            <circle cx={cx} cy={y + 7} r="4" style={{ fill: site.bop ? 'var(--perio-bop)' : 'var(--odo-surf)', stroke: dictated ? 'var(--perio-dict)' : site.sup ? 'var(--perio-sup)' : site.bop ? 'var(--perio-bop)' : 'var(--odo-tooth-line)', strokeWidth: site.sup || dictated ? 2.4 : 1 }} />
            {site.plaque && <rect x={cx - 4} y={y + 12.5} width="8" height="2.4" rx="1" style={{ fill: 'var(--perio-pl)' }} />}
            <title>{`${label}${site.bop ? ` · ${t('bop')}` : ''}${site.sup ? ` · ${t('sup')}` : ''}${site.plaque ? ` · ${t('plaque')}` : ''}`}</title>
          </g>
        );
      }
      // The margin is shown with the sign the clinic types it with (the record keeps recession positive)
      const value = kind === 'pd' ? site.pd : site.gm == null ? null : gmSign * site.gm;
      const prev = ghostSite(tooth, side, index);
      const prevValue = prev ? (kind === 'pd' ? prev.pd : prev.gm == null ? null : gmSign * prev.gm) : null;
      const isCursor = line === 'value' && sameSite(cursor, ref) && ((kind === 'pd' && pass === 'ps') || (kind === 'gm' && pass === 'mg'));
      const severity = kind === 'pd' ? severityClass(value == null ? null : Math.round(value)) : '';
      // Rounded: the evolution animation passes values between two exams
      const fmt = (v: number) => { const n = Math.round(v); return n < 0 ? `−${Math.abs(n)}` : String(n); };
      const text = value != null ? fmt(value) : prevValue != null ? fmt(prevValue) : '·';
      const h = kind === 'pd' ? 20 : 18;
      const missingHere = highlight === kind && value == null;
      const dictated = value != null && pending?.has(siteKey(ref));
      const before = compare ? baseSite(tooth, side, index) : null;
      const tone = compare?.mode === 'diff' && kind === 'pd' && value != null && before?.pd != null ? changeTone(Math.round(value) - before.pd) : null;
      const toneFill = tone === 'worse2' ? 'var(--perio-worse-strong)' : tone === 'worse1' ? 'var(--perio-s6-soft)' : tone === 'better2' ? 'var(--perio-better-strong)' : tone === 'better1' ? 'var(--perio-better-soft)' : null;
      return (
        <g key={`${tooth}-${index}`} onClick={onCellClick ? () => onCellClick(ref, kind) : undefined} className={cn(onCellClick && 'cursor-pointer')}>
          <rect
            data-cursor={isCursor ? '' : undefined}
            x={cx - 8.5} y={y} width="17" height={h} rx="4.5"
            className={cn(interactive && !isCursor && 'hover:[fill:hsl(var(--muted))]')}
            style={{
              fill: isCursor ? 'hsl(var(--primary) / 0.12)' : compare?.mode === 'diff' && kind === 'pd' ? toneFill ?? 'transparent' : severity === 's4' ? 'var(--perio-s4-soft)' : severity ? 'var(--perio-s6-soft)' : missingHere ? 'var(--perio-missing-soft)' : 'transparent',
              stroke: isCursor ? 'hsl(var(--primary))' : missingHere ? 'var(--perio-missing)' : 'transparent',
              strokeWidth: 1.8,
              strokeDasharray: missingHere && !isCursor ? '3 2' : undefined,
            }}
          />
          <text
            x={cx} y={y + (kind === 'pd' ? 14.5 : 13)} textAnchor="middle"
            className="pointer-events-none"
            style={{
              fontSize: kind === 'pd' ? 12.5 : 11.5,
              fontWeight: value != null && kind === 'pd' ? 600 : value != null ? 500 : 400,
              fontStyle: value == null && prevValue != null ? 'italic' : undefined,
              fill: value == null ? (prevValue != null ? 'var(--perio-ghost)' : 'hsl(var(--muted-foreground))') : isCursor ? 'hsl(var(--primary))' : severity === 's5' || severity === 's6' ? 'var(--perio-s6)' : kind === 'gm' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            }}
          >
            {text}
          </text>
          {dictated && <path d={`M${cx - 6} ${y + h - 2} H${cx + 6}`} className="pointer-events-none" style={{ stroke: 'var(--perio-dict)', strokeWidth: 2, strokeLinecap: 'round' }} />}
          <title>{`${label} · ${t(kind === 'pd' ? 'pd' : 'gm')}${prevValue != null ? ` · ${t('before', { value: fmt(prevValue) })}` : ''}${before?.pd != null && value != null ? ` · ${t('change', { before: before.pd, pd: signed(Math.round(value) - before.pd), cal: signed(changeOfCal(site, before)) })}` : ''}`}</title>
        </g>
      );
    });
  });

  const furcations = (side: PerioSide, cej: number, dir: number) => order.map((tooth, k) => {
    const x = byTooth.get(tooth);
    if (!x || x.status !== 'present') return null;
    return furcationEntries(tooth)
      .filter((entry) => (side === 'v' ? entry === 'v' : entry !== 'v'))
      .map((entry) => {
        const grade = x.furcation[entry] ?? 0;
        const position = entry === 'v' || entry === 'l' ? 1 : entry === 'mp' ? displayPosition(tooth, 2) : displayPosition(tooth, 0);
        const fx = toothX(k) + SITE_X[position];
        const fy = cej + dir * 3.4 * MM;
        const h = 7 * dir;
        return (
          <g key={`${tooth}-${entry}`} onClick={onFurcationClick ? () => onFurcationClick(tooth, entry) : undefined} className={cn(onFurcationClick && 'cursor-pointer')}>
            <rect x={fx - 9} y={Math.min(fy, fy + h) - 4} width="18" height="16" fill="transparent" />
            {grade ? (
              <path d={`M${fx - 6} ${fy + h} L${fx + 6} ${fy + h} L${fx} ${fy} Z`} style={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.4, fill: grade === 3 ? 'hsl(var(--muted-foreground))' : grade === 2 ? `url(#${patternId})` : 'var(--odo-surf)' }} />
            ) : (
              !compact && <path d={`M${fx - 4} ${fy + h} L${fx + 4} ${fy + h} L${fx} ${fy + h * 0.3} Z`} style={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.2, fill: 'var(--odo-surf)', opacity: 0.25 }} />
            )}
            <title>{t('furcationTitle', { tooth, entry: t(`furcation.${entry}`), grade: grade ? ROMAN[grade] : t('noLesion') })}</title>
          </g>
        );
      });
  });

  // Pulse over the sites a voice command wrote or went to, from the dot row to the depth row
  const flashBands = (side: PerioSide, top: boolean) => (flash?.size ? order.map((tooth, k) => ([0, 1, 2] as PerioSiteIndex[]).map((position) => {
    const index = indexAt(tooth, position);
    if (!flash.has(siteKey({ tooth, side, index }))) return null;
    const y0 = top ? rows.top.dot - 1 : rows.bottom.pd - 1;
    const y1 = top ? rows.top.pd + 21 : rows.bottom.dot + 15;
    return (
      <rect key={`${tooth}${side}${index}`} data-flash="" x={toothX(k) + SITE_X[position] - 10} y={y0} width="20" height={y1 - y0} rx="6" className="pointer-events-none animate-pulse" style={{ fill: 'hsl(var(--primary) / 0.16)', stroke: 'hsl(var(--primary))', strokeWidth: 1.6 }} />
    );
  })) : null);

  const cursorLine = (() => {
    if (!cursor || pass === 'fm' || !order.includes(cursor.tooth)) return null;
    const k = order.indexOf(cursor.tooth);
    const x = toothX(k) + SITE_X[displayPosition(cursor.tooth, cursor.index)];
    const top = cursor.side === topSide;
    return <path d={`M${x} ${top ? L.imgTop + 2 : L.imgBot + CROWN} V${top ? L.cejTop : L.dataBot - 2}`} className="pointer-events-none" style={{ fill: 'none', stroke: 'hsl(var(--primary))', strokeWidth: 1.5, strokeDasharray: '3 3' }} />;
  })();

  return (
    <svg viewBox={`0 0 ${WIDTH} ${L.height}`} className="block h-auto w-full select-none" role="img" aria-label={t(arch === 'U' ? 'upperAria' : 'lowerAria')}>
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" style={{ fill: 'var(--odo-surf)' }} />
          <path d="M0 4L4 0" style={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.4 }} />
        </pattern>
      </defs>

      {/* Tooth columns: hover and selection */}
      {order.map((tooth, k) => (
        <rect
          key={tooth}
          x={toothX(k) + 1} y={L.imgTop} width={TOOTH_W - 2} height={ROOT * 2 + CROWN * 2 + BAR} rx="10"
          onClick={onToothClick ? () => onToothClick(tooth) : undefined}
          className={cn(onToothClick && 'cursor-pointer', onToothClick && selectedTooth !== tooth && 'hover:[fill:var(--odo-hover)]')}
          style={{ fill: selectedTooth === tooth ? 'var(--odo-sel)' : 'transparent' }}
        />
      ))}

      {/* Millimetre grid (3, 6, 9) */}
      {[3, 6, 9].map((m) => (
        <g key={m} className="pointer-events-none">
          <path d={`M${LEFT} ${L.cejTop - m * MM} H${WIDTH}`} style={{ stroke: 'var(--perio-grid)', strokeWidth: 1 }} />
          <path d={`M${LEFT} ${L.cejBot + m * MM} H${WIDTH}`} style={{ stroke: 'var(--perio-grid)', strokeWidth: 1 }} />
          {!compact && (
            <>
              <text x={LEFT - 6} y={L.cejTop - m * MM + 3} textAnchor="end" style={{ fontSize: 8.5, fill: 'hsl(var(--muted-foreground))' }}>{m}</text>
              <text x={LEFT - 6} y={L.cejBot + m * MM + 3} textAnchor="end" style={{ fontSize: 8.5, fill: 'hsl(var(--muted-foreground))' }}>{m}</text>
            </>
          )}
        </g>
      ))}

      {/* Silhouettes and the cemento-enamel junction of each tooth */}
      <g className="pointer-events-none">
        {order.map((tooth, k) => {
          const status = byTooth.get(tooth)?.status ?? 'missing';
          return (
            <React.Fragment key={tooth}>
              <Silhouette tooth={tooth} k={k} status={status} cej={L.cejTop} up />
              <Silhouette tooth={tooth} k={k} status={status} cej={L.cejBot} up={false} />
              {isProbeable(status) && (
                <path d={`M${toothX(k) + 6} ${L.cejTop} H${toothX(k) + TOOTH_W - 6} M${toothX(k) + 6} ${L.cejBot} H${toothX(k) + TOOTH_W - 6}`} style={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '2 3' }} />
              )}
            </React.Fragment>
          );
        })}
      </g>

      {/* Row and face labels */}
      {!compact && (
        <g className="pointer-events-none" style={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em' }}>
          <text x="4" y={rows.top.dot + 11}>{t('rows.bop')}</text>
          <text x="4" y={rows.top.gm + 13}>{t('rows.gm')}</text>
          <text x="4" y={rows.top.pd + 14}>{t('rows.pd')}</text>
          <text x="4" y={rows.bottom.pd + 14}>{t('rows.pd')}</text>
          <text x="4" y={rows.bottom.gm + 13}>{t('rows.gm')}</text>
          <text x="4" y={rows.bottom.dot + 11}>{t('rows.bop')}</text>
          <text x="4" y={L.cejTop - 22} style={{ fill: 'hsl(var(--foreground))' }}>{t(arch === 'U' ? 'faces.vestibular' : 'faces.lingual')}</text>
          <text x="4" y={L.cejBot + 30} style={{ fill: 'hsl(var(--foreground))' }}>{t(arch === 'U' ? 'faces.palatal' : 'faces.vestibular')}</text>
        </g>
      )}

      {/* Number bar: tooth number, mobility and implant */}
      {order.map((tooth, k) => {
        const x = byTooth.get(tooth);
        const cx = toothX(k) + 32;
        const y = L.barY + 18;
        const canMobility = !!onMobilityClick && x?.status === 'present';
        return (
          <g key={tooth} onClick={canMobility ? () => onMobilityClick!(tooth) : undefined} className={cn(canMobility && 'cursor-pointer')}>
            <text x={cx} y={y} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: selectedTooth === tooth ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>{tooth}</text>
            {x?.status === 'implant' && <text x={cx + 20} y={y - 6} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: 'var(--odo-ex)' }}>IMP</text>}
            {!!x?.mobility && (
              <>
                <rect x={cx - 27} y={y - 13} width="15" height="13" rx="4" style={{ fill: 'var(--perio-s4-soft)' }} />
                <text x={cx - 19.5} y={y - 3.5} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: 'var(--perio-s5)' }}>{ROMAN[x.mobility]}</text>
              </>
            )}
            <title>{x?.status === 'present' ? t('mobilityTitle', { tooth, grade: ROMAN[x.mobility ?? 0] }) : `${tooth} · ${t(`status.${x?.status ?? 'missing'}`)}`}</title>
          </g>
        );
      })}

      {ghostCurves(topSide, L.cejTop, -1)}
      {ghostCurves(bottomSide, L.cejBot, 1)}
      <Curves segments={curveSegments(order, byTooth, topSide, L.cejTop, -1)} dir={-1} />
      <Curves segments={curveSegments(order, byTooth, bottomSide, L.cejBot, 1)} dir={1} />
      {compare?.mode === 'overlay' && (
        <>
          <ChangeBars order={order} byTooth={byTooth} baseSite={baseSite} side={topSide} cej={L.cejTop} dir={-1} label={(tooth, side, index, d) => t(d > 0 ? 'lost' : 'gained', { site: `${tooth} ${t(side === 'v' ? 'sidesShort.v' : arch === 'U' ? 'sidesShort.iUpper' : 'sidesShort.iLower')} ${t(`sites.${index}`)}`, mm: Math.abs(d) })} />
          <ChangeBars order={order} byTooth={byTooth} baseSite={baseSite} side={bottomSide} cej={L.cejBot} dir={1} label={(tooth, side, index, d) => t(d > 0 ? 'lost' : 'gained', { site: `${tooth} ${t(side === 'v' ? 'sidesShort.v' : arch === 'U' ? 'sidesShort.iUpper' : 'sidesShort.iLower')} ${t(`sites.${index}`)}`, mm: Math.abs(d) })} />
        </>
      )}
      {furcations(topSide, L.cejTop, -1)}
      {furcations(bottomSide, L.cejBot, 1)}

      {!compact && (
        <>
          {flashBands(topSide, true)}
          {flashBands(bottomSide, false)}
          {cells(topSide, 'dot', rows.top.dot)}
          {cells(topSide, 'gm', rows.top.gm)}
          {cells(topSide, 'pd', rows.top.pd)}
          {cells(bottomSide, 'pd', rows.bottom.pd)}
          {cells(bottomSide, 'gm', rows.bottom.gm)}
          {cells(bottomSide, 'dot', rows.bottom.dot)}
        </>
      )}
      {cursorLine}
    </svg>
  );
}

export const PerioArch = React.memo(PerioArchBase);
PerioArch.displayName = 'PerioArch';

/** Both arches, small and read-only (clinical timeline) */
export function PerioPreview({ teeth, className }: { teeth: PerioTooth[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <PerioArch arch="U" teeth={teeth} compact />
      <PerioArch arch="L" teeth={teeth} compact />
    </div>
  );
}

export { ROMAN };
