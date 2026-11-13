'use client';

import * as React from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { AlertTriangle, Building2, CalendarClock, CalendarX2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDisplayDate } from '@/lib/utils';
import { isTimeoutError } from '@/services/api';
import { LabOrdersError } from '@/services/lab-orders';

import type { LabOrder, LabStage } from '@/lib/types';

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

/**
 * Días en la etapa actual. En rojo, con el máximo de la etapa a la vista, solo cuando se pasó
 * de ese máximo; la entrega vencida se muestra aparte (`LabOrderPastDueBadge`), para que cada
 * aviso diga su motivo sin depender de un tooltip.
 */
export function LabOrderDaysInStage({
  order, className,
}: { order: Pick<LabOrder, 'days_in_stage' | 'is_stage_overdue' | 'stage_overdue_days'>; className?: string }) {
  const t = useTranslations('LabOrdersPage');
  const overdue = order.is_stage_overdue;
  const max = order.stage_overdue_days;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs',
        overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
        className,
      )}
      title={overdue ? t('overdueHint', { days: order.stage_overdue_days ?? 0 }) : undefined}
    >
      {overdue && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
      {/* Los días son completos: con el máximo recién pasado (3 días y horas, máx. 3) se dice "Más de 3 días". */}
      {overdue && max != null && order.days_in_stage <= max
        ? t('daysOverLimit', { days: max })
        : t('daysInStage', { count: order.days_in_stage })}
      {overdue && max != null && order.days_in_stage > max && (
        <span className="font-normal">· {t('stageOverdueMax', { days: max })}</span>
      )}
    </span>
  );
}

/**
 * Etapa que sigue a la actual en el orden configurado (el paso natural del circuito).
 * null si la orden ya está en una etapa final o no hay ninguna después.
 */
export function nextLabStage(stages: LabStage[], currentStageId: number): LabStage | null {
  const index = stages.findIndex((s) => s.id === currentStageId);
  if (index < 0 || stages[index].kind === 'final') return null;
  return stages[index + 1] ?? null;
}

/**
 * Progreso de la orden en el circuito: las etapas no finales en orden y, al final, la final
 * en la que está (o la primera final, si todavía no llegó). Varias finales (entregada,
 * cancelada…) no se muestran todas: son destinos alternativos, no pasos.
 */
export function LabStageProgress({ stages, currentStageId, className }: { stages: LabStage[]; currentStageId: number; className?: string }) {
  const t = useTranslations('LabOrdersPage');
  const current = stages.find((s) => s.id === currentStageId);
  if (!current) return null;
  const lastStep = current.kind === 'final' ? current : stages.find((s) => s.kind === 'final');
  const steps = [...stages.filter((s) => s.kind !== 'final'), ...(lastStep ? [lastStep] : [])];
  const currentIndex = steps.findIndex((s) => s.id === current.id);
  if (steps.length < 2) return null;

  return (
    <ol data-help-id="lab-orders.section.stage-progress" aria-label={t('detail.progress')} className={cn('flex items-start', className)}>
      {steps.map((stage, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return (
          <li
            key={stage.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn('absolute right-1/2 top-[7px] h-0.5 w-full', i <= currentIndex ? 'bg-muted-foreground/50' : 'bg-border')}
              />
            )}
            <span
              className={cn(
                'relative z-10 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 bg-background',
                state === 'todo' && 'border-border',
                state === 'current' && 'ring-4 ring-primary/10',
              )}
              style={state !== 'todo' ? { borderColor: stage.color, backgroundColor: state === 'done' ? stage.color : undefined } : undefined}
            >
              {state === 'done' && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden="true" />}
              {state === 'current' && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />}
            </span>
            <span
              title={stage.name}
              className={cn(
                'line-clamp-2 break-words px-0.5 text-[11px] leading-tight',
                state === 'current' ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {stage.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Fecha ISO UTC del backend (con o sin Z) en milisegundos, como la lee `formatUtcDateTime`. */
function utcMs(iso: string): number {
  return parseISO(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
}

/** "Estuvo 4 días" / "Estuvo 5 horas": cuánto pasó entre dos movimientos del historial. */
export function useLabStayText() {
  const t = useTranslations('LabOrdersPage');
  return React.useCallback((fromIso: string, toIso: string): string | null => {
    const ms = utcMs(toIso) - utcMs(fromIso);
    if (!Number.isFinite(ms) || ms < 0) return null;
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 24) return t('detail.stayedDays', { days: Math.floor(hours / 24) });
    if (hours >= 1) return t('detail.stayedHours', { hours });
    return t('detail.stayedLessThanHour');
  }, [t]);
}

const PILL ='inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium';

/** "Vencida hace N días": la fecha de entrega pasó y la orden no llegó a una etapa final. */
export function LabOrderPastDueBadge({
  order, className,
}: { order: Pick<LabOrder, 'is_past_due' | 'days_past_due' | 'due_date'>; className?: string }) {
  const t = useTranslations('LabOrdersPage');
  if (!order.is_past_due) return null;
  return (
    <span
      className={cn(PILL, 'border-destructive/40 bg-destructive/10 text-destructive', className)}
      title={order.due_date ? t('pastDueHint', { days: order.days_past_due, date: formatDisplayDate(order.due_date) }) : undefined}
    >
      <CalendarX2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{t('pastDueBadge', { days: order.days_past_due })}</span>
    </span>
  );
}

/** Días que faltan para la fecha de entrega ('YYYY-MM-DD', día local). Negativo si ya pasó. */
export function daysUntilDue(dueDate: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(dueDate.slice(0, 10)), today);
}

/** Ventana de "vence pronto": hoy y los 6 días siguientes. */
export const DUE_SOON_DAYS = 7;

/**
 * Entrega de una orden pendiente, relativa a hoy: "Vencida hace N días" (rojo), "Vence hoy" /
 * "Vence mañana" (ámbar), "Vence en N días" dentro de la semana y, más lejos, la fecha. La fecha
 * exacta queda en el tooltip. Con `onlySoon` no muestra nada si falta más de una semana (para
 * la lista, que ya tiene la fecha en su columna).
 */
export function LabOrderDueLabel({
  order, onlySoon = false, className,
}: { order: Pick<LabOrder, 'due_date' | 'is_pending' | 'is_past_due' | 'days_past_due'>; onlySoon?: boolean; className?: string }) {
  const t = useTranslations('LabOrdersPage');
  if (!order.due_date || !order.is_pending) return null;
  if (order.is_past_due) return <LabOrderPastDueBadge order={order} className={className} />;
  const days = daysUntilDue(order.due_date);
  const date = formatDisplayDate(order.due_date);
  if (days >= DUE_SOON_DAYS || days < 0) {
    return onlySoon ? null : <span className={cn('truncate text-[11px] text-muted-foreground', className)}>{t('dueShort', { date })}</span>;
  }
  const text = days === 0 ? t('dueToday') : days === 1 ? t('dueTomorrow') : t('dueInDays', { days });
  return (
    <span
      title={t('dueShort', { date })}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[11px]',
        days <= 1 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
        className,
      )}
    >
      <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Orden pendiente sin laboratorio: avisa antes de que se pida al moverla a una etapa no final. */
export function LabOrderNoLabBadge({
  order, className,
}: { order: Pick<LabOrder, 'laboratory_id' | 'is_pending'>; className?: string }) {
  const t = useTranslations('LabOrdersPage');
  if (order.laboratory_id || !order.is_pending) return null;
  return (
    <span
      className={cn(PILL, 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400', className)}
      title={t('noLaboratoryHint')}
    >
      <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{t('noLaboratory')}</span>
    </span>
  );
}
