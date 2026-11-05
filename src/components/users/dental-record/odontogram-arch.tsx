'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { OdontogramMarkStatus, OdontogramState, OdontogramSurface } from '@/lib/types';
import { getProcedure, getRender, isAbsenceCondition, isRangeCondition, isUpperTooth, LOWER_PERMANENT, LOWER_TEMPORAL, type ToothRender, UPPER_PERMANENT, UPPER_TEMPORAL } from './odontogram-catalog';
import { bridgeEdges, type ChartInteraction, type Dentition } from './odontogram-chart';
import { listToothMarks, type OdontogramMark } from './odontogram-state';
import { PENDING_COLOR, STATUS_COLOR } from './odontogram-tooth';
import { type ArchPlacement, placeArch, RING_POSITIONS, sectorPath, surfaceAt } from './tooth-geometry';

interface OdontogramArchProps extends ChartInteraction {
  state: OdontogramState;
  dentition: Dentition;
  /** One arch per row instead of side by side */
  stacked?: boolean;
}

/** Occlusal view: each tooth is its 5-surface diagram turned along the arch, marked like the FDI chart */
export function OdontogramArch({ state, dentition, stacked = false, ...interaction }: OdontogramArchProps) {
  return (
    <div className={cn('odo-chart mx-auto grid w-full max-w-[1160px] gap-3', stacked ? 'grid-cols-1' : 'grid-cols-2')}>
      <ArchSvg upper state={state} dentition={dentition} interaction={interaction} />
      <ArchSvg upper={false} state={state} dentition={dentition} interaction={interaction} />
    </div>
  );
}

function ArchSvg({ upper, state, dentition, interaction }: { upper: boolean; state: OdontogramState; dentition: Dentition; interaction: ChartInteraction }) {
  const t = useTranslations('DentalRecord.workspace');
  const cx = 210;
  const cy = upper ? 292 : 28;
  const hidden = new Set(interaction.hiddenStatuses ?? []);
  const placements: { p: ArchPlacement; inner: boolean }[] = [];
  const permanent = upper ? UPPER_PERMANENT : LOWER_PERMANENT;
  const temporal = upper ? UPPER_TEMPORAL : LOWER_TEMPORAL;
  if (dentition !== 'temporal') placeArch(permanent, 162, 222, cx, cy, upper).forEach((p) => placements.push({ p, inner: false }));
  if (dentition === 'mixed') placeArch(temporal, 97, 133, cx, cy, upper).forEach((p) => placements.push({ p, inner: true }));
  if (dentition === 'temporal') placeArch(temporal, 138, 189, cx, cy, upper).forEach((p) => placements.push({ p, inner: false }));

  const teeth = placements.map(({ p }) => p.tooth);
  const counts: Record<OdontogramMarkStatus, number> = { indicated: 0, existing: 0, done: 0 };
  teeth.forEach((tooth) => listToothMarks(String(tooth), state[String(tooth)]).forEach((m) => { counts[m.status] += 1; }));
  // The summary sits in the middle of the arch; with the temporal arch inside there is no room,
  // so it goes on one line just outside the open side of the arch
  const mixed = dentition === 'mixed';
  const ty = upper ? 200 : 110;
  const viewBox = mixed ? (upper ? '-16 -6 452 352' : '-16 -30 452 356') : '-16 -6 452 332';

  // Bridges: a bar between the centers of consecutive teeth of the same bridge, under the teeth
  const edges = bridgeEdges(state);
  const connectors: { x1: number; y1: number; x2: number; y2: number; color: string; key: string }[] = [];
  for (const arch of [placements.filter((x) => !x.inner), placements.filter((x) => x.inner)]) {
    arch.forEach(({ p }, i) => {
      const next = arch[i + 1]?.p;
      const edge = edges.get(p.tooth);
      if (!next || !edge || (edge !== 'start' && edge !== 'middle') || !edges.has(next.tooth)) return;
      const mark = listToothMarks(String(p.tooth), state[String(p.tooth)]).find((m) => isRangeCondition(m.condition));
      if (!mark || hidden.has(mark.status)) return;
      // Through the centers, like the bar across the crowns in the FDI chart
      connectors.push({ x1: p.x, y1: p.y, x2: next.x, y2: next.y, color: STATUS_COLOR[mark.status], key: `${p.tooth}-${next.tooth}` });
    });
  }

  return (
    <svg viewBox={viewBox} className="h-auto max-h-[520px] w-full" role="group" aria-label={upper ? t('archUpper') : t('archLower')}>
      {placements.map(({ p, inner }) => (
        <ArchTooth key={p.tooth} p={p} inner={inner} state={state} hidden={hidden} interaction={interaction} />
      ))}
      {connectors.map((c) => (
        <line key={c.key} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} className="pointer-events-none" style={{ stroke: c.color, strokeWidth: 3, strokeOpacity: 0.9, strokeLinecap: 'round' }} />
      ))}
      {mixed ? (
        <text x="210" y={upper ? 334 : -14} textAnchor="middle" style={{ fontSize: 11.5 }}>
          <tspan style={{ fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}>{upper ? t('archUpper') : t('archLower')}</tspan>
          <tspan dx="10" style={{ fill: STATUS_COLOR.indicated }}>● {t('archCount.indicated', { count: counts.indicated })}</tspan>
          <tspan dx="8" style={{ fill: STATUS_COLOR.existing }}>● {t('archCount.existing', { count: counts.existing })}</tspan>
          <tspan dx="8" style={{ fill: STATUS_COLOR.done }}>● {t('archCount.done', { count: counts.done })}</tspan>
        </text>
      ) : (
        <>
          <text x="210" y={ty} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}>
            {upper ? t('archUpper') : t('archLower')}
          </text>
          <text x="210" y={ty + 20} textAnchor="middle" style={{ fontSize: 11.5 }}>
            <tspan style={{ fill: STATUS_COLOR.indicated }}>● {t('archCount.indicated', { count: counts.indicated })}</tspan>
            <tspan dx="8" style={{ fill: STATUS_COLOR.existing }}>● {t('archCount.existing', { count: counts.existing })}</tspan>
          </text>
          <text x="210" y={ty + 38} textAnchor="middle" style={{ fontSize: 11.5, fill: STATUS_COLOR.done }}>
            ● {t('archCount.done', { count: counts.done })}
          </text>
        </>
      )}
    </svg>
  );
}

