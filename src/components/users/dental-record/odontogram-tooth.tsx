'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { OdontogramMarkStatus, OdontogramSurface, OdontogramToothState } from '@/lib/types';
import { getProcedure, getRender, isAbsenceCondition, isTemporalTooth, isUpperTooth, surfaceLetter, type ToothRender } from './odontogram-catalog';
import { listToothMarks, type OdontogramMark } from './odontogram-state';
import { RING_POSITIONS, sectorPath, surfaceAt, TOOTH_GEOMETRY, toothShape } from './tooth-geometry';

export const STATUS_COLOR: Record<OdontogramMarkStatus, string> = {
  indicated: 'var(--odo-ind)',
  existing: 'var(--odo-ex)',
  done: 'var(--odo-hoy)',
};
export const PENDING_COLOR = 'var(--odo-pend)';

/** Position of a tooth inside a bridge, for its bar and pillars */
export type BridgeEdge = 'start' | 'end' | 'middle' | 'single';

const SCREEN_ANGLE = { top: -90, right: 0, bottom: 90, left: 180 } as const;

interface OdontogramToothProps {
  toothNumber: number;
  tooth: OdontogramToothState | undefined;
  /** `mini`: small and read-only (plan, history) */
  variant?: 'regular' | 'mini';
  selected?: boolean;
  /** First tooth of a bridge being drawn */
  rangeStart?: boolean;
  highlighted?: boolean;
  /** Surfaces picked in the inspector, comma separated (a string keeps memo cheap) */
  selectedSurfaces?: string;
  /** Slots of this tooth that are proposals, comma separated */
  pendingSlots?: string;
  /** Statuses whose layer is hidden, comma separated */
  hiddenStatuses?: string;
  bridgeEdge?: BridgeEdge | null;
  onSurfaceClick?: (tooth: number, surface: OdontogramSurface, event: React.MouseEvent) => void;
  onToothClick?: (tooth: number, event: React.MouseEvent | React.KeyboardEvent) => void;
}

