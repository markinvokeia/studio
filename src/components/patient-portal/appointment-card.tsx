'use client';

import { format, parseISO } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { CalendarX2, Clock, MapPin, Stethoscope } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { STATUS_BADGE_VARIANT, canReschedule } from '@/constants/appointment-status';
import type { Appointment } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AppointmentCardProps {
  appointment: Appointment;
  /** La más próxima se destaca: es la que el paciente vino a mirar. */
  isNext?: boolean;
  onReschedule: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  /** `false` ⇒ la clínica no acepta reservas online: reagendar crea una cita
   *  nueva por el mismo camino, así que se oculta junto con "Reservar". Cancelar
   *  sigue disponible siempre: no crea nada. */
  canBook?: boolean;
}

/**
 * Tarjeta de una cita futura en el portal.
 *
 * El bloque de fecha a la izquierda funciona como ancla visual —se lee de un
 * vistazo sin tener que procesar la frase completa— y deja el resto del ancho
 * para los datos. En móvil el bloque y la hora se mantienen en la misma fila,
 * y los detalles pasan a una sola columna.
 */
export function AppointmentCard({ appointment, isNext, onReschedule, onCancel, canBook = true }: AppointmentCardProps) {
  const t = useTranslations('PatientPortal.appointments');
  const tStatus = useTranslations('AppointmentStatus');
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;

  const start = React.useMemo(
    () => parseISO(`${appointment.date}T${appointment.time || '00:00'}`),
    [appointment.date, appointment.time],
  );

  /**
   * `summary` se arma como "Nombre del paciente - Servicios". Sin servicios
   * queda un "Nombre -" colgando, que no le dice nada al paciente: se recorta
   * el prefijo y, si no queda nada, no se muestra la línea.
   */
  const serviceLabel = React.useMemo(() => {
    if (appointment.service_name?.trim()) return appointment.service_name.trim();
    const summary = appointment.summary?.trim() ?? '';
    if (!summary) return '';
    const withoutPatient = summary.startsWith(`${appointment.patientName} -`)
      ? summary.slice(`${appointment.patientName} -`.length)
      : summary;
    return withoutPatient.replace(/^[\s-]+|[\s-]+$/g, '');
  }, [appointment.service_name, appointment.summary, appointment.patientName]);

  const statusVariant = (STATUS_BADGE_VARIANT[appointment.status] ?? 'default') as
    React.ComponentProps<typeof Badge>['variant'];

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors',
        isNext && 'border-primary/40 ring-1 ring-primary/20',
      )}
    >
      {isNext && (
        <p className="bg-primary/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {t('nextOne')}
        </p>
      )}

      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Bloque de fecha — ancla visual */}
          <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-primary/10 py-2 text-primary">
            <span className="text-[10px] font-semibold uppercase leading-none">
              {format(start, 'MMM', { locale: dateLocale })}
            </span>
            <span className="text-2xl font-extrabold leading-tight tabular-nums">
              {format(start, 'd')}
            </span>
            <span className="text-[10px] uppercase leading-none opacity-80">
              {format(start, 'EEE', { locale: dateLocale })}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <p className="flex items-baseline gap-1.5">
                <Clock className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
                <span className="text-2xl font-bold leading-none tabular-nums">{appointment.time}</span>
              </p>
              <Badge variant={statusVariant} className="shrink-0">
                {tStatus(appointment.status)}
              </Badge>
            </div>

            <p className="mt-1 truncate text-sm capitalize text-muted-foreground">
              {format(start, "EEEE d 'de' MMMM", { locale: dateLocale })}
            </p>

            {/* Detalles: dos columnas en desktop para no desperdiciar el ancho */}
            <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {appointment.doctorName && (
                <Detail icon={Stethoscope} label={t('doctor')} value={appointment.doctorName} />
              )}
              {appointment.calendar_name && (
                <Detail icon={MapPin} label={t('room')} value={appointment.calendar_name} />
              )}
              {serviceLabel && (
                <Detail icon={CalendarX2} label={t('service')} value={serviceLabel} className="sm:col-span-2" />
              )}
            </dl>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row">
          {canBook && canReschedule(appointment.status) && (
            <Button
              size="sm"
              variant="outline"
              className="h-10 flex-1 gap-1.5"
              onClick={() => onReschedule(appointment)}
            >
              <Clock className="h-4 w-4" />
              {t('reschedule')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-10 flex-1 gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => onCancel(appointment)}
          >
            <CalendarX2 className="h-4 w-4" />
            {t('cancel')}
          </Button>
        </div>
      </div>
    </article>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
    </div>
  );
}
