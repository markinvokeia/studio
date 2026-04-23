'use client';

import { cn } from '@/lib/utils';
import type { ToothCondition, ToothConditionType } from '@/lib/types';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import 'react-odontogram/style.css';
import type { ToothConditionGroup } from 'react-odontogram';

const Odontogram = dynamic(
  () => import('react-odontogram').then((m) => m.Odontogram),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" /> },
);

export const CONDITION_COLORS: Record<ToothConditionType, { fill: string; outline: string; label: string }> = {
  healthy:    { fill: '#22c55e', outline: '#16a34a', label: 'healthy' },
  caries:     { fill: '#ef4444', outline: '#dc2626', label: 'caries' },
  filling:    { fill: '#3b82f6', outline: '#2563eb', label: 'filling' },
  crown:      { fill: '#eab308', outline: '#ca8a04', label: 'crown' },
  missing:    { fill: '#9ca3af', outline: '#6b7280', label: 'missing' },
  implant:    { fill: '#a855f7', outline: '#9333ea', label: 'implant' },
  root_canal: { fill: '#f97316', outline: '#ea580c', label: 'root_canal' },
  bridge:     { fill: '#06b6d4', outline: '#0891b2', label: 'bridge' },
  impacted:   { fill: '#ec4899', outline: '#db2777', label: 'impacted' },
  extracted:  { fill: '#374151', outline: '#1f2937', label: 'extracted' },
};

const CONDITION_ORDER: ToothConditionType[] = [
  'healthy', 'caries', 'filling', 'crown', 'missing',
  'implant', 'root_canal', 'bridge', 'impacted', 'extracted',
];

const CONDITION_ICONS: Record<ToothConditionType, string> = {
  healthy:    '✓',
  caries:     'C',
  filling:    'O',
  crown:      '♛',
  missing:    '✕',
  implant:    'I',
  root_canal: 'R',
  bridge:     'B',
  impacted:   'X',
  extracted:  'E',
};

/** Convert session odontogram conditions → react-odontogram teethConditions format */
function toTeethConditions(conditions: ToothCondition[]): ToothConditionGroup[] {
  const grouped: Record<ToothConditionType, string[]> = {} as Record<ToothConditionType, string[]>;
  for (const tc of conditions) {
    if (!grouped[tc.condition]) grouped[tc.condition] = [];
    grouped[tc.condition].push(tc.toothId);
  }
  return Object.entries(grouped).map(([cond, teeth]) => {
    const c = CONDITION_COLORS[cond as ToothConditionType];
    return {
      label: cond,
      teeth,
      fillColor: c.fill,
      outlineColor: c.outline,
    };
  });
}

interface OdontogramViewProps {
  conditions: ToothCondition[];
  activeTool: ToothConditionType;
  onActiveTool: (t: ToothConditionType) => void;
  onToothClick: (toothId: string) => void;
}

export function OdontogramView({ conditions, activeTool, onActiveTool, onToothClick }: OdontogramViewProps) {
  const t = useTranslations('DentalRecord');
  const { resolvedTheme } = useTheme();
  const isMobile = useViewportNarrow(768);

  const teethConditions = toTeethConditions(conditions);

  return (
    <div className="flex flex-col gap-4">
      {/* Condition toolbar */}
      <div className="flex flex-wrap gap-1.5">
        {CONDITION_ORDER.map((cond) => {
          const colors = CONDITION_COLORS[cond];
          const isActive = activeTool === cond;
          return (
            <button
              key={cond}
              title={t(`conditions.${cond}`)}
              onClick={() => onActiveTool(cond)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-all',
                isActive
                  ? 'text-white shadow-sm scale-105'
                  : 'bg-background text-foreground border-border hover:border-current hover:scale-105',
              )}
              style={
                isActive
                  ? { backgroundColor: colors.fill, borderColor: colors.outline }
                  : { color: colors.fill, borderColor: 'transparent' }
              }
            >
              <span
                className="h-3 w-3 rounded-sm flex items-center justify-center text-[8px] font-bold"
                style={{ backgroundColor: colors.fill, color: '#fff' }}
              >
                {CONDITION_ICONS[cond]}
              </span>
              <span className="hidden sm:inline">{t(`conditions.${cond}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Active tool indicator */}
      <p className="text-xs text-muted-foreground">
        Herramienta activa:{' '}
        <span
          className="font-semibold"
          style={{ color: CONDITION_COLORS[activeTool].fill }}
        >
          {t(`conditions.${activeTool}`)}
        </span>
        {' '}— Haz clic en un diente para aplicar
      </p>

      {/* Odontogram chart
          Mobile: circle layout (curved arch, ~0.6:1 ratio — shows natural jaw shape)
          Desktop: square layout (flat linear rows, 6:1 ratio — compact in wide panels) */}
      <div className={cn('w-full', isMobile && 'max-h-[60vh] overflow-y-auto')}>
        <Odontogram
          layout={isMobile ? 'circle' : 'square'}
          notation="FDI"
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          showLabels
          showTooltip
          teethConditions={teethConditions}
          onChange={(selected) => {
            if (selected.length > 0) {
              const last = selected[selected.length - 1];
              onToothClick(last.notations.fdi);
            }
          }}
          styles={{ width: '100%', maxWidth: '100%' }}
        />
      </div>
    </div>
  );
}
