'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { OdontogramState, OdontogramSurface } from '@/lib/types';
import {
  isRangeCondition,
  LOWER_PERMANENT,
  LOWER_TEMPORAL,
  PERMANENT_LOWER_LEFT,
  PERMANENT_LOWER_RIGHT,
  PERMANENT_UPPER_LEFT,
  PERMANENT_UPPER_RIGHT,
  TEMPORAL_LOWER_LEFT,
  TEMPORAL_LOWER_RIGHT,
  TEMPORAL_UPPER_LEFT,
  TEMPORAL_UPPER_RIGHT,
  UPPER_PERMANENT,
  UPPER_TEMPORAL,
} from './odontogram-catalog';
import { listToothMarks } from './odontogram-state';
import { type BridgeEdge, OdontogramTooth } from './odontogram-tooth';

export type Dentition = 'permanent' | 'mixed' | 'temporal';

export interface ChartInteraction {
  selectedTeeth?: number[];
  selectedSurfaces?: OdontogramSurface[];
  rangeStart?: number | null;
  highlightedTeeth?: number[];
  /** `<tooth>|<slot>` of the proposals shown on the chart */
  pendingKeys?: Set<string>;
  hiddenStatuses?: string[];
  onSurfaceClick?: (tooth: number, surface: OdontogramSurface, event: React.MouseEvent) => void;
  onToothClick?: (tooth: number, event: React.MouseEvent | React.KeyboardEvent) => void;
}

/** Where each tooth sits in its bridge: by `meta.range`, or by runs of bridge marks for older sessions */
export function bridgeEdges(state: OdontogramState): Map<number, BridgeEdge> {
  const edges = new Map<number, BridgeEdge>();
  for (const arch of [UPPER_PERMANENT, LOWER_PERMANENT, UPPER_TEMPORAL, LOWER_TEMPORAL]) {
    const groupOf = (tooth: number | undefined) => {
      if (tooth == null) return null;
      const mark = listToothMarks(String(tooth), state[String(tooth)]).find((m) => isRangeCondition(m.condition));
      return mark ? mark.meta?.range ?? 'run' : null;
    };
    arch.forEach((tooth, i) => {
      const group = groupOf(tooth);
      if (!group) return;
      const prev = groupOf(arch[i - 1]) === group;
      const next = groupOf(arch[i + 1]) === group;
      edges.set(tooth, prev && next ? 'middle' : prev ? 'end' : next ? 'start' : 'single');
    });
  }
  return edges;
}

/** Lookups built once per render, so each tooth gets cheap primitive props */
export function useToothProps(state: OdontogramState, interaction: ChartInteraction) {
  const edges = React.useMemo(() => bridgeEdges(state), [state]);
  const pendingByTooth = React.useMemo(() => {
    const map = new Map<string, string[]>();
    interaction.pendingKeys?.forEach((key) => {
      const [tooth, slot] = key.split('|');
      map.set(tooth, [...(map.get(tooth) ?? []), slot]);
    });
    return map;
  }, [interaction.pendingKeys]);
  const hidden = (interaction.hiddenStatuses ?? []).join(',');
  const surfaces = (interaction.selectedSurfaces ?? []).join(',');
  const single = interaction.selectedTeeth?.length === 1 ? interaction.selectedTeeth[0] : null;

  return (tooth: number) => ({
    toothNumber: tooth,
    tooth: state[String(tooth)],
    selected: interaction.selectedTeeth?.includes(tooth) ?? false,
    rangeStart: interaction.rangeStart === tooth,
    highlighted: interaction.highlightedTeeth?.includes(tooth) ?? false,
    selectedSurfaces: single === tooth ? surfaces : '',
    pendingSlots: (pendingByTooth.get(String(tooth)) ?? []).join(','),
    hiddenStatuses: hidden,
    bridgeEdge: edges.get(tooth) ?? null,
    onSurfaceClick: interaction.onSurfaceClick,
    onToothClick: interaction.onToothClick,
  });
}

interface OdontogramChartProps extends ChartInteraction {
  state: OdontogramState;
  dentition: Dentition;
  variant?: 'regular' | 'mini';
}

/** FDI chart: two continuous arches, crowns facing the occlusal line, numbers in the middle */
export function OdontogramChart({ state, dentition, variant = 'regular', ...interaction }: OdontogramChartProps) {
  const t = useTranslations('DentalRecord.workspace');
  const toothProps = useToothProps(state, interaction);
  const mini = variant === 'mini';

  const cell = (tooth: number | null, i: number) =>
    tooth == null
      ? <div key={`empty-${i}`} />
      : <OdontogramTooth key={tooth} {...toothProps(tooth)} variant={variant} onSurfaceClick={mini ? undefined : interaction.onSurfaceClick} onToothClick={mini ? undefined : interaction.onToothClick} />;

  const row = (left: (number | null)[], right: (number | null)[], key: string) => (
    <div key={key} className="flex items-stretch">
      <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${left.length}, minmax(0, 1fr))` }}>{left.map(cell)}</div>
      <div className="relative w-2.5 shrink-0 after:absolute after:inset-y-1.5 after:left-1/2 after:border-l after:border-dashed after:border-border" />
      <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${right.length}, minmax(0, 1fr))` }}>{right.map(cell)}</div>
    </div>
  );

  const N = null;
  const upper: React.ReactNode[] = [];
  const lower: React.ReactNode[] = [];
  if (dentition !== 'temporal') upper.push(row(PERMANENT_UPPER_RIGHT, PERMANENT_UPPER_LEFT, 'up'));
  if (dentition === 'mixed') {
    upper.push(row([N, N, N, ...TEMPORAL_UPPER_RIGHT], [...TEMPORAL_UPPER_LEFT, N, N, N], 'upt'));
    lower.push(row([N, N, N, ...TEMPORAL_LOWER_RIGHT], [...TEMPORAL_LOWER_LEFT, N, N, N], 'lot'));
  }
  if (dentition === 'temporal') {
    upper.push(row(TEMPORAL_UPPER_RIGHT, TEMPORAL_UPPER_LEFT, 'upt'));
    lower.push(row(TEMPORAL_LOWER_RIGHT, TEMPORAL_LOWER_LEFT, 'lot'));
  }
  if (dentition !== 'temporal') lower.push(row(PERMANENT_LOWER_RIGHT, PERMANENT_LOWER_LEFT, 'lo'));

  return (
    <div className={cn('odo-chart mx-auto flex w-full max-w-[1160px] flex-col gap-0.5', !mini && 'min-w-[600px]')}>
      {!mini && (
        <div className="flex justify-between px-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{t('quadrant.q1')}</span><span>{t('quadrant.q2')}</span>
        </div>
      )}
      <div className="flex flex-col gap-0.5">{upper}</div>
      <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground before:flex-1 before:border-t after:flex-1 after:border-t">
        {!mini && t('archSeparator')}
      </div>
      <div className="flex flex-col gap-0.5">{lower}</div>
      {!mini && (
        <div className="flex justify-between px-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{t('quadrant.q4')}</span><span>{t('quadrant.q3')}</span>
        </div>
      )}
    </div>
  );
}