function OdontogramToothBase({
  toothNumber: n,
  tooth,
  variant = 'regular',
  selected = false,
  rangeStart = false,
  highlighted = false,
  selectedSurfaces = '',
  pendingSlots = '',
  hiddenStatuses = '',
  bridgeEdge = null,
  onSurfaceClick,
  onToothClick,
}: OdontogramToothProps) {
  const t = useTranslations('DentalRecord');
  const mini = variant === 'mini';
  const upper = isUpperTooth(n);
  const geometry = TOOTH_GEOMETRY[toothShape(n)];
  const pending = new Set(pendingSlots ? pendingSlots.split(',') : []);
  const hidden = new Set(hiddenStatuses ? hiddenStatuses.split(',') : []);
  const picked = new Set(selectedSurfaces ? selectedSurfaces.split(',') : []);

  const marks = listToothMarks(String(n), tooth).filter((m) => pending.has(m.slot) || !hidden.has(m.status));
  const colorOf = (m: OdontogramMark) => (pending.has(m.slot) ? PENDING_COLOR : STATUS_COLOR[m.status]);
  const surfaceMarks = new Map<OdontogramSurface, OdontogramMark>();
  marks.forEach((m) => { if (m.surface) surfaceMarks.set(m.surface, m); });
  const toothMarks = marks.filter((m) => !m.surface);
  const lastOf = (render: ToothRender) => toothMarks.filter((m) => getRender(m.condition) === render).at(-1);

  const crown = lastOf('crown');
  const crownTmp = lastOf('crown-tmp');
  const canals = lastOf('canals');
  const post = lastOf('post');
  const implant = lastOf('implant');
  const cross = lastOf('cross');
  const bridge = lastOf('bridge');
  const removable = lastOf('removable');
  const fracture = lastOf('fracture');
  const rootFracture = lastOf('root-fracture');
  const apex = lastOf('apex');
  const resorption = lastOf('resorption');
  const remnant = lastOf('root-remnant');
  const recession = lastOf('recession');
  const enlargement = lastOf('enlargement');
  const pocket = lastOf('pocket');
  const furcation = lastOf('furcation');
  const mobility = lastOf('mobility');
  const bracket = lastOf('bracket');
  const wire = lastOf('wire');
  const absent = toothMarks.some((m) => isAbsenceCondition(m.condition));

  const cy = upper ? 123 : 33;
  const r1 = 7;
  const r2 = 18;
  const silhouette = upper ? 'translate(0,12)' : 'translate(0,144) scale(1,-1)';
  const codes = [...new Set(marks.map((m) => getProcedure(m.condition)?.code).filter(Boolean))] as string[];
  const lastMark = marks.at(-1);

  const surfaceFill = (surface: OdontogramSurface): { fill?: string; fillOpacity?: number } => {
    const m = surfaceMarks.get(surface);
    if (!m) return {};
    const render = getRender(m.condition);
    if (render === 'incipient') return {};
    return { fill: colorOf(m), fillOpacity: pending.has(m.slot) ? 0.45 : render === 'sealant' ? 0.45 : 1 };
  };

  const surfaceTitle = (surface: OdontogramSurface) => {
    const m = surfaceMarks.get(surface);
    const base = t('board.surfaceTitle', { tooth: n, surface: t(`surfaces.${surface}`) });
    return m ? `${base} · ${t(`procedures.${m.condition}.label`)}` : base;
  };

  const handleSurface = (surface: OdontogramSurface) => (e: React.MouseEvent) => {
    if (mini || !onSurfaceClick) return;
    e.stopPropagation();
    onSurfaceClick(n, surface, e);
  };

  const interactive = !mini && !!onToothClick;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={t('board.toothLabel', { tooth: n })}
      aria-pressed={interactive ? selected : undefined}
      data-tooth={n}
      onClick={interactive ? (e) => onToothClick?.(n, e) : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToothClick?.(n, e);
        }
      } : undefined}
      className={cn(
        'group relative min-w-0 select-none rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        interactive && 'cursor-pointer',
        isTemporalTooth(n) && 'mx-auto w-[82%]',
      )}
    >
      <svg viewBox="0 0 60 156" className="block h-auto w-full" role="img" aria-hidden>
        <rect
          x="1" y="1" width="58" height="154" rx="9"
          className={cn(!selected && !rangeStart && !highlighted && interactive && 'group-hover:[fill:var(--odo-hover)]')}
          style={{
            fill: selected || rangeStart ? 'var(--odo-sel)' : highlighted ? 'hsl(var(--primary) / 0.08)' : 'transparent',
            stroke: selected || rangeStart || highlighted ? 'hsl(var(--primary))' : 'transparent',
            strokeWidth: 1.6,
            strokeDasharray: rangeStart ? '4 3' : undefined,
          }}
        />

        {/* Silhouette: root(s) and crown, dimmed when the tooth is gone */}
        <g transform={silhouette} opacity={absent ? 0.28 : 1}>
          <rect x="2" y="0" width="56" height="90" fill="transparent" />
          {!implant && geometry.roots.map((d, i) => (
            <path key={i} d={d} style={{ fill: 'var(--odo-root)', stroke: remnant ? colorOf(remnant) : 'var(--odo-tooth-line)', strokeWidth: remnant ? 2.2 : 1.1 }} />
          ))}
          <path
            d={geometry.crown}
            style={{
              fill: crown ? colorOf(crown) : 'var(--odo-tooth)',
              fillOpacity: crown ? 0.2 : 1,
              stroke: crown ? colorOf(crown) : crownTmp ? colorOf(crownTmp) : 'var(--odo-tooth-line)',
              strokeWidth: crown ? 2.8 : crownTmp ? 2.2 : 1.2,
              strokeDasharray: crownTmp ? '4 2.5' : undefined,
              opacity: remnant ? 0.25 : 1,
            }}
          />
          {canals && geometry.canals.map(([x1, y1, x2, y2], i) => (
            <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} style={{ stroke: colorOf(canals), strokeWidth: 3.4, strokeLinecap: 'round' }} />
          ))}
          {post && <path d="M30 52 L30 30" style={{ stroke: colorOf(post), strokeWidth: 5, strokeLinecap: 'round' }} />}
          {apex && <circle cx={geometry.canals[0][2]} cy={geometry.canals[0][3] - 4} r="6" style={{ fill: 'none', stroke: colorOf(apex), strokeWidth: 2 }} />}
          {resorption && <circle cx={geometry.canals[0][2]} cy={geometry.canals[0][3]} r="4.5" style={{ fill: 'none', stroke: colorOf(resorption), strokeWidth: 1.8, strokeDasharray: '2 1.5' }} />}
          {fracture && <path d="M13 60 L21 68 L29 59 L37 68 L46 60" style={{ fill: 'none', stroke: colorOf(fracture), strokeWidth: 2.4 }} />}
          {rootFracture && <path d="M26 14 L33 22 L27 30 L33 38" style={{ fill: 'none', stroke: colorOf(rootFracture), strokeWidth: 2.2 }} />}
          {recession && <path d="M10 50 Q15 45 20 50 T30 50 T40 50 T50 50" style={{ fill: 'none', stroke: colorOf(recession), strokeWidth: 2 }} />}
          {enlargement && <path d="M10 56 Q15 61 20 56 T30 56 T40 56 T50 56" style={{ fill: 'none', stroke: colorOf(enlargement), strokeWidth: 2 }} />}
          {pocket && <path d="M52 22 L52 48" style={{ stroke: colorOf(pocket), strokeWidth: 3, strokeLinecap: 'round' }} />}
          {furcation && <path d="M24 50 L36 50 L30 38 Z" style={{ fill: 'var(--odo-tooth)', stroke: colorOf(furcation), strokeWidth: 1.6 }} />}
          {bracket && <rect x="25" y="60" width="10" height="9" rx="1.5" style={{ fill: colorOf(bracket) }} />}
          {wire && <path d="M0 64.5 L60 64.5" style={{ stroke: colorOf(wire), strokeWidth: 2 }} />}
          {removable && <rect x="5" y="48" width="50" height="40" rx="6" style={{ fill: 'none', stroke: colorOf(removable), strokeWidth: 1.8, strokeDasharray: '3 2' }} />}
          {bridge && (
            <>
              <rect
                x={bridgeEdge === 'start' ? 30 : 0}
                y="61"
                width={bridgeEdge === 'start' || bridgeEdge === 'end' ? 30 : 60}
                height="7"
                style={{ fill: colorOf(bridge) }}
              />
              {bridgeEdge !== 'middle' && <circle cx="30" cy="64.5" r="5" style={{ fill: colorOf(bridge) }} />}
            </>
          )}
        </g>

        {/* Implant: a screw instead of the root, visible even when the tooth is missing */}
        {implant && (
          <g transform={silhouette}>
            <rect x="23" y="10" width="14" height="40" rx="3" style={{ fill: colorOf(implant), fillOpacity: 0.18, stroke: colorOf(implant), strokeWidth: 1.6 }} />
            {[16, 22, 28, 34, 40, 46].map((y) => (
              <path key={y} d={`M21 ${y} L39 ${y + 2}`} style={{ stroke: colorOf(implant), strokeWidth: 1.6 }} />
            ))}
          </g>
        )}

        {cross && (
          <g style={{ stroke: colorOf(cross), strokeWidth: 3.6, strokeLinecap: 'round' }} className="pointer-events-none">
            <path d={`M10 ${upper ? 14 : 56} L50 ${upper ? 100 : 142}`} />
            <path d={`M50 ${upper ? 14 : 56} L10 ${upper ? 100 : 142}`} />
          </g>
        )}

        {/* 5-surface diagram */}
        {RING_POSITIONS.map((position) => {
          const surface = surfaceAt(n, position);
          const fill = surfaceFill(surface);
          return (
            <path
              key={position}
              d={sectorPath(30, cy, r1, r2, position)}
              onClick={handleSurface(surface)}
              className={cn(!mini && onSurfaceClick && 'cursor-pointer hover:[stroke:hsl(var(--primary))] hover:[stroke-width:1.8]')}
              style={{
                fill: fill.fill ?? 'var(--odo-surf)',
                fillOpacity: fill.fillOpacity,
                stroke: picked.has(surface) ? 'hsl(var(--primary))' : 'var(--odo-tooth-line)',
                strokeWidth: picked.has(surface) ? 2.4 : 1.1,
              }}
            >
              <title>{surfaceTitle(surface)}</title>
            </path>
          );
        })}
        <circle
          cx="30" cy={cy} r={r1}
          onClick={handleSurface('center')}
          className={cn(!mini && onSurfaceClick && 'cursor-pointer hover:[stroke:hsl(var(--primary))] hover:[stroke-width:1.8]')}
          style={{
            fill: surfaceFill('center').fill ?? 'var(--odo-surf)',
            fillOpacity: surfaceFill('center').fillOpacity,
            stroke: picked.has('center') ? 'hsl(var(--primary))' : 'var(--odo-tooth-line)',
            strokeWidth: picked.has('center') ? 2.4 : 1.1,
          }}
        >
          <title>{surfaceTitle('center')}</title>
        </circle>

        {/* Incipient caries: a dot on the surface */}
        {[...surfaceMarks.values()].filter((m) => getRender(m.condition) === 'incipient').map((m) => {
          const position = RING_POSITIONS.find((p) => surfaceAt(n, p) === m.surface);
          const angle = position ? (SCREEN_ANGLE[position] * Math.PI) / 180 : 0;
          const radius = position ? (r1 + r2) / 2 : 0;
          return <circle key={m.slot} cx={30 + radius * Math.cos(angle)} cy={cy + radius * Math.sin(angle)} r="2.6" className="pointer-events-none" style={{ fill: colorOf(m) }} />;
        })}

        {crown && <circle cx="30" cy={cy} r="21.5" className="pointer-events-none" style={{ fill: 'none', stroke: colorOf(crown), strokeWidth: 2.4 }} />}
        {mobility && (
          <text x="55" y={cy + 4} textAnchor="end" className="pointer-events-none" style={{ fill: colorOf(mobility), fontSize: 8.2, fontWeight: 700 }}>
            {getProcedure(mobility.condition)?.code === 'MOV_I' ? 'M1' : getProcedure(mobility.condition)?.code === 'MOV_II' ? 'M2' : 'M3'}
          </text>
        )}

        <text
          x="30" y={upper ? 153 : 12} textAnchor="middle"
          className="font-semibold"
          style={{ fontSize: mini ? 13 : 11.5, fill: selected ? 'hsl(var(--primary))' : isTemporalTooth(n) ? '#D97706' : 'hsl(var(--muted-foreground))' }}
        >
          {n}
        </text>
        {!mini && codes.length > 0 && lastMark && (
          <text x="30" y={upper ? 9 : 153} textAnchor="middle" className="pointer-events-none" style={{ fill: colorOf(lastMark), fontSize: 8.2, fontWeight: 700, letterSpacing: '0.02em' }}>
            {codes.slice(0, 2).join('·')}{codes.length > 2 ? '+' : ''}
          </text>
        )}
        {pending.size > 0 && (
          <rect x="1.5" y="1.5" width="57" height="153" rx="9" className="pointer-events-none" style={{ fill: 'none', stroke: PENDING_COLOR, strokeWidth: 1.5, strokeDasharray: '4 3' }} />
        )}
      </svg>
    </div>
  );
}

export const OdontogramTooth = React.memo(OdontogramToothBase);
OdontogramTooth.displayName = 'OdontogramTooth';

/** Letters of a list of surfaces of one tooth, e.g. "OM" */
export function surfaceLetters(tooth: number, surfaces: OdontogramSurface[]): string {
  return surfaces.map((s) => surfaceLetter(tooth, s)).join('');
}
