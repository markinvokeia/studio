'use client';

import { CalendarClock, CheckCircle2, Circle, ClipboardList, MapPin, RefreshCw, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { cn, formatDateTime, formatDisplayDate } from '@/lib/utils';
import type { PatientStudyOrder, StudyOrderBoardStatus } from '@/lib/types';

const VARIANT_BY_STATUS: Record<StudyOrderBoardStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'info' | 'warning'> = {
  draft: 'outline',
  new: 'info',
  unscheduled: 'warning',
  partially_scheduled: 'warning',
  scheduled: 'default',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'destructive',
};

/** Estados de cita con traducción en `AppointmentStatus`; cualquier otro se muestra tal cual. */
const KNOWN_APPOINTMENT_STATUSES = new Set([
  'completed', 'confirmed', 'pending', 'cancelled', 'scheduled', 'arrived',
  'arrived_late', 'in_progress', 'attended_late', 'no_show',
]);

interface MyStudyOrdersTabProps {
  orders: PatientStudyOrder[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

/**
 * "Mis órdenes" del portal: los estudios que le indicaron al paciente y en qué
 * punto está cada uno. Es de sólo lectura — agendar una orden ata la cita a la
 * orden, y eso hoy lo hace la clínica (o el link de auto-agendamiento).
 *
 * Los datos los trae la página: decide con ellos si el tab se muestra.
 */
export function MyStudyOrdersTab({ orders, isLoading, hasError, onRetry }: MyStudyOrdersTabProps) {
  const t = useTranslations('PatientPortal.orders');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t('loadError')}</p>
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{t('count', { count: orders.length })}</h2>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <StudyOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudyOrderCard({ order }: { order: PatientStudyOrder }) {
  const t = useTranslations('PatientPortal.orders');
  const tAppointment = useTranslations('AppointmentStatus');

  const isCancelled = order.board_status === 'cancelled';
  const total = Number(order.items_total) || order.items.length;
  const completed = Number(order.items_completed) || 0;
  const pending = order.items.filter((item) => !item.is_scheduled && !item.is_completed).length;

  // Las citas que siguen en pie: una cancelada no le dice nada al paciente acá,
  // el estudio vuelve a figurar como pendiente de agendar.
  const appointments = order.appointments.filter(
    (a) => !['cancelled', 'canceled', 'no_show'].includes(String(a.status).toLowerCase()),
  );

  return (
    <article className={cn('overflow-hidden rounded-2xl border bg-card shadow-sm', isCancelled && 'opacity-70')}>
      <div className="space-y-3 p-3 sm:p-4">
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">{t('orderNumber', { number: order.order_number })}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('issuedOn', { date: formatDisplayDate(order.submitted_at ?? order.created_at) })}
            </p>
          </div>
          <Badge variant={VARIANT_BY_STATUS[order.board_status] ?? 'outline'} className="shrink-0 whitespace-nowrap">
            {t(`status.${order.board_status}`)}
          </Badge>
        </header>

        {(order.doctor_name || order.preferred_sede_name) && (
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {order.doctor_name && <Detail icon={Stethoscope} label={t('doctor')} value={order.doctor_name} />}
            {order.preferred_sede_name && (
              <Detail icon={MapPin} label={t('sede')} value={order.preferred_sede_name} />
            )}
          </dl>
        )}

        {!isCancelled && total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('progress', { completed, total })}</span>
              {pending > 0 && <span className="font-medium text-amber-600 dark:text-amber-400">{t('pendingCount', { count: pending })}</span>}
            </div>
            <Progress value={(completed / total) * 100} className="h-1.5" />
          </div>
        )}

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('studies')}</h3>
          <ul className="divide-y rounded-xl border">
            {order.items.map((item) => {
              const state = item.is_completed ? 'completed' : item.is_scheduled ? 'scheduled' : 'pending';
              const Icon = state === 'completed' ? CheckCircle2 : state === 'scheduled' ? CalendarClock : Circle;
              return (
                <li key={item.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      state === 'completed' && 'text-green-600 dark:text-green-400',
                      state === 'scheduled' && 'text-primary',
                      state === 'pending' && 'text-muted-foreground',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {item.service_name}
                    {Number(item.quantity) > 1 && <span className="ml-1 text-muted-foreground">×{item.quantity}</span>}
                  </span>
                  {!isCancelled && (
                    <span className="shrink-0 text-xs text-muted-foreground">{t(`itemState.${state}`)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {appointments.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('appointments')}
            </h3>
            <ul className="space-y-1.5">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <span className="flex items-center gap-1.5 font-medium tabular-nums">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {formatDateTime(appointment.start_datetime)}
                  </span>
                  {(appointment.sede_name || appointment.calendar_name) && (
                    <span className="truncate text-muted-foreground">
                      {appointment.sede_name || appointment.calendar_name}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {KNOWN_APPOINTMENT_STATUSES.has(appointment.status)
                      ? tAppointment(appointment.status)
                      : appointment.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isCancelled && pending > 0 && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t('pendingHint')}</p>
        )}
      </div>
    </article>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
    </div>
  );
}