function ArchTooth({ p, inner, state, hidden, interaction }: { p: ArchPlacement; inner: boolean; state: OdontogramState; hidden: Set<string>; interaction: ChartInteraction }) {
  const n = p.tooth;
  const pendingSlots = new Set<string>();
  interaction.pendingKeys?.forEach((key) => { const [tooth, slot] = key.split('|'); if (tooth === String(n)) pendingSlots.add(slot); });
  const marks = listToothMarks(String(n), state[String(n)]).filter((m) => pendingSlots.has(m.slot) || !hidden.has(m.status));
  const colorOf = (m: OdontogramMark) => (pendingSlots.has(m.slot) ? PENDING_COLOR : STATUS_COLOR[m.status]);
  const bySurface = new Map<OdontogramSurface, OdontogramMark>();
  marks.forEach((m) => { if (m.surface) bySurface.set(m.surface, m); });
  const toothLevel = (render: ToothRender) => marks.filter((m) => !m.surface && getRender(m.condition) === render).at(-1);
  const crown = toothLevel('crown');
  const crownTmp = toothLevel('crown-tmp');
  const bridge = toothLevel('bridge');
  const removable = toothLevel('removable');
  const implant = toothLevel('implant');
  const canals = toothLevel('canals');
  const post = toothLevel('post');
  const cross = toothLevel('cross');
  const fracture = toothLevel('fracture');
  const bracket = toothLevel('bracket');
  const wire = toothLevel('wire');
  const mobility = toothLevel('mobility');
  const absent = marks.some((m) => !m.surface && isAbsenceCondition(m.condition));
  // Root and gum findings have no occlusal shape: a symbol each, along the vestibular edge
  const ROOT_RENDERS: ToothRender[] = ['apex', 'resorption', 'root-fracture', 'root-remnant', 'furcation', 'recession', 'enlargement', 'pocket'];
  const rootMarks = ROOT_RENDERS.map((render) => ({ render, mark: toothLevel(render) })).filter((x): x is { render: ToothRender; mark: OdontogramMark } => !!x.mark);

  const selected = interaction.selectedTeeth?.includes(n) ?? false;
  const single = interaction.selectedTeeth?.length === 1 && selected;
  const r = p.radius;
  const r1 = r * 0.42;
  /** Local y of the vestibular side: the diagram is turned so its top is vestibular above and lingual below */
  const vy = isUpperTooth(n) ? -1 : 1;
  const clickable = !!interaction.onSurfaceClick;
  const surfaceStyle = (surface: OdontogramSurface) => {
    const m = bySurface.get(surface);
    const picked = single && interaction.selectedSurfaces?.includes(surface);
    const render = m ? getRender(m.condition) : null;
    return {
      fill: m && render !== 'incipient' ? colorOf(m) : 'var(--odo-surf)',
      fillOpacity: m && (pendingSlots.has(m.slot) || render === 'sealant') ? 0.45 : 1,
      stroke: picked ? 'hsl(var(--primary))' : 'var(--odo-tooth-line)',
      strokeWidth: picked ? 2.4 : 1.1,
    };
  };
  const distance = inner ? -(r + 9) : r + 12;
  // Conditions without a drawing of their own (orthodontics, wear…) are named by their code; on the
  // side teeth the label goes further out so it clears the number
  const codeDistance = inner ? -(r + 19) : r + 23 + 10 * Math.abs(p.nx);
  const badgeMarks = marks.filter((m) => !m.surface && getRender(m.condition) === 'badge');
  const codes = [...new Set(badgeMarks.map((m) => getProcedure(m.condition)?.code).filter(Boolean))] as string[];
  const lastMark = badgeMarks.at(-1);
  const sectorAngle = { top: -90, right: 0, bottom: 90, left: 180 } as const;
  const incipient = [...bySurface.values()].filter((m) => getRender(m.condition) === 'incipient');

  // Root and gum symbols, plus mobility, in a row beside the tooth on the side without its number:
  // towards the inside of the arch (outwards for the temporal arch of a mixed dentition)
  const side = inner ? 1 : -1;
  const ox = p.x + p.nx * side * (r + 7);
  const oy = p.y + p.ny * side * (r + 7);
  const tx = -p.ny;
  const ty = p.nx;
  const sideItems = [...rootMarks.map((x) => ({ key: x.render, render: x.render, mark: x.mark })), ...(mobility ? [{ key: 'mobility', render: 'mobility' as ToothRender, mark: mobility }] : [])];
  const sideSymbol = ({ key, render, mark }: { key: string; render: ToothRender; mark: OdontogramMark }, i: number) => {
    const offset = (i - (sideItems.length - 1) / 2) * 9;
    const x = ox + tx * offset;
    const y = oy + ty * offset;
    const color = colorOf(mark);
    switch (render) {
      case 'apex': return <circle key={key} cx={x} cy={y} r="3" style={{ fill: 'none', stroke: color, strokeWidth: 1.6 }} />;
      case 'resorption': return <circle key={key} cx={x} cy={y} r="3" style={{ fill: 'none', stroke: color, strokeWidth: 1.4, strokeDasharray: '1.5 1.2' }} />;
      case 'root-fracture': return <path key={key} d={`M${x - 3.5} ${y - 2} l2.3 4 l2.4 -4 l2.3 4`} style={{ fill: 'none', stroke: color, strokeWidth: 1.5 }} />;
      case 'root-remnant': return <path key={key} d={`M${x - 1.6} ${y - 3.2} v6.4 M${x + 1.6} ${y - 3.2} v6.4`} style={{ stroke: color, strokeWidth: 1.6 }} />;
      case 'furcation': return <path key={key} d={`M${x - 3.4} ${y + 2.6} L${x + 3.4} ${y + 2.6} L${x} ${y - 3.2} Z`} style={{ fill: 'var(--odo-tooth)', stroke: color, strokeWidth: 1.4 }} />;
      case 'pocket': return <rect key={key} x={x - 3.5} y={y - 1.5} width="7" height="3" rx="1" style={{ fill: color }} />;
      case 'mobility': return (
        <text key={key} x={x} y={y + 2.8} textAnchor="middle" style={{ fill: color, fontSize: 7.5, fontWeight: 700 }}>
          {getProcedure(mark.condition)?.code === 'MOV_I' ? 'M1' : getProcedure(mark.condition)?.code === 'MOV_II' ? 'M2' : 'M3'}
        </text>
      );
      default: return <path key={key} d={`M${x - 3.5} ${y} q1.75 -2.6 3.5 0 t3.5 0`} style={{ fill: 'none', stroke: color, strokeWidth: 1.5, strokeDasharray: render === 'enlargement' ? '1.6 1.2' : undefined }} />;
    }
  };

  return (
    <g>
      <g
        transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`}
        className={cn(clickable && 'cursor-pointer')}
        opacity={absent ? 0.55 : 1}
        onClick={(e) => interaction.onToothClick?.(n, e)}
      >
        <circle r={r + 4} style={{ fill: selected ? 'var(--odo-sel)' : 'transparent', stroke: selected ? 'hsl(var(--primary))' : 'transparent', strokeWidth: 2.2 }} />
        {RING_POSITIONS.map((position) => {
          const surface = surfaceAt(n, position);
          return (
            <path
              key={position}
              d={sectorPath(0, 0, r1, r, position)}
              style={surfaceStyle(surface)}
              className={cn(clickable && 'hover:[stroke:hsl(var(--primary))]')}
              onClick={(e) => { if (!interaction.onSurfaceClick) return; e.stopPropagation(); interaction.onSurfaceClick(n, surface, e); }}
            />
          );
        })}
        <circle
          r={r1}
          style={surfaceStyle('center')}
          className={cn(clickable && 'hover:[stroke:hsl(var(--primary))]')}
          onClick={(e) => { if (!interaction.onSurfaceClick) return; e.stopPropagation(); interaction.onSurfaceClick(n, 'center', e); }}
        />
        {/* Crown, provisional crown, bridge and removable prosthesis: rings around the tooth */}
        {(crown || crownTmp || bridge) && (
          <circle r={r + 2.5} className="pointer-events-none" style={{ fill: 'none', stroke: colorOf((crown ?? crownTmp ?? bridge)!), strokeWidth: 2.6, strokeDasharray: crown ? undefined : crownTmp ? '4 2.5' : '5 3' }} />
        )}
        {removable && <circle r={r + 5.5} className="pointer-events-none" style={{ fill: 'none', stroke: colorOf(removable), strokeWidth: 1.6, strokeDasharray: '1.5 2.5' }} />}
        {/* Implant, root canal and post, from the occlusal side */}
        {implant ? (
          <rect x={-r1 * 0.8} y={-r1 * 0.8} width={r1 * 1.6} height={r1 * 1.6} className="pointer-events-none" style={{ fill: colorOf(implant) }} />
        ) : canals ? (
          <circle r={r1 * 0.62} className="pointer-events-none" style={{ fill: post ? 'none' : colorOf(canals), stroke: colorOf(canals), strokeWidth: 2 }} />
        ) : null}
        {post && !implant && (
          <rect x={-r1 * 0.3} y={-r1 * 0.3} width={r1 * 0.6} height={r1 * 0.6} transform="rotate(45)" className="pointer-events-none" style={{ fill: colorOf(post) }} />
        )}
        {incipient.map((m) => {
          const position = RING_POSITIONS.find((pos) => surfaceAt(n, pos) === m.surface);
          if (!position) return <circle key={m.slot} r="2.4" className="pointer-events-none" style={{ fill: colorOf(m) }} />;
          const angle = (sectorAngle[position] * Math.PI) / 180;
          const rr = (r1 + r) / 2;
          return <circle key={m.slot} cx={rr * Math.cos(angle)} cy={rr * Math.sin(angle)} r="2.4" className="pointer-events-none" style={{ fill: colorOf(m) }} />;
        })}
        {fracture && (
          <path d={`M${-r * 0.85} 0 l${r * 0.28} ${-r * 0.25} l${r * 0.29} ${r * 0.5} l${r * 0.29} ${-r * 0.5} l${r * 0.28} ${r * 0.25}`} className="pointer-events-none" style={{ fill: 'none', stroke: colorOf(fracture), strokeWidth: 2.2, strokeLinejoin: 'round' }} />
        )}
        {bracket && <rect x={-r * 0.2} y={vy * ((r1 + r) / 2) - r * 0.16} width={r * 0.4} height={r * 0.32} rx="1" className="pointer-events-none" style={{ fill: colorOf(bracket) }} />}
        {wire && <path d={`M${-r - 3} ${vy * (r + 2.5)} L${r + 3} ${vy * (r + 2.5)}`} className="pointer-events-none" style={{ stroke: colorOf(wire), strokeWidth: 1.8 }} />}
        {cross && (
          <g className="pointer-events-none" style={{ stroke: colorOf(cross), strokeWidth: 3, strokeLinecap: 'round' }}>
            <path d={`M${-r} ${-r} L${r} ${r}`} />
            <path d={`M${r} ${-r} L${-r} ${r}`} />
          </g>
        )}
      </g>
      {sideItems.length > 0 && <g className="pointer-events-none">{sideItems.map(sideSymbol)}</g>}
      <text
        x={(p.x + p.nx * distance).toFixed(1)}
        y={(p.y + p.ny * distance + 4).toFixed(1)}
        textAnchor="middle"
        style={{ fontSize: inner ? 11 : 12, fontWeight: 600, fill: inner ? '#D97706' : selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
      >
        {n}
      </text>
      {codes.length > 0 && lastMark && (
        <text
          x={(p.x + p.nx * codeDistance).toFixed(1)}
          y={(p.y + p.ny * codeDistance + 3).toFixed(1)}
          textAnchor="middle"
          className="pointer-events-none"
          style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.02em', fill: colorOf(lastMark) }}
        >
          {codes.slice(0, 2).join('·')}{codes.length > 2 ? '+' : ''}
        </text>
      )}
    </g>
  );
}
