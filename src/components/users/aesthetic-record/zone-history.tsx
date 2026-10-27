'use client';

import React from 'react';
import { subMonths } from 'date-fns';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn, formatDate, formatDisplayDate } from '@/lib/utils';

import type { AestheticDoseUnit, AestheticSession, AestheticZoneId } from '@/lib/types';
import { parseZoneId, UNIT_COLORS, ZONE_ORDER } from './map-templates';
import { useZoneLabel } from './use-zone-label';

type Period = '3' | '6' | '12' | 'all';
const PERIODS: Period[] = ['3', '6', '12', 'all'];
const NO_ZONE_KEY = '__none__';

interface ProductTotal {
  name: string;
  unit: AestheticDoseUnit;
  quantity: number;
  points: number;
}

interface ZoneRow {
  key: AestheticZoneId | typeof NO_ZONE_KEY;
  products: ProductTotal[];
  sessionIds: Set<string>;
  lastDate: string;
}

export function buildZoneRows(sessions: AestheticSession[], fromDate: string | null): ZoneRow[] {
  const rows = new Map<string, ZoneRow>();
  for (const session of sessions) {
    if (fromDate && session.date < fromDate) continue;
    for (const point of session.points) {
      const key = point.zone ?? NO_ZONE_KEY;
      const row = rows.get(key) ?? { key, products: [], sessionIds: new Set<string>(), lastDate: session.date };
      row.sessionIds.add(session.id);
      if (session.date > row.lastDate) row.lastDate = session.date;
      const name = point.productName.trim();
      const product = row.products.find((p) => p.name === name && p.unit === point.unit);
      if (product) {
        product.quantity += point.quantity ?? 0;
        product.points += 1;
      } else {
        row.products.push({ name, unit: point.unit, quantity: point.quantity ?? 0, points: 1 });
      }
      rows.set(key, row);
    }
  }
  const rank = (key: ZoneRow['key']) => {
    if (key === NO_ZONE_KEY) return [ZONE_ORDER.length, 0];
    const { base, side } = parseZoneId(key);
    return [ZONE_ORDER.indexOf(base), side === 'left' ? 2 : side === 'right' ? 1 : 0];
  };
  return [...rows.values()].sort((a, b) => {
    const [za, sa] = rank(a.key);
    const [zb, sb] = rank(b.key);
    return za - zb || sa - sb;
  });
}

const formatQuantity = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''));

interface ZoneHistoryProps {
  sessions: AestheticSession[];
  selectedZone?: AestheticZoneId | null;
  onHoverZone?: (zone: AestheticZoneId | null) => void;
  /** Clicking a row pins its zone on the map; clicking it again clears it */
  onSelectZone?: (zone: AestheticZoneId | null) => void;
}

export function ZoneHistory({ sessions, selectedZone, onHoverZone, onSelectZone }: ZoneHistoryProps) {
  const t = useTranslations('AestheticRecord');
  const zoneLabel = useZoneLabel();
  const [period, setPeriod] = React.useState<Period>('12');

  const fromDate = period === 'all' ? null : formatDate(subMonths(new Date(), Number(period)));
  const rows = React.useMemo(() => buildZoneRows(sessions, fromDate), [sessions, fromDate]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t('zoneHistory.title')}</h3>
          {onSelectZone && rows.length > 0 && <p className="text-[11px] text-muted-foreground">{t('zoneHistory.selectHint')}</p>}
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs" aria-label={t('zoneHistory.period')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p} value={p}>{t(`zoneHistory.periods.${p}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t('zoneHistory.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {rows.map((row) => {
            const zone = row.key === NO_ZONE_KEY ? null : row.key;
            const isSelected = !!zone && selectedZone === zone;
            return (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={!zone || !onSelectZone}
                  aria-pressed={isSelected}
                  onClick={() => onSelectZone?.(isSelected ? null : zone)}
                  onPointerEnter={() => onHoverZone?.(zone)}
                  onPointerLeave={() => onHoverZone?.(null)}
                  className={cn(
                    'flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 disabled:cursor-default sm:flex-row sm:items-start sm:gap-4',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  <div className="min-w-0 sm:w-48 sm:shrink-0">
                    <p className="text-sm font-medium text-foreground">{row.key === NO_ZONE_KEY ? t('zones.none') : zoneLabel(row.key)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('zoneHistory.sessions', { count: row.sessionIds.size })} · {t('zoneHistory.last', { date: formatDisplayDate(row.lastDate) })}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {row.products.map((product) => (
                      <Badge key={`${product.name}|${product.unit}`} variant="outline" className="gap-1.5 font-normal">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: UNIT_COLORS[product.unit] }} aria-hidden />
                        <span className={cn(!product.name && 'italic text-muted-foreground')}>{product.name || t('point.noProduct')}</span>
                        <span className="font-semibold">{formatQuantity(product.quantity)} {product.unit}</span>
                        <span className="text-muted-foreground">· {t('zoneHistory.points', { count: product.points })}</span>
                      </Badge>
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { formatQuantity };
