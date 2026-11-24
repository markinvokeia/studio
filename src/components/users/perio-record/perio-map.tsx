'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { placeArch } from '@/components/users/dental-record/tooth-geometry';
import { changeTone } from '@/lib/perio/compare';
import { attachmentLevel, displayPosition, isProbeable, isUpperPerio, PERIO_LOWER, PERIO_UPPER, type PerioSiteIndex } from '@/lib/perio/teeth';
import type { PerioSide, PerioSite, PerioTooth } from '@/lib/types';
import { ROMAN } from './perio-arch';

// Occlusal view of one arch, laid out like the odontogram's Arcada view. Each tooth is a ring of
// six sectors: the outer half is the vestibular face, the inner half palatal or lingual. A sector
// is coloured by its depth or, when comparing, by the change in attachment level.

/** Sector angles (degrees, SVG) per screen position, on the top or bottom half of the ring */
const TOP: Record<PerioSiteIndex, [number, number]> = { 0: [180, 240], 1: [240, 300], 2: [300, 360] };
const BOTTOM: Record<PerioSiteIndex, [number, number]> = { 0: [120, 180], 1: [60, 120], 2: [0, 60] };

function sector(r1: number, r2: number, [a0, a1]: [number, number]) {
  const p = (r: number, a: number) => `${(r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
}
const centroid = (r: number, [a0, a1]: [number, number]) => {
  const a = (((a0 + a1) / 2) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)] as const;
};

const depthFill = (pd: number | null) => (pd == null ? 'var(--odo-surf)' : pd >= 6 ? 'var(--perio-s6)' : pd === 5 ? 'var(--perio-s5)' : pd === 4 ? 'var(--perio-s4)' : 'var(--perio-better-soft)');
const changeFill = (delta: number | null) => {
  const tone = changeTone(delta);
  return tone === 'worse2' ? 'var(--perio-worse)' : tone === 'worse1' ? 'var(--perio-s6-soft)' : tone === 'better2' ? 'var(--perio-better)' : tone === 'better1' ? 'var(--perio-better-soft)' : 'var(--odo-surf)';
};

export interface PerioMapProps {
  arch: 'U' | 'L';
  teeth: PerioTooth[];
  /** With a base, sectors show the change in attachment level (depth when a margin is missing) */
  base?: PerioTooth[] | null;
  selectedTooth?: number | null;
  onToothClick?: (tooth: number) => void;
}

function PerioMapBase({ arch, teeth, base, selectedTooth, onToothClick }: PerioMapProps) {
  const t = useTranslations('PerioRecord.chart');
  const upper = arch === 'U';
  const cx = 210;
  const cy = upper ? 292 : 28;
  const placements = React.useMemo(() => placeArch(upper ? PERIO_UPPER : PERIO_LOWER, 162, 222, cx, cy, upper), [upper, cy]);
  const byTooth = React.useMemo(() => new Map(teeth.map((x) => [x.tooth, x])), [teeth]);
  const baseBy = React.useMemo(() => (base ? new Map(base.map((x) => [x.tooth, x])) : null), [base]);

  const delta = (now: PerioSite, before: PerioSite | null) => {
    if (!before || now.pd == null || before.pd == null) return null;
    const a = attachmentLevel(now);
    const b = attachmentLevel(before);
    return Math.round(a != null && b != null ? a - b : now.pd - before.pd);
  };

  return (
    <svg viewBox="-16 -6 452 332" className="h-auto max-h-[440px] w-full select-none" role="img" aria-label={t(upper ? 'upperAria' : 'lowerAria')}>
      <text x={cx} y={upper ? 200 : 120} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}>{t(upper ? 'upperArch' : 'lowerArch')}</text>
      {placements.map((p) => {
        const x = byTooth.get(p.tooth);
        const r = p.radius;
        const r1 = r * 0.42;
        const vestTop = isUpperPerio(p.tooth);
        const selected = selectedTooth === p.tooth;
        const label = (
          <text x={p.x + p.nx * (r + 12)} y={p.y + p.ny * (r + 12) + 4} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>{p.tooth}</text>
        );
        if (!x || !isProbeable(x.status)) {
          return (
            <g key={p.tooth} opacity={x?.status === 'pontic' ? 0.6 : 0.4}>
              <circle cx={p.x} cy={p.y} r={r} style={{ fill: 'none', stroke: 'var(--odo-tooth-line)', strokeDasharray: '3 3' }} />
              {label}
              <title>{`${p.tooth} · ${t(`status.${x?.status ?? 'missing'}`)}`}</title>
            </g>
          );
        }
        const b = baseBy?.get(p.tooth);
        const before = (s: PerioSide, i: number) => (b && isProbeable(b.status) ? b.sites[s][i] : null);
        return (
          <g key={p.tooth} onClick={onToothClick ? () => onToothClick(p.tooth) : undefined} className={cn(onToothClick && 'cursor-pointer')}>
            <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`}>
              {(['v', 'i'] as PerioSide[]).map((s) => ([0, 1, 2] as PerioSiteIndex[]).map((index) => {
                const site = x.sites[s][index];
                const half = (s === 'v') === vestTop ? TOP : BOTTOM;
                const angles = half[displayPosition(p.tooth, index)];
                const d = baseBy ? delta(site, before(s, index)) : null;
                const fill = baseBy ? changeFill(d) : depthFill(site.pd == null ? null : Math.round(site.pd));
                const [dx, dy] = centroid((r1 + r) / 2, angles);
                return (
                  <g key={`${s}${index}`}>
                    <path d={sector(r1, r, angles)} style={{ fill, stroke: 'hsl(var(--card))', strokeWidth: 1.2 }}>
                      <title>{`${p.tooth} ${t(s === 'v' ? 'sides.v' : upper ? 'sides.iUpper' : 'sides.iLower')} · ${t(`sites.${index}`)} · ${site.pd == null ? '–' : Math.round(site.pd)} mm${d != null ? ` · ${d > 0 ? '+' : ''}${d} mm` : ''}`}</title>
                    </path>
                    {site.bop && <circle cx={dx} cy={dy} r={2.4} className="pointer-events-none" style={{ fill: 'var(--perio-bop)' }} />}
                  </g>
                );
              }))}
              <circle r={r1} style={{ fill: 'var(--odo-tooth)', stroke: selected ? 'hsl(var(--primary))' : 'var(--odo-tooth-line)', strokeWidth: selected ? 2.4 : 1 }} />
              {!!x.mobility && <text y={4} textAnchor="middle" transform={`rotate(${-p.angle.toFixed(1)})`} style={{ fontSize: 10, fontWeight: 700, fill: 'var(--perio-s5)' }}>{ROMAN[x.mobility]}</text>}
            </g>
            {selected && <circle cx={p.x} cy={p.y} r={r + 3} className="pointer-events-none" style={{ fill: 'none', stroke: 'hsl(var(--primary))', strokeWidth: 2 }} />}
            {label}
          </g>
        );
      })}
    </svg>
  );
}

export const PerioMap = React.memo(PerioMapBase);
PerioMap.displayName = 'PerioMap';
