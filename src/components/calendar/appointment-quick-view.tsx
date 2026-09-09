'use client';

import * as React from 'react';
import { CalendarDays, MapPin, Pencil, Phone, Stethoscope, StickyNote, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import { formatDisplayDateWithWeekday } from '@/lib/utils';
import type { Appointment } from '@/lib/types';

import { GOOGLE_IMPORT_BADGE_COLOR } from './calendar-constants';

interface AppointmentQuickViewProps {
  appointment: Appointment;
  /** Rect de la card clickeada, en coordenadas de viewport (getBoundingClientRect). */
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
  /** 'es' | 'en', para el nombre del día de la semana. */
  locale?: string;
}

/**
 * `HH:mm` de un `dateTime` de la API.
 *
 * Se le saca la `Z` y se corta el string en vez de construir un `Date`: la API manda
 * la hora local de la clínica marcada como UTC, así que parsearla la correría tres
 * horas (ver la skill `date-formatting`).
 */
function timeOf(value: unknown): string {
  if (typeof value !== 'string') return '';
  const timePart = value.replace(/Z$/, '').split('T')[1];
  return timePart ? timePart.slice(0, 5) : '';
}

/** Fila de dato: ícono + valor. No se renderiza si no hay valor. */
function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 break-words text-xs text-foreground" title={label}>
        {value}
      </span>
    </div>
  );
}

/**
 * Ventana flotante de detalle de una cita, al estilo de Google Calendar: se abre con un
 * clic simple sobre la card y muestra lo esencial sin cargar nada del backend.
 *
 * Se usa en el modo `custom` del calendario, donde el clic simple no abría nada y la
 * edición es la tarjeta inline; en el modo normal ese clic sigue abriendo el panel
 * lateral completo.
 */
export function AppointmentQuickView({
  appointment,
  anchorRect,
  onClose,
  onEdit,
  locale = 'es',
}: AppointmentQuickViewProps) {
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');

  // El ancla queda fija en las coordenadas donde estaba la card: si el usuario
  // scrollea la grilla, la card se mueve y el popover quedaría flotando en el aire.
  React.useEffect(() => {
    const close = () => onClose();
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [onClose]);

  const isImported = appointment.imported_from_google === true;
  const patientName = appointment.patientName && appointment.patientName !== 'N/A'
    ? appointment.patientName
    : '';
  // Las citas importadas de Google no traen paciente: su título es el summary del evento.
  const title = (isImported ? appointment.summary : patientName || appointment.summary) || t('createDialog.none');
  // El mapeo deja 'N/A' cuando la cita no trae teléfono; no se muestra la fila.
  const patientPhone = (appointment.patientPhone || '').trim();
  const phone = patientPhone === 'N/A' ? '' : patientPhone;

  const treatment = (appointment.services ?? [])
    .map((service) => (service?.name || '').trim())
    .filter(Boolean)
    .join(', ');

  const startTime = timeOf(appointment.start?.dateTime);
  const endTime = timeOf(appointment.end?.dateTime);
  const dateLine = [
    formatDisplayDateWithWeekday(appointment.start?.dateTime, locale),
    startTime && endTime ? `${startTime} – ${endTime}` : startTime,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const accentColor = STATUS_ACCENT_COLOR[appointment.status] ?? appointment.color;

  // En la vista de agenda (y en móvil) la card ocupa casi todo el ancho, así que
  // anclar el popover "a la derecha" lo deja sin espacio: Radix lo aplasta contra
  // el borde izquierdo o lo empuja fuera de pantalla. Si el ancla es ancha
  // respecto al viewport, se abre debajo de la fila.
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const side = anchorRect.width > viewportWidth * 0.6 ? 'bottom' : 'right';

  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor asChild>
        <div
          aria-hidden
          className="pointer-events-none fixed"
          style={{
            left: anchorRect.left,
            top: anchorRect.top,
            width: anchorRect.width,
            height: anchorRect.height,
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        data-testid="appointment-quick-view"
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0"
        onContextMenu={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={tColumns('edit')}
            onClick={() => onEdit(appointment)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t('createDialog.close')}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 px-4 pb-4">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-1 h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: accentColor || 'hsl(var(--primary))' }}
            />
            <div className="min-w-0 space-y-0.5">
              <h3 className="break-words text-sm font-semibold leading-snug text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">{dateLine}</p>
            </div>
          </div>

          {isImported && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${GOOGLE_IMPORT_BADGE_COLOR}1a`, color: GOOGLE_IMPORT_BADGE_COLOR }}
            >
              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
              {t('importedFromGoogle')}
            </span>
          )}

          <div className="space-y-2">
            <Row icon={Stethoscope} label={tColumns('service')} value={treatment} />
            {/* Con paciente en el título, el nombre no se repite acá. */}
            {isImported && <Row icon={UserRound} label={tColumns('patient')} value={patientName} />}
            <Row icon={Phone} label={tColumns('phone')} value={phone} />
            <Row icon={UserRound} label={tColumns('doctor')} value={appointment.doctorName} />
            <Row icon={MapPin} label={tColumns('calendar')} value={appointment.calendar_name} />
            <Row icon={StickyNote} label={t('createDialog.notes')} value={appointment.notes} />
          </div>

          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium"
            style={{ color: accentColor }}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
            {tStatus(appointment.status)}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
