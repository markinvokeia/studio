'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDisplayDate } from '@/lib/utils';
import { isTimeoutError } from '@/services/api';
import { LabOrdersError } from '@/services/lab-orders';

import type { LabOrder } from '@/lib/types';

/** Numeración FDI válida: permanentes 11–48 y temporales 51–85. */
export function isValidFdiTooth(n: number): boolean {
  const quadrant = Math.floor(n / 10);
  const tooth = n % 10;
  if (quadrant >= 1 && quadrant <= 4) return tooth >= 1 && tooth <= 8;
  if (quadrant >= 5 && quadrant <= 8) return tooth >= 1 && tooth <= 5;
  return false;
}

/** "16, 21 36" → [16, 21, 36]. null si algún valor no es una pieza FDI. */
export function parseTeeth(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const teeth: number[] = [];
  for (const part of parts) {
    if (!/^\d{2}$/.test(part)) return null;
    const n = Number(part);
    if (!isValidFdiTooth(n)) return null;
    if (!teeth.includes(n)) teeth.push(n);
  }
  return teeth.sort((a, b) => a - b);
}

/** Texto corto del trabajo: los servicios ("Corona ×2, Férula") o, sin ellos, la descripción. */
export function labOrderWork(order: Pick<LabOrder, 'work_summary' | 'work_description'>): string {
  return order.work_summary || order.work_description || '—';
}

/** Mensaje traducido para un error de las acciones de órdenes. */
export function useLabOrderErrorText() {
  const t = useTranslations('LabOrdersPage');
  const tCommon = useTranslations('Common');
  return React.useCallback((error: unknown) => {
    if (error instanceof LabOrdersError) return t(`errors.${error.code}`);
    if (isTimeoutError(error)) return tCommon('timeoutError');
    return getErrorMessage(error) || tCommon('genericError');
  }, [t, tCommon]);
}

/** Punto de color + nombre de la etapa. Los nombres los escribe la clínica: no se traducen. */
export function LabStageBadge({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium', className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

type LabOrderOverdueFields = Pick<LabOrder, 'is_overdue' | 'is_stage_overdue' | 'is_past_due' | 'days_past_due' | 'stage_overdue_days' | 'due_date'>;

/** Por qué está atrasada: por permanencia en la etapa, por entrega vencida o ambas. */
export function useLabOrderOverdueReasons() {
  const t = useTranslations('LabOrdersPage');
  return React.useCallback((order: LabOrderOverdueFields): string[] => {
    if (!order.is_overdue) return [];
    const reasons: string[] = [];
    if (order.is_past_due && order.due_date) {
      reasons.push(t('pastDueHint', { days: order.days_past_due, date: formatDisplayDate(order.due_date) }));
    }
    if (order.is_stage_overdue) reasons.push(t('overdueHint', { days: order.stage_overdue_days ?? 0 }));
    return reasons;
  }, [t]);
}

/** Días en la etapa actual, en rojo con aviso si la orden está atrasada (por etapa o por entrega). */
export function LabOrderDaysInStage({ order, className }: { order: Pick<LabOrder, 'days_in_stage'> & LabOrderOverdueFields; className?: string }) {
  const t = useTranslations('LabOrdersPage');
  const overdueReasons = useLabOrderOverdueReasons();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs',
        order.is_overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
        className,
      )}
      title={order.is_overdue ? overdueReasons(order).join(' · ') : undefined}
    >
      {order.is_overdue && <AlertTriangle className="h-3.5 w-3.5" aria-label={t('overdue')} />}
      {t('daysInStage', { count: order.days_in_stage })}
    </span>
  );
}
