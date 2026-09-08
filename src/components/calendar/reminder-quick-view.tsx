'use client';

import * as React from 'react';
import { CalendarDays, FileText, Flag, Lock, MapPin, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

import { formatDisplayDateWithWeekday } from '@/lib/utils';
import type { CalendarReminder } from '@/lib/types';

interface ReminderQuickViewProps {
  reminder: CalendarReminder;
  /** Rect de la card clickeada, en coordenadas de viewport (getBoundingClientRect). */
  anchorRect: DOMRect;
  /** Nombre del calendario al que pertenece, ya resuelto por el consumidor. */
  calendarName?: string | null;
  onClose: () => void;
  onEdit: (reminder: CalendarReminder) => void;
  /** 'es' | 'en', para el nombre del día de la semana. */
  locale?: string;
}

/**
 * `HH:mm` de un `start_datetime` / `end_datetime`.
 *
 * Se le saca la `Z` y se corta el string en vez de construir un `Date`: la API manda la
 * hora local de la clínica marcada como UTC, así que parsearla la correría (ver la skill
 * `date-formatting`).
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
 * Ventana flotante de detalle de una nota o recordatorio, hermana de
 * `AppointmentQuickView` y con la misma mecánica.
 *
 * Se usa en el modo `custom` del calendario; en el modo normal el clic simple sigue
 * abriendo el panel lateral, que además trae los atajos de IA.
 */
export function ReminderQuickView({
  reminder,
  anchorRect,
  calendarName,
  onClose,
  onEdit,
  locale = 'es',
}: ReminderQuickViewProps) {
  const t = useTranslations('Reminders');

  // El ancla queda fija en las coordenadas donde estaba la card: si el usuario scrollea
  // la grilla, la card se mueve y el popover quedaría flotando en el aire.
  React.useEffect(() => {
    const close = () => onClose();
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [onClose]);

  const isNote = reminder.type === 'note';
  const isPersonal = reminder.visibility === 'personal';

  const startTime = timeOf(reminder.start_datetime);
  const endTime = timeOf(reminder.end_datetime);
  const dateLine = [
    formatDisplayDateWithWeekday(reminder.start_datetime, locale),
    startTime && endTime ? `${startTime} – ${endTime}` : startTime,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const accentColor = reminder.color || '#8b5cf6';

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
        data-testid="reminder-quick-view"
        side="right"
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
            title={t('edit')}
            onClick={() => onEdit(reminder)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t('dismiss')}
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
              style={{ backgroundColor: accentColor }}
            />
            <div className="min-w-0 space-y-0.5">
              <h3 className="break-words text-sm font-semibold leading-snug text-foreground">
                {reminder.title}
              </h3>
              <p className="text-xs text-muted-foreground">{dateLine}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {isNote ? <FileText className="h-3 w-3 shrink-0" aria-hidden /> : <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />}
              {t(isNote ? 'nota' : 'recordatorio')}
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t(`status.${reminder.status}`)}
            </span>
            {/* Solo se rotula la excepción: lo compartido es el default del modelo. */}
            {isPersonal && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-500 px-1.5 py-0.5 text-[11px] font-medium text-white">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                {t('personalBadge')}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Row icon={FileText} label={t('descriptionLabel')} value={reminder.description} />
            {/* Las notas no tienen prioridad, igual que en el panel lateral. */}
            {!isNote && (
              <Row icon={Flag} label={t('priorityLabel')} value={t(`priority.${reminder.priority.toLowerCase()}`)} />
            )}
            <Row icon={MapPin} label={t('calendarLabel')} value={calendarName} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
