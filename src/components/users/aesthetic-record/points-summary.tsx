'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { AestheticDoseUnit, AestheticPoint } from '@/lib/types';
import { UNIT_COLORS } from './map-templates';
import { useZoneLabel } from './use-zone-label';
import { formatQuantity } from './zone-history';

export const isPointIncomplete = (point: AestheticPoint) => !point.productName.trim() || point.quantity == null || point.quantity <= 0;

interface PointsSummaryProps {
  points: AestheticPoint[];
  pointNumbers: Map<string, number>;
  selectedPointId: string | null;
  isEditing: boolean;
  /** Mark the incomplete points as errors (after a blocked save) */
  showErrors?: boolean;
  onSelectPoint: (point: AestheticPoint) => void;
  /** Detail shown under the selected row, so a point is picked and edited in the same place */
  renderDetail?: (point: AestheticPoint) => React.ReactNode;
}

export function PointsSummary({ points, pointNumbers, selectedPointId, isEditing, showErrors = false, onSelectPoint, renderDetail }: PointsSummaryProps) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const selectedRowRef = React.useRef<HTMLLIElement>(null);

  // A point picked on the map (or just added) opens below the fold otherwise
  React.useEffect(() => {
    if (selectedPointId) selectedRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedPointId]);

  const totals = React.useMemo(() => {
    const map = new Map<string, { name: string; unit: AestheticDoseUnit; quantity: number }>();
    for (const point of points) {
      const name = point.productName.trim();
      const key = `${name}|${point.unit}`;
      const entry = map.get(key) ?? { name, unit: point.unit, quantity: 0 };
      entry.quantity += point.quantity ?? 0;
      map.set(key, entry);
    }
    return [...map.values()];
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
        {isEditing ? t('map.emptyEditing') : t('map.empty')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('map.totals')}</span>
        <div className="flex flex-wrap gap-1.5">
          {totals.map((total) => (
            <span key={`${total.name}|${total.unit}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: UNIT_COLORS[total.unit] }} aria-hidden />
              <span className={cn(!total.name && 'italic text-muted-foreground')}>{total.name || t('point.noProduct')}</span>
              <span className="font-semibold">{formatQuantity(total.quantity)} {total.unit}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('map.pointsTitle', { count: points.length })}</span>
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border">
          {points.map((point) => {
            const incomplete = isPointIncomplete(point);
            const isSelected = selectedPointId === point.id;
            return (
              <li key={point.id} ref={isSelected ? selectedRowRef : undefined} className="scroll-my-3">
                <button
                  type="button"
                  onClick={() => onSelectPoint(point)}
                  aria-expanded={renderDetail ? isSelected : undefined}
                  aria-pressed={renderDetail ? undefined : isSelected}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50',
                    isSelected && 'bg-primary/5',
                    incomplete && showErrors && 'bg-destructive/5 hover:bg-destructive/10',
                  )}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: UNIT_COLORS[point.unit] }}
                    aria-hidden
                  >
                    {pointNumbers.get(point.id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{point.zone ? zoneLabel(point.zone) : t('zones.none')}</span>
                    <span className={cn('block truncate text-muted-foreground', !point.productName && 'italic')}>
                      {point.productName || t('point.noProduct')}
                      {point.depth ? ` · ${t(`depths.${point.depth}`)}` : ''}
                    </span>
                  </span>
                  {incomplete && isEditing ? (
                    <AlertTriangle className={cn('h-4 w-4 shrink-0', showErrors ? 'text-destructive' : 'text-amber-500')} aria-label={t('map.incompletePoint')} />
                  ) : (
                    <span className="shrink-0 font-semibold text-foreground">
                      {point.quantity != null ? `${formatQuantity(point.quantity)} ${point.unit}` : '—'}
                    </span>
                  )}
                  {renderDetail && (
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isSelected && 'rotate-180')} aria-hidden />
                  )}
                </button>
                {isSelected && renderDetail?.(point)}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
